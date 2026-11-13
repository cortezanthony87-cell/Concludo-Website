export interface TimelineActionItem {
  id: string;
  title: string;
  owner?: string | null;
  due?: string | null;
  status: string;
  priority?: string | null;
  project?: string | null;
  project_id?: string | null;
  user_id?: string | null;
  b?: 'completed' | 'overdue' | 'today' | 'upcoming' | 'unscheduled';
  horizon?: string | null;
  dueText?: string | null;
  confidence?: string | null;
}

export interface TimelinePayload {
  project: string;
  shortProject: string;
  source: string;
  exportedOn: string; // YYYY-MM-DD
  timezone: string; // e.g. 'Australia/Melbourne'
  actions: TimelineActionItem[];
  // Meeting mode specific
  isMeetingMode?: boolean;
  meetingTitle?: string;
  meetingDate?: string; // YYYY-MM-DD
  meetingTime?: string; // e.g. '2:00 pm AEDT'
  meetingDuration?: string; // e.g. '45 min'
  reviewedBy?: string;
  nextMeeting?: {
    date?: string;
    time?: string;
    rawText?: string;
    mustProduce?: string;
  };
  openQuestions?: string[];
  activeSlides?: ('cover' | 'road' | 'weeks' | 'horizon' | 'attention' | 'nextMeeting' | 'progress')[];
}

export interface TimelineAssetBundle {
  cover: string;
  roadmap: string;
  grid: string;
  ridge: string;
  attention: string;
  close: string;
  logo: string;
}

export interface TimelineRenderOptions {
  fonts?: {
    head?: string;
    body?: string;
  };
  assets?: Partial<TimelineAssetBundle>;
  assigneesOrder?: string[];
}

export interface TimelineSaveResult {
  success: boolean;
  fileName: string;
  storagePath?: string | null;
  projectFileId?: string | null;
  outputRowCreated?: boolean;
  outputRowSkippedReason?: string | null;
  error?: string | null;
  blob?: Blob | null;
}

export interface MeetingTimelineEligibility {
  status: 'ready' | 'not_needed_no_actions' | 'not_needed_no_dates' | 'needs_one_more_date';
  openActionsCount: number;
  datedCount: number;
  undatedCount: number;
  hasNextMeetingDate: boolean;
  nextMeetingDate?: string;
  nextMeetingTime?: string;
  owners: string[];
  startDate?: string;
  endDate?: string;
  slides: ('cover' | 'road' | 'weeks' | 'horizon' | 'attention' | 'nextMeeting')[];
  slideCount: number;
  reason?: string;
}
