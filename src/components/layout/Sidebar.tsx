import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Zap, Bot, Radar, Terminal,
  Wallet, Lock, Palette, Cpu, ShieldAlert,
  ChevronLeft, ChevronRight, LogOut, Settings,
  TrendingUp, Package, Bitcoin, ShoppingBag, Target, Monitor, Activity, Code2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { User } from '@/types';

interface NavItem {
  icon: React.ElementType;
  label: string;
  path: string;
  badge?: string;
  group: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Command Bridge', path: '/dashboard', group: 'Core' },
  { icon: Zap, label: 'Engine Bay', path: '/engines', group: 'Core' },
  { icon: Bot, label: 'AI Core', path: '/autopilots', group: 'Core' },
  { icon: Radar, label: 'Star Scanner', path: '/opportunities', badge: 'LIVE', group: 'Discovery' },
  { icon: Target, label: 'Matching Engine', path: '/matching', badge: 'NEW', group: 'Discovery' },
  { icon: Terminal, label: 'Mission Control', path: '/mission-control', group: 'Discovery' },
  { icon: Monitor, label: 'Browser Automation', path: '/automation', group: 'Discovery' },
  { icon: Cpu, label: 'Identity Studio', path: '/identity', group: 'AI' },
  { icon: Package, label: 'Content Creator', path: '/content', group: 'AI' },
  { icon: Bitcoin, label: 'Crypto Profits', path: '/crypto', badge: 'HOT', group: 'Modules' },
  { icon: ShoppingBag, label: 'Dropshipping', path: '/dropshipping', group: 'Modules' },
  { icon: Wallet, label: 'Cargo Hold', path: '/wallet', group: 'Finance' },
  { icon: Lock, label: 'Vault', path: '/vault', group: 'Finance' },
  { icon: TrendingUp, label: 'Analytics', path: '/analytics', group: 'Finance' },
  { icon: ShieldAlert, label: 'Safety Control', path: '/safety', group: 'System' },
  { icon: Activity, label: 'Audit Log', path: '/audit', badge: 'NEW', group: 'System' },
  { icon: Settings, label: 'Settings', path: '/settings', group: 'System' },
  { icon: Code2, label: 'Dev Console', path: '/dev-console', badge: 'ADMIN', group: 'System' },
];

const GROUPS = ['Core', 'Discovery', 'AI', 'Modules', 'Finance', 'System'];

interface SidebarProps {
  user: User;
  onLogout: () => void;
}

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <aside
      className={cn(
        'relative z-40 flex flex-col h-screen transition-all duration-300 ease-in-out',
        'border-r border-[hsl(var(--border))]',
        'bg-[hsl(228_35%_5%/0.95)] backdrop-blur-xl',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex items-center px-4 py-5 border-b border-[hsl(var(--border))]',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div className="relative flex-shrink-0 w-8 h-8">
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 opacity-80 blur-sm" />
          <div className="relative w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center">
            <span className="text-xs font-black text-black" style={{ fontFamily: 'Orbitron' }}>V</span>
          </div>
        </div>
        {!collapsed && (
          <div>
            <div className="text-sm font-bold text-neon-cyan" style={{ fontFamily: 'Orbitron' }}>VELO 2.0</div>
            <div className="text-[10px] text-muted-foreground tracking-widest uppercase">Profit Platform</div>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        {GROUPS.map(group => {
          const items = NAV_ITEMS.filter(i => i.group === group);
          return (
            <div key={group} className="mb-4">
              {!collapsed && (
                <div className="px-2 mb-1 text-[10px] font-semibold tracking-widest uppercase text-muted-foreground">
                  {group}
                </div>
              )}
              {items.map(item => {
                const Icon = item.icon;
                const active = location.pathname === item.path;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5',
                      'transition-all duration-200 group relative',
                      collapsed ? 'justify-center' : '',
                      active
                        ? 'bg-[hsl(185_100%_50%/0.12)] text-[hsl(var(--cyan))] border border-[hsl(185_100%_50%/0.25)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[hsl(228_25%_12%)]'
                    )}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={16} className={cn('flex-shrink-0', active && 'text-neon-cyan')} />
                    {!collapsed && (
                      <span className="text-sm font-medium flex-1 text-left">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className={cn(
                        'text-[9px] font-bold px-1.5 py-0.5 rounded tracking-wider',
                        item.badge === 'HOT' ? 'bg-[hsl(0_85%_60%/0.15)] text-[hsl(0,85%,65%)] border border-[hsl(0_85%_60%/0.3)]' :
                        item.badge === 'NEW' ? 'bg-[hsl(265_80%_55%/0.15)] text-[hsl(265,80%,70%)] border border-[hsl(265_80%_55%/0.3)]' :
                        item.badge === 'ADMIN' ? 'bg-[hsl(50_100%_50%/0.15)] text-[hsl(50,100%,60%)] border border-[hsl(50_100%_50%/0.3)]' :
                        'bg-[hsl(145_100%_50%/0.15)] text-[hsl(145,100%,50%)] border border-[hsl(145_100%_50%/0.3)]'
                      )}>
                        {item.badge}
                      </span>
                    )}
                    {active && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[hsl(var(--cyan))] rounded-r blur-[1px]" />
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User */}
      <div className={cn(
        'border-t border-[hsl(var(--border))] px-3 py-3',
        collapsed ? 'flex justify-center' : 'flex items-center gap-2'
      )}>
        {!collapsed && (
          <>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-400 to-violet-500 flex items-center justify-center text-xs font-bold text-black flex-shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">{user.name}</div>
              <div className="text-[10px] text-muted-foreground truncate">{user.email}</div>
            </div>
            <button onClick={onLogout} className="p-1.5 rounded hover:bg-[hsl(0_85%_60%/0.15)] hover:text-destructive transition-colors" title="Logout">
              <LogOut size={14} />
            </button>
          </>
        )}
        {collapsed && (
          <button onClick={onLogout} className="p-1.5 rounded hover:bg-[hsl(0_85%_60%/0.15)] hover:text-destructive transition-colors" title="Logout">
            <LogOut size={14} />
          </button>
        )}
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-20 z-50 w-6 h-6 rounded-full border border-[hsl(var(--border))] bg-[hsl(228_35%_7%)] hover:border-[hsl(var(--cyan))] transition-colors flex items-center justify-center"
      >
        {collapsed ? <ChevronRight size={12} className="text-muted-foreground" /> : <ChevronLeft size={12} className="text-muted-foreground" />}
      </button>
    </aside>
  );
}
