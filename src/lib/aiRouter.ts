/**
 * VELO 2.0 — Credit-Aware AI Router
 *
 * Routes AI generation requests between:
 *   1. Cloud AI  — OnSpace AI (Gemini 3 Flash) via Edge Function
 *   2. Local AI  — Ollama running at localhost:11434 (free, open-source)
 *
 * Modes:
 *   cloud        — Always use cloud (default when credits available)
 *   local        — Always use local Ollama
 *   hybrid       — Cloud first, auto-fallback to local on credit exhaustion or error
 *   cost_optimized — Use local for simple tasks, cloud for complex ones
 *
 * Credit exhaustion detection:
 *   - HTTP 429 / 402 / 503 from cloud endpoint
 *   - Response body contains: "quota", "credits", "exhausted", "rate limit"
 *   - After 3 consecutive cloud failures, forces local mode
 */

import { generateAIContent, type GenerateContentParams } from '@/lib/api';
import { toast } from 'sonner';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export type AIMode = 'cloud' | 'local' | 'hybrid' | 'cost_optimized';

export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
  details?: {
    family: string;
    parameter_size: string;
    quantization_level: string;
  };
}

export interface AIRouterState {
  mode: AIMode;
  ollamaAvailable: boolean;
  ollamaChecked: boolean;
  availableModels: OllamaModel[];
  selectedModel: string;
  cloudCreditsOk: boolean;
  consecutiveCloudFailures: number;
  forcedLocalMode: boolean;
  totalRequests: number;
  cloudRequests: number;
  localRequests: number;
  cachedRequests: number;
}

export interface AIRouterOptions {
  /** Override the global mode for this one call */
  modeOverride?: AIMode;
  /** Cache key — if provided, result will be cached and reused */
  cacheKey?: string;
  /** True for simple/short tasks (uses smaller/faster local model) */
  isSimpleTask?: boolean;
  /** If true, does NOT fallback on cloud failure — returns error */
  noFallback?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────
const OLLAMA_BASE = 'http://localhost:11434';
const OLLAMA_TIMEOUT_MS = 60_000;    // 60s for generation
const OLLAMA_HEALTH_TIMEOUT = 2_500; // 2.5s for health check

/** Preferred models in priority order — first available is used */
const PREFERRED_MODELS = [
  'llama3:8b',
  'llama3',
  'mistral',
  'mistral:7b',
  'qwen2:7b',
  'qwen:7b',
  'phi3',
  'phi3:mini',
  'phi3:medium',
  'gemma2:9b',
  'gemma:7b',
  'deepseek-r1:7b',
  'llama3.2:3b',    // lightweight fallback
  'llama3.2:1b',    // ultra-lightweight fallback
  'tinyllama',      // last resort
];

/** Models well-suited for simple/fast tasks */
const SIMPLE_TASK_MODELS = [
  'llama3.2:3b',
  'llama3.2:1b',
  'phi3:mini',
  'tinyllama',
];

/** Credit exhaustion indicators in cloud error messages */
const CREDIT_EXHAUSTION_SIGNALS = [
  'quota', 'credit', 'exhausted', 'rate limit', 'insufficient', 'billing',
  'balance', 'limit exceeded', '429', '402', 'payment required',
];

const LS_KEY_MODE = 'velo2_ai_mode';
const LS_KEY_MODEL = 'velo2_ai_model';
const LS_KEY_CLOUD_OK = 'velo2_ai_cloud_ok';

// ─────────────────────────────────────────────────────────────────────────────
// Result cache (in-memory, cleared on page refresh)
// ─────────────────────────────────────────────────────────────────────────────
const resultCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const entry = resultCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    resultCache.delete(key);
    return null;
  }
  return entry.text;
}

function setCache(key: string, text: string) {
  resultCache.set(key, { text, timestamp: Date.now() });
  // Limit cache size to 100 entries
  if (resultCache.size > 100) {
    const oldest = resultCache.keys().next().value;
    if (oldest) resultCache.delete(oldest);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Router singleton state
// ─────────────────────────────────────────────────────────────────────────────
let _state: AIRouterState = {
  mode: (localStorage.getItem(LS_KEY_MODE) as AIMode) || 'hybrid',
  ollamaAvailable: false,
  ollamaChecked: false,
  availableModels: [],
  selectedModel: localStorage.getItem(LS_KEY_MODEL) || '',
  cloudCreditsOk: localStorage.getItem(LS_KEY_CLOUD_OK) !== 'false',
  consecutiveCloudFailures: 0,
  forcedLocalMode: false,
  totalRequests: 0,
  cloudRequests: 0,
  localRequests: 0,
  cachedRequests: 0,
};

type StateListener = (state: AIRouterState) => void;
const _listeners: StateListener[] = [];

function _setState(updates: Partial<AIRouterState>) {
  _state = { ..._state, ...updates };
  _listeners.forEach(fn => fn(_state));
}

export function subscribeToRouterState(fn: StateListener): () => void {
  _listeners.push(fn);
  fn(_state); // emit current state immediately
  return () => {
    const idx = _listeners.indexOf(fn);
    if (idx >= 0) _listeners.splice(idx, 1);
  };
}

export function getRouterState(): AIRouterState {
  return { ..._state };
}

// ─────────────────────────────────────────────────────────────────────────────
// Ollama health check + model discovery
// ─────────────────────────────────────────────────────────────────────────────
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_HEALTH_TIMEOUT);
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) {
      _setState({ ollamaAvailable: false, ollamaChecked: true });
      return false;
    }

    const data = await res.json();
    const models: OllamaModel[] = (data.models || []).map((m: Record<string, unknown>) => ({
      name:        String(m.name || ''),
      size:        Number(m.size || 0),
      modified_at: String(m.modified_at || ''),
      details: m.details ? {
        family:              String((m.details as Record<string, unknown>).family || ''),
        parameter_size:      String((m.details as Record<string, unknown>).parameter_size || ''),
        quantization_level:  String((m.details as Record<string, unknown>).quantization_level || ''),
      } : undefined,
    }));

    // Auto-select best model
    let selected = _state.selectedModel;
    if (!selected || !models.find(m => m.name === selected)) {
      // Pick from preferred list
      for (const preferred of PREFERRED_MODELS) {
        const found = models.find(m => m.name === preferred || m.name.startsWith(preferred.split(':')[0]));
        if (found) { selected = found.name; break; }
      }
      if (!selected && models.length > 0) selected = models[0].name;
    }

    _setState({
      ollamaAvailable: models.length > 0,
      ollamaChecked: true,
      availableModels: models,
      selectedModel: selected,
    });

    if (selected) localStorage.setItem(LS_KEY_MODEL, selected);
    return models.length > 0;

  } catch {
    _setState({ ollamaAvailable: false, ollamaChecked: true });
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Local AI generation via Ollama
// ─────────────────────────────────────────────────────────────────────────────
export async function generateWithOllama(
  systemPrompt: string,
  userPrompt: string,
  model?: string,
): Promise<{ text: string | null; error: string | null }> {

  const targetModel = model || _state.selectedModel;
  if (!targetModel) {
    return { text: null, error: 'No local model selected. Install Ollama and pull a model first.' };
  }

  // Optimized prompt for local models — shorter context window, no chain-of-thought preamble
  const fullPrompt =
    `<|system|>\n${systemPrompt}\n<|end|>\n<|user|>\n${userPrompt}\n<|end|>\n<|assistant|>`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model:  targetModel,
        prompt: fullPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p:       0.9,
          num_predict: 512,   // cap tokens for performance
          stop: ['<|end|>', '<|user|>', '<|system|>'],
        },
      }),
    });
    clearTimeout(timer);

    if (!res.ok) {
      const errText = await res.text();
      return { text: null, error: `Ollama error ${res.status}: ${errText}` };
    }

    const data = await res.json();
    const text = (data.response || '').trim();
    return { text: text || null, error: text ? null : 'Empty response from local model' };

  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return { text: null, error: `Local model timed out after ${OLLAMA_TIMEOUT_MS / 1000}s. Try a smaller model.` };
    }
    return { text: null, error: `Could not reach Ollama: ${(err as Error).message}. Is Ollama running?` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detect credit exhaustion from cloud error messages
// ─────────────────────────────────────────────────────────────────────────────
function isCreditsExhausted(errorMessage: string): boolean {
  const msg = errorMessage.toLowerCase();
  return CREDIT_EXHAUSTION_SIGNALS.some(sig => msg.includes(sig));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main routing function
// ─────────────────────────────────────────────────────────────────────────────
export async function routedGenerate(
  params: GenerateContentParams,
  options: AIRouterOptions = {},
): Promise<{ text: string | null; error: string | null; source: 'cloud' | 'local' | 'cache' }> {

  _setState({ totalRequests: _state.totalRequests + 1 });

  const effectiveMode = options.modeOverride
    ?? (_state.forcedLocalMode ? 'local' : _state.mode);

  // ── Check cache ────────────────────────────────────────────────────────────
  if (options.cacheKey) {
    const cached = getCached(options.cacheKey);
    if (cached) {
      _setState({ cachedRequests: _state.cachedRequests + 1 });
      return { text: cached, error: null, source: 'cache' };
    }
  }

  // ── Extract prompts from params for local AI ───────────────────────────────
  const systemPrompt = String(params.context._raw_system || buildSystemFromParams(params));
  const userPrompt   = String(params.context._raw_user   || buildUserFromParams(params));

  // ── Pure local mode ────────────────────────────────────────────────────────
  if (effectiveMode === 'local') {
    if (!_state.ollamaAvailable) {
      const checked = await checkOllamaHealth();
      if (!checked) {
        return {
          text: null,
          error: 'Local AI (Ollama) is not running. Start Ollama or switch to Cloud mode in Settings → AI Source.',
          source: 'local',
        };
      }
    }

    // Simple task → try to use smaller model
    let model = _state.selectedModel;
    if (options.isSimpleTask) {
      const small = SIMPLE_TASK_MODELS.find(sm =>
        _state.availableModels.find(m => m.name === sm || m.name.startsWith(sm.split(':')[0]))
      );
      if (small) {
        const found = _state.availableModels.find(m => m.name === small || m.name.startsWith(small.split(':')[0]));
        if (found) model = found.name;
      }
    }

    const result = await generateWithOllama(systemPrompt, userPrompt, model);
    _setState({ localRequests: _state.localRequests + 1 });
    if (result.text && options.cacheKey) setCache(options.cacheKey, result.text);
    return { ...result, source: 'local' };
  }

  // ── Pure cloud mode ────────────────────────────────────────────────────────
  if (effectiveMode === 'cloud') {
    const result = await generateAIContent(params);
    _setState({ cloudRequests: _state.cloudRequests + 1 });
    if (result.text && options.cacheKey) setCache(options.cacheKey, result.text);

    if (result.error) {
      // Detect credit exhaustion even in pure-cloud mode
      if (isCreditsExhausted(result.error)) {
        _setState({ cloudCreditsOk: false });
        localStorage.setItem(LS_KEY_CLOUD_OK, 'false');
        toast.warning('Cloud AI credits exhausted. Switch to Hybrid or Local mode in Settings → AI Source.');
      }
    }
    return { text: result.text, error: result.error, source: 'cloud' };
  }

  // ── Hybrid / Cost-optimized: Cloud first, local fallback ─────────────────
  // For cost_optimized simple tasks, go local immediately
  if (effectiveMode === 'cost_optimized' && options.isSimpleTask && _state.ollamaAvailable) {
    const result = await generateWithOllama(systemPrompt, userPrompt);
    _setState({ localRequests: _state.localRequests + 1 });
    if (result.text && options.cacheKey) setCache(options.cacheKey, result.text);
    return { ...result, source: 'local' };
  }

  // Try cloud first (unless cloud already known to be exhausted)
  if (_state.cloudCreditsOk && !_state.forcedLocalMode) {
    const cloudResult = await generateAIContent(params);
    _setState({ cloudRequests: _state.cloudRequests + 1 });

    if (cloudResult.text) {
      // Cloud success — reset failure counter
      _setState({ consecutiveCloudFailures: 0, cloudCreditsOk: true });
      localStorage.setItem(LS_KEY_CLOUD_OK, 'true');
      if (options.cacheKey) setCache(options.cacheKey, cloudResult.text);
      return { text: cloudResult.text, error: null, source: 'cloud' };
    }

    // Cloud failed
    const newFailures = _state.consecutiveCloudFailures + 1;
    _setState({ consecutiveCloudFailures: newFailures });

    if (cloudResult.error) {
      if (isCreditsExhausted(cloudResult.error)) {
        // Permanent switch to local
        _setState({ cloudCreditsOk: false, forcedLocalMode: true });
        localStorage.setItem(LS_KEY_CLOUD_OK, 'false');
        toast.warning('☁ Cloud AI credits exhausted — switching to 🧠 Local AI automatically', {
          duration: 6000,
          id: 'ai-fallback-toast',
        });
      } else if (newFailures >= 3 && !options.noFallback) {
        // 3 consecutive non-credit failures → force local temporarily
        _setState({ forcedLocalMode: true });
        toast.info('Cloud AI unavailable — activating Local AI fallback', { id: 'ai-fallback-toast' });
      }
    }

    if (options.noFallback) {
      return { text: null, error: cloudResult.error, source: 'cloud' };
    }
  }

  // ── Local fallback ─────────────────────────────────────────────────────────
  if (!_state.ollamaChecked) {
    await checkOllamaHealth();
  }

  if (!_state.ollamaAvailable) {
    return {
      text: null,
      error: 'Cloud AI unavailable and Local AI (Ollama) is not running. See Settings → AI Source for setup instructions.',
      source: 'local',
    };
  }

  // Show local mode notification (once)
  if (_state.forcedLocalMode) {
    toast.info('🧠 Running in Local AI Mode — all generation handled by ' + (_state.selectedModel || 'local model'), {
      id: 'local-mode-active',
      duration: 4000,
    });
  }

  const localResult = await generateWithOllama(systemPrompt, userPrompt);
  _setState({ localRequests: _state.localRequests + 1 });
  if (localResult.text && options.cacheKey) setCache(options.cacheKey, localResult.text);
  return { ...localResult, source: 'local' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Build fallback prompts from GenerateContentParams when _raw_* not set
// ─────────────────────────────────────────────────────────────────────────────
function buildSystemFromParams(params: GenerateContentParams): string {
  const identity = params.identity;
  return [
    `You are a professional AI assistant helping with ${params.content_type} generation.`,
    identity ? `Tone: ${identity.tone || 'professional'}. Style: ${identity.style || 'concise'}.` : '',
    'Be concise, professional, and accurate. Output only the requested content — no preamble.',
  ].filter(Boolean).join('\n');
}

function buildUserFromParams(params: GenerateContentParams): string {
  const ctx = params.context;
  const identity = params.identity;
  const lines: string[] = [`Content type: ${params.content_type}`];
  if (identity?.name) lines.push(`Name: ${identity.name}`);
  if (identity?.persona) lines.push(`Persona: ${identity.persona}`);
  if (ctx && typeof ctx === 'object') {
    for (const [k, v] of Object.entries(ctx)) {
      if (k.startsWith('_')) continue;
      if (v != null && v !== '') lines.push(`${k}: ${String(v).slice(0, 300)}`);
    }
  }
  lines.push('\nGenerate the requested content based on the above.');
  return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API for mode management
// ─────────────────────────────────────────────────────────────────────────────
export function setAIMode(mode: AIMode) {
  _setState({ mode, forcedLocalMode: mode === 'local' });
  localStorage.setItem(LS_KEY_MODE, mode);
  if (mode !== 'local') {
    // Reset forced state when user manually changes mode
    _setState({ forcedLocalMode: false, consecutiveCloudFailures: 0 });
  }
  if (mode === 'cloud') {
    // Trust the user's explicit choice to try cloud again
    _setState({ cloudCreditsOk: true, consecutiveCloudFailures: 0 });
    localStorage.setItem(LS_KEY_CLOUD_OK, 'true');
  }
}

export function setSelectedModel(model: string) {
  _setState({ selectedModel: model });
  localStorage.setItem(LS_KEY_MODEL, model);
}

export function resetCloudStatus() {
  _setState({ cloudCreditsOk: true, forcedLocalMode: false, consecutiveCloudFailures: 0 });
  localStorage.setItem(LS_KEY_CLOUD_OK, 'true');
}

export function clearAICache() {
  resultCache.clear();
}

/** Pull a model via Ollama — returns a readable stream for progress */
export async function pullOllamaModel(
  modelName: string,
  onProgress?: (status: string, percent?: number) => void,
): Promise<{ error: string | null }> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!res.ok) {
      return { error: `Pull failed: HTTP ${res.status}` };
    }

    const reader = res.body?.getReader();
    if (!reader) return { error: 'No response stream' };

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const status = data.status || '';
          let percent: number | undefined;
          if (data.total && data.completed) {
            percent = Math.round((data.completed / data.total) * 100);
          }
          onProgress?.(status, percent);
        } catch { /* non-JSON line */ }
      }
    }

    // Refresh model list
    await checkOllamaHealth();
    return { error: null };

  } catch (err) {
    return { error: `Pull error: ${(err as Error).message}` };
  }
}

// Initialize health check on module load (non-blocking)
checkOllamaHealth().catch(() => {});
