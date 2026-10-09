export interface DocumentInfo {
  kind: string;
  title?: string;
  subject?: string;
  footer_label: string;
  classification?: string;
}

export type SubscriptionTier = 'starter' | 'pro' | 'team' | null;

export interface MeetingInfo {
  kicker?: string;
  title_lines?: string[];
  accent_line?: string;
  subtitle?: string;
}

export interface MetaItem {
  label: string;
  value: string;
  note?: string;
}

export interface CountItem {
  label: string;
  value: string;
}

export interface RegisterSection {
  title?: string;
  intro?: string;
  size?: number;
  columns?: string[];
  widths?: number[];
  rows: string[][];
  stats_title?: string;
  stats?: [string, string][];
  callout?: {
    title: string;
    lines: string[];
  };
}

export interface ExecutivePoint {
  label: string;
  text: string;
  evidence?: string;
}

export interface ExecutiveSection {
  title?: string;
  intro?: string;
  points?: ExecutivePoint[];
}

export interface InputsSection {
  title?: string;
  intro?: string;
  columns?: string[];
  widths?: number[];
  rows?: string[][];
  gaps_title?: string;
  gaps?: string[];
  conflict?: {
    title: string;
    lines: string[];
  };
}

export interface RecommendationItem {
  title: string;
  why: string;
}

export interface RecommendationBand {
  label: 'Critical' | 'High' | 'Medium' | 'Low';
  items: RecommendationItem[];
}

export interface RecommendationsSection {
  title?: string;
  intro?: string;
  bands?: RecommendationBand[];
}

export interface HealthDimension {
  name: string;
  score: number | null;
  note?: string;
}

export interface HealthSection {
  title?: string;
  intro?: string;
  dimensions?: HealthDimension[];
  verdict?: {
    headline: string;
    note: string;
  };
}

export interface ClosingSection {
  title?: string;
  intro?: string;
  items?: [string, string][];
  audit_title?: string;
  audit?: [string, string][];
  gate?: {
    status: 'Pass' | 'Conditional pass' | 'Fail';
    note: string;
  };
}

export interface DocumentRoutingNotAnalysed {
  name: string;
  document_class?: string;
  reason:
    | 'not_discussed'
    | 'reference_only_class'
    | 'not_supplied'
    | 'unreadable'
    | 'protected_or_corrupt'
    | 'excluded_by_user'
    | 'already_analysed_unchanged'
    | 'class_unknown';
}

export interface DocumentRoutingSection {
  stage_reached: 'detect' | 'qualify' | 'explain';
  document_detected: boolean;
  detection_source?: Array<'project' | 'meeting' | 'transcript_reference'>;
  documents_found: number;
  documents_supplied: number;
  meeting_type:
    | 'contract_or_negotiation'
    | 'decision_or_approval'
    | 'board_or_governance'
    | 'project_or_delivery'
    | 'client_or_sales'
    | 'finance_or_budget'
    | 'status_or_standup'
    | 'onboarding_or_training'
    | 'unclear';
  meeting_type_inferred: boolean;
  not_analysed?: DocumentRoutingNotAnalysed[];
  agent_error?: string | null;
}

export interface DocumentNearestDate {
  date: string;
  event: string;
  basis: 'explicit' | 'inferred';
}

export interface DocumentProfessionalReview {
  profession: string;
  question: string;
  before_proceeding?: boolean;
  give_them?: string;
  ask_them?: string;
}

export interface DocumentBriefSection {
  document_name: string;
  document_class: string;
  status: 'draft' | 'unsigned' | 'signed' | 'executed' | 'final' | 'amended' | 'superseded' | 'extract' | 'unknown';
  document_date?: string | null;
  what_it_requires: string;
  nearest_date?: DocumentNearestDate | null;
  most_significant_risk?: string;
  professional_review?: DocumentProfessionalReview | null;
  evidence_label: string;
  notice?: string;
}

export interface DocumentParty {
  name: string;
  identifier?: string | null;
  role: string;
  is_our_organisation?: boolean;
}

export interface DocumentDiscussedItem {
  reference: string;
  what_it_says: string;
  what_it_means: string;
  why_it_matters?: string;
  transcript_anchor?: string | null;
  evidence_label: string;
}

export interface DocumentObligation {
  party?: string;
  obligation: string;
  by_when?: string | null;
  consequence_if_missed?: string;
  reference?: string;
}

export interface DocumentExplicitDate {
  date: string;
  event: string;
  notice_period?: string | null;
  reference: string;
}

export interface DocumentInferredDate {
  date: string;
  reason: string;
  requires_confirmation: boolean;
}

export interface DocumentAmount {
  amount: string;
  purpose: string;
  basis: 'stated' | 'calculated';
  working?: string | null;
  timing?: string | null;
  tax_treatment?: string | null;
  reference?: string;
}

export interface DocumentRiskItem {
  rating: 'critical' | 'high' | 'medium' | 'low' | 'informational';
  issue: string;
  reference: string;
  why_it_matters: string;
  who_carries_it?: string | null;
  recommended_response?: string;
}

export interface DocumentConflict {
  statement_a: string;
  location_a: string;
  statement_b: string;
  location_b: string;
  consequence: string;
}

export interface DocumentCoverage {
  reviewed: string;
  not_reviewed: string;
  limitation?: string | null;
}

export interface DocumentIntelligenceSection {
  document_name: string;
  document_class: string[];
  status: string;
  parties?: DocumentParty[];
  jurisdiction?: string | null;
  governing_law?: string | null;
  currency?: string | null;
  tax_treatment?: string | null;
  discussed_in_meeting?: DocumentDiscussedItem[];
  obligations?: DocumentObligation[];
  explicit_dates?: DocumentExplicitDate[];
  inferred_dates?: DocumentInferredDate[];
  amounts?: DocumentAmount[];
  risks?: DocumentRiskItem[];
  decisions_made?: string[];
  decisions_required?: string[];
  missing?: string[];
  conflicts?: DocumentConflict[];
  verify_with?: DocumentProfessionalReview[];
  coverage: DocumentCoverage;
  third_party_document?: boolean;
  notice: string;
}

export interface ConcludoReportPayload {
  document: DocumentInfo;
  tier?: SubscriptionTier;
  meeting: MeetingInfo;
  meta?: MetaItem[];
  counts?: CountItem[];
  notices?: string[];
  inputs?: InputsSection;
  document_routing?: DocumentRoutingSection;
  document_brief?: DocumentBriefSection;
  document_intelligence?: DocumentIntelligenceSection;
  executive?: ExecutiveSection;
  meeting_summary?: RegisterSection;
  decisions?: RegisterSection;
  actions?: RegisterSection;
  risks?: RegisterSection;
  recommendations?: RecommendationsSection;
  health?: HealthSection;
  closing?: ClosingSection;
  board_report?: any;
  [key: string]: any;
}
