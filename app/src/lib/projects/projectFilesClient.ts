import { SupabaseClient } from '@supabase/supabase-js';

export type ProjectFileType =
  | 'document'
  | 'meeting_output'
  | 'transcript'
  | 'spreadsheet'
  | 'presentation'
  | 'audio'
  | 'notes'
  | 'teams_import'
  | 'other';

export type ProjectFileSource =
  | 'device_upload'
  | 'meeting_output'
  | 'teams_import'
  | 'manual_creation'
  | 'transcript';

export interface ProjectFileRecord {
  id: string;
  project_id: string;
  user_id: string;
  name: string;
  file_type: ProjectFileType;
  mime_type: string;
  file_size_bytes: number;
  source: ProjectFileSource;
  content?: string | null;
  storage_path?: string | null;
  version: number;
  description?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CreateProjectFileInput {
  project_id: string;
  name: string;
  file_type?: ProjectFileType;
  mime_type?: string;
  file_size_bytes?: number;
  source?: ProjectFileSource;
  content?: string | null;
  storage_path?: string | null;
  description?: string | null;
  version?: number;
}

export interface UpdateProjectFileInput {
  name?: string;
  content?: string | null;
  description?: string | null;
  file_type?: ProjectFileType;
}

export interface FileQueryResult<T> {
  data: T | null;
  error: Error | null;
}

/**
 * Fetch all active stored files for a project.
 */
export async function fetchProjectFiles(
  supabase: SupabaseClient,
  projectId: string
): Promise<FileQueryResult<ProjectFileRecord[]>> {
  try {
    if (!projectId) {
      return { data: null, error: new Error('Project ID is required') };
    }

    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: (data as ProjectFileRecord[]) || [], error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to fetch project files'),
    };
  }
}

/**
 * Upload binary file to Supabase Storage bucket 'project-files'
 */
export async function uploadProjectFileBinary(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
  file: File
): Promise<{ storagePath: string | null; error: Error | null }> {
  try {
    const timestamp = Date.now();
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${userId}/${projectId}/${timestamp}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from('project-files')
      .upload(storagePath, file, {
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      return { storagePath: null, error: new Error(error.message) };
    }

    return { storagePath: data.path, error: null };
  } catch (err: any) {
    return {
      storagePath: null,
      error: err instanceof Error ? err : new Error('Storage upload failed'),
    };
  }
}

/**
 * Download binary file from Supabase Storage bucket 'project-files'
 */
export async function downloadProjectFileBinary(
  supabase: SupabaseClient,
  storagePath: string
): Promise<{ blob: Blob | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.storage
      .from('project-files')
      .download(storagePath);

    if (error) {
      return { blob: null, error: new Error(error.message) };
    }

    return { blob: data, error: null };
  } catch (err: any) {
    return {
      blob: null,
      error: err instanceof Error ? err : new Error('Storage download failed'),
    };
  }
}

/**
 * Save a new file into a project's persistent file storage.
 */
export async function createProjectFile(
  supabase: SupabaseClient,
  input: CreateProjectFileInput
): Promise<FileQueryResult<ProjectFileRecord>> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { data: null, error: new Error('User must be authenticated to store project files') };
    }

    const payload = {
      project_id: input.project_id,
      user_id: user.id,
      name: input.name.trim(),
      file_type: input.file_type || 'document',
      mime_type: input.mime_type || 'text/plain',
      file_size_bytes: input.file_size_bytes || (input.content ? new Blob([input.content]).size : 0),
      source: input.source || 'device_upload',
      content: input.content || null,
      storage_path: input.storage_path || null,
      description: input.description || null,
      version: input.version || 1,
    };

    const { data, error } = await supabase
      .from('project_files')
      .insert([payload])
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ProjectFileRecord, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to create project file'),
    };
  }
}

/**
 * Update an existing project file (e.g. edit text content or rename).
 */
export async function updateProjectFile(
  supabase: SupabaseClient,
  fileId: string,
  input: UpdateProjectFileInput
): Promise<FileQueryResult<ProjectFileRecord>> {
  try {
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (input.name !== undefined) updatePayload.name = input.name.trim();
    if (input.content !== undefined) {
      updatePayload.content = input.content;
      updatePayload.file_size_bytes = new Blob([input.content || '']).size;
    }
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.file_type !== undefined) updatePayload.file_type = input.file_type;

    const { data, error } = await supabase
      .from('project_files')
      .update(updatePayload)
      .eq('id', fileId)
      .select()
      .single();

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: data as ProjectFileRecord, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to update project file'),
    };
  }
}

/**
 * Soft delete a project file.
 */
export async function deleteProjectFile(
  supabase: SupabaseClient,
  fileId: string
): Promise<FileQueryResult<boolean>> {
  try {
    const { error } = await supabase
      .from('project_files')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fileId);

    if (error) {
      return { data: null, error: new Error(error.message) };
    }

    return { data: true, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Failed to delete project file'),
    };
  }
}
