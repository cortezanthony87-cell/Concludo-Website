/**
 * Finished outputs: a thread turned into Concludo work product.
 *
 * This is the module's reason for existing inside Concludo rather than beside
 * it. Concludo turns conversations into finished work. Until now the email
 * reader stopped at analysis, which is the useful half of a product rather than
 * a product.
 *
 * The important decision in this file is what it does NOT do. It does not
 * define a second document standard. The Workspace already has one, settled on
 * 27 September: `Concludo_Output_Document_Design_Spec_v1` for the rules and
 * `Concludo_Output_Payload_Schema_v1` for the contract between an extraction
 * engine and the renderer. This file fills that payload. The renderer draws
 * only what is in it, so anything absent is simply not printed, and nothing
 * here may be invented to fill a gap.
 *
 * Three rules from that spec govern every builder below.
 *
 * 1. **Every register row carries the point in the record it came from.** A row
 *    with no evidence is not written. That is why `evidenceFor` returns null
 *    rather than an empty string: a missing quote has to be visible as missing.
 *
 * 2. **Every inference is labelled as one.** A date the sender wrote and a date
 *    Concludo worked out are different kinds of fact, and the register says
 *    which, in the row, not in a footnote.
 *
 * 3. **A section with nothing in it is omitted.** An empty "Decisions" heading
 *    reads as "no decisions were made". Absent reads as "none found", which is
 *    the truth.
 */
import {
  Action,
  Commitment,
  Decision,
  Deadline,
  OpenQuestion,
  Risk,
  SourceRef,
  ThreadAnalysis,
} from './model';
import { ThreadRecord } from './filters';
import { formatDayTime, formatDay } from './outputFormat';

/* ----------------------------------------------------------- the four kinds */

export type OutputKind =
  | 'thread_summary'
  | 'action_plan'
  | 'decision_log'
  | 'follow_up_email';

export type OutputFormat = 'document' | 'email_text';

export interface OutputDefinition {
  kind: OutputKind;
  label: string;
  /** What it is, in one sentence. */
  description: string;
  /** When it is the right output to produce. */
  useWhen: string;
  format: OutputFormat;
  /** The document kind printed in the header and on the cover. */
  documentKind: string;
  iconName: string;
  /** The lowest tier that may produce it. */
  minimumTier: 'starter' | 'pro' | 'team';
}

export const OUTPUT_KINDS: readonly OutputDefinition[] = [
  {
    kind: 'thread_summary',
    label: 'Thread outcome report',
    description:
      'The whole conversation as a record: what it is, what was decided, what is owed, what is at risk, and what should happen next.',
    useWhen: 'You need to hand the conversation to somebody, or file it.',
    format: 'document',
    documentKind: 'Thread outcome report',
    iconName: 'FileText',
    minimumTier: 'starter',
  },
  {
    kind: 'action_plan',
    label: 'Action plan',
    description:
      'Every action and dated commitment in the thread, with an owner, a date where one was stated, and the sentence it came from.',
    useWhen: 'The thread produced work and you want the work, not the reading.',
    format: 'document',
    documentKind: 'Action plan',
    iconName: 'ListChecks',
    minimumTier: 'starter',
  },
  {
    kind: 'decision_log',
    label: 'Decision log',
    description:
      'Decisions made and decisions still required, each with who made it, when, and the words that settled it.',
    useWhen: 'Somebody will later ask what was agreed, and when.',
    format: 'document',
    documentKind: 'Decision log',
    iconName: 'Gavel',
    minimumTier: 'pro',
  },
  {
    kind: 'follow_up_email',
    label: 'Follow-up email',
    description:
      'A plain-text summary written to send back to the people in the thread, confirming what was agreed and what happens next.',
    useWhen: 'You want the other side to have the same record you do.',
    format: 'email_text',
    documentKind: 'Follow-up email',
    iconName: 'Mail',
    minimumTier: 'starter',
  },
];

export function outputDefinition(kind: OutputKind): OutputDefinition {
  const found = OUTPUT_KINDS.find((o) => o.kind === kind);
  if (!found) throw new Error(`Unknown output kind: ${kind}`);
  return found;
}

/* ------------------------------------------------------------ availability */

export interface OutputAvailability {
  available: boolean;
  /** Why it cannot be produced, written for the person. Empty when it can. */
  reason: string;
  /** What the thread would need. Shown so the refusal is actionable. */
  missing: readonly string[];
}

/**
 * Whether an output is worth producing from this thread.
 *
 * A document built from nothing is worse than no document: it looks like work
 * and carries none. So each kind states the minimum the thread has to hold,
 * and says plainly what is missing when it does not.
 */
export function availabilityFor(
  kind: OutputKind,
  record: ThreadRecord
): OutputAvailability {
  const a = record.analysis;

  if (!a.analysed) {
    return {
      available: false,
      reason: 'This thread has not been analysed yet, so there is nothing to build a document from.',
      missing: ['An analysis of the thread'],
    };
  }

  switch (kind) {
    case 'thread_summary':
      return { available: true, reason: '', missing: [] };

    case 'action_plan': {
      const actions = a.actions.length;
      const dated = a.explicitDeadlines.length + a.commitments.length;
      if (actions === 0 && dated === 0) {
        return {
          available: false,
          reason: 'Nothing in this thread asks anybody to do anything, so an action plan would be an empty page.',
          missing: ['At least one action, commitment or stated date'],
        };
      }
      return { available: true, reason: '', missing: [] };
    }

    case 'decision_log': {
      if (a.decisionsMade.length === 0 && a.decisionsRequired.length === 0) {
        return {
          available: false,
          reason: 'No decision was made or is outstanding in this thread.',
          missing: ['At least one decision made, or one decision still required'],
        };
      }
      return { available: true, reason: '', missing: [] };
    }

    case 'follow_up_email': {
      if (a.securityAlert !== null) {
        return {
          available: false,
          reason:
            'This thread is flagged as possibly unsafe. Concludo does not write a reply to a flagged thread, because a reply confirms the address is live.',
          missing: ['The security flag cleared by you, after checking it yourself'],
        };
      }
      if (a.classification.sensitivity === 'sensitive') {
        return {
          available: false,
          reason:
            'This thread carries sensitive content. A summary written for you is one thing; one written to send to somebody else is a judgement that is yours to make.',
          missing: ['Your own words, written by you'],
        };
      }
      if (a.currentStatus === 'resolved') {
        return {
          available: false,
          reason: 'This conversation is finished. A follow-up would be a reply to a closed thread.',
          missing: ['An open thread'],
        };
      }
      return { available: true, reason: '', missing: [] };
    }
  }
}

/* --------------------------------------------------------------- the payload */

/**
 * The payload shape, matching `Concludo_Output_Payload_Schema_v1`.
 *
 * Typed here rather than imported, because the schema is a JSON file in the
 * project record and this module must compile without it. The field names and
 * the optionality match it exactly; a mismatch is a bug in this file, not a
 * reason to change the schema.
 */
export interface OutputPayload {
  document: {
    kind: string;
    title: string;
    subject: string;
    footer_label: string;
    classification: string;
  };
  tier: 'starter' | 'pro' | 'team' | null;
  meeting: {
    kicker: string;
    title_lines: string[];
    accent_line: string;
    subtitle: string;
  };
  meta: { label: string; value: string; note?: string }[];
  counts: { label: string; value: string }[];
  notices: string[];
  executive?: {
    title: string;
    intro: string;
    points: { label: string; text: string; evidence?: string }[];
  };
  inputs?: {
    title: string;
    intro: string;
    columns: string[];
    widths?: number[];
    rows: string[][];
    gaps_title?: string;
    gaps?: string[];
    conflict?: { title: string; lines: string[] };
  };
  decisions?: OutputRegister;
  actions?: OutputRegister;
  risks?: OutputRegister;
  recommendations?: {
    title: string;
    intro: string;
    bands: { label: 'Critical' | 'High' | 'Medium' | 'Low'; items: { title: string; why: string }[] }[];
  };
  closing?: {
    title: string;
    intro: string;
    items: [string, string][];
    audit_title?: string;
    audit?: [string, string][];
  };
}

export interface OutputRegister {
  title: string;
  intro: string;
  columns: string[];
  widths?: number[];
  rows: string[][];
  stats_title?: string;
  stats?: [string, string][];
  callout?: { title: string; lines: string[] };
}

/* ------------------------------------------------------------ the evidence */

/**
 * The point in the record a row came from.
 *
 * Returns null rather than an empty string when there is none, so a caller has
 * to decide what to do about a fact with no source instead of printing a blank
 * cell that looks like a fact nobody bothered to cite.
 */
export function evidenceFor(sources: readonly SourceRef[]): string | null {
  const first = sources[0];
  if (!first) return null;
  const quote = first.quote?.trim();
  if (!quote) return first.messageId;
  return `“${quote}”`;
}

/** The basis of a fact, written out. An inference always says it is one. */
export function basisLabel(basis: 'stated' | 'inferred' | 'calculated'): string {
  switch (basis) {
    case 'stated':
      return 'Stated';
    case 'inferred':
      return 'Inferred';
    case 'calculated':
      return 'Calculated';
  }
}

function tierLabel(tier: 'starter' | 'pro' | 'team' | null): string {
  switch (tier) {
    case 'starter':
      return 'Starter subscription';
    case 'pro':
      return 'Pro subscription';
    case 'team':
      return 'Team subscription';
    default:
      return 'Tier not provided, so the Starter subscription content set was used';
  }
}

/** The three cover notices, in the order the spec fixes them. */
function noticesFor(
  tier: 'starter' | 'pro' | 'team' | null,
  analysis: ThreadAnalysis
): string[] {
  const notices = [
    `Produced under the ${tierLabel(tier)}. This document contains only what that tier includes.`,
  ];

  if (analysis.securityAlert !== null) {
    notices.push(
      'The source thread carries a security advisory. Read it before relying on anything in this document.'
    );
  } else if (analysis.confidence === 'low') {
    notices.push(
      'Confidence in this reading is low. Check the quoted evidence against the thread before relying on it.'
    );
  } else {
    notices.push('Built from a synthetic thread. No mailbox is connected.');
  }

  notices.push(
    'Human review is required before reliance. Concludo proposes; a person disposes.'
  );

  return notices;
}

function metaFor(record: ThreadRecord, now: string): OutputPayload['meta'] {
  const a = record.analysis;
  return [
    { label: 'Source', value: `Email thread, ${record.messages.length} messages`, note: 'Class: correspondence' },
    { label: 'With', value: `${record.counterpartyName}`, note: record.counterpartyAddress },
    {
      label: 'Period',
      value: `${formatDay(record.thread.firstMessageAt)} to ${formatDay(record.thread.lastMessageAt)}`,
    },
    { label: 'Produced', value: formatDayTime(now), note: `Confidence: ${a.confidence}` },
  ];
}

/* --------------------------------------------------------- the four builders */

export interface BuildOptions {
  record: ThreadRecord;
  accountLabel: string;
  tier: 'starter' | 'pro' | 'team' | null;
  now: string;
}

export function buildOutputPayload(kind: OutputKind, options: BuildOptions): OutputPayload {
  switch (kind) {
    case 'thread_summary':
      return buildThreadSummary(options);
    case 'action_plan':
      return buildActionPlan(options);
    case 'decision_log':
      return buildDecisionLog(options);
    case 'follow_up_email':
      return buildFollowUpShell(options);
  }
}

function coverFor(
  kind: OutputKind,
  options: BuildOptions,
  counts: { label: string; value: string }[]
): Pick<OutputPayload, 'document' | 'tier' | 'meeting' | 'meta' | 'counts' | 'notices'> {
  const definition = outputDefinition(kind);
  const { record, now, tier } = options;
  const a = record.analysis;

  return {
    document: {
      kind: definition.documentKind,
      title: `${definition.documentKind}: ${record.thread.subject}`,
      subject: `Email thread with ${record.counterpartyName}`,
      footer_label: `${record.thread.subject}, ${formatDay(record.thread.lastMessageAt)}`,
      classification: 'Commercial in confidence',
    },
    tier,
    meeting: {
      kicker: definition.documentKind.toUpperCase(),
      title_lines: splitTitle(record.thread.subject),
      accent_line: record.counterpartyName,
      subtitle: a.oneLineSummary,
    },
    meta: metaFor(record, now),
    counts,
    notices: noticesFor(tier, a),
  };
}

/** Up to three lines, broken on word boundaries, for the cover. */
function splitTitle(subject: string): string[] {
  const clean = subject.replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, '').trim();
  const words = clean.split(/\s+/);
  if (words.length <= 4) return [clean];

  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 28 && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
    if (lines.length === 2) break;
  }
  const remaining = words.slice(lines.join(' ').split(/\s+/).filter(Boolean).length).join(' ');
  if (remaining.trim()) lines.push(remaining.trim());
  else if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 3);
}

/* ------------------------------------------------- 1. thread outcome report */

function buildThreadSummary(options: BuildOptions): OutputPayload {
  const { record } = options;
  const a = record.analysis;

  const counts = [
    { label: 'Decisions', value: String(a.decisionsMade.length + a.decisionsRequired.length) },
    { label: 'Actions', value: String(a.actions.length) },
    { label: 'Risks', value: String(a.risks.length + (a.securityAlert ? 1 : 0)) },
    { label: 'Open questions', value: String(a.openQuestions.filter((q) => !q.answered).length) },
  ];

  const payload: OutputPayload = {
    ...coverFor('thread_summary', options, counts),
    executive: {
      title: 'What this conversation is',
      intro: 'The judgement, with the evidence behind each point.',
      points: executivePoints(record),
    },
  };

  const inputs = inputsSection(record);
  if (inputs) payload.inputs = inputs;

  const decisions = decisionRegister(a);
  if (decisions) payload.decisions = decisions;

  const actions = actionRegister(a);
  if (actions) payload.actions = actions;

  const risks = riskRegister(a);
  if (risks) payload.risks = risks;

  const recommendations = recommendationSection(record);
  if (recommendations) payload.recommendations = recommendations;

  payload.closing = closingSection(record);

  return payload;
}

function executivePoints(record: ThreadRecord): NonNullable<OutputPayload['executive']>['points'] {
  const a = record.analysis;
  const points: NonNullable<OutputPayload['executive']>['points'] = [];

  points.push({
    label: 'In one line',
    text: a.oneLineSummary,
    evidence: evidenceFor(a.classification.source) ?? undefined,
  });

  points.push({ label: 'Why it matters', text: a.whyItMatters });

  points.push({
    label: 'Where it stands',
    text: `${statusSentence(a)} ${a.replyReason}`.trim(),
  });

  const soonest = a.explicitDeadlines.find((d) => d.ownerIsSelf) ?? a.explicitDeadlines[0];
  if (soonest) {
    points.push({
      label: 'The date that matters',
      // The description often ends in a full stop of its own, which produced
      // "counted from the 7:12am message., 12 Oct" in the first render.
      text: `${trimStop(soonest.description)}, ${formatDay(soonest.dueAt)}. ${soonest.consequence}`,
      evidence: evidenceFor(soonest.source) ?? undefined,
    });
  }

  points.push({ label: 'Recommended next step', text: a.recommendedNextStep });

  return points;
}

/** Drops a trailing full stop, so a sentence can be continued cleanly. */
function trimStop(text: string): string {
  return text.trim().replace(/\.$/, '');
}

function statusSentence(a: ThreadAnalysis): string {
  switch (a.currentStatus) {
    case 'waiting_on_user':
      return 'The next step is yours.';
    case 'waiting_on_other':
      return 'Somebody else owes the next step.';
    case 'decision_required':
      return 'A decision is outstanding.';
    case 'action_required':
      return 'Work is outstanding.';
    case 'information_only':
      return 'Nothing is owed by anybody.';
    case 'resolved':
      return 'The conversation is finished.';
    case 'security_review':
      return 'This thread is flagged for security review.';
    default:
      return 'Who moves next is not stated in the thread.';
  }
}

function inputsSection(record: ThreadRecord): OutputPayload['inputs'] {
  const rows = record.messages.map((m, index) => [
    `M${String(index + 1).padStart(2, '0')}`,
    m.isFromSelf ? 'You' : (m.participants.find((p) => p.role === 'from')?.displayName ?? 'Unknown'),
    formatDayTime(m.sentAt),
    m.attachmentIds.length > 0 ? `${m.attachmentIds.length} attached` : 'None',
  ]);

  if (rows.length === 0) return undefined;

  const a = record.analysis;
  const gaps = a.openQuestions
    .filter((q) => !q.answered)
    .map((q) => `${q.question} Asked by ${q.askedByIsSelf ? 'you' : q.askedBy}, still unanswered.`);

  const section: NonNullable<OutputPayload['inputs']> = {
    title: 'The record',
    intro: 'Every message this document was built from, in order.',
    columns: ['ID', 'From', 'Sent', 'Attachments'],
    widths: [0.1, 0.35, 0.35, 0.2],
    rows,
  };

  if (gaps.length > 0) {
    section.gaps_title = 'What the record does not settle';
    section.gaps = gaps;
  }

  const conflict = a.conflicts[0];
  if (conflict) {
    section.conflict = {
      title: 'A conflict in the record',
      lines: [
        conflict.description,
        ...conflict.positions.map((p) => `${p.statement} (${p.source.messageId})`),
      ],
    };
  }

  return section;
}

function decisionRegister(a: ThreadAnalysis): OutputRegister | undefined {
  const rows: string[][] = [];

  a.decisionsMade.forEach((d: Decision, index) => {
    rows.push([
      `D${String(index + 1).padStart(2, '0')}`,
      d.description,
      'Made',
      d.decidedBy ?? 'Not stated',
      d.decidedAt ? formatDay(d.decidedAt) : 'Not stated',
      evidenceFor(d.source) ?? 'No source recorded',
    ]);
  });

  a.decisionsRequired.forEach((d: Decision, index) => {
    rows.push([
      `D${String(a.decisionsMade.length + index + 1).padStart(2, '0')}`,
      d.description,
      'Required',
      d.options && d.options.length > 0 ? d.options.join(' or ') : 'Options not stated',
      d.requiredBy ? formatDay(d.requiredBy) : 'No date stated',
      evidenceFor(d.source) ?? 'No source recorded',
    ]);
  });

  if (rows.length === 0) return undefined;

  return {
    title: 'Decisions',
    intro: 'What was settled, and what is still open. Each row carries the words it came from.',
    columns: ['ID', 'Decision', 'State', 'By or options', 'Date', 'From the thread'],
    widths: [0.07, 0.26, 0.09, 0.18, 0.12, 0.28],
    rows,
    stats_title: 'Counted',
    stats: [
      ['Made', String(a.decisionsMade.length)],
      ['Still required', String(a.decisionsRequired.length)],
    ],
  };
}

function actionRegister(a: ThreadAnalysis): OutputRegister | undefined {
  const rows: string[][] = [];

  a.actions.forEach((action: Action, index) => {
    rows.push([
      `A${String(index + 1).padStart(2, '0')}`,
      action.description,
      action.ownerIsSelf ? 'You' : action.owner,
      action.dueAt ? formatDay(action.dueAt) : 'No date stated',
      basisLabel(action.basis),
      evidenceFor(action.source) ?? 'No source recorded',
    ]);
  });

  a.commitments.forEach((c: Commitment, index) => {
    rows.push([
      `C${String(index + 1).padStart(2, '0')}`,
      c.description,
      c.promisedByIsSelf ? 'You promised' : `${c.promisedBy} promised`,
      c.dueAt ? formatDay(c.dueAt) : 'No date stated',
      c.status === 'overdue' ? 'Overdue' : basisLabel(c.basis),
      evidenceFor(c.source) ?? 'No source recorded',
    ]);
  });

  if (rows.length === 0) return undefined;

  const mine = a.actions.filter((x) => x.ownerIsSelf).length;
  const register: OutputRegister = {
    title: 'Actions and commitments',
    intro:
      'Every piece of work the thread creates. An owner and a date appear only where the thread states them.',
    columns: ['ID', 'What', 'Who', 'By when', 'Basis', 'From the thread'],
    widths: [0.07, 0.27, 0.14, 0.13, 0.1, 0.29],
    rows,
    stats_title: 'Counted',
    stats: [
      ['Yours', String(mine)],
      ['Theirs', String(a.actions.length - mine)],
      ['Commitments', String(a.commitments.length)],
    ],
  };

  const undated = a.actions.filter((x) => x.dueAt === null).length;
  if (undated > 0) {
    register.callout = {
      title: 'Dates the thread does not give',
      lines: [
        `${undated} of these ${undated === 1 ? 'has' : 'have'} no date anywhere in the conversation.`,
        'Concludo has not invented one. Agree a date with the other side, or set one yourself.',
      ],
    };
  }

  return register;
}

function riskRegister(a: ThreadAnalysis): OutputRegister | undefined {
  const rows: string[][] = [];

  if (a.securityAlert) {
    rows.push([
      'R01',
      a.securityAlert.explanation,
      a.securityAlert.severity === 'high' ? 'High' : a.securityAlert.severity === 'medium' ? 'Medium' : 'Low',
      a.securityAlert.recommendedCheck,
      evidenceFor(a.securityAlert.source) ?? 'No source recorded',
    ]);
  }

  a.risks.forEach((risk: Risk, index) => {
    rows.push([
      `R${String(rows.length + index + 1).padStart(2, '0')}`,
      risk.description,
      risk.severity === 'high' ? 'High' : risk.severity === 'medium' ? 'Medium' : 'Low',
      risk.suggestedMitigation ?? 'Not stated',
      evidenceFor(risk.source) ?? 'No source recorded',
    ]);
  });

  if (rows.length === 0) return undefined;

  const register: OutputRegister = {
    title: 'Risks',
    intro: 'What could go wrong, and the check that would settle it.',
    columns: ['ID', 'Risk', 'Severity', 'What to do', 'From the thread'],
    widths: [0.07, 0.33, 0.1, 0.23, 0.27],
    rows,
  };

  if (a.securityAlert) {
    register.callout = {
      title: 'Advisory, not a verdict',
      lines: [
        'Concludo flags and explains. It does not block, quarantine or delete, and it has not told anybody else.',
        'Check this yourself before acting on anything the message asks for.',
      ],
    };
  }

  return register;
}

function recommendationSection(record: ThreadRecord): OutputPayload['recommendations'] {
  const a = record.analysis;
  const bands: NonNullable<OutputPayload['recommendations']>['bands'] = [];

  const critical: { title: string; why: string }[] = [];
  const high: { title: string; why: string }[] = [];
  const medium: { title: string; why: string }[] = [];

  if (a.securityAlert) {
    critical.push({
      title: a.securityAlert.recommendedCheck,
      why: `The thread carries a ${a.securityAlert.severity} severity advisory (R01), and acting before checking is the expensive order.`,
    });
  }

  const overdue = a.commitments.filter((c) => c.status === 'overdue');
  overdue.forEach((c, i) => {
    high.push({
      title: `Close out: ${c.description}`,
      why: `Promised by ${c.promisedByIsSelf ? 'you' : c.promisedBy} and now overdue (C${String(i + 1).padStart(2, '0')}).`,
    });
  });

  if (a.recommendedNextStep) {
    (a.priorityBand === 'immediate' || a.priorityBand === 'today' ? high : medium).push({
      title: a.recommendedNextStep,
      why: `Priority band ${a.priorityBand}. ${a.priorityReasons[0] ?? ''}`.trim(),
    });
  }

  const undated = a.actions.filter((x) => x.ownerIsSelf && x.dueAt === null);
  if (undated.length > 0) {
    medium.push({
      title: 'Put a date against the undated actions',
      why: `${undated.length} ${undated.length === 1 ? 'action is' : 'actions are'} yours with no date stated anywhere in the thread.`,
    });
  }

  if (critical.length > 0) bands.push({ label: 'Critical', items: critical });
  if (high.length > 0) bands.push({ label: 'High', items: high });
  if (medium.length > 0) bands.push({ label: 'Medium', items: medium });

  if (bands.length === 0) return undefined;

  return {
    title: 'Recommendations',
    intro: 'Ranked by consequence, each naming the register row it comes from.',
    bands,
  };
}

function closingSection(record: ThreadRecord): OutputPayload['closing'] {
  const a = record.analysis;

  const items: [string, string][] = [
    ['Next step', a.recommendedNextStep],
    ['Owner of the next step', a.currentStatus === 'waiting_on_user' ? 'You' : record.counterpartyName],
  ];

  const soonest = record.nextStatedDeadline ?? record.nextAnyDeadline;
  if (soonest) {
    items.push([
      'By when',
      `${formatDay(soonest)}${record.nextStatedDeadline ? ', stated in the thread' : ', worked out rather than stated'}`,
    ]);
  }

  const audit: [string, string][] = [
    ['Messages read', String(record.messages.length)],
    ['Facts carrying a quoted source', String(countSourced(a))],
    ['Confidence in this reading', a.confidence],
    ['Analysis version', a.analysisVersionId ?? 'Not recorded'],
  ];

  return {
    title: 'Where this leaves you',
    intro: 'The single next step, and the audit of how this document was built.',
    items,
    audit_title: 'How this was built',
    audit,
  };
}

function countSourced(a: ThreadAnalysis): number {
  const all = [
    ...a.explicitDeadlines,
    ...a.suggestedDates,
    ...a.actions,
    ...a.decisionsMade,
    ...a.decisionsRequired,
    ...a.commitments,
    ...a.openQuestions,
    ...a.risks,
  ];
  return all.filter((x) => x.source.length > 0 && x.source[0]?.quote).length;
}

/* -------------------------------------------------------- 2. the action plan */

function buildActionPlan(options: BuildOptions): OutputPayload {
  const { record } = options;
  const a = record.analysis;

  const mine = a.actions.filter((x) => x.ownerIsSelf).length;
  const counts = [
    { label: 'Actions', value: String(a.actions.length) },
    { label: 'Yours', value: String(mine) },
    { label: 'Commitments', value: String(a.commitments.length) },
    { label: 'Dated', value: String(a.actions.filter((x) => x.dueAt !== null).length) },
  ];

  const payload: OutputPayload = {
    ...coverFor('action_plan', options, counts),
    executive: {
      title: 'What this thread asks of you',
      intro: 'The work, before the reading.',
      points: [
        { label: 'In one line', text: a.oneLineSummary },
        { label: 'First thing', text: a.recommendedNextStep },
        {
          label: 'Who is waiting',
          text:
            a.currentStatus === 'waiting_on_user'
              ? `${record.counterpartyName} is waiting on you.`
              : a.currentStatus === 'waiting_on_other'
                ? `You are waiting on ${record.counterpartyName}.`
                : 'Nobody is explicitly waiting, by the words of the thread.',
        },
      ],
    },
  };

  const actions = actionRegister(a);
  if (actions) payload.actions = actions;

  const dated = datedRegister(a);
  if (dated) payload.decisions = dated;

  const recommendations = recommendationSection(record);
  if (recommendations) payload.recommendations = recommendations;

  payload.closing = closingSection(record);

  return payload;
}

/** Dates, in their own register, split by whether they were stated or worked out. */
function datedRegister(a: ThreadAnalysis): OutputRegister | undefined {
  const rows: string[][] = [];

  a.explicitDeadlines.forEach((d: Deadline, index) => {
    rows.push([
      `T${String(index + 1).padStart(2, '0')}`,
      d.description,
      formatDay(d.dueAt),
      'Stated in the thread',
      d.ownerIsSelf ? 'You' : 'Them',
      evidenceFor(d.source) ?? 'No source recorded',
    ]);
  });

  a.suggestedDates.forEach((d: Deadline, index) => {
    rows.push([
      `T${String(a.explicitDeadlines.length + index + 1).padStart(2, '0')}`,
      d.description,
      formatDay(d.dueAt),
      `${basisLabel(d.basis)}, not stated`,
      d.ownerIsSelf ? 'You' : 'Them',
      evidenceFor(d.source) ?? 'No source recorded',
    ]);
  });

  if (rows.length === 0) return undefined;

  const register: OutputRegister = {
    title: 'Dates',
    intro: 'Every date in play. The basis column says whether the sender wrote it or Concludo worked it out.',
    columns: ['ID', 'What', 'When', 'Basis', 'Whose', 'From the thread'],
    widths: [0.07, 0.27, 0.12, 0.17, 0.08, 0.29],
    rows,
  };

  if (a.suggestedDates.length > 0) {
    register.callout = {
      title: 'Worked out, not stated',
      lines: [
        `${a.suggestedDates.length} of these ${a.suggestedDates.length === 1 ? 'date was' : 'dates were'} inferred from the conversation rather than written in it.`,
        'Confirm them with the other side before anybody plans around them.',
      ],
    };
  }

  return register;
}

/* ------------------------------------------------------- 3. the decision log */

function buildDecisionLog(options: BuildOptions): OutputPayload {
  const { record } = options;
  const a = record.analysis;

  const counts = [
    { label: 'Made', value: String(a.decisionsMade.length) },
    { label: 'Required', value: String(a.decisionsRequired.length) },
    { label: 'Open questions', value: String(a.openQuestions.filter((q) => !q.answered).length) },
    { label: 'Conflicts', value: String(a.conflicts.length) },
  ];

  const payload: OutputPayload = {
    ...coverFor('decision_log', options, counts),
    executive: {
      title: 'What was agreed',
      intro: 'The record somebody will ask for in three months.',
      points: [
        { label: 'In one line', text: a.oneLineSummary },
        {
          label: 'Settled',
          text:
            a.decisionsMade.length > 0
              ? `${a.decisionsMade.length} ${a.decisionsMade.length === 1 ? 'decision was' : 'decisions were'} made in this thread.`
              : 'Nothing was settled in this thread.',
        },
        {
          label: 'Outstanding',
          text:
            a.decisionsRequired.length > 0
              ? `${a.decisionsRequired.length} ${a.decisionsRequired.length === 1 ? 'decision is' : 'decisions are'} still required.`
              : 'No decision is outstanding.',
        },
      ],
    },
  };

  const decisions = decisionRegister(a);
  if (decisions) payload.decisions = decisions;

  const questions = questionRegister(a);
  if (questions) payload.actions = questions;

  payload.closing = closingSection(record);

  return payload;
}

function questionRegister(a: ThreadAnalysis): OutputRegister | undefined {
  const open = a.openQuestions.filter((q) => !q.answered);
  if (open.length === 0) return undefined;

  const rows = open.map((q: OpenQuestion, index) => [
    `Q${String(index + 1).padStart(2, '0')}`,
    q.question,
    q.askedByIsSelf ? 'You' : q.askedBy,
    formatDay(q.askedAt),
    q.blockedBy ?? 'Nothing stated',
    evidenceFor(q.source) ?? 'No source recorded',
  ]);

  return {
    title: 'Questions still open',
    intro: 'Asked in the thread and not answered in it.',
    columns: ['ID', 'Question', 'Asked by', 'Asked', 'Blocked by', 'From the thread'],
    widths: [0.07, 0.28, 0.12, 0.11, 0.15, 0.27],
    rows,
  };
}

/* ----------------------------------------------------- 4. the follow-up email */

/** The email is text, so its payload exists only to carry the cover furniture. */
function buildFollowUpShell(options: BuildOptions): OutputPayload {
  const { record } = options;
  const a = record.analysis;

  const counts = [
    { label: 'Recipients', value: String(recipientsFor(record).length) },
    { label: 'Decisions', value: String(a.decisionsMade.length) },
    { label: 'Actions', value: String(a.actions.length) },
    { label: 'Dates', value: String(a.explicitDeadlines.length) },
  ];

  return {
    ...coverFor('follow_up_email', options, counts),
    executive: {
      title: 'What this email says',
      intro: 'Written for the other side, from the same record.',
      points: [
        { label: 'To', text: recipientsFor(record).join(', ') || 'Nobody resolved from the thread' },
        { label: 'Subject', text: `Re: ${record.thread.subject}` },
        { label: 'Purpose', text: 'Confirm what was agreed and what happens next, in writing.' },
      ],
    },
  };
}

export function recipientsFor(record: ThreadRecord): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const message of record.messages) {
    for (const p of message.participants) {
      if (p.isSelf) continue;
      const key = p.address.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`${p.displayName} <${p.address}>`);
    }
  }
  return out;
}

/**
 * The follow-up email body.
 *
 * Plain text, because it is going into a mail client. Written in the first
 * person as something the person is sending, so what it says has to be
 * something they can stand behind: every line comes from the thread and
 * nothing is softened into a promise nobody made.
 */
export function buildFollowUpEmail(options: BuildOptions): {
  to: string[];
  subject: string;
  body: string;
  /** Everything the draft commits the sender to, listed before they send it. */
  commits: string[];
} {
  const { record } = options;
  const a = record.analysis;
  const lines: string[] = [];

  lines.push(`Hi ${firstName(record.counterpartyName)},`);
  lines.push('');
  lines.push(
    `Thanks for the conversation about ${plainSubject(record.thread.subject)}. Putting it in writing so we are working from the same record.`
  );

  if (a.decisionsMade.length > 0) {
    lines.push('');
    lines.push('What we agreed');
    for (const d of a.decisionsMade) {
      lines.push(`- ${d.description}`);
    }
  }

  const theirActions = a.actions.filter((x) => !x.ownerIsSelf);
  const myActions = a.actions.filter((x) => x.ownerIsSelf);

  if (myActions.length > 0) {
    lines.push('');
    lines.push('What I am doing');
    for (const action of myActions) {
      lines.push(`- ${action.description}${action.dueAt ? `, by ${formatDay(action.dueAt)}` : ''}`);
    }
  }

  if (theirActions.length > 0) {
    lines.push('');
    lines.push('What I am expecting from you');
    for (const action of theirActions) {
      lines.push(`- ${action.description}${action.dueAt ? `, by ${formatDay(action.dueAt)}` : ''}`);
    }
  }

  const open = a.openQuestions.filter((q) => !q.answered && !q.askedByIsSelf);
  const mine = a.openQuestions.filter((q) => !q.answered && q.askedByIsSelf);
  if (mine.length > 0) {
    lines.push('');
    lines.push('Still waiting on');
    for (const q of mine) lines.push(`- ${q.question}`);
  }
  if (open.length > 0) {
    lines.push('');
    lines.push('I owe you an answer on');
    for (const q of open) lines.push(`- ${q.question}`);
  }

  const dates = a.explicitDeadlines.filter((d) => d.ownerIsSelf === false || d.ownerIsSelf);
  if (dates.length > 0) {
    lines.push('');
    lines.push('Dates');
    for (const d of dates) lines.push(`- ${d.description}: ${formatDay(d.dueAt)}`);
  }

  lines.push('');
  lines.push('If any of that is wrong, tell me and I will correct it.');
  lines.push('');
  lines.push('Thanks');

  const commits = [
    ...myActions.map(
      (x) => `${x.description}${x.dueAt ? `, by ${formatDay(x.dueAt)}` : ', with no date given'}`
    ),
    ...a.commitments.filter((c) => c.promisedByIsSelf).map((c) => c.description),
  ];

  return {
    to: recipientsFor(record),
    subject: `Re: ${plainSubject(record.thread.subject)}`,
    body: lines.join('\n'),
    commits,
  };
}

function firstName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? '';
  // An organisation rather than a person gets no first name, because "Hi
  // Northaxis," reads as a mail merge that went wrong.
  if (/\b(group|holdings|accounts|collective|partners|co|ltd|pty|advisory|legal|services)\b/i.test(displayName)) {
    return 'there';
  }
  return first || 'there';
}

function plainSubject(subject: string): string {
  return subject.replace(/^(?:\s*(?:re|fw|fwd)\s*:\s*)+/i, '').trim();
}

/* ------------------------------------------------------------- entitlement */

export interface TierEntitlement {
  tier: 'starter' | 'pro' | 'team';
  /** Which output kinds the tier may produce. */
  kinds: readonly OutputKind[];
  note: string;
}

export const OUTPUT_ENTITLEMENTS: readonly TierEntitlement[] = [
  {
    tier: 'starter',
    kinds: ['thread_summary', 'action_plan', 'follow_up_email'],
    note: 'Three outputs, and three threads analysed a week.',
  },
  {
    tier: 'pro',
    kinds: ['thread_summary', 'action_plan', 'decision_log', 'follow_up_email'],
    note: 'Every output, unlimited threads.',
  },
  {
    tier: 'team',
    kinds: ['thread_summary', 'action_plan', 'decision_log', 'follow_up_email'],
    note: 'Every output, unlimited threads, per seat.',
  },
];

export function entitledTo(kind: OutputKind, tier: 'starter' | 'pro' | 'team'): boolean {
  const entitlement = OUTPUT_ENTITLEMENTS.find((e) => e.tier === tier);
  return entitlement ? entitlement.kinds.includes(kind) : false;
}
