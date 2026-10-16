/**
 * What Today shows, and why each thing is on it.
 *
 * THE RULE THIS MODULE ENFORCES
 *
 * Every item carries a reason. Not as a nicety, but because an item on a
 * working list with no reason is an instruction, and a person who cannot see
 * why something is in front of them cannot disagree with it. "Harbourline
 * Property Group" on a list is a demand. "Harbourline Property Group, no
 * recorded activity for 65 days" is information a person can act on, defer, or
 * dismiss as wrong. Only the second one respects the reader.
 *
 * The reason is structural: `TodayItem` cannot be constructed without a
 * `standing` drawn from the approved phrases and a `reason` in plain words.
 * A test asserts that no item anywhere in the composition has an empty reason,
 * and a second test scans every string this module can produce against the
 * banned language list.
 *
 * THE SECOND RULE: NO DECORATIVE NUMBERS
 *
 * The brief asks for twelve dashboard cards. A card that is only a number is
 * decoration. Every card here carries the number, the reason the number
 * matters, and the place it leads, and `TodayCard.destination` is required, so
 * a card that leads nowhere does not compile.
 */
import {
  CrmDataset,
  CrmModulePath,
  CrmProposal,
  CrmViewState,
} from './types';
import { ApprovedPhrase } from './language';
import { CRM_DEMO_NOW, daysSince, daysUntil } from './data/clock';
import {
  CrmIndex,
  buildCrmIndex,
  commitmentDueIn,
  filterCommitments,
  filterRecords,
  organisationName,
  stageDwell,
} from './selectors';

/* ------------------------------------------------------------- the items */

export interface TodayItem {
  id: string;
  /** What a reader sees first. */
  title: string;
  /** The second line: who it is with, or what it belongs to. */
  context: string;
  /** One of the approved phrases. */
  standing: ApprovedPhrase;
  /** Why this item appears, in plain words, with the fact behind it. */
  reason: string;
  /** Where the item leads. */
  destination: CrmModulePath;
  /**
   * A short status word shown beside a shape, never a colour alone.
   * Null where the item has no status beyond its standing.
   */
  statusLabel: string | null;
  /** 'open', 'waiting', 'review' or 'none'. Drives the non-colour indicator. */
  statusShape: 'open' | 'waiting' | 'review' | 'none';
}

export interface TodayCard {
  key: string;
  label: string;
  count: number;
  /** Why this count matters. Never a target, never a comparison to a person. */
  note: string;
  destination: CrmModulePath;
  /** 'attention' where the count is work to look at, else 'quiet'. */
  tone: 'attention' | 'quiet';
}

export interface TodayPanel {
  key: string;
  title: string;
  /** One line under the title saying what the panel is for. */
  description: string;
  /** Said when the panel is empty, as an outcome rather than a failure. */
  emptyMessage: string;
  destination: CrmModulePath;
  items: TodayItem[];
  /** How many the panel's own list holds before capping. */
  total: number;
  /** How many were left out because Handle first already showed them. */
  alreadyShown: number;
}

export interface TodayComposition {
  cards: TodayCard[];
  panels: TodayPanel[];
  /** True when nothing anywhere needs a look. */
  allClear: boolean;
  /** The number of proposals awaiting a decision, for the header indicator. */
  awaitingConfirmation: number;
}

/** No panel draws more than this. The full list is one click away. */
export const PANEL_SIZE = 4;

/* ---------------------------------------------------------- composition */

export function composeToday(
  dataset: CrmDataset,
  state: CrmViewState,
  now: string = CRM_DEMO_NOW
): TodayComposition {
  const index = buildCrmIndex(dataset);

  const records = filterRecords(dataset, index, state, now);
  const commitments = filterCommitments(dataset, index, state).filter((c) => c.state === 'open');

  /* ---- the raw groups, each computed once and reused by cards and panels */

  const quietOrganisations = dataset.organisations
    .filter((organisation) => {
      if (state.organisationId !== 'all' && organisation.id !== state.organisationId) return false;
      if (state.owner !== 'all' && organisation.ownerName !== state.owner) return false;
      if (!organisation.lastActivityAt) return true;
      return daysSince(organisation.lastActivityAt, now) >= 45;
    })
    .sort((a, b) => {
      // Quiet AND still carrying open work outranks quiet with nothing open.
      // An account with no open work and no contact is a decision to make
      // eventually; an account with two open opportunities and no contact for
      // two months is the one a person wants to see first.
      if ((a.openRecordCount > 0) !== (b.openRecordCount > 0)) {
        return a.openRecordCount > 0 ? -1 : 1;
      }
      const aDays = a.lastActivityAt ? daysSince(a.lastActivityAt, now) : Number.MAX_SAFE_INTEGER;
      const bDays = b.lastActivityAt ? daysSince(b.lastActivityAt, now) : Number.MAX_SAFE_INTEGER;
      return bDays - aDays;
    });

  const newLeads = dataset.leads.filter((lead) => lead.state === 'awaiting_review');

  const followUpsDue = records
    .filter((record) => record.status === 'open' && record.nextStepDue !== null)
    .filter((record) => daysUntil(record.nextStepDue as string, now) <= 4)
    .sort((a, b) => daysUntil(a.nextStepDue as string, now) - daysUntil(b.nextStepDue as string, now));

  const commitmentsDue = commitments
    .filter((commitment) => {
      const due = commitmentDueIn(commitment, now);
      return due !== null && due <= 5;
    })
    .sort((a, b) => (commitmentDueIn(a, now) ?? 0) - (commitmentDueIn(b, now) ?? 0));

  const noNextStep = records.filter(
    (record) => record.status === 'open' && record.nextStep === null
  );

  const sittingLong = records.filter((record) => {
    if (record.status !== 'open') return false;
    return stageDwell(record, index, now).longerThanUsual;
  });

  const meetingsOutstanding = dataset.activities
    .filter((activity) => activity.followThroughOutstanding)
    .filter(
      (activity) =>
        state.organisationId === 'all' || activity.organisationId === state.organisationId
    )
    .sort((a, b) => daysSince(b.occurredAt, now) - daysSince(a.occurredAt, now));

  const openServiceIssues = dataset.serviceIssues.filter(
    (issue) => issue.state !== 'resolved'
  );

  const awaitingProposals = dataset.proposals.filter(
    (proposal) => proposal.state === 'awaiting_confirmation'
  );

  const newRelationships = dataset.people
    .filter((person) => daysSince(person.createdAt, now) <= 14)
    .sort((a, b) => daysSince(a.createdAt, now) - daysSince(b.createdAt, now));

  const upcomingRenewals = dataset.organisations
    .filter((organisation) => organisation.renewalDate !== null)
    .filter((organisation) => {
      const until = daysUntil(organisation.renewalDate as string, now);
      return until >= 0 && until <= 60;
    })
    .sort(
      (a, b) =>
        daysUntil(a.renewalDate as string, now) - daysUntil(b.renewalDate as string, now)
    );

  const pipelineMovement = records
    .filter((record) => record.status === 'open')
    .map((record) => ({ record, dwell: stageDwell(record, index, now) }))
    .sort((a, b) => b.dwell.days - a.dwell.days);

  /* ------------------------------------------------------------- cards */

  const cards: TodayCard[] = [
    {
      key: 'relationships_attention',
      label: 'Relationships needing attention',
      count: dataset.people.filter((p) => p.attentionReason !== null).length,
      note: 'People with something outstanding recorded against them.',
      destination: '/crm/relationships',
      tone: 'attention',
    },
    {
      key: 'new_leads',
      label: 'New leads awaiting review',
      count: newLeads.length,
      note: 'Enquiries nobody has decided on yet.',
      destination: '/crm/leads',
      tone: 'attention',
    },
    {
      key: 'follow_ups',
      label: 'Follow-ups due',
      count: followUpsDue.length,
      note: 'Next steps with a date in the next four days or already past.',
      destination: '/crm/pipeline',
      tone: 'attention',
    },
    {
      key: 'commitments_due',
      label: 'Commitments due',
      count: commitmentsDue.length,
      note: 'Promises made in a meeting, with a date attached.',
      destination: '/crm/commitments',
      tone: 'attention',
    },
    {
      key: 'at_risk',
      label: `${dataset.workspace.recordTerminologyPlural} that may need attention`,
      count: sittingLong.length,
      note: 'Open work sitting in a stage longer than that stage usually takes.',
      destination: '/crm/pipeline',
      tone: 'attention',
    },
    {
      key: 'meetings_outstanding',
      label: 'Meetings awaiting follow-through',
      count: meetingsOutstanding.length,
      note: 'Meetings where something was agreed and nothing has been recorded since.',
      destination: '/crm/activities',
      tone: 'attention',
    },
    {
      key: 'service_issues',
      label: 'Service issues affecting relationships',
      count: openServiceIssues.length,
      note: 'Open issues with a recorded effect on the relationship.',
      destination: '/crm/service',
      tone: 'attention',
    },
    {
      key: 'proposals',
      label: 'AI proposals awaiting approval',
      count: awaitingProposals.length,
      note: 'Proposed CRM updates. Nothing is applied until a person confirms it.',
      destination: '/crm/proposals',
      tone: 'attention',
    },
    {
      key: 'records_review',
      label: 'Records needing review',
      count: dataset.reviewItems.length,
      note: 'Records where something is missing, unclear or inferred rather than stated.',
      destination: '/crm/data-quality',
      tone: 'quiet',
    },
    {
      key: 'duplicates',
      label: 'Possible duplicates',
      count: dataset.duplicates.filter((d) => d.recommendation === 'review_together').length,
      note: 'Pairs worth looking at together. Nothing is merged without a decision.',
      destination: '/crm/data-quality',
      tone: 'quiet',
    },
    {
      key: 'renewals',
      label: 'Upcoming renewals',
      count: upcomingRenewals.length,
      note: 'Renewal or review dates in the next sixty days.',
      destination: '/crm/organisations',
      tone: 'quiet',
    },
    {
      key: 'missing_next_steps',
      label: 'Missing next steps',
      count: noNextStep.length,
      note: 'Open work with nothing recorded as the next thing to do.',
      destination: '/crm/pipeline',
      tone: 'attention',
    },
  ];

  /* ------------------------------------------------------------ panels */

  /**
   * Handle First is a composition, not a queue.
   *
   * It takes the single most consequential item from four different places
   * rather than the top four of one list, because a person's first four
   * actions in a morning are rarely four of the same kind of thing. It also
   * means Handle First never repeats what the panel below it already shows in
   * full.
   */
  const handleFirst: TodayItem[] = [];

  /**
   * What Handle first has claimed.
   *
   * Without this, the four items at the top appear again in the four panels
   * below, and the page shows the same thread four times in four places. That
   * is the exact defect found in the Email Command Centre's dashboard, where
   * one invoice thread appeared in four panels and the page ran to 4,265
   * pixels. A thread already shown is a thread already seen, so each panel
   * below drops what Handle first took and says how many it dropped.
   */
  const claimed = new Set<string>();

  const firstOverdueCommitment = commitmentsDue.find((c) => {
    const due = commitmentDueIn(c, now);
    return due !== null && due < 0 && c.ownedByUser;
  });
  if (firstOverdueCommitment) {
    claimed.add(`commitment:${firstOverdueCommitment.id}`);
    const due = commitmentDueIn(firstOverdueCommitment, now) as number;
    handleFirst.push({
      id: `hf-com-${firstOverdueCommitment.id}`,
      title: firstOverdueCommitment.description,
      context: organisationName(firstOverdueCommitment.organisationId, index),
      standing: 'Recommended today',
      reason: `You said you would do this by ${formatDay(firstOverdueCommitment.dueDate as string)}, which was ${Math.abs(due)} days ago.`,
      destination: '/crm/commitments',
      statusLabel: 'Open',
      statusShape: 'open',
    });
  }

  const quietest = quietOrganisations[0];
  if (quietest) {
    claimed.add(`organisation:${quietest.id}`);
    handleFirst.push({
      id: `hf-org-${quietest.id}`,
      title: quietest.name,
      context: `${quietest.industry}. Owned by ${quietest.ownerName}.`,
      standing: 'Relationship may need attention',
      reason: quietest.lastActivityAt
        ? `No recorded activity for ${daysSince(quietest.lastActivityAt, now)} days. ${quietest.healthReason}`
        : `No activity has ever been recorded. ${quietest.healthReason}`,
      destination: '/crm/organisations',
      statusLabel: 'Needs a look',
      statusShape: 'review',
    });
  }

  const firstNoNextStep = noNextStep[0];
  if (firstNoNextStep) {
    claimed.add(`record:${firstNoNextStep.id}`);
    const dwell = stageDwell(firstNoNextStep, index, now);
    handleFirst.push({
      id: `hf-rec-${firstNoNextStep.id}`,
      title: firstNoNextStep.title,
      context: organisationName(firstNoNextStep.organisationId, index),
      standing: 'No next step recorded',
      reason: `At ${dwell.stageName} for ${dwell.days} days, where ${dwell.typicalDays} is usual, and nothing is recorded as the next thing to do.`,
      destination: '/crm/pipeline',
      statusLabel: dwell.stageName,
      statusShape: 'open',
    });
  }

  const firstProposal = awaitingProposals[0];
  if (firstProposal) {
    claimed.add(`proposal:${firstProposal.id}`);
    handleFirst.push(proposalItem(firstProposal));
  }

  /** The rows each panel keeps once Handle first has taken its own. */
  const freeFollowUps = followUpsDue.filter((r) => !claimed.has(`record:${r.id}`));
  const freeCommitments = commitmentsDue.filter((c) => !claimed.has(`commitment:${c.id}`));
  const freeMovement = pipelineMovement.filter(
    ({ record }) => !claimed.has(`record:${record.id}`)
  );
  const freeQuiet = quietOrganisations.filter((o) => !claimed.has(`organisation:${o.id}`));
  const freeProposals = awaitingProposals.filter((p) => !claimed.has(`proposal:${p.id}`));

  const panels: TodayPanel[] = [
    {
      key: 'handle_first',
      title: 'Handle first',
      description: 'One item from each of the places that most often needs you.',
      emptyMessage: 'Nothing stands out above anything else today.',
      destination: '/crm/pipeline',
      items: handleFirst.slice(0, PANEL_SIZE),
      total: handleFirst.length,
      alreadyShown: 0,
    },
    {
      key: 'follow_ups',
      title: 'Follow-ups due',
      description: 'Next steps with a date in the next four days or already past.',
      emptyMessage: 'No next step is due in the next four days.',
      destination: '/crm/pipeline',
      items: freeFollowUps.map((record) => {
        const until = daysUntil(record.nextStepDue as string, now);
        return {
          id: `fu-${record.id}`,
          title: record.nextStep as string,
          context: `${record.title}, ${organisationName(record.organisationId, index)}`,
          standing: until < 0 ? ('Recommended today' as const) : ('Commitment approaching' as const),
          reason:
            until < 0
              ? `Recorded as due ${formatDay(record.nextStepDue as string)}, ${Math.abs(until)} days ago.`
              : until === 0
                ? 'Recorded as due today.'
                : `Recorded as due in ${until} days, on ${formatDay(record.nextStepDue as string)}.`,
          destination: '/crm/pipeline' as const,
          statusLabel: record.ownerName,
          statusShape: 'open' as const,
        };
      }),
      total: followUpsDue.length,
      alreadyShown: followUpsDue.length - freeFollowUps.length,
    },
    {
      key: 'commitments',
      title: 'Commitments and promises',
      description: 'What was said in a meeting, by whom, and by when.',
      emptyMessage: 'No commitment has a date in the next five days.',
      destination: '/crm/commitments',
      items: freeCommitments.map((commitment) => {
        const until = commitmentDueIn(commitment, now) as number;
        return {
          id: `cm-${commitment.id}`,
          title: commitment.description,
          context: `${commitment.ownerName}. ${organisationName(commitment.organisationId, index)}`,
          standing:
            until < 0 ? ('Recommended today' as const) : ('Commitment approaching' as const),
          reason:
            until < 0
              ? `Due ${formatDay(commitment.dueDate as string)}, ${Math.abs(until)} days ago. Taken from: ${commitment.source.evidence ?? 'no quote recorded'}`
              : `Due ${formatDay(commitment.dueDate as string)}. Taken from: ${commitment.source.evidence ?? 'no quote recorded'}`,
          destination: '/crm/commitments' as const,
          statusLabel: commitment.ownedByUser ? 'Yours' : 'Theirs',
          statusShape: commitment.ownedByUser ? ('open' as const) : ('waiting' as const),
        };
      }),
      total: commitmentsDue.length,
      alreadyShown: commitmentsDue.length - freeCommitments.length,
    },
    {
      key: 'new_relationships',
      title: 'New relationships',
      description: 'People added in the last fortnight, and where they came from.',
      emptyMessage: 'No new people in the last fortnight.',
      destination: '/crm/relationships',
      items: newRelationships.map((person) => ({
        id: `nr-${person.id}`,
        title: person.fullName,
        context: `${person.roleLabel}. ${organisationName(person.organisationId, index)}`,
        standing:
          person.origin.basis === 'inferred'
            ? ('Awaiting confirmation' as const)
            : ('Recommended today' as const),
        reason:
          person.origin.basis === 'inferred'
            ? `Captured from a meeting rather than entered by hand. Evidence: ${person.origin.evidence ?? 'none recorded'}`
            : `Added ${formatDay(person.createdAt)}. ${person.origin.evidence ?? ''}`.trim(),
        destination: '/crm/relationships' as const,
        statusLabel: person.origin.basis === 'inferred' ? 'Inferred' : 'Stated',
        statusShape: person.origin.basis === 'inferred' ? ('review' as const) : ('none' as const),
      })),
      total: newRelationships.length,
      alreadyShown: 0,
    },
    {
      key: 'pipeline_movement',
      title: 'Pipeline movement',
      description: 'Open work, longest in its current stage first.',
      emptyMessage: 'No open work in the current filters.',
      destination: '/crm/pipeline',
      items: freeMovement.map(({ record, dwell }) => ({
        id: `pm-${record.id}`,
        title: record.title,
        context: `${organisationName(record.organisationId, index)}. ${dwell.stageName}.`,
        standing: dwell.longerThanUsual
          ? ('Relationship may need attention' as const)
          : ('Recommended today' as const),
        reason: dwell.longerThanUsual
          ? `At ${dwell.stageName} for ${dwell.days} days, where ${dwell.typicalDays} is usual for this stage.`
          : `At ${dwell.stageName} for ${dwell.days} days, within the ${dwell.typicalDays} days usual for this stage.`,
        destination: '/crm/pipeline' as const,
        statusLabel: dwell.stageName,
        statusShape: dwell.longerThanUsual ? ('review' as const) : ('open' as const),
      })),
      total: pipelineMovement.length,
      alreadyShown: pipelineMovement.length - freeMovement.length,
    },
    {
      key: 'meetings',
      title: 'Meetings requiring follow-through',
      description: 'Meetings where something was agreed and nothing has been recorded since.',
      emptyMessage: 'Every recorded meeting has had something recorded against it.',
      destination: '/crm/activities',
      items: meetingsOutstanding.map((activity) => ({
        id: `mt-${activity.id}`,
        title: activity.title,
        context: `${formatDay(activity.occurredAt)}. ${organisationName(activity.organisationId, index)}`,
        standing: 'Awaiting confirmation' as const,
        reason: activity.followThroughReason ?? 'Follow-through has not been recorded.',
        destination: '/crm/activities' as const,
        statusLabel: `${daysSince(activity.occurredAt, now)} days ago`,
        statusShape: 'waiting' as const,
      })),
      total: meetingsOutstanding.length,
      alreadyShown: 0,
    },
    {
      key: 'at_risk',
      title: 'Customers that may need attention',
      description: 'Organisations with no recent recorded activity, or an open service issue.',
      emptyMessage: 'Every organisation has recent recorded activity.',
      destination: '/crm/organisations',
      items: freeQuiet.map((organisation) => ({
        id: `ar-${organisation.id}`,
        title: organisation.name,
        context: `${organisation.industry}. Owned by ${organisation.ownerName}.`,
        standing: 'Relationship may need attention' as const,
        reason: organisation.lastActivityAt
          ? `Last recorded activity ${formatDay(organisation.lastActivityAt)}, ${daysSince(organisation.lastActivityAt, now)} days ago. ${organisation.healthReason}`
          : `No activity has ever been recorded. ${organisation.healthReason}`,
        destination: '/crm/organisations' as const,
        statusLabel: healthLabel(organisation.health),
        statusShape: 'review' as const,
      })),
      total: quietOrganisations.length,
      alreadyShown: quietOrganisations.length - freeQuiet.length,
    },
    {
      key: 'proposals',
      title: 'AI proposal queue',
      description: 'Proposed CRM updates. Nothing is applied until a person confirms it.',
      emptyMessage: 'No proposed updates are waiting.',
      destination: '/crm/proposals',
      items: freeProposals.map(proposalItem),
      total: awaitingProposals.length,
      alreadyShown: awaitingProposals.length - freeProposals.length,
    },
    {
      key: 'data_quality',
      title: 'Data quality review',
      description: 'Records where something is missing, unclear or inferred rather than stated.',
      emptyMessage: 'Nothing is flagged for review.',
      destination: '/crm/data-quality',
      items: dataset.reviewItems.map((item) => ({
        id: `dq-${item.id}`,
        title: item.label,
        context: item.suggestedCheck,
        standing: 'Source needs review' as const,
        reason: item.reason,
        destination: '/crm/data-quality' as const,
        statusLabel: null,
        statusShape: 'review' as const,
      })),
      total: dataset.reviewItems.length,
      alreadyShown: 0,
    },
    {
      key: 'renewals',
      title: 'Upcoming renewals',
      description: 'Renewal or review dates in the next sixty days.',
      emptyMessage: 'No renewal or review date falls in the next sixty days.',
      destination: '/crm/organisations',
      items: upcomingRenewals.filter((o) => !claimed.has(`organisation:${o.id}`)).map((organisation) => {
        const until = daysUntil(organisation.renewalDate as string, now);
        return {
          id: `rn-${organisation.id}`,
          title: organisation.name,
          context: `${organisation.industry}. Owned by ${organisation.ownerName}.`,
          standing: 'Commitment approaching' as const,
          reason: `Renewal or review recorded for ${formatDay(organisation.renewalDate as string)}, ${until} days away.`,
          destination: '/crm/organisations' as const,
          statusLabel: `${until} days`,
          statusShape: 'waiting' as const,
        };
      }),
      total: upcomingRenewals.length,
      alreadyShown:
        upcomingRenewals.length -
        upcomingRenewals.filter((o) => !claimed.has(`organisation:${o.id}`)).length,
    },
  ];

  // Cap each panel after the items are built, so `total` is the true count and
  // the panel can say how many it did not draw.
  const capped = panels.map((panel) => ({ ...panel, items: panel.items.slice(0, PANEL_SIZE) }));

  return {
    cards,
    panels: capped,
    allClear: capped.every((panel) => panel.total === 0),
    awaitingConfirmation: awaitingProposals.length,
  };
}

/* ------------------------------------------------------------- helpers */

function proposalItem(proposal: CrmProposal): TodayItem {
  return {
    id: `pr-${proposal.id}`,
    title: proposal.headline,
    context: `${proposal.subjectLabel}. Confidence: ${proposal.confidence}.`,
    standing: 'Proposed CRM update',
    reason: `${proposal.rationale} Evidence: ${proposal.evidence.evidence ?? 'none recorded'}`,
    destination: '/crm/proposals',
    statusLabel: proposal.destructive ? 'Would merge records' : 'Awaiting confirmation',
    statusShape: 'review',
  };
}

function healthLabel(health: string): string {
  if (health === 'needs_attention') return 'May need attention';
  if (health === 'dormant') return 'No open work';
  if (health === 'new') return 'New';
  return 'Steady';
}

/**
 * A date, in the workspace time zone.
 *
 * Pinned deliberately. Formatting a Melbourne date without a time zone renders
 * every deadline a day early for a reader west of it, which is a defect that
 * looks like a data problem and is not.
 */
export function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric',
    month: 'short',
  });
}

export function formatDayTime(iso: string): string {
  return new Date(iso).toLocaleString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Every string the composition can render, for the language test to scan. */
export function todayStrings(composition: TodayComposition): string[] {
  const strings: string[] = [];
  for (const card of composition.cards) strings.push(card.label, card.note);
  for (const panel of composition.panels) {
    strings.push(panel.title, panel.description, panel.emptyMessage);
    for (const item of panel.items) {
      strings.push(item.title, item.context, item.standing, item.reason);
      if (item.statusLabel) strings.push(item.statusLabel);
    }
  }
  return strings;
}
