import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity, Download, Filter, RefreshCw, Search, Shield, Wallet,
  Bot, Radar, Terminal, Lock, AlertTriangle, CheckCircle, Globe,
  Calendar, ChevronDown, X
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Module = 'all' | 'identity' | 'tasks' | 'wallet' | 'notifications' | 'eligibility' | 'autopilots';
type Severity = 'all' | 'info' | 'warning' | 'error' | 'success';

interface AuditEntry {
  id: string;
  timestamp: string;
  module: Module | string;
  action: string;
  description: string;
  severity: Severity | string;
  actor?: string;
  platform?: string;
  amount?: number;
  currency?: string;
  raw?: Record<string, unknown>;
}

const MODULE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  identity:     { icon: Shield,        color: 'text-[hsl(265,80%,70%)]',  label: 'Identity' },
  tasks:        { icon: Terminal,      color: 'text-[hsl(185,100%,55%)]', label: 'Tasks' },
  wallet:       { icon: Wallet,        color: 'text-[hsl(145,100%,55%)]', label: 'Wallet' },
  notifications:{ icon: Activity,      color: 'text-[hsl(30,100%,60%)]',  label: 'Notifications' },
  eligibility:  { icon: CheckCircle,   color: 'text-[hsl(185,100%,55%)]', label: 'Eligibility' },
  autopilots:   { icon: Bot,           color: 'text-[hsl(265,80%,70%)]',  label: 'Autopilots' },
  opportunities:{ icon: Radar,         color: 'text-[hsl(30,100%,60%)]',  label: 'Opportunities' },
  credentials:  { icon: Lock,          color: 'text-[hsl(0,85%,65%)]',    label: 'Vault' },
};

const SEVERITY_STYLE: Record<string, string> = {
  info:    'text-[hsl(185,100%,55%)] bg-[hsl(185_100%_50%/0.1)] border-[hsl(185_100%_50%/0.2)]',
  success: 'text-[hsl(145,100%,55%)] bg-[hsl(145_100%_50%/0.1)] border-[hsl(145_100%_50%/0.2)]',
  warning: 'text-[hsl(30,100%,60%)]  bg-[hsl(30_100%_55%/0.1)]  border-[hsl(30_100%_55%/0.2)]',
  error:   'text-[hsl(0,85%,65%)]    bg-[hsl(0_85%_60%/0.1)]    border-[hsl(0_85%_60%/0.2)]',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function formatTS(iso: string): string {
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState<Module>('all');
  const [severityFilter, setSeverityFilter] = useState<Severity>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAllLogs = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Fetch from all modules in parallel
    const [
      identityLogs,
      taskLogs,
      walletLogs,
      notifLogs,
      eligibilityLogs,
    ] = await Promise.all([
      supabase.from('identity_consent_log').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('tasks').select('id, name, type, status, created_at, completed_at, autopilot_id').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('autopilot_eligibility').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(30),
    ]);

    const all: AuditEntry[] = [];

    // Map identity consent log
    for (const row of identityLogs.data || []) {
      const r = row as Record<string, unknown>;
      all.push({
        id: `identity_${r.id}`,
        timestamp: r.created_at as string,
        module: 'identity',
        action: (r.action as string) || 'identity_event',
        description: (r.purpose as string) || String(r.action),
        severity: (r.action as string)?.includes('revoked') ? 'warning' : (r.action as string)?.includes('given') ? 'success' : 'info',
        platform: r.platform as string | undefined,
        raw: r,
      });
    }

    // Map tasks
    for (const row of taskLogs.data || []) {
      const r = row as Record<string, unknown>;
      all.push({
        id: `task_${r.id}`,
        timestamp: (r.created_at as string),
        module: 'tasks',
        action: `task_${r.status}`,
        description: `Task "${r.name}" — ${(r.type as string)?.replace('_', ' ')} (${r.status})`,
        severity: r.status === 'completed' ? 'success' : r.status === 'failed' ? 'error' : 'info',
        actor: `Autopilot`,
        raw: r,
      });
    }

    // Map wallet transactions
    for (const row of walletLogs.data || []) {
      const r = row as Record<string, unknown>;
      all.push({
        id: `wallet_${r.id}`,
        timestamp: r.created_at as string,
        module: 'wallet',
        action: `wallet_${r.type}`,
        description: `${String(r.type).toUpperCase()}: ${r.description || String(r.type)} — $${r.amount} ${r.currency}`,
        severity: r.type === 'withdrawal' ? 'warning' : r.status === 'failed' ? 'error' : 'success',
        amount: r.amount as number,
        currency: r.currency as string,
        raw: r,
      });
    }

    // Map notifications
    for (const row of notifLogs.data || []) {
      const r = row as Record<string, unknown>;
      all.push({
        id: `notif_${r.id}`,
        timestamp: r.created_at as string,
        module: 'notifications',
        action: r.type as string,
        description: `${r.title}: ${r.message || ''}`,
        severity: r.priority === 'critical' ? 'error' : r.priority === 'high' ? 'warning' : 'info',
        raw: r,
      });
    }

    // Map eligibility checks
    for (const row of eligibilityLogs.data || []) {
      const r = row as Record<string, unknown>;
      all.push({
        id: `elig_${r.id}`,
        timestamp: r.created_at as string,
        module: 'eligibility',
        action: 'eligibility_check',
        description: `Eligibility check — ${r.is_eligible ? 'PASSED' : 'FAILED'} (${(r.missing_requirements as string[])?.length || 0} missing)`,
        severity: r.is_eligible ? 'success' : 'warning',
        raw: r,
      });
    }

    // Sort by timestamp desc
    all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setEntries(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchAllLogs, 15000);
      return () => clearInterval(interval);
    }
  }, [fetchAllLogs, autoRefresh]);

  const filtered = entries.filter(e => {
    if (moduleFilter !== 'all' && e.module !== moduleFilter) return false;
    if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
    if (searchQuery && !e.description.toLowerCase().includes(searchQuery.toLowerCase()) && !e.action.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (dateFrom && new Date(e.timestamp) < new Date(dateFrom)) return false;
    if (dateTo && new Date(e.timestamp) > new Date(dateTo + 'T23:59:59')) return false;
    return true;
  });

  const exportCSV = () => {
    setExporting(true);
    const headers = ['Timestamp', 'Module', 'Action', 'Description', 'Severity', 'Platform', 'Amount', 'Currency'];
    const rows = filtered.map(e => [
      formatTS(e.timestamp),
      e.module,
      e.action,
      `"${e.description.replace(/"/g, '""')}"`,
      e.severity,
      e.platform || '',
      e.amount?.toString() || '',
      e.currency || '',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `velo-audit-log-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} entries as CSV`);
    setExporting(false);
  };

  const exportJSON = () => {
    const json = JSON.stringify(filtered.map(e => ({ ...e, raw: undefined })), null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `velo-audit-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} entries as JSON`);
  };

  const modules: Module[] = ['all', 'identity', 'tasks', 'wallet', 'notifications', 'eligibility'];

  const moduleCounts = entries.reduce((acc, e) => {
    acc[e.module] = (acc[e.module] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-5 slide-in-up">
      {/* Header */}
      <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.15)] p-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="text-lg font-black text-neon-cyan mb-0.5" style={{ fontFamily: 'Orbitron' }}>AUDIT LOG</div>
            <div className="text-xs text-muted-foreground">System-wide event log · {entries.length} total entries · All identity access logged</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Auto-refresh toggle */}
            <button
              onClick={() => setAutoRefresh(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
                autoRefresh ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)] text-[hsl(145,100%,55%)]' : 'border-[hsl(var(--border))] text-muted-foreground'
              )}
            >
              <div className={cn('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-[hsl(145,100%,55%)] animate-pulse' : 'bg-muted-foreground')} />
              {autoRefresh ? 'Live' : 'Paused'}
            </button>
            <button onClick={fetchAllLogs} className="p-2 rounded-lg border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setShowFilters(v => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors',
                showFilters ? 'border-[hsl(185_100%_50%/0.4)] bg-[hsl(185_100%_50%/0.1)] text-[hsl(185,100%,55%)]' : 'border-[hsl(var(--border))] text-muted-foreground hover:text-foreground'
              )}
            >
              <Filter size={12} /> Filters {showFilters ? <X size={10} /> : <ChevronDown size={10} />}
            </button>
            <div className="flex gap-1">
              <button
                onClick={exportCSV}
                disabled={exporting || filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-50 transition-all"
              >
                <Download size={12} /> CSV
              </button>
              <button
                onClick={exportJSON}
                disabled={filtered.length === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[hsl(185_100%_50%/0.3)] bg-[hsl(185_100%_50%/0.08)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.15)] disabled:opacity-50 transition-colors"
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* Module stats */}
        <div className="flex flex-wrap gap-2 mt-4">
          {Object.entries(moduleCounts).map(([mod, count]) => {
            const cfg = MODULE_CONFIG[mod];
            if (!cfg) return null;
            const Icon = cfg.icon;
            return (
              <div key={mod} className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-[11px]">
                <Icon size={10} className={cfg.color} />
                <span className="text-muted-foreground capitalize">{cfg.label}</span>
                <span className="font-bold text-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 slide-in-up">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Search</label>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Module filter */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Module</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors capitalize"
                value={moduleFilter}
                onChange={e => setModuleFilter(e.target.value as Module)}
              >
                {modules.map(m => <option key={m} value={m} className="capitalize">{m === 'all' ? 'All Modules' : m}</option>)}
              </select>
            </div>

            {/* Severity filter */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Severity</label>
              <select
                className="w-full px-3 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors capitalize"
                value={severityFilter}
                onChange={e => setSeverityFilter(e.target.value as Severity)}
              >
                {(['all', 'info', 'success', 'warning', 'error'] as Severity[]).map(s => <option key={s} value={s} className="capitalize">{s === 'all' ? 'All Severities' : s}</option>)}
              </select>
            </div>

            {/* Date range */}
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Date Range</label>
              <div className="flex gap-2">
                <input type="date" className="flex-1 px-2 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                <input type="date" className="flex-1 px-2 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" value={dateTo} onChange={e => setDateTo(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-muted-foreground">{filtered.length} of {entries.length} entries match filters</span>
            <button
              onClick={() => { setSearchQuery(''); setModuleFilter('all'); setSeverityFilter('all'); setDateFrom(''); setDateTo(''); }}
              className="text-xs text-[hsl(185,100%,55%)] hover:underline"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      )}

      {/* Log table */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] overflow-hidden">
        <div className="px-4 py-3 border-b border-[hsl(var(--border))] flex items-center justify-between bg-[hsl(228_35%_5%/0.5)]">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>
            Event Log — {filtered.length} entries
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <div className={cn('w-1.5 h-1.5 rounded-full', autoRefresh ? 'bg-[hsl(145,100%,55%)] animate-pulse' : 'bg-muted-foreground')} />
            {autoRefresh ? 'Auto-refreshing every 15s' : 'Paused'}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <RefreshCw size={16} className="animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Loading audit data from all modules...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Activity size={32} className="mb-3 opacity-20" />
            <div className="text-sm">No log entries found</div>
            <div className="text-xs mt-1 opacity-60">
              {entries.length > 0 ? 'Try adjusting your filters' : 'Activity will appear here as you use VELO 2.0'}
            </div>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border))]">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[100px_80px_120px_1fr_80px] gap-3 px-4 py-2 bg-[hsl(228_25%_8%)] text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              <span>Time</span>
              <span>Module</span>
              <span>Action</span>
              <span>Description</span>
              <span>Severity</span>
            </div>
            {filtered.map(entry => {
              const cfg = MODULE_CONFIG[entry.module] || { icon: Activity, color: 'text-muted-foreground', label: entry.module };
              const Icon = cfg.icon;
              return (
                <div
                  key={entry.id}
                  className="flex flex-col md:grid md:grid-cols-[100px_80px_120px_1fr_80px] gap-2 md:gap-3 px-4 py-3 hover:bg-[hsl(228_25%_9%/0.6)] transition-colors text-xs"
                >
                  {/* Timestamp */}
                  <div className="flex items-center gap-1 text-muted-foreground font-mono text-[10px] flex-shrink-0">
                    <span title={formatTS(entry.timestamp)}>{timeAgo(entry.timestamp)}</span>
                  </div>

                  {/* Module */}
                  <div className="flex items-center gap-1.5">
                    <Icon size={11} className={cfg.color} />
                    <span className="capitalize text-[10px] font-semibold">{cfg.label}</span>
                  </div>

                  {/* Action */}
                  <div className="font-mono text-[10px] text-muted-foreground truncate">
                    {entry.action.replace(/_/g, ' ')}
                  </div>

                  {/* Description */}
                  <div className="text-xs text-foreground line-clamp-2 min-w-0">
                    {entry.description}
                    {entry.platform && <span className="ml-1.5 text-[10px] text-muted-foreground">· {entry.platform}</span>}
                  </div>

                  {/* Severity */}
                  <div>
                    <span className={cn(
                      'text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider',
                      SEVERITY_STYLE[entry.severity] || SEVERITY_STYLE.info
                    )}>
                      {entry.severity}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Export note */}
      <div className="text-[11px] text-muted-foreground flex items-center gap-2 px-1">
        <Shield size={11} className="text-[hsl(265,80%,70%)]" />
        All identity-related actions are immutably logged. Exported logs can serve as compliance records.
        {filtered.length > 0 && <span className="ml-auto">{filtered.length} entries ready for export</span>}
      </div>
    </div>
  );
}
