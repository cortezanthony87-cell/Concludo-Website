export type OutputType =
  | 'summary'
  | 'action_items'
  | 'follow_up_email'
  | 'decision_log'
  | 'action_plan'
  | 'endpoint_report';

export const OUTPUT_TYPE_LABELS: Record<OutputType, string> = {
  summary: 'Summary',
  action_items: 'Action Items',
  follow_up_email: 'Follow-up Email',
  decision_log: 'Decision Log',
  action_plan: 'Action Plan',
  endpoint_report: 'Endpoint Report'
};

export const ALLOWED_OUTPUT_TYPES: OutputType[] = [
  'summary',
  'action_items',
  'follow_up_email',
  'decision_log',
  'action_plan',
  'endpoint_report'
];

export interface OutputRecord {
  id: string;
  project_id: string;
  user_id: string;
  output_type: OutputType;
  content: string | null;
  json_content: any | null;
  model_used: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SaveOutputInput {
  project_id: string;
  output_type: OutputType;
  content?: string;
  json_content?: any;
  model_used?: string;
}

export interface UpdateOutputInput {
  content?: string;
  json_content?: any;
  output_type?: OutputType;
}
