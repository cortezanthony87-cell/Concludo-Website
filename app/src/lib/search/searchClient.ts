import { SupabaseClient } from '@supabase/supabase-js';

export type SearchRecordType = 'Project' | 'Output' | 'Decision' | 'Action';

export interface SearchFilterOptions {
  typeFilter?: 'all' | 'projects' | 'outputs' | 'decisions' | 'actions';
  meetingType?: string;
  clientName?: string;
  projectName?: string;
  startDate?: string;
  endDate?: string;
  workspaceScope?: 'all' | 'personal' | 'team' | 'both';
  teamId?: string;
}

export interface SearchResultItem {
  id: string;
  projectId: string;
  recordId: string;
  projectTitle: string;
  recordType: SearchRecordType;
  matchField: string;
  preview: string;
  date: string | null;
  createdAt: string;
  updatedAt: string;
  relevanceScore: number;
}

export interface SearchQueryResult {
  data: SearchResultItem[] | null;
  error: Error | null;
}

/**
 * Searches current authenticated user's workspace records across:
 * - Project title, Project name, Client name, Meeting type, Notes, Transcript
 * - Saved outputs (content and output_type)
 * - Decision records (decision_title, decision_summary, decision_reasoning, decision_owner)
 * - Action records (action_title, action_description, owner_name, status)
 *
 * Supports Personal Workspace, Team Workspace, or Both.
 */
export async function searchMeetingHistory(
  supabase: SupabaseClient,
  query: string,
  filters?: SearchFilterOptions
): Promise<SearchQueryResult> {
  try {
    const trimmedQuery = query ? query.trim() : '';
    if (!trimmedQuery) {
      return { data: [], error: null };
    }

    const {
      data: { user },
      error: userErr,
    } = await supabase.auth.getUser();

    if (userErr || !user) {
      return { data: null, error: new Error('User session not found') };
    }

    const typeFilter = filters?.typeFilter || 'all';
    const workspaceScope = filters?.workspaceScope || 'all';

    // Try PostgreSQL RPC function first
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('search_meeting_history', {
        p_query: trimmedQuery,
        p_type_filter: typeFilter,
        p_meeting_type: filters?.meetingType || null,
        p_client_name: filters?.clientName || null,
        p_project_name: filters?.projectName || null,
        p_start_date: filters?.startDate || null,
        p_end_date: filters?.endDate || null,
        p_workspace_scope: workspaceScope,
        p_team_id: filters?.teamId || null,
      });

      if (!rpcError && Array.isArray(rpcData)) {
        const mappedResults: SearchResultItem[] = rpcData.map((row: any, idx: number) => ({
          id: `${row.project_id}-${row.record_id || idx}-${row.match_field}`,
          projectId: row.project_id,
          recordId: row.record_id || row.project_id,
          projectTitle: row.project_title || 'Untitled Project',
          recordType: (row.record_type as SearchRecordType) || 'Project',
          matchField: row.match_field || 'Match',
          preview: row.preview || '',
          date: row.meeting_date || row.updated_at,
          createdAt: row.created_at || row.updated_at,
          updatedAt: row.updated_at,
          relevanceScore: row.relevance_score || 50,
        }));

        return { data: mappedResults, error: null };
      }
    } catch {
      // Fallback to direct client queries if RPC encounters any issue
    }

    // Direct client fallback queries adhering strictly to RLS & retention
    const qLower = trimmedQuery.toLowerCase();
    const results: SearchResultItem[] = [];

    // Helper filter check
    const matchesMeta = (p: any) => {
      if (workspaceScope === 'personal' && p.ownership_type === 'team' && p.team_id) {
        return false;
      }
      if (workspaceScope === 'team' && p.ownership_type !== 'team') {
        return false;
      }
      if (filters?.teamId && p.team_id !== filters.teamId) {
        return false;
      }
      if (filters?.meetingType && (!p.meeting_type || !p.meeting_type.toLowerCase().includes(filters.meetingType.toLowerCase()))) {
        return false;
      }
      const client = p.client_name || p.client_or_project || '';
      if (filters?.clientName && !client.toLowerCase().includes(filters.clientName.toLowerCase())) {
        return false;
      }
      if (filters?.projectName && (!p.project_name || !p.project_name.toLowerCase().includes(filters.projectName.toLowerCase()))) {
        return false;
      }
      if (filters?.startDate && p.meeting_date && p.meeting_date < filters.startDate) {
        return false;
      }
      if (filters?.endDate && p.meeting_date && p.meeting_date > filters.endDate) {
        return false;
      }
      return true;
    };

    // 1. Projects search
    if (typeFilter === 'all' || typeFilter === 'projects') {
      const { data: projects, error: projErr } = await supabase
        .from('projects')
        .select('id, title, client_name, project_name, client_or_project, meeting_type, meeting_date, transcript, notes, created_at, updated_at, ownership_type, team_id')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (projErr) {
        return { data: null, error: new Error(projErr.message || 'Search failed') };
      }

      if (projects) {
        for (const p of projects) {
          if (!matchesMeta(p)) continue;

          let matched = false;
          let matchField = 'Project';
          let preview = p.title;
          let relevance = 50;

          if (p.title && p.title.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Project Title';
            preview = p.title;
            relevance = p.title.toLowerCase() === qLower ? 100 : 90;
          } else if (p.project_name && p.project_name.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Project Name';
            preview = p.project_name;
            relevance = 80;
          } else if ((p.client_name && p.client_name.toLowerCase().includes(qLower)) || (p.client_or_project && p.client_or_project.toLowerCase().includes(qLower))) {
            matched = true;
            matchField = 'Client Name';
            preview = p.client_name || p.client_or_project;
            relevance = 80;
          } else if (p.meeting_type && p.meeting_type.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Meeting Type';
            preview = p.meeting_type;
            relevance = 70;
          } else if (p.notes && p.notes.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Notes';
            const pos = p.notes.toLowerCase().indexOf(qLower);
            const start = Math.max(0, pos - 40);
            preview = (start > 0 ? '...' : '') + p.notes.slice(start, start + 160).trim() + '...';
            relevance = 55;
          } else if (p.transcript && p.transcript.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Transcript';
            const pos = p.transcript.toLowerCase().indexOf(qLower);
            const start = Math.max(0, pos - 40);
            preview = (start > 0 ? '...' : '') + p.transcript.slice(start, start + 160).trim() + '...';
            relevance = 50;
          }

          if (matched) {
            results.push({
              id: `proj-${p.id}`,
              projectId: p.id,
              recordId: p.id,
              projectTitle: p.title,
              recordType: 'Project',
              matchField,
              preview,
              date: p.meeting_date || p.updated_at,
              createdAt: p.created_at,
              updatedAt: p.updated_at,
              relevanceScore: relevance,
            });
          }
        }
      }
    }

    // 2. Outputs search
    if (typeFilter === 'all' || typeFilter === 'outputs') {
      const { data: outputs, error: outErr } = await supabase
        .from('outputs')
        .select('id, project_id, output_type, content, created_at, updated_at, projects(id, title, client_name, project_name, client_or_project, meeting_type, meeting_date, deleted_at, ownership_type, team_id)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (!outErr && outputs) {
        for (const o of outputs as any[]) {
          if (!o.projects || o.projects.deleted_at !== null) continue;
          if (!matchesMeta(o.projects)) continue;

          if (o.content && o.content.toLowerCase().includes(qLower)) {
            const pos = o.content.toLowerCase().indexOf(qLower);
            const start = Math.max(0, pos - 40);
            const snippet = (start > 0 ? '...' : '') + o.content.slice(start, start + 160).trim() + '...';
            results.push({
              id: `out-${o.id}`,
              projectId: o.project_id,
              recordId: o.id,
              projectTitle: o.projects.title || 'Untitled Project',
              recordType: 'Output',
              matchField: `Output: ${o.output_type}`,
              preview: snippet,
              date: o.projects.meeting_date || o.updated_at,
              createdAt: o.created_at,
              updatedAt: o.updated_at,
              relevanceScore: 65,
            });
          }
        }
      }
    }

    // 3. Decisions search
    if (typeFilter === 'all' || typeFilter === 'decisions') {
      const { data: decisions, error: decErr } = await supabase
        .from('decision_memory')
        .select('id, project_id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date, created_at, updated_at, projects(id, title, client_name, project_name, client_or_project, meeting_type, meeting_date, deleted_at, ownership_type, team_id)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (!decErr && decisions) {
        for (const d of decisions as any[]) {
          if (!d.projects || d.projects.deleted_at !== null) continue;
          if (!matchesMeta(d.projects)) continue;

          let matched = false;
          let matchField = 'Decision: Title';
          let preview = d.decision_title;
          let relevance = 70;

          if (d.decision_title && d.decision_title.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Decision: Title';
            preview = d.decision_title;
            relevance = d.decision_title.toLowerCase() === qLower ? 95 : 85;
          } else if (d.decision_owner && d.decision_owner.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Decision: Owner';
            preview = d.decision_owner;
            relevance = 80;
          } else if (d.decision_summary && d.decision_summary.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Decision: Summary';
            const pos = d.decision_summary.toLowerCase().indexOf(qLower);
            const start = Math.max(0, pos - 40);
            preview = (start > 0 ? '...' : '') + d.decision_summary.slice(start, start + 160).trim() + '...';
            relevance = 70;
          } else if (d.decision_reasoning && d.decision_reasoning.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Decision: Reasoning';
            const pos = d.decision_reasoning.toLowerCase().indexOf(qLower);
            const start = Math.max(0, pos - 40);
            preview = (start > 0 ? '...' : '') + d.decision_reasoning.slice(start, start + 160).trim() + '...';
            relevance = 65;
          }

          if (matched) {
            results.push({
              id: `dec-${d.id}`,
              projectId: d.project_id,
              recordId: d.id,
              projectTitle: d.projects.title || 'Untitled Project',
              recordType: 'Decision',
              matchField,
              preview,
              date: d.decision_date || d.projects.meeting_date || d.updated_at,
              createdAt: d.created_at,
              updatedAt: d.updated_at,
              relevanceScore: relevance,
            });
          }
        }
      }
    }

    // 4. Actions search
    if (typeFilter === 'all' || typeFilter === 'actions') {
      const { data: actions, error: actErr } = await supabase
        .from('action_tracker')
        .select('id, project_id, action_title, action_description, owner_name, assigned_user_name, due_date, status, created_at, updated_at, projects(id, title, client_name, project_name, client_or_project, meeting_type, meeting_date, deleted_at, ownership_type, team_id)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false });

      if (!actErr && actions) {
        for (const a of actions as any[]) {
          if (!a.projects || a.projects.deleted_at !== null) continue;
          if (!matchesMeta(a.projects)) continue;

          let matched = false;
          let matchField = 'Action: Title';
          let preview = a.action_title;
          let relevance = 70;

          if (a.action_title && a.action_title.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Action: Title';
            preview = a.action_title;
            relevance = a.action_title.toLowerCase() === qLower ? 95 : 85;
          } else if ((a.owner_name && a.owner_name.toLowerCase().includes(qLower)) || (a.assigned_user_name && a.assigned_user_name.toLowerCase().includes(qLower))) {
            matched = true;
            matchField = 'Action: Owner';
            preview = a.assigned_user_name || a.owner_name;
            relevance = 80;
          } else if (a.status && a.status.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Action: Status';
            preview = `Status: ${a.status}`;
            relevance = 75;
          } else if (a.action_description && a.action_description.toLowerCase().includes(qLower)) {
            matched = true;
            matchField = 'Action: Description';
            const pos = a.action_description.toLowerCase().indexOf(qLower);
            const start = Math.max(0, pos - 40);
            preview = (start > 0 ? '...' : '') + a.action_description.slice(start, start + 160).trim() + '...';
            relevance = 65;
          }

          if (matched) {
            results.push({
              id: `act-${a.id}`,
              projectId: a.project_id,
              recordId: a.id,
              projectTitle: a.projects.title || 'Untitled Project',
              recordType: 'Action',
              matchField,
              preview,
              date: a.due_date || a.projects.meeting_date || a.updated_at,
              createdAt: a.created_at,
              updatedAt: a.updated_at,
              relevanceScore: relevance,
            });
          }
        }
      }
    }

    // Sort combined results by relevance score DESC, then date DESC
    results.sort((a, b) => {
      if (b.relevanceScore !== a.relevanceScore) {
        return b.relevanceScore - a.relevanceScore;
      }
      const timeA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const timeB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return timeB - timeA;
    });

    return { data: results, error: null };
  } catch (err: any) {
    return { data: null, error: err instanceof Error ? err : new Error('Search failed') };
  }
}
