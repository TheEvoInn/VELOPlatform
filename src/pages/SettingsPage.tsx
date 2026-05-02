import React, { useState, useEffect } from 'react';
import {
  Settings, User, Globe, Bell, Shield, Save, RefreshCw, Key,
  Lock, Code2, Database, Zap, AlertTriangle, CheckCircle,
  ExternalLink, CreditCard, Wallet, FileText, ChevronRight, Info,
  Eye, EyeOff, Copy, Cpu, Server,
} from 'lucide-react';
import AISourcePanel from '@/components/features/AISourcePanel';
import AIRuntimePanel from '@/components/features/AIRuntimePanel';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Tab = 'profile' | 'workspace' | 'ai_source' | 'ai_runtime' | 'integrations' | 'security' | 'notifications' | 'about';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'profile',       label: 'Profile',       icon: User },
  { id: 'workspace',     label: 'Workspace',     icon: Settings },
  { id: 'ai_source',     label: 'AI Source',     icon: Cpu },
  { id: 'ai_runtime',   label: 'AI Runtime',    icon: Server },
  { id: 'integrations',  label: 'Integrations',  icon: Zap },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'about',         label: 'About',         icon: Info },
];

export default function SettingsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  const [notifications, setNotifications] = useState({
    earnings: true, opportunities: true, errors: true, weekly: false,
    task_complete: true, autopilot_idle: false,
  });

  const [workspace, setWorkspace] = useState({
    name: 'VELO Workspace',
    maxAutopilots: 10,
    autoAssign: true,
    autoApply: false,
    taskPollingInterval: 15,
    earningsAutoLog: true,
  });

  const [profile, setProfile] = useState({
    displayName: user?.username || '',
    timezone: 'UTC-5 (EST)',
  });

  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [devConsolePIN, setDevConsolePIN] = useState('');
  const [showPIN, setShowPIN] = useState(false);
  const [pinSaved, setPinSaved] = useState(false);

  // Integration API key state
  const [integrations, setIntegrations] = useState({
    captcha_solver_key: '',
    sms_provider_key: '',
    email_inbox_key: '',
    proxy_api_key: '',
    captcha_provider: 'anticaptcha',
    sms_provider: 'twilio',
    proxy_provider: 'brightdata',
  });
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  const toggleShowKey = (k: string) => setShowKeys(s => ({ ...s, [k]: !s[k] }));

  // Load existing settings from user metadata
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) return;
      const m = u.user_metadata || {};
      if (m.username) setProfile(p => ({ ...p, displayName: m.username }));
      if (m.timezone) setProfile(p => ({ ...p, timezone: m.timezone }));
      if (m.dev_console_pin) setDevConsolePIN(m.dev_console_pin);
      if (m.integrations) setIntegrations(prev => ({ ...prev, ...m.integrations }));
    });
  }, []);

  const { data: onboarding } = useQuery({
    queryKey: ['settings_onboarding'],
    queryFn: async () => {
      const { data } = await supabase.from('onboarding_progress').select('workspace_name').maybeSingle();
      if (data?.workspace_name) setWorkspace(w => ({ ...w, name: data.workspace_name }));
      return data;
    },
  });

  const saveProfileMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        data: { username: profile.displayName, timezone: profile.timezone },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Profile saved'),
    onError: (e: Error) => toast.error('Save failed: ' + e.message),
  });

  const saveWorkspaceMutation = useMutation({
    mutationFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) throw new Error('Not authenticated');
      const { error } = await supabase.from('onboarding_progress').upsert(
        { user_id: u.id, workspace_name: workspace.name }, { onConflict: 'user_id' }
      );
      if (error) throw error;
      await supabase.auth.updateUser({
        data: { workspace_settings: workspace },
      });
    },
    onSuccess: () => toast.success('Workspace settings saved'),
    onError: (e: Error) => toast.error('Save failed: ' + e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error('Passwords do not match');
      if (newPassword.length < 6) throw new Error('Password must be at least 6 characters');
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Password updated');
      setNewPassword(''); setConfirmPassword(''); setChangingPassword(false);
    },
    onError: (e: Error) => toast.error('Password change failed: ' + e.message),
  });

  const savePINMutation = useMutation({
    mutationFn: async () => {
      if (!devConsolePIN || devConsolePIN.length < 4) throw new Error('PIN must be at least 4 characters');
      const { error } = await supabase.auth.updateUser({
        data: { dev_console_pin: devConsolePIN },
      });
      if (error) throw error;
      sessionStorage.removeItem('dev_console_unlocked');
    },
    onSuccess: () => { toast.success('Dev Console PIN updated — re-authentication required on next access'); setPinSaved(true); },
    onError: (e: Error) => toast.error('PIN save failed: ' + e.message),
  });

  const saveIntegrationsMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({
        data: { integrations },
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success('Integration settings saved — available to automation engine'),
    onError: (e: Error) => toast.error('Save failed: ' + e.message),
  });

  const { data: identity } = useQuery({
    queryKey: ['settings_identity'],
    queryFn: async () => {
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) return null;
      const { data } = await supabase.from('user_identity').select('completeness_score, consent_given, has_id_document, approved_for_applications').eq('user_id', u.id).maybeSingle();
      return data;
    },
  });

  const inputCls = 'w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.4)] transition-colors';

  return (
    <div className="slide-in-up max-w-4xl">
      {/* Tab navigation */}
      <div className="flex gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_6%)] w-fit mb-6 flex-wrap">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all',
                tab === t.id
                  ? 'bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-[hsl(185,100%,55%)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: 'Orbitron' }}
            >
              <Icon size={11} />
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Profile Tab ──────────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-5">
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <User size={15} className="text-[hsl(185,100%,55%)]" />
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Commander Profile</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Display Name</label>
                <input className={inputCls} value={profile.displayName} onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))} placeholder="Your name" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Email Address</label>
                <input type="email" disabled className={cn(inputCls, 'text-muted-foreground cursor-not-allowed opacity-60')} value={user?.email || ''} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Timezone</label>
                <select className={inputCls} value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}>
                  {['UTC-8 (PST)', 'UTC-7 (MST)', 'UTC-6 (CST)', 'UTC-5 (EST)', 'UTC+0 (GMT)', 'UTC+1 (CET)', 'UTC+2 (EET)', 'UTC+5:30 (IST)', 'UTC+8 (CST/SGT)', 'UTC+9 (JST)', 'UTC+10 (AEST)'].map(tz => (
                    <option key={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-end">
                <div className="px-3 py-2.5 rounded-lg bg-[hsl(265_80%_55%/0.08)] border border-[hsl(265_80%_55%/0.2)] text-xs text-[hsl(265,80%,70%)] w-full">
                  Authenticated · ID: <span className="font-mono text-[10px]">{user?.id?.slice(0, 12)}...</span>
                </div>
              </div>
            </div>
            <button
              onClick={() => saveProfileMutation.mutate()}
              disabled={saveProfileMutation.isPending}
              className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {saveProfileMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
              {saveProfileMutation.isPending ? 'Saving...' : 'Save Profile'}
            </button>
          </div>

          {/* Identity status */}
          <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.15)] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Shield size={14} className="text-[hsl(265,80%,70%)]" />
              <h3 className="text-xs font-black uppercase tracking-wider text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>Identity Status</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              {[
                { label: 'Completeness', value: identity ? `${identity.completeness_score ?? 0}%` : '—', ok: (identity?.completeness_score ?? 0) >= 80 },
                { label: 'Consent Given', value: identity?.consent_given ? 'Yes' : 'No', ok: !!identity?.consent_given },
                { label: 'ID Document', value: identity?.has_id_document ? 'Uploaded' : 'Missing', ok: !!identity?.has_id_document },
                { label: 'Applications', value: identity?.approved_for_applications ? 'Approved' : 'Pending', ok: !!identity?.approved_for_applications },
              ].map(item => (
                <div key={item.label} className="p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                  <div className="flex items-center gap-1.5 mb-1">
                    {item.ok
                      ? <CheckCircle size={11} className="text-[hsl(145,100%,55%)]" />
                      : <AlertTriangle size={11} className="text-[hsl(30,100%,60%)]" />
                    }
                    <span className="text-muted-foreground">{item.label}</span>
                  </div>
                  <div className={cn('font-semibold', item.ok ? 'text-[hsl(145,100%,55%)]' : 'text-[hsl(30,100%,60%)]')}>{item.value}</div>
                </div>
              ))}
            </div>
            <a href="/identity" className="mt-3 flex items-center gap-1.5 text-xs text-[hsl(185,100%,55%)] hover:underline">
              <ChevronRight size={11} /> Open Identity Studio to complete your profile
            </a>
          </div>
        </div>
      )}

      {/* ── Workspace Tab ────────────────────────────────────────────────────── */}
      {tab === 'workspace' && (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Settings size={15} className="text-[hsl(265,80%,70%)]" />
            <h2 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Workspace Settings</h2>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Workspace Name</label>
                <input className={inputCls} value={workspace.name} onChange={e => setWorkspace(w => ({ ...w, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Max Concurrent Autopilots</label>
                <input type="number" min="1" max="50" className={inputCls} value={workspace.maxAutopilots} onChange={e => setWorkspace(w => ({ ...w, maxAutopilots: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Task Polling Interval (seconds)</label>
                <input type="number" min="5" max="120" className={inputCls} value={workspace.taskPollingInterval} onChange={e => setWorkspace(w => ({ ...w, taskPollingInterval: Number(e.target.value) }))} />
              </div>
            </div>

            {[
              { key: 'autoAssign' as const, label: 'Auto-Assign Opportunities', sub: 'Automatically match new opportunities to available autopilots' },
              { key: 'autoApply' as const, label: 'Auto-Apply to Matched Opportunities', sub: 'Automatically apply after matching (requires consent + identity completeness ≥ 80%)' },
              { key: 'earningsAutoLog' as const, label: 'Auto-Log Earnings on Task Completion', sub: 'Automatically record earnings to Wallet when automation sessions complete' },
            ].map(ctrl => (
              <div key={ctrl.key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                <div>
                  <div className="text-sm font-medium">{ctrl.label}</div>
                  <div className="text-xs text-muted-foreground">{ctrl.sub}</div>
                </div>
                <button
                  onClick={() => setWorkspace(w => ({ ...w, [ctrl.key]: !w[ctrl.key] }))}
                  className={cn('relative w-10 h-5 rounded-full transition-colors flex-shrink-0', workspace[ctrl.key] ? 'bg-[hsl(185,100%,45%)]' : 'bg-[hsl(228,25%,20%)]')}
                >
                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', workspace[ctrl.key] ? 'left-5' : 'left-0.5')} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => saveWorkspaceMutation.mutate()} disabled={saveWorkspaceMutation.isPending} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-opacity">
            {saveWorkspaceMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saveWorkspaceMutation.isPending ? 'Saving...' : 'Save Workspace'}
          </button>
        </div>
      )}

      {/* ── AI Runtime Tab ─────────────────────────────────────────────────────── */}
      {tab === 'ai_runtime' && (
        <div className="space-y-2">
          <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.15)] p-4 flex items-start gap-3 mb-2">
            <Server size={14} className="text-[hsl(185,100%,55%)] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-[hsl(185,100%,55%)] font-semibold">VELO Internal AI Runtime</span> — A 4-tier AI system that keeps VELO fully operational regardless of credit status. Configure a remote Ollama server for free, unlimited AI generation with no user installation required.
            </div>
          </div>
          <AIRuntimePanel />
        </div>
      )}

      {/* ── AI Source Tab ──────────────────────────────────────────────────────── */}
      {tab === 'ai_source' && (
        <div className="space-y-2">
          <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.15)] p-4 flex items-start gap-3 mb-2">
            <Cpu size={14} className="text-[hsl(145,100%,55%)] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-[hsl(145,100%,55%)] font-semibold">Local AI Fallback System</span> — VELO 2.0 stays fully operational even when cloud credits are exhausted.
              Configure your preferred AI source below. In Hybrid mode, the system automatically switches to your
              local Ollama instance when cloud AI becomes unavailable — no interruptions, no blocked workflows.
            </div>
          </div>
          <AISourcePanel />
        </div>
      )}

      {/* ── Integrations Tab ─────────────────────────────────────────────────── */}
      {tab === 'integrations' && (
        <div className="space-y-5">
          {/* Info banner */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(185_100%_50%/0.2)] bg-[hsl(185_100%_50%/0.04)]">
            <Info size={14} className="text-[hsl(185,100%,55%)] flex-shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground leading-relaxed">
              <span className="text-[hsl(185,100%,55%)] font-semibold">Third-Party Integrations</span> — These API keys are stored in your user metadata and made available to the automation engine for real-world task execution. Keys are never transmitted to third parties outside of their intended service.
            </div>
          </div>

          {/* CAPTCHA */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-[hsl(30,100%,60%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>CAPTCHA Solver</h3>
              <span className="ml-auto text-[10px] text-muted-foreground">Required for account creation & login automation</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Provider</label>
                <select className={inputCls} value={integrations.captcha_provider} onChange={e => setIntegrations(i => ({ ...i, captcha_provider: e.target.value }))}>
                  {['anticaptcha', '2captcha', 'capsolver', 'deathbycaptcha'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys['captcha'] ? 'text' : 'password'}
                    className={cn(inputCls, 'pr-8 font-mono text-xs')}
                    value={integrations.captcha_solver_key}
                    onChange={e => setIntegrations(i => ({ ...i, captcha_solver_key: e.target.value }))}
                    placeholder="Enter API key..."
                  />
                  <button onClick={() => toggleShowKey('captcha')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKeys['captcha'] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
            <a href="https://anti-captcha.com" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[hsl(185,100%,55%)] hover:underline flex items-center gap-1">
              <ExternalLink size={10} /> Get Anti-CAPTCHA API key (from $2/1000 solves)
            </a>
          </div>

          {/* SMS */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Zap size={15} className="text-[hsl(50,100%,60%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>SMS Verification</h3>
              <span className="ml-auto text-[10px] text-muted-foreground">Required for account phone verification</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Provider</label>
                <select className={inputCls} value={integrations.sms_provider} onChange={e => setIntegrations(i => ({ ...i, sms_provider: e.target.value }))}>
                  {['twilio', 'sms-activate', '5sim', 'textverified'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">API Key / SID</label>
                <div className="relative">
                  <input
                    type={showKeys['sms'] ? 'text' : 'password'}
                    className={cn(inputCls, 'pr-8 font-mono text-xs')}
                    value={integrations.sms_provider_key}
                    onChange={e => setIntegrations(i => ({ ...i, sms_provider_key: e.target.value }))}
                    placeholder="Enter API key..."
                  />
                  <button onClick={() => toggleShowKey('sms')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKeys['sms'] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
            <a href="https://sms-activate.io" target="_blank" rel="noopener noreferrer" className="text-[11px] text-[hsl(185,100%,55%)] hover:underline flex items-center gap-1">
              <ExternalLink size={10} /> Get SMS-Activate API key (virtual numbers from $0.10)
            </a>
          </div>

          {/* Proxy */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe size={15} className="text-[hsl(265,80%,70%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Proxy Provider</h3>
              <span className="ml-auto text-[10px] text-muted-foreground">Residential proxies for geo-routing</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Provider</label>
                <select className={inputCls} value={integrations.proxy_provider} onChange={e => setIntegrations(i => ({ ...i, proxy_provider: e.target.value }))}>
                  {['brightdata', 'oxylabs', 'smartproxy', 'iproyal', 'none'].map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys['proxy'] ? 'text' : 'password'}
                    className={cn(inputCls, 'pr-8 font-mono text-xs')}
                    value={integrations.proxy_api_key}
                    onChange={e => setIntegrations(i => ({ ...i, proxy_api_key: e.target.value }))}
                    placeholder="Enter API key..."
                  />
                  <button onClick={() => toggleShowKey('proxy')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showKeys['proxy'] ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Email Inbox */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={15} className="text-[hsl(145,100%,55%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Email Inbox Access</h3>
              <span className="ml-auto text-[10px] text-muted-foreground">For email verification during signup</span>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">IMAP / API Key (Mailosaur, MailSlurp, or personal IMAP)</label>
              <div className="relative">
                <input
                  type={showKeys['email'] ? 'text' : 'password'}
                  className={cn(inputCls, 'pr-8 font-mono text-xs')}
                  value={integrations.email_inbox_key}
                  onChange={e => setIntegrations(i => ({ ...i, email_inbox_key: e.target.value }))}
                  placeholder="API key or IMAP password..."
                />
                <button onClick={() => toggleShowKey('email')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showKeys['email'] ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
            </div>
          </div>

          <button
            onClick={() => saveIntegrationsMutation.mutate()}
            disabled={saveIntegrationsMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-opacity"
          >
            {saveIntegrationsMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saveIntegrationsMutation.isPending ? 'Saving...' : 'Save Integration Keys'}
          </button>
        </div>
      )}

      {/* ── Security Tab ─────────────────────────────────────────────────────── */}
      {tab === 'security' && (
        <div className="space-y-5">
          {/* Password */}
          <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Key size={15} className="text-[hsl(265,80%,70%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Account Password</h3>
            </div>
            {!changingPassword ? (
              <div className="flex items-center justify-between p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                <div>
                  <div className="text-sm font-semibold">Password</div>
                  <div className="text-xs text-muted-foreground">Update your account password</div>
                </div>
                <button
                  onClick={() => setChangingPassword(true)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.08)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.15)] transition-colors"
                >
                  Change Password
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">New Password</label>
                  <input type="password" className={inputCls} value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Confirm Password</label>
                  <input type="password" className={inputCls} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repeat password" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button
                    onClick={() => changePasswordMutation.mutate()}
                    disabled={changePasswordMutation.isPending || !newPassword}
                    className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {changePasswordMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                    Update Password
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Dev Console PIN */}
          <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.2)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Code2 size={15} className="text-[hsl(265,80%,70%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Developer Console PIN</h3>
            </div>
            <div className="mb-3 text-xs text-muted-foreground leading-relaxed">
              This PIN protects admin access to the Developer Console. Default is <code className="font-mono text-[hsl(265,80%,70%)]">VELO-ADMIN-2026</code>. Set a custom PIN to improve security.
            </div>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <input
                  type={showPIN ? 'text' : 'password'}
                  className={cn(inputCls, 'pr-8 font-mono tracking-widest')}
                  value={devConsolePIN}
                  onChange={e => setDevConsolePIN(e.target.value)}
                  placeholder="Set new PIN (min 4 chars)"
                />
                <button onClick={() => setShowPIN(s => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPIN ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <button
                onClick={() => savePINMutation.mutate()}
                disabled={savePINMutation.isPending || devConsolePIN.length < 4}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[hsl(265_80%_55%/0.15)] border border-[hsl(265_80%_55%/0.3)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.25)] disabled:opacity-50 transition-colors"
              >
                {savePINMutation.isPending ? <RefreshCw size={13} className="animate-spin" /> : pinSaved ? <CheckCircle size={13} /> : <Save size={13} />}
                {pinSaved ? 'Saved' : 'Set PIN'}
              </button>
            </div>
          </div>

          {/* Vault key info */}
          <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.15)] p-5">
            <div className="flex items-center gap-2 mb-3">
              <Lock size={15} className="text-[hsl(145,100%,55%)]" />
              <h3 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Vault Encryption</h3>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { label: 'Algorithm', value: 'AES-256-GCM' },
                { label: 'Key Derivation', value: 'PBKDF2 SHA-256, 100K iterations' },
                { label: 'Key Source', value: 'User auth identity (never stored)' },
                { label: 'Storage', value: 'Ciphertext only — zero-knowledge' },
                { label: 'Decryption', value: 'Client-side only, ephemeral' },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between p-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-semibold text-[hsl(145,100%,55%)] font-mono text-[11px]">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Notifications Tab ─────────────────────────────────────────────────── */}
      {tab === 'notifications' && (
        <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Bell size={15} className="text-[hsl(30,100%,60%)]" />
            <h2 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Notification Preferences</h2>
          </div>
          <div className="space-y-3">
            {[
              { key: 'earnings' as const,       label: 'Earnings Confirmed',        sub: 'Notify when profits are credited to your wallet' },
              { key: 'opportunities' as const,  label: 'New Opportunities',          sub: 'Alert when high-confidence opportunities are discovered' },
              { key: 'task_complete' as const,  label: 'Task Completions',           sub: 'Notify when automation sessions or tasks finish successfully' },
              { key: 'errors' as const,         label: 'System Errors',             sub: 'Critical alerts for failed tasks or system issues' },
              { key: 'autopilot_idle' as const, label: 'Autopilot Idle Warning',    sub: 'Alert when an autopilot has been idle for more than 24h' },
              { key: 'weekly' as const,         label: 'Weekly Performance Summary', sub: 'Weekly earnings and task digest every Monday' },
            ].map(n => (
              <div key={n.key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                <div>
                  <div className="text-sm font-medium">{n.label}</div>
                  <div className="text-xs text-muted-foreground">{n.sub}</div>
                </div>
                <button
                  onClick={() => setNotifications(v => ({ ...v, [n.key]: !v[n.key] }))}
                  className={cn('relative w-10 h-5 rounded-full transition-colors flex-shrink-0', notifications[n.key] ? 'bg-[hsl(185,100%,45%)]' : 'bg-[hsl(228,25%,20%)]')}
                >
                  <span className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all', notifications[n.key] ? 'left-5' : 'left-0.5')} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── About Tab ────────────────────────────────────────────────────────── */}
      {tab === 'about' && (
        <div className="space-y-5">
          <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.15)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-[hsl(265,80%,70%)]" />
              <h2 className="text-sm font-black uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>About VELO 2.0</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs mb-5">
              {[
                { label: 'Version',          val: '2.0.0' },
                { label: 'Build',            val: 'PROD-2026' },
                { label: 'Access Mode',      val: 'Real-World' },
                { label: 'Automation',       val: 'Playwright OSS' },
                { label: 'Cloud AI',         val: 'Gemini 3 Flash' },
                { label: 'Local AI',         val: 'Ollama (Free)' },
                { label: 'AI Router',        val: 'Credit-Aware' },
                { label: 'Backend',          val: 'OnSpace Cloud' },
                { label: 'Auth',             val: 'Supabase OTP' },
                { label: 'Encryption',       val: 'AES-256-GCM' },
                { label: 'Key Derivation',   val: 'PBKDF2 100K' },
              ].map(item => (
                <div key={item.label} className="p-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                  <div className="text-muted-foreground">{item.label}</div>
                  <div className="font-semibold text-[hsl(265,80%,70%)]">{item.val}</div>
                </div>
              ))}
            </div>

            <div className="text-[11px] text-muted-foreground leading-relaxed border-t border-[hsl(var(--border))] pt-4">
              VELO 2.0 is a fully autonomous profit platform operating in real-world mode. All automation uses genuine Playwright browser execution, real identity data provided by the user, live opportunity discovery from real platforms, and actual earnings tracking. No simulated workflows, no fake data, no placeholder logic.
            </div>
          </div>

          <div className="glass-panel rounded-xl border border-[hsl(0_85%_60%/0.15)] p-4">
            <div className="text-xs font-black text-[hsl(0,85%,65%)] mb-2 uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Real-World Mode Active</div>
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              {[
                'All workflows interact with real websites and APIs',
                'Identity data is real user-provided information',
                'Account creation uses legitimate signup flows',
                'Task submissions are real deliverables',
                'Earnings are tracked from actual platform payments',
                'No simulation, no mock data, no fake results',
              ].map(item => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle size={10} className="text-[hsl(145,100%,55%)] flex-shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
