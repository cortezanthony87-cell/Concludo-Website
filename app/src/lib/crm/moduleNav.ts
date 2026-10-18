/**
 * The fourteen CRM destinations, and the saved views.
 *
 * WHY FOURTEEN TABS ARE GROUPED RATHER THAN LISTED.
 *
 * The brief names fourteen destinations and allows a collapsible submenu and
 * module tabs if that creates excessive sidebar density. It does: the existing
 * sidebar already carries 39 links in 10 groups, and fourteen more would make
 * 53. So the sidebar gets **one** entry, `CRM`, which expands in place to the
 * fourteen for direct access, and the module carries the same fourteen as tabs.
 *
 * Fourteen tabs in one row is still a wall, so each destination declares a
 * group and the tab row draws four labelled clusters. A person scanning for
 * "where do I approve something" looks at four words rather than fourteen.
 *
 * The groups are not categories of feature. They are categories of intent:
 *
 * - **Work**: what I do today.
 * - **Relationships**: who I do it with.
 * - **Evidence**: what actually happened, and what the module thinks about it.
 * - **Manage**: the settings, the imports and the state of the data itself.
 */
import { CrmDestination, CrmModulePath, CrmSavedView } from './types';

export const CRM_MODULE_DESTINATIONS: CrmDestination[] = [
  {
    path: '/crm',
    label: 'Today',
    iconName: 'Sun',
    accessibleDescription: 'What is recommended today, and why each item is here.',
    group: 'Work',
  },
  {
    path: '/crm/capture',
    label: 'Capture',
    iconName: 'PlusCircle',
    accessibleDescription:
      'Create a contact, organisation, lead, piece of work, task, commitment, note or interaction.',
    group: 'Work',
  },
  {
    path: '/crm/leads',
    label: 'Leads',
    iconName: 'Inbox',
    accessibleDescription: 'New enquiries awaiting review, and what is missing from each one.',
    group: 'Work',
  },
  {
    path: '/crm/pipeline',
    label: 'Pipeline',
    iconName: 'Columns3',
    accessibleDescription: 'Open work by stage, with the next step and how long it has been there.',
    group: 'Work',
  },
  {
    path: '/crm/commitments',
    label: 'Commitments',
    iconName: 'Handshake',
    accessibleDescription: 'What was promised, by whom, by when, and the sentence it came from.',
    group: 'Work',
  },
  {
    /* Phase 2A-i. First in the Relationships group, and deliberately not in
       Work: it is not a list of things to do, it is the question of which
       accounts have unanswered questions against them. */
    path: '/crm/attention',
    label: 'Attention',
    iconName: 'Radar',
    accessibleDescription:
      'Which accounts have unanswered questions against them, which of the eleven conditions is true of each, and the records behind every one.',
    group: 'Relationships',
  },
  {
    /* Phase 2B-i. Next to Attention, because they are the two halves of the
       same question: Attention says which accounts have something unanswered,
       and Memory says what this business already knows about one of them. */
    path: '/crm/memory',
    label: 'Memory',
    iconName: 'BookMarked',
    accessibleDescription:
      'What this business needs to remember about a customer: what was promised, what was decided, what came of it, and the record behind every line.',
    group: 'Relationships',
  },
  {
    path: '/crm/relationships',
    label: 'Relationships',
    iconName: 'Users',
    accessibleDescription: 'People, their role in a decision, and when they were last in contact.',
    group: 'Relationships',
  },
  {
    path: '/crm/people',
    label: 'People',
    iconName: 'Contact',
    accessibleDescription:
      'Every person on record, who holds the relationship, and when they were last spoken to.',
    group: 'Relationships',
  },
  {
    path: '/crm/organisations',
    label: 'Organisations',
    iconName: 'Building2',
    accessibleDescription: 'Organisations, their parent and child structure, and their standing.',
    group: 'Accounts',
  },
  {
    path: '/crm/hierarchy',
    label: 'Hierarchy',
    iconName: 'Network',
    accessibleDescription: 'Parent and child organisations as one tree, with people and open work.',
    group: 'Accounts',
  },
  {
    path: '/crm/coverage',
    label: 'Coverage',
    iconName: 'UsersRound',
    accessibleDescription:
      'Which stakeholder roles are recorded at each organisation, and which are not.',
    group: 'Relationships',
  },
  {
    /* The KAM Copilot sits in Accounts, beside the plans it reads. It is not
       in Evidence with the Overview: the Overview reports what happened across
       the workspace, and this prepares a person for one conversation with one
       customer. Different job, different cluster.

       The icon is a compass rather than a brain or a spark. This module makes
       no claim to think, and an icon that implied one would be the first
       dishonest thing on the page. */
    path: '/crm/kam',
    label: 'KAM Copilot',
    iconName: 'Compass',
    accessibleDescription:
      'One account through six lenses: what is recorded, what the copilot inferred, and what nobody has answered. Carries no judgement about any person.',
    group: 'Accounts',
  },
  {
    path: '/crm/account-plans',
    label: 'Account Plans',
    iconName: 'Target',
    accessibleDescription: 'What each account is working towards, and how those outcomes stand.',
    group: 'Accounts',
  },
  {
    path: '/crm/service',
    label: 'Service',
    iconName: 'LifeBuoy',
    accessibleDescription: 'Service issues, and how each one bears on the relationship.',
    group: 'Accounts',
  },
  {
    /* The overview leads Evidence rather than Work, and that placement is
       load-bearing. Work is where a person DOES something: Today, Capture,
       Leads, Pipeline, Commitments. This page is a reporting view and nothing
       on it is an instruction, so it belongs beside Forecast and Reports.

       It was briefly in Work, which pushed that cluster to six tabs and
       tripped the five-per-cluster rule in the shell suite. That rule is not
       cosmetic: a cluster that grows past about five stops being a cluster
       and becomes the undivided row it was meant to replace. The right fix
       was to put the tab where it belongs, not to raise the limit. */
    path: '/crm/dashboard',
    label: 'Overview',
    iconName: 'LayoutDashboard',
    accessibleDescription:
      'How this is going: what is open, what has closed, what is waiting, and what changed. Every figure opens the records behind it.',
    group: 'Evidence',
  },
  {
    path: '/crm/activities',
    label: 'Activities',
    iconName: 'History',
    accessibleDescription: 'One timeline of meetings, calls, notes and documents, with their sources.',
    group: 'Evidence',
  },
  {
    path: '/crm/proposals',
    label: 'AI Proposals',
    iconName: 'Sparkles',
    accessibleDescription: 'Proposed CRM updates awaiting confirmation. Nothing is applied here.',
    group: 'Evidence',
  },
  {
    path: '/crm/forecast',
    label: 'Forecast',
    iconName: 'TrendingUp',
    accessibleDescription:
      'What people have said will close, and separately what the record carries. Never merged.',
    group: 'Evidence',
  },
  {
    path: '/crm/reports',
    label: 'Reports',
    iconName: 'BarChart3',
    accessibleDescription: 'Counts of work and records. This module never measures a person.',
    group: 'Evidence',
  },
  {
    path: '/crm/data-quality',
    label: 'Data Quality',
    iconName: 'ShieldCheck',
    accessibleDescription: 'Records needing review, possible duplicates, and sources needing review.',
    group: 'Manage',
  },
  {
    path: '/crm/imports',
    label: 'Imports',
    iconName: 'Upload',
    accessibleDescription: 'Where imported records came from. Import is not built in this release.',
    group: 'Manage',
  },
  {
    path: '/crm/settings',
    label: 'CRM Settings',
    iconName: 'Settings2',
    accessibleDescription: 'Terminology, pipelines, stages and what this release deliberately cannot do.',
    group: 'Manage',
  },
];

/**
 * The five clusters, in the order the tab row draws them.
 *
 * Four, until Stage 4. Adding People, Hierarchy and Coverage took the
 * Relationships cluster to seven, and a test written in Stage 2 caught it:
 * seven items under one word is a list, not a cluster, and the grouping exists
 * precisely so that nobody has to read a list.
 *
 * So the clusters were split rather than the limit raised. "Relationships" is
 * now about PEOPLE, and "Accounts" is about the organisations those people
 * work for and what is being done with them. That is the distinction a person
 * actually makes when they go looking: who do I talk to, versus what is
 * happening with this company.
 */
export const CRM_TAB_GROUPS: CrmDestination['group'][] = [
  'Work',
  'Relationships',
  'Accounts',
  'Evidence',
  'Manage',
];

/**
 * Resolves a path to its destination.
 *
 * An unknown child falls back to Today rather than throwing, because a stale
 * bookmark should land somewhere useful rather than on an error.
 */
export function crmDestinationForPath(pathname: string): CrmDestination {
  const exact = CRM_MODULE_DESTINATIONS.find((d) => d.path === pathname);
  if (exact) return exact;

  const nested = CRM_MODULE_DESTINATIONS.filter((d) => d.path !== '/crm')
    .filter((d) => pathname.startsWith(d.path + '/'))
    .sort((a, b) => b.path.length - a.path.length)[0];

  return nested ?? CRM_MODULE_DESTINATIONS[0];
}

/** Destinations in one group, in declaration order. */
export function crmDestinationsInGroup(group: CrmDestination['group']): CrmDestination[] {
  return CRM_MODULE_DESTINATIONS.filter((d) => d.group === group);
}

/**
 * Saved views.
 *
 * Each one is a named set of filters, not a separate page. That is the whole
 * point: a saved view that creates a new destination is a tab, and this module
 * already has fourteen.
 */
export const CRM_SAVED_VIEWS: CrmSavedView[] = [
  {
    key: 'my_week',
    label: 'My week',
    description: 'Everything I own, over the last thirty days.',
    patch: { owner: 'You', dateRange: 'last_30' },
  },
  {
    key: 'needs_a_next_step',
    label: 'Needs a next step',
    description: 'Open work with nothing recorded as the next thing to do.',
    patch: { dateRange: 'all', recordType: 'all' },
  },
  {
    key: 'real_estate',
    label: 'Agency work',
    description: 'The agency rollout pipeline only.',
    patch: { pipelineId: 'pipe-02', dateRange: 'all' },
  },
  {
    key: 'last_seven_days',
    label: 'Last seven days',
    description: 'Everything touched in the last week, whoever owns it.',
    patch: { owner: 'all', dateRange: 'last_7' },
  },
  {
    key: 'awaiting_confirmation',
    label: 'Awaiting confirmation',
    description: 'Proposed CRM updates that nobody has decided on yet.',
    patch: { dateRange: 'all', owner: 'all' },
  },
];

export function crmSavedView(key: string | null): CrmSavedView | null {
  if (!key) return null;
  return CRM_SAVED_VIEWS.find((v) => v.key === key) ?? null;
}

/** Every module path, for the route table and the static route generator. */
export const CRM_MODULE_PATHS: CrmModulePath[] = CRM_MODULE_DESTINATIONS.map((d) => d.path);
