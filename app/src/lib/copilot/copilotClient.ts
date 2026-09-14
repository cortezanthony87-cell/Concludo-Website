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
  }): Promise<{
    conversation: CopilotConversation;
    userMessage: CopilotMessage;
    assistantMessage: CopilotMessage;
    response: CopilotResponse;
  }> {
    const { query, assistantType, sessionId } = params;

    // 1. Log audit event: question_asked
    await recordAuditLog({
      action: 'question_asked',
      entityType: 'copilot_query',
      details: { query, assistantType },
      userId: this.userId,
      admin: true,
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
    });

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
        sourceRecordsCount: response.sourceRecords.length,
      },
      userId: this.userId,
      admin: true,
    });

    // 8. Log knowledge search if knowledge connections or discovery occurred
    if (response.knowledgeGraphConnections.length > 0 || response.intent === 'knowledge_discovery') {
      await recordAuditLog({
        action: 'knowledge_search',
        entityType: 'copilot_knowledge',
        details: { query, intent: response.intent },
        userId: this.userId,
        admin: true,
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
        },
        userId: this.userId,
        admin: true,
      });
    }

    return {
      conversation: conv,
      userMessage,
      assistantMessage,
      response,
    };
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
