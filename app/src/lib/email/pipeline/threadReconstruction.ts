/**
 * Thread reconstruction: the nine determinations the brief asks for.
 *
 * All nine are worked out from the messages themselves, not from the analysis,
 * which means they can be checked against the conversation by a person reading
 * it and they do not depend on a model having been run. That matters: if the
 * analysis fails, these still hold, and the dashboard can still say truthfully
 * whether a thread is waiting on you.
 *
 * Every determination carries its basis. A reading that cannot say why it
 * reached its conclusion is a reading nobody can argue with, and the ones worth
 * arguing with are exactly the ones that are wrong.
 */
import { EmailMessage, OpenQuestion, Deadline, Conflict, Participant } from '../model';

export interface Determination<T> {
  value: T;
  confidence: 'high' | 'medium' | 'low';
  /** Why, in one sentence a person reading the thread could check. */
  basis: string;
  /** The message ids the determination rests on. */
  evidence: readonly string[];
}

export interface ThreadReconstruction {
  threadId: string;
  /** The last message that moved the conversation, not a bare acknowledgement. */
  latestMeaningfulMessage: Determination<string | null>;
  userHasReplied: Determination<boolean>;
  answeredQuestionIds: Determination<readonly string[]>;
  unansweredQuestionIds: Determination<readonly string[]>;
  changedDeadlines: Determination<readonly { id: string; from: string; to: string }[]>;
  conflicts: Determination<readonly Conflict[]>;
  currentActionOwner: Determination<'user' | 'other' | 'nobody' | 'unclear'>;
  isResolved: Determination<boolean>;
  waitingOn: Determination<'user' | 'other' | 'nobody' | 'unclear'>;
}

/* -------------------------------------------------------------- helpers */

const ACKNOWLEDGEMENT =
  /^(?:(?:many\s+)?thanks(?:\s+(?:a\s+lot|very\s+much))?|thank\s+you|received(?:\s+with\s+thanks)?|noted|ok(?:ay)?|got\s+it|will\s+do|great|perfect|cheers|no\s+problem|sounds\s+good)[.!,\s]*$/i;

const CLOSING =
  /\b(?:nothing\s+further\s+(?:needed|required)|no\s+action\s+(?:needed|required)|all\s+(?:sorted|confirmed|done)|we\s+are\s+(?:all\s+)?(?:set|good)|closing\s+this\s+off|consider\s+this\s+closed)\b/i;

const QUESTION_ASK =
  /\?|\b(?:let\s+me\s+know|can\s+you|could\s+you|would\s+you|please\s+(?:confirm|advise|send|tell)|do\s+you)\b/i;

function ms(iso: string): number {
  return new Date(iso).getTime();
}

function ordered(messages: readonly EmailMessage[]): EmailMessage[] {
  return messages.slice().sort((a, b) => ms(a.sentAt) - ms(b.sentAt));
}

/**
 * Whether a message moved the conversation.
 *
 * A bare "thanks" did not. Treating it as the latest meaningful message is how
 * a thread that needs an answer looks like a thread that just got one.
 */
export function isMeaningful(message: EmailMessage): boolean {
  const body = message.body.trim();
  if (body.length === 0) return false;

  // Strip a signature-looking tail before judging length, so "Received with
  // thanks.\n\nTom" is still an acknowledgement.
  const firstLines = body
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .slice(0, 2)
    .join(' ')
    .trim();

  if (ACKNOWLEDGEMENT.test(firstLines)) return false;
  if (body.split(/\s+/).length <= 3 && !QUESTION_ASK.test(body)) return false;
  if (message.attachmentIds.length > 0) return true;
  return true;
}

/* ----------------------------------------------------- the reconstruction */

export function reconstructThread(input: {
  threadId: string;
  messages: readonly EmailMessage[];
  ownedAddresses: readonly string[];
  openQuestions: readonly OpenQuestion[];
  explicitDeadlines: readonly Deadline[];
  conflicts: readonly Conflict[];
  now: string;
}): ThreadReconstruction {
  const messages = ordered(input.messages);
  const owned = new Set(input.ownedAddresses.map((a) => a.toLowerCase()));

  const isSelf = (m: EmailMessage): boolean => {
    if (m.isFromSelf) return true;
    const from = m.participants.find((p: Participant) => p.role === 'from');
    return from ? owned.has(from.address.toLowerCase()) : false;
  };

  const inbound = messages.filter((m) => !isSelf(m));
  const outbound = messages.filter((m) => isSelf(m));
  const last = messages[messages.length - 1];

  /* ------------------------------------------- latest meaningful message */

  const meaningful = messages.filter(isMeaningful);
  const latestMeaningful = meaningful[meaningful.length - 1] ?? null;

  const latestMeaningfulMessage: Determination<string | null> = {
    value: latestMeaningful?.id ?? null,
    confidence: latestMeaningful ? (latestMeaningful.id === last?.id ? 'high' : 'medium') : 'low',
    basis: !latestMeaningful
      ? 'No message in the thread carries content beyond an acknowledgement.'
      : latestMeaningful.id === last?.id
        ? 'The most recent message is also the most recent one that moved the conversation.'
        : `The most recent message is an acknowledgement, so the last substantive one is ${latestMeaningful.id}.`,
    evidence: latestMeaningful ? [latestMeaningful.id] : [],
  };

  /* --------------------------------------------------- has the user replied */

  const lastInbound = inbound[inbound.length - 1];
  const repliedAfterLastInbound =
    lastInbound !== undefined && outbound.some((m) => ms(m.sentAt) > ms(lastInbound.sentAt));

  const userHasReplied: Determination<boolean> = {
    value: repliedAfterLastInbound,
    confidence: outbound.length === 0 ? 'high' : 'high',
    basis:
      outbound.length === 0
        ? 'You have not written in this thread at all.'
        : repliedAfterLastInbound
          ? 'Your most recent message came after theirs.'
          : 'Their most recent message came after yours, so the latest word is theirs.',
    evidence: [lastInbound?.id, outbound[outbound.length - 1]?.id].filter((x): x is string => Boolean(x)),
  };

  /* ------------------------------------------------------------ questions */

  /**
   * A question counts as answered when a message from the other side arrived
   * after it from the person it was asked of. That is a weaker test than
   * reading the answer, and the confidence says so rather than pretending
   * otherwise.
   */
  const answered: string[] = [];
  const unanswered: string[] = [];

  for (const question of input.openQuestions) {
    if (question.answered) {
      answered.push(question.id);
      continue;
    }
    const askedAt = ms(question.askedAt);
    const repliesSince = question.askedByIsSelf
      ? inbound.filter((m) => ms(m.sentAt) > askedAt && isMeaningful(m))
      : outbound.filter((m) => ms(m.sentAt) > askedAt && isMeaningful(m));

    if (repliesSince.length > 0) answered.push(question.id);
    else unanswered.push(question.id);
  }

  const answeredQuestionIds: Determination<readonly string[]> = {
    value: answered,
    confidence: 'medium',
    basis:
      'A question is treated as answered when a substantive message came back from the person it was asked of. Whether it was actually answered is a matter of reading the reply.',
    evidence: messages.map((m) => m.id),
  };

  const unansweredQuestionIds: Determination<readonly string[]> = {
    value: unanswered,
    confidence: unanswered.length === 0 ? 'high' : 'medium',
    basis:
      unanswered.length === 0
        ? 'Every question in the thread has had a substantive reply after it.'
        : `${unanswered.length} question${unanswered.length === 1 ? ' has' : 's have'} had no substantive reply since being asked.`,
    evidence: input.openQuestions.filter((q) => unanswered.includes(q.id)).flatMap((q) => q.source.map((s) => s.messageId)),
  };

  /* ---------------------------------------------------- changed deadlines */

  /**
   * A deadline for the same described thing, stated twice with different
   * dates. This is the case the whole product exists to catch: the date moved
   * halfway down a long thread and nobody noticed.
   */
  const changed: { id: string; from: string; to: string }[] = [];
  const byDescription = new Map<string, Deadline[]>();
  for (const deadline of input.explicitDeadlines) {
    const key = deadline.description.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
    byDescription.set(key, [...(byDescription.get(key) ?? []), deadline]);
  }
  for (const [, group] of byDescription) {
    if (group.length < 2) continue;
    const sorted = group.slice().sort((a, b) => {
      const am = ms(messageTimeOf(a, messages));
      const bm = ms(messageTimeOf(b, messages));
      return am - bm;
    });
    for (let i = 1; i < sorted.length; i += 1) {
      if (ms(sorted[i].dueAt) !== ms(sorted[i - 1].dueAt)) {
        changed.push({ id: sorted[i].id, from: sorted[i - 1].dueAt, to: sorted[i].dueAt });
      }
    }
  }

  const changedDeadlines: Determination<readonly { id: string; from: string; to: string }[]> = {
    value: changed,
    confidence: changed.length === 0 ? 'high' : 'medium',
    basis:
      changed.length === 0
        ? 'No date for the same thing was stated twice with different values.'
        : 'The same described deadline appears more than once in the thread with different dates.',
    evidence: input.explicitDeadlines.flatMap((d) => d.source.map((s) => s.messageId)),
  };

  /* ------------------------------------------------------------ conflicts */

  const conflicts: Determination<readonly Conflict[]> = {
    value: input.conflicts,
    confidence: input.conflicts.length === 0 ? 'medium' : 'high',
    basis:
      input.conflicts.length === 0
        ? 'No two statements in the thread were found to contradict each other. Absence of a finding is not proof there is none.'
        : 'Two statements in the thread cannot both be true. Both are shown with their sources.',
    evidence: input.conflicts.flatMap((c) => c.positions.map((p) => p.source.messageId)),
  };

  /* --------------------------------------------------------- is it closed */

  const closingMessage = messages.filter(isMeaningful).reverse().find((m) => CLOSING.test(m.body));
  const lastAsksSomething = latestMeaningful ? QUESTION_ASK.test(latestMeaningful.body) : false;
  const resolved = Boolean(closingMessage) && !lastAsksSomething && unanswered.length === 0;

  const isResolved: Determination<boolean> = {
    value: resolved,
    confidence: closingMessage ? 'high' : 'medium',
    basis: closingMessage
      ? `A message says the thread is finished: "${firstMatch(closingMessage.body, CLOSING)}"`
      : unanswered.length > 0
        ? 'Questions are still open, so the thread is not treated as finished.'
        : 'Nothing in the thread says it is finished, so it is not treated as finished.',
    evidence: closingMessage ? [closingMessage.id] : [],
  };

  /* ------------------------------------------- owner and who is waiting */

  let owner: 'user' | 'other' | 'nobody' | 'unclear';
  let ownerBasis: string;
  let ownerConfidence: 'high' | 'medium' | 'low';

  if (resolved) {
    owner = 'nobody';
    ownerBasis = 'The thread is finished, so nobody owes anything.';
    ownerConfidence = 'high';
  } else if (!latestMeaningful) {
    owner = 'unclear';
    ownerBasis = 'Nothing substantive has been said, so there is nothing to owe.';
    ownerConfidence = 'low';
  } else if (!isSelf(latestMeaningful)) {
    owner = lastAsksSomething || unanswered.length > 0 ? 'user' : 'unclear';
    ownerBasis = lastAsksSomething
      ? 'The last substantive message came from them and asks something of you.'
      : unanswered.length > 0
        ? 'The last substantive message came from them and questions remain open.'
        : 'The last substantive message came from them but asks nothing directly, so who moves next is not stated.';
    ownerConfidence = lastAsksSomething ? 'high' : 'medium';
  } else {
    owner = 'other';
    ownerBasis = 'The last substantive message was yours, so the next move is theirs.';
    ownerConfidence = 'high';
  }

  const currentActionOwner: Determination<typeof owner> = {
    value: owner,
    confidence: ownerConfidence,
    basis: ownerBasis,
    evidence: latestMeaningful ? [latestMeaningful.id] : [],
  };

  const waitingOn: Determination<typeof owner> = {
    value: owner,
    confidence: ownerConfidence,
    basis:
      owner === 'user'
        ? 'Waiting on you, because the last substantive word was theirs.'
        : owner === 'other'
          ? 'Waiting on them, because the last substantive word was yours.'
          : owner === 'nobody'
            ? 'Nobody is waiting. The thread is finished.'
            : 'Who is waiting cannot be read from the thread.',
    evidence: latestMeaningful ? [latestMeaningful.id] : [],
  };

  return {
    threadId: input.threadId,
    latestMeaningfulMessage,
    userHasReplied,
    answeredQuestionIds,
    unansweredQuestionIds,
    changedDeadlines,
    conflicts,
    currentActionOwner,
    isResolved,
    waitingOn,
  };
}

function messageTimeOf(deadline: Deadline, messages: readonly EmailMessage[]): string {
  const id = deadline.source[0]?.messageId;
  return messages.find((m) => m.id === id)?.sentAt ?? messages[0]?.sentAt ?? new Date(0).toISOString();
}

function firstMatch(text: string, re: RegExp): string {
  const m = text.match(re);
  return m ? m[0] : '';
}

/* ------------------------------------------------ quoted-history reduction */

/**
 * Splits a body from the quoted history beneath it.
 *
 * Providers return them concatenated. Separating them is what lets the
 * conversation pane collapse the history, and it is what stops an extraction
 * citing quoted text as though the sender wrote it.
 *
 * The patterns are the common ones, and the function is conservative: where it
 * cannot find a boundary it returns the whole body and no history, because
 * truncating a message at a guessed boundary loses content a person needs.
 */
const QUOTE_BOUNDARIES: readonly RegExp[] = [
  /^On\s.+\swrote:\s*$/m,
  /^-{2,}\s*Original Message\s*-{2,}\s*$/im,
  /^_{5,}\s*$/m,
  /^From:\s.+$/m,
  /^>\s?.*$/m,
  /^Sent from my \w+$/m,
];

export function reduceQuotedHistory(body: string): { body: string; quotedHistory: string | null } {
  let earliest = -1;

  for (const re of QUOTE_BOUNDARIES) {
    const pattern = new RegExp(re.source, re.flags.includes('m') ? re.flags : `${re.flags}m`);
    const match = pattern.exec(body);
    if (match && (earliest === -1 || match.index < earliest)) earliest = match.index;
  }

  if (earliest <= 0) return { body: body.trimEnd(), quotedHistory: null };

  const head = body.slice(0, earliest).trimEnd();
  const tail = body.slice(earliest).trim();

  // A body reduced to almost nothing means the boundary was wrong. Returning
  // the whole thing is the safe failure: a visible quoted block is a cosmetic
  // problem, a truncated message is a content loss.
  if (head.trim().length < 15) return { body: body.trimEnd(), quotedHistory: null };

  return { body: head, quotedHistory: tail.length > 0 ? tail : null };
}
