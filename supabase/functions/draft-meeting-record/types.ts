// Shared TypeScript types for draft-meeting-record

export interface ParticipantInput {
  name: string;
  organisation?: string | null;
  role?: string | null;
  joined?: string | null;
}

export interface DecisionInput {
  text: string;
  decided_by?: string | null;
  conditions?: string | null;
  at?: string | null;
  source_quote: string;
}

export interface ActionInput {
  text: string;
  owner?: string | null;
  owner_basis?: string | null;
  due_date?: string | null;
  due_raw?: string | null;
  due_approximate?: boolean;
  done_when?: string | null;
  at?: string | null;
  confidence?: string | null;
  source_quote: string;
}

export interface OpenQuestionInput {
  text: string;
  question?: string;
  raised_by?: string | null;
  resolver?: string | null;
  who_can_answer?: string | null;
  status?: string | null;
  needed_by?: string | null;
  needed_by_raw?: string | null;
  at?: string | null;
  source_quote: string;
}

export interface RiskInput {
  text: string;
  risk?: string;
  raised_by?: string | null;
  rating?: string | null;
  suggested_response?: string | null;
  mitigation?: string | null;
  at?: string | null;
  source_quote: string;
}

export interface NextMeetingInput {
  summary?: string | null;
  date?: string | null;
  time?: string | null;
  raw_text?: string | null;
}

export interface RawRecord {
  schema_version?: string;
  drafting_method?: 'model' | 'basic';
  meta?: any;
  participants?: ParticipantInput[];
  consent?: any;
  summary?: any;
  topics?: any[];
  decisions?: DecisionInput[];
  actions?: ActionInput[];
  open_questions?: OpenQuestionInput[];
  insights?: any[];
  risks?: RiskInput[];
  statements_to_verify?: any[];
  next_meeting?: NextMeetingInput | null;
  entities?: any[];
  flags?: string[];
}

export interface ValidatedDecision {
  text: string;
  decided_by: string | null;
  conditions: string | null;
  at?: string | null;
  source_quote: string;
}

export interface ValidatedAction {
  text: string;
  owner: string | null;
  owner_basis?: string | null;
  due_date: string | null;
  due_raw: string | null;
  due_approximate: boolean;
  status: string;
  done_when: string | null;
  at?: string | null;
  confidence?: string | null;
  source_quote: string;
}

export interface ValidatedOpenQuestion {
  text: string;
  raised_by: string | null;
  resolver: string | null;
  who_can_answer?: string | null;
  status?: string | null;
  needed_by: string | null;
  needed_by_raw: string | null;
  at?: string | null;
  source_quote: string;
}

export interface ValidatedRisk {
  text: string;
  raised_by: string | null;
  rating?: string | null;
  mitigation: string | null;
  suggested_response?: string | null;
  at?: string | null;
  source_quote: string;
}

export interface ValidatedRecord {
  schema_version?: string;
  drafting_method?: 'model' | 'basic';
  meta?: any;
  participants: Array<{ name: string; organisation: string | null; role?: string | null }>;
  consent?: any;
  summary?: any;
  topics?: any[];
  decisions: ValidatedDecision[];
  actions: ValidatedAction[];
  open_questions: ValidatedOpenQuestion[];
  insights?: any[];
  risks: ValidatedRisk[];
  statements_to_verify?: any[];
  next_meeting: NextMeetingInput | null;
  entities?: any[];
  flags: string[];
}

export interface ValidationResult {
  validated: ValidatedRecord;
  totalProposedItems: number;
  droppedCount: number;
  dropRatio: number;
  dateNulledCount: number;
  ownerNulledCount: number;
  redactionCount: number;
  rejectedDueToThreshold: boolean;
  dropDetails: Array<{ kind: string; text: string; reason: string; quote: string }>;
}
