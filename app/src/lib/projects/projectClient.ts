import { SupabaseClient } from '@supabase/supabase-js';
import { Project, CreateProjectInput, UpdateProjectInput } from './types';

export interface ProjectQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Fetch all active projects for the current authenticated user.
 * Normal project queries must only show: deleted_at is null
 */
export async function fetchProjects(
  supabase: SupabaseClient
): Promise<ProjectQueryResult<Project[]>> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as Project[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch projects')
    };
  }
}

/**
 * Fetch a single active project by ID for the current authenticated user.
 * Normal project queries must only show: deleted_at is null
 */
export async function fetchProjectById(
  supabase: SupabaseClient,
  id: string
): Promise<ProjectQueryResult<Project>> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return { data: null, error: new Error('Project not found') };
    }

    return { data: data as Project, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch project detail')
    };
  }
}

/**
 * Create a new project row in Supabase.
 * - Set user_id to the logged-in user
 * - Set created_at automatically
 * - Set updated_at automatically
 */
export async function createProject(
  supabase: SupabaseClient,
  input: CreateProjectInput
): Promise<ProjectQueryResult<Project>> {
  try {
    const trimmedTitle = input.title ? input.title.trim() : '';
    if (!trimmedTitle) {
      return { data: null, error: new Error('Project title missing') };
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    const newProjectPayload = {
      user_id: user.id,
      title: trimmedTitle,
      meeting_type: input.meeting_type?.trim() || null,
      client_or_project: input.client_or_project?.trim() || null,
      meeting_date: input.meeting_date || null
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(newProjectPayload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to create project') };
    }

    return { data: data as Project, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create project')
    };
  }
}

/**
 * Update project details: title, meeting_type, client_or_project, meeting_date.
 * Does not change user_id or created_at.
 */
export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  input: UpdateProjectInput
): Promise<ProjectQueryResult<Project>> {
  try {
    const trimmedTitle = input.title ? input.title.trim() : '';
    if (!trimmedTitle) {
      return { data: null, error: new Error('Project title missing') };
    }

    const updatePayload = {
      title: trimmedTitle,
      meeting_type: input.meeting_type?.trim() || null,
      client_or_project: input.client_or_project?.trim() || null,
      meeting_date: input.meeting_date || null
    };

    const { data, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to update project') };
    }

    return { data: data as Project, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update project')
    };
  }
}

/**
 * Soft delete a project by setting deleted_at to current timestamp.
 * Do not hard delete the row.
 */
export async function softDeleteProject(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('projects')
      .update({ deleted_at: nowIso })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      return { success: false, error: new Error(error.message || 'Failed to delete project') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to delete project')
    };
  }
}
