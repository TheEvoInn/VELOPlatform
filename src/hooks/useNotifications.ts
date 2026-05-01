import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getNotifications, markNotificationsRead, markAllNotificationsRead } from '@/lib/api';
import { toast } from 'sonner';

export interface VeloNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high' | 'critical';
  created_at: string;
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<VeloNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const loadNotifications = useCallback(async () => {
    const { data, error } = await getNotifications();
    if (!error && data) {
      setNotifications(data as VeloNotification[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadNotifications();

    // Poll for new notifications every 15 seconds (backend doesn't support realtime)
    const interval = setInterval(loadNotifications, 15000);

    // Also subscribe to DB changes via polling on insert
    const checkNew = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5);

      if (data?.length) {
        data.forEach(n => {
          const existing = notifications.find(x => x.id === n.id);
          if (!existing) {
            // New notification - show toast
            const toastFn = n.priority === 'critical' || n.priority === 'high' ? toast.error : toast.success;
            if (n.priority === 'high' || n.priority === 'critical') {
              toast.error(n.title, { description: n.message });
            } else {
              toast.success(n.title, { description: n.message });
            }
          }
        });
        setNotifications(prev => {
          const ids = new Set(prev.map(p => p.id));
          const newOnes = (data as VeloNotification[]).filter(d => !ids.has(d.id));
          return newOnes.length ? [...newOnes, ...prev] : prev;
        });
      }
    };

    const newCheckInterval = setInterval(checkNew, 8000);

    return () => {
      clearInterval(interval);
      clearInterval(newCheckInterval);
    };
  }, [loadNotifications]);

  const markRead = useCallback(async (ids: string[]) => {
    await markNotificationsRead(ids);
    setNotifications(prev => prev.map(n => ids.includes(n.id) ? { ...n, is_read: true } : n));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllNotificationsRead();
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  }, []);

  const addLocal = useCallback((notif: Omit<VeloNotification, 'id' | 'created_at' | 'is_read'>) => {
    const n: VeloNotification = {
      ...notif,
      id: `local_${Date.now()}`,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setNotifications(prev => [n, ...prev]);
    if (n.priority === 'high' || n.priority === 'critical') {
      toast.error(n.title, { description: n.message });
    } else {
      toast.success(n.title, { description: n.message });
    }
  }, []);

  return { notifications, unreadCount, loading, markRead, markAllRead, addLocal, reload: loadNotifications };
}
