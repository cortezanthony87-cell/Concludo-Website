/**
 * The seven record-level indicators, and why they are written this way.
 *
 * The brief asks for them to be NEUTRAL. That word is doing real work, and it
 * is easy to satisfy in the type and break in the copy. These rules hold:
 *
 *   The indicator describes the RECORD, never the person who owns it. There is
 *   no owner on a flag, no count by owner anywhere in this file, and no
 *   function here takes a user id. A chart of "flags by owner" cannot be built
 *   from this module without writing new code, which is the point: that is a
 *   decision somebody has to make deliberately, not one that falls out of a
 *   convenient shape.
 *
 *   The words are descriptive, not evaluative. "Unconfirmed" and "Stale" say
 *   what is true of the record. "Poor", "incomplete", "neglected" and "at risk"
 *   say what somebody should feel about it, and one of them is one step from
 *   saying it about the person.
 *
 *   Every flag names what would resolve it. An indicator a person cannot act on
 *   is an accusation.
 *
 * Nothing here is a score. There is no total, no grade and no ranking, and the
 * summary counts RECORDS in each condition rather than producing a number per
 * record. That is the same line Stage 3 drew in `recordQuality.ts` and in
 * `crm_record_quality`, held in the interface layer too.
 */
import {
  CrmWorkspaceData,
  DuplicateCandidate,
  Evidence,
  Organisation,
  Person,
  WorkItem,
} from '../domain';
import { sourceTrail } from './sources';
import { onWriteInvalidate } from '../cacheBus';

export type QualityFlagKind =
  | 'missing'
  | 'unconfirmed'
  | 'stale'
  | 'conflicting'
  | 'duplicate_candidate'
  | 'source_unavailable'
  | 'review_recommended';

export interface QualityFlag {
  kind: QualityFlagKind;
  /** The neutral label, as the interface shows it. */
  label: string;
  /** What exactly, in a sentence somebody can act on. */
  detail: string;
  /** What would clear it. Never blank. */
  resolution: string;
  subjectTable: string;
  subjectId: string;
}

export const QUALITY_LABELS: Record<QualityFlagKind, string> = {
  missing: 'Missing',
  unconfirmed: 'Unconfirmed',
  stale: 'Stale',
  conflicting: 'Conflicting',
  duplicate_candidate: 'Possible duplicate',
  source_unavailable: 'Source unavailable',
  review_recommended: 'Review recommended',
};

/** The order the interface lists them in. Not a severity ranking. */
export const QUALITY_ORDER: QualityFlagKind[] = [
  'conflicting',
  'duplicate_candidate',
  'missing',
  'unconfirmed',
  'source_unavailable',
  'stale',
  'review_recommended',
];

const DAY = 86_400_000;

function daysSince(iso: string, now: string): number {
  return Math.floor((new Date(now).getTime() - new Date(iso).getTime()) / DAY);
}

/* ------------------------------------------------- the lookups, built once
 *
 * Added in Stage 8, for one reason: measured at a thousand people, two
 * thousand activities and five hundred participants, `workspaceFlags` took ten
 * seconds. Not because any single check is expensive, but because each of them
 * scanned a whole collection and there were four of them per record. A
 * thousand records times four scans is the shape that makes a product feel
 * slow at size while every individual function looks reasonable in review.
 *
 * The fix is a pass per collection instead of a pass per record. The lookups
 * are cached against the dataset object in a WeakMap, and dropped on every
 * write through `onWriteInvalidate` at the bottom of this file, because the
 * session store mutates one workspace in place rather than replacing it.
 *
 * The flags this produces are byte for byte the ones it produced before, and
 * the Stage 4 suite is what says so.
 */

interface QualityIndex {
  latestByPerson: Map<string, string>;
  latestByOrganisation: Map<string, string>;
  latestByWorkItem: Map<string, string>;
  evidenceBySubject: Map<string, Evidence[]>;
  evidenceById: Map<string, Evidence>;
  duplicatesBySubject: Map<string, DuplicateCandidate[]>;
  consentCountByPerson: Map<string, number>;
}

const indexes = new WeakMap<CrmWorkspaceData, QualityIndex>();

function laterOf(a: string | undefined, b: string): string {
  if (a === undefined) return b;
  // Parsed rather than compared as text: timestamps in this product carry a
  // zone offset in some places and a Z in others, and '…T23:00Z' sorts below
  // '…T09:00+11:00' as text while being two hours later in fact.
  return Date.parse(b) > Date.parse(a) ? b : a;
}

function qualityIndex(data: CrmWorkspaceData): QualityIndex {
  const cached = indexes.get(data);
  if (cached) return cached;

  const index: QualityIndex = {
    latestByPerson: new Map(),
    latestByOrganisation: new Map(),
    latestByWorkItem: new Map(),
    evidenceBySubject: new Map(),
    evidenceById: new Map(),
    duplicatesBySubject: new Map(),
    consentCountByPerson: new Map(),
  };

  const peopleByActivity = new Map<string, string[]>();
  for (const participant of data.activityParticipants) {
    if (participant.personId === null) continue;
    const existing = peopleByActivity.get(participant.activityId);
    if (existing) existing.push(participant.personId);
    else peopleByActivity.set(participant.activityId, [participant.personId]);
  }

  for (const activity of data.activities) {
    if (activity.deletedAt !== null) continue;

    if (activity.organisationId !== null) {
      index.latestByOrganisation.set(
        activity.organisationId,
        laterOf(index.latestByOrganisation.get(activity.organisationId), activity.occurredAt)
      );
    }
    if (activity.workItemId !== null) {
      index.latestByWorkItem.set(
        activity.workItemId,
        laterOf(index.latestByWorkItem.get(activity.workItemId), activity.occurredAt)
      );
    }
    for (const personId of peopleByActivity.get(activity.id) ?? []) {
      index.latestByPerson.set(
        personId,
        laterOf(index.latestByPerson.get(personId), activity.occurredAt)
      );
    }
  }

  for (const e of data.evidence) {
    index.evidenceById.set(e.id, e);
    if (e.deletedAt !== null || e.supersededAt !== null) continue;
    const key = `${e.subjectTable}:${e.subjectId}`;
    const existing = index.evidenceBySubject.get(key);
    if (existing) existing.push(e);
    else index.evidenceBySubject.set(key, [e]);
  }

  for (const candidate of data.duplicateCandidates) {
    if (candidate.state !== 'open') continue;
    for (const id of [candidate.leftId, candidate.rightId]) {
      const existing = index.duplicatesBySubject.get(id);
      if (existing) existing.push(candidate);
      else index.duplicatesBySubject.set(id, [candidate]);
    }
  }

  for (const record of data.consentRecords) {
    index.consentCountByPerson.set(
      record.personId,
      (index.consentCountByPerson.get(record.personId) ?? 0) + 1
    );
  }

  indexes.set(data, index);
  return index;
}

/** Drops the cached lookups, for a caller that mutates a dataset in place. */
export function forgetQualityIndex(data: CrmWorkspaceData): void {
  indexes.delete(data);
}

/** The assertions about one record that are still current. */
function evidenceFor(data: CrmWorkspaceData, table: string, id: string): Evidence[] {
  return qualityIndex(data).evidenceBySubject.get(`${table}:${id}`) ?? [];
}

function duplicatesFor(data: CrmWorkspaceData, id: string): DuplicateCandidate[] {
  return qualityIndex(data).duplicatesBySubject.get(id) ?? [];
}

/**
 * The flags shared by every kind of record: the evidence-shaped ones.
 *
 * Stale is 90 days by default, and the number is an argument rather than a
 * constant because what counts as stale is a property of the business, not of
 * the software. A bookkeeper sees a client quarterly and a key-account team
 * sees one weekly; one threshold for both would make the indicator noise for
 * one of them.
 */
function sharedFlags(
  data: CrmWorkspaceData,
  table: string,
  id: string,
  lastTouched: string | null,
  now: string,
  staleAfterDays: number
): QualityFlag[] {
  const flags: QualityFlag[] = [];
  const evidence = evidenceFor(data, table, id);

  for (const e of evidence.filter((x) => x.conflictState === 'open')) {
    const other = e.conflictsWithId === null ? undefined : qualityIndex(data).evidenceById.get(e.conflictsWithId);
    flags.push({
      kind: 'conflicting',
      label: QUALITY_LABELS.conflicting,
      detail:
        other && other.assertedValue !== e.assertedValue
          ? `Two recorded values for ${e.fieldName}: ${e.assertedValue ?? 'nothing'} and ${other.assertedValue ?? 'nothing'}.`
          : `Two recorded values for ${e.fieldName}, and neither has been withdrawn.`,
      resolution: 'Open both sources and keep the one that is right.',
      subjectTable: table,
      subjectId: id,
    });
  }

  // An inferred value nobody has confirmed. Not wrong, not yet checked, and the
  // difference matters most on the values somebody will quote back to a client.
  for (const e of evidence.filter((x) => x.basis === 'inferred' && x.confirmedAt === null)) {
    flags.push({
      kind: 'unconfirmed',
      label: QUALITY_LABELS.unconfirmed,
      detail: `${e.fieldName} was worked out rather than stated, and nobody has confirmed it.`,
      resolution: 'Check it against the source and confirm it, or correct it.',
      subjectTable: table,
      subjectId: id,
    });
  }

  /* Source unavailable.
   *
   * This started as "no source was recorded", which turned out to be
   * unreachable: Stage 3's own validation refuses a stated, inferred or
   * calculated value that names no source, and the database enforces it. An
   * indicator that can never fire is worse than none, because it looks like
   * coverage.
   *
   * The real condition is narrower and more useful: the value IS sourced, and
   * the source cannot be opened from here. That happens two ways. The source
   * record was removed, leaving a dangling reference. Or the only pointer is a
   * location in something Concludo does not hold, such as a clause in a signed
   * agreement, which is checkable but not by clicking. In both cases the person
   * reading the value needs to know before they quote it. */
  for (const e of evidence) {
    if (e.basis === 'unknown') continue;
    if (e.sourceText !== null) continue;

    const resolves =
      e.sourceRecordId !== null && sourceTrail(data, e).record !== null;
    if (resolves) continue;

    flags.push({
      kind: 'source_unavailable',
      label: QUALITY_LABELS.source_unavailable,
      detail:
        e.sourceRecordId !== null
          ? `${e.fieldName} names a source record that is no longer available.`
          : `${e.fieldName} came from ${e.sourceLocation ?? 'a source'}, which Concludo does not hold and cannot open.`,
      resolution:
        e.sourceRecordId !== null
          ? 'Record the value by hand with a note of where it came from, or re-import the source.'
          : 'Check it against the original, and confirm the value so the next reader does not have to.',
      subjectTable: table,
      subjectId: id,
    });
  }

  for (const c of duplicatesFor(data, id)) {
    flags.push({
      kind: 'duplicate_candidate',
      label: QUALITY_LABELS.duplicate_candidate,
      detail: c.reason,
      resolution:
        c.recommendation === 'likely_separate'
          ? 'Confirm they are separate, so the pair stops being raised.'
          : 'Compare the two and decide. Nothing is merged without a decision.',
      subjectTable: table,
      subjectId: id,
    });
  }

  if (lastTouched === null) {
    flags.push({
      kind: 'stale',
      label: QUALITY_LABELS.stale,
      detail: 'Nothing has ever been recorded against this record.',
      resolution: 'Record the last conversation, or decide it is no longer current.',
      subjectTable: table,
      subjectId: id,
    });
  } else {
    const age = daysSince(lastTouched, now);
    if (age > staleAfterDays) {
      flags.push({
        kind: 'stale',
        label: QUALITY_LABELS.stale,
        detail: `No activity recorded for ${age} days.`,
        resolution: 'Record what has happened since, or close the record.',
        subjectTable: table,
        subjectId: id,
      });
    }
  }

  return flags;
}

export function personFlags(
  data: CrmWorkspaceData,
  person: Person,
  now: string,
  staleAfterDays = 90
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (person.primaryEmail === null && person.phone === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'No contact method is recorded.',
      resolution: 'Add an address or a phone number, if one is known.',
      subjectTable: 'crm_people',
      subjectId: person.id,
    });
  }

  if (person.organisationId === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'No organisation is recorded.',
      resolution: 'Link them to an organisation, or record that they are independent.',
      subjectTable: 'crm_people',
      subjectId: person.id,
    });
  }

  if (person.relationshipOwnerUserId === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'Nobody is recorded as holding this relationship.',
      resolution: 'Record who holds it. This says who is responsible, not how well.',
      subjectTable: 'crm_people',
      subjectId: person.id,
    });
  }

  // Consent is a record with a basis, not a checkbox, and an absent one is a
  // gap worth naming before somebody sends anything.
  const consentCount = qualityIndex(data).consentCountByPerson.get(person.id) ?? 0;
  if (consentCount === 0) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'No consent record of any kind.',
      resolution: 'Record how and when consent was obtained, or that it was not.',
      subjectTable: 'crm_people',
      subjectId: person.id,
    });
  }

  const touched = qualityIndex(data).latestByPerson.get(person.id) ?? null;

  return [...flags, ...sharedFlags(data, 'crm_people', person.id, touched, now, staleAfterDays)];
}

export function organisationFlags(
  data: CrmWorkspaceData,
  organisation: Organisation,
  now: string,
  staleAfterDays = 90
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (organisation.industry === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'No industry is recorded.',
      resolution: 'Record what they do.',
      subjectTable: 'crm_organisations',
      subjectId: organisation.id,
    });
  }

  if (organisation.relationshipOwnerUserId === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'Nobody is recorded as holding this relationship.',
      resolution: 'Record who holds it.',
      subjectTable: 'crm_organisations',
      subjectId: organisation.id,
    });
  }

  const touched = qualityIndex(data).latestByOrganisation.get(organisation.id) ?? null;

  return [
    ...flags,
    ...sharedFlags(data, 'crm_organisations', organisation.id, touched, now, staleAfterDays),
  ];
}

export function workItemFlags(
  data: CrmWorkspaceData,
  item: WorkItem,
  now: string,
  staleAfterDays = 90
): QualityFlag[] {
  const flags: QualityFlag[] = [];

  if (item.status === 'open' && item.nextStep === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'No next step is recorded.',
      resolution: 'Record the next thing to do, and when.',
      subjectTable: 'crm_work_items',
      subjectId: item.id,
    });
  }

  if (item.primaryPersonId === null) {
    flags.push({
      kind: 'missing',
      label: QUALITY_LABELS.missing,
      detail: 'No primary contact is recorded.',
      resolution: 'Record who the main contact is.',
      subjectTable: 'crm_work_items',
      subjectId: item.id,
    });
  }

  if (item.valueAmount !== null && item.valueBasis === 'inferred') {
    flags.push({
      kind: 'unconfirmed',
      label: QUALITY_LABELS.unconfirmed,
      detail: 'The value was worked out rather than stated by the customer.',
      resolution: 'Confirm the figure with them, or mark it as an estimate.',
      subjectTable: 'crm_work_items',
      subjectId: item.id,
    });
  }

  const touched = qualityIndex(data).latestByWorkItem.get(item.id) ?? null;

  return [...flags, ...sharedFlags(data, 'crm_work_items', item.id, touched, now, staleAfterDays)];
}

/**
 * Whether a record is worth a look, and why, in words.
 *
 * Deliberately returns the reasons rather than a verdict, so a view can show
 * what is true of the record instead of a judgement about it.
 */
export function reviewRecommended(flags: QualityFlag[]): QualityFlag | null {
  const serious = flags.filter(
    (f) => f.kind === 'conflicting' || f.kind === 'duplicate_candidate'
  );
  if (serious.length === 0) return null;
  return {
    kind: 'review_recommended',
    label: QUALITY_LABELS.review_recommended,
    detail:
      serious.length === 1
        ? 'One thing on this record needs a person to settle it.'
        : `${serious.length} things on this record need a person to settle them.`,
    resolution: 'Open the record and work through what is listed.',
    subjectTable: serious[0].subjectTable,
    subjectId: serious[0].subjectId,
  };
}

/** Every flag in the workspace, by record. No owner column, by design. */
export interface FlaggedRecord {
  subjectTable: string;
  subjectId: string;
  name: string;
  context: string | null;
  flags: QualityFlag[];
}

export function workspaceFlags(
  data: CrmWorkspaceData,
  now: string,
  staleAfterDays = 90
): FlaggedRecord[] {
  const out: FlaggedRecord[] = [];

  for (const person of data.people) {
    if (person.deletedAt !== null || person.mergedIntoPersonId !== null) continue;
    const flags = personFlags(data, person, now, staleAfterDays);
    const recommended = reviewRecommended(flags);
    if (flags.length === 0) continue;
    out.push({
      subjectTable: 'crm_people',
      subjectId: person.id,
      name: person.fullName,
      context:
        data.organisations.find((o) => o.id === person.organisationId)?.name ?? null,
      flags: recommended ? [recommended, ...flags] : flags,
    });
  }

  for (const organisation of data.organisations) {
    if (organisation.deletedAt !== null) continue;
    const flags = organisationFlags(data, organisation, now, staleAfterDays);
    const recommended = reviewRecommended(flags);
    if (flags.length === 0) continue;
    out.push({
      subjectTable: 'crm_organisations',
      subjectId: organisation.id,
      name: organisation.name,
      context: organisation.industry,
      flags: recommended ? [recommended, ...flags] : flags,
    });
  }

  for (const item of data.workItems) {
    if (item.deletedAt !== null) continue;
    const flags = workItemFlags(data, item, now, staleAfterDays);
    const recommended = reviewRecommended(flags);
    if (flags.length === 0) continue;
    out.push({
      subjectTable: 'crm_work_items',
      subjectId: item.id,
      name: item.title,
      context: data.organisations.find((o) => o.id === item.organisationId)?.name ?? null,
      flags: recommended ? [recommended, ...flags] : flags,
    });
  }

  return out;
}

/**
 * Counts of RECORDS in each condition.
 *
 * Note what it does not take and does not return: no owner, no person, no
 * total, no score. The shape of this function is the policy.
 */
export function countByKind(records: FlaggedRecord[]): Record<QualityFlagKind, number> {
  const counts = Object.fromEntries(
    QUALITY_ORDER.map((kind) => [kind, 0])
  ) as Record<QualityFlagKind, number>;

  for (const record of records) {
    for (const kind of QUALITY_ORDER) {
      if (record.flags.some((f) => f.kind === kind)) counts[kind] += 1;
    }
  }

  return counts;
}

/*
 * Drop the record-quality lookups whenever anything is written.
 *
 * The session store mutates one workspace object in place, so a cache keyed on
 * that object outlives the data it was built from. Registering here means the
 * cache is dropped by the thing that knows a write happened, rather than by
 * every caller remembering to.
 */
onWriteInvalidate(forgetQualityIndex);
