import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import {
  UserNotificationRecord,
  fetchUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from './userNotificationsClient';

type Listener = () => void;

/**
 * Singleton store managing authentic account notifications and real-time synchronisation.
 *
 * ARCHITECTURE:
 * 1. Guarantees exactly ONE active RealtimeChannel per authenticated user, preventing the
 *    "cannot add `postgres_changes` callbacks after `subscribe()`" error when multiple
 *    components (WorkspaceLayout, NotificationCentreModal) subscribe.
 * 2. Unsubscribes and cleans up channel properly on user switch or sign out.
 * 3. Never falls back to mock or synthetic data on authentic accounts.
 */
export class AccountNotificationsStore {
  private notifications: UserNotificationRecord[] = [];
  private loading = false;
  private error: Error | null = null;
  private activeUserId: string | null = null;
  private activeClient: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private listeners = new Set<Listener>();
  private version = 0;

  public subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emitChange(): void {
    this.version += 1;
    for (const listener of this.listeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in notifications listener:', err);
      }
    }
  }

  public getVersion(): number {
    return this.version;
  }

  public getNotifications(): UserNotificationRecord[] {
    return this.notifications;
  }

  public getUnreadCount(): number {
    return this.notifications.filter((n) => !n.is_read).length;
  }

  public isLoading(): boolean {
    return this.loading;
  }

  public getError(): Error | null {
    return this.error;
  }

  /**
   * Synchronises the store with the active Supabase client and user session.
   * Re-uses existing channel if user has not changed.
   */
  public syncUser(supabase: SupabaseClient | null, userId: string | null): void {
    if (!userId || !supabase) {
      if (this.activeUserId) {
        this.cleanupChannel();
        this.activeUserId = null;
        this.activeClient = null;
        this.notifications = [];
        this.loading = false;
        this.error = null;
        this.emitChange();
      }
      return;
    }

    if (this.activeUserId === userId && this.channel) {
      // Already attached and listening
      return;
    }

    // If user changed, tear down old channel first
    if (this.activeUserId && this.activeUserId !== userId) {
      this.cleanupChannel();
      this.notifications = [];
    }

    this.activeUserId = userId;
    this.activeClient = supabase;

    this.refresh();
    this.initRealtimeChannel(supabase, userId);
  }

  public async refresh(): Promise<void> {
    if (!this.activeClient || !this.activeUserId) {
      this.notifications = [];
      this.loading = false;
      this.emitChange();
      return;
    }

    try {
      this.loading = true;
      this.emitChange();

      const res = await fetchUserNotifications(this.activeClient);
      if (res.error) {
        this.error = res.error;
      } else {
        this.notifications = res.data || [];
        this.error = null;
      }
    } catch (err: any) {
      this.error = err instanceof Error ? err : new Error('Failed to load notifications');
    } finally {
      this.loading = false;
      this.emitChange();
    }
  }

  private initRealtimeChannel(supabase: SupabaseClient, userId: string): void {
    try {
      // Check if channel already exists in client to prevent duplicate registration
      const channelName = `user_notifications:${userId}`;
      const existing = supabase.getChannels().find((c) => c.topic === `realtime:${channelName}`);
      if (existing) {
        supabase.removeChannel(existing);
      }

      const chan = supabase.channel(channelName);
      chan.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_notifications',
          filter: `user_id=eq.${userId}`,
        },
        () => {
          this.refresh();
        }
      );

      chan.subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('Realtime channel error on user_notifications, falling back to manual refresh');
        }
      });

      this.channel = chan;
    } catch (err) {
      console.warn('Failed to initialise realtime notifications channel:', err);
    }
  }

  private cleanupChannel(): void {
    if (this.channel && this.activeClient) {
      try {
        this.activeClient.removeChannel(this.channel);
      } catch (err) {
        console.warn('Failed to remove realtime channel:', err);
      }
      this.channel = null;
    }
  }

  public async markAsRead(id: string): Promise<void> {
    if (!this.activeClient) return;
    // Optimistic local update
    this.notifications = this.notifications.map((n) =>
      n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
    );
    this.emitChange();

    try {
      await markNotificationAsRead(this.activeClient, id);
    } catch (err) {
      console.warn('Failed to mark notification read on server:', err);
    }
  }

  public async markAllAsRead(): Promise<void> {
    if (!this.activeClient) return;
    // Optimistic local update
    const now = new Date().toISOString();
    this.notifications = this.notifications.map((n) => ({ ...n, is_read: true, read_at: now }));
    this.emitChange();

    try {
      await markAllNotificationsAsRead(this.activeClient);
    } catch (err) {
      console.warn('Failed to mark all notifications read on server:', err);
    }
  }
}

export const accountNotificationsStore = new AccountNotificationsStore();
