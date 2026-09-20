/**
 * Tasklet 4.3: Recommendation Confidence Scoring
 * 
 * Compute evidentiary confidence scores for each proposed recommendation.
 * Scale: 0.000 to 1.000 based on transcript corroboration and citation density.
 * Rule: Recommendations with confidence under 0.65 are labelled "Advisory, requires verification".
 */

export function scoreRecommendationConfidence({ citations = [], corroboratingSlots = 1, clarityOfAgreement = 0.8 }) {
  const citationCount = Array.isArray(citations) ? citations.length : 0;
  const slotCount = Math.max(1, Number(corroboratingSlots));

  // Compute confidence
  let rawScore = (Math.min(citationCount, 3) * 0.2) + (Math.min(slotCount, 3) * 0.15) + (clarityOfAgreement * 0.25);
  const confidence = Math.max(0, Math.min(1, Number(rawScore.toFixed(3))));

  const isAdvisoryOnly = confidence < 0.65;
  const label = isAdvisoryOnly ? 'Advisory, requires verification' : 'Verified Evidence';

  return {
    confidence_score: confidence,
    is_advisory_only: isAdvisoryOnly,
    confidence_label: label,
    corroboration_summary: `Supported by ${citationCount} citation(s) across ${slotCount} anonymous participant slot(s).`
  };
}
