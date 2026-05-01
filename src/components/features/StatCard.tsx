import React from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ReactNode;
  accent?: 'cyan' | 'violet' | 'green' | 'orange' | 'red';
  className?: string;
}

const ACCENT_STYLES = {
  cyan: 'border-[hsl(185_100%_50%/0.25)] bg-[hsl(185_100%_50%/0.05)]',
  violet: 'border-[hsl(265_80%_55%/0.25)] bg-[hsl(265_80%_55%/0.05)]',
  green: 'border-[hsl(145_100%_50%/0.25)] bg-[hsl(145_100%_50%/0.05)]',
  orange: 'border-[hsl(30_100%_55%/0.25)] bg-[hsl(30_100%_55%/0.05)]',
  red: 'border-[hsl(0_85%_60%/0.25)] bg-[hsl(0_85%_60%/0.05)]',
};

const ACCENT_VALUE = {
  cyan: 'text-[hsl(185,100%,55%)]',
  violet: 'text-[hsl(265,80%,70%)]',
  green: 'text-[hsl(145,100%,55%)]',
  orange: 'text-[hsl(30,100%,60%)]',
  red: 'text-[hsl(0,85%,65%)]',
};

export default function StatCard({ label, value, sub, icon, accent = 'cyan', className }: StatCardProps) {
  return (
    <div className={cn(
      'rounded-xl border p-4 glass-panel transition-all duration-200 hover:scale-[1.01]',
      ACCENT_STYLES[accent],
      className
    )}>
      <div className="flex items-start justify-between mb-2">
        <span className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className={cn('text-2xl font-bold', ACCENT_VALUE[accent])} style={{ fontFamily: 'Orbitron' }}>
        {value}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}
