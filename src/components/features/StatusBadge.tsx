import React from 'react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const STATUS_MAP: Record<string, { label: string; cls: string; dot: string }> = {
  active: { label: 'ACTIVE', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  running: { label: 'RUNNING', cls: 'bg-[hsl(30_100%_55%/0.12)] text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)]', dot: 'bg-[hsl(30,100%,60%)] animate-pulse' },
  paused: { label: 'PAUSED', cls: 'bg-[hsl(215_25%_50%/0.12)] text-[hsl(215,25%,65%)] border-[hsl(215_25%_50%/0.3)]', dot: 'bg-[hsl(215,25%,65%)]' },
  stopped: { label: 'STOPPED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  idle: { label: 'IDLE', cls: 'bg-[hsl(215_25%_50%/0.12)] text-[hsl(215,25%,65%)] border-[hsl(215_25%_50%/0.3)]', dot: 'bg-[hsl(215,25%,65%)]' },
  error: { label: 'ERROR', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  new: { label: 'NEW', cls: 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]', dot: 'bg-[hsl(185,100%,55%)]' },
  matched: { label: 'MATCHED', cls: 'bg-[hsl(265_80%_55%/0.12)] text-[hsl(265,80%,70%)] border-[hsl(265_80%_55%/0.3)]', dot: 'bg-[hsl(265,80%,70%)]' },
  applied: { label: 'APPLIED', cls: 'bg-[hsl(30_100%_55%/0.12)] text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)]', dot: 'bg-[hsl(30,100%,60%)]' },
  in_progress: { label: 'IN PROGRESS', cls: 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]', dot: 'bg-[hsl(185,100%,55%)] animate-pulse' },
  completed: { label: 'COMPLETE', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  rejected: { label: 'REJECTED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  queued: { label: 'QUEUED', cls: 'bg-[hsl(265_80%_55%/0.12)] text-[hsl(265,80%,70%)] border-[hsl(265_80%_55%/0.3)]', dot: 'bg-[hsl(265,80%,70%)]' },
  failed: { label: 'FAILED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  confirmed: { label: 'CONFIRMED', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  pending: { label: 'PENDING', cls: 'bg-[hsl(30_100%_55%/0.12)] text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)]', dot: 'bg-[hsl(30,100%,60%)]' },
  high: { label: 'HIGH', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  medium: { label: 'MEDIUM', cls: 'bg-[hsl(30_100%_55%/0.12)] text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)]', dot: 'bg-[hsl(30,100%,60%)]' },
  low: { label: 'LOW', cls: 'bg-[hsl(215_25%_50%/0.12)] text-[hsl(215,25%,65%)] border-[hsl(215_25%_50%/0.3)]', dot: 'bg-[hsl(215,25%,65%)]' },
  // Crypto statuses
  upcoming: { label: 'UPCOMING', cls: 'bg-[hsl(265_80%_55%/0.12)] text-[hsl(265,80%,70%)] border-[hsl(265_80%_55%/0.3)]', dot: 'bg-[hsl(265,80%,70%)]' },
  claimed: { label: 'CLAIMED', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  expired: { label: 'EXPIRED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  // Dropship statuses
  processing: { label: 'PROCESSING', cls: 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]', dot: 'bg-[hsl(185,100%,55%)] animate-pulse' },
  shipped: { label: 'SHIPPED', cls: 'bg-[hsl(30_100%_55%/0.12)] text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)]', dot: 'bg-[hsl(30,100%,60%)]' },
  delivered: { label: 'DELIVERED', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  refunded: { label: 'REFUNDED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  cancelled: { label: 'CANCELLED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  researching: { label: 'RESEARCHING', cls: 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]', dot: 'bg-[hsl(185,100%,55%)]' },
  listed: { label: 'LISTED', cls: 'bg-[hsl(265_80%_55%/0.12)] text-[hsl(265,80%,70%)] border-[hsl(265_80%_55%/0.3)]', dot: 'bg-[hsl(265,80%,70%)]' },
  discontinued: { label: 'DISCONTINUED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  // Automation
  captcha: { label: 'CAPTCHA', cls: 'bg-[hsl(30_100%_55%/0.12)] text-[hsl(30,100%,60%)] border-[hsl(30_100%_55%/0.3)]', dot: 'bg-[hsl(30,100%,60%)] animate-pulse' },
  rate_limited: { label: 'RATE LIMITED', cls: 'bg-[hsl(0_85%_60%/0.12)] text-[hsl(0,85%,65%)] border-[hsl(0_85%_60%/0.3)]', dot: 'bg-[hsl(0,85%,65%)]' },
  // Match recommendations
  top: { label: 'TOP MATCH', cls: 'bg-[hsl(145_100%_50%/0.12)] text-[hsl(145,100%,55%)] border-[hsl(145_100%_50%/0.3)]', dot: 'bg-[hsl(145,100%,55%)]' },
  secondary: { label: 'SECONDARY', cls: 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(185,100%,55%)] border-[hsl(185_100%_50%/0.3)]', dot: 'bg-[hsl(185,100%,55%)]' },
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = STATUS_MAP[status] ?? { label: status.toUpperCase(), cls: 'bg-muted text-muted-foreground border-border', dot: 'bg-muted-foreground' };
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-bold tracking-wider',
      s.cls, className
    )}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', s.dot)} />
      {s.label}
    </span>
  );
}
