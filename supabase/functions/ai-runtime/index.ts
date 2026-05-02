/**
 * VELO 2.0 — Internal AI Runtime Edge Function
 *
 * This is VELO's internal AI backend. It acts as a universal AI proxy
 * with three tiers:
 *
 * Tier 1: OnSpace AI (Cloud) — Gemini 3 Flash, fast, uses credits
 * Tier 2: Remote Ollama    — Self-hosted on any VPS, configured via OLLAMA_ENDPOINT secret
 * Tier 3: Template Engine  — Zero-cost, zero-latency pattern-based responses
 *
 * The client never needs to know which tier is used. The runtime
 * auto-selects based on availability and credit status.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Template Engine — zero-cost always-available responses
// ─────────────────────────────────────────────────────────────────────────────
const TEMPLATES: Record<string, (ctx: Record<string, string>) => string> = {
  bio: (ctx) => `${ctx.name || 'Professional'} is a ${ctx.title || 'skilled professional'} with ${ctx.experience || '3+'} years of experience in ${ctx.skills || 'their field'}. ${ctx.headline ? `${ctx.headline}.` : ''} Passionate about delivering quality results and building impactful solutions.`,

  headline: (ctx) => `${ctx.title || 'Skilled Professional'} | ${ctx.skills?.split(',')[0]?.trim() || 'Expert'} | ${ctx.location || 'Remote'} | Open to opportunities`,

  cover_letter: (ctx) => `Dear Hiring Manager,

I am writing to express my strong interest in the ${ctx.job_title || 'position'} role${ctx.company ? ` at ${ctx.company}` : ''}.

With ${ctx.experience || 'several'} years of experience in ${ctx.skills || 'relevant technologies'}, I have developed a strong foundation in delivering high-quality work. My background in ${ctx.category || 'this field'} aligns well with the requirements you've outlined.

${ctx.platform ? `I have significant experience working on ${ctx.platform} and understand the platform's expectations for quality and professionalism.` : ''}

I am confident in my ability to contribute effectively and am excited about the opportunity to bring my skills to your team.

Best regards,
${ctx.name || 'Applicant'}`,

  skills: (ctx) => {
    const base = ctx.title || 'Software Development';
    const skillSets: Record<string, string[]> = {
      'Software Development': ['JavaScript', 'TypeScript', 'React', 'Node.js', 'REST APIs', 'Git'],
      'Design': ['Figma', 'Adobe XD', 'UI/UX Design', 'Prototyping', 'Design Systems'],
      'Marketing': ['Content Strategy', 'SEO', 'Social Media', 'Analytics', 'Copywriting'],
      'Data': ['Python', 'SQL', 'Data Analysis', 'Excel', 'Tableau', 'Machine Learning'],
      'Writing': ['Content Writing', 'Copywriting', 'Research', 'Editing', 'SEO Writing'],
    };
    const match = Object.keys(skillSets).find(k => base.toLowerCase().includes(k.toLowerCase()));
    const skills = skillSets[match || 'Software Development'];
    return skills.slice(0, 6).join(', ');
  },

  summary: (ctx) => `Experienced ${ctx.title || 'professional'} with a proven track record in ${ctx.skills || 'diverse skill areas'}. Specializing in ${ctx.category || 'delivering high-quality solutions'} for ${ctx.audience || 'clients globally'}. ${ctx.years_experience ? `${ctx.years_experience}+ years of professional experience.` : ''}`,

  proposal: (ctx) => `I'd love to work on this ${ctx.job_title || 'project'}!

Here's what I bring to the table:
• ${ctx.experience || '3+'} years of experience in ${ctx.skills || 'relevant skills'}
• Strong attention to detail and clear communication throughout the project
• Proven ability to deliver on time and within scope

${ctx.platform === 'Upwork' ? 'My Upwork profile reflects my commitment to 5-star quality.' : ''}

I'm available to start immediately and can discuss the project requirements in detail.

Let me know if you have any questions!

Best,
${ctx.name || 'Applicant'}`,

  email: (ctx) => `Subject: ${ctx.subject || 'Project Inquiry'}

Hi ${ctx.recipient || 'there'},

I hope this message finds you well. I'm reaching out regarding ${ctx.topic || 'a potential collaboration'}.

${ctx.body || 'I would love to discuss this opportunity further and explore how we can work together.'}

Please feel free to reach out at your convenience.

Best regards,
${ctx.name || 'VELO User'}`,

  code_fix: (ctx) => `// Fix for: ${ctx.issue || 'identified issue'}
// File: ${ctx.file || 'unknown'}

// TODO: Review the following pattern and apply it to your code:
// 1. Check for null/undefined values before accessing properties
// 2. Use destructured error handling: const { data, error } = await supabase.from(...)
// 3. Never chain .catch() on Supabase v2 queries
// 4. Add .filter(Boolean) before .map() on arrays that may contain null entries
// 5. Use useRef for values that need to be read at call-time in hooks

// For detailed AI assistance, configure a remote Ollama endpoint in Settings → AI Source`,

  default: (ctx) => `I've processed your request for "${ctx.task || 'this task'}". 

For detailed AI generation, please configure:
1. **Remote Ollama** — Set OLLAMA_ENDPOINT in your backend secrets (Settings → Cloud → Secrets)
2. **Local Ollama** — Run \`ollama serve\` on your machine
3. **Cloud AI** — Ensure OnSpace AI credits are available

Template response generated at: ${new Date().toISOString()}`,
};

function detectTemplateType(contentType: string, context: Record<string, string>): string {
  if (contentType === 'bio') return 'bio';
  if (contentType === 'cover_letter') return 'cover_letter';
  if (contentType === 'resume') return 'summary';
  if (contentType === 'message') return context.type === 'proposal' ? 'proposal' : 'email';
  if (contentType === 'raw' && context.task?.includes('fix')) return 'code_fix';
  if (context.field_type === 'headline') return 'headline';
  if (context.field_type === 'skills') return 'skills';
  return 'default';
}

function generateFromTemplate(contentType: string, context: Record<string, string>): string {
  const type = detectTemplateType(contentType, context);
  const templateFn = TEMPLATES[type] || TEMPLATES.default;
  return templateFn(context);
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 2: Remote Ollama proxy
// ─────────────────────────────────────────────────────────────────────────────
async function callRemoteOllama(
  endpoint: string,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 512,
): Promise<{ text: string | null; error: string | null }> {
  try {
    const fullPrompt = `<|system|>\n${systemPrompt}\n<|end|>\n<|user|>\n${userPrompt}\n<|end|>\n<|assistant|>`;

    const res = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: fullPrompt,
        stream: false,
        options: { temperature: 0.7, num_predict: maxTokens },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { text: null, error: `Ollama ${res.status}: ${errText}` };
    }

    const data = await res.json().catch(() => ({}));
    const text = String(data.response || '').trim();
    return { text: text || null, error: text ? null : 'Empty response' };
  } catch (err) {
    return { text: null, error: `Remote Ollama error: ${String(err)}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier 1: OnSpace AI (cloud)
// ─────────────────────────────────────────────────────────────────────────────
async function callOnSpaceAI(
  messages: Array<{ role: string; content: string }>,
  maxTokens = 1024,
  apiKey: string,
  baseUrl: string,
): Promise<{ text: string | null; error: string | null; creditExhausted?: boolean }> {
  if (!apiKey || !baseUrl) {
    return { text: null, error: 'OnSpace AI not configured' };
  }

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(25000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      const isCreditErr = res.status === 429 || res.status === 402 ||
        errText.toLowerCase().includes('quota') ||
        errText.toLowerCase().includes('credit');
      return {
        text: null,
        error: `Cloud AI ${res.status}: ${errText}`,
        creditExhausted: isCreditErr,
      };
    }

    const data = await res.json().catch(() => ({}));
    const text = String(data?.choices?.[0]?.message?.content || '').trim();
    return { text: text || null, error: text ? null : 'Empty response' };
  } catch (err) {
    return { text: null, error: `Cloud AI error: ${String(err)}` };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';
    const ollamaEndpoint = Deno.env.get('OLLAMA_ENDPOINT') ?? ''; // e.g. http://your-vps:11434

    // Auth
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      action = 'generate',
      content_type = 'raw',
      context = {},
      system_prompt = '',
      user_prompt = '',
      messages = [],
      max_tokens = 512,
      prefer_tier,        // 'cloud' | 'ollama' | 'template' — force specific tier
      no_fallback = false,
    } = body;

    // ── STATUS CHECK ──────────────────────────────────────────────────────
    if (action === 'status') {
      const ollamaOk = ollamaEndpoint ? await checkRemoteOllama(ollamaEndpoint) : false;
      const cloudOk = !!(apiKey && baseUrl);

      return new Response(JSON.stringify({
        tiers: {
          cloud: { available: cloudOk, endpoint: baseUrl ? 'configured' : 'not configured' },
          ollama: { available: ollamaOk, endpoint: ollamaEndpoint ? 'configured' : 'not configured' },
          template: { available: true, endpoint: 'internal' },
        },
        active_tier: prefer_tier || (cloudOk ? 'cloud' : ollamaOk ? 'ollama' : 'template'),
        ollama_endpoint_set: !!ollamaEndpoint,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── GENERATE ──────────────────────────────────────────────────────────
    if (action === 'generate') {
      const stringCtx: Record<string, string> = {};
      for (const [k, v] of Object.entries(context)) {
        if (v != null && !k.startsWith('_')) stringCtx[k] = String(v).slice(0, 400);
      }

      const sysPrompt = system_prompt ||
        `You are VELO 2.0's internal AI assistant. Generate concise, professional ${content_type} content. No preamble. Output only the requested content.`;

      const usrPrompt = user_prompt ||
        `Generate ${content_type} content for:\n${Object.entries(stringCtx).map(([k, v]) => `${k}: ${v}`).join('\n')}`;

      // Determine tier order
      const tierOrder: ('cloud' | 'ollama' | 'template')[] =
        prefer_tier === 'cloud'    ? ['cloud', 'ollama', 'template'] :
        prefer_tier === 'ollama'   ? ['ollama', 'cloud', 'template'] :
        prefer_tier === 'template' ? ['template'] :
        apiKey ? ['cloud', 'ollama', 'template'] : // default: cloud first
        ollamaEndpoint ? ['ollama', 'template'] :
        ['template'];

      let result: string | null = null;
      let usedTier: string = 'template';
      let creditExhausted = false;

      for (const tier of tierOrder) {
        if (tier === 'cloud' && apiKey && baseUrl) {
          const cloudMsgs = messages.length > 0
            ? [{ role: 'system', content: sysPrompt }, ...messages]
            : [{ role: 'system', content: sysPrompt }, { role: 'user', content: usrPrompt }];

          const r = await callOnSpaceAI(cloudMsgs, max_tokens, apiKey, baseUrl);
          if (r.text) { result = r.text; usedTier = 'cloud'; break; }
          if (r.creditExhausted) { creditExhausted = true; }
          if (no_fallback) break;
        }

        if (tier === 'ollama' && ollamaEndpoint) {
          // Get best model from remote Ollama
          const model = await getRemoteOllamaModel(ollamaEndpoint);
          if (model) {
            const r = await callRemoteOllama(ollamaEndpoint, model, sysPrompt, usrPrompt, max_tokens);
            if (r.text) { result = r.text; usedTier = 'ollama'; break; }
          }
          if (no_fallback) break;
        }

        if (tier === 'template') {
          result = generateFromTemplate(content_type, stringCtx);
          usedTier = 'template';
          break;
        }
      }

      return new Response(JSON.stringify({
        text: result,
        tier_used: usedTier,
        credit_exhausted: creditExhausted,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── DEV CONSOLE ASSIST ────────────────────────────────────────────────
    if (action === 'dev_assist') {
      const { dev_messages = [], code_context = '', intent = '', resolved_files = [] } = body;

      const devSystem = `You are VELO DevBot — the internal AI engineer for VELO 2.0.
STACK: React 18 + TypeScript + Tailwind CSS 3.4 + Supabase + Deno Edge Functions
PATTERNS: @/ imports, React Query, supabase destructured errors, toast from sonner
THEME: Galaxy HUD — hsl(228,35%,4%) background, neon cyan/violet accents

Files resolved: ${resolved_files.map((f: Record<string,string>) => f.name).join(', ')}
Code context:
\`\`\`
${String(code_context).slice(0, 2500)}
\`\`\`

Provide complete working TypeScript fixes in fenced code blocks. Be concise.`;

      const chatMessages = [
        { role: 'system', content: devSystem },
        ...dev_messages.slice(-6),
        { role: 'user', content: intent },
      ];

      // Try cloud first, then remote Ollama, then template
      let text: string | null = null;
      let usedTier = 'template';

      if (apiKey && baseUrl) {
        const r = await callOnSpaceAI(chatMessages, 2048, apiKey, baseUrl);
        if (r.text) { text = r.text; usedTier = 'cloud'; }
      }

      if (!text && ollamaEndpoint) {
        const model = await getRemoteOllamaModel(ollamaEndpoint);
        if (model) {
          const r = await callRemoteOllama(ollamaEndpoint, model, devSystem, intent, 1024);
          if (r.text) { text = r.text; usedTier = 'ollama'; }
        }
      }

      if (!text) {
        text = generateDevConsoleTemplate(intent, code_context, resolved_files);
        usedTier = 'template';
      }

      return new Response(JSON.stringify({ text, tier_used: usedTier }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[ai-runtime]', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────
async function checkRemoteOllama(endpoint: string): Promise<boolean> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return false;
    const data = await res.json().catch(() => ({}));
    return Array.isArray(data.models) && data.models.length > 0;
  } catch {
    return false;
  }
}

async function getRemoteOllamaModel(endpoint: string): Promise<string | null> {
  try {
    const res = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({}));
    const models: Array<{ name: string }> = data.models || [];
    if (!models.length) return null;
    // Prefer known good models
    const preferred = ['llama3:8b', 'llama3', 'mistral', 'phi3', 'gemma2:9b'];
    for (const p of preferred) {
      const m = models.find(m => m.name === p || m.name.startsWith(p.split(':')[0]));
      if (m) return m.name;
    }
    return models[0].name;
  } catch {
    return null;
  }
}

function generateDevConsoleTemplate(intent: string, codeCtx: string, resolvedFiles: Array<Record<string,string>>): string {
  const lower = intent.toLowerCase();
  const fileList = resolvedFiles.map(f => f.name).join(', ') || 'the relevant file';

  if (lower.includes('fix') && (lower.includes('upload') || lower.includes('document'))) {
    return `## Fix: Document Upload Pipeline

The most common upload failure causes in VELO 2.0:

\`\`\`typescript
// Fix 1: Upload File directly — no blob roundtrip
const { data: storageData, error: storageError } = await supabase.storage
  .from('identity-docs')
  .upload(path, file, { upsert: true }); // use File, not fetch(createObjectURL())

// Fix 2: Use stable doc keys for upsert
const { error: metaError } = await supabase
  .from('user_documents')
  .upsert({ user_id, doc_key, storage_path }, { onConflict: 'user_id,doc_key' });

// Fix 3: Read options via ref at call time (avoid stale closure)
const optionsRef = useRef(options);
useEffect(() => { optionsRef.current = options; }, [options]);
\`\`\`

**Target file:** ${fileList}

For AI-generated fixes with full context, configure a remote Ollama endpoint in Settings → AI Source → Runtime Config.`;
  }

  if (lower.includes('fix') && lower.includes('login')) {
    return `## Fix: Authentication Page

\`\`\`typescript
// Correct OTP login pattern for VELO 2.0
const handleSendOtp = async () => {
  setLoading(true);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) { toast.error(error.message); setLoading(false); }
  else { setStep('verify'); setLoading(false); }
};

const handleVerify = async () => {
  setLoading(true);
  const { data, error } = await supabase.auth.verifyOtp({
    email, token: otp, type: 'email',
  });
  if (error) { toast.error(error.message); setLoading(false); return; }
  if (data.user) { login(mapSupabaseUser(data.user)); navigate('/'); }
};
\`\`\`

**Target file:** ${fileList}`;
  }

  if (lower.includes('rls') || lower.includes('permission') || lower.includes('403')) {
    return `## Fix: Missing RLS Policy

\`\`\`sql
-- Enable RLS and add policies
ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_select_own" ON your_table
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "auth_insert_own" ON your_table
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY "auth_update_own" ON your_table
  FOR UPDATE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "auth_delete_own" ON your_table
  FOR DELETE TO authenticated USING (user_id = auth.uid());
\`\`\`

Run this in your Supabase SQL editor or OnSpace Cloud → Data.`;
  }

  if (lower.includes('catch') || lower.includes('not a function')) {
    return `## Fix: Supabase .catch() Incompatibility

Supabase JS v2 returns a \`PromiseLike\`, not a full Promise. Never chain \`.catch()\` directly.

\`\`\`typescript
// ❌ Wrong — causes "catch is not a function"
supabase.from('table').insert(data).catch(err => console.error(err));

// ✅ Correct — destructured error handling
const { data: result, error } = await supabase.from('table').insert(data);
if (error) {
  toast.error(error.message);
  return;
}
\`\`\`

**Target file:** ${fileList}`;
  }

  return `## Analysis: "${intent}"

**Target files:** ${fileList}

I've analyzed the request. To get a full AI-generated fix:

**Option 1 — Configure Remote Ollama (Free, No Credits)**
Set \`OLLAMA_ENDPOINT\` in your backend secrets to your Ollama server URL.
Any VPS with 8GB RAM can run Llama 3 8B for free.

**Option 2 — Use Local Ollama**
Run \`OLLAMA_ORIGINS=* ollama serve\` on your machine.
The Dev Console will automatically detect and use it.

**Option 3 — Cloud AI**
Ensure OnSpace AI credits are available in your workspace.

Current response generated by VELO's built-in Template Engine.
${codeCtx ? `\n**Code context detected** — ${codeCtx.split('\n').length} lines in context.` : ''}`;
}
