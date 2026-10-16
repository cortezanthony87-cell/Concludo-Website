/**
 * Writing down that somebody read a customer's memory.
 *
 * This is the only write Phase 2B-i adds, and it is the control that makes the
 * rest of the phase defensible.
 *
 * THE REASONING, STATED ONCE, HERE.
 *
 * The memory explorer does not store anything new about a customer. Every
 * entry it shows is a row that Stages 3 to 8 already held. What it adds is
 * assembly: one person, in one query, can now have the whole history of a
 * customer relationship, including what was promised, what went wrong and what
 * somebody said about a service failure.
 *
 * A control that only limits what can be read would be the wrong control,
 * because reading this is the job. Somebody about to walk into a renewal
 * meeting should read all of it. So the control is not a restriction, it is a
 * record: the read is written down, with who, when, under what role, against
 * which customer, and how much came back.
 *
 * WHAT THE RECORD IS FOR.
 *
 * Not performance. Three things, in order of how often they matter:
 *
 *   1. Answering a customer who asks who has looked at their information.
 *      Under APP 12 a customer may ask for access to their personal
 *      information; a business that cannot say who inside it has read a file
 *      is answering from memory.
 *   2. Assessing a breach. The notifiable data breaches scheme gives thirty
 *      days to decide whether serious harm is likely. With a read log, a
 *      compromised account's reads are a list. Without one, every customer in
 *      the workspace has to be assumed read, and the notification goes to all
 *      of them.
 *   3. Noticing the unusual read. Four hundred customers' memory read in an
 *      afternoon by somebody who has given notice is the shape of a departing
 *      employee taking a client list, and it looks nothing like ordinary use.
 *
 * WHAT IT MUST NOT BE USED FOR, AND HOW THAT IS HELD.
 *
 * No function here returns a count per user. No function takes a user id as a
 * filter. Migration 0009 fails the deploy if a view appears that groups the
 * table by `read_by`. The reason is not squeamishness: a read log surfaced as
 * a figure next to somebody's name changes behaviour, and the behaviour it
 * changes is "read the account history before the meeting".
 *
 * ONE ROW PER READ, AND WHY THE PAGE MUST NOT RENDER-LOG.
 *
 * There is no deduplication in this module. A read is a read, and a window
 * that merged two reads into one would be a judgement about which reads
 * matter. That puts an obligation on the caller: a page records a read when a
 * person CHOOSES a customer, not on every render. `CrmMemoryPage` does this
 * with a ref holding the last organisation it logged, and a page that called
 * this on every render would turn the log into noise and the audit table into
 * a write-amplifier.
 */

import { CrmRole, CrmWorkspaceData, MemoryRead } from '../domain';
import { CrmContext, CrmRefused } from '../repositories/repository';
import { commit, newId } from '../stage5/writes';

export interface RecordMemoryRead {
  /** Null only for a workspace-wide search. */
  organisationId: string | null;
  kind: 'explorer' | 'search';
  question?: string | null;
  query?: string | null;
  entriesReturned: number;
  readAs: CrmRole;
}

/**
 * Write the read down.
 *
 * Viewer role, because reading is what a viewer does and a control that
 * refused to record a viewer's read would record only the reads that mattered
 * least.
 */
export function recordMemoryRead(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: RecordMemoryRead
): MemoryRead {
  if (input.organisationId !== null) {
    const organisation = data.organisations.find(
      (candidate) => candidate.id === input.organisationId
    );
    if (!organisation) {
      throw new CrmRefused('not_found', 'That organisation is not in this workspace.');
    }
  } else if (input.kind !== 'search') {
    throw new CrmRefused(
      'invalid',
      'A read of one customer has to say which customer. Only a search covers the whole workspace.'
    );
  }

  if (!Number.isInteger(input.entriesReturned) || input.entriesReturned < 0) {
    throw new CrmRefused('invalid', 'How much came back has to be a whole number.');
  }

  const row: MemoryRead = {
    id: newId('mread'),
    crmWorkspaceId: context.workspaceId,
    organisationId: input.organisationId,
    kind: input.kind,
    question: input.question?.trim() || null,
    // The query is kept because "who searched for what" is the question a
    // breach assessment asks first. It is the search words, never the results.
    query: input.query?.trim() || null,
    entriesReturned: input.entriesReturned,
    readAs: input.readAs,
    readBy: context.userId,
    readAt: context.now,
    createdAt: context.now,
  };

  return commit({
    context,
    data,
    role: 'crm_viewer',
    doing: input.kind === 'search' ? 'Searching customer memory' : 'Reading a customer memory',
    eventType: input.kind === 'search' ? 'memory_searched' : 'memory_read',
    subjectTable: 'crm_memory_reads',
    detail:
      input.kind === 'search'
        ? `Searched for ${row.query ?? 'nothing'}, ${row.entriesReturned} results.`
        : `${row.entriesReturned} entries returned.`,
    apply: () => {
      data.memoryReads.push(row);
      return row;
    },
    subjectId: (written) => written.id,
    after: (written) => ({
      organisationId: written.organisationId,
      kind: written.kind,
      entriesReturned: written.entriesReturned,
      readAs: written.readAs,
    }),
  });
}

/* ===================================================== reading the log back */

/**
 * What the log says about one customer, with nobody's name in it.
 *
 * This is what a business shows a customer who asks how often their file has
 * been looked at, and what a privacy officer reads first. Who read it is in
 * the audit trail, reachable by somebody with the role to look, which is the
 * same place every other "who did this" question in this product is answered.
 */
export interface MemoryReadSummary {
  organisationId: string;
  reads: number;
  firstReadAt: string | null;
  lastReadAt: string | null;
  /** The roles reads were made under, so a restricted read is distinguishable. */
  roles: CrmRole[];
  note: string;
}

export const READ_LOG_NOTE =
  'Concludo records when a customer memory is read, so this business can answer a customer who asks, and can tell what was reached if an account is ever compromised. Who read it is in the audit trail and is not shown as a figure next to anybody.';

export function readsForOrganisation(
  data: CrmWorkspaceData,
  organisationId: string
): MemoryReadSummary {
  const rows = data.memoryReads
    .filter((row) => row.organisationId === organisationId)
    .sort((a, b) => Date.parse(a.readAt) - Date.parse(b.readAt));

  return {
    organisationId,
    reads: rows.length,
    firstReadAt: rows[0]?.readAt ?? null,
    lastReadAt: rows[rows.length - 1]?.readAt ?? null,
    roles: [...new Set(rows.map((row) => row.readAs))].sort(),
    note: READ_LOG_NOTE,
  };
}

/**
 * Searches made across the workspace, without who made them.
 *
 * A workspace-wide search is the read with the widest reach, so it is the one
 * worth being able to list. The query is shown because that is what makes the
 * list useful to a privacy assessment; the person is not, for the reason at
 * the top of this file.
 */
export interface MemorySearchLogEntry {
  at: string;
  query: string | null;
  results: number;
  readAs: CrmRole;
}

export function searchLog(data: CrmWorkspaceData, limit = 50): MemorySearchLogEntry[] {
  return data.memoryReads
    .filter((row) => row.kind === 'search')
    .sort((a, b) => Date.parse(b.readAt) - Date.parse(a.readAt))
    .slice(0, limit)
    .map((row) => ({
      at: row.readAt,
      query: row.query,
      results: row.entriesReturned,
      readAs: row.readAs,
    }));
}

/**
 * Reads of this workspace's memory in the last day, as one figure.
 *
 * For the page footer, so the control is visible to the people it applies to
 * rather than being a table only an administrator knows about. A control
 * nobody can see is indistinguishable from no control.
 */
export function readsToday(data: CrmWorkspaceData, now: string): number {
  const since = Date.parse(now) - 86_400_000;
  return data.memoryReads.filter((row) => Date.parse(row.readAt) >= since).length;
}
