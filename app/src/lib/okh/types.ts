/**
 * Organisation Knowledge Hub (OKH) - TypeScript Domain Types
 * Concludo Pty Ltd. 21 October 2026.
 */

export type OkhConfidenceLevel = 'high' | 'moderate' | 'low';

export type OkhSourceType =
  | 'meeting'
  | 'document'
  | 'crm_record'
  | 'manual_entry'
  | 'derived';

export type OkhFieldType =
  | 'text'
  | 'long_text'
  | 'url'
  | 'number'
  | 'currency'
  | 'percentage'
  | 'date'
  | 'datetime'
  | 'year'
  | 'month'
  | 'boolean'
  | 'select'
  | 'multi_select'
  | 'multi_text'
  | 'address'
  | 'user'
  | 'computed';

export type OkhSectionKey =
  | 'overview'
  | 'customers'
  | 'products_services'
  | 'marketing'
  | 'sales'
  | 'customer_success'
  | 'operations'
  | 'strategy'
  | 'policies'
  | 'ai_layer';

export type OkhKnowledgeFreshness = 'current' | 'ageing' | 'stale';

export type OkhConfidentialityLevel =
  | 'public'
  | 'standard'
  | 'confidential'
  | 'restricted';

export type OkhEnrichmentStatus =
  | 'idle'
  | 'running'
  | 'review_pending'
  | 'completed'
  | 'failed';

export type OkhReviewAction = 'accepted' | 'rejected' | 'edited' | 'skipped';

export interface OkhFieldDefinition {
  id: string;
  section_key: OkhSectionKey;
  field_key: string;
  display_label: string;
  field_type: OkhFieldType;
  is_required: boolean;
  sort_order: number;
  select_options?: string[] | null;
  description?: string | null;
  is_ai_fillable: boolean;
  is_sensitive: boolean;
  computation_fn?: string | null;
}

export interface OkhHub {
  id: string;
  workspace_id: string;
  organisation_id: string;
  created_at: string;
  created_by: string;
  updated_at: string;
  completeness_score: number;
  required_field_count: number;
  filled_field_count: number;
  enrichment_status: OkhEnrichmentStatus;
  last_enrichment_at?: string | null;
  last_enrichment_by?: string | null;
  enrichment_doc_ids?: string[] | null;
  knowledge_freshness: OkhKnowledgeFreshness;
  confidentiality_level: OkhConfidentialityLevel;
  data_sharing_consent: boolean;
  recording_consent: boolean;
  agent_query_count: number;
  last_agent_query_at?: string | null;
  last_human_review_at?: string | null;
  human_override_count: number;
}

export interface OkhFieldValue {
  id: string;
  hub_id: string;
  field_def_id: string;
  section_key: OkhSectionKey;
  field_key: string;
  value: any;
  is_ai_generated: boolean;
  is_human_verified: boolean;
  confidence?: OkhConfidenceLevel | null;
  source_document?: string | null;
  source_location?: string | null;
  source_type?: OkhSourceType | null;
  source_doc_id?: string | null;
  created_at: string;
  updated_at: string;
  generated_at?: string | null;
  generated_by?: string | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  definition?: OkhFieldDefinition;
}

export interface OkhEnrichmentJob {
  id: string;
  hub_id: string;
  started_at: string;
  completed_at?: string | null;
  status: OkhEnrichmentStatus;
  triggered_by: string;
  scope: string;
  doc_ids_used?: string[] | null;
  crm_record_ids?: string[] | null;
  fields_proposed: number;
  fields_accepted: number;
  fields_rejected: number;
  fields_edited: number;
  error_message?: string | null;
  agent_run_id?: string | null;
}

export interface OkhProposal {
  id: string;
  job_id: string;
  hub_id: string;
  field_def_id: string;
  section_key: OkhSectionKey;
  field_key: string;
  proposed_value: any;
  confidence: OkhConfidenceLevel;
  source_document?: string | null;
  source_location?: string | null;
  source_type?: OkhSourceType | null;
  source_doc_id?: string | null;
  prior_value?: any;
  review_action?: OkhReviewAction | null;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
  final_value?: any;
  reviewer_note?: string | null;
  created_at: string;
  definition?: OkhFieldDefinition;
}

export interface OkhVersion {
  id: string;
  hub_id: string;
  version_number: number;
  captured_at: string;
  captured_by: string;
  capture_reason?: string | null;
  completeness_score: number;
  snapshot: Record<string, any>;
}

export interface OkhAuditLogEntry {
  id: string;
  hub_id: string;
  occurred_at: string;
  actor_id: string;
  actor_type: string;
  actor_label: string;
  action: string;
  field_def_id?: string | null;
  section_key?: OkhSectionKey | null;
  field_key?: string | null;
  old_value?: any;
  new_value?: any;
  metadata?: any;
}
