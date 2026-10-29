import { SupabaseClient } from '@supabase/supabase-js';
import {
  AssistantType,
  CopilotClarification,
  CopilotMessage,
  CopilotQueryType,
  CopilotResponse,
  CopilotScopeInfo,
  CopilotScopeSelection,
} from './types';
import { fetchDocument, fetchRound1, fetchRound2, type DocumentContent } from './contextService';
import { applyScope, buildEntities, buildEvidence } from './evidence';
import { compose } from './composer';
import { detectIntent, parseQuery, resolveEntity, type NamedEntity } from './understanding';
import { formatAuDate, melbourneToday } from './dates';

export interface CopilotQueryOptions {
  userId: string;
  organizationId?: string | null;
  teamId?: string | null;
  assistantType?: AssistantType;
  history?: CopilotMessage[];
  sessionId?: string | null;
  /** Explicit scope chosen in the interface. It always wins over names found in the question. */
  scope?: CopilotScopeSelection;
  /** Override for tests. */
  now?: Date;
  /** The design preview passes 'sample' so fictional records are never labelled live. */
  dataMode?: 'live' | 'sample';
  /** Called as each real stage starts, so the interface shows true progress instead of a timer. */
  onProgress?: (stage: CopilotStage) => void;
}

export type CopilotStage = 'understanding' | 'reading' | 'checking' | 'writing';

export interface ScopeOptions {
  projects: Array<{ key: string; name: string; client: string | null; meetings: number; latest: string | null }>;
  clients: Array<{ key: string; name: string; meetings: number }>;
  truncated: boolean;
}

const WORKFLOW_INTENTS: CopilotQueryType[] = ['workflow_status', 'executive_query', 'recommendation_query'];
const OUTPUT_INTENTS: CopilotQueryType[] = [
  'project_retrieval', 'period_summary', 'risk_analysis', 'meeting_retrieval', 'executive_query',
  'recommendation_query', 'campaign_listing', 'timeline_query', 'consent_status', 'general_query', 'decision_retrieval',
];

/**
 * Concludo Copilot engine.
 *
 * What it is: a conversational interface that answers from the user's own records, with the scope
 * made explicit, citations on every recorded statement, and "not recorded" when nothing matches.
 * What it is not: an orchestrator of the 15 agents, and not a language model. Drafts that need a
 * person's sign-off are returned as previews and queued for approval by the client, never executed here.
 */
export class CopilotEngine {
  constructor(private supabase: SupabaseClient) {}

  detectIntent(query: string, history: CopilotMessage[] = []): CopilotQueryType {
    return detectIntent(query, history);
  }

  private mapIntentToAssistant(intent: CopilotQueryType): AssistantType {
    switch (intent) {
      case 'decision_retrieval':
        return 'decision_assistant';
      case 'project_retrieval':
      case 'period_summary':
      case 'meeting_retrieval':
      case 'campaign_listing':
      case 'document_query':
        return 'project_assistant';
      case 'action_retrieval':
      case 'client_commitments':
      case 'workflow_status':
        return 'action_assistant';
      case 'risk_analysis':
        return 'risk_assistant';
      case 'executive_query':
      case 'recommendation_query':
      case 'forecast_query':
        return 'executive_assistant';
      case 'knowledge_discovery':
        return 'knowledge_assistant';
      default:
        return 'copilot';
    }
  }

  /** Names for the interface's scope picker: distinct projects and clients, with counts. */
  async listScopeOptions(): Promise<ScopeOptions> {
    const r1 = await fetchRound1(this.supabase);
    const entities = buildEntities(r1.projects);
    const byId = new Map(r1.projects.map((p) => [p.id, p]));
    return {
      projects: entities
        .filter((e) => e.kind === 'project')
        .map((e) => ({
          key: e.key,
          name: e.display,
          client: e.client || null,
          meetings: e.ids.length,
          latest: e.ids.map((i) => (byId.get(i)?.meeting_date || '').slice(0, 10)).sort().pop() || null,
        }))
        .sort((a, b) => (b.latest || '').localeCompare(a.latest || '')),
      clients: entities.filter((e) => e.kind === 'client').map((e) => ({ key: e.key, name: e.display, meetings: e.ids.length })),
      truncated: r1.truncated.includes('projects'),
    };
  }

  async listDocuments(projectKey: string): Promise<Array<{ id: string; name: string; version: number | string | null; meetingId: string }>> {
    const r1 = await fetchRound1(this.supabase);
    const ent = buildEntities(r1.projects).find((e) => e.kind === 'project' && e.key === projectKey);
    if (!ent) return [];
    const raw = await fetchRound2(this.supabase, r1, {
      intent: 'document_query',
      projectIds: ent.ids,
      period: null,
      needOutputs: false,
      needFiles: true,
      needWorkflow: false,
    });
    return raw.files.map((f) => ({ id: f.id, name: f.name || 'Untitled file', version: f.version ?? null, meetingId: f.project_id }));
  }

  async processQuery(query: string, options: CopilotQueryOptions): Promise<CopilotResponse> {
    const { history = [] } = options;
    const cleanQuery = (query || '').trim();
    const today = melbourneToday(options.now);
    const dataMode = options.dataMode || 'live';
    const sel = options.scope || {};
    const hasDocument = !!sel.documentId;

    options.onProgress?.('understanding');
    const parsed = parseQuery(cleanQuery, history, { today, hasDocument });
    const asOf = new Date(options.now || Date.now()).toISOString();
    const baseScope: CopilotScopeInfo = { label: 'Whole workspace you can access', dataMode, asOf };
    const assistantFor = (i: CopilotQueryType) => options.assistantType && options.assistantType !== 'copilot' ? options.assistantType : this.mapIntentToAssistant(i);

    // 1. People ranking is refused before any data is read.
    if (parsed.rankingPeople) {
      return compose({
        query: cleanQuery,
        intent: 'people_ranking_refused',
        assistantType: assistantFor('people_ranking_refused'),
        pack: buildEvidence(emptyBundle(), today),
        scope: baseScope,
        rankingRefused: true,
        today,
      });
    }

    // 2. Names, then scope.
    options.onProgress?.('reading');
    const r1 = await fetchRound1(this.supabase);
    const entities = buildEntities(r1.projects);

    let entity: NamedEntity | null = null;
    let clarification: CopilotClarification | undefined;

    if (sel.projectKey) entity = entities.find((e) => e.kind === 'project' && e.key === sel.projectKey) || null;
    else if (sel.client) entity = entities.find((e) => e.kind === 'client' && e.key === sel.client) || null;
    else if (!hasDocument) {
      const res = resolveEntity(cleanQuery, entities);
      if (res.status === 'resolved') entity = res.entity;
      if (res.status === 'ambiguous') {
        clarification = {
          question: `More than one name matches "${cleanQuery.length > 60 ? cleanQuery.slice(0, 57) + '...' : cleanQuery}". Choose the one you mean. Concludo will not merge them.`,
          options: res.candidates.map((c) => ({
            id: `${c.kind}:${c.key}`,
            label: c.display,
            detail: `${c.kind === 'project' ? 'Project' : 'Client'}${c.client && c.kind === 'project' ? ` for ${c.client}` : ''}, ${c.ids.length} ${c.ids.length === 1 ? 'meeting' : 'meetings'}`,
          })),
        };
      }
    }

    const period = sel.period ? { ...sel.period, label: `${formatAuDate(sel.period.from)} to ${formatAuDate(sel.period.to)}, inclusive` } : parsed.period;

    if (clarification) {
      return compose({
        query: cleanQuery,
        intent: parsed.intent,
        assistantType: assistantFor(parsed.intent),
        pack: buildEvidence(emptyBundle(), today),
        scope: { ...baseScope, label: 'Waiting for you to choose a name' },
        clarification,
        today,
      });
    }

    // 3. Document context: the document decides the project.
    let document: DocumentContent | null = null;
    let projectIds: string[] | null = entity ? entity.ids : null;
    if (hasDocument) {
      document = await fetchDocument(this.supabase, sel.documentId as string);
      projectIds = document ? [document.projectId] : [];
    }

    // 4. Second round: only what this question needs.
    const intent = parsed.intent;
    const raw = await fetchRound2(this.supabase, r1, {
      intent,
      projectIds,
      period: period ? { from: period.from, to: period.to } : null,
      needOutputs: OUTPUT_INTENTS.includes(intent),
      needFiles: false,
      needWorkflow: WORKFLOW_INTENTS.includes(intent),
    });

    let lessons: any[] | undefined;
    if (intent === 'knowledge_discovery') {
      try {
        const { data } = await (this.supabase
          .from('lessons_learned')
          .select('id, title, summary, outcome, cluster_category, created_at')
          .is('deleted_at', null)
          .order('created_at', { ascending: false })
          .limit(10) as any);
        lessons = data || [];
      } catch {
        lessons = [];
      }
    }

    options.onProgress?.('checking');
    // 5. Scope the evidence. A document scopes to its own meeting.
    const docMeetingEntityKey = document ? buildEvidence(raw, today).meetings.find((m) => m.id === document!.projectId)?.projectKey : null;
    const full = buildEvidence(raw, today);
    const pack = applyScope(full, {
      projectKey: entity?.kind === 'project' ? entity.key : docMeetingEntityKey || null,
      clientKey: entity?.kind === 'client' ? entity.key : null,
      period: document ? null : period ? { from: period.from, to: period.to } : null,
    });
    if (document) {
      // keep only records of the document's own meeting
      pack.decisions = pack.decisions.filter((d) => d.projectId === document!.projectId);
      pack.actions = pack.actions.filter((a) => a.projectId === document!.projectId);
      pack.meetings = pack.meetings.filter((m) => m.id === document!.projectId);
    }

    const projectName = entity?.kind === 'project' ? entity.display : document ? full.meetings.find((m) => m.id === document!.projectId)?.projectName || null : null;
    const clientName = entity?.kind === 'client' ? entity.display : entity?.kind === 'project' ? entity.client || null : null;
    const labelBits = [projectName && `Project: ${projectName}`, entity?.kind === 'client' && `Client: ${entity.display}`, period && `Period: ${period.label}`, document && `Document: ${document.name}`].filter(Boolean) as string[];
    const scope: CopilotScopeInfo = {
      label: labelBits.length ? labelBits.join('  |  ') : 'Whole workspace you can access',
      projectName,
      projectKey: entity?.kind === 'project' ? entity.key : null,
      client: clientName,
      period: period ? { from: period.from, to: period.to, label: period.label } : null,
      documentId: document?.id || null,
      documentName: document?.name || null,
      documentVersion: document?.version ?? null,
      dataMode,
      asOf,
    };

    options.onProgress?.('writing');
    return compose({
      query: cleanQuery,
      intent,
      assistantType: assistantFor(intent),
      pack,
      scope,
      document,
      documentRequested: hasDocument,
      lessons,
      organizationId: options.organizationId,
      today,
    });
  }
}

function emptyBundle() {
  return { projects: [], outputs: [], decisions: [], actions: [], memory: [], files: [], approvals: [], executions: [], incidents: [], truncated: [], failed: [] };
}
