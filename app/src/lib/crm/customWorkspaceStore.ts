/**
 * Custom Authentic CRM Workspace Store.
 *
 * Manages user-created, authentic organisation CRM workspaces.
 * Guarantees that freshly created organisation CRMs contain zero synthetic or
 * demonstration records, no demo reminders or notifications, and allows saving
 * and linking the new CRM workspace into open projects on the user's dashboard.
 */
import {
  CrmWorkspaceData,
  Organisation,
  Pipeline,
  PipelineStage,
  WorkspaceDepth,
  WorkItemType,
} from './domain';
import { CrmDataset } from './types';
import { CRM_WORKSPACES } from './data/workspaces';

export const DEFAULT_CRM_WORKSPACE_ID = 'ws-agency';
export type WorkspaceChoice = { id: string; name: string; shape: string; recordsPlural: string };

const STORAGE_KEY = 'concludo_custom_crm_workspaces_v1';
const ACTIVE_WS_KEY = 'concludo_active_crm_workspace_id';

const SHAPE_WORDS: Record<string, string> = {
  sole_trader: 'Sole trader',
  small_team: 'Small team',
  mid_market: 'Mid market',
  enterprise: 'Enterprise',
};

export interface CreateFreshCrmInput {
  organisationName: string;
  workspaceName?: string;
  depth?: WorkspaceDepth;
  recordTerminology?: WorkItemType;
  recordTerminologyPlural?: string;
  linkedProjectId?: string | null;
  linkedProjectTitle?: string | null;
  userId?: string;
}

let onWorkspaceSavedHook: ((workspace: CrmWorkspaceData) => void) | null = null;

/** Register hook to update session store without circular imports */
export function registerWorkspaceSaveHook(fn: (workspace: CrmWorkspaceData) => void): void {
  onWorkspaceSavedHook = fn;
}

const inMemoryWorkspaces: CrmWorkspaceData[] = [];
let inMemoryActiveId = DEFAULT_CRM_WORKSPACE_ID;

/** Read custom workspaces from local storage. */
export function getCustomWorkspaces(): CrmWorkspaceData[] {
  if (typeof window === 'undefined') return inMemoryWorkspaces;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return inMemoryWorkspaces;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read custom CRM workspaces:', err);
    return [];
  }
}

/** Save a custom workspace into storage and notify listeners. */
export function saveCustomWorkspace(workspace: CrmWorkspaceData): void {
  const existing = getCustomWorkspaces();
  const index = existing.findIndex((w) => w.workspace.id === workspace.workspace.id);
  let updated: CrmWorkspaceData[];
  if (index >= 0) {
    updated = [...existing];
    updated[index] = workspace;
  } else {
    updated = [workspace, ...existing];
  }

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      window.localStorage.setItem(ACTIVE_WS_KEY, workspace.workspace.id);
      window.dispatchEvent(new CustomEvent('concludo_crm_workspaces_changed', { detail: workspace.workspace.id }));
    } catch (err) {
      console.error('Failed to save custom CRM workspace:', err);
    }
  } else {
    inMemoryWorkspaces.length = 0;
    inMemoryWorkspaces.push(...updated);
    inMemoryActiveId = workspace.workspace.id;
  }

  if (onWorkspaceSavedHook) {
    try {
      onWorkspaceSavedHook(workspace);
    } catch (e) {
      console.warn('Workspace save hook error:', e);
    }
  }
}

/** Remember active workspace ID */
export function setActiveWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_WS_KEY, workspaceId);
  } catch (e) {
    // Ignore
  }
}

/** Retrieve remembered active workspace ID */
export function getActiveWorkspaceId(): string {
  if (typeof window === 'undefined') return inMemoryActiveId;
  try {
    return window.localStorage.getItem(ACTIVE_WS_KEY) || DEFAULT_CRM_WORKSPACE_ID;
  } catch (e) {
    return DEFAULT_CRM_WORKSPACE_ID;
  }
}

/** Synchronise custom workspaces with Supabase project_files */
export async function syncCustomWorkspacesWithSupabase(supabase: any): Promise<CrmWorkspaceData[]> {
  if (!supabase || typeof window === 'undefined') return getCustomWorkspaces();
  try {
    const { data, error } = await supabase
      .from('project_files')
      .select('content, project_id')
      .eq('name', 'crm_workspace_data.json')
      .is('deleted_at', null);

    if (error || !data) return getCustomWorkspaces();

    const remoteWorkspaces: CrmWorkspaceData[] = [];
    for (const row of data) {
      if (row.content) {
        try {
          const ws = JSON.parse(row.content);
          if (ws?.workspace?.id) {
            remoteWorkspaces.push(ws);
          }
        } catch (e) {
          // Ignore non-json rows
        }
      }
    }

    if (remoteWorkspaces.length > 0) {
      const local = getCustomWorkspaces();
      const mergedMap = new Map<string, CrmWorkspaceData>();
      local.forEach((w) => mergedMap.set(w.workspace.id, w));
      remoteWorkspaces.forEach((w) => mergedMap.set(w.workspace.id, w));
      const merged = Array.from(mergedMap.values());
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    }
  } catch (err) {
    console.warn('Could not sync CRM workspaces with Supabase:', err);
  }
  return getCustomWorkspaces();
}

/** Factory for a brand new, empty organisation CRM workspace. */
export function createFreshWorkspaceData(input: CreateFreshCrmInput): CrmWorkspaceData {
  const now = new Date().toISOString();
  const cleanOrgName = input.organisationName.trim();
  const orgSlug = cleanOrgName.toLowerCase().replace(/[^a-z0-9]/g, '-').slice(0, 20) || 'org';
  const id = `ws-org-${orgSlug}-${Date.now().toString(36)}`;
  const wsName = input.workspaceName?.trim() || `${cleanOrgName} CRM`;
  const depth = input.depth || 'small_team';
  const terminology = input.recordTerminology || 'opportunity';
  const actorUserId = input.userId?.trim() || 'usr-admin';
  const terminologyPlural =
    input.recordTerminologyPlural?.trim() ||
    (terminology === 'opportunity'
      ? 'Opportunities'
      : terminology === 'job'
      ? 'Jobs'
      : terminology === 'case'
      ? 'Cases'
      : 'Deals');

  const mainOrg: Organisation = {
    id: `org-main-${Date.now().toString(36)}`,
    crmWorkspaceId: id,
    name: cleanOrgName,
    legalName: null,
    tradingName: null,
    abn: null,
    industry: 'Commercial',
    website: null,
    parentOrganisationId: null,
    hierarchyDepth: 0,
    ownerUserId: actorUserId,
    relationshipOwnerUserId: actorUserId,
    dataQualityOwnerUserId: actorUserId,
    lifecycleState: 'active',
    renewalDate: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    purgeAfter: null,
  };

  const pipelineId = `pipe-${Date.now().toString(36)}`;
  const pipeline: Pipeline = {
    id: pipelineId,
    crmWorkspaceId: id,
    name: 'Standard Pipeline',
    workItemType: terminology,
    isDefault: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    deletedBy: null,
    purgeAfter: null,
  };

  const stages: PipelineStage[] = [
    {
      id: `stg-1-${pipelineId}`,
      crmWorkspaceId: id,
      pipelineId,
      name: 'Qualification',
      stageOrder: 0,
      typicalDays: 14,
      isClosed: false,
      closedDisposition: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `stg-2-${pipelineId}`,
      crmWorkspaceId: id,
      pipelineId,
      name: 'Discovery',
      stageOrder: 1,
      typicalDays: 14,
      isClosed: false,
      closedDisposition: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `stg-3-${pipelineId}`,
      crmWorkspaceId: id,
      pipelineId,
      name: 'Proposal',
      stageOrder: 2,
      typicalDays: 21,
      isClosed: false,
      closedDisposition: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `stg-4-${pipelineId}`,
      crmWorkspaceId: id,
      pipelineId,
      name: 'Negotiation',
      stageOrder: 3,
      typicalDays: 14,
      isClosed: false,
      closedDisposition: null,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `stg-5-${pipelineId}`,
      crmWorkspaceId: id,
      pipelineId,
      name: 'Closed Won',
      stageOrder: 4,
      typicalDays: 30,
      isClosed: true,
      closedDisposition: 'won',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `stg-6-${pipelineId}`,
      crmWorkspaceId: id,
      pipelineId,
      name: 'Closed Lost',
      stageOrder: 5,
      typicalDays: 30,
      isClosed: true,
      closedDisposition: 'not_proceeding',
      createdAt: now,
      updatedAt: now,
    },
  ];

  return {
    workspace: {
      id,
      name: wsName,
      depth,
      recordTerminology: terminology,
      recordTerminologyPlural: terminologyPlural,
      terminology: {},
      linkedTeamId: null,
      linkedOrganizationId: null,
      workspaceScope: 'work',
      createdBy: actorUserId,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      deletedBy: null,
      purgeAfter: null,
      // Authentic metadata
      ...( {
        isAuthentic: true,
        organisationName: cleanOrgName,
        linkedProjectId: input.linkedProjectId || null,
        linkedProjectTitle: input.linkedProjectTitle || null,
      } as any ),
    },
    members: [
      {
        id: `mem-${Date.now().toString(36)}`,
        crmWorkspaceId: id,
        userId: actorUserId,
        crmRole: 'crm_admin',
        createdAt: now,
        updatedAt: now,
      },
    ],
    organisations: [mainOrg],
    people: [],
    personOrganisationRoles: [],
    relationships: [],
    leads: [],
    pipelines: [pipeline],
    stages,
    stageCriteria: [],
    workItems: [],
    stageMoves: [],
    activities: [],
    activityParticipants: [],
    meetings: [],
    emailReferences: [],
    notes: [],
    tasks: [],
    commitments: [],
    decisions: [],
    products: [],
    quotes: [],
    quoteLines: [],
    orderReferences: [],
    invoiceReferences: [],
    serviceCases: [],
    accountPlans: [],
    accountPlanOutcomes: [],
    attachmentReferences: [],
    tags: [],
    recordTags: [],
    customFieldDefinitions: [],
    customFieldValues: [],
    customObjectDefinitions: [],
    customObjectRecords: [],
    consentRecords: [],
    communicationPreferences: [],
    evidence: [],
    proposals: [],
    approvals: [],
    auditEvents: [
      {
        id: `aud-${Date.now().toString(36)}`,
        crmWorkspaceId: id,
        actorId: actorUserId,
        actorKind: 'user',
        eventType: 'workspace_created',
        subjectTable: 'crm_workspaces',
        subjectId: id,
        beforeState: null,
        afterState: { name: wsName, organisationName: cleanOrgName },
        proposalId: null,
        outcome: 'success',
        detail: 'Created fresh authentic organisation CRM workspace',
        requestId: null,
        createdAt: now,
      },
    ],
    duplicateCandidates: [],
    recordQuality: [],
    retentionPolicies: [],
    integrationConnections: [],
    importRuns: [],
    importRows: [],
    relationshipSignals: [],
    memoryReads: [],
    accountPlanEntries: [],
    accountPlanActions: [],
    whitespaceCells: [],
    jointPlans: [],
    jointPlanActions: [],
    accountReviews: [],
  };
}

/** Get all available workspace choices including custom workspaces. */
export function getAllWorkspaceChoices(): WorkspaceChoice[] {
  const custom = getCustomWorkspaces().map((data) => ({
    id: data.workspace.id,
    name: `${data.workspace.name} (Your organisation)`,
    shape: SHAPE_WORDS[data.workspace.depth] ?? data.workspace.depth,
    recordsPlural: data.workspace.recordTerminologyPlural,
  }));

  const demoChoices: WorkspaceChoice[] = CRM_WORKSPACES.map((data) => ({
    id: data.workspace.id,
    name: `${data.workspace.name} (Demo)`,
    shape: SHAPE_WORDS[data.workspace.depth] ?? data.workspace.depth,
    recordsPlural: data.workspace.recordTerminologyPlural,
  }));

  return [...custom, ...demoChoices];
}

/** Check if a workspace ID belongs to an authentic custom workspace. */
export function isAuthenticWorkspace(workspaceId: string | null | undefined): boolean {
  if (!workspaceId) return false;
  if (workspaceId.startsWith('ws-org-') || workspaceId.startsWith('ws-fresh-')) return true;
  const custom = getCustomWorkspaces().find((w) => w.workspace.id === workspaceId);
  return Boolean(custom && ((custom.workspace as any).isAuthentic ?? true));
}

/** Build a corresponding CrmDataset for any CrmWorkspaceData. */
export function workspaceToDataset(data: CrmWorkspaceData): CrmDataset {
  const isAuthentic = (data.workspace as any).isAuthentic || data.workspace.id.startsWith('ws-org-');
  const now = new Date().toISOString();

  return {
    workspace: {
      id: data.workspace.id,
      name: data.workspace.name,
      depth: data.workspace.depth === 'enterprise' ? 'mid_market' : data.workspace.depth,
      recordTerminology: (data.workspace.recordTerminology as any) || 'opportunity',
      recordTerminologyPlural: data.workspace.recordTerminologyPlural || 'Opportunities',
      owners: ['You'],
    },
    organisations: data.organisations.map((org) => ({
      id: org.id,
      name: org.name,
      parentOrganisationId: org.parentOrganisationId,
      industry: org.industry || 'Commercial',
      health: 'steady' as const,
      healthReason: 'Active account',
      website: org.website,
      lastActivityAt: org.updatedAt,
      openRecordCount: data.workItems.filter((w) => w.organisationId === org.id && w.status === 'open').length,
      peopleCount: data.people.filter((p) => p.organisationId === org.id).length,
      renewalDate: org.renewalDate,
      ownerName: 'You',
      createdAt: org.createdAt,
    })),
    people: data.people.map((p) => ({
      id: p.id,
      fullName: p.fullName,
      email: p.primaryEmail,
      phone: p.phone,
      organisationId: p.organisationId,
      roleLabel: p.roleLabel || 'Contact',
      stakeholderRole: 'decision_maker' as const,
      lastContactAt: p.updatedAt,
      attentionReason: null,
      contactPreference: 'open' as const,
      contactPreferenceNote: '',
      createdAt: p.createdAt,
      ownerName: 'You',
      origin: {
        basis: 'stated',
        evidence: 'Entered or imported by user',
        sourceKind: 'import',
        sourceId: null,
      },
    })),
    leads: data.leads.map((l) => ({
      id: l.id,
      personName: l.personName || 'Unknown Lead',
      organisationName: l.organisationName || '',
      source: l.source || 'Direct Enquiry',
      summary: l.summary || '',
      missing: l.missingInformation || [],
      state: l.state === 'awaiting_review' || l.state === 'in_review' || l.state === 'converted' || l.state === 'not_proceeding'
        ? l.state
        : 'awaiting_review',
      receivedAt: l.receivedAt,
    })),
    pipelines: data.pipelines.map((pipe) => ({
      id: pipe.id,
      name: pipe.name,
      recordTerminology: (pipe.workItemType as any) || 'opportunity',
      stageIds: data.stages.filter((s) => s.pipelineId === pipe.id).map((s) => s.id),
    })),
    stages: data.stages.map((stage) => ({
      id: stage.id,
      pipelineId: stage.pipelineId,
      name: stage.name,
      order: stage.stageOrder,
      exitCriteria: [],
      typicalDays: stage.typicalDays,
    })),
    records: data.workItems.map((item) => ({
      id: item.id,
      title: item.title,
      organisationId: item.organisationId || '',
      primaryPersonId: item.primaryPersonId,
      pipelineId: item.pipelineId,
      stageId: item.stageId,
      value: item.valueAmount,
      valueBasis: item.valueBasis,
      expectedCloseDate: item.expectedCloseDate,
      enteredStageAt: item.enteredStageAt,
      lastActivityAt: item.updatedAt,
      ownerName: 'You',
      nextStep: item.nextStep,
      nextStepDue: item.nextStepDue,
      status: item.status === 'won' || item.status === 'open' || item.status === 'not_proceeding' || item.status === 'on_hold'
        ? item.status
        : 'open',
      createdAt: item.createdAt,
    })),
    activities: data.activities.map((a) => ({
      id: a.id,
      kind: (a.activityType as any) || 'meeting',
      title: a.title,
      occurredAt: a.occurredAt,
      organisationId: a.organisationId,
      recordId: a.workItemId,
      peopleIds: [],
      summary: a.summary || '',
      followThroughOutstanding: a.followThroughOutstanding,
      followThroughReason: a.followThroughReason,
      source: {
        basis: 'stated',
        evidence: 'User activity entry',
        sourceKind: 'manual_entry',
        sourceId: null,
      },
    })),
    commitments: data.commitments.map((c) => ({
      id: c.id,
      description: c.description,
      ownerName: c.ownerName || 'You',
      ownedByUser: c.ownedByUs,
      dueDate: c.dueDate,
      organisationId: c.organisationId,
      recordId: c.workItemId,
      state: c.state,
      source: {
        basis: 'stated',
        evidence: 'User commitment entry',
        sourceKind: 'manual_entry',
        sourceId: null,
       },
     })),
     serviceIssues: [],
     accountPlans: [],
     proposals: [],
     duplicates: [],
     reviewItems: [],
     lastSynchronisedAt: isAuthentic ? now : data.workspace.updatedAt,
   };
 }
