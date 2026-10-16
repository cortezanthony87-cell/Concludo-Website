/**
 * One chronological timeline, out of eleven kinds of record.
 *
 * WHY ONE LIST RATHER THAN ELEVEN TABS.
 *
 * "What happened with this account" is one question. A person asking it does
 * not know, and should not have to know, whether the answer was recorded as a
 * meeting, a note, a decision or a stage change. Eleven tabs is the data model
 * leaking into the interface, and it makes the one question that matters, what
 * happened in what order, the hardest one to answer.
 *
 * So everything merges into one list, sorted by when it happened, and the kind
 * becomes a label and a filter rather than a destination.
 *
 * TWO THINGS THE ENTRIES CARRY THAT A NAIVE MERGE WOULD DROP.
 *
 *   `source` says where the entry itself came from: a person typed it, a model
 *   proposed it and somebody confirmed it, or it arrived from a connected
 *   system. A timeline that renders all three identically is one that cannot
 *   answer "did we actually agree that, or did the software decide we did".
 *
 *   `evidenceId` points at the assertion behind an extracted entry, so
 *   selecting it can open the sentence it came from. That is the source
 *   navigation requirement, and it is carried here rather than looked up later
 *   because an entry that cannot say where it came from should not be in the
 *   list at all.
 */
import { CrmWorkspaceData } from '../domain';

export type TimelineKind =
  | 'meeting'
  | 'email'
  | 'note'
  | 'call'
  | 'task'
  | 'decision'
  | 'commitment'
  | 'work_change'
  | 'service'
  | 'quote'
  | 'ai_update';

export type TimelineSource = 'person' | 'ai_confirmed' | 'connected_system';

export interface TimelineEntry {
  id: string;
  kind: TimelineKind;
  /** The headline, in the words of the record rather than a template. */
  title: string;
  /** One line of context: who, or which organisation, or what changed. */
  context: string | null;
  /** The body, where the record has one worth showing. */
  detail: string | null;
  occurredAt: string;

  organisationId: string | null;
  personIds: string[];
  workItemId: string | null;

  source: TimelineSource;
  /** How the conversation was captured, where this came from one. */
  captureMethod: string | null;

  /** The assertion behind this entry, where it was extracted. */
  evidenceId: string | null;
  /** The record to open, relative to /crm. */
  subjectTable: string;
  subjectId: string;
}

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  meeting: 'Meeting',
  email: 'Email',
  note: 'Note',
  call: 'Call',
  task: 'Task',
  decision: 'Decision',
  commitment: 'Commitment',
  work_change: 'Opportunity change',
  service: 'Service event',
  quote: 'Quote',
  ai_update: 'Approved AI update',
};

export const TIMELINE_SOURCE_LABELS: Record<TimelineSource, string> = {
  person: 'Recorded by a person',
  ai_confirmed: 'Proposed by Concludo, confirmed by a person',
  connected_system: 'From a connected system',
};

/** The capture methods, in words. Concludo is independent of every one of them. */
const CAPTURE_WORDS: Record<string, string> = {
  pasted_text: 'Pasted text',
  uploaded_file: 'Uploaded file',
  recorder: 'Recorder',
  smart_pen: 'Smart pen',
  phone_recording: 'Phone recording',
  platform_transcript: 'Meeting platform transcript',
  unknown: 'Capture method not recorded',
};

export interface TimelineFilter {
  kinds?: TimelineKind[];
  sources?: TimelineSource[];
  organisationId?: string | null;
  personId?: string | null;
  workItemId?: string | null;
  /** Entries on or after this moment. */
  since?: string | null;
  limit?: number;
}

/**
 * Builds the whole timeline for a workspace.
 *
 * Deleted records are excluded everywhere. A soft-deleted record is still a
 * row, and a timeline that renders it is a timeline that shows a person
 * something they already removed.
 */
export function buildTimeline(data: CrmWorkspaceData): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const orgName = (id: string | null): string | null =>
    data.organisations.find((o) => o.id === id)?.name ?? null;
  const personNameOf = (id: string | null): string | null =>
    data.people.find((p) => p.id === id)?.fullName ?? null;

  /* ------------------------------------------------- meetings and calls */

  for (const activity of data.activities) {
    if (activity.deletedAt !== null) continue;

    const participants = data.activityParticipants
      .filter((p) => p.activityId === activity.id)
      .map((p) => p.personId)
      .filter((id): id is string => id !== null);

    const meeting = data.meetings.find((m) => m.activityId === activity.id);

    // A stage change is recorded as an activity in the model and reads as an
    // opportunity change in a timeline, which is what a person calls it.
    const kind: TimelineKind =
      activity.activityType === 'meeting'
        ? 'meeting'
        : activity.activityType === 'call'
          ? 'call'
          : activity.activityType === 'email'
            ? 'email'
            : activity.activityType === 'stage_change'
              ? 'work_change'
              : activity.activityType === 'task_completed'
                ? 'task'
                : 'note';

    entries.push({
      id: `tl-act-${activity.id}`,
      kind,
      title: activity.title,
      context: orgName(activity.organisationId),
      detail: activity.summary,
      occurredAt: activity.occurredAt,
      organisationId: activity.organisationId,
      personIds: participants,
      workItemId: activity.workItemId,
      source: 'person',
      captureMethod: meeting?.captureMethod ? (CAPTURE_WORDS[meeting.captureMethod] ?? null) : null,
      evidenceId:
        data.evidence.find(
          (e) => e.sourceRecordTable === 'crm_activities' && e.sourceRecordId === activity.id
        )?.id ?? null,
      subjectTable: 'crm_activities',
      subjectId: activity.id,
    });
  }

  /* -------------------------------------------------------------- email */

  for (const reference of data.emailReferences) {
    if (reference.deletedAt !== null) continue;
    // A personal mailbox reference never appears beside work. The database
    // refuses to attach one; the timeline refuses to show one here.
    if (reference.accountScope === 'personal') continue;
    // An email that already has an activity is one entry, not two.
    if (reference.activityId !== null) continue;

    entries.push({
      id: `tl-mail-${reference.id}`,
      kind: 'email',
      title: reference.subject ?? 'Email thread',
      context: orgName(reference.organisationId) ?? personNameOf(reference.personId),
      detail: 'A reference to a thread. Concludo stores the pointer, never the message.',
      occurredAt: reference.occurredAt,
      organisationId: reference.organisationId,
      personIds: reference.personId ? [reference.personId] : [],
      workItemId: reference.workItemId,
      source: 'connected_system',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_email_references',
      subjectId: reference.id,
    });
  }

  /* -------------------------------------------------------------- notes */

  for (const note of data.notes) {
    if (note.deletedAt !== null) continue;
    entries.push({
      id: `tl-note-${note.id}`,
      kind: 'note',
      title: note.isPrivate ? 'Private note' : 'Note',
      context: orgName(note.organisationId) ?? personNameOf(note.personId),
      detail: note.body,
      occurredAt: note.createdAt,
      organisationId: note.organisationId,
      personIds: note.personId ? [note.personId] : [],
      workItemId: note.workItemId,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_notes',
      subjectId: note.id,
    });
  }

  /* -------------------------------------------------------------- tasks */

  for (const task of data.tasks) {
    if (task.deletedAt !== null) continue;
    entries.push({
      id: `tl-task-${task.id}`,
      kind: 'task',
      title: task.title,
      context: orgName(task.organisationId) ?? personNameOf(task.personId),
      detail: task.detail,
      occurredAt: task.completedAt ?? task.createdAt,
      organisationId: task.organisationId,
      personIds: task.personId ? [task.personId] : [],
      workItemId: task.workItemId,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_tasks',
      subjectId: task.id,
    });
  }

  /* ---------------------------------------------------------- decisions */

  for (const decision of data.decisions) {
    if (decision.deletedAt !== null) continue;
    entries.push({
      id: `tl-dec-${decision.id}`,
      kind: 'decision',
      title: decision.title,
      context:
        decision.decidedByName !== null
          ? `Decided by ${decision.decidedByName}`
          : orgName(decision.organisationId),
      detail: decision.reasoning ?? decision.summary,
      occurredAt: decision.decidedOn ?? decision.createdAt,
      organisationId: decision.organisationId,
      personIds: decision.decidedByPersonId ? [decision.decidedByPersonId] : [],
      workItemId: decision.workItemId,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_decisions',
      subjectId: decision.id,
    });
  }

  /* -------------------------------------------------------- commitments */

  for (const commitment of data.commitments) {
    if (commitment.deletedAt !== null) continue;
    entries.push({
      id: `tl-com-${commitment.id}`,
      kind: 'commitment',
      title: commitment.description,
      context: commitment.ownedByUs
        ? `We promised this. ${commitment.ownerName}`
        : `They promised this. ${commitment.ownerName}`,
      detail:
        commitment.dueDate !== null
          ? `Due ${commitment.dueDate}.`
          : 'No date was agreed, which is itself worth knowing.',
      occurredAt: commitment.createdAt,
      organisationId: commitment.organisationId,
      personIds: commitment.ownerPersonId ? [commitment.ownerPersonId] : [],
      workItemId: commitment.workItemId,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_commitments',
      subjectId: commitment.id,
    });
  }

  /* ----------------------------------------------- opportunity changes */

  for (const move of data.stageMoves) {
    const item = data.workItems.find((w) => w.id === move.workItemId);
    if (!item || item.deletedAt !== null) continue;
    const from = data.stages.find((s) => s.id === move.fromStageId)?.name;
    const to = data.stages.find((s) => s.id === move.toStageId)?.name ?? 'a new stage';

    entries.push({
      id: `tl-move-${move.id}`,
      kind: 'work_change',
      title: `${item.title} moved to ${to}`,
      context: from ? `From ${from}` : 'Entered the pipeline',
      // An override is the single most important thing a stage history carries,
      // so it is the detail rather than a footnote.
      detail:
        move.criteriaUnmet.length > 0
          ? `Moved with ${move.criteriaUnmet.length} exit ${move.criteriaUnmet.length === 1 ? 'criterion' : 'criteria'} unmet. Reason given: ${move.overrideReason}`
          : 'All required exit criteria were met.',
      occurredAt: move.movedAt,
      organisationId: item.organisationId,
      personIds: [],
      workItemId: item.id,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_work_item_stage_history',
      subjectId: move.id,
    });
  }

  /* ----------------------------------------------------- service events */

  for (const serviceCase of data.serviceCases) {
    if (serviceCase.deletedAt !== null) continue;
    entries.push({
      id: `tl-svc-${serviceCase.id}`,
      kind: 'service',
      title: serviceCase.title,
      context: orgName(serviceCase.organisationId),
      detail: serviceCase.relationshipEffect ?? serviceCase.detail,
      occurredAt: serviceCase.raisedAt,
      organisationId: serviceCase.organisationId,
      personIds: serviceCase.personId ? [serviceCase.personId] : [],
      workItemId: serviceCase.workItemId,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_service_cases',
      subjectId: serviceCase.id,
    });

    if (serviceCase.resolvedAt !== null) {
      entries.push({
        id: `tl-svc-done-${serviceCase.id}`,
        kind: 'service',
        title: `${serviceCase.title}: resolved`,
        context: orgName(serviceCase.organisationId),
        detail: serviceCase.relationshipEffect,
        occurredAt: serviceCase.resolvedAt,
        organisationId: serviceCase.organisationId,
        personIds: serviceCase.personId ? [serviceCase.personId] : [],
        workItemId: serviceCase.workItemId,
        source: 'person',
        captureMethod: null,
        evidenceId: null,
        subjectTable: 'crm_service_cases',
        subjectId: serviceCase.id,
      });
    }
  }

  /* ------------------------------------------------------------ quotes */

  for (const quote of data.quotes) {
    if (quote.deletedAt !== null) continue;
    const lines = data.quoteLines.filter((l) => l.quoteId === quote.id);
    entries.push({
      id: `tl-quote-${quote.id}`,
      kind: 'quote',
      title: `Quote ${quote.reference}`,
      context: orgName(quote.organisationId),
      detail:
        lines.length > 0
          ? `${lines.length} ${lines.length === 1 ? 'line' : 'lines'}. ${quote.state.replace(/_/g, ' ')}.`
          : quote.state.replace(/_/g, ' '),
      occurredAt: quote.sentOn ?? quote.createdAt,
      organisationId: quote.organisationId,
      personIds: quote.personId ? [quote.personId] : [],
      workItemId: quote.workItemId,
      source: 'person',
      captureMethod: null,
      evidenceId: null,
      subjectTable: 'crm_quotes',
      subjectId: quote.id,
    });
  }

  /* ------------------------------------------------- approved AI updates */

  for (const proposal of data.proposals) {
    if (proposal.deletedAt !== null) continue;
    // Only confirmed and applied proposals are history. One awaiting a decision
    // has not happened, and putting it on a timeline of what happened is how a
    // suggestion becomes a fact nobody agreed to.
    if (proposal.state !== 'confirmed' || proposal.appliedAt === null) continue;

    const approval = data.approvals.find((a) => a.proposalId === proposal.id);

    entries.push({
      id: `tl-prop-${proposal.id}`,
      kind: 'ai_update',
      title: proposal.headline,
      context: approval?.selfApproved
        ? 'Confirmed by the person who received it, working alone'
        : 'Confirmed by a person',
      detail: proposal.rationale,
      occurredAt: proposal.appliedAt,
      organisationId: null,
      personIds: [],
      workItemId: proposal.subjectTable === 'crm_work_items' ? proposal.subjectId : null,
      source: 'ai_confirmed',
      captureMethod: null,
      evidenceId: proposal.evidenceId,
      subjectTable: 'crm_proposals',
      subjectId: proposal.id,
    });
  }

  return entries.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

/** Applies a filter to a built timeline. Most recent first. */
export function filterTimeline(
  entries: TimelineEntry[],
  filter: TimelineFilter
): TimelineEntry[] {
  let out = entries;

  if (filter.kinds && filter.kinds.length > 0) {
    out = out.filter((e) => filter.kinds!.includes(e.kind));
  }
  if (filter.sources && filter.sources.length > 0) {
    out = out.filter((e) => filter.sources!.includes(e.source));
  }
  if (filter.organisationId) {
    out = out.filter((e) => e.organisationId === filter.organisationId);
  }
  if (filter.personId) {
    out = out.filter((e) => e.personIds.includes(filter.personId!));
  }
  if (filter.workItemId) {
    out = out.filter((e) => e.workItemId === filter.workItemId);
  }
  if (filter.since) {
    out = out.filter((e) => e.occurredAt >= filter.since!);
  }

  return filter.limit ? out.slice(0, filter.limit) : out;
}

/** The kinds actually present, so a filter never offers an empty choice. */
export function kindsPresent(entries: TimelineEntry[]): TimelineKind[] {
  const present = new Set(entries.map((e) => e.kind));
  return (Object.keys(TIMELINE_KIND_LABELS) as TimelineKind[]).filter((k) => present.has(k));
}

export function sourcesPresent(entries: TimelineEntry[]): TimelineSource[] {
  const present = new Set(entries.map((e) => e.source));
  return (Object.keys(TIMELINE_SOURCE_LABELS) as TimelineSource[]).filter((s) => present.has(s));
}

export { CAPTURE_WORDS };
