import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: { user }, error: userError } = await createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    ).auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();
    const {
      content_type,
      context,
      autopilot_id,
      opportunity_id,
      identity,
      streaming = false
    } = body;

    // Build system prompt based on identity settings
    const identityPrompt = identity
      ? `You are ${identity.name}, ${identity.persona}. Your tone is ${identity.tone}. Writing style: ${identity.style}. ${identity.rules?.length ? 'Rules: ' + identity.rules.join('; ') : ''}`
      : 'You are a professional AI writing assistant for the VELO 2.0 platform.';

    // Build content-type specific user prompt
    let userPrompt = '';
    switch (content_type) {
      case 'cover_letter':
        userPrompt = `Write a compelling, personalized cover letter for this opportunity:
Job/Gig Title: ${context.title || context.job_title}
Platform: ${context.platform}
Description: ${context.description}
Required Skills: ${context.requirements?.join(', ') || 'Not specified'}
Estimated Value: ${context.estimatedValue} ${context.currency || 'USD'}

User context:
${context.user_name ? `Name: ${context.user_name}` : ''}
${context.user_headline ? `Headline: ${context.user_headline}` : ''}
${Array.isArray(context.user_skills) && context.user_skills.length ? `Skills: ${(context.user_skills as string[]).join(', ')}` : ''}

Use the template style: ${identity?.coverLetterTemplate || 'professional cover letter format'}
Keep it under 250 words. Be specific, confident, and results-oriented.`;
        break;

      case 'resume':
        userPrompt = `Create a targeted resume/profile for:
Opportunity: ${context.title}
Platform: ${context.platform}
Required Skills: ${context.requirements?.join(', ') || 'General skills'}
Persona: ${identity?.persona || 'Professional freelancer'}

Format as a clean, scannable resume. Highlight relevant experience and skills.`;
        break;

      case 'message':
        userPrompt = `Write a professional ${context.messageType || 'follow-up'} message:
Context: ${context.description}
Platform: ${context.platform}
Recipient: ${context.recipient || 'Client'}
Purpose: ${context.purpose || 'Professional communication'}

Keep it concise, warm, and action-oriented. Under 100 words.`;
        break;

      case 'product_description':
        userPrompt = `Write a compelling e-commerce product description:
Product: ${context.name}
Category: ${context.category}
Key Features: ${context.features?.join(', ') || context.description}
Target Audience: ${context.audience || 'Online shoppers'}
Platform: ${context.platform || 'Shopify'}

Write 2-3 sentences for the short description, then bullet points for features. SEO-optimized.`;
        break;

      case 'crypto_submission':
        userPrompt = `Write a crypto task completion submission:
Protocol: ${context.protocol}
Task: ${context.title}
Steps Completed: ${context.stepsCompleted?.join(', ') || 'All required steps'}
Wallet: ${context.wallet || '[WALLET_ADDRESS]'}

Write a brief, factual completion report for the protocol team. Include transaction references if provided.`;
        break;

      case 'research_summary':
        userPrompt = `Create a structured research summary:
Topic: ${context.topic}
Data Points: ${JSON.stringify(context.data || {})}
Purpose: ${context.purpose || 'Market research'}

Format as: Executive Summary (2 sentences), Key Findings (bullet points), Recommendation (1-2 sentences).`;
        break;

      case 'bio':
        userPrompt = `Write a professional bio for platform profile:
Name: ${context.user_name || identity?.name || 'Professional'}
Persona: ${identity?.persona || context.target_role || 'Skilled professional'}
Platform: ${context.platform}
Headline: ${context.user_headline || ''}
Skills: ${Array.isArray(context.skills) ? (context.skills as string[]).join(', ') : (Array.isArray(context.user_skills) ? (context.user_skills as string[]).join(', ') : 'Various skills')}
Years Experience: ${context.user_years_experience || context.years_experience || 0}

Write a first-person bio, 3-4 sentences. Authoritative and platform-appropriate.`;
        break;

      case 'email':
        userPrompt = `Write a professional email:
Subject context: ${context.subject}
To: ${context.to || 'Client'}
Purpose: ${context.purpose}
Key points: ${context.keyPoints?.join(', ') || context.description}

Professional, clear, and concise. Include subject line suggestion.`;
        break;

      default:
        userPrompt = `Generate ${content_type} content based on: ${JSON.stringify(context)}. Be professional and high-quality.`;
    }

    const apiKey = Deno.env.get('ONSPACE_AI_API_KEY');
    const baseUrl = Deno.env.get('ONSPACE_AI_BASE_URL');

    // ── Raw passthrough for identity field generation ─────────────────────────
    if (content_type === 'raw' || (context._raw_system && context._raw_user)) {
      console.log(`[ai-content] Raw passthrough for field: ${context.field_type || 'unknown'}`);
      const rawAiResponse = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: context._raw_system as string },
            { role: 'user', content: context._raw_user as string },
          ],
          stream: false,
        }),
      });
      if (!rawAiResponse.ok) {
        const errText = await rawAiResponse.text();
        return new Response(JSON.stringify({ error: `AI API Error: ${errText}` }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const rawAiData = await rawAiResponse.json();
      const rawText = rawAiData.choices?.[0]?.message?.content ?? '';
      await supabase.from('ai_content_cache').insert({
        user_id: user.id,
        content_type: `identity_${context.field_type || 'field'}`,
        input_context: { field_type: context.field_type },
        output_text: rawText,
        model_used: 'google/gemini-3-flash-preview',
      });
      return new Response(JSON.stringify({ text: rawText, content_type }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[ai-content] Generating ${content_type} for user ${user.id}`);

    const aiResponse = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: identityPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[ai-content] AI API error:', errText);
      return new Response(JSON.stringify({ error: `AI API Error: ${errText}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const aiData = await aiResponse.json();
    const generatedText = aiData.choices?.[0]?.message?.content ?? '';

    // Cache the result
    await supabase.from('ai_content_cache').insert({
      user_id: user.id,
      content_type,
      input_context: context,
      output_text: generatedText,
      model_used: 'google/gemini-3-flash-preview',
      autopilot_id: autopilot_id || null,
      opportunity_id: opportunity_id || null,
    });

    console.log(`[ai-content] Generated ${generatedText.length} chars for ${content_type}`);

    return new Response(JSON.stringify({ text: generatedText, content_type }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[ai-content] Unexpected error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
