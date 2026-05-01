import React, { useState } from 'react';
import { Settings, User, Globe, Bell, Shield, Save, RefreshCw, Key } from 'lucide-react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { user } = useAuth();

  const [notifications, setNotifications] = useState({
    earnings: true,
    opportunities: true,
    errors: true,
    weekly: false,
  });

  const [workspace, setWorkspace] = useState({
    name: 'VELO Workspace',
    maxAutopilots: 10,
    autoAssign: true,
    autoApply: false,
  });

  const [profile, setProfile] = useState({
    displayName: user?.username || '',
    timezone: 'UTC-5 (EST)',
  });

  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load real onboarding/workspace settings
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
      const { error } = await supabase
        .from('onboarding_progress')
        .upsert({ user_id: u.id, workspace_name: workspace.name }, { onConflict: 'user_id' });
      if (error) throw error;
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
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
    },
    onError: (e: Error) => toast.error('Password change failed: ' + e.message),
  });

  return (
    <div className="space-y-6 slide-in-up max-w-3xl">
      {/* Profile */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-[hsl(185,100%,55%)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Commander Profile</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Display Name</label>
            <input
              className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors"
              value={profile.displayName}
              onChange={e => setProfile(p => ({ ...p, displayName: e.target.value }))}
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Email Address</label>
            <input
              type="email"
              disabled
              className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_8%)] border border-[hsl(var(--border))] text-sm text-muted-foreground cursor-not-allowed"
              value={user?.email || ''}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Timezone</label>
            <select
              className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors"
              value={profile.timezone}
              onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}
            >
              <option>UTC-8 (PST)</option>
              <option>UTC-5 (EST)</option>
              <option>UTC+0 (GMT)</option>
              <option>UTC+1 (CET)</option>
              <option>UTC+8 (CST)</option>
            </select>
          </div>
          <div className="flex items-end">
            <div className="px-3 py-2 rounded-lg bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] text-xs text-[hsl(265,80%,70%)] w-full">
              Account: <span className="font-bold">Authenticated</span> · ID: <span className="font-mono text-[10px]">{user?.id?.slice(0, 8)}...</span>
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

      {/* Security */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key size={16} className="text-[hsl(265,80%,70%)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Security</h2>
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
              <input
                type="password"
                className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Min 6 characters"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Confirm Password</label>
              <input
                type="password"
                className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button
                onClick={() => changePasswordMutation.mutate()}
                disabled={changePasswordMutation.isPending || !newPassword}
                className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {changePasswordMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Workspace */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe size={16} className="text-[hsl(265,80%,70%)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Workspace Settings</h2>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Workspace Name</label>
              <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" value={workspace.name} onChange={e => setWorkspace(w => ({ ...w, name: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Max Autopilots</label>
              <input type="number" className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" value={workspace.maxAutopilots} onChange={e => setWorkspace(w => ({ ...w, maxAutopilots: Number(e.target.value) }))} />
            </div>
          </div>
          {[
            { label: 'Auto-Assign Opportunities', sub: 'Automatically match new opportunities to available autopilots', key: 'autoAssign' as const },
            { label: 'Auto-Apply to Matched', sub: 'Automatically apply to opportunities after matching (review compliance first)', key: 'autoApply' as const },
          ].map(ctrl => (
            <div key={ctrl.key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
              <div>
                <div className="text-sm font-medium">{ctrl.label}</div>
                <div className="text-xs text-muted-foreground">{ctrl.sub}</div>
              </div>
              <button onClick={() => setWorkspace(w => ({ ...w, [ctrl.key]: !w[ctrl.key] }))} className={`relative w-10 h-5 rounded-full transition-colors ${workspace[ctrl.key] ? 'bg-[hsl(185,100%,45%)]' : 'bg-[hsl(228,25%,20%)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${workspace[ctrl.key] ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
        <button
          onClick={() => saveWorkspaceMutation.mutate()}
          disabled={saveWorkspaceMutation.isPending}
          className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-opacity"
        >
          {saveWorkspaceMutation.isPending ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
          {saveWorkspaceMutation.isPending ? 'Saving...' : 'Save Workspace'}
        </button>
      </div>

      {/* Notifications */}
      <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Bell size={16} className="text-[hsl(30,100%,60%)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Notifications</h2>
        </div>
        <div className="space-y-3">
          {[
            { key: 'earnings' as const, label: 'Earnings Confirmed', sub: 'Notify when profits are credited to your wallet' },
            { key: 'opportunities' as const, label: 'New Opportunities', sub: 'Alert when high-confidence opportunities are discovered' },
            { key: 'errors' as const, label: 'System Errors', sub: 'Critical alerts for failed tasks or system issues' },
            { key: 'weekly' as const, label: 'Weekly Summary', sub: 'Weekly performance digest every Monday' },
          ].map(n => (
            <div key={n.key} className="flex items-center justify-between p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
              <div>
                <div className="text-sm font-medium">{n.label}</div>
                <div className="text-xs text-muted-foreground">{n.sub}</div>
              </div>
              <button onClick={() => setNotifications(v => ({ ...v, [n.key]: !v[n.key] }))} className={`relative w-10 h-5 rounded-full transition-colors ${notifications[n.key] ? 'bg-[hsl(185,100%,45%)]' : 'bg-[hsl(228,25%,20%)]'}`}>
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${notifications[n.key] ? 'left-5' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* About */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.15)] p-5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-[hsl(265,80%,70%)]" />
          <h2 className="text-sm font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>About VELO 2.0</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {[
            { label: 'Version',    val: '2.0.0' },
            { label: 'Build',      val: 'PROD-2026' },
            { label: 'Access',     val: 'Authenticated' },
            { label: 'Automation', val: 'Playwright OSS' },
            { label: 'AI Engine',  val: 'Gemini 3 Flash' },
            { label: 'Backend',    val: 'OnSpace Cloud' },
          ].map(item => (
            <div key={item.label} className="p-2 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
              <div className="text-muted-foreground">{item.label}</div>
              <div className="font-semibold text-[hsl(265,80%,70%)]">{item.val}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
