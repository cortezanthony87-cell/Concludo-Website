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
  microsoft_excel: {
    willBeAbleTo: 'read and update spreadsheets you choose after you approve each change in Concludo',
    willNot: 'open spreadsheets you have not picked or change files without approval',
  },
  microsoft_onedrive: {
    willBeAbleTo: 'save documents and access folders you pick',
    willNot: 'open any file you have not picked or delete files without approval',
  },
  microsoft_onenote: {
    willBeAbleTo: 'create notes and sections in notebooks you pick after you approve each one',
    willNot: 'delete or modify existing notebook sections without approval',
  },
  microsoft_planner: {
    willBeAbleTo: 'view plans and create tasks you approve in Concludo',
    willNot: 'change or delete existing tasks without approval',
  },
  microsoft_sharepoint: {
    willBeAbleTo: 'save documents and sync files to SharePoint sites you choose',
    willNot: 'access sites you have not picked or change site settings',
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
  linkedin: {
    willBeAbleTo: 'publish posts and updates you review and approve in Concludo',
    willNot: 'publish to your LinkedIn profile or modify your profile without your explicit approval',
  },
  google_ads: {
    willBeAbleTo: 'view campaign performance and apply ad changes you approve in Concludo',
    willNot: 'change your campaigns or spend without your explicit human approval',
  },
  google_docs: {
    willBeAbleTo: 'save meeting summaries and documentation to Google Docs you pick',
    willNot: 'open any document you have not selected or change files without approval',
  },
  google_tasks: {
    willBeAbleTo: 'create tasks from approved meeting actions in Google Tasks',
    willNot: 'delete or modify existing tasks you did not select',
  },
  stripe: {
    willBeAbleTo: 'view customer transactions, subscription statuses, and invoice events you approve in Concludo',
    willNot: 'transfer funds, modify payout bank accounts, or charge customers without approval',
  },
  xero: {
    willBeAbleTo: 'view accounting invoices, contacts, and transactions you approve in Concludo',
    willNot: 'submit tax lodgements, alter financial settings, or delete ledger records',
  },
  myob: {
    willBeAbleTo: 'read and sync invoice and customer records you approve in Concludo',
    willNot: 'modify bank accounts or delete existing accounting entries',
  },
  quickbooks: {
    willBeAbleTo: 'view invoices, customers, and payment receipts you approve in Concludo',
    willNot: 'delete transactions or alter bank account connections',
  },
  paypal: {
    willBeAbleTo: 'view transaction summaries and payment dispute notices',
    willNot: 'transfer funds or change payment recipient settings',
  },
  slack: {
    willBeAbleTo: 'post meeting summaries, action cards, and notifications to channels you choose',
    willNot: 'read private direct messages or post to channels you have not selected',
  },
  hubspot: {
    willBeAbleTo: 'read and sync contacts, companies, and deals you approve in Concludo',
    willNot: 'delete CRM records or send marketing campaigns without approval',
  },
  notion: {
    willBeAbleTo: 'create pages, databases, and meeting action items in workspace areas you pick',
    willNot: 'access pages or workspaces you have not granted access to',
  },
  asana: {
    willBeAbleTo: 'create tasks, set due dates, and update project actions you approve',
    willNot: 'delete projects or modify tasks you did not select',
  },
  monday: {
    willBeAbleTo: 'create board items, status updates, and action tasks you approve in Concludo',
    willNot: 'delete boards or change workspace permissions',
  },
  clickup: {
    willBeAbleTo: 'create tasks, checklists, and assignees in spaces you choose',
    willNot: 'delete spaces or change team permissions',
  },
  jira: {
    willBeAbleTo: 'create issues, update action tickets, and sync meeting decisions',
    willNot: 'modify project schemes or delete user access',
  },
  trello: {
    willBeAbleTo: 'create cards and checklists on boards you select',
    willNot: 'delete boards or modify team settings',
  },
  airtable: {
    willBeAbleTo: 'add rows and sync action records to bases you pick',
    willNot: 'delete bases or access tables you have not selected',
  },
  smartsheet: {
    willBeAbleTo: 'add rows and sync action items to sheets you pick',
    willNot: 'delete sheets or modify workspace access',
  },
  shopify: {
    willBeAbleTo: 'view order summaries, customers, and product metrics you approve',
    willNot: 'modify store payout details or delete product listings',
  },
  woocommerce: {
    willBeAbleTo: 'view store orders and customer action summaries',
    willNot: 'modify store settings or delete order records',
  },
  openai: {
    willBeAbleTo: 'send structured prompts and receive AI completions using your API key',
    willNot: 'access your OpenAI account billing or share your key with third parties',
  },
  anthropic_claude: {
    willBeAbleTo: 'send structured prompts and receive Claude analysis using your API key',
    willNot: 'access your Anthropic account billing or share your key with third parties',
  },
  twilio: {
    willBeAbleTo: 'send SMS alerts and notifications you approve in Concludo',
    willNot: 'modify phone number purchases or change account credentials',
  },
  webhooks: {
    willBeAbleTo: 'dispatch real-time meeting and action events to your secure webhook URL',
    willNot: 'send unverified payloads or execute external mutations without approval',
  },
  generic_http: {
    willBeAbleTo: 'send authenticated HTTP requests to your configured API endpoints',
    willNot: 'store plain-text bearer secrets or call unauthorised endpoints',
  },
  zoom: {
    willBeAbleTo: 'view scheduled meetings and sync approved follow-up summaries',
    willNot: 'start meetings automatically or delete recording archives',
  },
  discord: {
    willBeAbleTo: 'post meeting summaries and action notifications to Discord channels you choose',
    willNot: 'read direct messages or modify server roles',
  },
  dropbox: {
    willBeAbleTo: 'save summaries and exported files to folders you pick',
    willNot: 'open files you have not selected or delete existing content',
  },
  box: {
    willBeAbleTo: 'save summaries and sync documentation to Box folders you pick',
    willNot: 'access enterprise folders you have not selected',
  },
  typeform: {
    willBeAbleTo: 'receive form responses and import survey feedback into Concludo',
    willNot: 'delete form definitions or modify question structures',
  },
  jotform: {
    willBeAbleTo: 'import form submissions and customer inquiries',
    willNot: 'delete forms or access unlinked submissions',
  },
  mailchimp: {
    willBeAbleTo: 'sync approved subscriber contacts and view campaign performance',
    willNot: 'send email campaigns without your explicit human approval',
  },
  activecampaign: {
    willBeAbleTo: 'sync approved contact records and automation trigger events',
    willNot: 'send broadcast emails without your explicit approval',
  },
  klaviyo: {
    willBeAbleTo: 'sync customer profiles and event metrics you approve',
    willNot: 'modify SMS or email campaign templates without approval',
  },
  zendesk: {
    willBeAbleTo: 'create and update support tickets from approved meeting actions',
    willNot: 'delete tickets or alter helpdesk routing rules',
  },
  intercom: {
    willBeAbleTo: 'create user notes and sync customer conversation action items',
    willNot: 'send automated messages to users without approval',
  },
  freshdesk: {
    willBeAbleTo: 'create and update support tickets you approve',
    willNot: 'delete tickets or change portal settings',
  },
  salesforce: {
    willBeAbleTo: 'view and update leads, contacts, and opportunities you approve',
    willNot: 'delete CRM records or alter organizational security controls',
  },
  pipedrive: {
    willBeAbleTo: 'sync deals, activities, and contact notes you approve',
    willNot: 'delete pipelines or change company stages',
  },
  zoho_crm: {
    willBeAbleTo: 'view leads, accounts, and contact activities you choose',
    willNot: 'delete records or modify system setup',
  },
  microsoft_forms: {
    willBeAbleTo: 'read responses from forms you choose and import survey data',
    willNot: 'delete forms or change form access settings',
  },
  microsoft_entra_id: {
    willBeAbleTo: 'read user profile and team directory details you approve',
    willNot: 'modify directory passwords or administrative roles',
  },
  power_bi: {
    willBeAbleTo: 'view workspace reports and export dashboard metrics you select',
    willNot: 'delete reports or modify data source connections',
  },
  dynamics_365: {
    willBeAbleTo: 'view and sync business contacts and accounts you approve',
    willNot: 'delete entities or alter Dynamics administration settings',
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
 * Returns true if the provider connects via Concludo Native OAuth ($0 third-party fees).
 */
export function isNativeOAuthProvider(app: { id?: string; provider_family?: string | null }): boolean {
  const family = (app.provider_family || '').toLowerCase();
  const id = (app.id || '').toLowerCase();
  return (
    family === 'google' ||
    family === 'microsoft' ||
    id.startsWith('google') ||
    id.startsWith('microsoft') ||
    id === 'onedrive' ||
    id === 'sharepoint'
  );
}

/**
 * Returns true if the provider connects directly with API key, bearer token, or webhook ($0 third-party fees).
 */
export function isDirectKeyProvider(app: { id?: string; authentication_type?: string | null }): boolean {
  const authType = (app.authentication_type || '').toLowerCase();
  const id = (app.id || '').toLowerCase();
  return (
    authType === 'api_key' ||
    authType === 'bearer' ||
    authType === 'webhook_signature' ||
    authType === 'none' ||
    id === 'stripe' ||
    id === 'openai' ||
    id === 'anthropic_claude' ||
    id === 'twilio' ||
    id === 'webhooks' ||
    id === 'generic_http' ||
    id === 'sftp_universal' ||
    id === 'email_universal' ||
    id === 'activecampaign' ||
    id === 'freshdesk' ||
    id === 'jotform' ||
    id === 'klaviyo' ||
    id === 'woocommerce'
  );
}

export interface CredentialFieldInfo {
  label: string;
  placeholder: string;
  help: string;
  requiresSecondary?: boolean;
  secondaryLabel?: string;
  secondaryPlaceholder?: string;
  secondaryKey?: string;
}

export function getCredentialFieldInfo(provider: { id: string; name: string }): CredentialFieldInfo {
  const id = (provider.id || '').toLowerCase();
  if (id === 'linkedin') {
    return {
      label: 'LinkedIn Access Token or App Secret',
      placeholder: 'Enter LinkedIn token or app secret',
      help: 'Found in your LinkedIn Developer Portal under Auth > OAuth 2.0 tools.',
    };
  }
  if (id === 'stripe') {
    return {
      label: 'Stripe Secret Key or Restricted Key',
      placeholder: 'rk_live_... or sk_live_...',
      help: 'Found in your Stripe Dashboard under Developers > API keys.',
    };
  }
  if (id === 'openai') {
    return {
      label: 'OpenAI API Key',
      placeholder: 'sk-...',
      help: 'Found in your OpenAI Platform under Settings > API Keys.',
    };
  }
  if (id === 'anthropic_claude') {
    return {
      label: 'Anthropic Claude API Key',
      placeholder: 'sk-ant-...',
      help: 'Found in your Anthropic Console under API Keys.',
    };
  }
  if (id === 'slack') {
    return {
      label: 'Slack Bot Token or User Token',
      placeholder: 'xoxb-... or xoxp-...',
      help: 'Found in your Slack App under OAuth & Permissions > Bot User OAuth Token.',
    };
  }
  if (id === 'hubspot') {
    return {
      label: 'HubSpot Private App Access Token',
      placeholder: 'pat-na1-... or pat-eu1-...',
      help: 'Found in HubSpot Settings > Integrations > Private Apps.',
    };
  }
  if (id === 'notion') {
    return {
      label: 'Notion Internal Integration Secret',
      placeholder: 'secret_...',
      help: 'Found at notion.so/profile/integrations under Internal Integration Token.',
    };
  }
  if (id === 'shopify') {
    return {
      label: 'Admin API Access Token',
      placeholder: 'shpat_...',
      help: 'Found in your Shopify Admin under Settings > Apps > Develop apps.',
      requiresSecondary: true,
      secondaryLabel: 'Store Domain',
      secondaryPlaceholder: 'your-store.myshopify.com',
      secondaryKey: 'store_domain',
    };
  }
  if (id === 'webhooks') {
    return {
      label: 'Target Webhook URL',
      placeholder: 'https://your-domain.com/api/webhook',
      help: 'The HTTPS URL where Concludo will send real-time action events.',
      requiresSecondary: true,
      secondaryLabel: 'Signing Secret (optional)',
      secondaryPlaceholder: 'whsec_...',
      secondaryKey: 'signing_secret',
    };
  }
  if (id === 'generic_http') {
    return {
      label: 'Bearer Token or API Secret',
      placeholder: 'Enter token or secret',
      help: 'The authorization bearer token passed in request headers.',
      requiresSecondary: true,
      secondaryLabel: 'Base API URL',
      secondaryPlaceholder: 'https://api.your-service.com/v1',
      secondaryKey: 'base_url',
    };
  }
  if (id === 'twilio') {
    return {
      label: 'Auth Token',
      placeholder: 'Enter Twilio Auth Token',
      help: 'Found in your Twilio Console dashboard.',
      requiresSecondary: true,
      secondaryLabel: 'Account SID',
      secondaryPlaceholder: 'AC...',
      secondaryKey: 'account_sid',
    };
  }
  if (id === 'asana') {
    return {
      label: 'Asana Personal Access Token',
      placeholder: '1/120...',
      help: 'Generate in Asana under My Profile Settings > Apps > Manage Developer Apps.',
    };
  }
  if (id === 'monday') {
    return {
      label: 'Monday.com API Token',
      placeholder: 'Enter your v2 API token',
      help: 'Found in Monday.com under Avatar > Developers > API.',
    };
  }
  if (id === 'clickup') {
    return {
      label: 'ClickUp Personal API Key',
      placeholder: 'pk_...',
      help: 'Found in ClickUp under Settings > Apps > API Token.',
    };
  }
  if (id === 'airtable') {
    return {
      label: 'Airtable Personal Access Token',
      placeholder: 'pat...',
      help: 'Generate in Airtable Builder Hub under Personal Access Tokens.',
    };
  }
  if (id === 'jira' || id === 'trello') {
    return {
      label: 'Atlassian API Token',
      placeholder: 'Enter Atlassian API Token',
      help: 'Generate in id.atlassian.com/manage-profile/security/api-tokens.',
    };
  }
  if (id === 'xero') {
    return {
      label: 'Xero API Token or Client Credentials',
      placeholder: 'Enter token or API credentials',
      help: 'Found in your Xero Developer Portal under App Credentials.',
    };
  }
  if (id === 'myob') {
    return {
      label: 'MYOB Developer API Key',
      placeholder: 'Enter API Key',
      help: 'Found in your MYOB Developer Account under My Apps.',
    };
  }
  if (id === 'quickbooks') {
    return {
      label: 'QuickBooks API Token',
      placeholder: 'Enter API Token',
      help: 'Found in your Intuit Developer Portal under App Keys.',
    };
  }
  return {
    label: `${provider.name} API Key or Access Token`,
    placeholder: 'Enter API key or access token',
    help: `Enter the API key or personal access token from your ${provider.name} account.`,
  };
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
  const isDirect = isDirectKeyProvider(app as any);
  const isNative = isNativeOAuthProvider(app as any);
  const how = isDirect
    ? `You will connect ${app.name} securely by providing your API key, secret, or webhook configuration. Your credentials are encrypted on Concludo's secure server and never exposed.`
    : isNative
    ? `You will connect ${app.name} by signing in on ${owner} own page. You will see exactly what Concludo is asking for and approve it there. Concludo never sees your password.`
    : `You will connect ${app.name} by authenticating your account or providing your workspace token. You will see exactly what Concludo is asking for and approve it there. Concludo never sees your account password.`;

  if (availability === 'available') {
    const body = [how];
    if (app.requires_admin_consent) body.push('Your administrator may need to approve Concludo before you can finish.');
    return {
      title: `Connect ${app.name}`,
      body,
      primary: isDirect ? 'Connect Account' : (isNativeOAuthProvider(app) ? `Continue to ${owner.replace(/'s$/, '')} sign-in` : 'Connect Account'),
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
