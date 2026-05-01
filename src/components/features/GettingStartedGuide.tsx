import React, { useState, useEffect } from 'react';
import {
  ChevronDown, ChevronUp, CheckCircle, Circle, ArrowRight,
  Zap, Bot, Cpu, Lock, ShieldCheck, Radar, Sparkles, X
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePlatformStats, useOpportunities } from '@/hooks/useSharedData';
import { useNavigate } from 'react-router-dom';

interface Step {
  id: string;
  icon: React.ElementType;
  label: string;
  description: string;
  route: string;
  cta: string;
  accentClass: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  done: boolean;
}

export default function GettingStartedGuide() {
  const navigate = useNavigate();
  const { engines, autopilots, identity, isLoading } = usePlatformStats();
  const { data: opportunities = [] } = useOpportunities();

  // Derive step completion from real data
  const hasEngine     = (engines as unknown[]).length > 0;
  const hasAutopilot  = (autopilots as unknown[]).length > 0;
  const identityData  = identity as {
    completeness_score?: number;
    has_id_document?: boolean;
    consent_given?: boolean;
  } | null | undefined;
  const identityReady = (identityData?.completeness_score ?? 0) >= 50;
  const hasIdDoc      = identityData?.has_id_document ?? false;
  const hasConsent    = identityData?.consent_given ?? false;
  const hasScanned    = (opportunities as unknown[]).length > 0;

  const STEPS: Step[] = [
    {
      id: 'engine',
      icon: Zap,
      label: 'Create a Profit Engine',
      description: 'Define your income strategy — freelance, crypto, gig, or dropshipping.',
      route: '/engines',
      cta: 'Go to Engine Bay',
      accentClass: 'cyan',
      accentBg: 'bg-[hsl(185_100%_50%/0.1)]',
      accentBorder: 'border-[hsl(185_100%_50%/0.25)]',
      accentText: 'text-[hsl(185,100%,55%)]',
      done: hasEngine,
    },
    {
      id: 'autopilot',
      icon: Bot,
      label: 'Deploy an Autopilot',
      description: 'Create your first AI agent to discover and apply for opportunities automatically.',
      route: '/autopilots',
      cta: 'Go to AI Core',
      accentClass: 'violet',
      accentBg: 'bg-[hsl(265_80%_55%/0.1)]',
      accentBorder: 'border-[hsl(265_80%_55%/0.25)]',
      accentText: 'text-[hsl(265,80%,70%)]',
      done: hasAutopilot,
    },
    {
      id: 'identity',
      icon: Cpu,
      label: 'Complete Your Identity',
      description: 'Fill in your profile to at least 50% — required for real-world applications.',
      route: '/identity',
      cta: 'Open Identity Studio',
      accentClass: 'violet',
      accentBg: 'bg-[hsl(265_80%_55%/0.1)]',
      accentBorder: 'border-[hsl(265_80%_55%/0.25)]',
      accentText: 'text-[hsl(265,80%,70%)]',
      done: identityReady,
    },
    {
      id: 'id_doc',
      icon: Lock,
      label: 'Upload ID to Vault',
      description: 'Store an encrypted government ID to unlock verified platform applications.',
      route: '/vault',
      cta: 'Open Vault',
      accentClass: 'orange',
      accentBg: 'bg-[hsl(30_100%_55%/0.1)]',
      accentBorder: 'border-[hsl(30_100%_55%/0.25)]',
      accentText: 'text-[hsl(30,100%,60%)]',
      done: hasIdDoc,
    },
    {
      id: 'consent',
      icon: ShieldCheck,
      label: 'Grant Identity Consent',
      description: 'Approve your Autopilots to use your verified identity in applications.',
      route: '/identity',
      cta: 'Manage Consent',
      accentClass: 'green',
      accentBg: 'bg-[hsl(145_100%_50%/0.1)]',
      accentBorder: 'border-[hsl(145_100%_50%/0.25)]',
      accentText: 'text-[hsl(145,100%,55%)]',
      done: hasConsent,
    },
    {
      id: 'scan',
      icon: Radar,
      label: 'Run Your First Scan',
      description: 'Let the Star Scanner discover live opportunities from 4+ real-world platforms.',
      route: '/opportunities',
      cta: 'Open Star Scanner',
      accentClass: 'cyan',
      accentBg: 'bg-[hsl(185_100%_50%/0.1)]',
      accentBorder: 'border-[hsl(185_100%_50%/0.25)]',
      accentText: 'text-[hsl(185,100%,55%)]',
      done: hasScanned,
    },
  ];

  const doneCount = STEPS.filter(s => s.done).length;
  const allDone   = doneCount === STEPS.length;
  const progress  = (doneCount / STEPS.length) * 100;

  // Start open until all done; allow dismiss after completion
  const [open, setOpen] = useState(!allDone);
  const [dismissed, setDismissed] = useState(false);

  // Auto-collapse when everything is done
  useEffect(() => {
    if (allDone) setOpen(false);
  }, [allDone]);

  if (dismissed) return null;

  return (
    <div className={cn(
      'glass-panel rounded-2xl border overflow-hidden transition-all duration-300',
      allDone
        ? 'border-[hsl(145_100%_50%/0.3)]'
        : 'border-[hsl(185_100%_50%/0.15)]'
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[hsl(228_25%_10%/0.5)] transition-colors text-left"
      >
        {/* Icon */}
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          allDone ? 'bg-[hsl(145_100%_50%/0.15)]' : 'bg-[hsl(185_100%_50%/0.1)]'
        )}>
          {allDone
            ? <CheckCircle size={18} className="text-[hsl(145,100%,55%)]" />
            : <Sparkles size={18} className="text-[hsl(185,100%,55%)]" />}
        </div>

        {/* Title + progress */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className={cn('text-sm font-bold', allDone ? 'text-[hsl(145,100%,55%)]' : 'text-foreground')}
              style={{ fontFamily: 'Orbitron' }}
            >
              {allDone ? 'PLATFORM READY' : 'GETTING STARTED'}
            </span>
            <span className={cn(
              'text-[10px] font-bold px-2 py-0.5 rounded-full border',
              allDone
                ? 'bg-[hsl(145_100%_50%/0.12)] border-[hsl(145_100%_50%/0.3)] text-[hsl(145,100%,55%)]'
                : 'bg-[hsl(185_100%_50%/0.1)] border-[hsl(185_100%_50%/0.25)] text-[hsl(185,100%,55%)]'
            )}>
              {doneCount}/{STEPS.length} steps
            </span>
          </div>
          {/* Progress bar */}
          <div className="h-1 rounded-full bg-[hsl(228_25%_12%)] overflow-hidden max-w-sm">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                allDone
                  ? 'bg-gradient-to-r from-green-400 to-cyan-400'
                  : 'bg-gradient-to-r from-cyan-500 to-violet-500'
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {allDone && (
            <button
              onClick={e => { e.stopPropagation(); setDismissed(true); }}
              className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_15%)] transition-colors"
              title="Dismiss"
            >
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
          {open
            ? <ChevronUp size={16} className="text-muted-foreground" />
            : <ChevronDown size={16} className="text-muted-foreground" />}
        </div>
      </button>

      {/* Step list */}
      {open && (
        <div className="border-t border-[hsl(var(--border))]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
              <div className="w-4 h-4 border border-[hsl(185_100%_50%/0.3)] border-t-[hsl(185,100%,55%)] rounded-full animate-spin" />
              Checking setup status...
            </div>
          ) : (
            <div className="divide-y divide-[hsl(var(--border))]">
              {STEPS.map((step, idx) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.id}
                    className={cn(
                      'flex items-center gap-4 px-5 py-3.5 transition-colors',
                      step.done
                        ? 'bg-[hsl(145_100%_50%/0.02)]'
                        : 'hover:bg-[hsl(228_25%_10%/0.5)]'
                    )}
                  >
                    {/* Step number / check */}
                    <div className="flex-shrink-0 relative">
                      {step.done ? (
                        <div className="w-8 h-8 rounded-full bg-[hsl(145_100%_50%/0.15)] border border-[hsl(145_100%_50%/0.3)] flex items-center justify-center">
                          <CheckCircle size={15} className="text-[hsl(145,100%,55%)]" />
                        </div>
                      ) : (
                        <div className={cn(
                          'w-8 h-8 rounded-full border flex items-center justify-center',
                          step.accentBg, step.accentBorder
                        )}>
                          <Icon size={15} className={step.accentText} />
                        </div>
                      )}
                      {/* Connector line */}
                      {idx < STEPS.length - 1 && (
                        <div className={cn(
                          'absolute left-1/2 -translate-x-1/2 top-full w-px h-3.5 mt-0.5',
                          step.done ? 'bg-[hsl(145_100%_50%/0.3)]' : 'bg-[hsl(var(--border))]'
                        )} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className={cn(
                        'text-sm font-semibold',
                        step.done ? 'text-muted-foreground line-through decoration-[hsl(145_100%_50%/0.5)]' : 'text-foreground'
                      )}>
                        {step.label}
                      </div>
                      {!step.done && (
                        <div className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                          {step.description}
                        </div>
                      )}
                    </div>

                    {/* CTA */}
                    {step.done ? (
                      <div className="flex-shrink-0 flex items-center gap-1 text-[11px] font-semibold text-[hsl(145,100%,55%)]">
                        <CheckCircle size={12} /> Done
                      </div>
                    ) : (
                      <button
                        onClick={() => navigate(step.route)}
                        className={cn(
                          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold border transition-all whitespace-nowrap',
                          step.accentBg, step.accentBorder, step.accentText,
                          'hover:opacity-90'
                        )}
                      >
                        {step.cta} <ArrowRight size={10} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Footer */}
          {allDone && (
            <div className="px-5 py-3 border-t border-[hsl(var(--border))] bg-[hsl(145_100%_50%/0.04)] flex items-center gap-2 text-xs text-[hsl(145,100%,55%)]">
              <Sparkles size={12} />
              <span className="font-semibold">Platform fully configured — your Autopilots are ready to earn!</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
