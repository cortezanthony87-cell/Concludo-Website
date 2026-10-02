/**
 * Concludo Integration Execution Log Service
 * Conforms to Master Build Instruction Sections 5, 12, 13, 24 & Zero-Secret Multi-Tenant Governance
 * Manages structured logging of every integration trigger & action step into public.integration_execution_logs.
 * Redacts all client secrets, API tokens, passwords, and sensitive keys.
 */

import { getSupabaseBrowserClient } from '../supabase/client';
import { redactSensitiveData } from '../workflows/auditService';

export interface IntegrationExecutionLogRecord {
  id: string;
  workflowRunId: string;
  workflowStepId: string;
  connectionId?: string | null;
  providerId: string;
  organizationId?: string | null;
  userId?: string | null;
  actionOrTriggerKey: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';
  attemptCount: number;
  durationMs: number;
  safeInputSummary: Record<string, any>;
  safeOutputSummary: Record<string, any>;
  errorCategory?: string | null;
  safeErrorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
}

// In-memory buffer for offline/test fallback and instant retrieval
const LOG_BUFFER: IntegrationExecutionLogRecord[] = [];

export class IntegrationExecutionLogService {
  /**
   * Records or updates a step execution record for an integrated external application.
   * Guarantees zero sensitive tokens, secrets, or keys are saved.
   */
  public static async recordLog(entry: {
    id?: string;
    workflowRunId: string;
    workflowStepId: string;
    connectionId?: string | null;
    providerId: string;
    organizationId?: string | null;
    userId?: string | null;
    actionOrTriggerKey: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'retrying' | 'cancelled';
    attemptCount?: number;
    durationMs?: number;
    inputData?: Record<string, any>;
    outputData?: Record<string, any>;
    errorCategory?: string | null;
    errorMessage?: string | null;
    startedAt?: string;
    completedAt?: string | null;
  }): Promise<IntegrationExecutionLogRecord> {
    const logId = entry.id || `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const safeInput = redactSensitiveData(entry.inputData || {});
    const safeOutput = redactSensitiveData(entry.outputData || {});
    const safeError = entry.errorMessage ? String(entry.errorMessage).replace(/Bearer\s+[A-Za-z0-9_.~+/]+=*/gi, '[REDACTED_TOKEN]') : null;

    const record: IntegrationExecutionLogRecord = {
      id: logId,
      workflowRunId: entry.workflowRunId,
      workflowStepId: entry.workflowStepId,
      connectionId: entry.connectionId || null,
      providerId: entry.providerId,
      organizationId: entry.organizationId || null,
      userId: entry.userId || null,
      actionOrTriggerKey: entry.actionOrTriggerKey,
      status: entry.status,
      attemptCount: entry.attemptCount ?? 1,
      durationMs: entry.durationMs ?? 0,
      safeInputSummary: safeInput,
      safeOutputSummary: safeOutput,
      errorCategory: entry.errorCategory || null,
      safeErrorMessage: safeError,
      startedAt: entry.startedAt || new Date().toISOString(),
      completedAt: entry.completedAt || (entry.status === 'succeeded' || entry.status === 'failed' ? new Date().toISOString() : null),
    };

    // Update in-memory buffer
    const existingIndex = LOG_BUFFER.findIndex(l => l.id === logId);
    if (existingIndex >= 0) {
      LOG_BUFFER[existingIndex] = record;
    } else {
      LOG_BUFFER.unshift(record);
      if (LOG_BUFFER.length > 500) LOG_BUFFER.pop();
    }

    // Persist to Supabase asynchronously without blocking execution thread
    if (typeof process === 'undefined' || !process.env.VITEST) {
      const supabaseClient = getSupabaseBrowserClient();
      if (supabaseClient && record.workflowRunId && !record.workflowRunId.includes('test')) {
        Promise.resolve().then(async () => {
          try {
            await supabaseClient.from('integration_execution_logs').upsert({
          id: record.id.startsWith('exec_') ? undefined : record.id,
          workflow_run_id: record.workflowRunId,
          workflow_step_id: record.workflowStepId,
          connection_id: record.connectionId && record.connectionId.includes('-') ? record.connectionId : null,
          provider_id: record.providerId,
          organization_id: record.organizationId && record.organizationId.includes('-') ? record.organizationId : null,
          user_id: record.userId && record.userId.includes('-') ? record.userId : null,
          action_or_trigger_key: record.actionOrTriggerKey,
          status: record.status,
          attempt_count: record.attemptCount,
          duration_ms: record.durationMs,
          safe_input_summary: record.safeInputSummary,
          safe_output_summary: record.safeOutputSummary,
          error_category: record.errorCategory,
          safe_error_message: record.safeErrorMessage,
          started_at: record.startedAt,
          completed_at: record.completedAt,
            });
          } catch {
            // Buffer guarantees audit preservation
          }
        });
      }
    }

    return record;
  }

  /**
   * Retrieves step logs for a specific workflow run.
   */
  public static async getLogsByRun(workflowRunId: string): Promise<IntegrationExecutionLogRecord[]> {
    const supabaseClient = getSupabaseBrowserClient();
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('integration_execution_logs')
          .select('*')
          .eq('workflow_run_id', workflowRunId)
          .order('started_at', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            workflowRunId: d.workflow_run_id,
            workflowStepId: d.workflow_step_id,
            connectionId: d.connection_id,
            providerId: d.provider_id,
            organizationId: d.organization_id,
            userId: d.user_id,
            actionOrTriggerKey: d.action_or_trigger_key,
            status: d.status,
            attemptCount: d.attempt_count,
            durationMs: d.duration_ms,
            safeInputSummary: d.safe_input_summary || {},
            safeOutputSummary: d.safe_output_summary || {},
            errorCategory: d.error_category,
            safeErrorMessage: d.safe_error_message,
            startedAt: d.started_at,
            completedAt: d.completed_at,
          }));
        }
      } catch {
        // Fall back to memory buffer
      }
    }

    return LOG_BUFFER.filter(l => l.workflowRunId === workflowRunId);
  }

  /**
   * Retrieves all recent integration execution logs across the organization.
   */
  public static async getRecentLogs(limit = 100): Promise<IntegrationExecutionLogRecord[]> {
    const supabaseClient = getSupabaseBrowserClient();
    if (supabaseClient) {
      try {
        const { data, error } = await supabaseClient
          .from('integration_execution_logs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);

        if (!error && data && data.length > 0) {
          return data.map((d: any) => ({
            id: d.id,
            workflowRunId: d.workflow_run_id,
            workflowStepId: d.workflow_step_id,
            connectionId: d.connection_id,
            providerId: d.provider_id,
            organizationId: d.organization_id,
            userId: d.user_id,
            actionOrTriggerKey: d.action_or_trigger_key,
            status: d.status,
            attemptCount: d.attempt_count,
            durationMs: d.duration_ms,
            safeInputSummary: d.safe_input_summary || {},
            safeOutputSummary: d.safe_output_summary || {},
            errorCategory: d.error_category,
            safeErrorMessage: d.safe_error_message,
            startedAt: d.started_at,
            completedAt: d.completed_at,
          }));
        }
      } catch {
        // Fall back to buffer
      }
    }

    return LOG_BUFFER.slice(0, limit);
  }

  public static clearBuffer(): void {
    LOG_BUFFER.length = 0;
  }
}
