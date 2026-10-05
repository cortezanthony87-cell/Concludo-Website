/**
 * Concludo Workflow Architect: edit support.
 *
 * Applies a plain-English change instruction to an existing WorkflowDefinition
 * and reports exactly what changed. Deterministic, rule-based and side-effect
 * free: it never calls a model, a connector or the database.
 *
 * Governing rules carried over from the Architect:
 *  - "Concludo proposes; a person disposes": any step that sends a message out
 *    of Concludo must have an approval step before it. Edits that break this
 *    are refused, and edits that need it get an approval added automatically.
 *  - "Measure work, never people": the caller runs the anti-surveillance gate
 *    before this module, and validation runs again after the edit.
 *  - Honest by default: if an instruction is not understood, or its target is
 *    ambiguous, nothing changes and a question is returned instead. The
 *    workflow is never silently replaced.
 */

import { WorkflowDefinition, WorkflowEdge, WorkflowStep, WorkflowBuildEvent } from './schemas';
import { validateWorkflowDefinition } from './validation';
import { evaluateWorkflowPolicies } from './policyEngine';
import { calculateWorkflowRisk } from './riskClassification';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WorkflowChangeKind = 'added' | 'removed' | 'moved' | 'changed' | 'renamed';

export interface WorkflowChange {
  kind: WorkflowChangeKind;
  stepKey?: string;
  /** Plain English, suitable for the "What changed" card. */
  summary: string;
}

export type WorkflowEditStatus = 'applied' | 'explained' | 'needs_clarification' | 'refused';

export interface WorkflowEditResult {
  status: WorkflowEditStatus;
  /** The edited workflow, or the unchanged original when status is not 'applied'. */
  workflow: WorkflowDefinition;
  changes: WorkflowChange[];
  questions: string[];
  assumptions: string[];
  limitations: string[];
  /** Plain-English reply lines for 'explained' and 'refused'. */
  answer: string[];
  events: Array<{ type: WorkflowBuildEvent['type']; payload: Record<string, any> }>;
}

export interface WorkflowEditContext {
  connectedApplications?: string[];
}

// ---------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------

/** Words people use for apps, mapped to provider ids and display names. */
const APP_ALIASES: Array<{ id: string; name: string; words: string[] }> = [
  { id: 'microsoft_teams', name: 'Microsoft Teams', words: ['microsoft teams', 'teams'] },
  { id: 'microsoft_outlook', name: 'Outlook', words: ['microsoft outlook', 'outlook'] },
  { id: 'slack', name: 'Slack', words: ['slack'] },
  { id: 'gmail', name: 'Gmail', words: ['gmail'] },
  { id: 'hubspot', name: 'HubSpot', words: ['hubspot'] },
  { id: 'salesforce', name: 'Salesforce', words: ['salesforce'] },
  { id: 'xero', name: 'Xero', words: ['xero'] },
  { id: 'myob', name: 'MYOB', words: ['myob'] },
  { id: 'stripe', name: 'Stripe', words: ['stripe'] },
  { id: 'google_sheets', name: 'Google Sheets', words: ['google sheets', 'google sheet', 'spreadsheet'] },
  { id: 'google_drive', name: 'Google Drive', words: ['google drive', 'drive'] },
  { id: 'google_calendar', name: 'Google Calendar', words: ['google calendar'] },
  { id: 'sharepoint', name: 'SharePoint', words: ['sharepoint'] },
  { id: 'onedrive', name: 'OneDrive', words: ['onedrive', 'one drive'] },
  { id: 'asana', name: 'Asana', words: ['asana'] },
  { id: 'trello', name: 'Trello', words: ['trello'] },
  { id: 'concludo_calendar', name: 'Concludo Calendar', words: ['concludo calendar', 'calendar'] },
  { id: 'concludo_projects', name: 'Concludo Projects', words: ['concludo projects', 'projects'] },
  { id: 'concludo_notifications', name: 'Concludo notifications', words: ['workspace notification', 'concludo notification'] },
];

/** Apps whose actions send something out of Concludo to people. */
const EXTERNAL_MESSAGING_APPS = new Set([
  'microsoft_teams',
  'microsoft_outlook',
  'slack',
  'gmail',
  'communications',
]);

/** Synonyms used when matching a phrase such as "the customer email" to a step. */
const SYNONYMS: Record<string, string[]> = {
  email: ['email', 'emails', 'mail', 'message', 'reminder', 'outlook', 'gmail', 'communications'],
  message: ['message', 'email', 'post', 'notify', 'notification'],
  notification: ['notification', 'notify', 'notifies', 'alert', 'notifications', 'message'],
  notify: ['notify', 'notification', 'alert', 'message'],
  follow: ['follow', 'reminder', 'email', 'message'],
  reminder: ['reminder', 'remind', 'follow'],
  task: ['task', 'tasks', 'projects'],
  tasks: ['task', 'tasks', 'projects'],
  project: ['project', 'projects'],
  calendar: ['calendar', 'event', 'events', 'deadline', 'deadlines', 'milestone'],
  summary: ['summary', 'summarise', 'summarises', 'ai', 'agent', 'extract'],
  approval: ['approval', 'approve', 'approves', 'sign', 'signoff'],
  invoice: ['invoice', 'payment', 'stripe'],
};

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'to', 'of', 'and', 'for', 'in', 'on', 'step', 'steps', 'this', 'that', 'it', 'me', 'my',
  'our', 'with', 'from', 'is', 'be', 'by', 'at', 'then', 'instead', 'please', 'workflow',
]);

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, fourteen: 14, thirty: 30, a: 1, an: 1,
};

const APPROVER_ROLES: Array<{ role: string; words: string[]; label: string }> = [
  { role: 'project_owner', words: ['project owner'], label: 'the project owner' },
  { role: 'account_manager', words: ['account manager'], label: 'the account manager' },
  { role: 'finance_manager', words: ['finance manager', 'finance'], label: 'Finance' },
  { role: 'organisation_admin', words: ['admin', 'administrator'], label: 'an administrator' },
  { role: 'director', words: ['director'], label: 'a director' },
  { role: 'manager', words: ['manager'], label: 'a manager' },
  { role: 'owner', words: ['owner'], label: 'the owner' },
];

// ---------------------------------------------------------------------------
// Entry points
// ---------------------------------------------------------------------------

/**
 * True when the prompt should be treated as a change to the current workflow
 * rather than a request for a new one.
 */
export function isEditInstruction(prompt: string, current?: WorkflowDefinition | null): boolean {
  if (!current || !Array.isArray(current.steps) || current.steps.length === 0) return false;
  const p = prompt.trim().toLowerCase();
  if (isRebuildRequest(p)) return false;
  return true;
}

/** "Start over", "build a new workflow ..." and similar mean: do not edit, build. */
export function isRebuildRequest(promptLower: string): boolean {
  return /^(start over|start again|scrap this|replace (this|the) workflow|(build|create|make) (me )?(a )?(new|fresh|different) workflow)/.test(
    promptLower.trim()
  );
}

export function applyWorkflowEdit(
  current: WorkflowDefinition,
  prompt: string,
  ctx: WorkflowEditContext = {}
): WorkflowEditResult {
  const original = normaliseDefinition(clone(current));
  const working = clone(original);
  const state: EditState = {
    wf: working,
    changes: [],
    questions: [],
    assumptions: [],
    limitations: [],
    answer: [],
    events: [],
    ctx,
  };

  const clauses = splitClauses(prompt);
  let explainedOnly = true;

  for (const clause of clauses) {
    const outcome = applyClause(state, clause);
    if (outcome === 'explained') continue;
    explainedOnly = false;
    if (outcome === 'unknown' && /^(when|whenever|every|each time|after|once)\b/i.test(clause.trim())) {
      state.questions.push(
        `"${clause}" sounds like a new workflow rather than a change to this one. Say "build a new workflow" first if you want me to replace it, or start one from New workflow.`
      );
    } else if (outcome === 'unknown') {
      state.questions.push(
        `I could not work out "${clause}". I can add, remove or move steps, add an approval or a wait, switch a step to another app, add a condition, change the approver, rename the workflow, or explain it.`
      );
    }
    if (outcome === 'refused' || outcome === 'unknown' || outcome === 'question') {
      return finishUnchanged(state, original, outcome === 'refused' ? 'refused' : 'needs_clarification');
    }
  }

  if (explainedOnly) {
    return finishUnchanged(state, original, 'explained');
  }

  // Governance: every outbound message needs a person's sign-off before it.
  enforceApprovalBeforeExternalMessages(state);

  // Keep the step array in run order: the execution engine walks steps in array order.
  reorderAndLayout(state.wf);

  // Re-validate and re-check policy. A DENY reverts the whole edit.
  // Only problems the edit introduced count against it; existing ones are not the edit's fault.
  const before = validateWorkflowDefinition(original, { enforceConnections: false });
  const beforePolicy = evaluateWorkflowPolicies(original);
  const validation = validateWorkflowDefinition(state.wf, {
    connectedApplications: ctx.connectedApplications,
    enforceConnections: false,
  });
  const policy = evaluateWorkflowPolicies(state.wf);
  const knownErrors = new Set(before.errors.map((e) => `${e.code}:${e.stepKey || ''}`));
  const newErrors = validation.errors.filter((e) => !knownErrors.has(`${e.code}:${e.stepKey || ''}`));
  const newViolations = policy.status !== 'ALLOW' ? policy.violations.filter((v) => !beforePolicy.violations.includes(v)) : [];
  if (newErrors.length > 0 || newViolations.length > 0) {
    state.answer.push('I did not make that change, because the result would break a Concludo rule:');
    newErrors.forEach((e) => state.answer.push(`- ${e.message}`));
    newViolations.forEach((v) => state.answer.push(`- ${v}`));
    return finishUnchanged(state, original, 'refused');
  }

  // Risk can rise with an edit, never fall below what it was.
  const order: WorkflowDefinition['riskLevel'][] = ['low', 'medium', 'high', 'critical'];
  const computed = calculateWorkflowRisk(state.wf as any).effectiveRisk;
  const computedLevel = (computed === 'restricted' ? 'critical' : computed) as WorkflowDefinition['riskLevel'];
  if (order.indexOf(computedLevel) > order.indexOf(state.wf.riskLevel)) {
    state.wf.riskLevel = computedLevel;
    state.changes.push({ kind: 'changed', summary: `Risk level is now ${computedLevel}.` });
  }

  // Editing a published workflow makes a new draft version. The published one keeps running.
  if (original.status === 'published' || original.status === 'approved') {
    state.wf.status = 'draft';
    state.wf.version = (original.version || 1) + 1;
    state.assumptions.push(
      `This is now draft version ${state.wf.version}. The active version keeps running until you activate the change.`
    );
  }

  // Engine limitations stated plainly, never hidden.
  if (state.wf.steps.some((s) => s.stepType === 'logic' && s.configuration?.rule)) {
    pushOnce(
      state.limitations,
      'Test runs do not follow conditions or branches yet: every step runs in order during a test.'
    );
  }

  return {
    status: 'applied',
    workflow: state.wf,
    changes: state.changes,
    questions: state.questions,
    assumptions: state.assumptions,
    limitations: state.limitations,
    answer: state.answer,
    events: state.events,
  };
}

/** Numbered plain-English description of a workflow, in run order. */
export function describeWorkflow(wf: WorkflowDefinition): string[] {
  const ordered = topologicalOrder(normaliseDefinition(clone(wf)));
  const lines: string[] = [];
  if (!ordered.some((s) => s.stepType === 'trigger') && wf.trigger?.displayName) {
    lines.push(`Starts when: ${wf.trigger.displayName}.`);
  }
  ordered.forEach((s) => {
    const text = (s.userFacingExplanation || s.purpose || s.displayName).trim().replace(/\.?$/, '.');
    if (s.stepType === 'approval' && s.configuration?.actionKey === 'create_manual_review') {
      lines.push(text);
    } else if (s.stepType === 'approval') {
      const who = roleLabel(s.approvalRequirement?.approverRole) || 'A person';
      lines.push(`${capitalise(who)} must approve before anything after this runs. ${text}`);
    } else {
      lines.push(text);
    }
  });
  return lines.map((l, i) => `${i + 1}. ${l}`);
}

// ---------------------------------------------------------------------------
// Clause handling
// ---------------------------------------------------------------------------

interface EditState {
  wf: WorkflowDefinition;
  changes: WorkflowChange[];
  questions: string[];
  assumptions: string[];
  limitations: string[];
  answer: string[];
  events: WorkflowEditResult['events'];
  ctx: WorkflowEditContext;
}

type ClauseOutcome = 'applied' | 'explained' | 'question' | 'refused' | 'unknown';

function splitClauses(prompt: string): string[] {
  return prompt
    .split(/(?<=[.;!?])\s+|\s+and then\s+|,\s*then\s+/i)
    .map((c) => c.trim().replace(/[.;!]+$/, '').trim())
    .filter((c) => c.length > 0);
}

function applyClause(state: EditState, clause: string): ClauseOutcome {
  const c = clause.toLowerCase().replace(/\s+/g, ' ').trim();

  // 1. Questions about the workflow: answer, change nothing.
  if (/^(explain|describe|walk me through|summari[sz]e|what does (this|it|the workflow) do)/.test(c)) {
    state.answer.push(...describeWorkflow(state.wf));
    return 'explained';
  }
  const whatIf = c.match(
    /what happens (?:if|when) (.+?) (?:is |are |goes |becomes )?(unavailable|down|offline|not available|disconnected|fails|failing|not connected)/
  );
  if (whatIf) {
    state.answer.push(...explainFailure(state.wf, whatIf[1]));
    return 'explained';
  }

  // 2. Rename the workflow.
  const rename = clause.match(/^(?:rename|call|name)\s+(?:this|it|the workflow)(?:\s+to)?\s+["'‘“]?(.+?)["'’”]?$/i);
  if (rename) {
    const before = state.wf.name;
    state.wf.name = rename[1].trim();
    state.changes.push({ kind: 'renamed', summary: `Renamed the workflow from "${before}" to "${state.wf.name}".` });
    return 'applied';
  }

  // 3. Number of approvers.
  const approvers = c.match(/(?:require|need|use|add)\s+(two|three|2|3)\s+approvers?/);
  if (approvers) return setMinimumApprovers(state, toNumber(approvers[1]) || 2);

  // 4. Change who approves.
  const approverRole =
    c.match(/^use (?:the )?(.+?) as (?:the )?approver/) ||
    c.match(/^(?:make|set) (?:the )?(.+?) (?:as )?(?:the )?approver/) ||
    c.match(/^(?:the )?(.+?) should approve/);
  if (approverRole) return setApproverRole(state, approverRole[1]);

  // 5. Ask for missing context: "If no project is linked, ask me to select one."
  const askMissing = c.match(/^if (?:there is )?no (\w+) is (?:linked|set|selected|chosen|attached|given),? ask (.+?) to (?:select|choose|pick|link|confirm)/);
  if (askMissing) return addAskIfMissing(state, askMissing[1], askMissing[2]);

  // 6. Conditions: "Only run this when the invoice is more than $5,000", "Only for client meetings".
  const onlyWhen = c.match(/^only (?:run (?:this|it)? ?|do this |trigger (?:this )?|continue )?(?:when|if|for) (.+)$/);
  if (onlyWhen) return addCondition(state, onlyWhen[1]);

  // 7. Approval steps: "Add manager approval before the customer email".
  const addApproval = c.match(/^(?:add|insert|require|need|put)(?: an?| another)? (.*?)\s*(?:approval|sign[- ]?off)(?: step)?(?:\s+(before|after|prior to)\s+(.+))?$/);
  if (addApproval) {
    return addApprovalStep(state, addApproval[1], addApproval[2], addApproval[3]);
  }

  // 8. Waits: "Wait three days before following up".
  const wait = c.match(/^(?:add a |add an )?wait (?:for )?(\w+) (business days?|days?|hours?|weeks?|minutes?)(?:\s+(before|after)\s+(.+))?$/);
  if (wait) return addWaitStep(state, wait[1], wait[2], wait[3], wait[4]);

  // 9. Reminders: "Add a reminder the day before".
  const reminder = c.match(/^add (?:a )?reminder (?:the |a )?(\w+)? ?(day|days|hour|hours|week) before/);
  if (reminder) return addReminder(state, reminder[1], reminder[2]);

  // 10. Switch app: "Send the notification to Teams instead", "Replace Slack with Teams", "Use Teams instead of Slack".
  const replaceWith = c.match(/^(?:replace|swap) (.+?) (?:with|for) (.+)$/);
  if (replaceWith) return switchApp(state, replaceWith[1], replaceWith[2]);
  const insteadOf = c.match(/^use (.+?) instead of (.+)$/);
  if (insteadOf) return switchApp(state, insteadOf[2], insteadOf[1]);
  const switchTo = c.match(/^(?:switch|change|move) (.+?) (?:to|over to) (.+?)(?: instead)?$/);
  if (switchTo && findApp(switchTo[2])) return switchApp(state, switchTo[1], switchTo[2]);
  const sendVia = c.match(/^(?:send|post|notify|deliver) (.+?) (?:to|in|via|through|using|on) (.+?)(?: instead)?$/);
  if (sendVia && findApp(sendVia[2])) return switchApp(state, sendVia[1], sendVia[2]);

  // 11. Move: "Move the email after approval".
  const move = c.match(/^(?:move|put) (.+?) (before|after) (.+)$/);
  if (move) return moveStepClause(state, move[1], move[2] as 'before' | 'after', move[3]);

  // 12. Remove: "Remove Slack", "Delete the calendar step".
  const remove = c.match(/^(?:remove|delete|drop|take out|get rid of|skip) (.+)$/);
  if (remove) return removeClause(state, remove[1]);

  return 'unknown';
}

// ---------------------------------------------------------------------------
// Edit operations
// ---------------------------------------------------------------------------

function addApprovalStep(state: EditState, who: string, side?: string, targetPhrase?: string): ClauseOutcome {
  const role = parseRole(who) || defaultApproverRole(state.wf);
  const label = roleLabel(role) || 'a person';
  let target: WorkflowStep | undefined;
  let position: 'before' | 'after' = side === 'after' ? 'after' : 'before';

  if (targetPhrase) {
    const found = resolveSingleStep(state, targetPhrase);
    if (!found) return 'question';
    target = found;
  } else {
    // No position given: guard the first outbound or record-changing step that has no approval before it.
    const ordered = topologicalOrder(state.wf);
    target = ordered.find(
      (s) =>
        s.stepType !== 'trigger' &&
        s.stepType !== 'approval' &&
        (isExternalMessage(s) || s.application === 'concludo_projects' || s.application === 'concludo_calendar') &&
        !hasApprovalBefore(state.wf, s.key)
    );
    if (!target) {
      state.questions.push('Which step should the new approval come before?');
      return 'question';
    }
    position = 'before';
  }

  const step = makeApprovalStep(state.wf, role, `${capitalise(label)} approves`, target);
  if (position === 'before') insertBefore(state, step, target.key);
  else insertAfter(state, step, target.key);
  emit(state, 'approval.added', { stepKey: step.key });
  state.changes.push({
    kind: 'added',
    stepKey: step.key,
    summary: `Added: ${capitalise(label)} approves, ${position} "${target.displayName}".`,
  });
  return 'applied';
}

function addWaitStep(state: EditState, amountWord: string, unitWord: string, side?: string, targetPhrase?: string): ClauseOutcome {
  const amount = toNumber(amountWord);
  if (!amount || amount < 1) {
    state.questions.push(`How long should Concludo wait? I read "${amountWord} ${unitWord}".`);
    return 'question';
  }
  if (!targetPhrase) {
    state.questions.push('Which step should the wait come before?');
    return 'question';
  }
  const target = resolveSingleStep(state, targetPhrase);
  if (!target) return 'question';

  const unit = unitWord.replace(/s$/, '');
  const businessDays = /business/.test(unit);
  const config: Record<string, any> = {};
  if (unit.startsWith('minute')) config.durationMinutes = amount;
  else if (unit.startsWith('hour')) config.durationHours = amount;
  else if (unit.startsWith('week')) config.durationDays = amount * 7;
  else config.durationDays = amount;
  if (businessDays) config.businessDaysOnly = true;

  const unitLabel = `${businessDays ? 'business ' : ''}${unit.replace('business ', '')}${amount === 1 ? '' : 's'}`;
  const step: WorkflowStep = {
    key: uniqueKey(state.wf, `wait_${amount}_${unit.replace(/\s+/g, '_')}`),
    name: `Wait ${amount} ${unitLabel}`,
    displayName: `Wait ${amount} ${unitLabel}`,
    stepType: 'wait',
    purpose: `Pauses the workflow for ${amount} ${unitLabel}.`,
    application: 'logic',
    service: 'logic',
    inputMapping: {},
    outputSchema: {},
    configuration: config,
    userFacingExplanation: `Waits ${amount} ${unitLabel} before continuing.`,
  };
  if (side === 'after') insertAfter(state, step, target.key);
  else insertBefore(state, step, target.key);
  state.changes.push({
    kind: 'added',
    stepKey: step.key,
    summary: `Added: Wait ${amount} ${unitLabel}, ${side === 'after' ? 'after' : 'before'} "${target.displayName}".`,
  });
  return 'applied';
}

function addReminder(state: EditState, amountWord: string | undefined, unitWord: string): ClauseOutcome {
  const calendarStep = topologicalOrder(state.wf).find(
    (s) => s.application === 'concludo_calendar' || s.application === 'google_calendar'
  );
  if (!calendarStep) {
    state.questions.push('A reminder needs a date to count back from, and this workflow does not create calendar dates. What should the reminder be before?');
    return 'question';
  }
  const amount = amountWord && amountWord !== 'the' ? toNumber(amountWord) || 1 : 1;
  const unit = unitWord.replace(/s$/, '');
  const offset = unit === 'hour' ? { hoursBefore: amount } : unit === 'week' ? { daysBefore: amount * 7 } : { daysBefore: amount };
  const when = amount === 1 ? `the ${unit} before` : `${amount} ${unit}s before`;
  const step: WorkflowStep = {
    key: uniqueKey(state.wf, 'send_reminder_before_due'),
    name: `Send a reminder ${when}`,
    displayName: `Send a reminder ${when}`,
    stepType: 'action',
    purpose: `Sends a workspace reminder ${when} each approved date.`,
    application: 'concludo_notifications',
    service: 'concludo_notifications',
    inputMapping: { events: `$${calendarStep.key}.createdEventIds` },
    outputSchema: { scheduled: 'boolean' },
    configuration: { channel: 'workspace', schedule: offset },
    retryPolicy: { maxAttempts: 3, initialIntervalMs: 1000, backoffFactor: 2 },
    userFacingExplanation: `Reminds the owner ${when} each date that was added.`,
  };
  insertAfter(state, step, calendarStep.key);
  state.changes.push({
    kind: 'added',
    stepKey: step.key,
    summary: `Added: Send a reminder ${when}, after "${calendarStep.displayName}".`,
  });
  state.assumptions.push('The reminder is a Concludo workspace notification. Ask if you want it sent by email or chat instead.');
  return 'applied';
}

function addCondition(state: EditState, conditionText: string): ClauseOutcome {
  const rule = parseCondition(conditionText);
  if (!rule) {
    state.questions.push(`I could not turn "${conditionText}" into a check. Try something like "only when the invoice is more than $5,000".`);
    return 'question';
  }
  const ordered = topologicalOrder(state.wf);
  const first = ordered[0];
  const step: WorkflowStep = {
    key: uniqueKey(state.wf, 'check_condition'),
    name: `Check: ${rule.label}`,
    displayName: `Only continue if ${rule.label}`,
    stepType: 'logic',
    purpose: `Stops the workflow unless ${rule.label}.`,
    application: 'logic',
    service: 'logic',
    inputMapping: {},
    outputSchema: { passed: 'boolean' },
    configuration: { actionKey: 'evaluate_condition', rule: rule.rule, onFalse: 'end_without_action' },
    userFacingExplanation: `Continues only if ${rule.label}. Otherwise the workflow ends and nothing else happens.`,
  };
  if (first.stepType === 'trigger') insertAfter(state, step, first.key, 'conditional', `steps.${step.key}.output.passed`);
  else insertBefore(state, step, first.key, 'conditional', `steps.${step.key}.output.passed`);
  state.changes.push({ kind: 'added', stepKey: step.key, summary: `Added: Only continue if ${rule.label}.` });
  if (rule.assumption) state.assumptions.push(rule.assumption);
  return 'applied';
}

function addAskIfMissing(state: EditState, thing: string, whoPhrase: string): ClauseOutcome {
  const field = `${thing}Id`;
  const ordered = topologicalOrder(state.wf);
  const target = ordered.find(
    (s) =>
      JSON.stringify(s.inputMapping || {}).toLowerCase().includes(field.toLowerCase()) ||
      (thing === 'project' && s.application === 'concludo_projects')
  );
  if (!target) {
    state.questions.push(`No step in this workflow uses a ${thing}, so there is nothing to ask for yet. Which step needs the ${thing}?`);
    return 'question';
  }
  const askWho = /\bme\b|\bi\b/.test(whoPhrase) ? 'you' : whoPhrase.replace(/^the /, 'the ');
  const check: WorkflowStep = {
    key: uniqueKey(state.wf, `check_${thing}_linked`),
    name: `Is a ${thing} linked?`,
    displayName: `Is a ${thing} linked?`,
    stepType: 'branch',
    purpose: `Checks whether a ${thing} is linked before "${target.displayName}".`,
    application: 'logic',
    service: 'logic',
    inputMapping: {},
    outputSchema: { linked: 'boolean' },
    configuration: { actionKey: 'branch', rule: { left: `trigger.${field}`, operator: 'not_empty' } },
    userFacingExplanation: `Checks that a ${thing} is linked. If not, asks ${askWho} to choose one.`,
  };
  const ask: WorkflowStep = {
    key: uniqueKey(state.wf, `ask_to_choose_${thing}`),
    name: `Ask ${askWho} to choose a ${thing}`,
    displayName: `Ask ${askWho} to choose a ${thing}`,
    stepType: 'approval',
    purpose: `Pauses until ${askWho} choose${askWho === 'you' ? '' : 's'} a ${thing} in Approval Centre.`,
    application: 'concludo_approval_centre',
    service: 'concludo_approval_centre',
    inputMapping: {},
    outputSchema: { [field]: 'string' },
    configuration: { actionKey: 'create_manual_review', requestedField: field },
    approvalRequirement: { required: true, approverRole: askWho === 'you' ? 'workflow_owner' : parseRole(whoPhrase) || 'workflow_owner' },
    userFacingExplanation: `Asks ${askWho} to choose a ${thing}, then carries on.`,
  };
  insertBefore(state, check, target.key, 'conditional', `steps.${check.key}.output.linked`, 'linked');
  addStep(state, ask);
  addEdge(state, check.key, ask.key, 'conditional', `!steps.${check.key}.output.linked`, `no ${thing}`);
  addEdge(state, ask.key, target.key, 'approval_approved');
  state.changes.push({ kind: 'added', stepKey: check.key, summary: `Added: Is a ${thing} linked?, before "${target.displayName}".` });
  state.changes.push({ kind: 'added', stepKey: ask.key, summary: `Added: Ask ${askWho} to choose a ${thing} when none is linked.` });
  return 'applied';
}

function setMinimumApprovers(state: EditState, count: number): ClauseOutcome {
  const approvals = state.wf.steps.filter((s) => s.stepType === 'approval');
  if (approvals.length === 0) {
    state.questions.push('There is no approval step yet. Which step should two people approve before?');
    return 'question';
  }
  approvals.forEach((s) => {
    s.approvalRequirement = { ...(s.approvalRequirement || { required: true }), required: true, minimumApprovers: count } as any;
    s.configuration = { ...(s.configuration || {}), minimumApprovers: count };
    emit(state, 'node.updated', { stepKey: s.key, field: 'minimumApprovers', value: count });
    state.changes.push({ kind: 'changed', stepKey: s.key, summary: `Changed: "${s.displayName}" now needs ${count} approvers.` });
  });
  pushOnce(state.limitations, 'Check that Approval Centre enforces more than one approver before relying on it. The workflow records the requirement.');
  return 'applied';
}

function setApproverRole(state: EditState, whoPhrase: string): ClauseOutcome {
  const role = parseRole(whoPhrase);
  if (!role) {
    state.questions.push(`Who should approve? I did not recognise "${whoPhrase}". Try the project owner, a manager, Finance or an administrator.`);
    return 'question';
  }
  const approvals = state.wf.steps.filter((s) => s.stepType === 'approval');
  if (approvals.length === 0) {
    state.questions.push('There is no approval step yet. Should I add one?');
    return 'question';
  }
  approvals.forEach((s) => {
    const before = roleLabel(s.approvalRequirement?.approverRole) || 'a person';
    s.approvalRequirement = { ...(s.approvalRequirement || { required: true }), required: true, approverRole: role };
    s.configuration = { ...(s.configuration || {}), approverRole: role };
    emit(state, 'node.updated', { stepKey: s.key, field: 'approverRole', value: role });
    state.changes.push({ kind: 'changed', stepKey: s.key, summary: `Changed: "${s.displayName}" approver from ${before} to ${roleLabel(role)}.` });
  });
  return 'applied';
}

function switchApp(state: EditState, fromPhrase: string, toPhrase: string): ClauseOutcome {
  const to = findApp(toPhrase);
  if (!to) {
    state.questions.push(`Which app should I use instead? I did not recognise "${toPhrase}".`);
    return 'question';
  }
  const fromApp = findApp(fromPhrase);
  let targets: WorkflowStep[];
  if (fromApp) {
    targets = state.wf.steps.filter((s) => s.application === fromApp.id && s.stepType !== 'trigger');
    if (targets.length === 0) {
      state.questions.push(`This workflow does not use ${fromApp.name}. Which step should move to ${to.name}?`);
      return 'question';
    }
  } else {
    const one = resolveSingleStep(state, fromPhrase, (s) => s.stepType !== 'trigger' && s.stepType !== 'approval');
    if (!one) return 'question';
    targets = [one];
  }

  for (const s of targets) {
    const beforeName = s.displayName;
    const beforeApp = appName(s.application);
    s.application = to.id;
    s.service = to.id;
    const renamed = renameForApp(s.displayName, beforeApp, to.name);
    s.displayName =
      renamed !== s.displayName || !EXTERNAL_MESSAGING_APPS.has(to.id) ? renamed : `${s.displayName} in ${to.name}`;
    s.name = s.displayName;
    s.userFacingExplanation = renameForApp(s.userFacingExplanation, beforeApp, to.name);
    if (!/(teams|outlook|slack|gmail|email|message)/i.test(s.userFacingExplanation) && EXTERNAL_MESSAGING_APPS.has(to.id)) {
      s.userFacingExplanation = `${s.userFacingExplanation.replace(/\.$/, '')}, sent through ${to.name}.`;
    }
    s.configuration = { ...(s.configuration || {}) };
    delete s.configuration.connectionId; // an old app's connection cannot serve the new app
    emit(state, 'node.updated', { stepKey: s.key, field: 'application', value: to.id });
    state.changes.push({
      kind: 'changed',
      stepKey: s.key,
      summary: `Changed: "${beforeName}" from ${beforeApp} to ${to.name}.`,
    });
  }

  const connected = state.ctx.connectedApplications;
  if (connected && !to.id.startsWith('concludo_') && !connected.includes(to.id)) {
    emit(state, 'connection.required', {
      connectorKey: to.id,
      message: `${to.name} must be connected before this workflow can be tested or activated.`,
    });
    state.assumptions.push(`${to.name} is not connected yet. Connect it before testing.`);
  }
  return 'applied';
}

function moveStepClause(state: EditState, stepPhrase: string, side: 'before' | 'after', targetPhrase: string): ClauseOutcome {
  const step = resolveSingleStep(state, stepPhrase, (s) => s.stepType !== 'trigger');
  if (!step) return 'question';
  const target = resolveSingleStep(state, targetPhrase, (s) => s.key !== step.key);
  if (!target) return 'question';

  if (step.stepType === 'approval' && side === 'after' && guardsExternalMessage(state.wf, step.key)) {
    // Moving an approval later must not leave an outbound message unguarded; the post-edit check re-adds one if needed.
    state.assumptions.push('Messages leaving Concludo still need an approval before them, so I kept one in front of each.');
  }
  detachStep(state, step.key);
  if (side === 'before') insertBefore(state, step, target.key);
  else insertAfter(state, step, target.key);
  emit(state, 'node.updated', { stepKey: step.key, field: 'position', value: `${side} ${target.key}` });
  state.changes.push({ kind: 'moved', stepKey: step.key, summary: `Moved: "${step.displayName}" ${side} "${target.displayName}".` });
  return 'applied';
}

function removeClause(state: EditState, phrase: string): ClauseOutcome {
  const app = findApp(phrase);
  let targets: WorkflowStep[];
  if (app && phrase.trim().split(/\s+/).length <= 3) {
    targets = state.wf.steps.filter((s) => s.application === app.id);
    if (targets.length === 0) {
      state.answer.push(`This workflow does not use ${app.name}, so there is nothing to remove.`);
      return 'refused';
    }
  } else {
    const one = resolveSingleStep(state, phrase);
    if (!one) return 'question';
    targets = [one];
  }

  for (const t of targets) {
    if (t.stepType === 'trigger') {
      state.answer.push(`I cannot remove "${t.displayName}" because it is what starts the workflow. Describe a new starting point instead.`);
      return 'refused';
    }
    if (t.stepType === 'approval' && guardsExternalMessage(state.wf, t.key)) {
      const otherApproval = state.wf.steps.some(
        (s) => s.key !== t.key && s.stepType === 'approval' && !targets.includes(s)
      );
      const guarded = downstreamExternalMessages(state.wf, t.key);
      const stillGuarded = otherApproval && guarded.every((g) => hasApprovalBefore(state.wf, g.key, t.key));
      if (!stillGuarded) {
        state.answer.push(
          `I cannot remove "${t.displayName}". It is the sign-off before "${guarded[0].displayName}", and messages leaving Concludo always need a person to approve them first.`
        );
        return 'refused';
      }
    }
  }

  for (const t of targets) {
    detachStep(state, t.key);
    state.wf.steps = state.wf.steps.filter((s) => s.key !== t.key);
    delete state.wf.layout.nodes[t.key];
    emit(state, 'node.removed', { stepKey: t.key });
    state.changes.push({ kind: 'removed', stepKey: t.key, summary: `Removed: "${t.displayName}".` });
  }
  return 'applied';
}

/** After any edit, put an approval in front of every outbound message that lacks one. */
function enforceApprovalBeforeExternalMessages(state: EditState) {
  const ordered = topologicalOrder(state.wf);
  for (const s of ordered) {
    if (!isExternalMessage(s)) continue;
    if (hasApprovalBefore(state.wf, s.key)) continue;
    const role = defaultApproverRole(state.wf);
    const step = makeApprovalStep(state.wf, role, `${capitalise(roleLabel(role) || 'a person')} approves the message`, s);
    insertBefore(state, step, s.key);
    emit(state, 'approval.added', { stepKey: step.key, reason: 'external_message' });
    state.changes.push({
      kind: 'added',
      stepKey: step.key,
      summary: `Added: an approval before "${s.displayName}", because messages leaving Concludo need a person's sign-off.`,
    });
  }
}

// ---------------------------------------------------------------------------
// Graph helpers
// ---------------------------------------------------------------------------

function addStep(state: EditState, step: WorkflowStep) {
  state.wf.steps.push(step);
  emit(state, 'node.added', { step });
}

function addEdge(
  state: EditState,
  source: string,
  destination: string,
  edgeType: WorkflowEdge['edgeType'] = 'success',
  conditionReference?: string,
  branchLabel?: string
) {
  const edge: WorkflowEdge = {
    id: uniqueEdgeId(state.wf),
    sourceStepKey: source,
    destinationStepKey: destination,
    sourceStep: source,
    destinationStep: destination,
    edgeType,
  };
  if (conditionReference) edge.conditionReference = conditionReference;
  if (branchLabel) edge.branchLabel = branchLabel;
  state.wf.edges.push(edge);
  emit(state, 'edge.added', { edge });
}

function removeEdge(state: EditState, edge: WorkflowEdge) {
  state.wf.edges = state.wf.edges.filter((e) => e !== edge);
  emit(state, 'edge.removed', { edgeId: edge.id });
}

/** Insert `step` so every path into `targetKey` now runs through `step` first. */
function insertBefore(
  state: EditState,
  step: WorkflowStep,
  targetKey: string,
  edgeType?: WorkflowEdge['edgeType'],
  conditionReference?: string,
  branchLabel?: string
) {
  addStep(state, step);
  const incoming = state.wf.edges.filter((e) => e.destinationStepKey === targetKey);
  for (const e of incoming) {
    e.destinationStepKey = step.key;
    e.destinationStep = step.key;
  }
  addEdge(
    state,
    step.key,
    targetKey,
    edgeType || (step.stepType === 'approval' ? 'approval_approved' : 'success'),
    conditionReference,
    branchLabel
  );
}

/** Insert `step` directly after `targetKey`, taking over its outgoing edges. */
function insertAfter(
  state: EditState,
  step: WorkflowStep,
  targetKey: string,
  edgeType?: WorkflowEdge['edgeType'],
  conditionReference?: string
) {
  const target = state.wf.steps.find((s) => s.key === targetKey);
  addStep(state, step);
  const outgoing = state.wf.edges.filter((e) => e.sourceStepKey === targetKey && e.edgeType !== 'failure' && e.edgeType !== 'approval_rejected');
  for (const e of outgoing) {
    e.sourceStepKey = step.key;
    e.sourceStep = step.key;
    if (e.edgeType === 'approval_approved' && step.stepType !== 'approval') e.edgeType = 'success';
    if (step.stepType === 'approval') e.edgeType = 'approval_approved';
  }
  addEdge(
    state,
    targetKey,
    step.key,
    edgeType || (target?.stepType === 'approval' ? 'approval_approved' : 'success'),
    conditionReference
  );
}

/** Remove a step's edges and join its predecessors directly to its successors. */
function detachStep(state: EditState, key: string) {
  const incoming = state.wf.edges.filter((e) => e.destinationStepKey === key);
  const outgoing = state.wf.edges.filter((e) => e.sourceStepKey === key);
  incoming.forEach((e) => removeEdge(state, e));
  outgoing.forEach((e) => removeEdge(state, e));
  for (const inE of incoming) {
    for (const outE of outgoing) {
      if (outE.edgeType === 'failure' || outE.edgeType === 'approval_rejected') continue;
      const exists = state.wf.edges.some(
        (e) => e.sourceStepKey === inE.sourceStepKey && e.destinationStepKey === outE.destinationStepKey
      );
      if (!exists && inE.sourceStepKey !== outE.destinationStepKey) {
        addEdge(state, inE.sourceStepKey, outE.destinationStepKey, inE.edgeType, inE.conditionReference, inE.branchLabel);
      }
    }
  }
}

function predecessors(wf: WorkflowDefinition, key: string): string[] {
  return wf.edges.filter((e) => e.destinationStepKey === key && e.edgeType !== 'failure').map((e) => e.sourceStepKey);
}

function successors(wf: WorkflowDefinition, key: string): string[] {
  return wf.edges.filter((e) => e.sourceStepKey === key && e.edgeType !== 'failure').map((e) => e.destinationStepKey);
}

/** True when every path from a root to `key` passes an approval step (ignoring `ignoreKey`). */
function hasApprovalBefore(wf: WorkflowDefinition, key: string, ignoreKey?: string): boolean {
  const byKey = new Map(wf.steps.map((s) => [s.key, s]));
  const memo = new Map<string, boolean>();
  const visiting = new Set<string>();
  const guarded = (k: string): boolean => {
    if (memo.has(k)) return memo.get(k)!;
    if (visiting.has(k)) return true;
    visiting.add(k);
    const preds = predecessors(wf, k);
    let result: boolean;
    if (preds.length === 0) result = false;
    else
      result = preds.every((p) => {
        const ps = byKey.get(p);
        if (ps && ps.stepType === 'approval' && p !== ignoreKey) return true;
        return guarded(p);
      });
    visiting.delete(k);
    memo.set(k, result);
    return result;
  };
  return guarded(key);
}

function downstreamExternalMessages(wf: WorkflowDefinition, key: string): WorkflowStep[] {
  const byKey = new Map(wf.steps.map((s) => [s.key, s]));
  const seen = new Set<string>();
  const out: WorkflowStep[] = [];
  const walk = (k: string) => {
    for (const n of successors(wf, k)) {
      if (seen.has(n)) continue;
      seen.add(n);
      const s = byKey.get(n);
      if (s && isExternalMessage(s)) out.push(s);
      walk(n);
    }
  };
  walk(key);
  return out;
}

function guardsExternalMessage(wf: WorkflowDefinition, approvalKey: string): boolean {
  return downstreamExternalMessages(wf, approvalKey).length > 0;
}

/** Kahn's algorithm; ties broken by current x position, then original array order. */
function topologicalOrder(wf: WorkflowDefinition): WorkflowStep[] {
  const indeg = new Map<string, number>();
  wf.steps.forEach((s) => indeg.set(s.key, 0));
  wf.edges.forEach((e) => {
    if (indeg.has(e.destinationStepKey) && indeg.has(e.sourceStepKey)) {
      indeg.set(e.destinationStepKey, (indeg.get(e.destinationStepKey) || 0) + 1);
    }
  });
  const index = new Map(wf.steps.map((s, i) => [s.key, i]));
  const xOf = (s: WorkflowStep) => s.position?.x ?? wf.layout?.nodes?.[s.key]?.x ?? (index.get(s.key) || 0) * 260;
  const byKey = new Map(wf.steps.map((s) => [s.key, s]));
  const ready = wf.steps.filter((s) => (indeg.get(s.key) || 0) === 0);
  const out: WorkflowStep[] = [];
  const sortReady = () => ready.sort((a, b) => xOf(a) - xOf(b) || (index.get(a.key)! - index.get(b.key)!));
  sortReady();
  while (ready.length) {
    const s = ready.shift()!;
    out.push(s);
    for (const e of wf.edges.filter((x) => x.sourceStepKey === s.key)) {
      const d = e.destinationStepKey;
      if (!indeg.has(d)) continue;
      indeg.set(d, (indeg.get(d) || 0) - 1);
      if (indeg.get(d) === 0) {
        ready.push(byKey.get(d)!);
        sortReady();
      }
    }
  }
  // Anything left is in a cycle; keep it in array order so nothing is lost.
  wf.steps.forEach((s) => {
    if (!out.includes(s)) out.push(s);
  });
  return out;
}

/** Steps array in run order; positions by depth so branches sit on their own row. */
function reorderAndLayout(wf: WorkflowDefinition) {
  const ordered = topologicalOrder(wf);
  const depth = new Map<string, number>();
  ordered.forEach((s) => {
    const preds = predecessors(wf, s.key);
    depth.set(s.key, preds.length ? Math.max(...preds.map((p) => (depth.get(p) ?? 0) + 1)) : 0);
  });
  const rowCount = new Map<number, number>();
  wf.layout = wf.layout || { nodes: {} };
  wf.layout.nodes = {};
  ordered.forEach((s) => {
    const d = depth.get(s.key) || 0;
    const row = rowCount.get(d) || 0;
    rowCount.set(d, row + 1);
    const pos = { x: 80 + d * 260, y: 150 + row * 180 };
    s.position = pos;
    wf.layout.nodes[s.key] = { key: s.key, x: pos.x, y: pos.y };
  });
  wf.steps = ordered;
}

// ---------------------------------------------------------------------------
// Matching helpers
// ---------------------------------------------------------------------------

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOP_WORDS.has(t));
}

function stem(t: string): string {
  return t.replace(/(ing|ed|es|s)$/, '');
}

function stepText(s: WorkflowStep): string {
  return `${s.displayName} ${s.name || ''} ${s.purpose} ${s.userFacingExplanation} ${s.application.replace(/_/g, ' ')} ${s.stepType}`.toLowerCase();
}

function scoreStep(s: WorkflowStep, phrase: string): number {
  const app = findApp(phrase);
  let score = app && s.application === app.id ? 3 : 0;
  const words = tokens(stepText(s)).map(stem);
  const nameWords = tokens(`${s.displayName} ${s.name || ''}`).map(stem);
  for (const t of tokens(phrase)) {
    const variants = [t, ...(SYNONYMS[t] || []), ...(SYNONYMS[stem(t)] || [])].map(stem);
    if (variants.some((v) => nameWords.includes(v))) score += 2;
    else if (variants.some((v) => words.includes(v))) score += 1;
  }
  if (/approv|sign/.test(phrase) && s.stepType === 'approval') score += 2;
  // "the customer email" means the email, not the approval named after it.
  if (!/approv|sign/.test(phrase) && s.stepType === 'approval') score -= 2;
  return Math.max(0, score);
}

/** One step for a phrase, or a question when none or several fit equally well. */
function resolveSingleStep(
  state: EditState,
  phrase: string,
  filter: (s: WorkflowStep) => boolean = () => true
): WorkflowStep | null {
  const p = phrase.replace(/^(the|a|an)\s+/, '').trim();
  const candidates = state.wf.steps.filter(filter);
  const scored = candidates.map((s) => ({ s, score: scoreStep(s, p) })).filter((x) => x.score > 0);
  if (scored.length === 0) {
    const names = topologicalOrder(state.wf).filter(filter).map((s) => `"${s.displayName}"`).join(', ');
    state.questions.push(`I could not find a step matching "${p}". The steps are: ${names}. Which one did you mean?`);
    return null;
  }
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((x) => x.score === scored[0].score);
  if (top.length > 1) {
    state.questions.push(
      `"${p}" could mean ${top.map((x) => `"${x.s.displayName}"`).join(' or ')}. Which one?`
    );
    return null;
  }
  return top[0].s;
}

function findApp(phrase: string): { id: string; name: string } | null {
  const p = ` ${phrase.toLowerCase().replace(/[^a-z0-9\s]/g, ' ')} `;
  for (const a of APP_ALIASES) {
    if (a.words.some((w) => p.includes(` ${w} `))) return { id: a.id, name: a.name };
  }
  return null;
}

function appName(id: string): string {
  return APP_ALIASES.find((a) => a.id === id)?.name || id.replace(/^concludo_/, 'Concludo ').replace(/_/g, ' ');
}

function renameForApp(text: string, fromName: string, toName: string): string {
  if (!text) return text;
  const re = new RegExp(fromName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig');
  if (re.test(text)) return text.replace(re, toName);
  return text;
}

function isExternalMessage(s: WorkflowStep): boolean {
  if (s.stepType !== 'action') return false;
  if (!EXTERNAL_MESSAGING_APPS.has(s.application)) return false;
  // Drafts stay inside Concludo; sends, posts and notifications leave it.
  return !/\bdraft\b/i.test(`${s.displayName} ${s.name || ''}`);
}

function parseRole(phrase: string): string | null {
  const p = ` ${phrase.toLowerCase()} `;
  for (const r of APPROVER_ROLES) if (r.words.some((w) => p.includes(` ${w} `) || p.includes(` ${w}s `))) return r.role;
  return null;
}

function roleLabel(role?: string): string | null {
  if (!role) return null;
  const known = APPROVER_ROLES.find((r) => r.role === role);
  if (known) return known.label;
  if (role === 'workflow_owner') return 'you';
  return `the ${role.replace(/_/g, ' ')}`;
}

function defaultApproverRole(wf: WorkflowDefinition): string {
  const existing = wf.steps.find((s) => s.stepType === 'approval' && s.approvalRequirement?.approverRole);
  return existing?.approvalRequirement?.approverRole || (wf.owner?.type === 'role' ? wf.owner.value : 'project_owner');
}

function makeApprovalStep(wf: WorkflowDefinition, role: string, title: string, before: WorkflowStep): WorkflowStep {
  const who = roleLabel(role) || 'a person';
  return {
    key: uniqueKey(wf, `approval_${role}_before_${before.key}`),
    name: title,
    displayName: title,
    stepType: 'approval',
    purpose: `Pauses until ${who} approves "${before.displayName}".`,
    application: 'concludo_approval_centre',
    service: 'concludo_approval_centre',
    inputMapping: {},
    outputSchema: { approved: 'boolean' },
    configuration: { approverRole: role },
    approvalRequirement: { required: true, approverRole: role },
    userFacingExplanation: `${capitalise(who)} reviews and approves before "${before.displayName}" runs.`,
  };
}

function parseCondition(text: string): { rule: Record<string, any>; label: string; assumption?: string } | null {
  const t = text.replace(/^(the |a |an )/, '').trim();
  const num = t.match(
    /^(.+?) (?:is |are |amount is )?(more than|greater than|over|above|at least|less than|under|below|equal to|equals|exactly) \$?\s?([\d,]+(?:\.\d+)?)\s*(k|thousand|m|million)?/
  );
  if (num) {
    const subject = num[1].trim();
    let value = parseFloat(num[3].replace(/,/g, ''));
    if (num[4] === 'k' || num[4] === 'thousand') value *= 1000;
    if (num[4] === 'm' || num[4] === 'million') value *= 1000000;
    const op =
      /more|greater|over|above/.test(num[2]) ? 'greater_than'
      : /at least/.test(num[2]) ? 'greater_than_or_equal'
      : /less|under|below/.test(num[2]) ? 'less_than'
      : 'equals';
    const money = /\$/.test(text) || /invoice|deal|payment|amount|price|value|total/.test(subject);
    const noun = tokens(subject).pop() || 'value';
    const field = money ? 'amount' : camel(subject);
    const words = { greater_than: 'more than', greater_than_or_equal: 'at least', less_than: 'less than', equals: 'exactly' }[op];
    const shown = money ? `$${value.toLocaleString('en-AU')}` : value.toLocaleString('en-AU');
    return {
      rule: { left: `trigger.${field}`, operator: op, right: value },
      label: `the ${noun} is ${words} ${shown}`,
      assumption: money ? `I compared the ${noun}'s amount in Australian dollars. Tell me if it should use another field.` : undefined,
    };
  }
  const forType = t.match(/^(\w+) (meetings?|deals?|invoices?|projects?|clients?|tasks?)$/);
  if (forType) {
    const kind = forType[1];
    const thing = forType[2].replace(/s$/, '');
    return {
      rule: { left: `trigger.${thing}Type`, operator: 'equals', right: kind },
      label: `it is a ${kind} ${thing}`,
      assumption: `I check the ${thing} type for "${kind}". Make sure ${thing}s are tagged that way in Concludo.`,
    };
  }
  return null;
}

function explainFailure(wf: WorkflowDefinition, appPhrase: string): string[] {
  const app = findApp(appPhrase);
  const name = app?.name || appPhrase;
  const steps = app ? wf.steps.filter((s) => s.application === app.id) : [];
  if (steps.length === 0) return [`This workflow does not use ${name}, so it is not affected if ${name} is unavailable.`];
  const lines: string[] = [];
  steps.forEach((s) => {
    const attempts = s.retryPolicy?.maxAttempts ?? 3;
    lines.push(
      `"${s.displayName}" tries up to ${attempts} times, waiting longer between each try. Steps after it do not run while it is failing.`
    );
  });
  if (wf.errorHandling?.notifyOwnerOnFailure) lines.push('If it still fails, the workflow owner is told.');
  const max = wf.errorHandling?.maxConsecutiveFailures;
  if (max) lines.push(`After ${max} failed runs in a row, Concludo opens an incident so someone looks at it.`);
  const unprotected = steps.filter((s) => s.stepType === 'action' && !s.idempotencyPolicy?.enabled);
  if (unprotected.length === 0) {
    lines.push('Retries are protected against repeats, so nothing is created or sent twice.');
  } else {
    lines.push(
      `"${unprotected[0].displayName}" is not protected against repeats, so a retry after a partial outage could send it twice. Check for duplicates after an outage.`
    );
  }
  return lines;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function finishUnchanged(state: EditState, original: WorkflowDefinition, status: WorkflowEditStatus): WorkflowEditResult {
  if (status === 'needs_clarification' && state.changes.length > 0) {
    state.questions.push('Nothing has changed yet. Answer the question above and I will make all of the changes together.');
  }
  return {
    status,
    workflow: original,
    changes: [],
    questions: state.questions,
    assumptions: status === 'explained' ? [] : state.assumptions,
    limitations: [],
    answer: state.answer,
    events: [],
  };
}

function emit(state: EditState, type: WorkflowBuildEvent['type'], payload: Record<string, any>) {
  state.events.push({ type, payload });
}

/** Fill in either edge key spelling so every consumer (validation, canvas, engine) sees the same graph. */
export function normaliseDefinition(wf: WorkflowDefinition): WorkflowDefinition {
  wf.edges = (wf.edges || []).map((e) => {
    const src = e.sourceStepKey || e.sourceStep || '';
    const dst = e.destinationStepKey || e.destinationStep || '';
    return { ...e, sourceStepKey: src, sourceStep: src, destinationStepKey: dst, destinationStep: dst };
  });
  wf.layout = wf.layout || { nodes: {} };
  wf.layout.nodes = wf.layout.nodes || {};
  wf.steps = (wf.steps || []).map((s) => {
    const fromLayout = wf.layout.nodes[s.key];
    return fromLayout && !s.position ? { ...s, position: { x: fromLayout.x, y: fromLayout.y } } : s;
  });
  return wf;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

function uniqueKey(wf: WorkflowDefinition, base: string): string {
  const clean = base.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').slice(0, 60);
  const keys = new Set(wf.steps.map((s) => s.key));
  if (!keys.has(clean)) return clean;
  let i = 2;
  while (keys.has(`${clean}_${i}`)) i++;
  return `${clean}_${i}`;
}

function uniqueEdgeId(wf: WorkflowDefinition): string {
  const ids = new Set(wf.edges.map((e) => e.id));
  let i = wf.edges.length + 1;
  while (ids.has(`e${i}`)) i++;
  return `e${i}`;
}

function toNumber(word: string): number {
  const n = parseInt(word, 10);
  if (!isNaN(n)) return n;
  return NUMBER_WORDS[word.toLowerCase()] || 0;
}

function camel(text: string): string {
  const parts = tokens(text);
  return parts.map((p, i) => (i === 0 ? p : p.charAt(0).toUpperCase() + p.slice(1))).join('') || 'value';
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function pushOnce(list: string[], item: string) {
  if (!list.includes(item)) list.push(item);
}
