/**
 * Concludo Meeting Rules v3 (Round 7)
 * ---------------------------------------------------------------------------
 * General, speech-act based extraction for the basic drafting method.
 * No names, nouns, products, amounts or whole phrases from any transcript are
 * held here. Cues are function words, common verbs and common hedge or modal
 * words. Decisions, open questions, risks, insights, statements to verify,
 * consent, actions and participants are all rebuilt from the turn structure:
 * who spoke, what the next speaker did, whether a question was answered,
 * whether a proposition was restated by the chair.
 *
 * Every item carries a source_quote that is one contiguous span of one turn,
 * unchanged, 4 to 60 words. Nothing is invented.
 */

export interface RTurn {
  idx: number;
  speaker: string;
  role?: string;
  text: string;
  at?: string;
  line: number;
}

export interface RSentence {
  text: string;
  start: number;
  end: number;
}

export interface RulesDeps {
  resolveDue: (sentence: string, meetingDate: string) => { iso?: string; text?: string; approx: boolean; uncertain?: boolean } | null;
}

/* ------------------------------------------------------------ text helpers */

const META_LABEL_SET = new Set([
  'meeting', 'title', 'subject', 'date', 'time', 'location', 'type', 'recording', 'source', 'platform', 'project',
  'client', 'attendees', 'attendee', 'present', 'apologies', 'absent', 'chair', 'organisation', 'organization', 'agenda',
  'notes', 'note', 'summary', 'minutes', 'duration', 'prepared', 'decision', 'decisions', 'action', 'actions', 'risk',
  'risks', 'transcript', 'room', 'venue', 'topic', 'participants',
]);

const NAME_TOKEN = "[A-Z][A-Za-z'’\\-]*";
const NAME = `${NAME_TOKEN}(?: ${NAME_TOKEN}){0,3}`;

const RE_STAMP_LINE = new RegExp(`^\\[(\\d{1,2}:\\d{2}(?::\\d{2})?)\\]\\s*(${NAME})(?: \\(([^)]{1,40})\\))?:\\s*(.*)$`);
const RE_NAME_LINE = new RegExp(`^(${NAME})(?: \\(([^)]{1,40})\\))?:\\s+(.*)$`);
const RE_NAME_TIME = new RegExp(`^(${NAME})\\s{1,4}(\\d{1,2}:\\d{2}(?::\\d{2})?)\\s*$`);
const RE_NAME_ONLY = new RegExp(`^(${NAME_TOKEN}(?: ${NAME_TOKEN}){0,2})\\s*$`);

export const clean = (s: string) => s.replace(/\s+/g, ' ').trim();
const lc = (s: string) => s.toLowerCase();
const wc = (s: string) => (s.match(/\S+/g) ?? []).length;
const capFirst = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const stripEnd = (s: string) => s.replace(/[\s,;:.!?]+$/, '');
const normW = (s: string) => lc(s).replace(/[‘’]/g, "'").replace(/[^a-z0-9'% ]+/g, ' ').replace(/\s+/g, ' ').trim();

const STOP = new Set(('a an the and or but of to in on at for from with by as is are was were be been it its that this those these ' +
  'we i you he she they them us our my your their will would could should can just so then than there here have has had do does did ' +
  'not no yes if up out into about over also all any more most some very really okay ok right good well one').split(' '));
const contentWords = (s: string) => normW(s).split(' ').filter((w) => w && !STOP.has(w));
function jacc(a: string, b: string): number {
  const x = new Set(contentWords(a));
  const y = new Set(contentWords(b));
  if (!x.size || !y.size) return 0;
  let n = 0;
  x.forEach((w) => { if (y.has(w)) n++; });
  return n / (x.size + y.size - n);
}

export function splitSentences(text: string): RSentence[] {
  const out: RSentence[] = [];
  const re = /[^.?!]*[.?!]+["'”’)\]]*(?=\s|$)|[^.?!]+$/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const raw = m[0];
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t) out.push({ text: t, start: m.index + lead, end: m.index + lead + t.length });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  // merge abbreviation or decimal breaks such as "approx." or "3.5": rejoin when a piece ends with a short lowercase abbreviation
  const merged: RSentence[] = [];
  for (const s of out) {
    const prev = merged[merged.length - 1];
    if (prev && /\b(?:mr|mrs|ms|dr|approx|etc|vs|inc|ltd|no|st)\.$/i.test(prev.text) && !/^["“]?[A-Z]/.test(s.text.slice(0, 1) + '')) {
      prev.text = text.slice(prev.start, s.end);
      prev.end = s.end;
    } else merged.push({ ...s });
  }
  return merged;
}

/** One contiguous span of the turn, starting at sentence k, extended while the span stays within 60 words. */
export function spanQuote(turn: RTurn, sents: RSentence[], from: number, to = from): string {
  let a = from;
  let b = Math.max(from, to);
  const seg = () => turn.text.slice(sents[a].start, sents[b].end);
  let q = seg();
  // extend forward while it helps reach 4 words, then back
  while (wc(q) < 4 && b + 1 < sents.length) { b++; q = seg(); }
  while (wc(q) < 4 && a - 1 >= 0) { a--; q = seg(); }
  // trim from the end if over 60 words (drop trailing sentences first)
  while (wc(q) > 60 && b > a) { b--; q = seg(); }
  if (wc(q) > 60) q = q.split(/\s+/).slice(0, 60).join(' ');
  return q;
}

/** Contiguous window of one turn around sentence k: the whole turn when it is 60 words or fewer, else the widest span up to 60 words. */
function wideQuote(turn: RTurn, sents: RSentence[], k: number): string {
  if (wc(turn.text) <= 60) return turn.text;
  let a = k;
  let b = k;
  let q = turn.text.slice(sents[a].start, sents[b].end);
  let growForward = true;
  for (let guard = 0; guard < 20; guard++) {
    let moved = false;
    for (const dir of growForward ? ['f', 'b'] : ['b', 'f']) {
      if (dir === 'f' && b + 1 < sents.length) {
        const n = turn.text.slice(sents[a].start, sents[b + 1].end);
        if (wc(n) <= 60) { b++; q = n; moved = true; }
      } else if (dir === 'b' && a - 1 >= 0) {
        const n = turn.text.slice(sents[a - 1].start, sents[b].end);
        if (wc(n) <= 60) { a--; q = n; moved = true; }
      }
    }
    growForward = !growForward;
    if (!moved) break;
  }
  if (wc(q) < 4) return spanQuote(turn, sents, k, k);
  return q;
}

/** Trim to one clause or sentence of at most `max` words, never ending on a dangling word. */
function limitWords(s: string, max = 38): string {
  let t = clean(stripEnd(s));
  if (wc(t) <= max) return t;
  const parts = t.split(/(?<=,)\s+|(?<=;)\s+|\s+(?=\band\b|\bbut\b|\bso\b|\bbecause\b)/);
  let acc = '';
  for (const p of parts) {
    const next = acc ? `${acc} ${p}` : p;
    if (wc(next) > max) break;
    acc = next;
  }
  if (!acc) acc = t.split(/\s+/).slice(0, max).join(' ');
  acc = stripEnd(acc);
  return dropDangling(acc);
}

const DANGLING = new Set(['and', 'or', 'a', 'an', 'the', 'to', 'of', 'but', 'so', 'as', 'that', 'if', 'with', 'for', 'in', 'on', 'at', 'by', 'because', 'which', 'who', 'is', 'are', 'was', 'were', "there's", 'than', 'then']);
function dropDangling(s: string): string {
  const w = s.split(/\s+/);
  while (w.length > 3 && DANGLING.has(lc(w[w.length - 1]).replace(/[^a-z']/g, ''))) w.pop();
  return stripEnd(w.join(' '));
}

const LEAD_FILLER = /^(?:(?:so|right|okay|ok|well|good|great|lovely|perfect|then|all right|alright|yes|yeah|yep|fine|and|but|now|look|honestly|actually|anyway|to be clear|just to confirm|thanks|thank you|cool|sure|exactly|fair|true|noted|understood)[,.:;]?\s+)+/i;
export function tidy(s: string): string {
  let t = clean(s).replace(LEAD_FILLER, '');
  t = t.replace(/^[A-Z][a-z]+,\s+(?=(?:can|could|will|would)\s+you\b)/, '');
  return capFirst(stripEnd(t));
}

/* --------------------------------------------------------------- turn parse */

export function parseTurns(text: string): RTurn[] {
  const lines = text.replace(/\r/g, '').split('\n');
  const turns: RTurn[] = [];
  const isMeta = (name: string) => META_LABEL_SET.has(lc(name.split(' ')[0])) && !/\(/.test(name);

  // pass 1: stamped, "Name (Role): text", "Name: text", "Name m:ss" with text below
  let cur: RTurn | null = null;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!l.trim()) { if (cur && cur.at === undefined) { /* keep */ } continue; }
    let m = l.match(RE_STAMP_LINE);
    if (m) {
      cur = { idx: turns.length, speaker: m[2], role: m[3], text: clean(m[4]), at: m[1], line: i + 1 };
      turns.push(cur);
      continue;
    }
    m = l.match(RE_NAME_TIME);
    if (m && !isMeta(m[1])) {
      const buf: string[] = [];
      let j = i + 1;
      while (j < lines.length && !lines[j].trim()) j++;
      while (j < lines.length && lines[j].trim() && !RE_NAME_TIME.test(lines[j])) { buf.push(lines[j].trim()); j++; }
      cur = { idx: turns.length, speaker: m[1], text: clean(buf.join(' ')), at: m[2], line: i + 1 };
      turns.push(cur);
      i = j - 1;
      continue;
    }
    m = l.match(RE_NAME_LINE);
    if (m && !isMeta(m[1])) {
      cur = { idx: turns.length, speaker: m[1], role: m[2], text: clean(m[3]), line: i + 1 };
      turns.push(cur);
      continue;
    }
    if (cur && turns.length && !isMetaLine(l)) {
      // wrapped continuation of the previous turn, only for the colon formats
      if (turns[turns.length - 1].at === undefined || RE_STAMP_LINE.test(lines[cur.line - 1] || '')) cur.text = clean(`${cur.text} ${l.trim()}`);
    }
  }
  const speakers = new Set(turns.map((t) => t.speaker));
  if (speakers.size >= 2 && turns.length >= 4) return turns;

  // pass 2: name alone on a line, text on the following paragraph
  const t2: RTurn[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].trim().match(RE_NAME_ONLY);
    if (!m || isMeta(m[1]) || wc(lines[i]) > 3) continue;
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length) break;
    const buf: string[] = [];
    while (j < lines.length && lines[j].trim() && !(RE_NAME_ONLY.test(lines[j].trim()) && wc(lines[j]) <= 3 && !/[.?!]$/.test(lines[j].trim()))) { buf.push(lines[j].trim()); j++; }
    if (!buf.length) continue;
    t2.push({ idx: t2.length, speaker: m[1], text: clean(buf.join(' ')), line: i + 1 });
    i = j - 1;
  }
  const counts = new Map<string, number>();
  t2.forEach((t) => counts.set(t.speaker, (counts.get(t.speaker) ?? 0) + 1));
  const good = t2.filter((t) => (counts.get(t.speaker) ?? 0) >= 2);
  if (new Set(good.map((t) => t.speaker)).size >= 2) return good.map((t, i) => ({ ...t, idx: i }));
  return turns;
}

function isMetaLine(l: string): boolean {
  const m = l.match(/^([A-Za-z ]{2,24}):\s/);
  return !!m && META_LABEL_SET.has(lc(m[1].trim().split(' ')[0]));
}

/* ------------------------------------------------------------------- cues */

const ASSENT_START = /^(?:yes|yep|yeah|yup|aye|agreed|fine|sure|ok(?:ay)?|good|great|perfect|lovely|true|fair|absolutely|definitely|certainly|for\b|in favour|happy|makes sense|that's (?:fair|sensible|reasonable|sound)|fair enough|sensible|reasonable|sounds (?:fair|sensible|reasonable)|i like that|that'll work|that works|that's fine|that's right|that's good|no objections?\b|none\b|nothing from me|i agree|i'm in\b|i'm happy|i'm fine|sounds good|go for it|go ahead|me too|same\b|understood|i can live with|i can accept|that makes sense|that sounds|works for me|fine by me|no worries|no problem|i support|support\b|park it|do it|let's do it|you're right|good point|good idea|exactly|right\b)/i;
const DISSENT_START = /^(?:no\b(?![ ,.]*(?:objections?|problem|worries|worry|doubt|one|rush))|nope|against\b|i object|i disagree|i'm against|i don't think|i don't like|that's too|too (?:much|many|soon|late|early)|every \w+ is too|i'd rather not|i'm not (?:sure|convinced|happy|comfortable)|hmm|honestly,? no|not (?:really|sure|this)|don't\b)/i;

const ASSENT_ANY = /\b(?:that works|that's fine|that's right|works for me|sounds good|sounds fine|happy with that|i agree|i'm in favour|i'm happy|makes sense|i can live with|fine by me|good with that|i'm good with|i support|agreed|that's a good|great idea|good idea|i like that)\b/i;
export function isAssent(t: RTurn): boolean {
  const s = t.text.trim();
  if (wc(s) > 30 || /\?\s*$/.test(s)) return false;
  if (/^(?:yes|yeah|ok|okay|sure|fair)[,.]?\s+(?:but|however|though)\b/i.test(s)) return false;
  if (/^(?:no|nope|not|don't|i don't|i'd rather|i object|i disagree)\b(?![ ,.]*(?:problem|worries|worry|objections?|issues?|one\b|concerns?|doubt))/i.test(s)) return false;
  if (ASSENT_START.test(s)) return true;
  const early = s.split(/\s+/).slice(0, 14).join(' ');
  return ASSENT_ANY.test(early) && !/\b(?:but|however|although|though|unless)\b/i.test(early);
}
export function isDissent(t: RTurn): boolean {
  const s = t.text.trim();
  return DISSENT_START.test(s) && !isAssent(t);
}

const DECL_MARK = /^(?:(?:so|right|okay|ok|good|great|lovely|perfect|then|all right|alright|fine|well|yes|and)[,.]?\s+)*(?:motion carried|carried|that's (?:settled|agreed|decided|done|a decision)|settled|we(?:'re| are) (?:all )?agreed|agreed|it's (?:decided|agreed|settled)|decided|done|approved)\b[,.:;!]?\s*(.*)$/i;
const OBJ_Q = /^(?:any|anyone|does anyone|is there any|are there any)\b.*\b(?:object|objections?|disagree|concerns?|issues?|problems?)\b|^(?:is that|are we|all|is everyone|are we all|does that|are you all|is everybody)\b.*\b(?:agreed|ok|okay|fine|happy|in favour|work(?:s)? for (?:everyone|you|all)|good with that)\b|^all (?:agreed|in favour)|^those in favour|^who(?:'s| is)? in favour|^shall we (?:say|go|agree)|^(?:everyone|everybody) (?:ok|okay|happy|fine)/i;
const UNLESS_OBJ = /,?\s*unless (?:anyone|anybody|no one|nobody|there(?:'s| is) (?:an|any) objection)[^.?!,]*(?:objects?|objections?)?/i;
const PROPOSE = /\b(?:the (?:motion|proposal|proposition) is|i (?:propose|move|suggest|recommend)|i'd (?:suggest|say|like (?:us )?to|propose|go with|promote|leave|hold|park|wait|go further)|i would (?:say|suggest|promote|leave|hold|park|wait)|let's|let us|we should|we'll|we will|we could|we need to|my (?:proposal|suggestion|view) is|how about|what about|shall we|why don't we|can we (?:agree|say|go|make|park|hold|keep)|i think we (?:should|could|park|hold)|so the proposal)\b/i;
const DEC_VERB = /\b(?:we|let's|then we|so we)\b[^.?!]{0,40}\b(?:park|hold|defer|postpone|wait|pause|scrap|drop|cancel|keep|stay|move|switch|adopt|replace|remove|start|stop|run|trial|apply|approve|promote|buy|order|book|extend|increase|reduce|cut|raise|renew|retain|go ahead|go with|include|exclude|change|make|revisit|bring|take|use|go to|do|offer|load|lock|apply|lodge|submit|sign|hire|appoint|schedule|set|fix|settle|choose|pick|appoint|adopt|introduce|charge|pay|bill|add|buy|spend|commit|proceed|finalise|confirm|accept|reject|decline|issue|publish|release|launch|award|select|renew|continue|tighten|bring forward|put)\b/i;
const DEC_PRED = /\b(?:becomes?|moves? to|goes? live|goes? ahead|starts? (?:on|from)|stays?|stay with|comes? off|replaces?|runs? (?:for|six|\w+ weeks)|is (?:mandatory|dropped|parked|approved|scrapped|on|capped|off the table)|are (?:dropped|parked|approved|capped)|stays? as)\b/i;
const DEFER = /\b(?:hold|park|parked|wait|defer|postpone|put (?:it )?off|pause|revisit|shelve)\b[^.?!]{0,60}\b(?:until|till|after|before|once)\b|\b(?:parked|on hold|deferred)\b/i;
const HYPO = /^(?:if|what if|suppose|imagine)\b|\b(?:would be (?:silly|absurd|daft|mad|crazy|nice|great|ideal)|could just|i'm not proposing|not proposing|one day|someday|if (?:the )?(?:budget|money|we had|we were|i were)|in an ideal)\b/i;
const RECAP_PAST = /\b(?:last (?:time|week|month|meeting|session)|previously|earlier we|we (?:agreed|decided|said) (?:last|earlier|before)|at the last)\b/i;
const AGENDA_OPEN = /^(?:now\b|next\b|last item|first\b|today\b|four things|three things|two things|five things|let(?:'s| us) (?:start|begin|move on|get going|go|finish|wrap|talk|look|see|hear|take|review|check|focus|continue|recap|discuss|come back|begin|kick)|moving on|on to|turning to|quick recap|to recap)/i;

const NUM_WORDS = '(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|half|dozen)';
const FIGURE = new RegExp(`\\$?\\d|\\b${NUM_WORDS}\\b`, 'i');
const DATE_WORD = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next (?:week|month|monday|tuesday|wednesday|thursday|friday)|(?:january|february|march|april|may|june|july|august|september|october|november|december)|\d{1,2}(?:st|nd|rd|th)?\b|(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth|twenty[- ](?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)) of)\b/i;

/* ------------------------------------------------------------------ consent */

const CONSENT_REQ = /\b(?:record(?:ing|ed)?|tap(?:e|ing)|transcrib\w+|pen on)\b/i;
const CONSENT_ASK = /\?|\b(?:happy|fine with|ok(?:ay)? with|comfortable|any objection|do you mind|mind if|i'd like to|i'm going to|i'll put|so (?:that )?i can|is everyone|are you|if everyone)\b/i;

export interface ConsentOut {
  asked_by: string | null;
  answered_by: string | null;
  at: string | null;
  note: string;
  source_quote: string | null;
  not_asked: string[];
  conditional: string[];
}

export function findConsent(turns: RTurn[], speakers: string[]): { out: ConsentOut; askIdx: number; answers: number[] } {
  let askIdx = -1;
  for (let i = 0; i < Math.min(turns.length, 12); i++) {
    const t = turns[i];
    if (CONSENT_REQ.test(t.text) && CONSENT_ASK.test(t.text)) { askIdx = i; break; }
  }
  if (askIdx < 0) {
    const first = turns[0];
    return {
      askIdx: -1,
      answers: [],
      out: {
        asked_by: null,
        answered_by: null,
        at: first?.at ?? null,
        note: 'Consent was not recorded in the supplied transcript.',
        source_quote: null,
        not_asked: speakers.slice(),
        conditional: [],
      },
    };
  }
  const asker = turns[askIdx].speaker;
  const answered = new Set<string>();
  const conditional: string[] = [];
  const answerIdx: number[] = [];
  for (let j = askIdx + 1; j < Math.min(turns.length, askIdx + 16); j++) {
    const t = turns[j];
    if (t.speaker === asker) {
      if (wc(t.text) > 14 && !/\b(?:thank|thanks|understood|noted)\b/i.test(t.text.slice(0, 40))) break;
      continue;
    }
    if (wc(t.text) <= 24 && !/\?\s*$/.test(t.text) && (isAssent(t) || /\b(?:as long as|provided|on condition|only if)\b/i.test(t.text) && wc(t.text) <= 24 && /\b(?:fine|ok|okay|yes|happy|no problem|sure|go ahead)\b/i.test(t.text))) {
      if (!answered.has(t.speaker)) {
        answered.add(t.speaker);
        answerIdx.push(j);
        if (/\b(?:as long as|provided|on condition|only if)\b/i.test(t.text)) conditional.push(t.speaker);
      }
    }
  }
  const others = speakers.filter((s) => s !== asker);
  const notAsked = others.filter((s) => !answered.has(s));
  const ansList = others.filter((s) => answered.has(s));
  const sq = spanQuote(turns[askIdx], splitSentences(turns[askIdx].text), 0, 0);
  let reqSent = splitSentences(turns[askIdx].text).findIndex((s) => CONSENT_REQ.test(s.text));
  if (reqSent < 0) reqSent = 0;
  const sents = splitSentences(turns[askIdx].text);
  let note = '';
  if (notAsked.length) {
    note = `${asker} asked; ${ansList.length ? ansList.join(', ') : 'nobody'} answered. ${notAsked.join(', ')} was not asked or did not answer.`;
  } else {
    note = `${asker} asked and everyone answered.`;
  }
  if (conditional.length) note += ` ${conditional.join(', ')} agreed on a condition.`;
  return {
    askIdx,
    answers: answerIdx,
    out: {
      asked_by: asker,
      answered_by: ansList.length ? ansList.join(', ') : null,
      at: turns[askIdx].at ?? null,
      note,
      source_quote: spanQuote(turns[askIdx], sents, reqSent, reqSent) || sq,
      not_asked: notAsked,
      conditional,
    },
  };
}

/* -------------------------------------------------------------- decisions */

export interface DecOut {
  statement: string;
  quote: string;
  turn: number;
  conf: number;
  by: string[];
  speaker: string;
  condition?: string;
  ctx: number[];
  ctxQuotes?: Array<{ turn: number; quote: string }>;
}

const WHATIF_WE = /^what if we\b/i;
const RECAP_LEAD = /^(?:(?:so|and|okay|ok|right)[,.]?\s+)?(?:just )?(?:to (?:recap|summari[sz]e|sum up|confirm)|in (?:short|summary)|for the record)[,:]?\s+/i;

/* ---- explicit calendar dates (weekday, ordinal, "of", month) resolved here, so a stray "second" or weekday cannot override them ---- */
const ORD_MAP: Record<string, number> = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13, fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18, nineteenth: 19, twentieth: 20, thirtieth: 30 };
const ORD_WORD = '(?:(?:twenty|thirty)[- ](?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)';
const ORD_ANY = `(?:\\d{1,2}(?:st|nd|rd|th)?|${ORD_WORD})`;
const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MON_RE = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)';
const MON_ANY = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const WD_PRE = '(?:(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\\s+)?';
function ordToNum(w: string): number | null {
  const x = w.toLowerCase().replace(/(?:st|nd|rd|th)$/, (m) => (/^\d/.test(w) ? '' : m));
  if (/^\d{1,2}$/.test(x)) return parseInt(x, 10);
  if (ORD_MAP[x] !== undefined) return ORD_MAP[x];
  const m = x.match(/^(twenty|thirty)[- ](first|second|third|fourth|fifth|sixth|seventh|eighth|ninth)$/);
  return m ? (m[1] === 'twenty' ? 20 : 30) + ORD_MAP[m[2]] : null;
}
function monthIdx(w: string): number {
  const l = w.toLowerCase().replace('.', '');
  return MONTH_NAMES.findIndex((n) => n === l || n.startsWith(l.slice(0, 3)) && l.length >= 3 && n.startsWith(l));
}
export function explicitDate(s: string, meetingDate: string): { iso: string; text: string; approx: boolean } | null {
  const md = /^(\d{4})-(\d{2})-(\d{2})/.exec(meetingDate || '');
  if (!md) return null;
  const base = Date.UTC(+md[1], +md[2] - 1, +md[3]);
  const tries: Array<[RegExp, (m: RegExpMatchArray) => [string, string]]> = [
    [new RegExp(`\\b(${WD_PRE})(?:the\\s+)?(${ORD_ANY})\\s+of\\s+(${MON_ANY})\\b`, 'i'), (m) => [m[2], m[3]]],
    [new RegExp(`\\b(${WD_PRE})(${MON_RE})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!:)`), (m) => [m[3], m[2]]],
    [new RegExp(`\\b(${WD_PRE})(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MON_RE})\\b`), (m) => [m[2], m[3]]],
  ];
  for (const [re, pick] of tries) {
    const m = s.match(re);
    if (!m) continue;
    const [d, mo] = pick(m);
    const day = ordToNum(d); const mi = monthIdx(mo);
    if (!day || mi < 0 || day < 1 || day > 31) continue;
    let y = +md[1];
    let t = Date.UTC(y, mi, day);
    if (new Date(t).getUTCMonth() !== mi) continue;
    if (t < base - 45 * 86400000) { y += 1; t = Date.UTC(y, mi, day); }
    return { iso: new Date(t).toISOString().slice(0, 10), text: clean(m[0]), approx: false };
  }
  return null;
}

const PRON_ONLY = /^(?:it|that|this|them|those|these)\b/i;
const VOCATIVE_REQ = /^[A-Z][a-z]+,?\s+(?:can|could|will|would)\s+you\b/;
const POSTPONE_Q = /\b(?:next (?:meeting|time|week|session|review)|come back|revisit (?:it|this|that)|at the next|later|another time|decide (?:that |this )?next)\b/i;
const VAGUE_START = /^(?:(?:let's|we'll|we will|okay,? we'll) (?:keep|treat|leave|log|record|note|park) (?:it|that|this) (?:as )?(?:an? )?(?:open|for now)|let's (?:lock|do|go|say|just|get|see|put|call|move on|make)(?: that| it| this)?(?: in| on| there)?\b|i'd like to (?:get|go|see|start|say|make)\b|we'll (?:see|get|come back|talk|leave it)\b)/i;
const QSTART = /^(?:should|shall|do|can|could|would|will|are|is) (?:we|you)\s+(?:want to |agree to )?/i;

function declarative(s: string): boolean {
  return !/\?\s*$/.test(s) && wc(s) >= 3;
}

const SUBORD = /\b(?:if|whether|when|because|although|while|since|as long as)\b[^,.?!;]*/gi;
const DEC_ING = /\b(?:we(?:'re| are| have| will be)|the (?:committee|board|team|group|meeting|council))\s+(?:now |all |therefore |formally |also )?(?:adopting|approving|retaining|keeping|replacing|deferring|postponing|moving|switching|dropping|cancelling|canceling|extending|engaging|appointing|hiring|licensing|purchasing|buying|ordering|launching|going with|proceeding|accepting|rejecting|awarding|selecting|choosing|signing|renewing|running|starting|stopping|pausing|holding|parking|splitting|increasing|reducing|capping|adding|removing|retaining|funding|approving|committing)\b/i;
function decisionLike(s: string): boolean {
  const main = s.replace(SUBORD, ' ');
  if (DEC_ING.test(main)) return true;
  if (/^(?:i also|i don't|i do not|i'm not|i am not|i haven't|i have not)\b/i.test(main.trim())) return false;
  return PROPOSE.test(main) || DEC_VERB.test(main) || DEC_PRED.test(main) || DEFER.test(main);
}

function tailCondition(sentence: string): string | undefined {
  const m = sentence.match(/\b(?:subject to|as long as|provided(?: that)?|on condition that|unless|so long as)\b[^.?!]*/i);
  return m ? clean(stripEnd(m[0])) : undefined;
}

function substantive(s: string): boolean {
  return contentWords(s).length >= 3;
}

export function findDecisions(turns: RTurn[], chair: string, skipFrom: number, skipTo: number): DecOut[] {
  const cands: DecOut[] = [];
  const assenters = (i: number, from: string, n = 4): number[] => {
    const out: number[] = [];
    const seen = new Set<string>();
    for (let j = i + 1; j < Math.min(turns.length, i + 1 + n); j++) {
      const t = turns[j];
      if (t.speaker !== from && isAssent(t) && !seen.has(t.speaker)) { seen.add(t.speaker); out.push(j); }
    }
    return out;
  };
  const dissentNext = (i: number, from: string): boolean => {
    const t = turns[i + 1];
    return !!t && t.speaker !== from && isDissent(t);
  };
  const push = (c: Omit<DecOut, 'ctx'> & { ctx?: number[] }) => cands.push({ ...c, ctx: c.ctx ?? [] });

  for (let i = 0; i < turns.length; i++) {
    if (skipFrom >= 0 && i >= skipFrom && i <= skipTo) continue;
    const t = turns[i];
    const S = splitSentences(t.text);
    if (!S.length) continue;

    for (let k = 0; k < S.length; k++) {
      const st = S[k].text;
      const bare = st.replace(LEAD_FILLER, '').replace(RECAP_LEAD, '');
      if (RECAP_PAST.test(st)) continue;

      /* A. declaration marker */
      const dm = bare.match(DECL_MARK) || st.match(DECL_MARK);
      if (dm && !/\?\s*$/.test(st)) {
        let prop = '';
        let propTurn = i;
        let declEnd = k;
        const rest = clean(dm[1] || '');
        const strongMark = /^(?:(?:so|right|okay|ok|good|great|then|all right|alright|yes)[,.]?\s+)*(?:motion carried|carried|that's (?:settled|decided|a decision)|settled|decided|it's (?:decided|settled)|we(?:'re| are) (?:all )?agreed)\b/i.test(bare);
        const restOk = (x: string) => wc(x) >= 4 && declarative(x) && !/^(?:i\b|i'|and i\b|thanks|thank|and for the record|for the record|by the way|just so you know)/i.test(x) && !VOCATIVE_REQ.test(x) && substantive(x) && (strongMark || decisionLike(x));
        if (rest && restOk(rest)) {
          prop = rest;
        } else {
          for (let n = k + 1; n < Math.min(S.length, k + 3); n++) {
            const cb = S[n].text.replace(LEAD_FILLER, '');
            if (restOk(cb) && !AGENDA_OPEN.test(cb) && !HYPO.test(cb) && !/^(?:and for the record|by the way|just so you know)/i.test(cb)) { prop = cb; declEnd = n; break; }
            if (/\?\s*$/.test(S[n].text) || /^(?:i\b|i')/i.test(cb)) break;
          }
        }
        if (!prop) {
          // short declaration ("Carried, we apply."): the proposition is the nearest earlier proposal, statement or question
          for (let j = i; j >= Math.max(0, i - 8) && !prop; j--) {
            const SS = j === i ? S : splitSentences(turns[j].text);
            for (let n = (j === i ? k - 1 : SS.length - 1); n >= 0; n--) {
              const raw = SS[n].text;
              let cb = raw.replace(LEAD_FILLER, '').replace(RECAP_LEAD, '');
              const isQ = /\?\s*$/.test(raw);
              if (isQ) {
                if (!QSTART.test(cb) || OBJ_Q.test(cb)) continue;
                cb = capFirst(stripEnd(cb.replace(QSTART, '')));
              }
              const structural = j === i && !!SS[n + 1] && OBJ_Q.test(SS[n + 1].text.replace(LEAD_FILLER, '')) && !isQ && /^(?:we|the|all|everyone|our|from|for)\b/i.test(cb);
              if (wc(cb) >= 4 && substantive(cb) && (decisionLike(raw) || isQ || structural) && !HYPO.test(cb) && !VOCATIVE_REQ.test(cb) && !AGENDA_OPEN.test(cb)) { prop = cb; propTurn = j; break; }
            }
          }
        }
        if (prop && wc(prop) >= 3) {
          const a = assenters(i, t.speaker, 3);
          cands.push({ statement: tidy(prop), quote: spanQuote(t, S, k, Math.min(S.length - 1, Math.max(k, declEnd))), turn: i, conf: 0.9, by: [t.speaker, ...a.map((x) => turns[x].speaker)], speaker: t.speaker, condition: tailCondition(prop), ctx: [propTurn, ...a] });
          continue;
        }
      }

      /* A2. "<date phrase> it is" */
      const itis = !/\?\s*$/.test(st) ? bare.match(/^(.{6,90}?)\s*,?\s+it is\b[,.]?\s*(.*)$/i) : null;
      if (itis && contentWords(itis[1]).length >= 2 && !HYPO.test(st) && !/^(?:that|this|what|how|why|there|here|when|where)\b/i.test(itis[1])) {
        const stmt = clean(`${itis[1]}${itis[2] ? ', ' + stripEnd(itis[2]) : ''}`);
        const a = assenters(i, t.speaker, 3);
        if (wc(stmt) >= 4 && (t.speaker === chair || a.length)) {
          cands.push({ statement: tidy(stmt), quote: spanQuote(t, S, k, k), turn: i, conf: 0.86, by: [t.speaker, ...a.map((x) => turns[x].speaker)], speaker: t.speaker, condition: tailCondition(stmt), ctx: [i - 1, ...a].filter((x) => x >= 0) });
          continue;
        }
      }

      /* E. a question that restates the plan, confirmed by the next speaker */
      if (/\?\s*$/.test(st)) {
        const pm = bare.match(/^(?:you|we) (?:wanted|want|said|agreed|planned|are planning|were planning|were going|are going|will|would like|decided)(?: to)? (.{12,120}?)\?$/i);
        const nx = turns[i + 1];
        if (pm && nx && nx.speaker !== t.speaker && /^(?:yes|yeah|yep|correct|exactly|that's (?:right|the plan|correct)|right)\b/i.test(nx.text.trim()) && /\b(?:that's (?:right|the plan|correct)|the plan|correct|exactly)\b|^yes\b/i.test(nx.text.slice(0, 40))) {
          cands.push({ statement: tidy(pm[1]), quote: spanQuote(t, S, k, k), turn: i, conf: 0.72, by: [t.speaker, nx.speaker], speaker: t.speaker, ctx: [i + 1] });
          continue;
        }
      }

      /* B. call for objections or agreement */
      if (/\?\s*$/.test(st) && OBJ_Q.test(bare)) {
        let prop = '';
        let propTurn = i;
        let propSent = k;
        for (let n = k - 1; n >= 0; n--) {
          const cb = S[n].text.replace(LEAD_FILLER, '').replace(RECAP_LEAD, '');
          if (declarative(cb) && wc(cb) >= 4 && substantive(cb) && !/^(?:thanks|thank)/i.test(cb)) { prop = cb; propSent = n; break; }
          if (/\?\s*$/.test(cb)) break;
        }
        if (!prop) {
          for (let n = k + 1; n < S.length; n++) {
            const cb = S[n].text.replace(LEAD_FILLER, '');
            if (declarative(cb) && wc(cb) >= 3 && substantive(cb)) { prop = cb; propSent = n; break; }
          }
        }
        if (!prop && turns[i - 1] && turns[i - 1].speaker !== t.speaker) {
          const pt = turns[i - 1];
          const PS = splitSentences(pt.text);
          for (let n = PS.length - 1; n >= 0; n--) {
            const cb = PS[n].text.replace(LEAD_FILLER, '');
            if (declarative(cb) && wc(cb) >= 4 && substantive(cb) && decisionLike(cb) && !HYPO.test(cb)) { prop = cb; propTurn = i - 1; break; }
          }
        }
        if (prop && !HYPO.test(prop) && !AGENDA_OPEN.test(prop.replace(/^(?:last item)[.,]?\s*/i, ''))) {
          const a = assenters(i, t.speaker, 4);
          const stmtRaw = prop.replace(/^(?:last item|next|now)[.,:]?\s+/i, '');
          if (a.length) cands.push({ statement: tidy(stmtRaw), quote: spanQuote(t, S, Math.max(0, Math.min(k, propSent)), Math.max(k, propSent)), turn: i, conf: 0.88, by: [t.speaker, ...a.map((x) => turns[x].speaker)], speaker: t.speaker, condition: tailCondition(prop), ctx: [propTurn, ...a] });
        }
        continue;
      }

      /* C. "unless anyone objects" */
      if (UNLESS_OBJ.test(st) && !/\?\s*$/.test(st)) {
        const prop = tidy(st.replace(UNLESS_OBJ, '')).replace(/^unless.*?,\s*/i, '');
        const a = assenters(i, t.speaker, 4);
        if (wc(prop) >= 4 && substantive(prop) && !HYPO.test(prop)) cands.push({ statement: prop, quote: spanQuote(t, S, k, k), turn: i, conf: a.length ? 0.86 : 0.6, by: [t.speaker, ...a.map((x) => turns[x].speaker)], speaker: t.speaker, ctx: a });
        continue;
      }

      /* D. a proposal or decision statement that the others assent to */
      if (AGENDA_OPEN.test(bare) && !DEC_PRED.test(bare) && !DEFER.test(bare) && !PROPOSE.test(bare.replace(/^let(?:'s| us) (?:start|begin|move on|get going|go|finish|wrap|talk|look|see|hear|take|review|check|focus|continue|recap|discuss|come back|kick)\b/i, ''))) continue;
      if ((HYPO.test(st) && !WHATIF_WE.test(bare)) || VAGUE_START.test(bare)) continue;
      const isQ = /\?\s*$/.test(st);
      const q = isQ && /^(?:what|how) about\b|^what if we\b|^(?:shall|should) we\b|^why don't we\b|^can we\b|^could we\b/i.test(bare);
      if (isQ && !q) continue;
      if (!isQ && !decisionLike(bare)) continue;
      if (q && !decisionLike(bare.replace(/^(?:what|how) about\s+|^what if we\s+|^(?:shall|should|can|could) we\s+|^why don't we\s+/i, 'we ')) && !(turns[i + 1] && turns[i + 1].speaker !== t.speaker && isAssent(turns[i + 1]))) continue;
      if (/^(?:i'll|i will|i can|i'm going to)\b/i.test(bare) && !DEFER.test(bare)) continue;
      if (/\b(?:i'll|i will)\b/i.test(bare) && !PROPOSE.test(bare) && !DEFER.test(bare)) continue;
      if (POSTPONE_Q.test(bare) && !DEFER.test(bare)) continue;
      const a = assenters(i, t.speaker, 3);
      let conf = 0.3;
      if (a.length >= 1) conf += 0.32;
      if (a.length >= 2) conf += 0.14;
      if (dissentNext(i, t.speaker)) conf -= 0.35;
      if (t.speaker === chair) conf += 0.08;
      if (DEC_PRED.test(bare) || DEFER.test(bare)) conf += 0.1;
      if (/\bcould\b/i.test(bare) && !/\bcould you\b/i.test(bare)) conf -= 0.12;
      if (/\b(?:i think|maybe|perhaps|probably|not sure|i worry|worried|i'm worried|concerned)\b/i.test(bare)) conf -= 0.2;
      if (q) conf -= 0.06;
      if (t.speaker === chair && DEC_PRED.test(bare) && !isQ && !dissentNext(i, t.speaker) && /\b(?:from|starting|next|by|on)\b/i.test(bare) && !/\b(?:i think|maybe|perhaps|probably|not sure|could|might)\b/i.test(bare)) conf = Math.max(conf, 0.64);
      if (conf < 0.62) continue;
      const stmtSrc = q ? bare.replace(/^(?:what|how) about\s+|^what if we\s+|^(?:shall|should|can|could) we\s+|^why don't we\s+/i, '').replace(/\?\s*$/, '') : bare;
      cands.push({ statement: tidy(stmtSrc), quote: spanQuote(t, S, k, Math.min(S.length - 1, k + 1)), turn: i, conf, by: [t.speaker, ...a.map((x) => turns[x].speaker)], speaker: t.speaker, condition: tailCondition(bare), ctx: a });
    }
  }

  const valid = cands.filter((c) => {
    if (wc(c.statement) < 4 || !substantive(c.statement)) return false;
    if (/^(?:thanks|thank you|welcome|sorry)\b/i.test(c.statement)) return false;
    if (/\?$/.test(c.statement)) return false;
    if (/\bwe(?:'ll| will) have to (?:look|check|see|find out|work out|sort|figure|ask|confirm)\b/i.test(c.statement)) return false;
    if (/\b(?:come back to|we'll see|see how it goes|talk about (?:it|that) (?:later|next))\b/i.test(c.statement)) return false;
    if (CONSENT_REQ.test(c.statement) && /\b(?:before we start|okay with|fine with|happy with)\b/i.test(c.statement)) return false;
    return true;
  });
  // a later, firmer decision on the same topic supersedes an earlier proposal
  const sharedWords = (a: string, b: string) => { const x = new Set(contentWords(a)); return contentWords(b).filter((w) => x.has(w)).length; };
  const noDate = (x: string) => contentWords(x.replace(new RegExp(DATE_WORD.source, 'gi'), ' ').replace(/\b(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/gi, ' '));
  const dateConflict = (e: DecOut, l: DecOut) => DATE_WORD.test(e.statement) && DATE_WORD.test(l.statement) && l.turn - e.turn <= 25 && noDate(e.statement).some((w) => noDate(l.statement + ' ' + l.quote + ' ' + l.ctx.map((x) => turns[x]?.text ?? '').join(' ')).includes(w));
  const live = valid.filter((e) => !valid.some((l) => l !== e && l.turn > e.turn && l.conf >= 0.85 && e.conf < 0.85 && (sharedWords(e.statement, l.statement) >= 2 || dateConflict(e, l))));
  live.sort((a, b) => b.conf - a.conf || b.turn - a.turn);
  const kept: DecOut[] = [];
  for (const c of live) {
    if (kept.some((k) => jacc(k.statement, c.statement) >= 0.4 || wordsOverlap(k.statement, c.statement) >= 0.6)) continue;
    kept.push(c);
  }
  kept.forEach((c) => { c.statement = limitWords(c.statement, 36); });
  kept.sort((a, b) => a.turn - b.turn);
  return kept.slice(0, 14);
}

function wordsOverlap(a: string, b: string): number {
  const x = new Set(normW(a).split(' '));
  const y = normW(b).split(' ');
  if (!y.length || !x.size) return 0;
  let n = 0;
  y.forEach((w) => { if (x.has(w)) n++; });
  return n / Math.min(x.size, y.length);
}

/* --------------------------------------------------------- open questions */

const Q_SKIP = /^(?:(?:can|could|may) i (?:raise|ask|just|say|add|jump|interrupt|make|mention|go|start|say)|is everyone|does everyone|have i missed|are we all|any objection|anyone (?:object|mind)|all (?:agreed|in favour)|is that (?:agreed|ok|okay|fine|right|clear|alright)|does that (?:work|make sense|sound)|(?:make|makes) sense|right\?|okay\?|yeah\?|shall we (?:start|begin|move|go|get)|are you (?:happy|ok|okay|fine|comfortable|all)|how are you|what do you think|you happy|did anyone see|have you seen|did you see|anyone (?:catch|see|watch)|what a |isn't it|don't you|doesn't it|aren't|wasn't|weren't|can everyone|is everybody)/i;
const Q_REQUEST = /^(?:[A-Z][a-z]+,?\s+)?(?:can|could|will|would) you (?:please )?(?!tell me|say|explain|confirm whether|let me know)\w+/i;
const Q_REQUEST2 = /^(?:[A-Z][a-z]+,?\s+)?(?:could|can|would) (?:you|we|someone|somebody|anyone) (?:please )?(?:send|book|draft|write|pull|load|chase|call|ring|email|organise|prepare|create|build|set|arrange|check|look into|follow up)\b/i;
const UNKNOWN = /\b(?:nor do i|neither do i|i (?:don't|do not|dont) know|i honestly don't know|i'm not sure|i am not sure|i'd have to (?:check|look)|no idea|not sure|no idea|haven't (?:checked|thought|looked)|hadn't thought|i'd have to (?:check|look|ask)|don't know yet|couldn't say|i can't say|honestly,? (?:that's me|nobody)|(?:we'll|we will|i'll|i will) have to (?:sort|check|find|look|work)|(?:we'll|i'll|let's|leave|park|come back|revisit|pick)\b[^.?!]{0,50}\b(?:next|later|another)\b[^.?!]{0,20}\b(?:meeting|session|review|time|week)|open item|as open|nobody|no one|not me|unknown|(?:has|have|had)(?:n't| not) (?:yet )?been (?:resolved|decided|sorted|settled|confirmed|assigned|arranged|worked out|answered)|(?:not|isn't|hasn't) (?:been )?(?:resolved|decided|sorted|settled|answered) yet|still (?:need|needs|have to|has to) (?:to )?(?:find|sort|work out|decide|resolve|confirm|someone|somebody)|has to be (?:sorted|resolved|worked out|decided|figured out)|unresolved|(?:we|you|i) (?:still )?need (?:someone|somebody)|i'll find out|let me find out|can anyone cover|sort that out|haven't decided|not yet|to be confirmed|still to)\b/i;

export interface OqOut { question: string; raised_by: string; status: string; note: string; quote: string; turn: number; resolver?: string }

export function findOpenQuestions(turns: RTurn[]): OqOut[] {
  const out: OqOut[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const S = splitSentences(t.text);
    for (let k = 0; k < S.length; k++) {
      const q = S[k].text;
      if (!/\?\s*$/.test(q)) continue;
      const qb = q.replace(LEAD_FILLER, '');
      if (wc(qb) < 4) continue;
      if (TAG_Q.test(q.trim())) continue;
      if (Q_SKIP.test(qb) || OBJ_Q.test(qb)) continue;
      if (Q_REQUEST.test(qb) || Q_REQUEST2.test(qb)) continue;
      if (/\b(?:the (?:football|footy|cricket|game|match|rugby))\b/i.test(qb)) continue;
      // compound "A, or B?": keep whole
      // answered or not: the same turn may say it is not known, otherwise look at the next turn(s) by other speakers
      const nxt = turns.slice(i + 1, i + 3).filter((n) => n.speaker !== t.speaker);
      const first = nxt[0];
      let status = '';
      let note = '';
      let resolver: string | undefined;
      const tail = S.slice(k + 1, k + 3).map((x) => x.text).join(' ');
      if (tail && UNKNOWN.test(tail) && !/\?\s*$/.test(S[k + 1]?.text ?? '')) {
        status = 'Not answered';
        note = 'The speaker said it is not known';
      } else if (first) {
        const fs = splitSentences(first.text);
        const head = fs.slice(0, 2).map((x) => x.text).join(' ');
        if (UNKNOWN.test(head) || UNKNOWN.test(first.text.slice(0, 160))) {
          status = /\b(?:next|later|another|leave|park|come back|open item)\b/i.test(head) ? 'Postponed' : 'Not answered';
          note = 'Answered with "not known" or postponed';
        } else if (nxt.some((n2) => DEFER_PHRASE.test(n2.text.slice(0, 200)))) {
          status = 'Not answered';
          note = 'Deferred or not answered';
        } else if (nxt[1] && UNKNOWN.test(nxt[1].text.slice(0, 160)) && /^(?:so|right|okay|ok|well|hm+)\b/i.test(first.text) && wc(first.text) < 12) {
          status = 'Not answered';
          note = 'Left open';
        }
      } else {
        status = 'Not answered';
        note = 'Not answered';
      }
      if (!status) continue;
      // a question asked back by the next speaker is not an answer: leave
      const quote = wideQuote(t, S, k);
      const askedOnly = spanQuote(t, S, k, k);
      out.push({ question: tidy(stripEnd(qb)) + '?', raised_by: t.speaker, status, note, quote: wc(askedOnly) >= 4 ? askedOnly : quote, turn: i, resolver });
    }
  }
  // statements that say someone will find out, check or confirm a point: the point is still open
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const S = splitSentences(t.text);
    S.forEach((sx, k) => {
      const m = sx.text.match(/\b(?:find out|check|confirm|establish|ask|see)\s+(whether|if|what|who|when|how)\s+(.{12,120}?)(?:[.!]|$)/i);
      if (!m || /\?\s*$/.test(sx.text) || HYPO.test(sx.text)) return;
      const point = clean(stripEnd(m[2]));
      const qtext = `${capFirst(m[1].toLowerCase() === 'if' ? 'whether' : m[1].toLowerCase())} ${point}`;
      out.push({ question: qtext, raised_by: t.speaker, status: 'To be confirmed', note: 'Someone is to find out', quote: spanQuote(t, S, k, k), turn: i });
    });
  }
  // dedupe
  const kept: OqOut[] = [];
  for (const o of out) if (!kept.some((k) => jacc(k.question, o.question) >= 0.5)) kept.push(o);
  return kept.slice(0, 12);
}

/* ------------------------------------------------------------------- risks */

const RISK_CUES: Array<{ key: string; re: RegExp }> = [
  { key: 'departure', re: /\b(?:one of (?:them|us|our \w+)|\w+ ) ?(?:is|are) (?:leaving|resigning|retiring|moving on|going on (?:leave|maternity|long service))\b|\b(?:is|are) (?:leaving|resigning|retiring) (?:in|at the end of|next|this)\b/i },
  { key: 'scarce', re: /\b(?:i|we) only have (?:one|two|three|a couple of|a few|four) (?:\w+ ){0,2}(?:who|that|can|able)\b/i },
  { key: 'shortfall', re: /\b(?:(?:we|i|they) (?:need|require)s? [^.?!]{3,60}\b(?:and|but|yet)\b[^.?!]{0,20}\b(?:we|i|they)\b[^.?!]{0,10}\b(?:only|just) (?:have|got|has)\b|(?:we|i|they) (?:only|just) (?:have|got) (?:\w+ ){0,3}(?:qualified|available|trained|spare|left)|(?:do not|don't|doesn't|have not|haven't) (?:have|got) enough\b|(?:are|is|am) short (?:of|on)\b|shortfall)\b/i },
  { key: 'group', re: /\b(?:some|many|most|a few|several) of (?:our|the|my|their) \w+ (?:will|may|might|could|would|are going to) \w+/i },
  { key: 'prob', re: /\b(?:he|she|they|it|you|we)(?:'d| would) probably (?:leave|go|walk|quit|resign|cancel|switch|drop|object|refuse|complain|struggle|fail)\b/i },
  { key: 'worry', re: /\b(?:that(?:'s| is) (?:a )?(?:worry|concern|risk|problem)|this is a (?:worry|concern|risk|problem)|(?:a|the) (?:worry|concern|risk) is)\b/i },
  { key: 'deadline', re: /\b(?:only (?:valid|held|open|available|good|on offer|runs|lasts|covers)|(?:runs?|valid|ends?) (?:only )?until the|(?:late|penalty|cancellation|exit) (?:fee|charge|penalty)s? (?:if|when|applies|apply)|there(?:'s| is) a (?:late|penalty|cancellation) (?:fee|charge)|(?:valid|held|open|available) (?:only )?(?:until|till)|closes? (?:on|at|by)|(?:has|have|need|needs|must) to be (?:filed|lodged|submitted|in|paid|done|signed|booked|ready|finished|sent|approved)\b[^.?!]{0,30}\b(?:by|before|until)|(?:expires?|expiry|cut[- ]?off|lapses?)\b|runs? out|last day to|no later than the|due (?:on|by) the|before (?:the )?(?:shutdown|deadline|end of)\b|(?:shuts?|shutting) down (?:on|for))\b/i },
  { key: 'conditional', re: /\b(?:if (?:it|we|that|this|they|he|she|i|you|the)\b[^.?!]{0,60}(?:dies|fails?|breaks?|is late|isn't ready|doesn't|don't|goes wrong|slips?|falls? over|is off|are off|miss(?:es)?|lose|lost|leave|walk)\b[^.?!]{0,60}\b(?:we|you|i|they|it)(?:'ll|'d| will| would| could| might)?\b[^.?!]{0,20}\b(?:lose|stuck|back[- ]?pay\w*|be (?:stuck|stranded|short|out)|knock|fail|miss|struggle|delay|cost|pay)\w*|(?:knock|knocks) (?:you|us|them) back|we(?:'ll| will) (?:lose|be stuck|be short)|we lose\b|we(?:'re| are) stuck|back[- ]?paying|will (?:probably |likely )?(?:leave|walk|go elsewhere|resign|quit)|would probably leave)\b/i },
  { key: 'capacity', re: /\b(?:(?:i'm|i am|we're|we are|i have been|we've been) (?:at capacity|flat out|swamped|stretched|overloaded|snowed under|maxed out|booked (?:out|solid)|running (?:flat|hot)|short[- ]staffed|(?:two|three|one|a few|several) people short|short (?:of|on) (?:people|staff|hands))|(?:two|three|one|a few|several) people short|(?:i|we) can(?:'t|not) (?:take|do|fit|manage|handle) (?:that|this|it|another|anything|any more|more)(?: \w+)? (?:on|in)?|no (?:room|capacity|headroom)|(?:is|are) (?:already )?(?:overloaded|swamped|stretched|flat out|at capacity)|(?:going to be|is going to be|will be|is|are) (?:really |very |quite )?tight|(?:too|very) (?:tight|stretched|busy)|swamped)\b/i },
  { key: 'single', re: /\b(?:(?:i'm|i am|you're|you are|he's|she's|he is|she is|they're|is|am) the only (?:one|person|people)\b|only (?:one|person)(?: here| in the (?:team|office|business))? (?:who|with|that|accredited|certified|able|holding|holds|knows)|the only (?:one|person) (?:who|with|accredited|certified))\b/i },
  { key: 'away', re: /\b(?:(?:i'm|i am|i will be|i'll be|i'm going to be|we're|he's|she's) (?:away|on leave|interstate|overseas|out of the office|off|travelling|on holiday)(?: (?:from|until|till|for|that week|in))?|(?:away|on leave|interstate|overseas) (?:from|until|till|for|that week))\b/i },
  { key: 'leaving', re: /\b(?:(?:may|might|could|would probably|will|have said (?:they'll|they will)|are thinking of|is thinking of|thinking of|talking to|approached by|interviewing|job[- ]hunting|looking at|want(?:s)? to|plan(?:s)? to|about to)\b[^.?!]{0,25}\b(?:leave|leaving|go elsewhere|moving to another|move to another|walk|walking|resign|quit|switch|drop us|cancel|go to (?:a )?compet\w+)|go(?:ing)? elsewhere|(?:have|has|had) (?:already )?(?:complained|pushed back|threatened|resigned|handed in|given notice|left)|(?:have|has) been approached|(?:are|is) (?:already )?(?:frustrated|irritated|unhappy|upset|annoyed|angry|fed up)|balk at|(?:mood|morale) (?:is|has been|was) (?:flat|low|down)|talking to (?:two|three|other|another)|already complained)\b/i },
  { key: 'cost', re: /\b(?:(?:is|are) at stake|at stake with|could (?:cost|be (?:around|about|roughly|as much))|might (?:cost|be (?:around|about))|exposure|back[- ]?paying|penalt(?:y|ies)|fine(?:d|s)? (?:of|up to)|non[- ]refundable|not refundable|lose the (?:deposit|booking)|deposit (?:on that )?is not)\b/i },
  { key: 'samepeiod', re: /\b(?:same (?:week|day|month|time|fortnight)|at the same time as|land(?:s)? (?:in )?the same|overlap(?:s)?|clash(?:es)? with|collid\w+)\b/i },
  { key: 'lead', re: /\b(?:lead time (?:is|of)|(?:waiting|wait|waits) (?:three|four|six|ten|\d+)\b|takes? (?:about |around )?(?:\w+ )?(?:weeks|months) (?:to|for))\b/i },
  { key: 'failing', re: /\b(?:(?:is|are|was|were|has|have) (?:failing|failed|almost full|nearly full|breaking|dying|about to fail|out of date|unreliable|not backed up)|going to fail|will fail|backup (?:failed|isn't|hasn't)|no (?:recent )?(?:full )?backup|haven't (?:checked|priced|tested|confirmed) (?:it |that |what )?(?:properly|yet|what))\b/i },
  { key: 'lost', re: /\b(?:(?:lost|losing) (?:\w+ ){0,2}(?:drivers?|staff|clients?|customers?|accounts?|pages?|people|candidates?|days?|time|hours?)|we lost\b|(?:lose|losing) (?:days?|hours?|time))\b/i },
  { key: 'needs', re: /\b(?:need(?:s)? (?:\w+ )?(?:volunteers|people|staff|hands|more)|(?:haven't|hasn't|have not|has not) (?:been )?(?:priced|confirmed|checked|tested|signed|booked|paid)|late joiner|has already complained|will want (?:\w+ )?(?:at|for|in))\b/i },
];

export interface RiskOut { risk: string; raised_by: string; quote: string; turn: number; key: string; score: number }

const ACK_ONLY = /^(?:yes|yeah|yep|ok|okay|sure|fine|good|great|noted|thanks|thank you|right|true|agreed|understood|exactly|that's right)\b[.,!]?$/i;

export function findRisks(turns: RTurn[], skipTurn: number): RiskOut[] {
  const out: RiskOut[] = [];
  for (let i = 0; i < turns.length; i++) {
    if (i === skipTurn) continue;
    const t = turns[i];
    const S = splitSentences(t.text);
    for (let k = 0; k < S.length; k++) {
      let st = S[k].text;
      if (/\?\s*$/.test(st)) continue;
      const bare = st.replace(LEAD_FILLER, '');
      if (wc(bare) < 4 || ACK_ONLY.test(bare)) continue;
      if (HYPO.test(bare) && !/\bif (?:it|we|that|this|they|he|she|i|you|the|our|a|an|my|their|your)\b/i.test(bare)) continue;
      let hits = RISK_CUES.filter((c) => c.re.test(bare));
      if (hits.length && hits.every((h) => h.key === 'deadline') && /^(?:i can live with|that works|that's fine|fine\b|yes\b|agreed|sure\b|ok\b)/i.test(bare)) hits = [];
      if (!hits.length) continue;
      // two-sentence risks: a consequence sentence directly after a cue is carried by the quote
      let score = hits.length;
      if (hits.some((h) => h.key === 'single' || h.key === 'deadline' || h.key === 'cost')) score += 1;
      if (hits.some((h) => h.key === 'away') && !DATE_WORD.test(bare)) score -= 1;
      if (hits.length === 1 && hits[0].key === 'away' && !DATE_WORD.test(bare + ' ' + (S[k + 1]?.text ?? ''))) continue;
      if (hits.length === 1 && hits[0].key === 'needs' && !/\b(?:volunteers|priced|late joiner)\b/i.test(bare)) continue;
      if (/^(?:i'll|i will)\b/i.test(bare) && !/\b(?:capacity|away|leave)\b/i.test(bare)) continue;
      let stmtSrc = bare;
      if (hits.length === 1 && hits[0].key === 'worry' && wc(bare) <= 8 && k > 0) stmtSrc = S[k - 1].text.replace(LEAD_FILLER, '');
      const stmt = limitWords(tidy(stmtSrc), 38);
      out.push({ risk: stmt, raised_by: t.speaker, quote: wideQuote(t, S, k), turn: i, key: hits[0].key, score });
    }
  }
  // dedupe: similar risks collapse, keep the higher score
  out.sort((a, b) => b.score - a.score || a.turn - b.turn);
  const kept: RiskOut[] = [];
  for (const r of out) {
    if (kept.some((k) => jacc(k.risk, r.risk) >= 0.45 || (k.turn === r.turn && k.quote === r.quote))) continue;
    kept.push(r);
  }
  kept.sort((a, b) => a.turn - b.turn);
  return kept.slice(0, 16);
}

/* ---------------------------------------------------------------- insights */

export type InsightKind = 'feedback_positive' | 'concern' | 'advice' | 'offer' | 'market_intel' | 'context';

const IN_POSITIVE = /\b(?:excellent|fantastic|brilliant|terrific|outstanding|impressive|great (?:job|work|idea|point|call|result)|well done|nice work|good work|good (?:point|call|idea)|the best (?:thing|\w+)|clearest|really (?:helpful|good|useful)|love (?:it|that|this)|top[- ]notch|couldn't be happier|that's a great|(?:very|really|so) (?:impressed|pleased|happy with)|thanks for (?:all|the work|your (?:work|help))|has been (?:great|brilliant|excellent))\b/i;
const IN_ADVICE = /^(?:(?:so|and|but|well|honestly|look),?\s+)?(?:i'd|i would) (?:suggest|recommend|say|go|leave|promote|wait|hold|push|encourage|advise|start|ask|rather|like (?:you|us|to see)|go further|offer|pull|keep)\b|\bi suggest\b|\b(?:live with (?:that|it)|fine|agreed|works|happy|good|ok(?:ay)?)\b[^.?!]{0,20},?\s+as long as (?:the|we|it|there|someone|everyone)\b[^.?!]{8,}|\b(?:you should|you might want|you could|you'll want to|my advice|worth (?:doing|checking|considering|having)|make sure|don't forget|be clear|it might be worth|i'd like you to|i'd like us to|i'd like (?:one|it|to see)|i'd suggest|how about|what about|i recommend|better to|better if|i'd also suggest|the answer is to|i'd rather|try to)\b/i;
const IN_CONCERN = /\b(?:(?:is|are) (?:almost|nearly|already) full|nowhere to put|running out of (?:room|space|stock)|i'm (?:a bit |quite |really |slightly )?(?:worried|concerned|nervous|uneasy|not comfortable|not sure about|wary)|(?:my|a|the|one) (?:concern|worry|fear)|i don't want (?:to|us to)|i'd hate|that's a (?:risk|worry|problem|big ask|worry)|the (?:problem|issue|trouble|risk) is|it'll be tight|tight for me|too much|too many|a big ask|i can't take|we lose\b|we lost\b|i lose\b|stuck|hassle|i'd rather not|frustrat\w+|irritat\w+|(?:has|have) (?:already )?complained|disconnected|drown|overwhelm\w*|struggl\w+|break(?:s)? our|it's not working|isn't working|aren't working|not working|(?:don't|doesn't) work|if (?:it|that) (?:dies|fails)|i think (?:it|that) will fail|isn't (?:great|good|fair)|isn't enough|not enough)\b/i;
const IN_OFFER = /\b(?:i am happy to|i(?:'m| am) glad to|i (?:could|can) (?:also |easily |quickly )?(?:take|cover|help|do|send|have|put|build|pull|set|show|look|check|chase|bring|handle|share|step in|sit in|host|draft|write|run|lend|offer)|(?:i|we)(?:'d| would) be (?:happy|glad) to|happy to (?:sit|help|take|cover|do|join|look|run)|i'm happy to|i could take|if (?:you|that|it) (?:want|helps|would help|suits)|let me know if|just ask)\b/i;
const IN_INTEL_SUBJ = /\b(?:clients?|customers?|suppliers?|competitors?|vendors?|partners?|candidates?|(?:one|two|three|several|some|a few) of (?:our|my|the) [a-z]+)\b/i;
const IN_INTEL_VERB = /\b(?:told me|told us|said (?:they|he|she|that|it)|(?:he|she|they) (?:said|asked|mentioned|wants?|want|reckons?|reckon|offered|quoted|think|thinks|were|was|are|is|have|has|will)|i (?:spoke|talked|heard|got an? (?:email|call)|had a call)|(?:have|has) (?:said|told|asked|pushed back|approached|emailed|called|rung|offered|quoted|raised)|is (?:frustrated|asking|offering|thinking)|are (?:offering|asking|frustrated|saying|telling|thinking|looking)|(?:asked|mentioned|emailed|rang|called) (?:me|us|about)|heard from|according to|approached by|keep(?:s)? (?:asking|saying)|(?:published|promises?|promised|quoted|advertis\w+) )\b/i;
const IN_CONTEXT = /\b(?:i(?:'m| am) (?:only )?here (?:for|to)\b|i'm (?:the only|away|at capacity|on leave|in the (?:office|field)|out|booked|off|flat out|swamped|interstate|back|not available|unavailable)|i only (?:do|work|have|get)|i've (?:checked|spoken|looked|already|been|got|done|had|just)|i have (?:no|a|an|two|three|four|\d+)\b|my (?:availability|diary|calendar|team|role|job)|i won't be|i will be (?:away|out|in)|until (?:the )?(?:middle|end) of|i work (?:from|on|at)|i do (?:the|all)|we (?:currently|already|usually|normally|have|keep)|at the moment|we've (?:got|been|never|had|always)|last year (?:we|our|the)|(?:costs?|cost) (?:about|around|roughly)|(?:takes?|took) (?:about |around )?(?:\w+ )?(?:hours?|days?|weeks?)|it would save|it saves)\b/i;

export interface InsOut { kind: InsightKind; who: string; insight: string; quote: string; turn: number; score: number }

const IN_POSITIVE2 = /\b(?:well prepared|well done|useful|helpful|clean|neat|clear(?:est)?|great|good (?:point|call|idea|thinking|work)|nice|sensible|smart|impressive|brilliant|excellent|fantastic|terrific|love|really good|that helps|that's a good|right call|appreciate|thank you for)\b/i;
const IN_NEGATIVE2 = /\b(?:push(?:ed)? back|complain\w*|irritat\w+|frustrat\w+|stretched|swamped|flat out|tight|short(?: of| on)?|behind|slow|stuck|struggl\w+|worr\w+|concern\w*|catch|trouble|problem|issue|risk|late|flat|unhappy|upset|overwhelm\w*|sit in my inbox|not great|isn't working|aren't working|doesn't work|gone up|too (?:much|many|big|late|early|soon)|big jump|big ask|only worry|my worry)\b/i;
const IN_ADVICE2 = /\b(?:i'd (?:put|want|say|suggest|announce|go|keep|leave|hold|wait|start|recommend|rather)|i would|i wouldn't|you should|you could|you might|we should|we need|so we need|otherwise|if i were you|my view|my advice|make sure|worth|better to|better if|instead|rather than|before we commit|before buying|don't wait|please put|ought to)\b/i;
const IN_OFFER2 = /\b(?:do you want me to|i can (?:run|do|take|cover|help|send|set|put|share|pull|have)|i could (?:take|cover|help|do|run|send|put|share)|happy to|i'd be happy|i'm happy to|let me know if|if you want it|if you like)\b/i;
const IN_REPORT2 = /\b(?:told me|asked me|said (?:they|he|she)|they said|has said|have said|according to|their (?:turnaround|lead time|quote|price)|(?:the|a|an|our|my|their) [a-z]+(?: [a-z]+)? (?:told|said|asked|mentioned|reckons|offered|quoted|wants|has said|have said|keeps saying)\b|one of (?:our|my|the) [a-z]+|(?:a few|some of our|several) [a-z]+)\b/i;
const IN_CONTEXT2 = /\b(?:it takes me|i'm the (?:only|one|electrician|\w+ who)|i only|i've (?:been|got|had|done|checked|looked|already)|i have (?:no|a|an|two|three|four|\d+)|my (?:team|role|diary|calendar|crew)|we (?:currently|already|usually|normally|always|never)|costs? (?:about|around)|takes? (?:about|around)|every (?:week|month|day)|last (?:year|month|quarter)|(?:about|around|roughly) (?:\w+ )?(?:per cent|dollars|weeks|months|hours|days))\b/i;
const INS_FILL = /^(?:thanks|thank you|welcome|sorry|good morning|morning|afternoon|hello|hi|okay|ok|right|fine|sure|yes|no|agreed|noted|perfect|lovely|great,? no objections|carried|done)\b[,. ]*$/i;

function scoreInsight(sent: string): { kind: InsightKind; score: number } | null {
  const s = sent;
  if (wc(s) < 5 || INS_FILL.test(s)) return null;
  if (/\b(?:the (?:football|footy|cricket|game|match|rugby|scoreboard)|on the weekend|last night|robbed|sack the)\b/i.test(s)) return null;
  let sc = 0;
  let kind: InsightKind = 'context';
  const pos = IN_POSITIVE2.test(s) || IN_POSITIVE.test(s);
  const neg = IN_NEGATIVE2.test(s) || IN_CONCERN.test(s);
  const adv = IN_ADVICE2.test(s) || IN_ADVICE.test(s);
  const off = IN_OFFER2.test(s) || IN_OFFER.test(s);
  const rep = IN_REPORT2.test(s) || (IN_INTEL_SUBJ.test(s) && IN_INTEL_VERB.test(s));
  const ctx = IN_CONTEXT2.test(s) || IN_CONTEXT.test(s);
  if (pos) { sc += 2; kind = 'feedback_positive'; }
  if (neg) { sc += 2; if (!pos) kind = 'concern'; }
  if (adv) { sc += 2; if (/\b(?:my advice|i suggest|i recommend|i'd recommend|my recommendation)\b/i.test(s)) sc += 1.2; if (!pos && !neg) kind = 'advice'; }
  if (off) { sc += 2; if (!pos && !neg) kind = 'offer'; }
  if (rep) { sc += 2; if (!pos && !(off && /^(?:i|we)\b/i.test(s))) kind = 'market_intel'; }
  if (ctx) { sc += 1.2; if (/\bi(?:'m| am) (?:only )?here (?:for|to)\b/i.test(s)) sc += 0.8; }
  if (/\b(?:i think|i believe|my view|i reckon|i'd say)\b/i.test(s)) sc += 0.8;
  if (FIGURE.test(s) && wc(s) >= 8) sc += 0.4;
  if (wc(s) >= 8 && wc(s) <= 34) sc += 0.4;
  if (/\?\s*$/.test(s) && !off) sc -= 2;
  if (sc < 2) return null;
  // advice that is really an offer to do something by the speaker
  if (kind === 'advice' && off && /\bi (?:can|could)\b/i.test(s)) kind = 'offer';
  return { kind, score: sc };
}

export function findInsights(turns: RTurn[], skipTurn: number, chair: string, max = 30): InsOut[] {
  const out: InsOut[] = [];
  for (let i = 0; i < turns.length; i++) {
    if (i === skipTurn) continue;
    const t = turns[i];
    const S = splitSentences(t.text);
    const scored: Array<{ k: number; c: { kind: InsightKind; score: number } }> = [];
    for (let k = 0; k < S.length; k++) {
      const bare = S[k].text.replace(LEAD_FILLER, '');
      const c = scoreInsight(bare);
      if (c) scored.push({ k, c });
    }
    scored.sort((a, b) => b.c.score - a.c.score);
    scored.slice(0, 2).forEach((x, n) => {
      if (n === 1 && x.c.score < 3 && !(x.c.kind !== scored[0].c.kind && x.c.score >= 2.3 && scored[0].c.score >= 3.5)) return;
      const bare = S[x.k].text.replace(LEAD_FILLER, '');
      const chairPenalty = t.speaker === chair ? 0.3 : 0;
      const extra = n === 1 && x.c.score < 3 ? 1.2 : 0;
      out.push({ kind: x.c.kind, who: t.speaker, insight: limitWords(tidy(bare), 36), quote: wideQuote(t, S, x.k), turn: i, score: x.c.score - chairPenalty - extra });
    });
  }
  out.sort((a, b) => b.score - a.score || a.turn - b.turn);
  const kept: InsOut[] = [];
  const perSpeaker = new Map<string, number>();
  const nSpeakers = new Set(turns.map((x) => x.speaker)).size;
  const cap = Math.max(6, Math.ceil((max * 0.55) / Math.max(1, nSpeakers)));
  for (const r of out) {
    if (kept.some((k) => jacc(k.insight, r.insight) >= 0.45)) continue;
    if ((perSpeaker.get(r.who) ?? 0) >= cap) continue;
    kept.push(r);
    perSpeaker.set(r.who, (perSpeaker.get(r.who) ?? 0) + 1);
    if (kept.length >= max) break;
  }
  kept.sort((a, b) => a.turn - b.turn);
  return kept;
}

/* ------------------------------------------------------ statements to verify */

const ABSOLUTE = /\b(?:never|always|every single|every time|no one has ever|nobody has ever|not once|without fail|100 ?%|a hundred per cent|guaranteed|constantly|perfect(?:ly)?)\b/i;
const HEDGE = /\b(?:i think|i believe|i guess|i reckon|roughly|about|around|approximately|maybe|perhaps|probably|something like|rough guess|don't quote me|don't hold me|if i remember|if i recall|i'd have to check|i'm not sure but|ballpark|at least|up to|or so|give or take|i haven't pulled|i haven't checked|from memory|off the top of my head)\b/i;
const HEDGE_STRONG = /\b(?:i think|i believe|i guess|i reckon|rough guess|don't quote me|don't hold me|if i remember|if i recall|i'd have to check|ballpark|from memory|off the top of my head|i haven't pulled|give or take|something like|roughly|approximately)\b/i;

export interface StvOut { said_by: string; statement: string; why_check: string; quote: string; turn: number }

export function findStatements(turns: RTurn[]): StvOut[] {
  const out: StvOut[] = [];
  for (let i = 0; i < turns.length; i++) {
    const t = turns[i];
    const S = splitSentences(t.text);
    for (let k = 0; k < S.length; k++) {
      const st = S[k].text;
      const bare = st.replace(LEAD_FILLER, '');
      if (wc(bare) < 5 || /\?\s*$/.test(bare)) continue;
      if (/^(?:thanks|thank you)\b/i.test(bare)) continue;
      const abs = ABSOLUTE.test(bare) && /\b(?:i've|we've|i have|we have|i|we|it|they|you've|you have|there's|there has|there have|nobody|no one)\b/i.test(bare) && !/\b(?:always (?:been )?(?:tight|busy)|never mind)\b/i.test(bare);
      const hedge = HEDGE.test(bare) && FIGURE.test(bare) && (HEDGE_STRONG.test(bare) || /\b(?:about|around|maybe|probably|at least|up to|or so)\b/i.test(bare) && /\b(?:per cent|percent|%|dollars?|\$|thousand|million|weeks?|months?|days?|hours?|years?|people|clients?|customers?|staff|reps|drivers)\b/i.test(bare));
      const hedgeFact = !hedge && HEDGE_STRONG.test(bare) && /\b(?:have to|has to|need to|must|is due|are due|expires?|deadline|notice|lease|clause|required|legally|law|award|tax|registered|accredited)\b/i.test(bare);
      if (!abs && !hedge && !hedgeFact) continue;
      let why = 'Check before relying on it';
      if (abs) why = 'Absolute claim about the past or future, without a source';
      else if (/\b(?:per cent|percent|%|dollars?|\$|thousand|million|cost)\b/i.test(bare)) why = 'Figure quoted with a hedge, without a source';
      else why = 'Fact or estimate quoted with a hedge, without a source';
      out.push({ said_by: t.speaker, statement: limitWords(tidy(bare), 36), why_check: why, quote: wideQuote(t, S, k), turn: i });
    }
  }
  const kept: StvOut[] = [];
  for (const r of out) if (!kept.some((k) => jacc(k.statement, r.statement) >= 0.5)) kept.push(r);
  return kept.slice(0, 10);
}

/* ----------------------------------------------------------------- actions */

const CORE_COMMIT = /\b(?:i'll|i will|i'm going to|i am going to|i shall|let me|i can have|i'd be happy to|i'm happy to|i'll also|i'll just)\b/i;
const SOFT_COMMIT = /\bi can\b/i;
const ACTION_NOT = /^(?:be (?:honest|quick|brief|clear|direct|upfront|there|back|late|away|on)|say\b|admit|tell you (?:now|straight)|stop there|leave it|keep it (?:short|brief)|hand (?:it )?(?:back|over)|pass\b|just say|put (?:it|the pen)|go with the|drop off|take (?:another|that|this|it) (?:file|on|one)|take (?:another|on)\b|live with|accept\b|see (?:how|what|if|whether)\b|imagine|take your word|leave that|come back|follow the|follow along|sit tight|move on|start (?:by|with|there)|think about|hear (?:from|what)|mention it|wait and see|worry|stay\b|keep going|let (?:you|that|it|them) )/i;
const DEFER_PHRASE = /\b(?:not sure|i'll check|no idea|park (?:it|that)|let me think|good question|don't know|dunno|have a think|hard to say|i'll find out|that's your (?:call|decision)|i'll confirm|check with|i'll ask|haven't agreed|not yet decided|to be considered)\b/i;
const TAG_Q = /\b(?:isn't it|aren't they|doesn't it|don't they|wouldn't it|won't it|you know|know what i mean)\?\s*$/i;
const REQ_SENT = /^(?:(?:and|okay|ok|so|right|now|then)[,.]?\s+)?(?:([A-Z][a-z]+),?\s+)?(?:[Cc]an|[Cc]ould|[Ww]ill|[Ww]ould) (?:you|someone|somebody|anyone)(?: please)? (.+?)\?$/;
const REQ_ASSIGN = /^(?:([A-Z][a-z]+),?\s+)(?:please |I need you to |I'd like you to |I want you to |you need to |you'll )(.+?)[.!]?$/;
const REQ_ANY = /\b(?:i'd like you to|i need you to|i want you to|i'd suggest you|i would suggest you|you should|you might want to|you need to|you'll need to|please)\s+(.+?)(?:[.!?]|$)/i;
const REQ_HAVE = /^(?:and )?can i (?:have|get) (.+?)\?$/i;
const REQ_NEED = /\b(?:has to|have to|needs to|need to|must|should)\s+(?:go|be|get|come)\b/i;
const ACCEPT = /^(?:yes|yeah|yep|sure|will do|can do|no problem|of course|happy to|i'll|i will|i can|absolutely|certainly|done|okay|ok|fine|please do|thank you|thanks|great|lovely|perfect|good|that'd be great|yes please)\b/i;
const DECLINE = /^(?:no\b|not (?:this time|me)|sorry,? (?:i|no)|i can't|i cannot|i'm (?:at capacity|swamped)|i don't think i can|i wish i could)/i;
const PRON_OBJ = /\b(?:it|that|this|them|those|these)\b/i;

export interface ActOut { task: string; owner: string; ownerBasis: 'speaker' | 'stated'; quote: string; turn: number; due?: string; dueText?: string; dueApprox: boolean; sentence: string; at?: string; speakerLine: number; ctx: number[]; ctxQuotes: Array<{ turn: number; quote: string }> }

const MONTHS = '(?:january|february|march|april|may|june|july|august|september|october|november|december)';
const DAYNAMES = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)';
function dueStripped(task: string): string {
  const day = `(?:${DAYNAMES}|tomorrow|today|tonight|the end of the (?:week|month|day)|end of (?:week|month|day)|next week|this week|the first of \\w+|first thing)`;
  const dated = `(?:the\\s+)?[a-z][a-z\\-]{1,14}(?:\\s+[a-z\\-]{3,10})?\\s+of\\s+${MONTHS}|${MONTHS}\\s+\\d{1,2}(?:st|nd|rd|th)?|\\d{1,2}(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTHS}`;
  const re = new RegExp(`\\s*,?\\s*\\b(?:by|on|before|no later than|until|for|from)\\s+(?:the\\s+)?(?:end of\\s+)?(?:(?:next|this|every|the)\\s+)?(?:${dated}|${day})(?:\\s+(?:morning|afternoon|evening|noon|midday|night|at noon|at \\w+(?::\\d+)?(?:\\s*(?:am|pm))?))*(?:\\s+(?:the\\s+)?(?:${dated}))?`, 'ig');
  const t = clean(task).replace(re, ' ').replace(/\s+,/g, ',').replace(/\s+/g, ' ').trim().replace(/[,;]+$/, '');
  return t.length >= 4 ? t : task;
}

function toTask(rest: string): string {
  let t = clean(stripEnd(rest)).replace(/^(?:also|just|then|now|definitely|certainly|happily)\s+/i, '');
  t = dueStripped(t);
  t = t.replace(/\bmy\b/gi, 'their').replace(/\bmyself\b/gi, 'themselves').replace(/\bme\b/gi, 'them').replace(/\bI'll\b/g, 'they will');
  t = limitWords(t, 30);
  return capFirst(t);
}

function pronounOnly(task: string): boolean {
  const t = dueStripped(clean(task));
  const content = contentWords(t.replace(/\b(?:it|that|this|them|those|these)\b/gi, ''));
  return PRON_OBJ.test(t) && content.length <= 2;
}

export function findActions(turns: RTurn[], meetingDate: string, deps: RulesDeps, skipTurn: number, firstNames: Map<string, string>): ActOut[] {
  const out: ActOut[] = [];
  const mkDue = (s: string) => { try { return deps.resolveDue(s, meetingDate); } catch { return null; } };

  const requestBefore = (i: number, speaker: string): { task: string; sentence: string; turn: number } | null => {
    for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
      const pt = turns[j];
      if (pt.speaker === speaker) continue;
      const PS = splitSentences(pt.text);
      for (let n = PS.length - 1; n >= 0; n--) {
        const raw = PS[n].text.replace(LEAD_FILLER, '');
        const rm = raw.match(REQ_SENT);
        if (rm && (!rm[1] || speaker.split(' ')[0] === rm[1] || !firstNames.has(rm[1]))) return { task: rm[2], sentence: PS[n].text, turn: j };
        const hv = raw.match(REQ_HAVE);
        if (hv) return { task: `provide ${hv[1]}`, sentence: PS[n].text, turn: j };
        const am = raw.match(REQ_ASSIGN);
        if (am && speaker.split(' ')[0] === am[1]) return { task: am[2], sentence: PS[n].text, turn: j };
        const an = raw.match(REQ_ANY);
        if (an && !/\?\s*$/.test(raw) && wc(an[1]) >= 3) return { task: an[1], sentence: PS[n].text, turn: j };
        // "Name, the X still has to go to Y by Monday. Is that realistic?"
        const nm = raw.match(/^(?:([A-Z][a-z]+),\s+)?(.+)$/);
        if (nm && REQ_NEED.test(raw) && !/\?\s*$/.test(raw) && (!nm[1] || speaker.split(' ')[0] === nm[1]) && wc(raw) <= 40) return { task: nm[2], sentence: PS[n].text, turn: j };
      }
    }
    return null;
  };

  const selfNeed = (S: RSentence[], k: number): string | null => {
    for (let n = k - 1; n >= 0; n--) {
      const m = S[n].text.match(/\bi (?:need|have|want|ought|should) to (.+?)[.!]?$/i);
      if (m && wc(m[1]) >= 3) return m[1];
    }
    return null;
  };

  for (let i = 0; i < turns.length; i++) {
    if (i === skipTurn) continue;
    const t = turns[i];
    const S = splitSentences(t.text);
    for (let k = 0; k < S.length; k++) {
      const st = S[k].text;
      const bare = st.replace(LEAD_FILLER, '');
      const isQ = /\?\s*$/.test(bare);
      const next = turns[i + 1];
      const nextOther = next && next.speaker !== t.speaker ? next : null;
      const ctxQuotes: Array<{ turn: number; quote: string }> = [];

      /* 1. first person commitments */
      if (!isQ && (CORE_COMMIT.test(bare) || SOFT_COMMIT.test(bare)) && !HYPO.test(bare)) {
        const core = bare.match(CORE_COMMIT);
        const soft = !core ? bare.match(SOFT_COMMIT) : null;
        const m = core || soft;
        if (m && m.index !== undefined) {
          let rest = clean(bare.slice(m.index + m[0].length)).replace(/^(?:also|just|then|now|definitely|certainly|happily|do that|do it)\b[,.]?\s*/i, (x) => (/^do\b/i.test(x) ? x : ''));
          if (/\bi can have\b/i.test(m[0])) rest = `have ${rest}`;
          if (/^be (?:there|at|on|in)\b/i.test(rest) && (mkDue(bare) || DATE_WORD.test(bare))) rest = rest.replace(/^be (?:there|at|on|in)\b/i, 'attend');
          const hasCond = /\b(?:if|unless|provided|as long as)\b/i.test(rest);
          const req = requestBefore(i, t.speaker);
          const accepted = nextOther && ACCEPT.test(nextOther.text.trim()) && !DECLINE.test(nextOther.text.trim());
          const softOk = !!soft && (!!req || !!accepted || !!selfNeed(S, k));
          const coreOk = !!core && !/^(?:be|see|say|tell you|stay)\b/i.test(rest);
          let ok = (coreOk || softOk) && rest && !ACTION_NOT.test(rest) && wc(rest) >= 1;
          if (ok && hasCond && !/\bif (?:that|it) helps\b|\bif you (?:want|like)\b/i.test(rest) && !mkDue(bare)) ok = false;
          if (ok && /\bi (?:could|might|may)\b/i.test(bare)) ok = false;
          if (ok) {
            let task = rest.replace(/\s+if (?:that|it) helps\b.*$/i, '').replace(/,?\s*if you (?:want|like)(?: it)?\b.*$/i, '');
            let resolved = false;
            if (pronounOnly(task)) {
              const sn = selfNeed(S, k);
              if (req) { task = req.task; resolved = true; ctxQuotes.push({ turn: req.turn, quote: bestSentenceQuote(turns[req.turn], req.sentence) }); }
              else if (sn) { task = sn; resolved = true; }
              else ok = false;
            } else if (req) { ctxQuotes.push({ turn: req.turn, quote: bestSentenceQuote(turns[req.turn], req.sentence) }); }
            if (ok) {
              const taskText = toTask(task);
              let due = mkDue(bare) || (req ? mkDue(req.sentence) : null);
              if (!due && nextOther && wc(nextOther.text) <= 14) due = mkDue(nextOther.text);
              if (!due && !resolved) { const nn = turns[i + 2]; if (nn && wc(nn.text) <= 14 && req) due = mkDue(nn.text); }
              if (wc(taskText) >= 2 && contentWords(taskText).length >= 2) {
                if (accepted && nextOther) ctxQuotes.push({ turn: i + 1, quote: firstSentenceQuote(nextOther) });
                out.push({
                  task: taskText, owner: t.speaker, ownerBasis: 'speaker', quote: spanQuote(t, S, k, Math.min(S.length - 1, k + 1)), turn: i,
                  due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, sentence: bare, at: t.at, speakerLine: t.line,
                  ctx: [], ctxQuotes,
                });
                continue;
              }
            }
          }
        }
      }

      /* 2. third person: "Name will X", "Name to X" */
      const th = !isQ ? bare.match(/^(?:and )?([A-Z][a-z]+) (?:will|to|is going to|is to|has agreed to|agreed to) (.+)$/) : null;
      if (th && firstNames.has(th[1]) && th[1] !== t.speaker.split(' ')[0] && !/^(?:be|have to|need|get on)\b/i.test(th[2]) && wc(th[2]) >= 2 && !HYPO.test(bare) && !/\bif\b/i.test(th[2])) {
        const due = mkDue(bare);
        const taskText = toTask(th[2]);
        if (substantive(taskText)) {
          out.push({ task: taskText, owner: firstNames.get(th[1])!, ownerBasis: 'stated', quote: spanQuote(t, S, k, Math.min(S.length - 1, k + 1)), turn: i, due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, sentence: bare, at: t.at, speakerLine: t.line, ctx: [], ctxQuotes: [] });
          continue;
        }
      }

      /* 3. a request that the other person accepts */
      const rq = bare.match(REQ_SENT);
      const as = !rq ? bare.match(REQ_ASSIGN) : null;
      const hv = !rq && !as ? bare.match(REQ_HAVE) : null;
      const adq = !rq && !as && !hv && isQ ? bare.match(/^([A-Z][a-z]+),\s+(.+?)\?$/) : null;
      const req = rq || as || hv || adq;
      /* 3b. a direct assignment with a date ("Name, please X by Friday") that nobody declined */
      if (as && !isQ && firstNames.has(as[1]) && as[1] !== t.speaker.split(' ')[0]) {
        const sameAddr = nextOther && nextOther.speaker.split(' ')[0] === as[1];
        const declined = !!sameAddr && DECLINE.test(nextOther!.text.trim());
        const dueA = mkDue(bare);
        const taskA = toTask(as[2]);
        if (!declined && dueA && wc(taskA) >= 2 && contentWords(taskA).length >= 2 && !pronounOnly(taskA) && !HYPO.test(bare)) {
          out.push({ task: taskA, owner: firstNames.get(as[1])!, ownerBasis: 'stated', quote: spanQuote(t, S, k, k), turn: i, due: dueA.iso, dueText: dueA.text, dueApprox: !!dueA.approx, sentence: bare, at: t.at, speakerLine: t.line, ctx: [], ctxQuotes: sameAddr && ACCEPT.test(nextOther!.text.trim()) ? [{ turn: i + 1, quote: firstSentenceQuote(nextOther!) }] : [] });
        }
      }
      if (req && nextOther) {
        const addressee = hv ? undefined : req[1];
        const reqText = hv ? `provide ${hv[1]}` : req[2];
        const addrOk = addressee ? nextOther.speaker.split(' ')[0] === addressee : true;
        const accepted = ACCEPT.test(nextOther.text.trim()) && !DECLINE.test(nextOther.text.trim());
        if (addrOk && accepted && !/^(?:tell me|say|explain|confirm whether|what|how|why|who|when|where|are|is|do|does|did)\b/i.test(reqText) && (addressee || as || hv) && !(adq && !/\b(?:by|before|ready|done|tied|sent|booked|signed|in|out)\b/i.test(reqText))) {
          const due = mkDue(bare) || mkDue(nextOther.text);
          const taskText = toTask(reqText);
          if (wc(taskText) >= 2 && contentWords(taskText).length >= 2 && !pronounOnly(taskText)) {
            out.push({
              task: taskText, owner: nextOther.speaker, ownerBasis: 'stated', quote: spanQuote(t, S, k, k), turn: i,
              due: due?.iso, dueText: due?.text, dueApprox: !!due?.approx, sentence: bare, at: t.at, speakerLine: t.line,
              ctx: [], ctxQuotes: [{ turn: i + 1, quote: firstSentenceQuote(nextOther) }],
            });
          }
        }
      }
    }
  }
  // dedupe
  const kept: ActOut[] = [];
  for (const a of out) {
    const same = kept.find((k) => k.owner === a.owner && (jacc(k.task, a.task) >= 0.4 || jacc(k.sentence, a.sentence) >= 0.5 || k.ctxQuotes.some((c) => a.ctxQuotes.some((d) => c.turn === d.turn && c.turn !== undefined && a.ctxQuotes.length && k.ctxQuotes.length))));
    if (same) {
      if (!same.due && a.due) { same.due = a.due; same.dueText = a.dueText; same.dueApprox = a.dueApprox; }
      a.ctxQuotes.forEach((c) => { if (!same.ctxQuotes.some((d) => d.turn === c.turn)) same.ctxQuotes.push(c); });
      if (wc(a.task) > wc(same.task) && substantive(a.task) && !pronounOnly(a.task)) same.task = a.task;
      continue;
    }
    kept.push(a);
  }
  return kept.slice(0, 20);
}

/* ------------------------------------------------------------ next meeting */

const NEXT_RE = /\b(?:next (?:meeting|session|review|catch[- ]?up|call|time|one|check[- ]in)|same time next|we(?:'ll| will) (?:meet|reconvene|speak|catch up|talk) (?:again|next|on)|meet again|see you (?:next|on|all|then)|reconvene)\b/i;
const TIME_RE = /\b(?:(?:at )?(half past|quarter past|quarter to)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+in the\s+(morning|afternoon|evening))?|(?:at )?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)(?:\s+o'clock)?\s+in the\s+(morning|afternoon|evening)|(?:at )?(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve) o'clock|(?:at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm))\b/i;
const HOURS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };

export function findNextMeeting(turns: RTurn[], meetingDate: string, deps: RulesDeps): { date: string | null; time: string | null; summary: string | null; raw_text: string | null } | null {
  for (let i = turns.length - 1; i >= Math.max(0, turns.length - 14); i--) {
    const t = turns[i];
    const S = splitSentences(t.text);
    for (let k = S.length - 1; k >= 0; k--) {
      const st = S[k].text;
      if (!NEXT_RE.test(st) && !(k > 0 && NEXT_RE.test(S[k - 1].text))) continue;
      const scope = NEXT_RE.test(st) ? st : `${S[k - 1].text} ${st}`;
      const due = deps.resolveDue(scope, meetingDate);
      const tm = scope.match(TIME_RE);
      let time: string | null = null;
      if (tm) {
        const rel = tm[1]; const word = tm[2] || tm[4] || tm[6]; const part = (tm[3] || tm[5] || '').toLowerCase();
        if (tm[9]) {
          time = `${parseInt(tm[7], 10)}:${tm[8] || '00'} ${tm[9].toLowerCase()}`;
        } else if (word) {
          let h = HOURS[lc(word)];
          let mins = '00';
          if (rel) {
            const r = lc(rel);
            if (r === 'half past') mins = '30';
            else if (r === 'quarter past') mins = '15';
            else if (r === 'quarter to') { mins = '45'; h = h - 1 || 12; }
          }
          let ap = part === 'afternoon' || part === 'evening' ? 'pm' : part === 'morning' ? 'am' : '';
          if (!ap) ap = h >= 7 && h <= 11 ? 'am' : 'pm';
          time = `${h}:${mins} ${ap}`;
        }
      }
      if (!tm) {
        // numeric forms the base extractor reads: "at 10", "10:00", "10 o'clock"; am or pm only when the words or the hour make it plain
        const nb = scope.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b(?!\s*(?:am|pm|per|percent|%|people|sites|items))/i) || scope.match(/\b(\d{1,2}):(\d{2})\b/) || scope.match(/\b(\d{1,2})\s+o'clock\b/i);
        const hh = nb ? parseInt(nb[1], 10) : 0;
        if (nb && hh >= 1 && hh <= 12) {
          let ap = '';
          if (/\b(?:morning|am)\b/i.test(scope)) ap = 'am';
          else if (/\b(?:afternoon|evening|pm)\b/i.test(scope)) ap = 'pm';
          else if (hh >= 8 && hh <= 11) ap = 'am';
          else if (hh >= 1 && hh <= 6) ap = 'pm';
          if (ap) time = `${hh}:${nb[2] && /^\d{2}$/.test(nb[2]) ? nb[2] : '00'} ${ap}`;
        }
      }
      if (due?.iso || time) {
        return { date: due?.iso ?? null, time, summary: null, raw_text: clean(scope) };
      }
    }
  }
  return null;
}

/** The sentence of a turn closest to a statement, plus the following sentence when the span stays short. */
function bestSentenceQuote(turn: RTurn, statement: string): string {
  const S = splitSentences(turn.text);
  if (!S.length) return turn.text;
  let best = 0; let bs = -1;
  S.forEach((x, i) => { const j = jacc(x.text, statement); if (j > bs) { bs = j; best = i; } });
  if (bs <= 0 && wc(turn.text) <= 30) return turn.text;
  return spanQuote(turn, S, best, best);
}

/** First sentence of a turn, the place an acceptance or assent sits; empty when it is too short to quote. */
function firstSentenceQuote(turn: RTurn): string {
  const S = splitSentences(turn.text);
  if (!S.length) return '';
  const f = S[0].text;
  return wc(f) >= 4 ? f : '';
}

/** Later sentences that restate or confirm a decision (a chair's recap, an assent that repeats the proposition). */
function restatements(turns: RTurn[], from: number, statement: string, exclude: number[]): Array<{ x: number; q: string }> {
  const out: Array<{ x: number; q: string }> = [];
  for (let j = Math.max(0, from - 1); j < Math.min(turns.length, from + 9); j++) {
    if (exclude.includes(j)) continue;
    const S = splitSentences(turns[j].text);
    for (let n = 0; n < S.length; n++) {
      const sx = S[n].text;
      if (/\?\s*$/.test(sx) || wc(sx) < 4) continue;
      if (jacc(sx, statement) >= 0.3 && decisionLike(sx) && !HYPO.test(sx)) { out.push({ x: j, q: spanQuote(turns[j], S, n, n) }); break; }
    }
    if (out.length >= 2) break;
  }
  return out;
}

/* ------------------------------------------------------------------ apply */

const mkEv = (sourceName: string, t: RTurn, quote: string) => ({
  sourceId: 'S1', sourceName, line: t.line, timestamp: t.at, speaker: t.speaker, quote,
});

export function applyRulesV3(model: any, text: string, sourceName: string, meetingDate: string, deps: RulesDeps): boolean {
  const baseResolve = deps.resolveDue;
  deps = { ...deps, resolveDue: (sentence: string, md: string) => { const e = explicitDate(sentence, md); return e ?? baseResolve(sentence, md); } };
  const turns = parseTurns(text).filter((t) => t.text && wc(t.text) > 0);
  const names = Array.from(new Set(turns.map((t) => t.speaker)));
  if (turns.length < 4 || names.length < 2) return false;

  const roles = new Map<string, string>();
  turns.forEach((t) => { if (t.role && !roles.has(t.speaker)) roles.set(t.speaker, t.role); });
  const firstNames = new Map<string, string>();
  names.forEach((n) => firstNames.set(n.split(' ')[0], n));

  // chair: first speaker, or the one who speaks most in the opening turns
  const chair = turns[0].speaker;

  const cons = findConsent(turns, names);
  const skip = cons.askIdx;

  const consEnd = cons.answers.length ? Math.max(...cons.answers) : cons.askIdx;
  const decs = findDecisions(turns, chair, cons.askIdx, consEnd);
  const acts = findActions(turns, meetingDate, deps, skip, firstNames);
  const oqs = findOpenQuestions(turns);
  const risks = findRisks(turns, skip);
  const ins = findInsights(turns, skip, chair);
  const stv = findStatements(turns);
  const nm = findNextMeeting(turns, meetingDate, deps);

  model.participants = names.map((n) => ({ name: n, role: roles.get(n), present: true }));

  model.consent = {
    asked_by: cons.out.asked_by,
    answered_by: cons.out.answered_by,
    at: cons.out.at,
    note: cons.out.note,
    source_quote: cons.out.source_quote,
  };
  if (cons.out.not_asked.length) model.consent.not_asked = cons.out.not_asked;

  model.decisions = decs.map((d, i) => {
    const t = turns[d.turn];
    return {
      id: `D${String(i + 1).padStart(2, '0')}`,
      statement: d.statement,
      title: d.statement,
      calledBy: d.speaker,
      decided_by: d.by.filter((x, j, a) => a.indexOf(x) === j).join(', '),
      conditions: d.condition ?? null,
      at: t.at ?? null,
      source_quote: d.quote,
      display_quote: d.quote,
      status: d.condition ? 'conditional' : 'agreed',
      condition: d.condition,
      evidence: [mkEv(sourceName, t, d.quote), ...restatements(turns, d.turn, d.statement, [d.turn, ...d.ctx]).map((r) => mkEv(sourceName, turns[r.x], r.q)), ...d.ctx.filter((x) => x !== d.turn).slice(0, 3).map((x) => ({ x, q: turns[x].speaker && isAssent(turns[x]) ? firstSentenceQuote(turns[x]) : bestSentenceQuote(turns[x], d.statement) })).filter((c) => c.q).map((c) => mkEv(sourceName, turns[c.x], c.q))],
      confidence: 'explicit',
      review: 'proposed',
      superseded: null,
    };
  });

  model.actions = acts.map((a, i) => {
    const t = turns[a.turn];
    const horizon = a.due ? 'next' : 'undated';
    return {
      id: `A${String(i + 1).padStart(2, '0')}`,
      task: a.task,
      owner: a.owner,
      ownerBasis: a.ownerBasis === 'speaker' ? 'speaker' : 'stated',
      owner_basis: a.ownerBasis === 'speaker' ? 'Speaker commitment' : 'Stated explicitly in turn',
      due: a.due, dueText: a.dueText, dueApprox: a.dueApprox,
      due_date: a.due ?? null, due_raw: a.dueText ?? null, due_approximate: a.dueApprox,
      dueBasis: a.due ? 'stated' : 'none',
      horizon,
      at: t.at ?? null,
      source_quote: a.quote, display_quote: a.quote, sourceQuote: a.quote, sourceLine: t.line,
      evidence: [mkEv(sourceName, t, a.quote), ...a.ctxQuotes.slice(0, 3).filter((c) => c.quote).map((c) => mkEv(sourceName, turns[c.turn], c.quote))],
      confidence: 'explicit',
      gaps: a.due ? [] : ['no due date'],
      review: 'proposed',
    };
  });

  const consentRisks: any[] = [];
  const mkRisk = (r: string, by: string, t: RTurn, q: string) => ({
    risk: r, raisedBy: by, raised_by: by, likelihood: 2, consequence: 3, rating: 'not_rated',
    evidence: [mkEv(sourceName, t, q)], review: 'proposed', source_quote: q, display_quote: q, at: t.at ?? null,
  });
  if (cons.out.not_asked.length && cons.askIdx >= 0 && cons.out.source_quote) {
    consentRisks.push(mkRisk(`Recording consent was not confirmed by ${cons.out.not_asked.join(', ')}.`, 'System', turns[cons.askIdx], cons.out.source_quote));
  }
  const allRisks = [...risks.map((r) => mkRisk(r.risk, r.raised_by, turns[r.turn], r.quote)), ...consentRisks];
  allRisks.forEach((r, i) => { r.id = `R${String(i + 1).padStart(2, '0')}`; });
  model.risks = allRisks;

  model.open_questions = oqs.map((o) => ({
    question: o.question, raised_by: o.raised_by, who_can_answer: o.resolver ?? null, status: o.status,
    at: turns[o.turn].at ?? null, source_quote: o.quote, note: o.note,
  }));
  model.openItems = oqs.map((o, i) => ({
    id: `Q${String(i + 1).padStart(2, '0')}`, question: o.question, kind: o.status === 'Postponed' ? 'deferred' : 'unresolved',
    raisedBy: o.raised_by, raised_by: o.raised_by, at: turns[o.turn].at ?? null, source_quote: o.quote, display_quote: o.quote,
    evidence: [mkEv(sourceName, turns[o.turn], o.quote)], review: 'proposed',
  }));

  model.insights = ins.map((x) => ({
    kind: x.kind, who: x.who, insight: x.insight, at: turns[x.turn].at ?? null, source_quote: x.quote, audience: 'internal',
  }));
  model.statements_to_verify = stv.map((s) => ({
    said_by: s.said_by, statement: s.statement, why_check: s.why_check, at: turns[s.turn].at ?? null, source_quote: s.quote,
  }));
  if (nm) {
    model.next_meeting = { date: nm.date, time: nm.time, summary: nm.summary, raw_text: nm.raw_text };
  }
  return true;
}
