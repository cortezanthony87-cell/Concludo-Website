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
    | 'recommendation';
  snippet: string;
  createdAt?: string;
  metadata?: Record<string, any>;
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
  status: 'draft' | 'pending_approval' | 'executed';
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
