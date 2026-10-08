/**
 * Concludo app catalogue: what each app card says and which button it shows.
 *
 * Reads two things the server owns:
 *   - integration_providers.availability (available, coming_soon, not_planned)
 *   - the user's integration_connections row, through connectionStatus.ts
 *
 * The browser never decides that an app works. An app is only connectable when
 * the server has marked it available, and only shows Connected when
 * connectionStatus.isUsable() says so.
 */

import { describeStatus, isUsable, type ConnectionEvidence, type StatusTone } from './connectionStatus';

export type Availability = 'available' | 'coming_soon' | 'not_planned';
export type ProviderFamily = 'microsoft' | 'google' | string;

export interface CatalogueApp {
  id: string;
  name: string;
  category: string;
  description: string;
  provider_family?: ProviderFamily | null;
  availability: Availability | string;
  availability_note?: string | null;
  requires_admin_consent?: boolean | null;
  sort_order?: number | null;
}

export type CardAction = 'connect' | 'reconnect' | 'review_permissions' | 'test' | 'try_again' | 'cancel' | 'notify' | 'none';

export interface AppCardState {
  badge: string;
  tone: StatusTone;
  action: CardAction;
  actionLabel?: string;
  /** One line under the app name. Never shows a typed email as an account. */
  detail: string;
}

const FAMILY_SIGN_IN_PAGE: Record<string, string> = {
  microsoft: "Microsoft's",
  google: "Google's",
};

const FAMILY_LABEL: Record<string, string> = {
  microsoft: 'Microsoft 365',
  google: 'Google Workspace',
};

export const APP_PERMISSIONS_SUMMARY: Record<string, { willBeAbleTo: string; willNot: string }> = {
  microsoft_outlook: {
    willBeAbleTo: 'send emails from your mailbox after you approve each one in Concludo',
    willNot: 'read your email',
  },
  microsoft_outlook_calendar: {
    willBeAbleTo: 'see your calendars and add events you approve',
    willNot: 'change events you did not approve in Concludo',
  },
  microsoft_teams: {
    willBeAbleTo: 'see your teams and channels, and post messages you approve',
    willNot: 'read channel or chat messages',
  },
  microsoft_todo: {
    willBeAbleTo: 'see your task lists and add tasks you approve',
    willNot: 'change tasks you did not approve in Concludo',
  },
  gmail: {
    willBeAbleTo: 'send emails from your account after you approve each one in Concludo',
    willNot: 'read your email',
  },
  google_calendar: {
    willBeAbleTo: 'see your events and add events you approve',
    willNot: 'change events you did not approve in Concludo, or change your calendar settings',
  },
  google_sheets: {
    willBeAbleTo: 'add rows to sheets you pick',
    willNot: 'open any sheet you have not picked',
  },
  google_drive: {
    willBeAbleTo: 'save documents to folders you pick',
    willNot: 'open any file you have not picked or that Concludo did not create',
  },
};

export function normaliseAvailability(value: string | null | undefined): Availability {
  return value === 'available' || value === 'not_planned' ? value : 'coming_soon';
}

/** Name of the page the customer signs in on, for example "Microsoft's" or "Google's". */
export function signInPageOwner(app: Pick<CatalogueApp, 'name' | 'provider_family'>): string {
  const family = app.provider_family || '';
  return FAMILY_SIGN_IN_PAGE[family] ?? `${app.name}'s`;
}

export function familyLabel(family: string | null | undefined): string {
  return FAMILY_LABEL[family || ''] ?? 'Other apps';
}

/**
 * What the card shows.
 * @param requested true when this user already asked to be told when the app is ready
 */
export function appCardState(app: CatalogueApp, connection?: ConnectionEvidence | null, requested = false): AppCardState {
  const availability = normaliseAvailability(app.availability);

  if (availability === 'not_planned') {
    return { badge: 'Not available', tone: 'neutral', action: 'none', detail: app.availability_note || 'Concludo does not plan to support this app yet.' };
  }

  if (availability === 'coming_soon') {
    return requested
      ? { badge: 'Coming soon', tone: 'neutral', action: 'none', detail: 'Requested. Thanks for telling us you want this app.' }
      : { badge: 'Coming soon', tone: 'neutral', action: 'notify', actionLabel: 'I want this app', detail: app.availability_note || 'This connection is being set up.' };
  }

  // available
  if (!connection || ['not_connected', 'disconnected'].includes(describeStatus(connection).status)) {
    return {
      badge: 'Not connected',
      tone: 'neutral',
      action: 'connect',
      actionLabel: 'Connect',
      detail: app.requires_admin_consent ? 'Your Microsoft 365 or Google administrator may need to approve this.' : app.description,
    };
  }

  const meta = describeStatus(connection);
  return {
    badge: meta.label,
    tone: meta.tone,
    action: (meta.action === 'test_later' ? 'test' : meta.action) as CardAction,
    actionLabel: meta.actionLabel,
    detail: meta.description,
  };
}

/** Copy for the panel that opens from a card. Plain English, no dashes. */
export function connectPanelCopy(app: CatalogueApp): {
  title: string;
  body: string[];
  primary?: string;
  permissions?: { willBeAbleTo: string; willNot: string };
} {
  const owner = signInPageOwner(app);
  const availability = normaliseAvailability(app.availability);
  const how = `You will connect ${app.name} by signing in on ${owner} own page. You will see exactly what Concludo is asking for and approve it there. Concludo never sees your password.`;

  if (availability === 'available') {
    const body = [how];
    if (app.requires_admin_consent) body.push('Your administrator may need to approve Concludo before you can finish.');
    return {
      title: `Connect ${app.name}`,
      body,
      primary: `Continue to ${owner.replace(/'s$/, '')} sign-in`,
      permissions: APP_PERMISSIONS_SUMMARY[app.id],
    };
  }
  if (availability === 'not_planned') {
    return { title: app.name, body: [app.availability_note || 'Concludo does not plan to support this app yet.'] };
  }
  return {
    title: `${app.name} is coming soon`,
    body: [how, 'This connection is being set up. Tell us you want it and we will prioritise it.'],
    primary: 'I want this app',
  };
}

/** The independence line shown on every page that names a third-party app. */
export function independenceLine(): string {
  return 'Concludo is an independent product. It is not affiliated with or endorsed by Microsoft, Google or any other app maker, device maker, meeting platform or note-taking service named here.';
}

/** Catalogue order: Microsoft 365, Google Workspace, then everything else; within a group by sort order, then name. */
export function sortCatalogue<T extends CatalogueApp>(apps: T[]): T[] {
  const familyRank = (f?: string | null) => (f === 'microsoft' ? 0 : f === 'google' ? 1 : 2);
  return [...apps].sort(
    (a, b) =>
      familyRank(a.provider_family) - familyRank(b.provider_family) ||
      (a.sort_order ?? 1000) - (b.sort_order ?? 1000) ||
      a.name.localeCompare(b.name, 'en-AU'),
  );
}

/** Counts for a dashboard tile. Only usable connections count as connected. */
export function connectedCount(connections: ConnectionEvidence[]): number {
  return connections.filter(isUsable).length;
}

export function connectionResultText(
  result: 'connected' | 'cancelled' | 'failed' | 'permission_required' | 'admin_required' | 'unavailable',
  appName: string,
  accountLabel?: string,
): string {
  switch (result) {
    case 'connected':
      return `${appName} is connected and verified.${accountLabel ? ` Signed in as ${accountLabel}.` : ''}`;
    case 'cancelled':
      return 'Sign-in was cancelled. You can try again when you are ready.';
    case 'failed':
      return `Concludo couldn't finish connecting to ${appName}. Try again. If it keeps happening, contact hello@concludo.au.`;
    case 'permission_required':
      return `${appName} didn't give Concludo everything it needs. Connect again and approve all the permissions shown.`;
    case 'admin_required':
      return 'Your organisation needs a Microsoft 365 administrator to approve Concludo before you can connect. Send them this page.';
    case 'unavailable':
      return `${appName} isn't responding right now. Concludo will check again later.`;
  }
}
