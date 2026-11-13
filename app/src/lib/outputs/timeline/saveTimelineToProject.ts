import { SupabaseClient } from '@supabase/supabase-js';
import { createProjectFile } from '../../projects/projectFilesClient';
import { buildTimelineFileName } from './timelineData';
import { TimelinePayload, TimelineSaveResult } from './types';

export async function logTimelineExportEvent(
  supabase: SupabaseClient,
  params: {
    userId: string;
    projectIdOrView: string;
    actionCount: number;
    slideCount: number;
    method: 'download' | 'save';
    outcome: 'success' | 'failure';
    errorMessage?: string;
  }
): Promise<void> {
  try {
    await supabase.from('audit_logs').insert({
      user_id: params.userId,
      action: `timeline_export_${params.method}`,
      resource_type: 'action_timeline',
      resource_id: params.projectIdOrView,
      details: {
        action_count: params.actionCount,
        slide_count: params.slideCount,
        method: params.method,
        outcome: params.outcome,
        error: params.errorMessage || null,
      },
    });
  } catch (err) {
    // Logging failure must not crash the export operation
    console.warn('[Timeline] Failed to insert audit log:', err);
  }
}

/**
 * Saves the generated Action Timeline PowerPoint presentation directly to a project's
 * persistent Project File Storage, and conditionally records an outputs row.
 */
export async function saveTimelineToProject(
  supabase: SupabaseClient,
  projectId: string,
  payload: TimelinePayload,
  blob: Blob,
  slideCount: number
): Promise<TimelineSaveResult> {
  try {
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return {
        success: false,
        fileName: '',
        error: 'User must be authenticated to save timeline to project.',
      };
    }

    const fileName = buildTimelineFileName(payload.project, payload.exportedOn);
    const timestamp = Date.now();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${user.id}/${projectId}/${timestamp}_${cleanFileName}`;

    // 1. Upload binary file to Supabase Storage 'project-files' bucket
    const { error: uploadErr } = await supabase.storage
      .from('project-files')
      .upload(storagePath, blob, {
        contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        cacheControl: '3600',
        upsert: false,
      });

    if (uploadErr) {
      await logTimelineExportEvent(supabase, {
        userId: user.id,
        projectIdOrView: projectId,
        actionCount: payload.actions.length,
        slideCount,
        method: 'save',
        outcome: 'failure',
        errorMessage: uploadErr.message,
      });
      return {
        success: false,
        fileName,
        error: `Storage upload failed: ${uploadErr.message}`,
      };
    }

    // 2. Insert record into public.project_files table
    const { data: fileRec, error: fileErr } = await createProjectFile(supabase, {
      project_id: projectId,
      name: fileName,
      file_type: 'presentation',
      mime_type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      file_size_bytes: blob.size,
      source: 'manual_creation',
      storage_path: storagePath,
      description: `Action Timeline PowerPoint (${payload.actions.length} actions, ${slideCount} slides)`,
      version: 1,
    });

    if (fileErr || !fileRec) {
      // Clean up orphaned storage object to maintain consistency
      try {
        await supabase.storage.from('project-files').remove([storagePath]);
      } catch {}

      await logTimelineExportEvent(supabase, {
        userId: user.id,
        projectIdOrView: projectId,
        actionCount: payload.actions.length,
        slideCount,
        method: 'save',
        outcome: 'failure',
        errorMessage: fileErr?.message || 'Database file record creation failed',
      });
      return {
        success: false,
        fileName,
        error: `Project file record failed: ${fileErr?.message || 'Could not write project file metadata'}`,
      };
    }

    // 3. Attempt to insert into public.outputs row of type 'action_timeline' if supported
    let outputRowCreated = false;
    let outputRowSkippedReason: string | null = null;
    try {
      const { error: outErr } = await supabase.from('outputs').insert({
        project_id: projectId,
        user_id: user.id,
        output_type: 'action_timeline',
        content: `Action Timeline PowerPoint (${payload.actions.length} actions, ${slideCount} slides)`,
        json_content: {
          action_count: payload.actions.length,
          slide_count: slideCount,
          exported_on: payload.exportedOn,
          timezone: payload.timezone,
          file_name: fileName,
          storage_path: storagePath,
        },
      });

      if (outErr) {
        outputRowSkippedReason = `Outputs row not written: ${outErr.message}`;
      } else {
        outputRowCreated = true;
      }
    } catch (err: any) {
      outputRowSkippedReason = `Outputs row not supported: ${err?.message || 'Schema check constraint'}`;
    }

    // Log success audit event
    await logTimelineExportEvent(supabase, {
      userId: user.id,
      projectIdOrView: projectId,
      actionCount: payload.actions.length,
      slideCount,
      method: 'save',
      outcome: 'success',
    });

    return {
      success: true,
      fileName,
      storagePath,
      projectFileId: fileRec.id,
      outputRowCreated,
      outputRowSkippedReason,
      blob,
    };
  } catch (err: any) {
    return {
      success: false,
      fileName: '',
      error: err instanceof Error ? err.message : 'Failed to save timeline to project',
    };
  }
}
