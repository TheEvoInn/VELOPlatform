import React from 'react';
import { Zap, TrendingUp, Bot, Radar, RefreshCw, ArrowUpRight, Clock, Target, Cpu, AlertTriangle } from 'lucide-react';
import IdentityCompletenessWidget from '@/components/features/IdentityCompletenessWidget';
import GettingStartedGuide from '@/components/features/GettingStartedGuide';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import { usePlatformStats, useEngines } from '@/hooks/useSharedData';
import { fetchOpportunityFeed } from '@/lib/api';
import { formatCurrency, timeAgo } from '@/lib/mockData';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);
  const { totalEarned, activeEngines, autopilotCount, runningTasks, isLoading, engines, autopilots, tasks } = usePlatformStats();

  const quickScan = async () => {
    setScanning(true);
    toast.info('Initiating quick scan...');
    const { data, error } = await fetchOpportunityFeed(['freelance', 'crypto', 'gig'], 10);
    if (error) toast.error('Scan failed');
    else toast.success(`Found ${data?.count || 0} new opportunities!`);
    setScanning(false);
  };

  type EngineRow = { id: string; name: string; status: string; total_earned?: number; totalEarned?: number; runs_completed?: number; runsCompleted?: number };
  type APRow = { id: string; avatar?: string; name: string; status: string; total_earned?: number; totalEarned?: number; tasks_completed?: number; tasksCompleted?: number; current_workload?: number; currentWorkload?: number; workload_limit?: number; workloadLimit?: number };
  type TaskRow = { id: string; name: string; status: string; type: string; created_at?: string; createdAt?: string };

  return (
    <div className="space-y-6 slide-in-up">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Earned" value={isLoading ? '...' : formatCurrency(totalEarned || 0)} sub="all-time profits" icon={<TrendingUp size={16} />} accent="green" />
        <StatCard label="Active Engines" value={isLoading ? '...' : `${activeEngines}`} sub="running now" icon={<Zap size={16} />} accent="cyan" />
        <StatCard label="Autopilots" value={isLoading ? '...' : `${autopilotCount}`} sub="fleet size" icon={<Bot size={16} />} accent="violet" />
        <StatCard label="Active Tasks" value={isLoading ? '...' : `${runningTasks}`} sub="in execution" icon={<Target size={16} />} accent="orange" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Run Scan',       icon: Radar,      action: quickScan,                           color: 'cyan',   loading: scanning },
          { label: 'Content AI',     icon: Cpu,        action: () => navigate('/content'),          color: 'violet' },
          { label: 'Opportunities',  icon: Target,     action: () => navigate('/opportunities'),    color: 'green' },
          { label: 'Mission Control',icon: RefreshCw,  action: () => navigate('/mission-control'),  color: 'orange' },
        ].map(item => {
          const Icon = item.icon;
          return (
            <button
              key={item.label}
              onClick={item.action}
              disabled={item.loading}
              className="glass-panel rounded-xl border border-[hsl(var(--border))] p-4 flex flex-col items-center gap-2 hover:border-[hsl(185_100%_50%/0.25)] transition-all group"
            >
              <Icon size={20} className={`text-[hsl(185,100%,55%)] group-hover:scale-110 transition-transform ${item.loading ? 'animate-spin' : ''}`} />
              <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Getting Started Guide */}
      <GettingStartedGuide />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Engines */}
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Engine Bay</h2>
            <button onClick={() => navigate('/engines')} className="text-xs text-[hsl(185,100%,55%)] hover:underline flex items-center gap-1">
              View All <ArrowUpRight size={11} />
            </button>
          </div>
          <div className="space-y-3">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-4 h-4 border border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" /> Loading...
              </div>
            ) : (engines as EngineRow[]).slice(0, 4).map(eng => (
              <div key={eng.id} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${['active', 'running'].includes(eng.status) ? 'bg-[hsl(145,100%,55%)] animate-pulse' : eng.status === 'paused' ? 'bg-[hsl(30,100%,60%)]' : 'bg-muted-foreground'}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{eng.name}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {formatCurrency(eng.total_earned || eng.totalEarned || 0)} earned · {eng.runs_completed ?? eng.runsCompleted ?? 0} runs
                  </div>
                </div>
                <StatusBadge status={eng.status} />
              </div>
            ))}
            {!isLoading && engines.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">
                No engines yet. <button onClick={() => navigate('/engines')} className="text-[hsl(185,100%,55%)] underline">Create one</button>
              </div>
            )}
          </div>
        </div>

        {/* Recent activity */}
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Recent Activity</h2>
            <button onClick={() => navigate('/mission-control')} className="text-xs text-[hsl(185,100%,55%)] hover:underline flex items-center gap-1">
              All Tasks <ArrowUpRight size={11} />
            </button>
          </div>
          <div className="space-y-2">
            {isLoading ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="w-4 h-4 border border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" /> Loading...
              </div>
            ) : (tasks as TaskRow[]).slice(0, 5).map(task => (
              <div key={task.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[hsl(228_25%_10%)] transition-colors">
                <div className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] ${task.status === 'completed' ? 'bg-[hsl(145_100%_50%/0.15)] text-[hsl(145,100%,55%)]' : task.status === 'running' ? 'bg-[hsl(30_100%_55%/0.15)] text-[hsl(30,100%,60%)]' : 'bg-[hsl(228_25%_12%)] text-muted-foreground'}`}>
                  {task.status === 'completed' ? '✓' : task.status === 'running' ? '▶' : '○'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{task.name}</div>
                  <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock size={9} /> {timeAgo(task.created_at || task.createdAt || new Date().toISOString())}
                  </div>
                </div>
                <StatusBadge status={task.status} />
              </div>
            ))}
            {!isLoading && tasks.length === 0 && (
              <div className="text-xs text-muted-foreground text-center py-4">No tasks yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Identity Completeness Widget */}
      <IdentityCompletenessWidget compact />

      {/* Autopilot Fleet */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Autopilot Fleet</h2>
          <button onClick={() => navigate('/autopilots')} className="text-xs text-[hsl(185,100%,55%)] hover:underline flex items-center gap-1">
            Manage <ArrowUpRight size={11} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(autopilots as APRow[]).slice(0, 3).map(ap => (
            <div key={ap.id} className="p-4 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] hover:border-[hsl(185_100%_50%/0.2)] transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{ap.avatar || '🤖'}</span>
                <div>
                  <div className="text-sm font-bold">{ap.name}</div>
                  <StatusBadge status={ap.status} />
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground space-y-0.5">
                <div>Earned: <span className="text-[hsl(145,100%,55%)]">{formatCurrency(ap.total_earned || ap.totalEarned || 0)}</span></div>
                <div>Tasks: <span className="font-semibold text-foreground">{ap.tasks_completed ?? ap.tasksCompleted ?? 0}</span></div>
                <div>Workload: <span className="font-semibold">{ap.current_workload ?? ap.currentWorkload ?? 0}/{ap.workload_limit ?? ap.workloadLimit ?? 10}</span></div>
              </div>
            </div>
          ))}
          {!isLoading && autopilots.length === 0 && (
            <div className="col-span-3 text-center py-6 text-sm text-muted-foreground">
              No autopilots yet. <button onClick={() => navigate('/autopilots')} className="text-[hsl(185,100%,55%)] underline">Create one</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
