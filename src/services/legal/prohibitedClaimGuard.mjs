/**
 * Tasklet 14.4: Prohibited Claim Runtime Guard
 *
 * Stops a prohibited claim reaching a customer's document at generation time
 * on every request, before persistence and before render.
 *
 * Blocked means the document does not render and persists nothing.
 * Works identically under any subscription tier or access grant.
 */

export const PROHIBITED_RULES = Object.freeze([
  {
    code: 'PROHIBITED_INDIVIDUAL_SCORING',
    category: 'individual_measurement',
    regex: /\b(spoke\s+the\s+most|highest\s+engagement\s+score|contributed\s+least|individual\s+score|speaker\s+ranking|performance\s+score\s+for\s+[A-Z][a-z]+)\b/i,
    description: 'Concludo strictly prohibits per-person scoring, individual rankings, or personal engagement metrics.',
  },
  {
    code: 'PROHIBITED_BENCHMARK_CLAIM',
    category: 'benchmark',
    regex: /\b(industry\s+average|peer\s+benchmark|pass\s+mark|compared\s+(?:to|with)\s+other\s+companies|market\s+standard\s+score)\b/i,
    description: 'Concludo strictly prohibits external industry benchmarks, peer comparisons, or external pass marks.',
  },
  {
    code: 'PROHIBITED_SAVINGS_CLAIM',
    category: 'waste_and_savings',
    regex: /\b(money\s+saved|hours\s+saved|annual\s+savings|roi\s+of|payback\s+period|time\s+wasted|financial\s+waste)\b/i,
    description: 'Concludo strictly prohibits cost savings, ROI, payback, or financial waste claims.',
  },
  {
    code: 'PROHIBITED_BOARD_MINUTES_CLAIM',
    category: 'board_minutes',
    regex: /\b(official\s+board\s+minutes|legal\s+minutes\s+of|statutory\s+board\s+record|certified\s+meeting\s+minutes)\b/i,
    description: 'Concludo produces working records and advisory briefing papers, never formal or statutory legal board minutes.',
  },
  {
    code: 'PROHIBITED_ADVICE_OR_PARTNERSHIP_CLAIM',
    category: 'advice_and_partnership',
    regex: /\b(certified\s+by\s+(?:zoom|microsoft|google)|official\s+partner\s+of|constitutes\s+formal\s+legal\s+advice|provides\s+licensed\s+financial\s+advice)\b/i,
    description: 'Concludo does not provide legal/financial advice or claim third-party certifications/affiliations.',
  },
]);

export class ProhibitedClaimError extends Error {
  constructor(blockDetail) {
    super(`Prohibited claim blocked by runtime guard: [${blockDetail.rule_code}] ${blockDetail.description}`);
    this.name = 'ProhibitedClaimError';
    this.code = 'PROHIBITED_CLAIM_BLOCKED';
    this.blockDetail = blockDetail;
  }
}

/**
 * Scans content before persistence/render and raises if any prohibited claim is present.
 *
 * @param {string} content
 * @param {object} [context]
 * @param {string} [context.organisationId]
 * @param {string} [context.meetingId]
 * @param {string} [context.outputId]
 * @returns {{ ok: true }} if clean; throws ProhibitedClaimError if blocked.
 */
export function scanContentForProhibitedClaims(content, context = {}) {
  const text = typeof content === 'string' ? content : JSON.stringify(content);

  for (const rule of PROHIBITED_RULES) {
    const match = text.match(rule.regex);
    if (match) {
      const blockDetail = {
        rule_code: rule.code,
        category: rule.category,
        description: rule.description,
        matched_excerpt: match[0],
        action_taken: 'blocked',
        organisation_id: context.organisationId || null,
        meeting_id: context.meetingId || null,
        output_id: context.outputId || null,
        occurred_at: new Date().toISOString(),
      };
      throw new ProhibitedClaimError(blockDetail);
    }
  }

  return { ok: true };
}
