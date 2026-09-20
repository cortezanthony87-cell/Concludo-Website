/**
 * Tasklet 4.4: Priority Scoring Engine
 * 
 * Assign multi-factor priority classifications (P1 Critical, P2 High, P3 Medium, P4 Low).
 * Rule: Ambiguous defaults to P3 Medium.
 * Distinguishable by label and shape as well as colour.
 */

export const PRIORITY_TIERS = {
  P1: { code: 'P1', label: 'Critical', shape: 'octagon', color: '#DC2626' },
  P2: { code: 'P2', label: 'High', shape: 'diamond', color: '#F97316' },
  P3: { code: 'P3', label: 'Medium', shape: 'square', color: '#E2B53C' },
  P4: { code: 'P4', label: 'Low', shape: 'circle', color: '#2563EB' }
};

export function evaluatePriority(recommendation = {}, meetingText = '') {
  const text = `${recommendation.title || ''} ${recommendation.recommendation_text || ''} ${meetingText}`.toLowerCase();

  if (text.includes('immediate') || text.includes('by friday') || text.includes('statutory deadline') || text.includes('critical blocker') || text.includes('regulatory breach')) {
    return PRIORITY_TIERS.P1;
  }
  if (text.includes('next week') || text.includes('high exposure') || text.includes('key milestone') || text.includes('significant risk')) {
    return PRIORITY_TIERS.P2;
  }
  if (text.includes('routine') || text.includes('low impact') || text.includes('backlog') || text.includes('informational')) {
    return PRIORITY_TIERS.P4;
  }

  // Default to P3 Medium when ambiguous
  return PRIORITY_TIERS.P3;
}
