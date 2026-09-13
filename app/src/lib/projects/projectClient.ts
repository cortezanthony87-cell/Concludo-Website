import { SupabaseClient } from '@supabase/supabase-js';
import { Project, CreateProjectInput, UpdateProjectInput } from './types';
import { detectSpeakerLabels } from '../transcripts/speakerDetection';
import { logTeamActivity } from '../teams/teamClient';

export interface ProjectQueryResult<T> {
  data: T | null;
  error: Error | null;
}

export interface FetchProjectsOptions {
  teamId?: string;
  workspaceScope?: 'all' | 'personal' | 'team';
}

/**
 * Fetch active projects for the current authenticated user and accessible teams.
 * Normal project queries must only show: deleted_at is null
 * Sorted: Updated date descending (most recently modified first)
 */
export async function fetchProjects(
  supabase: SupabaseClient,
  options?: FetchProjectsOptions
): Promise<ProjectQueryResult<Project[]>> {
  try {
    let query = supabase
      .from('projects')
      .select('*')
      .is('deleted_at', null);

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

    const { data, error } = await query.order('updated_at', { ascending: false });

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
 * Fetch a single active project by ID.
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
 * Fetch all soft-deleted projects for the current authenticated user (Recently Deleted).
 * Queries records where: deleted_at is not null
 * Respects RLS.
 */
export async function fetchDeletedProjects(
  supabase: SupabaseClient
): Promise<ProjectQueryResult<Project[]>> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as Project[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch deleted projects')
    };
  }
}

/**
 * Create a new project row in Supabase.
 * - Set user_id to the logged-in user
 * - Stores all Tasklet 13 & 16 fields:
 *   id, user_id, title, meeting_type, client_name, project_name, meeting_date, transcript, notes, ownership_type, team_id
 * - Synchronizes with transcripts table for archive compatibility
 * - Set created_at & updated_at automatically
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

    const clientName = input.client_name?.trim() || null;
    const projectName = input.project_name?.trim() || null;
    const clientOrProject = input.client_or_project?.trim() || clientName || projectName || null;
    const transcriptText = input.transcript ? input.transcript.trim() : null;
    const notesText = input.notes ? input.notes.trim() : null;
    const ownershipType = input.ownership_type || (input.team_id ? 'team' : 'personal');
    const teamId = input.team_id || null;

    const newProjectPayload: Record<string, any> = {
      user_id: user.id,
      title: trimmedTitle,
      meeting_type: input.meeting_type?.trim() || null,
      client_name: clientName,
      project_name: projectName,
      client_or_project: clientOrProject,
      meeting_date: input.meeting_date || null,
      transcript: transcriptText,
      notes: notesText,
      ownership_type: ownershipType,
      team_id: teamId,
      deleted_at: null,
      deleted_by: null,
      purge_after: null
    };

    const { data, error } = await supabase
      .from('projects')
      .insert(newProjectPayload)
      .select('*')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to create project') };
    }

    // If transcript text was provided, also save to transcripts table for dual-table archive support
    if (transcriptText) {
      try {
        await supabase.from('transcripts').insert({
          project_id: data.id,
          user_id: user.id,
          raw_text: transcriptText,
          speaker_labels_detected: detectSpeakerLabels(transcriptText),
          source_type: 'pasted'
        });
      } catch {
        // Silently continue if transcripts table has non-critical issue; project record has full transcript
      }
    }

    // If team project, log team activity
    if (teamId && ownershipType === 'team') {
      await logTeamActivity(supabase, teamId, {
        activity_type: 'project_created',
        title: 'Project created',
        description: `Created project "${trimmedTitle}"`,
        entity_id: data.id,
        entity_type: 'project',
      });
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
 * Update project details:
 * title, meeting_type, client_name, project_name, client_or_project, meeting_date, transcript, notes.
 */
export async function updateProject(
  supabase: SupabaseClient,
  id: string,
  input: UpdateProjectInput
): Promise<ProjectQueryResult<Project>> {
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (input.title !== undefined) {
      const trimmedTitle = input.title ? input.title.trim() : '';
      if (!trimmedTitle) {
        return { data: null, error: new Error('Project title missing') };
      }
      updatePayload.title = trimmedTitle;
    }

    if (input.meeting_type !== undefined) {
      updatePayload.meeting_type = input.meeting_type?.trim() || null;
    }

    if (input.client_name !== undefined) {
      updatePayload.client_name = input.client_name?.trim() || null;
    }

    if (input.project_name !== undefined) {
      updatePayload.project_name = input.project_name?.trim() || null;
    }

    if (input.client_or_project !== undefined) {
      updatePayload.client_or_project = input.client_or_project?.trim() || null;
    } else if (input.client_name !== undefined || input.project_name !== undefined) {
      updatePayload.client_or_project =
        input.client_name?.trim() || input.project_name?.trim() || null;
    }

    if (input.meeting_date !== undefined) {
      updatePayload.meeting_date = input.meeting_date || null;
    }

    if (input.ownership_type !== undefined) {
      updatePayload.ownership_type = input.ownership_type;
    }

    if (input.team_id !== undefined) {
      updatePayload.team_id = input.team_id;
    }

    if (input.transcript !== undefined) {
      const trimmedTranscript = input.transcript ? input.transcript.trim() : null;
      updatePayload.transcript = trimmedTranscript;

      // Also update or insert in transcripts table
      if (trimmedTranscript) {
        try {
          const { data: existingTr } = await supabase
            .from('transcripts')
            .select('id')
            .eq('project_id', id)
            .is('deleted_at', null)
            .maybeSingle();

          if (existingTr) {
            await supabase
              .from('transcripts')
              .update({
                raw_text: trimmedTranscript,
                speaker_labels_detected: detectSpeakerLabels(trimmedTranscript),
                updated_at: new Date().toISOString()
              })
              .eq('id', existingTr.id);
          } else {
            const {
              data: { user }
            } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('transcripts').insert({
                project_id: id,
                user_id: user.id,
                raw_text: trimmedTranscript,
                speaker_labels_detected: detectSpeakerLabels(trimmedTranscript),
                source_type: 'pasted'
              });
            }
          }
        } catch {
          // Ignore child transcript sync error
        }
      }
    }

    if (input.notes !== undefined) {
      updatePayload.notes = input.notes ? input.notes.trim() : null;
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updatePayload)
      .eq('id', id)
      .is('deleted_at', null)
      .select('*')
      .single();

    if (error) {
      return { data: null, error: new Error(error.message || 'Failed to update project') };
    }

    if (data?.team_id && data.ownership_type === 'team') {
      await logTeamActivity(supabase, data.team_id, {
        activity_type: 'project_updated',
        title: 'Project updated',
        description: `Updated project "${data.title}"`,
        entity_id: data.id,
        entity_type: 'project',
      });
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
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const now = new Date();
    const nowIso = now.toISOString();
    const purgeAfterIso = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from('projects')
      .update({
        deleted_at: nowIso,
        deleted_by: user?.id || null,
        purge_after: purgeAfterIso
      })
      .eq('id', id)
      .is('deleted_at', null)
      .select();

    if (error) {
      return { success: false, error: new Error(error.message || 'Failed to delete project') };
    }

    if (!data || data.length === 0) {
      return { success: false, error: new Error('Project not found or already deleted') };
    }

    const proj = data[0];
    if (proj.team_id && proj.ownership_type === 'team') {
      await logTeamActivity(supabase, proj.team_id, {
        activity_type: 'project_deleted',
        title: 'Project deleted',
        description: `Moved project "${proj.title}" to Recently Deleted`,
        entity_id: proj.id,
        entity_type: 'project',
      });
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to delete project')
    };
  }
}

/**
 * Restore a soft-deleted project back to active state.
 * Uses atomic PostgreSQL RPC function restore_project.
 */
export async function restoreProject(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!id) {
      return { success: false, error: new Error('Project ID is required') };
    }

    const { error } = await supabase.rpc('restore_project', {
      p_project_id: id
    });

    if (error) {
      return { success: false, error: new Error(error.message || 'Failed to restore project') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to restore project')
    };
  }
}

/**
 * Permanently delete a project from Recently Deleted.
 * Uses atomic PostgreSQL RPC function permanent_delete_project.
 */
export async function permanentDeleteProject(
  supabase: SupabaseClient,
  id: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    if (!id) {
      return { success: false, error: new Error('Project ID is required') };
    }

    const { data, error } = await supabase.rpc('permanent_delete_project', {
      p_project_id: id
    });

    if (error) {
      return { success: false, error: new Error(error.message || 'Failed to permanently delete project') };
    }

    if (data && typeof data === 'object' && (data as any).success === false) {
      return { success: false, error: new Error((data as any).error || 'Failed to permanently delete project') };
    }

    return { success: true, error: null };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error('Failed to permanently delete project')
    };
  }
}
