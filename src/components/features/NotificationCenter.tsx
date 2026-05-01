import React, { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckCheck, Inbox } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNotifications, VeloNotification } from '@/hooks/useNotifications';

const TYPE_ICONS: Record<string, string> = {
  opportunity: '🎯',
  task_complete: '✅',
  earning: '💰',
  error: '🚨',
  human_review: '👁',
  credential_access: '🔐',
  crypto_reward: '⚡',
  order: '📦',
  system: '⚙️',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'border-l-[hsl(0,85%,65%)] bg-[hsl(0_85%_60%/0.05)]',
  high: 'border-l-[hsl(30,100%,60%)] bg-[hsl(30_100%_55%/0.05)]',
  normal: 'border-l-transparent',
  low: 'border-l-transparent opacity-80',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationCenter() {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleOpen = () => {
    setOpen(o => !o);
    // Mark visible unread as read after a delay
    if (!open) {
      setTimeout(() => {
        const unread = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unread.length > 0) markRead(unread.slice(0, 10));
      }, 2000);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg hover:bg-[hsl(228_25%_12%)] transition-colors"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-muted-foreground" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[hsl(0,85%,60%)] text-white text-[9px] font-bold flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[600px] glass-panel-bright rounded-2xl border border-[hsl(185_100%_50%/0.2)] shadow-2xl shadow-black/50 z-50 slide-in-up overflow-hidden flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-[hsl(var(--border))]">
            <div className="flex items-center gap-2">
              <Bell size={15} className="text-[hsl(185,100%,55%)]" />
              <span className="text-sm font-bold" style={{ fontFamily: 'Orbitron' }}>NOTIFICATIONS</span>
              {unreadCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[hsl(0_85%_60%/0.2)] text-[hsl(0,85%,65%)] font-bold">{unreadCount} new</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-[hsl(228_25%_12%)] transition-colors">
                  <CheckCheck size={11} /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-[hsl(228_25%_12%)] transition-colors">
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox size={32} className="mb-3 opacity-30" />
                <div className="text-sm">No notifications yet</div>
                <div className="text-xs mt-1 opacity-60">Activity will appear here</div>
              </div>
            ) : (
              notifications.slice(0, 30).map(n => (
                <NotificationItem key={n.id} notification={n} onMarkRead={() => markRead([n.id])} />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationItem({ notification: n, onMarkRead }: { notification: VeloNotification; onMarkRead: () => void }) {
  return (
    <div
      onClick={onMarkRead}
      className={cn(
        'flex items-start gap-3 p-4 border-b border-[hsl(var(--border))] border-l-2 cursor-pointer hover:bg-[hsl(228_25%_10%/0.5)] transition-colors',
        PRIORITY_COLORS[n.priority] || 'border-l-transparent',
        !n.is_read && 'bg-[hsl(228_25%_10%/0.4)]'
      )}
    >
      <div className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? '🔔'}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-xs font-semibold truncate">{n.title}</span>
          {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[hsl(185,100%,55%)] flex-shrink-0" />}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{n.message}</p>
        <div className="text-[10px] text-muted-foreground mt-1 opacity-60">{timeAgo(n.created_at)}</div>
      </div>
    </div>
  );
}
