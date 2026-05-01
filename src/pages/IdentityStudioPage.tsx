import React, { useState, useEffect, useCallback } from 'react';
import {
  Cpu, Save, Plus, Trash2, CheckCircle, Shield, Eye, EyeOff,
  Lock, Unlock, AlertTriangle, Clock, RefreshCw, User, Briefcase,
  Globe, Phone, MapPin, Star, FileText, Activity, Sparkles, Wand2,
  ChevronRight, Copy, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getUserIdentity, upsertUserIdentity, giveIdentityConsent, revokeIdentityConsent,
  getIdentityConsentLog, type UserIdentity
} from '@/lib/api';
import { useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS } from '@/hooks/useSharedData';
import AIFieldGenerator from '@/components/features/AIFieldGenerator';

const TONES = ['Professional', 'Friendly', 'Technical', 'Creative', 'Authoritative', 'Casual'];
const STYLES = ['Concise & Direct', 'Descriptive & Detailed', 'Formal Academic', 'Conversational', 'Technical Docs'];
const AVATARS = ['🤖', '🛸', '🧠', '⚡', '🔮', '🌌', '🚀', '💠', '🎯', '🔬'];
const SAMPLE_RULES = [
  'Never accept projects below minimum rate',
  'Always use milestone-based payment',
  'Respond to clients within 2 hours',
  'Include portfolio links in every proposal',
];

function timeAgo(iso: string) {
  if (!iso) return 'unknown';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  identity_updated:    { label: 'Profile Updated',     color: 'text-[hsl(185,100%,55%)]' },
  consent_given:       { label: 'Consent Granted',     color: 'text-[hsl(145,100%,55%)]' },
  consent_revoked:     { label: 'Consent Revoked',     color: 'text-[hsl(0,85%,65%)]' },
  eligibility_checked: { label: 'Eligibility Verified', color: 'text-[hsl(265,80%,70%)]' },
  data_used:           { label: 'Data Used in Action', color: 'text-[hsl(30,100%,60%)]' },
};

// Reusable labeled field with optional AI button
interface FieldRowProps {
  label: string;
  sensitive?: boolean;
  aiButton?: React.ReactNode;
  children: React.ReactNode;
  hint?: string;
}
function FieldRow({ label, sensitive, aiButton, children, hint }: FieldRowProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1.5">
        <label className="text-xs text-muted-foreground">{label}</label>
        {sensitive && (
          <span className="text-[10px] text-[hsl(30,100%,60%)] flex items-center gap-1">
            <AlertTriangle size={9} /> Sensitive
          </span>
        )}
        {hint && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-auto">
            <Info size={8} /> {hint}
          </span>
        )}
        {aiButton && <div className="ml-auto">{aiButton}</div>}
      </div>
      {children}
    </div>
  );
}

export default function IdentityStudioPage() {
  const [activeTab, setActiveTab] = useState<'real_identity' | 'ai_persona' | 'templates' | 'rules' | 'consent' | 'audit'>('real_identity');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  // Real identity (PII)
  const [identity, setIdentity] = useState<UserIdentity>({});
  const [showPhone, setShowPhone] = useState(false);
  const [consentLog, setConsentLog] = useState<Array<{
    id: string; action: string; purpose: string; fields_accessed: string[];
    platform?: string; created_at: string;
  }>>([]);
  const [revoking, setRevoking] = useState(false);
  const [skillsInput, setSkillsInput] = useState('');
  const [experienceHighlights, setExperienceHighlights] = useState('');

  // AI Persona (non-PII)
  const [persona, setPersona] = useState({
    name: 'ARIA-7',
    avatar: '🤖',
    bio: 'Senior copywriter with 8 years experience in B2B SaaS and tech content.',
    tone: 'Professional',
    style: 'Concise & Direct',
    coverLetterTemplate: `Dear [Client Name],\n\nI am writing to express my interest in your [Project Title] opportunity. With my expertise in [Skills], I am confident I can deliver exceptional results.\n\n[Personalized Value Proposition]\n\nBest regards,\n[Name]`,
    resumeTemplate: `[NAME] | [TITLE]\n[Email] | [Location]\n\nSUMMARY\n[Professional summary]\n\nSKILLS\n[Key skills list]\n\nEXPERIENCE\n[Work history]`,
  });
  const [rules, setRules] = useState<string[]>([...SAMPLE_RULES]);
  const [newRule, setNewRule] = useState('');

  // AI tone preview state
  const [tonePreviews, setTonePreviews] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await getUserIdentity();
      if (data) {
        setIdentity(data);
        setSkillsInput((data.skills || []).join(', '));
      }
      const { data: logData } = await getIdentityConsentLog();
      if (logData) setConsentLog(logData as typeof consentLog);
      setLoading(false);
    })();
  }, []);

  // Shared AI context derived from current identity state
  const aiContext = {
    full_name: identity.full_name,
    headline: identity.headline,
    bio: identity.bio,
    skills: identity.skills || skillsInput.split(',').map(s => s.trim()).filter(Boolean),
    years_experience: identity.years_experience,
    location_country: identity.location_country,
    tone: persona.tone,
    style: persona.style,
  };

  const saveRealIdentity = async () => {
    setSaving(true);
    const parsedSkills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
    const { data, error } = await upsertUserIdentity({
      ...identity,
      skills: parsedSkills,
    });
    if (error) {
      toast.error('Failed to save identity');
    } else {
      setIdentity(data || identity);
      // Invalidate shared React Query identity cache so widgets update
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.identity });
      toast.success('Identity profile saved securely');
    }
    setSaving(false);
  };

  const handleGrantConsent = async () => {
    setSaving(true);
    const { error } = await giveIdentityConsent(['applications', 'registration', 'communication']);
    if (!error) {
      setIdentity(prev => ({
        ...prev,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        approved_for_applications: true,
        approved_for_registration: true,
        approved_for_communication: true,
      }));
      toast.success('Consent granted — Autopilots authorized');
      const { data: logData } = await getIdentityConsentLog();
      if (logData) setConsentLog(logData as typeof consentLog);
    } else {
      toast.error('Failed to grant consent');
    }
    setSaving(false);
  };

  const handleRevokeConsent = async () => {
    setRevoking(true);
    const { error } = await revokeIdentityConsent();
    if (!error) {
      setIdentity(prev => ({
        ...prev,
        consent_given: false,
        approved_for_applications: false,
        approved_for_registration: false,
        approved_for_communication: false,
      }));
      toast.success('Consent revoked — all automated identity use suspended');
      const { data: logData } = await getIdentityConsentLog();
      if (logData) setConsentLog(logData as typeof consentLog);
    } else {
      toast.error('Failed to revoke consent');
    }
    setRevoking(false);
  };

  const addRule = () => {
    if (!newRule.trim()) return;
    setRules(r => [...r, newRule.trim()]);
    setNewRule('');
  };

  const completeness = identity.completeness_score ?? 0;

  return (
    <div className="space-y-6 slide-in-up">
      {/* Header */}
      <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.2)] p-5">
        <div className="flex items-center gap-5 flex-wrap">
          <div className="text-5xl float-anim">🛸</div>
          <div className="flex-1 min-w-0">
            <div className="text-lg font-black text-neon-violet mb-1" style={{ fontFamily: 'Orbitron' }}>IDENTITY STUDIO</div>
            <p className="text-xs text-muted-foreground">
              Manage your real identity (PII) for applications and your AI persona for communications.
              Use <span className="text-[hsl(265,80%,70%)] font-semibold">✦ AI</span> buttons to instantly generate professional content from your profile.
            </p>
          </div>

          {/* AI assist badge */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.08)] flex-shrink-0">
            <div className="w-2 h-2 rounded-full bg-[hsl(265,80%,70%)] animate-pulse" />
            <div>
              <div className="text-[10px] font-bold text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>AI ASSIST</div>
              <div className="text-[9px] text-muted-foreground">Gemini 3 Flash</div>
            </div>
          </div>

          {/* Completeness ring */}
          <div className="flex-shrink-0 text-center">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15" fill="none" className="stroke-[hsl(228_25%_12%)]" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15" fill="none"
                  stroke="url(#cGrad)" strokeWidth="3"
                  strokeDasharray={`${(completeness / 100) * 94.2} 94.2`}
                  strokeLinecap="round"
                />
                <defs>
                  <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(185,100%,55%)" />
                    <stop offset="100%" stopColor="hsl(265,80%,70%)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-sm font-black">{completeness}%</span>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Complete</div>
          </div>

          {/* Consent status */}
          <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-xl border flex-shrink-0',
            identity.consent_given
              ? 'border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)]'
              : 'border-[hsl(0_85%_60%/0.3)] bg-[hsl(0_85%_60%/0.06)]'
          )}>
            {identity.consent_given
              ? <CheckCircle size={14} className="text-[hsl(145,100%,55%)]" />
              : <AlertTriangle size={14} className="text-[hsl(0,85%,65%)]" />}
            <div>
              <div className="text-xs font-bold" style={{ fontFamily: 'Orbitron' }}>
                {identity.consent_given ? 'CONSENT ACTIVE' : 'NO CONSENT'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {identity.consent_given
                  ? `Since ${timeAgo(identity.consent_timestamp || '')}`
                  : 'Required for automation'}
              </div>
            </div>
          </div>
        </div>

        {/* Missing fields warning with AI prompt */}
        {(identity.missing_fields || []).length > 0 && completeness < 80 && (
          <div className="mt-4 p-3 rounded-lg border border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.04)] flex items-start gap-2">
            <AlertTriangle size={13} className="text-[hsl(30,100%,60%)] mt-0.5 flex-shrink-0" />
            <div className="flex-1 text-xs text-muted-foreground">
              <span className="text-[hsl(30,100%,60%)] font-semibold">Profile incomplete.</span> Missing:{' '}
              {(identity.missing_fields || []).map(f => f.replace(/_/g, ' ')).join(', ')}.
            </div>
            <button
              onClick={() => setActiveTab('real_identity')}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-[hsl(265_80%_55%/0.3)] bg-[hsl(265_80%_55%/0.1)] text-[hsl(265,80%,70%)] hover:bg-[hsl(265_80%_55%/0.2)] transition-colors flex-shrink-0"
            >
              <Sparkles size={9} /> Use AI →
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl border border-[hsl(var(--border))] bg-[hsl(228_25%_8%)] overflow-x-auto">
        {([
          { id: 'real_identity', label: 'Real Identity', icon: User },
          { id: 'consent',       label: 'Consent',       icon: Shield },
          { id: 'ai_persona',    label: 'AI Persona',    icon: Cpu },
          { id: 'templates',     label: 'Templates',     icon: FileText },
          { id: 'rules',         label: 'Rules',         icon: CheckCircle },
          { id: 'audit',         label: 'Audit Log',     icon: Activity },
        ] as const).map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)]'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              style={{ fontFamily: 'Orbitron' }}
            >
              <Icon size={11} />{tab.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-[hsl(265_80%_55%/0.3)] border-t-[hsl(265,80%,70%)] rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ─── REAL IDENTITY TAB ──────────────────────────────────────────── */}
          {activeTab === 'real_identity' && (
            <div className="space-y-5">
              <div className="p-3 rounded-xl border border-[hsl(265_80%_55%/0.2)] bg-[hsl(265_80%_55%/0.05)] flex items-start gap-3">
                <Lock size={14} className="text-[hsl(265,80%,70%)] mt-0.5 flex-shrink-0" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong className="text-[hsl(265,80%,70%)]">Secure & Voluntary.</strong> This information is stored encrypted and only accessed during approved actions.{' '}
                  Use <span className="text-[hsl(265,80%,70%)] font-semibold">✦ AI</span> buttons to generate professional content from your provided details.
                  AI only enhances — it never fabricates personal information.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Personal */}
                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
                    <User size={12} /> Personal Information
                  </h3>
                  <FieldRow label="Full Legal Name">
                    <input
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                      placeholder="Your real full name"
                      value={identity.full_name || ''}
                      onChange={e => setIdentity(i => ({ ...i, full_name: e.target.value }))}
                    />
                  </FieldRow>
                  <FieldRow label="Display Name (public)">
                    <input
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                      placeholder="Name shown on applications"
                      value={identity.display_name || ''}
                      onChange={e => setIdentity(i => ({ ...i, display_name: e.target.value }))}
                    />
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Nationality">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="e.g. American" value={identity.nationality || ''} onChange={e => setIdentity(i => ({ ...i, nationality: e.target.value }))} />
                    </FieldRow>
                    <FieldRow label="Timezone">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="e.g. UTC-5" value={identity.timezone || ''} onChange={e => setIdentity(i => ({ ...i, timezone: e.target.value }))} />
                    </FieldRow>
                  </div>
                </div>

                {/* Contact */}
                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
                    <Phone size={12} /> Contact Details
                  </h3>
                  <FieldRow label="Email Address">
                    <input
                      type="email"
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                      placeholder="your@email.com"
                      value={identity.email || ''}
                      onChange={e => setIdentity(i => ({ ...i, email: e.target.value }))}
                    />
                  </FieldRow>
                  <FieldRow label="Phone Number" sensitive>
                    <div className="relative">
                      <input
                        type={showPhone ? 'text' : 'password'}
                        className="w-full px-3 py-2.5 pr-10 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                        placeholder="+1 (555) 000-0000"
                        value={identity.phone || ''}
                        onChange={e => setIdentity(i => ({ ...i, phone: e.target.value }))}
                      />
                      <button onClick={() => setShowPhone(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPhone ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>
                  </FieldRow>
                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Country">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="United States" value={identity.location_country || ''} onChange={e => setIdentity(i => ({ ...i, location_country: e.target.value }))} />
                    </FieldRow>
                    <FieldRow label="City">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="New York" value={identity.location_city || ''} onChange={e => setIdentity(i => ({ ...i, location_city: e.target.value }))} />
                    </FieldRow>
                  </div>
                </div>

                {/* Professional — with AI buttons */}
                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
                    <Briefcase size={12} /> Professional Profile
                    <span className="ml-auto flex items-center gap-1 text-[10px] text-[hsl(265,80%,70%)] font-normal">
                      <Sparkles size={9} /> AI-enhanced
                    </span>
                  </h3>

                  {/* Headline with AI */}
                  <FieldRow
                    label="Professional Headline"
                    aiButton={
                      <AIFieldGenerator
                        fieldType="headline"
                        currentValue={identity.headline}
                        identityContext={aiContext}
                        onAccept={val => {
                          // If multiple headline options returned, take the first line
                          const first = val.split('\n').find(l => l.trim()) || val;
                          const clean = first.replace(/^\*+\s*/, '').replace(/^(Bold\/Confident|Professional|Friendly\/Approachable):\s*/i, '').trim();
                          setIdentity(i => ({ ...i, headline: clean }));
                        }}
                        compact
                      />
                    }
                  >
                    <input
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                      placeholder="Full-stack Developer | 8 yrs exp"
                      value={identity.headline || ''}
                      onChange={e => setIdentity(i => ({ ...i, headline: e.target.value }))}
                    />
                  </FieldRow>

                  {/* Bio with full AI generator */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-xs text-muted-foreground">Professional Bio</label>
                      <div className="ml-auto">
                        <AIFieldGenerator
                          fieldType="bio"
                          currentValue={identity.bio}
                          identityContext={aiContext}
                          onAccept={val => setIdentity(i => ({ ...i, bio: val }))}
                          compact
                        />
                      </div>
                    </div>
                    <textarea
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors resize-none h-24"
                      placeholder="Brief professional background..."
                      value={identity.bio || ''}
                      onChange={e => setIdentity(i => ({ ...i, bio: e.target.value }))}
                    />
                    {/* Expanded AI bio generator */}
                    <AIFieldGenerator
                      fieldType="bio"
                      currentValue={identity.bio}
                      identityContext={aiContext}
                      onAccept={val => setIdentity(i => ({ ...i, bio: val }))}
                      label="Full Professional Bio"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FieldRow label="Years Experience">
                      <input
                        type="number"
                        className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                        value={identity.years_experience ?? ''}
                        onChange={e => setIdentity(i => ({ ...i, years_experience: Number(e.target.value) }))}
                        min={0} max={50}
                      />
                    </FieldRow>
                    <FieldRow label="Min Hourly Rate (USD)">
                      <input
                        type="number"
                        className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                        placeholder="25"
                        value={identity.hourly_rate_min ?? ''}
                        onChange={e => setIdentity(i => ({ ...i, hourly_rate_min: Number(e.target.value) }))}
                      />
                    </FieldRow>
                  </div>

                  {/* Skills with AI */}
                  <div>
                    <div className="flex items-center gap-2 mb-1.5">
                      <label className="text-xs text-muted-foreground">Skills (comma-separated)</label>
                      <div className="ml-auto">
                        <AIFieldGenerator
                          fieldType="skills"
                          currentValue={skillsInput}
                          identityContext={aiContext}
                          onAccept={val => {
                            // Clean up the AI output (remove bullets, numbering)
                            const cleaned = val.replace(/^[-•*\d.)\s]+/gm, '').replace(/\n/g, ', ').replace(/,\s*,/g, ',').trim();
                            setSkillsInput(cleaned);
                            const parsed = cleaned.split(',').map(s => s.trim()).filter(Boolean);
                            setIdentity(i => ({ ...i, skills: parsed }));
                          }}
                          compact
                        />
                      </div>
                    </div>
                    <input
                      className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                      placeholder="React, TypeScript, copywriting, SEO..."
                      value={skillsInput}
                      onChange={e => setSkillsInput(e.target.value)}
                    />
                    {/* Show parsed skills as tags */}
                    {skillsInput && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {skillsInput.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10).map(skill => (
                          <span key={skill} className="text-[10px] px-2 py-0.5 rounded bg-[hsl(185_100%_50%/0.08)] border border-[hsl(185_100%_50%/0.2)] text-[hsl(185,100%,55%)]">
                            {skill}
                          </span>
                        ))}
                        {skillsInput.split(',').filter(s => s.trim()).length > 10 && (
                          <span className="text-[10px] text-muted-foreground">+{skillsInput.split(',').filter(s => s.trim()).length - 10}</span>
                        )}
                      </div>
                    )}
                    {/* Full skills AI expander */}
                    <div className="mt-2">
                      <AIFieldGenerator
                        fieldType="skills"
                        currentValue={skillsInput}
                        identityContext={aiContext}
                        onAccept={val => {
                          const cleaned = val.replace(/^[-•*\d.)\s]+/gm, '').replace(/\n/g, ', ').replace(/,\s*,/g, ',').trim();
                          setSkillsInput(cleaned);
                          setIdentity(i => ({ ...i, skills: cleaned.split(',').map(s => s.trim()).filter(Boolean) }));
                        }}
                        label="Generate Full Skills List"
                      />
                    </div>
                  </div>
                </div>

                {/* Links + Experience Highlights */}
                <div className="space-y-5">
                  {/* Online Presence */}
                  <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
                      <Globe size={12} /> Online Presence
                    </h3>
                    <FieldRow label="Portfolio URL">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="https://yourportfolio.com" value={identity.portfolio_url || ''} onChange={e => setIdentity(i => ({ ...i, portfolio_url: e.target.value, has_portfolio: !!e.target.value }))} />
                    </FieldRow>
                    <FieldRow label="LinkedIn">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="https://linkedin.com/in/..." value={identity.linkedin_url || ''} onChange={e => setIdentity(i => ({ ...i, linkedin_url: e.target.value }))} />
                    </FieldRow>
                    <FieldRow label="GitHub">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="https://github.com/..." value={identity.github_url || ''} onChange={e => setIdentity(i => ({ ...i, github_url: e.target.value }))} />
                    </FieldRow>
                    <FieldRow label="Languages (comma-separated)">
                      <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" placeholder="English, Spanish..." value={(identity.languages || []).join(', ')} onChange={e => setIdentity(i => ({ ...i, languages: e.target.value.split(',').map(l => l.trim()).filter(Boolean) }))} />
                    </FieldRow>
                  </div>

                  {/* Experience Highlights — AI-only section */}
                  <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.15)] p-5 space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
                      <Star size={12} className="text-[hsl(265,80%,70%)]" />
                      <span className="text-[hsl(265,80%,70%)]">Experience Highlights</span>
                      <span className="text-[10px] font-normal text-[hsl(265,80%,70%)] ml-1 flex items-center gap-1">
                        <Sparkles size={8} /> AI-Powered
                      </span>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      AI generates professional resume bullet points from your headline, bio, and skills. Add context keywords below to improve output.
                    </p>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Context / Keywords (optional)</label>
                      <input
                        className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors"
                        placeholder="e.g. built SaaS platform, led team of 5, 300% growth..."
                        value={experienceHighlights}
                        onChange={e => setExperienceHighlights(e.target.value)}
                      />
                    </div>
                    <AIFieldGenerator
                      fieldType="experience_highlights"
                      currentValue={experienceHighlights}
                      identityContext={{ ...aiContext }}
                      onAccept={val => {
                        setExperienceHighlights(val);
                        toast.success('Experience highlights ready — copy them to your resume template');
                      }}
                      label="Generate Experience Bullets"
                    />
                    {experienceHighlights && experienceHighlights.includes('•') || experienceHighlights.includes('-') ? (
                      <div className="p-3 rounded-lg bg-[hsl(228_35%_5%)] border border-[hsl(265_80%_55%/0.15)] font-mono text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
                        {experienceHighlights}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Resume Summary AI — full width */}
              <div className="glass-panel rounded-xl border border-[hsl(185_100%_50%/0.15)] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Wand2 size={14} className="text-[hsl(185,100%,55%)]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Resume Summary</h3>
                  <span className="text-[10px] text-[hsl(185,100%,55%)] ml-2">Used in all application workflows</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  A polished 2-3 sentence summary for resumes and cover letters. AI builds it from your profile.
                </p>
                <AIFieldGenerator
                  fieldType="resume_summary"
                  currentValue={identity.bio}
                  identityContext={aiContext}
                  onAccept={val => {
                    setIdentity(i => ({ ...i, bio: val }));
                    toast.success('Resume summary saved to Professional Bio');
                  }}
                  label="Generate Resume Summary"
                />
              </div>

              <button
                onClick={saveRealIdentity}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 disabled:opacity-60 transition-all"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save Identity Profile'}
              </button>
            </div>
          )}

          {/* ─── CONSENT TAB ────────────────────────────────────────────────── */}
          {activeTab === 'consent' && (
            <div className="space-y-5">
              <div className={cn(
                'glass-panel rounded-xl border p-6',
                identity.consent_given ? 'border-[hsl(145_100%_50%/0.3)]' : 'border-[hsl(0_85%_60%/0.3)]'
              )}>
                <div className="flex items-center gap-4 mb-4">
                  <div className={cn(
                    'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0',
                    identity.consent_given ? 'bg-[hsl(145_100%_50%/0.15)]' : 'bg-[hsl(0_85%_60%/0.1)]'
                  )}>
                    {identity.consent_given
                      ? <CheckCircle size={28} className="text-[hsl(145,100%,55%)]" />
                      : <AlertTriangle size={28} className="text-[hsl(0,85%,65%)]" />}
                  </div>
                  <div>
                    <div className="text-lg font-black" style={{ fontFamily: 'Orbitron' }}>
                      {identity.consent_given ? 'CONSENT GRANTED' : 'CONSENT NOT GRANTED'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {identity.consent_given
                        ? `Your identity data is authorized for Autopilot use${identity.consent_timestamp ? ' since ' + timeAgo(identity.consent_timestamp) : ''}.`
                        : 'Your identity data is locked — Autopilots cannot use it until you grant consent.'}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { key: 'approved_for_applications', label: 'Applications', desc: 'Job & gig applications' },
                    { key: 'approved_for_registration', label: 'Registration', desc: 'Platform account creation' },
                    { key: 'approved_for_communication', label: 'Communication', desc: 'Client messages & comms' },
                  ].map(({ key, label, desc }) => {
                    const approved = identity[key as keyof UserIdentity] as boolean;
                    return (
                      <div key={key} className={cn('p-3 rounded-xl border text-center', approved ? 'border-[hsl(145_100%_50%/0.25)] bg-[hsl(145_100%_50%/0.06)]' : 'border-[hsl(var(--border))]')}>
                        <div className="mb-1">{approved ? '✅' : '🔒'}</div>
                        <div className="text-xs font-bold">{label}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{desc}</div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex gap-3">
                  {!identity.consent_given ? (
                    <button onClick={handleGrantConsent} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90 disabled:opacity-60 transition-all">
                      {saving ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={14} />}
                      Grant Consent for All Uses
                    </button>
                  ) : (
                    <button onClick={handleRevokeConsent} disabled={revoking} className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold border border-[hsl(0_85%_60%/0.3)] bg-[hsl(0_85%_60%/0.08)] text-[hsl(0,85%,65%)] hover:bg-[hsl(0_85%_60%/0.15)] disabled:opacity-60 transition-all">
                      {revoking ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                      Revoke All Consent
                    </button>
                  )}
                </div>
              </div>

              <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
                <h3 className="text-sm font-bold mb-3 flex items-center gap-2" style={{ fontFamily: 'Orbitron' }}>
                  <Shield size={14} className="text-[hsl(185,100%,55%)]" /> Legal Compliance Framework
                </h3>
                <div className="space-y-2 text-xs text-muted-foreground">
                  {[
                    'Identity data is collected voluntarily and stored with AES-256 encryption',
                    'Access to your PII requires your explicit, logged consent for each purpose',
                    'Autopilots only access your real identity during approved, user-initiated actions',
                    'All identity access events are permanently logged and cannot be deleted',
                    'You can revoke consent at any time, which immediately suspends all automated identity use',
                    'VELO 2.0 never fabricates, modifies, or misrepresents your identity information',
                    'AI generation only enhances user-provided data — it never invents credentials or facts',
                    'Platform terms compliance is verified before any automated submission',
                  ].map((rule, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle size={11} className="text-[hsl(145,100%,55%)] mt-0.5 flex-shrink-0" />
                      <span>{rule}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── AI PERSONA TAB ─────────────────────────────────────────────── */}
          {activeTab === 'ai_persona' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>AI Agent Identity</h3>
                  <FieldRow label="Agent Name">
                    <input className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors" value={persona.name} onChange={e => setPersona(p => ({ ...p, name: e.target.value }))} />
                  </FieldRow>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Avatar</label>
                    <div className="flex gap-2 flex-wrap">
                      {AVATARS.map(av => (
                        <button key={av} onClick={() => setPersona(p => ({ ...p, avatar: av }))} className={cn('text-xl p-2 rounded-lg border transition-colors', persona.avatar === av ? 'border-[hsl(265_80%_55%/0.5)] bg-[hsl(265_80%_55%/0.1)]' : 'border-[hsl(var(--border))] hover:border-[hsl(265_80%_55%/0.3)]')}>{av}</button>
                      ))}
                    </div>
                  </div>
                  <FieldRow label="Persona Description"
                    aiButton={
                      <AIFieldGenerator
                        fieldType="bio"
                        currentValue={persona.bio}
                        identityContext={aiContext}
                        onAccept={val => setPersona(p => ({ ...p, bio: val }))}
                        compact
                      />
                    }
                  >
                    <textarea className="w-full px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(265_80%_55%/0.5)] transition-colors resize-none h-24" value={persona.bio} onChange={e => setPersona(p => ({ ...p, bio: e.target.value }))} />
                  </FieldRow>
                </div>

                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Communication Style</h3>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Tone</label>
                    <div className="flex flex-wrap gap-2">
                      {TONES.map(t => (
                        <button key={t} onClick={() => setPersona(p => ({ ...p, tone: t }))} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', persona.tone === t ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]' : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))] hover:text-foreground')}>{t}</button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Writing Style</label>
                    <div className="flex flex-wrap gap-2">
                      {STYLES.map(s => (
                        <button key={s} onClick={() => setPersona(p => ({ ...p, style: s }))} className={cn('px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors', persona.style === s ? 'bg-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)] border-[hsl(265_80%_55%/0.3)]' : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))] hover:text-foreground')}>{s}</button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tone Preview AI generator */}
              <div className="glass-panel rounded-xl border border-[hsl(265_80%_55%/0.15)] p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-[hsl(265,80%,70%)]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[hsl(265,80%,70%)]" style={{ fontFamily: 'Orbitron' }}>Tone Previews</h3>
                  <span className="text-[10px] text-muted-foreground ml-1">See how your voice sounds in different tones</span>
                </div>
                <AIFieldGenerator
                  fieldType="tone_suggestions"
                  currentValue={tonePreviews}
                  identityContext={aiContext}
                  onAccept={val => setTonePreviews(val)}
                  label="Generate Tone Previews"
                />
                {tonePreviews && (
                  <div className="p-4 rounded-xl bg-[hsl(228_35%_5%)] border border-[hsl(265_80%_55%/0.15)] text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed font-mono">
                    {tonePreviews}
                  </div>
                )}
              </div>

              <button onClick={() => toast.success('AI Persona saved')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 transition-all">
                <Save size={14} /> Save AI Persona
              </button>
            </div>
          )}

          {/* ─── TEMPLATES TAB ─────────────────────────────────────────────── */}
          {activeTab === 'templates' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Cover Letter Template</h3>
                  </div>
                  <div className="text-[10px] text-muted-foreground">Use: [Name] [Title] [Skills] [Platform] [Rate] — AI fills from your real identity</div>
                  {/* AI generator for cover letter */}
                  <AIFieldGenerator
                    fieldType="cover_letter_template"
                    currentValue={persona.coverLetterTemplate}
                    identityContext={aiContext}
                    onAccept={val => setPersona(p => ({ ...p, coverLetterTemplate: val }))}
                    label="Regenerate with AI"
                  />
                  <textarea
                    className="w-full px-3 py-3 rounded-lg bg-[hsl(228_35%_5%)] border border-[hsl(var(--border))] text-xs font-mono focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors resize-none h-52 leading-relaxed"
                    value={persona.coverLetterTemplate}
                    onChange={e => setPersona(p => ({ ...p, coverLetterTemplate: e.target.value }))}
                  />
                </div>
                <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>Resume Template</h3>
                  <div className="text-[10px] text-muted-foreground">AI populates this from your real identity profile</div>
                  <AIFieldGenerator
                    fieldType="resume_summary"
                    currentValue={persona.resumeTemplate}
                    identityContext={aiContext}
                    onAccept={val => setPersona(p => ({ ...p, resumeTemplate: val }))}
                    label="Generate Resume Summary Section"
                  />
                  <textarea
                    className="w-full px-3 py-3 rounded-lg bg-[hsl(228_35%_5%)] border border-[hsl(var(--border))] text-xs font-mono focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors resize-none h-52 leading-relaxed"
                    value={persona.resumeTemplate}
                    onChange={e => setPersona(p => ({ ...p, resumeTemplate: e.target.value }))}
                  />
                </div>
              </div>
              <button onClick={() => toast.success('Templates saved')} className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold bg-gradient-to-r from-violet-500 to-cyan-500 text-black hover:opacity-90 transition-all">
                <Save size={14} /> Save Templates
              </button>
            </div>
          )}

          {/* ─── RULES TAB ────────────────────────────────────────────────── */}
          {activeTab === 'rules' && (
            <div className="glass-panel rounded-xl border border-[hsl(var(--border))] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4" style={{ fontFamily: 'Orbitron' }}>Behavior Rules</h3>
              <div className="space-y-2 mb-4">
                {rules.map((rule, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))]">
                    <CheckCircle size={14} className="text-[hsl(145,100%,55%)] flex-shrink-0" />
                    <span className="text-sm flex-1">{rule}</span>
                    <button onClick={() => setRules(r => r.filter((_, j) => j !== i))} className="p-1 rounded hover:bg-[hsl(0_85%_60%/0.1)] transition-colors">
                      <Trash2 size={13} className="text-muted-foreground hover:text-[hsl(0,85%,65%)]" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input className="flex-1 px-3 py-2.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-sm focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors" placeholder="Add a new behavior rule..." value={newRule} onChange={e => setNewRule(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRule()} />
                <button onClick={addRule} className="px-4 py-2 rounded-lg bg-[hsl(185_100%_50%/0.1)] border border-[hsl(185_100%_50%/0.25)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.2)] transition-colors">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}

          {/* ─── AUDIT LOG TAB ────────────────────────────────────────────── */}
          {activeTab === 'audit' && (
            <div className="glass-panel rounded-xl border border-[hsl(var(--border))] overflow-hidden">
              <div className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between">
                <div className="text-xs font-bold uppercase tracking-wider" style={{ fontFamily: 'Orbitron' }}>Identity Access Audit Log</div>
                <span className="text-[10px] text-muted-foreground">{consentLog.length} entries · Immutable</span>
              </div>
              {consentLog.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <Activity size={32} className="mb-3 opacity-30" />
                  <div className="text-sm">No access events yet</div>
                  <div className="text-xs mt-1 opacity-60">All identity use will appear here</div>
                </div>
              ) : (
                <div className="divide-y divide-[hsl(var(--border))]">
                  {consentLog.map(entry => {
                    const meta = ACTION_LABELS[entry.action] ?? { label: entry.action, color: 'text-muted-foreground' };
                    return (
                      <div key={entry.id} className="flex items-start gap-4 p-4 hover:bg-[hsl(228_25%_10%/0.4)] transition-colors">
                        <div className="w-8 h-8 rounded-full bg-[hsl(228_25%_12%)] flex items-center justify-center flex-shrink-0">
                          <Shield size={13} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className={cn('text-xs font-bold', meta.color)}>{meta.label}</span>
                            {entry.platform && <span className="text-[10px] text-muted-foreground">· {entry.platform}</span>}
                          </div>
                          <div className="text-xs text-muted-foreground">{entry.purpose}</div>
                          {entry.fields_accessed.length > 0 && (
                            <div className="flex gap-1 flex-wrap mt-1">
                              {entry.fields_accessed.slice(0, 5).map(f => (
                                <span key={f} className="text-[10px] px-1.5 py-0.5 rounded bg-[hsl(228_25%_12%)] border border-[hsl(var(--border))] text-muted-foreground">{f}</span>
                              ))}
                              {entry.fields_accessed.length > 5 && <span className="text-[10px] text-muted-foreground">+{entry.fields_accessed.length - 5}</span>}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock size={9} /> {timeAgo(entry.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
