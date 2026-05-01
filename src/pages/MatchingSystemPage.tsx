import React, { useState } from 'react';
import { Target, Zap, CheckCircle, TrendingUp, Bot, RefreshCw, ArrowRight, AlertTriangle } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import { useOpportunities, useAutopilots, useCreateTask, QUERY_KEYS } from '@/hooks/useSharedData';
import { runMatchingEngine } from '@/lib/api';
import { formatCurrency } from '@/lib/mockData';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ScoreResult {
  autopilot_id: string;
  autopilot_name: string;
  autopilot_avatar?: string;
  total_score: number;
  skill_score: number;
  category_score: number;
  effort_score: number;
  confidence: string;
  recommendation: string;
  reasons: string[];
}

function ScoreBar({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-1 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export default function MatchingSystemPage() {
  const qc = useQueryClient();
  const { data: rawOpps = [], isLoading: oppsLoading } = useOpportunities();
  const { data: rawAutopilots = [], isLoading: aLoading } = useAutopilots();
  const createTask = useCreateTask();

  const opportunities = rawOpps as { id: string; title: string; platform: string; category: string; estimated_value: number; currency: string; status: string; effort?: string }[];
  const autopilots = rawAutopilots as { id: string; name: string; avatar?: string; skills?: string[] }[];

  const [running, setRunning] = useState(false);
  const [matchResults, setMatchResults] = useState<Record<string, ScoreResult[]>>({});
  const [autoAssigned, setAutoAssigned] = useState(0);
  const [runningOppId, setRunningOppId] = useState<string | null>(null);

  const allScores = Object.values(matchResults).flat();
  const topMatches = allScores.filter(s => s.recommendation === 'top');
  const avgScore = allScores.length ? Math.round(allScores.reduce((a, s) => a + s.total_score, 0) / allScores.length) : 0;

  const runMatchingForOpp = async (oppId: string) => {
    setRunningOppId(oppId);
    const { data, error } = await runMatchingEngine(oppId, false);
    if (error) { toast.error('Matching failed: ' + error); setRunningOppId(null); return; }
    const matches = (data as { matches: ScoreResult[] })?.matches ?? [];
    setMatchResults(prev => ({ ...prev, [oppId]: matches }));
    setRunningOppId(null);
    if (matches.length > 0) {
      toast.success(`Found ${matches.length} matches for this opportunity`);
    } else {
      toast.info('No autopilot matches found — create autopilots with relevant skills first');
    }
  };

  const runAll = async () => {
    if (opportunities.length === 0) { toast.error('No opportunities to match'); return; }
    setRunning(true);
    toast.info(`Running matching engine on ${opportunities.length} opportunities...`);
    for (const opp of opportunities.slice(0, 10)) {
      await runMatchingForOpp(opp.id);
    }
    setRunning(false);
    toast.success('Matching complete');
  };

  const assignMatch = (opp: typeof opportunities[0], score: ScoreResult) => {
    createTask.mutate({
      name: `Apply: ${opp.title} on ${opp.platform}`,
      type: 'application',
      status: 'queued',
      autopilot_id: score.autopilot_id,
      opportunity_id: opp.id,
      priority: score.recommendation === 'top' ? 1 : 2,
      progress: 0,
      logs: [{ timestamp: new Date().toISOString(), level: 'info', message: `Auto-assigned by Matching Engine (score: ${score.total_score})` }],
    }, {
      onSuccess: () => {
        setAutoAssigned(n => n + 1);
        toast.success(`${score.autopilot_name} assigned to "${opp.title}"`);
        qc.invalidateQueries({ queryKey: QUERY_KEYS.opportunities });
      },
    });
  };

  const batchAssignAll = () => {
    const topPairs: { opp: typeof opportunities[0]; score: ScoreResult }[] = [];
    for (const opp of opportunities) {
      const scores = matchResults[opp.id] ?? [];
      const top = scores.find(s => s.recommendation === 'top');
      if (top) topPairs.push({ opp, score: top });
    }
    if (topPairs.length === 0) { toast.error('No top matches to assign — run matching first'); return; }
    topPairs.forEach(({ opp, score }) => assignMatch(opp, score));
  };

  const newOpps = opportunities.filter(o => o.status === 'new');

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Opportunities"  value={`${opportunities.length}`}  sub="in database"         icon={<Target size={16} />} accent="cyan" />
        <StatCard label="Top Matches"    value={`${topMatches.length}`}     sub="high-confidence pairs" accent="green" />
        <StatCard label="Avg Score"      value={allScores.length ? `${avgScore}%` : '—'} sub="match quality" accent="violet" />
        <StatCard label="Auto-Assigned"  value={`${autoAssigned}`}          sub="this session"        accent="orange" />
      </div>

      {/* Controls */}
      <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.15)] p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-base font-bold" style={{ fontFamily: 'Orbitron' }}>MATCHING ENGINE</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Scores opportunity-autopilot pairs using skill alignment, category, effort, and constraints via the real matching-engine Edge Function
            </p>
          </div>
          <div className="flex gap-3">
            <button onClick={batchAssignAll} disabled={topMatches.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold border border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.1)] text-[hsl(145,100%,55%)] hover:bg-[hsl(145_100%_50%/0.2)] disabled:opacity-40 transition-colors">
              <CheckCircle size={14} /> Assign All Top Matches
            </button>
            <button onClick={runAll} disabled={running || oppsLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all">
              <RefreshCw size={14} className={running ? 'animate-spin' : ''} />
              {running ? 'Matching...' : 'Run Matching'}
            </button>
          </div>
        </div>
      </div>

      {/* Algorithm info */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Skill Alignment',  desc: 'Autopilot skills vs opportunity requirements', color: 'hsl(185,100%,55%)' },
          { label: 'Category Match',   desc: 'Autopilot allowed categories vs opportunity type', color: 'hsl(265,80%,70%)' },
          { label: 'Effort Score',     desc: 'Workload capacity vs task effort level', color: 'hsl(145,100%,55%)' },
          { label: 'Deadline Score',   desc: 'Time urgency and autopilot availability', color: 'hsl(30,100%,60%)' },
        ].map(f => (
          <div key={f.label} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-3">
            <div className="text-xs font-bold mb-1" style={{ color: f.color }}>{f.label}</div>
            <div className="text-[11px] text-muted-foreground">{f.desc}</div>
          </div>
        ))}
      </div>

      {/* No opportunities / autopilots states */}
      {!oppsLoading && opportunities.length === 0 && (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-8 text-center">
          <Target size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <div className="text-sm font-bold mb-1">No opportunities to match</div>
          <div className="text-xs text-muted-foreground">Run an opportunity scan first to discover gigs, jobs, and crypto tasks.</div>
        </div>
      )}

      {!aLoading && opportunities.length > 0 && autopilots.length === 0 && (
        <div className="glass-panel rounded-xl border border-[hsl(30_100%_55%/0.2)] p-5 flex items-center gap-3">
          <AlertTriangle size={16} className="text-[hsl(30,100%,60%)] flex-shrink-0" />
          <div className="text-xs text-muted-foreground">
            <strong className="text-[hsl(30,100%,60%)]">No Autopilots.</strong> Create at least one Autopilot with skills and allowed categories to enable matching.
          </div>
        </div>
      )}

      {/* Opportunities with match results */}
      {opportunities.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Opportunities & Matches</h2>
          {opportunities.map(opp => {
            const scores = matchResults[opp.id] ?? [];
            const isRunning = runningOppId === opp.id;
            return (
              <div key={opp.id} className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-3">
                {/* Opportunity header */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">{opp.title}</span>
                      <StatusBadge status={opp.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {opp.platform} · <span className="capitalize">{opp.category}</span> · <span className="text-[hsl(185,100%,55%)] font-semibold">{formatCurrency(opp.estimated_value, opp.currency)}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => runMatchingForOpp(opp.id)}
                    disabled={isRunning}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[hsl(185_100%_50%/0.3)] bg-[hsl(185_100%_50%/0.08)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.15)] disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw size={11} className={isRunning ? 'animate-spin' : ''} />
                    {isRunning ? 'Matching...' : scores.length > 0 ? 'Re-match' : 'Find Matches'}
                  </button>
                </div>

                {/* Match results */}
                {scores.length > 0 && (
                  <div className="space-y-3 border-t border-[hsl(var(--border))] pt-3">
                    {scores.slice(0, 3).map(score => {
                      const recColor = score.recommendation === 'top' ? 'hsl(145,100%,55%)' : 'hsl(185,100%,55%)';
                      const recBg = score.recommendation === 'top' ? 'border-[hsl(145_100%_50%/0.2)] bg-[hsl(145_100%_50%/0.04)]' : 'border-[hsl(var(--border))]';
                      return (
                        <div key={score.autopilot_id} className={cn('rounded-xl border p-4 flex items-start gap-4 flex-wrap', recBg)}>
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xl">{score.autopilot_avatar || '🤖'}</span>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold">{score.autopilot_name}</div>
                              <div className="space-y-1 mt-2 min-w-32 w-40">
                                <ScoreBar value={score.skill_score}     label="Skills"    color="hsl(185,100%,55%)" />
                                <ScoreBar value={score.category_score}  label="Category"  color="hsl(265,80%,70%)" />
                                <ScoreBar value={score.effort_score}    label="Effort"    color="hsl(145,100%,55%)" />
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="text-center">
                              <div className="text-2xl font-black" style={{ fontFamily: 'Orbitron', color: recColor }}>{score.total_score}</div>
                              <div className="text-[10px] font-bold uppercase" style={{ color: recColor }}>{score.recommendation}</div>
                              <StatusBadge status={score.confidence} />
                            </div>
                            <button
                              onClick={() => assignMatch(opp, score)}
                              disabled={createTask.isPending}
                              className={cn(
                                'px-3 py-1.5 rounded text-xs font-semibold transition-colors',
                                score.recommendation === 'top'
                                  ? 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90'
                                  : 'bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
                              )}
                            >
                              {createTask.isPending ? '...' : score.recommendation === 'top' ? '⚡ Assign' : 'Assign'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {scores.length === 0 && !isRunning && (
                  <div className="text-xs text-muted-foreground text-center py-2 border-t border-[hsl(var(--border))]">
                    Click "Find Matches" to run the matching engine for this opportunity
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
