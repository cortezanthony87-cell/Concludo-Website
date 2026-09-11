export type TranscriptSourceType = 'pasted' | 'manual' | 'imported_later';

export interface Transcript {
  id: string;
  project_id: string;
  user_id: string;
  raw_text: string;
  speaker_labels_detected: boolean;
  source_type: TranscriptSourceType;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SaveTranscriptInput {
  project_id: string;
  raw_text: string;
  source_type?: TranscriptSourceType;
}

export interface UpdateTranscriptInput {
  raw_text: string;
  source_type?: TranscriptSourceType;
}
