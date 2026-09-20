/**
 * Tasklet 2.2: Meeting Health Scoring
 *
 * Computes weighted multi-factor composite scores across dimensions D1 to D10
 * using fixed registry weights and the 5 standard registry bands.
 * Variable archetype weights are deleted because they break own-series comparability.
 */
import { registry } from '../../registry.mjs';

const H = registry.health;

export const FIXED_DIMENSION_WEIGHTS = Object.freeze({
  D1: 12,
  D2: 8,
  D3: 15,
  D4: 15,
  D5: 8,
  D6: 8,
  D7: 8,
  D8: 6,
  D9: 8,
  D10: 12,
});

export const REGISTRY_BANDS = Object.freeze([
  { min: 85, max: 100, internal: 'Excellent', display: 'Excellent' },
  { min: 70, max: 84, internal: 'Good', display: 'Good' },
  { min: 50, max: 69, internal: 'Average', display: 'Average' },
  { min: 30, max: 49, internal: 'Poor', display: 'Poor' },
  { min: 0, max: 29, internal: 'Waste of Time', display: 'Did not justify the time' },
]);

export const SCOREABLE_WEIGHT_FLOOR = 70;

/**
 * Calculates composite score from dimension raw scores (0 to 3 scale) or null if unscoreable.
 * @param {Record<string, { raw: number | null, reason?: string }>} dimensionScores
 * @returns {{
 *   scoreable_weight: number,
 *   earned_points: number,
 *   composite_score: number | null,
 *   classification_band: string | null,
 *   display_band: string | null,
 *   partial_label: string | null,
 *   dimensions: Array<{ id: string, name: string, weight: number, raw: number | null, scoreable: boolean, points: number | null, unscoreable_reason: string | null }>
 * }}
 */
export function calculateCompositeScore(dimensionScores = {}) {
  let scoreableWeight = 0;
  let earnedPoints = 0;
  const processedDimensions = [];

  for (const [id, weight] of Object.entries(FIXED_DIMENSION_WEIGHTS)) {
    const entry = dimensionScores[id];
    const meta = H.dimensions.find((d) => d.id === id) || { name: id };
    const raw = entry && typeof entry.raw === 'number' && entry.raw >= 0 && entry.raw <= 3 ? entry.raw : null;
    const scoreable = raw !== null;
    const points = scoreable ? (raw / 3) * weight : null;

    if (scoreable) {
      scoreableWeight += weight;
      earnedPoints += points;
    }

    processedDimensions.push({
      id,
      name: meta.name,
      weight,
      raw,
      scoreable,
      points: points !== null ? Number(points.toFixed(2)) : null,
      unscoreable_reason: scoreable ? null : (entry?.reason || 'dimension unscoreable from provided record'),
    });
  }

  let compositeScore = null;
  let classificationBand = null;
  let displayBand = null;
  let partialLabel = null;

  if (scoreableWeight >= SCOREABLE_WEIGHT_FLOOR) {
    compositeScore = Math.round((100 * earnedPoints) / scoreableWeight);
    const band = REGISTRY_BANDS.find((b) => compositeScore >= b.min && compositeScore <= b.max) || REGISTRY_BANDS[REGISTRY_BANDS.length - 1];
    classificationBand = band.internal;
    displayBand = band.display;

    const scoreableCount = processedDimensions.filter((d) => d.scoreable).length;
    if (scoreableCount < 10) {
      partialLabel = `Partial score, ${scoreableCount} of 10 dimensions assessed`;
    }
  } else {
    partialLabel = 'Not scored: scoreable weight below 70-point floor';
  }

  return {
    scoreable_weight: scoreableWeight,
    earned_points: Number(earnedPoints.toFixed(2)),
    composite_score: compositeScore,
    classification_band: classificationBand,
    display_band: displayBand,
    partial_label: partialLabel,
    dimensions: processedDimensions,
  };
}
