import React, { useState } from 'react';
import { Zap, Plus, Play, Pause, RefreshCw, Clock } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import { useEngines, useCreateEngine, useUpdateEngine } from '@/hooks/useSharedData';
import { formatCurrency, timeAgo } from '@/lib/mockData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Engine {
  id: string;
  name: string;
  goal?: string;
  status: string;
  category?: string;
  total_earned?: number;
  totalEarned?: number;
  runs_completed?: number;
  runsCompleted?: number;
  last_run?: string;
  lastRun?: string;
  channels?: string[];
  created_at?: string;
}

const CATEGORIES = ['freelance', 'crypto', 'gig', 'dropshipping', 'remote_job', 'bounty'];
const STATUS_CYCLE: Record<string, string> = { active: 'paused', paused: 'active', idle: 'active', running: 'paused', error: 'idle' };

export default function EnginesPage() {
  const { data: rawEngines = [], isLoading: loading } = useEngines();
  const engines = rawEngines as Engine[];
  const updateEngineMutation = useUpdateEngine();
  const createEngineMutation = useCreateEngine();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [category, setCategory] = useState('freelance');
  const [channels, setChannels] = useState('');

  const active = engines.filter(e => ['active', 'running'].includes(e.status)).length;
  const totalEarned = engines.reduce((s, e) => s + (e.total_earned || e.totalEarned || 0), 0);

  const toggleStatus = async (eng: Engine) => {
    const next = STATUS_CYCLE[eng.status] || 'idle';
    updateEngineMutation.mutate(
      { id: eng.id, updates: { status: next } },
      { onSuccess: () => toast.success(`Engine ${next}`) }
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Engine name required'); return; }
    createEngineMutation.mutate(
      {
        name, goal,
        category,
        channels: channels.split(',').map(c => c.trim()).filter(Boolean),
        status: 'idle',
        total_earned: 0,
        runs_completed: 0,
      },
      {
        onSuccess: () => {
          toast.success(`Engine "${name}" created!`);
          setShowCreate(false);
          setName(''); setGoal(''); setChannels('');
        },
        onError: () => toast.error('Failed to create engine'),
      }
    );
  };

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Engines"  value={`${engines.length}`} sub="configured"          icon={<Zap size={16} />} accent="cyan" />
        <StatCard label="Active"         value={`${active}`}         sub="running now"          accent="green" />
        <StatCard label="Total Earned"   value={formatCurrency(totalEarned)} sub="all engines"  accent="violet" />
        <StatCard label="Total Runs"     value={`${engines.reduce((s, e) => s + (e.runs_completed || e.runsCompleted || 0), 0)}`} sub="completed executions" accent="orange" />
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Profit Engines</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-opacity">
          <Plus size={13} /> New Engine
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
        </div>
      ) : engines.length === 0 ? (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-12 text-center">
          <Zap size={36} className="mx-auto mb-3 text-muted-foreground opacity-30" />
          <div className="text-sm font-semibold mb-2">No engines yet</div>
          <div className="text-xs text-muted-foreground mb-4">Create your first Profit Engine to start discovering opportunities</div>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 transition-all">
            Create First Engine
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {engines.map(eng => (
            <div key={eng.id} className={cn(
              'glass-panel rounded-xl border p-5 transition-all',
              ['active', 'running'].includes(eng.status) ? 'border-[hsl(145_100%_50%/0.2)]' : 'border-[hsl(var(--border))]'
            )}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className={cn('w-3 h-3 rounded-full mt-1.5 flex-shrink-0', {
                    'bg-[hsl(145,100%,55%)] animate-pulse': ['active', 'running'].includes(eng.status),
                    'bg-[hsl(30,100%,60%)]': eng.status === 'paused',
                    'bg-muted-foreground': !['active', 'running', 'paused'].includes(eng.status),
                  })} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-bold text-base">{eng.name}</h3>
                      <StatusBadge status={eng.status} />
                      {eng.category && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground capitalize">{eng.category}</span>
                      )}
                    </div>
                    {eng.goal && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{eng.goal}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                      <span className="text-[hsl(145,100%,55%)] font-semibold">{formatCurrency(eng.total_earned || eng.totalEarned || 0)} earned</span>
                      <span>{eng.runs_completed ?? eng.runsCompleted ?? 0} runs</span>
                      {(eng.last_run || eng.lastRun) && (
                        <span className="flex items-center gap-1"><Clock size={10} /> {timeAgo(eng.last_run || eng.lastRun || '')}</span>
                      )}
                    </div>
                    {eng.channels && eng.channels.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {eng.channels.map(ch => (
                          <span key={ch} className="text-[10px] px-2 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground">{ch}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => toggleStatus(eng)}
                  disabled={updateEngineMutation.isPending}
                  className="p-2 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(185_100%_50%/0.3)] transition-colors flex-shrink-0"
                >
                  {['active', 'running'].includes(eng.status)
                    ? <Pause size={14} className="text-muted-foreground" />
                    : <Play size={14} className="text-[hsl(145,100%,55%)]" />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.2)] p-6 w-full max-w-md mx-4 slide-in-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-5 text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>NEW PROFIT ENGINE</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Engine Name</label>
                <input autoFocus className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="e.g. Freelance Blitz" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Goal</label>
                <textarea className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors resize-none h-20" placeholder="e.g. Win 5 writing gigs per week..." value={goal} onChange={e => setGoal(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => (
                    <button key={cat} onClick={() => setCategory(cat)} className={cn('px-3 py-1.5 rounded-lg text-xs border capitalize transition-colors', category === cat ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]' : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))] hover:text-foreground')}>{cat}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Channels (comma-separated)</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="upwork, fiverr, twitter..." value={channels} onChange={e => setChannels(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={createEngineMutation.isPending || !name} className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {createEngineMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                {createEngineMutation.isPending ? 'Creating...' : 'Create Engine'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
