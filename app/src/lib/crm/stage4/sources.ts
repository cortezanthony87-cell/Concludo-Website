/**
 * Source navigation: from an extracted value back to where it came from.
 *
 * THE RULE THIS FILE EXISTS TO HOLD.
 *
 * Concludo's whole claim is that a conversation becomes finished work. The
 * moment a person cannot get from a value on a screen back to the sentence it
 * came from, that claim is unfalsifiable, and an unfalsifiable claim about an
 * AI-generated figure is the one a buyer is right to distrust.
 *
 * So every extracted value resolves to a trail with three parts:
 *
 *   What was asserted, and on what basis.
 *   The sentence it came from, where there is one.
 *   The record that sentence sits in, and a route to open it.
 *
 * Where any of those is absent, the trail says so IN WORDS rather than
 * rendering an empty space. "No source recorded" and "source recorded but the
 * record is gone" are different facts and a person acting on the value needs to
 * know which one they have.
 */
import { Basis, Confidence, CrmWorkspaceData, Evidence } from '../domain';

export interface SourceRecordRef {
  table: string;
  id: string;
  /** What to call it on screen. */
  label: string;
  /** When it happened, where the record has a time. */
  when: string | null;
  /** The in-module route that opens it, relative to /crm. */
  path: string | null;
}

export interface SourceTrail {
  evidenceId: string;
  fieldName: string;
  assertedValue: string | null;
  basis: Basis;
  confidence: Confidence;
  capturedAt: string;

  /** The sentence, where one was captured. */
  sourceText: string | null;
  /** Where to look in the source, for example a transcript position. */
  sourceLocation: string | null;

  /** The record the sentence sits in, if it still resolves. */
  record: SourceRecordRef | null;

  /**
   * Why there is nothing to open, in words. Null when there is.
   * This is the field that stops an absent source looking like a bug.
   */
  unavailableBecause: string | null;

  /** Set where a model produced the value. Both or neither. */
  modelVersion: string | null;
  promptVersion: string | null;

  confirmedAt: string | null;
  supersededAt: string | null;
  conflictsWithId: string | null;
}

const SOURCE_TYPE_WORDS: Record<Evidence['sourceType'], string> = {
  meeting_transcript: 'Meeting transcript',
  email: 'Email',
  document: 'Document',
  manual_entry: 'Entered by hand',
  import: 'Import',
  external_system: 'External system',
  derived: 'Worked out from other records',
  none: 'No source',
};

/**
 * Resolves the record an assertion points at.
 *
 * Returns null where the evidence names no record. Returns a ref with a null
 * path where the record exists but has no view of its own yet, which is honest
 * about what this release can open rather than rendering a link that goes
 * nowhere.
 */
function resolveRecord(data: CrmWorkspaceData, evidence: Evidence): SourceRecordRef | null {
  const { sourceRecordTable: table, sourceRecordId: id } = evidence;
  if (!table || !id) return null;

  if (table === 'crm_activities') {
    const activity = data.activities.find((a) => a.id === id);
    if (!activity) return null;
    const meeting = data.meetings.find((m) => m.activityId === activity.id);
    return {
      table,
      id,
      label: meeting ? `${activity.title}, ${meeting.meetingType ?? 'meeting'}` : activity.title,
      when: activity.occurredAt,
      path: `/crm/activities?focus=${activity.id}`,
    };
  }

  if (table === 'crm_email_references') {
    const reference = data.emailReferences.find((e) => e.id === id);
    if (!reference) return null;
    return {
      table,
      id,
      // A pointer, never the mail. There is no body to open, and saying so is
      // part of the privacy position rather than a missing feature.
      label: reference.subject ?? 'Email thread',
      when: reference.occurredAt,
      path: `/crm/activities?focus=${reference.id}`,
    };
  }

  if (table === 'crm_notes') {
    const note = data.notes.find((n) => n.id === id);
    if (!note) return null;
    return { table, id, label: 'Note', when: note.createdAt, path: `/crm/activities?focus=${note.id}` };
  }

  if (table === 'crm_quotes') {
    const quote = data.quotes.find((q) => q.id === id);
    if (!quote) return null;
    return { table, id, label: `Quote ${quote.reference}`, when: quote.sentOn, path: null };
  }

  return { table, id, label: table.replace('crm_', '').replace(/_/g, ' '), when: null, path: null };
}

export function sourceTrail(data: CrmWorkspaceData, evidence: Evidence): SourceTrail {
  const record = resolveRecord(data, evidence);

  let unavailable: string | null = null;
  if (evidence.basis === 'unknown') {
    unavailable = 'Nothing is recorded for this, so there is no source to open. This is absent, not zero.';
  } else if (evidence.sourceType === 'none' && evidence.sourceText === null) {
    unavailable = 'No source was recorded when this value was entered.';
  } else if (!record && evidence.sourceRecordId) {
    unavailable = 'The source record this came from is no longer available.';
  } else if (!record && evidence.sourceText) {
    unavailable = `${SOURCE_TYPE_WORDS[evidence.sourceType]}. The quote was kept; the record it sits in was not linked.`;
  } else if (!record) {
    unavailable = 'No source record is linked to this value.';
  }

  return {
    evidenceId: evidence.id,
    fieldName: evidence.fieldName,
    assertedValue: evidence.assertedValue,
    basis: evidence.basis,
    confidence: evidence.confidence,
    capturedAt: evidence.capturedAt,
    sourceText: evidence.sourceText,
    sourceLocation: evidence.sourceLocation,
    record,
    unavailableBecause: unavailable,
    modelVersion: evidence.modelVersion,
    promptVersion: evidence.promptVersion,
    confirmedAt: evidence.confirmedAt,
    supersededAt: evidence.supersededAt,
    conflictsWithId: evidence.conflictsWithId,
  };
}

/**
 * Every current assertion about one record, as trails.
 *
 * Superseded assertions are excluded: showing a corrected value beside the
 * current one without saying which is which is how somebody quotes last
 * month's number at a client. They are reachable from the correction itself,
 * through `supersededTrail`.
 */
export function trailsFor(
  data: CrmWorkspaceData,
  subjectTable: string,
  subjectId: string
): SourceTrail[] {
  return data.evidence
    .filter(
      (e) =>
        e.subjectTable === subjectTable &&
        e.subjectId === subjectId &&
        e.deletedAt === null &&
        e.supersededAt === null
    )
    .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt))
    .map((e) => sourceTrail(data, e));
}

/** What a value used to say, for a correction that wants to show its history. */
export function supersededTrail(data: CrmWorkspaceData, current: Evidence): SourceTrail[] {
  return data.evidence
    .filter((e) => e.supersededById === current.id)
    .map((e) => sourceTrail(data, e));
}

/**
 * The two sides of an open conflict.
 *
 * Returns both, in captured order, because a conflict is two live facts a
 * person has to settle and showing one of them is how the other gets lost.
 */
export function conflictPair(data: CrmWorkspaceData, evidence: Evidence): SourceTrail[] {
  if (evidence.conflictState !== 'open' || !evidence.conflictsWithId) return [];
  const other = data.evidence.find((e) => e.id === evidence.conflictsWithId);
  if (!other) return [sourceTrail(data, evidence)];
  return [evidence, other]
    .sort((a, b) => a.capturedAt.localeCompare(b.capturedAt))
    .map((e) => sourceTrail(data, e));
}

/** Every open conflict in the workspace, paired. */
export function openConflicts(data: CrmWorkspaceData): SourceTrail[][] {
  const seen = new Set<string>();
  const pairs: SourceTrail[][] = [];

  for (const e of data.evidence) {
    if (e.conflictState !== 'open' || !e.conflictsWithId) continue;
    const key = [e.id, e.conflictsWithId].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push(conflictPair(data, e));
  }

  return pairs;
}

export { SOURCE_TYPE_WORDS };
