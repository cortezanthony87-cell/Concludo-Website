import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase/admin';
import { getSupabaseBrowserClient } from '../supabase/client';
import {
  WorkflowRecord,
  WorkflowExecutionRecord,
  WorkflowApprovalRecord,
  WorkflowTriggerType,
  WorkflowActionType,
  ApprovalStatus,
} from './types';
import { recordAuditLog } from '../enterprise/auditService';
import { logAgentActivity } from '../agents/agentMemoryService';

function getClient(admin: boolean = false): SupabaseClient {
  if (admin) {
    try {
      return getSupabaseAdminClient();
    } catch {
      return getSupabaseBrowserClient();
    }
  }
  return getSupabaseBrowserClient();
}


export async function fetchWorkflows(params: {
  userId: string;
  teamId?: string | null;
  organizationId?: string | null;
  admin?: boolean;
}): Promise<WorkflowRecord[]> {
  const client = getClient(params.admin);
  let query = client.from('workflows').select('*').is('deleted_at', null);

  if (params.organizationId) {
    query = query.eq('organization_id', params.organizationId);
  } else if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  } else {
    query = query.eq('owner_id', params.userId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error(`Failed to fetch workflows: ${error.message}`);
  return (data || []) as WorkflowRecord[];
}

export async function createWorkflow(
  workflow: {
    owner_id: string;
    team_id?: string | null;
    organization_id?: string | null;
    name: string;
    description?: string;
    trigger_type: WorkflowTriggerType;
    trigger_config?: Record<string, any>;
    conditions?: any[];
    actions?: any[];
    execution_type?: 'automatic' | 'approval_required' | 'manual_only';
    is_active?: boolean;
  },
  admin: boolean = false
): Promise<WorkflowRecord> {
  const client = getClient(admin);

  const { data, error } = await client
    .from('workflows')
    .insert({
      owner_id: workflow.owner_id,
      team_id: workflow.team_id || null,
      organization_id: workflow.organization_id || null,
      name: workflow.name,
      description: workflow.description || '',
      trigger_type: workflow.trigger_type,
      trigger_config: workflow.trigger_config || {},
      conditions: workflow.conditions || [],
      actions: workflow.actions || [],
      execution_type: workflow.execution_type || 'approval_required',
      is_active: workflow.is_active !== undefined ? workflow.is_active : true,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to create workflow: ${error.message}`);

  await recordAuditLog({
    action: 'workflow_change',
    entityType: 'workflow',
    entityId: data.id,
    details: { action: 'created', name: data.name, trigger: data.trigger_type },
    userId: workflow.owner_id,
    organizationId: workflow.organization_id,
    admin,
  });

  return data as WorkflowRecord;
}

export async function updateWorkflow(
  id: string,
  updates: Partial<WorkflowRecord>,
  userId: string,
  admin: boolean = false
): Promise<WorkflowRecord> {
  const client = getClient(admin);

  const { data, error } = await client
    .from('workflows')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new Error(`Failed to update workflow: ${error.message}`);

  await recordAuditLog({
    action: 'workflow_change',
    entityType: 'workflow',
    entityId: id,
    details: { action: 'updated', updates: Object.keys(updates) },
    userId,
    admin,
  });

  return data as WorkflowRecord;
}

export async function deleteWorkflow(
  id: string,
  userId: string,
  admin: boolean = false
): Promise<void> {
  const client = getClient(admin);
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error } = await client
    .from('workflows')
    .update({
      deleted_at: now.toISOString(),
      deleted_by: userId,
      purge_after: purgeAfter.toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete workflow: ${error.message}`);

  await recordAuditLog({
    action: 'workflow_change',
    entityType: 'workflow',
    entityId: id,
    details: { action: 'soft_deleted' },
    userId,
    admin,
  });
}

export async function triggerWorkflow(params: {
  workflowId: string;
  userId: string;
  triggerData?: Record<string, any>;
  admin?: boolean;
}): Promise<{
  execution: WorkflowExecutionRecord;
  approval?: WorkflowApprovalRecord;
}> {
  const startTime = Date.now();
  const client = getClient(params.admin);

  // 1. Fetch workflow
  const { data: workflow, error: wfError } = await client
    .from('workflows')
    .select('*')
    .eq('id', params.workflowId)
    .is('deleted_at', null)
    .single();

  if (wfError || !workflow) {
    throw new Error(`Workflow not found or inactive: ${params.workflowId}`);
  }

  if (!workflow.is_active) {
    throw new Error(`Workflow is currently paused or inactive: ${workflow.name}`);
  }

  // 2. Determine execution flow based on execution_type
  const executionType = workflow.execution_type || 'approval_required';
  const triggerData = params.triggerData || {};

  let executionStatus: 'completed' | 'requires_approval' | 'pending' = 'completed';
  if (executionType === 'approval_required') {
    executionStatus = 'requires_approval';
  } else if (executionType === 'manual_only') {
    executionStatus = 'pending';
  }

  // Create initial execution record
  const stepsCompleted = (workflow.actions || []).map((action: any) => ({
    actionType: action.type,
    status: executionType === 'approval_required' ? 'requires_approval' : 'success',
    result: { action: action.type, note: 'Processed by workflow orchestration engine' },
    executedAt: new Date().toISOString(),
  }));

  const { data: execution, error: execError } = await client
    .from('workflow_executions')
    .insert({
      workflow_id: workflow.id,
      triggered_by: params.userId,
      status: executionStatus,
      trigger_data: triggerData,
      steps_completed: stepsCompleted,
      execution_duration_ms: Date.now() - startTime,
    })
    .select('*')
    .single();

  if (execError) {
    throw new Error(`Failed to create workflow execution: ${execError.message}`);
  }

  let approvalRecord: WorkflowApprovalRecord | undefined;

  // 3. If approval is required, create approval request in workflow_approvals
  if (executionType === 'approval_required') {
    const { data: approval, error: appError } = await client
      .from('workflow_approvals')
      .insert({
        workflow_id: workflow.id,
        execution_id: execution.id,
        requester_id: params.userId,
        status: 'pending',
        action_type: workflow.actions?.[0]?.type || 'workflow_execution',
        action_payload: {
          workflowName: workflow.name,
          actions: workflow.actions,
          triggerData,
        },
        notes: `Automated approval request created for workflow "${workflow.name}".`,
      })
      .select('*')
      .single();

    if (!appError && approval) {
      approvalRecord = approval as WorkflowApprovalRecord;
    }

    // Log approval request
    await recordAuditLog({
      action: 'approval_request',
      entityType: 'workflow_approval',
      entityId: approvalRecord?.id || workflow.id,
      details: { workflowId: workflow.id, executionId: execution.id, name: workflow.name },
      userId: params.userId,
      organizationId: workflow.organization_id,
      admin: params.admin,
    });
  }

  // Log workflow execution
  await recordAuditLog({
    action: 'workflow_execution',
    entityType: 'workflow',
    entityId: workflow.id,
    details: {
      executionId: execution.id,
      status: executionStatus,
      executionType,
    },
    userId: params.userId,
    organizationId: workflow.organization_id,
    admin: params.admin,
  });

  await logAgentActivity({
    agentType: 'workflow_coordinator',
    actionType: 'orchestrate_workflow',
    status: executionStatus === 'completed' ? 'success' : 'requires_approval',
    entityType: 'workflow',
    entityId: workflow.id,
    details: {
      workflowName: workflow.name,
      executionId: execution.id,
      status: executionStatus,
    },
    userId: params.userId,
    teamId: workflow.team_id,
    organizationId: workflow.organization_id,
    admin: params.admin,
  });

  return {
    execution: execution as WorkflowExecutionRecord,
    approval: approvalRecord,
  };
}

export async function fetchWorkflowExecutions(params: {
  workflowId?: string;
  userId?: string;
  limit?: number;
  admin?: boolean;
}): Promise<WorkflowExecutionRecord[]> {
  const client = getClient(params.admin);
  let query = client
    .from('workflow_executions')
    .select('*, workflow:workflows(id, name, trigger_type, execution_type)');

  if (params.workflowId) {
    query = query.eq('workflow_id', params.workflowId);
  }
  if (params.userId) {
    query = query.eq('triggered_by', params.userId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(params.limit || 50);

  if (error) throw new Error(`Failed to fetch workflow executions: ${error.message}`);
  return (data || []) as WorkflowExecutionRecord[];
}

export async function fetchWorkflowApprovals(params: {
  status?: ApprovalStatus;
  userId?: string;
  limit?: number;
  admin?: boolean;
}): Promise<WorkflowApprovalRecord[]> {
  const client = getClient(params.admin);
  let query = client
    .from('workflow_approvals')
    .select('*, workflow:workflows(id, name, trigger_type, execution_type)');

  if (params.status) {
    query = query.eq('status', params.status);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(params.limit || 50);

  if (error) throw new Error(`Failed to fetch workflow approvals: ${error.message}`);
  return (data || []) as WorkflowApprovalRecord[];
}

export async function respondToApproval(params: {
  approvalId: string;
  approverId: string;
  decision: 'approve' | 'reject';
  notes?: string;
  admin?: boolean;
}): Promise<WorkflowApprovalRecord> {
  const client = getClient(params.admin);
  const now = new Date().toISOString();
  const status: ApprovalStatus = params.decision === 'approve' ? 'approved' : 'rejected';

  // 1. Fetch current approval
  const { data: currentApproval, error: fetchErr } = await client
    .from('workflow_approvals')
    .select('*, workflow:workflows(organization_id, team_id)')
    .eq('id', params.approvalId)
    .single();

  if (fetchErr || !currentApproval) {
    throw new Error(`Approval request not found: ${params.approvalId}`);
  }

  // 2. Update approval
  const updateData: any = {
    status,
    approver_id: params.approverId,
    notes: params.notes || currentApproval.notes,
  };
  if (params.decision === 'approve') {
    updateData.approved_at = now;
  } else {
    updateData.rejected_at = now;
  }

  const { data: updatedApproval, error: updateErr } = await client
    .from('workflow_approvals')
    .update(updateData)
    .eq('id', params.approvalId)
    .select('*')
    .single();

  if (updateErr) {
    throw new Error(`Failed to update approval: ${updateErr.message}`);
  }

  // 3. Update associated execution if linked
  if (currentApproval.execution_id) {
    const execStatus = params.decision === 'approve' ? 'completed' : 'rejected';
    await client
      .from('workflow_executions')
      .update({
        status: execStatus,
        updated_at: now,
      })
      .eq('id', currentApproval.execution_id);
  }

  // 4. Audit Log
  await recordAuditLog({
    action: params.decision === 'approve' ? 'approval_granted' : 'approval_rejected',
    entityType: 'workflow_approval',
    entityId: params.approvalId,
    details: {
      decision: params.decision,
      executionId: currentApproval.execution_id,
      notes: params.notes,
    },
    userId: params.approverId,
    organizationId: currentApproval.workflow?.organization_id,
    admin: params.admin,
  });

  return updatedApproval as WorkflowApprovalRecord;
}
