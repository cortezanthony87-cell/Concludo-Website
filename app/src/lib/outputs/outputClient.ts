import { SupabaseClient } from '@supabase/supabase-js';
import {
  OutputRecord,
  OutputType,
  SaveOutputInput,
  UpdateOutputInput,
  ALLOWED_OUTPUT_TYPES
} from './types';

export interface OutputQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Fetch all active outputs for a given project.
 * Normal output queries must only show: deleted_at is null
 */
export async function fetchProjectOutputs(
  supabase: SupabaseClient,
  projectId: string
): Promise<OutputQueryResult<OutputRecord[]>> {
  try {
    if (!projectId) {
      return { data: null, error: new Error('Project ID is required') };
    }

    const { data, error } = await supabase
      .from('outputs')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as OutputRecord[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch project outputs')
    };
  }
}

/**
 * Fetch a single output record by ID.
 * Normal output queries must only show: deleted_at is null
 */
export async function fetchOutputById(
  supabase: SupabaseClient,
  id: string
): Promise<OutputQueryResult<OutputRecord>> {
  try {
    if (!id) {
      return { data: null, error: new Error('Output ID is required') };
    }

    const { data, error } = await supabase
      .from('outputs')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    if (!data) {
      return { data: null, error: new Error('Output not found') };
    }

    return { data: data as OutputRecord, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch output')
    };
  }
}

/**
 * Create a new output record attached to a project.
 * - Set user_id to the logged-in user
 * - Require project_id
 * - Confirm the project belongs to the logged-in user
 * - Require output_type
 * - Require either content or json_content
 * - Set created_at and updated_at automatically
 * - Set deleted_at to null
 */
export async function saveOutput(
  supabase: SupabaseClient,
  input: SaveOutputInput
): Promise<OutputQueryResult<OutputRecord>> {
  try {
    if (!input.project_id) {
      return { data: null, error: new Error('Project ID is required') };
    }

    if (!input.output_type) {
      return { data: null, error: new Error('Output type missing') };
    }

    if (!ALLOWED_OUTPUT_TYPES.includes(input.output_type)) {
      return {
        data: null,
        error: new Error(`Invalid output type. Must be one of: ${ALLOWED_OUTPUT_TYPES.join(', ')}`)
      };
    }

    const hasTextContent = typeof input.content === 'string' && input.content.trim().length > 0;
    const hasJsonContent = input.json_content !== undefined && input.json_content !== null;

    if (!hasTextContent && !hasJsonContent) {
      return { data: null, error: new Error('Output content missing') };
    }

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Client-side verification that project belongs to current user
    const { data: projectData, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', input.project_id)
      .is('deleted_at', null)
      .maybeSingle();

    if (projectError || !projectData) {
      return {
        data: null,
        error: new Error('Project not found')
      };
    }

    if (projectData.user_id !== user.id) {
      return {
        data: null,
        error: new Error('Permission denied: Cannot attach output to another user project')
      };
    }

    const payload = {
      project_id: input.project_id,
      user_id: user.id,
      output_type: input.output_type,
      content: hasTextContent ? input.content!.trim() : null,
      json_content: hasJsonContent ? input.json_content : null,
      model_used: input.model_used || null,
      deleted_at: null,
      deleted_by: null,
      purge_after: null
    };

    const { data, error } = await supabase
      .from('outputs')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to save output') };
    }

    return { data: data as OutputRecord, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to save output')
    };
  }
}

/**
 * Update an existing output record.
 * - Require either content or json_content
 * - Update updated_at
 * - Do not change user_id, project_id, or created_at
 */
export async function updateOutput(
  supabase: SupabaseClient,
  id: string,
  input: UpdateOutputInput
): Promise<OutputQueryResult<OutputRecord>> {
  try {
    if (!id) {
      return { data: null, error: new Error('Output ID is required') };
    }

    const hasTextContent = typeof input.content === 'string' && input.content.trim().length > 0;
    const hasJsonContent = input.json_content !== undefined && input.json_content !== null;

    if (!hasTextContent && !hasJsonContent && input.output_type === undefined) {
      return { data: null, error: new Error('Output content missing') };
    }

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (hasTextContent) {
      updatePayload.content = input.content!.trim();
    }

    if (hasJsonContent) {
      updatePayload.json_content = input.json_content;
    }

    if (input.output_type) {
      if (!ALLOWED_OUTPUT_TYPES.includes(input.output_type)) {
        return {
          data: null,
          error: new Error(`Invalid output type. Must be one of: ${ALLOWED_OUTPUT_TYPES.join(', ')}`)
        };
      }
      updatePayload.output_type = input.output_type;
    }

    const { data, error } = await supabase
      .from('outputs')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to update output') };
    }

    if (!data) {
      return { data: null, error: new Error('Output not found') };
    }

    return { data: data as OutputRecord, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update output')
    };
  }
}

/**
 * Soft delete an output record by setting deleted_at to the current timestamp.
 * Do not hard delete the row.
 */
export async function softDeleteOutput(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!id) {
      return { success: false, error: new Error('Output ID is required') };
    }

    const {
      data: { user }
    } = await supabase.auth.getUser();

    const now = new Date();
    const nowIso = now.toISOString();
    const purgeAfterIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('outputs')
      .update({
        deleted_at: nowIso,
        deleted_by: user?.id || null,
        purge_after: purgeAfterIso
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select();

    if (error) {
      return { success: false, error: new Error(error.message || 'Failed to delete output') };
    }

    if (!data || data.length === 0) {
      return { success: false, error: new Error('Output not found or already deleted') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to delete output')
    };
  }
}
