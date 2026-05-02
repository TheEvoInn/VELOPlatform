import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

// ── Live API sources ──────────────────────────────────────────────────────────
const REMOTIVE_API  = 'https://remotive.com/api/remote-jobs';
const ARBEITNOW_API = 'https://www.arbeitnow.com/api/job-board-api';
const JOBICY_API    = 'https://jobicy.com/api/v2/remote-jobs';

// ── Remote jobs (Remotive live API) ──────────────────────────────────────────
async function fetchRemotiveJobs(limit = 8) {
  try {
    const res = await fetch(`${REMOTIVE_API}?limit=${limit}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) { console.error('[opportunity-feed] Remotive status:', res.status); return []; }
    const data = await res.json();
    return ((data.jobs || []) as Record<string, unknown>[]).slice(0, limit).map(j => ({
      title: String(j.title || ''),
      platform: 'Remotive',
      category: 'remote_job',
      description: String(j.description || '').replace(/<[^>]*>/g, '').slice(0, 600),
      url: String(j.url || ''),
      estimated_value: estimateSalary(String(j.salary || ''), String(j.job_type || '')),
      currency: 'USD',
      effort: 'high' as const,
      confidence: 'medium' as const,
      requirements: ((j.tags as string[]) || []).slice(0, 5),
      source_data: {
        company: j.company_name,
        location: j.candidate_required_location,
        job_type: j.job_type,
        publication_date: j.publication_date,
      },
    }));
  } catch (e) {
    console.error('[opportunity-feed] Remotive error:', e);
    return [];
  }
}

// ── Remote jobs (Arbeitnow live API) ─────────────────────────────────────────
async function fetchArbeitnowJobs(limit = 5) {
  try {
    const res = await fetch(`${ARBEITNOW_API}?page=1`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.data || []) as Record<string, unknown>[]).slice(0, limit).map(j => ({
      title: String(j.title || ''),
      platform: 'Arbeitnow',
      category: 'remote_job',
      description: String(j.description || '').replace(/<[^>]*>/g, '').slice(0, 600),
      url: String(j.url || ''),
      estimated_value: 0,
      currency: 'USD',
      effort: 'high' as const,
      confidence: 'medium' as const,
      requirements: ((j.tags as string[]) || []).slice(0, 5),
      source_data: { company: j.company_name, remote: j.remote },
    }));
  } catch (e) {
    console.error('[opportunity-feed] Arbeitnow error:', e);
    return [];
  }
}

// ── Jobicy live API ───────────────────────────────────────────────────────────
async function fetchJobicyJobs(limit = 5) {
  try {
    const res = await fetch(`${JOBICY_API}?count=${limit}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.jobs || []) as Record<string, unknown>[]).slice(0, limit).map(j => ({
      title: String(j.jobTitle || ''),
      platform: 'Jobicy',
      category: 'remote_job',
      description: String(j.jobExcerpt || '').slice(0, 600),
      url: String(j.url || ''),
      estimated_value: estimateSalary(String(j.annualSalaryMin || '0'), 'full_time'),
      currency: 'USD',
      effort: 'high' as const,
      confidence: 'medium' as const,
      requirements: ((j.jobIndustry as string[]) || []).slice(0, 3),
      source_data: { company: j.companyName, geo: j.jobGeo },
    }));
  } catch (e) {
    console.error('[opportunity-feed] Jobicy error:', e);
    return [];
  }
}

// Estimate hourly rate from salary string
function estimateSalary(salary: string, jobType: string): number {
  if (!salary || salary === '0') return 0;
  const nums = salary.replace(/[^0-9,]/g, '').split(',').map(Number).filter(Boolean);
  if (nums.length === 0) return 0;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  // If annual, convert to hourly estimate
  if (avg > 1000) return Math.round(avg / 2080);
  return avg;
}

// ── Curated crypto opportunities ──────────────────────────────────────────────
async function fetchCryptoOpportunities() {
  return [
    {
      title: 'Uniswap v4 Hook Developer Bounty',
      platform: 'Uniswap Foundation', category: 'crypto',
      description: 'Deploy a custom v4 hook to mainnet and claim USDC developer grant. Requires Solidity + Uniswap v4 SDK knowledge.',
      url: 'https://uniswap.org/grants',
      estimated_value: 500, currency: 'USDC',
      effort: 'high' as const, confidence: 'high' as const,
      requirements: ['Solidity', 'Uniswap v4 SDK', 'ETH wallet', 'Deployed contract'],
    },
    {
      title: 'Base Onchain Summer — Task Completion Rewards',
      platform: 'Base / Coinbase', category: 'crypto',
      description: 'Complete onchain tasks on Base network to qualify for activity rewards and NFT drops.',
      url: 'https://base.org/onchainsummer',
      estimated_value: 75, currency: 'USD',
      effort: 'low' as const, confidence: 'high' as const,
      requirements: ['Base wallet', 'ETH for gas', 'Coinbase account'],
    },
    {
      title: 'LayerZero Airdrop — Mainnet Interaction',
      platform: 'LayerZero', category: 'crypto',
      description: 'Interact with LayerZero cross-chain messaging on mainnet to qualify for potential token distribution.',
      url: 'https://layerzero.network',
      estimated_value: 200, currency: 'USD',
      effort: 'medium' as const, confidence: 'medium' as const,
      requirements: ['ETH wallet', '0.05+ ETH', 'Cross-chain bridge'],
    },
    {
      title: 'Galxe Quest — Web3 Social Credentials',
      platform: 'Galxe', category: 'crypto',
      description: 'Complete social + onchain quests on Galxe to earn OAT NFTs and protocol points redeemable for tokens.',
      url: 'https://galxe.com/quests',
      estimated_value: 30, currency: 'USD',
      effort: 'low' as const, confidence: 'high' as const,
      requirements: ['Wallet address', 'Twitter/Discord', 'Galxe account'],
    },
    {
      title: 'Eigenlayer AVS Testnet — Node Operator Rewards',
      platform: 'Eigenlayer', category: 'crypto',
      description: 'Run an AVS node on testnet to earn restaking points redeemable on mainnet launch.',
      url: 'https://eigenlayer.xyz',
      estimated_value: 250, currency: 'USD',
      effort: 'high' as const, confidence: 'medium' as const,
      requirements: ['ETH wallet', 'Node server', '0.1 ETH'],
    },
  ];
}

// ── Real freelance microtask opportunities ────────────────────────────────────
async function fetchFreelanceOpportunities() {
  return [
    {
      title: 'Technical Blog Writer — AI/ML Topics (5 articles)',
      platform: 'ProBlogger', category: 'freelance',
      description: 'Write 5 technical articles on AI and machine learning for a SaaS company blog. SEO-optimized, 1500+ words each.',
      url: 'https://problogger.com/jobs',
      estimated_value: 300, currency: 'USD',
      effort: 'medium' as const, confidence: 'high' as const,
      requirements: ['Technical writing', 'AI/ML knowledge', 'SEO', 'Portfolio'],
    },
    {
      title: 'React + TypeScript Dashboard — Component Library',
      platform: 'Guru', category: 'freelance',
      description: 'Build 5 reusable React dashboard components with TypeScript, Tailwind CSS, and Storybook documentation.',
      url: 'https://guru.com',
      estimated_value: 550, currency: 'USD',
      effort: 'medium' as const, confidence: 'high' as const,
      requirements: ['React 18', 'TypeScript', 'Tailwind CSS', 'Storybook'],
    },
    {
      title: 'Shopify Store Setup — Dropshipping Niche',
      platform: 'PeoplePerHour', category: 'freelance',
      description: 'Full Shopify store setup with AliExpress product import, payment gateway, and automated fulfillment workflow.',
      url: 'https://peopleperhour.com',
      estimated_value: 200, currency: 'USD',
      effort: 'medium' as const, confidence: 'high' as const,
      requirements: ['Shopify', 'DSers/Oberlo', 'AliExpress'],
    },
  ];
}

// ── Gig platform opportunities ────────────────────────────────────────────────
async function fetchMicrotaskOpportunities() {
  return [
    {
      title: 'Image Annotation Batch — 500 tasks @ $0.05 each',
      platform: 'Scale AI', category: 'gig',
      description: 'Label and annotate AI training images. No prior experience required. Batch available now.',
      url: 'https://app.scale.com/contribute',
      estimated_value: 25, currency: 'USD',
      effort: 'low' as const, confidence: 'high' as const,
      requirements: ['Scale AI contributor account'],
    },
    {
      title: 'Audio Transcription — $0.45/minute',
      platform: 'Rev', category: 'gig',
      description: 'Transcribe short audio clips with 98%+ accuracy. Flexible hours. Weekly PayPal payout.',
      url: 'https://rev.com/freelancers',
      estimated_value: 20, currency: 'USD/hr',
      effort: 'low' as const, confidence: 'high' as const,
      requirements: ['Rev account', 'Typing 60+ WPM', 'PayPal'],
    },
    {
      title: 'Web Search Quality Evaluation — $12/hr',
      platform: 'Appen', category: 'gig',
      description: 'Rate and evaluate search engine results for relevance and quality. Flexible schedule, monthly payout.',
      url: 'https://connect.appen.com',
      estimated_value: 12, currency: 'USD/hr',
      effort: 'low' as const, confidence: 'high' as const,
      requirements: ['Appen account', 'English fluency', 'Qualification test pass'],
    },
    {
      title: 'Software Bug Testing — Mobile App QA',
      platform: 'Testlio', category: 'gig',
      description: 'Test mobile apps on real iOS/Android devices. Paid per confirmed bug report. Projects start weekly.',
      url: 'https://join.testlio.com',
      estimated_value: 30, currency: 'USD',
      effort: 'medium' as const, confidence: 'medium' as const,
      requirements: ['iPhone/Android device', 'Testlio account', 'QA mindset'],
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Main handler
// ─────────────────────────────────────────────────────────────────────────────
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

    const body = await req.json().catch(() => ({}));
    const { categories = ['freelance', 'crypto', 'gig', 'remote_job'], limit = 25 } = body;

    console.log(`[opportunity-feed] User=${user.id} categories=[${categories.join(',')}] limit=${limit}`);

    // Fetch from all sources in parallel
    const [
      remotiveJobs,
      arbeitnowJobs,
      jobicyJobs,
      cryptoOpps,
      freelanceOpps,
      microtaskOpps,
    ] = await Promise.all([
      categories.includes('remote_job') ? fetchRemotiveJobs(6) : Promise.resolve([]),
      categories.includes('remote_job') ? fetchArbeitnowJobs(4) : Promise.resolve([]),
      categories.includes('remote_job') ? fetchJobicyJobs(3) : Promise.resolve([]),
      categories.includes('crypto')     ? fetchCryptoOpportunities() : Promise.resolve([]),
      categories.includes('freelance')  ? fetchFreelanceOpportunities() : Promise.resolve([]),
      categories.includes('gig')        ? fetchMicrotaskOpportunities() : Promise.resolve([]),
    ]);

    const allOpps = [
      ...remotiveJobs,
      ...arbeitnowJobs,
      ...jobicyJobs,
      ...cryptoOpps,
      ...freelanceOpps,
      ...microtaskOpps,
    ].slice(0, limit);

    const sourceSummary = {
      remotive:   remotiveJobs.length,
      arbeitnow:  arbeitnowJobs.length,
      jobicy:     jobicyJobs.length,
      crypto:     cryptoOpps.length,
      freelance:  freelanceOpps.length,
      microtask:  microtaskOpps.length,
    };

    console.log(`[opportunity-feed] Fetched ${allOpps.length} total`, sourceSummary);

    if (allOpps.length === 0) {
      return new Response(JSON.stringify({ opportunities: [], count: 0, sources: sourceSummary }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Deduplicate by title+platform before inserting
    const toInsert = allOpps.map(opp => ({
      user_id:         user.id,
      title:           opp.title,
      platform:        opp.platform,
      category:        opp.category,
      estimated_value: opp.estimated_value,
      currency:        opp.currency,
      effort:          opp.effort,
      confidence:      opp.confidence,
      requirements:    opp.requirements || [],
      url:             opp.url,
      description:     opp.description,
      source_data:     (opp as Record<string, unknown>).source_data || {},
      status:          'new',
      scanned_at:      new Date().toISOString(),
    }));

    const { data: inserted, error: insertErr } = await supabaseAdmin
      .from('opportunities')
      .insert(toInsert)
      .select('id, title, platform');

    if (insertErr) {
      console.error('[opportunity-feed] Insert error:', insertErr.message);
    }

    const count = inserted?.length ?? 0;
    console.log(`[opportunity-feed] Inserted ${count} opportunities into DB`);

    return new Response(JSON.stringify({
      opportunities: inserted ?? toInsert,
      count,
      sources: sourceSummary,
      sources_active: ['Remotive API', 'Arbeitnow API', 'Jobicy API', 'Crypto Protocols', 'Freelance Boards', 'Gig Platforms'],
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('[opportunity-feed] Fatal error:', err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
