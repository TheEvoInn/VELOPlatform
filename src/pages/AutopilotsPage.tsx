import React, { useState, useEffect } from 'react';
import { Bot, Plus, Play, Pause, RefreshCw, Shield, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import StatCard from '@/components/features/StatCard';
import StatusBadge from '@/components/features/StatusBadge';
import EligibilityChecker from '@/components/features/EligibilityChecker';
import ConsentGate from '@/components/features/ConsentGate';
import { getUserIdentity, type UserIdentity } from '@/lib/api';
import { useAutopilots, useCreateAutopilot, useUpdateAutopilot } from '@/hooks/useSharedData';
import { formatCurrency } from '@/lib/mockData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Autopilot {
  id: string;
  name: string;
  avatar?: string;
  persona?: string;
  tone?: string;
  status: string;
  skills?: string[];
  allowed_categories?: string[];
  workload_limit?: number;
  current_workload?: number;
  workloadLimit?: number;
  currentWorkload?: number;
  total_earned?: number;
  totalEarned?: number;
  tasks_completed?: number;
  tasksCompleted?: number;
  behavior_rules?: string[];
}

const AVATARS = ['🤖', '🛸', '🧠', '⚡', '🔮', '🌌', '🚀', '💠'];
const TONES = ['professional', 'friendly', 'technical', 'creative'];
const CATEGORIES = ['freelance', 'crypto', 'gig', 'dropshipping', 'remote_job', 'bounty'];

export default function AutopilotsPage() {
  const navigate = useNavigate();
  const { data: rawAutopilots = [], isLoading: loading } = useAutopilots();
  const autopilots = rawAutopilots as Autopilot[];
  const updateAutopilotMutation = useUpdateAutopilot();
  const createAutopilotMutation = useCreateAutopilot();

  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userIdentity, setUserIdentity] = useState<UserIdentity | null>(null);

  // Consent gate state
  const [consentGateOpen, setConsentGateOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ autopilot: Autopilot; purpose: string } | null>(null);

  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [persona, setPersona] = useState('');
  const [tone, setTone] = useState('professional');
  const [skills, setSkills] = useState('');
  const [categories, setCategories] = useState<string[]>(['freelance']);
  const [workloadLimit, setWorkloadLimit] = useState(10);
  const [rules, setRules] = useState('Never accept below minimum rate, Always request milestones');

  // Load identity once
  useEffect(() => {
    getUserIdentity().then(({ data }) => { if (data) setUserIdentity(data); });
  }, []);

  const identityReady = userIdentity?.consent_given && userIdentity?.completeness_score && userIdentity.completeness_score >= 50;

  const active = autopilots.filter(a => ['active', 'running'].includes(a.status)).length;
  const totalEarned = autopilots.reduce((s, a) => s + (a.total_earned || a.totalEarned || 0), 0);

  const activateWithConsent = (ap: Autopilot) => {
    if (!identityReady) {
      setPendingAction({ autopilot: ap, purpose: `Activate ${ap.name} for automated opportunity applications` });
      setConsentGateOpen(true);
      return;
    }
    toggleStatus(ap);
  };

  const handleConsentApproved = async () => {
    setConsentGateOpen(false);
    const { data } = await getUserIdentity();
    setUserIdentity(data);
    if (pendingAction) {
      toggleStatus(pendingAction.autopilot);
      setPendingAction(null);
    }
  };

  const toggleStatus = (ap: Autopilot) => {
    const next = ['active', 'running'].includes(ap.status) ? 'idle' : 'active';
    updateAutopilotMutation.mutate(
      { id: ap.id, updates: { status: next } },
      { onSuccess: () => toast.success(`${ap.name} is now ${next}`) }
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    createAutopilotMutation.mutate(
      {
        name, avatar, persona,
        tone, status: 'idle',
        skills: skills.split(',').map(s => s.trim()).filter(Boolean),
        allowed_categories: categories,
        workload_limit: workloadLimit,
        behavior_rules: rules.split(',').map(r => r.trim()).filter(Boolean),
        total_earned: 0,
        tasks_completed: 0,
        current_workload: 0,
      },
      {
        onSuccess: () => {
          toast.success(`${name} deployed!`);
          setShowCreate(false);
          setName(''); setPersona(''); setSkills('');
          setSaving(false);
        },
        onError: () => { toast.error('Failed to create autopilot'); setSaving(false); },
      }
    );
  };

  return (
    <div className="space-y-6 slide-in-up">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Autopilots" value={`${autopilots.length}`} sub="deployed agents" icon={<Bot size={16} />} accent="violet" />
        <StatCard label="Active" value={`${active}`} sub="operating now" accent="green" />
        <StatCard label="Total Earned" value={formatCurrency(totalEarned)} sub="fleet earnings" accent="cyan" />
        <StatCard label="Total Tasks" value={`${autopilots.reduce((s, a) => s + (a.tasks_completed || a.tasksCompleted || 0), 0)}`} sub="completed" accent="orange" />
      </div>

      {/* Identity readiness banner */}
      {!identityReady && (
        <div className="glass-panel rounded-xl border border-[hsl(30_100%_55%/0.25)] p-4 flex items-center gap-4">
          <AlertTriangle size={18} className="text-[hsl(30,100%,60%)] flex-shrink-0" />
          <div className="flex-1">
            <div className="text-sm font-bold text-[hsl(30,100%,60%)]">Identity Setup Required</div>
            <div className="text-xs text-muted-foreground">
              {!userIdentity
                ? 'Set up your identity profile before activating Autopilots for real-world applications.'
                : !userIdentity.consent_given
                  ? 'Grant consent in Identity Studio before Autopilots can submit applications on your behalf.'
                  : 'Complete at least 50% of your identity profile to enable automated applications.'}
            </div>
          </div>
          <button
            onClick={() => navigate('/identity')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.08)] text-[hsl(30,100%,60%)] hover:bg-[hsl(30_100%_55%/0.15)] transition-colors flex-shrink-0"
          >
            Set Up Identity <ExternalLink size={11} />
          </button>
        </div>
      )}

      {identityReady && (
        <div className="glass-panel rounded-xl border border-[hsl(145_100%_50%/0.2)] p-3 flex items-center gap-3">
          <CheckCircle size={15} className="text-[hsl(145,100%,55%)]" />
          <div className="text-xs text-muted-foreground flex-1">
            <strong className="text-[hsl(145,100%,55%)]">Identity Ready.</strong> Profile {userIdentity?.completeness_score}% complete · Consent granted · Autopilots authorized for applications
          </div>
          <button onClick={() => navigate('/identity')} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
            Manage <ExternalLink size={9} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Autopilot Fleet</h2>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 transition-opacity">
          <Plus size={13} /> Deploy Autopilot
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-2 border-[hsl(265_80%_55%/0.3)] border-t-[hsl(265,80%,70%)] rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {autopilots.map(ap => {
            const isExpanded = expandedId === ap.id;
            return (
              <div key={ap.id} className={cn(
                'glass-panel rounded-xl border overflow-hidden transition-all',
                ['active', 'running'].includes(ap.status) ? 'border-[hsl(265_80%_55%/0.25)]' : 'border-[hsl(var(--border))]'
              )}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <span className="text-3xl float-anim flex-shrink-0">{ap.avatar || '🤖'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold">{ap.name}</span>
                          <StatusBadge status={ap.status} />
                        </div>
                        {ap.persona && <p className="text-xs text-muted-foreground line-clamp-1">{ap.persona}</p>}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                          <span className="text-[hsl(145,100%,55%)] font-semibold">{formatCurrency(ap.total_earned || ap.totalEarned || 0)} earned</span>
                          <span>{ap.tasks_completed ?? ap.tasksCompleted ?? 0} tasks</span>
                          <span>{ap.current_workload ?? ap.currentWorkload ?? 0}/{ap.workload_limit ?? ap.workloadLimit ?? 10} workload</span>
                        </div>
                        {/* Workload bar */}
                        <div className="mt-2 h-1 rounded-full bg-[hsl(228_25%_15%)] overflow-hidden w-48">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500"
                            style={{ width: `${((ap.current_workload ?? ap.currentWorkload ?? 0) / (ap.workload_limit ?? ap.workloadLimit ?? 10)) * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {/* Eligibility expand toggle */}
                      <button
                        onClick={() => setExpandedId(e => e === ap.id ? null : ap.id)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground hover:border-[hsl(185_100%_50%/0.3)] transition-colors"
                      >
                        <Shield size={11} />
                        {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      <button
                        onClick={() => activateWithConsent(ap)}
                        className="p-2 rounded-lg border border-[hsl(var(--border))] hover:border-[hsl(265_80%_55%/0.3)] transition-colors"
                      >
                        {['active', 'running'].includes(ap.status)
                          ? <Pause size={13} className="text-muted-foreground" />
                          : <Play size={13} className="text-[hsl(145,100%,55%)]" />}
                      </button>
                    </div>
                  </div>

                  {/* Skills */}
                  {(ap.skills || []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {(ap.skills || []).slice(0, 4).map(s => (
                        <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground">{s}</span>
                      ))}
                      {(ap.skills || []).length > 4 && <span className="text-[10px] text-muted-foreground">+{(ap.skills || []).length - 4}</span>}
                    </div>
                  )}
                </div>

                {/* Eligibility checker - expandable */}
                {isExpanded && (
                  <div className="border-t border-[hsl(var(--border))] p-4 bg-[hsl(228_35%_4%/0.5)]">
                    <EligibilityChecker
                      autopilotId={ap.id}
                      autopilotName={ap.name}
                      onEligible={() => {}}
                      onIneligible={() => {}}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Consent Gate */}
      {consentGateOpen && pendingAction && (
        <ConsentGate
          isOpen={consentGateOpen}
          onApprove={handleConsentApproved}
          onDeny={() => { setConsentGateOpen(false); setPendingAction(null); }}
          purpose={pendingAction.purpose}
          autopilotName={pendingAction.autopilot.name}
          fields={['full_name', 'email', 'headline', 'skills', 'location_country', 'portfolio_url']}
        />
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="glass-panel-bright rounded-2xl border border-[hsl(265_80%_55%/0.25)] p-6 w-full max-w-lg mx-4 slide-in-up max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-5 text-neon-violet" style={{ fontFamily: 'Orbitron' }}>DEPLOY AUTOPILOT</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Agent Name</label>
                  <input autoFocus className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="ARIA-7" value={name} onChange={e => setName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Avatar</label>
                  <div className="flex flex-wrap gap-1">
                    {AVATARS.map(av => (
                      <button key={av} onClick={() => setAvatar(av)} className={cn('text-lg p-1 rounded border', avatar === av ? 'border-[hsl(265_80%_55%/0.5)] bg-[hsl(265_80%_55%/0.1)]' : 'border-[hsl(var(--border))] hover:border-[hsl(265_80%_55%/0.3)]')}>{av}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Persona</label>
                <textarea className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors resize-none h-16" placeholder="Senior copywriter with 8 years in B2B SaaS..." value={persona} onChange={e => setPersona(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Tone</label>
                <div className="flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <button key={t} onClick={() => setTone(t)} className={cn('px-3 py-1 rounded-lg text-xs border capitalize', tone === t ? 'bg-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)] border-[hsl(265_80%_55%/0.3)]' : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))]')}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Skills (comma-separated)</label>
                <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="copywriting, SEO, blockchain..." value={skills} onChange={e => setSkills(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Allowed Categories</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(cat => {
                    const sel = categories.includes(cat);
                    return (
                      <button key={cat} onClick={() => setCategories(prev => sel ? prev.filter(c => c !== cat) : [...prev, cat])} className={cn('px-2.5 py-1 rounded-lg text-xs border capitalize', sel ? 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]' : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))]')}>{cat}</button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Workload Limit</label>
                <input type="number" className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" value={workloadLimit} onChange={e => setWorkloadLimit(Number(e.target.value))} min={1} max={50} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Behavior Rules (comma-separated)</label>
                <textarea className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors resize-none h-16" value={rules} onChange={e => setRules(e.target.value)} />
              </div>

              {/* Identity check note */}
              {!identityReady && (
                <div className="p-3 rounded-lg border border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.05)] text-xs text-muted-foreground flex items-start gap-2">
                  <AlertTriangle size={12} className="text-[hsl(30,100%,60%)] mt-0.5" />
                  <span>You can create this Autopilot now, but you'll need to complete your Identity profile before it can submit real applications.</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowCreate(false)} className="flex-1 py-2 rounded-lg text-sm font-semibold bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              <button onClick={handleCreate} disabled={saving || !name} className="flex-1 py-2 rounded-lg text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-60 transition-all flex items-center justify-center gap-2">
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Bot size={14} />}
                {saving ? 'Deploying...' : 'Deploy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
