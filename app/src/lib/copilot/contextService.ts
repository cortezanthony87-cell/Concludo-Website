import type { SupabaseClient } from '@supabase/supabase-js';
import type { CopilotQueryType } from './types';
import type {
  RawAction,
  RawApproval,
  RawBundle,
  RawDecision,
  RawExecution,
  RawFile,
  RawIncident,
  RawMemory,
  RawOutput,
  RawProject,
} from './evidence';

/**
 * Context retrieval. Two short parallel rounds replace the old 19 sequential and parallel queries.
 *
 *  Round 1 (names): project rows and the agent memory that holds consent, listing and owed-to-client.
 *  Round 2 (records): only the tables the question needs, filtered to the resolved project ids and period.
 *
 * Authorisation is not re-implemented here. The browser client runs under the user's session, so row
 * level security (owner, team membership, paid project scope) decides what comes back. Nothing in
 * this file uses a service key.
 */

export const LIMITS = {
  projects: 500,
  decisions: 500,
  actions: 500,
  outputs: 200,
  files: 100,
  workflow: 50,
} as const;

const MEMORY_AGENTS = ['consent_check', 'vendor_campaign_update', 'client_commitments'];

export interface Round1 {
  projects: RawProject[];
  memory: RawMemory[];
  truncated: string[];
  failed: string[];
}

export interface Round2Request {
  intent: CopilotQueryType;
  projectIds: string[] | null; // null = workspace-wide
  period: { from: string; to: string } | null;
  needOutputs: boolean;
  needFiles: boolean;
  needWorkflow: boolean;
}

type Res<T> = { data: T[] | null; error: any };

async function guarded<T>(name: string, p: PromiseLike<Res<T>>, limit: number, trunc: string[], failed: string[]): Promise<T[]> {
  try {
    const { data, error } = await p;
    if (error) {
      failed.push(name);
      return [];
    }
    const rows = data || [];
    if (rows.length >= limit) trunc.push(name);
    return rows;
  } catch {
    failed.push(name);
    return [];
  }
}

export async function fetchRound1(supabase: SupabaseClient): Promise<Round1> {
  const truncated: string[] = [];
  const failed: string[] = [];
  const [projects, memory] = await Promise.all([
    guarded<RawProject>(
      'projects',
      supabase
        .from('projects')
        .select('id, title, client_name, project_name, meeting_date, created_at, team_id')
        .is('deleted_at', null)
        .order('meeting_date', { ascending: false })
        .limit(LIMITS.projects) as any,
      LIMITS.projects,
      truncated,
      failed
    ),
    guarded<RawMemory>(
      'agent_memory',
      supabase
        .from('agent_memory')
        .select('agent_type, memory_key, memory_value')
        .in('agent_type', MEMORY_AGENTS)
        .is('deleted_at', null)
        .limit(2000) as any,
      2000,
      truncated,
      failed
    ),
  ]);
  return { projects, memory, truncated, failed };
}

export async function fetchRound2(supabase: SupabaseClient, r1: Round1, req: Round2Request): Promise<RawBundle> {
  const truncated = [...r1.truncated];
  const failed = [...r1.failed];
  const ids = req.projectIds;
  const per = req.period;

  // A scoped question with no matching project ids has nothing to fetch: say so, do not widen to the workspace.
  const scopedButEmpty = ids !== null && ids.length === 0;

  let decisionsQ: any = supabase
    .from('decision_memory')
    .select('id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date, project_id, source_output_id, created_at')
    .is('deleted_at', null);
  let actionsQ: any = supabase
    .from('action_tracker')
    .select('id, action_title, action_description, owner_name, due_date, status, project_id, source_output_id, created_at, updated_at')
    .is('deleted_at', null);
  if (ids) {
    decisionsQ = decisionsQ.in('project_id', ids);
    actionsQ = actionsQ.in('project_id', ids);
  }
  if (!ids && per) {
    decisionsQ = decisionsQ.gte('decision_date', per.from).lte('decision_date', per.to);
  }
  decisionsQ = decisionsQ.order('decision_date', { ascending: false }).limit(LIMITS.decisions);
  actionsQ = actionsQ.order('due_date', { ascending: true }).limit(LIMITS.actions);

  const outputIds = ids ? ids.slice(0, 200) : r1.projects.slice(0, 40).map((p) => p.id);
  const outputsQ: any = req.needOutputs && outputIds.length
    ? supabase
        .from('outputs')
        .select('id, project_id, created_at, risks:json_content->risks, executiveSummary:json_content->>executiveSummary, summary:json_content->>summary')
        .in('project_id', outputIds)
        .is('deleted_at', null)
        .limit(LIMITS.outputs)
    : null;

  const filesQ: any = req.needFiles && ids && ids.length
    ? supabase
        .from('project_files')
        .select('id, project_id, name, file_type, version, created_at')
        .in('project_id', ids)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(LIMITS.files)
    : null;

  const wf = req.needWorkflow;
  const approvalsQ: any = wf
    ? supabase
        .from('workflow_approvals')
        .select('id, status, action_type, action_payload, created_at, consumed_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(LIMITS.workflow)
    : null;
  const execQ: any = wf
    ? supabase
        .from('workflow_executions')
        .select('id, workflow_id, status, error_message, created_at')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(LIMITS.workflow)
    : null;
  const incQ: any = wf
    ? supabase
        .from('workflow_incidents')
        .select('id, workflow_id, severity, status, step_key, error_message, customer_safe_explanation, created_at')
        .order('created_at', { ascending: false })
        .limit(LIMITS.workflow)
    : null;

  const none = <T,>(): Promise<T[]> => Promise.resolve([]);
  const [decisions, actions, outputsRaw, files, approvals, executions, incidents] = await Promise.all([
    scopedButEmpty ? none<RawDecision>() : guarded<RawDecision>('decision_memory', decisionsQ, LIMITS.decisions, truncated, failed),
    scopedButEmpty ? none<RawAction>() : guarded<RawAction>('action_tracker', actionsQ, LIMITS.actions, truncated, failed),
    outputsQ ? guarded<any>('outputs', outputsQ, LIMITS.outputs, truncated, failed) : none<any>(),
    filesQ ? guarded<RawFile>('project_files', filesQ, LIMITS.files, truncated, failed) : none<RawFile>(),
    approvalsQ ? guarded<RawApproval>('workflow_approvals', approvalsQ, LIMITS.workflow, truncated, failed) : none<RawApproval>(),
    execQ ? guarded<RawExecution>('workflow_executions', execQ, LIMITS.workflow, truncated, failed) : none<RawExecution>(),
    incQ ? guarded<RawIncident>('workflow_incidents', incQ, LIMITS.workflow, truncated, failed) : none<RawIncident>(),
  ]);

  const outputs: RawOutput[] = (outputsRaw as any[]).map((o) => ({
    id: o.id,
    project_id: o.project_id,
    created_at: o.created_at,
    json_content: {
      risks: o.risks ?? o.json_content?.risks,
      executiveSummary: o.executiveSummary ?? o.json_content?.executiveSummary,
      summary: o.summary ?? o.json_content?.summary,
    },
  }));

  return {
    projects: r1.projects,
    memory: r1.memory,
    outputs,
    decisions,
    actions,
    files,
    approvals,
    executions,
    incidents,
    truncated: Array.from(new Set(truncated)),
    failed: Array.from(new Set(failed)),
  };
}

/* ---------------------------------------------------------------- DOCUMENT */

export const DOC_TEXT_LIMIT = 40000;

export interface DocumentContent {
  id: string;
  projectId: string;
  name: string;
  version: number | string | null;
  createdAt: string | null;
  text: string | null;
  textTruncated: boolean;
  reason?: 'no_text' | 'not_found';
}

/**
 * Read one document the user selected. Access is whatever row level security on project_files allows.
 * The text is untrusted input: it is only ever searched and quoted, never obeyed.
 */
export async function fetchDocument(supabase: SupabaseClient, documentId: string): Promise<DocumentContent | null> {
  try {
    const { data, error } = await (supabase
      .from('project_files')
      .select('id, project_id, name, version, created_at, content')
      .eq('id', documentId)
      .is('deleted_at', null)
      .maybeSingle() as any);
    if (error || !data) return null;
    const text = typeof data.content === 'string' && data.content.trim() ? String(data.content) : null;
    return {
      id: data.id,
      projectId: data.project_id,
      name: data.name || 'Untitled file',
      version: data.version ?? null,
      createdAt: data.created_at || null,
      text: text ? text.slice(0, DOC_TEXT_LIMIT) : null,
      textTruncated: !!text && text.length > DOC_TEXT_LIMIT,
      reason: text ? undefined : 'no_text',
    };
  } catch {
    return null;
  }
}
