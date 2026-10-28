import type {
  Store,
  Workflow,
  Run,
  Approval,
  Incident,
  AuditEvent,
  AppKey,
  ConnectionState,
  OutgoingItem,
} from './automationCore';
import { pickStoredSteps, stepsFromStored, triggerFromStored, appInfo } from './automationCore';
import type { WorkspaceData, ConsentBasis } from './agentsCore';
import { getSupabaseBrowserClient, getSupabaseEnv } from '../supabase/client';

export class SupabaseAutomationStore implements Store {
  private userId: string;
  private organizationId: string | null;
  private actorName: string;

  constructor(opts: { userId: string; organizationId?: string | null; actorName: string }) {
    this.userId = opts.userId;
    this.organizationId = opts.organizationId || null;
    this.actorName = opts.actorName || 'User';
  }

  now(): string {
    return new Date().toISOString();
  }

  id(prefix: string): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  private client() {
    return getSupabaseBrowserClient();
  }

  /* ========================================================== WORKFLOWS */
  async getWorkflow(id: string): Promise<Workflow | null> {
    const { data, error } = await this.client()
      .from('workflows')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToWorkflow(data);
  }

  async listWorkflows(): Promise<Workflow[]> {
    const { data, error } = await this.client()
      .from('workflows')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) return [];
    return data.map((row) => this.mapRowToWorkflow(row));
  }

  async saveWorkflow(w: Workflow): Promise<void> {
    const supabase = this.client();
    const { data: existing } = await supabase
      .from('workflows')
      .select('id')
      .eq('id', w.id)
      .maybeSingle();

    const isActive = w.status === 'active';
    const dbStatus = w.status === 'active' ? 'published' : (w.status === 'draft' ? 'draft' : 'paused');
    const row = {
      id: w.id,
      name: w.name,
      description: w.description || `Workflow managed by Automation v2.1. Trigger: ${w.trigger.type}`,
      trigger_type: w.trigger.type,
      trigger_config: {
        trigger: w.trigger,
        status: w.status,
        pausedBy: w.pausedBy,
        consecutiveFailures: w.consecutiveFailures || 0,
      },
      actions: w.steps,
      execution_type: 'approval_required',
      is_active: isActive,
      status: dbStatus,
      is_emergency_stopped: Boolean(w.pausedBy === 'workspace_stop'),
      updated_at: w.updatedAt || this.now(),
      owner_id: w.ownerId || this.userId,
      ...(this.organizationId ? { organization_id: this.organizationId } : {}),
    };

    if (existing) {
      const { error } = await supabase.from('workflows').update(row).eq('id', w.id);
      if (error) console.error('Failed to update workflow:', error);
    } else {
      const { error } = await supabase.from('workflows').insert({
        ...row,
        created_at: w.createdAt || this.now(),
      });
      if (error) console.error('Failed to insert workflow:', error);
    }
  }

  async deleteWorkflow(id: string): Promise<void> {
    const { error } = await this.client()
      .from('workflows')
      .update({
        deleted_at: this.now(),
        deleted_by: this.userId,
        is_active: false,
      })
      .eq('id', id);
    if (error) {
      console.error('Failed to delete workflow:', error);
      throw new Error(error.message || 'Failed to delete workflow');
    }
  }

  private mapRowToWorkflow(row: any): Workflow {
    const tc = row.trigger_config || {};
    const trigger = triggerFromStored(row.trigger_type, tc);
    const steps = stepsFromStored(pickStoredSteps(row), (i) => `${row.id || 'step'}-${i + 1}`);

    return {
      id: row.id,
      name: row.name || 'Untitled workflow',
      description: row.description || '',
      ownerId: row.owner_id || this.userId,
      teamId: row.team_id || null,
      status: row.is_active ? 'active' : (tc.status || 'paused'),
      pausedBy: tc.pausedBy || null,
      consecutiveFailures: tc.consecutiveFailures || 0,
      trigger,
      steps,
      createdAt: row.created_at || this.now(),
      updatedAt: row.updated_at || this.now(),
    };
  }

  /* ============================================================== RUNS */
  async getRun(id: string): Promise<Run | null> {
    const { data, error } = await this.client()
      .from('workflow_executions')
      .select('*, workflows(name)')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToRun(data);
  }

  async listRuns(): Promise<Run[]> {
    const { data, error } = await this.client()
      .from('workflow_executions')
      .select('*, workflows(name)')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];
    return data.map((row) => this.mapRowToRun(row));
  }

  async saveRun(r: Run): Promise<void> {
    const supabase = this.client();
    const { data: existing } = await supabase
      .from('workflow_executions')
      .select('id')
      .eq('id', r.id)
      .maybeSingle();

    const row = {
      id: r.id,
      workflow_id: r.workflowId,
      triggered_by: this.userId,
      status: r.status,
      trigger_data: {
        input: r.input,
        workflowName: r.workflowName,
        startedBy: r.startedBy,
        approvalId: r.approvalId,
        retryOf: r.retryOf,
        test: r.test,
      },
      steps_completed: r.steps,
      error_message: r.error || null,
      updated_at: r.finishedAt || this.now(),
    };

    if (existing) {
      const { error } = await supabase.from('workflow_executions').update(row).eq('id', r.id);
      if (error) console.error('Failed to update execution:', error);
    } else {
      const { error } = await supabase.from('workflow_executions').insert({
        ...row,
        created_at: r.startedAt || this.now(),
      });
      if (error) console.error('Failed to insert execution:', error);
    }
  }

  private mapRowToRun(row: any): Run {
    const td = row.trigger_data || {};
    const wfName = td.workflowName || row.workflows?.name || 'Workflow';
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: wfName,
      startedAt: row.created_at,
      finishedAt: row.updated_at,
      startedBy: td.startedBy || 'User',
      status: row.status as any,
      steps: Array.isArray(row.steps_completed) ? row.steps_completed : [],
      input: td.input || {},
      approvalId: td.approvalId,
      retryOf: td.retryOf,
      error: row.error_message || undefined,
      test: Boolean(td.test),
    };
  }

  /* ========================================================= APPROVALS */
  async getApproval(id: string): Promise<Approval | null> {
    const { data, error } = await this.client()
      .from('workflow_approvals')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !data) return null;
    return this.mapRowToApproval(data);
  }

  async listApprovals(): Promise<Approval[]> {
    const { data, error } = await this.client()
      .from('workflow_approvals')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];
    return data.map((row) => this.mapRowToApproval(row));
  }

  async saveApproval(a: Approval): Promise<void> {
    const supabase = this.client();
    const { data: existing } = await supabase
      .from('workflow_approvals')
      .select('id')
      .eq('id', a.id)
      .maybeSingle();

    const row = {
      id: a.id,
      workflow_id: a.workflowId || null,
      execution_id: a.runId || null,
      requester_id: this.userId,
      status: a.status,
      action_type: a.kind === 'agent_draft' ? 'agent_draft' : 'external_dispatch',
      action_payload: {
        title: a.title,
        kind: a.kind,
        source: a.source,
        requestedBy: a.requestedBy,
        requestedAt: a.requestedAt,
        outgoing: a.outgoing,
      },
      notes: a.note || null,
      approved_at: a.status === 'approved' ? (a.decidedAt || this.now()) : null,
      rejected_at: a.status === 'rejected' ? (a.decidedAt || this.now()) : null,
    };

    if (existing) {
      const { error } = await supabase.from('workflow_approvals').update(row).eq('id', a.id);
      if (error) console.error('Failed to update approval:', error);
    } else {
      const { error } = await supabase.from('workflow_approvals').insert({
        ...row,
        created_at: a.requestedAt || this.now(),
      });
      if (error) console.error('Failed to insert approval:', error);
    }
  }

  private mapRowToApproval(row: any): Approval {
    const payload = row.action_payload || {};
    return {
      id: row.id,
      workflowId: row.workflow_id,
      runId: row.execution_id,
      title: payload.title || row.action_type || 'Approval request',
      kind: payload.kind || (row.action_type === 'agent_draft' ? 'agent_draft' : 'workflow_step'),
      source: payload.source || 'Workflow execution',
      requestedAt: payload.requestedAt || row.created_at,
      requestedBy: payload.requestedBy || 'User',
      status: row.status as any,
      decidedAt: row.approved_at || row.rejected_at || undefined,
      decidedBy: (row.approved_at || row.rejected_at) ? this.actorName : undefined,
      note: row.notes || undefined,
      outgoing: Array.isArray(payload.outgoing) ? payload.outgoing : [],
    };
  }

  /* ========================================================= INCIDENTS */
  async listIncidents(): Promise<Incident[]> {
    const { data, error } = await this.client()
      .from('workflow_incidents')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      workflowId: row.workflow_id,
      runId: row.execution_id || row.run_id || '',
      stepLabel: row.step_key || 'Step execution',
      severity: (row.severity as any) || 'high',
      status: (row.status as any) || 'open',
      createdAt: row.created_at,
      message: row.error_message || row.customer_safe_explanation || 'Step failed',
      resolvedBy: row.resolved_by ? this.actorName : undefined,
      resolution: row.resolution_notes || undefined,
    }));
  }

  async saveIncident(i: Incident): Promise<void> {
    const supabase = this.client();
    const { data: existing } = await supabase
      .from('workflow_incidents')
      .select('id')
      .eq('id', i.id)
      .maybeSingle();

    const row = {
      id: i.id,
      workflow_id: i.workflowId,
      execution_id: i.runId,
      step_key: i.stepLabel,
      severity: i.severity,
      status: i.status,
      error_message: i.message,
      customer_safe_explanation: i.message,
      created_at: i.createdAt || this.now(),
      resolved_at: i.status === 'resolved' ? this.now() : null,
      resolution_notes: i.resolution || null,
      ...(this.organizationId ? { organization_id: this.organizationId } : {}),
    };

    if (existing) {
      const { error } = await supabase.from('workflow_incidents').update(row).eq('id', i.id);
      if (error) console.error('Failed to update incident:', error);
    } else {
      const { error } = await supabase.from('workflow_incidents').insert(row);
      if (error) console.error('Failed to insert incident:', error);
    }
  }

  /* ============================================================= AUDIT */
  async listAudit(): Promise<AuditEvent[]> {
    const { data, error } = await this.client()
      .from('audit_logs')
      .select('*')
      .in('entity_type', ['workflow', 'workflow_execution', 'agent', 'governance', 'workflow_approval'])
      .order('created_at', { ascending: false })
      .limit(60);

    if (error || !data) return [];
    return data.map((row) => ({
      id: row.id,
      at: row.created_at,
      actor: row.details?.actor || this.actorName,
      event: (row.action as any) || 'record_updated',
      objectType: (row.entity_type as any) || 'workflow',
      objectId: row.entity_id || '',
      detail: row.details?.detail || row.details?.message || row.action,
    }));
  }

  async appendAudit(e: AuditEvent): Promise<void> {
    const { error } = await this.client()
      .from('audit_logs')
      .insert({
        id: e.id,
        user_id: this.userId,
        action: e.event,
        entity_type: e.objectType,
        entity_id: e.objectId,
        details: {
          actor: e.actor || this.actorName,
          detail: e.detail,
          at: e.at,
        },
        created_at: e.at || this.now(),
        ...(this.organizationId ? { organization_id: this.organizationId } : {}),
      });

    if (error) console.error('Failed to append audit log:', error);
  }

  /* ======================================================= CONNECTIONS */
  async connection(app: AppKey): Promise<ConnectionState> {
    if (app === 'concludo') return 'connected';
    try {
      const { data } = await this.client()
        .from('integration_connections')
        .select('status')
        .eq('provider_id', this.providerId(app))
        .eq('user_id', this.userId)
        .is('deleted_at', null)
        .maybeSingle();

      if (!data) return 'disconnected';
      if (data.status === 'active' || data.status === 'connected') return 'connected';
      if (data.status === 'needs_reauth') return 'needs_reauth';
      if (data.status === 'permission_required') return 'permission_required';
      return 'disconnected';
    } catch {
      return 'disconnected';
    }
  }

  private providerId(app: AppKey): string {
    const map: Partial<Record<AppKey, string>> = {
      outlook: 'microsoft_outlook',
      teams: 'microsoft_teams',
    };
    return map[app] || app;
  }

  /** A real read-only check. Never sends, creates or changes anything in the app, and never logs a token. */
  async probe(app: AppKey): Promise<{ state: ConnectionState; verified: boolean; detail: string }> {
    if (app === 'concludo' || !appInfo(app).external) {
      return { state: 'connected', verified: true, detail: 'Inside Concludo.' };
    }
    const label = appInfo(app).label;
    try {
      const { data, error } = await this.client()
        .from('integration_connections')
        .select('id, status')
        .eq('provider_id', this.providerId(app))
        .eq('user_id', this.userId)
        .is('deleted_at', null)
        .maybeSingle();
      if (error) return { state: 'service_issue', verified: false, detail: `The check could not read whether ${label} is connected.` };
      if (!data || data.status === 'disconnected') return { state: 'disconnected', verified: true, detail: `No connection is saved for ${label}.` };
      if (data.status === 'needs_reauth' || data.status === 'reauth_required') {
        return { state: 'needs_reauth', verified: true, detail: `The saved sign-in for ${label} has lapsed.` };
      }
      if (data.status === 'permission_required') {
        return { state: 'permission_required', verified: true, detail: `${label} is missing a permission.` };
      }
      const { data: tested, error: testErr } = await this.client().functions.invoke('connection-test', {
        body: { connection_id: data.id },
      });
      if (testErr) {
        const msg = String(testErr.message || '');
        if (/timeout|timed out|429|rate|503|502|500/i.test(msg)) {
          return { state: 'service_issue', verified: true, detail: `${label} did not answer.` };
        }
        return { state: 'service_issue', verified: false, detail: `The check itself failed for ${label}. The real state is not known.` };
      }
      const status = String(tested?.status || '');
      const err = String(tested?.error || tested?.status_reason || '');
      if (tested?.success === true || status === 'connected') {
        return { state: 'connected', verified: true, detail: `A live check confirmed ${label} just now.` };
      }
      if (status === 'reauth_required' || status === 'needs_reauth' || /401|unauthor/i.test(err)) {
        return { state: 'needs_reauth', verified: true, detail: `The sign-in for ${label} has lapsed.` };
      }
      if (/403|permission|scope|insufficient/i.test(`${status} ${err}`)) {
        return { state: 'permission_required', verified: true, detail: `${label} is missing a permission.` };
      }
      if (/429|5\d\d|timeout|unavailable|rate/i.test(`${status} ${err}`)) {
        return { state: 'service_issue', verified: true, detail: `${label} did not answer.` };
      }
      return { state: 'disconnected', verified: true, detail: `The live check did not confirm ${label}.` };
    } catch {
      return { state: 'service_issue', verified: false, detail: `The check itself failed for ${label}. The real state is not known.` };
    }
  }

  async startConnect(app: AppKey): Promise<{ ok: boolean; needsPerson: boolean; note: string }> {
    const label = appInfo(app).label;
    return {
      ok: false,
      needsPerson: true,
      note: `${label} has to be signed in by a person. Concludo cannot sign in for you.`,
    };
  }

  /* ========================================================== DISPATCH */
  async dispatch(item: OutgoingItem, run: Run): Promise<{ ok: boolean; note: string }> {
    // 1. Truthful connection check
    const c = await this.connection(item.app);
    if (c !== 'connected') {
      return {
        ok: false,
        note: `${item.app} is not connected or requires re-authentication. Nothing was sent.`,
      };
    }

    // 2. Mandatory Gate: Live sending is disabled in internal Workspace.
    // Record the item in execution audit log honestly without external network dispatch.
    await this.appendAudit({
      id: this.id('aud'),
      at: this.now(),
      actor: this.actorName,
      event: 'action_succeeded',
      objectType: 'run',
      objectId: run.id,
      detail: `Staged ${item.what} to ${item.to} via ${item.app}. (Live sending disabled in internal workspace)`,
    });

    return {
      ok: true,
      note: `Dispatched ${item.what} to ${item.to}. (Internal workspace mode)`,
    };
  }
}

/* ================================================= LOAD WORKSPACE DATA */
export async function loadWorkspaceData(opts: {
  userId: string;
  actorName: string;
}): Promise<WorkspaceData> {
  const supabase = getSupabaseBrowserClient();
  const today = new Date().toISOString().slice(0, 10);

  // 1. Projects (Meetings)
  const { data: projectsData } = await supabase
    .from('projects')
    .select('id, title, meeting_date, client_name, project_name')
    .is('deleted_at', null)
    .order('meeting_date', { ascending: false })
    .limit(20);

  // 2. Outputs for summary and risks
  const projectIds = (projectsData || []).map((p) => p.id);
  const { data: outputsData } = projectIds.length
    ? await supabase
        .from('outputs')
        .select('project_id, json_content, content')
        .in('project_id', projectIds)
        .is('deleted_at', null)
    : { data: [] };

  // 3. Actions
  const { data: actionsData } = await supabase
    .from('action_tracker')
    .select('id, action_title, owner_name, due_date, status, project_id, updated_at')
    .is('deleted_at', null)
    .order('due_date', { ascending: true })
    .limit(100);

  // 4. Decisions
  const { data: decisionsData } = await supabase
    .from('decision_memory')
    .select('id, decision_title, decision_owner, decision_date, decision_summary, project_id')
    .is('deleted_at', null)
    .order('decision_date', { ascending: false })
    .limit(50);

  // 5. Agent memory for extra facts: consent, listing, owedTo
  const { data: memoryData } = await supabase
    .from('agent_memory')
    .select('agent_type, memory_key, memory_value')
    .is('deleted_at', null);

  const consentMap = new Map<string, ConsentBasis>();
  const listingMap = new Map<string, { listing: string; vendor?: string }>();
  const owedToMap = new Map<string, string>();

  (memoryData || []).forEach((row) => {
    if (row.agent_type === 'consent_check' && row.memory_key.startsWith('meeting:')) {
      const pid = row.memory_key.replace('meeting:', '');
      consentMap.set(pid, row.memory_value?.basis as ConsentBasis);
    } else if (row.agent_type === 'vendor_campaign_update' && row.memory_key.startsWith('meeting:')) {
      const pid = row.memory_key.replace('meeting:', '');
      listingMap.set(pid, row.memory_value || {});
    } else if (row.agent_type === 'client_commitments' && row.memory_key.startsWith('action:')) {
      const aid = row.memory_key.replace('action:', '');
      owedToMap.set(aid, row.memory_value?.owedTo || '');
    }
  });

  // Map meetings
  const meetings = (projectsData || []).map((p) => {
    const out = (outputsData || []).find((o) => o.project_id === p.id);
    const jc = out?.json_content || {};
    const attendees = Array.isArray(jc.attendees) ? jc.attendees : [];
    const summary = jc.executiveSummary || jc.summary || out?.content?.slice(0, 250);
    const mDecisions = (decisionsData || []).filter((d) => d.project_id === p.id).map((d) => d.id);
    const mActions = (actionsData || []).filter((a) => a.project_id === p.id).map((a) => a.id);
    const mRisks = Array.isArray(jc.risks) ? jc.risks.map((r: any) => r.id || r.title) : [];

    const listInfo = listingMap.get(p.id);

    return {
      id: p.id,
      title: p.title || 'Untitled Meeting',
      date: p.meeting_date || today,
      project: p.project_name || p.title || 'Project',
      attendees,
      summary,
      decisionIds: mDecisions,
      actionIds: mActions,
      riskIds: mRisks,
      consent: consentMap.get(p.id) || undefined,
      client: p.client_name || undefined,
      listing: listInfo?.listing,
      vendor: listInfo?.vendor,
    };
  });

  // Map actions
  const actions = (actionsData || []).map((a) => {
    const proj = (projectsData || []).find((p) => p.id === a.project_id);
    const rawStatus = a.status || 'not_started';
    const validStatus = ['not_started', 'in_progress', 'completed', 'blocked', 'overdue'].includes(rawStatus)
      ? (rawStatus as 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'overdue')
      : 'not_started';

    return {
      id: a.id,
      action_title: a.action_title || 'Untitled action',
      owner_name: a.owner_name || null,
      due_date: a.due_date || null,
      status: validStatus,
      project: proj ? (proj.project_name || proj.title) : 'General',
      completed_on: a.status === 'completed' ? (a.updated_at ? a.updated_at.slice(0, 10) : today) : null,
      owedTo: owedToMap.get(a.id) || null,
    };
  });

  // Map decisions
  const decisions = (decisionsData || []).map((d) => {
    const proj = (projectsData || []).find((p) => p.id === d.project_id);
    return {
      id: d.id,
      decision_title: d.decision_title || 'Untitled decision',
      decision_date: d.decision_date || today,
      project: proj ? (proj.project_name || proj.title) : 'General',
    };
  });

  // Map risks from meeting output json
  const risks: Array<{ id: string; text: string; rating: 'high' | 'medium' | 'low'; project: string; response?: string | null }> = [];
  (outputsData || []).forEach((out) => {
    const proj = (projectsData || []).find((p) => p.id === out.project_id);
    const jc = out.json_content || {};
    if (Array.isArray(jc.risks)) {
      jc.risks.forEach((r: any, idx: number) => {
        risks.push({
          id: r.id || `${out.project_id}_risk_${idx}`,
          text: r.text || r.title || r.name || 'Identified Risk',
          rating: (r.rating || r.severity || 'medium') as 'high' | 'medium' | 'low',
          project: proj ? (proj.project_name || proj.title) : 'General',
          response: r.response || r.mitigation || null,
        });
      });
    }
  });

  return {
    today,
    me: opts.actorName,
    meetings,
    actions,
    decisions,
    risks,
  };
}

/* ================================================= APPLY FIX IN SUPABASE */
export async function applySupabaseFix(
  fix: { id: string; kind: string; ref: string; ref2?: string },
  values: Record<string, string>,
  actor: { userId: string; name: string }
): Promise<string> {
  const supabase = getSupabaseBrowserClient();
  const need = (k: string) => {
    const v = (values[k] || '').trim();
    if (!v) throw new Error('Fill in the value first. Nothing was changed.');
    return v;
  };

  let detail = '';

  switch (fix.kind) {
    case 'set_owner': {
      const owner = need('owner');
      const { data: act } = await supabase
        .from('action_tracker')
        .select('action_title')
        .eq('id', fix.ref)
        .single();
      await supabase
        .from('action_tracker')
        .update({ owner_name: owner, updated_at: new Date().toISOString() })
        .eq('id', fix.ref);
      detail = `Owner of “${act?.action_title || 'action'}” set to ${owner}.`;
      break;
    }
    case 'set_due': {
      const due = need('due');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('Use a full date.');
      const { data: act } = await supabase
        .from('action_tracker')
        .select('action_title')
        .eq('id', fix.ref)
        .single();
      await supabase
        .from('action_tracker')
        .update({ due_date: due, updated_at: new Date().toISOString() })
        .eq('id', fix.ref);
      detail = `Due date of “${act?.action_title || 'action'}” set to ${due}.`;
      break;
    }
    case 'merge_action': {
      if (!fix.ref2) throw new Error('Action not found.');
      const now = new Date().toISOString();
      const purgeAfter = new Date(Date.now() + 30 * 86400000).toISOString();
      const { data: act } = await supabase
        .from('action_tracker')
        .select('action_title')
        .eq('id', fix.ref)
        .single();
      const { data: kept } = await supabase
        .from('action_tracker')
        .select('action_title')
        .eq('id', fix.ref2)
        .single();

      await supabase
        .from('action_tracker')
        .update({
          deleted_at: now,
          deleted_by: actor.userId,
          purge_after: purgeAfter,
        })
        .eq('id', fix.ref);
      detail = `“${act?.action_title || 'Action'}” merged into “${kept?.action_title || 'action'}”. The duplicate was removed.`;
      break;
    }
    case 'set_consent': {
      const basis = need('basis') as ConsentBasis;
      const { data: mtg } = await supabase
        .from('projects')
        .select('title')
        .eq('id', fix.ref)
        .single();
      const { data: existing } = await supabase
        .from('agent_memory')
        .select('id')
        .eq('agent_type', 'consent_check')
        .eq('memory_key', `meeting:${fix.ref}`)
        .is('deleted_at', null)
        .maybeSingle();

      const memoryVal = {
        basis,
        recordedBy: actor.name,
        recordedAt: new Date().toISOString(),
      };

      if (existing) {
        const { error: updErr } = await supabase.from('agent_memory').update({
          memory_value: memoryVal,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (updErr) throw new Error(`Failed to save consent: ${updErr.message}`);
      } else {
        const { error: insErr } = await supabase.from('agent_memory').insert({
          agent_type: 'consent_check',
          memory_key: `meeting:${fix.ref}`,
          owner_id: actor.userId,
          memory_value: memoryVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (insErr) throw new Error(`Failed to save consent: ${insErr.message}`);
      }
      detail = `Consent recorded for “${mtg?.title || 'meeting'}”: ${basis}.`;
      break;
    }
    case 'set_listing': {
      const listing = need('listing');
      const vendor = (values.vendor || '').trim();
      const { data: mtg } = await supabase
        .from('projects')
        .select('title')
        .eq('id', fix.ref)
        .single();
      const { data: existing } = await supabase
        .from('agent_memory')
        .select('id')
        .eq('agent_type', 'vendor_campaign_update')
        .eq('memory_key', `meeting:${fix.ref}`)
        .is('deleted_at', null)
        .maybeSingle();

      const memoryVal = { listing, vendor };
      if (existing) {
        const { error: updErr } = await supabase.from('agent_memory').update({
          memory_value: memoryVal,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (updErr) throw new Error(`Failed to save listing: ${updErr.message}`);
      } else {
        const { error: insErr } = await supabase.from('agent_memory').insert({
          agent_type: 'vendor_campaign_update',
          memory_key: `meeting:${fix.ref}`,
          owner_id: actor.userId,
          memory_value: memoryVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (insErr) throw new Error(`Failed to save listing: ${insErr.message}`);
      }
      detail = `“${mtg?.title || 'meeting'}” tagged to ${listing}${vendor ? `, vendor ${vendor}` : ''}.`;
      break;
    }
    case 'mark_owed': {
      const client = need('client');
      const { data: act } = await supabase
        .from('action_tracker')
        .select('action_title')
        .eq('id', fix.ref)
        .single();
      const { data: existing } = await supabase
        .from('agent_memory')
        .select('id')
        .eq('agent_type', 'client_commitments')
        .eq('memory_key', `action:${fix.ref}`)
        .is('deleted_at', null)
        .maybeSingle();

      const memoryVal = { owedTo: client };
      if (existing) {
        const { error: updErr } = await supabase.from('agent_memory').update({
          memory_value: memoryVal,
          updated_at: new Date().toISOString(),
        }).eq('id', existing.id);
        if (updErr) throw new Error(`Failed to mark owed: ${updErr.message}`);
      } else {
        const { error: insErr } = await supabase.from('agent_memory').insert({
          agent_type: 'client_commitments',
          memory_key: `action:${fix.ref}`,
          owner_id: actor.userId,
          memory_value: memoryVal,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        if (insErr) throw new Error(`Failed to mark owed: ${insErr.message}`);
      }
      detail = `“${act?.action_title || 'action'}” marked as owed to ${client}.`;
      break;
    }
    default:
      throw new Error('Unknown fix.');
  }

  // 1. Audit event
  await supabase.from('audit_logs').insert({
    user_id: actor.userId,
    action: 'record_updated',
    entity_type: 'agent_fix',
    entity_id: fix.ref,
    details: {
      actor: actor.name,
      detail,
      kind: fix.kind,
    },
    created_at: new Date().toISOString(),
  });

  return detail;
}

/* ================================================= LOG AGENT ACTIVITY */
export async function logAgentActivity(opts: {
  userId: string;
  agentType: string;
  headline: string;
  basis: string;
  status: 'success' | 'skipped';
}): Promise<void> {
  const supabase = getSupabaseBrowserClient();
  await supabase.from('agent_activity').insert({
    agent_type: opts.agentType,
    action_type: 'agent_run',
    status: opts.status,
    user_id: opts.userId,
    details: {
      headline: opts.headline,
      basis: opts.basis,
    },
    created_at: new Date().toISOString(),
  });
}
