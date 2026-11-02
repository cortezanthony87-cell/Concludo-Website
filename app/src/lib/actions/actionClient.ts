import { SupabaseClient } from '@supabase/supabase-js';
import { ActionRecord, CreateActionInput, UpdateActionInput, ActionStatus, ActionPriority, PRIORITY_RANK } from './types';
import { isActionOverdue } from '../intel/actionStatus';
import { logTeamActivity } from '../teams/teamClient';

export interface ActionQueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface FetchActionsOptions {
  projectId?: string;
  status?: string;
  owner?: string;
  assignedUserId?: string;
  limit?: number;
  teamId?: string;
  workspaceScope?: 'all' | 'personal' | 'team';
}

/**
 * Default priority and due-date comparator (Section 1.3):
 * 1. High -> Medium -> Normal -> Low
 * 2. Earliest due date first, unscheduled last
 * 3. Oldest created first
 */
export function compareActionsByPriorityAndDue(a: ActionRecord, b: ActionRecord): number {
  const pA = PRIORITY_RANK[(a.priority || 'normal').toLowerCase()] ?? 2;
  const pB = PRIORITY_RANK[(b.priority || 'normal').toLowerCase()] ?? 2;
  if (pA !== pB) return pA - pB;

  const dueA = a.due_date ? a.due_date.slice(0, 10) : '9999-99-99';
  const dueB = b.due_date ? b.due_date.slice(0, 10) : '9999-99-99';
  if (dueA !== dueB) return dueA.localeCompare(dueB);

  const createdA = a.created_at ? new Date(a.created_at).getTime() : 0;
  const createdB = b.created_at ? new Date(b.created_at).getTime() : 0;
  return createdA - createdB;
}

/**
 * Client-side permission check for edit/delete controls.
 * Viewers or non-owners without edit rights see controls disabled with a reason.
 */
export function canUserEditAction(
  action: ActionRecord,
  currentUserId?: string | null,
  userRole?: string | null
): { allowed: boolean; reason?: string } {
  if (!currentUserId) {
    return { allowed: false, reason: 'View only: sign in to edit this action' };
  }
  if (userRole === 'viewer') {
    return { allowed: false, reason: 'View only: team viewers cannot edit actions' };
  }
  if (action.ownership_type === 'personal') {
    if (action.user_id !== currentUserId && action.assigned_user_id !== currentUserId) {
      return { allowed: false, reason: 'View only: you do not have permission to edit this action' };
    }
  }
  return { allowed: true };
}

/** Helper to record action audit events */
async function logActionEvent(
  supabase: SupabaseClient,
  actionId: string,
  event: string,
  changedFields: Record<string, any>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user?.id) {
      await supabase.from('action_audit_events').insert({
        action_id: actionId,
        actor_id: user.id,
        event,
        changed_fields: changedFields,
      });
    }
  } catch {
    // Audit log non-blocking
  }
}

/**
 * Save a new action into Action Tracker.
 */
export async function saveAction(
  supabase: SupabaseClient,
  input: CreateActionInput
): Promise<ActionQueryResult<ActionRecord>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Overdue is computed from due_date with Melbourne date; never stored in status.
    // Legacy 'overdue' is treated as pending ('not_started').
    let initialStatus: ActionStatus = input.status === 'overdue'
      ? 'not_started'
      : (input.status || 'not_started');

    // Determine ownership and team_id if not explicitly provided
    let ownershipType = input.ownership_type || (input.team_id ? 'team' : 'personal');
    let teamId = input.team_id || null;

    if (!input.team_id && input.project_id) {
      const { data: proj } = await supabase
        .from('projects')
        .select('ownership_type, team_id')
        .eq('id', input.project_id)
        .maybeSingle();

      if (proj && proj.ownership_type === 'team' && proj.team_id) {
        ownershipType = 'team';
        teamId = proj.team_id;
      }
    }

    const { data, error } = await supabase
      .from('action_tracker')
      .insert({
        user_id: user.id,
        project_id: input.project_id || null,
        action_title: input.action_title.trim(),
        action_description: input.action_description?.trim() || null,
        owner_name: input.owner_name?.trim() || null,
        due_date: input.due_date || null,
        status: initialStatus,
        source_output_id: input.source_output_id || null,
        ownership_type: ownershipType,
        team_id: teamId,
        assigned_user_id: input.assigned_user_id || null,
        assigned_user_name: input.assigned_user_name || null,
        priority: input.priority || 'normal',
        due_time: input.due_time || null,
        due_timezone: input.due_timezone || 'Australia/Melbourne',
        all_day: input.all_day ?? true,
        source_type: input.source_type || null,
        source_id: input.source_id || null,
        source_url: input.source_url || null,
        origin_marker: input.origin_marker || null,
        approval_state: input.approval_state || 'manual',
        approved_by: input.approved_by || null,
        approved_at: input.approved_at || null,
        completed_at: input.completed_at || null,
        completed_by: input.completed_by || null,
        archived_at: input.archived_at || null,
        archived_by: input.archived_by || null,
      })
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (teamId && ownershipType === 'team') {
      await logTeamActivity(supabase, teamId, {
        activity_type: 'action_created',
        title: 'Action created',
        description: `Created action "${input.action_title.trim()}"`,
        entity_id: data.id,
        entity_type: 'action',
      });
    }

    return { data: data as ActionRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to save action') };
  }
}

/**
 * Fetch non-deleted actions accessible to the authenticated user.
 * Default sort:
 * 1. Incomplete actions first (status != 'completed')
 * 2. Nearest due date (ascending, nulls last)
 * 3. Most recent (created_at DESC)
 */
export async function fetchActions(
  supabase: SupabaseClient,
  options?: FetchActionsOptions
): Promise<ActionQueryResult<ActionRecord[]>> {
  try {
    let query = supabase
      .from('action_tracker')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id)')
      .is('deleted_at', null);

    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    }

    if (options?.workspaceScope === 'personal') {
      query = query.or('ownership_type.eq.personal,team_id.is.null');
    } else if (options?.workspaceScope === 'team') {
      query = query.eq('ownership_type', 'team');
      if (options.teamId) {
        query = query.eq('team_id', options.teamId);
      }
    } else if (options?.teamId) {
      query = query.eq('team_id', options.teamId);
    }

    if (options?.assignedUserId) {
      query = query.eq('assigned_user_id', options.assignedUserId);
    }

    if (options?.status && options.status !== 'all') {
      if (options.status === 'overdue') {
        // Handled in JS post-processing: not completed and due_date before today in Melbourne
      } else if (options.status === 'not_started' || options.status === 'pending') {
        // Stored 'overdue' is treated as pending ('not_started')
        query = query.in('status', ['not_started', 'overdue']);
      } else {
        query = query.eq('status', options.status);
      }
    }

    if (options?.owner) {
      query = query.or(`owner_name.ilike.%${options.owner}%,assigned_user_name.ilike.%${options.owner}%`);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Filter out actions whose parent project is soft-deleted.
    // Synthetic demonstration and dry-run tasks are strictly excluded.
    // A stored 'overdue' is treated as pending ('not_started').
    let records = (data || []).filter((a: any) => {
      if (a.deleted_at !== null) return false;
      if (a.projects && a.projects.deleted_at !== null) return false;
      const titleLower = (a.action_title || '').toLowerCase();
      if (
        titleLower.includes('alex mercer') ||
        titleLower.includes('sarah jenkins') ||
        titleLower.includes('synthetic demonstration') ||
        titleLower.includes('[demonstration]')
      ) {
        return false;
      }
      return true;
    }).map((act: any) => {
      if (act.status === 'overdue') {
        return { ...act, status: 'not_started' as ActionStatus };
      }
      return act as ActionRecord;
    });

    // Overdue filter becomes: not completed and due_date before today in Melbourne
    if (options?.status === 'overdue') {
      records = records.filter((act) => isActionOverdue(act));
    }

    // Default ordering (Section 1.3): High -> Medium -> Normal -> Low, earliest due first (unscheduled last), oldest created
    records.sort(compareActionsByPriorityAndDue);

    if (options?.limit) {
      records = records.slice(0, options.limit);
    }

    return { data: records, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load actions') };
  }
}

/**
 * Fetch a single action record by ID with project and output details.
 */
export async function fetchActionById(
  supabase: SupabaseClient,
  id: string
): Promise<ActionQueryResult<ActionRecord>> {
  try {
    const { data, error } = await supabase
      .from('action_tracker')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id), outputs(id, output_type, content)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const record = data as ActionRecord;
    // Treat legacy stored 'overdue' as pending ('not_started'); overdue is computed
    if (record.status === 'overdue') {
      record.status = 'not_started';
    }

    return { data: record, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load action') };
  }
}

/**
 * Update an existing action record.
 */
export async function updateAction(
  supabase: SupabaseClient,
  id: string,
  input: UpdateActionInput
): Promise<ActionQueryResult<ActionRecord>> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.action_title !== undefined) updatePayload.action_title = input.action_title.trim();
    if (input.action_description !== undefined) updatePayload.action_description = input.action_description?.trim() || null;
    if (input.owner_name !== undefined) updatePayload.owner_name = input.owner_name?.trim() || null;
    if (input.due_date !== undefined) updatePayload.due_date = input.due_date || null;
    if (input.status !== undefined) {
      // Overdue is computed from due_date, never stored in status.
      updatePayload.status = input.status === 'overdue' ? 'not_started' : input.status;
      if (input.status === 'completed') {
        updatePayload.completed_at = input.completed_at || new Date().toISOString();
        updatePayload.completed_by = input.completed_by || user?.id || null;
      } else {
        updatePayload.completed_at = null;
        updatePayload.completed_by = null;
      }
    }
    if (input.assigned_user_id !== undefined) updatePayload.assigned_user_id = input.assigned_user_id;
    if (input.assigned_user_name !== undefined) updatePayload.assigned_user_name = input.assigned_user_name;
    if (input.ownership_type !== undefined) updatePayload.ownership_type = input.ownership_type;
    if (input.team_id !== undefined) updatePayload.team_id = input.team_id;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.due_time !== undefined) updatePayload.due_time = input.due_time;
    if (input.due_timezone !== undefined) updatePayload.due_timezone = input.due_timezone;
    if (input.all_day !== undefined) updatePayload.all_day = input.all_day;
    if (input.completed_at !== undefined) updatePayload.completed_at = input.completed_at;
    if (input.completed_by !== undefined) updatePayload.completed_by = input.completed_by;
    if (input.archived_at !== undefined) updatePayload.archived_at = input.archived_at;
    if (input.archived_by !== undefined) updatePayload.archived_by = input.archived_by;
    if (input.origin_marker !== undefined) updatePayload.origin_marker = input.origin_marker;

    const { data, error } = await supabase
      .from('action_tracker')
      .update(updatePayload)
      .eq('id', id)
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (data?.team_id && data.ownership_type === 'team') {
      if (input.status === 'completed') {
        await logTeamActivity(supabase, data.team_id, {
          activity_type: 'action_completed',
          title: 'Action completed',
          description: `Completed action "${data.action_title}"`,
          entity_id: data.id,
          entity_type: 'action',
        });
      } else {
        await logTeamActivity(supabase, data.team_id, {
          activity_type: 'action_updated',
          title: 'Action updated',
          description: `Updated action "${data.action_title}"`,
          entity_id: data.id,
          entity_type: 'action',
        });
      }
    }

    // Record in action_audit_events with who, when, field, old value, and new value (Section 2.6)
    if (input.status !== undefined) {
      await logActionEvent(
        supabase,
        id,
        'status_updated',
        { field: 'status', old_value: input.old_status ?? null, new_value: input.status }
      );
    }
    if (input.priority !== undefined) {
      await logActionEvent(
        supabase,
        id,
        'priority_updated',
        { field: 'priority', old_value: input.old_priority ?? null, new_value: input.priority }
      );
    }

    return { data: data as ActionRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to update action') };
  }
}

/**
 * Update action status directly.
 */
export async function updateActionStatus(
  supabase: SupabaseClient,
  id: string,
  status: ActionStatus
): Promise<ActionQueryResult<ActionRecord>> {
  return updateAction(supabase, id, { status });
}

/**
 * Non-destructive soft delete for an action record (30-day retention).
 */
export async function softDeleteAction(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: rpcErr } = await supabase.rpc('soft_delete_action', {
      p_action_id: id,
    });

    if (!rpcErr) {
      await logActionEvent(supabase, id, 'action_deleted', {
        field: 'deleted_at',
        old_value: null,
        deleted_at: new Date().toISOString(),
      });
      return { success: true, error: null };
    }

    // Direct fallback
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('action_tracker')
      .update({
        deleted_at: now.toISOString(),
        deleted_by: currentUser?.id || null,
        purge_after: purgeAfter.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

    await logActionEvent(supabase, id, 'action_deleted', {
      field: 'deleted_at',
      old_value: null,
      deleted_at: now.toISOString(),
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error('Failed to delete action') };
  }
}

/**
 * Restore a soft-deleted action.
 */
export async function restoreAction(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: rpcErr } = await supabase.rpc('restore_action', {
      p_action_id: id,
    });

    if (!rpcErr) {
      await logActionEvent(supabase, id, 'action_restored', {
        field: 'deleted_at',
        old_value: 'deleted',
        restored_at: new Date().toISOString(),
      });
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('action_tracker')
      .update({
        deleted_at: null,
        deleted_by: null,
        purge_after: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

    await logActionEvent(supabase, id, 'action_restored', {
      field: 'deleted_at',
      old_value: 'deleted',
      restored_at: new Date().toISOString(),
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error('Failed to restore action') };
  }
}

/**
 * True database deletion (available only from Recently Deleted).
 */
export async function permanentDeleteAction(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: rpcErr } = await supabase.rpc('permanent_delete_action', {
      p_action_id: id,
    });

    if (!rpcErr) {
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('action_tracker')
      .delete()
      .eq('id', id)
      .not('deleted_at', 'is', null);

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error('Failed to permanently delete action') };
  }
}

/**
 * Fetch deleted actions for Recently Deleted view.
 */
export async function fetchDeletedActions(
  supabase: SupabaseClient
): Promise<ActionQueryResult<ActionRecord[]>> {
  try {
    const { data, error } = await supabase
      .from('action_tracker')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as ActionRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load deleted actions') };
  }
}
