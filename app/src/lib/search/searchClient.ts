import { SupabaseClient } from '@supabase/supabase-js';

export interface SearchResultItem {
  id: string;
  projectId: string;
  projectTitle: string;
  matchField: string;
  preview: string;
  date: string | null;
  updatedAt: string;
}

export interface SearchQueryResult {
  data: SearchResultItem[] | null;
  error: Error | null;
}

/**
 * Searches current authenticated user's workspace records across:
 * - Project title
 * - Client name
 * - Project name
 * - Transcript text (projects.transcript and transcripts.raw_text)
 * - Output content (outputs.content and outputs.output_type)
 * - Project notes
 *
 * Rules:
 * - Search only current user records
 * - Respect RLS
 * - Never return deleted projects or deleted outputs
 * - Never return other users' records
 */
export async function searchMeetingHistory(
  supabase: SupabaseClient,
  query: string
): Promise<SearchQueryResult> {
  try {
    const trimmedQuery = query ? query.trim() : '';
    if (!trimmedQuery) {
      return { data: [], error: null };
    }

    const {
      data: { user },
      error: userErr
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    // Try PostgreSQL RPC function first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_meeting_history', {
        p_query: trimmedQuery
      });

      if (!rpcError && Array.isArray(rpcData)) {
        const mappedResults: SearchResultItem[] = rpcData.map((row: any, idx: number) => ({
          id: `${row.project_id}-${row.match_field}-${idx}`,
          projectId: row.project_id,
          projectTitle: row.project_title || 'Untitled Project',
          matchField: row.match_field || 'Match',
          preview: row.preview || '',
          date: row.meeting_date || row.updated_at,
          updatedAt: row.updated_at
        }));

        return { data: mappedResults, error: null };
      }
    } catch {
      // Fallback to direct client queries if RPC encounters any transient issue
    }

    // Direct client fallback queries adhering strictly to RLS:
    const qLower = trimmedQuery.toLowerCase();
    const results: SearchResultItem[] = [];

    // 1. Query user projects
    const { data: projects, error: projErr } = await supabase
      .from('projects')
      .select('id, title, client_name, project_name, client_or_project, meeting_date, transcript, notes, updated_at')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (projErr) {
      return { data: null, error: new Error(projErr.message || 'Search failed') };
    }

    if (projects) {
      for (const p of projects) {
        // Match Title
        if (p.title && p.title.toLowerCase().includes(qLower)) {
          results.push({
            id: `proj-title-${p.id}`,
            projectId: p.id,
            projectTitle: p.title,
            matchField: 'Project Title',
            preview: p.title,
            date: p.meeting_date || p.updated_at,
            updatedAt: p.updated_at
          });
        }

        // Match Client Name
        const cName = p.client_name || p.client_or_project;
        if (cName && cName.toLowerCase().includes(qLower)) {
          results.push({
            id: `proj-client-${p.id}`,
            projectId: p.id,
            projectTitle: p.title,
            matchField: 'Client Name',
            preview: cName,
            date: p.meeting_date || p.updated_at,
            updatedAt: p.updated_at
          });
        }

        // Match Project Name
        if (p.project_name && p.project_name.toLowerCase().includes(qLower)) {
          results.push({
            id: `proj-name-${p.id}`,
            projectId: p.id,
            projectTitle: p.title,
            matchField: 'Project Name',
            preview: p.project_name,
            date: p.meeting_date || p.updated_at,
            updatedAt: p.updated_at
          });
        }

        // Match Transcript
        if (p.transcript && p.transcript.toLowerCase().includes(qLower)) {
          const pos = p.transcript.toLowerCase().indexOf(qLower);
          const start = Math.max(0, pos - 40);
          const snippet = (start > 0 ? '...' : '') + p.transcript.slice(start, start + 160).trim() + '...';
          results.push({
            id: `proj-tr-${p.id}`,
            projectId: p.id,
            projectTitle: p.title,
            matchField: 'Transcript',
            preview: snippet,
            date: p.meeting_date || p.updated_at,
            updatedAt: p.updated_at
          });
        }

        // Match Notes
        if (p.notes && p.notes.toLowerCase().includes(qLower)) {
          const pos = p.notes.toLowerCase().indexOf(qLower);
          const start = Math.max(0, pos - 40);
          const snippet = (start > 0 ? '...' : '') + p.notes.slice(start, start + 160).trim() + '...';
          results.push({
            id: `proj-notes-${p.id}`,
            projectId: p.id,
            projectTitle: p.title,
            matchField: 'Notes',
            preview: snippet,
            date: p.meeting_date || p.updated_at,
            updatedAt: p.updated_at
          });
        }
      }
    }

    // 2. Query user outputs
    const { data: outputs, error: outErr } = await supabase
      .from('outputs')
      .select('id, project_id, output_type, content, updated_at, projects(id, title, deleted_at, meeting_date)')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (!outErr && outputs) {
      for (const o of outputs as any[]) {
        // Skip if parent project is deleted or missing
        if (!o.projects || o.projects.deleted_at !== null) continue;

        if (o.content && o.content.toLowerCase().includes(qLower)) {
          const pos = o.content.toLowerCase().indexOf(qLower);
          const start = Math.max(0, pos - 40);
          const snippet = (start > 0 ? '...' : '') + o.content.slice(start, start + 160).trim() + '...';
          results.push({
            id: `out-${o.id}`,
            projectId: o.project_id,
            projectTitle: o.projects.title || 'Untitled Project',
            matchField: `Output: ${o.output_type}`,
            preview: snippet,
            date: o.projects.meeting_date || o.updated_at,
            updatedAt: o.updated_at
          });
        }
      }
    }

    return { data: results, error: null };
  } catch (err: any) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Search failed')
    };
  }
}
