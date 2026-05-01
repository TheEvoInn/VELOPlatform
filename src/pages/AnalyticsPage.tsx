import React, { useMemo, useState } from 'react';
import { TrendingUp, BarChart3, DollarSign, Target, RefreshCw } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { usePlatformStats, useTransactions, useOpportunities } from '@/hooks/useSharedData';
import { formatCurrency } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const CHART_COLORS = ['hsl(185,100%,50%)', 'hsl(265,80%,60%)', 'hsl(30,100%,55%)', 'hsl(50,100%,50%)', 'hsl(145,100%,50%)'];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="glass-panel-bright rounded-lg border border-[hsl(185_100%_50%/0.2)] px-3 py-2 text-xs">
        <div className="text-muted-foreground mb-1">{label}</div>
        {payload.map((p, i) => (
          <div key={i} className="font-semibold" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' ? formatCurrency(p.value) : p.value}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'all'>('month');
  const { data: rawTxns = [], isLoading: txLoading } = useTransactions();
  const { autopilots, tasks, isLoading: statsLoading } = usePlatformStats();
  const { data: opps = [] } = useOpportunities();

  const transactions = rawTxns as { type: string; amount: number; status: string; currency: string; description?: string; created_at: string }[];

  // ── Derived metrics ─────────────────────────────────────────────────────────
  const confirmed = transactions.filter(t => t.status === 'confirmed' && ['earning', 'bonus'].includes(t.type));
  const totalEarned = confirmed.reduce((s, t) => s + t.amount, 0);
  const completedTasks = (tasks as { status: string }[]).filter(t => t.status === 'completed').length;
  const avgPerTask = completedTasks > 0 ? totalEarned / completedTasks : 0;
  const totalTasks = (tasks as { status: string }[]).length;
  const successRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ── Time-range filtered data ─────────────────────────────────────────────
  const now = Date.now();
  const cutoff = timeRange === 'week' ? now - 7 * 86400000
    : timeRange === 'month' ? now - 30 * 86400000
    : 0;

  const filteredTxns = confirmed.filter(t => new Date(t.created_at).getTime() >= cutoff);

  // ── Daily earnings chart ─────────────────────────────────────────────────
  const earningsData = useMemo(() => {
    const groups: Record<string, number> = {};
    filteredTxns.forEach(t => {
      const d = new Date(t.created_at);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      groups[key] = (groups[key] || 0) + t.amount;
    });
    return Object.entries(groups)
      .sort((a, b) => new Date('2026/' + a[0]).getTime() - new Date('2026/' + b[0]).getTime())
      .map(([date, earnings]) => ({ date, earnings: Math.round(earnings * 100) / 100 }))
      .slice(-20);
  }, [filteredTxns]);

  // ── Category breakdown from opportunities ───────────────────────────────
  const categoryData = useMemo(() => {
    const cats: Record<string, number> = {};
    filteredTxns.forEach(t => {
      const cat = t.description?.toLowerCase().includes('crypto') ? 'Crypto'
        : t.description?.toLowerCase().includes('dropship') || t.description?.toLowerCase().includes('shopify') ? 'Dropshipping'
        : t.description?.toLowerCase().includes('click') || t.description?.toLowerCase().includes('gig') ? 'Gig Tasks'
        : 'Freelance';
      cats[cat] = (cats[cat] || 0) + t.amount;
    });
    return Object.entries(cats).map(([name, value], i) => ({ name, value: Math.round(value * 100) / 100, fill: CHART_COLORS[i % CHART_COLORS.length] }));
  }, [filteredTxns]);

  // ── Autopilot performance ─────────────────────────────────────────────
  const autopilotPerf = useMemo(() => {
    return (autopilots as { name: string; total_earned?: number; tasks_completed?: number }[])
      .map(ap => ({
        name: ap.name,
        earned: ap.total_earned || 0,
        tasks: ap.tasks_completed || 0,
      }))
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 5);
  }, [autopilots]);

  const isLoading = txLoading || statsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-6 h-6 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 slide-in-up">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue"     value={formatCurrency(totalEarned)} sub="confirmed earnings"  icon={<DollarSign size={16} />} accent="cyan" />
        <StatCard label="Avg / Task"        value={formatCurrency(avgPerTask)}  sub="earnings per task"   accent="green" />
        <StatCard label="Tasks Completed"   value={`${completedTasks}`}         sub="fully automated"     accent="violet" />
        <StatCard label="Success Rate"      value={`${successRate}%`}           sub="tasks completed OK"  accent="orange" />
      </div>

      {/* Empty state for new users */}
      {totalEarned === 0 && confirmedCount(confirmed) === 0 && (
        <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.15)] p-6 text-center">
          <TrendingUp size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <div className="text-sm font-bold mb-1">No earnings data yet</div>
          <div className="text-xs text-muted-foreground">
            Complete your first task or opportunity to start seeing analytics. All charts will populate with real data from your wallet transactions.
          </div>
        </div>
      )}

      {/* Time range selector */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground">Time Range:</span>
        {(['week', 'month', 'all'] as const).map(r => (
          <button key={r} onClick={() => setTimeRange(r)} className={cn(
            'px-3 py-1 rounded text-xs font-semibold uppercase tracking-wider transition-colors border',
            timeRange === r
              ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]'
              : 'text-muted-foreground hover:text-foreground border-transparent'
          )}>{r}</button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">{filteredTxns.length} transactions in range</span>
      </div>

      {/* Earnings chart */}
      {earningsData.length > 0 && (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-[hsl(185,100%,55%)]" />
            <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Daily Earnings</h2>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={earningsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="earnGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(185,100%,50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(185,100%,50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(228,25%,14%)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215,25%,55%)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(215,25%,55%)' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="earnings" name="earnings" stroke="hsl(185,100%,50%)" strokeWidth={2} fill="url(#earnGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category breakdown */}
        {categoryData.length > 0 && (
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Target size={16} className="text-[hsl(145,100%,55%)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>By Category</h2>
            </div>
            <div className="flex items-center gap-3">
              <ResponsiveContainer width="55%" height={160}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={65} paddingAngle={3} dataKey="value">
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2">
                {categoryData.map(cat => (
                  <div key={cat.name} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: cat.fill }} />
                    <span className="text-[11px] text-muted-foreground flex-1">{cat.name}</span>
                    <span className="text-[11px] font-semibold">{formatCurrency(cat.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Autopilot performance */}
        {autopilotPerf.length > 0 && (
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-[hsl(265,80%,70%)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Autopilot Performance</h2>
            </div>
            <div className="space-y-4">
              {autopilotPerf.map(ap => (
                <div key={ap.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold">{ap.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{ap.tasks} tasks</span>
                      <span className="text-sm font-bold text-[hsl(145,100%,55%)]">{formatCurrency(ap.earned)}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700"
                      style={{ width: `${Math.min((ap.earned / Math.max(...autopilotPerf.map(a => a.earned), 1)) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All empty state for analytics */}
        {categoryData.length === 0 && autopilotPerf.every(a => a.earned === 0) && (
          <div className="lg:col-span-3 glass-panel rounded-xl border border-[hsl(var(--border))] p-8 text-center">
            <TrendingUp size={28} className="mx-auto mb-3 text-muted-foreground opacity-30" />
            <div className="text-sm text-muted-foreground">Charts will appear here once you have confirmed earnings and active autopilots.</div>
          </div>
        )}
      </div>

      {/* Opportunity pipeline stats */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-4" style={{ fontFamily: 'Orbitron' }}>Opportunity Pipeline</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(['new', 'matched', 'applied', 'completed'] as const).map(status => {
            const count = (opps as { status: string }[]).filter(o => o.status === status).length;
            const colors: Record<string, string> = { new: 'hsl(185,100%,55%)', matched: 'hsl(265,80%,70%)', applied: 'hsl(30,100%,60%)', completed: 'hsl(145,100%,55%)' };
            return (
              <div key={status} className="p-3 rounded-xl border border-[hsl(var(--border))] text-center">
                <div className="text-2xl font-black" style={{ fontFamily: 'Orbitron', color: colors[status] }}>{count}</div>
                <div className="text-xs text-muted-foreground capitalize mt-1">{status}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function confirmedCount(txns: { status: string }[]) {
  return txns.filter(t => t.status === 'confirmed').length;
}
