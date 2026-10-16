/**
 * Concludo CRM, Stage 3: the synthetic demonstration dataset.
 *
 * WHAT THIS SUITE IS FOR.
 *
 * Two jobs, and they are different jobs.
 *
 * The first is referential integrity. Demonstration data that points at records
 * which are not there produces a demonstration that breaks in front of a buyer,
 * and it produces tests elsewhere that pass for the wrong reason. Every
 * reference is resolved here, inside its own workspace, because a reference
 * that resolves to a record in a DIFFERENT workspace is the exact failure the
 * tenancy model exists to prevent and it would otherwise look fine.
 *
 * The second is coverage of the twenty conditions the brief names. These are
 * asserted by COMPUTING them from the data rather than by looking up an id the
 * author remembers putting there. If the condition is removed from the data,
 * the test fails; if the test merely checked that `wi-ka-3` exists, renaming a
 * record would break the test while removing the condition would not.
 *
 * Run: bun tests/crm.dataset.test.ts
 */
import {
  CrmWorkspaceData,
  Organisation,
  Person,
} from '../src/lib/crm/domain';
import { CRM_WORKSPACES, USERS, getCrmWorkspace } from '../src/lib/crm/data/workspaces';
import { CRM_DEMO_NOW } from '../src/lib/crm/data/factory';
import { group, makeAssert, recorder, report } from './crm/stage3Harness';

const r = recorder();
const { assert, assertEqual } = makeAssert(r);

const ALL = CRM_WORKSPACES;
const NOW = new Date(CRM_DEMO_NOW).getTime();

/** Every workspace, by the name the report uses for it. */
const byId = new Map(ALL.map((d) => [d.workspace.id, d]));
const EXPECTED_IDS = [
  'ws-sole-trader',
  'ws-service',
  'ws-agency',
  'ws-consulting',
  'ws-key-accounts',
];

function ws(id: string): CrmWorkspaceData {
  const found = byId.get(id);
  if (!found) throw new Error(`The suite expects a workspace ${id} and there is none.`);
  return found;
}

/** Does any workspace satisfy this, and which ones. */
function where(predicate: (d: CrmWorkspaceData) => boolean): string[] {
  return ALL.filter(predicate).map((d) => d.workspace.id);
}

const daysSince = (iso: string): number =>
  Math.floor((NOW - new Date(iso).getTime()) / 86_400_000);

/* ===================================================== the five shapes */

group('The five business shapes', () => {
  assertEqual(ALL.length, 5, 'There are five workspaces');

  for (const id of EXPECTED_IDS) {
    assert(byId.has(id), `${id} is present`);
  }

  assertEqual(ws('ws-sole-trader').workspace.depth, 'sole_trader', 'The coach is a sole trader');
  // The rest span the remaining depths. The specific label each one carries is
  // a design choice; what the suite holds to is that more than one depth is
  // exercised, so no interface decision can quietly assume a single shape.
  assert(
    new Set(ALL.map((d) => d.workspace.depth)).size >= 3,
    'At least three workspace depths are exercised'
  );

  // A sole trader has nobody to assign anything to. If the fixture quietly
  // gives them a colleague, every "unassigned" case in the interface goes
  // untested.
  assertEqual(ws('ws-sole-trader').members.length, 1, 'The sole trader works alone');
  assert(
    ws('ws-key-accounts').members.length >= 3,
    'The key-account team has enough people for ownership to be a real question'
  );

  assertEqual(getCrmWorkspace('ws-agency')?.workspace.name, 'Harbourline Property Group',
    'getCrmWorkspace finds a workspace by id');
  assertEqual(getCrmWorkspace('ws-nothing'), null, 'getCrmWorkspace returns null for an unknown id');
});

/* ====================================== 1. tenancy on every single row */

group('Every row carries its own workspace', () => {
  for (const d of ALL) {
    const w = d.workspace.id;
    let rows = 0;
    let wrong = 0;

    for (const [key, value] of Object.entries(d)) {
      if (key === 'workspace' || !Array.isArray(value)) continue;
      for (const row of value as { crmWorkspaceId?: string }[]) {
        if (!('crmWorkspaceId' in row)) continue;
        rows += 1;
        if (row.crmWorkspaceId !== w) wrong += 1;
      }
    }

    assert(rows > 25, `${w} holds enough rows to be worth checking (${rows})`);
    assertEqual(wrong, 0, `${w}: every row's crm_workspace_id is its own workspace`);
  }
});

/* =========================================== 2. referential integrity */

group('Every reference resolves, inside its own workspace', () => {
  for (const d of ALL) {
    const w = d.workspace.id;
    const orgs = new Set(d.organisations.map((o) => o.id));
    const people = new Set(d.people.map((p) => p.id));
    const items = new Set(d.workItems.map((i) => i.id));
    const pipelines = new Set(d.pipelines.map((p) => p.id));
    const stages = new Set(d.stages.map((s) => s.id));
    const criteria = new Set(d.stageCriteria.map((c) => c.id));
    const activities = new Set(d.activities.map((a) => a.id));
    const plans = new Set(d.accountPlans.map((p) => p.id));
    const evidence = new Set(d.evidence.map((e) => e.id));
    const quotes = new Set(d.quotes.map((q) => q.id));
    const fields = new Set(d.customFieldDefinitions.map((f) => f.id));
    const members = new Set(d.members.map((m) => m.userId));

    const broken: string[] = [];
    const check = (
      ok: boolean,
      what: string
    ): void => {
      if (!ok) broken.push(what);
    };
    const opt = (set: Set<string>, value: string | null, what: string): void => {
      if (value !== null) check(set.has(value), what);
    };

    for (const o of d.organisations) {
      opt(orgs, o.parentOrganisationId, `organisation ${o.id} parent`);
      opt(members, o.ownerUserId, `organisation ${o.id} owner`);
      opt(members, o.relationshipOwnerUserId, `organisation ${o.id} relationship owner`);
      opt(members, o.dataQualityOwnerUserId, `organisation ${o.id} data quality owner`);
    }

    for (const p of d.people) {
      opt(orgs, p.organisationId, `person ${p.id} organisation`);
      opt(people, p.mergedIntoPersonId, `person ${p.id} merge target`);
      opt(members, p.ownerUserId, `person ${p.id} owner`);
      opt(members, p.relationshipOwnerUserId, `person ${p.id} relationship owner`);
    }

    for (const role of d.personOrganisationRoles) {
      check(people.has(role.personId), `role ${role.id} person`);
      check(orgs.has(role.organisationId), `role ${role.id} organisation`);
    }

    for (const rel of d.relationships) {
      const from = rel.fromKind === 'person' ? people : orgs;
      const to = rel.toKind === 'person' ? people : orgs;
      check(from.has(rel.fromId), `relationship ${rel.id} from`);
      check(to.has(rel.toId), `relationship ${rel.id} to`);
    }

    for (const l of d.leads) {
      opt(people, l.convertedPersonId, `lead ${l.id} converted person`);
      opt(orgs, l.convertedOrganisationId, `lead ${l.id} converted organisation`);
      opt(items, l.convertedWorkItemId, `lead ${l.id} converted work item`);
      opt(members, l.ownerUserId, `lead ${l.id} owner`);
    }

    for (const s of d.stages) check(pipelines.has(s.pipelineId), `stage ${s.id} pipeline`);
    for (const c of d.stageCriteria) check(stages.has(c.stageId), `criterion ${c.id} stage`);

    for (const i of d.workItems) {
      check(pipelines.has(i.pipelineId), `work item ${i.id} pipeline`);
      check(stages.has(i.stageId), `work item ${i.id} stage`);
      opt(orgs, i.organisationId, `work item ${i.id} organisation`);
      opt(people, i.primaryPersonId, `work item ${i.id} primary person`);
      opt(members, i.ownerUserId, `work item ${i.id} owner`);
      opt(members, i.actionOwnerUserId, `work item ${i.id} action owner`);

      // The stage a work item sits at has to belong to the pipeline it is in.
      // The database refuses this with a trigger; the fixture must not contain
      // what the database would refuse.
      const stage = d.stages.find((s) => s.id === i.stageId);
      check(stage?.pipelineId === i.pipelineId, `work item ${i.id} stage is in its own pipeline`);
    }

    for (const m of d.stageMoves) {
      check(items.has(m.workItemId), `stage move ${m.id} work item`);
      check(stages.has(m.toStageId), `stage move ${m.id} destination stage`);
      opt(stages, m.fromStageId, `stage move ${m.id} origin stage`);
      for (const id of [...m.criteriaMet, ...m.criteriaUnmet]) {
        check(criteria.has(id), `stage move ${m.id} criterion ${id}`);
      }
    }

    for (const a of d.activities) {
      opt(orgs, a.organisationId, `activity ${a.id} organisation`);
      opt(items, a.workItemId, `activity ${a.id} work item`);
    }

    for (const p of d.activityParticipants) {
      check(activities.has(p.activityId), `participant ${p.id} activity`);
      opt(people, p.personId, `participant ${p.id} person`);
    }

    for (const m of d.meetings) check(activities.has(m.activityId), `meeting ${m.id} activity`);

    for (const e of d.emailReferences) {
      opt(activities, e.activityId, `email reference ${e.id} activity`);
      opt(orgs, e.organisationId, `email reference ${e.id} organisation`);
      opt(items, e.workItemId, `email reference ${e.id} work item`);
      opt(people, e.personId, `email reference ${e.id} person`);
    }

    for (const c of d.commitments) {
      opt(people, c.ownerPersonId, `commitment ${c.id} person`);
      opt(members, c.ownerUserId, `commitment ${c.id} user`);
      opt(orgs, c.organisationId, `commitment ${c.id} organisation`);
      opt(items, c.workItemId, `commitment ${c.id} work item`);
      opt(activities, c.activityId, `commitment ${c.id} activity`);
    }

    for (const dec of d.decisions) {
      opt(people, dec.decidedByPersonId, `decision ${dec.id} person`);
      opt(orgs, dec.organisationId, `decision ${dec.id} organisation`);
      opt(items, dec.workItemId, `decision ${dec.id} work item`);
      opt(activities, dec.activityId, `decision ${dec.id} activity`);
    }

    for (const q of d.quotes) {
      opt(items, q.workItemId, `quote ${q.id} work item`);
      opt(orgs, q.organisationId, `quote ${q.id} organisation`);
      opt(people, q.personId, `quote ${q.id} person`);
    }
    for (const line of d.quoteLines) check(quotes.has(line.quoteId), `quote line ${line.id} quote`);

    for (const c of d.serviceCases) {
      check(orgs.has(c.organisationId), `service case ${c.id} organisation`);
      opt(people, c.personId, `service case ${c.id} person`);
      opt(items, c.workItemId, `service case ${c.id} work item`);
    }

    for (const p of d.accountPlans) {
      check(orgs.has(p.organisationId), `account plan ${p.id} organisation`);
      opt(members, p.planOwnerUserId, `account plan ${p.id} owner`);
    }
    for (const o of d.accountPlanOutcomes) {
      check(plans.has(o.accountPlanId), `plan outcome ${o.id} plan`);
    }

    for (const c of d.consentRecords) check(people.has(c.personId), `consent ${c.id} person`);
    for (const p of d.communicationPreferences) {
      check(people.has(p.personId), `preference ${p.id} person`);
    }

    for (const v of d.customFieldValues) {
      check(fields.has(v.definitionId), `custom value ${v.id} definition`);
    }

    for (const e of d.evidence) {
      opt(evidence, e.supersededById, `evidence ${e.id} supersession target`);
      opt(evidence, e.conflictsWithId, `evidence ${e.id} conflict partner`);
      opt(members, e.confirmedBy, `evidence ${e.id} confirmer`);
    }

    for (const p of d.proposals) {
      opt(evidence, p.evidenceId, `proposal ${p.id} evidence`);
    }

    for (const n of d.notes) {
      opt(orgs, n.organisationId, `note ${n.id} organisation`);
      opt(people, n.personId, `note ${n.id} person`);
      opt(items, n.workItemId, `note ${n.id} work item`);
      opt(activities, n.activityId, `note ${n.id} activity`);
      opt(members, n.authorUserId, `note ${n.id} author`);
    }

    for (const t of d.tasks) {
      opt(orgs, t.organisationId, `task ${t.id} organisation`);
      opt(people, t.personId, `task ${t.id} person`);
      opt(items, t.workItemId, `task ${t.id} work item`);
      opt(members, t.actionOwnerUserId, `task ${t.id} action owner`);
    }

    const orders = new Set(d.orderReferences.map((o) => o.id));
    for (const o of d.orderReferences) {
      opt(orgs, o.organisationId, `order reference ${o.id} organisation`);
      opt(items, o.workItemId, `order reference ${o.id} work item`);
    }
    for (const inv of d.invoiceReferences) {
      opt(orgs, inv.organisationId, `invoice reference ${inv.id} organisation`);
      opt(items, inv.workItemId, `invoice reference ${inv.id} work item`);
      opt(orders, inv.orderReferenceId, `invoice reference ${inv.id} order`);
    }

    const tags = new Set(d.tags.map((t) => t.id));
    for (const rt of d.recordTags) check(tags.has(rt.tagId), `record tag ${rt.id} tag`);

    const objects = new Set(d.customObjectDefinitions.map((o) => o.id));
    for (const rec of d.customObjectRecords) {
      check(objects.has(rec.definitionId), `custom object record ${rec.id} definition`);
    }

    const proposals = new Set(d.proposals.map((x) => x.id));
    for (const a of d.approvals) {
      check(proposals.has(a.proposalId), `approval ${a.id} proposal`);
      check(members.has(a.decidedBy), `approval ${a.id} decider`);
    }

    for (const c of d.duplicateCandidates) {
      const set = c.subjectTable === 'crm_people' ? people : orgs;
      check(set.has(c.leftId), `duplicate ${c.id} left`);
      check(set.has(c.rightId), `duplicate ${c.id} right`);
    }

    assertEqual(
      broken.length,
      0,
      `${w}: every reference resolves${broken.length ? ' (' + broken.slice(0, 6).join(', ') + ')' : ''}`
    );
  }
});

group('No reference crosses a workspace boundary', () => {
  // The ids are globally unique in the fixture, so a cross-workspace reference
  // would resolve against another workspace's record and look correct. This
  // checks the thing that would actually be wrong: an id belonging to a
  // workspace other than the one holding the row.
  const owner = new Map<string, string>();
  for (const d of ALL) {
    for (const [key, value] of Object.entries(d)) {
      if (key === 'workspace' || !Array.isArray(value)) continue;
      for (const row of value as { id?: string }[]) {
        if (typeof row.id === 'string') owner.set(row.id, d.workspace.id);
      }
    }
  }

  let strays = 0;
  for (const d of ALL) {
    for (const [key, value] of Object.entries(d)) {
      if (key === 'workspace' || !Array.isArray(value)) continue;
      for (const row of value as Record<string, unknown>[]) {
        for (const [field, v] of Object.entries(row)) {
          if (field === 'id' || field === 'crmWorkspaceId') continue;
          if (typeof v !== 'string') continue;
          const home = owner.get(v);
          if (home && home !== d.workspace.id) {
            strays += 1;
            console.error(`  stray  ${d.workspace.id}.${field} = ${v} (lives in ${home})`);
          }
        }
      }
    }
  }
  assertEqual(strays, 0, 'No field in any workspace points at another workspace\'s record');
});

/* ======================================= 3. nothing here is anybody's */

group('Nothing in the fixture could be a real person', () => {
  const addresses: string[] = [];
  const phones: string[] = [];

  for (const d of ALL) {
    for (const p of d.people) {
      for (const a of [p.primaryEmail, p.secondaryEmail]) if (a) addresses.push(a);
      if (p.phone) phones.push(p.phone);
    }
    for (const l of d.leads) if (l.email) addresses.push(l.email);
    for (const o of d.organisations) if (o.website) addresses.push(o.website);
  }

  assert(addresses.length > 10, `There are enough addresses to be worth checking (${addresses.length})`);
  const realLooking = addresses.filter((a) => !a.includes('.example'));
  assertEqual(
    realLooking.length,
    0,
    `Every address uses the reserved .example domain${realLooking.length ? ' (' + realLooking.slice(0, 3).join(', ') + ')' : ''}`
  );

  // The reserved Australian fictional ranges: 5550 0000 to 5550 0999 behind an
  // area code, and 0491 570 006 and the like for mobiles.
  const badPhones = phones.filter((p) => !/5550 0\d{3}$/.test(p) && !/^\+61 4\d\d 5\d\d \d\d\d$/.test(p));
  assertEqual(
    badPhones.length,
    0,
    `Every phone number is in a reserved fictional range${badPhones.length ? ' (' + badPhones.slice(0, 3).join(', ') + ')' : ''}`
  );

  // No email reference may carry an address at all, in any workspace. The
  // column is called accountReference and is meant to be opaque.
  const leaked = ALL.flatMap((d) => d.emailReferences).filter((e) =>
    e.accountReference.includes('@')
  );
  assertEqual(leaked.length, 0, 'No email reference stores an address in place of an opaque reference');
});

/* =================================== 4. the twenty named conditions */

group('The twenty demonstration conditions', () => {
  const found: Record<string, string[]> = {};
  const condition = (name: string, predicate: (d: CrmWorkspaceData) => boolean): void => {
    const hits = where(predicate);
    found[name] = hits;
    assert(hits.length > 0, `${name}: present (${hits.join(', ') || 'nowhere'})`);
  };

  condition('New leads', (d) => d.leads.some((l) => l.state === 'awaiting_review'));

  condition('Duplicate contacts', (d) =>
    d.duplicateCandidates.some((c) => c.state === 'open' && c.recommendation === 'review_together')
  );

  condition('Stale records', (d) =>
    d.organisations.some((o) => {
      const touched = d.activities
        .filter((a) => a.organisationId === o.id && a.deletedAt === null)
        .map((a) => a.occurredAt)
        .sort()
        .at(-1);
      return touched !== undefined && daysSince(touched) > 90;
    })
  );

  condition('Parent and child organisations', (d) =>
    d.organisations.some((o) => o.parentOrganisationId !== null)
  );

  condition('Opportunities at different stages', (d) => {
    const open = d.workItems.filter((i) => i.status === 'open');
    return new Set(open.map((i) => i.stageId)).size >= 3;
  });

  condition('Jobs', (d) => d.workItems.some((i) => i.workItemType === 'job'));

  condition('Commitments', (d) => d.commitments.some((c) => c.state === 'open'));

  condition('Decisions', (d) => d.decisions.length > 0);

  condition('Service issues', (d) =>
    d.serviceCases.some((c) => c.state !== 'resolved' && c.state !== 'closed')
  );

  condition('Account plans', (d) => d.accountPlans.length > 0 && d.accountPlanOutcomes.length > 0);

  condition('Missing next steps', (d) =>
    d.workItems.some((i) => i.status === 'open' && i.nextStep === null)
  );

  // Two live assertions about the same field of the same record, each marked as
  // conflicting with the other. Not one superseding the other: an open
  // conflict a person has to settle.
  condition('Conflicting dates', (d) =>
    d.evidence.some(
      (e) =>
        e.conflictState === 'open' &&
        e.conflictsWithId !== null &&
        e.supersededAt === null &&
        /date/i.test(e.fieldName)
    )
  );

  condition('Unconfirmed AI proposals', (d) =>
    d.proposals.some((p) => p.state === 'awaiting_confirmation' && p.modelVersion !== null)
  );

  condition('Personal and work communication', (d) =>
    d.emailReferences.some((e) => e.accountScope === 'personal') ||
    d.people.some((p) => p.primaryEmailScope === 'personal')
  );

  condition('Consent preferences', (d) =>
    d.consentRecords.length > 0 && d.communicationPreferences.length > 0
  );

  condition('A customer approaching renewal', (d) =>
    d.organisations.some((o) => {
      if (o.renewalDate === null) return false;
      const days = -daysSince(o.renewalDate);
      return days >= 0 && days <= 120;
    })
  );

  // One named contact and nothing else. The risk the interface has to show,
  // and the reason the stakeholder role is a separate table.
  condition('A relationship on one contact alone', (d) =>
    d.organisations.some((o) => {
      const live = d.people.filter(
        (p) => p.organisationId === o.id && p.deletedAt === null && p.mergedIntoPersonId === null
      );
      return (
        live.length === 1 &&
        d.workItems.some((i) => i.organisationId === o.id && i.status === 'open')
      );
    })
  );

  condition('An opportunity with no decision maker', (d) =>
    d.workItems.some((i) => {
      if (i.status !== 'open' || i.organisationId === null) return false;
      const roles = d.personOrganisationRoles.filter((x) => x.organisationId === i.organisationId);
      return roles.length > 0 && !roles.some((x) => x.stakeholderRole === 'decision_maker');
    })
  );

  condition('A quote awaiting response', (d) =>
    d.quotes.some((q) => q.state === 'awaiting_response' || (q.state === 'sent' && q.respondedOn === null))
  );

  // The one that catches a dashboard bug rather than a data bug: a resolved
  // record that still looks active somewhere.
  condition('A resolved item not shown as active', (d) =>
    d.workItems.some((i) => i.status !== 'open' && i.resolvedAt !== null) ||
    d.serviceCases.some((c) => c.state === 'resolved' && c.resolvedAt !== null)
  );

  assertEqual(Object.keys(found).length, 20, 'All twenty conditions are checked');
});

group('A resolved record never reads as open', () => {
  for (const d of ALL) {
    const w = d.workspace.id;
    const wrong = d.workItems.filter(
      (i) => (i.status === 'open') !== (i.resolvedAt === null)
    );
    assertEqual(wrong.length, 0, `${w}: status and resolvedAt agree on every work item`);

    const cases = d.serviceCases.filter(
      (c) => (c.state === 'resolved' || c.state === 'closed') !== (c.resolvedAt !== null)
    );
    assertEqual(cases.length, 0, `${w}: state and resolvedAt agree on every service case`);

    const commitments = d.commitments.filter(
      (c) => (c.state === 'done') !== (c.completedAt !== null)
    );
    assertEqual(commitments.length, 0, `${w}: state and completedAt agree on every commitment`);
  }
});

/* ======================================== 5. custom terminology */

group('Custom terminology', () => {
  // The bookkeeper calls the thing a job. One table, a configurable label: the
  // alternative is five near-identical tables and a migration every time a
  // customer uses a different word.
  assertEqual(ws('ws-service').workspace.recordTerminology, 'job', 'The bookkeeper has jobs');
  assertEqual(ws('ws-service').workspace.recordTerminologyPlural, 'Jobs', 'Plural form is set');
  assertEqual(ws('ws-agency').workspace.recordTerminology, 'deal', 'The agency has deals');

  for (const d of ALL) {
    const w = d.workspace.id;
    // WHERE THE WORD HAS TO AGREE, AND WHERE IT DOES NOT.
    //
    // This check used to require every pipeline in a workspace to carry the
    // workspace's own word. That was too strong, and the schema never asked for
    // it: `work_item_type` sits on the pipeline and on the work item, and the
    // workspace's `record_terminology` is a default, not a constraint. A real
    // agency runs a sales pipeline next to a property management pipeline, and
    // the second one holds jobs, not deals.
    //
    // What actually has to hold is narrower and stricter: a work item must be
    // the kind its own pipeline says it is, because the pipeline is what puts a
    // heading over it. That is the failure the original check was aimed at, and
    // it is tested here directly rather than through a proxy that also banned
    // something legitimate.
    const byPipeline = new Map(d.pipelines.map((p) => [p.id, p.workItemType]));
    const mismatched = d.workItems.filter(
      (i) => byPipeline.get(i.pipelineId) !== undefined && i.workItemType !== byPipeline.get(i.pipelineId)
    );
    assertEqual(mismatched.length, 0, `${w}: every work item is the kind its own pipeline names`);

    const orphaned = d.workItems.filter((i) => !byPipeline.has(i.pipelineId));
    assertEqual(orphaned.length, 0, `${w}: every work item sits in a pipeline of this workspace`);

    // The default pipeline is the one the workspace's own word describes, so a
    // workspace that calls its records jobs does not open on a board of deals.
    const defaultPipeline = d.pipelines.find((p) => p.isDefault) ?? d.pipelines[0];
    if (defaultPipeline) {
      assertEqual(
        defaultPipeline.workItemType,
        d.workspace.recordTerminology,
        `${w}: the default pipeline is the kind this workspace names`
      );
    }

    assert(
      d.workspace.recordTerminologyPlural.trim().length > 0,
      `${w}: the plural form is not blank`
    );
  }

  // Renaming a noun must not require a schema change, so the renames live in
  // one JSON column and at least one workspace has to exercise it.
  assert(
    ALL.some((d) => Object.keys(d.workspace.terminology).length > 0),
    'At least one workspace renames other nouns through the terminology map'
  );
});

/* ========================================= 6. ownership, not ranking */

group('Ownership is responsibility, never a measure', () => {
  for (const d of ALL) {
    const w = d.workspace.id;
    const members = new Set(d.members.map((m) => m.userId));

    // Every owner is a member. An owner who is not a member is work assigned
    // to somebody who cannot see it.
    const orphaned = [
      ...d.organisations.flatMap((o) => [o.ownerUserId, o.relationshipOwnerUserId, o.dataQualityOwnerUserId]),
      ...d.workItems.flatMap((i) => [i.ownerUserId, i.actionOwnerUserId]),
      ...d.accountPlans.map((p) => p.planOwnerUserId),
    ].filter((u): u is string => u !== null && !members.has(u));
    assertEqual(orphaned.length, 0, `${w}: every owner is a member of the workspace`);

    // The five kinds of ownership are separate columns on purpose. In at least
    // one workspace they must actually differ, or the model is a single owner
    // with four aliases and nobody has tested the distinction.
    if (d.members.length > 1) {
      const split =
        d.organisations.some(
          (o) =>
            o.ownerUserId !== null &&
            o.relationshipOwnerUserId !== null &&
            o.ownerUserId !== o.relationshipOwnerUserId
        ) ||
        d.organisations.some(
          (o) =>
            o.ownerUserId !== null &&
            o.dataQualityOwnerUserId !== null &&
            o.ownerUserId !== o.dataQualityOwnerUserId
        ) ||
        d.workItems.some(
          (i) =>
            i.ownerUserId !== null &&
            i.actionOwnerUserId !== null &&
            i.ownerUserId !== i.actionOwnerUserId
        );
      assert(split, `${w}: the kinds of ownership are exercised as different people`);
    }
  }

  assert(
    ALL.some((d) => d.organisations.some((o) => o.dataQualityOwnerUserId !== null)),
    'Data quality ownership is exercised somewhere'
  );
});

/* ================================= 7. the outsider, and the members */

group('The outsider is a real member of exactly one workspace', () => {
  // A tenancy test against a user who is a member of nothing tests almost
  // nothing: the wrong answer and the right answer look the same. The outsider
  // is a genuine admin somewhere, so "can they read the agency's data" is a
  // question with a wrong answer available.
  const memberOf = ALL.filter((d) => d.members.some((m) => m.userId === USERS.outsider));
  assertEqual(memberOf.length, 1, 'The outsider belongs to one workspace');
  assert(
    memberOf.length === 1 &&
      memberOf[0].members.some((m) => m.userId === USERS.outsider && m.crmRole === 'crm_admin'),
    'And holds admin there, so a leak would be a leak to somebody with every permission'
  );

  for (const d of ALL) {
    const ids = d.members.map((m) => m.userId);
    assertEqual(new Set(ids).size, ids.length, `${d.workspace.id}: nobody is a member twice`);
    assert(
      d.members.some((m) => m.crmRole === 'crm_admin'),
      `${d.workspace.id}: somebody can administer it`
    );
  }
});

/* ===================================== 8. evidence, in the fixture */

group('Evidence in the fixture is traceable or says it is not', () => {
  for (const d of ALL) {
    const w = d.workspace.id;

    const untraceable = d.evidence.filter(
      (e) =>
        e.basis !== 'unknown' &&
        e.sourceType !== 'none' &&
        e.sourceText === null &&
        e.sourceLocation === null &&
        e.sourceRecordId === null
    );
    assertEqual(untraceable.length, 0, `${w}: no known assertion lacks a source`);

    const halfVersioned = d.evidence.filter(
      (e) => (e.modelVersion === null) !== (e.promptVersion === null)
    );
    assertEqual(halfVersioned.length, 0, `${w}: model and prompt versions travel together`);

    // A superseded assertion and a conflicting one are different states. A row
    // that is both is a row nobody can reason about.
    const both = d.evidence.filter((e) => e.supersededAt !== null && e.conflictState === 'open');
    assertEqual(both.length, 0, `${w}: nothing is superseded and in open conflict at once`);

    // Conflict is recorded on BOTH sides. One-sided conflict means the record
    // you happen to open first looks settled.
    const oneSided = d.evidence.filter((e) => {
      if (e.conflictsWithId === null) return false;
      const other = d.evidence.find((x) => x.id === e.conflictsWithId);
      return other === undefined || other.conflictsWithId !== e.id;
    });
    assertEqual(oneSided.length, 0, `${w}: every conflict is recorded on both rows`);
  }

  const aiRows = ALL.flatMap((d) => d.evidence).filter((e) => e.modelVersion !== null);
  assert(aiRows.length > 0, 'Some assertions are AI-generated, so provenance is exercised');
  const human = ALL.flatMap((d) => d.evidence).filter((e) => e.modelVersion === null);
  assert(human.length > 0, 'Some assertions are human-entered, so the contrast is visible');
});

group('No proposal has been applied without being confirmed', () => {
  for (const d of ALL) {
    const wrong = d.proposals.filter((p) => p.appliedAt !== null && p.state !== 'confirmed');
    assertEqual(wrong.length, 0, `${d.workspace.id}: appliedAt implies confirmed`);
    const destructive = d.proposals.filter((p) => p.proposalKind === 'merge_duplicate' && !p.isDestructive);
    assertEqual(destructive.length, 0, `${d.workspace.id}: a merge is marked destructive`);
  }
  assert(
    ALL.some((d) => d.proposals.some((p) => p.isDestructive && p.state === 'awaiting_confirmation')),
    'A destructive proposal is waiting somewhere, so the confirmation path has something to test'
  );
});

/* ============================ 9. the duplicate pair, and the parent */

group('The duplicate pairs are the two shapes that matter', () => {
  const all = ALL.flatMap((d) => d.duplicateCandidates);

  const together = all.filter((c) => c.recommendation === 'review_together');
  assert(together.length > 0, 'At least one pair is worth reviewing together');

  // The important one. A pair that looks like a duplicate and is demonstrably
  // not one, so the interface has to be able to say so, and so the detector
  // can be tested for the failure that actually costs data.
  const separate = all.filter((c) => c.recommendation === 'likely_separate');
  assert(separate.length > 0, 'At least one pair is recommended as separate');

  for (const c of all) {
    assert(c.matchingFields.length > 0, `${c.id} says what matches`);
    assert(c.differingFields.length > 0, `${c.id} says what differs`);
    assert(c.reason.trim().length > 20, `${c.id} explains itself in a sentence`);
    assert(c.leftId !== c.rightId, `${c.id} is a pair of two records`);
    if (c.state === 'open') {
      assertEqual(c.decidedAt, null, `${c.id} is open and undecided`);
    } else {
      assert(c.decidedAt !== null, `${c.id} is decided and says when`);
    }
  }
});

/* ============================== 10. the personal boundary in the data */

group('The personal boundary holds in the fixture', () => {
  for (const d of ALL) {
    const w = d.workspace.id;
    const personal = d.emailReferences.filter((e) => e.accountScope === 'personal');
    const attached = personal.filter((e) => e.workItemId !== null || e.organisationId !== null);
    assertEqual(attached.length, 0, `${w}: no personal mailbox reference is attached to work`);

    if (d.workspace.workspaceScope === 'work') {
      assertEqual(
        personal.length,
        0,
        `${w}: a work workspace holds no personal mailbox references at all`
      );
    }
  }

  // The adjacent case, on a person rather than a mailbox: a personal address
  // recorded against a work contact. Legitimate to hold, and the interface has
  // to show the scope, so the fixture carries one.
  const scoped = ALL.flatMap((d) => d.people).filter((p) => p.primaryEmailScope === 'personal');
  assert(scoped.length > 0, 'A contact has a personal address, marked as personal');
});

/* ======================================== 11. consent and preferences */

group('Consent is a record, not a checkbox', () => {
  const consents = ALL.flatMap((d) => d.consentRecords);
  assert(consents.length > 0, 'There are consent records');

  for (const c of consents) {
    assert(c.capturedAt.length > 0, `${c.id} says when consent was captured`);
    if (c.basis === 'withdrawn') {
      assert(c.withdrawnAt !== null, `${c.id} is withdrawn and says when`);
    }
    if (c.withdrawnAt !== null) {
      assert(c.withdrawalNote !== null, `${c.id} says why it was withdrawn`);
    }
  }

  assert(
    consents.some((c) => c.consentType === 'recording'),
    'Recording consent is exercised, which is the one Concludo actually needs'
  );
  assert(
    consents.some((c) => c.basis === 'withdrawn'),
    'A withdrawal is present, so the interface has to handle one'
  );

  const prefs = ALL.flatMap((d) => d.communicationPreferences);
  const dnc = prefs.filter((p) => p.preference === 'do_not_contact');
  assert(dnc.length > 0, 'A do-not-contact is present');
  assertEqual(
    dnc.filter((p) => p.note.trim().length === 0).length,
    0,
    'Every do-not-contact carries a reason'
  );
});

/* =================================== 12. the fixture is reproducible */

group('The fixture is reproducible', () => {
  // Built twice, it must be the same both times. A fixture that moves with the
  // wall clock produces tests that pass in the morning.
  const first = JSON.stringify(getCrmWorkspace('ws-consulting'));
  const second = JSON.stringify(getCrmWorkspace('ws-consulting'));
  assertEqual(first, second, 'The same workspace serialises identically twice');

  const dates = ALL.flatMap((d) => [
    ...d.activities.map((a) => a.occurredAt),
    ...d.evidence.map((e) => e.capturedAt),
  ]);
  const future = dates.filter((iso) => new Date(iso).getTime() > NOW);
  assertEqual(future.length, 0, 'Nothing that has happened happens after the fixed demonstration date');
});

/* ================================= 13. retention is set, per workspace */

group('Retention is stated rather than assumed', () => {
  for (const d of ALL) {
    assert(
      d.retentionPolicies.length > 0,
      `${d.workspace.id}: at least one retention policy is recorded`
    );
    for (const p of d.retentionPolicies) {
      assert(p.retainDeletedDays > 0, `${p.id} keeps a deleted record for a stated number of days`);
    }
  }
});

/* ============================= 14. nothing in the model is unexercised */

group('Every collection the model defines is exercised somewhere', () => {
  // A table nobody put a row in is a table nobody has built an interface for,
  // and the gap only shows up when a buyer asks to see it. Two collections are
  // exempt and are named here rather than skipped quietly: both are produced at
  // runtime, not authored.
  const derivedAtRuntime = new Set([
    // Written by the repository on every change. A fixture row would be a
    // fabricated audit entry, which is worse than none.
    'auditEvents',
    // Computed from the record and its activity by recordQuality.ts. Storing a
    // pre-baked row would let the fixture and the computation disagree.
    'recordQuality',
  ]);

  const totals = new Map<string, number>();
  for (const d of ALL) {
    for (const [key, value] of Object.entries(d)) {
      if (key === 'workspace' || !Array.isArray(value)) continue;
      totals.set(key, (totals.get(key) ?? 0) + value.length);
    }
  }

  const empty = [...totals.entries()]
    .filter(([key, count]) => count === 0 && !derivedAtRuntime.has(key))
    .map(([key]) => key);

  assertEqual(
    empty.length,
    0,
    `No authored collection is empty across all five workspaces${empty.length ? ' (' + empty.join(', ') + ')' : ''}`
  );

  for (const key of derivedAtRuntime) {
    assertEqual(totals.get(key) ?? -1, 0, `${key} is left to be produced at runtime`);
  }

  const rows = [...totals.values()].reduce((a, b) => a + b, 0);
  assert(rows > 200, `The dataset is substantial enough to demonstrate on (${rows} rows)`);
});

group('A reference to an external system is a pointer, never a figure', () => {
  const refs = [
    ...ALL.flatMap((d) => d.orderReferences),
    ...ALL.flatMap((d) => d.invoiceReferences),
  ];
  assert(refs.length > 0, 'There are external references');

  for (const ref of refs) {
    assert(ref.externalSystem.trim().length > 0, `${ref.id} names the system of record`);
    assert(ref.externalId.trim().length > 0, `${ref.id} carries the external identifier`);
    // A cached figure with no read time is a number nobody can tell is six
    // months stale, and it is the one an interface will show as current.
    assert(ref.cachedAt !== null, `${ref.id} says when the cached figure was read`);
  }
});

group('Meetings record how the conversation was captured, not whose product it was', () => {
  const meetings = ALL.flatMap((d) => d.meetings);
  assert(meetings.length > 0, 'There are meetings, which is the record Concludo exists around');

  const methods = new Set(meetings.map((m) => m.captureMethod));
  assert(
    methods.size >= 3,
    'Several capture methods are exercised, because Concludo is capture agnostic'
  );

  // The independence rule, as a test. Concludo claims no affiliation with and
  // no endorsement by any device maker or meeting platform, so no brand name
  // belongs in the data at all.
  const brands = [
    'zoom',
    'teams',
    'google meet',
    'otter',
    'plaud',
    'limitless',
    'rewind',
    'fireflies',
    'granola',
    'livescribe',
    'remarkable',
    'xero',
    'myob',
    'quickbooks',
    'hubspot',
    'salesforce',
  ];
  const haystack = JSON.stringify(ALL).toLowerCase();
  const named = brands.filter((b) => haystack.includes(b));
  assertEqual(
    named.length,
    0,
    `No device maker, meeting platform or accounting product is named in the data${named.length ? ' (' + named.join(', ') + ')' : ''}`
  );
});

report('Concludo CRM Stage 3, dataset', r);

// Keep the imports honest: these types are used in the signatures above and
// the suite should fail to compile, not silently skip, if they change shape.
export type { Organisation, Person };
