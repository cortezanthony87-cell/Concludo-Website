export interface Project {
  id: string;
  user_id: string;
  title: string;
  meeting_type: string | null;
  client_or_project: string | null;
  meeting_date: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  deleted_by?: string | null;
  purge_after?: string | null;
}

export interface CreateProjectInput {
  title: string;
  meeting_type?: string | null;
  client_or_project?: string | null;
  meeting_date?: string | null;
}

export interface UpdateProjectInput {
  title: string;
  meeting_type?: string | null;
  client_or_project?: string | null;
  meeting_date?: string | null;
}

export const COMMON_MEETING_TYPES = [
  'Strategy & Planning',
  'Client Consultation',
  'Operational Sync',
  'Executive Review',
  'Workshop Session',
  'One-on-One Check-in',
  'Quarterly Business Review',
  'Other'
] as const;
