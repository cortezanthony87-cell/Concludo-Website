/**
 * The Thread Intelligence workspace: selectors for the three columns and the
 * eight analysis tabs.
 *
 * The job of this file is to turn one thread and its analysis into exactly what
 * the workspace renders, and in particular to make SOURCE NAVIGATION work:
 * selecting an extracted action, deadline, decision or question has to point at
 * the message it came from and, where a quote was recorded, at the words inside
 * that message.
 *
 * Quotes are located in the message BODY only, never in the quoted history
 * beneath it. Matching inside quoted text would let an extraction appear to be
 * sourced from a message that merely repeated someone else's words.
 */
import {
  AccountDataset,
  Action,
  Attachment,
  Commitment,
  Conflict,
  Decision,
  Deadline,
  EmailMessage,
  FactToVerify,
  OpenQuestion,
  Risk,
  SourceRef,
  ThreadAnalysis,
  ThreadStatus,
} from './model';
import { ThreadRecord, recordsFor } from './filters';

/* ----------------------------------------------------------------- tabs */

export type IntelligenceTabKey =
  | 'overview'
  | 'actions'
  | 'decisions'
  | 'deadlines'
  | 'questions'
  | 'attachments'
  | 'draft'
  | 'risks';

export interface IntelligenceTab {
  key: IntelligenceTabKey;
  label: string;
  iconName: string;
  /** Used as the accessible description where the label is not enough. */
  description: string;
}

export const INTELLIGENCE_TABS: readonly IntelligenceTab[] = [
  { key: 'overview', label: 'Overview', iconName: 'LayoutDashboard', description: 'What this thread is and why it matters.' },
  { key: 'actions', label: 'Actions', iconName: 'ListChecks', description: 'Things to do, and who owes them.' },
  { key: 'decisions', label: 'Decisions', iconName: 'GitBranch', description: 'Decisions made, and decisions still required.' },
  { key: 'deadlines', label: 'Deadlines', iconName: 'CalendarClock', description: 'Dates stated in the thread, and dates worked out.' },
  { key: 'questions', label: 'Questions', iconName: 'CircleHelp', description: 'Questions asked, and whether they were answered.' },
  { key: 'attachments', label: 'Attachments', iconName: 'Paperclip', description: 'Files received, expected, or referred to but missing.' },
  { key: 'draft', label: 'Draft Reply', iconName: 'PenLine', description: 'The proposed reply and its review. Nothing is sent from here.' },
  { key: 'risks', label: 'Risks', iconName: 'ShieldAlert', description: 'What could go wrong, and how severe it is.' },
];

/** Counts for the tab badges. A tab with nothing in it says so rather than lying. */
export function tabCounts(analysis: ThreadAnalysis): Record<IntelligenceTabKey, number> {
  return {
    overview: 0,
    actions: analysis.actions.length,
    decisions: analysis.decisionsMade.length + analysis.decisionsRequired.length,
    deadlines: analysis.explicitDeadlines.length + analysis.suggestedDates.length,
    questions: analysis.openQuestions.length,
    attachments: analysis.attachments.length,
    draft: 0,
    risks: analysis.risks.length + (analysis.securityAlert ? 1 : 0),
  };
}

/* -------------------------------------------------------- source linking */

/**
 * A selectable extraction. Everything in the right column that can be clicked
 * to reveal where it came from is reduced to this.
 */
export interface SelectableExtraction {
  /** Unique within the thread. Used as the selection key and the DOM id. */
  id: string;
  kind: 'action' | 'deadline' | 'decision' | 'question' | 'commitment' | 'risk' | 'attachment' | 'fact' | 'conflict';
  /** The sources it cites. The first is the primary. */
  source: readonly SourceRef[];
}

export interface SourceLocation {
  messageId: string;
  /** Present when the extraction recorded a quote AND it was found in the body. */
  quote: string | null;
  /** Character offset of the quote in the message body, or null. */
  index: number | null;
  /**
   * Set when a quote was recorded but could not be located in the body. The
   * interface says so rather than silently highlighting nothing, because a
   * missing highlight looks like a broken click.
   */
  quoteNotFound: boolean;
}

/**
 * Resolves a source reference to a place in a message.
 *
 * Matching is exact first, then whitespace-insensitive, and nothing else. A
 * fuzzy match that lands on the wrong sentence is worse than no highlight: it
 * attributes a claim to words the sender did not write.
 */
export function locateSource(
  messages: readonly EmailMessage[],
  ref: SourceRef
): SourceLocation | null {
  const message = messages.find((m) => m.id === ref.messageId);
  if (!message) return null;

  if (!ref.quote) {
    return { messageId: message.id, quote: null, index: null, quoteNotFound: false };
  }

  const exact = message.body.indexOf(ref.quote);
  if (exact > -1) {
    return { messageId: message.id, quote: ref.quote, index: exact, quoteNotFound: false };
  }

  // The dataset wraps message bodies at a readable width, so a quote spanning a
  // line break will not match exactly. Compare with runs of whitespace treated
  // as equivalent, and map the hit back to an offset in the original text.
  const located = findIgnoringWhitespace(message.body, ref.quote);
  if (located) {
    return {
      messageId: message.id,
      quote: message.body.slice(located.start, located.end),
      index: located.start,
      quoteNotFound: false,
    };
  }

  return { messageId: message.id, quote: ref.quote, index: null, quoteNotFound: true };
}

function findIgnoringWhitespace(
  haystack: string,
  needle: string
): { start: number; end: number } | null {
  const targets = needle.trim().split(/\s+/);
  if (targets.length === 0) return null;

  const tokens: { text: string; index: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) tokens.push({ text: m[0], index: m.index });

  for (let i = 0; i + targets.length <= tokens.length; i += 1) {
    let ok = true;
    for (let j = 0; j < targets.length; j += 1) {
      const isLast = j === targets.length - 1;
      const token = tokens[i + j].text;
      // Interior words must match exactly. The final word may carry the
      // sentence's punctuation in the body while the recorded quote stops at
      // the word, so "get in" is allowed to match "get in." Found by the tests:
      // five quotes in the dataset end at a full stop or a comma, and all five
      // failed to locate before this.
      const matches = isLast ? token === targets[j] || token.startsWith(targets[j]) : token === targets[j];
      if (!matches) {
        ok = false;
        break;
      }
    }
    if (ok) {
      const last = tokens[i + targets.length - 1];
      // The highlight covers the quoted words only, never the trailing stop.
      return { start: tokens[i].index, end: last.index + targets[targets.length - 1].length };
    }
  }
  return null;
}

/** Every location an extraction points at, in order. */
export function locationsFor(
  messages: readonly EmailMessage[],
  extraction: SelectableExtraction
): SourceLocation[] {
  return extraction.source
    .map((ref) => locateSource(messages, ref))
    .filter((x): x is SourceLocation => x !== null);
}

/* ------------------------------------------------------ the overview tab */

/**
 * Facts, inferences and unknowns, separated.
 *
 * This separation is the whole point of the Overview tab. A reader needs to
 * know which of these the sender actually wrote, which the module worked out,
 * and which nobody knows yet. Collapsing them into one list of "insights" is
 * how an inference gets acted on as a fact.
 */
export interface OverviewEvidence {
  /** Stated in the thread. Quotable and attributable. */
  facts: { id: string; text: string; source: readonly SourceRef[] }[];
  /** Worked out by the module. Must be labelled wherever shown. */
  inferences: { id: string; text: string; source: readonly SourceRef[] }[];
  /** Nobody knows. Open questions, missing information, things to verify. */
  unknowns: { id: string; text: string; why: string }[];
  /** Two statements that cannot both be true. */
  conflicts: readonly Conflict[];
}

export function overviewEvidence(analysis: ThreadAnalysis): OverviewEvidence {
  const facts: OverviewEvidence['facts'] = [];
  const inferences: OverviewEvidence['inferences'] = [];

  const add = (id: string, text: string, basis: string, source: readonly SourceRef[]) => {
    if (basis === 'stated') facts.push({ id, text, source });
    else inferences.push({ id, text, source });
  };

  for (const d of analysis.explicitDeadlines) {
    add(d.id, `${d.description} Due ${d.dueAt}.`, 'stated', d.source);
  }
  for (const d of analysis.suggestedDates) {
    add(d.id, d.description, d.basis, d.source);
  }
  for (const a of analysis.actions) {
    add(a.id, a.description, a.basis, a.source);
  }
  for (const d of [...analysis.decisionsMade, ...analysis.decisionsRequired]) {
    add(d.id, d.description, d.basis, d.source);
  }
  for (const c of analysis.commitments) {
    add(c.id, c.description, c.basis, c.source);
  }

  const unknowns: OverviewEvidence['unknowns'] = [
    ...analysis.openQuestions
      .filter((q) => !q.answered)
      .map((q) => ({
        id: q.id,
        text: q.question,
        why: q.blockedBy ? `Blocked by: ${q.blockedBy}` : 'Asked, and not answered anywhere in the thread.',
      })),
    ...analysis.factsToVerify.map((f) => ({
      id: f.id,
      text: f.claim,
      why: `Not confirmed. ${f.howToVerify}`,
    })),
  ];

  return { facts, inferences, unknowns, conflicts: analysis.conflicts };
}

/* ------------------------------------------------- the whole workspace */

export interface ThreadDetail {
  record: ThreadRecord;
  messages: readonly EmailMessage[];
  analysis: ThreadAnalysis;
  accountLabel: string;
  accountType: 'work' | 'personal';
  status: ThreadStatus;
  evidence: OverviewEvidence;
  counts: Record<IntelligenceTabKey, number>;
  /** Everything selectable, keyed by id, for source navigation. */
  extractions: SelectableExtraction[];
}

/**
 * Loads one thread from one account.
 *
 * Returns null when the thread is not on this account. That is the account
 * isolation boundary for the whole workspace: a thread id from the work
 * account, pasted into a URL while the personal account is open, finds nothing.
 * It does not fall back to searching the other account.
 */
export function threadDetail(
  dataset: AccountDataset | null,
  threadId: string
): ThreadDetail | null {
  if (!dataset) return null;

  const record = recordsFor(dataset).find((r) => r.thread.id === threadId);
  if (!record) return null;

  const analysis = record.analysis;

  const extractions: SelectableExtraction[] = [
    ...analysis.actions.map((x: Action) => ({ id: x.id, kind: 'action' as const, source: x.source })),
    ...analysis.explicitDeadlines.map((x: Deadline) => ({ id: x.id, kind: 'deadline' as const, source: x.source })),
    ...analysis.suggestedDates.map((x: Deadline) => ({ id: x.id, kind: 'deadline' as const, source: x.source })),
    ...analysis.decisionsMade.map((x: Decision) => ({ id: x.id, kind: 'decision' as const, source: x.source })),
    ...analysis.decisionsRequired.map((x: Decision) => ({ id: x.id, kind: 'decision' as const, source: x.source })),
    ...analysis.openQuestions.map((x: OpenQuestion) => ({ id: x.id, kind: 'question' as const, source: x.source })),
    ...analysis.commitments.map((x: Commitment) => ({ id: x.id, kind: 'commitment' as const, source: x.source })),
    ...analysis.risks.map((x: Risk) => ({ id: x.id, kind: 'risk' as const, source: x.source })),
    ...analysis.attachments.map((x: Attachment) => ({ id: x.id, kind: 'attachment' as const, source: x.source })),
    ...analysis.factsToVerify.map((x: FactToVerify) => ({ id: x.id, kind: 'fact' as const, source: x.source })),
    ...analysis.conflicts.map((x: Conflict) => ({ id: x.id, kind: 'conflict' as const, source: x.source })),
  ];

  return {
    record,
    messages: record.messages,
    analysis,
    accountLabel: dataset.account.label,
    accountType: dataset.account.accountType,
    status: analysis.currentStatus,
    evidence: overviewEvidence(analysis),
    counts: tabCounts(analysis),
    extractions,
  };
}

/** The left column: every thread on the account, newest activity first. */
export function threadListFor(dataset: AccountDataset | null): ThreadRecord[] {
  if (!dataset) return [];
  return recordsFor(dataset)
    .slice()
    .sort((a, b) => {
      if (a.analysis.priorityScore !== b.analysis.priorityScore) {
        return b.analysis.priorityScore - a.analysis.priorityScore;
      }
      return new Date(b.thread.lastMessageAt).getTime() - new Date(a.thread.lastMessageAt).getTime();
    });
}
