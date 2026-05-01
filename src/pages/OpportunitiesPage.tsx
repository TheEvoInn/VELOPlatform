import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radar, RefreshCw, Filter, ExternalLink, Zap, Rocket, CheckCircle,
  AlertCircle, Globe, Cpu, Bitcoin, Briefcase, ShoppingBag, Wifi, WifiOff,
} from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import ApplicationWorkflow from '@/components/features/ApplicationWorkflow';
import { checkPlatformCompliance } from '@/components/features/PlatformTermsChecker';
import { fetchOpportunityFeed, getOpportunitiesFromDB, runMatchingEngine } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { formatCurrency, timeAgo } from '@/lib/mockData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const CATEGORIES = ['all', 'freelance', 'crypto', 'gig', 'remote_job', 'dropshipping'];

const CATEGORY_ICONS: Record<string, React.ElementType> = {
  all:          Globe,
  freelance:    Briefcase,
  crypto:       Bitcoin,
  gig:          Zap,
  remote_job:   Globe,
  dropshipping: ShoppingBag,
};

const CONFIDENCE_COLORS = {
  high:   'text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)]',
  medium: 'text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.08)]',
  low:    'text-muted-foreground border-[hsl(var(--border))] bg-[hsl(228_25%_10%)]',
};

const SCAN_SOURCES = [
  { id: 'remote_job',   label: 'Remotive Jobs',      icon: Globe,        color: 'hsl(185,100%,55%)' },
  { id: 'crypto',       label: 'Crypto Protocols',   icon: Bitcoin,      color: 'hsl(265,80%,70%)' },
  { id: 'freelance',    label: 'Freelance Boards',   icon: Briefcase,    color: 'hsl(145,100%,55%)' },
  { id: 'gig',          label: 'Microtask Platforms', icon: Zap,         color: 'hsl(30,100%,60%)' },
];

interface DBOpportunity {
  id: string;
  title: string;
  platform: string;
  category: string;
  estimated_value: number;
  currency: string;
  effort: string;
  deadline?: string;
  requirements: string[];
  confidence: 'high' | 'medium' | 'low';
  url?: string;
  status: string;
  description?: string;
  scanned_at: string;
  matched_autopilot_id?: string;
}

type SourceStatus = 'idle' | 'scanning' | 'done' | 'error';

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState<DBOpportunity[]>([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [matchingId, setMatchingId] = useState<string | null>(null);
  const [applyingOpp, setApplyingOpp] = useState<DBOpportunity | null>(null);
  const [userCategories, setUserCategories] = useState<string[]>(['freelance', 'crypto', 'gig', 'remote_job']);

  // Real-time scanner state
  const [sourceStatuses, setSourceStatuses] = useState<Record<string, SourceStatus>>({});
  const [scanLog, setScanLog] = useState<string[]>([]);
  const [scanNewCount, setScanNewCount] = useState(0);
  const [autoMatchingCount, setAutoMatchingCount] = useState(0);
  const [autoMatchDone, setAutoMatchDone] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  // ── Load user's preferred categories from onboarding ────────────────────
  useEffect(() => {
    supabase
      .from('onboarding_progress')
      .select('selected_categories')
      .maybeSingle()
      .then(({ data }) => {
        if (data?.selected_categories?.length) {
          setUserCategories(data.selected_categories);
        }
      });
  }, []);

  // ── Scroll log to bottom on update ──────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [scanLog]);

  const addLog = useCallback((msg: string) => {
    setScanLog(prev => [...prev.slice(-40), msg]);
  }, []);

  const loadOpportunities = useCallback(async () => {
    const { data, error } = await getOpportunitiesFromDB();
    if (!error && data) {
      setOpportunities(data as DBOpportunity[]);
      if ((data as DBOpportunity[]).length > 0) {
        setLastScan((data as DBOpportunity[])[0].scanned_at);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadOpportunities();
    const interval = setInterval(loadOpportunities, 30000);
    return () => clearInterval(interval);
  }, [loadOpportunities]);

  // ── Auto-run matching on newly discovered opportunities ──────────────────
  const autoRunMatching = useCallback(async (newOpps: DBOpportunity[]) => {
    if (newOpps.length === 0) return;
    setAutoMatchingCount(0);
    setAutoMatchDone(false);

    const toMatch = newOpps.filter(o => !o.matched_autopilot_id).slice(0, 8);
    if (toMatch.length === 0) { setAutoMatchDone(true); return; }

    addLog(`\n⟳ Auto-matching ${toMatch.length} new opportunities to Autopilots...`);

    let matched = 0;
    for (const opp of toMatch) {
      const { data, error } = await runMatchingEngine(opp.id, true);
      if (!error) {
        const matches = (data as { matches: { autopilot_name: string; total_score: number }[] })?.matches ?? [];
        if (matches.length > 0) {
          matched++;
          addLog(`  ✓ "${opp.title.slice(0, 40)}..." → ${matches[0].autopilot_name} (${matches[0].total_score}%)`);
        }
      }
      setAutoMatchingCount(n => n + 1);
    }

    setAutoMatchDone(true);
    addLog(`\n✓ Matching complete — ${matched}/${toMatch.length} opportunities assigned`);
    if (matched > 0) {
      toast.success(`${matched} opportunities auto-matched to Autopilots`);
    }
    await loadOpportunities();
  }, [addLog, loadOpportunities]);

  // ── Live scanner ─────────────────────────────────────────────────────────
  const runScan = async () => {
    if (scanning) return;
    setScanning(true);
    setScanLog([]);
    setScanNewCount(0);
    setAutoMatchDone(false);
    setAutoMatchingCount(0);

    const activeSources = SCAN_SOURCES.filter(s =>
      userCategories.includes(s.id) || userCategories.length === 0
    );

    addLog('╔════════════════════════════════════════╗');
    addLog('║   VELO STAR SCANNER — INITIATING       ║');
    addLog('╚════════════════════════════════════════╝');
    addLog(`› Targeting ${activeSources.length} opportunity sources`);
    addLog(`› User categories: ${userCategories.join(', ')}`);
    addLog('');

    // Mark all active sources as scanning
    const initialStatuses: Record<string, SourceStatus> = {};
    SCAN_SOURCES.forEach(s => { initialStatuses[s.id] = 'idle'; });
    setSourceStatuses(initialStatuses);

    // Animate source scanning sequentially for real-time feel
    for (const source of SCAN_SOURCES) {
      if (!userCategories.includes(source.id)) {
        setSourceStatuses(prev => ({ ...prev, [source.id]: 'idle' }));
        continue;
      }
      setSourceStatuses(prev => ({ ...prev, [source.id]: 'scanning' }));
      addLog(`⟳ Connecting to ${source.label}...`);
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
    }

    addLog('');
    addLog('⟳ Dispatching scan requests to all sources...');

    // Actual API call
    const { data, error } = await fetchOpportunityFeed(userCategories, 30);

    // Update source statuses based on result
    SCAN_SOURCES.forEach(s => {
      setSourceStatuses(prev => ({
        ...prev,
        [s.id]: userCategories.includes(s.id) ? (error ? 'error' : 'done') : 'idle',
      }));
    });

    if (error) {
      addLog('');
      addLog(`✗ Scan failed: ${error}`);
      toast.error('Scan failed: ' + error);
      setScanning(false);
      return;
    }

    const count = data?.count || 0;
    const sources = data?.sources || [];
    setScanNewCount(count);

    addLog('');
    sources.forEach(s => addLog(`  ✓ ${s} — scanned successfully`));
    addLog('');
    addLog(`✓ Discovered ${count} new opportunities`);
    addLog(`› Saving to database...`);

    setLastScan(new Date().toISOString());
    await loadOpportunities();

    addLog(`› Database updated — ${count} records inserted`);
    toast.success(`Star Scanner: ${count} new opportunities discovered`);

    // Get the newly inserted opportunities for auto-matching
    const { data: freshOpps } = await getOpportunitiesFromDB();
    const newOpps = (freshOpps as DBOpportunity[] ?? [])
      .filter(o => o.status === 'new')
      .slice(0, 8);

    setScanning(false);

    // Auto-run matching engine
    await autoRunMatching(newOpps);
  };

  const matchOpportunity = async (id: string) => {
    setMatchingId(id);
    const { data, error } = await runMatchingEngine(id, true);
    if (error) {
      toast.error('Matching failed: ' + error);
    } else {
      const matches = (data as { matches: { autopilot_name: string; total_score: number }[] })?.matches || [];
      if (matches.length > 0) {
        toast.success(`Matched to ${matches[0].autopilot_name} (Score: ${matches[0].total_score}%)`);
      } else {
        toast.info('No suitable autopilots — create autopilots with relevant skills first');
      }
      await loadOpportunities();
    }
    setMatchingId(null);
  };

  const filtered = filter === 'all' ? opportunities : opportunities.filter(o => o.category === filter);
  const high = opportunities.filter(o => o.confidence === 'high').length;
  const totalValue = opportunities.reduce((s, o) => s + (o.estimated_value || 0), 0);
  const matched = opportunities.filter(o => o.matched_autopilot_id).length;

  const scanIsActive = scanning || (autoMatchingCount > 0 && !autoMatchDone);

  return (
    <div className="space-y-6 slide-in-up">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Discovered" value={`${opportunities.length}`}      sub="in live feed"      icon={<Radar size={16} />} accent="cyan" />
        <StatCard label="High Confidence"  value={`${high}`}                       sub="ready to apply"    accent="green" />
        <StatCard label="Auto-Matched"     value={`${matched}`}                    sub="assigned to pilots" accent="violet" />
        <StatCard label="Est. Total Value" value={`~${formatCurrency(totalValue)}`} sub="across all opps"  accent="orange" />
      </div>

      {/* Scanner HUD */}
      <div className={cn(
        'glass-panel rounded-xl border transition-all duration-500',
        scanIsActive
          ? 'border-[hsl(185_100%_50%/0.4)] shadow-[0_0_24px_hsl(185_100%_50%/0.12)]'
          : 'border-[hsl(185_100%_50%/0.15)]'
      )}>
        <div className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              {/* Radar pulse */}
              <div className="relative w-8 h-8 flex-shrink-0">
                <div className={cn(
                  'absolute inset-0 rounded-full border-2 transition-colors',
                  scanIsActive ? 'border-[hsl(185,100%,55%)] animate-ping opacity-30' : 'border-[hsl(145,100%,55%/0.4)]'
                )} />
                <div className={cn(
                  'absolute inset-1 rounded-full flex items-center justify-center',
                  scanIsActive ? 'bg-[hsl(185_100%_50%/0.2)]' : 'bg-[hsl(145_100%_50%/0.1)]'
                )}>
                  <Radar size={14} className={scanIsActive ? 'text-[hsl(185,100%,55%)] animate-spin' : 'text-[hsl(145,100%,55%)]'} />
                </div>
              </div>
              <div>
                <div className="text-xs font-bold" style={{ fontFamily: 'Orbitron', color: scanIsActive ? 'hsl(185,100%,55%)' : 'hsl(145,100%,55%)' }}>
                  {scanning ? 'STAR SCANNER — SCANNING...'
                    : autoMatchingCount > 0 && !autoMatchDone ? 'AUTO-MATCHING IN PROGRESS...'
                    : 'STAR SCANNER — ONLINE'}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {lastScan ? `Last scan: ${timeAgo(lastScan)}` : 'No scans yet'}
                  {userCategories.length > 0 && ` · Targeting: ${userCategories.slice(0, 3).join(', ')}${userCategories.length > 3 ? '...' : ''}`}
                </div>
              </div>
            </div>
            <button
              onClick={runScan}
              disabled={scanIsActive}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all"
            >
              <RefreshCw size={14} className={scanning ? 'animate-spin' : ''} />
              {scanning ? 'Scanning...' : autoMatchingCount > 0 && !autoMatchDone ? 'Matching...' : 'Run Live Scan'}
            </button>
          </div>

          {/* Source status row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-4">
            {SCAN_SOURCES.map(source => {
              const st = sourceStatuses[source.id] ?? 'idle';
              const Icon = source.icon;
              const active = userCategories.includes(source.id);
              return (
                <div key={source.id} className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all duration-300',
                  !active ? 'opacity-40 border-[hsl(var(--border))] bg-transparent' :
                  st === 'scanning' ? 'border-[hsl(185_100%_50%/0.5)] bg-[hsl(185_100%_50%/0.08)] shadow-[0_0_8px_hsl(185_100%_50%/0.15)]' :
                  st === 'done'     ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.06)]' :
                  st === 'error'    ? 'border-[hsl(0_85%_60%/0.3)] bg-[hsl(0_85%_60%/0.06)]' :
                  'border-[hsl(var(--border))] bg-[hsl(228_25%_10%/0.5)]'
                )}>
                  <div className={cn(
                    'w-1.5 h-1.5 rounded-full flex-shrink-0',
                    !active          ? 'bg-muted-foreground/20' :
                    st === 'scanning' ? 'bg-[hsl(185,100%,55%)] animate-pulse' :
                    st === 'done'     ? 'bg-[hsl(145,100%,55%)]' :
                    st === 'error'    ? 'bg-[hsl(0,85%,65%)]' :
                    'bg-muted-foreground/40'
                  )} />
                  <Icon size={11} className="text-muted-foreground flex-shrink-0" />
                  <span className={cn(
                    'truncate',
                    st === 'scanning' ? 'text-[hsl(185,100%,55%)]' :
                    st === 'done'     ? 'text-[hsl(145,100%,55%)]' :
                    st === 'error'    ? 'text-[hsl(0,85%,65%)]' :
                    'text-muted-foreground'
                  )}>{source.label}</span>
                  {st === 'done' && <CheckCircle size={10} className="text-[hsl(145,100%,55%)] ml-auto flex-shrink-0" />}
                  {st === 'error' && <AlertCircle size={10} className="text-[hsl(0,85%,65%)] ml-auto flex-shrink-0" />}
                </div>
              );
            })}
          </div>

          {/* Live console log (shown during/after scan) */}
          {scanLog.length > 0 && (
            <div
              ref={logRef}
              className="bg-[hsl(230_35%_3%)] rounded-lg p-3 font-mono text-[10px] max-h-36 overflow-y-auto space-y-0.5 border border-[hsl(var(--border))]"
            >
              {scanLog.map((line, i) => (
                <div key={i} className={cn(
                  'leading-relaxed',
                  line.startsWith('╔') || line.startsWith('║') || line.startsWith('╚') ? 'text-[hsl(185,100%,55%)]' :
                  line.startsWith('✓') ? 'text-[hsl(145,100%,55%)]' :
                  line.startsWith('✗') ? 'text-[hsl(0,85%,65%)]' :
                  line.startsWith('⟳') ? 'text-[hsl(30,100%,60%)] animate-pulse' :
                  line.startsWith('  ✓') ? 'text-[hsl(145,100%,55%)] pl-2' :
                  line.startsWith('›') ? 'text-[hsl(185,100%,55%)]' :
                  'text-muted-foreground'
                )}>{line || '\u00A0'}</div>
              ))}
              {scanIsActive && <div className="text-[hsl(185,100%,55%)] animate-pulse">_</div>}
            </div>
          )}

          {/* Post-scan summary */}
          {!scanIsActive && scanNewCount > 0 && (
            <div className="mt-3 flex items-center gap-3 p-2.5 rounded-lg bg-[hsl(145_100%_50%/0.06)] border border-[hsl(145_100%_50%/0.15)]">
              <CheckCircle size={14} className="text-[hsl(145,100%,55%)] flex-shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-[hsl(145,100%,55%)]">{scanNewCount} opportunities discovered</span>
                {autoMatchDone && autoMatchingCount > 0 && (
                  <span className="text-muted-foreground"> · {autoMatchingCount} processed through matching engine</span>
                )}
              </div>
            </div>
          )}

          {/* Category pills (from user preferences) */}
          {userCategories.length > 0 && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider mr-1">Your targets:</span>
              {userCategories.map(cat => {
                const Icon = CATEGORY_ICONS[cat] ?? Globe;
                return (
                  <span key={cat} className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-[hsl(265_80%_55%/0.08)] border border-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)]">
                    <Icon size={9} /> {cat.replace('_', ' ')}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat] ?? Globe;
          return (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-colors',
                filter === cat
                  ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]'
                  : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))] hover:text-foreground'
              )}
            >
              <Icon size={11} />
              {cat.replace('_', ' ')}
            </button>
          );
        })}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} opportunities</span>
      </div>

      {/* Opportunities list */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin mx-auto mb-3" />
            <div className="text-xs text-muted-foreground">Loading opportunities...</div>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-12 text-center">
          <Radar size={40} className="text-muted-foreground mx-auto mb-4 opacity-30" />
          <div className="text-sm font-semibold mb-2">No opportunities found</div>
          <div className="text-xs text-muted-foreground mb-4">
            Run a live scan to discover real opportunities from Remotive, Crypto Protocols, Freelance Boards, and Microtask Platforms.
          </div>
          <button
            onClick={runScan}
            disabled={scanIsActive}
            className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all"
          >
            Run First Scan
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((opp, idx) => (
            <div
              key={opp.id}
              className={cn(
                'glass-panel rounded-xl border transition-all hover:border-[hsl(185_100%_50%/0.2)]',
                opp.confidence === 'high' ? 'border-[hsl(145_100%_50%/0.15)]' : 'border-[hsl(var(--border))]',
                'slide-in-up'
              )}
              style={{ animationDelay: `${Math.min(idx * 30, 300)}ms` }}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <h3 className="font-bold text-sm">{opp.title}</h3>
                      <StatusBadge status={opp.status} />
                      <span className={cn('text-[10px] px-2 py-0.5 rounded border', CONFIDENCE_COLORS[opp.confidence])}>
                        {opp.confidence} confidence
                      </span>
                      {opp.matched_autopilot_id && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)]">
                          ⚡ Assigned
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-2 flex-wrap">
                      <span className="font-medium text-foreground">{opp.platform}</span>
                      <span>·</span>
                      <span className="capitalize">{opp.category?.replace('_', ' ')}</span>
                      <span>·</span>
                      <span className="capitalize">{opp.effort} effort</span>
                      {opp.deadline && <><span>·</span><span>Deadline: {timeAgo(opp.deadline)}</span></>}
                      <span>·</span>
                      <span className="opacity-60">Scanned {timeAgo(opp.scanned_at)}</span>
                    </div>
                    {opp.description && (
                      <p className="text-xs text-muted-foreground mb-3 leading-relaxed line-clamp-2">{opp.description}</p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(opp.requirements || []).slice(0, 5).map(r => (
                        <span key={r} className="text-[10px] px-2 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground">{r}</span>
                      ))}
                    </div>
                  </div>

                  <div className="flex-shrink-0 text-right">
                    <div className="text-xl font-black text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>
                      {opp.estimated_value > 0 ? formatCurrency(opp.estimated_value) : 'TBD'}
                    </div>
                    <div className="text-[10px] text-muted-foreground mb-3">{opp.currency}</div>

                    {/* Compliance badge */}
                    {(() => {
                      const c = checkPlatformCompliance(opp.platform);
                      return (
                        <div className={cn(
                          'text-[9px] px-1.5 py-0.5 rounded border text-center mb-2 font-semibold',
                          c.automation === 'allowed'     ? 'bg-[hsl(145_100%_50%/0.08)] border-[hsl(145_100%_50%/0.2)] text-[hsl(145,100%,55%)]' :
                          c.automation === 'restricted'  ? 'bg-[hsl(30_100%_55%/0.08)] border-[hsl(30_100%_55%/0.2)] text-[hsl(30,100%,60%)]' :
                          c.automation === 'prohibited'  ? 'bg-[hsl(0_85%_60%/0.08)] border-[hsl(0_85%_60%/0.2)] text-[hsl(0,85%,65%)]' :
                          'bg-[hsl(228_25%_12%)] border-[hsl(var(--border))] text-muted-foreground'
                        )}>
                          {c.automation === 'allowed' ? '✓ Auto OK' : c.automation === 'restricted' ? '⚠ Review' : c.automation === 'prohibited' ? '✗ No Auto' : '? Unknown'}
                        </div>
                      );
                    })()}

                    <div className="flex flex-col gap-1.5">
                      {['new', 'matched'].includes(opp.status) && (
                        <button
                          onClick={() => setApplyingOpp(opp)}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-violet-500 text-black font-semibold hover:opacity-90 transition-all"
                        >
                          <Rocket size={11} /> Apply
                        </button>
                      )}
                      {opp.status === 'new' && !opp.matched_autopilot_id && (
                        <button
                          onClick={() => matchOpportunity(opp.id)}
                          disabled={matchingId === opp.id}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {matchingId === opp.id ? <RefreshCw size={11} className="animate-spin" /> : <Zap size={11} />}
                          {matchingId === opp.id ? 'Matching...' : 'Match'}
                        </button>
                      )}
                      {opp.url && (
                        <a
                          href={opp.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <ExternalLink size={11} /> View
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Application Workflow Modal */}
      {applyingOpp && (
        <ApplicationWorkflow
          opportunity={applyingOpp}
          isOpen={!!applyingOpp}
          onClose={() => setApplyingOpp(null)}
          onSuccess={(_taskId?: string) => { setApplyingOpp(null); loadOpportunities(); }}
        />
      )}
    </div>
  );
}
