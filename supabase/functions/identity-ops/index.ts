import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
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

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || (req.method === 'GET' ? 'get' : 'upsert');

    // ── GET identity ──────────────────────────────────────────────────────────
    if (action === 'get') {
      const { data, error } = await admin
        .from('user_identity')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return new Response(JSON.stringify({ identity: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json();

    // ── UPSERT identity ───────────────────────────────────────────────────────
    if (action === 'upsert') {
      const { identity } = body;
      const { data, error } = await admin
        .from('user_identity')
        .upsert({ ...identity, user_id: user.id }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;

      // Log the save
      await admin.rpc('log_identity_access', {
        p_user_id: user.id,
        p_action: 'identity_updated',
        p_purpose: 'User updated their identity profile',
        p_fields: Object.keys(identity),
      });

      console.log(`[identity-ops] Identity upserted for user ${user.id}, score: ${data.completeness_score}`);
      return new Response(JSON.stringify({ identity: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── GIVE CONSENT ──────────────────────────────────────────────────────────
    if (action === 'consent') {
      const { scope, approved_for_applications, approved_for_registration, approved_for_communication } = body;
      const { data, error } = await admin
        .from('user_identity')
        .upsert({
          user_id: user.id,
          consent_given: true,
          consent_timestamp: new Date().toISOString(),
          consent_scope: scope || ['applications', 'registration', 'communication'],
          approved_for_applications: approved_for_applications ?? true,
          approved_for_registration: approved_for_registration ?? true,
          approved_for_communication: approved_for_communication ?? true,
        }, { onConflict: 'user_id' })
        .select()
        .single();
      if (error) throw error;

      await admin.rpc('log_identity_access', {
        p_user_id: user.id,
        p_action: 'consent_given',
        p_purpose: 'User granted consent for identity use',
        p_fields: scope || ['applications', 'registration', 'communication'],
      });

      return new Response(JSON.stringify({ success: true, identity: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── REVOKE CONSENT ────────────────────────────────────────────────────────
    if (action === 'revoke_consent') {
      await admin
        .from('user_identity')
        .update({
          consent_given: false,
          consent_timestamp: null,
          approved_for_applications: false,
          approved_for_registration: false,
          approved_for_communication: false,
        })
        .eq('user_id', user.id);

      await admin.rpc('log_identity_access', {
        p_user_id: user.id,
        p_action: 'consent_revoked',
        p_purpose: 'User revoked identity use consent',
        p_fields: [],
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── ELIGIBILITY CHECK ─────────────────────────────────────────────────────
    if (action === 'eligibility_check') {
      const { autopilot_id, opportunity_id, required_fields = [] } = body;

      // Fetch identity
      const { data: identity } = await admin
        .from('user_identity')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      // Fetch autopilot
      const { data: autopilot } = await admin
        .from('autopilots')
        .select('*')
        .eq('id', autopilot_id)
        .maybeSingle();

      const checks: { check: string; passed: boolean; message: string }[] = [];
      const missing: string[] = [];

      // 1. Identity exists
      checks.push({
        check: 'identity_exists',
        passed: !!identity,
        message: identity ? 'Identity profile found' : 'No identity profile configured',
      });
      if (!identity) missing.push('identity_profile');

      // 2. Consent given
      checks.push({
        check: 'consent_given',
        passed: identity?.consent_given === true,
        message: identity?.consent_given ? 'User consent granted' : 'User consent required',
      });
      if (!identity?.consent_given) missing.push('user_consent');

      // 3. Approved for applications
      checks.push({
        check: 'approved_for_applications',
        passed: identity?.approved_for_applications === true,
        message: identity?.approved_for_applications ? 'Approved for automated applications' : 'Application approval required',
      });
      if (!identity?.approved_for_applications) missing.push('application_approval');

      // 4. Required identity fields
      const REQUIRED: Array<keyof typeof identity> = ['full_name', 'email', 'headline', 'skills'];
      for (const field of REQUIRED) {
        const val = identity?.[field];
        const passed = val !== null && val !== undefined && val !== '' && (!Array.isArray(val) || val.length > 0);
        checks.push({
          check: `field_${field}`,
          passed,
          message: passed ? `${field} is present` : `Missing required field: ${field}`,
        });
        if (!passed) missing.push(field);
      }

      // 5. Completeness threshold
      const score = identity?.completeness_score ?? 0;
      checks.push({
        check: 'completeness_threshold',
        passed: score >= 50,
        message: score >= 50 ? `Profile ${score}% complete (threshold: 50%)` : `Profile only ${score}% complete — needs 50%+`,
      });
      if (score < 50) missing.push('profile_completeness');

      // 6. Autopilot active
      checks.push({
        check: 'autopilot_active',
        passed: autopilot?.status !== 'error',
        message: autopilot?.status !== 'error' ? 'Autopilot operational' : 'Autopilot in error state',
      });
      if (autopilot?.status === 'error') missing.push('autopilot_status');

      // 7. Workload capacity
      const hasCapacity = (autopilot?.current_workload ?? 0) < (autopilot?.workload_limit ?? 10);
      checks.push({
        check: 'workload_capacity',
        passed: hasCapacity,
        message: hasCapacity ? 'Autopilot has capacity' : 'Autopilot workload limit reached',
      });
      if (!hasCapacity) missing.push('workload_capacity');

      const isEligible = missing.length === 0;
      const requiresApproval = !identity?.consent_given || !identity?.approved_for_applications;

      // Persist eligibility result
      const { data: eligData } = await admin
        .from('autopilot_eligibility')
        .insert({
          user_id: user.id,
          autopilot_id,
          opportunity_id: opportunity_id || null,
          is_eligible: isEligible,
          checks,
          missing_requirements: missing,
          requires_user_approval: requiresApproval,
        })
        .select()
        .single();

      // Log the check
      await admin.rpc('log_identity_access', {
        p_user_id: user.id,
        p_action: 'eligibility_checked',
        p_purpose: `Eligibility check for opportunity ${opportunity_id || 'unknown'}`,
        p_fields: ['identity_profile', 'consent', 'approvals'],
        p_autopilot_id: autopilot_id,
        p_opportunity_id: opportunity_id || null,
      });

      return new Response(JSON.stringify({
        is_eligible: isEligible,
        checks,
        missing_requirements: missing,
        requires_approval: requiresApproval,
        eligibility_id: eligData?.id,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ── ACCESS IDENTITY FOR APPLICATION ──────────────────────────────────────
    if (action === 'access_for_application') {
      const { autopilot_id, opportunity_id, platform, purpose } = body;

      const { data: identity } = await admin
        .from('user_identity')
        .select('full_name, email, phone, headline, bio, skills, location_country, location_city, portfolio_url, linkedin_url, github_url, languages, years_experience, hourly_rate_min, hourly_rate_currency')
        .eq('user_id', user.id)
        .single();

      if (!identity) {
        return new Response(JSON.stringify({ error: 'No identity profile found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verify consent before sharing
      const { data: identityFull } = await admin
        .from('user_identity')
        .select('consent_given, approved_for_applications')
        .eq('user_id', user.id)
        .single();

      if (!identityFull?.consent_given || !identityFull?.approved_for_applications) {
        return new Response(JSON.stringify({ error: 'User consent not granted for applications' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Log access
      await admin.rpc('log_identity_access', {
        p_user_id: user.id,
        p_action: 'data_used',
        p_purpose: purpose || `Application submission via ${platform}`,
        p_fields: Object.keys(identity),
        p_platform: platform,
        p_autopilot_id: autopilot_id || null,
        p_opportunity_id: opportunity_id || null,
      });

      return new Response(JSON.stringify({ identity }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // ── GET CONSENT LOG ───────────────────────────────────────────────────────
    if (action === 'consent_log') {
      const { data, error } = await admin
        .from('identity_consent_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return new Response(JSON.stringify({ log: data || [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[identity-ops] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
