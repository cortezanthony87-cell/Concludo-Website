import { SupabaseClient } from '@supabase/supabase-js';
import { PurgeResult, RetentionPolicy, DEFAULT_RETENTION_POLICY } from './types';

/**
 * Executes the system-wide automated retention purge.
 * Requires Supabase Service Role client.
 *
 * Purge criteria:
 * deleted_at is not null AND purge_after < now()
 *
 * Permanently removes expired projects (and cascading child records) and expired outputs.
 */
export async function executeRetentionPurge(
  adminClient: SupabaseClient
): Promise<PurgeResult> {
  const { data, error } = await adminClient.rpc('purge_expired_records');

  if (error) {
    return {
      success: false,
      executed_at: new Date().toISOString(),
      purged_projects: 0,
      purged_outputs: 0,
      error: error.message,
    };
  }

  return {
    success: data?.success ?? true,
    executed_at: data?.executed_at ?? new Date().toISOString(),
    purged_projects: data?.purged_projects ?? 0,
    purged_outputs: data?.purged_outputs ?? 0,
  };
}

/**
 * Executes a user-scoped automated retention purge for records owned by the authenticated user.
 * Safe for authenticated client sessions. Honors RLS.
 */
export async function executeUserRetentionPurge(
  client: SupabaseClient
): Promise<PurgeResult> {
  const { data, error } = await client.rpc('purge_user_expired_records');

  if (error) {
    return {
      success: false,
      executed_at: new Date().toISOString(),
      purged_projects: 0,
      purged_outputs: 0,
      error: error.message,
    };
  }

  return {
    success: data?.success ?? true,
    executed_at: data?.executed_at ?? new Date().toISOString(),
    purged_projects: data?.purged_projects ?? 0,
    purged_outputs: data?.purged_outputs ?? 0,
    user_id: data?.user_id,
  };
}

/**
 * Returns the active workspace retention policy.
 */
export function getRetentionPolicy(): RetentionPolicy {
  return DEFAULT_RETENTION_POLICY;
}

/**
 * Future Team Retention Helper:
 * Evaluates effective retention window in days considering team override if present.
 * Standard default: 30 days.
 */
export function resolveRetentionWindow(options?: {
  retention_policy_days?: number;
  team_retention_override?: boolean;
}): number {
  if (options?.team_retention_override && options.retention_policy_days && options.retention_policy_days > 0) {
    return options.retention_policy_days;
  }
  return DEFAULT_RETENTION_POLICY.retention_policy_days;
}
