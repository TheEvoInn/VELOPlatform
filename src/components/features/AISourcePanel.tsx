/**
 * VELO 2.0 — AI Source Panel
 * Settings panel for AI mode selection, Ollama status, model management,
 * setup guide, and routing stats.
 */
import React, { useState, useCallback } from 'react';
import {
  Cloud, Cpu, Zap, CheckCircle, AlertTriangle, RefreshCw, Download,
  Activity, ArrowRight, ChevronDown, ChevronUp, ExternalLink, Info,
  Wifi, WifiOff, Sparkles, BarChart2, Trash2, Terminal, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAIRouter } from '@/hooks/useAIRouter';
import type { AIMode } from '@/lib/aiRouter';
import { toast } from 'sonner';

// ─── Free model catalog ───────────────────────────────────────────────────────
const FREE_MODELS = [
  {
    id: 'llama3:8b',
    name: 'Llama 3 8B',
    by: 'Meta',
    size: '4.7 GB',
    speed: 'Fast',
    quality: 'High',
    badge: 'Recommended',
    badgeColor: 'text-[hsl(145,100%,55%)] bg-[hsl(145_100%_50%/0.1)] border-[hsl(145_100%_50%/0.3)]',
    desc: 'Best balance of speed and quality. Ideal for proposals, bios, and form filling.',
    tags: ['proposals', 'bios', 'forms', 'code'],
    pullId: 'llama3',
  },
  {
    id: 'mistral:7b',
    name: 'Mistral 7B',
    by: 'Mistral AI',
    size: '4.1 GB',
    speed: 'Fast',
    quality: 'High',
    badge: 'Great Value',
    badgeColor: 'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)] border-[hsl(185_100%_50%/0.2)]',
    desc: 'Excellent instruction following. Strong for cover letters and task logic.',
    tags: ['cover letters', 'tasks', 'summaries'],
    pullId: 'mistral',
  },
  {
    id: 'qwen2:7b',
    name: 'Qwen 2 7B',
    by: 'Alibaba',
    size: '4.4 GB',
    speed: 'Fast',
    quality: 'High',
    badge: 'Multilingual',
    badgeColor: 'text-[hsl(50,100%,60%)] bg-[hsl(50_100%_50%/0.1)] border-[hsl(50_100%_50%/0.2)]',
    desc: 'Strong multilingual support. Good for content creation and form filling.',
    tags: ['multilingual', 'content', 'forms'],
    pullId: 'qwen2',
  },
  {
    id: 'phi3:mini',
    name: 'Phi-3 Mini',
    by: 'Microsoft',
    size: '2.2 GB',
    speed: 'Very Fast',
    quality: 'Good',
    badge: 'Lightweight',
    badgeColor: 'text-[hsl(265,80%,70%)] bg-[hsl(265_80%_55%/0.1)] border-[hsl(265_80%_55%/0.2)]',
    desc: 'Best for low-spec hardware. Good for simple tasks and quick completions.',
    tags: ['simple tasks', 'quick fills', 'summaries'],
    pullId: 'phi3:mini',
  },
  {
    id: 'llama3.2:3b',
    name: 'Llama 3.2 3B',
    by: 'Meta',
    size: '2.0 GB',
    speed: 'Fastest',
    quality: 'Good',
    badge: 'Ultra-Light',
    badgeColor: 'text-[hsl(30,100%,60%)] bg-[hsl(30_100%_55%/0.1)] border-[hsl(30_100%_55%/0.2)]',
    desc: 'Fastest local model. Great for simple completions and form fills.',
    tags: ['fast fills', 'simple tasks'],
    pullId: 'llama3.2:3b',
  },
];

const MODE_OPTIONS: { id: AIMode; label: string; icon: React.ElementType; desc: string; color: string }[] = [
  {
    id: 'hybrid',
    label: 'Hybrid (Auto)',
    icon: Zap,
    desc: 'Cloud AI by default, auto-switches to local when credits run out.',
    color: 'hsl(185,100%,55%)',
  },
  {
    id: 'cloud',
    label: 'Cloud Only',
    icon: Cloud,
    desc: 'Always use OnSpace Cloud AI (Gemini). Requires active credits.',
    color: 'hsl(265,80%,70%)',
  },
  {
    id: 'local',
    label: 'Local Only',
    icon: Cpu,
    desc: 'Always use local Ollama model. Free, private, no internet needed.',
    color: 'hsl(145,100%,55%)',
  },
  {
    id: 'cost_optimized',
    label: 'Cost-Optimized',
    icon: BarChart2,
    desc: 'Use local AI for simple tasks, cloud only for complex generation.',
    color: 'hsl(50,100%,60%)',
  },
];

function formatBytes(bytes: number): string {
  if (bytes > 1e9) return (bytes / 1e9).toFixed(1) + ' GB';
  if (bytes > 1e6) return (bytes / 1e6).toFixed(0) + ' MB';
  return bytes + ' B';
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────
export default function AISourcePanel() {
  const router = useAIRouter();

  const [showSetupGuide, setShowSetupGuide]     = useState(false);
  const [showModelPull, setShowModelPull]       = useState(false);
  const [pullingModel, setPullingModel]         = useState<string | null>(null);
  const [pullProgress, setPullProgress]         = useState<{ status: string; percent?: number } | null>(null);
  const [refreshing, setRefreshing]             = useState(false);
  const [showStats, setShowStats]               = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await router.refreshOllama();
    setRefreshing(false);
    if (router.ollamaAvailable) {
      toast.success(`Ollama connected — ${router.availableModels.length} model(s) available`);
    } else {
      toast.warning('Ollama not detected. Make sure it\'s running on port 11434.');
    }
  }, [router]);

  const handlePullModel = useCallback(async (modelId: string, pullId: string) => {
    if (!router.ollamaAvailable) {
      toast.error('Start Ollama first, then pull a model.');
      return;
    }
    setPullingModel(modelId);
    setPullProgress({ status: 'Starting download...' });
    toast.info(`Downloading ${modelId}... This may take several minutes.`);

    const { error } = await router.pullModel(pullId, (status, percent) => {
      setPullProgress({ status, percent });
    });

    if (error) {
      toast.error(`Download failed: ${error}`);
    } else {
      toast.success(`${modelId} downloaded and ready!`);
      router.setModel(modelId);
    }
    setPullingModel(null);
    setPullProgress(null);
  }, [router]);

  const activeSource = router.activeSource;
  const currentModeConfig = MODE_OPTIONS.find(m => m.id === router.mode);

  return (
    <div className="space-y-5">
      {/* ── Status header ─────────────────────────────────────────────────── */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4">
        <div className="flex items-center gap-4 flex-wrap">
          {/* Cloud node */}
          <div className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all',
            activeSource === 'cloud'
              ? 'border-[hsl(265_80%_55%/0.4)] bg-[hsl(265_80%_55%/0.08)]'
              : 'border-[hsl(var(--border))] opacity-50'
          )}>
            <div className={cn('w-2 h-2 rounded-full', activeSource === 'cloud' ? 'bg-[hsl(265,80%,70%)] animate-pulse' : 'bg-muted-foreground')} />
            <Cloud size={14} className={activeSource === 'cloud' ? 'text-[hsl(265,80%,70%)]' : 'text-muted-foreground'} />
            <div>
              <div className="text-[10px] font-bold text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>CLOUD AI</div>
              <div className="text-[9px] text-muted-foreground">Gemini 3 Flash</div>
            </div>
            {router.cloudCreditsOk
              ? <CheckCircle size={11} className="text-[hsl(145,100%,55%)]" />
              : <AlertTriangle size={11} className="text-[hsl(0,85%,65%)]" />}
          </div>

          {/* Routing arrow */}
          <div className="flex flex-col items-center gap-0.5">
            <ArrowRight size={14} className={cn(
              'transition-all',
              activeSource === 'local' ? 'text-[hsl(145,100%,55%)] rotate-180' : 'text-muted-foreground'
            )} />
            <div className={cn(
              'text-[9px] font-bold px-1.5 py-0.5 rounded',
              router.mode === 'hybrid' ? 'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)]' :
              router.mode === 'cost_optimized' ? 'text-[hsl(50,100%,60%)] bg-[hsl(50_100%_50%/0.1)]' :
              'text-muted-foreground bg-[hsl(228_25%_10%)]'
            )}>
              {router.mode.replace('_', '-').toUpperCase()}
            </div>
          </div>

          {/* Local node */}
          <div className={cn(
            'flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all',
            activeSource === 'local'
              ? 'border-[hsl(145_100%_50%/0.4)] bg-[hsl(145_100%_50%/0.08)]'
              : 'border-[hsl(var(--border))] opacity-50'
          )}>
            <div className={cn('w-2 h-2 rounded-full', activeSource === 'local' ? 'bg-[hsl(145,100%,55%)] animate-pulse' : 'bg-muted-foreground')} />
            <Cpu size={14} className={activeSource === 'local' ? 'text-[hsl(145,100%,55%)]' : 'text-muted-foreground'} />
            <div>
              <div className="text-[10px] font-bold text-[hsl(145,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>LOCAL AI</div>
              <div className="text-[9px] text-muted-foreground">
                {router.ollamaAvailable
                  ? (router.selectedModel || 'Ollama ready')
                  : 'Ollama offline'}
              </div>
            </div>
            {router.ollamaAvailable
              ? <Wifi size={11} className="text-[hsl(145,100%,55%)]" />
              : <WifiOff size={11} className="text-[hsl(0,85%,65%)]" />}
          </div>

          {/* Refresh + stats */}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setShowStats(s => !s)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
            >
              <BarChart2 size={11} /> Stats
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
            >
              <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Forced-local warning */}
        {router.forcedLocalMode && router.mode !== 'local' && (
          <div className="mt-3 flex items-center gap-2 p-2.5 rounded-lg border border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.06)] text-xs">
            <AlertTriangle size={12} className="text-[hsl(30,100%,60%)] flex-shrink-0" />
            <span className="text-muted-foreground flex-1">
              Cloud AI credits exhausted — <span className="text-[hsl(145,100%,55%)] font-semibold">Local AI is now active.</span> All workflows continue uninterrupted.
            </span>
            <button
              onClick={() => router.resetCloud()}
              className="text-[10px] px-2 py-1 rounded border border-[hsl(30_100%_55%/0.3)] text-[hsl(30,100%,60%)] hover:bg-[hsl(30_100%_55%/0.1)] transition-colors flex-shrink-0"
            >
              Retry Cloud
            </button>
          </div>
        )}

        {/* Stats panel */}
        {showStats && (
          <div className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              { label: 'Total',  value: router.totalRequests,  color: 'text-[hsl(185,100%,55%)]' },
              { label: 'Cloud',  value: router.cloudRequests,  color: 'text-[hsl(265,80%,70%)]' },
              { label: 'Local',  value: router.localRequests,  color: 'text-[hsl(145,100%,55%)]' },
              { label: 'Cached', value: router.cachedRequests, color: 'text-[hsl(50,100%,60%)]' },
            ].map(s => (
              <div key={s.label} className="p-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                <div className={cn('text-xl font-black', s.color)} style={{ fontFamily: 'Orbitron' }}>{s.value}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Mode selector ──────────────────────────────────────────────────── */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>
          AI Source Mode
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MODE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            const isActive = router.mode === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => {
                  router.setMode(opt.id);
                  toast.success(`AI mode set to ${opt.label}`);
                }}
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border text-left transition-all hover:scale-[1.01]',
                  isActive
                    ? 'border-current shadow-[0_0_12px_-4px_currentColor]'
                    : 'border-[hsl(var(--border))] hover:border-[hsl(228_25%_25%)]'
                )}
                style={isActive ? { borderColor: opt.color, background: `color-mix(in srgb, ${opt.color} 6%, transparent)` } : {}}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: `color-mix(in srgb, ${opt.color} 14%, transparent)` }}
                >
                  <Icon size={16} style={{ color: opt.color }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-bold" style={{ color: isActive ? opt.color : undefined }}>{opt.label}</span>
                    {isActive && (
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ color: opt.color, background: `color-mix(in srgb, ${opt.color} 15%, transparent)` }}>ACTIVE</span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground leading-relaxed">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Local AI: Ollama status ────────────────────────────────────────── */}
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>
          Local AI Engine (Ollama)
        </div>

        {router.ollamaAvailable ? (
          <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.2)] p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
              <span className="text-sm font-semibold text-[hsl(145,100%,55%)]">Ollama Connected</span>
              <span className="text-xs text-muted-foreground">· localhost:11434</span>
              <span className="ml-auto text-xs text-muted-foreground">{router.availableModels.length} model(s)</span>
            </div>

            {/* Model selector */}
            {router.availableModels.length > 0 && (
              <div>
                <label className="text-[11px] text-muted-foreground mb-1.5 block">Active Model</label>
                <select
                  className="w-full px-3 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(145_100%_50%/0.5)] transition-colors"
                  value={router.selectedModel}
                  onChange={e => router.setModel(e.target.value)}
                >
                  {router.availableModels.map(m => (
                    <option key={m.name} value={m.name}>
                      {m.name}{m.details?.parameter_size ? ` (${m.details.parameter_size})` : ''}{m.size ? ` — ${formatBytes(m.size)}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Installed models list */}
            <div className="space-y-1.5">
              {router.availableModels.map(model => (
                <div key={model.name} className="flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(228_25%_8%)] border border-[hsl(var(--border))]">
                  <div className={cn('w-2 h-2 rounded-full flex-shrink-0', model.name === router.selectedModel ? 'bg-[hsl(145,100%,55%)]' : 'bg-[hsl(228,20%,30%)]')} />
                  <span className="font-mono text-xs flex-1">{model.name}</span>
                  {model.details?.parameter_size && (
                    <span className="text-[10px] text-muted-foreground">{model.details.parameter_size}</span>
                  )}
                  {model.size > 0 && (
                    <span className="text-[10px] text-muted-foreground">{formatBytes(model.size)}</span>
                  )}
                  {model.name !== router.selectedModel && (
                    <button
                      onClick={() => router.setModel(model.name)}
                      className="text-[10px] px-2 py-0.5 rounded border border-[hsl(185_100%_50%/0.2)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.1)] transition-colors"
                    >
                      Use
                    </button>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowModelPull(s => !s)}
              className="flex items-center gap-2 text-xs text-[hsl(185,100%,55%)] hover:underline"
            >
              <Download size={11} /> Download more models
              {showModelPull ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            </button>
          </div>
        ) : (
          <div className="glass-panel rounded-xl border border-dashed border-[hsl(30_100%_55%/0.3)] p-5">
            <div className="flex items-center gap-3 mb-3">
              <WifiOff size={18} className="text-[hsl(30,100%,60%)]" />
              <div>
                <div className="text-sm font-bold text-[hsl(30,100%,60%)]">Ollama Not Running</div>
                <div className="text-xs text-muted-foreground">Local AI is unavailable — cloud AI is active as fallback</div>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setShowSetupGuide(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[hsl(185_100%_50%/0.3)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.08)] transition-colors"
              >
                <Terminal size={11} /> Setup Guide
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
              >
                <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} /> Detect
              </button>
              <a
                href="https://ollama.com/download"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[hsl(145,80%,40%)] to-[hsl(185,100%,40%)] text-black hover:opacity-90 transition-all"
              >
                <ExternalLink size={11} /> Download Ollama (Free)
              </a>
            </div>
          </div>
        )}
      </div>

      {/* ── Setup guide ───────────────────────────────────────────────────── */}
      {showSetupGuide && (
        <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.2)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={14} className="text-[hsl(185,100%,55%)]" />
              <span className="text-sm font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>OLLAMA SETUP GUIDE</span>
            </div>
            <button onClick={() => setShowSetupGuide(false)} className="p-1 rounded hover:bg-[hsl(228_25%_12%)]"><X size={13} /></button>
          </div>

          <div className="space-y-3">
            {[
              {
                step: '1',
                label: 'Download Ollama',
                color: 'hsl(185,100%,55%)',
                content: (
                  <a href="https://ollama.com/download" target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-[hsl(185,100%,55%)] hover:underline">
                    <ExternalLink size={10} /> ollama.com/download — Free for macOS, Linux, and Windows
                  </a>
                ),
              },
              {
                step: '2',
                label: 'Install and start Ollama',
                color: 'hsl(265,80%,70%)',
                content: (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="px-3 py-1.5 rounded bg-[hsl(230_35%_4%)] border border-[hsl(var(--border))] text-[hsl(145,100%,55%)]">
                      # Ollama starts automatically after install<br />
                      # Or start manually:
                    </div>
                    <div className="px-3 py-1.5 rounded bg-[hsl(230_35%_4%)] border border-[hsl(var(--border))] text-[hsl(185,100%,55%)]">
                      ollama serve
                    </div>
                  </div>
                ),
              },
              {
                step: '3',
                label: 'Enable browser access (CORS)',
                color: 'hsl(50,100%,60%)',
                content: (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-muted-foreground">Set this environment variable before starting Ollama:</div>
                    <div className="font-mono text-[11px] px-3 py-2 rounded bg-[hsl(230_35%_4%)] border border-[hsl(50_100%_50%/0.2)] text-[hsl(50,100%,60%)]">
                      OLLAMA_ORIGINS=* ollama serve
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      On macOS/Linux, add to ~/.bashrc or ~/.zshrc:
                    </div>
                    <div className="font-mono text-[10px] px-3 py-1.5 rounded bg-[hsl(230_35%_4%)] border border-[hsl(var(--border))] text-muted-foreground">
                      export OLLAMA_ORIGINS="*"
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      On Windows, set in System → Environment Variables.
                    </div>
                  </div>
                ),
              },
              {
                step: '4',
                label: 'Pull a free model',
                color: 'hsl(145,100%,55%)',
                content: (
                  <div className="space-y-1.5 font-mono text-[11px]">
                    <div className="text-[10px] text-muted-foreground font-sans mb-1">Run in terminal (choose one):</div>
                    {['ollama pull llama3', 'ollama pull mistral', 'ollama pull phi3:mini'].map(cmd => (
                      <div key={cmd} className="px-3 py-1.5 rounded bg-[hsl(230_35%_4%)] border border-[hsl(var(--border))] text-[hsl(185,100%,55%)]">{cmd}</div>
                    ))}
                  </div>
                ),
              },
              {
                step: '5',
                label: 'Click "Detect" above',
                color: 'hsl(265,80%,70%)',
                content: (
                  <div className="text-[11px] text-muted-foreground">
                    VELO 2.0 will detect Ollama, list your models, and automatically use them as fallback AI.
                  </div>
                ),
              },
            ].map(item => (
              <div key={item.step} className="flex items-start gap-3">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 mt-0.5"
                  style={{ color: item.color, border: `1.5px solid ${item.color}`, background: `color-mix(in srgb, ${item.color} 10%, transparent)` }}
                >
                  {item.step}
                </div>
                <div className="flex-1 space-y-1.5">
                  <div className="text-xs font-semibold" style={{ color: item.color }}>{item.label}</div>
                  {item.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Free model catalog ─────────────────────────────────────────────── */}
      {(showModelPull || !router.ollamaAvailable) && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground mb-3" style={{ fontFamily: 'Orbitron' }}>
            Free Open-Source Models
          </div>
          <div className="space-y-3">
            {FREE_MODELS.map(model => {
              const isInstalled = !!router.availableModels.find(m =>
                m.name === model.id || m.name.startsWith(model.pullId.split(':')[0])
              );
              const isPulling = pullingModel === model.id;

              return (
                <div
                  key={model.id}
                  className={cn(
                    'glass-panel rounded-xl border p-4 transition-all',
                    isInstalled ? 'border-[hsl(145_100%_50%/0.25)]' : 'border-[hsl(var(--border))]'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      isInstalled ? 'bg-[hsl(145_100%_50%/0.12)]' : 'bg-[hsl(228_25%_12%)]'
                    )}>
                      {isInstalled
                        ? <CheckCircle size={16} className="text-[hsl(145,100%,55%)]" />
                        : <Cpu size={16} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-sm font-bold">{model.name}</span>
                        <span className="text-[10px] text-muted-foreground">by {model.by}</span>
                        <span className={cn('text-[9px] px-1.5 py-0.5 rounded border font-bold', model.badgeColor)}>
                          {model.badge}
                        </span>
                        {isInstalled && (
                          <span className="text-[9px] text-[hsl(145,100%,55%)] font-bold flex items-center gap-0.5">
                            <CheckCircle size={8} /> Installed
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground mb-2">{model.desc}</div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                        <span>📦 {model.size}</span>
                        <span>⚡ {model.speed}</span>
                        <span>✦ {model.quality} quality</span>
                      </div>
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {model.tags.map(t => (
                          <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground">{t}</span>
                        ))}
                      </div>

                      {/* Pull progress */}
                      {isPulling && pullProgress && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                            <span>{pullProgress.status}</span>
                            {pullProgress.percent !== undefined && <span>{pullProgress.percent}%</span>}
                          </div>
                          <div className="h-1.5 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-300"
                              style={{ width: `${pullProgress.percent ?? 30}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      {isInstalled ? (
                        <button
                          onClick={() => router.setModel(
                            router.availableModels.find(m =>
                              m.name === model.id || m.name.startsWith(model.pullId.split(':')[0])
                            )?.name || model.id
                          )}
                          className={cn(
                            'px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                            router.selectedModel === model.id
                              ? 'border-[hsl(145_100%_50%/0.4)] bg-[hsl(145_100%_50%/0.1)] text-[hsl(145,100%,55%)]'
                              : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
                          )}
                        >
                          {router.selectedModel === model.id ? 'Active' : 'Use This'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handlePullModel(model.id, model.pullId)}
                          disabled={isPulling || !router.ollamaAvailable}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all"
                        >
                          {isPulling
                            ? <RefreshCw size={11} className="animate-spin" />
                            : <Download size={11} />}
                          {isPulling ? 'Downloading...' : 'Download Free'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {!router.ollamaAvailable && (
            <div className="mt-3 flex items-start gap-2 p-3 rounded-lg border border-[hsl(50_100%_50%/0.2)] bg-[hsl(50_100%_50%/0.04)] text-[11px] text-muted-foreground">
              <Info size={11} className="text-[hsl(50,100%,60%)] flex-shrink-0 mt-0.5" />
              Install and start Ollama first, then use the download buttons above to pull models directly from here.
            </div>
          )}
        </div>
      )}

      {/* ── AI behavior notes ──────────────────────────────────────────────── */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.1)] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info size={13} className="text-[hsl(265,80%,70%)]" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Local AI Capabilities</span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            'Bios & headlines', 'Cover letter writing', 'Form field filling',
            'Skills generation', 'Proposal drafts', 'Task interpretation',
            'Content summaries', 'Resume sections',
            'Autopilot workflow logic', 'Identity field enhancement',
          ].map(cap => (
            <div key={cap} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CheckCircle size={9} className="text-[hsl(145,100%,55%)] flex-shrink-0" />
              {cap}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
