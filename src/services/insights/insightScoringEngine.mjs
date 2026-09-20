/**
 * Tasklet 3.9: Insight Scoring and Confidence Engine
 * 
 * Calculate composite priority scores, confidence levels, and corroboration ratings for all generated insights.
 * Rule: Corroboration counts anonymous slots, not named people.
 */

export function scoreInsight({
  insight_id,
  insight_type,
  confidence_score = 0.8,
  corroboration_count = 1,
  business_materiality_score = 5
}) {
  const confidence = Math.max(0, Math.min(1, Number(confidence_score)));
  const materiality = Math.max(1, Math.min(10, Math.round(Number(business_materiality_score))));
  const corroboration = Math.max(1, Math.round(Number(corroboration_count)));

  // Composite priority calculation
  const compositePriority = Number(((materiality * 0.5) + (confidence * 3.0) + (Math.min(corroboration, 5) * 0.4)).toFixed(2));

  return {
    insight_id: insight_id || `ins_${Math.random().toString(36).slice(2, 9)}`,
    insight_type,
    confidence_score: confidence,
    corroboration_count: corroboration,
    business_materiality_score: materiality,
    composite_priority_score: compositePriority,
    created_at: new Date().toISOString()
  };
}
