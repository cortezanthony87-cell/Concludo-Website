/**
 * The repository layer.
 *
 * WHAT IT IS FOR, AND WHAT IT IS NOT FOR.
 *
 * It is the one place that knows how a CRM record is read and written, so the
 * rules that must hold on every write hold in one function rather than in
 * every caller: the workspace scope is applied, the role is checked, soft
 * deletes are respected on read, and an audit row is written for every change.
 *
 * It is **not** the security boundary. Row level security is, and it is
 * enforced in the database whatever this file does. That matters because the
 * production build has no API host, so a browser talks to Postgres directly
 * and anything written here is advice to a cooperative client. The repository
 * refuses early and explains why; the database refuses regardless.
 *
 * ONE ADAPTER, AND WHY ONLY ONE.
 *
 * `CrmRepository` is the port. `InMemoryCrmRepository` is the only adapter in
 * Stage 3: it runs on the synthetic workspaces and is what the tests and the
 * Stage 2 shell use. A Supabase adapter is Stage 4 work and is deliberately
 * absent rather than present and untested, because there is no migrated
 * project to exercise it against and an adapter nobody has run is a claim, not
 * a component. The SQL side is verified directly instead, against a real
 * PostgreSQL 16 instance, by docs/migrations/0099_crm_verify.sql.
 */
import {
  AuditEvent,
  CrmRole,
  CrmTable,
  CrmWorkspaceData,
  Evidence,
  Organisation,
  Person,
  Proposal,
  SoftDeletable,
  StageMove,
  Uuid,
  WorkItem,
  roleAtLeast,
} from '../domain';
import { ValidationResult, validateStageMoveRecord } from '../validation';

/* ------------------------------------------------------------ context */

export interface CrmContext {
  /** Who is asking. */
  userId: Uuid;
  /** Which workspace they are working in. */
  workspaceId: Uuid;
  /** What they may do there. */
  role: CrmRole;
  /** The moment, injected rather than read, so results are reproducible. */
  now: string;
}

export class CrmRefused extends Error {
  /** Why, in words a person can act on. */
  readonly because: string;
  readonly code:
    | 'not_a_member'
    | 'insufficient_role'
    | 'not_found'
    | 'invalid'
    | 'cross_workspace'
    | 'not_permitted';

  constructor(code: CrmRefused['code'], because: string) {
    super(`${code}: ${because}`);
    this.name = 'CrmRefused';
    this.code = code;
    this.because = because;
  }
}

/**
 * The role gate.
 *
 * Exported because Stage 5's write layer needs the same check and the same
 * words. Two definitions of "you cannot do that" drift, and the second one is
 * always the one that forgets to mention which role you hold.
 */
export function requireRole(context: CrmContext, minimum: CrmRole, doing: string): void {
  if (!roleAtLeast(context.role, minimum)) {
    throw new CrmRefused(
      'insufficient_role',
      `${doing} requires the ${minimum.replace('crm_', '')} role in this workspace. You hold ${context.role.replace('crm_', '')}.`
    );
  }
}

/* --------------------------------------------------------- the port */

export interface ListOptions {
  /** Deleted rows are excluded unless this is set. */
  includeDeleted?: boolean;
  limit?: number;
}

export interface CrmRepository {
  listOrganisations(context: CrmContext, options?: ListOptions): Promise<Organisation[]>;
  getOrganisation(context: CrmContext, id: Uuid): Promise<Organisation | null>;
  /** The hierarchy, rooted at one organisation, parents first. */
  organisationAncestry(context: CrmContext, id: Uuid): Promise<Organisation[]>;
  organisationChildren(context: CrmContext, id: Uuid): Promise<Organisation[]>;

  listPeople(context: CrmContext, options?: ListOptions): Promise<Person[]>;
  getPerson(context: CrmContext, id: Uuid): Promise<Person | null>;

  listWorkItems(context: CrmContext, options?: ListOptions): Promise<WorkItem[]>;
  getWorkItem(context: CrmContext, id: Uuid): Promise<WorkItem | null>;

  listEvidenceFor(context: CrmContext, subjectTable: string, subjectId: Uuid): Promise<Evidence[]>;
  listProposals(context: CrmContext, options?: ListOptions): Promise<Proposal[]>;

  softDelete(context: CrmContext, table: CrmTable, id: Uuid, reason?: string): Promise<void>;
  restore(context: CrmContext, table: CrmTable, id: Uuid): Promise<void>;

  moveStage(context: CrmContext, move: Omit<StageMove, 'id' | 'movedAt' | 'movedBy'>): Promise<StageMove>;

  listAudit(context: CrmContext, options?: ListOptions): Promise<AuditEvent[]>;
}

/* ------------------------------------------------ the in-memory adapter */

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

let counter = 0;
function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter.toString().padStart(6, '0')}`;
}

/**
 * Reads and writes the synthetic workspaces.
 *
 * It applies the workspace scope on every read, which looks redundant when the
 * data is already one workspace's worth. It is not: the tests load several
 * workspaces into one repository on purpose, so that "did you remember to
 * scope this query" is a question the tests can actually ask. A repository
 * tested against a single-tenant fixture tests nothing about tenancy.
 */
export class InMemoryCrmRepository implements CrmRepository {
  private readonly byWorkspace = new Map<Uuid, CrmWorkspaceData>();
  private readonly audit: AuditEvent[] = [];
  /** Who is a member of what, so the repository can refuse an outsider. */
  private readonly membership = new Map<string, CrmRole>();

  constructor(workspaces: CrmWorkspaceData[]) {
    for (const data of workspaces) {
      this.byWorkspace.set(data.workspace.id, data);
      for (const member of data.members) {
        this.membership.set(`${data.workspace.id}|${member.userId}`, member.crmRole);
      }
    }
  }

  /** The check every read and write goes through first. */
  private scope(context: CrmContext): CrmWorkspaceData {
    const held = this.membership.get(`${context.workspaceId}|${context.userId}`);
    if (!held) {
      throw new CrmRefused(
        'not_a_member',
        'You are not a member of that workspace. Row level security refuses this in the database as well.'
      );
    }

    const data = this.byWorkspace.get(context.workspaceId);
    if (!data) {
      // An unknown workspace is an error, never an empty list. Silence and
      // zero must not look the same: one means nothing is there, the other
      // means something is wrong and you are being shown nothing.
      throw new CrmRefused('not_found', 'That workspace does not exist.');
    }

    return data;
  }

  private live<T extends SoftDeletable>(rows: T[], options?: ListOptions): T[] {
    const filtered = options?.includeDeleted ? rows : rows.filter((r) => r.deletedAt === null);
    return options?.limit ? filtered.slice(0, options.limit) : filtered;
  }

  private writeAudit(args: {
    context: CrmContext;
    eventType: string;
    subjectTable: string;
    subjectId: Uuid | null;
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
    detail?: string | null;
    outcome?: AuditEvent['outcome'];
  }): AuditEvent {
    const event: AuditEvent = {
      id: nextId('audit'),
      crmWorkspaceId: args.context.workspaceId,
      actorId: args.context.userId,
      actorKind: 'user',
      eventType: args.eventType,
      subjectTable: args.subjectTable,
      subjectId: args.subjectId,
      beforeState: args.before ?? null,
      afterState: args.after ?? null,
      proposalId: null,
      outcome: args.outcome ?? 'success',
      detail: args.detail ?? null,
      requestId: null,
      createdAt: args.context.now,
    };
    this.audit.push(event);
    return event;
  }

  async listOrganisations(context: CrmContext, options?: ListOptions): Promise<Organisation[]> {
    return this.live(this.scope(context).organisations, options);
  }

  async getOrganisation(context: CrmContext, id: Uuid): Promise<Organisation | null> {
    return this.scope(context).organisations.find((o) => o.id === id) ?? null;
  }

  async organisationAncestry(context: CrmContext, id: Uuid): Promise<Organisation[]> {
    const data = this.scope(context);
    const byId = new Map(data.organisations.map((o) => [o.id, o]));
    const chain: Organisation[] = [];

    let cursor = byId.get(id)?.parentOrganisationId ?? null;
    let depth = 0;
    while (cursor) {
      depth += 1;
      // The same guard the database trigger applies. A cycle should be
      // impossible; walking one forever is not an acceptable way to find out
      // that it is not.
      if (depth > 12) {
        throw new CrmRefused(
          'invalid',
          'The organisation hierarchy is deeper than twelve levels, which should not be possible.'
        );
      }
      const parent = byId.get(cursor);
      if (!parent) break;
      chain.unshift(parent);
      cursor = parent.parentOrganisationId;
    }

    return chain;
  }

  async organisationChildren(context: CrmContext, id: Uuid): Promise<Organisation[]> {
    return this.live(
      this.scope(context).organisations.filter((o) => o.parentOrganisationId === id)
    );
  }

  async listPeople(context: CrmContext, options?: ListOptions): Promise<Person[]> {
    // A merged person is not deleted, but it is not a separate person either.
    // Returning it in a list is how a merge appears not to have worked.
    return this.live(this.scope(context).people, options).filter(
      (p) => p.mergedIntoPersonId === null
    );
  }

  async getPerson(context: CrmContext, id: Uuid): Promise<Person | null> {
    return this.scope(context).people.find((p) => p.id === id) ?? null;
  }

  async listWorkItems(context: CrmContext, options?: ListOptions): Promise<WorkItem[]> {
    return this.live(this.scope(context).workItems, options);
  }

  async getWorkItem(context: CrmContext, id: Uuid): Promise<WorkItem | null> {
    return this.scope(context).workItems.find((w) => w.id === id) ?? null;
  }

  async listEvidenceFor(
    context: CrmContext,
    subjectTable: string,
    subjectId: Uuid
  ): Promise<Evidence[]> {
    return this.scope(context)
      .evidence.filter(
        (e) =>
          e.subjectTable === subjectTable &&
          e.subjectId === subjectId &&
          e.deletedAt === null &&
          // Superseded assertions are out of the current view. A forgotten
          // filter here shows somebody a fact that was corrected last month.
          e.supersededAt === null
      )
      .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
  }

  async listProposals(context: CrmContext, options?: ListOptions): Promise<Proposal[]> {
    return this.live(this.scope(context).proposals, options);
  }

  async softDelete(
    context: CrmContext,
    table: CrmTable,
    id: Uuid,
    reason?: string
  ): Promise<void> {
    requireRole(context, 'crm_contributor', 'Removing a record');
    const data = this.scope(context);
    const rows = this.rowsFor(data, table);

    const row = rows.find((r) => r.id === id) as
      | Mutable<SoftDeletable & { id: Uuid }>
      | undefined;

    if (!row) throw new CrmRefused('not_found', `That ${table} record does not exist here.`);
    if (row.deletedAt !== null) {
      throw new CrmRefused('invalid', 'That record is already in the deleted state.');
    }

    const before = { ...row } as unknown as Record<string, unknown>;

    row.deletedAt = context.now;
    row.deletedBy = context.userId;
    // Thirty days, matching the default retention policy. The real window
    // comes from crm_retention_policies in the database.
    row.purgeAfter = new Date(
      new Date(context.now).getTime() + 30 * 86_400_000
    ).toISOString();

    this.writeAudit({
      context,
      eventType: 'record_soft_deleted',
      subjectTable: table,
      subjectId: id,
      before,
      after: null,
      detail: reason ?? null,
    });
  }

  async restore(context: CrmContext, table: CrmTable, id: Uuid): Promise<void> {
    requireRole(context, 'crm_contributor', 'Restoring a record');
    const data = this.scope(context);
    const rows = this.rowsFor(data, table);

    const row = rows.find((r) => r.id === id) as
      | Mutable<SoftDeletable & { id: Uuid }>
      | undefined;

    if (!row) throw new CrmRefused('not_found', `That ${table} record does not exist here.`);
    if (row.deletedAt === null) {
      throw new CrmRefused('invalid', 'That record is not in the deleted state.');
    }

    row.deletedAt = null;
    row.deletedBy = null;
    row.purgeAfter = null;

    this.writeAudit({
      context,
      eventType: 'record_restored',
      subjectTable: table,
      subjectId: id,
      before: null,
      after: { ...row } as unknown as Record<string, unknown>,
    });
  }

  async moveStage(
    context: CrmContext,
    move: Omit<StageMove, 'id' | 'movedAt' | 'movedBy'>
  ): Promise<StageMove> {
    requireRole(context, 'crm_contributor', 'Moving work between stages');
    const data = this.scope(context);

    const item = data.workItems.find((w) => w.id === move.workItemId) as Mutable<WorkItem> | undefined;
    if (!item) throw new CrmRefused('not_found', 'That work item does not exist here.');

    const stage = data.stages.find((s) => s.id === move.toStageId);
    if (!stage) throw new CrmRefused('not_found', 'That stage does not exist here.');
    if (stage.pipelineId !== item.pipelineId) {
      // The database refuses this too. A work item sitting at a stage of a
      // pipeline it is not in makes every stage report quietly wrong.
      throw new CrmRefused('invalid', 'That stage belongs to a different pipeline.');
    }

    const validation: ValidationResult = validateStageMoveRecord(move);
    if (!validation.ok) {
      throw new CrmRefused('invalid', validation.problems.map((p) => p.message).join(' '));
    }

    const before = { stageId: item.stageId, enteredStageAt: item.enteredStageAt };

    const record: StageMove = {
      ...move,
      id: nextId('move'),
      movedAt: context.now,
      movedBy: context.userId,
    };

    data.stageMoves.push(record);
    item.stageId = move.toStageId;
    item.enteredStageAt = context.now;
    item.updatedAt = context.now;

    this.writeAudit({
      context,
      eventType: 'work_item_stage_changed',
      subjectTable: 'crm_work_items',
      subjectId: item.id,
      before,
      after: { stageId: item.stageId, enteredStageAt: item.enteredStageAt },
      detail:
        move.criteriaUnmet.length > 0
          ? `Moved with ${move.criteriaUnmet.length} unmet criteria. Reason: ${move.overrideReason}`
          : 'All required exit criteria met.',
    });

    return record;
  }

  async listAudit(context: CrmContext, options?: ListOptions): Promise<AuditEvent[]> {
    this.scope(context);
    const rows = this.audit
      .filter((e) => e.crmWorkspaceId === context.workspaceId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return options?.limit ? rows.slice(0, options.limit) : rows;
  }

  /** Audit rows as written, for a test to inspect. Never for a caller. */
  auditTrail(): readonly AuditEvent[] {
    return this.audit;
  }

  /**
   * The rows for a table, as things that can be soft deleted and have an id.
   *
   * Every CRM entity carries both, so the narrow return type is honest rather
   * than a convenience: it is what lets softDelete and restore work on any
   * table without a cast per table.
   */
  private rowsFor(data: CrmWorkspaceData, table: CrmTable): (SoftDeletable & { id: Uuid })[] {
    switch (table) {
      case 'crm_organisations':
        return data.organisations;
      case 'crm_people':
        return data.people;
      case 'crm_work_items':
        return data.workItems;
      case 'crm_leads':
        return data.leads;
      case 'crm_activities':
        return data.activities;
      case 'crm_commitments':
        return data.commitments;
      case 'crm_decisions':
        return data.decisions;
      case 'crm_quotes':
        return data.quotes;
      case 'crm_service_cases':
        return data.serviceCases;
      case 'crm_evidence':
        return data.evidence;
      case 'crm_proposals':
        return data.proposals;
      case 'crm_notes':
        return data.notes;
      case 'crm_tasks':
        return data.tasks;
      default:
        throw new CrmRefused(
          'invalid',
          `${table} is not a soft-deletable table. The database keeps the same list in crm_soft_deletable_tables().`
        );
    }
  }
}
