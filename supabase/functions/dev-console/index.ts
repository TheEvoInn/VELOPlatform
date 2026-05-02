import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── AUTH ──────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const userClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    const apiKey  = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Helper: call AI API ──────────────────────────────────────────────
    async function callAI(
      messages: Array<{ role: string; content: string }>,
      maxTokens = 4096
    ): Promise<string> {
      if (!apiKey || !baseUrl) throw new Error('AI not configured');

      const aiRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages,
          max_tokens: maxTokens,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        throw new Error(`AI API error ${aiRes.status}: ${errText}`);
      }

      const aiData = await aiRes.json().catch(() => ({}));
      return aiData?.choices?.[0]?.message?.content ?? 'No response generated.';
    }

    // ── Helper: audit log ────────────────────────────────────────────────
    async function auditLog(action: string, purpose: string, fields: string[] = []) {
      await supabaseAdmin.from('identity_consent_log').insert({
        user_id: user.id,
        action,
        purpose,
        fields_accessed: fields,
        approved_by_user: true,
      }).catch(() => {});
    }

    // ── Helper: schema snapshot ──────────────────────────────────────────
    async function getSchemaSnapshot() {
      try {
        const { data: tables } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_name')
          .eq('table_schema', 'public')
          .order('table_name');

        return tables?.map((t: { table_name: string }) => t.table_name).join(', ') ?? 'Unknown';
      } catch {
        return 'user_identity, autopilots, opportunities, tasks, wallet_transactions, credentials, platforms, playbooks';
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // AI ASSIST — Chat-style code assistance with full platform context
    // ════════════════════════════════════════════════════════════════════
    if (action === 'ai_assist') {
      const {
        messages = [],
        code_context = '',
        file_path = 'unknown',
        user_message = 'Analyze this code.',
        repo_tree,
        related_files,
        schema_snapshot,
      } = body;

      const schema = schema_snapshot ?? await getSchemaSnapshot();

      const systemPrompt = `You are VELO DevBot, the AI architect for VELO 2.0 — a fully autonomous profit platform.

TECH STACK:
- Frontend: React 18 + TypeScript + Tailwind CSS 3.4 + shadcn/ui + React Router 6
- Backend: Supabase PostgreSQL + Edge Functions (Deno) + Row Level Security
- AI Router: routedGenerate() in aiRouter.ts — cloud (Gemini 3 Flash) + local (Ollama) fallback
- Auth: Supabase OTP email login
- Encryption: AES-256-GCM + PBKDF2 (100K iterations) in vaultCrypto.ts
- Automation: Playwright browser engine with playbooks, runners, anti-friction handlers
- State: React Query (server) + useState (local) + Zustand (shared)

DESIGN SYSTEM (Galaxy HUD theme):
- Background: hsl(228,35%,4%) | Neon cyan: hsl(185,100%,55%) | Violet: hsl(265,80%,70%)
- Font: Orbitron for headings (style={{ fontFamily: 'Orbitron' }}), font-mono for code
- Containers: class="glass-panel rounded-xl border border-[hsl(var(--border))]"
- Animations: class="slide-in-up" on page mount
- ALL imports use @/ alias (e.g. import { supabase } from '@/lib/supabase')

KEY PATTERNS:
- Data fetching: useQuery + useSharedData hooks, NOT direct supabase calls in components
- Mutations: useMutation with onSuccess cache invalidation via useQueryClient
- Forms: react-hook-form + zod validation
- Errors: toast from sonner, never silent failures
- Navigation: useNavigate(), NEVER window.location
- RLS: user_id = auth.uid() on all tables, foreign key to user_profiles(id)

DATABASE TABLES: ${schema}

CURRENT FILE: ${file_path}

CODE CONTEXT:
\`\`\`
${code_context.slice(0, 3000)}
\`\`\`

${repo_tree ? `REPO TREE:\n\`\`\`\n${JSON.stringify(repo_tree, null, 2).slice(0, 1000)}\n\`\`\`` : ''}
${related_files ? `RELATED FILES:\n\`\`\`\n${JSON.stringify(related_files, null, 2).slice(0, 1000)}\n\`\`\`` : ''}

ALWAYS:
- Output complete, working TypeScript code in fenced \`\`\`tsx or \`\`\`ts blocks
- Follow VELO's exact patterns (no vanilla HTML, no raw CSS, no mock data)
- Explain root cause briefly, then show the fix
- If a request is ambiguous, ask one clarifying question
- Never invent file paths or component names that don't exist`;

      const conversationMessages = [
        { role: 'system', content: systemPrompt },
        ...messages.slice(-8), // last 8 turns for context
        { role: 'user', content: user_message },
      ];

      let text = 'No response generated.';
      try {
        text = await callAI(conversationMessages);
      } catch (err) {
        const msg = String(err);
        // Check for credit exhaustion
        if (msg.includes('429') || msg.includes('402') || msg.toLowerCase().includes('quota') || msg.toLowerCase().includes('credit')) {
          text = '⚠️ Cloud AI credits exhausted.\n\nVELO DevBot will automatically switch to your local Ollama model. Make sure Ollama is running and a model is downloaded.\n\nGo to **Settings → AI Source** to configure local AI or check your cloud AI credits.';
          return new Response(JSON.stringify({ text, credit_exhausted: true }), {
            status: 402,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
        text = `❌ AI Error: ${msg}`;
      }

      await auditLog('dev_console_ai_assist', `AI assistance: ${file_path}`, ['file_path', 'code_context']);

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // SCAFFOLD — Generate new module code from template
    // ════════════════════════════════════════════════════════════════════
    if (action === 'scaffold') {
      const { template_type = 'page', module_name = 'New', custom_prompt = '' } = body;

      const prompt = custom_prompt || `Generate a complete VELO 2.0 ${template_type} called "${module_name}" following all platform patterns. Include TypeScript interfaces, proper imports with @/ alias, VELO galaxy HUD styling, and production-ready code.`;

      const systemPrompt = `You are VELO DevBot generating production-ready code for VELO 2.0. 
Always use TypeScript, @/ imports, React Query for data, VELO galaxy theme, and complete working implementations. 
Output only the code with brief inline comments. No explanations needed — just the code.`;

      let text = 'No code generated.';
      try {
        text = await callAI([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ]);
      } catch (err) {
        text = `❌ Scaffold error: ${String(err)}`;
      }

      await auditLog('dev_console_scaffold', `Module scaffold: ${template_type} — ${module_name}`, ['template_type', 'module_name']);

      return new Response(JSON.stringify({ text, template_type, module_name }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // ANALYZE — Deep code analysis for bugs, security, performance
    // ════════════════════════════════════════════════════════════════════
    if (action === 'analyze') {
      const { file_path = 'unknown', code_context = '', analysis_type = 'general' } = body;

      const analysisPrompts: Record<string, string> = {
        bugs:        'Identify ALL bugs, edge cases, and runtime errors. For each bug: (1) location, (2) root cause, (3) exact fix with code.',
        security:    'Security audit: check for: XSS risks, unprotected DB queries, exposed credentials, missing RLS, auth bypasses, insecure direct object references.',
        performance: 'Performance review: check for: unnecessary re-renders, missing memoization, N+1 DB queries, large bundle sizes, blocking operations.',
        general:     'Full code review: bugs, performance, security, best practices, and VELO 2.0 pattern compliance.',
      };

      const analysisInstruction = analysisPrompts[analysis_type] || analysisPrompts.general;

      let text = 'Analysis failed.';
      try {
        text = await callAI([
          { role: 'system', content: `You are a senior VELO 2.0 code reviewer. ${analysisInstruction}\n\nFile: ${file_path}` },
          { role: 'user', content: `Analyze this code:\n\n\`\`\`\n${code_context.slice(0, 4000)}\n\`\`\`` },
        ]);
      } catch (err) {
        text = `❌ Analysis error: ${String(err)}`;
      }

      await auditLog('dev_console_analyze', `Code analysis: ${analysis_type} on ${file_path}`, [file_path, analysis_type]);

      return new Response(JSON.stringify({ text, analysis_type, file_path }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // SCHEMA CHECK — Database schema inspection
    // ════════════════════════════════════════════════════════════════════
    if (action === 'schema_check') {
      try {
        const { data: tables } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_schema, table_name')
          .eq('table_schema', 'public');

        const { data: columns } = await supabaseAdmin
          .from('information_schema.columns')
          .select('table_name, column_name, data_type, is_nullable, column_default')
          .eq('table_schema', 'public')
          .order('table_name')
          .order('ordinal_position');

        return new Response(JSON.stringify({ schema: { tables: tables ?? [], columns: columns ?? [] } }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err) {
        return new Response(JSON.stringify({ schema: { tables: [], columns: [] }, error: String(err) }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // ════════════════════════════════════════════════════════════════════
    // FETCH LOGS — Read system logs for the developer console
    // ════════════════════════════════════════════════════════════════════
    if (action === 'fetch_logs') {
      const { log_type = 'audit', limit = 50, filter_query = '' } = body;

      let data = null;
      let error = null;

      if (log_type === 'audit') {
        const query = supabaseAdmin.from('identity_consent_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
        const result = await (filter_query ? query.ilike('action', `%${filter_query}%`) : query);
        data = result.data; error = result.error;
      } else if (log_type === 'automation') {
        const query = supabaseAdmin.from('automation_sessions').select('id, name, platform, status, runner_id, started_at, completed_at, runtime_ms, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
        const result = await query;
        data = result.data; error = result.error;
      } else if (log_type === 'notifications') {
        const result = await supabaseAdmin.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(limit);
        data = result.data; error = result.error;
      } else if (log_type === 'identity') {
        const result = await supabaseAdmin.from('user_identity').select('*').eq('user_id', user.id).maybeSingle();
        data = result.data ? [result.data] : []; error = result.error;
      }

      return new Response(JSON.stringify({ data: data ?? [], error: error?.message ?? null }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // LOG DEPLOYMENT — Record deployment to audit trail
    // ════════════════════════════════════════════════════════════════════
    if (action === 'log_deployment') {
      const { deploy_id, files_changed, status, notes } = body;

      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        type: 'deployment',
        title: `Deployment ${status === 'success' ? 'Succeeded' : 'Failed'}: ${deploy_id}`,
        message: `${files_changed?.length ?? 0} files changed. ${notes || ''}`,
        data: { deploy_id, files_changed, status, timestamp: new Date().toISOString() },
        priority: status === 'success' ? 'normal' : 'high',
      });

      await auditLog('dev_console_deploy', `Deployment: ${deploy_id} — ${status}`, files_changed ?? []);

      return new Response(JSON.stringify({ logged: true, deploy_id }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ════════════════════════════════════════════════════════════════════
    // QUICK FIX — Fast single-purpose AI fix for known issues
    // ════════════════════════════════════════════════════════════════════
    if (action === 'quick_fix') {
      const { issue_type, context = '' } = body;

      const fixPrompts: Record<string, string> = {
        rls_missing:       'Generate missing RLS policies for this table following VELO 2.0 patterns',
        typescript_error:  'Fix the TypeScript error in this code',
        react_query_error: 'Fix the React Query configuration issue in this code',
        cors_error:        'Fix the CORS configuration in this Edge Function',
        auth_error:        'Fix the authentication/authorization issue in this code',
      };

      const prompt = fixPrompts[issue_type] || `Fix the issue: ${issue_type}`;

      let text = 'Fix generation failed.';
      try {
        text = await callAI([
          { role: 'system', content: 'You are VELO DevBot. Provide a direct, working fix. Show only the corrected code with brief comments explaining the fix.' },
          { role: 'user', content: `${prompt}\n\nContext:\n\`\`\`\n${context.slice(0, 2000)}\n\`\`\`` },
        ]);
      } catch (err) {
        text = `❌ Quick fix error: ${String(err)}`;
      }

      await auditLog('dev_console_quick_fix', `Quick fix: ${issue_type}`, [issue_type]);

      return new Response(JSON.stringify({ text, issue_type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Unknown action
    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[dev-console] Fatal error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
