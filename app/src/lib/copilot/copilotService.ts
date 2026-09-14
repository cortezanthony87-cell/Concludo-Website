import { SupabaseClient } from '@supabase/supabase-js';
import {
  CopilotConversation,
  CopilotMessage,
  CopilotPrompt,
  CopilotResponse,
  PromptCategory,
  PromptScope,
} from './types';
import { recordAuditLog } from '../enterprise/auditService';

export interface FetchConversationsOptions {
  userId: string;
  organizationId?: string | null;
  teamId?: string | null;
  isArchived?: boolean;
  search?: string;
}

/**
 * Lists active conversations with retention filtering and search
 */
export async function fetchConversations(
  supabase: SupabaseClient,
  options: FetchConversationsOptions
): Promise<CopilotConversation[]> {
  const { userId, organizationId, teamId, isArchived, search } = options;

  let query = supabase
    .from('copilot_conversations')
    .select('*')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false });

  if (isArchived !== undefined) {
    query = query.eq('is_archived', isArchived);
  }

  if (organizationId) {
    query = query.or(`user_id.eq.${userId},organization_id.eq.${organizationId}`);
  } else if (teamId) {
    query = query.or(`user_id.eq.${userId},team_id.eq.${teamId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  if (search && search.trim()) {
    query = query.ilike('title', `%${search.trim()}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);
  return data || [];
}

/**
 * Retrieves a single conversation by ID
 */
export async function fetchConversationById(
  supabase: SupabaseClient,
  conversationId: string
): Promise<CopilotConversation | null> {
  const { data, error } = await supabase
    .from('copilot_conversations')
    .select('*')
    .eq('id', conversationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) throw new Error(`Failed to fetch conversation: ${error.message}`);
  return data;
}

/**
 * Creates a new conversation and logs the audit event
 */
export async function createConversation(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId?: string | null;
    teamId?: string | null;
    title?: string;
    sessionId?: string | null;
    metadata?: Record<string, any>;
  }
): Promise<CopilotConversation> {
  const { userId, organizationId, teamId, title = 'New Conversation', sessionId, metadata = {} } = params;

  const { data, error } = await supabase
    .from('copilot_conversations')
    .insert({
      user_id: userId,
      organization_id: organizationId || null,
      team_id: teamId || null,
      session_id: sessionId || null,
      title,
      is_archived: false,
      metadata,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create conversation: ${error.message}`);

  await recordAuditLog({
    action: 'conversation_created',
    entityType: 'copilot_conversation',
    entityId: data.id,
    details: { title, organization_id: organizationId, team_id: teamId },
    userId,
    admin: true,
  });

  return data;
}

/**
 * Updates conversation details (rename, archive)
 */
export async function updateConversation(
  supabase: SupabaseClient,
  conversationId: string,
  updates: Partial<Pick<CopilotConversation, 'title' | 'is_archived' | 'metadata'>>
): Promise<CopilotConversation> {
  const { data, error } = await supabase
    .from('copilot_conversations')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update conversation: ${error.message}`);
  return data;
}

/**
 * Soft-deletes a conversation (30-day recovery window)
 */
export async function softDeleteConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('soft_delete_copilot_conversation', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  if (error) throw new Error(`Failed to soft-delete conversation: ${error.message}`);

  await recordAuditLog({
    action: 'conversation_deleted',
    entityType: 'copilot_conversation',
    entityId: conversationId,
    details: { soft_deleted: true },
    userId,
    admin: true,
  });

  return true;
}

/**
 * Restores a soft-deleted conversation
 */
export async function restoreConversation(
  supabase: SupabaseClient,
  conversationId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('restore_copilot_conversation', {
    p_conversation_id: conversationId,
  });

  if (error) throw new Error(`Failed to restore conversation: ${error.message}`);
  return true;
}

/**
 * Permanently deletes a conversation with Legal Hold enforcement
 */
export async function permanentDeleteConversation(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('permanent_delete_copilot_conversation', {
    p_conversation_id: conversationId,
    p_user_id: userId,
  });

  if (error) throw new Error(`Failed to permanently delete conversation: ${error.message}`);
  return true;
}

/**
 * Fetches messages belonging to a conversation
 */
export async function fetchMessages(
  supabase: SupabaseClient,
  conversationId: string
): Promise<CopilotMessage[]> {
  const { data, error } = await supabase
    .from('copilot_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
  return data || [];
}

/**
 * Adds a message to a conversation
 */
export async function createMessage(
  supabase: SupabaseClient,
  params: {
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    message: string;
    response?: CopilotResponse | Record<string, any>;
  }
): Promise<CopilotMessage> {
  const { conversationId, role, message, response = {} } = params;

  const { data, error } = await supabase
    .from('copilot_messages')
    .insert({
      conversation_id: conversationId,
      role,
      message,
      response,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to append message: ${error.message}`);

  // Touch conversation updated_at
  await supabase
    .from('copilot_conversations')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  return data;
}

/**
 * Prompts Management: Fetch saved and shared prompts
 */
export async function fetchPrompts(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId?: string | null;
    teamId?: string | null;
    category?: PromptCategory;
    scope?: PromptScope;
  }
): Promise<CopilotPrompt[]> {
  const { userId, organizationId, teamId, category, scope } = params;

  let query = supabase
    .from('copilot_prompts')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (category) {
    query = query.eq('category', category);
  }

  if (scope) {
    query = query.eq('scope', scope);
  }

  if (organizationId) {
    query = query.or(`user_id.eq.${userId},organization_id.eq.${organizationId}`);
  } else if (teamId) {
    query = query.or(`user_id.eq.${userId},team_id.eq.${teamId}`);
  } else {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to fetch prompts: ${error.message}`);
  return data || [];
}

/**
 * Saves a new prompt
 */
export async function createPrompt(
  supabase: SupabaseClient,
  params: {
    userId: string;
    organizationId?: string | null;
    teamId?: string | null;
    title: string;
    promptText: string;
    category?: PromptCategory;
    scope?: PromptScope;
    targetRole?: string | null;
  }
): Promise<CopilotPrompt> {
  const {
    userId,
    organizationId,
    teamId,
    title,
    promptText,
    category = 'general',
    scope = 'personal',
    targetRole = null,
  } = params;

  const { data, error } = await supabase
    .from('copilot_prompts')
    .insert({
      user_id: userId,
      organization_id: organizationId || null,
      team_id: teamId || null,
      title,
      prompt_text: promptText,
      category,
      scope,
      target_role: targetRole,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to create prompt: ${error.message}`);

  await recordAuditLog({
    action: 'prompt_saved',
    entityType: 'copilot_prompt',
    entityId: data.id,
    details: { title, category, scope },
    userId,
    admin: true,
  });

  return data;
}

/**
 * Soft deletes a prompt
 */
export async function softDeletePrompt(
  supabase: SupabaseClient,
  promptId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('soft_delete_copilot_prompt', {
    p_prompt_id: promptId,
    p_user_id: userId,
  });

  if (error) throw new Error(`Failed to delete prompt: ${error.message}`);
  return true;
}

/**
 * Restores a soft-deleted prompt
 */
export async function restorePrompt(
  supabase: SupabaseClient,
  promptId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('restore_copilot_prompt', {
    p_prompt_id: promptId,
  });

  if (error) throw new Error(`Failed to restore prompt: ${error.message}`);
  return true;
}

/**
 * Permanently deletes a prompt with Legal Hold check
 */
export async function permanentDeletePrompt(
  supabase: SupabaseClient,
  promptId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.rpc('permanent_delete_copilot_prompt', {
    p_prompt_id: promptId,
    p_user_id: userId,
  });

  if (error) throw new Error(`Failed to permanently delete prompt: ${error.message}`);
  return true;
}
