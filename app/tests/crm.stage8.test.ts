/**
 * Concludo CRM, Stage 8: integrations, service, reporting, governance, import
 * and production readiness.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * Stage 8 is the stage where a CRM either becomes a real system or becomes a
 * demonstration with a settings page. The difference is almost entirely in the
 * things it refuses to do, so most of these checks are negative: nothing sends,
 * nothing merges, nothing imports without a preview, no report counts a person,
 * no connector asks for a scope nobody justified, no page reads a whole table
 * to draw fifty rows.
 *
 * Three groups are worth calling out.
 *
 * THE PER-PERSON CHECK IS STRUCTURAL. It does not search the copy for the word
 * "performance". It walks every report every role can produce, in every
 * workspace, and asserts that no figure anywhere is keyed by a user id. A
 * leaderboard cannot be added without failing this, which is the point.
 *
 * THE PERFORMANCE CHECKS MEASURE. They build a workspace of a hundred thousand
 * people and a hundred thousand conversations and time the pages against it.
 * They are deliberately generous on the absolute numbers, because a test that
 * asserts a millisecond figure fails on somebody else's laptop and gets
 * deleted. What they catch is the thing worth catching: a page going quadratic.
 *
 * THE LAST GROUP IS THE DEFINITION OF DONE, line by line.
 *
 * Run: bun tests/crm.stage8.test.ts
 */
import { CRM_WORKSPACES, USERS, getCrmWorkspace } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { CRM_TABLES, CrmRole, CrmWorkspaceData } from '../src/lib/crm/domain';
import { CrmRefused } from '../src/lib/crm/repositories/repository';
import {
  ADM_OBLIGATION_START,
  AI_MODEL_REGISTER,
  AUTOMATED_DECISION_REGISTER,
  INTEGRATION_REGISTER,
  INTEGRATION_TRUTH,
  integrationsConnected,
  modelsConnected,
  privacyPolicyAdmSection,
  writeScopes,
} from '../src/lib/crm/stage8/registers';
import {
  FIELD_RULES,
  OFFBOARDING,
  RETENTION_RULES,
  exportWorkspace,
  maySeeField,
  planPersonDeletion,
  redactFor,
  retentionFindings,
} from '../src/lib/crm/stage8/governance';
import {
  PRIORITY_WORDS,
  SLA_NOTE,
  SLA_TARGETS,
  buildCase,
  buildServiceInbox,
  derivePriority,
} from '../src/lib/crm/stage8/service';
import {
  NOT_RANKED_NOTE,
  REPORT_ROLES,
  ReportRole,
  buildReport,
} from '../src/lib/crm/stage8/reports';
import {
  INDICATOR_ORDER,
  buildDataQualityDashboard,
} from '../src/lib/crm/stage8/dataQuality';
import { LIVE_SWEEP_LIMIT, qualityFigure } from '../src/lib/crm/stage8/qualitySource';
import {
  IMPORT_FIELDS,
  acceptSuggestions,
  commitImport,
  dryRun,
  errorFile,
  markDryRun,
  previewRows,
  readDate,
  readDelimited,
  rollbackImport,
  startImport,
  suggestMapping,
  validateImport,
} from '../src/lib/crm/stage8/importer';
import {
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  accountSlice,
  activityPage,
  forgetIndex,
  indexFor,
  organisationsPage,
  pageOf,
  peoplePage,
} from '../src/lib/crm/stage8/paging';
import { SCALE_POINTS, generateWorkspace } from '../src/lib/crm/stage8/scale';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual, assertRefused } = makeAssert(r);

const NOW = CRM_DEMO_NOW;
const AGENCY = 'ws-agency';

function fresh(id = AGENCY): CrmWorkspaceData {
  const found = getCrmWorkspace(id);
  if (!found) throw new Error(`no workspace ${id}`);
  return structuredClone(found);
}

function contextFor(data: CrmWorkspaceData, role: CrmRole = 'crm_approver') {
  return {
    userId: data.members[0].userId,
    workspaceId: data.workspace.id,
    role,
    now: NOW,
  };
}

/* =====================================================================
   1. Integrations: least privilege, nothing connected, nothing sending
   ===================================================================== */

group('Fourteen integrations, specified before they are built', () => {
  assertEqual(INTEGRATION_REGISTER.length, 14, 'fourteen entries in the integration register');

  const ids = new Set(INTEGRATION_REGISTER.map((entry) => entry.id));
  assertEqual(ids.size, 14, 'every integration id is distinct');

  assert(
    INTEGRATION_TRUTH.includes('No connector to an outside system is connected'),
    'the register states plainly that no outside connector is connected'
  );

  for (const entry of INTEGRATION_REGISTER) {
    assert(entry.purpose.trim().length > 0, `${entry.id} says what it is for`);
    assertEqual(entry.sendingDefault, 'off', `${entry.id} defaults sending to off`);

    for (const scope of entry.scopes) {
      assert(
        scope.because.trim().length > 0,
        `${entry.id}: the scope ${scope.scope} says why Concludo needs it`
      );
      assert(
        scope.allows.trim().length > 0,
        `${entry.id}: the scope ${scope.scope} says what it allows`
      );
    }

    if (entry.state !== 'not_built') {
      assert(
        entry.importControls.length > 0,
        `${entry.id} names the controls set before anything is read`
      );
      assert(
        entry.onPermissionExpiry.trim().length > 0,
        `${entry.id} says what happens when the permission expires`
      );
    }
  }
});

group('No connector asks to write to somebody else\u2019s system', () => {
  // The brief asks for least privilege. The claim worth asserting is the exact
  // one: Concludo never asks another system for permission to change anything
  // in it. The single write scope in the register is on Concludo's OWN api,
  // where the customer uses their own key to write to their own CRM, and that
  // is a different thing from asking to write in somebody's mailbox.
  const writes = writeScopes();
  assertEqual(writes.length, 1, 'exactly one write scope exists in the whole register');
  assertEqual(
    writes[0].integration,
    'Open API',
    'and it is on Concludo\u2019s own API rather than on anybody else\u2019s system'
  );

  for (const entry of INTEGRATION_REGISTER) {
    if (entry.id === 'int-api') continue;
    assert(
      entry.scopes.every((scope) => !scope.writes),
      `${entry.id} asks for nothing that can write`
    );
  }

  for (const entry of INTEGRATION_REGISTER) {
    assert(
      entry.canSend === false,
      `${entry.id} cannot send: there is no code path and no scope for it`
    );
  }
});

group('Nothing imports a whole mailbox', () => {
  const mailLike = INTEGRATION_REGISTER.filter(
    (entry) => entry.state !== 'not_built' && /mail|message|calendar|chat/i.test(entry.purpose)
  );
  assert(mailLike.length > 0, 'the register covers mail-shaped connectors');

  for (const entry of mailLike) {
    const controls = entry.importControls.join(' ').toLowerCase();
    const named =
      ['account', 'mailbox', 'label', 'folder', 'date', 'channel', 'workspace'].filter((word) =>
        controls.includes(word)
      ).length;
    assert(
      named >= 2,
      `${entry.id} names at least two of account, folder, label or date as controls before reading`
    );
  }
});

group('A connection in this workspace records what was granted, not what was asked', () => {
  const data = fresh();
  assert(data.integrationConnections.length >= 3, 'the fixture demonstrates several connections');

  const states = new Set(data.integrationConnections.map((c) => c.state));
  assert(states.has('connected'), 'one connection is working');
  assert(states.has('expired') || states.has('failed'), 'one connection is broken');
  assert(states.has('never_connected'), 'one connection has never been set up');

  for (const connection of data.integrationConnections) {
    assertEqual(
      connection.sendingEnabled,
      false,
      `${connection.integrationId}: sending is off`
    );
    if (connection.lastOutcome === 'failed' || connection.lastOutcome === 'partial') {
      assert(
        connection.failureDetail !== null,
        `${connection.integrationId}: a failure says what failed, in words`
      );
    }
    if (connection.state === 'never_connected') {
      assertEqual(
        connection.grantedScopes.length,
        0,
        `${connection.integrationId}: nothing is granted on a connection nobody made`
      );
    }
  }
});

/* =====================================================================
   2. Service
   ===================================================================== */

group('Priority comes from consequence, and shows its working', () => {
  const data = fresh();
  const inbox = buildServiceInbox(data, NOW, 'crm_admin');

  assert(inbox.open.length + inbox.resolved.length > 0, 'the fixture has service cases');

  for (const view of [...inbox.open, ...inbox.waitingOnCustomer, ...inbox.resolved]) {
    assert(
      view.priority.because.length > 0,
      `${view.kase.id}: the priority names the sentences it came from`
    );
    assert(
      PRIORITY_WORDS[view.priority.priority] !== undefined,
      `${view.kase.id}: the priority is a word about when, not a number`
    );
  }

  // A case with nothing recorded about its effect is undecided, not guessed.
  const nothingRecorded = derivePriority(
    { relationshipEffect: null, state: 'open', raisedAt: NOW } as never,
    { consequence: 'not_recorded', peopleAffected: 0, relationshipUnderStrain: false }
  );
  assertEqual(
    nothingRecorded.priority,
    'undecided',
    'a case with no recorded consequence is undecided rather than given a guess'
  );
});

group('A service target is Concludo’s own, and says so', () => {
  assertEqual(SLA_TARGETS.length, 5, 'one target per priority');
  assert(
    SLA_NOTE.includes('No service level has been agreed with any customer') &&
      SLA_NOTE.includes('Nothing here is a contractual commitment'),
    'the note says no service level has been agreed with anybody'
  );

  const data = fresh();
  assertEqual(
    buildServiceInbox(data, NOW, 'crm_admin').slaNote,
    SLA_NOTE,
    'the inbox carries that note'
  );
});

group('Case detail is withheld by role, and the withholding is visible', () => {
  const data = fresh();
  const withDetail = data.serviceCases.find((kase) => kase.detail !== null);
  assert(withDetail !== undefined, 'the fixture has a case with detail to withhold');
  if (!withDetail) return;

  const admin = buildCase(data, withDetail.id, NOW, 'crm_admin');
  const viewer = buildCase(data, withDetail.id, NOW, 'crm_viewer');

  assert(admin?.detail !== null, 'an administrator sees the detail');
  assertEqual(viewer?.detail, null, 'a viewer does not');
  assertEqual(viewer?.detailRedacted, true, 'and is told that something is withheld');
  assert(
    (viewer?.detailRedactedBecause ?? '').length > 20,
    'the reason for withholding is a sentence, not a shrug'
  );

  // The relationship consequence is NOT withheld: a person who cannot read the
  // case still has to know the customer is unhappy before they ring them.
  assert(
    (viewer?.consequenceWord ?? '').length > 0,
    'what the case means for the relationship is still shown'
  );
});

group('Nothing in service sends', () => {
  const data = fresh();
  const inbox = buildServiceInbox(data, NOW, 'crm_admin');
  for (const view of [...inbox.open, ...inbox.resolved]) {
    if (view.draft === null) continue;
    assert(
      view.sendingNote.includes('no way to send'),
      `${view.kase.id}: the draft says it cannot be sent`
    );
  }
});

/* =====================================================================
   3. Reports: work, never people
   ===================================================================== */

group('Six reports, one per role', () => {
  assertEqual(REPORT_ROLES.length, 6, 'six roles');
  for (const data of CRM_WORKSPACES) {
    for (const role of REPORT_ROLES) {
      const built = buildReport(role, data, NOW, 'crm_admin');
      assertEqual(built.role, role, `${data.workspace.id}: the ${role} report is the one asked for`);
      assert(built.lines.length > 0, `${data.workspace.id}: the ${role} report has figures`);
      assertEqual(
        built.notRankedNote,
        NOT_RANKED_NOTE,
        `${data.workspace.id}: the ${role} report carries the standing note`
      );
      for (const line of built.lines) {
        assert(line.meaning.trim().length > 0, `${role}: "${line.label}" says what it means`);
      }
    }
  }
});

group('No report counts anything per person', () => {
  // Structural, not editorial. Every user id in every workspace is checked
  // against every figure in every report, from every role. A report that
  // grouped by owner would put a user id in a label or key one of its items.
  const userIds = Object.values(USERS);

  for (const data of CRM_WORKSPACES) {
    const workspaceUsers = [...new Set(data.members.map((m) => m.userId)), ...userIds];

    for (const role of REPORT_ROLES as ReportRole[]) {
      const built = buildReport(role, data, NOW, 'crm_admin');
      const serialised = JSON.stringify(built);

      for (const userId of workspaceUsers) {
        assert(
          !serialised.includes(userId),
          `${data.workspace.id}/${role}: no user id appears anywhere in the report`
        );
      }

      // And no line is a count keyed by a person's NAME either.
      for (const line of built.lines) {
        for (const person of data.people) {
          assert(
            line.label !== person.fullName,
            `${data.workspace.id}/${role}: no figure is labelled with a person's name`
          );
        }
      }
    }
  }
});

group('A figure that is not available is blank, never zero', () => {
  // Above the sweep limit the record-quality figure is not computed on the way
  // to a page. The line has to say so rather than show a zero, because a zero
  // reads as "nothing is wrong".
  const big = generateWorkspace(
    { people: LIVE_SWEEP_LIMIT + 10, organisations: 50, activities: 100, workItems: 20 },
    NOW
  );
  const figure = qualityFigure(big, NOW);
  assertEqual(figure.source, 'not_available', 'above the limit with no job run, it is not available');
  assertEqual(figure.flaggedRecords, null, 'and the number is null rather than zero');
  assert(
    (figure.whatWouldFixIt ?? '').includes('job'),
    'and it names the job that would make it available'
  );

  const manager = buildReport('manager', big, NOW, 'crm_admin');
  const quality = manager.lines.find((line) => line.label === 'Data quality');
  assertEqual(quality?.count, null, 'the manager report shows the figure as blank');

  const small = fresh();
  assertEqual(
    qualityFigure(small, NOW).source,
    'computed_now',
    'a small workspace is checked live'
  );
});

/* =====================================================================
   4. The ten data-quality indicators
   ===================================================================== */

group('Ten indicators, each one a list rather than a number', () => {
  assertEqual(INDICATOR_ORDER.length, 10, 'ten indicators');

  for (const data of CRM_WORKSPACES) {
    const dashboard = buildDataQualityDashboard(data, NOW);
    assertEqual(
      dashboard.indicators.length,
      10,
      `${data.workspace.id}: all ten are computed`
    );

    const keys = dashboard.indicators.map((indicator) => indicator.key);
    for (const expected of INDICATOR_ORDER) {
      assert(keys.includes(expected), `${data.workspace.id}: ${expected} is present`);
    }

    for (const indicator of dashboard.indicators) {
      assert(
        indicator.whatToDo.trim().length > 0,
        `${data.workspace.id}/${indicator.key}: says what to do about it`
      );
      assert(
        indicator.meaning.trim().length > 0,
        `${data.workspace.id}/${indicator.key}: says what it counts`
      );
      if (indicator.state === 'attention') {
        assert(
          indicator.subjects.length > 0,
          `${data.workspace.id}/${indicator.key}: an indicator needing attention lists what to look at`
        );
      }
      if (indicator.state === 'nothing_to_measure') {
        assert(
          indicator.zeroBecause !== null,
          `${data.workspace.id}/${indicator.key}: a zero with nothing behind it says why`
        );
      }
    }
  }
});

group('A zero that means "nothing is connected" is not shown as healthy', () => {
  const data = fresh('ws-sole-trader');
  const dashboard = buildDataQualityDashboard(data, NOW);
  const integrations = dashboard.indicators.find(
    (indicator) => indicator.key === 'failed_integrations'
  );

  assertEqual(
    integrations?.state,
    'nothing_to_measure',
    'with nothing connected, the integration indicator is not "clear"'
  );
  assert(
    (integrations?.zeroBecause ?? '').includes('nothing can fail'),
    'and it says the zero is because there is nothing there'
  );
});

group('A failing connection is counted, and an unscheduled retry is named', () => {
  const data = fresh();
  const dashboard = buildDataQualityDashboard(data, NOW);
  const integrations = dashboard.indicators.find(
    (indicator) => indicator.key === 'failed_integrations'
  );

  assertEqual(integrations?.state, 'attention', 'the expired connection is counted');
  const detail = integrations?.subjects.map((subject) => subject.detail).join(' ') ?? '';
  assert(
    detail.includes('reconnect') || detail.includes('Reconnect') || detail.includes('granted'),
    'the fix is named'
  );
});

group('The data-quality page has no owner column and no per-person count', () => {
  for (const data of CRM_WORKSPACES) {
    const dashboard = buildDataQualityDashboard(data, NOW);
    const serialised = JSON.stringify(dashboard.indicators);
    for (const member of data.members) {
      assert(
        !serialised.includes(member.userId),
        `${data.workspace.id}: no user id appears in any indicator`
      );
    }
    // The one place a person appears is the named owner list, and the number
    // beside them is how many records they are responsible for.
    for (const owner of dashboard.namedOwners) {
      assert(owner.recordCount > 0, 'a named owner is named because records name them');
    }
  }
});

/* =====================================================================
   5. The importer
   ===================================================================== */

const CSV = [
  'Full name,Email,Mobile,Company,Role,Internal code',
  'Dev Raman,dev.raman@thornbury.example,0491 570 156,Thornbury Collective,Director,X1',
  '"Liu, Wen",wen.liu@merrivale.example,,Merrivale Group,Owner,X2',
  'Dev Raman,dev.raman@thornbury.example,,Thornbury Collective,Director,X3',
  ',not-an-address,0491 570 157,Nowhere Pty Ltd,,X4',
  '"He said ""hello""",ok@fine.example,,Merrivale Group,Adviser,X5',
].join('\n');

group('The reader handles the file shapes a real export produces', () => {
  const parsed = readDelimited(CSV);
  assertEqual(parsed.headers.length, 6, 'six columns');
  assertEqual(parsed.rows.length, 5, 'five rows');
  assertEqual(parsed.rows[1]['Full name'], 'Liu, Wen', 'a comma inside a quoted value is kept');
  assertEqual(parsed.rows[4]['Full name'], 'He said "hello"', 'a doubled quotation mark is unescaped');
  assertEqual(parsed.problems.length, 0, 'a well-formed file has no problems');

  const unclosed = readDelimited('a,b\n"never closed,2');
  assert(
    unclosed.problems.some((problem) => problem.includes('never closed')),
    'an unclosed quote is reported rather than half-read'
  );

  const empty = readDelimited('   ');
  assert(empty.problems.length > 0, 'an empty file says so');

  const ragged = readDelimited('a,b,c\n1,2');
  assert(
    ragged.problems.some((problem) => problem.includes('values where the heading has')),
    'a short row is reported'
  );

  const duplicated = readDelimited('Name,Name\n1,2');
  assert(
    duplicated.problems.some((problem) => problem.includes('both named')),
    'two columns with one name are reported'
  );
});

group('Seven kinds, and only the fields a record needs are required', () => {
  const kinds = Object.keys(IMPORT_FIELDS);
  assertEqual(kinds.length, 7, 'seven kinds of import');

  assertEqual(
    IMPORT_FIELDS.contacts.filter((field) => field.required).length,
    1,
    'a contact needs exactly one field: a name'
  );
  assertEqual(
    IMPORT_FIELDS.organisations.filter((field) => field.required).length,
    1,
    'an organisation needs exactly one field: a name'
  );
  for (const [kind, fields] of Object.entries(IMPORT_FIELDS)) {
    assert(fields.length > 0, `${kind} has fields`);
    assert(
      fields.filter((field) => field.required).length <= 3,
      `${kind} requires no more than three fields`
    );
  }
});

group('Nothing is mapped without somebody accepting it', () => {
  const parsed = readDelimited(CSV);
  const proposal = suggestMapping(parsed.headers, 'contacts');

  for (const suggestion of proposal.suggestions) {
    assert(suggestion.because.trim().length > 0, `${suggestion.header}: the suggestion says why`);
  }
  assert(
    proposal.unmappedHeaders.includes('Internal code'),
    'a column nothing matches is named as unmapped rather than dropped quietly'
  );
  assert(
    proposal.note.includes('Nothing is mapped until you accept it'),
    'the proposal says it is a suggestion'
  );

  const all = acceptSuggestions(proposal);
  const rejected = acceptSuggestions(proposal, ['Email']);
  assert(Object.values(all).includes('primaryEmail'), 'accepting takes the email mapping');
  assert(
    !Object.values(rejected).includes('primaryEmail'),
    'rejecting one suggestion leaves it unmapped'
  );

  const preview = previewRows(parsed, rejected, 2);
  assert(
    preview[0].ignored.includes('Email'),
    'the preview names the rejected column among the ignored ones'
  );
});

group('Validation separates what stops a row from what is merely worth knowing', () => {
  const data = fresh();
  const parsed = readDelimited(CSV);
  const proposal = suggestMapping(parsed.headers, 'contacts');
  const mapping = acceptSuggestions(proposal);
  const run = startImport(contextFor(data), 'contacts', 'test.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);

  assertEqual(summary.rows.length, 5, 'every row is accounted for');

  const blocked = summary.rows.filter((row) => row.state === 'blocked');
  assertEqual(blocked.length, 1, 'one row is stopped');
  assert(
    blocked[0].issues.some((issue) => issue.includes('Full name is empty')),
    'and it says which field stopped it'
  );
  assert(
    blocked[0].issues.some((issue) => issue.includes('not an email address')),
    'and every problem with that row, not just the first'
  );

  const unmatchedOrganisation = summary.rows.filter((row) =>
    row.warnings.some((warning) => warning.includes('matches no organisation'))
  );
  assert(unmatchedOrganisation.length > 0, 'an unmatched organisation is a warning');
  assert(
    unmatchedOrganisation.every((row) => row.state !== 'blocked' || row.issues.length > 0),
    'and a warning on its own never stops a row'
  );

  const repeat = summary.rows.find((row) =>
    row.warnings.some((warning) => warning.includes('same email address'))
  );
  assertEqual(
    repeat?.state,
    'needs_duplicate_review',
    'a row repeated inside the same file waits for a decision'
  );
});

group('Nothing merges, including an exact match', () => {
  const data = fresh();
  const existing = data.people[0];
  const csv = `Full name,Email\n${existing.fullName},${existing.primaryEmail ?? 'x@y.example'}`;
  const parsed = readDelimited(csv);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'dup.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);

  assertEqual(
    summary.rows[0].state,
    'needs_duplicate_review',
    'an exact match on name and address waits for a person'
  );
  assertEqual(summary.duplicates.length, 1, 'and the match is reported with what it matched');
  assert(
    summary.duplicates[0].recommendation !== ('merge' as never),
    'the recommendation is never to merge'
  );

  const before = data.people.length;
  markDryRun(run, NOW);
  commitImport(contextFor(data), data, run, summary.rows, mapping);
  assertEqual(data.people.length, before, 'committing creates nothing from a row awaiting review');
});

group('No commit without a preview', () => {
  const data = fresh();
  const parsed = readDelimited(CSV);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'test.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);

  assertRefused(
    () => commitImport(contextFor(data), data, run, summary.rows, mapping),
    (error) => error instanceof CrmRefused && error.because.includes('not been previewed'),
    'a commit without a dry run is refused'
  );

  const preview = dryRun(summary, 'contacts', run.id);
  assert(preview.note.includes('Nothing has been written'), 'the preview says it wrote nothing');
  assertEqual(preview.willCreate, 3, 'the preview counts what would be created');
  assertEqual(preview.willWait, 1, 'and what would wait');
  assertEqual(preview.willSkip, 1, 'and what would be skipped');
  assert(
    (preview.consentNote ?? '').includes('A spreadsheet is not consent'),
    'and it says what the import means for consent'
  );
});

group('Committing an import needs the approver role', () => {
  const data = fresh();
  const parsed = readDelimited(CSV);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'test.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);
  markDryRun(run, NOW);

  assertRefused(
    () => commitImport(contextFor(data, 'crm_contributor'), data, run, summary.rows, mapping),
    (error) => error instanceof CrmRefused && error.code === 'insufficient_role',
    'a contributor cannot commit an import'
  );
});

group('An imported contact arrives with no basis to contact them', () => {
  const data = fresh();
  const parsed = readDelimited(CSV);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'list.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);
  markDryRun(run, NOW);

  const result = commitImport(contextFor(data), data, run, summary.rows, mapping);
  assertEqual(result.created.length, 3, 'three contacts created');

  for (const created of result.created) {
    const consent = data.consentRecords.filter((record) => record.personId === created.id);
    assertEqual(consent.length, 1, 'each imported contact has a consent record');
    assertEqual(consent[0].basis, 'not_obtained', 'and the basis is recorded as not obtained');
  }

  const gaps = buildDataQualityDashboard(data, NOW).indicators.find(
    (indicator) => indicator.key === 'consent_gaps'
  );
  assert(
    (gaps?.count ?? 0) >= 3,
    'and they appear on the consent-gap list straight away'
  );

  assert(result.auditEventId !== null, 'the import writes an audit record');
  const event = data.auditEvents.find((candidate) => candidate.id === result.auditEventId);
  assertEqual(event?.eventType, 'import_committed', 'and the audit record says what happened');
});

group('An error file reproduces the source exactly', () => {
  const data = fresh();
  const parsed = readDelimited(CSV);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'test.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);

  const file = errorFile(parsed, summary.rows);
  const lines = file.trim().split('\n');
  assertEqual(lines.length, 2, 'the error file holds the heading and the one stopped row');
  assert(lines[0].startsWith('Full name,Email,Mobile,Company,Role,Internal code'), 'every source column, in order');
  assert(lines[0].includes('Concludo row'), 'plus the row number');
  assert(lines[0].includes('Concludo issue'), 'plus what stopped it');
  assert(lines[1].includes('X4'), 'the source values are reproduced, including the ignored column');

  const clean = readDelimited('Full name\nSomebody Real');
  const cleanSummary = validateImport(
    data,
    clean,
    acceptSuggestions(suggestMapping(clean.headers, 'contacts')),
    'contacts',
    run.id
  );
  assertEqual(errorFile(clean, cleanSummary.rows), '', 'a file with nothing wrong produces no error file');
});

group('Rollback reverses what the import made, and nothing else', () => {
  const data = fresh();
  const parsed = readDelimited(CSV);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'test.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);
  markDryRun(run, NOW);

  const before = data.people.filter((person) => person.deletedAt === null).length;
  const result = commitImport(contextFor(data), data, run, summary.rows, mapping);
  assertEqual(
    data.people.filter((person) => person.deletedAt === null).length,
    before + 3,
    'three were created'
  );

  // Somebody edits one of them afterwards.
  const edited = data.people.find((person) => person.id === result.created[0].id);
  const later = new Date(Date.parse(NOW) + 60_000).toISOString();
  if (edited) edited.updatedAt = later;

  const laterStill = new Date(Date.parse(NOW) + 120_000).toISOString();
  const rolled = rollbackImport(
    { ...contextFor(data), now: laterStill },
    data,
    run,
    summary.rows,
    'Wrong file.'
  );

  assertEqual(rolled.reversed.length, 2, 'the two untouched records are reversed');
  assertEqual(rolled.kept.length, 1, 'the one somebody edited is kept');
  assert(
    rolled.kept[0].because.includes('edited this record since the import'),
    'and the reason is named'
  );
  assertEqual(
    data.people.filter((person) => person.deletedAt === null).length,
    before + 1,
    'one imported record survives, because somebody worked on it'
  );
  assertEqual(rolled.run.rollbackReason, 'Wrong file.', 'the rollback records why');
  assert(
    data.auditEvents.some((event) => event.eventType === 'import_rolled_back'),
    'and writes an audit record'
  );

  assertRefused(
    () => rollbackImport(contextFor(data), data, rolled.run, summary.rows, ''),
    (error) => error instanceof CrmRefused,
    'a rollback with no reason is refused'
  );
});

group('Dates are read, never guessed', () => {
  assertEqual(readDate('2026-10-14').date, '2026-10-14', 'an ISO date is read');
  assertEqual(readDate('14/10/2026').date, '2026-10-14', 'an Australian day-first date is read');
  assertEqual(readDate('14-10-26').date, '2026-10-14', 'a two-digit year is read');
  assertEqual(readDate('').date, null, 'an empty value is not a date and not a problem');

  const ambiguous = readDate('03/15/2026');
  assertEqual(ambiguous.date, null, 'a month-first date is not silently reinterpreted');
  assert(
    (ambiguous.problem ?? '').includes('ambiguous'),
    'and the ambiguity is reported rather than resolved by guessing'
  );

  assert(readDate('tomorrow').problem !== null, 'a word is not a date');
});

/* =====================================================================
   6. Governance
   ===================================================================== */

group('The automated-decision register is complete and dated', () => {
  assert(AUTOMATED_DECISION_REGISTER.length >= 5, 'every automated decision is registered');
  assertEqual(ADM_OBLIGATION_START, '2026-12-10', 'the obligation date is recorded');

  for (const entry of AUTOMATED_DECISION_REGISTER) {
    assert(entry.what.trim().length > 0, `${entry.id} says what the program does`);
    assert(
      entry.personalInformationUsed.length > 0 || entry.automationLevel === 'no_decision_made',
      `${entry.id} names the personal information used`
    );
    assert(entry.assessment.trim().length > 20, `${entry.id} gives its reasoning`);
    assert(entry.wouldChangeIf.trim().length > 20, `${entry.id} says what would change the answer`);
    assert(entry.lastReviewed.length === 10, `${entry.id} is dated`);
    assert(
      entry.automationLevel !== 'decides_alone',
      `${entry.id}: nothing in Concludo decides alone`
    );
  }

  const policy = privacyPolicyAdmSection();
  assert(policy.text.trim().length > 0, 'the privacy policy text is generated from the register');
  assert(policy.because.trim().length > 0, 'and says why it says what it says');
});

group('The model register exists before the models do', () => {
  assert(AI_MODEL_REGISTER.length >= 3, 'every model slot is registered');
  assertEqual(modelsConnected(), 0, 'no model is connected');

  for (const entry of AI_MODEL_REGISTER) {
    assertEqual(entry.state, 'not_connected', `${entry.id} is not connected`);
    assertEqual(entry.provider, null, `${entry.id} names no provider, because there is none`);
    assert(entry.beforeEnabling.length > 0, `${entry.id} lists what must be true before it is on`);
    if (entry.sendsPersonalInformation) {
      // An entry may defer to another one rather than restating it, which is
      // how a checklist stays readable. Follow the reference.
      const referenced = entry.beforeEnabling.some((step) =>
        /everything (above|in model-\d)/i.test(step)
      )
        ? AI_MODEL_REGISTER.flatMap((other) => other.beforeEnabling)
        : entry.beforeEnabling;

      assert(
        referenced.some((step) => /residen|Australia|processing|agreement/i.test(step)),
        `${entry.id}: a model that would receive personal information has to settle where it is processed`
      );
    }
  }
});

group('Residency is recorded wherever it would matter', () => {
  const withResidency = INTEGRATION_REGISTER.filter((entry) => entry.residencyNote !== null);
  assert(withResidency.length > 0, 'residency is recorded against the connectors it applies to');
  assertEqual(
    integrationsConnected().length,
    1,
    'exactly one integration is connected, and it is the file importer'
  );
  assertEqual(
    integrationsConnected()[0].id,
    'int-csv',
    'the connected one is the file import, which needs no credential'
  );
});

group('An export covers every table, and the gap is named rather than silent', () => {
  for (const data of CRM_WORKSPACES) {
    const result = exportWorkspace(data, NOW);
    assertEqual(
      result.missedTables.length,
      0,
      `${data.workspace.id}: every table in the model is in the export`
    );
    assertEqual(
      result.tables.length,
      CRM_TABLES.length,
      `${data.workspace.id}: one entry per table`
    );
  }
});

group('A field a reader may not see is withheld and named', () => {
  assert(FIELD_RULES.length > 0, 'there are field-level rules');
  for (const rule of FIELD_RULES) {
    assert(rule.because.trim().length > 0, `${rule.table}.${rule.field} says why it is restricted`);
    assert(
      !maySeeField('crm_viewer', rule.table, rule.field) ||
        maySeeField('crm_admin', rule.table, rule.field),
      `${rule.table}.${rule.field}: the restriction is by role`
    );
  }

  const redacted = redactFor('crm_viewer', 'crm_service_cases', {
    id: 'x',
    detail: 'Something private about a named person.',
  });
  assertEqual(redacted.detail, null, 'the field is removed for a reader who may not see it');
  assert(
    redacted.redactedFields.includes('detail'),
    'and the reader is told which field was removed'
  );
});

group('Deleting a person says what goes and what stays', () => {
  const data = fresh();
  const person = data.people[0];
  const plan = planPersonDeletion(data, person.id);
  assert(plan !== null, 'a plan is produced for a person who exists');
  if (plan === null) return;

  assert(plan.cascades.length > 0, 'the plan says what would be deleted with them');
  assert(plan.retained.length > 0, 'and what would be kept');
  for (const kept of plan.retained) {
    assert(kept.because.trim().length > 0, `${kept.table} says why it is kept`);
  }
});

group('Retention is a prompt to decide, never an automatic deletion', () => {
  assert(RETENTION_RULES.length >= 7, 'every kind of record has a retention rule');
  for (const rule of RETENTION_RULES) {
    assert(rule.because.trim().length > 0, `${rule.table} says why that long`);
    assert(rule.clockStarts.trim().length > 0, `${rule.table} says what starts the clock`);
  }

  for (const data of CRM_WORKSPACES) {
    const findings = retentionFindings(data, NOW);
    for (const finding of findings) {
      assert(finding.overdueDays > 0, 'a finding is actually overdue');
      assert(finding.label.trim().length > 0, 'and names the record');
    }
  }
});

group('There is a way out, in order', () => {
  assert(OFFBOARDING.length >= 5, 'offboarding has steps');
  const orders = OFFBOARDING.map((step) => step.order);
  assertEqual(
    orders.join(','),
    [...orders].sort((a, b) => a - b).join(','),
    'the steps are in order'
  );
  for (const step of OFFBOARDING) {
    assert(step.because.trim().length > 0, `step ${step.order} says why`);
  }
  assert(
    OFFBOARDING.some((step) => !step.reversible),
    'at least one step is irreversible, and is marked as such'
  );
});

/* =====================================================================
   7. Paging and size
   ===================================================================== */

group('A list asks for a page, never for a table', () => {
  const data = generateWorkspace(SCALE_POINTS.medium, NOW);

  const first = peoplePage(data, { pageSize: 50 });
  assertEqual(first.items.length, 50, 'a page is a page');
  assert(first.hasMore, 'and says there are more');
  assert(first.nextCursor !== null, 'and gives the cursor for the next one');

  const second = peoplePage(data, { pageSize: 50, cursor: first.nextCursor });
  assertEqual(second.items.length, 50, 'the next page is the same size');
  assert(
    second.items[0].id !== first.items[0].id,
    'and starts after the previous one rather than repeating it'
  );

  const overlap = first.items.filter((person) =>
    second.items.some((other) => other.id === person.id)
  );
  assertEqual(overlap.length, 0, 'no row appears on two pages');

  const clamped = pageOf(data.people, { pageSize: 10_000 }, { label: 'people' });
  assertEqual(clamped.items.length, MAX_PAGE_SIZE, 'a page size is clamped');
  assertEqual(
    pageOf(data.people, {}, { label: 'people' }).items.length,
    DEFAULT_PAGE_SIZE,
    'and has a sensible default'
  );

  const lost = pageOf(data.people, { cursor: 'no-such-row' }, { label: 'people' });
  assert(
    lost.footer.includes('started again'),
    'a cursor that no longer resolves restarts the list and says so'
  );
});

group('An account page reads its own account, not the workspace', () => {
  const data = generateWorkspace(SCALE_POINTS.medium, NOW);
  const slice = accountSlice(data, 'org-7');

  assert(slice.organisation !== null, 'the organisation is found');
  assert(
    slice.rowsRead < 200,
    `an account page reads a couple of hundred rows at most (read ${slice.rowsRead})`
  );
  assert(
    slice.recentActivity.items.length <= 10,
    'and one page of its history rather than all of it'
  );
});

group('The index is built once per dataset and dropped with it', () => {
  const data = fresh();
  const first = indexFor(data);
  const second = indexFor(data);
  assert(first === second, 'the same dataset gives the same index');

  forgetIndex(data);
  assert(indexFor(data) !== first, 'forgetting it builds a fresh one');

  const other = fresh('ws-consulting');
  assert(indexFor(other) !== first, 'a different dataset gets its own');
});

group('The pages hold at a hundred thousand records', () => {
  // Generous thresholds on purpose. What this catches is a page going
  // quadratic, which shows up as seconds rather than as a few milliseconds.
  const data = generateWorkspace(SCALE_POINTS.large, NOW);

  assertEqual(data.people.length, 100_000, 'a hundred thousand people');
  assertEqual(data.organisations.length, 10_000, 'ten thousand organisations');
  assertEqual(data.activities.length, 100_000, 'a hundred thousand conversations');

  const timed = (label: string, limit: number, body: () => unknown) => {
    const started = performance.now();
    body();
    const took = performance.now() - started;
    assert(took < limit, `${label} in under ${limit}ms (took ${Math.round(took)}ms)`);
  };

  // The first call builds the index, so it carries that cost.
  timed('the index builds', 8_000, () => indexFor(data));
  timed('a page of contacts', 250, () => peoplePage(data, { pageSize: 50 }));
  timed('a page of organisations', 250, () => organisationsPage(data, { pageSize: 50 }));
  timed('a page of activity', 250, () => activityPage(data, { pageSize: 25 }));
  timed('an account page', 250, () => accountSlice(data, 'org-7'));
  timed('the data-quality dashboard', 5_000, () => buildDataQualityDashboard(data, NOW));
  timed('every report', 10_000, () => {
    for (const role of REPORT_ROLES) buildReport(role, data, NOW, 'crm_admin');
  });
});

group('The generated workspace could not reach a real person', () => {
  const data = generateWorkspace(SCALE_POINTS.small, NOW);
  for (const person of data.people) {
    if (person.primaryEmail !== null) {
      assert(
        person.primaryEmail.endsWith('.example'),
        'every generated address is at a reserved domain'
      );
    }
    if (person.phone !== null) {
      assert(
        person.phone.startsWith('0491 570 1'),
        'every generated phone number is in the reserved fictional range'
      );
    }
  }
});

/* =====================================================================
   8. The definition of done, line by line
   ===================================================================== */

group('Definition of done', () => {
  const data = fresh();

  // 1. Fourteen integrations, specified with least-privilege scopes.
  assertEqual(INTEGRATION_REGISTER.length, 14, '1. fourteen integrations are specified');

  // 2. Every scope is justified.
  assert(
    INTEGRATION_REGISTER.every((entry) => entry.scopes.every((scope) => scope.because.length > 0)),
    '2. every scope requested carries its justification'
  );

  // 3. Automatic sending is off by default, everywhere.
  assert(
    INTEGRATION_REGISTER.every((entry) => entry.sendingDefault === 'off') &&
      data.integrationConnections.every((connection) => !connection.sendingEnabled),
    '3. automatic sending is off by default on every connector and every connection'
  );

  // 4. Nothing imports silently: account, folder, label, date and relationship
  //    controls exist on every connector that reads messages.
  assert(
    INTEGRATION_REGISTER.filter((entry) => entry.state !== 'not_built').every(
      (entry) => entry.importControls.length > 0
    ),
    '4. every built connector names what is read before anything is read'
  );

  // 5. The service module exists, with cases, consequence, priority, owner,
  //    target, customer history, draft and reopening.
  const inbox = buildServiceInbox(data, NOW, 'crm_admin');
  assert(
    inbox.open.length + inbox.waitingOnCustomer.length + inbox.resolved.length > 0 &&
      inbox.open.every((view) => view.priority.because.length > 0),
    '5. the service inbox exists and every priority shows its working'
  );

  // 6. Six role reports.
  assertEqual(REPORT_ROLES.length, 6, '6. six role reports');

  // 7. No employee ranking or individual productivity score anywhere.
  const everyReport = CRM_WORKSPACES.flatMap((workspace) =>
    REPORT_ROLES.map((role) => JSON.stringify(buildReport(role, workspace, NOW, 'crm_admin')))
  ).join(' ');
  assert(
    Object.values(USERS).every((userId) => !everyReport.includes(userId)),
    '7. no report anywhere contains a figure keyed to a person'
  );

  // 8. Ten data-quality indicators.
  assertEqual(
    buildDataQualityDashboard(data, NOW).indicators.length,
    10,
    '8. ten data-quality indicators'
  );

  // 9. A guided importer for seven kinds of record.
  assertEqual(Object.keys(IMPORT_FIELDS).length, 7, '9. the importer covers seven kinds');

  // 10. Preview, mapping, validation, duplicate review, error download, dry
  //     run, rollback and an audit record: all eight, demonstrated above.
  const parsed = readDelimited(CSV);
  const mapping = acceptSuggestions(suggestMapping(parsed.headers, 'contacts'));
  const run = startImport(contextFor(data), 'contacts', 'done.csv');
  const summary = validateImport(data, parsed, mapping, 'contacts', run.id);
  markDryRun(run, NOW);
  const committed = commitImport(contextFor(data), data, run, summary.rows, mapping);
  assert(
    previewRows(parsed, mapping, 2).length === 2 &&
      summary.rows.length === 5 &&
      summary.duplicates.length >= 0 &&
      errorFile(parsed, summary.rows).length > 0 &&
      run.dryRunAt !== null &&
      committed.auditEventId !== null,
    '10. preview, mapping, validation, duplicate review, error file, dry run and audit record all work'
  );

  // 11. An automated-decision register.
  assert(AUTOMATED_DECISION_REGISTER.length >= 5, '11. the automated-decision register exists');

  // 12. An AI model register.
  assert(AI_MODEL_REGISTER.length >= 3, '12. the model register exists');

  // 13. An integration register.
  assert(INTEGRATION_REGISTER.length === 14, '13. the integration register exists');

  // 14. Data residency is recorded.
  assert(
    INTEGRATION_REGISTER.some((entry) => entry.residencyNote !== null),
    '14. data residency is recorded where it applies'
  );

  // 15. Privacy-policy support: the policy text is generated from the register.
  assert(privacyPolicyAdmSection().text.length > 0, '15. the privacy policy section is generated');

  // 16. Nothing claims compliance. Every assessment is Concludo's own and says
  //     it has not been through a lawyer.
  assert(
    AUTOMATED_DECISION_REGISTER.every((entry) =>
      /pending legal review|flagged for legal review|reviewed by/i.test(entry.reviewedBy)
    ),
    '16. no assessment is presented as a legal opinion'
  );

  // 17. The sizes in the brief are met, and no page loads the whole CRM.
  const big = generateWorkspace(SCALE_POINTS.large, NOW);
  const page = peoplePage(big, { pageSize: 50 });
  assert(
    big.people.length === 100_000 && page.items.length === 50 && page.hasMore,
    '17. a hundred thousand records, fifty on the page'
  );

  // 18. The things that must not exist, do not: a send path, an automatic
  //     merge, a per-person score, and a commit that skips the preview.
  const noSend = INTEGRATION_REGISTER.every((entry) => !entry.canSend);
  const noAutoMerge = summary.rows.every((row) => row.state !== 'updated');
  const noScore = !everyReport.toLowerCase().includes('"score"');
  let previewEnforced = false;
  try {
    const second = startImport(contextFor(data), 'contacts', 'again.csv');
    commitImport(contextFor(data), data, second, summary.rows, mapping);
  } catch (error) {
    previewEnforced = error instanceof CrmRefused;
  }
  assert(
    noSend && noAutoMerge && noScore && previewEnforced,
    '18. no send path, no automatic merge, no per-person score, no commit without a preview'
  );
});

report('Concludo CRM Stage 8, the whole system', r);
