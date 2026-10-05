import { describe, test, expect } from 'bun:test';
import {
  executeWorkflowArchitect,
  buildMeetingFollowthroughVerticalSlice,
} from '../app/src/lib/workflows/workflowArchitectAgent';
import { validateWorkflowDefinition } from '../app/src/lib/workflows/validation';
import { evaluateWorkflowPolicies } from '../app/src/lib/workflows/policyEngine';
import { WorkflowExecutionEngine } from '../app/src/lib/workflows/executionEngine';
import { WorkflowDefinition } from '../app/src/lib/workflows/schemas';

const ORG = 'org_edit_test';
const USER = 'user_edit_test';

async function build(prompt: string, connectedApplications: string[] = []) {
  const r = await executeWorkflowArchitect({ userPrompt: prompt, organizationId: ORG, userId: USER, connectedApplications });
  return r.workflowDefinition;
}

async function edit(current: WorkflowDefinition, prompt: string, connectedApplications: string[] = []) {
  return executeWorkflowArchitect({
    userPrompt: prompt,
    organizationId: ORG,
    userId: USER,
    currentWorkflow: current,
    connectedApplications,
  });
}

const stripePrompt = 'When a Stripe invoice payment fails, notify finance, create follow-up task, wait 3 days, recheck, and draft customer email with approval';
const meetingPrompt = 'When a meeting finishes, create a summary, extract actions, ask project owner for approval, and add to calendar';

function keys(wf: WorkflowDefinition) {
  return wf.steps.map((s) => s.key);
}

function preds(wf: WorkflowDefinition, key: string) {
  return wf.edges.filter((e) => e.destinationStepKey === key).map((e) => e.sourceStepKey);
}

/** Every path into `key` passes an approval step. */
function guardedByApproval(wf: WorkflowDefinition, key: string, seen = new Set<string>()): boolean {
  const p = preds(wf, key);
  if (p.length === 0) return false;
  return p.every((k) => {
    if (seen.has(k)) return true;
    seen.add(k);
    const s = wf.steps.find((x) => x.key === k)!;
    return s.stepType === 'approval' || guardedByApproval(wf, k, seen);
  });
}

function expectHealthyGraph(wf: WorkflowDefinition) {
  const v = validateWorkflowDefinition(wf);
  expect(v.errors).toEqual([]);
  const stepKeys = new Set(keys(wf));
  for (const e of wf.edges) {
    expect(e.sourceStep).toBe(e.sourceStepKey);
    expect(e.destinationStep).toBe(e.destinationStepKey);
    expect(stepKeys.has(e.sourceStepKey)).toBe(true);
    expect(stepKeys.has(e.destinationStepKey)).toBe(true);
  }
  // Steps are stored in run order: no edge points backwards in the array.
  const idx = new Map(keys(wf).map((k, i) => [k, i]));
  for (const e of wf.edges) expect(idx.get(e.sourceStepKey)!).toBeLessThan(idx.get(e.destinationStepKey)!);
  // Every step has a position for the canvas.
  for (const s of wf.steps) expect(s.position).toBeDefined();
}

describe('Workflow Architect: editing an existing workflow', () => {
  test('adds a manager approval before the customer email', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Add manager approval before the customer email.');
    expect(r.mode).toBe('edit');
    expect(r.buildStatus).toBe('complete');
    const added = r.workflowDefinition.steps.find((s) => s.approvalRequirement?.approverRole === 'manager')!;
    expect(added).toBeDefined();
    expect(added.stepType).toBe('approval');
    expect(preds(r.workflowDefinition, 'send_approved_customer_email')).toEqual([added.key]);
    expect(r.changes!.some((c) => c.kind === 'added' && /manager/i.test(c.summary))).toBe(true);
    expect(r.workflowDefinition.workflowKey).toBe(wf.workflowKey); // edited, not replaced
    expectHealthyGraph(r.workflowDefinition);
    expect(r.buildEvents.some((e) => e.type === 'node.added')).toBe(true);
    expect(r.buildEvents.some((e) => e.type === 'approval.added')).toBe(true);
  });

  test('waits three days before following up', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Wait three days before following up.');
    expect(r.buildStatus).toBe('complete');
    const wait = r.workflowDefinition.steps.find((s) => s.stepType === 'wait' && s.key.startsWith('wait_3'))!;
    expect(wait.configuration.durationDays).toBe(3);
    expect(preds(r.workflowDefinition, 'draft_customer_reminder')).toEqual([wait.key]);
    expectHealthyGraph(r.workflowDefinition);
  });

  test('switches the notification to Teams and flags the missing connection', async () => {
    const wf = await build(meetingPrompt);
    const r = await edit(wf, 'Send the notification to Teams instead.', ['hubspot']);
    expect(r.buildStatus).toBe('complete');
    const step = r.workflowDefinition.steps.find((s) => s.key === 'send_completion_notification')!;
    expect(step.application).toBe('microsoft_teams');
    expect(r.connectionsRequired).toContain('microsoft_teams');
    expect(r.buildEvents.some((e) => e.type === 'connection.required')).toBe(true);
    expect(guardedByApproval(r.workflowDefinition, step.key)).toBe(true);
    expect(r.changes!.some((c) => c.kind === 'changed' && /Microsoft Teams/.test(c.summary))).toBe(true);
    expectHealthyGraph(r.workflowDefinition);
  });

  test('removes an app and rejoins the steps around it', async () => {
    const wf = await build(meetingPrompt);
    const withSlack = (await edit(wf, 'Replace Concludo notification with Slack')).workflowDefinition;
    expect(withSlack.steps.some((s) => s.application === 'slack')).toBe(true);
    const r = await edit(withSlack, 'Remove Slack');
    expect(r.buildStatus).toBe('complete');
    expect(r.workflowDefinition.steps.some((s) => s.application === 'slack')).toBe(false);
    expect(r.changes!.some((c) => c.kind === 'removed')).toBe(true);
    expectHealthyGraph(r.workflowDefinition);
  });

  test('adds a condition: only when the invoice is more than $5,000', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Only run this when the invoice is more than $5,000.');
    expect(r.buildStatus).toBe('complete');
    const check = r.workflowDefinition.steps.find((s) => s.key.startsWith('check_condition'))!;
    expect(check.configuration.rule).toEqual({ left: 'trigger.amount', operator: 'greater_than', right: 5000 });
    expect(preds(r.workflowDefinition, check.key)).toEqual(['trigger_payment_failed']);
    expect(check.displayName).toContain('$5,000');
    expect(r.limitations.join(' ')).toMatch(/do not follow conditions/);
    expectHealthyGraph(r.workflowDefinition);
  });

  test('asks the user to choose a project when none is linked', async () => {
    const wf = await build(meetingPrompt);
    const r = await edit(wf, 'If no project is linked, ask me to select one.');
    expect(r.buildStatus).toBe('complete');
    const check = r.workflowDefinition.steps.find((s) => s.key === 'check_project_linked')!;
    const ask = r.workflowDefinition.steps.find((s) => s.key === 'ask_to_choose_project')!;
    expect(check).toBeDefined();
    expect(ask.stepType).toBe('approval');
    expect(preds(r.workflowDefinition, 'create_project_tasks').sort()).toEqual([ask.key, check.key].sort());
    expectHealthyGraph(r.workflowDefinition);
  });

  test('uses the project owner as the approver', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Use the project owner as the approver.');
    expect(r.buildStatus).toBe('complete');
    const approvals = r.workflowDefinition.steps.filter((s) => s.stepType === 'approval');
    expect(approvals.length).toBeGreaterThan(0);
    approvals.forEach((s) => expect(s.approvalRequirement?.approverRole).toBe('project_owner'));
  });

  test('explains the workflow without changing it', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Explain this workflow to me.');
    expect(r.mode).toBe('explain');
    expect(r.changes).toEqual([]);
    expect(r.answer!.length).toBeGreaterThan(3);
    expect(r.answer![0]).toMatch(/^1\. /);
    expect(JSON.stringify(r.workflowDefinition.steps.map((s) => s.key))).toBe(JSON.stringify(keys(wf)));
  });

  test('answers what happens if an app is unavailable', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const xero = await edit(wf, 'What happens if Xero is unavailable?');
    expect(xero.mode).toBe('explain');
    expect(xero.answer!.join(' ')).toMatch(/does not use Xero/);
    const stripe = await edit(wf, 'What happens if Stripe is down?');
    expect(stripe.answer!.join(' ')).toMatch(/tries up to 3 times/);
  });

  test('the three builder suggestion chips edit instead of replacing the workflow', async () => {
    const slice = buildMeetingFollowthroughVerticalSlice();
    const reminder = await edit(slice, 'Add a reminder the day before');
    expect(reminder.buildStatus).toBe('complete');
    expect(reminder.workflowDefinition.steps.some((s) => s.key === 'send_reminder_before_due')).toBe(true);
    expect(reminder.workflowDefinition.workflowKey).toBe('meeting-follow-through');

    const two = await edit(slice, 'Require two approvers');
    expect(two.buildStatus).toBe('complete');
    expect(two.workflowDefinition.steps.find((s) => s.key === 'approval_centre_review')!.approvalRequirement!.minimumApprovers).toBe(2);
    expect(two.limitations.join(' ')).toMatch(/Approval Centre/);

    const client = await edit(slice, 'Only for client meetings');
    expect(client.buildStatus).toBe('complete');
    const check = client.workflowDefinition.steps.find((s) => s.key.startsWith('check_condition'))!;
    expect(check.configuration.rule).toEqual({ left: 'trigger.meetingType', operator: 'equals', right: 'client' });
    expectHealthyGraph(client.workflowDefinition);
  });

  test('never silently replaces: an unclear instruction asks and changes nothing', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Make it more synergistic');
    expect(r.buildStatus).toBe('needs_clarification');
    expect(r.questions.length).toBeGreaterThan(0);
    expect(r.changes).toEqual([]);
    expect(keys(r.workflowDefinition)).toEqual(keys(wf));

    const newOne = await edit(wf, 'When a HubSpot deal is won, set up onboarding');
    expect(newOne.buildStatus).toBe('needs_clarification');
    expect(newOne.questions[0]).toMatch(/new workflow/);
    expect(newOne.workflowDefinition.workflowKey).toBe(wf.workflowKey);
  });

  test('an ambiguous target asks which step is meant', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Remove the task');
    // "task" could only mean the recovery task here, so it applies; an approval phrase with two candidates asks.
    expect(['complete', 'needs_clarification']).toContain(r.buildStatus);
    const twoApprovals = (await edit(wf, 'Add manager approval before the customer email')).workflowDefinition;
    const ask = await edit(twoApprovals, 'Move the approval after the recheck');
    expect(ask.buildStatus).toBe('needs_clarification');
    expect(ask.questions[0]).toMatch(/Which one/);
  });

  test('refuses to remove the sign-off that guards a customer email', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const r = await edit(wf, 'Remove the approve customer email dispatch step');
    expect(r.buildStatus).toBe('failed');
    expect(r.answer!.join(' ')).toMatch(/always need a person to approve/);
    expect(keys(r.workflowDefinition)).toEqual(keys(wf));
  });

  test('refuses to remove the only approval before tasks and calendar dates', async () => {
    const wf = await build(meetingPrompt);
    const r = await edit(wf, 'Remove the approval centre sign-off');
    expect(r.buildStatus).toBe('failed');
    expect(keys(r.workflowDefinition)).toContain('approval_centre_review');
  });

  test('a message moved ahead of its approval gets a new approval in front of it', async () => {
    const wf = await build(meetingPrompt);
    const teams = (await edit(wf, 'Send the notification to Teams instead.')).workflowDefinition;
    const r = await edit(teams, 'Move the notification before the meeting AI agent');
    expect(r.buildStatus).toBe('complete');
    expect(guardedByApproval(r.workflowDefinition, 'send_completion_notification')).toBe(true);
    expect(r.changes!.some((c) => /need a person's sign-off/.test(c.summary))).toBe(true);
    expectHealthyGraph(r.workflowDefinition);
  });

  test('editing a published workflow creates the next draft version', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    const published = { ...wf, status: 'published' as const, version: 3 };
    const r = await edit(published, 'Rename this to Payment chaser. Wait 2 days before the customer email.');
    expect(r.buildStatus).toBe('complete');
    expect(r.workflowDefinition.name).toBe('Payment chaser');
    expect(r.workflowDefinition.status).toBe('draft');
    expect(r.workflowDefinition.version).toBe(4);
    expect(published.status).toBe('published'); // input not mutated
  });

  test('the surveillance gate still applies to edits', async () => {
    const wf = await build(meetingPrompt);
    let blocked = false;
    try {
      await edit(wf, 'Add an employee ranking leaderboard after the summary');
    } catch {
      blocked = true;
    }
    expect(blocked).toBe(true);
  });

  test('mode build forces a fresh workflow even when one is open', async () => {
    const wf = await build(meetingPrompt);
    const r = await executeWorkflowArchitect({
      userPrompt: stripePrompt,
      organizationId: ORG,
      userId: USER,
      currentWorkflow: wf,
      mode: 'build',
    });
    expect(r.mode).toBe('build');
    expect(r.workflowDefinition.workflowKey).toBe('stripe-payment-failure-followup');
  });

  test('a build request it cannot match asks instead of building the meeting workflow', async () => {
    const r = await executeWorkflowArchitect({
      userPrompt: 'When an invoice becomes overdue, tell Finance',
      organizationId: ORG,
      userId: USER,
    });
    expect(r.mode).toBe('build');
    expect(r.buildStatus).toBe('needs_clarification');
    expect(r.questions[0]).toMatch(/four kinds of workflow/);
    const meeting = await executeWorkflowArchitect({ userPrompt: 'After every client meeting, create the follow-up tasks', organizationId: ORG, userId: USER });
    expect(meeting.buildStatus).toBe('complete');
    expect(meeting.workflowDefinition.workflowKey).toBe('meeting-follow-through');
  });

  test('edited workflows still pass policy checks and run in a dry run', async () => {
    const wf = await build(stripePrompt, ['stripe']);
    let current = wf;
    for (const instruction of [
      'Add manager approval before the customer email.',
      'Wait three days before following up.',
      'Only run this when the invoice is more than $5,000.',
    ]) {
      const r = await edit(current, instruction);
      expect(r.buildStatus).toBe('complete');
      current = r.workflowDefinition;
    }
    expect(evaluateWorkflowPolicies(current).status).not.toBe('DENY');
    const engine = new WorkflowExecutionEngine();
    const run = await engine.execute(current, { invoiceId: 'in_test', amount: 7000 }, { isDryRun: true, simulateImmediateApproval: true });
    expect(run.status).toBe('completed');
    expect(Object.keys(run.stepResults).length).toBe(current.steps.length);
  });
});
