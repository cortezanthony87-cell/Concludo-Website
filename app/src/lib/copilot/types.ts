export type CopilotQueryType =
  | 'decision_retrieval'
  | 'project_retrieval'
  | 'action_retrieval'
  | 'timeline_query'
  | 'risk_analysis'
  | 'forecast_query'
  | 'recommendation_query'
  | 'relationship_query'
  | 'evidence_query'
  | 'executive_query'
  | 'knowledge_discovery'
  | 'action_execution_request'
  | 'meeting_retrieval'
  | 'period_summary'
  | 'client_commitments'
  | 'campaign_listing'
  | 'workflow_status'
  | 'consent_status'
  | 'document_query'
  | 'people_ranking_refused'
  | 'general_query';

export type AssistantType =
  | 'copilot'
  | 'decision_assistant'
  | 'project_assistant'
  | 'action_assistant'
  | 'risk_assistant'
  | 'executive_assistant'
  | 'knowledge_assistant';

export type CopilotConfidenceLevel =
  | 'low'
  | 'moderate'
  | 'high'
  | 'very_high';

export interface SourceRecord {
  id: string;
  title: string;
  type:
    | 'project'
    | 'decision'
    | 'action'
    | 'transcript'
    | 'output'
    | 'report'
    | 'forecast'
    | 'knowledge_node'
    | 'lesson_learned'
    | 'risk'
    | 'recommendation'
    | 'meeting'
    | 'document'
    | 'approval'
    | 'workflow_run'
    | 'incident';
  snippet: string;
  createdAt?: string;
  /** Calendar date of the record itself (meeting, decision or due date), YYYY-MM-DD. */
  recordDate?: string | null;
  /** Where the record lives, for the Open link. */
  href?: string;
  /** Plain label for status, owner or version, shown beside the citation. */
  status?: string | null;
  metadata?: Record<string, any>;
}

/** How a statement was reached. The interface labels every statement with one of these. */
export type StatementBasis = 'recorded' | 'calculated' | 'inferred' | 'recommended' | 'modelled';

export interface AnswerItem {
  text: string;
  basis: StatementBasis;
  /** Ids of SourceRecords that support this statement. Empty only for calculated totals. */
  sourceIds: string[];
  date?: string | null;
  tone?: 'normal' | 'attention' | 'ok' | 'muted';
}

export interface AnswerSection {
  kind:
    | 'summary'
    | 'meetings'
    | 'decisions'
    | 'actions'
    | 'risks'
    | 'commitments'
    | 'approvals'
    | 'runs'
    | 'incidents'
    | 'forecast'
    | 'document'
    | 'discrepancy'
    | 'held'
    | 'gaps'
    | 'next_steps';
  title: string;
  items: AnswerItem[];
}

export type EvidenceStatus = 'grounded' | 'partial' | 'none' | 'ambiguous' | 'refused';

export interface CopilotNotice {
  kind: 'consent' | 'truncated' | 'stale' | 'injection' | 'scope' | 'info' | 'permission' | 'partial' | 'error';
  text: string;
}

export interface CopilotScopeInfo {
  label: string;
  projectName?: string | null;
  projectKey?: string | null;
  client?: string | null;
  period?: { from: string; to: string; label: string } | null;
  documentId?: string | null;
  documentName?: string | null;
  documentVersion?: number | string | null;
  /** Always 'live' when read from the database. 'sample' is used only by the design preview. */
  dataMode: 'live' | 'sample';
  asOf: string;
}

export interface CopilotClarification {
  question: string;
  options: Array<{ id: string; label: string; detail: string }>;
}

export interface CopilotScopeSelection {
  projectKey?: string | null;
  client?: string | null;
  documentId?: string | null;
  period?: { from: string; to: string } | null;
}

export interface KnowledgeGraphConnection {
  from: string;
  relationship: string;
  to: string;
  confidence: number;
}

export interface CopilotExecutionDraft {
  actionType:
    | 'generate_report'
    | 'prepare_briefing'
    | 'create_workflow'
    | 'export_actions';
  title: string;
  payload: Record<string, any>;
  requiresApproval: boolean;
  /** 'draft' means NOT saved to Approvals yet. Only 'pending_approval' with an approvalId is a real queued item. */
  status: 'draft' | 'pending_approval' | 'executed';
  approvalId?: string | null;
  /** Stable key so a repeated click or retry never queues the same request twice. */
  idempotencyKey?: string;
  /** Plain-language preview of what approving would do. */
  preview?: string[];
  persistError?: string | null;
}

export interface CopilotResponse {
  query: string;
  intent: CopilotQueryType;
  assistantType: AssistantType;
  answer: string;
  supportingEvidence: string[];
  sourceRecords: SourceRecord[];
  confidence: CopilotConfidenceLevel;
  confidenceScore: number;
  confidenceExplanation: string;
  relatedRecords: Array<{
    id: string;
    title: string;
    type: string;
    relationship?: string;
  }>;
  reasoningPath: string[];
  knowledgeGraphConnections: KnowledgeGraphConnection[];
  suggestedFollowUps: string[];
  executionDraft?: CopilotExecutionDraft;
  /** Added by the evidence engine. Optional so older stored messages still render. */
  sections?: AnswerSection[];
  evidenceStatus?: EvidenceStatus;
  notices?: CopilotNotice[];
  scope?: CopilotScopeInfo;
  clarification?: CopilotClarification;
  /** Names the formula behind confidenceScore so the number is never a bare assertion. */
  strengthFactors?: Array<{ label: string; points: number }>;
}

export interface CopilotConversation {
  id: string;
  user_id: string;
  organization_id?: string | null;
  team_id?: string | null;
  session_id?: string | null;
  title: string;
  is_archived: boolean;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface CopilotMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  message: string;
  response: CopilotResponse | Record<string, any>;
  created_at: string;
}

export type PromptCategory =
  | 'general'
  | 'decisions'
  | 'projects'
  | 'actions'
  | 'risks'
  | 'executive'
  | 'reports';

export type PromptScope =
  | 'personal'
  | 'team'
  | 'organization'
  | 'executive'
  | 'role';

export interface CopilotPrompt {
  id: string;
  organization_id?: string | null;
  team_id?: string | null;
  user_id: string;
  title: string;
  prompt_text: string;
  category: PromptCategory;
  scope: PromptScope;
  target_role?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export function getConfidenceLevel(score: number): CopilotConfidenceLevel {
  if (score >= 85) return 'very_high';
  if (score >= 70) return 'high';
  if (score >= 50) return 'moderate';
  return 'low';
}
