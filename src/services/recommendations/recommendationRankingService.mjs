/**
 * Tasklet 4.2: Recommendation Ranking Engine
 * 
 * Order recommendations using formula:
 * RankScore = (Impact * 0.45) + (Confidence * 30) - (EffortWeight * 15)
 * Effort weights: LOW = 1, MEDIUM = 2, HIGH = 3.
 * Assigns sequential priority_rank integers (1 to N).
 */

export const EFFORT_WEIGHTS = {
  'LOW': 1,
  'MEDIUM': 2,
  'HIGH': 3
};

export function calculateRankScore({ business_impact_score = 5, confidence_score = 0.8, implementation_effort = 'MEDIUM' }) {
  const impact = Math.max(1, Math.min(10, Number(business_impact_score)));
  const confidence = Math.max(0, Math.min(1, Number(confidence_score)));
  const effortWeight = EFFORT_WEIGHTS[implementation_effort.toUpperCase()] || 2;

  // Formula: (Impact * 0.45) + (Confidence * 30) - (EffortWeight * 15)
  return Number(((impact * 0.45) + (confidence * 30) - (effortWeight * 15)).toFixed(3));
}

export function rankRecommendations(recommendations = []) {
  const scored = recommendations.map(rec => {
    const score = calculateRankScore(rec);
    return {
      ...rec,
      _rankScore: score
    };
  });

  // Sort descending by rank score, tie-break by impact descending, then by creation date
  scored.sort((a, b) => {
    if (b._rankScore !== a._rankScore) return b._rankScore - a._rankScore;
    if (b.business_impact_score !== a.business_impact_score) return b.business_impact_score - a.business_impact_score;
    return (a.recommendation_code || '').localeCompare(b.recommendation_code || '');
  });

  // Assign sequential ranks 1 to N
  return scored.map((rec, idx) => {
    const { _rankScore, ...rest } = rec;
    return {
      ...rest,
      priority_rank: idx + 1
    };
  });
}
