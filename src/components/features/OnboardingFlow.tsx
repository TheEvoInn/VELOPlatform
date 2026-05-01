// Remove framer-motion dependency from OnboardingFlow - use CSS animations instead
import React, { useState } from 'react';
import {
  Rocket, User, Bot, Cpu, Lock, Target, Zap,
  CheckCircle, ChevronRight, X, Star, Sparkles, Shield, Eye, EyeOff
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { createEngine, createAutopilot, addCredential, upsertOnboardingProgress, upsertUserIdentity, giveIdentityConsent } from '@/lib/api';
import { toast } from 'sonner';

interface OnboardingFlowProps {
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  { id: 'workspace',     icon: Rocket, label: 'Workspace',   title: 'Name Your Mission',           color: 'cyan' },
  { id: 'profile',       icon: User,   label: 'Profile',     title: 'Commander Profile',            color: 'violet' },
  { id: 'real_identity', icon: Shield, label: 'Identity',    title: 'Your Real Identity (Secure)',  color: 'cyan' },
  { id: 'autopilot',     icon: Bot,    label: 'Autopilot',   title: 'Create First Autopilot',       color: 'violet' },
  { id: 'ai_identity',   icon: Cpu,    label: 'AI Persona',  title: 'Configure AI Identity',        color: 'cyan' },
  { id: 'vault',         icon: Lock,   label: 'Vault',       title: 'Secure Your Credentials',      color: 'violet' },
  { id: 'categories',    icon: Target, label: 'Categories',  title: 'Select Profit Categories',     color: 'cyan' },
  { id: 'engine',        icon: Zap,    label: 'Engine',      title: 'Launch First Engine',          color: 'violet' },
];

const CATEGORIES = ['freelance', 'crypto', 'gig', 'remote_job', 'dropshipping', 'bounty', 'contest'];

export default function OnboardingFlow({ onComplete, onSkip }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);

  const [workspaceName, setWorkspaceName] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileBio, setProfileBio] = useState('');

  // Real identity (PII)
  const [realFullName, setRealFullName] = useState('');
  const [realEmail, setRealEmail] = useState('');
  const [realHeadline, setRealHeadline] = useState('');
  const [realSkills, setRealSkills] = useState('');
  const [realCountry, setRealCountry] = useState('');
  const [realPortfolio, setRealPortfolio] = useState('');
  const [showRealEmail, setShowRealEmail] = useState(false);
  const [identityConsent, setIdentityConsent] = useState(false);

  const [autopilotName, setAutopilotName] = useState('ARIA-1');
  const [autopilotPersona, setAutopilotPersona] = useState('');
  const [selectedTone, setSelectedTone] = useState('professional');
  const [identityRules] = useState(['Never accept below minimum rate', 'Always request milestones']);
  const [credName, setCredName] = useState('');
  const [credPlatform, setCredPlatform] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['freelance', 'crypto']);
  const [engineName, setEngineName] = useState('');
  const [engineGoal, setEngineGoal] = useState('');

  const step = STEPS[currentStep];
  const progress = Math.round((completedSteps.size / STEPS.length) * 100);

  const markComplete = (idx: number) => setCompletedSteps(prev => new Set([...prev, idx]));

  const goNext = async () => {
    setSaving(true);
    try {
      if (currentStep === 0 && workspaceName) {
        await upsertOnboardingProgress({ workspace_name: workspaceName });
      } else if (currentStep === 2) {
        // Save real identity
        if (realFullName || realEmail || realHeadline) {
          await upsertUserIdentity({
            full_name: realFullName || undefined,
            email: realEmail || undefined,
            headline: realHeadline || undefined,
            skills: realSkills ? realSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
            location_country: realCountry || undefined,
            portfolio_url: realPortfolio || undefined,
            has_portfolio: !!realPortfolio,
          });
        }
        if (identityConsent) {
          await giveIdentityConsent(['applications', 'registration', 'communication']);
          toast.success('Identity saved & consent granted');
        }
      } else if (currentStep === 3 && autopilotName) {
        await createAutopilot({
          name: autopilotName,
          persona: autopilotPersona || 'Professional AI assistant',
          tone: selectedTone,
          status: 'idle',
          skills: realSkills ? realSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
          allowed_categories: selectedCategories,
          workload_limit: 10,
          behavior_rules: identityRules,
        });
      } else if (currentStep === 5 && credName) {
        await addCredential({ name: credName, type: 'login', platform: credPlatform, is_encrypted: true });
      } else if (currentStep === 7 && engineName) {
        await createEngine({
          name: engineName, goal: engineGoal, status: 'idle',
          channels: selectedCategories, category: selectedCategories[0] || 'freelance',
        });
        await upsertOnboardingProgress({
          completed_steps: STEPS.map(s => s.id),
          current_step: 'done',
          is_complete: true,
          selected_categories: selectedCategories,
          completed_at: new Date().toISOString(),
        });
        markComplete(currentStep);
        toast.success('VELO 2.0 is ready for launch! 🚀');
        onComplete();
        setSaving(false);
        return;
      }
      markComplete(currentStep);
      if (currentStep < STEPS.length - 1) setCurrentStep(c => c + 1);
      else onComplete();
    } catch (err) {
      console.error('[onboarding]', err);
    } finally {
      setSaving(false);
    }
  };

  const canProceed = () => {
    if (currentStep === 0) return workspaceName.trim().length > 2;
    if (currentStep === 1) return profileName.trim().length > 1;
    if (currentStep === 2) return true; // identity optional but encouraged
    if (currentStep === 3) return autopilotName.trim().length > 1;
    if (currentStep === 6) return selectedCategories.length > 0;
    if (currentStep === 7) return engineName.trim().length > 1;
    return true;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(230_35%_4%/0.97)] backdrop-blur-md">
      {/* Stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="star absolute" style={{
            width: `${Math.random() * 2 + 0.5}px`,
            height: `${Math.random() * 2 + 0.5}px`,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            '--duration': `${Math.random() * 4 + 2}s`,
            '--delay': `${Math.random() * 3}s`,
          } as React.CSSProperties} />
        ))}
      </div>

      <div className="relative w-full max-w-2xl mx-4">
        <button onClick={onSkip} className="absolute -top-10 right-0 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <X size={13} /> Skip onboarding
        </button>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>VELO 2.0 — MISSION SETUP</div>
            <div className="text-xs text-muted-foreground">{progress}% Complete</div>
          </div>
          <div className="h-1 rounded-full bg-[hsl(228_25%_12%)] overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all duration-700" style={{ width: `${progress}%` }} />
          </div>
          <div className="flex justify-between mt-3">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const isDone = completedSteps.has(i);
              const isCurrent = i === currentStep;
              return (
                <div key={s.id} className="flex flex-col items-center gap-1">
                  <div className={cn('w-7 h-7 rounded-full border flex items-center justify-center transition-all',
                    isDone ? 'bg-[hsl(145_100%_50%/0.2)] border-[hsl(145_100%_50%/0.5)]' :
                    isCurrent ? 'bg-[hsl(185_100%_50%/0.15)] border-[hsl(185_100%_50%/0.5)] glow-cyan' :
                    'bg-[hsl(228_25%_12%)] border-[hsl(228_25%_18%)]')}>
                    {isDone ? <CheckCircle size={13} className="text-[hsl(145,100%,55%)]" /> : <Icon size={12} className={isCurrent ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground'} />}
                  </div>
                  <span className={cn('text-[9px] hidden sm:block', isCurrent ? 'text-[hsl(185,100%,55%)]' : 'text-muted-foreground')}>{s.label}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Card */}
        <div className="glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.2)] p-7 slide-in-up max-h-[70vh] overflow-y-auto">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-violet-500 flex items-center justify-center float-anim flex-shrink-0">
              {React.createElement(step.icon, { size: 20, className: 'text-black' })}
            </div>
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Step {currentStep + 1} of {STEPS.length}</div>
              <h2 className="text-lg font-black text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>{step.title}</h2>
            </div>
          </div>

          {/* Step content */}
          <div className="space-y-4">
            {currentStep === 0 && (
              <>
                <p className="text-sm text-muted-foreground">Give your autonomous profit workspace a name.</p>
                <input autoFocus className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="e.g. Alpha Strike Base, Profit Nexus..." value={workspaceName} onChange={e => setWorkspaceName(e.target.value)} />
                <div className="grid grid-cols-3 gap-2">
                  {['Alpha Strike Base', 'Profit Nexus', 'Quantum Vault'].map(p => (
                    <button key={p} onClick={() => setWorkspaceName(p)} className="p-2 rounded-lg border border-[hsl(var(--border))] text-xs text-muted-foreground hover:text-foreground hover:border-[hsl(185_100%_50%/0.3)] transition-colors">{p}</button>
                  ))}
                </div>
              </>
            )}

            {currentStep === 1 && (
              <>
                <p className="text-sm text-muted-foreground">Your Autopilots will represent you on platforms.</p>
                <input autoFocus className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Commander name..." value={profileName} onChange={e => setProfileName(e.target.value)} />
                <textarea className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors resize-none h-20" placeholder="Professional background..." value={profileBio} onChange={e => setProfileBio(e.target.value)} />
              </>
            )}

            {currentStep === 2 && (
              <>
                <div className="p-3 rounded-xl border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.05)] flex items-start gap-2">
                  <Shield size={13} className="text-[hsl(265,80%,70%)] mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    <strong className="text-[hsl(265,80%,70%)]">Voluntary & Encrypted.</strong> Provide your real info for authentic applications. VELO never fabricates identity data. All fields optional but improve Autopilot success rates.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                    <input autoFocus className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Your real name" value={realFullName} onChange={e => setRealFullName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Country</label>
                    <input className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="United States" value={realCountry} onChange={e => setRealCountry(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 flex items-center gap-2">Email <span className="text-[hsl(145,100%,55%)] text-[10px]">🔒 encrypted</span></label>
                  <div className="relative">
                    <input type={showRealEmail ? 'text' : 'password'} className="w-full px-3 py-2.5 pr-10 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="your@email.com" value={realEmail} onChange={e => setRealEmail(e.target.value)} />
                    <button onClick={() => setShowRealEmail(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {showRealEmail ? <EyeOff size={13} /> : <Eye size={13} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Professional Headline</label>
                  <input className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Full-stack dev · 8 yrs exp" value={realHeadline} onChange={e => setRealHeadline(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Skills (comma-separated)</label>
                  <input className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="React, copywriting, SEO..." value={realSkills} onChange={e => setRealSkills(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Portfolio URL (optional)</label>
                  <input className="w-full px-3 py-2.5 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="https://yourportfolio.com" value={realPortfolio} onChange={e => setRealPortfolio(e.target.value)} />
                </div>
                {/* Consent */}
                <label className="flex items-start gap-3 cursor-pointer select-none group p-3 rounded-xl border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.05)]">
                  <div onClick={() => setIdentityConsent(c => !c)} className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all', identityConsent ? 'bg-[hsl(265_80%_55%/0.3)] border-[hsl(265,80%,70%)]' : 'border-[hsl(var(--border))] group-hover:border-[hsl(265_80%_55%/0.4)]')}>
                    {identityConsent && <CheckCircle size={12} className="text-[hsl(265,80%,70%)]" />}
                  </div>
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    I authorize VELO 2.0 Autopilots to use this information for legitimate job applications and platform registrations on my behalf.
                  </span>
                </label>
              </>
            )}

            {currentStep === 3 && (
              <>
                <p className="text-sm text-muted-foreground">Your first AI agent that applies for and completes tasks.</p>
                <input autoFocus className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="e.g. ARIA-7, NEXUS-1..." value={autopilotName} onChange={e => setAutopilotName(e.target.value)} />
                <input className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Persona (e.g. Senior copywriter...)" value={autopilotPersona} onChange={e => setAutopilotPersona(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {['professional', 'friendly', 'technical', 'creative'].map(t => (
                    <button key={t} onClick={() => setSelectedTone(t)} className={cn('px-3 py-1.5 rounded-lg text-xs border capitalize', selectedTone === t ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]' : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))]')}>{t}</button>
                  ))}
                </div>
              </>
            )}

            {currentStep === 4 && (
              <>
                <p className="text-sm text-muted-foreground">Behavioral rules govern all Autopilot actions.</p>
                <div className="space-y-2">
                  {identityRules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                      <CheckCircle size={13} className="text-[hsl(145,100%,55%)]" />
                      <span className="text-sm">{rule}</span>
                    </div>
                  ))}
                </div>
                <div className="p-3 rounded-xl border border-[hsl(185_100%_50%/0.15)] bg-[hsl(185_100%_50%/0.04)] text-xs text-muted-foreground">
                  <Sparkles size={12} className="inline mr-1 text-[hsl(185,100%,55%)]" />
                  Customizable anytime in the AI Identity Studio module.
                </div>
              </>
            )}

            {currentStep === 5 && (
              <>
                <p className="text-sm text-muted-foreground">Store your first credential — encrypted and secure.</p>
                <div className="grid grid-cols-2 gap-3">
                  <input className="px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="e.g. Upwork Account" value={credName} onChange={e => setCredName(e.target.value)} />
                  <input className="px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Platform..." value={credPlatform} onChange={e => setCredPlatform(e.target.value)} />
                </div>
                <div className="p-3 rounded-xl border border-[hsl(265_80%_55%/0.15)] bg-[hsl(265_80%_55%/0.04)] text-xs text-muted-foreground">
                  <Lock size={12} className="inline mr-1 text-[hsl(265,80%,70%)]" />
                  AES-256 encrypted. Autopilots access only during approved tasks.
                </div>
              </>
            )}

            {currentStep === 6 && (
              <>
                <p className="text-sm text-muted-foreground">Your Autopilots will focus on these profit categories.</p>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const sel = selectedCategories.includes(cat);
                    return (
                      <button key={cat} onClick={() => setSelectedCategories(prev => sel ? prev.filter(c => c !== cat) : [...prev, cat])}
                        className={cn('p-3 rounded-xl border text-left text-sm capitalize transition-colors', sel ? 'bg-[hsl(185_100%_50%/0.12)] border-[hsl(185_100%_50%/0.4)] text-[hsl(185,100%,55%)]' : 'bg-[hsl(228_25%_10%)] border-[hsl(var(--border))] text-muted-foreground hover:text-foreground')}>
                        <div className="flex items-center gap-2">
                          {sel && <CheckCircle size={12} className="text-[hsl(185,100%,55%)]" />}
                          <span className="font-medium">{cat.replace('_', ' ')}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {currentStep === 7 && (
              <>
                <p className="text-sm text-muted-foreground">Your first Profit Engine — the core autonomous unit.</p>
                <input autoFocus className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="e.g. Freelance Blitz, Crypto Hunter..." value={engineName} onChange={e => setEngineName(e.target.value)} />
                <textarea className="w-full px-4 py-3 rounded-xl bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors resize-none h-20" placeholder="Goal: win 5 writing gigs per week..." value={engineGoal} onChange={e => setEngineGoal(e.target.value)} />
                <div className="p-3 rounded-xl bg-gradient-to-r from-cyan-500/10 to-violet-500/10 border border-[hsl(185_100%_50%/0.2)] text-xs text-muted-foreground">
                  <Star size={12} className="inline mr-1 text-[hsl(185,100%,55%)]" />
                  Engine will begin scanning for opportunities immediately after launch.
                </div>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-7">
            <button onClick={() => currentStep > 0 && setCurrentStep(c => c - 1)} disabled={currentStep === 0} className="px-4 py-2 rounded-xl text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors">
              Back
            </button>
            <div className="flex items-center gap-2">
              {currentStep < STEPS.length - 1 && (
                <button onClick={() => { markComplete(currentStep); setCurrentStep(c => c + 1); }} className="px-4 py-2 rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Skip step
                </button>
              )}
              <button onClick={goNext} disabled={!canProceed() || saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-40 transition-all">
                {saving ? <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> : (
                  currentStep === STEPS.length - 1 ? <><Rocket size={15} /> Launch VELO 2.0</> : <>Next <ChevronRight size={15} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
