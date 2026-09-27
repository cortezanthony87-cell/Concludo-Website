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

export interface ConcludoReportPayload {
  document: DocumentInfo;
  tier?: SubscriptionTier;
  meeting: MeetingInfo;
  meta?: MetaItem[];
  counts?: CountItem[];
  notices?: string[];
  inputs?: InputsSection;
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
