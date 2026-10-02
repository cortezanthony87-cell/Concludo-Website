import { WorkflowProvenanceRecord } from './types';

const PROVENANCE_STORE: Map<string, WorkflowProvenanceRecord> = new Map();

/**
 * Records source provenance for a created or modified resource.
 */
export async function recordSourceProvenance(record: WorkflowProvenanceRecord): Promise<WorkflowProvenanceRecord> {
  const provenance: WorkflowProvenanceRecord = {
    ...record,
    id: record.id || `prov_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: record.createdAt || new Date().toISOString(),
  };

  const key = `${record.resourceType}:${record.resourceId}`;
  PROVENANCE_STORE.set(key, provenance);
  return provenance;
}

/**
 * Retrieves the provenance record for a specific resource.
 */
export function getSourceProvenance(resourceType: string, resourceId: string): WorkflowProvenanceRecord | null {
  return PROVENANCE_STORE.get(`${resourceType}:${resourceId}`) || null;
}

/**
 * Formats a plain-language explanation of where a resource originated.
 */
export function explainProvenance(resourceType: string, resourceId: string): string {
  const record = getSourceProvenance(resourceType, resourceId);
  if (!record) {
    return 'Origin metadata is not recorded for this resource.';
  }

  switch (record.sourceType) {
    case 'meeting_transcript':
      return `Derived from Meeting '${record.sourceId}' (Transcript reference: ${record.sourceLocation || 'Full transcript'}) processed by ${record.agentId || 'Concludo AI Agent'} under Workflow v${record.workflowVersion}.`;
    case 'document':
      return `Extracted from Document '${record.sourceId}' (Section: ${record.sourceLocation || 'General content'}) via Workflow v${record.workflowVersion}.`;
    case 'crm_deal':
      return `Synchronized from CRM Deal '${record.sourceId}' retrieved via live connector under Workflow v${record.workflowVersion}.`;
    case 'webhook_payload':
      return `Triggered by inbound verified Webhook event '${record.sourceId}' under Workflow v${record.workflowVersion}.`;
    default:
      return `Created by Workflow v${record.workflowVersion} from ${record.sourceType}.`;
  }
}

/**
 * Clears provenance store for test resets.
 */
export function clearProvenanceStore(): void {
  PROVENANCE_STORE.clear();
}
