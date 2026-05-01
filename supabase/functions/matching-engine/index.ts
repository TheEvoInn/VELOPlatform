import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

function computeSkillScore(skills: string[], requirements: string[]): number {
  if (!requirements.length) return 80;
  const matches = requirements.filter(req =>
    skills.some(skill => skill.toLowerCase().includes(req.toLowerCase()) || req.toLowerCase().includes(skill.toLowerCase()))
  );
  return Math.round((matches.length / requirements.length) * 100);
}

function computeEffortScore(effort: string, workloadCurrent: number, workloadLimit: number): number {
  const available = workloadLimit - workloadCurrent;
  if (available <= 0) return 0;
  const effortMap: Record<string, number> = { low: 100, medium: 75, high: 50 };
  return effortMap[effort] ?? 75;
}

function computeDeadlineScore(deadline?: string): number {
  if (!deadline) return 80;
  const daysLeft = (new Date(deadline).getTime() - Date.now()) / 86400000;
  if (daysLeft < 0) return 0;
  if (daysLeft < 1) return 40;
  if (daysLeft < 3) return 90;
  if (daysLeft < 7) return 85;
  if (daysLeft < 14) return 75;
  return 70;
}

function computeCategoryScore(autopilotCategories: string[], oppCategory: string): number {
  return autopilotCategories.some(c => c.toLowerCase() === oppCategory?.toLowerCase()) ? 100 : 20;
}

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { opportunity_id, auto_assign = false } = body;

    // Fetch opportunity
    const { data: opp, error: oppErr } = await supabaseAdmin
      .from('opportunities')
      .select('*')
      .eq('id', opportunity_id)
      .eq('user_id', user.id)
      .single();

    if (oppErr || !opp) {
      return new Response(JSON.stringify({ error: 'Opportunity not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch active autopilots
    const { data: autopilots } = await supabaseAdmin
      .from('autopilots')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'idle']);

    if (!autopilots?.length) {
      return new Response(JSON.stringify({ matches: [], message: 'No active autopilots' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Score each autopilot
    const matches = autopilots.map(ap => {
      const skillScore = computeSkillScore(ap.skills || [], opp.requirements || []);
      const categoryScore = computeCategoryScore(ap.allowed_categories || [], opp.category);
      const effortScore = computeEffortScore(opp.effort, ap.current_workload, ap.workload_limit);
      const deadlineScore = computeDeadlineScore(opp.deadline);
      const totalScore = Math.round(skillScore * 0.35 + categoryScore * 0.30 + effortScore * 0.20 + deadlineScore * 0.15);

      const confidence = totalScore >= 80 ? 'high' : totalScore >= 60 ? 'medium' : 'low';
      const recommendation = totalScore >= 80 ? 'top' : totalScore >= 60 ? 'secondary' : 'low_confidence';

      const reasons: string[] = [];
      if (skillScore > 80) reasons.push(`Strong skill match (${skillScore}%)`);
      if (categoryScore === 100) reasons.push(`Perfect category alignment: ${opp.category}`);
      if (effortScore > 80) reasons.push(`Workload capacity available`);
      if (deadlineScore > 85) reasons.push(`Optimal deadline window`);
      if (skillScore < 50) reasons.push(`Skill gap — consider training`);

      return {
        autopilot_id: ap.id,
        autopilot_name: ap.name,
        opportunity_id: opp.id,
        total_score: totalScore,
        skill_score: skillScore,
        category_score: categoryScore,
        effort_score: effortScore,
        deadline_score: deadlineScore,
        confidence,
        recommendation,
        reasons,
      };
    }).sort((a, b) => b.total_score - a.total_score);

    // Auto-assign to best match if requested
    if (auto_assign && matches.length > 0 && matches[0].total_score >= 70) {
      const best = matches[0];
      await supabaseAdmin
        .from('opportunities')
        .update({ matched_autopilot_id: best.autopilot_id, status: 'matched' })
        .eq('id', opportunity_id);

      // Create task for the match
      await supabaseAdmin.from('tasks').insert({
        user_id: user.id,
        name: `Apply to: ${opp.title}`,
        type: 'application',
        status: 'queued',
        autopilot_id: best.autopilot_id,
        opportunity_id: opp.id,
        priority: best.total_score >= 90 ? 1 : 2,
        progress: 0,
        logs: [],
      });

      // Notify
      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        type: 'opportunity',
        title: 'Autopilot Matched & Assigned',
        message: `${best.autopilot_name} matched to "${opp.title}" (Score: ${best.total_score}%)`,
        data: { opportunity_id: opp.id, autopilot_id: best.autopilot_id, score: best.total_score },
        priority: 'high',
      });
    }

    return new Response(JSON.stringify({ matches, opportunity: opp }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[matching-engine] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
