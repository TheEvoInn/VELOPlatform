import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, AlertTriangle, ChevronRight, RefreshCw, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserIdentity, type UserIdentity } from '@/lib/api';
import { useNavigate } from 'react-router-dom';

interface FieldCheck {
  key: keyof UserIdentity;
  label: string;
  required: boolean;
  points: number;
}

const FIELD_CHECKS: FieldCheck[] = [
  { key: 'full_name',        label: 'Full Name',            required: true,  points: 15 },
  { key: 'email',            label: 'Email Address',        required: true,  points: 15 },
  { key: 'headline',         label: 'Professional Headline',required: true,  points: 10 },
  { key: 'bio',              label: 'Professional Bio',     required: true,  points: 10 },
  { key: 'skills',           label: 'Skills Listed',        required: true,  points: 15 },
  { key: 'consent_given',    label: 'Consent Granted',      required: true,  points: 10 },
  { key: 'location_country', label: 'Country',              required: false, points: 5  },
  { key: 'phone',            label: 'Phone Number',         required: false, points: 5  },
  { key: 'portfolio_url',    label: 'Portfolio URL',        required: false, points: 5  },
  { key: 'linkedin_url',     label: 'LinkedIn Profile',     required: false, points: 5  },
  { key: 'has_portfolio',    label: 'Portfolio Attached',   required: false, points: 5  },
];

function fieldPresent(identity: UserIdentity, key: keyof UserIdentity): boolean {
  const val = identity[key];
  if (val === null || val === undefined || val === false) return false;
  if (typeof val === 'string') return val.trim().length > 0;
  if (Array.isArray(val)) return val.length > 0;
  return true;
}

interface Props {
  compact?: boolean;
  onComplete?: () => void;
}

export default function IdentityCompletenessWidget({ compact = false, onComplete }: Props) {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState<UserIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(!compact);

  const load = async () => {
    setLoading(true);
    const { data } = await getUserIdentity();
    setIdentity(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const score = identity?.completeness_score ?? 0;
  const consentGiven = identity?.consent_given ?? false;
  const missingRequired = FIELD_CHECKS.filter(f => f.required && identity && !fieldPresent(identity, f.key));
  const missingOptional = FIELD_CHECKS.filter(f => !f.required && identity && !fieldPresent(identity, f.key));
  const isReady = score >= 50 && consentGiven;

  const circumference = 2 * Math.PI * 20;
  const dashOffset = circumference - (score / 100) * circumference;

  if (loading) {
    return (
      <div className={cn('glass-panel rounded-xl border border-[hsl(var(--border))] flex items-center justify-center', compact ? 'p-3 h-20' : 'p-5 h-28')}>
        <RefreshCw size={14} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compact) {
    return (
      <div
        className={cn(
          'glass-panel rounded-xl border p-4 cursor-pointer hover:border-[hsl(185_100%_50%/0.25)] transition-all group',
          isReady ? 'border-[hsl(145_100%_50%/0.2)]' : 'border-[hsl(30_100%_55%/0.2)]'
        )}
        onClick={() => navigate('/identity')}
      >
        <div className="flex items-center gap-3">
          {/* Mini ring */}
          <div className="relative w-10 h-10 flex-shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
              <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(228 25% 15%)" strokeWidth="4" />
              <circle
                cx="24" cy="24" r="20" fill="none"
                stroke={isReady ? 'hsl(145,100%,55%)' : score >= 30 ? 'hsl(30,100%,60%)' : 'hsl(0,85%,65%)'}
                strokeWidth="4"
                strokeDasharray={`${circumference}`}
                strokeDashoffset={`${dashOffset}`}
                strokeLinecap="round"
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-black">{score}%</span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold" style={{ fontFamily: 'Orbitron' }}>
              {isReady ? 'Identity Ready' : 'Identity Incomplete'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isReady
                ? 'Autopilots authorized for applications'
                : missingRequired.length > 0
                  ? `${missingRequired.length} required field${missingRequired.length > 1 ? 's' : ''} missing`
                  : 'Grant consent to unlock Autopilots'}
            </div>
          </div>

          <ChevronRight size={13} className="text-muted-foreground group-hover:text-[hsl(185,100%,55%)] transition-colors flex-shrink-0" />
        </div>

        {/* Top missing fields */}
        {!isReady && missingRequired.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {missingRequired.slice(0, 3).map(f => (
              <span key={String(f.key)} className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(30_100%_55%/0.1)] border border-[hsl(30_100%_55%/0.2)] text-[hsl(30,100%,60%)]">
                {f.label}
              </span>
            ))}
            {missingRequired.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{missingRequired.length - 3} more</span>
            )}
          </div>
        )}
      </div>
    );
  }

  // Full widget
  return (
    <div className={cn(
      'glass-panel rounded-xl border overflow-hidden',
      isReady ? 'border-[hsl(145_100%_50%/0.2)]' : 'border-[hsl(30_100%_55%/0.2)]'
    )}>
      {/* Header */}
      <div className="p-5 flex items-center gap-4">
        {/* Score ring */}
        <div className="relative w-16 h-16 flex-shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 48 48">
            <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(228 25% 12%)" strokeWidth="4" />
            <circle
              cx="24" cy="24" r="20" fill="none"
              stroke="url(#idGrad)"
              strokeWidth="4"
              strokeDasharray={`${circumference}`}
              strokeDashoffset={`${dashOffset}`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
            <defs>
              <linearGradient id="idGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={isReady ? 'hsl(145,100%,55%)' : 'hsl(30,100%,60%)'} />
                <stop offset="100%" stopColor={isReady ? 'hsl(185,100%,55%)' : 'hsl(0,85%,65%)'} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-sm font-black">{score}%</span>
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold" style={{ fontFamily: 'Orbitron' }}>Identity Readiness</span>
            {isReady
              ? <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(145_100%_50%/0.15)] border border-[hsl(145_100%_50%/0.3)] text-[hsl(145,100%,55%)] font-bold">READY</span>
              : <span className="text-[10px] px-2 py-0.5 rounded bg-[hsl(30_100%_55%/0.1)] border border-[hsl(30_100%_55%/0.25)] text-[hsl(30,100%,60%)] font-bold">INCOMPLETE</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            {isReady
              ? 'Your identity profile is authorized for Autopilot use'
              : `Complete ${missingRequired.length} required fields to unlock automated applications`}
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded border flex items-center gap-1',
              consentGiven ? 'bg-[hsl(145_100%_50%/0.1)] border-[hsl(145_100%_50%/0.25)] text-[hsl(145,100%,55%)]' : 'bg-[hsl(0_85%_60%/0.1)] border-[hsl(0_85%_60%/0.25)] text-[hsl(0,85%,65%)]'
            )}>
              {consentGiven ? <CheckCircle size={9} /> : <Lock size={9} />}
              {consentGiven ? 'Consent Active' : 'No Consent'}
            </span>
            <span className={cn(
              'text-[10px] px-2 py-0.5 rounded border flex items-center gap-1',
              score >= 50 ? 'bg-[hsl(145_100%_50%/0.1)] border-[hsl(145_100%_50%/0.25)] text-[hsl(145,100%,55%)]' : 'bg-[hsl(30_100%_55%/0.1)] border-[hsl(30_100%_55%/0.25)] text-[hsl(30,100%,60%)]'
            )}>
              {score >= 50 ? <CheckCircle size={9} /> : <AlertTriangle size={9} />}
              {score >= 50 ? `${score}% Profile` : `${score}% — Need 50%+`}
            </span>
          </div>
        </div>

        <button onClick={() => setExpanded(e => !e)} className="p-2 rounded-lg hover:bg-[hsl(228_25%_12%)] transition-colors flex-shrink-0">
          <ChevronRight size={14} className={cn('text-muted-foreground transition-transform', expanded ? 'rotate-90' : '')} />
        </button>
      </div>

      {/* Field checklist */}
      {expanded && (
        <div className="border-t border-[hsl(var(--border))] divide-y divide-[hsl(var(--border))]">
          {/* Required fields */}
          <div className="px-5 py-3">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Required Fields</div>
            <div className="space-y-1.5">
              {FIELD_CHECKS.filter(f => f.required).map(f => {
                const present = identity ? fieldPresent(identity, f.key) : false;
                return (
                  <div key={String(f.key)} className="flex items-center gap-2 text-xs">
                    {present
                      ? <CheckCircle size={11} className="text-[hsl(145,100%,55%)] flex-shrink-0" />
                      : <AlertTriangle size={11} className="text-[hsl(30,100%,60%)] flex-shrink-0" />}
                    <span className={present ? 'text-muted-foreground' : 'text-foreground font-medium'}>{f.label}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">+{f.points}pts</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Optional fields */}
          {missingOptional.length < FIELD_CHECKS.filter(f => !f.required).length && (
            <div className="px-5 py-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Optional Boosts</div>
              <div className="space-y-1.5">
                {FIELD_CHECKS.filter(f => !f.required).map(f => {
                  const present = identity ? fieldPresent(identity, f.key) : false;
                  return (
                    <div key={String(f.key)} className="flex items-center gap-2 text-xs">
                      {present
                        ? <CheckCircle size={11} className="text-[hsl(185,100%,55%)] flex-shrink-0" />
                        : <div className="w-[11px] h-[11px] rounded-full border border-[hsl(var(--border))] flex-shrink-0" />}
                      <span className={cn('text-muted-foreground', !present && 'opacity-60')}>{f.label}</span>
                      <span className="ml-auto text-[10px] text-muted-foreground">+{f.points}pts</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTA */}
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={() => navigate('/identity')}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all',
                isReady
                  ? 'border border-[hsl(145_100%_50%/0.3)] bg-[hsl(145_100%_50%/0.08)] text-[hsl(145,100%,55%)] hover:bg-[hsl(145_100%_50%/0.15)]'
                  : 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90'
              )}
            >
              <Shield size={12} />
              {isReady ? 'Manage Identity' : 'Complete Profile'}
              <ChevronRight size={11} />
            </button>
            {!consentGiven && (
              <div className="text-[11px] text-[hsl(30,100%,60%)] flex items-center gap-1">
                <Lock size={10} /> Grant consent in Identity Studio to unlock Autopilots
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
