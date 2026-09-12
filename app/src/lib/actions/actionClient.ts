import { SupabaseClient } from '@supabase/supabase-js';
import { ActionRecord, CreateActionInput, UpdateActionInput, ActionStatus, isActionOverdue } from './types';

export interface ActionQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Save a new action into Action Tracker.
 * Scoped to authenticated user (auth.uid()).
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

    let initialStatus: ActionStatus = input.status || 'not_started';
    if (input.due_date && isActionOverdue({ status: initialStatus, due_date: input.due_date })) {
      initialStatus = 'overdue';
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
      })
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ActionRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to save action') };
  }
}

/**
 * Fetch non-deleted actions owned by the authenticated user.
 * Default sort:
 * 1. Incomplete actions first (status != 'completed')
 * 2. Nearest due date (ascending, nulls last)
 * 3. Most recent (created_at DESC)
 */
export async function fetchActions(
  supabase: SupabaseClient,
  options?: {
    projectId?: string;
    status?: string;
    owner?: string;
    limit?: number;
  }
): Promise<ActionQueryResult<ActionRecord[]>> {
  try {
    let query = supabase
      .from('action_tracker')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at)')
      .is('deleted_at', null);

    if (options?.projectId) {
      query = query.eq('project_id', options.projectId);
    }

    if (options?.status && options.status !== 'all') {
      if (options.status === 'overdue') {
        // Handled in JS post-processing to include both status='overdue' and past due_dates
      } else {
        query = query.eq('status', options.status);
      }
    }

    if (options?.owner) {
      query = query.ilike('owner_name', `%${options.owner}%`);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Filter out actions whose parent project is soft-deleted
    let records = (data || []).filter(
      (a: any) => !a.projects || a.projects.deleted_at === null
    ) as ActionRecord[];

    // Auto-detect overdue status for any uncompleted action
    records = records.map((act) => {
      if (act.status !== 'completed' && isActionOverdue(act)) {
        return { ...act, status: 'overdue' as ActionStatus };
      }
      return act;
    });

    if (options?.status === 'overdue') {
      records = records.filter((act) => act.status === 'overdue');
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
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at), outputs(id, output_type, content)')
      .eq('id', id)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    const record = data as ActionRecord;
    if (record.status !== 'completed' && isActionOverdue(record)) {
      record.status = 'overdue';
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
    if (input.status !== undefined) updatePayload.status = input.status;

    // Auto-overdue detection
    if (updatePayload.due_date && updatePayload.status !== 'completed') {
      if (isActionOverdue({ status: updatePayload.status || 'not_started', due_date: updatePayload.due_date })) {
        updatePayload.status = 'overdue';
      }
    }

    const { data, error } = await supabase
      .from('action_tracker')
      .update(updatePayload)
      .eq('id', id)
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
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
      return { success: true, error: null };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('action_tracker')
      .update({
        deleted_at: now.toISOString(),
        deleted_by: user?.id || null,
        purge_after: purgeAfter.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('id', id);

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

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

    if (rpcErr) {
      return { success: false, error: new Error(rpcErr.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error('Failed to permanently delete action') };
  }
}

/**
 * Fetch soft-deleted actions for the current authenticated user (Recently Deleted).
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

    return { data: (data || []) as ActionRecord[], error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load deleted actions') };
  }
}
