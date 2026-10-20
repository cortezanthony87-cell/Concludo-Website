import { SupabaseClient } from '@supabase/supabase-js';

export type UserNotificationKind =
  | 'message'
  | 'email'
  | 'calendar_invitation'
  | 'approval'
  | 'task'
  | 'shared_org_request'
  | 'system_alert';

export interface UserNotificationRecord {
  id: string;
  user_id: string;
  organization_id?: string | null;
  kind: UserNotificationKind;
  title: string;
  summary: string;
  source_room?: string | null;
  sender_name?: string | null;
  target_url: string;
  reference_id?: string | null;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export interface CreateNotificationInput {
  kind: UserNotificationKind;
  title: string;
  summary: string;
  source_room?: string | null;
  sender_name?: string | null;
  target_url?: string;
  reference_id?: string | null;
  organization_id?: string | null;
}

export interface NotifQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Fetch authenticated notifications for the active user.
 * Strictly queries public.user_notifications where user_id = auth.uid() and deleted_at is null.
 * Synthetic demonstration items are never inserted or queried here.
 */
export async function fetchUserNotifications(
  supabase: SupabaseClient
): Promise<NotifQueryResult<UserNotificationRecord[]>> {
  try {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { data: [], error: null };
    }

    const { data, error } = await supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as UserNotificationRecord[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch user notifications'),
    };
  }
}

/**
 * Create an authentic notification for the authenticated user.
 */
export async function createUserNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput
): Promise<NotifQueryResult<UserNotificationRecord>> {
  try {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return { data: null, error: new Error('User must be authenticated to receive notifications') };
    }

    const payload = {
      user_id: user.id,
      organization_id: input.organization_id || null,
      kind: input.kind,
      title: input.title.trim(),
      summary: input.summary.trim(),
      source_room: input.source_room || null,
      sender_name: input.sender_name || null,
      target_url: input.target_url || '/dashboard',
      reference_id: input.reference_id || null,
      is_read: false,
    };

    const { data, error } = await supabase
      .from('user_notifications')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as UserNotificationRecord, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create notification'),
    };
  }
}

/**
 * Mark a notification as read.
 */
export async function markNotificationAsRead(
  supabase: SupabaseClient,
  notificationId: string
): Promise<NotifQueryResult<boolean>> {
  try {
    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to mark notification read'),
    };
  }
}

/**
 * Mark all notifications as read for current user.
 */
export async function markAllNotificationsAsRead(
  supabase: SupabaseClient
): Promise<NotifQueryResult<boolean>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new Error('User not authenticated') };
    }

    const { error } = await supabase
      .from('user_notifications')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('is_read', false);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to mark all notifications read'),
    };
  }
}
