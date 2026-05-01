import React, { useState } from 'react';
import { Terminal, Play, Pause, StopCircle, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, Bot, Radar, Clock } from 'lucide-react';
import StatusBadge from '@/components/features/StatusBadge';
import StatCard from '@/components/features/StatCard';
import { updateTask } from '@/lib/api';
import { useTasks, useUpdateTask } from '@/hooks/useSharedData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TaskLog { timestamp: string; level?: string; message: string; }
interface Task {
  id: string;
  name: string;
  type: string;
  status: string;
  priority: number;
  progress: number;
  logs: TaskLog[] | unknown;
  retries: number;
  created_at?: string;
  autopilot_id?: string;
  opportunity_id?: string;
}

function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const TASK_TYPE_ICONS: Record<string, string> = {
  application:  '📋',
  automation:   '🤖',
  research:     '🔍',
  crypto:       '₿',
  dropshipping: '📦',
  content:      '✍️',
};

export default function MissionControlPage() {
  const { data: rawTasks = [], isLoading: loading, refetch } = useTasks();
  const tasks = rawTasks as Task[];
  const updateTaskMutation = useUpdateTask();

  const [expanded, setExpanded] = useState<string | null>(null);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'running' | 'queued' | 'completed' | 'failed'>('all');

  const running   = tasks.filter(t => t.status === 'running').length;
  const queued    = tasks.filter(t => t.status === 'queued').length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const failed    = tasks.filter(t => t.status === 'failed').length;

  const filtered = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  const pauseTask = (id: string) => {
    updateTaskMutation.mutate({ id, updates: { status: 'paused' } },
      { onSuccess: () => toast.info('Task paused') });
  };

  const resumeTask = async (id: string) => {
    updateTaskMutation.mutate({ id, updates: { status: 'running' } });
    toast.success('Task resumed');
  };

  const retryTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    updateTaskMutation.mutate({ id, updates: { status: 'queued', retries: (task.retries || 0) + 1, progress: 0 } });
    toast.info('Task re-queued');
  };

  const handleEmergencyStop = async () => {
    setEmergencyStop(true);
    const activeIds = tasks.filter(t => ['running', 'queued'].includes(t.status)).map(t => t.id);
    await Promise.all(activeIds.map(id => updateTask(id, { status: 'paused' })));
    refetch();
    toast.error('EMERGENCY STOP — All active tasks paused');
  };

  // Normalize logs for safe rendering
  const getLogs = (task: Task): TaskLog[] => {
    if (!task.logs) return [];
    if (Array.isArray(task.logs)) {
      return (task.logs as unknown[]).map((l, i) => {
        if (typeof l === 'string') return { timestamp: new Date().toISOString(), message: l };
        if (typeof l === 'object' && l !== null) {
          const obj = l as Record<string, unknown>;
          return {
            timestamp: (obj.timestamp as string) || new Date().toISOString(),
            level: (obj.level as string) || 'info',
            message: (obj.message as string) || JSON.stringify(l),
          };
        }
        return { timestamp: new Date().toISOString(), message: String(l) };
      });
    }
    return [];
  };

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Running"   value={`${running}`}   sub="tasks executing" accent="orange" />
        <StatCard label="Queued"    value={`${queued}`}    sub="waiting"         accent="violet" />
        <StatCard label="Completed" value={`${completed}`} sub="done"            accent="green" />
        <StatCard label="Failed"    value={`${failed}`}    sub="need attention"  accent="red" />
      </div>

      {/* Emergency stop / status */}
      <div className={cn('rounded-xl border p-4 flex items-center justify-between flex-wrap gap-3', emergencyStop ? 'bg-[hsl(0_85%_60%/0.1)] border-[hsl(0_85%_60%/0.4)]' : 'glass-panel border-[hsl(var(--border))]')}>
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} className={emergencyStop ? 'text-[hsl(0,85%,65%)]' : 'text-muted-foreground'} />
          <div>
            <div className={cn('text-sm font-bold', emergencyStop ? 'text-[hsl(0,85%,65%)]' : 'text-foreground')} style={{ fontFamily: 'Orbitron' }}>
              {emergencyStop ? 'EMERGENCY STOP ACTIVE' : 'MISSION CONTROL — NOMINAL'}
            </div>
            <div className="text-xs text-muted-foreground">
              {emergencyStop ? 'All tasks paused — manual review required' : `${running} running · ${queued} queued · Auto-refreshing every 15s`}
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={12} /> Refresh
          </button>
          {emergencyStop ? (
            <button onClick={() => setEmergencyStop(false)} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(145_100%_50%/0.15)] border border-[hsl(145_100%_50%/0.3)] text-[hsl(145,100%,55%)]">
              Resume Systems
            </button>
          ) : (
            <button onClick={handleEmergencyStop} className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-[hsl(0_85%_60%/0.1)] border border-[hsl(0_85%_60%/0.3)] text-[hsl(0,85%,65%)] hover:bg-[hsl(0_85%_60%/0.2)] flex items-center gap-2">
              <StopCircle size={13} /> Emergency Stop
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Filter:</span>
        {(['all', 'running', 'queued', 'completed', 'failed'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-xs font-semibold border capitalize transition-colors',
              filterStatus === s
                ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]'
                : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))] hover:text-foreground'
            )}
          >
            {s === 'all' ? `All (${tasks.length})` : `${s} (${tasks.filter(t => t.status === s).length})`}
          </button>
        ))}
      </div>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-6 h-6 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(task => {
              const logs = getLogs(task);
              const isExpanded = expanded === task.id;
              const typeIcon = TASK_TYPE_ICONS[task.type] || '⚙️';
              return (
                <div key={task.id} className="glass-panel rounded-xl border border-[hsl(var(--border))] overflow-hidden">
                  <div
                    className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[hsl(228_25%_10%/0.5)] transition-colors"
                    onClick={() => setExpanded(e => e === task.id ? null : task.id)}
                  >
                    {/* Priority + type */}
                    <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] flex flex-col items-center justify-center gap-0">
                      <span className="text-base leading-none">{typeIcon}</span>
                      <span className="text-[9px] text-muted-foreground">P{task.priority || 3}</span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm font-semibold">{task.name}</span>
                        <StatusBadge status={task.status} />
                        <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(228_25%_12%)] text-muted-foreground border border-[hsl(var(--border))] capitalize">{task.type}</span>
                        {task.retries > 0 && (
                          <span className="text-[10px] text-[hsl(30,100%,60%)]">retry #{task.retries}</span>
                        )}
                      </div>

                      {/* Context chips */}
                      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground mb-1">
                        {task.autopilot_id && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(265_80%_55%/0.08)] border border-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)]">
                            <Bot size={8} /> Has Autopilot
                          </span>
                        )}
                        {task.opportunity_id && (
                          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[hsl(185_100%_50%/0.08)] border border-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)]">
                            <Radar size={8} /> Linked Opportunity
                          </span>
                        )}
                        {task.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock size={8} /> {timeAgo(task.created_at)}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      {(task.status === 'running' || task.progress > 0) && (
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700"
                              style={{ width: `${task.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{task.progress || 0}%</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {task.status === 'running' && (
                        <button onClick={e => { e.stopPropagation(); pauseTask(task.id); }}
                          className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_15%)] transition-colors" title="Pause">
                          <Pause size={13} className="text-muted-foreground" />
                        </button>
                      )}
                      {['paused', 'queued'].includes(task.status) && (
                        <button onClick={e => { e.stopPropagation(); resumeTask(task.id); }}
                          className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_15%)] transition-colors" title="Resume">
                          <Play size={13} className="text-[hsl(145,100%,55%)]" />
                        </button>
                      )}
                      {task.status === 'failed' && (
                        <button onClick={e => { e.stopPropagation(); retryTask(task.id); }}
                          className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_15%)] transition-colors" title="Retry">
                          <RefreshCw size={13} className="text-[hsl(30,100%,60%)]" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Expanded: logs */}
                  {isExpanded && (
                    <div className="border-t border-[hsl(var(--border))] bg-[hsl(228_35%_5%)]">
                      {logs.length > 0 ? (
                        <div className="p-4 font-mono text-[11px] space-y-1.5 max-h-52 overflow-y-auto">
                          {logs.map((log, i) => (
                            <div key={i} className={cn('flex gap-2', {
                              'text-[hsl(145,100%,55%)]': log.level === 'success',
                              'text-[hsl(0,85%,65%)]':    log.level === 'error',
                              'text-[hsl(30,100%,60%)]':  log.level === 'warn' || log.level === 'warning',
                              'text-muted-foreground':    !log.level || ['info', 'debug'].includes(log.level),
                            })}>
                              <span className="opacity-50 flex-shrink-0">
                                [{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}]
                              </span>
                              <span className="break-all">{log.message}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="p-4 text-xs text-muted-foreground text-center opacity-60">
                          No execution logs yet
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-10 text-center">
                <Terminal size={32} className="mx-auto mb-3 text-muted-foreground opacity-30" />
                <div className="text-sm text-muted-foreground">
                  {filterStatus === 'all'
                    ? 'No tasks yet — run a scan and apply to opportunities to generate tasks'
                    : `No ${filterStatus} tasks`}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
