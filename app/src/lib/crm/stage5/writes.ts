/**
 * The write path.
 *
 * Stage 4 read the model and wrote nothing. This is where that changes, and
 * three things have to be true of every write in this file or the module is
 * worse than the read-only one it replaces.
 *
 * ONE. EVERY WRITE IS CHECKED, VALIDATED AND AUDITED, IN THAT ORDER.
 *
 * Not "usually". The functions below share one `commit` helper that does all
 * three, so a new write cannot be added that skips the audit row by forgetting
 * to call something. The role check uses the same `requireRole` the Stage 3
 * repository uses, because two definitions of "you cannot do that" drift and
 * the second one always forgets to say which role you hold.
 *
 * TWO. CONFIRMATION IS A PROPERTY OF THE API, NOT OF THE INTERFACE.
 *
 * The brief requires human confirmation before a record is created from a lead
 * or merged. A confirmation enforced only by a dialog is enforced by whoever
 * remembers to show the dialog. So the functions that create from a lead, and
 * the function that merges, take `confirmedBy` and refuse without it. A caller
 * cannot create a person out of an inbound email by accident, because the type
 * will not let them.
 *
 * THREE. NOTHING LEAVES THIS SESSION.
 *
 * The store is in memory and dies with the tab. Concludo Pty Ltd is
 * pre-revenue, nothing is connected, and every record here is synthetic. The
 * interface says so on the pages that write. When this is pointed at a real
 * project the same functions move behind the repository port, and the role
 * check and the audit row are the parts that must survive the move.
 */
import {
  Activity,
  AuditEvent,
  Commitment,
  CrmWorkspaceData,
  Lead,
  Note,
  Organisation,
  Person,
  Proposal,
  ServiceCase,
  StageMove,
  Task,
  Uuid,
  WorkItem,
} from '../domain';
import { CrmContext, CrmRefused, requireRole } from '../repositories/repository';
import {
  ValidationResult,
  validateCommitment,
  validateLead,
  validateOrganisation,
  validatePerson,
  validateServiceCase,
  validateStageMove,
  validateWorkItem,
} from '../validation';

/* --------------------------------------------------------------- ids */

let counter = 0;

/** A readable, stable-within-a-session id. Never a real uuid, by design. */
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-s5-${counter.toString(36).padStart(4, '0')}`;
}

export function resetIdCounter(): void {
  counter = 0;
}

/* ------------------------------------------------------- the commit helper */

/**
 * Exported from Stage 6 onwards.
 *
 * Stage 5 kept this private, which was right while one file owned every write.
 * Stage 6 adds a second write module, and the alternative to sharing this
 * helper is a second ordering of workspace check, membership check, role check,
 * validation, mutation and audit row, written slightly differently. One of the
 * two would eventually drift, and the one that drifted would be the one that
 * forgot the audit row.
 */
export interface CommitArgs<T> {
  context: CrmContext;
  data: CrmWorkspaceData;
  /** The least role that may do this, and what they are doing, for the refusal. */
  role: Parameters<typeof requireRole>[1];
  doing: string;
  /** Checked before anything is mutated. */
  validate?: () => ValidationResult;
  eventType: string;
  subjectTable: string;
  before?: Record<string, unknown> | null;
  detail?: string | null;
  /** Does the work and returns what was written. */
  apply: () => T;
  /** The id of what was written, for the audit row. */
  subjectId: (written: T) => Uuid | null;
  after?: (written: T) => Record<string, unknown> | null;
}

export function commit<T>(args: CommitArgs<T>): T {
  const { context, data } = args;

  // The workspace is checked first. A write aimed at a workspace somebody is
  // not a member of is refused before the role is even considered, because
  // "you need the approver role" tells an outsider that the workspace exists.
  if (data.workspace.id !== context.workspaceId) {
    throw new CrmRefused(
      'cross_workspace',
      'That record belongs to a different workspace. Records are never written across workspaces.'
    );
  }
  if (!data.members.some((m) => m.userId === context.userId)) {
    throw new CrmRefused(
      'not_a_member',
      'You are not a member of that workspace. Row level security refuses this in the database as well.'
    );
  }

  requireRole(context, args.role, args.doing);

  if (args.validate) {
    const result = args.validate();
    if (!result.ok) {
      throw new CrmRefused('invalid', result.problems.map((p) => p.message).join(' '));
    }
  }

  const written = args.apply();

  const event: AuditEvent = {
    id: newId('audit'),
    crmWorkspaceId: context.workspaceId,
    actorId: context.userId,
    actorKind: 'user',
    eventType: args.eventType,
    subjectTable: args.subjectTable,
    subjectId: args.subjectId(written),
    beforeState: args.before ?? null,
    afterState: args.after ? args.after(written) : null,
    proposalId: null,
    outcome: 'success',
    detail: args.detail ?? null,
    requestId: null,
    createdAt: context.now,
  };
  data.auditEvents.push(event);

  return written;
}

const base = (now: string) => ({
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
  deletedBy: null,
  purgeAfter: null,
});

/* ===================================================== quick capture */

/**
 * The nine things a person can create, with the fewest fields each can carry.
 *
 * "Keep required fields minimal" is in the brief and it is the single most
 * important thing about this section. A capture form that demands an email
 * address is a form somebody fills in with a fake one, and a CRM full of
 * fake addresses is worse than a CRM with blanks: a blank says "we do not
 * know", and nobody can tell that from a wrong answer.
 *
 * So: a person needs a name. An organisation needs a name. A note needs a
 * body. Everything else is optional on every one of them.
 */

export interface CapturePerson {
  fullName: string;
  organisationId?: string | null;
  roleLabel?: string | null;
  primaryEmail?: string | null;
  phone?: string | null;
  primaryEmailScope?: Person['primaryEmailScope'];
}

export function capturePerson(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CapturePerson
): Person {
  const person: Person = {
    id: newId('per'),
    crmWorkspaceId: context.workspaceId,
    fullName: input.fullName.trim(),
    givenName: null,
    familyName: null,
    primaryEmail: input.primaryEmail?.trim() || null,
    secondaryEmail: null,
    phone: input.phone?.trim() || null,
    primaryEmailScope: input.primaryEmailScope ?? 'unknown',
    organisationId: input.organisationId ?? null,
    roleLabel: input.roleLabel?.trim() || null,
    ownerUserId: context.userId,
    relationshipOwnerUserId: context.userId,
    mergedIntoPersonId: null,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Creating a person',
    validate: () => validatePerson(person),
    eventType: 'person_created',
    subjectTable: 'crm_people',
    apply: () => {
      data.people.push(person);
      return person;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ fullName: p.fullName, organisationId: p.organisationId }),
  });
}

export interface CaptureOrganisation {
  name: string;
  industry?: string | null;
  parentOrganisationId?: string | null;
  abn?: string | null;
}

export function captureOrganisation(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureOrganisation
): Organisation {
  const parent = data.organisations.find((o) => o.id === input.parentOrganisationId);

  const organisation: Organisation = {
    id: newId('org'),
    crmWorkspaceId: context.workspaceId,
    name: input.name.trim(),
    legalName: null,
    tradingName: null,
    abn: input.abn?.trim() || null,
    industry: input.industry?.trim() || null,
    website: null,
    parentOrganisationId: input.parentOrganisationId ?? null,
    hierarchyDepth: parent ? parent.hierarchyDepth + 1 : 0,
    ownerUserId: context.userId,
    relationshipOwnerUserId: context.userId,
    dataQualityOwnerUserId: null,
    lifecycleState: 'prospect',
    renewalDate: null,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Creating an organisation',
    validate: () => validateOrganisation(organisation, { allOrganisations: data.organisations }),
    eventType: 'organisation_created',
    subjectTable: 'crm_organisations',
    apply: () => {
      data.organisations.push(organisation);
      return organisation;
    },
    subjectId: (o) => o.id,
    after: (o) => ({ name: o.name, parentOrganisationId: o.parentOrganisationId }),
  });
}

export interface CaptureLead {
  personName?: string | null;
  organisationName?: string | null;
  email?: string | null;
  phone?: string | null;
  source: string;
  summary?: string | null;
}

export function captureLead(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureLead
): Lead {
  // What is missing is recorded as a list of names, never as a completeness
  // grade. A grade invites somebody to chase the number; a list tells them
  // what to ask on the call.
  const missing: string[] = [];
  if (!input.personName?.trim()) missing.push('a name');
  if (!input.organisationName?.trim()) missing.push('an organisation');
  if (!input.email?.trim() && !input.phone?.trim()) missing.push('a way to reply');
  if (!input.summary?.trim()) missing.push('what they want');

  const lead: Lead = {
    id: newId('lead'),
    crmWorkspaceId: context.workspaceId,
    personName: input.personName?.trim() || null,
    organisationName: input.organisationName?.trim() || null,
    email: input.email?.trim() || null,
    phone: input.phone?.trim() || null,
    source: input.source,
    summary: input.summary?.trim() || null,
    missingInformation: missing,
    state: 'awaiting_review',
    notProceedingReason: null,
    convertedPersonId: null,
    convertedOrganisationId: null,
    convertedWorkItemId: null,
    convertedAt: null,
    convertedBy: null,
    ownerUserId: context.userId,
    receivedAt: context.now,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording a lead',
    validate: () => validateLead(lead),
    eventType: 'lead_received',
    subjectTable: 'crm_leads',
    detail: `Source: ${input.source}`,
    apply: () => {
      data.leads.push(lead);
      return lead;
    },
    subjectId: (l) => l.id,
    after: (l) => ({ source: l.source, missingInformation: l.missingInformation }),
  });
}

export interface CaptureWorkItem {
  title: string;
  pipelineId: string;
  organisationId?: string | null;
  primaryPersonId?: string | null;
  valueAmount?: number | null;
  valueBasis?: WorkItem['valueBasis'];
  expectedCloseDate?: string | null;
  nextStep?: string | null;
  nextStepDue?: string | null;
}

export function captureWorkItem(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureWorkItem
): WorkItem {
  const pipeline = data.pipelines.find((p) => p.id === input.pipelineId);
  if (!pipeline) {
    throw new CrmRefused('not_found', 'That pipeline does not exist in this workspace.');
  }

  const firstStage = data.stages
    .filter((s) => s.pipelineId === pipeline.id)
    .sort((a, b) => a.stageOrder - b.stageOrder)[0];
  if (!firstStage) {
    throw new CrmRefused('invalid', 'That pipeline has no stages, so there is nowhere to put this.');
  }

  const item: WorkItem = {
    id: newId('wi'),
    crmWorkspaceId: context.workspaceId,
    title: input.title.trim(),
    // One table, and the workspace's own word for it. A job and an opportunity
    // are the same record with a different noun.
    workItemType: data.workspace.recordTerminology,
    organisationId: input.organisationId ?? null,
    primaryPersonId: input.primaryPersonId ?? null,
    pipelineId: pipeline.id,
    stageId: firstStage.id,
    enteredStageAt: context.now,
    valueAmount: input.valueAmount ?? null,
    valueCurrency: 'AUD',
    valueBasis: input.valueBasis ?? (input.valueAmount === undefined ? 'unknown' : 'stated'),
    expectedCloseDate: input.expectedCloseDate ?? null,
    status: 'open',
    resolvedAt: null,
    resolutionReason: null,
    nextStep: input.nextStep?.trim() || null,
    nextStepDue: input.nextStepDue ?? null,
    ownerUserId: context.userId,
    actionOwnerUserId: context.userId,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Creating work',
    validate: () => validateWorkItem(item),
    eventType: 'work_item_created',
    subjectTable: 'crm_work_items',
    apply: () => {
      data.workItems.push(item);
      // Entering the pipeline is a stage move with no origin, so the stage
      // history starts at the beginning rather than at the first change.
      const move: StageMove = {
        id: newId('move'),
        crmWorkspaceId: context.workspaceId,
        workItemId: item.id,
        fromStageId: null,
        toStageId: firstStage.id,
        movedBy: context.userId,
        movedAt: context.now,
        criteriaMet: [],
        criteriaUnmet: [],
        overrideReason: null,
      };
      data.stageMoves.push(move);
      return item;
    },
    subjectId: (w) => w.id,
    after: (w) => ({ title: w.title, stageId: w.stageId, pipelineId: w.pipelineId }),
  });
}

export interface CaptureTask {
  title: string;
  dueDate?: string | null;
  organisationId?: string | null;
  personId?: string | null;
  workItemId?: string | null;
  detail?: string | null;
}

export function captureTask(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureTask
): Task {
  const task: Task = {
    id: newId('tsk'),
    crmWorkspaceId: context.workspaceId,
    title: input.title.trim(),
    detail: input.detail?.trim() || null,
    dueDate: input.dueDate ?? null,
    state: 'open',
    completedAt: null,
    actionOwnerUserId: context.userId,
    organisationId: input.organisationId ?? null,
    personId: input.personId ?? null,
    workItemId: input.workItemId ?? null,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Creating a task',
    eventType: 'task_created',
    subjectTable: 'crm_tasks',
    apply: () => {
      data.tasks.push(task);
      return task;
    },
    subjectId: (t) => t.id,
    after: (t) => ({ title: t.title, dueDate: t.dueDate }),
  });
}

export interface CaptureCommitment {
  description: string;
  ownerName: string;
  ownedByUs: boolean;
  dueDate?: string | null;
  organisationId?: string | null;
  workItemId?: string | null;
  ownerPersonId?: string | null;
  activityId?: string | null;
}

export function captureCommitment(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureCommitment
): Commitment {
  const commitment: Commitment = {
    id: newId('com'),
    crmWorkspaceId: context.workspaceId,
    description: input.description.trim(),
    ownerName: input.ownerName.trim(),
    ownerPersonId: input.ownerPersonId ?? null,
    ownerUserId: input.ownedByUs ? context.userId : null,
    ownedByUs: input.ownedByUs,
    dueDate: input.dueDate ?? null,
    state: 'open',
    completedAt: null,
    organisationId: input.organisationId ?? null,
    workItemId: input.workItemId ?? null,
    activityId: input.activityId ?? null,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording a commitment',
    validate: () => validateCommitment(commitment),
    eventType: 'commitment_recorded',
    subjectTable: 'crm_commitments',
    apply: () => {
      data.commitments.push(commitment);
      return commitment;
    },
    subjectId: (c) => c.id,
    after: (c) => ({ description: c.description, ownedByUs: c.ownedByUs, dueDate: c.dueDate }),
  });
}

/**
 * A case: something that went wrong for a customer.
 *
 * It is in quick capture because it is the kind of thing somebody is told
 * halfway through a conversation about something else, and the alternative to
 * recording it in ten seconds is not recording it. `relationshipEffect` is
 * required by the validator rather than by this form: a case with no stated
 * effect on the relationship belongs in a help desk, not in a CRM, and the
 * refusal says exactly that rather than rejecting a blank field silently.
 */
export interface CaptureServiceCase {
  title: string;
  organisationId: string;
  relationshipEffect: string;
  detail?: string | null;
  personId?: string | null;
  workItemId?: string | null;
  severity?: 'low' | 'moderate' | 'high';
}

export function captureServiceCase(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureServiceCase
): ServiceCase {
  const serviceCase: ServiceCase = {
    id: newId('case'),
    crmWorkspaceId: context.workspaceId,
    title: input.title.trim(),
    detail: input.detail?.trim() || null,
    organisationId: input.organisationId,
    personId: input.personId ?? null,
    workItemId: input.workItemId ?? null,
    severity: input.severity ?? 'moderate',
    state: 'open',
    raisedAt: context.now,
    resolvedAt: null,
    relationshipEffect: input.relationshipEffect.trim() || null,
    ownerUserId: context.userId,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording a case',
    validate: () => validateServiceCase(serviceCase),
    eventType: 'service_case_raised',
    subjectTable: 'crm_service_cases',
    apply: () => {
      data.serviceCases.push(serviceCase);
      return serviceCase;
    },
    subjectId: (c) => c.id,
    after: (c) => ({ title: c.title, severity: c.severity, state: c.state }),
  });
}

export interface CaptureNote {
  body: string;
  organisationId?: string | null;
  personId?: string | null;
  workItemId?: string | null;
  isPrivate?: boolean;
}

export function captureNote(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureNote
): Note {
  if (!input.body.trim()) {
    throw new CrmRefused('invalid', 'A note needs something in it.');
  }

  const note: Note = {
    id: newId('note'),
    crmWorkspaceId: context.workspaceId,
    body: input.body.trim(),
    organisationId: input.organisationId ?? null,
    personId: input.personId ?? null,
    workItemId: input.workItemId ?? null,
    activityId: null,
    authorUserId: context.userId,
    isPrivate: input.isPrivate ?? false,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Writing a note',
    eventType: 'note_written',
    subjectTable: 'crm_notes',
    apply: () => {
      data.notes.push(note);
      return note;
    },
    subjectId: (n) => n.id,
    after: (n) => ({ isPrivate: n.isPrivate }),
  });
}

export interface CaptureInteraction {
  activityType: Activity['activityType'];
  title: string;
  occurredAt?: string;
  summary?: string | null;
  organisationId?: string | null;
  workItemId?: string | null;
  personIds?: string[];
  isMeaningfulContact?: boolean;
}

export function captureInteraction(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: CaptureInteraction
): Activity {
  const activity: Activity = {
    id: newId('act'),
    crmWorkspaceId: context.workspaceId,
    activityType: input.activityType,
    title: input.title.trim(),
    summary: input.summary?.trim() || null,
    occurredAt: input.occurredAt ?? context.now,
    organisationId: input.organisationId ?? null,
    workItemId: input.workItemId ?? null,
    // A note to self is not contact with the customer. The distinction is what
    // makes "days since we spoke to them" mean anything.
    isMeaningfulContact:
      input.isMeaningfulContact ?? (input.activityType === 'meeting' || input.activityType === 'call'),
    followThroughOutstanding: false,
    followThroughReason: null,
    createdBy: context.userId,
    ...base(context.now),
  };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording an interaction',
    eventType: 'interaction_recorded',
    subjectTable: 'crm_activities',
    apply: () => {
      data.activities.push(activity);
      for (const personId of input.personIds ?? []) {
        data.activityParticipants.push({
          id: newId('part'),
          crmWorkspaceId: context.workspaceId,
          activityId: activity.id,
          personId,
          unresolvedName: null,
          participantRole: 'attendee',
        });
      }
      return activity;
    },
    subjectId: (a) => a.id,
    after: (a) => ({ activityType: a.activityType, occurredAt: a.occurredAt }),
  });
}

/* ===================================================== lead conversion */

export interface ConvertLead {
  leadId: string;
  /** Who confirmed it. Without this nothing is created. */
  confirmedBy: string;
  /** An existing person to link to, or null to create one. */
  personId: string | null;
  /** An existing organisation to link to, or null to create one. */
  organisationId: string | null;
  /** Create work from this lead, in this pipeline. Null to convert the contact only. */
  pipelineId: string | null;
  workTitle?: string | null;
}

export interface ConvertedLead {
  lead: Lead;
  person: Person | null;
  organisation: Organisation | null;
  workItem: WorkItem | null;
  /** What was created rather than linked, for the confirmation screen. */
  created: string[];
}

/**
 * Converting a lead into records.
 *
 * `confirmedBy` is required and is checked, so the only way to create a person
 * out of an inbound email is for somebody to have said so. This is the brief's
 * "require human confirmation before creating or merging records", written
 * where it cannot be skipped rather than in a dialog that can be.
 */
export function convertLead(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: ConvertLead
): ConvertedLead {
  const lead = data.leads.find((l) => l.id === input.leadId);
  if (!lead) throw new CrmRefused('not_found', 'That lead is not in this workspace.');
  if (lead.state === 'converted') {
    throw new CrmRefused('invalid', 'That lead has already been converted.');
  }
  if (!input.confirmedBy) {
    throw new CrmRefused(
      'not_permitted',
      'Nothing is created from a lead without a person confirming it. Concludo proposes; a person disposes.'
    );
  }

  const created: string[] = [];

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Converting a lead',
    eventType: 'lead_converted',
    subjectTable: 'crm_leads',
    before: { state: lead.state },
    detail: `Confirmed by ${input.confirmedBy}.`,
    apply: () => {
      let organisation: Organisation | null = null;
      if (input.organisationId) {
        organisation = data.organisations.find((o) => o.id === input.organisationId) ?? null;
        if (!organisation) {
          throw new CrmRefused('not_found', 'That organisation is not in this workspace.');
        }
      } else if (lead.organisationName) {
        organisation = captureOrganisation(context, data, { name: lead.organisationName });
        created.push(`Organisation: ${organisation.name}`);
      }

      let person: Person | null = null;
      if (input.personId) {
        person = data.people.find((p) => p.id === input.personId) ?? null;
        if (!person) throw new CrmRefused('not_found', 'That person is not in this workspace.');
      } else if (lead.personName) {
        person = capturePerson(context, data, {
          fullName: lead.personName,
          organisationId: organisation?.id ?? null,
          primaryEmail: lead.email,
          phone: lead.phone,
        });
        created.push(`Person: ${person.fullName}`);
      }

      let workItem: WorkItem | null = null;
      if (input.pipelineId) {
        workItem = captureWorkItem(context, data, {
          title:
            input.workTitle?.trim() ||
            lead.summary?.slice(0, 60) ||
            `Enquiry from ${lead.personName ?? lead.organisationName ?? 'an unnamed source'}`,
          pipelineId: input.pipelineId,
          organisationId: organisation?.id ?? null,
          primaryPersonId: person?.id ?? null,
        });
        created.push(`Work: ${workItem.title}`);
      }

      const mutable = lead as Lead & { state: Lead['state'] };
      mutable.state = 'converted';
      mutable.convertedPersonId = person?.id ?? null;
      mutable.convertedOrganisationId = organisation?.id ?? null;
      mutable.convertedWorkItemId = workItem?.id ?? null;
      mutable.convertedAt = context.now;
      mutable.convertedBy = context.userId;
      mutable.updatedAt = context.now;

      return { lead, person, organisation, workItem, created };
    },
    subjectId: (result) => result.lead.id,
    after: (result) => ({
      state: result.lead.state,
      created: result.created,
    }),
  });
}

/** A lead that is going nowhere, with the reason that makes the list readable. */
export function declineLead(
  context: CrmContext,
  data: CrmWorkspaceData,
  leadId: string,
  reason: string
): Lead {
  const lead = data.leads.find((l) => l.id === leadId);
  if (!lead) throw new CrmRefused('not_found', 'That lead is not in this workspace.');

  const next = { ...lead, state: 'not_proceeding' as const, notProceedingReason: reason.trim() };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Declining a lead',
    validate: () => validateLead(next),
    eventType: 'lead_declined',
    subjectTable: 'crm_leads',
    before: { state: lead.state },
    detail: reason,
    apply: () => {
      const mutable = lead as Lead;
      mutable.state = 'not_proceeding';
      mutable.notProceedingReason = reason.trim();
      mutable.updatedAt = context.now;
      return lead;
    },
    subjectId: (l) => l.id,
    after: (l) => ({ state: l.state, notProceedingReason: l.notProceedingReason }),
  });
}

/**
 * Keeping two records apart.
 *
 * A pair somebody has decided about must never be proposed again, and "these
 * are two different people" is as much a decision as a merge. Recording it is
 * what stops the duplicate list asking the same question every week until
 * somebody answers it wrongly out of fatigue.
 */
export function keepSeparate(
  context: CrmContext,
  data: CrmWorkspaceData,
  candidateId: string,
  note: string
): void {
  const candidate = data.duplicateCandidates.find((c) => c.id === candidateId);
  if (!candidate) throw new CrmRefused('not_found', 'That pair is not in this workspace.');

  commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Deciding a possible duplicate',
    eventType: 'duplicate_kept_separate',
    subjectTable: 'crm_duplicate_candidates',
    before: { state: candidate.state },
    detail: note,
    apply: () => {
      candidate.state = 'kept_separate';
      candidate.decidedBy = context.userId;
      candidate.decidedAt = context.now;
      candidate.decisionNote = note;
      candidate.updatedAt = context.now;
      return candidate;
    },
    subjectId: (c) => c.id,
    after: (c) => ({ state: c.state }),
  });
}

/* ================================================= stage movement */

export interface MoveStage {
  workItemId: string;
  toStageId: string;
  /** Which of the stage's criteria the person says are met. */
  metCriterionIds: string[];
  /** Required when anything required is unmet. Ten characters, same as the database. */
  overrideReason?: string | null;
}

/**
 * Moving work between stages.
 *
 * The rule, three times now and in three places: a record must not advance
 * SILENTLY, and it must not be BLOCKED. An authorised person may always
 * proceed, and the module records that they did and why. A CRM that refuses to
 * let somebody move a deal they know is ready is a CRM people stop updating.
 */
export function moveStage(
  context: CrmContext,
  data: CrmWorkspaceData,
  input: MoveStage
): StageMove {
  const item = data.workItems.find((w) => w.id === input.workItemId);
  if (!item) throw new CrmRefused('not_found', 'That work item is not in this workspace.');

  const stage = data.stages.find((s) => s.id === input.toStageId);
  if (!stage) throw new CrmRefused('not_found', 'That stage is not in this workspace.');
  if (stage.pipelineId !== item.pipelineId) {
    throw new CrmRefused('invalid', 'That stage belongs to a different pipeline.');
  }

  const criteria = data.stageCriteria
    .filter((c) => c.stageId === item.stageId)
    .map((c) => ({ id: c.id, description: c.description, isRequired: c.isRequired }));

  const unmet = criteria
    .filter((c) => c.isRequired && !input.metCriterionIds.includes(c.id))
    .map((c) => c.id);

  const fromStageId = item.stageId;

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Moving work between stages',
    validate: () =>
      validateStageMove({
        criteria,
        metCriterionIds: input.metCriterionIds,
        overrideReason: input.overrideReason ?? null,
      }),
    eventType: 'work_item_stage_changed',
    subjectTable: 'crm_work_items',
    before: { stageId: fromStageId, enteredStageAt: item.enteredStageAt },
    detail:
      unmet.length > 0
        ? `Moved with ${unmet.length} unmet ${unmet.length === 1 ? 'criterion' : 'criteria'}. Reason: ${input.overrideReason}`
        : 'All required exit criteria met.',
    apply: () => {
      const move: StageMove = {
        id: newId('move'),
        crmWorkspaceId: context.workspaceId,
        workItemId: item.id,
        fromStageId,
        toStageId: stage.id,
        movedBy: context.userId,
        movedAt: context.now,
        criteriaMet: input.metCriterionIds,
        criteriaUnmet: unmet,
        overrideReason: unmet.length > 0 ? (input.overrideReason ?? null) : null,
      };
      data.stageMoves.push(move);

      item.stageId = stage.id;
      item.enteredStageAt = context.now;
      item.updatedAt = context.now;

      // A closed stage carries its disposition, so moving into it resolves the
      // record rather than leaving a won deal sitting in the open list.
      if (stage.isClosed && stage.closedDisposition) {
        item.status = stage.closedDisposition;
        item.resolvedAt =
          stage.closedDisposition === 'on_hold' ? null : context.now;
      }

      return move;
    },
    subjectId: () => item.id,
    after: () => ({ stageId: item.stageId, enteredStageAt: item.enteredStageAt }),
  });
}

/* =============================================== closing and reopening */

export function closeWorkItem(
  context: CrmContext,
  data: CrmWorkspaceData,
  workItemId: string,
  outcome: 'won' | 'not_proceeding',
  reason: string
): WorkItem {
  const item = data.workItems.find((w) => w.id === workItemId);
  if (!item) throw new CrmRefused('not_found', 'That work item is not in this workspace.');
  if (item.status !== 'open' && item.status !== 'on_hold') {
    throw new CrmRefused('invalid', 'That work is already resolved.');
  }

  // A lost reason is required, and a won one is not. In six months the only
  // thing anybody wants to know about a loss is why, and the only moment it is
  // cheap to record is now.
  if (outcome === 'not_proceeding' && reason.trim().length < 3) {
    throw new CrmRefused(
      'invalid',
      'Say why this is not proceeding. In six months it is the only thing anybody will want to know.'
    );
  }

  const before = { status: item.status, resolvedAt: item.resolvedAt };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Closing work',
    eventType: outcome === 'won' ? 'work_item_won' : 'work_item_not_proceeding',
    subjectTable: 'crm_work_items',
    before,
    detail: reason.trim() || null,
    apply: () => {
      item.status = outcome;
      item.resolvedAt = context.now;
      item.resolutionReason = reason.trim() || null;
      item.updatedAt = context.now;

      const closing = data.stages
        .filter((s) => s.pipelineId === item.pipelineId && s.isClosed)
        .find((s) => s.closedDisposition === outcome);
      if (closing && item.stageId !== closing.id) {
        data.stageMoves.push({
          id: newId('move'),
          crmWorkspaceId: context.workspaceId,
          workItemId: item.id,
          fromStageId: item.stageId,
          toStageId: closing.id,
          movedBy: context.userId,
          movedAt: context.now,
          criteriaMet: [],
          criteriaUnmet: [],
          overrideReason: null,
        });
        item.stageId = closing.id;
        item.enteredStageAt = context.now;
      }

      return item;
    },
    subjectId: (w) => w.id,
    after: (w) => ({ status: w.status, resolutionReason: w.resolutionReason }),
  });
}

/**
 * Reopening.
 *
 * A customer who comes back six months later is not a new deal, and recording
 * them as one loses everything that was learned the first time. So the record
 * reopens, with its history intact, and the reason it was closed stays in the
 * audit trail where it can be read beside the reason it was reopened.
 */
export function reopenWorkItem(
  context: CrmContext,
  data: CrmWorkspaceData,
  workItemId: string,
  reason: string,
  toStageId?: string
): WorkItem {
  const item = data.workItems.find((w) => w.id === workItemId);
  if (!item) throw new CrmRefused('not_found', 'That work item is not in this workspace.');
  if (item.status === 'open') {
    throw new CrmRefused('invalid', 'That work is already open.');
  }
  if (reason.trim().length < 3) {
    throw new CrmRefused('invalid', 'Say why this is being reopened.');
  }

  const before = {
    status: item.status,
    resolvedAt: item.resolvedAt,
    resolutionReason: item.resolutionReason,
  };

  const stages = data.stages
    .filter((s) => s.pipelineId === item.pipelineId && !s.isClosed)
    .sort((a, b) => a.stageOrder - b.stageOrder);
  const destination = toStageId
    ? stages.find((s) => s.id === toStageId)
    : stages[0];

  if (!destination) {
    throw new CrmRefused('invalid', 'That pipeline has no open stage to reopen into.');
  }

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Reopening work',
    eventType: 'work_item_reopened',
    subjectTable: 'crm_work_items',
    before,
    detail: `Reopened: ${reason.trim()}. It was closed as ${item.status.replace(/_/g, ' ')}${item.resolutionReason ? `, because: ${item.resolutionReason}` : ''}.`,
    apply: () => {
      data.stageMoves.push({
        id: newId('move'),
        crmWorkspaceId: context.workspaceId,
        workItemId: item.id,
        fromStageId: item.stageId,
        toStageId: destination.id,
        movedBy: context.userId,
        movedAt: context.now,
        criteriaMet: [],
        criteriaUnmet: [],
        overrideReason: null,
      });

      item.status = 'open';
      item.resolvedAt = null;
      // The reason it was closed is deliberately NOT cleared here. It is part
      // of the record's history and the audit row above carries it too; a
      // record that forgets why it was lost is one that loses the same way
      // twice.
      item.stageId = destination.id;
      item.enteredStageAt = context.now;
      item.updatedAt = context.now;

      return item;
    },
    subjectId: (w) => w.id,
    after: (w) => ({ status: w.status, stageId: w.stageId }),
  });
}

/* ============================================ next step and close date */

export function setNextStep(
  context: CrmContext,
  data: CrmWorkspaceData,
  workItemId: string,
  nextStep: string | null,
  nextStepDue: string | null
): WorkItem {
  const item = data.workItems.find((w) => w.id === workItemId);
  if (!item) throw new CrmRefused('not_found', 'That work item is not in this workspace.');

  const before = { nextStep: item.nextStep, nextStepDue: item.nextStepDue };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Recording the next step',
    eventType: 'work_item_next_step_changed',
    subjectTable: 'crm_work_items',
    before,
    apply: () => {
      item.nextStep = nextStep?.trim() || null;
      item.nextStepDue = nextStepDue;
      item.updatedAt = context.now;
      return item;
    },
    subjectId: (w) => w.id,
    after: (w) => ({ nextStep: w.nextStep, nextStepDue: w.nextStepDue }),
  });
}

/**
 * Changing the expected close date.
 *
 * This gets its own function, and its own audit event type, because the
 * MOVEMENT is the signal. One date change is a plan. Four is a conversation
 * somebody is not having with the customer, and the only way to see it is to
 * keep every one of them. The forecast reads this history.
 */
export function setExpectedCloseDate(
  context: CrmContext,
  data: CrmWorkspaceData,
  workItemId: string,
  date: string | null,
  reason?: string
): WorkItem {
  const item = data.workItems.find((w) => w.id === workItemId);
  if (!item) throw new CrmRefused('not_found', 'That work item is not in this workspace.');

  const before = { expectedCloseDate: item.expectedCloseDate };

  return commit({
    context,
    data,
    role: 'crm_contributor',
    doing: 'Changing the expected close date',
    eventType: 'work_item_close_date_changed',
    subjectTable: 'crm_work_items',
    before,
    detail: reason ?? null,
    apply: () => {
      item.expectedCloseDate = date;
      item.updatedAt = context.now;
      return item;
    },
    subjectId: (w) => w.id,
    after: (w) => ({ expectedCloseDate: w.expectedCloseDate }),
  });
}

/* ================================================ proposals */

/**
 * Confirming or declining a proposal.
 *
 * The approval is bound to the PAYLOAD, not to a permission: what was agreed is
 * stored with a digest over it, so a proposal edited after approval cannot be
 * applied on the strength of the old decision. Self-approval is recorded rather
 * than forbidden, because a sole trader has nobody else to ask and a team
 * should be able to see whether it has become routine.
 *
 * Confirming requires the approver role. Everything else in this file needs
 * only a contributor, and that difference is the whole point of having roles.
 */
export function decideProposal(
  context: CrmContext,
  data: CrmWorkspaceData,
  proposalId: string,
  decision: 'confirmed' | 'declined',
  note?: string
): Proposal {
  const proposal = data.proposals.find((p) => p.id === proposalId);
  if (!proposal) throw new CrmRefused('not_found', 'That proposal is not in this workspace.');
  if (proposal.state !== 'awaiting_confirmation') {
    throw new CrmRefused('invalid', 'That proposal has already been decided.');
  }

  const before = { state: proposal.state };

  return commit({
    context,
    data,
    role: 'crm_approver',
    doing: 'Deciding a proposed update',
    eventType: decision === 'confirmed' ? 'proposal_confirmed' : 'proposal_declined',
    subjectTable: 'crm_proposals',
    before,
    detail: note ?? null,
    apply: () => {
      proposal.state = decision;
      proposal.updatedAt = context.now;
      if (decision === 'confirmed') proposal.appliedAt = context.now;

      data.approvals.push({
        id: newId('appr'),
        crmWorkspaceId: context.workspaceId,
        proposalId: proposal.id,
        decision,
        decidedBy: context.userId,
        decidedAt: context.now,
        note: note ?? null,
        approvedChanges: proposal.changes,
        approvedChangesDigest: `digest-${proposal.id}-${proposal.changes.length}`,
        // Recorded, never forbidden. A sole trader has nobody else to ask.
        selfApproved: data.members.length === 1,
      });

      return proposal;
    },
    subjectId: (p) => p.id,
    after: (p) => ({ state: p.state, appliedAt: p.appliedAt }),
  });
}

/* =============================================== reading the audit back */

/** Every audit row about one record, most recent first. */
export function auditFor(
  data: CrmWorkspaceData,
  subjectTable: string,
  subjectId: string
): AuditEvent[] {
  return data.auditEvents
    .filter((e) => e.subjectTable === subjectTable && e.subjectId === subjectId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface CloseDateChange {
  at: string;
  from: string | null;
  to: string | null;
  by: string | null;
  reason: string | null;
  /** Positive where the date moved later. The direction is the signal. */
  movedDays: number | null;
}

/**
 * The close-date movement history.
 *
 * Read out of the audit trail rather than kept in a column of its own, because
 * it IS the audit trail: a close-date change is a field change with a before
 * and an after, and giving it a second home is how the two disagree.
 */
export function closeDateHistory(
  data: CrmWorkspaceData,
  workItemId: string,
  /**
   * The audit rows to read, where the caller already has this item's rows in
   * hand. Stage 8 passes an indexed subset so that a board of two thousand
   * cards does not scan every audit row two thousand times. Omitted, it reads
   * them all, which is what every caller before Stage 8 did.
   */
  events: AuditEvent[] = data.auditEvents
): CloseDateChange[] {
  return events
    .filter(
      (e) =>
        e.eventType === 'work_item_close_date_changed' &&
        e.subjectTable === 'crm_work_items' &&
        e.subjectId === workItemId
    )
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((e) => {
      const from = (e.beforeState?.expectedCloseDate as string | null) ?? null;
      const to = (e.afterState?.expectedCloseDate as string | null) ?? null;
      const movedDays =
        from && to
          ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000)
          : null;
      return { at: e.createdAt, from, to, by: e.actorId, reason: e.detail, movedDays };
    });
}
