/**
 * The data-quality dashboard.
 *
 * Ten indicators, named in the brief, computed here.
 *
 * Two decisions run through all of them.
 *
 * FIRST: AN INDICATOR IS A LIST, NOT A NUMBER. Every indicator carries the
 * records it counted, so "14 duplicate candidates" is a link to fourteen pairs
 * rather than a figure somebody has to go and find. A dashboard of numbers with
 * no route into the work is a dashboard people read once.
 *
 * SECOND: ZERO IS AMBIGUOUS AND MUST SAY WHICH ZERO IT IS. "0 failed
 * integrations" reads as healthy. In this release it means nothing is
 * connected, so nothing can fail, which is a different fact and the one worth
 * knowing. Every indicator therefore carries a `state`:
 *
 *   - `clear`         nothing to do, and the thing being measured is live
 *   - `nothing_to_measure`  the zero is because there is nothing there yet
 *   - `attention`     there is something to look at
 *
 * The third state exists because the honest answer to half of these questions
 * in a pre-revenue product is "not applicable yet", and painting that green is
 * how a dashboard trains people to ignore it.
 *
 * NO OWNER COLUMN, AGAIN. Indicator nine names the person responsible for
 * keeping a record good, because somebody has to be. It does not count issues
 * per person, it is not sortable by person, and there is no function here that
 * returns a number per user. The one aggregate that touches people is
 * "organisations with nobody named", which counts records, not people.
 */

import { CrmWorkspaceData } from '../domain';
import { lastMeaningfulContactWith } from '../stage4/relationships';
import { indexFor } from './paging';
import { INTEGRATION_REGISTER } from './registers';

export type IndicatorState = 'clear' | 'nothing_to_measure' | 'attention';

export interface IndicatorSubject {
  table: string;
  id: string;
  name: string;
  /** What is wrong with this one, in a sentence naming the field. */
  detail: string;
  /** Where to go to fix it. */
  path: string | null;
}

export interface Indicator {
  key: IndicatorKey;
  label: string;
  /** The number the dashboard shows. */
  count: number;
  /**
   * Whether `count` is a number of records or a percentage. It matters for
   * more than rendering: on a count, higher is worse, and on a percentage
   * here, higher is better. The state is computed from the records needing
   * attention rather than from `count`, so a coverage of 100 per cent reads
   * as clear instead of as a hundred problems.
   */
  unit: 'count' | 'percent';
  /** The denominator, where one makes the number mean anything. */
  outOf: number | null;
  state: IndicatorState;
  /** What this counts, in one sentence. */
  meaning: string;
  /** What to do about it, in one sentence. Never blank. */
  whatToDo: string;
  subjects: IndicatorSubject[];
  /** Set only where the count is zero for a reason worth naming. */
  zeroBecause: string | null;
}

export type IndicatorKey =
  | 'duplicate_candidates'
  | 'stale_records'
  | 'missing_next_steps'
  | 'unconfirmed_ai_fields'
  | 'conflicting_values'
  | 'unlinked_activities'
  | 'consent_gaps'
  | 'source_coverage'
  | 'failed_integrations'
  | 'quality_owner';

export const INDICATOR_ORDER: IndicatorKey[] = [
  'duplicate_candidates',
  'stale_records',
  'missing_next_steps',
  'unconfirmed_ai_fields',
  'conflicting_values',
  'unlinked_activities',
  'consent_gaps',
  'source_coverage',
  'failed_integrations',
  'quality_owner',
];

/** The dashboard's own note, shown above the indicators. */
export const DASHBOARD_NOTE =
  'These are counts of records, never of people. Nothing on this page is ' +
  'grouped by who entered a record or who owns it, because a data-quality ' +
  'page that can be sorted by person stops being about data.';

const DAY = 86_400_000;

function days(from: string, to: string): number {
  return (new Date(to).getTime() - new Date(from).getTime()) / DAY;
}

function personName(data: CrmWorkspaceData, id: string): string {
  const person = indexFor(data).peopleById.get(id);
  if (!person) return 'A contact that no longer exists';
  return person.fullName;
}

function organisationName(data: CrmWorkspaceData, id: string | null): string {
  if (id === null) return 'No organisation recorded';
  return indexFor(data).organisationsById.get(id)?.name ?? 'An organisation that no longer exists';
}

/** Trim a long list for the dashboard, keeping the count honest. */
function sample(subjects: IndicatorSubject[], limit = 12): IndicatorSubject[] {
  return subjects.slice(0, limit);
}

function build(
  key: IndicatorKey,
  label: string,
  subjects: IndicatorSubject[],
  opts: {
    outOf?: number | null;
    meaning: string;
    whatToDo: string;
    /** Why a zero here is "nothing to measure" rather than "clear". */
    nothingToMeasure?: string | null;
    count?: number;
    unit?: 'count' | 'percent';
  }
): Indicator {
  const count = opts.count ?? subjects.length;
  // The state comes from the subjects, never from `count`. On a percentage
  // indicator those are different questions, and reading the state off the
  // number is how 100 per cent coverage would be reported as a problem.
  const state: IndicatorState =
    subjects.length > 0 ? 'attention' : opts.nothingToMeasure ? 'nothing_to_measure' : 'clear';

  return {
    key,
    label,
    count,
    unit: opts.unit ?? 'count',
    outOf: opts.outOf ?? null,
    state,
    meaning: opts.meaning,
    whatToDo: opts.whatToDo,
    subjects: sample(subjects),
    zeroBecause: count === 0 ? (opts.nothingToMeasure ?? null) : null,
  };
}

/* ---------------------------------------------------------------- 1 */

function duplicateCandidates(data: CrmWorkspaceData): Indicator {
  const index = indexFor(data);
  const open = data.duplicateCandidates.filter((candidate) => candidate.state === 'open');

  const subjects: IndicatorSubject[] = open.map((candidate) => {
    const naming =
      candidate.subjectTable === 'crm_people'
        ? `${personName(data, candidate.leftId)} and ${personName(data, candidate.rightId)}`
        : `${organisationName(data, candidate.leftId)} and ${organisationName(data, candidate.rightId)}`;

    return {
      table: candidate.subjectTable,
      id: candidate.id,
      name: naming,
      detail:
        candidate.matchingFields.length > 0
          ? `Same ${candidate.matchingFields.join(', ')}. Different ${
              candidate.differingFields.length > 0 ? candidate.differingFields.join(', ') : 'nothing recorded'
            }. ${candidate.reason}`
          : candidate.reason,
      path: '/crm/data-quality',
    };
  });

  return build('duplicate_candidates', 'Possible duplicates', subjects, {
    outOf: index.livePeople.length,
    meaning:
      'Pairs of records that might be the same contact or organisation. Concludo shows what matches and what differs so a person can judge.',
    whatToDo:
      'Open each pair, and either merge it or mark it as separate. Nothing merges on its own, including an exact match.',
    nothingToMeasure: open.length === 0 && data.people.length === 0 ? 'There are no contacts yet.' : null,
  });
}

/* ---------------------------------------------------------------- 2 */

function staleRecords(data: CrmWorkspaceData, now: string, staleAfterDays: number): Indicator {
  const live = indexFor(data).liveOrganisations;

  // The people for an organisation come from the index rather than from a
  // filter over every person. The filter was a pass over the whole contact
  // table per organisation, which at ten thousand of each is a hundred million
  // comparisons to draw one page.
  const index = indexFor(data);

  const subjects: IndicatorSubject[] = [];
  for (const organisation of live) {
    if (organisation.lifecycleState === 'closed') continue;

    const people = index.peopleByOrganisation.get(organisation.id) ?? [];
    const contacts = people
      .map((person) => lastMeaningfulContactWith(data, person.id))
      .filter((at): at is string => at !== null)
      .sort();
    const last = contacts.at(-1) ?? null;

    if (last === null) {
      subjects.push({
        table: 'crm_organisations',
        id: organisation.id,
        name: organisation.name,
        detail:
          people.length === 0
            ? 'No contact recorded, and nobody is recorded at this organisation.'
            : 'No meaningful contact has ever been recorded with anybody here.',
        path: `/crm/organisations/${organisation.id}`,
      });
      continue;
    }

    const age = Math.floor(days(last, now));
    if (age >= staleAfterDays) {
      subjects.push({
        table: 'crm_organisations',
        id: organisation.id,
        name: organisation.name,
        detail: `Last meaningful contact was ${age} days ago. Still recorded as ${organisation.lifecycleState}.`,
        path: `/crm/organisations/${organisation.id}`,
      });
    }
  }

  return build('stale_records', 'Records nothing has happened on', subjects, {
    outOf: live.length,
    meaning: `Organisations with no meaningful contact in ${staleAfterDays} days, which are not recorded as closed. Internal activity does not count as contact.`,
    whatToDo:
      'Decide for each one. Either it is still a customer and needs a next step, or it is not and should say so.',
    nothingToMeasure: live.length === 0 ? 'There are no organisations yet.' : null,
  });
}

/* ---------------------------------------------------------------- 3 */

function missingNextSteps(data: CrmWorkspaceData): Indicator {
  const open = indexFor(data).openWorkItems;

  const subjects: IndicatorSubject[] = open
    .filter((item) => item.nextStep === null || item.nextStep.trim() === '' || item.nextStepDue === null)
    .map((item) => ({
      table: 'crm_work_items',
      id: item.id,
      name: item.title,
      detail:
        item.nextStep === null || item.nextStep.trim() === ''
          ? 'No next step recorded.'
          : 'A next step is recorded with no date, so nothing will ever flag it as late.',
      path: `/crm/work/${item.id}`,
    }));

  return build('missing_next_steps', 'Open work with no next step', subjects, {
    outOf: open.length,
    meaning:
      'Work that is open with nothing recorded as the next action, or with an action and no date. Both are how work goes quiet.',
    whatToDo: 'Add the next step and the date it is due. Where neither is known, that is the next step.',
    nothingToMeasure: open.length === 0 ? 'There is no open work.' : null,
  });
}

/* ---------------------------------------------------------------- 4 */

function unconfirmedAiFields(data: CrmWorkspaceData): Indicator {
  // A field is "AI" here if a model produced it: modelVersion is set. A field a
  // person typed is not unconfirmed, it is entered.
  const fromModel = data.evidence.filter(
    (item) =>
      item.deletedAt === null &&
      item.modelVersion !== null &&
      item.supersededById === null
  );
  const unconfirmed = fromModel.filter((item) => item.confirmedBy === null);

  const subjects: IndicatorSubject[] = unconfirmed.map((item) => ({
    table: item.subjectTable,
    id: item.subjectId,
    name:
      item.subjectTable === 'crm_people'
        ? personName(data, item.subjectId)
        : item.subjectTable === 'crm_organisations'
          ? organisationName(data, item.subjectId)
          : (data.workItems.find((w) => w.id === item.subjectId)?.title ?? item.subjectId),
    detail: `${item.fieldName} reads "${item.assertedValue ?? 'nothing'}", proposed by ${item.modelVersion} at ${item.confidence} confidence, and nobody has confirmed it.`,
    path: '/crm/data-quality',
  }));

  return build('unconfirmed_ai_fields', 'Fields a model filled that nobody confirmed', subjects, {
    outOf: fromModel.length,
    meaning:
      'Values produced by a model and not yet confirmed by a person. They are shown everywhere as unconfirmed, and they are never counted as fact.',
    whatToDo:
      'Open each one against its source and either confirm it or correct it. Confirming is one click and it records who confirmed.',
    nothingToMeasure:
      fromModel.length === 0 ? 'No model has proposed a field value in this workspace.' : null,
  });
}

/* ---------------------------------------------------------------- 5 */

function conflictingValues(data: CrmWorkspaceData): Indicator {
  // 'open' is the unresolved state. 'resolved_kept' and 'resolved_superseded'
  // are conflicts somebody has already decided, and counting those as
  // outstanding would mean the number never comes down.
  const conflicting = data.evidence.filter(
    (item) => item.deletedAt === null && item.conflictState === 'open'
  );

  // Two assertions about one field are one conflict, not two.
  const seen = new Set<string>();
  const subjects: IndicatorSubject[] = [];
  for (const item of conflicting) {
    const key = `${item.subjectTable}:${item.subjectId}:${item.fieldName}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const others = conflicting.filter(
      (other) =>
        other.id !== item.id &&
        other.subjectTable === item.subjectTable &&
        other.subjectId === item.subjectId &&
        other.fieldName === item.fieldName
    );

    subjects.push({
      table: item.subjectTable,
      id: item.subjectId,
      name:
        item.subjectTable === 'crm_people'
          ? personName(data, item.subjectId)
          : item.subjectTable === 'crm_organisations'
            ? organisationName(data, item.subjectId)
            : (data.workItems.find((w) => w.id === item.subjectId)?.title ?? item.subjectId),
      detail: `${item.fieldName} has ${others.length + 1} values recorded: ${[item, ...others]
        .map((e) => `"${e.assertedValue ?? 'nothing'}" (${e.sourceType.replace(/_/g, ' ')})`)
        .join(' and ')}. ${item.conflictNote ?? 'Neither has been chosen.'}`,
      path: '/crm/data-quality',
    });
  }

  return build('conflicting_values', 'Fields with two answers', subjects, {
    outOf: null,
    meaning:
      'Where two sources disagree about the same field. Concludo shows both rather than picking one, because picking one silently is how the wrong value becomes the record.',
    whatToDo: 'Open each conflict, read both sources, and choose. The one not chosen stays as history.',
    nothingToMeasure: conflicting.length === 0 ? 'Nothing recorded has two answers.' : null,
  });
}

/* ---------------------------------------------------------------- 6 */

function unlinkedActivities(data: CrmWorkspaceData): Indicator {
  const index = indexFor(data);
  const live = index.liveActivities;

  const subjects: IndicatorSubject[] = live
    .filter((activity) => {
      if (activity.organisationId !== null || activity.workItemId !== null) return false;
      // A conversation with a named participant is attached to somebody, even
      // with no organisation on it. The gap that matters is the one attached to
      // nothing at all. Read from the index, because the filter it replaces
      // was a pass over the participant table per activity.
      return (index.participantsByActivity.get(activity.id) ?? []).length === 0;
    })
    .map((activity) => ({
      table: 'crm_activities',
      id: activity.id,
      name: activity.title,
      detail: `A ${activity.activityType.replace(/_/g, ' ')} on ${activity.occurredAt.slice(0, 10)} attached to no organisation, no work and no contact.`,
      path: '/crm/activities',
    }));

  return build('unlinked_activities', 'Conversations attached to nothing', subjects, {
    outOf: live.length,
    meaning:
      'Recorded conversations that are not linked to an organisation, a piece of work or a named contact, so they appear on nobody\'s history.',
    whatToDo:
      'Attach each one. Where two accounts are plausible, Concludo will not guess, so this is a decision rather than a confirmation.',
    nothingToMeasure: live.length === 0 ? 'No activity has been recorded yet.' : null,
  });
}

/* ---------------------------------------------------------------- 7 */

function consentGaps(data: CrmWorkspaceData, now: string): Indicator {
  const index = indexFor(data);
  const live = index.livePeople;

  const subjects: IndicatorSubject[] = [];
  for (const person of live) {
    const records = index.consentByPerson.get(person.id) ?? [];
    const contact = records.filter((record) => record.consentType === 'contact');

    const active = contact.filter(
      (record) =>
        record.withdrawnAt === null &&
        (record.expiresAt === null || Date.parse(record.expiresAt) > Date.parse(now))
    );

    if (contact.length === 0) {
      subjects.push({
        table: 'crm_people',
        id: person.id,
        name: person.fullName,
        detail: 'No basis for contact is recorded at all.',
        path: `/crm/people/${person.id}`,
      });
      continue;
    }

    if (active.length === 0) {
      const withdrawn = contact.find((record) => record.withdrawnAt !== null);
      subjects.push({
        table: 'crm_people',
        id: person.id,
        name: person.fullName,
        detail: withdrawn
          ? `Consent to contact was withdrawn on ${withdrawn.withdrawnAt?.slice(0, 10)}. Nothing may be sent.`
          : 'Every recorded basis for contact has expired.',
        path: `/crm/people/${person.id}`,
      });
      continue;
    }

    const notObtained = active.find((record) => record.basis === 'not_obtained');
    if (notObtained) {
      subjects.push({
        table: 'crm_people',
        id: person.id,
        name: person.fullName,
        detail: 'A contact record exists with the basis recorded as not obtained.',
        path: `/crm/people/${person.id}`,
      });
    }
  }

  return build('consent_gaps', 'Contacts with no basis to contact them', subjects, {
    outOf: live.length,
    meaning:
      'People with no recorded basis for contact, an expired one, or a withdrawal. Concludo blocks a draft to any of them before it is addressed.',
    whatToDo:
      'Record where the basis came from, or mark the person as not to be contacted. Guessing a basis is worse than recording none.',
    nothingToMeasure: live.length === 0 ? 'There are no contacts yet.' : null,
  });
}

/* ---------------------------------------------------------------- 8 */

function sourceCoverage(data: CrmWorkspaceData): Indicator {
  // Coverage is the share of asserted field values that can be traced back to
  // something. An untraceable value is not wrong; it is unprovable, which is a
  // different problem and the one that bites during a dispute.
  const live = data.evidence.filter((item) => item.deletedAt === null && item.supersededById === null);
  const traceable = live.filter(
    (item) =>
      item.sourceRecordId !== null || (item.sourceText !== null && item.sourceText.trim() !== '')
  );
  const untraceable = live.filter((item) => !traceable.includes(item));

  const subjects: IndicatorSubject[] = untraceable.map((item) => ({
    table: item.subjectTable,
    id: item.subjectId,
    name:
      item.subjectTable === 'crm_people'
        ? personName(data, item.subjectId)
        : item.subjectTable === 'crm_organisations'
          ? organisationName(data, item.subjectId)
          : (data.workItems.find((w) => w.id === item.subjectId)?.title ?? item.subjectId),
    detail: `${item.fieldName} has no source record and no source text, so there is no way to check where it came from.`,
    path: '/crm/data-quality',
  }));

  const percent = live.length === 0 ? 0 : Math.round((traceable.length / live.length) * 100);

  return build('source_coverage', 'Values that can be traced to a source', subjects, {
    outOf: live.length,
    count: percent,
    unit: 'percent',
    meaning: `Per cent of recorded field values with a source behind them. ${traceable.length} of ${live.length} can be traced.`,
    whatToDo:
      'For the untraceable ones, add the source or re-enter the value from one. A value with no source cannot be defended.',
    nothingToMeasure: live.length === 0 ? 'No field values have been recorded with evidence yet.' : null,
  });
}

/* ---------------------------------------------------------------- 9 */

function failedIntegrations(data: CrmWorkspaceData, now: string): Indicator {
  const connections = data.integrationConnections;

  const subjects: IndicatorSubject[] = [];
  for (const connection of connections) {
    const entry = INTEGRATION_REGISTER.find((item) => item.id === connection.integrationId);
    const name = entry?.name ?? connection.integrationId;

    if (connection.lastOutcome === 'failed' || connection.lastOutcome === 'partial') {
      subjects.push({
        table: 'crm_integration_connections',
        id: connection.id,
        name,
        detail: `${connection.lastOutcome === 'partial' ? 'Partly synced' : 'Failed'} at ${connection.lastAttemptAt?.slice(0, 16).replace('T', ' ') ?? 'an unrecorded time'}. ${connection.failureDetail ?? 'No detail recorded.'} ${
          connection.nextRetryAt
            ? `Next attempt ${connection.nextRetryAt.slice(0, 16).replace('T', ' ')}.`
            : 'No retry is scheduled, so this will not fix itself.'
        }`,
        path: '/crm/settings',
      });
      continue;
    }

    if (connection.state === 'expired' || connection.state === 'revoked') {
      subjects.push({
        table: 'crm_integration_connections',
        id: connection.id,
        name,
        detail: `Permission has been ${connection.state}. Nothing is syncing, and nothing will until somebody reconnects it.`,
        path: '/crm/settings',
      });
      continue;
    }

    // A connection that has not run in a week is not failing, but it is not
    // working either, and silence is the failure mode people miss.
    if (
      connection.state === 'connected' &&
      connection.lastAttemptAt !== null &&
      days(connection.lastAttemptAt, now) > 7
    ) {
      subjects.push({
        table: 'crm_integration_connections',
        id: connection.id,
        name,
        detail: `Connected, last attempted ${Math.floor(days(connection.lastAttemptAt, now))} days ago. Nothing has failed and nothing has run.`,
        path: '/crm/settings',
      });
    }
  }

  const liveConnections = connections.filter((connection) => connection.state === 'connected');

  return build('failed_integrations', 'Connections not bringing anything in', subjects, {
    outOf: connections.length,
    meaning:
      'Connections that failed, lost permission, or have gone quiet. A failure with no scheduled retry is named as such, because a failure that looks handled is worse than one that looks broken.',
    whatToDo:
      'Reconnect or fix each one. Where a permission has expired, the person who granted it has to grant it again.',
    nothingToMeasure:
      liveConnections.length === 0
        ? 'Nothing is connected in this release, so nothing can fail. This is a zero because there is nothing there, not because everything is working.'
        : null,
  });
}

/* --------------------------------------------------------------- 10 */

function qualityOwner(data: CrmWorkspaceData): Indicator {
  const live = indexFor(data).liveOrganisations;
  const unowned = live.filter((o) => o.dataQualityOwnerUserId === null);

  const subjects: IndicatorSubject[] = unowned.map((organisation) => ({
    table: 'crm_organisations',
    id: organisation.id,
    name: organisation.name,
    detail: 'Nobody is named as responsible for keeping this record good.',
    path: `/crm/organisations/${organisation.id}`,
  }));

  return build('quality_owner', 'Records with nobody named for data quality', subjects, {
    outOf: live.length,
    meaning:
      'Organisations with no named data-quality owner. This is responsibility for a record, and it is never used to count anything against the person named.',
    whatToDo: 'Name somebody on each one. In a one-person business that is the one person, recorded once.',
    nothingToMeasure: live.length === 0 ? 'There are no organisations yet.' : null,
  });
}

/* ---------------------------------------------------------------- */

export interface DataQualityDashboard {
  workspaceId: string;
  generatedAt: string;
  indicators: Indicator[];
  /** How many indicators have something to look at. */
  needingAttention: number;
  /** How many are zero because there is nothing there yet. */
  nothingToMeasure: number;
  note: string;
  /** Who is named for data quality anywhere in this workspace. */
  namedOwners: { userId: string; recordCount: number }[];
}

/**
 * `namedOwners` is the one place a person appears with a number beside them,
 * and the number is how many records name them, which is a count of
 * responsibility assigned rather than of work done, errors made, or anything
 * else about the person. It exists so somebody can see that one person has been
 * made responsible for four hundred records, which is a staffing fact.
 */
export function buildDataQualityDashboard(
  data: CrmWorkspaceData,
  now: string,
  staleAfterDays = 90
): DataQualityDashboard {
  const indicators: Indicator[] = [
    duplicateCandidates(data),
    staleRecords(data, now, staleAfterDays),
    missingNextSteps(data),
    unconfirmedAiFields(data),
    conflictingValues(data),
    unlinkedActivities(data),
    consentGaps(data, now),
    sourceCoverage(data),
    failedIntegrations(data, now),
    qualityOwner(data),
  ];

  const owners = new Map<string, number>();
  for (const organisation of data.organisations) {
    if (organisation.deletedAt !== null) continue;
    const owner = organisation.dataQualityOwnerUserId;
    if (owner === null) continue;
    owners.set(owner, (owners.get(owner) ?? 0) + 1);
  }

  return {
    workspaceId: data.workspace.id,
    generatedAt: now,
    indicators,
    needingAttention: indicators.filter((indicator) => indicator.state === 'attention').length,
    nothingToMeasure: indicators.filter((indicator) => indicator.state === 'nothing_to_measure').length,
    note: DASHBOARD_NOTE,
    namedOwners: [...owners.entries()]
      .map(([userId, recordCount]) => ({ userId, recordCount }))
      .sort((a, b) => a.userId.localeCompare(b.userId)),
  };
}

/** One indicator by key, for a page that shows a single list. */
export function indicator(
  data: CrmWorkspaceData,
  key: IndicatorKey,
  now: string
): Indicator | null {
  return buildDataQualityDashboard(data, now).indicators.find((item) => item.key === key) ?? null;
}
