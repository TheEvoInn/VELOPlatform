import React, { useState, useCallback } from 'react';
import { Shield, CheckCircle, XCircle, AlertTriangle, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { runEligibilityCheck } from '@/lib/api';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface EligibilityCheck {
  check: string;
  passed: boolean;
  message: string;
}

interface EligibilityResult {
  is_eligible: boolean;
  checks: EligibilityCheck[];
  missing_requirements: string[];
  requires_approval: boolean;
  eligibility_id?: string;
}

interface EligibilityCheckerProps {
  autopilotId: string;
  autopilotName: string;
  opportunityId?: string;
  opportunityTitle?: string;
  onEligible?: (result: EligibilityResult) => void;
  onIneligible?: (result: EligibilityResult) => void;
  compact?: boolean;
}

const CHECK_LABELS: Record<string, string> = {
  identity_exists:           'Identity Profile',
  consent_given:             'User Consent',
  approved_for_applications: 'Application Approval',
  field_full_name:           'Full Name',
  field_email:               'Email Address',
  field_headline:            'Professional Headline',
  field_skills:              'Skills Listed',
  completeness_threshold:    'Profile Completeness',
  autopilot_active:          'Autopilot Operational',
  workload_capacity:         'Workload Capacity',
};

const MISSING_ACTIONS: Record<string, { label: string; route: string }> = {
  identity_profile:     { label: 'Set up Identity', route: '/identity' },
  user_consent:         { label: 'Grant Consent',   route: '/identity' },
  application_approval: { label: 'Approve Access',  route: '/identity' },
  full_name:            { label: 'Add Full Name',   route: '/identity' },
  email:                { label: 'Add Email',       route: '/identity' },
  headline:             { label: 'Add Headline',    route: '/identity' },
  skills:               { label: 'Add Skills',      route: '/identity' },
  profile_completeness: { label: 'Complete Profile', route: '/identity' },
  autopilot_status:     { label: 'Fix Autopilot',   route: '/autopilots' },
  workload_capacity:    { label: 'Adjust Workload', route: '/autopilots' },
};

export default function EligibilityChecker({
  autopilotId,
  autopilotName,
  opportunityId,
  opportunityTitle,
  onEligible,
  onIneligible,
  compact = false,
}: EligibilityCheckerProps) {
  const navigate = useNavigate();
  const [result, setResult] = useState<EligibilityResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const runCheck = useCallback(async () => {
    setLoading(true);
    setResult(null);
    const { data, error } = await runEligibilityCheck(autopilotId, opportunityId);
    if (error) {
      toast.error(`Eligibility check failed: ${error}`);
      setLoading(false);
      return;
    }
    if (data) {
      setResult(data);
      setExpanded(true);
      if (data.is_eligible) {
        toast.success(`${autopilotName} is eligible — ready to proceed`);
        onEligible?.(data);
      } else {
        toast.warning(`${autopilotName} has ${data.missing_requirements.length} unmet requirements`);
        onIneligible?.(data);
      }
    }
    setLoading(false);
  }, [autopilotId, opportunityId, autopilotName, onEligible, onIneligible]);

  const passed = result?.checks.filter(c => c.passed).length ?? 0;
  const total = result?.checks.length ?? 0;

  return (
    <div className={cn('rounded-xl border overflow-hidden', compact ? '' : 'glass-panel',
      result
        ? result.is_eligible
          ? 'border-[hsl(145_100%_50%/0.25)]'
          : 'border-[hsl(30_100%_55%/0.25)]'
        : 'border-[hsl(var(--border))]'
    )}>
      {/* Header */}
      <div className={cn('flex items-center gap-3 p-4', compact ? '' : '')}>
        <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
          result
            ? result.is_eligible ? 'bg-[hsl(145_100%_50%/0.15)]' : 'bg-[hsl(30_100%_55%/0.15)]'
            : 'bg-[hsl(228_25%_12%)]'
        )}>
          {result ? (
            result.is_eligible
              ? <CheckCircle size={16} className="text-[hsl(145,100%,55%)]" />
              : <AlertTriangle size={16} className="text-[hsl(30,100%,60%)]" />
          ) : (
            <Shield size={16} className="text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground" style={{ fontFamily: 'Orbitron' }}>
            Pre-Flight Eligibility Check
          </div>
          {result ? (
            <div className={cn('text-sm font-semibold mt-0.5',
              result.is_eligible ? 'text-[hsl(145,100%,55%)]' : 'text-[hsl(30,100%,60%)]'
            )}>
              {result.is_eligible ? `✓ Eligible — ${passed}/${total} checks passed` : `⚠ ${result.missing_requirements.length} requirements not met`}
            </div>
          ) : (
            <div className="text-xs text-muted-foreground mt-0.5">
              {opportunityTitle ? `For: ${opportunityTitle}` : `Verify ${autopilotName}`}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {result && (
            <button onClick={() => setExpanded(e => !e)} className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_12%)] transition-colors">
              {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
            </button>
          )}
          <button
            onClick={runCheck}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all',
              result?.is_eligible
                ? 'bg-[hsl(145_100%_50%/0.15)] border border-[hsl(145_100%_50%/0.3)] text-[hsl(145,100%,55%)] hover:bg-[hsl(145_100%_50%/0.25)]'
                : 'bg-gradient-to-r from-cyan-500 to-violet-500 text-black hover:opacity-90',
              loading && 'opacity-60'
            )}
          >
            {loading ? <RefreshCw size={12} className="animate-spin" /> : <Shield size={12} />}
            {loading ? 'Checking...' : result ? 'Re-check' : 'Run Check'}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && expanded && (
        <div className="border-t border-[hsl(var(--border))] bg-[hsl(228_35%_4%/0.5)]">
          {/* Progress bar */}
          <div className="px-4 py-3 border-b border-[hsl(var(--border))]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-muted-foreground">Checks passed</span>
              <span className="text-xs font-bold">{passed}/{total}</span>
            </div>
            <div className="h-1.5 rounded-full bg-[hsl(228_25%_12%)] overflow-hidden">
              <div
                className={cn('h-full rounded-full transition-all duration-700',
                  result.is_eligible ? 'bg-gradient-to-r from-cyan-500 to-green-500' : 'bg-gradient-to-r from-orange-500 to-red-500'
                )}
                style={{ width: `${(passed / total) * 100}%` }}
              />
            </div>
          </div>

          {/* Individual checks */}
          <div className="divide-y divide-[hsl(var(--border))]">
            {result.checks.map((check) => (
              <div key={check.check} className="flex items-start gap-3 px-4 py-2.5">
                <div className="flex-shrink-0 mt-0.5">
                  {check.passed
                    ? <CheckCircle size={13} className="text-[hsl(145,100%,55%)]" />
                    : <XCircle size={13} className="text-[hsl(0,85%,65%)]" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold">{CHECK_LABELS[check.check] ?? check.check}</div>
                  <div className="text-[11px] text-muted-foreground">{check.message}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Fix actions for missing */}
          {result.missing_requirements.length > 0 && (
            <div className="px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(30_100%_55%/0.04)]">
              <div className="text-xs font-semibold text-[hsl(30,100%,60%)] mb-2 flex items-center gap-1.5">
                <AlertTriangle size={11} /> Actions Required
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(result.missing_requirements.map(r => MISSING_ACTIONS[r]?.route).filter(Boolean))).map(route => {
                  const req = result.missing_requirements.find(r => MISSING_ACTIONS[r]?.route === route);
                  const action = req ? MISSING_ACTIONS[req] : null;
                  if (!action) return null;
                  return (
                    <button
                      key={route}
                      onClick={() => navigate(route!)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border border-[hsl(30_100%_55%/0.3)] bg-[hsl(30_100%_55%/0.08)] text-[hsl(30,100%,60%)] hover:bg-[hsl(30_100%_55%/0.15)] transition-colors"
                    >
                      <ExternalLink size={10} /> {action.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
