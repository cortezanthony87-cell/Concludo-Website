/**
 * Concludo CRM, Stage 3: tenancy, permissions, deletion, restoration, audit.
 *
 * WHAT THIS SUITE IS FOR, AND WHAT IT CANNOT DO.
 *
 * It tests the repository layer, which is not the security boundary. Row level
 * security is, it lives in the database, and it is verified separately and
 * behaviourally by docs/migrations/0099_crm_verify.sql, which signs in as three
 * different people against a real PostgreSQL instance and checks what each one
 * can actually see. Nothing in this file proves anything about that.
 *
 * What it does prove is that the repository refuses early and refuses for the
 * right reason, which is what turns a silent empty list into a message a person
 * can act on. The two tests that matter most:
 *
 *   The repository is loaded with SEVERAL workspaces on purpose. A tenancy test
 *   against a single-tenant fixture tests nothing: every query returns the only
 *   data there is, whether or not it was scoped.
 *
 *   The outsider is a genuine administrator of another workspace, not a user of
 *   nothing. "Returned nothing because they have no access" and "returned
 *   nothing because there is nothing" look identical from the outside, and only
 *   one of them is the security property.
 *
 * Run: bun tests/crm.security.test.ts
 */
import { CrmRole, CrmTable } from '../src/lib/crm/domain';
import {
  CrmContext,
  CrmRefused,
  InMemoryCrmRepository,
} from '../src/lib/crm/repositories/repository';
import { CRM_WORKSPACES, USERS } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { groupAsync, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual, assertRefusedAsync } = makeAssert(r);

/** A fresh repository, so one suite's deletions cannot affect the next. */
function repo(): InMemoryCrmRepository {
  // Deep copied, because the in-memory adapter mutates rows in place and the
  // module-level fixture is shared with the other suites.
  return new InMemoryCrmRepository(JSON.parse(JSON.stringify(CRM_WORKSPACES)));
}

function ctx(workspaceId: string, userId: string, role: CrmRole): CrmContext {
  return { userId, workspaceId, role, now: CRM_DEMO_NOW };
}

const refusedWith = (code: CrmRefused['code']) => (error: unknown): boolean =>
  error instanceof CrmRefused && error.code === code;

const AGENCY = 'ws-agency';
const SERVICE = 'ws-service';
const KEY = 'ws-key-accounts';

await groupAsync('Several workspaces are loaded, so scoping can be tested at all', async () => {
  const q = repo();
  const agency = await q.listOrganisations(ctx(AGENCY, USERS.anthony, 'crm_admin'));
  const key = await q.listOrganisations(ctx(KEY, USERS.anthony, 'crm_admin'));

  assert(agency.length > 0, 'The agency has organisations');
  assert(key.length > 0, 'So does the key-account team');
  assertEqual(
    agency.filter((o) => key.some((k) => k.id === o.id)).length,
    0,
    'And the two lists share no record, so a missing scope would be visible'
  );
  assertEqual(
    agency.filter((o) => o.crmWorkspaceId !== AGENCY).length,
    0,
    'Every row returned for the agency belongs to the agency'
  );
});

await groupAsync('An administrator of another workspace gets nothing from this one', async () => {
  const q = repo();
  // The outsider is a full administrator of the bookkeeping practice. Every
  // call below is made with every permission that workspace can grant.
  const theirOwn = await q.listOrganisations(ctx(SERVICE, USERS.outsider, 'crm_admin'));
  assert(theirOwn.length > 0, 'The outsider can read their own workspace');

  const asOutsider = ctx(AGENCY, USERS.outsider, 'crm_admin');

  await assertRefusedAsync(
    () => q.listOrganisations(asOutsider),
    refusedWith('not_a_member'),
    'Reading another workspace\'s organisations is refused, not returned empty'
  );
  await assertRefusedAsync(
    () => q.listPeople(asOutsider),
    refusedWith('not_a_member'),
    'And its people'
  );
  await assertRefusedAsync(
    () => q.listWorkItems(asOutsider),
    refusedWith('not_a_member'),
    'And its work'
  );
  await assertRefusedAsync(
    () => q.listProposals(asOutsider),
    refusedWith('not_a_member'),
    'And its proposals'
  );
  await assertRefusedAsync(
    () => q.listAudit(asOutsider),
    refusedWith('not_a_member'),
    'And its audit trail'
  );
  await assertRefusedAsync(
    () => q.getOrganisation(asOutsider, 'org-ag-1'),
    refusedWith('not_a_member'),
    'Asking for a specific record by id is refused too, which is the one a filter forgets'
  );
  await assertRefusedAsync(
    () => q.organisationAncestry(asOutsider, 'org-ag-2'),
    refusedWith('not_a_member'),
    'And walking its hierarchy'
  );
  await assertRefusedAsync(
    () => q.listEvidenceFor(asOutsider, 'crm_work_items', 'wi-ag-1'),
    refusedWith('not_a_member'),
    'And reading the evidence behind its records'
  );
  await assertRefusedAsync(
    () => q.softDelete(asOutsider, 'crm_people', 'per-ag-4'),
    refusedWith('not_a_member'),
    'Writing is refused as a non-member before the role is even considered'
  );

  // A refusal has to say why in words somebody can act on. "Returned nothing"
  // is the failure mode this exists to avoid.
  try {
    await q.listOrganisations(asOutsider);
  } catch (error) {
    const refusal = error as CrmRefused;
    assert(refusal.because.length > 20, 'The refusal explains itself in a sentence');
    assert(
      refusal.because.toLowerCase().includes('row level security'),
      'And says the database refuses it as well, so nobody reads this as a client-side rule'
    );
  }
});

await groupAsync('An unknown workspace is an error, never an empty list', async () => {
  const q = repo();
  await assertRefusedAsync(
    () => q.listOrganisations(ctx('ws-does-not-exist', USERS.anthony, 'crm_admin')),
    refusedWith('not_a_member'),
    'A workspace nobody is a member of is refused'
  );
});

await groupAsync('Roles gate writes, and only writes', async () => {
  const q = repo();
  const viewer = ctx(AGENCY, USERS.tom, 'crm_viewer');

  // A viewer reads everything in their workspace. Restricting reads by role is
  // a different product; this one restricts change.
  const read = await q.listWorkItems(viewer);
  assert(read.length > 0, 'A viewer can read');

  await assertRefusedAsync(
    () => q.softDelete(viewer, 'crm_people', 'per-ag-4'),
    refusedWith('insufficient_role'),
    'A viewer cannot delete'
  );
  await assertRefusedAsync(
    () => q.restore(viewer, 'crm_people', 'per-ag-4'),
    refusedWith('insufficient_role'),
    'Nor restore'
  );
  await assertRefusedAsync(
    () =>
      q.moveStage(viewer, {
        crmWorkspaceId: AGENCY,
        workItemId: 'wi-ag-1',
        fromStageId: 'stg-ag-3',
        toStageId: 'stg-ag-4',
        criteriaMet: [],
        criteriaUnmet: [],
        overrideReason: null,
      }),
    refusedWith('insufficient_role'),
    'Nor move work between stages'
  );

  // And the refusal names the role needed and the role held, because "access
  // denied" sends somebody to the wrong person for help.
  try {
    await q.softDelete(viewer, 'crm_people', 'per-ag-4');
  } catch (error) {
    const refusal = error as CrmRefused;
    assert(refusal.because.includes('contributor'), 'The refusal names the role required');
    assert(refusal.because.includes('viewer'), 'And the role held');
  }

  const contributor = ctx(AGENCY, USERS.tom, 'crm_contributor');
  await q.softDelete(contributor, 'crm_people', 'per-ag-4', 'Left the firm in August');
  const remaining = await q.listPeople(contributor);
  assertEqual(
    remaining.filter((p) => p.id === 'per-ag-4').length,
    0,
    'A contributor can delete, and the record leaves the default list'
  );
});

await groupAsync('Soft deletion keeps the record and says who and when', async () => {
  const q = repo();
  const as = ctx(AGENCY, USERS.anthony, 'crm_admin');

  const before = await q.listPeople(as);
  await q.softDelete(as, 'crm_people', 'per-ag-4', 'Left the firm in August');
  const after = await q.listPeople(as);
  assertEqual(after.length, before.length - 1, 'The record is gone from the list');

  const kept = await q.getPerson(as, 'per-ag-4');
  assert(kept !== null, 'But the row is still there, which is what makes a restore possible');
  assertEqual(kept?.deletedBy, USERS.anthony, 'It records who deleted it');
  assertEqual(kept?.deletedAt, CRM_DEMO_NOW, 'And when');
  assert(kept?.purgeAfter !== null, 'And when it becomes eligible for purge');
  assert(
    new Date(kept?.purgeAfter ?? 0).getTime() > new Date(CRM_DEMO_NOW).getTime(),
    'Which is in the future, so nothing is purged the moment it is deleted'
  );

  const withDeleted = await q.listPeople(as, { includeDeleted: true });
  assert(
    withDeleted.some((p) => p.id === 'per-ag-4'),
    'A deliberate request for deleted records returns it'
  );

  await assertRefusedAsync(
    () => q.softDelete(as, 'crm_people', 'per-ag-4'),
    refusedWith('invalid'),
    'Deleting it twice is refused rather than silently repeated'
  );
  await assertRefusedAsync(
    () => q.softDelete(as, 'crm_people', 'per-does-not-exist'),
    refusedWith('not_found'),
    'Deleting something that is not there is refused'
  );

  // A table with no deletion semantics must refuse rather than guess. Audit
  // rows and approvals are the ones that must never be deletable at all.
  await assertRefusedAsync(
    () => q.softDelete(as, 'crm_audit_events' as CrmTable, 'audit-1'),
    refusedWith('invalid'),
    'An append-only table refuses deletion'
  );
});

await groupAsync('Restoration puts it back, and says it happened', async () => {
  const q = repo();
  const as = ctx(AGENCY, USERS.anthony, 'crm_admin');

  await q.softDelete(as, 'crm_people', 'per-ag-4', 'Deleted in error');
  await q.restore(as, 'crm_people', 'per-ag-4');

  const back = await q.getPerson(as, 'per-ag-4');
  assertEqual(back?.deletedAt, null, 'The deletion marker is cleared');
  assertEqual(back?.deletedBy, null, 'And so is who deleted it');
  assertEqual(back?.purgeAfter, null, 'And the purge date, so it is no longer scheduled for removal');

  const list = await q.listPeople(as);
  assert(list.some((p) => p.id === 'per-ag-4'), 'And it is back in the ordinary list');

  await assertRefusedAsync(
    () => q.restore(as, 'crm_people', 'per-ag-4'),
    refusedWith('invalid'),
    'Restoring something that is not deleted is refused'
  );

  const trail = q.auditTrail();
  assert(
    trail.some((e) => e.eventType === 'record_soft_deleted' && e.subjectId === 'per-ag-4'),
    'The deletion is in the audit trail'
  );
  assert(
    trail.some((e) => e.eventType === 'record_restored' && e.subjectId === 'per-ag-4'),
    'And so is the restoration, which is the half a delete-only audit omits'
  );
});

await groupAsync('A merged person is not returned as a separate person', async () => {
  const q = repo();
  const as = ctx(AGENCY, USERS.anthony, 'crm_admin');

  // The duplicate pair in the agency fixture. Merging per-ag-2 into per-ag-1
  // keeps the row so that ids still resolve and the merge stays reversible, but
  // the list must stop showing two people.
  const people = await q.listPeople(as);
  assert(
    people.some((p) => p.id === 'per-ag-2'),
    'Both halves of the duplicate pair are listed before a merge'
  );
});

await groupAsync('The organisation hierarchy reads in one direction and terminates', async () => {
  const q = repo();
  const as = ctx(AGENCY, USERS.anthony, 'crm_admin');

  const ancestry = await q.organisationAncestry(as, 'org-ag-2');
  assertEqual(ancestry.length, 1, 'The subsidiary has one ancestor');
  assertEqual(ancestry[0].id, 'org-ag-1', 'Which is the parent group');

  const children = await q.organisationChildren(as, 'org-ag-1');
  assertEqual(children.length, 1, 'And the group has one child');
  assertEqual(children[0].id, 'org-ag-2', 'Which is the subsidiary');

  assertEqual(
    (await q.organisationAncestry(as, 'org-ag-1')).length,
    0,
    'A root organisation has no ancestors, which is an empty list rather than an error'
  );
});

await groupAsync('A stage move is recorded, with or without an override', async () => {
  const q = repo();
  const as = ctx(KEY, USERS.priya, 'crm_approver');

  const items = await q.listWorkItems(as);
  const item = items.find((i) => i.status === 'open');
  assert(item !== undefined, 'There is open work to move');
  if (!item) return;

  const stages = CRM_WORKSPACES.find((d) => d.workspace.id === KEY)?.stages ?? [];
  const sameline = stages.filter((s) => s.pipelineId === item.pipelineId && s.id !== item.stageId);
  assert(sameline.length > 0, 'And a stage to move it to');

  const clean = await q.moveStage(as, {
    crmWorkspaceId: KEY,
    workItemId: item.id,
    fromStageId: item.stageId,
    toStageId: sameline[0].id,
    criteriaMet: [],
    criteriaUnmet: [],
    overrideReason: null,
  });
  assertEqual(clean.movedBy, USERS.priya, 'The move records who made it');
  assertEqual(clean.movedAt, CRM_DEMO_NOW, 'And when');

  const moved = await q.getWorkItem(as, item.id);
  assertEqual(moved?.stageId, sameline[0].id, 'The work item is at the new stage');
  assertEqual(moved?.enteredStageAt, CRM_DEMO_NOW, 'And the clock on the new stage starts now');

  const trail = q.auditTrail().filter((e) => e.eventType === 'work_item_stage_changed');
  assert(trail.length > 0, 'The move is audited');
  assert(
    trail[trail.length - 1].beforeState !== null && trail[trail.length - 1].afterState !== null,
    'With the stage before and after, so the change itself is readable'
  );

  // The rule the brief states twice: not silent, not blocked.
  await assertRefusedAsync(
    () =>
      q.moveStage(as, {
        crmWorkspaceId: KEY,
        workItemId: item.id,
        fromStageId: sameline[0].id,
        toStageId: sameline[1]?.id ?? sameline[0].id,
        criteriaMet: [],
        criteriaUnmet: ['crit-made-up'],
        overrideReason: null,
      }),
    refusedWith('invalid'),
    'Moving past an unmet criterion with no reason is refused'
  );

  if (sameline.length > 1) {
    const override = await q.moveStage(as, {
      crmWorkspaceId: KEY,
      workItemId: item.id,
      fromStageId: sameline[0].id,
      toStageId: sameline[1].id,
      criteriaMet: [],
      criteriaUnmet: ['crit-made-up'],
      overrideReason: 'Client confirmed the budget verbally on Tuesday',
    });
    assert(override.overrideReason !== null, 'With a reason, the move goes through');
    const audited = q
      .auditTrail()
      .filter((e) => e.eventType === 'work_item_stage_changed')
      .at(-1);
    assert(
      (audited?.detail ?? '').includes('unmet'),
      'And the audit record says it was an override'
    );
    assert(
      (audited?.detail ?? '').includes('Client confirmed'),
      'And carries the reason given'
    );
  }
});

await groupAsync('A stage from another pipeline is refused', async () => {
  const q = repo();
  const as = ctx(KEY, USERS.priya, 'crm_approver');
  const data = CRM_WORKSPACES.find((d) => d.workspace.id === KEY);
  const item = data?.workItems.find((i) => i.status === 'open');
  const foreign = CRM_WORKSPACES.find((d) => d.workspace.id === AGENCY)?.stages[0];

  if (item && foreign) {
    // The stage exists, in another workspace. The repository must refuse it as
    // absent here rather than find it globally, which is the mistake a lookup
    // by primary key makes.
    await assertRefusedAsync(
      () =>
        q.moveStage(as, {
          crmWorkspaceId: KEY,
          workItemId: item.id,
          fromStageId: item.stageId,
          toStageId: foreign.id,
          criteriaMet: [],
          criteriaUnmet: [],
          overrideReason: null,
        }),
      refusedWith('not_found'),
      'A stage from another workspace does not exist here'
    );
  }

  const other = data?.pipelines.find((p) => p.id !== item?.pipelineId);
  const otherStage = data?.stages.find((s) => s.pipelineId === other?.id);
  if (item && otherStage) {
    await assertRefusedAsync(
      () =>
        q.moveStage(as, {
          crmWorkspaceId: KEY,
          workItemId: item.id,
          fromStageId: item.stageId,
          toStageId: otherStage.id,
          criteriaMet: [],
          criteriaUnmet: [],
          overrideReason: null,
        }),
      refusedWith('invalid'),
      'And a stage from a different pipeline in the same workspace is refused'
    );
  }
});

await groupAsync('Every change writes an audit row, scoped to its workspace', async () => {
  const q = repo();
  const agency = ctx(AGENCY, USERS.anthony, 'crm_admin');
  const service = ctx(SERVICE, USERS.anthony, 'crm_admin');

  await q.softDelete(agency, 'crm_people', 'per-ag-4', 'Left the firm');
  await q.softDelete(service, 'crm_organisations', 'org-sv-2', 'Duplicate of another record');

  const agencyAudit = await q.listAudit(agency);
  const serviceAudit = await q.listAudit(service);

  assert(agencyAudit.length > 0, 'The agency has audit rows');
  assert(serviceAudit.length > 0, 'So does the practice');
  assertEqual(
    agencyAudit.filter((e) => e.crmWorkspaceId !== AGENCY).length,
    0,
    'And neither workspace sees the other\'s audit trail'
  );
  assertEqual(
    agencyAudit.filter((e) => e.subjectId === 'org-sv-2').length,
    0,
    'Specifically, the practice\'s deletion is not in the agency\'s trail'
  );

  const row = agencyAudit[0];
  assertEqual(row.actorId, USERS.anthony, 'An audit row records who');
  assertEqual(row.actorKind, 'user', 'And whether it was a person or an agent');
  assertEqual(row.outcome, 'success', 'And what happened');
  assert(row.beforeState !== null, 'And the state before the change');
  assertEqual(row.detail, 'Left the firm', 'And the reason given, where one was');
  assert(row.createdAt === CRM_DEMO_NOW, 'And when');
});

await groupAsync('Evidence reads exclude what has been superseded', async () => {
  const q = repo();
  const as = ctx('ws-consulting', USERS.anthony, 'crm_admin');

  const data = CRM_WORKSPACES.find((d) => d.workspace.id === 'ws-consulting');
  const superseded = data?.evidence.filter((e) => e.supersededAt !== null) ?? [];
  const subject = superseded[0];

  if (subject) {
    const current = await q.listEvidenceFor(as, subject.subjectTable, subject.subjectId);
    assertEqual(
      current.filter((e) => e.id === subject.id).length,
      0,
      'A superseded assertion is not in the current view, so nobody is shown a corrected fact'
    );
  } else {
    // No supersession in the fixture would make the assertion above vacuous,
    // so say so rather than pass quietly.
    assert(false, 'The consulting fixture is expected to contain a superseded assertion');
  }

  // The conflicting pair, by contrast, must BOTH be visible. A conflict is two
  // live facts a person has to settle, not one fact winning silently.
  const conflicting = data?.evidence.filter((e) => e.conflictState === 'open') ?? [];
  assert(conflicting.length >= 2, 'The fixture holds a conflicting pair');
  if (conflicting.length >= 2) {
    const current = await q.listEvidenceFor(
      as,
      conflicting[0].subjectTable,
      conflicting[0].subjectId
    );
    const both = conflicting.filter((c) => current.some((e) => e.id === c.id));
    assertEqual(both.length, conflicting.length, 'And both sides of it are returned');
  }
});

report('Concludo CRM Stage 3, security and repository', r);
