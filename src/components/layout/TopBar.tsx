import React from 'react';
import { Wifi, WifiOff, Zap } from 'lucide-react';
import NotificationCenter from '@/components/features/NotificationCenter';
import type { User } from '@/types';

const PAGE_TITLES: Record<string, { title: string; sub: string }> = {
  '/dashboard': { title: 'COMMAND BRIDGE', sub: 'Mission overview & live metrics' },
  '/engines': { title: 'ENGINE BAY', sub: 'Profit engines management' },
  '/autopilots': { title: 'AI CORE', sub: 'Autopilot fleet management' },
  '/opportunities': { title: 'STAR SCANNER', sub: 'Live opportunity discovery' },
  '/matching': { title: 'MATCHING ENGINE', sub: 'AI-powered opportunity matching' },
  '/mission-control': { title: 'MISSION CONTROL', sub: 'Task orchestration center' },
  '/automation': { title: 'BROWSER AUTOMATION', sub: 'Playwright session management' },
  '/identity': { title: 'IDENTITY STUDIO', sub: 'AI persona configuration' },
  '/content': { title: 'CONTENT CREATOR AI', sub: 'Gemini-powered content generation' },
  '/crypto': { title: 'CRYPTO PROFITS', sub: 'Airdrops, testnets & bounties' },
  '/dropshipping': { title: 'DROPSHIP NEXUS', sub: 'E-commerce automation' },
  '/wallet': { title: 'CARGO HOLD', sub: 'Profit wallet & ledger' },
  '/vault': { title: 'SECURE VAULT', sub: 'Encrypted credential storage' },
  '/analytics': { title: 'ANALYTICS', sub: 'Performance intelligence' },
  '/safety': { title: 'SAFETY CONTROL', sub: 'Compliance & recovery systems' },
  '/settings': { title: 'SETTINGS', sub: 'Workspace configuration' },
};

interface TopBarProps {
  user: User;
  pathname: string;
}

export default function TopBar({ user, pathname }: TopBarProps) {
  const page = PAGE_TITLES[pathname] ?? { title: 'VELO 2.0', sub: 'Autonomous Profit Platform' };

  return (
    <header className="h-14 border-b border-[hsl(var(--border))] bg-[hsl(228_35%_5%/0.9)] backdrop-blur-xl flex items-center px-5 gap-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-sm font-black tracking-widest text-neon-cyan leading-none" style={{ fontFamily: 'Orbitron' }}>
            {page.title}
          </h1>
          <div className="hidden sm:flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full bg-[hsl(var(--cyan))] opacity-60" />
            <span className="text-[11px] text-muted-foreground">{page.sub}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Live status */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(145_100%_50%/0.08)] border border-[hsl(145_100%_50%/0.15)]">
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(145,100%,55%)] animate-pulse" />
          <span className="text-[10px] font-semibold text-[hsl(145,100%,55%)]">LIVE</span>
        </div>

        {/* AI badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[hsl(265_80%_55%/0.08)] border border-[hsl(265_80%_55%/0.15)]">
          <Zap size={11} className="text-[hsl(265,80%,70%)]" />
          <span className="text-[10px] font-semibold text-[hsl(265,80%,70%)]">Gemini 3 Flash</span>
        </div>

        {/* Notifications */}
        <NotificationCenter />

        {/* User avatar */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-xs font-bold text-black flex-shrink-0 cursor-pointer hover:scale-105 transition-transform">
          {user.name.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  );
}
