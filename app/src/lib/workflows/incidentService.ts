import { WorkflowIncidentRecord, WorkflowIncidentSeverity, WorkflowIncidentStatus } from './types';
import { redactSensitiveData } from './auditService';

const INCIDENT_STORE: Map<string, WorkflowIncidentRecord> = new Map();

/**
 * Creates and registers a new workflow incident with strict redaction of sensitive credentials and data.
 */
export async function createIncident(params: {
  organizationId: string;
  workflowId: string;
  workflowName?: string;
  versionNumber?: number;
  runId?: string | null;
  connector?: string | null;
  stepKey: string;
  severity: WorkflowIncidentSeverity;
  summary: string;
  technicalClassification: string;
  customerSafeExplanation: string;
  errorMessage: string;
  dataAffected?: string[];
  objectsAffected?: string[];
  ownerId?: string | null;
}): Promise<WorkflowIncidentRecord> {
  const incidentId = `inc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const now = new Date().toISOString();

  // Apply sensitive-data redaction before persistence
  const sanitizedSummary = redactSensitiveData(params.summary);
  const sanitizedErrorMessage = redactSensitiveData(params.errorMessage);
  const sanitizedCustomerExplanation = redactSensitiveData(params.customerSafeExplanation);
  const sanitizedDataAffected = params.dataAffected ? redactSensitiveData(params.dataAffected) : [];
  const sanitizedObjectsAffected = params.objectsAffected ? redactSensitiveData(params.objectsAffected) : [];

  const incident: WorkflowIncidentRecord = {
    id: incidentId,
    incidentNumber: INCIDENT_STORE.size + 101,
    organizationId: params.organizationId,
    workflowId: params.workflowId,
    workflowName: params.workflowName || 'Workflow',
    versionNumber: params.versionNumber || 1,
    runId: params.runId,
    connector: params.connector,
    stepKey: params.stepKey,
    severity: params.severity,
    status: 'open',
    summary: sanitizedSummary,
    technicalClassification: params.technicalClassification,
    customerSafeExplanation: sanitizedCustomerExplanation,
    errorMessage: sanitizedErrorMessage,
    dataAffected: sanitizedDataAffected,
    objectsAffected: sanitizedObjectsAffected,
    containmentStatus: 'none',
    ownerId: params.ownerId || null,
    firstDetected: now,
    lastDetected: now,
    timeline: [
      {
        timestamp: now,
        note: `Incident opened: ${sanitizedSummary}`,
        actor: 'System Monitoring',
      },
    ],
  };

  INCIDENT_STORE.set(incidentId, incident);
  return incident;
}

/**
 * Acknowledges an incident.
 */
export function acknowledgeIncident(incidentId: string, actor: string): WorkflowIncidentRecord {
  const inc = INCIDENT_STORE.get(incidentId);
  if (!inc) throw new Error(`Incident '${incidentId}' not found.`);

  inc.status = 'acknowledged';
  inc.timeline?.push({
    timestamp: new Date().toISOString(),
    note: 'Incident acknowledged by administrator.',
    actor,
  });

  return inc;
}

/**
 * Resolves an incident with root cause and preventive action documentation.
 */
export function resolveIncident(
  incidentId: string,
  actor: string,
  resolution: { rootCause: string; preventiveAction: string; notes?: string }
): WorkflowIncidentRecord {
  const inc = INCIDENT_STORE.get(incidentId);
  if (!inc) throw new Error(`Incident '${incidentId}' not found.`);

  const now = new Date().toISOString();
  inc.status = 'resolved';
  inc.containmentStatus = 'resolved';
  inc.rootCause = redactSensitiveData(resolution.rootCause);
  inc.preventiveAction = redactSensitiveData(resolution.preventiveAction);
  inc.resolutionNotes = redactSensitiveData(resolution.notes || 'Resolved');
  inc.resolvedAt = now;
  inc.resolvedBy = actor;
  inc.timeline?.push({
    timestamp: now,
    note: `Incident resolved: ${inc.rootCause}`,
    actor,
  });

  return inc;
}

/**
 * Queries incidents for an organization.
 */
export function getOrganizationIncidents(
  organizationId: string,
  statusFilter?: WorkflowIncidentStatus
): WorkflowIncidentRecord[] {
  const incidents = Array.from(INCIDENT_STORE.values()).filter((i) => i.organizationId === organizationId);
  if (statusFilter) {
    return incidents.filter((i) => i.status === statusFilter);
  }
  return incidents.sort((a, b) => new Date(b.firstDetected).getTime() - new Date(a.firstDetected).getTime());
}

/**
 * Exports an incident report formatted for compliance and post-mortem analysis.
 */
export function exportIncidentReport(incidentId: string): string {
  const inc = INCIDENT_STORE.get(incidentId);
  if (!inc) throw new Error(`Incident '${incidentId}' not found.`);

  return JSON.stringify(
    {
      reportTitle: `Post-Mortem Incident Report #${inc.incidentNumber}`,
      incidentId: inc.id,
      severity: inc.severity,
      organizationId: inc.organizationId,
      workflow: {
        id: inc.workflowId,
        name: inc.workflowName,
        version: inc.versionNumber,
      },
      failureContext: {
        stepKey: inc.stepKey,
        connector: inc.connector,
        technicalClassification: inc.technicalClassification,
        customerSafeExplanation: inc.customerSafeExplanation,
      },
      timing: {
        firstDetected: inc.firstDetected,
        lastDetected: inc.lastDetected,
        resolvedAt: inc.resolvedAt,
      },
      resolution: {
        rootCause: inc.rootCause,
        preventiveAction: inc.preventiveAction,
        notes: inc.resolutionNotes,
      },
      timeline: inc.timeline,
    },
    null,
    2
  );
}

/**
 * Clears incident store (for test suite cleanup).
 */
export function clearIncidentStore(): void {
  INCIDENT_STORE.clear();
}
