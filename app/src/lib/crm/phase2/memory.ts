/**
 * Concludo Memory: what a business needs to remember about a customer.
 *
 * WHAT THIS IS, AND WHAT IT IS NOT.
 *
 * It is not the timeline. The Stage 4 timeline is everything that happened,
 * eleven kinds from three sources, and it is the right thing to read when
 * somebody asks "what has been going on". Memory is the much smaller set a
 * business cannot afford to lose: what was promised, who promised it, what
 * was decided, what came of it, why something was lost, and what is still
 * outstanding. The difference between those two sets is the product.
 *
 * NO MODEL IS CALLED HERE, AND THAT IS THE POINT.
 *
 * The nine questions the Phase 2 brief lists are all answerable from records.
 * Answering them from records is what proves the memory layer is real rather
 * than generated, and it means every sentence on the page resolves to a row
 * somebody can open. When a model is eventually wired in, it arrives as a
 * better way to ASK the question, never as the source of the answer: the
 * contract is that an answer with no supporting record returns "not recorded"
 * rather than a plausible sentence.
 *
 * That rule is worth more than it looks. A memory system that invents one
 * answer in a hundred destroys trust in the other ninety-nine, because a
 * person who finds the invented one has no way to tell which of the rest to
 * believe.
 *
 * EVERY ENTRY CARRIES ITS PROVENANCE. `source` names the table and the row.
 * An entry that cannot say where it came from is a rumour with a timestamp,
 * and this module will not produce one: the type requires it.
 *
 * NOTHING HERE IS STORED. Memory is derived from records that already exist,
 * so a stored copy could disagree with the records it came from. The only
 * table Phase 2B-i adds is the READ LOG, because making a customer's whole
 * history searchable in one query is the single largest change to the product's
 * risk surface and the control for it is knowing who asked what.
 */

import { CrmWorkspaceData, CrmRole } from '../domain';
import { onWriteInvalidate } from '../cacheBus';
import { buildTimeline, TimelineEntry } from '../stage4/timeline';
import { maySeeField } from '../stage8/governance';
import { indexFor } from '../stage8/paging';

/* ===================================================== the shape */

export type MemoryKind =
  | 'promise'
  | 'decision'
  | 'outcome'
  | 'change'
  | 'escalation'
  | 'renewal_event'
  | 'loss_reason'
  | 'milestone';

export const MEMORY_KIND_LABELS: Record<MemoryKind, string> = {
  promise: 'Promise',
  decision: 'Decision',
  outcome: 'Outcome',
  change: 'Change',
  escalation: 'Escalation',
  renewal_event: 'Renewal',
  loss_reason: 'Why it was lost',
  milestone: 'Milestone',
};

export interface MemorySource {
  table: string;
  id: string;
  /** What this record contributes, in a few words. */
  what: string;
}

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  organisationId: string;
  /** One sentence, in the words of the record. Never a template with slots. */
  statement: string;
  /** Who, where a record names somebody. Never inferred from anything. */
  who: string | null;
  occurredAt: string;
  /** Never empty. */
  source: MemorySource;
  /** Where to open the record. */
  path: string | null;
  /**
   * Whether anything is recorded as having come of this.
   *
   * Null where the question does not apply. The honest value for a promise
   * nobody has recorded an outcome against is `false`, not silence: an
   * unfulfilled promise is the single most useful thing in this module.
   */
  resolved: boolean | null;
  /** What resolved it, where something did. */
  resolvedBy: MemorySource | null;
}

/* ===================================================== building it */

const DAY = 86_400_000;

function personName(data: CrmWorkspaceData, id: string | null): string | null {
  if (id === null) return null;
  return indexFor(data).peopleById.get(id)?.fullName ?? null;
}

/**
 * The audit events that count as something a business needs to remember.
 *
 * An allowlist, not a filter on everything. The audit table records every
 * write, and most writes are not memory: a note being typed, a task being
 * created and a stage being dragged are all in the activity timeline already.
 * What belongs here is the narrow set that changed what the relationship IS,
 * because that is what makes the next conversation go differently: who
 * matters, how we stand with them, whether a plan is agreed, and whether a
 * date moved.
 *
 * Adding to this list is a deliberate act. A memory page that lists every
 * write is the activity timeline with a different heading, which is how a
 * memory feature stops being used.
 */
const CHANGE_EVENTS: Record<string, string> = {
  stakeholder_role_recorded: 'What part somebody plays here was recorded',
  relationship_described: 'How a relationship stands was described',
  joint_plan_approved: 'A joint plan was approved internally',
  joint_plan_withdrawn: 'A joint plan was withdrawn',
  work_item_close_date_changed: 'An expected close date moved',
  work_item_reopened: 'Work that had been closed was reopened',
  lead_converted: 'An enquiry became a customer record',
};

function push(bucket: Map<string, MemoryEntry[]>, organisationId: string, entry: MemoryEntry): void {
  const existing = bucket.get(organisationId);
  if (existing) existing.push(entry);
  else bucket.set(organisationId, [entry]);
}

/**
 * Memory for the whole workspace, bucketed by organisation, built in one pass.
 *
 * WHY THIS IS NOT A FILTER PER ORGANISATION.
 *
 * The obvious shape is `memoryFor(organisation)` filtering each table, and the
 * picker and the search then call it once per organisation. That is the
 * quadratic shape Stage 8 found five times: a thousand organisations against a
 * hundred thousand commitments is a hundred million comparisons to draw one
 * list. So the pass is over the tables once, and the organisation lookup is a
 * map read.
 *
 * The cache is keyed by role as well as by dataset, because one entry's
 * provenance line depends on what the role may see, and a cache shared across
 * roles would hand an administrator's wording to a viewer or the reverse.
 */
function buildMemoryIndex(data: CrmWorkspaceData, role: CrmRole): Map<string, MemoryEntry[]> {
  const bucket = new Map<string, MemoryEntry[]>();
  const index = indexFor(data);

  /* ---- promises, and whether anything came of them ---- */

  // Activities by organisation, newest first, so finding the conversation a
  // commitment was closed in does not re-scan the activity table per promise.
  for (const commitment of data.commitments) {
    if (commitment.deletedAt !== null) continue;
    if (commitment.organisationId === null) continue;

    const resolvedBy =
      commitment.state === 'done' && commitment.completedAt !== null
        ? (index.activitiesByOrganisation.get(commitment.organisationId) ?? []).find(
            (activity) =>
              Date.parse(activity.occurredAt) >= Date.parse(commitment.completedAt!) - DAY
          )
        : undefined;

    push(bucket, commitment.organisationId, {
      id: `mem-commit-${commitment.id}`,
      kind: 'promise',
      organisationId: commitment.organisationId,
      statement: commitment.description,
      who: commitment.ownedByUs
        ? `${commitment.ownerName} (ours)`
        : `${commitment.ownerName} (theirs)`,
      occurredAt: commitment.createdAt,
      source: { table: 'crm_commitments', id: commitment.id, what: 'the commitment as recorded' },
      path: '/crm/commitments',
      resolved: commitment.state === 'done',
      resolvedBy: resolvedBy
        ? { table: 'crm_activities', id: resolvedBy.id, what: 'the conversation it was closed in' }
        : null,
    });
  }

  /* ---- decisions ---- */

  for (const decision of data.decisions) {
    if (decision.deletedAt !== null) continue;
    if (decision.organisationId === null) continue;

    push(bucket, decision.organisationId, {
      id: `mem-decision-${decision.id}`,
      kind: 'decision',
      organisationId: decision.organisationId,
      statement: decision.summary ? `${decision.title}. ${decision.summary}` : decision.title,
      who: personName(data, decision.decidedByPersonId) ?? decision.decidedByName,
      occurredAt: decision.decidedOn ?? decision.createdAt,
      source: { table: 'crm_decisions', id: decision.id, what: 'the decision as recorded' },
      path: '/crm/activities',
      resolved: null,
      resolvedBy: null,
    });
  }

  /* ---- what happened to the work, including why it was lost ---- */

  for (const item of data.workItems) {
    if (item.deletedAt !== null) continue;
    if (item.organisationId === null) continue;
    if (item.status !== 'won' && item.status !== 'not_proceeding') continue;

    const lost = item.status === 'not_proceeding';
    push(bucket, item.organisationId, {
      id: `mem-work-${item.id}`,
      kind: lost ? 'loss_reason' : 'outcome',
      organisationId: item.organisationId,
      statement: lost
        ? item.resolutionReason
          ? `${item.title} did not proceed. Recorded reason: ${item.resolutionReason}`
          : `${item.title} did not proceed, and no reason is recorded.`
        : `${item.title} was won.${
            item.valueAmount !== null
              ? ` Recorded value ${item.valueCurrency} ${item.valueAmount.toLocaleString('en-AU')}.`
              : ' No value is recorded against it.'
          }`,
      who: null,
      occurredAt: item.resolvedAt ?? item.updatedAt,
      source: { table: 'crm_work_items', id: item.id, what: 'the work and how it ended' },
      path: `/crm/work/${item.id}`,
      resolved: true,
      resolvedBy: null,
    });
  }

  /* ---- escalations: a service case, without its detail ---- */

  // The case DETAIL is restricted by role and is not memory's to show. What
  // memory carries is that something went wrong, when, and what it meant for
  // the relationship, which is the part that changes the next conversation.
  const maySeeDetail = maySeeField(role, 'crm_service_cases', 'detail');

  for (const kase of data.serviceCases) {
    if (kase.deletedAt !== null) continue;
    if (kase.organisationId === null) continue;

    push(bucket, kase.organisationId, {
      id: `mem-case-${kase.id}`,
      kind: 'escalation',
      organisationId: kase.organisationId,
      statement: kase.relationshipEffect
        ? `${kase.title}. Recorded effect: ${kase.relationshipEffect}`
        : `${kase.title}. Nothing is recorded about what it meant for the relationship.`,
      who: personName(data, kase.personId),
      occurredAt: kase.raisedAt,
      source: {
        table: 'crm_service_cases',
        id: kase.id,
        what: maySeeDetail ? 'the case' : 'the case, with its detail withheld by role',
      },
      path: '/crm/service',
      resolved: kase.state === 'resolved' || kase.state === 'closed',
      resolvedBy: null,
    });
  }

  /* ---- renewal events, from the organisation's own record ---- */

  for (const organisation of index.liveOrganisations) {
    if (!organisation.renewalDate) continue;
    push(bucket, organisation.id, {
      id: `mem-renewal-${organisation.id}`,
      kind: 'renewal_event',
      organisationId: organisation.id,
      statement: `Renewal recorded for ${organisation.renewalDate}.`,
      who: null,
      occurredAt: organisation.updatedAt,
      source: {
        table: 'crm_organisations',
        id: organisation.id,
        what: 'the recorded renewal date',
      },
      path: `/crm/organisations/${organisation.id}`,
      resolved: null,
      resolvedBy: null,
    });
  }

  /* ---- milestones: an account review happened ---- */

  const planOrganisation = new Map<string, string>();
  for (const plan of data.accountPlans) {
    if (plan.deletedAt !== null || plan.organisationId === null) continue;
    planOrganisation.set(plan.id, plan.organisationId);
  }

  for (const review of data.accountReviews) {
    const organisationId = planOrganisation.get(review.accountPlanId);
    if (organisationId === undefined) continue;

    push(bucket, organisationId, {
      id: `mem-review-${review.id}`,
      kind: 'milestone',
      organisationId,
      statement: review.summary
        ? `Account reviewed. ${review.summary}`
        : 'Account reviewed, and nothing was recorded about what was discussed.',
      who: personName(data, review.reviewedBy),
      occurredAt: review.reviewedAt,
      source: {
        table: 'crm_account_reviews',
        id: review.id,
        what: 'the review and its summary',
      },
      path: '/crm/account-plans',
      resolved: null,
      resolvedBy: null,
    });
  }

  /* ---- changes that altered what the relationship is ---- */

  // Resolving an audit row to an organisation needs a map, because the subject
  // of a stakeholder-role event is a role row, not a person. Built from the
  // tables whose rows carry an organisation, in one pass each.
  const organisationOfSubject = new Map<string, string>();
  for (const organisation of data.organisations) {
    organisationOfSubject.set(organisation.id, organisation.id);
  }
  const withOrganisation: { id: string; organisationId: string | null }[][] = [
    data.people,
    data.personOrganisationRoles,
    data.workItems,
    data.commitments,
    data.serviceCases,
    data.accountPlans,
    data.jointPlans,
    data.activities,
    data.decisions,
  ];
  for (const rows of withOrganisation) {
    for (const row of rows) {
      if (row.organisationId === null) continue;
      organisationOfSubject.set(row.id, row.organisationId);
    }
  }
  for (const [planId, organisationId] of planOrganisation) {
    organisationOfSubject.set(planId, organisationId);
  }
  for (const review of data.accountReviews) {
    const organisationId = planOrganisation.get(review.accountPlanId);
    if (organisationId !== undefined) organisationOfSubject.set(review.id, organisationId);
  }

  for (const event of data.auditEvents) {
    if (event.subjectId === null) continue;
    if (event.outcome !== 'success') continue;

    const label = CHANGE_EVENTS[event.eventType];
    if (label === undefined) continue;

    const organisationId = organisationOfSubject.get(event.subjectId);
    if (organisationId === undefined) continue;

    push(bucket, organisationId, {
      id: `mem-change-${event.id}`,
      kind: 'change',
      organisationId,
      statement: event.detail ? `${label}. ${event.detail}` : `${label}.`,
      who: null,
      occurredAt: event.createdAt,
      source: { table: 'crm_audit_events', id: event.id, what: 'the audit row for the change' },
      path: `/crm/organisations/${organisationId}`,
      resolved: null,
      resolvedBy: null,
    });
  }

  for (const entries of bucket.values()) {
    entries.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }

  return bucket;
}

const cache = new WeakMap<CrmWorkspaceData, Map<CrmRole, Map<string, MemoryEntry[]>>>();

function memoryIndexFor(data: CrmWorkspaceData, role: CrmRole): Map<string, MemoryEntry[]> {
  let byRole = cache.get(data);
  if (!byRole) {
    byRole = new Map();
    cache.set(data, byRole);
  }
  let bucket = byRole.get(role);
  if (!bucket) {
    bucket = buildMemoryIndex(data, role);
    byRole.set(role, bucket);
  }
  return bucket;
}

/**
 * Drops the cached memory index.
 *
 * The session store mutates one workspace object in place rather than
 * replacing it, so a cache keyed on that object survives a write and is wrong
 * afterwards. Registered below, at module scope, through the import-free
 * cache bus.
 */
export function forgetMemoryIndex(data: CrmWorkspaceData): void {
  cache.delete(data);
}

onWriteInvalidate(forgetMemoryIndex);

/**
 * Everything worth remembering about one organisation, newest first.
 *
 * Eight kinds, each derived from a record that already exists. The derivation
 * is deliberately literal: the statement is the record's own words, and where
 * a record has no words of its own the entry says what the record is rather
 * than inventing a description of it.
 *
 * A copy, so a caller that sorts or splices the result cannot corrupt the
 * cache every other caller reads.
 */
export function memoryFor(
  data: CrmWorkspaceData,
  organisationId: string,
  role: CrmRole = 'crm_admin'
): MemoryEntry[] {
  return (memoryIndexFor(data, role).get(organisationId) ?? []).slice();
}

/* ===================================================== the timeline */

export interface MemoryTimeline {
  organisation: { id: string; name: string };
  /** The memory entries: what the business needs to remember. */
  memory: MemoryEntry[];
  /** Everything that happened, from the Stage 4 builder, newest first. */
  activity: TimelineEntry[];
  /** Said on the page, so the two are never confused. */
  note: string;
}

export const MEMORY_NOTE =
  'Memory is what this business needs to remember about this customer: what was promised, what was decided, what came of it. It is smaller than the activity history on purpose. Every line is a record you can open, and nothing on this page is generated.';

export function memoryTimeline(
  data: CrmWorkspaceData,
  organisationId: string,
  role: CrmRole = 'crm_admin'
): MemoryTimeline | null {
  const organisation = indexFor(data).organisationsById.get(organisationId);
  if (!organisation || organisation.deletedAt !== null) return null;

  return {
    organisation: { id: organisation.id, name: organisation.name },
    memory: memoryFor(data, organisationId, role),
    activity: buildTimeline(data)
      .filter((entry) => entry.organisationId === organisationId)
      .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)),
    note: MEMORY_NOTE,
  };
}

/* ===================================================== the nine questions */

export type MemoryQuestionKind =
  | 'what_did_we_promise'
  | 'who_promised_it'
  | 'what_happened_next'
  | 'what_was_decided'
  | 'why_was_it_lost'
  | 'last_senior_conversation'
  | 'what_service_issues'
  | 'what_is_outstanding'
  | 'what_changed_recently';

export const MEMORY_QUESTIONS: { kind: MemoryQuestionKind; question: string }[] = [
  { kind: 'what_did_we_promise', question: 'What did we promise?' },
  { kind: 'who_promised_it', question: 'Who promised it, and when?' },
  { kind: 'what_happened_next', question: 'What happened next?' },
  { kind: 'what_was_decided', question: 'What decisions were made?' },
  { kind: 'why_was_it_lost', question: 'Why was the opportunity lost?' },
  { kind: 'last_senior_conversation', question: 'When was the last conversation with somebody senior?' },
  { kind: 'what_service_issues', question: 'What service issues exist?' },
  { kind: 'what_is_outstanding', question: 'What commitments remain unresolved?' },
  { kind: 'what_changed_recently', question: 'What changed recently?' },
];

export interface MemoryAnswer {
  kind: MemoryQuestionKind;
  question: string;
  /** The answer, assembled from records. Never generated. */
  answer: string;
  /** One line per supporting record. Empty only where the answer is "not recorded". */
  lines: { statement: string; who: string | null; occurredAt: string; source: MemorySource; path: string | null }[];
  /**
   * True where nothing in the records supports an answer.
   *
   * This is a feature. An answer with nothing behind it is the one thing a
   * memory layer must never produce, because the person reading it has no way
   * to tell it apart from the ninety-nine that were real.
   */
  notRecorded: boolean;
}

/**
 * Counting phrases that read like a person wrote them.
 *
 * Phase 2A-i shipped "1 of the 1 people have" and "3 pieces of work is" before
 * anybody read the page aloud. A memory layer is judged on whether it sounds
 * like it knows what it is talking about, and one disagreeing verb costs more
 * trust than the sentence was worth.
 */
function were(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export const NOT_RECORDED =
  'Not recorded. Concludo will not answer this from anything other than the records, so the honest answer is that nothing here says.';

export function answerMemoryQuestion(
  data: CrmWorkspaceData,
  organisationId: string,
  kind: MemoryQuestionKind,
  now: string,
  role: CrmRole = 'crm_admin'
): MemoryAnswer {
  const question = MEMORY_QUESTIONS.find((entry) => entry.kind === kind)?.question ?? '';
  const entries = memoryFor(data, organisationId, role);
  const index = indexFor(data);

  const line = (entry: MemoryEntry) => ({
    statement: entry.statement,
    who: entry.who,
    occurredAt: entry.occurredAt,
    source: entry.source,
    path: entry.path,
  });

  const build = (answer: string, chosen: MemoryEntry[]): MemoryAnswer =>
    chosen.length === 0
      ? { kind, question, answer: NOT_RECORDED, lines: [], notRecorded: true }
      : { kind, question, answer, lines: chosen.map(line), notRecorded: false };

  switch (kind) {
    case 'what_did_we_promise': {
      const ours = entries.filter(
        (entry) => entry.kind === 'promise' && (entry.who ?? '').includes('(ours)')
      );
      return build(
        `${ours.length} ${were(ours.length, 'thing is', 'things are')} recorded as ours to do for this customer.`,
        ours
      );
    }

    case 'who_promised_it': {
      const promises = entries.filter((entry) => entry.kind === 'promise');
      const named = promises.filter((entry) => entry.who !== null).length;
      const total = promises.length;
      const answer =
        named === total
          ? `${were(total, 'The one recorded promise names who made it', `All ${total} recorded promises name who made them`)}. Concludo never fills in a name that is not on the record.`
          : `${named} of the ${total} recorded promises ${were(named, 'names who made it', 'name who made them')}. Concludo never fills in a name that is not on the record.`;
      return build(answer, promises);
    }

    case 'what_happened_next': {
      const resolved = entries.filter((entry) => entry.resolved === true);
      return build(
        `${resolved.length} recorded ${were(resolved.length, 'thing has something recorded as having come of it', 'things have something recorded as having come of them')}.`,
        resolved
      );
    }

    case 'what_was_decided': {
      const decisions = entries.filter((entry) => entry.kind === 'decision');
      return build(
        `${decisions.length} ${were(decisions.length, 'decision is', 'decisions are')} recorded against this customer.`,
        decisions
      );
    }

    case 'why_was_it_lost': {
      const lost = entries.filter((entry) => entry.kind === 'loss_reason');
      return build(
        `${lost.length} ${were(lost.length, 'piece of work did', 'pieces of work did')} not proceed, with whatever reason was recorded at the time.`,
        lost
      );
    }

    case 'last_senior_conversation': {
      // Senior means a recorded economic buyer or decision maker. Not a
      // judgement about anybody, just the role on the record.
      const seniorPeople = new Set(
        data.personOrganisationRoles
          .filter(
            (roleRow) =>
              roleRow.organisationId === organisationId &&
              roleRow.endedOn === null &&
              (roleRow.stakeholderRole === 'economic_buyer' ||
                roleRow.stakeholderRole === 'decision_maker')
          )
          .map((roleRow) => roleRow.personId)
      );

      if (seniorPeople.size === 0) {
        return {
          kind,
          question,
          answer:
            'Nobody at this organisation is recorded as an economic buyer or a decision maker, so there is no senior conversation to find.',
          lines: [],
          notRecorded: true,
        };
      }

      const activities = buildTimeline(data).filter(
        (entry) =>
          entry.organisationId === organisationId &&
          entry.personIds.some((personId) => seniorPeople.has(personId))
      );
      const latest = activities.sort(
        (a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt)
      )[0];

      if (!latest) {
        return {
          kind,
          question,
          answer:
            'Somebody senior is recorded here, and no conversation with them has ever been recorded.',
          lines: [],
          notRecorded: true,
        };
      }

      const days = Math.floor((Date.parse(now) - Date.parse(latest.occurredAt)) / DAY);
      return {
        kind,
        question,
        answer: `${days} ${days === 1 ? 'day' : 'days'} ago: ${latest.title}.`,
        lines: [
          {
            statement: latest.title,
            who: latest.personIds
              .map((personId) => personName(data, personId))
              .filter((name): name is string => name !== null)
              .join(', '),
            occurredAt: latest.occurredAt,
            source: {
              table: latest.subjectTable,
              id: latest.subjectId,
              what: 'the conversation',
            },
            path: '/crm/activities',
          },
        ],
        notRecorded: false,
      };
    }

    case 'what_service_issues': {
      const open = entries.filter((entry) => entry.kind === 'escalation' && entry.resolved === false);
      return build(
        `${open.length} service ${were(open.length, 'issue is', 'issues are')} open. What the case says is restricted by role and is not shown here.`,
        open
      );
    }

    case 'what_is_outstanding': {
      const outstanding = entries.filter(
        (entry) => entry.kind === 'promise' && entry.resolved === false
      );
      return build(
        `${outstanding.length} recorded ${were(outstanding.length, 'promise has nothing recorded as having come of it', 'promises have nothing recorded as having come of them')}.`,
        outstanding
      );
    }

    case 'what_changed_recently': {
      const thirtyDaysAgo = Date.parse(now) - 30 * DAY;
      const recent = entries.filter((entry) => Date.parse(entry.occurredAt) >= thirtyDaysAgo);
      return build(
        `${recent.length} ${were(recent.length, 'thing was', 'things were')} recorded in the last thirty days.`,
        recent
      );
    }
  }
}

/** Every question, answered. What the explorer shows. */
export function answerAll(
  data: CrmWorkspaceData,
  organisationId: string,
  now: string,
  role: CrmRole = 'crm_admin'
): MemoryAnswer[] {
  return MEMORY_QUESTIONS.map((entry) =>
    answerMemoryQuestion(data, organisationId, entry.kind, now, role)
  );
}

/* ===================================================== search */

export interface MemoryHit {
  entry: MemoryEntry;
  organisationName: string;
  /** The words that matched, for the person to see why this is here. */
  matched: string;
}

export interface MemorySearchResult {
  query: string;
  hits: MemoryHit[];
  /** How many organisations the search covered. */
  searched: number;
  note: string;
}

export const SEARCH_NOTE =
  'Searching what is recorded, not what a model remembers. Every result opens the record it came from, and anything your role may not see is not searched in the first place.';

/**
 * Search memory across the workspace.
 *
 * The role is applied in the SEARCH, not in the rendering. Filtering an answer
 * after it has been assembled is how a restricted field reaches somebody
 * through a snippet, and when a model is eventually wired in behind this it is
 * the difference between a control and a hope.
 */
export function searchMemory(
  data: CrmWorkspaceData,
  query: string,
  role: CrmRole = 'crm_admin',
  limit = 40
): MemorySearchResult {
  const needle = query.trim().toLowerCase();
  const index = indexFor(data);

  if (needle.length < 2) {
    return { query, hits: [], searched: 0, note: SEARCH_NOTE };
  }

  const hits: MemoryHit[] = [];
  const bucket = memoryIndexFor(data, role);

  for (const organisation of index.liveOrganisations) {
    for (const entry of bucket.get(organisation.id) ?? []) {
      const haystack = `${entry.statement} ${entry.who ?? ''}`.toLowerCase();
      if (!haystack.includes(needle)) continue;

      const at = entry.statement.toLowerCase().indexOf(needle);
      hits.push({
        entry,
        organisationName: organisation.name,
        // Where the match was on the name rather than in the statement, the
        // statement is shown from the start instead of from a negative offset.
        matched:
          at === -1
            ? entry.statement.slice(0, 80)
            : entry.statement.slice(Math.max(0, at - 30), at + needle.length + 50),
      });
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  return {
    query,
    hits: hits.sort((a, b) => Date.parse(b.entry.occurredAt) - Date.parse(a.entry.occurredAt)),
    searched: index.liveOrganisations.length,
    note: SEARCH_NOTE,
  };
}

/* ===================================================== the graph */

export interface MemoryLink {
  from: MemorySource;
  to: MemorySource;
  relation: 'fulfilled_by' | 'led_to' | 'about';
  /** Why this link exists. Never a guess. */
  because: string;
}

/**
 * The links that already exist in the records.
 *
 * Deliberately narrow. The useful views are "this promise and what fulfilled
 * it" and "this decision and what it changed"; a graph of every record at
 * depth five is a hairball that answers nothing, so there is no depth
 * parameter and no traversal.
 */
export function memoryLinks(
  data: CrmWorkspaceData,
  organisationId: string,
  role: CrmRole = 'crm_admin'
): MemoryLink[] {
  const links: MemoryLink[] = [];

  for (const entry of memoryFor(data, organisationId, role)) {
    if (entry.resolvedBy) {
      links.push({
        from: entry.source,
        to: entry.resolvedBy,
        relation: 'fulfilled_by',
        because: 'The record was closed, and this is the conversation it was closed in.',
      });
    }
  }

  for (const commitment of data.commitments) {
    if (commitment.deletedAt !== null) continue;
    if (commitment.organisationId !== organisationId) continue;
    if (commitment.activityId === null) continue;

    links.push({
      from: { table: 'crm_activities', id: commitment.activityId, what: 'the conversation' },
      to: { table: 'crm_commitments', id: commitment.id, what: 'the promise made in it' },
      relation: 'led_to',
      because: 'The commitment names the conversation it was made in.',
    });
  }

  return links;
}

/**
 * What the explorer's picker needs about an organisation, and nothing else.
 *
 * The whole organisation record carries three owner columns. Phase 2A-i
 * established the rule and the reason: a user id that leaves a module is a
 * user id a later page can group by, and a page that groups relationship work
 * by the person who owns the account is a league table of staff. So the picker
 * gets the id, the name and the count.
 */
export interface MemoryPickerEntry {
  organisationId: string;
  name: string;
  entries: number;
}

/** Organisations with anything worth remembering, for the explorer's picker. */
export function organisationsWithMemory(
  data: CrmWorkspaceData,
  role: CrmRole = 'crm_admin'
): MemoryPickerEntry[] {
  const bucket = memoryIndexFor(data, role);
  return indexFor(data)
    .liveOrganisations.map((organisation) => ({
      organisationId: organisation.id,
      name: organisation.name,
      entries: (bucket.get(organisation.id) ?? []).length,
    }))
    .sort((a, b) =>
      b.entries === a.entries ? a.name.localeCompare(b.name, 'en-AU') : b.entries - a.entries
    );
}
