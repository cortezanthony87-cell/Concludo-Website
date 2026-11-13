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
}

export interface TimelinePayload {
  project: string;
  shortProject: string;
  source: string;
  exportedOn: string; // YYYY-MM-DD
  timezone: string; // e.g. 'Australia/Melbourne'
  actions: TimelineActionItem[];
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
