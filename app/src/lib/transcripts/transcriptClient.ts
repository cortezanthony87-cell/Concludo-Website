import { SupabaseClient } from '@supabase/supabase-js';
import { Transcript, SaveTranscriptInput, UpdateTranscriptInput } from './types';
import { detectSpeakerLabels } from './speakerDetection';

export interface TranscriptQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Fetch the active transcript for a given project.
 * Normal transcript queries must only show: deleted_at is null
 */
export async function fetchProjectTranscript(
  supabase: SupabaseClient,
  projectId: string
): Promise<TranscriptQueryResult<Transcript>> {
  try {
    if (!projectId) {
      return { data: null, error: new Error('Project ID is required') };
    }

    const { data, error } = await supabase
      .from('transcripts')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as Transcript) || null, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch project transcript')
    };
  }
}

/**
 * Create a new transcript row for a project.
 * - Set user_id to the logged-in user
 * - Require project_id
 * - Confirm the project belongs to the logged-in user
 * - Require raw_text (reject empty transcript text)
 * - Set source_type to pasted by default
 * - Set speaker_labels_detected automatically
 */
export async function saveTranscript(
  supabase: SupabaseClient,
  input: SaveTranscriptInput
): Promise<TranscriptQueryResult<Transcript>> {
  try {
    if (!input.project_id) {
      return { data: null, error: new Error('Project ID is required') };
    }

    const trimmedText = input.raw_text ? input.raw_text.trim() : '';
    if (!trimmedText) {
      return { data: null, error: new Error('Transcript text cannot be empty') };
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
        error: new Error('Cannot attach transcript to another user project or non-existent project')
      };
    }

    if (projectData.user_id !== user.id) {
      return {
        data: null,
        error: new Error('Cannot attach transcript to another user project')
      };
    }

    const speakerLabelsDetected = detectSpeakerLabels(input.raw_text);

    const payload = {
      project_id: input.project_id,
      user_id: user.id,
      raw_text: input.raw_text,
      speaker_labels_detected: speakerLabelsDetected,
      source_type: input.source_type || 'pasted'
    };

    const { data, error } = await supabase
      .from('transcripts')
      .insert(payload)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to save transcript') };
    }

    return { data: data as Transcript, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to save transcript')
    };
  }
}

/**
 * Update an existing transcript.
 * - Require raw_text (reject empty transcript text)
 * - Re-run speaker label detection
 * - Update updated_at
 * - Do not change user_id, project_id, or created_at
 */
export async function updateTranscript(
  supabase: SupabaseClient,
  id: string,
  input: UpdateTranscriptInput
): Promise<TranscriptQueryResult<Transcript>> {
  try {
    if (!id) {
      return { data: null, error: new Error('Transcript ID is required') };
    }

    const trimmedText = input.raw_text ? input.raw_text.trim() : '';
    if (!trimmedText) {
      return { data: null, error: new Error('Transcript text cannot be empty') };
    }

    const speakerLabelsDetected = detectSpeakerLabels(input.raw_text);

    const updatePayload: Record<string, any> = {
      raw_text: input.raw_text,
      speaker_labels_detected: speakerLabelsDetected,
      updated_at: new Date().toISOString()
    };

    if (input.source_type) {
      updatePayload.source_type = input.source_type;
    }

    const { data, error } = await supabase
      .from('transcripts')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to update transcript') };
    }

    return { data: data as Transcript, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update transcript')
    };
  }
}

/**
 * Soft delete a transcript by setting deleted_at to current timestamp.
 * Do not hard delete the row.
 */
export async function softDeleteTranscript(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!id) {
      return { success: false, error: new Error('Transcript ID is required') };
    }

    const nowIso = new Date().toISOString();

    const { error } = await supabase
      .from('transcripts')
      .update({ deleted_at: nowIso })
      .eq('id', id)
      .is('deleted_at', null);

    if (error) {
      return { success: false, error: new Error(error.message || 'Failed to delete transcript') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to delete transcript')
    };
  }
}
