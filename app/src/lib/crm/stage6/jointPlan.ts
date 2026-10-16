/**
 * The joint action plan: written with the customer, not yet shown to them.
 *
 * WHAT THIS STAGE DELIBERATELY DOES NOT BUILD.
 *
 * The brief says: "External sharing must remain disabled until it has been
 * securely designed and approved. For this stage, implement preview and
 * internal approval only."
 *
 * "Disabled" can mean two things, and the difference matters. It can mean a
 * feature flag set to false, with the sharing code sitting behind it waiting
 * for somebody to flip it. Or it can mean the code is not there. This stage
 * does the second, because the first is how a customer's plan ends up on a
 * public URL: the flag is flipped in an environment nobody checked, or a test
 * sets it, or the sharing path is reachable by a route somebody forgot was
 * wired. There is no token, no recipient, no public link, no expiry and no
 * export in this module, in the pages, in the write path or in the migration.
 * The word "preview" below means an internal preview: what the customer WOULD
 * see, rendered for somebody who works here.
 *
 * When sharing is designed, it arrives as its own migration, its own write
 * path, its own threat model and its own review. Not as a boolean.
 *
 * WHY APPROVAL IS A STATE AND NOT A CHECKBOX.
 *
 * A plan that goes to a customer is a commitment made on behalf of the company,
 * so somebody with the authority to make it has to say so, and their name has
 * to be on it afterwards. The states run draft, internal review, approved
 * internally, with withdrawn as the way back. Approval requires the approver
 * role, and the validator refuses an approval with nobody's name against it.
 */
import {
  CrmWorkspaceData,
  JointPlan,
  JointPlanAction,
  JointPlanApprovalState,
  Organisation,
} from '../domain';
import { SourceTrail, sourceTrail } from '../stage4/sources';

export const APPROVAL_WORDS: Record<JointPlanApprovalState, string> = {
  draft: 'Draft',
  internal_review: 'With somebody here for review',
  approved_internally: 'Approved internally',
  withdrawn: 'Withdrawn',
};

export const APPROVAL_MEANINGS: Record<JointPlanApprovalState, string> = {
  draft: 'Being written. Nobody has been asked to look at it.',
  internal_review: 'Somebody here has been asked to approve it.',
  approved_internally:
    'Approved by somebody here. It is not shared with the customer: this release has no way to do that.',
  withdrawn: 'Taken back, with the reason recorded.',
};

export const ACTION_STATE_WORDS: Record<JointPlanAction['state'], string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  blocked: 'Blocked',
  no_longer_needed: 'No longer needed',
};

/* ---------------------------------------------------------- an action */

export interface JointActionView {
  action: JointPlanAction;
  stateWord: string;
  /** Whose it is, in words. A plan of only our actions is not a joint plan. */
  side: 'Ours' | 'Theirs';
  ownerLabel: string;
  dueDate: string | null;
  overdueDays: number | null;
  /** The actions this one waits on, resolved, so a dependency is readable. */
  dependsOn: { id: string; description: string; state: JointPlanAction['state'] }[];
  /** True where something it waits on is not done. */
  waiting: boolean;
  waitingOn: string[];
  evidence: SourceTrail | null;
  /** When it last changed, which is what tells you whether a plan is alive. */
  lastChangedAt: string;
}

function daysOverdue(due: string | null, now: string): number | null {
  if (!due) return null;
  const ms = new Date(now).getTime() - new Date(`${due}T00:00:00.000Z`).getTime();
  const days = Math.floor(ms / 86_400_000);
  return days > 0 ? days : null;
}

/* ------------------------------------------------------------ the plan */

export interface JointPlanView {
  plan: JointPlan;
  organisation: Organisation | null;
  approvalWord: string;
  approvalMeaning: string;
  actions: JointActionView[];
  ours: JointActionView[];
  theirs: JointActionView[];
  /** Counts by state, for the summary line. */
  byState: Record<JointPlanAction['state'], number>;
  overdueCount: number;
  blockedCount: number;
  /** The most recent change anywhere in the plan. A plan nobody touches is dead. */
  lastChangedAt: string | null;
  /** Whether this can be approved from where it is now, and why not. */
  canBeApproved: boolean;
  cannotBeApprovedBecause: string | null;
  /**
   * Said on every rendering of this plan, including the preview.
   * Not configurable, because the statement is the safeguard.
   */
  sharingNote: string;
  /** Problems a person should fix before asking for approval. */
  readiness: string[];
}

export const SHARING_NOTE =
  'This plan is not shared with the customer. Concludo has no way to send it to anybody outside this workspace in this release, and nothing on this page creates a link. Sharing will be built separately, once it has been designed and reviewed.';

export function buildJointPlan(
  data: CrmWorkspaceData,
  jointPlanId: string,
  now: string
): JointPlanView | null {
  const plan = data.jointPlans.find((p) => p.id === jointPlanId && p.deletedAt === null);
  if (!plan) return null;

  const organisation =
    data.organisations.find((o) => o.id === plan.organisationId && o.deletedAt === null) ?? null;

  const rows = data.jointPlanActions
    .filter((a) => a.jointPlanId === plan.id && a.deletedAt === null)
    .sort((a, b) => a.actionOrder - b.actionOrder);

  const byId = new Map(rows.map((a) => [a.id, a]));

  const actions: JointActionView[] = rows.map((action) => {
    const dependsOn = action.dependsOnActionIds
      .map((id) => byId.get(id))
      .filter((a): a is JointPlanAction => a !== undefined)
      .map((a) => ({ id: a.id, description: a.description, state: a.state }));

    const waitingOn = dependsOn
      .filter((d) => d.state !== 'done' && d.state !== 'no_longer_needed')
      .map((d) => d.description);

    const evidenceRow = action.evidenceId
      ? data.evidence.find((e) => e.id === action.evidenceId)
      : undefined;

    return {
      action,
      stateWord: ACTION_STATE_WORDS[action.state],
      side: action.ownedByUs ? 'Ours' : 'Theirs',
      ownerLabel: action.ownedByUs
        ? (action.ownerName ?? 'Somebody here, not yet named')
        : (action.ownerName ?? 'Somebody at the customer, not yet named'),
      dueDate: action.dueDate,
      overdueDays:
        action.state === 'done' || action.state === 'no_longer_needed'
          ? null
          : daysOverdue(action.dueDate, now),
      dependsOn,
      waiting: waitingOn.length > 0,
      waitingOn,
      evidence: evidenceRow ? sourceTrail(data, evidenceRow) : null,
      lastChangedAt: action.updatedAt,
    };
  });

  const byState: Record<JointPlanAction['state'], number> = {
    not_started: 0,
    in_progress: 0,
    done: 0,
    blocked: 0,
    no_longer_needed: 0,
  };
  for (const row of actions) byState[row.action.state] += 1;

  const lastChangedAt =
    [plan.updatedAt, ...actions.map((a) => a.lastChangedAt)].sort().at(-1) ?? null;

  /* ---- what has to be true before anybody is asked to approve ---- */

  const readiness: string[] = [];
  if (actions.length === 0) {
    readiness.push('The plan has no actions in it yet.');
  }
  if (actions.length > 0 && actions.every((a) => a.action.ownedByUs)) {
    readiness.push(
      'Every action here is ours. A joint plan with nothing on the customer’s side is our to-do list with their name on it.',
    );
  }
  const undated = actions.filter((a) => a.action.dueDate === null);
  if (undated.length > 0) {
    readiness.push(
      `${undated.length} ${undated.length === 1 ? 'action has' : 'actions have'} no date.`
    );
  }
  const unowned = actions.filter((a) => !a.action.ownerName && !a.action.ownerUserId);
  if (unowned.length > 0) {
    readiness.push(
      `${unowned.length} ${unowned.length === 1 ? 'action has' : 'actions have'} nobody named against it.`
    );
  }

  const canBeApproved = plan.approvalState === 'internal_review' && readiness.length === 0;
  const cannotBeApprovedBecause =
    plan.approvalState === 'approved_internally'
      ? 'It is already approved.'
      : plan.approvalState === 'draft'
        ? 'It is still a draft. Send it for review first.'
        : plan.approvalState === 'withdrawn'
          ? 'It was withdrawn. Put it back into review to approve it.'
          : readiness.length > 0
            ? 'There are things to settle first, listed above.'
            : null;

  return {
    plan,
    organisation,
    approvalWord: APPROVAL_WORDS[plan.approvalState],
    approvalMeaning: APPROVAL_MEANINGS[plan.approvalState],
    actions,
    ours: actions.filter((a) => a.action.ownedByUs),
    theirs: actions.filter((a) => !a.action.ownedByUs),
    byState,
    overdueCount: actions.filter((a) => a.overdueDays !== null).length,
    blockedCount: actions.filter((a) => a.action.state === 'blocked' || a.waiting).length,
    lastChangedAt,
    canBeApproved,
    cannotBeApprovedBecause,
    sharingNote: SHARING_NOTE,
    readiness,
  };
}

/**
 * What the customer would see, rendered for somebody who works here.
 *
 * An INTERNAL preview. It exists so a person can check what they are about to
 * read out in a meeting, and it strips the things that are ours alone: internal
 * notes, the readiness list, the approval history. It does not send anything,
 * and the page that renders it says so.
 */
export interface JointPlanPreview {
  sharedObjective: string;
  organisationName: string | null;
  actions: {
    description: string;
    side: 'Ours' | 'Theirs';
    owner: string;
    dueDate: string | null;
    state: string;
    waitingOn: string[];
  }[];
  /** Said at the top of the preview, every time. */
  notSharedNote: string;
}

export function previewOf(view: JointPlanView): JointPlanPreview {
  return {
    sharedObjective: view.plan.sharedObjective,
    organisationName: view.organisation?.name ?? null,
    actions: view.actions
      .filter((a) => a.action.state !== 'no_longer_needed')
      .map((a) => ({
        description: a.action.description,
        side: a.side,
        owner: a.ownerLabel,
        dueDate: a.dueDate,
        state: a.stateWord,
        waitingOn: a.waitingOn,
      })),
    notSharedNote: SHARING_NOTE,
  };
}

/** Every joint plan in the workspace, newest change first. */
export function jointPlansIn(data: CrmWorkspaceData, now: string): JointPlanView[] {
  return data.jointPlans
    .filter((p) => p.deletedAt === null)
    .map((p) => buildJointPlan(data, p.id, now))
    .filter((v): v is JointPlanView => v !== null)
    .sort((a, b) => (b.lastChangedAt ?? '').localeCompare(a.lastChangedAt ?? ''));
}
