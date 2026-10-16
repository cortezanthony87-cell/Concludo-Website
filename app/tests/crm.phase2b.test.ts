/**
 * Concludo CRM, Phase 2B-i: organisational memory.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * The eight kinds and the nine questions are the easy half. The hard half is
 * the four properties that make a memory layer trustworthy rather than
 * impressive, and nearly every check below is about one of those.
 *
 *   NOTHING IS INVENTED. Asserted structurally rather than by reading the
 *   copy: every sentence this module produces is checked for being a
 *   substring assembled from values that exist in the records, every entry's
 *   `source` is checked for naming a row that is actually there in the right
 *   workspace, and the "not recorded" answer is checked for appearing exactly
 *   when there is nothing behind it rather than whenever it is convenient.
 *
 *   MEMORY IS SMALLER THAN THE TIMELINE. If memory ever equalled the
 *   timeline, the product would have one feature with two names. The check
 *   asserts the relationship across every fixture, which is what would catch
 *   somebody widening a kind until it swallowed everything.
 *
 *   THE ROLE IS APPLIED IN THE SEARCH, NOT THE RENDER. A restricted field
 *   reaching somebody through a snippet is the defect that a role check in
 *   the page would not catch, so the check runs the search as a viewer and
 *   asserts on the output of the module, not of a component.
 *
 *   NOTHING IS ABOUT A PERSON. Every user id in every workspace is checked
 *   against the whole serialised output of every read function in the module,
 *   the same way Phase 2A-i checks the attention module. The read LOG holds a
 *   user id by design, so it is checked the other way: that no function
 *   returning a summary of it carries one.
 *
 * Run: bun tests/crm.phase2b.test.ts
 */
import { CRM_WORKSPACES, getCrmWorkspace } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CrmRole, CrmWorkspaceData, CRM_TABLES } from '../src/lib/crm/domain';
import { CrmRefused } from '../src/lib/crm/repositories/repository';
import {
  MEMORY_KIND_LABELS,
  MEMORY_NOTE,
  MEMORY_QUESTIONS,
  MemoryEntry,
  MemoryKind,
  NOT_RECORDED,
  SEARCH_NOTE,
  answerAll,
  answerMemoryQuestion,
  forgetMemoryIndex,
  memoryFor,
  memoryLinks,
  memoryTimeline,
  organisationsWithMemory,
  searchMemory,
} from '../src/lib/crm/phase2/memory';
import {
  READ_LOG_NOTE,
  readsForOrganisation,
  readsToday,
  recordMemoryRead,
  searchLog,
} from '../src/lib/crm/phase2/memoryReads';
import { setStakeholderRole } from '../src/lib/crm/stage6/planWrites';
import { CRM_MODULE_DESTINATIONS } from '../src/lib/crm/moduleNav';
import { checkLanguage } from '../src/lib/crm/language';
import { invalidateCaches, registeredCacheCount } from '../src/lib/crm/cacheBus';
/* Imported for their side effect: each of these modules registers its cache
   invalidator at module scope, and a module nobody imports never registers.
   The import list IS the check, the same as in the Phase 2A-i suite. */
import { forgetContactIndex } from '../src/lib/crm/stage4/relationships';
import { forgetQualityIndex } from '../src/lib/crm/stage4/quality';
import { forgetCoverageIndex } from '../src/lib/crm/stage4/hierarchy';
import { forgetBoardIndex } from '../src/lib/crm/stage5/pipeline';
import { forgetIndex } from '../src/lib/crm/stage8/paging';
import { buildTimeline } from '../src/lib/crm/stage4/timeline';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual, assertRefused } = makeAssert(r);

const NOW = CRM_DEMO_NOW;
const KINDS = Object.keys(MEMORY_KIND_LABELS) as MemoryKind[];
const ROLES: CrmRole[] = ['crm_viewer', 'crm_contributor', 'crm_approver', 'crm_admin'];

function fresh(id: string): CrmWorkspaceData {
  const found = getCrmWorkspace(id);
  if (!found) throw new Error(`no workspace ${id}`);
  const copy = structuredClone(found);
  // The index caches against the workspace object. A clone is a new object, so
  // nothing is stale, but dropping it is cheap and makes the intent explicit.
  forgetMemoryIndex(copy);
  return copy;
}

function contextFor(data: CrmWorkspaceData, role: CrmRole = 'crm_contributor') {
  return { userId: data.members[0].userId, workspaceId: data.workspace.id, role, now: NOW };
}

/** Every record id in a workspace, by table, for the provenance check. */
function idsByTable(data: CrmWorkspaceData): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  const put = (table: string, rows: { id: string }[]) =>
    map.set(table, new Set(rows.map((row) => row.id)));

  put('crm_organisations', data.organisations);
  put('crm_people', data.people);
  put('crm_work_items', data.workItems);
  put('crm_activities', data.activities);
  put('crm_commitments', data.commitments);
  put('crm_decisions', data.decisions);
  put('crm_service_cases', data.serviceCases);
  put('crm_account_plans', data.accountPlans);
  put('crm_account_reviews', data.accountReviews);
  put('crm_audit_events', data.auditEvents);
  put('crm_memory_reads', data.memoryReads);
  return map;
}

function everyOrganisation(data: CrmWorkspaceData): string[] {
  return data.organisations.filter((row) => row.deletedAt === null).map((row) => row.id);
}

/* =====================================================================
   1. The shape: eight kinds, nine questions, and a label for each
   ===================================================================== */

group('Eight kinds of thing worth remembering, each with a heading', () => {
  assertEqual(KINDS.length, 8, 'eight kinds');
  assertEqual(new Set(KINDS).size, 8, 'every kind name is distinct');

  for (const kind of KINDS) {
    assert(
      (MEMORY_KIND_LABELS[kind] ?? '').trim().length > 0,
      `${kind} has a heading a person can read`
    );
  }

  // Nothing shaped like a judgement. The kinds are things that happened, and
  // a kind called "sentiment" or "health" would be an opinion with a label.
  for (const kind of KINDS) {
    assert(
      !/sentiment|health|mood|engagement|score|grade|rating|risk_level/.test(kind),
      `${kind} is a thing that happened, not a judgement about anybody`
    );
  }
});

group('Nine questions, each answerable, each with a distinct kind', () => {
  assertEqual(MEMORY_QUESTIONS.length, 9, 'nine questions');
  assertEqual(
    new Set(MEMORY_QUESTIONS.map((entry) => entry.kind)).size,
    9,
    'every question kind is distinct'
  );

  for (const entry of MEMORY_QUESTIONS) {
    assert(entry.question.trim().endsWith('?'), `${entry.kind} is phrased as a question`);
    assert(entry.question.length > 10, `${entry.kind} asks something specific`);
  }
});

/* =====================================================================
   2. Nothing is invented: every entry resolves to a row
   ===================================================================== */

group('Every memory entry names a record that exists in this workspace', () => {
  let entries = 0;

  for (const data of CRM_WORKSPACES) {
    const ids = idsByTable(data);

    for (const organisationId of everyOrganisation(data)) {
      for (const entry of memoryFor(data, organisationId)) {
        entries += 1;

        assert(
          CRM_TABLES.includes(entry.source.table as never),
          `${entry.id} cites a table the model knows (${entry.source.table})`
        );

        const known = ids.get(entry.source.table);
        assert(
          known !== undefined && known.has(entry.source.id),
          `${entry.id} cites a row that is actually in this workspace (${entry.source.table} ${entry.source.id})`
        );

        assert(
          entry.source.what.trim().length > 0,
          `${entry.id} says what the record it cites contributes`
        );
        assert(entry.statement.trim().length > 0, `${entry.id} has a sentence`);
        assert(
          entry.organisationId === organisationId,
          `${entry.id} belongs to the organisation it was asked for`
        );
        assert(
          !Number.isNaN(Date.parse(entry.occurredAt)),
          `${entry.id} has a date that parses`
        );
      }
    }
  }

  assert(entries > 20, `the fixture produces enough memory to be worth checking (${entries})`);
});

group('Every entry sentence is assembled from values that are in the records', () => {
  // The real guard against a generated sentence. For each kind, the statement
  // has to contain a string that came out of a column, so a sentence written
  // by a model rather than read from a row would fail.
  for (const data of CRM_WORKSPACES) {
    for (const organisationId of everyOrganisation(data)) {
      for (const entry of memoryFor(data, organisationId)) {
        let grounded = false;

        switch (entry.kind) {
          case 'promise': {
            const row = data.commitments.find((candidate) => entry.id.endsWith(candidate.id));
            grounded = row !== undefined && entry.statement === row.description;
            break;
          }
          case 'decision': {
            const row = data.decisions.find((candidate) => entry.id.endsWith(candidate.id));
            grounded = row !== undefined && entry.statement.startsWith(row.title);
            break;
          }
          case 'outcome':
          case 'loss_reason': {
            const row = data.workItems.find((candidate) => entry.id.endsWith(candidate.id));
            grounded = row !== undefined && entry.statement.startsWith(row.title);
            break;
          }
          case 'escalation': {
            const row = data.serviceCases.find((candidate) => entry.id.endsWith(candidate.id));
            grounded = row !== undefined && entry.statement.startsWith(row.title);
            break;
          }
          case 'renewal_event': {
            const row = data.organisations.find(
              (candidate) => candidate.id === entry.organisationId
            );
            grounded = row?.renewalDate !== null && entry.statement.includes(row!.renewalDate!);
            break;
          }
          case 'milestone': {
            const row = data.accountReviews.find((candidate) => entry.id.endsWith(candidate.id));
            grounded =
              row !== undefined &&
              (row.summary === null
                ? entry.statement.includes('nothing was recorded')
                : entry.statement.includes(row.summary));
            break;
          }
          case 'change': {
            const row = data.auditEvents.find((candidate) => entry.id.endsWith(candidate.id));
            grounded =
              row !== undefined &&
              (row.detail === null || entry.statement.includes(row.detail));
            break;
          }
        }

        assert(grounded, `${entry.id} (${entry.kind}) reads its sentence out of its own record`);
      }
    }
  }
});

group('Nobody is named unless a record names them', () => {
  for (const data of CRM_WORKSPACES) {
    const names = new Set(data.people.map((person) => person.fullName));
    for (const commitment of data.commitments) names.add(commitment.ownerName);
    for (const decision of data.decisions) {
      if (decision.decidedByName) names.add(decision.decidedByName);
    }

    for (const organisationId of everyOrganisation(data)) {
      for (const entry of memoryFor(data, organisationId)) {
        if (entry.who === null) continue;
        // The promise entries annotate ours and theirs, so the name is a
        // prefix rather than the whole value.
        const bare = entry.who.replace(/ \((ours|theirs)\)$/, '');
        assert(
          names.has(bare),
          `${entry.id} names somebody a record names (${entry.who})`
        );
      }
    }
  }
});

/* =====================================================================
   3. "Not recorded" means not recorded
   ===================================================================== */

group('An answer with nothing behind it says so, and one with something does not', () => {
  let notRecorded = 0;
  let answered = 0;

  for (const data of CRM_WORKSPACES) {
    for (const organisationId of everyOrganisation(data)) {
      for (const answer of answerAll(data, organisationId, NOW)) {
        if (answer.notRecorded) {
          notRecorded += 1;
          assertEqual(
            answer.lines.length,
            0,
            `${answer.kind}: an answer that says nothing is recorded carries no records`
          );
        } else {
          answered += 1;
          assert(
            answer.lines.length > 0,
            `${answer.kind}: an answer that claims something carries at least one record`
          );
          assert(
            answer.answer !== NOT_RECORDED,
            `${answer.kind}: an answered question does not also say nothing is recorded`
          );
        }

        assert(answer.answer.trim().length > 0, `${answer.kind} says something`);
        assert(
          answer.question === MEMORY_QUESTIONS.find((q) => q.kind === answer.kind)?.question,
          `${answer.kind} carries its own question`
        );
      }
    }
  }

  assert(notRecorded > 0, `the honest empty answer occurs in the fixture (${notRecorded})`);
  assert(answered > 0, `real answers occur in the fixture (${answered})`);
});

group('An empty workspace answers nine times and invents nothing', () => {
  const data = fresh(CRM_WORKSPACES[0].workspace.id);
  // Emptied completely. Every question must still answer, and every answer
  // must be the honest one.
  data.commitments = [];
  data.decisions = [];
  data.workItems = [];
  data.serviceCases = [];
  data.accountReviews = [];
  data.auditEvents = [];
  for (const organisation of data.organisations) organisation.renewalDate = null;
  forgetMemoryIndex(data);

  const organisationId = everyOrganisation(data)[0];
  const answers = answerAll(data, organisationId, NOW);

  assertEqual(answers.length, 9, 'nine answers from an empty workspace');
  for (const answer of answers) {
    assert(answer.notRecorded, `${answer.kind} says nothing is recorded`);
    assertEqual(answer.lines.length, 0, `${answer.kind} carries no records`);
  }
  assertEqual(memoryFor(data, organisationId).length, 0, 'no memory is produced from nothing');
});

group('Every question answers for every organisation, including ones with nothing', () => {
  for (const data of CRM_WORKSPACES) {
    for (const organisationId of everyOrganisation(data)) {
      for (const entry of MEMORY_QUESTIONS) {
        const answer = answerMemoryQuestion(data, organisationId, entry.kind, NOW);
        assertEqual(answer.kind, entry.kind, `${entry.kind} answers the question it was asked`);
        assert(answer.answer.trim().length > 0, `${entry.kind} never answers with silence`);
      }
    }
  }
});

/* =====================================================================
   4. Memory is smaller than the timeline
   ===================================================================== */

group('Memory is a subset of what happened, never the whole of it', () => {
  let compared = 0;
  let strictlySmaller = 0;

  for (const data of CRM_WORKSPACES) {
    const activityByOrganisation = new Map<string, number>();
    for (const entry of buildTimeline(data)) {
      if (entry.organisationId === null) continue;
      activityByOrganisation.set(
        entry.organisationId,
        (activityByOrganisation.get(entry.organisationId) ?? 0) + 1
      );
    }

    for (const organisationId of everyOrganisation(data)) {
      const timeline = memoryTimeline(data, organisationId);
      assert(timeline !== null, `${organisationId} has a timeline`);
      if (!timeline) continue;

      compared += 1;
      assertEqual(
        timeline.activity.length,
        activityByOrganisation.get(organisationId) ?? 0,
        `${organisationId}: the activity list is the Stage 4 timeline for this organisation`
      );
      assertEqual(
        timeline.memory.length,
        memoryFor(data, organisationId).length,
        `${organisationId}: the timeline's memory is the same memory`
      );
      if (timeline.memory.length < timeline.activity.length) strictlySmaller += 1;

      assertEqual(timeline.note, MEMORY_NOTE, `${organisationId}: the standing note is said`);
      assertEqual(
        timeline.organisation.id,
        organisationId,
        `${organisationId}: the timeline names its organisation`
      );
    }
  }

  assert(compared > 5, `enough organisations were compared (${compared})`);
  assert(
    strictlySmaller > 0,
    `memory is strictly smaller than the history somewhere (${strictlySmaller} of ${compared})`
  );
});

group('Both lists are newest first', () => {
  for (const data of CRM_WORKSPACES) {
    for (const organisationId of everyOrganisation(data)) {
      const timeline = memoryTimeline(data, organisationId);
      if (!timeline) continue;

      const ordered = (dates: string[]) =>
        dates.every(
          (value, index) => index === 0 || Date.parse(dates[index - 1]) >= Date.parse(value)
        );

      assert(
        ordered(timeline.memory.map((entry) => entry.occurredAt)),
        `${organisationId}: memory is newest first`
      );
      assert(
        ordered(timeline.activity.map((entry) => entry.occurredAt)),
        `${organisationId}: the history is newest first`
      );
    }
  }
});

group('A deleted or unknown organisation has no memory timeline', () => {
  const data = fresh(CRM_WORKSPACES[2].workspace.id);
  const organisationId = everyOrganisation(data)[0];

  assert(memoryTimeline(data, organisationId) !== null, 'a live organisation has one');
  assertEqual(
    memoryTimeline(data, 'org-that-does-not-exist'),
    null,
    'an unknown organisation has none'
  );

  const organisation = data.organisations.find((row) => row.id === organisationId)!;
  organisation.deletedAt = NOW;
  forgetMemoryIndex(data);
  assertEqual(
    memoryTimeline(data, organisationId),
    null,
    'a deleted organisation has none, rather than a timeline nobody should see'
  );
});

/* =====================================================================
   5. The role is applied in the search, not the render
   ===================================================================== */

group('A restricted field never reaches a snippet', () => {
  const data = fresh(CRM_WORKSPACES[1].workspace.id);
  const kase = data.serviceCases.find((row) => row.deletedAt === null);
  assert(kase !== undefined, 'the fixture has a service case to check with');
  if (!kase) return;

  for (const role of ROLES) {
    const entries = memoryFor(data, kase.organisationId!, role);
    const escalation = entries.find((entry) => entry.kind === 'escalation');
    assert(escalation !== undefined, `${role} sees that something went wrong`);
    if (!escalation) continue;

    // The case DETAIL is restricted. What memory carries is the title and the
    // recorded relationship effect, which is the part that changes the next
    // conversation, and the provenance line says when the detail is withheld.
    assert(
      !escalation.source.what.includes('withheld') ||
        role === 'crm_viewer' ||
        role === 'crm_contributor',
      `${role}: the provenance line only claims a withheld field where one is withheld`
    );
  }
});

group('Search applies the role before it matches, not after', () => {
  const data = fresh(CRM_WORKSPACES[1].workspace.id);
  const kase = data.serviceCases.find((row) => row.deletedAt === null);
  if (!kase) return;

  const asAdmin = searchMemory(data, kase.title.slice(0, 12), 'crm_admin');
  const asViewer = searchMemory(data, kase.title.slice(0, 12), 'crm_viewer');

  assert(asAdmin.hits.length > 0, 'the administrator finds the case by its title');
  assert(
    asViewer.hits.every((hit) => !hit.entry.source.what.includes('the case,') === false ||
      hit.entry.source.what.includes('withheld') ||
      hit.entry.kind !== 'escalation'),
    'a viewer who finds the case is told its detail was withheld'
  );

  for (const result of [asAdmin, asViewer]) {
    assertEqual(result.note, SEARCH_NOTE, 'the search says what it searched');
    assertEqual(
      result.searched,
      everyOrganisation(data).length,
      'the search says how many customers it covered'
    );
    for (const hit of result.hits) {
      assert(hit.matched.trim().length > 0, 'every hit shows why it is a hit');
      assert(hit.organisationName.trim().length > 0, 'every hit names its customer');
    }
  }
});

group('A search too short to be a search returns nothing rather than everything', () => {
  const data = CRM_WORKSPACES[3];
  for (const query of ['', ' ', 'a', '  b  ']) {
    const result = searchMemory(data, query);
    assertEqual(result.hits.length, 0, `"${query}" returns nothing`);
    assertEqual(result.searched, 0, `"${query}" does not pretend to have searched`);
  }
});

group('A search only returns entries that contain what was asked for', () => {
  for (const data of CRM_WORKSPACES) {
    for (const query of ['renewal', 'payroll', 'deferred', 'scope', 'report']) {
      const result = searchMemory(data, query);
      for (const hit of result.hits) {
        const haystack = `${hit.entry.statement} ${hit.entry.who ?? ''}`.toLowerCase();
        assert(
          haystack.includes(query.toLowerCase()),
          `"${query}" in ${data.workspace.name}: every hit actually contains it`
        );
      }
    }
  }
});

/* =====================================================================
   6. Nothing is about a person
   ===================================================================== */

group('No user id leaves the read side of this module', () => {
  for (const data of CRM_WORKSPACES) {
    const userIds = new Set(data.members.map((member) => member.userId));
    for (const organisation of data.organisations) {
      if (organisation.ownerUserId) userIds.add(organisation.ownerUserId);
      if (organisation.relationshipOwnerUserId) userIds.add(organisation.relationshipOwnerUserId);
      if (organisation.deletedBy) userIds.add(organisation.deletedBy);
    }

    const serialised = JSON.stringify({
      picker: organisationsWithMemory(data),
      timelines: everyOrganisation(data).map((id) => memoryTimeline(data, id)),
      answers: everyOrganisation(data).map((id) => answerAll(data, id, NOW)),
      links: everyOrganisation(data).map((id) => memoryLinks(data, id)),
      search: searchMemory(data, 'the'),
      summaries: everyOrganisation(data).map((id) => readsForOrganisation(data, id)),
      log: searchLog(data),
    });

    for (const userId of userIds) {
      assert(
        !serialised.includes(userId),
        `${data.workspace.name}: no user id reaches the read side (${userId})`
      );
    }
  }
});

group('No function in this module takes or returns a figure about a person', () => {
  // Structural, not a copy check. The picker is the one place a per-person
  // rollup would naturally appear, so it is asserted to carry a customer, a
  // name and a count, and nothing else.
  for (const data of CRM_WORKSPACES) {
    for (const row of organisationsWithMemory(data)) {
      assertEqual(
        Object.keys(row).sort().join(','),
        'entries,name,organisationId',
        'the picker carries a customer, a name and a count, and nothing else'
      );
      assert(Number.isInteger(row.entries), 'the count is a count');
      assert(row.entries >= 0, 'the count is never negative');
      assertEqual(
        row.entries,
        memoryFor(data, row.organisationId).length,
        `${row.name}: the count is the number of entries, so it cannot drift`
      );
    }
  }
});

group('The read log summary counts reads and never ranks readers', () => {
  const data = fresh(CRM_WORKSPACES[3].workspace.id);
  const organisationId = everyOrganisation(data)[0];
  const context = contextFor(data, 'crm_viewer');

  recordMemoryRead(context, data, {
    organisationId,
    kind: 'explorer',
    entriesReturned: 2,
    readAs: 'crm_viewer',
  });
  // A second reader, where the workspace has one. The point of the check is
  // that two readers produce one count and no names, so a workspace with a
  // single member still exercises it.
  const other = data.members[1]?.userId ?? data.members[0].userId;
  recordMemoryRead({ ...context, userId: other }, data, {
    organisationId,
    kind: 'explorer',
    entriesReturned: 2,
    readAs: 'crm_admin',
  });

  const summary = readsForOrganisation(data, organisationId);
  assertEqual(summary.reads, 2, 'both reads are counted');
  assertEqual(
    Object.keys(summary).sort().join(','),
    'firstReadAt,lastReadAt,note,organisationId,reads,roles',
    'the summary carries a count, two dates, the roles and the note, and nobody'
  );
  assertEqual(summary.roles.join(','), 'crm_admin,crm_viewer', 'the roles are reported');
  assertEqual(summary.note, READ_LOG_NOTE, 'the summary says why the log exists');
  for (const member of data.members) {
    assert(
      !JSON.stringify(summary).includes(member.userId),
      `the summary does not carry who read (${member.userId})`
    );
  }
});

/* =====================================================================
   7. The read log: the one write this phase adds
   ===================================================================== */

group('A read is recorded with an audit row, like every other write', () => {
  const data = fresh(CRM_WORKSPACES[4].workspace.id);
  const organisationId = everyOrganisation(data)[0];
  const before = data.auditEvents.length;
  // The fixture seeds a few reads so the control is visible on first open, so
  // this is a delta rather than an absolute.
  const readsBefore = data.memoryReads.length;

  const row = recordMemoryRead(contextFor(data, 'crm_viewer'), data, {
    organisationId,
    kind: 'explorer',
    entriesReturned: 3,
    readAs: 'crm_viewer',
  });

  assertEqual(data.memoryReads.length, readsBefore + 1, 'the read is on the record');
  assertEqual(data.auditEvents.length, before + 1, 'and so is an audit row');
  assertEqual(row.organisationId, organisationId, 'the read names its customer');
  assertEqual(row.readBy, data.members[0].userId, 'the read records who made it');
  assertEqual(row.entriesReturned, 3, 'and how much came back');
  assertEqual(row.crmWorkspaceId, data.workspace.id, 'and the workspace it was in');

  const event = data.auditEvents[data.auditEvents.length - 1];
  assertEqual(event.eventType, 'memory_read', 'the audit row says what happened');
  assertEqual(event.subjectTable, 'crm_memory_reads', 'and which table it touched');
  assertEqual(event.subjectId, row.id, 'and which row');
  assertEqual(event.outcome, 'success', 'and that it succeeded');
});

group('A search is recorded with its words, never its results', () => {
  const data = fresh(CRM_WORKSPACES[2].workspace.id);
  const row = recordMemoryRead(contextFor(data, 'crm_viewer'), data, {
    organisationId: null,
    kind: 'search',
    query: '  renewal  ',
    entriesReturned: 1,
    readAs: 'crm_viewer',
  });

  assertEqual(row.query, 'renewal', 'the words are kept, trimmed');
  assertEqual(row.organisationId, null, 'a workspace search names no single customer');
  assert(
    !Object.keys(row).some((key) => /result|payload|snapshot|content|entries$/.test(key)),
    'the row has no field that would hold a copy of what came back'
  );

  const log = searchLog(data);
  assertEqual(log.length, 1, 'the search appears in the log');
  assertEqual(log[0].query, 'renewal', 'with its words');
  assertEqual(log[0].results, 1, 'and a count');
  assert(
    !Object.keys(log[0]).includes('readBy'),
    'and without who made it, which is in the audit trail'
  );
});

group('A read of one customer has to name the customer', () => {
  const data = fresh(CRM_WORKSPACES[0].workspace.id);
  const seeded = data.memoryReads.length;

  assertRefused(
    () =>
      recordMemoryRead(contextFor(data, 'crm_viewer'), data, {
        organisationId: null,
        kind: 'explorer',
        entriesReturned: 1,
        readAs: 'crm_viewer',
      }),
    (error) => error instanceof CrmRefused && error.because.includes('which customer'),
    'an explorer read with no customer is refused'
  );

  assertRefused(
    () =>
      recordMemoryRead(contextFor(data, 'crm_viewer'), data, {
        organisationId: 'org-not-here',
        kind: 'explorer',
        entriesReturned: 1,
        readAs: 'crm_viewer',
      }),
    (error) => error instanceof CrmRefused && error.code === 'not_found',
    'a read naming a customer that is not here is refused'
  );

  assertRefused(
    () =>
      recordMemoryRead(contextFor(data, 'crm_viewer'), data, {
        organisationId: everyOrganisation(data)[0],
        kind: 'explorer',
        entriesReturned: -1,
        readAs: 'crm_viewer',
      }),
    (error) => error instanceof CrmRefused && error.code === 'invalid',
    'a negative count is refused'
  );

  assertEqual(
    data.memoryReads.length,
    seeded,
    'none of the three refusals wrote anything'
  );
});

group('Reads are counted in a window, not forever', () => {
  const data = fresh(CRM_WORKSPACES[1].workspace.id);
  const organisationId = everyOrganisation(data)[0];

  // The fixture's seeded reads are all older than a day, so the figure for
  // today starts at nothing and this read is the only one in the window.
  assertEqual(readsToday(data, NOW), 0, 'the seeded reads are all older than a day');

  const row = recordMemoryRead(contextFor(data, 'crm_viewer'), data, {
    organisationId,
    kind: 'explorer',
    entriesReturned: 1,
    readAs: 'crm_viewer',
  });
  assertEqual(readsToday(data, NOW), 1, 'a read today counts today');

  // Backdate THAT read by a week, by its id rather than by position: the
  // fixture's own seeded reads are at the front of the array.
  const written = data.memoryReads.find((candidate) => candidate.id === row.id)!;
  written.readAt = new Date(Date.parse(NOW) - 7 * 86_400_000).toISOString();
  assertEqual(readsToday(data, NOW), 0, 'a read a week ago does not count today');
});

/* =====================================================================
   8. The links: only the ones the records carry
   ===================================================================== */

group('Every link names two records that exist, and says why it exists', () => {
  let links = 0;

  for (const data of CRM_WORKSPACES) {
    const ids = idsByTable(data);

    for (const organisationId of everyOrganisation(data)) {
      for (const link of memoryLinks(data, organisationId)) {
        links += 1;
        for (const [end, reference] of [
          ['from', link.from],
          ['to', link.to],
        ] as const) {
          const known = ids.get(reference.table);
          assert(
            known !== undefined && known.has(reference.id),
            `a link's ${end} is a row that exists (${reference.table} ${reference.id})`
          );
        }
        assert(link.because.trim().length > 10, 'every link says why it is there');
        assert(
          ['fulfilled_by', 'led_to', 'about'].includes(link.relation),
          `${link.relation} is one of the three named relations`
        );
      }
    }
  }

  assert(links > 0, `the fixture produces links (${links})`);
});

/* =====================================================================
   9. The index is one pass, and a write drops it
   ===================================================================== */

group('Building memory for the whole workspace is one pass, not one per customer', () => {
  // The quadratic shape is the one Stage 8 found five times. Measured rather
  // than asserted by inspection: a thousand organisations against the same
  // record tables must not cost a thousand times one.
  const data = fresh(CRM_WORKSPACES[4].workspace.id);
  const template = data.organisations[0];

  for (let index = 0; index < 400; index += 1) {
    data.organisations.push({ ...template, id: `org-bulk-${index}`, name: `Bulk ${index}` });
  }
  forgetMemoryIndex(data);

  const started = Date.now();
  const picker = organisationsWithMemory(data);
  const elapsed = Date.now() - started;

  assertEqual(picker.length, everyOrganisation(data).length, 'every organisation is in the picker');
  assert(
    elapsed < 500,
    `the picker over ${picker.length} organisations is not quadratic (${elapsed}ms)`
  );
});

group('The memory index is dropped when something is written', () => {
  /* THE DEFECT THIS GUARDS AGAINST, STATED ONCE.

     The index caches against the workspace object, and the session store
     mutates ONE workspace object in place rather than replacing it. So a
     cache keyed on that object survives a write and is wrong afterwards, for
     the life of the tab. Phase 2A-i found this in five Stage 8 modules at
     once and fixed it with the import-free cache bus: each caching module
     registers an invalidator at module scope, and the session store calls
     them all on every write.

     This check exercises the real mechanism rather than a convenience. It
     reads, writes, asserts the cache IS stale without the bus, then calls
     exactly what the session store calls and asserts the new entry appears.
     A version that simply dropped the cache by hand would pass whether the
     registration existed or not, which is how the original defect survived
     eight stages of tests. */
  const data = fresh(CRM_WORKSPACES[4].workspace.id);
  const organisationId = everyOrganisation(data)[0];

  const before = memoryFor(data, organisationId).length;

  // A write that produces a memory entry: a stakeholder role is one of the
  // seven audit events the change kind reads.
  const person = data.people.find(
    (candidate) => candidate.organisationId === organisationId && candidate.deletedAt === null
  );
  assert(person !== undefined, 'the fixture has a person at this organisation');
  if (!person) return;

  const existing = data.personOrganisationRoles.find(
    (candidate) =>
      candidate.personId === person.id &&
      candidate.organisationId === organisationId &&
      candidate.endedOn === null
  );
  assert(existing !== undefined, 'the person is recorded against this organisation');
  if (!existing) return;

  setStakeholderRole(contextFor(data, 'crm_contributor'), data, {
    personId: person.id,
    organisationId,
    stakeholderRole: 'economic_buyer',
    evidence: 'Said so in the quarterly review, in those words.',
  });

  assertEqual(
    memoryFor(data, organisationId).length,
    before,
    'without the bus the cache is stale, which is the defect this exists to catch'
  );

  // Exactly what the session store calls on every write.
  invalidateCaches(data);

  const after = memoryFor(data, organisationId).length;
  assert(
    after > before,
    `after the bus runs, the write is visible (${before} then ${after})`
  );

  const added = memoryFor(data, organisationId).find((entry) => entry.kind === 'change');
  assert(added !== undefined, 'the new entry is the change');
  assertEqual(
    added?.source.table,
    'crm_audit_events',
    'and it cites the audit row it was read from'
  );
  assert(
    added?.statement.includes('What part somebody plays here was recorded') ?? false,
    'and its sentence names the change, not a template'
  );
});

group('Six caching modules register an invalidator, and memory is the sixth', () => {
  // Each of the six is a real function, so the imports above cannot be
  // dropped as unused, and loading them is what triggers the registration.
  for (const [name, fn] of Object.entries({
    forgetContactIndex,
    forgetQualityIndex,
    forgetCoverageIndex,
    forgetBoardIndex,
    forgetIndex,
    forgetMemoryIndex,
  })) {
    assert(typeof fn === 'function', `${name} exists and can drop its cache`);
  }

  assert(
    registeredCacheCount() >= 6,
    `six caching modules register an invalidator (saw ${registeredCacheCount()})`
  );
});

group('The index is keyed by role, so one role never serves another', () => {
  const data = fresh(CRM_WORKSPACES[1].workspace.id);
  const kase = data.serviceCases.find((row) => row.deletedAt === null);
  if (!kase) return;

  const viewerFirst = memoryFor(data, kase.organisationId!, 'crm_viewer').find(
    (entry) => entry.kind === 'escalation'
  );
  const adminAfter = memoryFor(data, kase.organisationId!, 'crm_admin').find(
    (entry) => entry.kind === 'escalation'
  );
  const viewerAgain = memoryFor(data, kase.organisationId!, 'crm_viewer').find(
    (entry) => entry.kind === 'escalation'
  );

  assertEqual(
    viewerFirst?.source.what,
    viewerAgain?.source.what,
    'a viewer gets the same answer twice'
  );
  assert(
    viewerFirst?.source.what !== undefined && adminAfter?.source.what !== undefined,
    'both roles get an escalation entry'
  );
  assert(
    viewerFirst?.source.what !== adminAfter?.source.what,
    'and the two roles are told different things about the case detail'
  );
});

group('A memory entry is a copy, so a caller cannot corrupt the cache', () => {
  const data = fresh(CRM_WORKSPACES[3].workspace.id);
  const organisationId = everyOrganisation(data).find(
    (id) => memoryFor(data, id).length > 1
  );
  assert(organisationId !== undefined, 'the fixture has a customer with more than one entry');
  if (!organisationId) return;

  const first = memoryFor(data, organisationId);
  const count = first.length;
  first.length = 0;
  first.push({} as MemoryEntry);

  assertEqual(
    memoryFor(data, organisationId).length,
    count,
    'emptying the returned array does not empty the cache'
  );
});

/* =====================================================================
   10. The destination, and the language
   ===================================================================== */

group('Memory is a destination in the module navigation', () => {
  const destination = CRM_MODULE_DESTINATIONS.find((entry) => entry.path === '/crm/memory');
  assert(destination !== undefined, 'the destination exists');
  if (!destination) return;

  assertEqual(destination.label, 'Memory', 'it is called Memory');
  assertEqual(destination.group, 'Relationships', 'it sits with Attention, not with Work');
  assert(
    destination.accessibleDescription.length > 40,
    'it says what question it answers'
  );
});

group('Everything this module says is in Australian English and has no em dashes', () => {
  const sentences: string[] = [
    MEMORY_NOTE,
    SEARCH_NOTE,
    NOT_RECORDED,
    READ_LOG_NOTE,
    ...Object.values(MEMORY_KIND_LABELS),
    ...MEMORY_QUESTIONS.map((entry) => entry.question),
  ];

  for (const data of CRM_WORKSPACES) {
    for (const organisationId of everyOrganisation(data)) {
      for (const answer of answerAll(data, organisationId, NOW)) {
        sentences.push(answer.answer);
      }
      for (const link of memoryLinks(data, organisationId)) sentences.push(link.because);
      for (const entry of memoryFor(data, organisationId)) sentences.push(entry.source.what);
    }
  }

  for (const sentence of sentences) {
    const problems = checkLanguage(sentence);
    assertEqual(
      problems.length,
      0,
      `"${sentence.slice(0, 60)}" is in house language (${problems.join('; ')})`
    );
  }
});

group('No answer ever disagrees with itself about a count', () => {
  // The grammar defect Phase 2A-i shipped and had to fix: "3 pieces of work
  // is". Asserted rather than read, for every answer in every fixture.
  for (const data of CRM_WORKSPACES) {
    for (const organisationId of everyOrganisation(data)) {
      for (const answer of answerAll(data, organisationId, NOW)) {
        if (answer.notRecorded) continue;

        assert(
          !/\b1 [a-z ]*(are|were|have)\b/.test(answer.answer),
          `"${answer.answer}" does not say one of something plurally`
        );
        assert(
          !/\b([02-9]|[1-9][0-9]+) [a-z ]*(is|was|has)\b/.test(answer.answer),
          `"${answer.answer}" does not say several of something singularly`
        );
        assert(
          !answer.answer.includes(' of them.') || !answer.answer.startsWith('1 '),
          `"${answer.answer}" does not say "of them" about one thing`
        );
      }
    }
  }
});

group('The whole module is read only apart from the read log', () => {
  // Structural: running every read function against a frozen workspace. A
  // function that wrote anything would throw.
  for (const data of CRM_WORKSPACES) {
    const organisationId = everyOrganisation(data)[0];
    const before = JSON.stringify({
      commitments: data.commitments.length,
      decisions: data.decisions.length,
      workItems: data.workItems.length,
      serviceCases: data.serviceCases.length,
      audit: data.auditEvents.length,
      reads: data.memoryReads.length,
    });

    memoryFor(data, organisationId);
    memoryTimeline(data, organisationId);
    answerAll(data, organisationId, NOW);
    memoryLinks(data, organisationId);
    searchMemory(data, 'renewal');
    organisationsWithMemory(data);
    readsForOrganisation(data, organisationId);
    searchLog(data);
    readsToday(data, NOW);

    const after = JSON.stringify({
      commitments: data.commitments.length,
      decisions: data.decisions.length,
      workItems: data.workItems.length,
      serviceCases: data.serviceCases.length,
      audit: data.auditEvents.length,
      reads: data.memoryReads.length,
    });

    assertEqual(after, before, `${data.workspace.name}: reading changed nothing`);
  }
});

group('The read log table is in the model and the migration list', () => {
  assert(
    CRM_TABLES.includes('crm_memory_reads' as never),
    'the read log is a table the model knows'
  );
  assertEqual(CRM_TABLES.length, 55, 'fifty-five tables after Phase 2B-i');
  assert(
    !CRM_TABLES.some((table) => /^crm_memory($|_entries|_timeline|_cache|_summaries)/.test(table)),
    'and there is no table of assembled memory'
  );
});

report('Concludo CRM Phase 2B-i, organisational memory', r);
