export interface DecisionRecord {
  id: string;
  user_id: string;
  project_id: string;
  decision_title: string;
  decision_summary: string | null;
  decision_reasoning: string | null;
  decision_owner: string | null;
  decision_date: string | null;
  source_output_id: string | null;
  ownership_type?: 'personal' | 'team';
  team_id?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
  purge_after: string | null;
  projects?: {
    id: string;
    title: string;
    client_name?: string | null;
    project_name?: string | null;
    meeting_date?: string | null;
    deleted_at?: string | null;
    ownership_type?: 'personal' | 'team';
    team_id?: string | null;
  } | null;
  outputs?: {
    id: string;
    output_type: string;
    content?: string | null;
  } | null;
}

export interface CreateDecisionInput {
  project_id: string;
  decision_title: string;
  decision_summary?: string | null;
  decision_reasoning?: string | null;
  decision_owner?: string | null;
  decision_date?: string | null;
  source_output_id?: string | null;
  ownership_type?: 'personal' | 'team';
  team_id?: string | null;
}

export interface UpdateDecisionInput {
  decision_title?: string;
  decision_summary?: string | null;
  decision_reasoning?: string | null;
  decision_owner?: string | null;
  decision_date?: string | null;
  ownership_type?: 'personal' | 'team';
  team_id?: string | null;
}
