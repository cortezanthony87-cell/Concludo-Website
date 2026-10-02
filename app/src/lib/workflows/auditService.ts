import { WorkflowAuditEvent, WorkflowAuditEventType } from './types';

// Sensitive keys that must be redacted from audit logs and objects
const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /authorization/i,
  /key/i,
  /credential/i,
  /ssn/i,
  /card/i,
  /cvv/i,
  /cookie/i,
];

// Inline string patterns for known token formats, API keys, passwords, bearer tokens
const SENSITIVE_STRING_PATTERNS = [
  /Bearer\s+[A-Za-z0-9_\-\.~+/]+=*/gi,
  /sk_live_[0-9a-zA-Z]{20,}/g,
  /sk_test_[0-9a-zA-Z]{20,}/g,
  /xox[baprs]-[0-9a-zA-Z]{9,}-[0-9a-zA-Z]{9,}-[0-9a-zA-Z]{20,}/g,
  /gh[pous]_[0-9a-zA-Z]{36}/g,
  /pat_[0-9a-zA-Z]{20,}/g,
  /ya29\.[0-9a-zA-Z_\-]{30,}/g,
  /pwd_[0-9a-zA-Z!@#$%^&*]{8,}/g,
];

/**
 * Redacts known secret patterns found within arbitrary strings.
 */
export function redactSensitiveString(str: string): string {
  let result = str;
  for (const pattern of SENSITIVE_STRING_PATTERNS) {
    result = result.replace(pattern, '[REDACTED_SECRET]');
  }
  return result;
}

/**
 * Recursively redacts sensitive values and inline credentials from objects and strings.
 */
export function redactSensitiveData(data: any): any {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === 'string') {
    return redactSensitiveString(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => redactSensitiveData(item));
  }

  if (typeof data === 'object') {
    const redacted: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const isSensitiveKey = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
      if (isSensitiveKey) {
        redacted[key] = '[REDACTED_SECRET]';
      } else {
        redacted[key] = redactSensitiveData(value);
      }
    }
    return redacted;
  }

  return data;
}

// In-memory audit buffer for testing and runtime exploration
const AUDIT_BUFFER: WorkflowAuditEvent[] = [];

/**
 * Records a standardized workflow audit event with automatic redaction of secrets.
 */
export async function recordWorkflowAuditEvent(event: WorkflowAuditEvent): Promise<WorkflowAuditEvent> {
  const sanitizedMetadata = redactSensitiveData(event.metadata || {});

  const auditEntry: WorkflowAuditEvent = {
    ...event,
    id: event.id || `audit_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    metadata: sanitizedMetadata,
    createdAt: event.createdAt || new Date().toISOString(),
  };

  AUDIT_BUFFER.unshift(auditEntry);
  if (AUDIT_BUFFER.length > 500) {
    AUDIT_BUFFER.pop();
  }

  return auditEntry;
}

/**
 * Retrieves audit events filtered by organization, workflow, or event type.
 */
export function queryWorkflowAudits(filters: {
  organizationId: string;
  workflowId?: string;
  eventType?: WorkflowAuditEventType;
  actorId?: string;
  limit?: number;
}): WorkflowAuditEvent[] {
  let results = AUDIT_BUFFER.filter((e) => e.organizationId === filters.organizationId);

  if (filters.workflowId) {
    results = results.filter((e) => e.workflowId === filters.workflowId);
  }
  if (filters.eventType) {
    results = results.filter((e) => e.eventType === filters.eventType);
  }
  if (filters.actorId) {
    results = results.filter((e) => e.actorId === filters.actorId);
  }

  return results.slice(0, filters.limit || 50);
}

/**
 * Clears the in-memory audit buffer (primarily for test suite resets).
 */
export function clearAuditBuffer(): void {
  AUDIT_BUFFER.length = 0;
}
