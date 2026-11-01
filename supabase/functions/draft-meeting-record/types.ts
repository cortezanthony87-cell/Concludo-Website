// Shared TypeScript types for draft-meeting-record

export interface ParticipantInput {
  name: string;
  organisation?: string | null;
}

export interface DecisionInput {
  text: string;
  decided_by?: string | null;
  conditions?: string | null;
  source_quote: string;
}

export interface ActionInput {
  text: string;
  owner?: string | null;
  due_date?: string | null;
  due_raw?: string | null;
  due_approximate?: boolean;
  done_when?: string | null;
  source_quote: string;
}

export interface OpenQuestionInput {
  text: string;
  resolver?: string | null;
  needed_by?: string | null;
  needed_by_raw?: string | null;
  source_quote: string;
}

export interface RiskInput {
  text: string;
  raised_by?: string | null;
  mitigation?: string | null;
  source_quote: string;
}

export interface NextMeetingInput {
  date: string;
  time?: string | null;
  raw_text?: string | null;
}

export interface RawRecord {
  participants?: ParticipantInput[];
  decisions?: DecisionInput[];
  actions?: ActionInput[];
  open_questions?: OpenQuestionInput[];
  risks?: RiskInput[];
  next_meeting?: NextMeetingInput | null;
  flags?: string[];
}

export interface ValidatedDecision {
  text: string;
  decided_by: string | null;
  conditions: string | null;
  source_quote: string;
}

export interface ValidatedAction {
  text: string;
  owner: string | null;
  due_date: string | null;
  due_raw: string | null;
  due_approximate: boolean;
  status: string;
  done_when: string | null;
  source_quote: string;
}

export interface ValidatedOpenQuestion {
  text: string;
  resolver: string | null;
  needed_by: string | null;
  needed_by_raw: string | null;
  source_quote: string;
}

export interface ValidatedRisk {
  text: string;
  raised_by: string | null;
  mitigation: string | null;
  source_quote: string;
}

export interface ValidatedRecord {
  participants: Array<{ name: string; organisation: string | null }>;
  decisions: ValidatedDecision[];
  actions: ValidatedAction[];
  open_questions: ValidatedOpenQuestion[];
  risks: ValidatedRisk[];
  next_meeting: NextMeetingInput | null;
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
