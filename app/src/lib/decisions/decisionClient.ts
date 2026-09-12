import { SupabaseClient } from '@supabase/supabase-js';
import { DecisionRecord, CreateDecisionInput, UpdateDecisionInput } from './types';
import { logTeamActivity } from '../teams/teamClient';

export interface DecisionQueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface FetchDecisionsOptions {
  projectId?: string;
  limit?: number;
  teamId?: string;
  workspaceScope?: 'all' | 'personal' | 'team';
}

/**
 * Save a new decision into Decision Memory.
 */
export async function saveDecision(
  supabase: SupabaseClient,
  input: CreateDecisionInput
): Promise<DecisionQueryResult<DecisionRecord>> {
  try {
    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

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
      .from('decision_memory')
      .insert({
        user_id: user.id,
        project_id: input.project_id,
        decision_title: input.decision_title.trim(),
        decision_summary: input.decision_summary?.trim() || null,
        decision_reasoning: input.decision_reasoning?.trim() || null,
        decision_owner: input.decision_owner?.trim() || null,
        decision_date: input.decision_date || null,
        source_output_id: input.source_output_id || null,
        ownership_type: ownershipType,
        team_id: teamId,
      })
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (teamId && ownershipType === 'team') {
      await logTeamActivity(supabase, teamId, {
        activity_type: 'decision_saved',
        title: 'Decision recorded',
        description: `Saved decision "${input.decision_title.trim()}"`,
        entity_id: data.id,
        entity_type: 'decision',
      });
    }

    return { data: data as DecisionRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to save decision') };
  }
}

/**
 * Fetch non-deleted decisions accessible to the authenticated user.
 */
export async function fetchDecisions(
  supabase: SupabaseClient,
  options?: FetchDecisionsOptions
): Promise<DecisionQueryResult<DecisionRecord[]>> {
  try {
    let query = supabase
      .from('decision_memory')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id)')
      .is('deleted_at', null)
      .order('decision_date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

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

    if (options?.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    // Filter out decisions whose parent project is soft-deleted
    const valid = (data || []).filter(
      (d: any) => !d.projects || d.projects.deleted_at === null
    );

    return { data: valid as DecisionRecord[], error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load decisions') };
  }
}

/**
 * Fetch a single decision record by ID with project and output details.
 */
export async function fetchDecisionById(
  supabase: SupabaseClient,
  id: string
): Promise<DecisionQueryResult<DecisionRecord>> {
  try {
    const { data, error } = await supabase
      .from('decision_memory')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id), outputs(id, output_type, content)')
      .eq('id', id)
      .is('deleted_at', null)
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as DecisionRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load decision') };
  }
}

/**
 * Update an existing decision record.
 */
export async function updateDecision(
  supabase: SupabaseClient,
  id: string,
  input: UpdateDecisionInput
): Promise<DecisionQueryResult<DecisionRecord>> {
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.decision_title !== undefined) updatePayload.decision_title = input.decision_title.trim();
    if (input.decision_summary !== undefined) updatePayload.decision_summary = input.decision_summary?.trim() || null;
    if (input.decision_reasoning !== undefined) updatePayload.decision_reasoning = input.decision_reasoning?.trim() || null;
    if (input.decision_owner !== undefined) updatePayload.decision_owner = input.decision_owner?.trim() || null;
    if (input.decision_date !== undefined) updatePayload.decision_date = input.decision_date || null;
    if (input.ownership_type !== undefined) updatePayload.ownership_type = input.ownership_type;
    if (input.team_id !== undefined) updatePayload.team_id = input.team_id;

    const { data, error } = await supabase
      .from('decision_memory')
      .update(updatePayload)
      .eq('id', id)
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at, ownership_type, team_id)')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as DecisionRecord, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to update decision') };
  }
}

/**
 * Non-destructive soft delete for a decision record (30-day retention).
 */
export async function softDeleteDecision(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: rpcErr } = await supabase.rpc('soft_delete_decision', {
      p_decision_id: id,
    });

    if (!rpcErr) {
      return { success: true, error: null };
    }

    // Direct fallback
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const now = new Date();
    const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const { error } = await supabase
      .from('decision_memory')
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
    return { success: false, error: err instanceof Error ? err : new Error('Failed to delete decision') };
  }
}

/**
 * Restore a soft-deleted decision.
 */
export async function restoreDecision(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: rpcErr } = await supabase.rpc('restore_decision', {
      p_decision_id: id,
    });

    if (!rpcErr) {
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('decision_memory')
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
    return { success: false, error: err instanceof Error ? err : new Error('Failed to restore decision') };
  }
}

/**
 * True database deletion (available only from Recently Deleted).
 */
export async function permanentDeleteDecision(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error: rpcErr } = await supabase.rpc('permanent_delete_decision', {
      p_decision_id: id,
    });

    if (!rpcErr) {
      return { success: true, error: null };
    }

    const { error } = await supabase
      .from('decision_memory')
      .delete()
      .eq('id', id)
      .not('deleted_at', 'is', null);

    if (error) {
      return { success: false, error: new Error(error.message) };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err instanceof Error ? err : new Error('Failed to permanently delete decision') };
  }
}

/**
 * Fetch deleted decisions for Recently Deleted view.
 */
export async function fetchDeletedDecisions(
  supabase: SupabaseClient
): Promise<DecisionQueryResult<DecisionRecord[]>> {
  try {
    const { data, error } = await supabase
      .from('decision_memory')
      .select('*, projects(id, title, client_name, project_name, meeting_date, deleted_at)')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as DecisionRecord[]) || [], error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Failed to load deleted decisions') };
  }
}
