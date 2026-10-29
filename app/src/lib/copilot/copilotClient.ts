import { SupabaseClient } from '@supabase/supabase-js';
import {
  AssistantType,
  CopilotConversation,
  CopilotMessage,
  CopilotPrompt,
  CopilotResponse,
  PromptCategory,
  PromptScope,
} from './types';
import { CopilotEngine } from './copilotEngine';
import {
  createConversation,
  createMessage,
  createPrompt,
  fetchConversationById,
  fetchConversations,
  fetchMessages,
  fetchPrompts,
  softDeleteConversation,
  softDeletePrompt,
  updateConversation,
} from './copilotService';
import { recordAuditLog } from '../enterprise/auditService';
import type { CopilotExecutionDraft, CopilotScopeSelection } from './types';
import type { CopilotStage, ScopeOptions } from './copilotEngine';

/** Stable key: the same request on the same day with the same scope queues once, however many clicks or retries. */
export function draftIdempotencyKey(userId: string, draft: CopilotExecutionDraft, day: string): string {
  const scope = JSON.stringify(draft.payload?.scope || {});
  const raw = `${userId}|${draft.actionType}|${scope}|${draft.payload?.sourceQuery || ''}|${day}`.toLowerCase();
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  return `copilot:${draft.actionType}:${(h >>> 0).toString(36)}`;
}

/**
 * Queue a Copilot draft in workflow_approvals so it appears in Approvals. Returns the real state:
 * 'pending_approval' with an approvalId only if the row exists. On any failure the draft stays 'draft'
 * and carries the error, so the interface never claims something was queued when it was not.
 */
export async function persistExecutionDraft(
  supabase: SupabaseClient,
  userId: string,
  draft: CopilotExecutionDraft,
  requestedBy: string
): Promise<CopilotExecutionDraft> {
  const key = draftIdempotencyKey(userId, draft, new Date().toISOString().slice(0, 10));
  try {
    const { data: existing } = await supabase
      .from('workflow_approvals')
      .select('id, status')
      .eq('requester_id', userId)
      .eq('action_type', 'agent_draft')
      .contains('action_payload', { idempotencyKey: key })
      .is('deleted_at', null)
      .limit(1);
    if (existing && existing.length > 0) {
      return { ...draft, idempotencyKey: key, approvalId: existing[0].id, status: 'pending_approval', persistError: null };
    }
    const { data, error } = await supabase
      .from('workflow_approvals')
      .insert({
        requester_id: userId,
        status: 'pending',
        action_type: 'agent_draft',
        action_payload: {
          title: draft.title,
          kind: 'agent_draft',
          source: 'Copilot',
          requestedBy,
          requestedAt: new Date().toISOString(),
          outgoing: [],
          idempotencyKey: key,
          copilot: { actionType: draft.actionType, payload: draft.payload, preview: draft.preview || [] },
        },
        notes: null,
      })
      .select('id')
      .single();
    if (error || !data) {
      return { ...draft, idempotencyKey: key, status: 'draft', approvalId: null, persistError: error?.message || 'The approval could not be saved.' };
    }
    return { ...draft, idempotencyKey: key, approvalId: data.id, status: 'pending_approval', persistError: null };
  } catch (e: any) {
    return { ...draft, idempotencyKey: key, status: 'draft', approvalId: null, persistError: e?.message || 'The approval could not be saved.' };
  }
}

export interface CopilotClientOptions {
  supabase: SupabaseClient;
  userId: string;
  organizationId?: string | null;
  teamId?: string | null;
}

/**
 * High-level Client SDK for interacting with Concludo Copilot
 */
export class CopilotClient {
  private engine: CopilotEngine;
  private supabase: SupabaseClient;
  private userId: string;
  private organizationId: string | null;
  private teamId: string | null;

  constructor(options: CopilotClientOptions) {
    this.supabase = options.supabase;
    this.userId = options.userId;
    this.organizationId = options.organizationId || null;
    this.teamId = options.teamId || null;
    this.engine = new CopilotEngine(this.supabase);
  }

  /**
   * Submits a prompt, generates an evidence-grounded answer, records messages, and logs audit events
   */
  async ask(params: {
    query: string;
    conversationId?: string | null;
    assistantType?: AssistantType;
    sessionId?: string | null;
    scope?: CopilotScopeSelection;
    requestedBy?: string;
    onProgress?: (stage: CopilotStage) => void;
    dataMode?: 'live' | 'sample';
  }): Promise<{
    conversation: CopilotConversation;
    userMessage: CopilotMessage;
    assistantMessage: CopilotMessage;
    response: CopilotResponse;
  }> {
    const { query, assistantType, sessionId, scope } = params;

    // 1. Log audit event: question_asked
    await recordAuditLog({
      action: 'question_asked',
      entityType: 'copilot_query',
      // The question text is not logged: it can contain client names or other sensitive detail.
      details: { queryLength: query.length, assistantType: assistantType || 'copilot', scoped: !!(scope && (scope.projectKey || scope.client || scope.documentId || scope.period)) },
      userId: this.userId,
      organizationId: this.organizationId,
    });

    // 2. Resolve or create conversation
    let conv: CopilotConversation;
    if (params.conversationId) {
      const existing = await fetchConversationById(this.supabase, params.conversationId);
      if (!existing) {
        throw new Error('Conversation not found');
      }
      conv = existing;
    } else {
      const autoTitle = query.length > 40 ? `${query.slice(0, 37)}...` : query;
      conv = await createConversation(this.supabase, {
        userId: this.userId,
        organizationId: this.organizationId,
        teamId: this.teamId,
        title: autoTitle,
        sessionId,
      });
    }

    // 3. Fetch past messages for conversational continuity
    const history = await fetchMessages(this.supabase, conv.id);

    // 4. Record user message
    const userMessage = await createMessage(this.supabase, {
      conversationId: conv.id,
      role: 'user',
      message: query,
    });

    // 5. Run Copilot Engine with context history
    const response = await this.engine.processQuery(query, {
      userId: this.userId,
      organizationId: this.organizationId,
      teamId: this.teamId,
      assistantType,
      history,
      sessionId,
      scope,
      onProgress: params.onProgress,
      dataMode: params.dataMode,
    });

    // 5b. A draft that needs sign-off is queued for real, or reported as not queued.
    if (response.executionDraft) {
      response.executionDraft = await persistExecutionDraft(this.supabase, this.userId, response.executionDraft, params.requestedBy || 'Copilot user');
    }

    // 6. Record assistant message
    const assistantMessage = await createMessage(this.supabase, {
      conversationId: conv.id,
      role: 'assistant',
      message: response.answer,
      response,
    });

    // 7. Log audit event: answer_generated
    await recordAuditLog({
      action: 'answer_generated',
      entityType: 'copilot_response',
      entityId: assistantMessage.id,
      details: {
        intent: response.intent,
        confidence: response.confidence,
        confidenceScore: response.confidenceScore,
        evidenceStatus: response.evidenceStatus,
        sourceRecordsCount: response.sourceRecords.length,
      },
      userId: this.userId,
      organizationId: this.organizationId,
    });

    // 8. Log knowledge search if knowledge connections or discovery occurred
    if (response.knowledgeGraphConnections.length > 0 || response.intent === 'knowledge_discovery') {
      await recordAuditLog({
        action: 'knowledge_search',
        entityType: 'copilot_knowledge',
        details: { intent: response.intent },
        userId: this.userId,
        organizationId: this.organizationId,
      });
    }

    // 9. If execution draft exists, log execution request audit event
    if (response.executionDraft) {
      await recordAuditLog({
        action: 'execution_request',
        entityType: 'copilot_execution_draft',
        details: {
          draftAction: response.executionDraft.actionType,
          title: response.executionDraft.title,
          approvalId: response.executionDraft.approvalId || null,
          queued: response.executionDraft.status === 'pending_approval',
        },
        userId: this.userId,
        organizationId: this.organizationId,
      });
    }

    return {
      conversation: conv,
      userMessage,
      assistantMessage,
      response,
    };
  }

  // Scope pickers
  async listScopeOptions(): Promise<ScopeOptions> {
    return this.engine.listScopeOptions();
  }

  async listDocuments(projectKey: string) {
    return this.engine.listDocuments(projectKey);
  }

  // Conversation Helpers
  async listConversations(search?: string, isArchived?: boolean) {
    return fetchConversations(this.supabase, {
      userId: this.userId,
      organizationId: this.organizationId,
      teamId: this.teamId,
      search,
      isArchived,
    });
  }

  async getMessages(conversationId: string) {
    return fetchMessages(this.supabase, conversationId);
  }

  async renameConversation(conversationId: string, title: string) {
    return updateConversation(this.supabase, conversationId, { title });
  }

  async deleteConversation(conversationId: string) {
    return softDeleteConversation(this.supabase, conversationId, this.userId);
  }

  // Prompt Helpers
  async listPrompts(category?: PromptCategory, scope?: PromptScope) {
    return fetchPrompts(this.supabase, {
      userId: this.userId,
      organizationId: this.organizationId,
      teamId: this.teamId,
      category,
      scope,
    });
  }

  async savePrompt(title: string, promptText: string, category?: PromptCategory, scope?: PromptScope) {
    return createPrompt(this.supabase, {
      userId: this.userId,
      organizationId: this.organizationId,
      teamId: this.teamId,
      title,
      promptText,
      category,
      scope,
    });
  }

  async deletePrompt(promptId: string) {
    return softDeletePrompt(this.supabase, promptId, this.userId);
  }
}
