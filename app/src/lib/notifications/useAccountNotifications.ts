import { useEffect, useSyncExternalStore, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import { UserNotificationRecord } from './userNotificationsClient';
import { accountNotificationsStore } from './accountNotificationsStore';

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
 * 4. Listens to real-time postgres changes via accountNotificationsStore singleton.
 */
export function useAccountNotifications(): UseAccountNotificationsReturn {
  const { supabase, user } = useAuth();

  // Keep store synchronised with active auth state
  useEffect(() => {
    accountNotificationsStore.syncUser(supabase, user?.id || null);
  }, [supabase, user?.id]);

  // Subscribe to store updates via useSyncExternalStore
  useSyncExternalStore(
    (onStoreChange) => accountNotificationsStore.subscribe(onStoreChange),
    () => accountNotificationsStore.getVersion(),
    () => 0
  );

  const notifications = accountNotificationsStore.getNotifications();
  const unreadCount = accountNotificationsStore.getUnreadCount();
  const loading = accountNotificationsStore.isLoading();
  const error = accountNotificationsStore.getError();

  const refresh = useCallback(() => accountNotificationsStore.refresh(), []);
  const markAsRead = useCallback((id: string) => accountNotificationsStore.markAsRead(id), []);
  const markAllAsRead = useCallback(() => accountNotificationsStore.markAllAsRead(), []);

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
