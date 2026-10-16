/**
 * Governance: who may see what, what is kept, and how a customer leaves.
 *
 * THE PART MOST PRODUCTS GET WRONG.
 *
 * Export and deletion are built last, built badly, and discovered to be wrong
 * at the worst possible moment: when a customer has asked to leave, or when the
 * regulator has asked what you hold about somebody. By then the code that
 * writes records has had two years to grow places the exporter does not know
 * about, and the deletion routine misses the four tables somebody added in
 * March.
 *
 * So both are built here from the SAME list of collections the domain declares,
 * rather than from a hand-written list that drifts. If a table exists in
 * `CRM_TABLES` and the exporter does not cover it, the test fails. That is the
 * only arrangement that survives a growing schema.
 *
 * FIELD-LEVEL PERMISSIONS ARE DENY-BY-DEFAULT FOR THE FEW FIELDS THAT NEED IT.
 *
 * Not every field. A CRM where every field carries a permission is a CRM nobody
 * can configure, and the usual result is that everybody gets everything because
 * the alternative took too long. What is restricted here is short and
 * defensible: the detail of a service case, a private note, and the contents of
 * a consent record. Everything else follows the record's own permission.
 */
import { CRM_TABLES, CrmRole, CrmTable, CrmWorkspaceData, roleAtLeast } from '../domain';

/* ===================================================== field permissions */

export interface FieldRule {
  table: CrmTable;
  field: string;
  /** The least role that may see it. */
  minimumRole: CrmRole;
  /** Why it is restricted. A rule with no reason gets removed by somebody. */
  because: string;
  /** What a person who may not see it is shown instead. */
  insteadShow: string;
}

export const FIELD_RULES: FieldRule[] = [
  {
    table: 'crm_service_cases',
    field: 'detail',
    minimumRole: 'crm_contributor',
    because:
      'A service case detail is the customer’s own account of a problem. It routinely names individuals and describes what happened to them, and an account manager preparing a renewal call does not need it to do their job.',
    insteadShow: 'The effect on the relationship, the state and the age of the case.',
  },
  {
    table: 'crm_notes',
    field: 'body',
    minimumRole: 'crm_contributor',
    because:
      'A note marked private was marked private by somebody. The restriction is on the private ones only; an ordinary note follows the record.',
    insteadShow: 'That a private note exists, and who wrote it.',
  },
  {
    table: 'crm_consent_records',
    field: 'withdrawalNote',
    minimumRole: 'crm_approver',
    because:
      'Why somebody withdrew consent is frequently a complaint, and it is not operational information.',
    insteadShow: 'That consent was withdrawn, and when.',
  },
  {
    table: 'crm_audit_events',
    field: 'beforeState',
    minimumRole: 'crm_approver',
    because:
      'An audit row’s before-state can contain a value that was corrected because it was wrong about a person.',
    insteadShow: 'That the field changed, and who changed it.',
  },
];

export function maySeeField(role: CrmRole, table: string, field: string): boolean {
  const rule = FIELD_RULES.find((entry) => entry.table === table && entry.field === field);
  if (!rule) return true;
  return roleAtLeast(role, rule.minimumRole);
}

export function fieldRuleFor(table: string, field: string): FieldRule | null {
  return FIELD_RULES.find((entry) => entry.table === table && entry.field === field) ?? null;
}

/**
 * Redact a record for a reader, rather than hiding the record.
 *
 * Hiding the whole record would mean a service lead sees a case and an account
 * manager sees nothing, which teaches the account manager that the CRM is
 * missing things. Showing the record with the restricted field replaced by a
 * sentence teaches them where to go.
 */
export function redactFor<T extends Record<string, unknown>>(
  role: CrmRole,
  table: string,
  record: T
): T & { redactedFields: string[] } {
  const copy = { ...record } as T & { redactedFields: string[] };
  const redacted: string[] = [];

  for (const rule of FIELD_RULES.filter((entry) => entry.table === table)) {
    if (maySeeField(role, table, rule.field)) continue;
    if (!(rule.field in copy)) continue;
    (copy as Record<string, unknown>)[rule.field] = null;
    redacted.push(rule.field);
  }

  copy.redactedFields = redacted;
  return copy;
}

/* ========================================================== retention */

export interface RetentionRule {
  table: CrmTable;
  /** How long after the record stops being needed. */
  keepForDays: number;
  because: string;
  /** What triggers the clock. */
  clockStarts: string;
}

/**
 * Retention, with a reason against every line.
 *
 * APP 11.2 requires destruction or de-identification when information is no
 * longer needed for a permitted purpose. "Needed" is the operative word and it
 * is a judgement, so each rule says what the judgement was. Seven years appears
 * repeatedly because Australian business records commonly carry a seven-year
 * obligation, and a CRM that destroyed something a customer needed for an audit
 * has solved a privacy problem by creating a different one.
 *
 * NOTHING HERE DELETES ON A TIMER. The rules produce a list; an administrator
 * acts on it. A product that destroys records automatically destroys the wrong
 * one eventually, and destruction is the operation with no undo.
 */
export const RETENTION_RULES: RetentionRule[] = [
  {
    table: 'crm_leads',
    keepForDays: 730,
    because:
      'A lead that went nowhere two years ago is not a business record. Keeping it is keeping somebody’s contact details for no purpose, which is what APP 11.2 is about.',
    clockStarts: 'When the lead was marked not proceeding.',
  },
  {
    table: 'crm_activities',
    keepForDays: 2555,
    because:
      'A record of a customer conversation can be needed to show what was agreed. Seven years matches the common Australian business-records expectation.',
    clockStarts: 'When the conversation happened.',
  },
  {
    table: 'crm_work_items',
    keepForDays: 2555,
    because: 'A resolved deal or job is a commercial record.',
    clockStarts: 'When the work was resolved.',
  },
  {
    table: 'crm_service_cases',
    keepForDays: 2555,
    because:
      'A service case can be evidence in a dispute. The DETAIL could reasonably go sooner, which is a refinement worth making later.',
    clockStarts: 'When the case was closed.',
  },
  {
    table: 'crm_people',
    keepForDays: 2555,
    because:
      'A person record is the spine everything else hangs from, so destroying it early orphans records that must be kept. De-identification is usually the better answer here than destruction.',
    clockStarts: 'When the last related record ages out.',
  },
  {
    table: 'crm_consent_records',
    keepForDays: 2555,
    because:
      'A consent record is the evidence that contact was permitted. Destroying it removes the defence, not the obligation.',
    clockStarts: 'When consent was withdrawn or expired.',
  },
  {
    table: 'crm_audit_events',
    keepForDays: 2555,
    because:
      'An audit trail that can be aged out quietly is not an audit trail. This is the one rule that should be hardest to change.',
    clockStarts: 'When the event was recorded.',
  },
];

export interface RetentionFinding {
  table: string;
  recordId: string;
  label: string;
  /** How long past the rule it is. */
  overdueDays: number;
  rule: RetentionRule;
}

export function retentionFindings(data: CrmWorkspaceData, now: string): RetentionFinding[] {
  const findings: RetentionFinding[] = [];
  const nowMs = new Date(now).getTime();

  const check = (
    table: CrmTable,
    rows: { id: string; purgeAfter?: string | null }[],
    label: (row: { id: string }) => string
  ) => {
    const rule = RETENTION_RULES.find((entry) => entry.table === table);
    if (!rule) return;
    for (const row of rows) {
      if (!row.purgeAfter) continue;
      const due = new Date(row.purgeAfter).getTime();
      if (due > nowMs) continue;
      findings.push({
        table,
        recordId: row.id,
        label: label(row),
        overdueDays: Math.floor((nowMs - due) / 86_400_000),
        rule,
      });
    }
  };

  check('crm_people', data.people, (row) => {
    const person = data.people.find((p) => p.id === row.id);
    return person?.fullName ?? row.id;
  });
  check('crm_leads', data.leads, (row) => {
    const lead = data.leads.find((l) => l.id === row.id);
    return lead?.personName ?? row.id;
  });
  check('crm_activities', data.activities, (row) => {
    const activity = data.activities.find((a) => a.id === row.id);
    return activity?.title ?? row.id;
  });

  return findings.sort((a, b) => b.overdueDays - a.overdueDays);
}

/* ============================================================ export */

export interface ExportResult {
  workspaceId: string;
  generatedAt: string;
  /** Every collection, named, including the empty ones. */
  tables: { table: string; rows: number }[];
  /** The data itself. */
  payload: Record<string, unknown[]>;
  /** Tables the domain declares that the exporter did not cover. Must be empty. */
  missedTables: string[];
  totalRows: number;
}

/**
 * Everything one workspace holds, from the domain's own table list.
 *
 * `missedTables` is the point of this function. It is computed by comparing
 * what was exported against `CRM_TABLES`, so a table added to the domain and
 * not to the exporter shows up as a named gap rather than as silence. The test
 * asserts it is empty, which means adding a table to the schema and forgetting
 * the exporter is a build failure rather than a discovery during an access
 * request.
 */
export function exportWorkspace(data: CrmWorkspaceData, now: string): ExportResult {
  const collections: Partial<Record<CrmTable, unknown[]>> = {
    crm_workspaces: [data.workspace],
    crm_workspace_members: data.members,
    crm_organisations: data.organisations,
    crm_people: data.people,
    crm_person_organisation_roles: data.personOrganisationRoles,
    crm_relationships: data.relationships,
    crm_leads: data.leads,
    crm_pipelines: data.pipelines,
    crm_pipeline_stages: data.stages,
    crm_stage_criteria: data.stageCriteria,
    crm_work_items: data.workItems,
    crm_work_item_stage_history: data.stageMoves,
    crm_activities: data.activities,
    crm_activity_participants: data.activityParticipants,
    crm_meetings: data.meetings,
    crm_email_references: data.emailReferences,
    crm_notes: data.notes,
    crm_tasks: data.tasks,
    crm_commitments: data.commitments,
    crm_decisions: data.decisions,
    crm_products: data.products,
    crm_quotes: data.quotes,
    crm_quote_lines: data.quoteLines,
    crm_order_references: data.orderReferences,
    crm_invoice_references: data.invoiceReferences,
    crm_service_cases: data.serviceCases,
    crm_account_plans: data.accountPlans,
    crm_account_plan_outcomes: data.accountPlanOutcomes,
    crm_account_plan_entries: data.accountPlanEntries,
    crm_account_plan_actions: data.accountPlanActions,
    crm_whitespace_cells: data.whitespaceCells,
    crm_joint_plans: data.jointPlans,
    crm_joint_plan_actions: data.jointPlanActions,
    crm_account_reviews: data.accountReviews,
    crm_attachment_references: data.attachmentReferences,
    crm_tags: data.tags,
    crm_record_tags: data.recordTags,
    crm_custom_field_definitions: data.customFieldDefinitions,
    crm_custom_field_values: data.customFieldValues,
    crm_custom_object_definitions: data.customObjectDefinitions,
    crm_custom_object_records: data.customObjectRecords,
    crm_consent_records: data.consentRecords,
    crm_communication_preferences: data.communicationPreferences,
    crm_evidence: data.evidence,
    crm_proposals: data.proposals,
    crm_approvals: data.approvals,
    crm_audit_events: data.auditEvents,
    crm_duplicate_candidates: data.duplicateCandidates,
    crm_record_quality: data.recordQuality,
    crm_retention_policies: data.retentionPolicies,
    crm_integration_connections: data.integrationConnections,
    crm_import_runs: data.importRuns,
    // Import rows hold the source file as it was read, so they hold personal
    // information and belong in an export. Leaving them out would mean a
    // person's own data sat in a staging table that no export could see.
    crm_import_rows: data.importRows,
    crm_relationship_signals: data.relationshipSignals,
    // The memory read log is in the export for the same reason the import
    // rows are: it holds personal information. Each row says that a named
    // customer's history was read and by whom, which is information about the
    // customer under APP 12 and about the person who read it. A privacy
    // control that was itself invisible to the export would be a table of
    // personal information nobody could ask for.
    crm_memory_reads: data.memoryReads,
  };

  const payload: Record<string, unknown[]> = {};
  const tables: ExportResult['tables'] = [];
  let totalRows = 0;

  for (const table of CRM_TABLES) {
    const rows = collections[table];
    if (rows === undefined) continue;
    payload[table] = rows;
    tables.push({ table, rows: rows.length });
    totalRows += rows.length;
  }

  const missedTables = CRM_TABLES.filter((table) => collections[table] === undefined);

  return {
    workspaceId: data.workspace.id,
    generatedAt: now,
    tables,
    payload,
    missedTables,
    totalRows,
  };
}

/** The export as a file a person can keep. */
export function exportAsJson(result: ExportResult): string {
  return JSON.stringify(
    {
      concludoCrmExport: 1,
      workspace: result.workspaceId,
      generatedAt: result.generatedAt,
      note:
        'Everything Concludo holds for this workspace. Produced from the domain’s own table list, so a table added to the schema and missed here is a build failure rather than a silent omission.',
      tables: result.tables,
      data: result.payload,
    },
    null,
    2
  );
}

/* ========================================================== deletion */

export interface DeletionPlan {
  subject: { table: string; id: string; label: string };
  /** Everything that would go, by table. */
  cascades: { table: string; ids: string[]; because: string }[];
  /** Everything that would be kept, with the reason. This is the honest half. */
  retained: { table: string; ids: string[]; because: string }[];
  totalToDelete: number;
  totalRetained: number;
  /** Said before anybody presses anything. */
  warning: string;
}

/**
 * What deleting a person would actually do.
 *
 * Shown in full before anything happens, including the records that would NOT
 * go. A deletion that silently keeps an audit trail is the right behaviour and
 * the wrong surprise: somebody who asked for their data to be deleted and later
 * discovers an audit row with their name in it has been misled, even though
 * keeping it was correct.
 */
export function planPersonDeletion(
  data: CrmWorkspaceData,
  personId: string
): DeletionPlan | null {
  const person = data.people.find((p) => p.id === personId);
  if (!person) return null;

  const cascades: DeletionPlan['cascades'] = [];
  const retained: DeletionPlan['retained'] = [];

  const roles = data.personOrganisationRoles.filter((role) => role.personId === personId);
  if (roles.length > 0) {
    cascades.push({
      table: 'crm_person_organisation_roles',
      ids: roles.map((role) => role.id),
      because: 'A role is about this person and means nothing without them.',
    });
  }

  const participation = data.activityParticipants.filter(
    (participant) => participant.personId === personId
  );
  if (participation.length > 0) {
    cascades.push({
      table: 'crm_activity_participants',
      ids: participation.map((participant) => participant.id),
      because: 'Their presence in a conversation is personal information about them.',
    });
  }

  const consents = data.consentRecords.filter((record) => record.personId === personId);
  if (consents.length > 0) {
    cascades.push({
      table: 'crm_consent_records',
      ids: consents.map((record) => record.id),
      because: 'Consent records are about this person.',
    });
  }

  const preferences = data.communicationPreferences.filter(
    (preference) => preference.personId === personId
  );
  if (preferences.length > 0) {
    cascades.push({
      table: 'crm_communication_preferences',
      ids: preferences.map((preference) => preference.id),
      because: 'A preference is about this person.',
    });
  }

  const notes = data.notes.filter((note) => note.personId === personId);
  if (notes.length > 0) {
    cascades.push({
      table: 'crm_notes',
      ids: notes.map((note) => note.id),
      because: 'A note about this person is personal information about them.',
    });
  }

  /* ---- what is kept, and why ---- */

  const activities = data.activities.filter((activity) =>
    data.activityParticipants.some(
      (participant) => participant.activityId === activity.id && participant.personId === personId
    )
  );
  if (activities.length > 0) {
    retained.push({
      table: 'crm_activities',
      ids: activities.map((activity) => activity.id),
      because:
        'The conversation happened and is a business record. The person’s participation is removed above, so the record no longer identifies them, which is de-identification rather than destruction.',
    });
  }

  const commitments = data.commitments.filter(
    (commitment) => commitment.ownerPersonId === personId
  );
  if (commitments.length > 0) {
    retained.push({
      table: 'crm_commitments',
      ids: commitments.map((commitment) => commitment.id),
      because:
        'A promise made to or by a customer is a commercial record. The link to this person is cleared, the promise is kept.',
    });
  }

  const audit = data.auditEvents.filter(
    (event) => event.subjectTable === 'crm_people' && event.subjectId === personId
  );
  if (audit.length > 0) {
    retained.push({
      table: 'crm_audit_events',
      ids: audit.map((event) => event.id),
      because:
        'An audit trail that can be deleted is not an audit trail. These rows record that changes were made, including this deletion.',
    });
  }

  const totalToDelete = cascades.reduce((sum, entry) => sum + entry.ids.length, 0) + 1;
  const totalRetained = retained.reduce((sum, entry) => sum + entry.ids.length, 0);

  return {
    subject: { table: 'crm_people', id: person.id, label: person.fullName },
    cascades,
    retained,
    totalToDelete,
    totalRetained,
    warning:
      `This permanently removes ${totalToDelete} ${totalToDelete === 1 ? 'record' : 'records'} and cannot be undone. ` +
      `${totalRetained} ${totalRetained === 1 ? 'record is' : 'records are'} kept, listed above with the reason for each. ` +
      `If somebody has asked for their information to be deleted, show them that list rather than telling them everything has gone.`,
  };
}

/* ================================================= tenant offboarding */

export interface OffboardingStep {
  order: number;
  what: string;
  /** Who does it. */
  who: 'customer' | 'concludo' | 'either';
  /** Whether it can be undone after it runs. */
  reversible: boolean;
  because: string;
}

/**
 * How a customer leaves, in order.
 *
 * Export first, destruction last, with a gap between them that the customer
 * controls. A workflow that destroys before the customer has confirmed they
 * have their export is a workflow that loses somebody's data on the day they
 * were already unhappy enough to leave.
 */
export const OFFBOARDING: OffboardingStep[] = [
  {
    order: 1,
    what: 'The customer takes a full export, and confirms they can open it.',
    who: 'customer',
    reversible: true,
    because: 'Nothing is destroyed until somebody has confirmed they have the data.',
  },
  {
    order: 2,
    what: 'Every integration is disconnected and every token revoked at the provider.',
    who: 'concludo',
    reversible: true,
    because:
      'Revoking at the provider rather than deleting locally. A token Concludo forgets about is still a token that works.',
  },
  {
    order: 3,
    what: 'API tokens and webhook endpoints for the workspace are revoked.',
    who: 'concludo',
    reversible: false,
    because: 'A live token against a closing workspace is the worst kind of loose end.',
  },
  {
    order: 4,
    what: 'The workspace is closed to sign-in, and kept for an agreed period.',
    who: 'concludo',
    reversible: true,
    because:
      'The gap is the point. Customers come back, and more often they realise on day nine that they needed one more thing.',
  },
  {
    order: 5,
    what: 'The customer confirms in writing that destruction should proceed.',
    who: 'customer',
    reversible: true,
    because: 'Destruction happens on an instruction, not on a schedule.',
  },
  {
    order: 6,
    what: 'Records are destroyed, except those under a retention obligation, which are listed.',
    who: 'concludo',
    reversible: false,
    because:
      'The list is produced and given to the customer. Telling somebody everything is gone when seven tables are kept under a retention rule is a false statement, however well meant.',
  },
  {
    order: 7,
    what: 'A destruction certificate is issued, naming what went and what was kept.',
    who: 'concludo',
    reversible: false,
    because: 'The customer needs evidence for their own obligations.',
  },
];
