import { SupabaseClient } from '@supabase/supabase-js';
import { Project } from './types';

/**
 * Server-side helper to fetch project by ID.
 * Returns null if not found or soft deleted.
 */
export async function getProjectByIdServer(
  supabase: SupabaseClient,
  id: string
): Promise<Project | null> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data as Project;
}
