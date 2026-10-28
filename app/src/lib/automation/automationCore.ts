/**
 * Concludo Automation Core v2
 * ---------------------------------------------------------------------------
 * One engine behind the three workflow functions: Runs, Approvals and Governance.
 * They read and write the same records, so they cannot drift apart:
 *
 *   runWorkflow ──► Run ──(external step)──► Approval ──► decideApproval ──► Run resumes or stops
 *        ▲                                                       │
 *        └──── blocked while the workflow is paused, stopped or quarantined ◄── Governance
 *
 * Rules built in, not configurable:
 *  1. Concludo proposes; a person disposes. Every step that sends or changes something outside
 *     Concludo sits behind an approval step. The builder inserts it; validation refuses to turn a
 *     workflow on without it.
 *  2. Nothing is invented. A run works only on its input. Empty input produces "nothing to do",
 *     never sample people, messages or invoice numbers. A preview never claims something was sent.
 *  3. Measure work, never people. Workflows that score, rank or monitor individuals are refused.
 *  4. Governance is real. Pausing, the workspace stop and quarantine all use the workflow's own
 *     active flag (workflows.is_active), so they block runs and approvals everywhere, survive a
 *     reload and need no new table.
 *
 * Framework free. Storage sits behind the Store interface: MemoryStore for the studio preview and
 * tests, SupabaseStore (supabaseStore.ts) for the Workspace.
 */

/* ============================================================== catalogue */

export type TriggerType =
  | 'meeting_completed'
  | 'action_created'
  | 'action_completed'
  | 'decision_created'
  | 'project_created'
  | 'report_generated'
  | 'workflow_schedule'
  | 'webhook_event';

export const TRIGGERS: Record<TriggerType, { label: string; hint: string }> = {
  meeting_completed: { label: 'A meeting record is saved', hint: 'Runs with the meeting, its decisions and its actions' },
  action_created: { label: 'An action is created', hint: 'Runs with the new action' },
  action_completed: { label: 'An action is completed', hint: 'Runs with the completed action' },
  decision_created: { label: 'A decision is saved', hint: 'Runs with the decision' },
  project_created: { label: 'A project is created', hint: 'Runs with the project' },
  report_generated: { label: 'A report is generated', hint: 'Runs with the report' },
  workflow_schedule: { label: 'On a schedule', hint: 'Runs with your open actions, decisions and risks' },
  webhook_event: { label: 'Another app sends an event', hint: 'Runs with the event the app sends' },
};

/** A trigger saved by an older builder still has a label. It never throws. */
export function triggerInfo(type: string | null | undefined): { label: string; hint: string } {
  if (type && Object.prototype.hasOwnProperty.call(TRIGGERS, type)) return TRIGGERS[type as TriggerType];
  const raw = String(type || 'unknown').replace(/_/g, ' ');
  return {
    label: `Older trigger: ${raw}`,
    hint: 'This trigger is from an older workflow. Choose a current trigger before turning the workflow on',
  };
}

export type AppKey =
  | 'concludo'
  | 'outlook'
  | 'gmail'
  | 'slack'
  | 'teams'
  | 'google_calendar'
  | 'microsoft_todo'
  | 'hubspot'
  | 'google_sheets';

export const APPS: Record<AppKey, { label: string; external: boolean }> = {
  concludo: { label: 'Concludo', external: false },
  outlook: { label: 'Outlook', external: true },
  gmail: { label: 'Gmail', external: true },
  slack: { label: 'Slack', external: true },
  teams: { label: 'Teams', external: true },
  google_calendar: { label: 'Google Calendar', external: true },
  microsoft_todo: { label: 'Microsoft To Do', external: true },
  hubspot: { label: 'HubSpot', external: true },
  google_sheets: { label: 'Google Sheets', external: true },
};

/** An app name that is not in the catalogue is shown, not crashed on. */
export function appInfo(app: string | null | undefined): { label: string; external: boolean } {
  if (app && Object.prototype.hasOwnProperty.call(APPS, app)) return APPS[app as AppKey];
  return { label: 'Unknown app', external: false };
}

export type ActionKey =
  | 'summarise_meeting'
  | 'create_actions'
  | 'save_decisions'
  | 'build_report'
  | 'notify_me'
  | 'send_email'
  | 'post_message'
  | 'create_event'
  | 'create_task'
  | 'add_crm_note'
  | 'add_sheet_row'
  | 'ask_approval'
  | 'only_if'
  | 'run_agent'
  | 'unsupported';

export type StepKind = 'do' | 'approval' | 'only_if';

export interface FieldSpec {
  key: string;
  label: string;
  kind: 'text' | 'longtext' | 'select';
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
  placeholder?: string;
}

export interface ActionSpec {
  key: ActionKey;
  kind: StepKind;
  label: string;
  group: 'Concludo' | 'Ask a person' | 'Send or notify' | 'Calendar and tasks' | 'Records' | 'Logic';
  apps: AppKey[];
  fields: FieldSpec[];
  /** Hidden from the add-step list. Used for older steps we can show but not run. */
  hidden?: boolean;
  /** One plain sentence for the explanation panel. */
  explain: (s: Step) => string;
}

/** Agents a workflow step can run. Labels only: the agents themselves live in agentsCore. */
export const AGENT_STEP_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'meeting_prep', label: 'Meeting prep' },
  { value: 'consent_check', label: 'Consent check' },
  { value: 'record_hygiene', label: 'Record hygiene' },
  { value: 'client_commitments', label: 'Client commitments' },
  { value: 'vendor_campaign_update', label: 'Vendor campaign update' },
  { value: 'board_pack', label: 'Board pack' },
  { value: 'meeting_followup', label: 'Meeting follow-up' },
  { value: 'action_accountability', label: 'Action accountability' },
  { value: 'risk_monitoring', label: 'Risk monitoring' },
  { value: 'report_generation', label: 'Report generation' },
];

const recipients: FieldSpec = {
  key: 'to',
  label: 'Send to',
  kind: 'select',
  required: true,
  options: [
    { value: 'attendees', label: 'Everyone in the meeting' },
    { value: 'action_owners', label: 'Each action owner' },
    { value: 'me', label: 'Me only' },
    { value: 'custom', label: 'An address I type' },
  ],
};

export const ACTIONS: Record<ActionKey, ActionSpec> = {
  summarise_meeting: { key: 'summarise_meeting', kind: 'do', label: 'Summarise the meeting', group: 'Concludo', apps: ['concludo'], fields: [], explain: () => 'Concludo writes the meeting summary from the record.' },
  create_actions: { key: 'create_actions', kind: 'do', label: 'Add actions to the tracker', group: 'Concludo', apps: ['concludo'], fields: [], explain: () => 'Concludo adds the agreed actions to the Action tracker, with owners and dates only where they were stated.' },
  save_decisions: { key: 'save_decisions', kind: 'do', label: 'Save decisions to Decision memory', group: 'Concludo', apps: ['concludo'], fields: [], explain: () => 'Concludo saves each decision with the quote it came from.' },
  build_report: {
    key: 'build_report', kind: 'do', label: 'Build a status report', group: 'Concludo', apps: ['concludo'],
    fields: [{ key: 'report', label: 'Report', kind: 'select', required: true, options: [{ value: 'weekly_status', label: 'Weekly status' }, { value: 'board_briefing', label: 'Board briefing' }, { value: 'overdue', label: 'Overdue actions' }] }],
    explain: (s) => `Concludo builds the ${optionLabel(ACTIONS.build_report.fields[0], s.settings.report) || 'status'} report from your records.`,
  },
  notify_me: { key: 'notify_me', kind: 'do', label: 'Notify me in Concludo', group: 'Concludo', apps: ['concludo'], fields: [{ key: 'message', label: 'Message', kind: 'text', placeholder: 'What should the notification say?' }], explain: () => 'You get a notification inside Concludo. Nothing leaves Concludo.' },
  send_email: {
    key: 'send_email', kind: 'do', label: 'Send an email', group: 'Send or notify', apps: ['outlook', 'gmail'],
    fields: [recipients, { key: 'address', label: 'Address', kind: 'text', placeholder: 'name@company.com.au' }, { key: 'subject', label: 'Subject', kind: 'text', required: true, placeholder: 'Outcomes and actions from today' }],
    explain: (s) => `An email goes to ${optionLabel(recipients, s.settings.to)?.toLowerCase() || 'the people you choose'} from ${appInfo(s.app).label}.`,
  },
  post_message: {
    key: 'post_message', kind: 'do', label: 'Post a message', group: 'Send or notify', apps: ['slack', 'teams'],
    fields: [{ key: 'channel', label: 'Channel', kind: 'text', required: true, placeholder: '#project-updates' }],
    explain: (s) => `A message is posted to ${s.settings.channel || 'a channel'} in ${appInfo(s.app).label}.`,
  },
  create_event: {
    key: 'create_event', kind: 'do', label: 'Add deadlines to a calendar', group: 'Calendar and tasks', apps: ['google_calendar', 'outlook'],
    fields: [{ key: 'calendar', label: 'Calendar', kind: 'select', required: true, options: [{ value: 'mine', label: 'My calendar' }, { value: 'owners', label: 'Each action owner’s calendar' }] }],
    explain: (s) => `Each dated action becomes a calendar entry in ${appInfo(s.app).label}.`,
  },
  create_task: { key: 'create_task', kind: 'do', label: 'Create tasks in a task app', group: 'Calendar and tasks', apps: ['microsoft_todo'], fields: [{ key: 'list', label: 'List', kind: 'text', required: true, placeholder: 'Tasks' }], explain: (s) => `Each action becomes a task in ${appInfo(s.app).label}.` },
  add_crm_note: { key: 'add_crm_note', kind: 'do', label: 'Add a note to the CRM', group: 'Records', apps: ['hubspot'], fields: [], explain: () => 'The meeting summary is added as a note on the client record in HubSpot.' },
  add_sheet_row: { key: 'add_sheet_row', kind: 'do', label: 'Add rows to a spreadsheet', group: 'Records', apps: ['google_sheets'], fields: [{ key: 'sheet', label: 'Sheet name', kind: 'text', required: true, placeholder: 'Action log' }], explain: (s) => `Each action is added as a row in ${s.settings.sheet || 'a sheet'}.` },
  ask_approval: {
    key: 'ask_approval', kind: 'approval', label: 'Ask for approval', group: 'Ask a person', apps: ['concludo'],
    fields: [{ key: 'approver', label: 'Who approves', kind: 'select', required: true, options: [{ value: 'owner', label: 'The workflow owner' }, { value: 'me', label: 'Me' }] }],
    explain: () => 'The workflow stops here until a person approves it in the Approval Centre.',
  },
  run_agent: {
    key: 'run_agent', kind: 'do', label: 'Run an AI agent', group: 'Concludo', apps: ['concludo'],
    fields: [{ key: 'agent', label: 'Agent', kind: 'select', required: true, options: AGENT_STEP_OPTIONS }],
    explain: (s) => `The ${optionLabel(ACTIONS.run_agent.fields[0], s.settings.agent) || 'chosen'} agent runs on your records. Any drafts it writes wait in the Approval Centre and are never sent by Concludo.`,
  },
  only_if: {
    key: 'only_if', kind: 'only_if', label: 'Only continue if…', group: 'Logic', apps: ['concludo'],
    fields: [{ key: 'rule', label: 'Continue only if', kind: 'select', required: true, options: [
      { value: 'has_actions', label: 'There is at least one action' },
      { value: 'has_overdue', label: 'An action is overdue' },
      { value: 'has_high_risk', label: 'A risk is rated high' },
      { value: 'has_decisions', label: 'At least one decision was made' },
    ] }],
    explain: (s) => `The workflow continues only if ${(optionLabel(ACTIONS.only_if.fields[0], s.settings.rule) || 'the rule is met').replace(/^There is|^An|^A|^At/, (m) => m.toLowerCase())}.`,
  },
  unsupported: {
    key: 'unsupported', kind: 'do', label: 'Older step', group: 'Concludo', apps: ['concludo'], fields: [], hidden: true,
    explain: (s) => `This step is from an older workflow (${String(s.settings.legacyType || 'unknown action').replace(/_/g, ' ')}). It is shown so you can replace it. Concludo will not run it.`,
  },
};

export function optionLabel(f: FieldSpec, v?: string): string | undefined {
  return f.options?.find((o) => o.value === v)?.label;
}

/** A step action that is not in the catalogue becomes the older-step placeholder. */
export function actionInfo(action: string | null | undefined): ActionSpec {
  if (action && Object.prototype.hasOwnProperty.call(ACTIONS, action)) return ACTIONS[action as ActionKey];
  return ACTIONS.unsupported;
}

/* ============================================================== records */

export type WorkflowStatus = 'draft' | 'active' | 'paused';
export type PauseReason = 'you' | 'workspace_stop' | 'quarantine';

export interface Step {
  id: string;
  action: ActionKey;
  app: AppKey;
  label: string;
  settings: Record<string, string>;
  /** Set on approval steps Concludo inserted to guard an external step. */
  autoAdded?: boolean;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  teamId?: string | null;
  status: WorkflowStatus;
  pausedBy?: PauseReason | null;
  trigger: { type: TriggerType; schedule?: string };
  steps: Step[];
  consecutiveFailures: number;
  createdAt: string;
  updatedAt: string;
}

const LEGACY_STEP: Record<string, { action: ActionKey; app: AppKey }> = {
  generate_summary: { action: 'summarise_meeting', app: 'concludo' },
  generate_report: { action: 'build_report', app: 'concludo' },
  create_tasks: { action: 'create_actions', app: 'concludo' },
  send_teams_message: { action: 'post_message', app: 'teams' },
  send_slack_message: { action: 'post_message', app: 'slack' },
  send_outlook_message: { action: 'send_email', app: 'outlook' },
  create_todo_task: { action: 'create_task', app: 'microsoft_todo' },
  generate_approval_request: { action: 'ask_approval', app: 'concludo' },
  append_sheet_row: { action: 'add_sheet_row', app: 'google_sheets' },
};

function asApp(value: unknown): AppKey | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase().replace(/\s+/g, '_');
  if (Object.prototype.hasOwnProperty.call(APPS, v)) return v as AppKey;
  if (v === 'gcal' || v === 'google' || v === 'calendar') return 'google_calendar';
  if (v === 'sheets' || v === 'spreadsheet') return 'google_sheets';
  if (v === 'todo' || v === 'microsoft_todo' || v === 'to_do') return 'microsoft_todo';
  return null;
}

function stringSettings(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
  }
  return out;
}

function unsupportedStep(id: string, legacyType: string, label?: string): Step {
  const name = (legacyType || 'unknown').replace(/_/g, ' ');
  return {
    id,
    action: 'unsupported',
    app: 'concludo',
    label: label || `Older step: ${name}`,
    settings: { legacyType: legacyType || 'unknown' },
  };
}

/** Turns one saved step, old or new, into a step the builder can draw. Unknown actions stay visible and are not run. */
export function stepFromStored(raw: unknown, index: number, id: string): Step {
  if (!raw || typeof raw !== 'object') return unsupportedStep(id, 'unknown');
  const row = raw as Record<string, unknown>;
  const legacyType = String(row.action || row.actionType || row.type || row.stepType || row.key || '');
  const explicitApp = row.app || row.connector || row.application || row.service;
  const hinted = asApp(explicitApp);
  const known = legacyType && Object.prototype.hasOwnProperty.call(ACTIONS, legacyType) && legacyType !== 'unsupported'
    ? legacyType as ActionKey
    : null;
  if (known) {
    const spec = ACTIONS[known];
    if (explicitApp && !hinted) return unsupportedStep(typeof row.id === 'string' && row.id ? row.id : id, `${legacyType} via ${String(explicitApp)}`, typeof row.label === 'string' ? row.label : undefined);
    if (hinted && !spec.apps.includes(hinted)) return unsupportedStep(typeof row.id === 'string' && row.id ? row.id : id, `${legacyType} via ${hinted}`, typeof row.label === 'string' ? row.label : undefined);
    return {
      id: typeof row.id === 'string' && row.id ? row.id : id,
      action: known,
      app: hinted && spec.apps.includes(hinted) ? hinted : spec.apps[0],
      label: typeof row.label === 'string' && row.label ? row.label : spec.label,
      settings: stringSettings(row.settings || row.config || row.configuration),
      ...(row.autoAdded === true ? { autoAdded: true } : {}),
    };
  }
  const mapped = LEGACY_STEP[legacyType];
  if (mapped) {
    return {
      id: typeof row.id === 'string' && row.id ? row.id : id,
      action: mapped.action,
      app: mapped.app,
      label: typeof row.label === 'string' && row.label ? row.label : ACTIONS[mapped.action].label,
      settings: stringSettings(row.config || row.configuration || row.settings),
    };
  }
  if (legacyType === 'create_calendar_event' || legacyType === 'create_calendar_events') {
    if (hinted === 'google_calendar' || hinted === 'outlook') {
      return {
        id: typeof row.id === 'string' && row.id ? row.id : id,
        action: 'create_event',
        app: hinted,
        label: typeof row.label === 'string' && row.label ? row.label : ACTIONS.create_event.label,
        settings: { calendar: 'mine', ...stringSettings(row.config || row.settings) },
      };
    }
  }
  if (legacyType === 'create_crm_note' && hinted === 'hubspot') {
    return {
      id: typeof row.id === 'string' && row.id ? row.id : id,
      action: 'add_crm_note',
      app: 'hubspot',
      label: typeof row.label === 'string' && row.label ? row.label : ACTIONS.add_crm_note.label,
      settings: stringSettings(row.config || row.settings),
    };
  }
  if ((legacyType === 'send_external_email' || legacyType === 'send_completion_notification') && (hinted === 'outlook' || hinted === 'gmail')) {
    return {
      id: typeof row.id === 'string' && row.id ? row.id : id,
      action: 'send_email',
      app: hinted,
      label: typeof row.label === 'string' && row.label ? row.label : ACTIONS.send_email.label,
      settings: { to: 'attendees', ...stringSettings(row.config || row.settings) },
    };
  }
  const stepId = typeof row.id === 'string' && row.id ? row.id : id;
  return unsupportedStep(stepId, legacyType || 'unknown', typeof row.label === 'string' ? row.label : undefined);
}

export function stepsFromStored(raw: unknown, idFor: (index: number) => string): Step[] {
  const list = Array.isArray(raw) ? raw : [];
  return list.map((item, i) => stepFromStored(item, i, idFor(i)));
}

/** Reads a trigger from either the new trigger object or the older trigger_type column. */
export function triggerFromStored(triggerType: unknown, triggerConfig: unknown): { type: TriggerType; schedule?: string } {
  const tc = triggerConfig && typeof triggerConfig === 'object' ? triggerConfig as Record<string, unknown> : {};
  const nested = tc.trigger && typeof tc.trigger === 'object' ? tc.trigger as Record<string, unknown> : null;
  const typeRaw = String(nested?.type || triggerType || tc.type || 'meeting_completed');
  const schedule = typeof nested?.schedule === 'string' ? nested.schedule : typeof tc.schedule === 'string' ? tc.schedule : undefined;
  return { type: typeRaw as TriggerType, ...(schedule ? { schedule } : {}) };
}

/** Prefer steps already saved by this builder. Otherwise use an older definition. */
export function pickStoredSteps(row: { actions?: unknown; definition_json?: { steps?: unknown } | null }): unknown[] {
  const actions = Array.isArray(row.actions) ? row.actions : [];
  const defined = row.definition_json && Array.isArray(row.definition_json.steps) ? row.definition_json.steps : [];
  const looksCurrent = (list: unknown[]) => list.some((s) => {
    if (!s || typeof s !== 'object') return false;
    const step = s as Record<string, unknown>;
    return typeof step.action === 'string' && typeof step.app === 'string' && Object.prototype.hasOwnProperty.call(ACTIONS, step.action);
  });
  if (looksCurrent(actions)) return actions;
  if (defined.length) return defined;
  return actions;
}

export type RunStatus = 'running' | 'requires_approval' | 'completed' | 'failed' | 'rejected' | 'cancelled';
export type StepRunStatus = 'pending' | 'done' | 'nothing_to_do' | 'waiting' | 'previewed' | 'skipped' | 'failed';

export interface StepRun {
  stepId: string;
  label: string;
  status: StepRunStatus;
  note: string;
  at?: string;
}

export interface Run {
  id: string;
  workflowId: string;
  workflowName: string;
  test: boolean;
  status: RunStatus;
  startedBy: string;
  input: RunInput;
  steps: StepRun[];
  approvalId?: string | null;
  error?: string | null;
  retryOf?: string | null;
  startedAt: string;
  finishedAt?: string | null;
}

export interface OutgoingItem {
  stepId: string;
  app: AppKey;
  what: string;
  to: string;
  preview: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface Approval {
  id: string;
  kind: 'workflow' | 'agent_draft';
  workflowId?: string | null;
  runId?: string | null;
  title: string;
  status: ApprovalStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy?: string | null;
  decidedAt?: string | null;
  note?: string | null;
  /** Exactly what will leave Concludo if approved. Built from the run input, never invented. */
  outgoing: OutgoingItem[];
  /** Where the content came from. */
  source: string;
}

export interface Incident {
  id: string;
  workflowId: string;
  runId: string;
  stepLabel: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'acknowledged' | 'resolved';
  message: string;
  createdAt: string;
  resolvedBy?: string | null;
  resolution?: string | null;
}

export interface AuditEvent {
  id: string;
  at: string;
  actor: string;
  event: string;
  objectType: 'workflow' | 'run' | 'approval' | 'incident' | 'workspace' | 'agent';
  objectId: string;
  detail: string;
}

export type ConnectionState = 'connected' | 'needs_reauth' | 'permission_required' | 'service_issue' | 'disconnected';

/** What a run works on. Every field optional: the run uses what it is given and says what is missing. */
export interface RunInput {
  meeting?: { id?: string; title: string; date?: string; attendees?: string[]; summary?: string; consent?: 'recorded' | 'not_recorded' };
  actions?: Array<{ id?: string; title: string; owner?: string | null; due?: string | null; status?: string }>;
  decisions?: Array<{ id?: string; statement: string }>;
  risks?: Array<{ id?: string; text: string; rating: 'high' | 'medium' | 'low' }>;
  event?: Record<string, unknown>;
}

/* ============================================================== store */

export interface Store {
  getWorkflow(id: string): Promise<Workflow | null>;
  listWorkflows(): Promise<Workflow[]>;
  saveWorkflow(w: Workflow): Promise<void>;
  deleteWorkflow(id: string): Promise<void>;
  getRun(id: string): Promise<Run | null>;
  listRuns(): Promise<Run[]>;
  saveRun(r: Run): Promise<void>;
  getApproval(id: string): Promise<Approval | null>;
  listApprovals(): Promise<Approval[]>;
  saveApproval(a: Approval): Promise<void>;
  listIncidents(): Promise<Incident[]>;
  saveIncident(i: Incident): Promise<void>;
  listAudit(): Promise<AuditEvent[]>;
  appendAudit(e: AuditEvent): Promise<void>;
  connection(app: AppKey): Promise<ConnectionState>;
  /** A live check of one app. Absent means the store can only read its saved record, and the UI says so. */
  probe?(app: AppKey): Promise<{ state: ConnectionState; verified: boolean; simulated?: boolean; detail: string }>;
  /** Starts the app's own sign-in. Only a person can finish it. Absent means connecting happens elsewhere. */
  startConnect?(app: AppKey): Promise<{ ok: boolean; needsPerson: boolean; note: string }>;
  /** Hands an approved external step to the real connector. Returns what happened, honestly. */
  dispatch(item: OutgoingItem, run: Run): Promise<{ ok: boolean; note: string }>;
  /** Runs a Concludo agent for a "Run an AI agent" step. Absent means agents are not wired in. */
  runAgent?(agent: string, run: Run): Promise<{ ok: boolean; note: string }>;
  now(): string;
  id(prefix: string): string;
}

export class MemoryStore implements Store {
  workflows = new Map<string, Workflow>();
  runs = new Map<string, Run>();
  approvals = new Map<string, Approval>();
  incidents = new Map<string, Incident>();
  audit: AuditEvent[] = [];
  connections: Partial<Record<AppKey, ConnectionState>> = {};
  /** Preview dispatch: records the item, never sends. Tests can replace this. */
  outbox: Array<{ item: OutgoingItem; runId: string }> = [];
  dispatchImpl?: (item: OutgoingItem, run: Run) => Promise<{ ok: boolean; note: string }>;
  runAgent?: (agent: string, run: Run) => Promise<{ ok: boolean; note: string }>;
  private seq = 0;
  private clock?: () => string;
  constructor(opts: { connections?: Partial<Record<AppKey, ConnectionState>>; clock?: () => string } = {}) {
    this.connections = { concludo: 'connected', ...(opts.connections || {}) };
    this.clock = opts.clock;
  }
  async getWorkflow(id: string) { return clone(this.workflows.get(id) ?? null); }
  async listWorkflows() { return [...this.workflows.values()].map(clone); }
  async saveWorkflow(w: Workflow) { this.workflows.set(w.id, clone(w)); }
  async deleteWorkflow(id: string) { this.workflows.delete(id); }
  async getRun(id: string) { return clone(this.runs.get(id) ?? null); }
  async listRuns() { return [...this.runs.values()].map(clone).sort((a, b) => b.startedAt.localeCompare(a.startedAt)); }
  async saveRun(r: Run) { this.runs.set(r.id, clone(r)); }
  async getApproval(id: string) { return clone(this.approvals.get(id) ?? null); }
  async listApprovals() { return [...this.approvals.values()].map(clone).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)); }
  async saveApproval(a: Approval) { this.approvals.set(a.id, clone(a)); }
  async listIncidents() { return [...this.incidents.values()].map(clone).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  async saveIncident(i: Incident) { this.incidents.set(i.id, clone(i)); }
  async listAudit() { return [...this.audit].reverse(); }
  async appendAudit(e: AuditEvent) { this.audit.push(clone(e)); }
  async connection(app: AppKey) { return this.connections[app] ?? 'disconnected'; }
  /** Preview only: apps that report a service problem for this many checks, then recover. */
  recoversAfter: Partial<Record<AppKey, number>> = {};
  probeLog: AppKey[] = [];
  async probe(app: AppKey): Promise<{ state: ConnectionState; verified: boolean; simulated?: boolean; detail: string }> {
    this.probeLog.push(app);
    const left = this.recoversAfter[app];
    const label = appInfo(app).label;
    if (left !== undefined && left > 0) {
      this.recoversAfter[app] = left - 1;
      if (left - 1 === 0) { delete this.recoversAfter[app]; this.connections[app] = 'connected'; }
      else return { state: 'service_issue', verified: true, simulated: true, detail: `${label} did not answer. This is a preview check of the sample record.` };
    }
    return { state: await this.connection(app), verified: true, simulated: true, detail: 'Preview check of the sample record. A live Workspace checks the app itself.' };
  }
  async startConnect(app: AppKey) {
    return { ok: false, needsPerson: true, note: `${appInfo(app).label} has to be signed in by a person. In the Workspace this opens the app's own sign-in page.` };
  }
  /** Preview only: stands in for the person finishing the app's sign-in. */
  completeSignIn(app: AppKey) { this.connections[app] = 'connected'; }
  async dispatch(item: OutgoingItem, run: Run) {
    if (this.dispatchImpl) return this.dispatchImpl(item, run);
    this.outbox.push({ item, runId: run.id });
    return { ok: true, note: 'Recorded in the preview outbox. This preview is not connected, so nothing was sent.' };
  }
  now() { return this.clock ? this.clock() : new Date().toISOString(); }
  id(prefix: string) { this.seq += 1; return `${prefix}_${Date.now().toString(36)}${this.seq.toString(36)}`; }
}

function clone<T>(x: T): T { return x === null || x === undefined ? x : JSON.parse(JSON.stringify(x)); }

/* ============================================================== helpers */

const isExternal = (s: Step) => {
  const spec = actionInfo(s.action);
  if (spec.key === 'unsupported' || spec.kind !== 'do') return false;
  if (s.app && Object.prototype.hasOwnProperty.call(APPS, s.app)) return APPS[s.app].external;
  return spec.apps.length > 0 && spec.apps.every((a) => APPS[a].external);
};
const usable = (c: ConnectionState) => c === 'connected';
/** The state a workflow can rely on. With a live check, connected must be confirmed, never assumed. */
async function stateOf(store: Pick<Store, 'connection' | 'probe'>, app: AppKey): Promise<ConnectionState> {
  if (!app || !Object.prototype.hasOwnProperty.call(APPS, app)) return 'disconnected';
  if (!store.probe) return store.connection(app);
  try {
    const r = await store.probe(app);
    if (r.state === 'connected' && !r.verified) return 'service_issue';
    return r.state;
  } catch { return 'service_issue'; }
}
const CONNECTION_TEXT: Record<ConnectionState, string> = {
  connected: 'connected',
  needs_reauth: 'needs signing in again',
  permission_required: 'needs more permission',
  service_issue: 'is having a service problem',
  disconnected: 'is not connected',
};

export function newStep(store: Pick<Store, 'id'>, action: ActionKey, app?: AppKey, settings: Record<string, string> = {}): Step {
  const spec = ACTIONS[action];
  const defaults: Record<string, string> = {};
  spec.fields.forEach((f) => { if (f.kind === 'select' && f.options && f.required) defaults[f.key] = f.options[0].value; });
  const step: Step = { id: store.id('step'), action, app: app ?? spec.apps[0], label: spec.label, settings: { ...defaults, ...settings } };
  step.label = stepLabel(step);
  return step;
}

/** The default label for a step. Agent steps name their agent. */
export function stepLabel(step: Pick<Step, 'action' | 'settings'>): string {
  if (step.action === 'run_agent') return `Run the ${optionLabel(ACTIONS.run_agent.fields[0], step.settings.agent) || 'chosen'} agent`;
  return actionInfo(step.action).label;
}

async function audit(store: Store, actor: string, event: string, objectType: AuditEvent['objectType'], objectId: string, detail: string) {
  await store.appendAudit({ id: store.id('aud'), at: store.now(), actor, event, objectType, objectId, detail });
}

/* ============================================================== builder functions */

/** Insert an approval step in front of every external step that is not already guarded. */
export function ensureApprovals(wf: Workflow, store: Pick<Store, 'id'>): { workflow: Workflow; added: string[] } {
  const out: Step[] = [];
  const added: string[] = [];
  let guarded = false;
  for (const s of wf.steps) {
    if (actionInfo(s.action).kind === 'approval') guarded = true;
    if (isExternal(s) && !guarded) {
      const a = newStep(store, 'ask_approval');
      a.autoAdded = true;
      out.push(a);
      added.push(s.label);
      guarded = true;
    }
    out.push(s);
  }
  return { workflow: { ...wf, steps: out }, added };
}

const SURVEILLANCE = /\b(rank|ranking|score|scoring|scorecard|leaderboard|productivity of|performance of|monitor|track|surveil|watch)\b[^.]{0,40}\b(staff|employees?|people|person|individuals?|team members?|agents?|workers?)\b|\b(staff|employee|individual)\s+(performance|productivity|scores?)\b/i;

export interface Issue { level: 'block' | 'warn'; text: string; stepId?: string; fix?: 'add_approval' | 'connect' | 'fill' }

/** Plain-language checks. Anything at level 'block' stops a workflow being turned on. */
export async function validateWorkflow(wf: Workflow, store: Pick<Store, 'connection' | 'probe'>): Promise<Issue[]> {
  const issues: Issue[] = [];
  if (!wf.name.trim()) issues.push({ level: 'block', text: 'Give the workflow a name.' });
  if (!Object.prototype.hasOwnProperty.call(TRIGGERS, wf.trigger?.type)) {
    issues.push({ level: 'block', text: 'This workflow uses an older trigger. Choose a current trigger before turning it on.' });
  }
  if (!wf.steps.some((s) => actionInfo(s.action).kind === 'do' && s.action !== 'unsupported')) issues.push({ level: 'block', text: 'Add at least one step that does something.' });
  if (SURVEILLANCE.test(`${wf.name} ${wf.description} ${wf.steps.map((s) => `${s.label} ${Object.values(s.settings || {}).join(' ')}`).join(' ')}`)) {
    issues.push({ level: 'block', text: 'Concludo measures work, never people. Workflows that score, rank or monitor individuals cannot be built.' });
  }
  let guarded = false;
  for (const s of wf.steps) {
    const spec = actionInfo(s.action);
    if (s.action === 'unsupported' || !Object.prototype.hasOwnProperty.call(ACTIONS, s.action)) {
      issues.push({ level: 'block', text: `“${s.label}” is an older step Concludo does not run. Replace it before turning this workflow on.`, stepId: s.id });
      continue;
    }
    if (spec.kind === 'approval') guarded = true;
    const settings = s.settings || {};
    for (const f of spec.fields) {
      if (f.required && !(settings[f.key] || '').trim()) issues.push({ level: 'block', text: `“${s.label}”: add the ${f.label.toLowerCase()}.`, stepId: s.id, fix: 'fill' });
    }
    if (s.action === 'send_email' && settings.to === 'custom' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(settings.address || '')) {
      issues.push({ level: 'block', text: `“${s.label}” needs a valid email address.`, stepId: s.id, fix: 'fill' });
    }
    if (isExternal(s)) {
      if (!guarded) issues.push({ level: 'block', text: `“${s.label}” sends something outside Concludo, so a person must approve it first.`, stepId: s.id, fix: 'add_approval' });
      const c = await stateOf(store, s.app);
      if (!usable(c)) issues.push({ level: 'block', text: `${appInfo(s.app).label} ${CONNECTION_TEXT[c] || 'is not connected'}. Connect it before turning this workflow on.`, stepId: s.id, fix: 'connect' });
    }
  }
  if (wf.steps.length && actionInfo(wf.steps[wf.steps.length - 1].action).kind === 'approval') {
    issues.push({ level: 'warn', text: 'The last step is an approval with nothing after it. Approving it will do nothing.' });
  }
  return issues;
}


/* ============================================================== connections: honest checks and repair */

export interface ConnectionCheck {
  app: AppKey;
  state: ConnectionState;
  /** True only when a live check confirmed this state just now. A saved record is never verified on its own. */
  verified: boolean;
  /** True when the check read sample data, as in the preview. The Workspace must not set this. */
  simulated: boolean;
  checkedAt: string;
  detail: string;
}

const CONN_WORDS: Record<ConnectionState, string> = {
  connected: 'Connected',
  needs_reauth: 'Needs signing in again',
  permission_required: 'Needs more permission',
  service_issue: 'Not answering',
  disconnected: 'Not connected',
};

export async function checkConnection(store: Store, app: AppKey): Promise<ConnectionCheck> {
  const checkedAt = store.now();
  if (!APPS[app].external) return { app, state: 'connected', verified: true, simulated: false, checkedAt, detail: 'Inside Concludo.' };
  if (store.probe) {
    try {
      const r = await store.probe(app);
      return { app, state: r.state, verified: r.verified, simulated: !!r.simulated, checkedAt, detail: r.detail };
    } catch (e) {
      return { app, state: 'service_issue', verified: false, simulated: false, checkedAt, detail: `The check itself failed (${e instanceof Error ? e.message : 'unknown error'}). The real state is not known.` };
    }
  }
  return { app, state: await store.connection(app), verified: false, simulated: false, checkedAt, detail: 'Read from the saved record. It has not been checked against the app.' };
}

export async function checkAllConnections(store: Store): Promise<ConnectionCheck[]> {
  const apps = (Object.keys(APPS) as AppKey[]).filter((a) => APPS[a].external);
  return Promise.all(apps.map((a) => checkConnection(store, a)));
}

export interface RepairStep { label: string; status: 'done' | 'warn' | 'failed'; note: string }
export interface RepairReport {
  app: AppKey;
  workflowId: string;
  /** fixed: confirmed connected by a live check. needs_person: only a person can sign in. unverified: nothing could confirm it. unfixable: still failing. */
  outcome: 'fixed' | 'needs_person' | 'unverified' | 'unfixable';
  state: ConnectionState;
  steps: RepairStep[];
  /** Other apps that can do the same job and are connected right now. Applied only when a person confirms. */
  alternatives: Array<{ stepId: string; stepLabel: string; app: AppKey; label: string }>;
  summary: string;
}

/** The repair agent for a not-connected problem. It re-checks, retries a service problem, starts the sign-in, and offers a connected alternative. It never signs in for a person and never reports fixed unless a check confirms it. */
export async function repairConnection(store: Store, wf: Workflow, app: AppKey, actor: string, opts: { retries?: number; wait?: (ms: number) => Promise<void>; onStep?: (s: RepairStep) => void } = {}): Promise<RepairReport> {
  const steps: RepairStep[] = [];
  const add = (s: RepairStep) => { steps.push(s); opts.onStep?.(s); };
  const label = appInfo(app).label;
  const retries = opts.retries ?? 3;
  const wait = opts.wait ?? (async () => undefined);
  let c = await checkConnection(store, app);
  add({ label: `Checked ${label}`, status: c.state === 'connected' && c.verified ? 'done' : 'warn', note: `${CONN_WORDS[c.state]}. ${c.detail}` });
  if (c.state === 'service_issue') {
    for (let n = 1; n <= retries && c.state === 'service_issue'; n++) {
      await wait(600 * n);
      c = await checkConnection(store, app);
      add({ label: `Checked ${label} again (${n} of ${retries})`, status: c.state === 'connected' && c.verified ? 'done' : 'warn', note: `${CONN_WORDS[c.state]}.` });
    }
  } else if (c.state !== 'connected') {
    if (store.startConnect) {
      const r = await store.startConnect(app);
      add({ label: `Started the ${label} sign-in`, status: r.ok ? 'done' : 'warn', note: r.note });
      if (r.ok) { c = await checkConnection(store, app); add({ label: `Checked ${label} after sign-in`, status: c.state === 'connected' && c.verified ? 'done' : 'warn', note: `${CONN_WORDS[c.state]}.` }); }
    } else {
      add({ label: `Connect ${label}`, status: 'warn', note: 'Connecting happens on the Connect App page. Only a person can sign in to an app.' });
    }
  }
  let outcome: RepairReport['outcome'];
  if (c.state === 'connected' && c.verified) outcome = 'fixed';
  else if (c.state === 'connected') outcome = 'unverified';
  else if (c.state === 'service_issue') outcome = 'unfixable';
  else outcome = 'needs_person';
  const alternatives: RepairReport['alternatives'] = [];
  if (outcome !== 'fixed') {
    for (const s of wf.steps.filter((x) => x.app === app && actionInfo(x.action).kind === 'do' && x.action !== 'unsupported')) {
      for (const other of actionInfo(s.action).apps.filter((a) => a !== app && APPS[a].external)) {
        const o = await checkConnection(store, other);
        if (o.state === 'connected' && o.verified) alternatives.push({ stepId: s.id, stepLabel: s.label, app: other, label: appInfo(other).label });
      }
    }
  }
  const summary = outcome === 'fixed' ? `${label} is connected. A live check confirmed it just now.`
    : outcome === 'needs_person' ? `${label} needs a person to sign in. The agent cannot do that for you.`
    : outcome === 'unverified' ? `${label} looks connected in the saved record, but nothing could confirm it. It is not counted as fixed.`
    : `${label} is still having a service problem after ${retries} checks. Nothing was changed.`;
  await audit(store, actor, 'connection_repair', 'workflow', wf.id, `Workflow repair agent: ${summary}`);
  return { app, workflowId: wf.id, outcome, state: c.state, steps, alternatives, summary };
}

/** Swaps one step to another connected app. Called only after a person confirms. */
export async function applyAlternative(store: Store, wf: Workflow, stepId: string, app: AppKey, actor: string): Promise<Workflow> {
  const step = wf.steps.find((s) => s.id === stepId);
  if (!step) throw new Error('That step is no longer in the workflow.');
  if (!actionInfo(step.action).apps.includes(app)) throw new Error(`${appInfo(app).label} cannot do “${step.label}”.`);
  const from = appInfo(step.app).label;
  step.app = app;
  wf.updatedAt = store.now();
  await store.saveWorkflow(wf);
  await audit(store, actor, 'step_app_changed', 'workflow', wf.id, `“${step.label}” now uses ${appInfo(app).label} instead of ${from}.`);
  return wf;
}

/** A blank workflow for manual building. It has no steps, so it cannot be turned on until a person adds one. */
export function blankWorkflow(store: Pick<Store, 'id' | 'now'>, ownerId: string, trigger: Workflow['trigger'] = { type: 'meeting_completed' }, name = 'New workflow'): Workflow {
  const now = store.now();
  return { id: store.id('wf'), name, description: '', ownerId, status: 'draft', trigger, steps: [], consecutiveFailures: 0, createdAt: now, updatedAt: now };
}

/** The left-hand explanation in the builder, one sentence per step. */
export function explainWorkflow(wf: Workflow): string[] {
  const trig = triggerInfo(wf.trigger?.type);
  const lines = [`When ${trig.label.toLowerCase()}${wf.trigger?.type === 'workflow_schedule' && wf.trigger.schedule ? ` (${wf.trigger.schedule})` : ''}:`];
  wf.steps.forEach((s) => lines.push(actionInfo(s.action).explain({ ...s, settings: s.settings || {} })));
  return lines;
}

/* ============================================================== plain English to workflow */

const PLAN_TRIGGERS: Array<[RegExp, TriggerType, string?]> = [
  [/\b(meeting|call|session)\b[^.]{0,30}\b(ends?|ended|finish|finished|completed?|saved|is over)\b|\bafter (each |every |a )?(meeting|call)\b/i, 'meeting_completed'],
  [/\b(every|each)\s+(monday|tuesday|wednesday|thursday|friday|week|weekday|morning|day)\b|\bweekly\b|\bdaily\b/i, 'workflow_schedule'],
  [/\baction\b[^.]{0,20}\b(is |gets )?(completed|done|closed)\b/i, 'action_completed'],
  [/\b(new|an?) action\b|\baction is (created|added)\b/i, 'action_created'],
  [/\bdecision\b[^.]{0,15}\b(made|saved|recorded)\b/i, 'decision_created'],
  [/\b(new|a) project\b|\bproject is created\b/i, 'project_created'],
  [/\bwebhook\b|\b(form|another app|stripe|crm) (sends|submits)\b/i, 'webhook_event'],
];

const PLAN_STEPS: Array<[RegExp, ActionKey, AppKey?, Record<string, string>?]> = [
  [/\bconsent\b/i, 'run_agent', 'concludo', { agent: 'consent_check' }],
  [/\b(hygiene|tidy|clean ?up)\b/i, 'run_agent', 'concludo', { agent: 'record_hygiene' }],
  [/\b(promises?|commitments?)\b/i, 'run_agent', 'concludo', { agent: 'client_commitments' }],
  [/\bvendor (update|report)s?\b/i, 'run_agent', 'concludo', { agent: 'vendor_campaign_update' }],
  [/\b(board|steering)[- ](pack|deck)\b/i, 'run_agent', 'concludo', { agent: 'board_pack' }],
  [/\b(prep|prepare)\b[^.]{0,25}\b(brief|meeting)\b|\bmeeting prep\b|\bprep brief\b/i, 'run_agent', 'concludo', { agent: 'meeting_prep' }],
  [/\bsummar(y|ise|ize)\b/i, 'summarise_meeting'],
  [/\b(actions?|tasks?)\b[^.]{0,25}\b(tracker|add|create|log|record)\b|\b(add|create|log|record)\b[^.]{0,25}\b(actions?)\b/i, 'create_actions'],
  [/\bdecisions?\b/i, 'save_decisions'],
  [/\b(board|weekly|status|overdue)?\s*report\b/i, 'build_report'],
  [/\bto ?do\b/i, 'create_task', 'microsoft_todo'],
  [/\bcalendar|deadlines?\b/i, 'create_event', 'google_calendar'],
  [/\bslack\b/i, 'post_message', 'slack'],
  [/\bteams\b/i, 'post_message', 'teams'],
  [/\b(e-?mail|follow[- ]?up)\b/i, 'send_email', 'outlook', { to: 'attendees', subject: 'Outcomes and actions from our meeting' }],
  [/\b(hubspot|crm)\b/i, 'add_crm_note', 'hubspot'],
  [/\b(sheet|spreadsheet)\b/i, 'add_sheet_row', 'google_sheets', { sheet: 'Action log' }],
  [/\bnotify me\b|\blet me know\b|\balert me\b/i, 'notify_me'],
  [/\bapprov|\bcheck (it|with me)\b|\bsign[- ]?off\b/i, 'ask_approval'],
];

export interface PlanResult {
  status: 'complete' | 'needs_clarification';
  workflow: Workflow;
  understood: string[];
  unclear: string[];
  addedApprovals: string[];
}

/** Deterministic: the same words always give the same workflow. It says what it did not understand. */
export function planFromDescription(text: string, store: Pick<Store, 'id' | 'now'>, ownerId: string): PlanResult {
  const now = store.now();
  const wf: Workflow = { id: store.id('wf'), name: '', description: text.trim(), ownerId, status: 'draft', trigger: { type: 'meeting_completed' }, steps: [], consecutiveFailures: 0, createdAt: now, updatedAt: now };
  const understood: string[] = [];
  const unclear: string[] = [];
  const trig = PLAN_TRIGGERS.find(([re]) => re.test(text));
  if (trig) {
    wf.trigger = { type: trig[1] };
    if (trig[1] === 'workflow_schedule') {
      const m = text.match(/\b(every|each)\s+(\w+)( morning)?|\b(weekly|daily)\b/i);
      wf.trigger.schedule = m ? m[0].replace(/^each/i, 'Every').replace(/^every/i, 'Every') : 'Every Monday';
    }
    understood.push(`Starts when ${TRIGGERS[wf.trigger.type].label.toLowerCase()}`);
  } else unclear.push('When it should start. Choose a trigger.');

  const clauses = text.split(/,|;|\bthen\b|\band then\b|\band\b|\.|\bafter that\b/i).map((c) => c.trim()).filter((c) => c.length > 2);
  for (const c of clauses) {
    if (trig && trig[0].test(c) && !PLAN_STEPS.some(([re]) => re.test(c))) continue;
    const hit = PLAN_STEPS.find(([re]) => re.test(c));
    if (hit) {
      if (wf.steps.some((s) => s.action === hit[1] && s.app === (hit[2] ?? ACTIONS[hit[1]].apps[0]) && (s.settings.agent || '') === (hit[3]?.agent || ''))) continue;
      const settings = { ...(hit[3] || {}) };
      if (hit[1] === 'post_message') settings.channel = (c.match(/#[\w-]+/) || ['#project-updates'])[0];
      if (hit[1] === 'build_report') settings.report = /overdue/i.test(c) ? 'overdue' : /board/i.test(c) ? 'board_briefing' : 'weekly_status';
      if (hit[1] === 'send_email' && /\bme\b|myself/i.test(c)) settings.to = 'me';
      wf.steps.push(newStep(store, hit[1], hit[2], settings));
      understood.push(hit[1] === 'run_agent' ? `Run the ${optionLabel(ACTIONS.run_agent.fields[0], settings.agent)} agent` : ACTIONS[hit[1]].label + (hit[2] ? ` (${APPS[hit[2]].label})` : ''));
    } else if (/\b(only if|if|unless|when)\b/i.test(c) && /\b(overdue|high|risk|decision|action)/i.test(c)) {
      const rule = /overdue/i.test(c) ? 'has_overdue' : /risk|high/i.test(c) ? 'has_high_risk' : /decision/i.test(c) ? 'has_decisions' : 'has_actions';
      wf.steps.push(newStep(store, 'only_if', 'concludo', { rule }));
      understood.push(`Only continues if ${optionLabel(ACTIONS.only_if.fields[0], rule)!.toLowerCase()}`);
    } else if (!(trig && trig[0].test(c))) {
      unclear.push(`“${c}”`);
    }
  }
  // conditions first
  wf.steps.sort((a, b) => (a.action === 'only_if' ? -1 : 0) - (b.action === 'only_if' ? -1 : 0));
  const guarded = ensureApprovals(wf, store);
  wf.steps = guarded.workflow.steps;
  wf.name = nameFor(wf);
  return { status: !trig || !wf.steps.length || unclear.length ? 'needs_clarification' : 'complete', workflow: wf, understood, unclear, addedApprovals: guarded.added };
}

function nameFor(wf: Workflow): string {
  const known = Object.prototype.hasOwnProperty.call(TRIGGERS, wf.trigger.type)
    ? { meeting_completed: 'After each meeting', workflow_schedule: wf.trigger.schedule || 'On a schedule', action_created: 'New action', action_completed: 'Action completed', decision_created: 'New decision', project_created: 'New project', report_generated: 'Report generated', webhook_event: 'App event' }[wf.trigger.type]
    : triggerInfo(wf.trigger.type).label;
  const t = known || triggerInfo(wf.trigger.type).label;
  const main = wf.steps.find((s) => isExternal(s)) || wf.steps.find((s) => s.action !== 'unsupported' && actionInfo(s.action).kind === 'do');
  return main ? `${t}: ${main.label.toLowerCase()}` : t;
}

/* ============================================================== running */

export class GovernanceBlock extends Error {}

function pausedText(wf: Workflow): string {
  return wf.pausedBy === 'workspace_stop'
    ? 'All workflows are stopped from the Governance Centre.'
    : wf.pausedBy === 'quarantine'
      ? `Paused automatically after ${wf.consecutiveFailures} failed runs in a row.`
      : 'This workflow is paused.';
}

/** What an internal step does with the input. Honest about empty input. */
function runInternal(step: Step, input: RunInput): { status: StepRunStatus; note: string } {
  const a = input.actions || [];
  const d = input.decisions || [];
  switch (step.action) {
    case 'summarise_meeting':
      if (!input.meeting) return { status: 'failed', note: 'No meeting in the input, so there is nothing to summarise.' };
      return { status: 'done', note: `Summary prepared for “${input.meeting.title}”${input.meeting.attendees?.length ? `, ${input.meeting.attendees.length} attendees` : ''}.` };
    case 'create_actions':
      if (!a.length) return { status: 'nothing_to_do', note: 'No actions in the input. Nothing was added.' };
      return { status: 'done', note: `${a.length} action${a.length === 1 ? '' : 's'} added to the tracker${a.some((x) => !x.owner) ? `, ${a.filter((x) => !x.owner).length} without an owner` : ''}.` };
    case 'save_decisions':
      if (!d.length) return { status: 'nothing_to_do', note: 'No decisions in the input. Nothing was saved.' };
      return { status: 'done', note: `${d.length} decision${d.length === 1 ? '' : 's'} saved to Decision memory.` };
    case 'build_report': {
      const overdue = a.filter((x) => x.due && x.status !== 'completed' && x.due < (input.event?.today as string || '9999')).length;
      return { status: 'done', note: `Report built from ${a.length} action${a.length === 1 ? '' : 's'}, ${d.length} decision${d.length === 1 ? '' : 's'} and ${(input.risks || []).length} risk${(input.risks || []).length === 1 ? '' : 's'}${overdue ? `; ${overdue} overdue` : ''}.` };
    }
    case 'notify_me':
      return { status: 'done', note: 'Notification added to your Concludo inbox.' };
    default:
      return { status: 'failed', note: 'Unknown step.' };
  }
}

function conditionMet(step: Step, input: RunInput): boolean {
  const a = input.actions || [];
  const today = (input.event?.today as string) || new Date().toISOString().slice(0, 10);
  switch (step.settings.rule) {
    case 'has_actions': return a.length > 0;
    case 'has_overdue': return a.some((x) => x.due && x.status !== 'completed' && x.due < today);
    case 'has_high_risk': return (input.risks || []).some((r) => r.rating === 'high');
    case 'has_decisions': return (input.decisions || []).length > 0;
    default: return false;
  }
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
/** Australian long date from an ISO date, with no locale dependency: 2026-11-09 becomes 9 November 2026. */
export function auDate(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : String(iso || '');
}

/** What an external step would send, built only from the input. */
export function outgoingFor(step: Step, input: RunInput): OutgoingItem {
  const a = input.actions || [];
  const app = appInfo(step.app).label;
  const to = step.action === 'send_email'
    ? step.settings.to === 'custom' ? step.settings.address || 'an address' : optionLabel(recipients, step.settings.to) || 'recipients'
    : step.action === 'post_message' ? step.settings.channel || 'a channel'
      : step.action === 'create_event' ? (step.settings.calendar === 'owners' ? 'Each action owner’s calendar' : 'My calendar')
        : step.action === 'create_task' ? `List “${step.settings.list || 'Tasks'}”`
          : step.action === 'add_sheet_row' ? `Sheet “${step.settings.sheet || ''}”` : 'Client record';
  let preview = '';
  if (step.action === 'send_email' || step.action === 'post_message' || step.action === 'add_crm_note') {
    const lines: string[] = [];
    if (step.action === 'send_email') lines.push(`Subject: ${step.settings.subject || '(no subject)'}`);
    if (input.meeting) lines.push(`${input.meeting.title}${input.meeting.date ? `, ${auDate(input.meeting.date)}` : ''}`);
    if (input.meeting?.summary) lines.push('', input.meeting.summary);
    if ((input.decisions || []).length) lines.push('', 'Decisions', ...input.decisions!.map((x) => `- ${x.statement}`));
    if (a.length) lines.push('', 'Actions', ...a.map((x) => `- ${x.title}: ${x.owner || 'owner not named'}${x.due ? `, by ${auDate(x.due)}` : ', no date set'}`));
    preview = lines.length ? lines.join('\n') : 'The input was empty. Approving would send an empty message.';
  } else {
    const dated = step.action === 'create_event' ? a.filter((x) => x.due) : a;
    preview = dated.length ? dated.map((x) => `${x.title}${x.due ? ` (${auDate(x.due)})` : ''}${x.owner ? `, ${x.owner}` : ''}`).join('\n') : step.action === 'create_event' ? 'No dated actions in the input. Nothing would be added.' : 'No actions in the input. Nothing would be added.';
  }
  return { stepId: step.id, app: step.app, what: `${actionInfo(step.action).label} (${app})`, to, preview };
}

export interface RunOptions { input?: RunInput; actor: string; test?: boolean; retryOf?: string }

/**
 * Start a run. Live runs stop at the first approval step and create one approval that lists every
 * external item after it. Test runs never send and never create approvals: they preview.
 */
export async function runWorkflow(store: Store, workflowId: string, opts: RunOptions): Promise<Run> {
  const wf = await store.getWorkflow(workflowId);
  if (!wf) throw new Error('Workflow not found.');
  if (!opts.test) {
    if (wf.status === 'paused') throw new GovernanceBlock(pausedText(wf));
    if (wf.status === 'draft') throw new GovernanceBlock('Turn this workflow on before running it live, or use Test run.');
    const blocks = (await validateWorkflow(wf, store)).filter((i) => i.level === 'block');
    if (blocks.length) throw new GovernanceBlock(blocks[0].text);
  }
  const run: Run = {
    id: store.id('run'), workflowId: wf.id, workflowName: wf.name, test: !!opts.test, status: 'running', startedBy: opts.actor,
    input: opts.input || {}, steps: wf.steps.map((s) => ({ stepId: s.id, label: s.label, status: 'pending', note: '' })),
    approvalId: null, error: null, retryOf: opts.retryOf ?? null, startedAt: store.now(), finishedAt: null,
  };
  await store.saveRun(run);
  await audit(store, opts.actor, run.test ? 'test_run_started' : opts.retryOf ? 'run_retried' : 'run_started', 'run', run.id, `${wf.name}`);
  if (run.input.meeting?.consent === 'not_recorded') return hold(store, wf, run, opts.actor);
  return continueRun(store, wf, run, 0, opts.actor);
}

/** Consent hold: a run that starts from a meeting with no consent basis recorded stops before any step. Not a failure: no incident, no quarantine count. */
async function hold(store: Store, wf: Workflow, run: Run, actor: string): Promise<Run> {
  const msg = `Held: no consent basis is recorded for “${run.input.meeting!.title}”. Record it with the Consent check agent, then retry. Nothing was done.`;
  run.steps.forEach((s) => { s.status = 'skipped'; s.note = 'Not started: consent basis missing.'; });
  run.error = msg;
  run.status = 'cancelled';
  run.finishedAt = store.now();
  await store.saveRun(run);
  await audit(store, actor, run.test ? 'test_run_held' : 'run_held', 'run', run.id, `${wf.name}: no consent basis recorded`);
  return run;
}

async function continueRun(store: Store, wf: Workflow, run: Run, from: number, actor: string): Promise<Run> {
  for (let i = from; i < wf.steps.length; i++) {
    const step = wf.steps[i];
    const sr = run.steps[i];
    const spec = actionInfo(step.action);
    sr.at = store.now();
    if (step.action === 'unsupported' || !Object.prototype.hasOwnProperty.call(ACTIONS, step.action)) {
      return fail(store, wf, run, i, `“${step.label}” is an older step Concludo does not run. Nothing was changed.`, actor, 'medium');
    }
    if (spec.kind === 'only_if') {
      if (conditionMet(step, run.input)) {
        sr.status = 'done';
        sr.note = 'Condition met. Continuing.';
      } else {
        sr.status = 'done';
        sr.note = 'Condition not met. The workflow stopped here, as designed.';
        for (let j = i + 1; j < run.steps.length; j++) { run.steps[j].status = 'skipped'; run.steps[j].note = 'Skipped: condition not met.'; }
        return finish(store, wf, run, 'completed', actor);
      }
      continue;
    }
    if (spec.kind === 'approval') {
      const outgoing = wf.steps.slice(i + 1).filter(isExternal).map((s) => outgoingFor(s, run.input));
      if (run.test) {
        sr.status = 'previewed';
        sr.note = `In a live run, this waits for approval of ${outgoing.length} item${outgoing.length === 1 ? '' : 's'}.`;
        continue;
      }
      const ap: Approval = {
        id: store.id('apr'), kind: 'workflow', workflowId: wf.id, runId: run.id, title: wf.name, status: 'pending',
        requestedBy: run.startedBy, requestedAt: store.now(), outgoing,
        source: run.input.meeting ? `Meeting: ${run.input.meeting.title}` : run.input.event ? 'App event' : 'Workflow input',
      };
      await store.saveApproval(ap);
      sr.status = 'waiting';
      sr.note = 'Waiting for approval in the Approval Centre.';
      run.status = 'requires_approval';
      run.approvalId = ap.id;
      await store.saveRun(run);
      await audit(store, actor, 'approval_requested', 'approval', ap.id, `${wf.name}: ${outgoing.length} ${outgoing.length === 1 ? 'item' : 'items'} to approve`);
      return run;
    }
    if (isExternal(step)) {
      const item = outgoingFor(step, run.input);
      if (run.test) {
        sr.status = 'previewed';
        sr.note = `Would send to ${item.to}. Test runs never send.`;
        continue;
      }
      const c = await stateOf(store, step.app);
      if (!usable(c)) return fail(store, wf, run, i, `${appInfo(step.app).label} ${CONNECTION_TEXT[c] || 'is not connected'}. Nothing was sent.`, actor, 'high');
      const res = await store.dispatch(item, run);
      if (!res.ok) return fail(store, wf, run, i, res.note, actor, 'high');
      sr.status = 'done';
      sr.note = res.note;
      continue;
    }
    if (step.action === 'run_agent') {
      const name = optionLabel(ACTIONS.run_agent.fields[0], step.settings.agent) || 'chosen';
      if (run.test) { sr.status = 'previewed'; sr.note = `Would run the ${name} agent. Test runs never create drafts.`; continue; }
      if (!store.runAgent) return fail(store, wf, run, i, 'Agents are not connected to workflows in this workspace yet.', actor, 'medium');
      const res = await store.runAgent(step.settings.agent, run);
      if (!res.ok) return fail(store, wf, run, i, res.note, actor, 'medium');
      sr.status = 'done';
      sr.note = res.note;
      continue;
    }
    const r = runInternal(step, run.input);
    if (r.status === 'failed') return fail(store, wf, run, i, r.note, actor, 'medium');
    sr.status = r.status;
    sr.note = r.note;
  }
  return finish(store, wf, run, 'completed', actor);
}

async function finish(store: Store, wf: Workflow, run: Run, status: RunStatus, actor: string): Promise<Run> {
  run.status = status;
  run.finishedAt = store.now();
  await store.saveRun(run);
  if (!run.test && status === 'completed') {
    const fresh = (await store.getWorkflow(wf.id))!;
    if (fresh.consecutiveFailures) { fresh.consecutiveFailures = 0; await store.saveWorkflow(fresh); }
  }
  await audit(store, actor, run.test ? 'test_run_finished' : `run_${status}`, 'run', run.id, wf.name);
  return run;
}

export const QUARANTINE_AFTER = 3;

async function fail(store: Store, wf: Workflow, run: Run, i: number, message: string, actor: string, severity: Incident['severity']): Promise<Run> {
  run.steps[i].status = 'failed';
  run.steps[i].note = message;
  for (let j = i + 1; j < run.steps.length; j++) { run.steps[j].status = 'skipped'; run.steps[j].note = 'Skipped: an earlier step failed.'; }
  run.error = message;
  run.status = 'failed';
  run.finishedAt = store.now();
  await store.saveRun(run);
  await audit(store, actor, run.test ? 'test_run_failed' : 'run_failed', 'run', run.id, `${wf.name}: ${message}`);
  if (run.test) return run;
  const inc: Incident = { id: store.id('inc'), workflowId: wf.id, runId: run.id, stepLabel: run.steps[i].label, severity, status: 'open', message, createdAt: store.now() };
  await store.saveIncident(inc);
  await audit(store, 'Concludo', 'incident_opened', 'incident', inc.id, `${wf.name}: ${message}`);
  const fresh = (await store.getWorkflow(wf.id))!;
  fresh.consecutiveFailures = (fresh.consecutiveFailures || 0) + 1;
  if (fresh.consecutiveFailures >= QUARANTINE_AFTER && fresh.status === 'active') {
    fresh.status = 'paused';
    fresh.pausedBy = 'quarantine';
    await audit(store, 'Concludo', 'workflow_quarantined', 'workflow', wf.id, `Paused after ${fresh.consecutiveFailures} failed runs in a row.`);
  }
  fresh.updatedAt = store.now();
  await store.saveWorkflow(fresh);
  return run;
}

/** Start a new live run with the same input. The failed run is kept as history. */
export async function retryRun(store: Store, runId: string, actor: string, freshInput?: RunInput): Promise<Run> {
  const old = await store.getRun(runId);
  if (!old) throw new Error('Run not found.');
  if (old.status !== 'failed' && old.status !== 'cancelled') throw new Error('Only failed or cancelled runs can be retried.');
  return runWorkflow(store, old.workflowId, { input: freshInput || old.input, actor, retryOf: old.id });
}

/* ============================================================== approvals */

export async function decideApproval(store: Store, approvalId: string, decision: 'approve' | 'reject', actor: string, note?: string): Promise<{ approval: Approval; run?: Run | null }> {
  const ap = await store.getApproval(approvalId);
  if (!ap) throw new Error('Approval not found.');
  if (ap.status !== 'pending') throw new Error(`Already ${ap.status}${ap.decidedBy ? ` by ${ap.decidedBy}` : ''}. Nothing was changed.`);
  if (decision === 'reject' && !(note || '').trim()) throw new Error('Say why you are rejecting it. The reason is kept with the run.');
  if (ap.kind === 'workflow' && ap.workflowId) {
    const wf = await store.getWorkflow(ap.workflowId);
    if (!wf) throw new Error('The workflow for this approval no longer exists.');
    if (decision === 'approve' && wf.status === 'paused') throw new GovernanceBlock(`${pausedText(wf)} Resume it before approving. This approval stays waiting.`);
  }
  ap.status = decision === 'approve' ? 'approved' : 'rejected';
  ap.decidedBy = actor;
  ap.decidedAt = store.now();
  ap.note = (note || '').trim() || null;
  await store.saveApproval(ap);
  await audit(store, actor, decision === 'approve' ? 'approval_granted' : 'approval_rejected', 'approval', ap.id, `${ap.title}${ap.note ? `: ${ap.note}` : ''}`);
  if (ap.kind !== 'workflow' || !ap.runId) return { approval: ap, run: null };
  const run = await store.getRun(ap.runId);
  const wf = await store.getWorkflow(ap.workflowId!);
  if (!run || !wf) return { approval: ap, run: null };
  const gate = run.steps.findIndex((s) => s.status === 'waiting');
  if (decision === 'reject') {
    if (gate >= 0) { run.steps[gate].status = 'done'; run.steps[gate].note = `Rejected by ${actor}: ${ap.note}`; }
    for (let j = gate + 1; j < run.steps.length; j++) { run.steps[j].status = 'skipped'; run.steps[j].note = 'Skipped: rejected.'; }
    return { approval: ap, run: await finish(store, wf, run, 'rejected', actor) };
  }
  if (gate >= 0) { run.steps[gate].status = 'done'; run.steps[gate].note = `Approved by ${actor}.`; }
  run.status = 'running';
  await store.saveRun(run);
  return { approval: ap, run: await continueRun(store, wf, run, gate + 1, actor) };
}

/** Pending approvals older than the limit expire, and their runs are cancelled. */
export async function expireStaleApprovals(store: Store, hours = 72, actor = 'Concludo'): Promise<number> {
  const cutoff = new Date(Date.parse(store.now()) - hours * 3600_000).toISOString();
  let n = 0;
  for (const ap of await store.listApprovals()) {
    if (ap.status !== 'pending' || ap.requestedAt > cutoff) continue;
    ap.status = 'expired';
    ap.decidedAt = store.now();
    await store.saveApproval(ap);
    n++;
    if (ap.runId) {
      const run = await store.getRun(ap.runId);
      if (run && run.status === 'requires_approval') {
        run.status = 'cancelled';
        run.finishedAt = store.now();
        run.steps.forEach((s) => { if (s.status === 'waiting' || s.status === 'pending') { s.status = 'skipped'; s.note = `Approval expired after ${hours} hours.`; } });
        await store.saveRun(run);
      }
    }
    await audit(store, actor, 'approval_expired', 'approval', ap.id, `${ap.title}: not decided within ${hours} hours`);
  }
  return n;
}

/** An agent draft that a person must approve. Approving never sends: Concludo does not send agent drafts. */
export async function requestDraftApproval(store: Store, params: { title: string; actor: string; source: string; items: OutgoingItem[] }): Promise<Approval> {
  const ap: Approval = { id: store.id('apr'), kind: 'agent_draft', title: params.title, status: 'pending', requestedBy: params.actor, requestedAt: store.now(), outgoing: params.items, source: params.source };
  await store.saveApproval(ap);
  await audit(store, params.actor, 'approval_requested', 'approval', ap.id, params.title);
  return ap;
}

/* ============================================================== governance */

export async function setActive(store: Store, workflowId: string, on: boolean, actor: string): Promise<Workflow> {
  const wf = await store.getWorkflow(workflowId);
  if (!wf) throw new Error('Workflow not found.');
  if (on) {
    if (wf.pausedBy === 'workspace_stop') throw new GovernanceBlock('All workflows are stopped. Release the stop in the Governance Centre first.');
    const blocks = (await validateWorkflow(wf, store)).filter((i) => i.level === 'block');
    if (blocks.length) throw new GovernanceBlock(blocks[0].text);
    wf.status = 'active';
    wf.pausedBy = null;
    wf.consecutiveFailures = 0;
  } else {
    if (wf.status !== 'active') return wf;
    wf.status = 'paused';
    wf.pausedBy = 'you';
  }
  wf.updatedAt = store.now();
  await store.saveWorkflow(wf);
  await audit(store, actor, on ? 'workflow_turned_on' : 'workflow_paused', 'workflow', wf.id, wf.name);
  return wf;
}

/** The workspace stop: pauses every active workflow at once. Nothing runs and nothing can be approved until released. */
export async function stopEverything(store: Store, actor: string, reason: string): Promise<number> {
  if (!reason.trim()) throw new Error('Give a reason. It is kept in the audit log.');
  let n = 0;
  for (const wf of await store.listWorkflows()) {
    if (wf.status !== 'active') continue;
    wf.status = 'paused';
    wf.pausedBy = 'workspace_stop';
    wf.updatedAt = store.now();
    await store.saveWorkflow(wf);
    n++;
  }
  await audit(store, actor, 'workspace_stopped', 'workspace', 'workspace', `${n} ${n === 1 ? 'workflow' : 'workflows'} stopped: ${reason.trim()}`);
  return n;
}

/** Releases the workspace stop. Only workflows the stop paused are turned back on. */
export async function releaseStop(store: Store, actor: string): Promise<number> {
  let n = 0;
  for (const wf of await store.listWorkflows()) {
    if (wf.pausedBy !== 'workspace_stop') continue;
    wf.status = 'active';
    wf.pausedBy = null;
    wf.updatedAt = store.now();
    await store.saveWorkflow(wf);
    n++;
  }
  await audit(store, actor, 'workspace_stop_released', 'workspace', 'workspace', `${n} ${n === 1 ? 'workflow' : 'workflows'} resumed`);
  return n;
}

export async function isWorkspaceStopped(store: Store): Promise<boolean> {
  return (await store.listWorkflows()).some((w) => w.pausedBy === 'workspace_stop');
}

export async function resolveIncident(store: Store, incidentId: string, actor: string, resolution: string): Promise<Incident> {
  if (!resolution.trim()) throw new Error('Say what fixed it. The note is kept with the incident.');
  const inc = (await store.listIncidents()).find((i) => i.id === incidentId);
  if (!inc) throw new Error('Incident not found.');
  inc.status = 'resolved';
  inc.resolvedBy = actor;
  inc.resolution = resolution.trim();
  await store.saveIncident(inc);
  await audit(store, actor, 'incident_resolved', 'incident', inc.id, resolution.trim());
  return inc;
}

export interface Health {
  runs7d: number;
  completed7d: number;
  failed7d: number;
  successRate: number | null;
  waitingApprovals: number;
  oldestWaitHours: number | null;
  openIncidents: number;
  activeWorkflows: number;
  pausedWorkflows: number;
  quarantined: number;
  stopped: boolean;
}

/** Every figure is counted from records. Nothing is estimated or fixed. */
export async function health(store: Store): Promise<Health> {
  const now = Date.parse(store.now());
  const since = new Date(now - 7 * 86400_000).toISOString();
  const runs = (await store.listRuns()).filter((r) => !r.test && r.startedAt >= since);
  const done = runs.filter((r) => r.status === 'completed').length;
  const failed = runs.filter((r) => r.status === 'failed').length;
  const pend = (await store.listApprovals()).filter((a) => a.status === 'pending');
  const wfs = await store.listWorkflows();
  const finished = done + failed;
  return {
    runs7d: runs.length,
    completed7d: done,
    failed7d: failed,
    successRate: finished ? Math.round((done / finished) * 100) : null,
    waitingApprovals: pend.length,
    oldestWaitHours: pend.length ? Math.round((now - Math.min(...pend.map((a) => Date.parse(a.requestedAt)))) / 3600_000) : null,
    openIncidents: (await store.listIncidents()).filter((i) => i.status !== 'resolved').length,
    activeWorkflows: wfs.filter((w) => w.status === 'active').length,
    pausedWorkflows: wfs.filter((w) => w.status === 'paused').length,
    quarantined: wfs.filter((w) => w.pausedBy === 'quarantine').length,
    stopped: wfs.some((w) => w.pausedBy === 'workspace_stop'),
  };
}

/* ============================================================== templates */

export interface TemplateSpec { key: string; name: string; summary: string; build: (store: Pick<Store, 'id'>) => Pick<Workflow, 'trigger' | 'steps'> }

export const TEMPLATES: TemplateSpec[] = [
  { key: 'meeting-follow-through', name: 'Meeting follow-through', summary: 'Summarise, log actions and decisions, then email attendees after approval.', build: (s) => ({ trigger: { type: 'meeting_completed' }, steps: [newStep(s, 'summarise_meeting'), newStep(s, 'create_actions'), newStep(s, 'save_decisions'), { ...newStep(s, 'ask_approval') }, newStep(s, 'send_email', 'outlook', { to: 'attendees', subject: 'Outcomes and actions from our meeting' })] }) },
  { key: 'calendar-deadline-creation', name: 'Deadlines to calendar', summary: 'Put every dated action into the owner’s calendar, after approval.', build: (s) => ({ trigger: { type: 'meeting_completed' }, steps: [newStep(s, 'create_actions'), newStep(s, 'only_if', 'concludo', { rule: 'has_actions' }), newStep(s, 'ask_approval'), newStep(s, 'create_event', 'google_calendar', { calendar: 'owners' })] }) },
  { key: 'weekly-project-status-review', name: 'Weekly status report', summary: 'Every Monday, build a status report and notify you. Nothing leaves Concludo.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'Every Monday' }, steps: [newStep(s, 'build_report', 'concludo', { report: 'weekly_status' }), newStep(s, 'notify_me', 'concludo', { message: 'Your weekly status report is ready.' })] }) },
  { key: 'overdue-action-chase', name: 'Overdue action reminders', summary: 'Each weekday, if anything is overdue, draft reminders to owners for approval.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'Every weekday' }, steps: [newStep(s, 'only_if', 'concludo', { rule: 'has_overdue' }), newStep(s, 'build_report', 'concludo', { report: 'overdue' }), newStep(s, 'ask_approval'), newStep(s, 'send_email', 'outlook', { to: 'action_owners', subject: 'Reminder: actions now overdue' })] }) },
  { key: 'high-risk-issue-escalation', name: 'High-risk escalation', summary: 'If a meeting records a high risk, post to the team channel after approval.', build: (s) => ({ trigger: { type: 'meeting_completed' }, steps: [newStep(s, 'only_if', 'concludo', { rule: 'has_high_risk' }), newStep(s, 'ask_approval'), newStep(s, 'post_message', 'slack', { channel: '#leadership' })] }) },
  { key: 'meeting-prep-brief', name: 'Meeting prep brief', summary: 'Each weekday, prepare a brief for your next meeting from earlier records. Nothing leaves Concludo.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'Every weekday' }, steps: [newStep(s, 'run_agent', 'concludo', { agent: 'meeting_prep' }), newStep(s, 'notify_me', 'concludo', { message: 'Your prep brief is ready.' })] }) },
  { key: 'consent-check-on-save', name: 'Consent check on save', summary: 'When a meeting is saved, check its consent basis and tell you if it is missing.', build: (s) => ({ trigger: { type: 'meeting_completed' }, steps: [newStep(s, 'run_agent', 'concludo', { agent: 'consent_check' })] }) },
  { key: 'weekly-record-hygiene', name: 'Weekly record clean-up', summary: 'Every Monday, list actions missing an owner or date and likely duplicates for you to fix.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'Every Monday' }, steps: [newStep(s, 'run_agent', 'concludo', { agent: 'record_hygiene' }), newStep(s, 'notify_me', 'concludo', { message: 'Your weekly record clean-up list is ready.' })] }) },
  { key: 'weekly-client-commitments', name: 'Client promises this week', summary: 'Every Monday, list what you promised each client and draft a where-things-stand note for approval.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'Every Monday' }, steps: [newStep(s, 'run_agent', 'concludo', { agent: 'client_commitments' })] }) },
  { key: 'weekly-vendor-update', name: 'Weekly vendor update', summary: 'Every Friday, draft each active listing’s vendor update for approval. Concludo never sends it.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'Every Friday' }, steps: [newStep(s, 'run_agent', 'concludo', { agent: 'vendor_campaign_update' })] }) },
  { key: 'monthly-board-pack', name: 'Monthly board pack', summary: 'On the first Monday of the month, build the steering committee pack from the month’s records.', build: (s) => ({ trigger: { type: 'workflow_schedule', schedule: 'First Monday of the month' }, steps: [newStep(s, 'run_agent', 'concludo', { agent: 'board_pack' }), newStep(s, 'notify_me', 'concludo', { message: 'Your board pack is ready to review.' })] }) },
  { key: 'crm-meeting-note', name: 'Client meeting to CRM', summary: 'Add the meeting summary to the client record in HubSpot, after approval.', build: (s) => ({ trigger: { type: 'meeting_completed' }, steps: [newStep(s, 'summarise_meeting'), newStep(s, 'ask_approval'), newStep(s, 'add_crm_note', 'hubspot')] }) },
];

export function workflowFromTemplate(store: Pick<Store, 'id' | 'now'>, key: string, ownerId: string): Workflow {
  const t = TEMPLATES.find((x) => x.key === key);
  if (!t) throw new Error('Template not found.');
  const now = store.now();
  const built = t.build(store);
  return { id: store.id('wf'), name: t.name, description: t.summary, ownerId, status: 'draft', trigger: built.trigger, steps: built.steps, consecutiveFailures: 0, createdAt: now, updatedAt: now };
}
