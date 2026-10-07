/**
 * Concludo connection status: one vocabulary for the database, server and browser.
 *
 * Rule: only the server may say a connection works, and only after a real call
 * to the provider succeeded. This module never decides that. It only reads what
 * the server stored and turns it into words, colours and the next action.
 *
 * Matches the CHECK constraint in
 * supabase/migrations/20261006100000_connection_status_truth.sql.
 */

export const CONNECTION_STATUSES = [
  'not_connected',
  'authorising',
  'verifying',
  'connected',
  'failed',
  'reauth_required',
  'permission_required',
  'expired',
  'provider_unavailable',
  'disconnected',
  'unverified',
] as const;

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

/** Four colours on screen. Green ('ok') is used for exactly one status. */
export type StatusTone = 'ok' | 'attention' | 'failed' | 'neutral';

export type NextAction =
  | 'connect'
  | 'cancel'
  | 'none'
  | 'test'
  | 'try_again'
  | 'reconnect'
  | 'review_permissions'
  | 'test_later';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** One plain sentence, no jargon, no secrets. */
  description: string;
  action: NextAction;
  actionLabel?: string;
}

export const CONNECTION_STATUS_META: Record<ConnectionStatus, StatusMeta> = {
  not_connected: {
    label: 'Not connected',
    tone: 'neutral',
    description: 'Concludo is not connected to this app.',
    action: 'connect',
    actionLabel: 'Connect',
  },
  authorising: {
    label: 'Waiting for sign-in',
    tone: 'neutral',
    description: 'Finish signing in on the app’s own page.',
    action: 'cancel',
    actionLabel: 'Cancel',
  },
  verifying: {
    label: 'Checking the connection',
    tone: 'neutral',
    description: 'Concludo is making a test call to the app.',
    action: 'none',
  },
  connected: {
    label: 'Connected and verified',
    tone: 'ok',
    description: 'Concludo has successfully communicated with this app.',
    action: 'test',
    actionLabel: 'Test connection',
  },
  failed: {
    label: 'Couldn’t connect',
    tone: 'failed',
    description: 'The connection did not complete.',
    action: 'try_again',
    actionLabel: 'Try again',
  },
  reauth_required: {
    label: 'Reconnect required',
    tone: 'attention',
    description: 'Your sign-in has expired or was revoked.',
    action: 'reconnect',
    actionLabel: 'Reconnect',
  },
  permission_required: {
    label: 'Permission needed',
    tone: 'attention',
    description: 'The app has not allowed Concludo to do something a workflow needs.',
    action: 'review_permissions',
    actionLabel: 'Review permissions',
  },
  expired: {
    label: 'Connection expired',
    tone: 'attention',
    description: 'The connection has lapsed and needs a fresh sign-in.',
    action: 'reconnect',
    actionLabel: 'Reconnect',
  },
  provider_unavailable: {
    label: 'App not responding',
    tone: 'attention',
    description: 'The app is not responding. Workflows that use it are paused until it recovers.',
    action: 'test_later',
    actionLabel: 'Test again',
  },
  disconnected: {
    label: 'Disconnected',
    tone: 'neutral',
    description: 'This connection was disconnected.',
    action: 'connect',
    actionLabel: 'Connect',
  },
  unverified: {
    label: 'Not verified',
    tone: 'neutral',
    description: 'Added before Concludo checked connections with the app. Reconnect to verify.',
    action: 'reconnect',
    actionLabel: 'Reconnect',
  },
};

/** Values written before 6 October 2026. Read them, never write them. */
const LEGACY_STATUS_MAP: Record<string, ConnectionStatus> = {
  connected: 'unverified', // only when there is no verification evidence; see normaliseStatus
  needs_reauth: 'reauth_required',
  service_issue: 'provider_unavailable',
  setup_required: 'not_connected',
};

export interface ConnectionEvidence {
  status: string;
  verified_at?: string | null;
  last_test_at?: string | null;
  last_test_result?: string | null;
}

/**
 * The status to show. Anything unknown, and any 'connected' without evidence,
 * is shown as not verified. The browser can never upgrade a status.
 */
export function normaliseStatus(conn: ConnectionEvidence): ConnectionStatus {
  const raw = (conn.status || '').trim();
  if (raw === 'connected') {
    return hasVerificationEvidence(conn) ? 'connected' : 'unverified';
  }
  if ((CONNECTION_STATUSES as readonly string[]).includes(raw)) return raw as ConnectionStatus;
  if (raw in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[raw];
  return 'unverified';
}

export function hasVerificationEvidence(conn: ConnectionEvidence): boolean {
  return Boolean(conn.verified_at) && conn.last_test_result === 'success';
}

/** True only when a workflow may rely on this connection. */
export function isUsable(conn: ConnectionEvidence): boolean {
  return normaliseStatus(conn) === 'connected';
}

/** A verified connection not checked within `hours` must be re-tested before activation. */
export function needsRecheck(conn: ConnectionEvidence, now: Date = new Date(), hours = 24): boolean {
  if (!isUsable(conn)) return true;
  const last = conn.last_test_at || conn.verified_at;
  if (!last) return true;
  return now.getTime() - new Date(last).getTime() > hours * 3600 * 1000;
}

export function describeStatus(conn: ConnectionEvidence): StatusMeta & { status: ConnectionStatus } {
  const status = normaliseStatus(conn);
  return { status, ...CONNECTION_STATUS_META[status] };
}

/**
 * "Last checked 6 Oct 2026, 10:43 am" in Australian English, or "Never checked".
 * Pass the user's time zone; defaults to Melbourne.
 */
export function lastCheckedText(conn: ConnectionEvidence, timeZone = 'Australia/Melbourne'): string {
  const last = conn.last_test_at || conn.verified_at;
  if (!last) return 'Never checked';
  const d = new Date(last);
  const date = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric', timeZone }).format(d);
  const time = new Intl.DateTimeFormat('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .format(d)
    .replace(/\s?([ap])\.?m\.?/i, (_m, p) => ` ${p.toLowerCase()}m`);
  return `Last checked ${date}, ${time}`;
}

/** Sort order for lists: problems first, then verified, then the rest. */
export function statusSortRank(conn: ConnectionEvidence): number {
  const status = normaliseStatus(conn);
  const tone = CONNECTION_STATUS_META[status].tone;
  if (tone === 'failed') return 0;
  if (tone === 'attention') return 1;
  if (status === 'unverified') return 2;
  if (tone === 'ok') return 3;
  return 4;
}
