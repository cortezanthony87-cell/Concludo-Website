/**
 * Concludo Native Calendar Types
 * Authoritative spec: Concludo Calendar Handover Tasklet 2
 * Canonical Brand Tokens:
 * Navy: #16263F
 * Secondary Navy: #21395C
 * Gold: #E2B53C
 * Deep Gold: #BC8A1C
 * Light: #F4F6FA
 * White: #FFFFFF
 * Slate: #5A6478
 * Hairline: #D9DFE9
 */

export type CalendarItemType =
  | 'meeting'
  | 'task'
  | 'event'
  | 'milestone'
  | 'review'
  | 'follow_up'
  | 'board_action'
  | 'timeline_activity';

export type CalendarItemPriority = 'low' | 'medium' | 'high' | 'critical' | null;

export type CalendarItemStatus =
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'waiting'
  | 'blocked'
  | 'review'
  | 'completed'
  | 'cancelled';

export type ReviewType =
  | 'decision'
  | 'risk'
  | 'compliance'
  | 'audit'
  | 'governance'
  | 'strategy'
  | 'policy';

export type ReviewCadence = 'once' | 'monthly' | 'quarterly' | 'half_yearly' | 'yearly' | null;

export type CalendarVisibility = 'private' | 'assigned' | 'pending' | 'shared';

export interface CalendarItem {
  id: string;
  calendar_id?: string | null;
  creator_id: string;
  owner_id?: string | null;
  owner_name?: string | null;
  organization_id?: string | null;
  type: CalendarItemType;
  title: string;
  description?: string | null;
  notes?: string | null;
  reference?: string | null;
  priority?: CalendarItemPriority;
  status: CalendarItemStatus;
  status_reason?: string | null;
  due_date?: string | null; // YYYY-MM-DD
  due_time?: string | null; // HH:mm:ss
  date_inferred?: boolean;
  start_date?: string | null;
  end_date?: string | null;
  progress_percentage?: number | null;
  review_type?: ReviewType | null;
  review_cadence?: ReviewCadence | null;
  review_expires_on?: string | null;
  visibility: CalendarVisibility;
  source_type?: 'meeting' | 'report' | 'project' | 'decision_register' | 'risk_register' | 'board_paper' | 'other' | null;
  source_id?: string | null;
  source_title?: string | null;
  source_reference?: string | null;
  source_occurred_at?: string | null;
  project_id?: string | null;
  output_id?: string | null;
  idempotency_key?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

export interface CalendarSummaryCounts {
  overdue: number;
  unowned: number;
  undated: number;
  reviewsDue: number;
  totalOpen: number;
  todayCount: number;
}

export interface GenerateCalendarPayloadItem {
  type: CalendarItemType;
  reference: string;
  title: string;
  description?: string;
  owner?: {
    name: string;
    user_id?: string | null;
    stated: boolean;
  } | null;
  due_date?: string | null;
  due_time?: string | null;
  date_inferred?: boolean;
  priority?: CalendarItemPriority;
  status?: CalendarItemStatus;
  start_date?: string | null;
  end_date?: string | null;
  review?: {
    review_type: ReviewType;
    cadence?: ReviewCadence;
    expires_on?: string | null;
  } | null;
  related?: {
    meeting?: string | null;
    project?: string | null;
    risk?: string | null;
    decision?: string | null;
    report?: string | null;
  } | null;
}

export interface GenerateCalendarPayload {
  source: {
    type: 'meeting' | 'report' | 'project' | 'decision_register' | 'risk_register' | 'board_paper' | 'other';
    id: string;
    title: string;
    occurred_at?: string;
    record_reference?: string;
    project_id?: string | null;
    output_id?: string | null;
  };
  options: ('task' | 'event' | 'milestone' | 'review' | 'follow_up' | 'timeline' | 'everything')[];
  idempotency_key?: string;
  items: GenerateCalendarPayloadItem[];
}
