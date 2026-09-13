import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase/admin';
import { getSupabaseBrowserClient } from '../supabase/client';
import { AgentMemoryRecord, AgentActivityRecord } from './types';

function getClient(admin: boolean = false): SupabaseClient {
  if (admin) {
    try {
      return getSupabaseAdminClient();
    } catch {
      return getSupabaseBrowserClient();
    }
  }
  return getSupabaseBrowserClient();
}


export async function getAgentMemory(params: {
  agentType: string;
  memoryKey: string;
  ownerId: string;
  teamId?: string | null;
  organizationId?: string | null;
  admin?: boolean;
}): Promise<AgentMemoryRecord | null> {
  const client = getClient(params.admin);
  let query = client
    .from('agent_memory')
    .select('*')
    .eq('agent_type', params.agentType)
    .eq('memory_key', params.memoryKey)
    .is('deleted_at', null);

  if (params.organizationId) {
    query = query.eq('organization_id', params.organizationId);
  } else if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  } else {
    query = query.eq('owner_id', params.ownerId);
  }

  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error || !data) return null;
  return data as AgentMemoryRecord;
}

export async function setAgentMemory(params: {
  agentType: string;
  memoryKey: string;
  memoryValue: Record<string, any>;
  ownerId: string;
  teamId?: string | null;
  organizationId?: string | null;
  admin?: boolean;
}): Promise<AgentMemoryRecord> {
  const client = getClient(params.admin);

  // Check if existing key exists
  const existing = await getAgentMemory({
    agentType: params.agentType,
    memoryKey: params.memoryKey,
    ownerId: params.ownerId,
    teamId: params.teamId,
    organizationId: params.organizationId,
    admin: params.admin,
  });

  if (existing) {
    const { data, error } = await client
      .from('agent_memory')
      .update({
        memory_value: params.memoryValue,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    if (error) throw new Error(`Failed to update agent memory: ${error.message}`);
    return data as AgentMemoryRecord;
  }

  const { data, error } = await client
    .from('agent_memory')
    .insert({
      agent_type: params.agentType,
      memory_key: params.memoryKey,
      memory_value: params.memoryValue,
      owner_id: params.ownerId,
      team_id: params.teamId || null,
      organization_id: params.organizationId || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to set agent memory: ${error.message}`);
  return data as AgentMemoryRecord;
}

export async function listAgentMemory(params: {
  agentType?: string;
  ownerId?: string;
  teamId?: string | null;
  organizationId?: string | null;
  admin?: boolean;
}): Promise<AgentMemoryRecord[]> {
  const client = getClient(params.admin);
  let query = client.from('agent_memory').select('*').is('deleted_at', null);

  if (params.agentType) {
    query = query.eq('agent_type', params.agentType);
  }
  if (params.organizationId) {
    query = query.eq('organization_id', params.organizationId);
  } else if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  } else if (params.ownerId) {
    query = query.eq('owner_id', params.ownerId);
  }

  const { data, error } = await query.order('updated_at', { ascending: false });
  if (error) throw new Error(`Failed to list agent memory: ${error.message}`);
  return (data || []) as AgentMemoryRecord[];
}

export async function deleteAgentMemory(
  id: string,
  userId: string,
  admin: boolean = false
): Promise<void> {
  const client = getClient(admin);
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { error } = await client
    .from('agent_memory')
    .update({
      deleted_at: now.toISOString(),
      deleted_by: userId,
      purge_after: purgeAfter.toISOString(),
    })
    .eq('id', id);

  if (error) throw new Error(`Failed to delete agent memory: ${error.message}`);
}

export async function logAgentActivity(activity: {
  agentType: string;
  actionType: string;
  status: 'success' | 'failed' | 'pending' | 'requires_approval' | 'skipped';
  entityType?: string | null;
  entityId?: string | null;
  details?: Record<string, any>;
  userId: string;
  teamId?: string | null;
  organizationId?: string | null;
  admin?: boolean;
}): Promise<AgentActivityRecord> {
  const client = getClient(activity.admin);
  const { data, error } = await client
    .from('agent_activity')
    .insert({
      agent_type: activity.agentType,
      action_type: activity.actionType,
      status: activity.status,
      entity_type: activity.entityType || null,
      entity_id: activity.entityId || null,
      details: activity.details || {},
      user_id: activity.userId,
      team_id: activity.teamId || null,
      organization_id: activity.organizationId || null,
    })
    .select('*')
    .single();

  if (error) throw new Error(`Failed to log agent activity: ${error.message}`);
  return data as AgentActivityRecord;
}

export async function fetchAgentActivity(params: {
  agentType?: string;
  userId?: string;
  teamId?: string | null;
  organizationId?: string | null;
  limit?: number;
  admin?: boolean;
}): Promise<AgentActivityRecord[]> {
  const client = getClient(params.admin);
  let query = client.from('agent_activity').select('*');

  if (params.agentType) {
    query = query.eq('agent_type', params.agentType);
  }
  if (params.organizationId) {
    query = query.eq('organization_id', params.organizationId);
  } else if (params.teamId) {
    query = query.eq('team_id', params.teamId);
  } else if (params.userId) {
    query = query.eq('user_id', params.userId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(params.limit || 50);

  if (error) throw new Error(`Failed to fetch agent activity: ${error.message}`);
  return (data || []) as AgentActivityRecord[];
}
