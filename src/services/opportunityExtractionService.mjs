/**
 * Tasklet 1.11: Opportunity Extraction Service
 *
 * Extracts stated commercial, efficiency, innovation, and partnership opportunities
 * surfaced in discussions.
 *
 * STATED ONLY, NEVER INFERRED. An opportunity Concludo thought of is an insight
 * in Channel INS-D and renders as a question.
 * Every opportunity must carry a named proponent (stated_by).
 */

export const VALUE_CATEGORIES = [
  'REVENUE_GROWTH',
  'COST_REDUCTION',
  'MARKET_EXPANSION',
  'EFFICIENCY',
];

export function validateOpportunity(opp) {
  if (!opp.title || !opp.description) {
    return { valid: false, error: 'Missing opportunity title or description' };
  }

  // Must be stated, never inferred
  if (opp.status === 'inferred' || opp.is_inferred) {
    return {
      valid: false,
      error: 'INFERRED_OPPORTUNITY_PROHIBITED: An opportunity Concludo thought of is an insight, not an opportunity. It belongs in Channel INS-D.',
    };
  }

  // Every record carries stated_by
  if (!opp.stated_by || typeof opp.stated_by !== 'string' || opp.stated_by.trim().length === 0) {
    return {
      valid: false,
      error: 'MISSING_PROPONENT: Every opportunity must carry stated_by. An opportunity with no named proponent is not an opportunity.',
    };
  }

  return { valid: true };
}

export function extractOpportunitiesFromTranscript(rawOpportunities, options = {}) {
  const extracted = [];
  const rejected = [];

  for (const item of rawOpportunities) {
    const val = validateOpportunity(item);
    if (!val.valid) {
      rejected.push({ item, reason: val.error });
      continue;
    }

    const feasibility = Math.max(1, Math.min(5, Math.round(Number(item.feasibility_score) || 3)));
    const strategicFit = Math.max(1, Math.min(5, Math.round(Number(item.strategic_fit_score) || 3)));
    const category = VALUE_CATEGORIES.includes(item.potential_value_category)
      ? item.potential_value_category
      : 'EFFICIENCY';

    let estimatedAud = null;
    let speculativeFlag = false;

    if (item.estimated_value_aud !== undefined && item.estimated_value_aud !== null) {
      if (typeof item.estimated_value_aud === 'number' && item.explicitly_stated_figure) {
        estimatedAud = Number(item.estimated_value_aud.toFixed(2));
      } else {
        speculativeFlag = true;
      }
    }

    extracted.push({
      opportunity_code: item.opportunity_code || `OPP-${String(extracted.length + 1).padStart(2, '0')}`,
      title: item.title.trim(),
      description: item.description.trim(),
      potential_value_category: category,
      estimated_value_aud: estimatedAud,
      speculative_value_flag: speculativeFlag,
      feasibility_score: feasibility,
      strategic_fit_score: strategicFit,
      stated_by: item.stated_by.trim(),
      next_step_recommendation: item.next_step_recommendation || null,
      evidence_citations: Array.isArray(item.evidence_citations) ? item.evidence_citations : [],
      status: 'stated',
      extracted_at: new Date().toISOString(),
    });
  }

  return {
    opportunities: extracted,
    rejected,
  };
}
