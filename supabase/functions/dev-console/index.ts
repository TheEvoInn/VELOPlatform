import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ───────────────────────────────────────────────────────────────
    // AUTH
    // ───────────────────────────────────────────────────────────────
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
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ───────────────────────────────────────────────────────────────
    // REQUEST BODY
    // ───────────────────────────────────────────────────────────────
    const body = await req.json().catch(() => ({}));
    const {
      action,
      messages,
      code_context,
      file_path,
      user_message,
      repo_tree,
      related_files,
      schema_snapshot
    } = body;

    const apiKey  = Deno.env.get('ONSPACE_AI_API_KEY') ?? '';
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL') ?? '';
    const codeServiceUrl = Deno.env.get('CODE_SERVICE_URL') ?? '';

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ───────────────────────────────────────────────────────────────
    // SAFE HELPERS (NEVER THROW)
    // ───────────────────────────────────────────────────────────────

    async function safeFetchCodeContext() {
      if (!codeServiceUrl) return {};
      try {
        const res = await fetch(`${codeServiceUrl}/context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path, query: user_message })
        });
        if (!res.ok) return {};
        return await res.json().catch(() => ({}));
      } catch {
        return {};
      }
    }

    async function safeSchemaSnapshot() {
      if (schema_snapshot) return schema_snapshot;

      try {
        const { data: tables } = await supabaseAdmin
          .from('information_schema.tables')
          .select('table_schema, table_name')
          .eq('table_schema', 'public');

        const { data: columns } = await supabaseAdmin
          .from('information_schema.columns')
          .select('table_schema, table_name, column_name, data_type, is_nullable')
          .eq('table_schema', 'public');

        return { tables: tables ?? [], columns: columns ?? [] };
      } catch {
        return { tables: [], columns: [] };
      }
    }

    // ───────────────────────────────────────────────────────────────
    // AI ASSIST
    // ───────────────────────────────────────────────────────────────
    if (action === 'ai_assist') {
      if (!apiKey || !baseUrl) {
        return new Response(JSON.stringify({ error: 'AI not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const external = await safeFetchCodeContext();
      const schema  = await safeSchemaSnapshot();

      const systemPrompt = `
You are VELO DevBot, an expert AI code assistant for the VELO 2.0 platform.

You ALWAYS:
- Use ONLY the context provided below.
- Never invent file paths, modules, or components.
- Clearly state when context is missing.
- Suggest fixes based strictly on available code.
- Follow React 18 + TypeScript + Tailwind + shadcn/ui patterns.
- Follow VELO's galaxy/HUD theme.

CURRENT FILE:
${file_path || 'Unknown'}

PRIMARY CODE CONTEXT:
\`\`\`
${code_context || 'No code context provided.'}
\`\`\`

REPO TREE (may be partial or missing):
\`\`\`
${repo_tree ? JSON.stringify(repo_tree, null, 2) : 'Not provided'}
\`\`\`

RELATED FILES:
\`\`\`
${related_files ? JSON.stringify(related_files, null, 2) : 'None provided'}
\`\`\`

EXTERNAL CODE CONTEXT:
\`\`\`
${JSON.stringify(external, null, 2)}
\`\`\`

DATABASE SCHEMA SNAPSHOT:
\`\`\`
${JSON.stringify(schema, null, 2)}
\`\`\`

GUIDELINES:
- If you need another file, explicitly say: "Request file: <path>"
- If something is unclear, say so instead of guessing.
- Provide fixes in fenced code blocks.
- Explain root cause before showing the fix.
`;

      const conversationMessages = [
        { role: 'system', content: systemPrompt },
        ...(messages || []),
        { role: 'user', content: user_message || 'Analyze this code.' }
      ];

      const aiRes = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: conversationMessages,
          max_tokens: 4096
        })
      });

      const aiData = await aiRes.json().catch(() => ({}));
      const text = aiData?.choices?.[0]?.message?.content ?? 'No response generated.';

      await supabaseAdmin.from('identity_consent_log').insert({
        user_id: user.id,
        action: 'dev_console_ai_assist',
        purpose: `AI code assistance on: ${file_path || 'unknown file'}`,
        fields_accessed: ['file_path', 'code_context'],
        approved_by_user: true
      });

      return new Response(JSON.stringify({ text }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ───────────────────────────────────────────────────────────────
    // SCHEMA CHECK
    // ───────────────────────────────────────────────────────────────
    if (action === 'schema_check') {
      const snapshot = await safeSchemaSnapshot();
      return new Response(JSON.stringify({ schema: snapshot }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ───────────────────────────────────────────────────────────────
    // DEPLOY LOG
    // ───────────────────────────────────────────────────────────────
    if (action === 'log_deployment') {
      const { deploy_id, files_changed, status, notes } = body;

      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        type: 'deployment',
        title: `Deployment ${status === 'success' ? 'Succeeded' : 'Failed'}: ${deploy_id}`,
        message: `${files_changed?.length ?? 0} files changed. ${notes || ''}`,
        data: { deploy_id, files_changed, status, timestamp: new Date().toISOString() },
        priority: status === 'success' ? 'normal' : 'high'
      });

      return new Response(JSON.stringify({ logged: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ───────────────────────────────────────────────────────────────
    // UNKNOWN ACTION
    // ───────────────────────────────────────────────────────────────
    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});