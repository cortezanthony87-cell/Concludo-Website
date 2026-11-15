import { SupabaseClient } from '@supabase/supabase-js';

export interface AdminSession {
  id: string;
  created_at: string;
  updated_at: string;
  refreshed_at: string | null;
  ip: string | null;
  user_agent: string | null;
  is_active: boolean;
}

export interface AdminPresenceRecord {
  user_id: string;
  role: 'organization_owner' | 'organization_admin';
  joined_at: string;
  email: string;
  full_name: string;
  last_sign_in_at: string | null;
  last_seen_at: string;
  current_status: 'online' | 'offline';
  current_path: string | null;
  recent_sessions: AdminSession[];
}

export interface RealtimePresenceState {
  user_id: string;
  online_at: string;
}

/**
 * Format timestamp into Melbourne Australian English representation.
 */
/**
 * Format timestamp into Melbourne Australian English representation with timezone.
 */
export function formatMelbourneDateTime(
  date: string | Date | null | undefined,
  includeSeconds: boolean = false
): string {
  if (!date) return "Not recorded";
  const d = typeof date === "string" ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: includeSeconds ? "2-digit" : undefined,
    hour12: true,
    timeZoneName: "short",
  }).format(d);
}

export function formatMelbourneTime(date: string | Date | null | undefined): string {
  if (!date) return 'Not recorded';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return 'Not recorded';

  return new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Melbourne',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(d);
}

/**
 * Relative time description relative to current Melbourne moment.
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (!d || isNaN(d.getTime())) return 'Never';

  const now = Date.now();
  const diffSec = Math.floor((now - d.getTime()) / 1000);

  if (diffSec < 30) return 'Just now';
  if (diffSec < 60) return '< 1 min ago';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

  return formatMelbourneTime(d);
}

/**
 * Parse client browser and operating system platform from user agent.
 */
export function parseUserAgent(ua: string | null | undefined): { browser: string; os: string; isAutomated: boolean } {
  if (!ua) return { browser: 'Unknown Browser', os: 'Unknown OS', isAutomated: false };

  const isAutomated = /HeadlessChrome|Playwright|Puppeteer|bot|spider|crawl/i.test(ua);

  let os = 'Unknown OS';
  if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
  else if (/iPhone|iPad/i.test(ua)) os = 'iOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/Linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/HeadlessChrome\/([0-9.]+)/i.test(ua)) {
    browser = 'Headless Chrome (Automated / Test)';
  } else if (/SamsungBrowser\/([0-9.]+)/i.test(ua)) {
    browser = 'Samsung Internet';
  } else if (/Edg\/([0-9.]+)/i.test(ua)) {
    browser = 'Microsoft Edge';
  } else if (/Chrome\/([0-9.]+)/i.test(ua)) {
    browser = 'Google Chrome';
  } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
    browser = 'Apple Safari';
  } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
    browser = 'Mozilla Firefox';
  }

  return { browser, os, isAutomated };
}

/**
 * Fetch all organization admins with live presence records and session history.
 */
export async function fetchAdminPresence(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: AdminPresenceRecord[]; error: Error | null }> {
  try {
    const { data, error } = await supabase.rpc("get_organization_admin_presence", {
      p_org_id: orgId,
    });

    if (error) {
      return { data: [], error: new Error(error.message) };
    }

    let parsed = data;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        parsed = [];
      }
    }

    if (!Array.isArray(parsed)) {
      parsed = [];
    }

    return { data: parsed as AdminPresenceRecord[], error: null };
  } catch (err: any) {
    return { data: [], error: err instanceof Error ? err : new Error(String(err)) };
  }
}

/**
 * Send an activity heartbeat for the current administrator.
 */
export async function sendAdminHeartbeat(
  supabase: SupabaseClient,
  orgId: string,
  status: 'online' | 'offline' = 'online',
  currentPath?: string
): Promise<void> {
  try {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : null;
    await supabase.rpc('record_admin_heartbeat', {
      p_org_id: orgId,
      p_status: status,
      p_current_path: currentPath || (typeof window !== 'undefined' ? window.location.pathname : null),
      p_user_agent: ua,
    });
  } catch (err) {
    // Non-blocking telemetry error
    console.warn('[AdminPresence] Heartbeat failed:', err);
  }
}

/**
 * Real-time subscription to Supabase Presence and table changes.
 */
export function subscribeToAdminPresence(
  supabase: SupabaseClient,
  orgId: string,
  user: { id: string },
  onPresenceChange: (onlineUserIds: Set<string>) => void,
  onDatabaseUpdate: () => void
): () => void {
  const onlineUsers = new Set<string>();

  // Clean up any stale existing channels with this topic first
  try {
    const existingChannels = supabase.getChannels();
    for (const ch of existingChannels) {
      if (ch.topic === `realtime:org-presence-${orgId}` || ch.topic === `realtime:admin-presence-db-${orgId}`) {
        supabase.removeChannel(ch);
      }
    }
  } catch (e) {
    // Ignore cleanup warning
  }

  // 1. Supabase Realtime Presence Channel
  const presenceChannel = supabase.channel(`org-presence-${orgId}`, {
    config: {
      presence: {
        key: user.id,
      },
    },
  });

  presenceChannel
    .on('presence', { event: 'sync' }, () => {
      const state = presenceChannel.presenceState();
      onlineUsers.clear();
      Object.keys(state).forEach((key) => {
        onlineUsers.add(key);
      });
      onPresenceChange(new Set(onlineUsers));
    })
    .on('presence', { event: 'join' }, ({ key }) => {
      onlineUsers.add(key);
      onPresenceChange(new Set(onlineUsers));
    })
    .on('presence', { event: 'leave' }, ({ key }) => {
      onlineUsers.delete(key);
      onPresenceChange(new Set(onlineUsers));
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        try {
          await presenceChannel.track({
            user_id: user.id,
            online_at: new Date().toISOString(),
          });
        } catch (e) {
          console.warn('[AdminPresence] Track failed:', e);
        }
      }
    });

  // 2. Postgres CDC Channel for admin_presence table changes
  const dbChannel = supabase
    .channel(`admin-presence-db-${orgId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'admin_presence',
        filter: `organization_id=eq.${orgId}`,
      },
      () => {
        onDatabaseUpdate();
      }
    )
    .subscribe();

  // Return teardown function
  return () => {
    try {
      presenceChannel.untrack();
      supabase.removeChannel(presenceChannel);
      supabase.removeChannel(dbChannel);
      sendAdminHeartbeat(supabase, orgId, 'offline').catch(() => {});
    } catch (e) {
      console.warn('[AdminPresence] Cleanup error:', e);
    }
  };
}
