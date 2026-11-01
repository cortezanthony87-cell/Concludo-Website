// Pure validator module for draft-meeting-record (Deno, Node, Bun compatible)
import {
  RawRecord,
  ValidationResult,
  ValidatedRecord,
  ValidatedDecision,
  ValidatedAction,
  ValidatedOpenQuestion,
  ValidatedRisk,
  NextMeetingInput
} from './types.ts';

export * from './types.ts';

export function cleanParticipantName(name: string): string {
  if (!name) return '';
  return name.replace(/[\s\t]+\d+(?::\d{2})*$/g, '').trim();
}

/**
 * Redact a single string:
 * 1. En and em dashes replaced with ", "
 * 2. Passwords, passcodes, PINs, alarm codes, access/door/security codes
 * 3. Credit cards (13-19 digits)
 * 4. Australian TFNs (9 digits)
 * 5. BSBs (when near BSB keyword within 3 words or 123-456 followed by account number)
 */
export function redactString(
  s: string,
  state: { redactionCount: number; flags: Set<string> }
): string {
  if (!s || typeof s !== 'string') return s;
  let mod = s;

  // 1. Dash replacement: en (\u2013) and em (\u2014) dashes with ", "
  // Section 2.5: replace \s*[\u2013\u2014]\s* with ", "
  mod = mod.replace(/\s*[\u2013\u2014]\s*/g, ', ');

  // 2. Secret keywords with up to 5 words before is/:/=
  // Keywords: password, passcode, pass code, PIN, alarm code, access code, door code, security code
  const secretRegex = /\b(?:pass(?:word|code|\s+code)|pin|alarm\s+code|access\s+code|door\s+code|security\s+code)(?:(?:[\s,]+[\w'-]+){0,5}?\s*(?::|=|is|\bis\b)|\s+)\s*([^\s,;.]+)/gi;
  mod = mod.replace(secretRegex, (m, val) => {
    state.redactionCount++;
    state.flags.add('sensitive_content_withheld');
    return m.replace(val, '[REDACTED]');
  });

  // 3. Card numbers (13 to 19 digits with spaces/hyphens)
  const cardRegex = /\b(?:\d[ -]*?){13,19}\b/g;
  mod = mod.replace(cardRegex, () => {
    state.redactionCount++;
    state.flags.add('sensitive_content_withheld');
    return '[REDACTED]';
  });

  // 4. TFN (9 digits, 3-3-3)
  const tfnRegex = /\b\d{3}[ -]?\d{3}[ -]?\d{3}\b/g;
  mod = mod.replace(tfnRegex, () => {
    state.redactionCount++;
    state.flags.add('sensitive_content_withheld');
    return '[REDACTED]';
  });

  // 5. BSB:
  // (a) BSB within 3 words of 6 digits (e.g. "BSB is 123 456", "BSB 123-456", "123 456 BSB")
  const bsbNearRegex = /(?:\bBSB(?:\s+[\w'-]+){0,3}\s+(\d{3}[ -]?\d{3})\b|\b(\d{3}[ -]?\d{3})(?:\s+[\w'-]+){0,3}\s+BSB\b)/gi;
  mod = mod.replace(bsbNearRegex, (full, g1, g2) => {
    state.redactionCount++;
    state.flags.add('sensitive_content_withheld');
    const target = g1 || g2;
    return full.replace(target, '[REDACTED]');
  });

  // (b) 123-456 followed by account number (6 to 10 digits within 3 words)
  const bsbAccRegex = /\b(\d{3}-\d{3})(?=(?:\s+[\w'-]+){0,3}\s+\d{6,10}\b)/gi;
  mod = mod.replace(bsbAccRegex, () => {
    state.redactionCount++;
    state.flags.add('sensitive_content_withheld');
    return '[REDACTED]';
  });

  // Section 2.4: Account numbers (6 to 10 digits following account or acct within 3 words)
  // e.g. "account 1234 5678", "acct no. 987654321"
  const accRegex = /\b(?:account|acct)(?:\s+[\w#.-]+){0,3}\s+((?:\d[ -]?){6,12}\b)/gi;
  mod = mod.replace(accRegex, (full, digitGroup) => {
    const rawDigits = digitGroup.replace(/\D/g, '');
    if (rawDigits.length >= 6 && rawDigits.length <= 10) {
      state.redactionCount++;
      state.flags.add('sensitive_content_withheld');
      return full.replace(digitGroup, '[REDACTED]');
    }
    return full;
  });

  return mod;
}

/**
 * Recursive deep redaction over every string field of an object or array.
 */
export function deepRedact<T>(val: T, state: { redactionCount: number; flags: Set<string> }): T {
  if (val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return redactString(val, state) as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map((item) => deepRedact(item, state)) as unknown as T;
  }
  if (typeof val === 'object') {
    const res: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = deepRedact(v, state);
    }
    return res as T;
  }
  return val;
}

/**
 * Section 1.2: Strict date validation rules
 * - rawPhrase must be present and appear verbatim in transcript (no scattered word-bag match, no weekday/tomorrow/next week fallbacks)
 * - isoDate must be YYYY-MM-DD and not before meetingDate
 * - If rawPhrase names a weekday, the ISO date must fall on that exact weekday
 * - If rawPhrase names a month, the ISO date must fall in that exact month
 * - If rawPhrase names a day number (e.g. "26th", "26", "5"), the ISO date must match that day number
 */
export function checkDateWordsMatchIso(rawPhrase: string, isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const rawLower = rawPhrase.toLowerCase();
  const [yStr, mStr, dStr] = isoDate.split('-');
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);

  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  const dt = new Date(Date.UTC(y, m - 1, d));
  const isoWeekday = weekdays[dt.getUTCDay()];

  // Check weekday consistency if raw phrase explicitly mentions any weekday
  const mentionedWeekdays = weekdays.filter(w => new RegExp('\\b' + w + '\\b').test(rawLower));
  if (mentionedWeekdays.length > 0 && !mentionedWeekdays.includes(isoWeekday)) {
    return false;
  }

  // Check month consistency if raw phrase explicitly mentions any month
  const mentionedMonths = months.filter(mName => new RegExp('\\b' + mName + '\\b').test(rawLower));
  if (mentionedMonths.length > 0 && !mentionedMonths.includes(months[m - 1])) {
    return false;
  }

  // If raw phrase contains full ISO date YYYY-MM-DD, check that directly
  if (rawLower.includes(isoDate)) {
    return true;
  }

  // Check day number consistency if raw phrase mentions an explicit day number (1-31)
  // Strip out ISO dates (YYYY-MM-DD) before checking standalone day numbers
  const cleanedRaw = rawLower.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '');
  const dayMatches = cleanedRaw.match(/\b\d{1,2}(?:st|nd|rd|th)?\b/g);
  if (dayMatches) {
    for (const dm of dayMatches) {
      const num = parseInt(dm.replace(/\D/g, ''), 10);
      if (num >= 1 && num <= 31 && num !== d) {
        return false;
      }
    }
  }

  return true;
}

export function computeRelativeDate(rawPhrase: string, meetingDate: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meetingDate)) return null;
  const raw = rawPhrase.toLowerCase().replace(/\s+/g, " ").trim();

  // Explicit unresolvable or vague phrases that must stay nulled
  if (/\b(?:by christmas|first thing next week|mid-december|mid december|at some point|end of term)\b/.test(raw)) {
    return null;
  }

  const [mY, mM, mD] = meetingDate.split("-").map((x) => parseInt(x, 10));
  const mDate = new Date(Date.UTC(mY, mM - 1, mD));
  const mDayOfWeek = mDate.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  const fmtIso = (d: Date) => d.toISOString().slice(0, 10);
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);

  // 1. "today", "tomorrow"
  if (/\btoday\b/.test(raw)) return fmtIso(mDate);
  if (/\btomorrow\b/.test(raw)) return fmtIso(addDays(mDate, 1));

  // 4. "same time in two weeks", "in N days", "in N weeks", "in a fortnight", "next fortnight"
  if (/\b(?:same time in two weeks|in two weeks|in 2 weeks)\b/.test(raw)) {
    return fmtIso(addDays(mDate, 14));
  }
  if (/\b(?:in a fortnight|next fortnight)\b/.test(raw)) {
    return fmtIso(addDays(mDate, 14));
  }
  const inDaysMatch = raw.match(/\bin\s+(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\b/);
  if (inDaysMatch) {
    const numWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
    const n = parseInt(inDaysMatch[1], 10) || numWords[inDaysMatch[1]] || 0;
    if (n > 0) return fmtIso(addDays(mDate, n));
  }
  const inWeeksMatch = raw.match(/\bin\s+(\d+|one|two|three|four|five|six)\s+weeks?\b/);
  if (inWeeksMatch) {
    const numWords: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    const n = parseInt(inWeeksMatch[1], 10) || numWords[inWeeksMatch[1]] || 0;
    if (n > 0) return fmtIso(addDays(mDate, n * 7));
  }

  // 5. "end of the week" (Friday), "end of next week" (Friday of following week), "end of the month" (last day of month)
  if (/\bend of next week\b/.test(raw)) {
    const daysUntilNextMon = (8 - mDayOfWeek) % 7 || 7;
    const nextMonday = addDays(mDate, daysUntilNextMon);
    const nextFriday = addDays(nextMonday, 4);
    return fmtIso(nextFriday);
  }
  if (/\bend of (?:the )?week\b/.test(raw)) {
    let diff = 5 - mDayOfWeek;
    if (diff <= 0) diff += 7;
    return fmtIso(addDays(mDate, diff));
  }
  if (/\bend of (?:the )?month\b/.test(raw)) {
    const lastDayOfMonth = new Date(Date.UTC(mY, mM, 0));
    if (fmtIso(lastDayOfMonth) >= meetingDate) {
      return fmtIso(lastDayOfMonth);
    }
    const lastDayNextMonth = new Date(Date.UTC(mY, mM + 1, 0));
    return fmtIso(lastDayNextMonth);
  }

  const weekdays = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

  // 2. "next <weekday>" vs "<weekday>" (e.g. "by Monday", "next Monday")
  const nextWeekdayMatch = raw.match(/\bnext\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (nextWeekdayMatch) {
    const targetDay = weekdays.indexOf(nextWeekdayMatch[1]);
    const daysUntilNextMon = (8 - mDayOfWeek) % 7 || 7;
    const nextWeekStart = addDays(mDate, daysUntilNextMon);
    const targetOffset = (targetDay + 7 - 1) % 7;
    return fmtIso(addDays(nextWeekStart, targetOffset));
  }

  const plainWeekdayMatch = raw.match(/\b(?:by\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/);
  if (plainWeekdayMatch && !raw.includes("last " + plainWeekdayMatch[1])) {
    const targetDay = weekdays.indexOf(plainWeekdayMatch[1]);
    let diff = targetDay - mDayOfWeek;
    if (diff <= 0) diff += 7;
    return fmtIso(addDays(mDate, diff));
  }

  // 3. Day of the month in digits or ordinal words ("the 16th", "the sixteenth", "1st of December")
  const ordinals: Record<string, number> = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5,
    sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
    eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15,
    sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20,
    "twenty-first": 21, "twenty-second": 22, "twenty-third": 23, "twenty-fourth": 24,
    "twenty-fifth": 25, "twenty-sixth": 26, "twenty-seventh": 27, "twenty-eighth": 28,
    "twenty-ninth": 29, "thirtieth": 30, "thirty-first": 31,
    "twenty first": 21, "twenty second": 22, "twenty third": 23, "twenty fourth": 24,
    "twenty fifth": 25, "twenty sixth": 26, "twenty seventh": 27, "twenty eighth": 28,
    "twenty ninth": 29
  };

  const months = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

  let targetDayNum: number | null = null;
  let targetMonthNum: number | null = null;

  for (let mi = 0; mi < months.length; mi++) {
    if (new RegExp("\\b" + months[mi] + "\\b").test(raw)) {
      targetMonthNum = mi + 1;
      break;
    }
  }

  for (const [w, num] of Object.entries(ordinals)) {
    if (new RegExp("\\b" + w + "\\b").test(raw)) {
      targetDayNum = num;
      break;
    }
  }
  if (!targetDayNum) {
    const digitMatch = raw.match(/\b(\d{1,2})(?:st|nd|rd|th)?\b/);
    if (digitMatch) {
      const n = parseInt(digitMatch[1], 10);
      if (n >= 1 && n <= 31) targetDayNum = n;
    }
  }

  if (targetDayNum) {
    if (targetMonthNum) {
      let candidate = new Date(Date.UTC(mY, targetMonthNum - 1, targetDayNum));
      if (fmtIso(candidate) < meetingDate) {
        candidate = new Date(Date.UTC(mY + 1, targetMonthNum - 1, targetDayNum));
      }
      return fmtIso(candidate);
    } else {
      let candidate = new Date(Date.UTC(mY, mM - 1, targetDayNum));
      if (fmtIso(candidate) < meetingDate) {
        candidate = new Date(Date.UTC(mY, mM, targetDayNum));
      }
      return fmtIso(candidate);
    }
  }

  return null;
}

export function validateDateStrict(
  isoDate: string | null | undefined,
  meetingDate: string,
  rawPhrase: string | null | undefined,
  tNorm: string
): { validIso: string | null; uncertain: boolean } {
  if (!isoDate) return { validIso: null, uncertain: false };
  const isValidIso = /^\d{4}-\d{2}-\d{2}$/.test(isoDate);
  if (!isValidIso) return { validIso: null, uncertain: true };
  if (isoDate < meetingDate) return { validIso: null, uncertain: true };

  // rawPhrase is strictly required
  if (!rawPhrase || typeof rawPhrase !== 'string') {
    return { validIso: null, uncertain: true };
  }

  const rawNorm = rawPhrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!rawNorm) return { validIso: null, uncertain: true };

  // Must appear VERBATIM in the normalized transcript
  if (!tNorm.includes(rawNorm)) {
    return { validIso: null, uncertain: true };
  }

  // If rawPhrase literally contains the ISO date (YYYY-MM-DD)
  if (rawNorm.includes(isoDate) && checkDateWordsMatchIso(rawNorm, isoDate)) {
    return { validIso: isoDate, uncertain: false };
  }

  // Round 4 Rule: Compute relative date implied from meetingDate
  const computedDate = computeRelativeDate(rawNorm, meetingDate);
  if (computedDate) {
    if (computedDate === isoDate) {
      // Also verify checkDateWordsMatchIso if weekday or month or day is named
      if (checkDateWordsMatchIso(rawNorm, isoDate)) {
        return { validIso: isoDate, uncertain: false };
      }
    }
    // Mismatch or failed word check
    return { validIso: null, uncertain: true };
  }

  // Anything else (vague phrases like "by Christmas", "mid-December", etc.) stays nulled
  return { validIso: null, uncertain: true };
}

export function validateModelRecord(
  raw: RawRecord,
  transcript: string,
  meetingDate: string
): ValidationResult {
  const drops: Array<{ kind: string; text: string; reason: string; quote: string }> = [];
  const dateNulls: any[] = [];
  const ownerNulls: any[] = [];
  const redactionState = { redactionCount: 0, flags: new Set<string>(raw.flags || []) };

  const tNorm = transcript.toLowerCase().replace(/\s+/g, ' ');

  // 1. Clean participants
  const participants: Array<{ name: string; organisation: string | null }> = [];
  const seenParticipants = new Set<string>();
  for (const p of raw.participants || []) {
    const cleaned = cleanParticipantName(p.name || '');
    if (!cleaned) continue;
    const cLow = cleaned.toLowerCase();
    const firstName = cLow.split(' ')[0];
    if (!tNorm.includes(cLow) && !tNorm.includes(firstName)) continue; // drop unmentioned names
    if (seenParticipants.has(cLow)) continue; // remove duplicates
    seenParticipants.add(cLow);
    participants.push({ name: cleaned, organisation: p.organisation || null });
  }

  // 2. Evidence gate
  function checkEvidence(item: any, kind: string): boolean {
    const q = (item.source_quote || '').trim().toLowerCase().replace(/\s+/g, ' ');
    const words = q.split(' ').filter((w: string) => w.length > 0);
    if (words.length < 4 || !tNorm.includes(q)) {
      drops.push({ kind, text: item.text, reason: 'no supporting line found', quote: item.source_quote });
      return false;
    }
    return true;
  }

  const rawDecisions = raw.decisions || [];
  const rawActions = raw.actions || [];
  const rawOpenQuestions = raw.open_questions || [];
  const rawRisks = raw.risks || [];

  const totalProposedItems = rawDecisions.length + rawActions.length + rawOpenQuestions.length + rawRisks.length;

  const validDecisions = rawDecisions.filter((d) => checkEvidence(d, 'decision'));
  const validOpenQuestions = rawOpenQuestions.filter((q) => checkEvidence(q, 'open_question'));
  const validRisks = rawRisks.filter((r) => checkEvidence(r, 'risk'));

  // Decisions: preserve conditions, decided_by, source_quote
  const decisions: ValidatedDecision[] = validDecisions.map((d) => {
    let decided_by = d.decided_by ? cleanParticipantName(d.decided_by) : null;
    return {
      text: d.text,
      decided_by: decided_by || null,
      conditions: d.conditions || null,
      source_quote: d.source_quote
    };
  });

  // Actions: check date, owner, preserve done_when, due_raw, source_quote
  const actions: ValidatedAction[] = [];
  for (const a of rawActions) {
    if (!checkEvidence(a, 'action')) continue;

    let due = a.due_date || null;
    if (due) {
      const dateCheck = validateDateStrict(due, meetingDate, a.due_raw, tNorm);
      if (dateCheck.uncertain) {
        dateNulls.push({ text: a.text, due, due_raw: a.due_raw });
        due = null;
        redactionState.flags.add('date_uncertainty');
      }
    }

    let owner = a.owner ? cleanParticipantName(a.owner) : null;
    if (owner) {
      const oNorm = owner.toLowerCase().trim();
      const inTranscript = tNorm.includes(oNorm) || participants.some(
        (p) => p.name.toLowerCase().includes(oNorm) || oNorm.includes(p.name.toLowerCase())
      );
      if (!inTranscript) {
        ownerNulls.push({ text: a.text, owner });
        owner = null;
      }
    }

    actions.push({
      text: a.text,
      owner,
      due_date: a.due_approximate ? null : due,
      due_raw: a.due_raw || null,
      due_approximate: !!a.due_approximate,
      status: 'open',
      done_when: a.done_when || null,
      source_quote: a.source_quote
    });
  }

  // Open questions: check needed_by date, preserve resolver, needed_by, source_quote
  const open_questions: ValidatedOpenQuestion[] = [];
  for (const q of validOpenQuestions) {
    let needed_by = q.needed_by || null;
    let needed_by_raw = q.needed_by_raw || null;
    if (needed_by) {
      const dateCheck = validateDateStrict(needed_by, meetingDate, needed_by_raw, tNorm);
      if (dateCheck.uncertain) {
        dateNulls.push({ text: q.text, needed_by, needed_by_raw });
        needed_by = null;
        redactionState.flags.add('date_uncertainty');
      }
    }

    let resolver = q.resolver ? cleanParticipantName(q.resolver) : null;
    open_questions.push({
      text: q.text,
      resolver: resolver || null,
      needed_by,
      needed_by_raw,
      source_quote: q.source_quote
    });
  }

  // Risks: preserve raised_by, mitigation, source_quote
  const risks: ValidatedRisk[] = validRisks.map((r) => {
    let raised_by = r.raised_by ? cleanParticipantName(r.raised_by) : null;
    return {
      text: r.text,
      raised_by: raised_by || null,
      mitigation: r.mitigation || null,
      source_quote: r.source_quote
    };
  });

  // Next meeting: raw_text is strictly required and must appear verbatim in transcript
  let next_meeting: NextMeetingInput | null = null;
  if (raw.next_meeting && raw.next_meeting.date) {
    const rawNm = raw.next_meeting.raw_text;
    const nmDateCheck = validateDateStrict(raw.next_meeting.date, meetingDate, rawNm, tNorm);
    if (!nmDateCheck.uncertain && nmDateCheck.validIso && rawNm) {
      next_meeting = {
        date: nmDateCheck.validIso,
        time: raw.next_meeting.time || null,
        raw_text: rawNm
      };
    } else {
      dateNulls.push({ text: 'next_meeting', date: raw.next_meeting.date, raw_text: rawNm });
      redactionState.flags.add('date_uncertainty');
    }
  }

  // Check instruction-shaped text in transcript (avoiding bare "assistant")
  const instructionPattern = /\b(?:ignore\s+(?:all\s+)?previous\s+instructions|ignore\s+the\s+above|disregard|system\s+prompt|(?:summariser|summarizer)\s+(?:do|must|should|please|never|always|ignore|follow|forget))\b/i;
  if (instructionPattern.test(transcript)) {
    redactionState.flags.add('instruction_shaped_content');
  }

  // Evidence gate threshold: if > 20% dropped, reject
  const droppedCount = drops.length;
  const dropRatio = totalProposedItems > 0 ? (droppedCount / totalProposedItems) : 0;
  const rejectedDueToThreshold = totalProposedItems > 0 && dropRatio > 0.20;

  // Build intermediate record
  const unredactedRecord: ValidatedRecord = {
    participants,
    decisions,
    actions,
    open_questions,
    risks,
    next_meeting,
    flags: Array.from(redactionState.flags)
  };

  // Perform one recursive pass over every string field to redact secrets, cards, TFN, BSB and replace dashes
  const finalRecord = deepRedact(unredactedRecord, redactionState);
  finalRecord.flags = Array.from(redactionState.flags);

  return {
    validated: finalRecord,
    totalProposedItems,
    droppedCount,
    dropRatio,
    dateNulledCount: dateNulls.length,
    ownerNulledCount: ownerNulls.length,
    redactionCount: redactionState.redactionCount,
    rejectedDueToThreshold,
    dropDetails: drops
  };
}
