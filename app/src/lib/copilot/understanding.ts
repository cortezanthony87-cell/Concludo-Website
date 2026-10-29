import type { CopilotMessage, CopilotQueryType } from './types';
import {
  addDays,
  formatAuDate,
  lastDayOfMonth,
  melbourneToday,
  monthIndex,
  parseISODate,
  startOfWeekMonday,
  toISODate,
} from './dates';

/**
 * Query understanding. Pure functions only: no network, no clock unless `today` is passed.
 * Everything the engine decides from the words of a question is decided here and can be tested.
 */

export interface ResolvedPeriod {
  from: string;
  to: string;
  label: string;
}

/** Questions that ask to rank, score or judge individual people. Copilot measures work, never people. */
const PEOPLE_RANKING = [
  /\brank(ing)?\b.*\b(people|person|staff|team ?members?|employees?|colleagues?|owners?|assignees?)\b/i,
  /\b(people|staff|team ?members?|employees?|colleagues?)\b.*\brank(ed|ing)?\b/i,
  /\b(league table|leaderboard|scorecard for (people|staff|individuals))\b/i,
  /\bwho (is|are|was|were) (the )?(best|worst|slowest|fastest|laziest|least|most) (productive|reliable|performing|performer|performers|efficient)\b/i,
  /\bwho (owns|has|holds|completes|completed|missed|misses) the (most|fewest|least)\b/i,
  /\b(best|worst|top|bottom) (performer|performers|performing|person|people|employee|employees|team ?member|team ?members)\b/i,
  /\b(least|most) productive\b/i,
  /\bwho (is|are) (underperforming|falling behind|letting us down)\b/i,
  /\bperformance (review|rating|score)s? (of|for) \w+/i,
];

export function asksToRankPeople(query: string): boolean {
  return PEOPLE_RANKING.some((re) => re.test(query));
}

const EXEC_PATTERNS = [
  /create (a )?report/i,
  /prepare (a|an|the) .*briefing/i,
  /prepare briefing/i,
  /draft (a |the )?briefing/i,
  /generate (a |the )?(board[- ]ready )?(update|summary|report|briefing)/i,
  /export (the )?actions/i,
  /(create|draft|prepare|generate|set up) (a |the )?(follow[- ]?up )?workflow/i,
  /board[- ]ready update/i,
  /\b(draft|write|prepare|generate|create|compile)\b.{0,40}\b(report|briefing|pack|board update)\b/i,
  /\bsend (it|this|that|them|the [a-z ]{1,30}) to\b/i,
];

function isExecutionRequest(q: string): boolean {
  return EXEC_PATTERNS.some((re) => re.test(q));
}

/**
 * Intent detection. Same intents as before, plus the ones the audit found missing:
 * meetings, client commitments, campaign listings, workflow status and documents.
 */
export function detectIntent(
  query: string,
  history: CopilotMessage[] = [],
  opts: { hasDocument?: boolean; today?: string } = {}
): CopilotQueryType {
  const q = query.toLowerCase();

  if (isExecutionRequest(q)) return 'action_execution_request';
  if (opts.hasDocument) return 'document_query';

  if (/\b(owed to|owe(s)? (the )?client|promised|promises|commitments?)\b/.test(q)) return 'client_commitments';
  if (/\b(listing|vendor update|campaign)\b/.test(q)) return 'campaign_listing';
  if (/\b(approval|approvals|incident|incidents|failed run|failed runs|workflow run|workflow runs|pending sign[- ]?off)\b/.test(q)) return 'workflow_status';
  if (/\b(consent|permission to record)\b/.test(q)) return 'consent_status';

  if (/(timeline|chronolog|what happened after|what changed after)/.test(q)) return 'timeline_query';

  // A period plus two or more kinds of record is a period summary (meetings, decisions, actions, risks).
  const kinds = ['meeting', 'decision', 'action', 'risk'].filter((k) => new RegExp(`\\b${k}s?\\b`).test(q)).length;
  if (parsePeriod(q, opts.today || melbourneToday()) && (kinds >= 2 || /\b(summari[sz]e|summary|overview|recap)\b/.test(q))) return 'period_summary';

  if (/(forecast|predict|30 day|90 day|completion rate|workload change|on track to)/.test(q)) return 'forecast_query';
  if (/(recommend|why is this recommended|evidence supports this recommendation)/.test(q)) return 'recommendation_query';
  if (/\b(risk|risks|bottleneck|bottlenecks|project drift|highest-risk|blocker|blockers)\b/.test(q)) return 'risk_analysis';
  if (/(leadership|executive|strategic|momentum|\bboard\b|organi[sz]ational health|focus on)/.test(q)) return 'executive_query';

  if (history.length > 0) {
    const lastMsg = history[history.length - 1];
    if (/(those|which of|show supporting|who owns|what else|and the|what about)/.test(q)) {
      if (/(action|task|overdue)/.test(q)) return 'action_retrieval';
      if (/(decision|approved|vendor)/.test(q)) return 'decision_retrieval';
      if (/(project|initiative)/.test(q)) return 'project_retrieval';
      if (/(risk|drift)/.test(q)) return 'risk_analysis';
      if (lastMsg.role === 'assistant' && typeof lastMsg.response === 'object') {
        const prev = (lastMsg.response as any).intent as CopilotQueryType | undefined;
        if (prev === 'decision_retrieval') return 'action_retrieval';
        if (prev === 'project_retrieval') return 'decision_retrieval';
        if (prev && prev !== 'general_query') return prev;
      }
    }
  }

  if (/\b(meeting|meetings|met|call|calls|session|sessions)\b/.test(q)) return 'meeting_retrieval';
  if (/(action|overdue|\bdue\b|backlog|blocked|assigned|\btask)/.test(q)) return 'action_retrieval';
  if (/(decision|decide|approved|vendor|unresolved|selection|why was|why did we)/.test(q)) return 'decision_retrieval';
  if (/(project|initiative|deliverable|milestone|progress|summari[sz]e)/.test(q)) return 'project_retrieval';
  if (/(lesson|knowledge|cluster|similar|what happened previously|experience)/.test(q)) return 'knowledge_discovery';
  return 'general_query';
}

/* ----------------------------------------------------------------------- PERIOD */

function quarterBounds(y: number, q: number): { from: string; to: string } {
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  return { from: toISODate(y, startMonth, 1), to: toISODate(y, endMonth, lastDayOfMonth(y, endMonth)) };
}

/** Australian financial-year-agnostic: "quarter" means the calendar quarter. Stated in the label. */
export function parsePeriod(query: string, today: string = melbourneToday()): ResolvedPeriod | null {
  const q = query.toLowerCase();
  const { y, m, d } = parseISODate(today);

  const mk = (from: string, to: string, label: string): ResolvedPeriod => ({ from, to, label });

  let hit: RegExpMatchArray | null;

  // between 1 September and 30 September (optional year)
  hit = q.match(/(?:between|from)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?\s+(?:and|to|until)\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/);
  if (hit) {
    const m1 = monthIndex(hit[2]);
    const m2 = monthIndex(hit[5]);
    if (m1 && m2) {
      const y2 = hit[6] ? Number(hit[6]) : y;
      const y1 = hit[3] ? Number(hit[3]) : m1 > m2 ? y2 - 1 : y2;
      const from = toISODate(y1, m1, Number(hit[1]));
      const to = toISODate(y2, m2, Number(hit[4]));
      if (from <= to) return mk(from, to, `${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
    }
  }

  // between january and march (months only)
  hit = q.match(/(?:between|from)\s+([a-z]{3,9})\s+(?:and|to|until)\s+([a-z]{3,9})(?:\s+(\d{4}))?/);
  if (hit) {
    const m1 = monthIndex(hit[1]);
    const m2 = monthIndex(hit[2]);
    if (m1 && m2) {
      const yy = hit[3] ? Number(hit[3]) : y;
      const y1 = m1 > m2 ? yy - 1 : yy;
      const from = toISODate(y1, m1, 1);
      const to = toISODate(yy, m2, lastDayOfMonth(yy, m2));
      return mk(from, to, `${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
    }
  }

  // in october 2026 / during september
  hit = q.match(/\b(?:in|during|for)\s+(?:the month of\s+)?([a-z]{3,9})(?:\s+(\d{4}))?\b/);
  if (hit && monthIndex(hit[1])) {
    const mm = monthIndex(hit[1]);
    const yy = hit[2] ? Number(hit[2]) : mm > m ? y - 1 : y;
    const from = toISODate(yy, mm, 1);
    const to = toISODate(yy, mm, lastDayOfMonth(yy, mm));
    return mk(from, to, `${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
  }

  if (/\blast quarter\b/.test(q)) {
    const cur = Math.floor((m - 1) / 3) + 1;
    const py = cur === 1 ? y - 1 : y;
    const pq = cur === 1 ? 4 : cur - 1;
    const b = quarterBounds(py, pq);
    return mk(b.from, b.to, `Last calendar quarter: ${formatAuDate(b.from)} to ${formatAuDate(b.to)}, inclusive`);
  }
  if (/\bthis quarter\b/.test(q)) {
    const b = quarterBounds(y, Math.floor((m - 1) / 3) + 1);
    return mk(b.from, b.to, `This calendar quarter: ${formatAuDate(b.from)} to ${formatAuDate(b.to)}, inclusive`);
  }
  if (/\blast month\b/.test(q)) {
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    const from = toISODate(py, pm, 1);
    const to = toISODate(py, pm, lastDayOfMonth(py, pm));
    return mk(from, to, `Last month: ${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
  }
  if (/\bthis month\b/.test(q)) {
    const from = toISODate(y, m, 1);
    const to = toISODate(y, m, lastDayOfMonth(y, m));
    return mk(from, to, `This month: ${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
  }
  if (/\blast week\b/.test(q)) {
    const thisMon = startOfWeekMonday(today);
    const from = addDays(thisMon, -7);
    const to = addDays(thisMon, -1);
    return mk(from, to, `Last week (Monday to Sunday): ${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
  }
  if (/\bthis week\b/.test(q)) {
    const from = startOfWeekMonday(today);
    const to = addDays(from, 6);
    return mk(from, to, `This week (Monday to Sunday): ${formatAuDate(from)} to ${formatAuDate(to)}, inclusive`);
  }
  hit = q.match(/\b(?:last|past)\s+(\d{1,3})\s+days?\b/);
  if (hit) {
    const n = Math.min(Number(hit[1]), 366);
    const from = addDays(today, -(n - 1));
    return mk(from, today, `Last ${n} days to today: ${formatAuDate(from)} to ${formatAuDate(today)}, inclusive`);
  }
  hit = q.match(/\bsince\s+(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]+)(?:\s+(\d{4}))?/);
  if (hit && monthIndex(hit[2])) {
    const yy = hit[3] ? Number(hit[3]) : y;
    const from = toISODate(yy, monthIndex(hit[2]), Number(hit[1]));
    return mk(from, today, `Since ${formatAuDate(from)} to today, inclusive`);
  }
  void d;
  return null;
}

/* --------------------------------------------------------------------- ENTITIES */

const STOP = new Set([
  'the', 'and', 'for', 'with', 'what', 'which', 'who', 'when', 'where', 'why', 'how', 'are', 'was', 'were',
  'did', 'does', 'have', 'has', 'had', 'our', 'from', 'that', 'this', 'these', 'those', 'about', 'into',
  'across', 'workspace', 'project', 'projects', 'client', 'clients', 'meeting', 'meetings', 'decision',
  'decisions', 'action', 'actions', 'risk', 'risks', 'summarise', 'summarize', 'show', 'list', 'give',
  'tell', 'outstanding', 'open', 'overdue', 'earlier', 'current', 'recent', 'last', 'month', 'week',
  'quarter', 'owed', 'between', 'all', 'any', 'there', 'their', 'them', 'been', 'made', 'make', 'need',
  'please', 'details', 'status', 'update', 'updates', 'listing', 'campaign', 'campaigns', 'approvals',
  'incidents', 'workflow', 'workflows', 'runs', 'failed', 'pending', 'document', 'file', 'files',
]);

export function normaliseName(s: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function significantTokens(query: string): string[] {
  return normaliseName(query)
    .split(' ')
    .filter((t) => t.length >= 4 && !STOP.has(t) && !/^\d+$/.test(t));
}

export interface NamedEntity {
  key: string; // normalised name
  display: string;
  kind: 'project' | 'client';
  ids: string[]; // meeting/project row ids carrying this name
  client?: string;
}

export type EntityResolution =
  | { status: 'none' }
  | { status: 'resolved'; entity: NamedEntity }
  | { status: 'ambiguous'; candidates: NamedEntity[] };

/**
 * Resolve which named project or client a question is about.
 * Rules, in order:
 *  1. A full name found in the question wins; the longest full name wins over a shorter one it contains.
 *  2. Two different full names of equal weight, or a single word that matches several different names,
 *     is ambiguous. Copilot asks instead of merging them.
 *  3. If nothing in the question matches a name, there is no entity scope (it is not an error).
 */
export function resolveEntity(query: string, entities: NamedEntity[]): EntityResolution {
  const nq = ` ${normaliseName(query)} `;
  const exact = entities.filter((e) => e.key.length >= 3 && nq.includes(` ${e.key} `));
  if (exact.length > 0) {
    const longest = Math.max(...exact.map((e) => e.key.length));
    const top = exact.filter((e) => e.key.length === longest);
    // Same normalised key but different kinds (project and client share a name) is not ambiguous: use project.
    const distinctKeys = new Set(top.map((e) => e.key));
    if (distinctKeys.size === 1) {
      const pick = top.find((e) => e.kind === 'project') || top[0];
      return { status: 'resolved', entity: pick };
    }
    return { status: 'ambiguous', candidates: top };
  }

  const tokens = significantTokens(query);
  if (tokens.length === 0) return { status: 'none' };
  const partial = entities.filter((e) => {
    const words = e.key.split(' ');
    return tokens.some((t) => words.includes(t));
  });
  if (partial.length === 0) return { status: 'none' };
  const keys = new Set(partial.map((e) => e.key));
  if (keys.size === 1) {
    const pick = partial.find((e) => e.kind === 'project') || partial[0];
    return { status: 'resolved', entity: pick };
  }
  return { status: 'ambiguous', candidates: partial.slice(0, 6) };
}

export interface ParsedQuery {
  query: string;
  intent: CopilotQueryType;
  period: ResolvedPeriod | null;
  rankingPeople: boolean;
}

export function parseQuery(
  query: string,
  history: CopilotMessage[] = [],
  opts: { today?: string; hasDocument?: boolean } = {}
): ParsedQuery {
  const today = opts.today || melbourneToday();
  return {
    query,
    intent: detectIntent(query, history, { hasDocument: opts.hasDocument, today }),
    period: parsePeriod(query, today),
    rankingPeople: asksToRankPeople(query),
  };
}
