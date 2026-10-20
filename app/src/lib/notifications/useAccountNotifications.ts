import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  UserNotificationRecord,
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './userNotificationsClient';

export interface UseAccountNotificationsReturn {
  notifications: UserNotificationRecord[];
  unreadCount: number;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

/**
 * Hook for authentic user notifications.
 *
 * STRICT PRIVACY GUARANTEE:
 * 1. Queries only public.user_notifications for the active authenticated user (auth.uid()).
 * 2. If no user is logged in, returns an empty array and unreadCount = 0.
 * 3. Synthetic demonstration events and mock data are NEVER returned here.
 * 4. Listens to real-time postgres changes on public.user_notifications for the active user.
 */
export function useAccountNotifications(): UseAccountNotificationsReturn {
  const { supabase, user } = useAuth();
  const [notifications, setNotifications] = useState<UserNotificationRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!user || !supabase) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const res = await fetchUserNotifications(supabase);
      if (res.error) {
        setError(res.error);
      } else {
        setNotifications(res.data || []);
        setError(null);
      }
    } catch (err: any) {
      setError(err instanceof Error ? err : new Error('Failed to load notifications'));
    } finally {
      setLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    refresh();

    if (!user || !supabase) return;

    // Real-time subscription to user_notifications table for this user
    const channel = supabase
      .channel(`user_notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, supabase, refresh]);

  const markAsRead = useCallback(
    async (id: string) => {
      if (!supabase) return;
      // Optimistic update
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n))
      );
      await markNotificationAsRead(supabase, id);
    },
    [supabase]
  );

  const markAllAsRead = useCallback(async () => {
    if (!supabase) return;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
    );
    await markAllNotificationsAsRead(supabase);
  }, [supabase]);

  const unreadCount = useMemo(() => {
    return notifications.filter((n) => !n.is_read).length;
  }, [notifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markAsRead,
    markAllAsRead,
  };
}
