import { SupabaseClient } from '@supabase/supabase-js';
import { logAuditEvent, fetchAuditLogs as fetchAuditLogsBase } from './enterpriseClient';
import { getSupabaseAdminClient } from '../supabase/admin';
import { getSupabaseBrowserClient } from '../supabase/client';
import { AuditActionType, AuditLog } from './types';

export async function recordAuditLog(params: {
  action: AuditActionType | string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, any>;
  userId?: string | null;
  organizationId?: string | null;
  ipAddress?: string;
  admin?: boolean;
}): Promise<{ success: boolean; error: Error | null }> {
  let client: SupabaseClient = getSupabaseBrowserClient();
  if (params.admin) {
    try {
      client = getSupabaseAdminClient();
    } catch {
      client = getSupabaseBrowserClient();
    }
  }
  return logAuditEvent(client, {
    action: params.action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
    userId: params.userId,
    organizationId: params.organizationId,
    ipAddress: params.ipAddress,
  });
}

export async function fetchAuditLogs(
  filters?: {
    organizationId?: string;
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  },
  admin: boolean = false
): Promise<{ data: AuditLog[]; error: Error | null }> {
  let client: SupabaseClient = getSupabaseBrowserClient();
  if (admin) {
    try {
      client = getSupabaseAdminClient();
    } catch {
      client = getSupabaseBrowserClient();
    }
  }
  return fetchAuditLogsBase(client, filters);
}
