import React, { useState } from 'react';
import { supabase } from '@/lib/supabase';

import type { User } from '@/types';
import { toast } from 'sonner';
import heroGalaxy from '@/assets/hero-galaxy.jpg';

type Mode = 'login' | 'signup' | 'otp';

interface AuthPageProps {
  onLogin: (user: User) => void;
}

export default function AuthPage({ onLogin }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) { toast.error('Enter email and password'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
      setLoading(false);
      return;
    }
    if (data.user) {
      const u: User = {
        id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.username || email.split('@')[0],
        role: 'owner',
        inviteCode: '',
        createdAt: data.user.created_at,
      };
      onLogin(u);
    }
  };

  const VALID_CODES = ['VELO-ALPHA-7', 'VELO-BETA-9', 'VELO-GAMMA-3'];

  const handleSignupSendOtp = async () => {
    if (!email) { toast.error('Enter your email'); return; }
    if (!VALID_CODES.includes(inviteCode.toUpperCase().trim())) { toast.error('Invalid invite code'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) { toast.error(error.message); setLoading(false); return; }
    toast.success('OTP sent to ' + email);
    setMode('otp');
    setLoading(false);
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) { toast.error('Enter the OTP code'); return; }
    setLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' });
    if (error) { toast.error(error.message); setLoading(false); return; }
    if (data.user) {
      if (password) {
        await supabase.auth.updateUser({ password, data: { username: email.split('@')[0] } });
      }
      const u: User = {
        id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.username || email.split('@')[0],
        role: 'owner',
        inviteCode: '',
        createdAt: data.user.created_at,
      };
      onLogin(u);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex relative overflow-hidden">
      {/* Stars */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 100 }).map((_, i) => (
          <div key={i} className="star" style={{
            width: `${Math.random() * 2.5 + 0.5}px`,
            height: `${Math.random() * 2.5 + 0.5}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            '--duration': `${Math.random() * 5 + 2}s`,
            '--delay': `${Math.random() * 4}s`,
          } as React.CSSProperties} />
        ))}
      </div>

      {/* Hero image left side */}
      <div className="hidden lg:block relative w-1/2 overflow-hidden">
        <img src={heroGalaxy} alt="VELO 2.0" className="absolute inset-0 w-full h-full object-cover opacity-70" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[hsl(230_35%_4%)]" />
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <div className="text-5xl font-black text-neon-cyan mb-2" style={{ fontFamily: 'Orbitron' }}>VELO 2.0</div>
          <div className="text-lg text-muted-foreground mb-6">Autonomous Profit Platform</div>
          <div className="space-y-2">
            {['Discover real opportunities autonomously', 'Apply & complete tasks via AI Autopilots', 'Earn profits while you sleep'].map(item => (
              <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(185,100%,55%)]" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Auth form right */}
      <div className="flex-1 flex items-center justify-center p-8 relative z-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center mx-auto mb-4 float-anim">
              <span className="text-2xl font-black text-black" style={{ fontFamily: 'Orbitron' }}>V</span>
            </div>
            <div className="text-2xl font-black text-neon-cyan mb-1" style={{ fontFamily: 'Orbitron' }}>VELO 2.0</div>
            <div className="text-xs text-muted-foreground uppercase tracking-widest">Invite-Only · Private Access</div>
          </div>

          <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.15)] p-6">
            {/* Tabs */}
            {mode !== 'otp' && (
              <div className="flex gap-1 p-1 rounded-xl bg-[hsl(228_25%_8%)] mb-5">
                {(['login', 'signup'] as Mode[]).map(m => (
                  <button key={m} onClick={() => setMode(m)} className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors ${mode === m ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)]' : 'text-muted-foreground hover:text-foreground'}`} style={{ fontFamily: 'Orbitron' }}>
                    {m}
                  </button>
                ))}
              </div>
            )}

            <div className="space-y-3">
              {mode === 'otp' ? (
                <>
                  <div className="text-center mb-4">
                    <div className="text-sm font-semibold mb-1">Check your email</div>
                    <div className="text-xs text-muted-foreground">OTP sent to <span className="text-[hsl(185,100%,55%)]">{email}</span></div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">4-Digit OTP Code</label>
                    <input autoFocus type="text" maxLength={6} className="w-full px-3 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xl font-mono text-center tracking-[0.5em] focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="0000" value={otp} onChange={e => setOtp(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleVerifyOtp()} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Set Password (optional)</label>
                    <input type="password" className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} />
                  </div>
                  <button onClick={handleVerifyOtp} disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all mt-2">
                    {loading ? 'Verifying...' : 'Access Platform'}
                  </button>
                  <button onClick={() => setMode('signup')} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors">← Back</button>
                </>
              ) : mode === 'login' ? (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                    <input type="email" className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="commander@velo2.io" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
                    <input type="password" className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                  </div>
                  <button onClick={handleLogin} disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all mt-1">
                    {loading ? 'Authenticating...' : 'Enter Platform'}
                  </button>
                </>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Invite Code</label>
                    <input className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm font-mono uppercase tracking-widest focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="VELO-XXXX-X" value={inviteCode} onChange={e => setInviteCode(e.target.value.toUpperCase())} />
                    <div className="text-[10px] text-muted-foreground mt-1">Use: VELO-ALPHA-7 · VELO-BETA-9 · VELO-GAMMA-3</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                    <input type="email" className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
                  </div>
                  <button onClick={handleSignupSendOtp} disabled={loading} className="w-full py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all mt-1">
                    {loading ? 'Sending OTP...' : 'Request Access'}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="text-center mt-4 text-[10px] text-muted-foreground">
            VELO 2.0 · Invite-Only · Powered by OnSpace AI + Playwright
          </div>
        </div>
      </div>
    </div>
  );
}
