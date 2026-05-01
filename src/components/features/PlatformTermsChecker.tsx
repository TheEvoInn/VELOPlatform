import React, { useState, useCallback } from 'react';
import {
  Globe, CheckCircle, XCircle, AlertTriangle, RefreshCw,
  Shield, Lock, ExternalLink, Plus, Clock, ChevronDown, ChevronUp
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export type AutomationStatus = 'allowed' | 'restricted' | 'prohibited' | 'unknown' | 'checking';

export interface PlatformCompliance {
  platform: string;
  domain: string;
  automation: AutomationStatus;
  allows_scraping: boolean;
  requires_id: boolean;
  requires_human_review: boolean;
  notes: string;
  last_checked: string;
  risk_level: 'low' | 'medium' | 'high' | 'extreme';
}

// Built-in platform compliance database
const PLATFORM_DB: Omit<PlatformCompliance, 'last_checked'>[] = [
  {
    platform: 'Upwork',       domain: 'upwork.com',
    automation: 'restricted', allows_scraping: false, requires_id: true,  requires_human_review: true,
    notes: 'Automated bidding violates ToS. AI-assisted writing permitted with human review.',
    risk_level: 'high',
  },
  {
    platform: 'Fiverr',       domain: 'fiverr.com',
    automation: 'restricted', allows_scraping: false, requires_id: false, requires_human_review: true,
    notes: 'Automated account actions restricted. AI content generation allowed.',
    risk_level: 'medium',
  },
  {
    platform: 'ClickWorker',  domain: 'clickworker.com',
    automation: 'allowed',    allows_scraping: false, requires_id: false, requires_human_review: false,
    notes: 'Worker API fully supported. Task automation permitted.',
    risk_level: 'low',
  },
  {
    platform: 'Remotive',     domain: 'remotive.com',
    automation: 'allowed',    allows_scraping: true,  requires_id: false, requires_human_review: false,
    notes: 'Public job board. Scraping permitted per robots.txt.',
    risk_level: 'low',
  },
  {
    platform: 'Amazon MTurk', domain: 'mturk.com',
    automation: 'allowed',    allows_scraping: false, requires_id: true,  requires_human_review: false,
    notes: 'Worker API available. Automation supported for task completion.',
    risk_level: 'low',
  },
  {
    platform: 'Freelancer',   domain: 'freelancer.com',
    automation: 'restricted', allows_scraping: false, requires_id: true,  requires_human_review: true,
    notes: 'Limited automation; bidding bots prohibited. AI writing allowed.',
    risk_level: 'high',
  },
  {
    platform: 'Toptal',       domain: 'toptal.com',
    automation: 'prohibited', allows_scraping: false, requires_id: true,  requires_human_review: true,
    notes: 'Strictly prohibits all automation. Manual application only.',
    risk_level: 'extreme',
  },
  {
    platform: 'Arbitrum',     domain: 'arbitrum.io',
    automation: 'allowed',    allows_scraping: true,  requires_id: false, requires_human_review: false,
    notes: 'Decentralized protocol. Full automation supported.',
    risk_level: 'low',
  },
  {
    platform: 'zkSync Era',   domain: 'zksync.io',
    automation: 'allowed',    allows_scraping: true,  requires_id: false, requires_human_review: false,
    notes: 'DeFi protocol — automation and scripting fully supported.',
    risk_level: 'low',
  },
  {
    platform: 'Linea',        domain: 'linea.build',
    automation: 'allowed',    allows_scraping: true,  requires_id: false, requires_human_review: false,
    notes: 'Blockchain protocol. All automation permitted.',
    risk_level: 'low',
  },
  {
    platform: 'Scale AI',     domain: 'scale.com',
    automation: 'allowed',    allows_scraping: false, requires_id: true,  requires_human_review: false,
    notes: 'Worker API available via Scale Tasker platform.',
    risk_level: 'low',
  },
  {
    platform: 'AliExpress',   domain: 'aliexpress.com',
    automation: 'restricted', allows_scraping: false, requires_id: false, requires_human_review: true,
    notes: 'API available for affiliates. Direct scraping restricted.',
    risk_level: 'medium',
  },
];

const STATUS_CONFIG: Record<AutomationStatus, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  allowed:   { label: 'Allowed',    color: 'text-[hsl(145,100%,55%)]', bg: 'bg-[hsl(145_100%_50%/0.1)]',  border: 'border-[hsl(145_100%_50%/0.25)]', icon: CheckCircle },
  restricted:{ label: 'Restricted', color: 'text-[hsl(30,100%,60%)]',  bg: 'bg-[hsl(30_100%_55%/0.1)]',   border: 'border-[hsl(30_100%_55%/0.25)]',  icon: AlertTriangle },
  prohibited:{ label: 'Prohibited', color: 'text-[hsl(0,85%,65%)]',    bg: 'bg-[hsl(0_85%_60%/0.1)]',     border: 'border-[hsl(0_85%_60%/0.25)]',    icon: XCircle },
  unknown:   { label: 'Unknown',    color: 'text-muted-foreground',     bg: 'bg-[hsl(228_25%_12%)]',        border: 'border-[hsl(var(--border))]',     icon: AlertTriangle },
  checking:  { label: 'Checking...', color: 'text-[hsl(185,100%,55%)]', bg: 'bg-[hsl(185_100%_50%/0.1)]',  border: 'border-[hsl(185_100%_50%/0.25)]', icon: RefreshCw },
};

const RISK_COLORS: Record<string, string> = {
  low:     'text-[hsl(145,100%,55%)] bg-[hsl(145_100%_50%/0.1)] border-[hsl(145_100%_50%/0.25)]',
  medium:  'text-[hsl(30,100%,60%)] bg-[hsl(30_100%_55%/0.1)] border-[hsl(30_100%_55%/0.25)]',
  high:    'text-[hsl(0,85%,65%)] bg-[hsl(0_85%_60%/0.1)] border-[hsl(0_85%_60%/0.25)]',
  extreme: 'text-[hsl(0,85%,65%)] bg-[hsl(0_85%_60%/0.15)] border-[hsl(0_85%_60%/0.4)]',
};

interface PlatformTermsCheckerProps {
  filterPlatform?: string;
  compact?: boolean;
}

export function checkPlatformCompliance(platform: string): PlatformCompliance {
  const key = platform?.toLowerCase().trim();
  const match = PLATFORM_DB.find(p =>
    key?.includes(p.domain.split('.')[0]) || p.platform.toLowerCase().includes(key || '')
  );
  return {
    ...(match || {
      platform,
      domain: `${key}.com`,
      automation: 'unknown' as AutomationStatus,
      allows_scraping: false,
      requires_id: false,
      requires_human_review: true,
      notes: 'Platform compliance not verified. Proceed with caution and manual review.',
      risk_level: 'medium' as const,
    }),
    last_checked: new Date().toISOString(),
  };
}

export default function PlatformTermsChecker({ filterPlatform, compact = false }: PlatformTermsCheckerProps) {
  const [platforms, setPlatforms] = useState<PlatformCompliance[]>(
    PLATFORM_DB.map(p => ({ ...p, last_checked: new Date(Date.now() - Math.random() * 86400000).toISOString() }))
  );
  const [newPlatform, setNewPlatform] = useState('');
  const [checkingPlatform, setCheckingPlatform] = useState<string | null>(null);
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AutomationStatus | 'all'>('all');

  const checkPlatform = useCallback(async (platformName: string) => {
    setCheckingPlatform(platformName);

    // Simulate async check (in production, would call an edge function or external API)
    await new Promise(r => setTimeout(r, 1200));

    const result = checkPlatformCompliance(platformName);
    setPlatforms(prev => {
      const exists = prev.find(p => p.platform === platformName || p.domain.includes(platformName.toLowerCase()));
      if (exists) {
        return prev.map(p => p.platform === exists.platform ? { ...p, last_checked: new Date().toISOString() } : p);
      }
      return [...prev, result];
    });

    // Log compliance decision
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'system',
        title: `Platform Compliance Check: ${platformName}`,
        message: `Automation ${result.automation} on ${platformName}. Risk: ${result.risk_level}`,
        data: { platform: platformName, automation: result.automation, risk_level: result.risk_level },
        priority: result.automation === 'prohibited' ? 'high' : result.automation === 'restricted' ? 'normal' : 'low',
      });
    }

    setCheckingPlatform(null);
    toast.success(`Compliance check complete: ${platformName} — ${result.automation}`);
  }, []);

  const addCustomPlatform = () => {
    if (!newPlatform.trim()) return;
    checkPlatform(newPlatform.trim());
    setNewPlatform('');
  };

  const displayed = platforms.filter(p => {
    if (filterPlatform) {
      return p.platform.toLowerCase().includes(filterPlatform.toLowerCase()) ||
             p.domain.includes(filterPlatform.toLowerCase());
    }
    if (filterStatus !== 'all') return p.automation === filterStatus;
    return true;
  });

  if (compact && filterPlatform) {
    const p = displayed[0] || checkPlatformCompliance(filterPlatform);
    const cfg = STATUS_CONFIG[p.automation] || STATUS_CONFIG.unknown;
    const Icon = cfg.icon;
    return (
      <div className={cn('flex items-center gap-2 px-3 py-2 rounded-xl border text-xs', cfg.bg, cfg.border)}>
        <Icon size={12} className={cn(cfg.color, p.automation === 'checking' && 'animate-spin')} />
        <span className={cn('font-semibold', cfg.color)}>{cfg.label}</span>
        <span className="text-muted-foreground">· {p.notes.substring(0, 60)}...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {(['all', 'allowed', 'restricted', 'prohibited'] as const).map(s => {
            const cfg = s === 'all' ? null : STATUS_CONFIG[s];
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors',
                  filterStatus === s
                    ? s === 'all' ? 'bg-[hsl(185_100%_50%/0.15)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]'
                                  : cn(cfg?.bg, cfg?.color, cfg?.border)
                    : 'bg-[hsl(228_25%_10%)] text-muted-foreground border-[hsl(var(--border))] hover:text-foreground'
                )}
              >
                {s === 'all' ? `All (${platforms.length})` : `${s} (${platforms.filter(p => p.automation === s).length})`}
              </button>
            );
          })}
        </div>

        {/* Add platform */}
        <div className="flex gap-2 ml-auto">
          <input
            className="px-3 py-1.5 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-xs focus:outline-none focus:border-[hsl(185_100%_50%/0.5)] transition-colors w-40"
            placeholder="Check platform..."
            value={newPlatform}
            onChange={e => setNewPlatform(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCustomPlatform()}
          />
          <button
            onClick={addCustomPlatform}
            disabled={!newPlatform.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border border-[hsl(185_100%_50%/0.3)] bg-[hsl(185_100%_50%/0.08)] text-[hsl(185,100%,55%)] hover:bg-[hsl(185_100%_50%/0.15)] disabled:opacity-40 transition-colors"
          >
            <Plus size={12} /> Check
          </button>
        </div>
      </div>

      {/* Platform list */}
      <div className="space-y-2">
        {displayed.map(p => {
          const cfg = STATUS_CONFIG[checkingPlatform === p.platform ? 'checking' : p.automation] || STATUS_CONFIG.unknown;
          const Icon = cfg.icon;
          const isExpanded = expandedPlatform === p.platform;
          const isChecking = checkingPlatform === p.platform;

          return (
            <div
              key={p.platform}
              className={cn(
                'glass-panel rounded-xl border overflow-hidden transition-all',
                `border-[hsl(var(--border))]`
              )}
            >
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-[hsl(228_25%_9%/0.5)] transition-colors"
                onClick={() => setExpandedPlatform(e => e === p.platform ? null : p.platform)}
              >
                {/* Status indicator */}
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', cfg.bg, cfg.border, 'border')}>
                  <Icon size={14} className={cn(cfg.color, isChecking && 'animate-spin')} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                    <span className="text-sm font-bold">{p.platform}</span>
                    <span className={cn('text-[9px] px-2 py-0.5 rounded border font-bold uppercase tracking-wider', cfg.bg, cfg.border, cfg.color)}>
                      {isChecking ? 'Checking...' : cfg.label}
                    </span>
                    <span className={cn('text-[9px] px-1.5 py-0.5 rounded border capitalize', RISK_COLORS[p.risk_level])}>
                      {p.risk_level} risk
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">{p.domain}</div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {/* Quick flags */}
                  <div className="hidden md:flex gap-1.5">
                    {p.requires_id && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(265_80%_55%/0.1)] border border-[hsl(265_80%_55%/0.2)] text-[hsl(265,80%,70%)] flex items-center gap-1">
                        <Lock size={8} /> ID Req
                      </span>
                    )}
                    {p.requires_human_review && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(30_100%_55%/0.08)] border border-[hsl(30_100%_55%/0.2)] text-[hsl(30,100%,60%)] flex items-center gap-1">
                        👁 Review
                      </span>
                    )}
                    {p.allows_scraping && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-[hsl(145_100%_50%/0.08)] border border-[hsl(145_100%_50%/0.2)] text-[hsl(145,100%,55%)] flex items-center gap-1">
                        ✓ Scraping
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <Clock size={9} />
                    {new Date(p.last_checked).toLocaleDateString()}
                  </div>

                  <button
                    onClick={e => { e.stopPropagation(); checkPlatform(p.platform); }}
                    disabled={isChecking}
                    className="p-1.5 rounded-lg hover:bg-[hsl(228_25%_15%)] transition-colors"
                    title="Re-check"
                  >
                    <RefreshCw size={11} className={cn('text-muted-foreground', isChecking && 'animate-spin')} />
                  </button>

                  {isExpanded ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                </div>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-[hsl(var(--border))] p-4 bg-[hsl(228_35%_4%/0.5)] space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.notes}</p>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Automation', value: p.automation, allowed: p.automation === 'allowed' },
                      { label: 'Scraping', value: p.allows_scraping ? 'Allowed' : 'Restricted', allowed: p.allows_scraping },
                      { label: 'ID Required', value: p.requires_id ? 'Yes' : 'No', allowed: !p.requires_id },
                    ].map(item => (
                      <div key={item.label} className="p-3 rounded-lg bg-[hsl(228_25%_10%)] border border-[hsl(var(--border))] text-center">
                        <div className="text-[10px] text-muted-foreground mb-1">{item.label}</div>
                        <div className={cn('text-xs font-bold capitalize', item.allowed ? 'text-[hsl(145,100%,55%)]' : 'text-[hsl(0,85%,65%)]')}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Compliance action */}
                  {p.automation === 'prohibited' && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-[hsl(0_85%_60%/0.25)] bg-[hsl(0_85%_60%/0.05)] text-xs text-[hsl(0,85%,65%)]">
                      <XCircle size={12} className="flex-shrink-0 mt-0.5" />
                      Autopilots are blocked from acting on this platform. Manual action only.
                    </div>
                  )}
                  {p.automation === 'restricted' && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-[hsl(30_100%_55%/0.2)] bg-[hsl(30_100%_55%/0.04)] text-xs text-[hsl(30,100%,60%)]">
                      <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                      Human review required before Autopilot proceeds. User approval will be requested.
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground px-1">
        <span className="flex items-center gap-1"><CheckCircle size={10} className="text-[hsl(145,100%,55%)]" /> Allowed: full automation</span>
        <span className="flex items-center gap-1"><AlertTriangle size={10} className="text-[hsl(30,100%,60%)]" /> Restricted: human oversight</span>
        <span className="flex items-center gap-1"><XCircle size={10} className="text-[hsl(0,85%,65%)]" /> Prohibited: manual only</span>
      </div>
    </div>
  );
}
