import { SupabaseClient } from '@supabase/supabase-js';
import { Transcript } from './types';

/**
 * Server-side helper to fetch project transcript using authenticated server client.
 */
export async function fetchProjectTranscriptServer(
  supabase: SupabaseClient,
  projectId: string
): Promise<{ data: Transcript | null; error: Error | null }> {
  try {
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
      error: err instanceof Error ? err : new Error('Failed to fetch transcript server-side')
    };
  }
}
