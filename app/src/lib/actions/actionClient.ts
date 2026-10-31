import { SupabaseClient } from '@supabase/supabase-js';
import { ActionRecord, CreateActionInput, UpdateActionInput, ActionStatus } from './types';
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

    if (!input.team_id) {
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
        project_id: input.project_id,
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
    // A stored 'overdue' is treated as pending ('not_started').
    let records = (data || []).filter(
      (a: any) => !a.projects || a.projects.deleted_at === null
    ).map((act: any) => {
      if (act.status === 'overdue') {
        return { ...act, status: 'not_started' as ActionStatus };
      }
      return act as ActionRecord;
    });

    // Overdue filter becomes: not completed and due_date before today in Melbourne
    if (options?.status === 'overdue') {
      records = records.filter((act) => isActionOverdue(act));
    }

    // Sort: Incomplete first -> Nearest due date -> Most recent
    records.sort((a, b) => {
      const aComplete = a.status === 'completed' ? 1 : 0;
      const bComplete = b.status === 'completed' ? 1 : 0;
      if (aComplete !== bComplete) return aComplete - bComplete;

      // Both incomplete or both complete: sort by due date
      if (a.due_date && b.due_date) {
        const timeDiff = new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        if (timeDiff !== 0) return timeDiff;
      } else if (a.due_date && !b.due_date) {
        return -1;
      } else if (!a.due_date && b.due_date) {
        return 1;
      }

      // Then by created_at descending
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

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
    }
    if (input.assigned_user_id !== undefined) updatePayload.assigned_user_id = input.assigned_user_id;
    if (input.assigned_user_name !== undefined) updatePayload.assigned_user_name = input.assigned_user_name;
    if (input.ownership_type !== undefined) updatePayload.ownership_type = input.ownership_type;
    if (input.team_id !== undefined) updatePayload.team_id = input.team_id;

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
    const { error: rpcErr } = await supabase.rpc('soft_delete_action', {\n      p_action_id: id,\n    });\n\n    if (!rpcErr) {\n      return { success: true, error: null };\n    }\n\n    // Direct fallback\n    const {\n      data: { user },\n    } = await supabase.auth.getUser();\n\n    const now = new Date();\n    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);\n\n    const { error } = await supabase\n      .from('action_tracker')\n      .update({\n        deleted_at: now.toISOString(),\n        deleted_by: user?.id || null,\n        purge_after: purgeAfter.toISOString(),\n        updated_at: now.toISOString(),\n      })\n      .eq('id', id);\n\n    if (error) {\n      return { success: false, error: new Error(error.message) };\n    }\n\n    return { success: true, error: null };\n  } catch (err: any) {\n    return { success: false, error: err instanceof Error ? err : new Error('Failed to delete action') };\n  }\n}\n\n/**\n * Restore a soft-deleted action.\n */\nexport async function restoreAction(\n  supabase: SupabaseClient,\n  id: string\n): Promise<{ success: boolean; error: Error | null }> {\n  try {\n    const { error: rpcErr } = await supabase.rpc('restore_action', {\n      p_action_id: id,\n    });\n\n    if (!rpcErr) {\n      return { success: true, error: null };\n    }\n\n    const { error } = await supabase\n      .from('action_tracker')\n      .update({\n        deleted_at: null,\n        deleted_by: null,\n        purge_after: null,\n        updated_at: new Date().toISOString(),\n      })\n      .eq('id', id);\n\n    if (error) {\n      return { success: false, error: new Error(error.message) };\n    }\n\n    return { success: true, error: null };\n  } catch (err: any) {\n    return { success: false, error: err instanceof Error ? err : new Error('Failed to restore action') };\n  }\n}\n\n/**\n * True database deletion (available only from Recently Deleted).\n */\nexport async function permanentDeleteAction(\n  supabase: SupabaseClient,\n  id: string\n): Promise<{ success: boolean; error: Error | null }> {\n  try {\n    const { error: rpcErr } = await supabase.rpc('permanent_delete_action', {\n      p_action_id: id,\n    });\n\n    if (!rpcErr) {\n      return { success: true, error: null };\n    }\n\n    const { error } = await supabase\n      .from('action_tracker')\n      .delete()\n      .eq('id', id)\n      .not('deleted_at', 'is', null);\n\n    if (error) {\n      return { success: false, error: new Error(error.message) };\n    }\n\n    return { success: true, error: null };\n  } catch (err: any) {\n    return { success: false, error: err instanceof Error ? err : new Error('Failed to permanently delete action') };\n  }\n}\n\n/**\n * Fetch deleted actions for Recently Deleted view.\n */\nexport async function fetchDeletedActions(\n  supabase: SupabaseClient\n): Promise<ActionQueryResult<ActionRecord[]>> {\n  try {\n    const { data, error } = await supabase\n      .from('action_tracker')\n      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at)')\n      .not('deleted_at', 'is', null)\n      .order('deleted_at', { ascending: false });\n\n    if (error) {\n      return { data: null, error: new Error(error.message) };\n    }\n\n    return { data: (data as ActionRecord[]) || [], error: null };\n  } catch (err: any) {\n    return { data: null, error: err instanceof Error ? err : new Error('Failed to load deleted actions') };\n  }\n}