import React, { useState } from 'react';
import { ShieldAlert, Shield, AlertTriangle, CheckCircle, Ban, Globe, Activity, Plus, Trash2, FileText, RefreshCw } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import PlatformTermsChecker from '@/components/features/PlatformTermsChecker';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { timeAgo } from '@/lib/mockData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const DEFAULT_WHITELIST = ['upwork.com', 'fiverr.com', 'clickworker.com', 'remoteok.com', 'arbitrum.io', 'layerzero.network'];
const DEFAULT_BLACKLIST = ['*.torrent.*', 'darkweb.*', '*.illegal.*'];

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: string;
  is_read: boolean;
  created_at: string;
}

export default function SafetyPage() {
  const [activeTab, setActiveTab] = useState<'controls' | 'terms' | 'audit'>('controls');
  const [masterSwitch, setMasterSwitch] = useState(true);
  const [captchaFallback, setCaptchaFallback] = useState(true);
  const [humanReview, setHumanReview] = useState(true);
  const [rateLimit, setRateLimit] = useState(30);
  const [whitelist, setWhitelist] = useState(DEFAULT_WHITELIST);
  const [blacklist, setBlacklist] = useState(DEFAULT_BLACKLIST);
  const [newDomain, setNewDomain] = useState('');
  const [addMode, setAddMode] = useState<'white' | 'black'>('white');

  // Real audit log: pull from notifications table (system events)
  const { data: auditNotifs = [], isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['safety_audit_log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  // Real safety stats: count error/warning notifications
  const errorCount = auditNotifs.filter(n => n.priority === 'high' || n.type === 'error').length;
  const totalCount = auditNotifs.length;

  const addDomain = () => {
    if (!newDomain.trim()) return;
    if (addMode === 'white') {
      setWhitelist(w => [...w, newDomain.trim()]);
      toast.success('Domain whitelisted');
    } else {
      setBlacklist(b => [...b, newDomain.trim()]);
      toast.success('Domain blacklisted');
    }
    setNewDomain('');
  };

  const getLevelFromNotif = (n: Notification): { label: string; cls: string } => {
    if (n.priority === 'high' || n.type === 'error') return { label: 'ERROR', cls: 'text-[hsl(0,85%,65%)]' };
    if (n.type === 'task_complete') return { label: 'SUCCESS', cls: 'text-[hsl(145,100%,55%)]' };
    if (n.type === 'opportunity') return { label: 'INFO', cls: 'text-[hsl(185,100%,55%)]' };
    return { label: 'INFO', cls: 'text-muted-foreground' };
  };

  const DomainControls = () => (
    <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Domain Controls</h2>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
          <CheckCircle size={12} className="text-[hsl(145,100%,55%)]" /> Whitelisted Domains
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {whitelist.map(d => (
            <span key={d} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[hsl(145_100%_50%/0.08)] border border-[hsl(145_100%_50%/0.2)] text-[hsl(145,100%,60%)]">
              <Globe size={10} />{d}
              <button onClick={() => setWhitelist(w => w.filter(x => x !== d))}><Trash2 size={10} /></button>
            </span>
          ))}
        </div>
      </div>
      <div>
        <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
          <Ban size={12} className="text-[hsl(0,85%,65%)]" /> Blacklisted Patterns
        </div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {blacklist.map(d => (
            <span key={d} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-[hsl(0_85%_60%/0.08)] border border-[hsl(0_85%_60%/0.2)] text-[hsl(0,85%,65%)]">
              <Ban size={10} />{d}
              <button onClick={() => setBlacklist(b => b.filter(x => x !== d))}><Trash2 size={10} /></button>
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <select className="px-2 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs" value={addMode} onChange={e => setAddMode(e.target.value as 'white' | 'black')}>
          <option value="white">Whitelist</option>
          <option value="black">Blacklist</option>
        </select>
        <input className="flex-1 px-3 py-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)]" placeholder="domain.com" value={newDomain} onChange={e => setNewDomain(e.target.value)} onKeyDown={e => e.key === 'Enter' && addDomain()} />
        <button onClick={addDomain} className="px-3 py-2 rounded-lg bg-[hsl(185_100%_50%/0.1)] border border-[hsl(185_100%_50%/0.25)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.2)] transition-colors">
          <Plus size={14} />
        </button>
      </div>
    </div>
  );

  const SafetyControls = () => (
    <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
      <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Safety Controls</h2>
      {[
        { label: 'CAPTCHA Detection & Fallback', sub: 'Auto-detect CAPTCHAs and pause for manual intervention', val: captchaFallback, set: setCaptchaFallback },
        { label: 'Human Review Queue', sub: 'High-risk actions require manual approval before execution', val: humanReview, set: setHumanReview },
      ].map(ctrl => (
        <div key={ctrl.label} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
          <div>
            <div className="text-sm font-semibold">{ctrl.label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{ctrl.sub}</div>
          </div>
          <button onClick={() => ctrl.set(v => !v)} className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${ctrl.val ? 'bg-[hsl(185,100%,45%)]' : 'bg-[hsl(228,25%,20%)]'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${ctrl.val ? 'left-5' : 'left-0.5'}`} />
          </button>
        </div>
      ))}
      <div className="p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-sm font-semibold">Rate Limit (req/min)</div>
            <div className="text-xs text-muted-foreground">Maximum requests per minute per platform</div>
          </div>
          <span className="text-lg font-bold text-[hsl(185,100%,55%)]" style={{ fontFamily: 'Orbitron' }}>{rateLimit}</span>
        </div>
        <input type="range" min={5} max={120} value={rateLimit} onChange={e => setRateLimit(Number(e.target.value))} className="w-full accent-[hsl(185,100%,50%)]" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6 slide-in-up">
      {/* Master switch */}
      <div className={cn('rounded-xl border p-5 flex items-center justify-between', masterSwitch ? 'glass-panel border-[hsl(145_100%_50%/0.2)] bg-[hsl(145_100%_50%/0.04)]' : 'bg-[hsl(0_85%_60%/0.08)] border-[hsl(0_85%_60%/0.3)]')}>
        <div className="flex items-center gap-3">
          <ShieldAlert size={22} className={masterSwitch ? 'text-[hsl(145,100%,55%)]' : 'text-[hsl(0,85%,65%)]'} />
          <div>
            <div className="font-bold text-sm" style={{ fontFamily: 'Orbitron' }}>SAFETY SHIELD {masterSwitch ? '— ACTIVE' : '— DISABLED'}</div>
            <div className="text-xs text-muted-foreground">Master safety control for all automation systems</div>
          </div>
        </div>
        <button onClick={() => { setMasterSwitch(v => !v); toast[masterSwitch ? 'error' : 'success'](masterSwitch ? 'Safety shield disabled' : 'Safety shield enabled'); }}
          className={cn('relative w-12 h-6 rounded-full transition-colors', masterSwitch ? 'bg-[hsl(145,100%,50%)]' : 'bg-[hsl(0,85%,50%)]')}>
          <span className={cn('absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all', masterSwitch ? 'left-6' : 'left-0.5')} />
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="System Alerts"    value={`${errorCount}`}  sub="high priority events" accent="red" />
        <StatCard label="CAPTCHA Guard"    value={captchaFallback ? 'ON' : 'OFF'} sub="detection active"   accent="orange" />
        <StatCard label="Rate Limit"       value={`${rateLimit}/m`} sub="req per minute"       accent="violet" />
        <StatCard label="Audit Entries"    value={`${totalCount}`}  sub="notifications logged" accent="cyan" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SafetyControls />
        <DomainControls />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_8%)]">
        {([{ id: 'controls', label: 'Safety Controls', icon: Shield }, { id: 'terms', label: 'Platform Terms', icon: Globe }, { id: 'audit', label: 'Quick Log', icon: Activity }] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors',
                activeTab === tab.id ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)]' : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: 'Orbitron' }}>
              <Icon size={11} />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'controls' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SafetyControls />
          <DomainControls />
        </div>
      )}

      {activeTab === 'terms' && (
        <div className="space-y-4">
          <div className="p-3 rounded-xl border border-[hsl(185_100%_50%/0.15)] bg-[hsl(185_100%_50%/0.04)] flex items-start gap-2">
            <Shield size={13} className="text-[hsl(185,100%,55%)] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              Platform Terms Checker verifies whether automation is permitted before Autopilots proceed. Prohibited platforms are blocked; restricted platforms require human approval.
            </p>
          </div>
          <PlatformTermsChecker />
        </div>
      )}

      {activeTab === 'audit' && (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-[hsl(185,100%,55%)]" />
              <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Quick Audit Log</h2>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => refetchAudit()} className="p-1.5 rounded hover:bg-[hsl(228_25%_12%)] transition-colors" title="Refresh">
                <RefreshCw size={12} className={cn('text-muted-foreground', auditLoading && 'animate-spin')} />
              </button>
              <a href="/audit" className="text-xs text-[hsl(185,100%,55%)] hover:underline flex items-center gap-1">
                <FileText size={11} /> Full Audit Log & Export →
              </a>
            </div>
          </div>

          {auditLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
            </div>
          ) : auditNotifs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Activity size={24} className="mx-auto mb-2 opacity-30" />
              <div className="text-sm">No system events yet</div>
              <div className="text-xs mt-1 opacity-60">Events will appear here as Autopilots and workflows execute</div>
            </div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {auditNotifs.map(notif => {
                const { label, cls } = getLevelFromNotif(notif);
                return (
                  <div key={notif.id} className="flex items-start gap-3 py-2.5 text-xs">
                    <span className="font-mono text-muted-foreground flex-shrink-0">{timeAgo(notif.created_at)}</span>
                    <span className={cn('flex-shrink-0 font-semibold', cls)}>[{label}]</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-foreground font-medium truncate">{notif.title}</div>
                      {notif.message && <div className="text-muted-foreground text-[10px] mt-0.5 truncate">{notif.message}</div>}
                    </div>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0 capitalize">{notif.type}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
