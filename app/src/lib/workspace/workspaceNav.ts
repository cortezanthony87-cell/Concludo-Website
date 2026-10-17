/**
 * The Concludo Workspace navigation manifest.
 *
 * WHY THIS FILE EXISTS.
 *
 * The sidebar is forty hand-written `NavLink` elements with no manifest, so a
 * route can exist without a link, or a link without a route, and nobody finds
 * out until somebody clicks. This file makes the navigation data, and
 * `workspaceRouteTable.ts` makes the pairing a compile error rather than a
 * defect found later. It is the same pattern the CRM module already uses.
 *
 * THE ROUTES IN HERE ARE A STARTING POINT, NOT A VERIFIED LIST.
 *
 * This file was written without access to the Workspace repository. Every
 * `path` below is the best available reading of the route, taken from the
 * page folders recorded in the Stage 1 architecture review and from routes
 * that later modules confirmed.
 *
 * Do not ship until `scripts/check-nav.mjs` passes. It compares every path
 * here against the routes declared in `App.tsx` and fails the build on any
 * mismatch. That check, not this comment, is what makes the list correct.
 *
 * NOTHING HERE IS A PLAN TIER.
 *
 * Entitlement is a `feature` key, resolved by the permissions layer on the
 * server. Nine items in the current sidebar compare `profile.plan` strings
 * inline in the layout, against a tier that is not being sold. That is
 * entitlement in the wrong place and it has already drifted.
 */

import type { FeatureKey } from '../permissions/types';

export type WorkspaceGroup =
  | 'Work'
  | 'Intelligence'
  | 'Automation'
  | 'Connectivity'
  | 'Admin';

/**
 * The five groups, in the order they appear.
 *
 * Work is first and pinned. The rest scroll.
 */
export const WORKSPACE_GROUPS: WorkspaceGroup[] = [
  'Work',
  'Intelligence',
  'Automation',
  'Connectivity',
  'Admin',
];

/**
 * The kind of badge shown beside a destination.
 *
 * There are two and never a third:
 *   blocking       someone is waiting on you (Approvals). Renders gold.
 *   informational  a number worth knowing (Email). Renders slate.
 */
export type BadgeKind = 'blocking' | 'informational';

export interface WorkspaceDestination {
  /** The route. Must match a `<Route path="...">` in App.tsx. */
  path: string;
  /** Label shown in the sidebar. Australian English throughout. */
  label: string;
  /** Name of a Lucide icon. Resolved by WorkspaceSidebar.tsx. */
  iconName: string;
  /**
   * The question this destination answers, used as its accessible description.
   *
   * Screen readers read this; the rail tooltip shows the label instead.
   */
  accessibleDescription: string;
  /** Which group the destination belongs to. */
  group: WorkspaceGroup;
  /**
   * The feature key that gates visibility. Resolved by the permissions layer,
   * never by comparing plan strings in the layout.
   */
  feature: FeatureKey;
  /**
   * Work destinations are pinned above the scroll, along with the header and
   * the search field. Nothing else is pinned.
   */
  pinned?: boolean;
  /**
   * For the seventeen destinations the redesign folds into four: the path
   * they fold into. While MERGED_PAGES_READY is false, these destinations
   * render and their merge targets are hidden. When it is true, the reverse.
   */
  mergedInto?: string;
  /** Badge kind, if this destination carries a count. */
  badge?: BadgeKind;
  /**
   * Marker for routes that were inferred rather than verified.
   * `scripts/check-nav.mjs` reports these until checked against the repo.
   */
  unverified?: boolean;
}

/**
 * The switch for the four merges.
 *
 * The redesign folds seventeen destinations into four:
 *   Memory      from Decision Memory, Organisational Memory,
 *                    Knowledge Explorer, Knowledge Timeline
 *   Insight     from Insight, Stats, Knowledge Analytics, Performance
 *   Forecasts   from Predictive Intelligence, Forecasts,
 *                    Scenario Modelling, Digital Twin
 *   Briefings   from Executive Briefings, Executive Intelligence,
 *                    Executive Centre, Command Centre
 *
 * Each merge is one destination with the old views as tabs.
 *
 * THOSE FOUR PAGES DO NOT EXIST YET.
 *
 * Turning this switch on before they are built removes seventeen working
 * destinations and replaces them with four routes that 404. So this package
 * ships with the switch OFF. The sidebar reorder, the pinning, the search
 * field, the removals and the rename all take effect immediately, with every
 * destination still pointing at a page that exists today.
 *
 * When the four pages are built, change this to true. That is the whole change.
 *
 *   Stage A (today): false. Seventeen old destinations render, the four
 *   merged ones do not.
 *
 *   Stage B: true, on the day the four merged pages are built and their tabs
 *   render the old views. One line, and it is reversible by changing it back.
 */
export const MERGED_PAGES_READY = false;

const DESTINATIONS: WorkspaceDestination[] = [
  /* ---------------------------------------------------------------- Work
   *
   * Six, pinned, in the order Anthony approved. Copilot first because it is
   * where the work starts. Approvals last because it is the one that tells
   * you somebody else is waiting.
   */
  {
    path: '/copilot',
    label: 'Concludo Copilot',
    iconName: 'Sparkles',
    accessibleDescription:
      'Turn a transcript into a summary, decisions, actions and a follow-up email, for you to approve.',
    group: 'Work',
    feature: 'concludo_copilot',
    pinned: true,
  },
  {
    path: '/dashboard',
    label: 'Dashboard',
    iconName: 'LayoutGrid',
    accessibleDescription:
      'What changed, what needs you, your projects, and the button that starts a new transcript.',
    group: 'Work',
    feature: 'workspace_basic',
    pinned: true,
  },
  {
    path: '/calendar',
    label: 'Calendar',
    iconName: 'Calendar',
    accessibleDescription: 'What is coming up, and what came out of what already happened.',
    group: 'Work',
    feature: 'workspace_basic',
    pinned: true,
  },
  {
    path: '/email',
    label: 'Email',
    iconName: 'Mail',
    accessibleDescription: 'What needs a reply, what you are waiting on, and what is drafted.',
    group: 'Work',
    feature: 'workspace_basic',
    pinned: true,
    badge: 'informational',
  },
  {
    path: '/crm',
    label: 'CRM',
    iconName: 'Contact',
    accessibleDescription:
      'Who you work with, what was promised, what was decided, and what needs attention.',
    group: 'Work',
    feature: 'workspace_basic',
    pinned: true,
  },
  {
    path: '/approvals',
    label: 'Approvals',
    iconName: 'CheckCircle',
    accessibleDescription: 'What is waiting on your decision before anything is sent or changed.',
    group: 'Work',
    feature: 'workflow_approvals',
    pinned: true,
    badge: 'blocking',
  },

  /* -------------------------------------------------------- Intelligence
   *
   * The four merged destinations. Hidden until MERGED_PAGES_READY is true.
   */
  {
    path: '/memory',
    label: 'Memory',
    iconName: 'Brain',
    accessibleDescription:
      'What the organisation knows, what was decided, and where in the records it came from.',
    group: 'Intelligence',
    feature: 'meeting_memory',
  },
  {
    path: '/insight',
    label: 'Insight',
    iconName: 'BarChart3',
    accessibleDescription: 'What the numbers say about the work, the knowledge and the delivery.',
    group: 'Intelligence',
    feature: 'insight',
  },
  {
    path: '/forecasts',
    label: 'Forecasts',
    iconName: 'TrendingUp',
    accessibleDescription: 'What is expected to happen next, and what changes if an input changes.',
    group: 'Intelligence',
    feature: 'forecasting',
  },
  {
    path: '/briefings',
    label: 'Briefings',
    iconName: 'FileText',
    accessibleDescription: 'What to tell the board, assembled from what is recorded.',
    group: 'Intelligence',
    feature: 'executive_intelligence',
  },

  /* The seventeen that the four above replace. Present while the switch is
     off, so nothing in use disappears before its replacement is built. Each
     names the destination it folds into, so the mapping is in the code
     rather than in a document somebody has to find. */
  { path: '/decision-memory', label: 'Decision Memory', iconName: 'Database', accessibleDescription: 'Decisions that were recorded, and what they were based on.', group: 'Intelligence', feature: 'decision_memory', mergedInto: '/memory' },
  { path: '/knowledge', label: 'Knowledge Explorer', iconName: 'Database', accessibleDescription: 'Search what the business has recorded.', group: 'Intelligence', feature: 'knowledge_explorer', mergedInto: '/memory' },
  { path: '/organizational-memory', label: 'Organisational Memory', iconName: 'Database', accessibleDescription: 'What the organisation knows, across its records.', group: 'Intelligence', feature: 'organizational_memory', mergedInto: '/memory' },
  { path: '/knowledge/timeline', label: 'Knowledge Timeline', iconName: 'Clock', accessibleDescription: 'What was recorded, in order.', group: 'Intelligence', feature: 'knowledge_graph', mergedInto: '/memory' },

  { path: '/insight', label: 'Insight', iconName: 'Lightbulb', accessibleDescription: 'What stands out in the records.', group: 'Intelligence', feature: 'insight', mergedInto: '/insight' },
  { path: '/stats', label: 'Stats', iconName: 'BarChart3', accessibleDescription: 'Counts and totals across the workspace.', group: 'Intelligence', feature: 'stats', mergedInto: '/insight' },
  { path: '/knowledge-analytics', label: 'Knowledge Analytics', iconName: 'BarChart3', accessibleDescription: 'How the recorded knowledge is used.', group: 'Intelligence', feature: 'knowledge_analytics', mergedInto: '/insight' },
  { path: '/performance', label: 'Performance', iconName: 'BarChart3', accessibleDescription: 'How delivery is tracking.', group: 'Intelligence', feature: 'insight', mergedInto: '/insight' },

  { path: '/predictive-intelligence', label: 'Predictive Intelligence', iconName: 'TrendingUp', accessibleDescription: 'What the records suggest is coming.', group: 'Intelligence', feature: 'predictive_intelligence', mergedInto: '/forecasts' },
  { path: '/forecasts', label: 'Forecasts', iconName: 'TrendingUp', accessibleDescription: 'Expected outcomes over a period.', group: 'Intelligence', feature: 'forecasting', mergedInto: '/forecasts' },
  { path: '/scenario-modeling', label: 'Scenario Modelling', iconName: 'SlidersHorizontal', accessibleDescription: 'What changes if an input changes.', group: 'Intelligence', feature: 'scenario_modeling', mergedInto: '/forecasts' },
  { path: '/digital-twin', label: 'Digital Twin', iconName: 'Cpu', accessibleDescription: 'A model of the business as recorded.', group: 'Intelligence', feature: 'digital_twin', mergedInto: '/forecasts' },

  { path: '/executive-briefings', label: 'Executive Briefings', iconName: 'FileText', accessibleDescription: 'Briefings assembled for an executive audience.', group: 'Intelligence', feature: 'executive_intelligence', mergedInto: '/briefings' },
  { path: '/executive-intelligence', label: 'Executive Intelligence', iconName: 'Compass', accessibleDescription: 'What matters at an executive level.', group: 'Intelligence', feature: 'executive_intelligence', mergedInto: '/briefings' },
  { path: '/executive-center', label: 'Executive Centre', iconName: 'FileText', accessibleDescription: 'The executive view of the workspace.', group: 'Intelligence', feature: 'executive_intelligence', mergedInto: '/briefings' },
  { path: '/executive-command-center', label: 'Command Centre', iconName: 'Compass', accessibleDescription: 'The operating view of the workspace.', group: 'Intelligence', feature: 'executive_command_center', mergedInto: '/briefings' },

  { path: '/endpoint-report', label: 'Endpoint Report', iconName: 'FileBarChart', accessibleDescription: 'How the connected endpoints are behaving.', group: 'Connectivity', feature: 'endpoint_report' },

  /* ---------------------------------------------------------- Automation */
  {
    path: '/agents',
    label: 'AI Agents',
    iconName: 'Bot',
    accessibleDescription: 'The agents that prepare work for you, and how each one is doing.',
    group: 'Automation',
    feature: 'ai_agents',
  },
  {
    path: '/workflows',
    label: 'Workflows',
    iconName: 'Workflow',
    accessibleDescription: 'The steps that run when something happens.',
    group: 'Automation',
    feature: 'workflow_orchestration',
  },
  {
    path: '/actions',
    label: 'Actions',
    iconName: 'ListChecks',
    accessibleDescription: 'What is to be done, and by when.',
    group: 'Automation',
    feature: 'action_tracker',
  },
  { path: '/agents/dashboard', label: 'Agent Dashboard', iconName: 'Gauge', accessibleDescription: 'How the agents are running.', group: 'Automation', feature: 'ai_agents', mergedInto: '/agents' },

  /* -------------------------------------------------------- Connectivity */
  {
    path: '/integrations',
    label: 'Connect apps',
    iconName: 'Plug',
    accessibleDescription:
      'Connect the apps this workspace reads from and writes to, with your own credentials.',
    group: 'Connectivity',
    feature: 'third_party_integrations',
  },
  {
    path: '/automation-export',
    label: 'Automation Export',
    iconName: 'Layers',
    accessibleDescription: 'Take an automation out of the workspace.',
    group: 'Connectivity',
    feature: 'automation_export',
  },
  {
    path: '/webhooks',
    label: 'Webhooks',
    iconName: 'Webhook',
    accessibleDescription: 'Where the workspace sends an event when something happens.',
    group: 'Connectivity',
    feature: 'webhooks',
  },
  {
    path: '/api',
    label: 'Public API',
    iconName: 'Code',
    accessibleDescription: 'Reach the workspace from your own code.',
    group: 'Connectivity',
    feature: 'api_access',
  },

  /* ---------------------------------------------------------------- Admin */
  { path: '/admin', label: 'Enterprise Admin', iconName: 'Shield', accessibleDescription: 'Members, roles and workspace settings.', group: 'Admin', feature: 'organization_admin' },
  { path: '/admin/audit', label: 'Audit Logs', iconName: 'ScrollText', accessibleDescription: 'Who did what, and when.', group: 'Admin', feature: 'audit_logging' },
  { path: '/admin/compliance', label: 'Compliance', iconName: 'Scale', accessibleDescription: 'Consent, retention and the obligations that attach to them.', group: 'Admin', feature: 'compliance_controls' },
  { path: '/admin/security', label: 'Security', iconName: 'KeyRound', accessibleDescription: 'Access, keys and sign-in.', group: 'Admin', feature: 'security_controls' },
  { path: '/checkout', label: 'Packages & Plans', iconName: 'CreditCard', accessibleDescription: 'What this workspace includes.', group: 'Admin', feature: 'workspace_basic' },
  { path: '/settings', label: 'Settings', iconName: 'Settings', accessibleDescription: 'How this workspace behaves.', group: 'Admin', feature: 'workspace_basic' },
];

/**
 * The destinations to render, for the stage this build is in.
 *
 * With the switch off: the four merged destinations are hidden and the
 * seventeen they replace are shown. With it on: the reverse. Nothing is ever
 * shown twice, and nothing in use is ever hidden without its replacement
 * being present.
 */
export const WORKSPACE_DESTINATIONS: WorkspaceDestination[] = DESTINATIONS.filter(
  (destination) =>
    MERGED_PAGES_READY
      ? destination.mergedInto === undefined
      : !isMergeTarget(destination.path)
);

/** The six pinned Work destinations, in order. */
export const PINNED_DESTINATIONS: WorkspaceDestination[] = DESTINATIONS.filter(
  (destination) => destination.pinned === true
);

/** All destinations belonging to one group, preserving their declared order. */
export function destinationsInGroup(group: WorkspaceGroup): WorkspaceDestination[] {
  return WORKSPACE_DESTINATIONS.filter((destination) => destination.group === group);
}

/** Looks up a destination by its exact route. */
export function findDestinationByPath(path: string): WorkspaceDestination | undefined {
  return DESTINATIONS.find((destination) => destination.path === path);
}

/** Whether a path is one of the four destinations that replaces older views. */
export function isMergeTarget(path: string): boolean {
  return DESTINATIONS.some(
    (destination) => destination.mergedInto !== undefined && destination.mergedInto === path
  );
}
