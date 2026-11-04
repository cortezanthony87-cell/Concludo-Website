import {
  SourceInput,
  MeetingMetaInput,
  MeetingModel,
  Action,
  Evidence,
  Basis,
  Review,
  GateRecord,
  ExcludedItem,
  CoverageRecord,
} from './meetingEngine';

export type { GateRecord, ExcludedItem, CoverageRecord };

const WHOLE_MONTHS: Record<string, string> = {
  january: '01', jan: '01',
  february: '02', feb: '02',
  march: '03', mar: '03',
  april: '04', apr: '04',
  may: '05',
  june: '06', jun: '06',
  july: '07', jul: '07',
  august: '08', aug: '08',
  september: '09', sep: '09', sept: '09',
  october: '10', oct: '10',
  november: '11', nov: '11',
  december: '12', dec: '12',
};

const COMMON_ACTION_VERBS = new Set([
  'accept', 'acquire', 'action', 'activate', 'add', 'address', 'adjust', 'advise', 'allocate',
  'analyse', 'analyze', 'apply', 'appoint', 'appraise', 'approve', 'arrange', 'assemble',
  'assess', 'assign', 'assist', 'attach', 'audit', 'author', 'authorise', 'authorize',
  'automate', 'backup', 'balance', 'benchmark', 'block', 'book', 'brief', 'build',
  'calculate', 'calibrate', 'cancel', 'capture', 'categorise', 'categorize', 'certify',
  'check', 'circulate', 'clarify', 'clean', 'cleanup', 'clear', 'close', 'coach',
  'collect', 'combine', 'communicate', 'compare', 'compile', 'complete', 'comply',
  'compose', 'compute', 'conduct', 'configure', 'confirm', 'connect', 'consolidate',
  'construct', 'consult', 'contact', 'coordinate', 'copy', 'correct', 'counsel',
  'create', 'customize', 'customise', 'debug', 'decide', 'define', 'delegate',
  'delete', 'deliver', 'demonstrate', 'deploy', 'design', 'determine', 'develop',
  'devise', 'diagnose', 'direct', 'disable', 'disclose', 'dispatch', 'distribute',
  'document', 'download', 'draft', 'edit', 'eliminate', 'enable', 'engage', 'enforce',
  'engineer', 'enhance', 'enquire', 'enroll', 'enrol', 'ensure', 'enter', 'equip',
  'escalate', 'establish', 'estimate', 'evaluate', 'examine', 'execute', 'expand',
  'expedite', 'explain', 'explore', 'export', 'extract', 'facilitate', 'finalize',
  'finalise', 'find', 'fix', 'follow', 'forecast', 'formulate', 'forward', 'freeze',
  'fulfill', 'fulfil', 'gather', 'generate', 'get', 'give', 'guide', 'handle',
  'hire', 'hold', 'host', 'identify', 'implement', 'import', 'improve', 'index',
  'inform', 'initiate', 'inspect', 'install', 'instruct', 'integrate', 'interview',
  'introduce', 'investigate', 'issue', 'join', 'launch', 'lead', 'lease', 'liaise',
  'license', 'licence', 'link', 'list', 'load', 'locate', 'lodge', 'log', 'maintain',
  'manage', 'map', 'measure', 'meet', 'merge', 'migrate', 'mitigate', 'modify',
  'monitor', 'move', 'negotiate', 'notify', 'obtain', 'open', 'operate', 'optimise',
  'optimize', 'order', 'organise', 'organize', 'outsource', 'oversee', 'package',
  'participate', 'perform', 'pilot', 'plan', 'post', 'prepare', 'present', 'print',
  'prioritise', 'prioritize', 'process', 'procure', 'produce', 'programme', 'program',
  'promote', 'propose', 'provide', 'publish', 'purchase', 'purge', 'qualify', 're-run',
  'read', 'reassess', 'reconcile', 'record', 'recover', 'recruit', 'redesign', 'reduce',
  'refactor', 'refer', 'refine', 'register', 'regulate', 'reiterate', 'release',
  'relocate', 'remediate', 'remove', 'render', 'renegotiate', 'reorganise', 'reorganize',
  'repair', 'replace', 'replicate', 'report', 'request', 'reschedule', 'research',
  'reset', 'resolve', 'respond', 'restore', 'restructure', 'retain', 'retest',
  'retrieve', 'review', 'revise', 'revoke', 'rework', 'rollout', 'route', 'run',
  'safeguard', 'save', 'scale', 'scan', 'schedule', 'scope', 'screen', 'scrutinise',
  'scrutinize', 'search', 'secure', 'select', 'send', 'separate', 'serve', 'service',
  'set', 'setup', 'settle', 'share', 'ship', 'sign', 'simplify', 'simulate',
  'solicit', 'solve', 'source', 'specify', 'split', 'stabilise', 'stabilize',
  'staff', 'standardise', 'standardize', 'start', 'stop', 'streamline', 'structure',
  'submit', 'supervise', 'supply', 'support', 'survey', 'switch', 'synchronise',
  'synchronize', 'sync', 'synthesise', 'synthesize', 'systematise', 'systematize',
  'table', 'target', 'test', 'track', 'train', 'transfer', 'transform', 'transition',
  'translate', 'transmit', 'triage', 'trigger', 'tune', 'unblock', 'unify', 'uninstall',
  'unlink', 'unlock', 'update', 'upgrade', 'upload', 'use', 'validate', 'verify',
  'vet', 'view', 'visit', 'warn', 'wire', 'withdraw', 'withhold', 'witness', 'write',
]);

export function isVerbLed(text: string): boolean {
  const clean = text.trim();
  if (!clean) return false;
  const firstWord = clean.split(/\s+/)[0]?.toLowerCase().replace(/[^a-z]/g, '');
  if (!firstWord) return false;
  if (COMMON_ACTION_VERBS.has(firstWord)) return true;
  if (firstWord.endsWith('ing') && COMMON_ACTION_VERBS.has(firstWord.slice(0, -3))) return true;
  if (firstWord.endsWith('ed') && COMMON_ACTION_VERBS.has(firstWord.slice(0, -2))) return true;
  return false;
}

const MONTH_WORD_REGEX = /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\b/i;

export function matchWholeMonth(str: string): { monthNum: string; raw: string } | null {
  const m = str.match(MONTH_WORD_REGEX);
  if (!m) return null;
  const key = m[1].toLowerCase();
  const num = WHOLE_MONTHS[key];
  return num ? { monthNum: num, raw: m[1] } : null;
}

export function daysInMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

export function stripReasonClause(text: string): string {
  return text
    .replace(/,\s*(?:so\s+that|in\s+order\s+to|in\s+order\s+that)\b.*$/i, '')
    .replace(/\s+(?:so\s+that|in\s+order\s+to|in\s+order\s+that)\b.*$/i, '')
    .trim();
}

const GROUP_OWNERS = new Set([
  'team', 'all staff', 'we', 'everyone', 'board', 'committee', 'department', 'all'
]);

function parseIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso: string, n: number): string {
  const d = parseIso(iso);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Fix 8: Document-likeness scoring & Source Type Classification */
export function detectSourceType(inputs: SourceInput[], metaIn?: MeetingMetaInput): 'transcript' | 'minutes' | 'document' {
  if (metaIn?.sourceType) return metaIn.sourceType;
  if (metaIn?.meetingType && /^(?:document|plan|policy|report|brief)$/i.test(metaIn.meetingType)) return 'document';
  if (metaIn?.meetingType && /^(?:transcript|recording|call|meeting)$/i.test(metaIn.meetingType)) return 'transcript';
  if (metaIn?.meetingType && /^(?:minutes|board)$/i.test(metaIn.meetingType)) return 'minutes';

  const fullText = inputs.map((s) => s.text).join('\n');

  // Minutes / Notes markers take precedence (e.g. - Decision:, - Action:, - Risk:, RESOLVED:)
  const minutesMatches = fullText.match(/^(?:[-*•]\s*)?(?:RESOLVED|Resolved|ACTION|Action|DECISION|Decision|RISK|Risk)\s*:/m) || fullText.match(/\bAttendees:\s*.*\(Chair\)/i);
  if (minutesMatches) {
    return 'minutes';
  }

  // Transcript cues: timestamped turns, VTT headers, or alternating Name: turns (excluding meta labels)
  const rawTurns = fullText.match(/^[A-Z][A-Za-z\s]{1,25}:/gm) || [];
  const speakerTurnMatches = rawTurns.filter(
    (t) => !/^(?:attendees?|present|apologies|absent|chair|resolved|action|date|meeting|subject|agenda|notes):/i.test(t.trim())
  );
  const timestampMatches = fullText.match(/\b(?:\d{1,2}:\d{2}(?::\d{2})?)\b/g) || [];
  const vttMatches = fullText.match(/^WEBVTT/m) || [];
  const transcriptScore = (speakerTurnMatches.length * 3) + timestampMatches.length + (vttMatches.length * 20);

  // Document likeness score: markdown headings, lists, tables, checkboxes, plan keywords
  const headingMatches = fullText.match(/^#{1,6}\s+.+$/gm) || [];
  const listMatches = fullText.match(/^(?:[-*•]|\d+[\.)])\s+.+$/gm) || [];
  const tableMatches = fullText.match(/\|.+?\|.+?\|/gm) || [];
  const checkboxMatches = fullText.match(/[☐☑]|\[\s*\]|\[x\]/gi) || [];
  const documentKeywords = fullText.match(/\b(?:version\s+\d|table of contents|executive summary|actions\s*\(measurable\)|deliverables|appendix|policy|work\s*plan|roadmap)\b/gi) || [];

  const documentScore = (headingMatches.length * 2) + listMatches.length + (tableMatches.length * 2) + (checkboxMatches.length * 5) + (documentKeywords.length * 3);

  if (documentScore > transcriptScore) {
    return 'document';
  }
  if (transcriptScore > documentScore) {
    return 'transcript';
  }
  if (transcriptScore === 0 && documentScore > 0) {
    return 'document';
  }

  return 'transcript';
}

/** Fix 1 & 10: Whole-word months only. Never default a year. */
function parseStageEnd(sStr: string): { date: string; precision: 'day' | 'month' } | null {
  const mDay = sStr.match(/(?:to|-|–)\s*(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/i);
  if (mDay) {
    const d = parseInt(mDay[1], 10);
    const mon = matchWholeMonth(mDay[2]);
    const y = mDay[3];
    if (mon) {
      const maxDays = daysInMonth(parseInt(y, 10), parseInt(mon.monthNum, 10));
      const validD = Math.min(d, maxDays);
      return { date: `${y}-${mon.monthNum}-${String(validD).padStart(2, '0')}`, precision: 'day' };
    }
  }

  const mMon = sStr.match(/(?:to|-|–)\s*([A-Za-z]+)\s+(\d{4})/i);
  if (mMon) {
    const mon = matchWholeMonth(mMon[1]);
    const y = mMon[2];
    if (mon) {
      return { date: `${y}-${mon.monthNum}`, precision: 'month' };
    }
  }
  return null;
}

/** Fix 1 & 10: Resolve due date without defaulting year. */
export function resolveTableDue(
  cellText: string,
  baseYear: number | null
): { date: string | null; raw: string | null } {
  const raw = cellText.trim();
  if (!raw) return { date: null, raw: null };

  // Check for whole month in string
  const mon = matchWholeMonth(raw);
  if (!mon) {
    return { date: null, raw };
  }

  // 4-digit year in cell, or derived from document anchor/version
  const yearM = raw.match(/\b(20\d{2})\b/);
  const year = yearM ? parseInt(yearM[1], 10) : baseYear;
  if (!year) {
    // If no year stated or derivable, leave date empty
    return { date: null, raw };
  }

  const monthInt = parseInt(mon.monthNum, 10);
  const dayM = raw.match(/\b([12]\d|3[01]|0?[1-9])(?:st|nd|rd|th)?\b/);

  if (dayM) {
    const dd = parseInt(dayM[1], 10);
    const maxDays = daysInMonth(year, monthInt);
    const validDay = Math.min(dd, maxDays);
    return {
      date: `${year}-${mon.monthNum}-${String(validDay).padStart(2, '0')}`,
      raw,
    };
  }

  if (/end of/i.test(raw)) {
    const lastDay = daysInMonth(year, monthInt);
    return {
      date: `${year}-${mon.monthNum}-${String(lastDay).padStart(2, '0')}`,
      raw,
    };
  }

  return {
    date: `${year}-${mon.monthNum}`,
    raw,
  };
}

export function isActionHeading(text: string): boolean {
  return /^(?:#+\s*)?(?:Actions(?:\s*\(.*?\))?|Action\s+items?|Next\s+steps?|To\s*do|Tasks?|Follow\s*ups?|Immediate\s+actions?|Agreed\s+actions?|Work\s+plan|Execution\s+plan|Key\s+tasks?|Do\s+now)\b/i.test(text.trim());
}

export function analyseDocumentMode(inputs: SourceInput[], metaIn: MeetingMetaInput = {}): MeetingModel {
  const fullText = inputs.map((s) => s.text).join('\n');
  const lines = fullText.split(/\r?\n/);
  const sourceName = inputs[0]?.name || 'Document';

  // 1. Day 1 Anchor
  let anchorDate: string | null = null;
  const anchorM = fullText.match(/Day 1 is (?:[A-Za-z]+,?\s+)?(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (anchorM) {
    const parts = anchorM[1].split(/\s+/);
    const d = parseInt(parts[0], 10);
    const mon = matchWholeMonth(parts[1]);
    const y = parts[2];
    if (mon) {
      anchorDate = `${y}-${mon.monthNum}-${String(d).padStart(2, '0')}`;
    }
  }

  // 2. Document Date (Version header or explicit document date)
  let docDate: string | null = null;
  const vM = fullText.match(/(?:version\s+\d+(?:\.\d+)?\.?\s+.*?|source document\s+·\s+)(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i);
  if (vM) {
    const parts = vM[1].split(/\s+/);
    const d = parseInt(parts[0], 10);
    const mon = matchWholeMonth(parts[1]);
    const y = parts[2];
    if (mon) {
      docDate = `${y}-${mon.monthNum}-${String(d).padStart(2, '0')}`;
    }
  }
  if (!docDate) {
    const headerBlock = lines.slice(0, 20).join('\n');
    const dM = headerBlock.match(/\b(?:dated|date|effective|published|prepared|held)?\s*[:·,]?\s*(\d{1,2}\s+[A-Za-z]+\s+\d{4})\b/i);
    if (dM) {
      const parts = dM[1].split(/\s+/);
      const d = parseInt(parts[0], 10);
      const mon = matchWholeMonth(parts[1]);
      const y = parts[2];
      if (mon) {
        docDate = `${y}-${mon.monthNum}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  // Fix 1 & Fix 6: Never default year, and never default meetingDate to today
  const baseYear = docDate
    ? parseInt(docDate.split('-')[0], 10)
    : (anchorDate ? parseInt(anchorDate.split('-')[0], 10) : null);
  const meetingDate = metaIn.meetingDate || docDate || undefined;

  // 3. Document Title
  let docTitle = metaIn.title;
  if (!docTitle) {
    const tM = fullText.match(/^#\s+(.+)$/m);
    if (tM) docTitle = tM[1].trim();
  }
  if (!docTitle) {
    docTitle = sourceName.replace(/\.[^.]+$/, '');
  }


  // Fix 3: Count candidates independently before extraction
  interface RawCandidate {
    lineNum: number;
    text: string;
    kind: 'checkbox' | 'list_item' | 'table_row' | 'prose_commitment';
  }
  const rawCandidates: RawCandidate[] = [];
  let inActionSecCount = false;
  let inTableCount = false;

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const cl = line.trim();
    if (!cl) return;

    if (/^#{1,6}\s+/.test(cl)) {
      inActionSecCount = isActionHeading(cl);
    } else if (/^[A-Z][A-Za-z\s()]+:?$/.test(cl) && cl.length < 40 && isActionHeading(cl)) {
      inActionSecCount = true;
    }

    if (cl.startsWith('|')) {
      const cells = cl.split('|').slice(1, -1).map((c) => c.trim().toLowerCase());
      if (cells.some((c) => c.includes('action') || c.includes('task'))) {
        inTableCount = true;
        return;
      }
      if (inTableCount) {
        if (cells.every((c) => c.replace(/-/g, '').trim() === '')) return; // separator
        rawCandidates.push({ lineNum, text: cl, kind: 'table_row' });
        return;
      }
    } else {
      inTableCount = false;
    }

    // Checkbox lines
    if (/[☐☑]|\[\s*\]|\[x\]/i.test(cl)) {
      rawCandidates.push({ lineNum, text: cl, kind: 'checkbox' });
      return;
    }

    // Plain list items under action heading (Fix 2 & 9)
    if (inActionSecCount && /^(?:[-*•]|\d+[\.)])\s+/.test(cl)) {
      rawCandidates.push({ lineNum, text: cl, kind: 'list_item' });
      return;
    }

    // Named person commitment in prose
    if (!cl.includes('|') && !cl.startsWith('#')) {
      const commitM = cl.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:will|must)\s+([a-z]+)\b/);
      if (commitM) {
        const subj = commitM[1];
        const isInanimate = /^(?:The|This|Our|Its|A|An|Every|Each)\s+/i.test(subj) ||
          /^(?:policy|document|statement|review|section|plan|team|board|committee|organisation|organization|company|department|group|all\s+staff)$/i.test(subj);
        if (!isInanimate) {
          rawCandidates.push({ lineNum, text: cl, kind: 'prose_commitment' });
        }
      }
    }
  });

  const actions: Action[] = [];
  const excludedItems: ExcludedItem[] = [];
  const gates: GateRecord[] = [];
  const extractedCandidateLines = new Set<number>();
  const excludedCandidateLines = new Set<number>();

  let currentStageName: string | undefined;
  let currentStageEnd: string | null = null;
  let currentStagePrec: 'day' | 'month' | null = null;
  let currentStageNo = 0;
  let inActionSection = false;
  let inMarkdownTable = false;
  let colMap: Record<string, number | undefined> = {};

  lines.forEach((line, lineIdx) => {
    const lineNum = lineIdx + 1;
    const cleanLine = line.trim();
    if (!cleanLine) return;

    // Heading context check
    if (/^#{1,6}\s+/.test(cleanLine)) {
      inActionSection = isActionHeading(cleanLine);
    } else if (/^[A-Z][A-Za-z\s()]+:?$/.test(cleanLine) && cleanLine.length < 40 && isActionHeading(cleanLine)) {
      inActionSection = true;
    }

    // A. Detect Stage Header (General pattern)
    const isTocLine = /\t\s*\d+$/.test(cleanLine);
    const isTableLine = cleanLine.startsWith('|');
    const stM = !isTocLine && !isTableLine && cleanLine.match(/^(?:#{1,6}\s+)?(?:[A-Z0-9]+[.\s]+)?((?:(?:Phase|Stage)\s+\d+|(?:First\s+\d+\s+days|Days\s+\d+\s+to\s+\d+|Months?\s+\d+\s+to\s+\d+|Years?\s+\d+(?:\s+(?:and|to)\s+\d+)?|Now\s+to\s+Day\s+\d+))[^|\n]*)/i);
    if (stM) {
      const candidateSt = stM[1].trim().replace(/^\|\s*|\s*\|$/g, '');
      currentStageName = candidateSt;
      currentStageNo += 1;
      const endD = parseStageEnd(candidateSt);
      if (endD) {
        currentStageEnd = endD.date;
        currentStagePrec = endD.precision;
      } else {
        currentStageEnd = null;
        currentStagePrec = null;
      }
    }

    // B. Detect Decision Gate (D5)
    const gateM = cleanLine.match(/\|\s*Decision gate\s*\|\s*([^|]+)\|/i);
    if (gateM) {
      const gateDesc = gateM[1].trim();
      let stopRule: string | undefined;
      let accelRule: string | undefined;
      for (let lookahead = lineIdx + 1; lookahead < Math.min(lines.length, lineIdx + 12); lookahead++) {
        const lTxt = lines[lookahead];
        if (/If missed/i.test(lTxt)) {
          const stopM = lTxt.match(/\|\s*If missed(?:,\s*stop)?\s*\|\s*([^|]+)\|/i);
          if (stopM) stopRule = stopM[1].trim();
        }
        if (/If (?:exceeded|beaten)/i.test(lTxt)) {
          const accM = lTxt.match(/\|\s*If (?:exceeded(?:,\s*accelerate)?|beaten)\s*\|\s*([^|]+)\|/i);
          if (accM) accelRule = accM[1].trim();
        }
      }
      gates.push({
        stage: currentStageName,
        date: currentStageEnd || undefined,
        passTest: gateDesc,
        ifMissedStop: stopRule,
        ifExceededAccelerate: accelRule,
      });
    }

    // C. Structural Purpose Clauses and Non-Action Exclusions (Fix 4 & 5)
    // General structural rules based on heading context, grammatical tense, and modality
    const isPurePurposeSentence = (
      /^(?:(?:The|Our|Its|This|Each)\s+)?(?:[a-z\s]+'s\s+)?(?:(?:primary|main|key|stated|overall)\s+)?(?:goal|purpose|aim|objective|intent|principle|mission)\b(?:\s+of\s+[A-Za-z\s]+?)?\s+(?:is|was)\s+(?:to|for)\b/i.test(cleanLine) ||
      /^Each\s+[a-z\s]+\s+has\s+a\s+(?:job|purpose|goal|role|mission|aim|objective)\b/i.test(cleanLine) ||
      /^(?:The\s+aim\s+is\s+to|The\s+goal\s+is\s+to|Its\s+purpose\s+is\s+to|The\s+purpose\s+(?:of\s+[^is]+)?is\s+to)\b/i.test(cleanLine) ||
      /^(?:In\s+order\s+to\s+[^,]+,\s*(?:the|this|all|our|we)\b)/i.test(cleanLine) ||
      /\b(?:is|are)\s+(?:intended|designed)\s+to\s+(?:reinforce|confirm|ensure|provide|support|guide)\b/i.test(cleanLine)
    );
    const isOpenGapSentence = /^(?:Nobody|No\s+one|No-one)\s+(?:has\s+(?:yet\s+)?been\s+asked\s+to|is\s+assigned\s+to|has\s+been\s+assigned\s+to)\b/i.test(cleanLine);
    const isPassiveDescriptiveSentence = (
      /^(?:This|The|Our)\s+[a-z\s]+(?:describes|outlines|records|sets\s+out|applies\s+to|consists|is\s+a\s+description)\b/i.test(cleanLine) ||
      /^[A-Za-z\s]+\s+(?:are\s+expected\s+to|will\s+be\s+reviewed\s+(?:annually|each\s+year|periodically|quarterly|monthly))\b/i.test(cleanLine)
    );

    // Exclude only when NOT a table row, NOT a checkbox line, and NOT an action list item
    const isCheckboxLine = /[☐☑]|\[\s*\]|\[x\]/i.test(cleanLine);
    const isTableRow = cleanLine.startsWith('|');

    if (!isTableRow && !isCheckboxLine && (isPurePurposeSentence || isOpenGapSentence || isPassiveDescriptiveSentence)) {
      excludedItems.push({
        text: cleanLine.replace(/^\|\s*|\s*\|$/g, ''),
        reason: isPurePurposeSentence ? 'purpose clause' : isOpenGapSentence ? 'unassigned gap' : 'policy description',
        sourceLine: lineNum,
      });
      excludedCandidateLines.add(lineNum);
      return;
    }

    // D. Action Candidates (D2)

    // D2.1 Checkbox Action Line
    // If it is a multi-column table row (3 or more cells), let D2.3 handle it
    const isMultiColumnTableRow = cleanLine.startsWith('|') && cleanLine.split('|').slice(1, -1).length >= 3;
    const cbM = !isMultiColumnTableRow && cleanLine.match(/(?:^|\|\s*|[-*•]\s*)(?:[☐☑]|\[\s*\]|\[x\])\s*(.+?)(?=\s*\|?\s*$)/i);
    if (cbM) {
      const rawContent = cbM[1].trim();
      const dayM = rawContent.match(/^(Day\s+\d+|Days\s+\d+\s+to\s+\d+)[:\s-]+(.*)$/i);
      const inlineDayM = rawContent.match(/\bby\s+(Day\s+\d+)\b/i);

      let dueRaw: string | undefined;
      let dueDate: string | undefined;
      let dueBasis: 'stated' | 'stage_end' | 'none' | null = null;
      let taskText = rawContent;

      if (dayM) {
        dueRaw = dayM[1];
        taskText = dayM[2].trim();
        if (anchorDate) {
          const nums = dueRaw.match(/\d+/g)?.map(Number) || [1];
          const targetDay = nums[nums.length - 1];
          dueDate = addDays(anchorDate, targetDay - 1);
          dueBasis = 'stated';
        }
      } else if (inlineDayM && anchorDate) {
        dueRaw = inlineDayM[1];
        const nums = dueRaw.match(/\d+/g)?.map(Number) || [1];
        const targetDay = nums[nums.length - 1];
        dueDate = addDays(anchorDate, targetDay - 1);
        dueBasis = 'stated';
      } else if (currentStageEnd) {
        dueRaw = undefined;
        dueDate = currentStageEnd;
        dueBasis = 'stage_end';
      }

      // Fix 4: Strip reason clause if present, but keep action
      actions.push({
        id: `X${String(actions.length + 1).padStart(2, '0')}`,
        task: stripReasonClause(taskText),
        owner: undefined,
        ownerBasis: 'none',
        ownerRaw: undefined,
        suggestedOwner: undefined,
        due: dueDate,
        dueRaw: dueRaw,
        dueText: dueRaw,
        dueBasis: dueBasis,
        dueApprox: false,
        horizon: 'undated',
        doneDefinition: undefined,
        doneWhen: undefined,
        stage: currentStageName,
        stageNo: currentStageNo,
        evidence: [
          {
            sourceId: 'S1',
            sourceName,
            line: lineNum,
            quote: cleanLine.replace(/^\|\s*|\s*\|$/g, ''),
          },
        ],
        confidence: 'explicit',
        gaps: ['owner', 'definition_of_done'],
        review: 'proposed',
        sourceLine: lineNum,
        sourceQuote: cleanLine,
      });
      extractedCandidateLines.add(lineNum);
      return;
    }

    // D2.2 Plain list items under action headings (Fix 2 & 9)
    if (inActionSection && !cleanLine.startsWith('|')) {
      const listM = cleanLine.match(/^(?:[-*•]|\d+[\.)])\s+(.+)$/);
      if (listM) {
        const itemContent = listM[1].trim();
        const dayM = itemContent.match(/^(Day\s+\d+|Days\s+\d+\s+to\s+\d+)[:\s-]+(.*)$/i);
        let dueRaw: string | undefined;
        let dueDate: string | undefined;
        let dueBasis: 'stated' | 'stage_end' | 'none' | null = null;
        let taskText = itemContent;

        if (dayM) {
          dueRaw = dayM[1];
          taskText = dayM[2].trim();
          if (anchorDate) {
            const nums = dueRaw.match(/\d+/g)?.map(Number) || [1];
            const targetDay = nums[nums.length - 1];
            dueDate = addDays(anchorDate, targetDay - 1);
            dueBasis = 'stated';
          }
        } else if (currentStageEnd) {
          dueDate = currentStageEnd;
          dueBasis = 'stage_end';
        }

        // D2.2: Line is an action candidate when it begins with a verb
        if (isVerbLed(taskText)) {
        actions.push({
          id: `X${String(actions.length + 1).padStart(2, '0')}`,
          task: stripReasonClause(taskText),
          owner: undefined,
          ownerBasis: 'none',
          ownerRaw: undefined,
          suggestedOwner: undefined,
          due: dueDate,
          dueRaw: dueRaw,
          dueText: dueRaw,
          dueBasis,
          dueApprox: false,
          horizon: 'undated',
          doneDefinition: undefined,
          doneWhen: undefined,
          stage: currentStageName,
          stageNo: currentStageNo,
          evidence: [
            {
              sourceId: 'S1',
              sourceName,
              line: lineNum,
              quote: cleanLine,
            },
          ],
          confidence: 'explicit',
          gaps: ['owner', 'definition_of_done'],
          review: 'proposed',
          sourceLine: lineNum,
          sourceQuote: cleanLine,
        });
        extractedCandidateLines.add(lineNum);
        return;
        }

        // If not verb-led, check if it's an explicit purpose clause exclusion
        if (isPurePurposeSentence || isPassiveDescriptiveSentence) {
          excludedItems.push({
            text: taskText,
            reason: isPurePurposeSentence ? 'purpose clause' : 'policy description',
            sourceLine: lineNum,
          });
          excludedCandidateLines.add(lineNum);
          return;
        }
        // Otherwise, it was counted in rawCandidates, but is neither extracted nor excluded:
        // It stays unresolved, so needsAttention will count it!
        return;
      }
    }

    // D2.3 Markdown Table Action Row
    if (cleanLine.includes('|')) {
      const cells = cleanLine.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.length >= 3) {
        const headerNames = cells.map((c) => c.toLowerCase());
        const hasActionHeader = headerNames.some((h) => h.includes('action') || h.includes('task'));
        const hasMetaHeader = headerNames.some((h) => h.includes('due') || h.includes('owner') || h.includes('when'));
        if (hasActionHeader && hasMetaHeader) {
          inMarkdownTable = true;
          colMap = {
            id: headerNames.findIndex((h) => h.includes('id')),
            action: headerNames.findIndex((h) => h.includes('action') || h.includes('task')),
            owner: headerNames.findIndex((h) => h.includes('owner') || h.includes('who')),
            due: headerNames.findIndex((h) => h.includes('due') || (h.includes('when') && !h.includes('done'))),
            done: headerNames.findIndex((h) => h.includes('done')),
          };
          return;
        } else if (inMarkdownTable && !cells.every((c) => c.replace(/-/g, '').trim() === '')) {
          const actIdx = colMap.action;
          if (actIdx !== undefined && actIdx !== -1 && actIdx < cells.length) {
            const task = cells[actIdx].trim();
            const rawOwner = (colMap.owner !== undefined && colMap.owner !== -1 && colMap.owner < cells.length) ? cells[colMap.owner].trim() : '';
            const rawDue = (colMap.due !== undefined && colMap.due !== -1 && colMap.due < cells.length) ? cells[colMap.due].trim() : '';
            const rawDone = (colMap.done !== undefined && colMap.done !== -1 && colMap.done < cells.length) ? cells[colMap.done].trim() : '';

            let owner: string | undefined;
            let ownerRaw: string | undefined;
            if (rawOwner) {
              if (GROUP_OWNERS.has(rawOwner.toLowerCase())) {
                owner = undefined;
                ownerRaw = rawOwner;
              } else {
                owner = rawOwner;
              }
            }

            const { date: tableDueDate, raw: tableDueRaw } = resolveTableDue(rawDue, baseYear);

            actions.push({
              id: `X${String(actions.length + 1).padStart(2, '0')}`,
              task: stripReasonClause(task),
              owner,
              ownerBasis: owner ? 'stated' : 'none',
              ownerRaw,
              suggestedOwner: undefined,
              due: tableDueDate || undefined,
              dueRaw: tableDueRaw || undefined,
              dueText: tableDueRaw || undefined,
              dueBasis: tableDueDate ? 'stated' : null,
              dueApprox: false,
              horizon: 'undated',
              doneDefinition: rawDone || undefined,
              doneWhen: rawDone || undefined,
              stage: currentStageName,
              stageNo: currentStageNo,
              evidence: [
                {
                  sourceId: 'S1',
                  sourceName,
                  line: lineNum,
                  quote: cleanLine.replace(/^\|\s*|\s*\|$/g, ''),
                },
              ],
              confidence: 'explicit',
              gaps: [
                ...(owner ? [] : ['owner']),
                ...(tableDueDate ? [] : ['due']),
                ...(rawDone ? [] : ['definition_of_done']),
              ],
              review: 'proposed',
              sourceLine: lineNum,
              sourceQuote: cleanLine,
            });
            extractedCandidateLines.add(lineNum);
            return;
          }
        }
      }
    } else {
      inMarkdownTable = false;
    }

    // D2.4 Named Person Commitment in Prose (Fix 5: structural check)
    if (!cleanLine.includes('|')) {
      const commitM = cleanLine.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+(?:will|must)\s+([a-z]+)\b\s*(.*)$/);
      if (commitM) {
        const person = commitM[1];
        const verb = commitM[2];
        const rest = commitM[3];
        const isInanimate = /^(?:The|This|Our|Its|A|An|Every|Each)\s+/i.test(person) ||
          /^(?:policy|document|statement|review|section|plan|team|board|committee|organisation|organization|company|department|group|all\s+staff)$/i.test(person);
        if (!isInanimate) {
          let fullTask = `${verb} ${rest}`.replace(/\.\s*$/, '');
          fullTask = stripReasonClause(fullTask);
          let dueDate: string | undefined;
          let dueRaw: string | undefined;
          let dueBasis: 'stated' | 'stage_end' | 'none' | null = null;

          const dueM = fullTask.match(/\bby\s+((?:[A-Za-z]+,?\s+)?(?:\d{1,2}\s+[A-Za-z]+|[A-Za-z]+\s+\d{1,2}))/i);
          if (dueM) {
            dueRaw = dueM[1].trim();
            const rDue = resolveTableDue(dueRaw, baseYear);
            dueDate = rDue.date || undefined;
            dueBasis = dueDate ? 'stated' : null;
            fullTask = fullTask.slice(0, dueM.index).trim();
          }

          actions.push({
            id: `X${String(actions.length + 1).padStart(2, '0')}`,
            task: fullTask,
            owner: person,
            ownerBasis: 'stated',
            ownerRaw: person,
            suggestedOwner: undefined,
            due: dueDate,
            dueRaw: dueRaw,
            dueText: dueRaw,
            dueBasis,
            dueApprox: false,
            horizon: 'undated',
            doneDefinition: undefined,
            doneWhen: undefined,
            stage: currentStageName,
            stageNo: currentStageNo,
            evidence: [
              {
                sourceId: 'S1',
                sourceName,
                line: lineNum,
                quote: cleanLine,
              },
            ],
            confidence: 'explicit',
            gaps: [
              ...(dueDate ? [] : ['due']),
              'definition_of_done',
            ],
            review: 'proposed',
            sourceLine: lineNum,
            sourceQuote: cleanLine,
          });
          extractedCandidateLines.add(lineNum);
        }
      }
    }
  });

  // Next meeting in prose check
  let nextMeeting: MeetingModel['nextMeeting'] = undefined;
  const nextMeetM = fullText.match(/\b(?:agreed to meet again|meet again|next meeting)\s+(?:on\s+)?((?:Tuesday|Wednesday|Thursday|Friday|Monday|Saturday|Sunday)?,?\s*\d{1,2}\s+[A-Za-z]+(?:\s+\d{4})?)/i);
  if (nextMeetM) {
    const rawMeet = nextMeetM[1].trim();
    const rDue = resolveTableDue(rawMeet, baseYear);
    if (rDue.date) {
      nextMeeting = {
        date: rDue.date,
        rawText: rawMeet,
      };
    }
  }

  // Fix 7: Horizon Bucketing - Only if document declares horizons or explicit dates exist
  const hasDeclaredHorizons = /^(?:#+\s*)?(?:Horizon\s+\d+|Now|Next|Later)\b/im.test(fullText);
  const hasDatedActions = actions.some((a) => a.due);
  const hasHorizons = hasDeclaredHorizons || (hasDatedActions && !!anchorDate);

  if (hasHorizons && anchorDate) {
    actions.forEach((a) => {
      if (a.due) {
        const anchorD = parseIso(anchorDate!);
        const dueD = parseIso(a.due);
        const diffDays = Math.round((dueD.getTime() - anchorD.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 30) a.horizon = 'now';
        else if (diffDays <= 90) a.horizon = 'next';
        else a.horizon = 'later';
      } else {
        a.horizon = 'undated';
      }
    });
  } else {
    actions.forEach((a) => {
      a.horizon = 'undated';
    });
  }

  // Fix 3: Independent Candidate Reconciliation
  const extractedCandidates = rawCandidates.filter((c) => extractedCandidateLines.has(c.lineNum));
  const excludedCandidates = rawCandidates.filter((c) => excludedCandidateLines.has(c.lineNum));
  const unresolvedCandidates = rawCandidates.filter(
    (c) => !extractedCandidateLines.has(c.lineNum) && !excludedCandidateLines.has(c.lineNum)
  );

  const totalCandidates = rawCandidates.length;
  const extractedCount = extractedCandidates.length;
  const totalExcluded = excludedCandidates.length;
  const needsAttention = unresolvedCandidates.length;
  const unresolved = unresolvedCandidates.map((c) => `Line ${c.lineNum}: ${c.text}`);

  const flags: string[] = [];
  if (needsAttention > 0) {
    flags.push('coverage_gap');
    flags.push(`Coverage gap: ${needsAttention} candidate item(s) need attention.`);
  }

  const model: MeetingModel = {
    version: '2.0',
    meta: {
      title: docTitle,
      meetingType: 'Plan document',
      meetingDate: meetingDate || '',
      organisation: metaIn.organisation,
      project: metaIn.project,
      chair: undefined,
      duration: undefined,
    },
    sources: inputs.map((src, i) => ({
      id: `S${i + 1}`,
      name: src.name,
      kind: src.kind,
      words: src.text.split(/\s+/).filter(Boolean).length,
      lines: src.text.split(/\r?\n/).filter((l) => l.trim()).length,
      speakers: 0,
    })),
    participants: [],
    decisions: [],
    actions,
    risks: [],
    openItems: [],
    figures: [],
    recommendations: [],
    health: { dimensions: [], notScored: ['clarity', 'ownership', 'dating', 'mitigation', 'balance'] },
    gate: { status: 'Ready to circulate', checks: [] },
    bottomLine: `${actions.length} actions came out of this document. ${actions.filter((a) => a.dueBasis === 'stated').length} carry their own date and ${actions.filter((a) => a.dueBasis === 'stage_end').length} inherit the end date of their stage. ${actions.filter((a) => a.owner).length ? `${actions.filter((a) => a.owner).length} have an owner.` : 'None has a named owner yet.'}${gates.length ? ` The next gate is ${gates[0].stage || 'Stage 1'}.` : ''}`,
    stats: {
      decisions: 0,
      actions: actions.length,
      owned: actions.filter((a) => a.owner).length,
      dated: actions.filter((a) => a.due).length,
      openItems: 0,
      risks: 0,
      highRisks: 0,
    },
    warnings: [],
    signals: { balance: null, speakers: 0, dateConfirmed: !!docDate },
    sourceType: 'document',
    documentMeta: {
      title: docTitle,
      versionDate: docDate || undefined,
      anchor: anchorDate ? { label: 'Day 1', date: anchorDate } : undefined,
    },
    gates,
    excludedItems,
    coverage: {
      candidates: totalCandidates,
      extracted: extractedCount,
      excluded: totalExcluded,
      needsAttention,
      unresolved,
    },
    nextMeeting,
    flags,
  };

  return model;
}

export function toDocumentModeRecord(m: MeetingModel) {
  return {
    source_type: m.sourceType || 'document',
    document: {
      title: m.documentMeta?.title || m.meta.title || '',
      version_date: m.documentMeta?.versionDate || m.meta.meetingDate,
      anchor: m.documentMeta?.anchor || null,
    },
    actions: m.actions.map((a) => ({
      id: a.id,
      text: a.task,
      owner: a.owner || null,
      owner_raw: a.ownerRaw || null,
      suggested_owner: a.suggestedOwner || null,
      due_raw: a.dueRaw || a.dueText || null,
      due_date: a.due || null,
      due_basis: a.dueBasis || (a.due ? 'stated' : null),
      done_when: a.doneWhen || a.doneDefinition || null,
      stage: a.stage || null,
      stage_no: a.stageNo || null,
      evidence: m.sourceType === 'document' ? 'Planned in source' : 'Confirmed',
      source_line: a.sourceLine || (a.evidence && a.evidence[0] ? a.evidence[0].line : 0),
      source_quote: a.sourceQuote || (a.evidence && a.evidence[0] ? a.evidence[0].quote : ''),
    })),
    gates: (m.gates || []).map((g) => ({
      stage: g.stage,
      date: g.date,
      pass_test: g.passTest,
      if_missed_stop: g.ifMissedStop,
      if_exceeded_accelerate: g.ifExceededAccelerate,
    })),
    excluded: (m.excludedItems || []).map((e) => ({
      text: e.text,
      reason: e.reason,
      source_line: e.sourceLine,
    })),
    coverage: m.coverage ? {
      candidates: m.coverage.candidates,
      extracted: m.coverage.extracted,
      excluded: m.coverage.excluded,
      needs_attention: m.coverage.needsAttention,
      unresolved: m.coverage.unresolved,
    } : {
      candidates: m.actions.length,
      extracted: m.actions.length,
      excluded: m.excludedItems ? m.excludedItems.length : 0,
      needs_attention: 0,
      unresolved: [],
    },
    flags: m.flags || [],
  };
}
