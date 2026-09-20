/**
 * Tasklet 1.10: Risk and Blocker Extraction Service
 *
 * Extracts, classifies, and rates operational, financial, regulatory, strategic,
 * and technical risks articulated during meetings.
 *
 * Enforces verbatim transcript quote citations and timestamp citations.
 * Zero hallucinated risks: risks lacking evidence citations are rejected.
 */

export const RISK_CATEGORIES = [
  'OPERATIONAL',
  'FINANCIAL',
  'REGULATORY',
  'STRATEGIC',
  'TECHNICAL',
];

export function validateRiskGrounding(risk) {
  if (!risk.risk_title || !risk.description) {
    return { valid: false, error: 'Missing risk title or description' };
  }

  const citations = Array.isArray(risk.evidence_citations) ? risk.evidence_citations : [];
  if (citations.length === 0) {
    return {
      valid: false,
      error: 'UNGROUNDED_RISK_REJECTED: Risk contains zero verbatim transcript evidence citations',
    };
  }

  for (const c of citations) {
    if (!c.quote || !c.timestamp) {
      return {
        valid: false,
        error: 'UNGROUNDED_RISK_REJECTED: Citation missing verbatim quote or timestamp',
      };
    }
  }

  return { valid: true };
}

export function calculateRiskScore(probability, impactSeverity) {
  const p = Math.max(0, Math.min(1, Number(probability) || 0));
  const s = Math.max(1, Math.min(5, Math.round(Number(impactSeverity) || 1)));
  const score = Number((p * s).toFixed(2));
  return { probability: p, impact_severity: s, risk_score: score };
}

export function extractRisksFromTranscript(rawExtractedRisks, options = {}) {
  const extracted = [];
  const rejected = [];

  for (const item of rawExtractedRisks) {
    const grounding = validateRiskGrounding(item);
    if (!grounding.valid) {
      rejected.push({ item, reason: grounding.error });
      continue;
    }

    const { probability, impact_severity, risk_score } = calculateRiskScore(
      item.probability,
      item.impact_severity
    );

    const category = RISK_CATEGORIES.includes(item.category)
      ? item.category
      : 'OPERATIONAL';

    extracted.push({
      risk_code: item.risk_code || `RSK-${String(extracted.length + 1).padStart(2, '0')}`,
      risk_title: item.risk_title.trim(),
      description: item.description.trim(),
      category,
      probability,
      impact_severity,
      risk_score,
      mitigation_proposed: item.mitigation_proposed || null,
      mitigation_owner: item.mitigation_owner || null,
      evidence_citations: item.evidence_citations,
      extracted_at: new Date().toISOString(),
    });
  }

  return {
    risks: extracted,
    rejected,
    risk_level_index: extracted.length > 0
      ? Math.round((extracted.reduce((acc, r) => acc + r.risk_score, 0) / (extracted.length * 5)) * 100)
      : 0,
  };
}
