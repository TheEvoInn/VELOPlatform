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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    const { action } = body;

    if (action === 'get_summary') {
      const { data: txns } = await supabaseAdmin
        .from('wallet_transactions')
        .select('type, amount, currency, status')
        .eq('user_id', user.id);

      const confirmed = (txns || []).filter(t => t.status === 'confirmed');
      const totalEarned = confirmed.filter(t => ['earning', 'bonus'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
      const totalWithdrawn = confirmed.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0);
      const pendingEarnings = (txns || []).filter(t => t.status === 'pending' && ['earning', 'bonus'].includes(t.type)).reduce((s, t) => s + t.amount, 0);

      return new Response(JSON.stringify({
        totalEarned, totalWithdrawn,
        pendingEarnings,
        availableBalance: totalEarned - totalWithdrawn,
        currency: 'USD',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'add_earning') {
      const { amount, currency, description, task_id } = body;
      const { data, error } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          type: 'earning',
          amount,
          currency: currency || 'USD',
          description,
          status: 'confirmed',
          related_task_id: task_id || null,
        })
        .select()
        .single();
      if (error) throw error;
      return new Response(JSON.stringify({ transaction: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'withdraw') {
      const { amount, currency, description } = body;
      // Check available balance first
      const { data: txns } = await supabaseAdmin
        .from('wallet_transactions')
        .select('type, amount, status')
        .eq('user_id', user.id)
        .eq('status', 'confirmed');

      const earned = (txns || []).filter(t => ['earning', 'bonus'].includes(t.type)).reduce((s, t) => s + t.amount, 0);
      const withdrawn = (txns || []).filter(t => t.type === 'withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0);
      const available = earned - withdrawn;

      if (amount > available) {
        return new Response(JSON.stringify({ error: 'Insufficient balance' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const { data, error } = await supabaseAdmin
        .from('wallet_transactions')
        .insert({
          user_id: user.id,
          type: 'withdrawal',
          amount: -Math.abs(amount),
          currency: currency || 'USD',
          description: description || 'Manual withdrawal',
          status: 'confirmed',
        })
        .select()
        .single();
      if (error) throw error;

      return new Response(JSON.stringify({ transaction: data }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[wallet-ops] Error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
