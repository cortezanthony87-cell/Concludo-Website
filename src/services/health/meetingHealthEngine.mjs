/**
 * Tasklet 2.1: Meeting Health Engine and Core Framework
 *
 * Core Meeting Health Engine execution harness that ingests meeting signals
 * and runs modular dimension scoring plugins across all 10 diagnostic dimensions.
 */
import { calculateCompositeScore, FIXED_DIMENSION_WEIGHTS } from './healthScoringService.mjs';
import { analyzeParticipation } from './participationAnalysisEngine.mjs';
import { analyzeDecisionQuality } from './decisionQualityEngine.mjs';
import { auditMeetingActions } from './actionQualityAuditEngine.mjs';
import { analyzeStrategicValue } from './strategicValueEngine.mjs';
import { analyzeTimeEfficiency } from './timeEfficiencyService.mjs';

export const ENGINE_VERSION = 'v1.0';

/**
 * Runs the modular Meeting Health Engine against a meeting record.
 * @param {object} record MeetingRecord 1.1
 * @param {object} [context]
 * @param {boolean} [context.restricted]
 * @param {string} [context.objective]
 * @param {string} [context.typeDetailed]
 * @param {string} [context.meetingId]
 * @param {string} [context.organisationId]
 * @param {number} [context.userSuppliedHourlyRateAud]
 * @returns {{
 *   id: string,
 *   meeting_id: string,
 *   organisation_id: string,
 *   composite_score: number | null,
 *   scoreable_weight: number,
 *   partial_label: string | null,
 *   classification_band: string | null,
 *   display_band: string | null,
 *   engine_version: string,
 *   total_duration_seconds: number,
 *   dimension_scores: Record<string, { raw: number | null, points: number | null, weight: number, scoreable: boolean, basis: string[], unscoreable_reason: string | null }>,
 *   telemetry: {
 *     participation: ReturnType<typeof analyzeParticipation>,
 *     decisions: ReturnType<typeof analyzeDecisionQuality>,
 *     actions: ReturnType<typeof auditMeetingActions>,
 *     strategic: ReturnType<typeof analyzeStrategicValue>,
 *     efficiency: ReturnType<typeof analyzeTimeEfficiency>
 *   }
 * }}
 */
export function executeHealthEngine(record, context = {}) {
  const meetingId = context.meetingId || record.meeting?.id || '00000000-0000-0000-0000-000000000000';
  const orgId = context.organisationId || record.meeting?.organisation_id || '00000000-0000-0000-0000-000000000000';
  const durationMinutes = record.meeting?.duration_minutes != null ? record.meeting.duration_minutes : 60;
  const totalDurationSeconds = durationMinutes * 60;

  // Governance check: restricted records are never scored
  if (context.restricted) {
    return {
      id: crypto.randomUUID(),
      meeting_id: meetingId,
      organisation_id: orgId,
      composite_score: null,
      scoreable_weight: 0,
      partial_label: 'Restricted path. Performance, clinical, and sensitive records are not scored.',
      classification_band: null,
      display_band: null,
      engine_version: ENGINE_VERSION,
      total_duration_seconds: totalDurationSeconds,
      dimension_scores: {},
      telemetry: null,
    };
  }

  // Execute modular analysis plugins
  const participation = analyzeParticipation(record, context);
  const decisions = analyzeDecisionQuality(record, context);
  const actions = auditMeetingActions(record);
  const strategic = analyzeStrategicValue(record, context);
  const efficiency = analyzeTimeEfficiency(record, context);

  // Compile raw dimension scores
  const rawMap = {
    D1: { raw: actions.dimension_evaluations.D1.raw, basis: actions.dimension_evaluations.D1.basis },
    D2: { raw: participation.dimension_evaluations.D2.raw, basis: participation.dimension_evaluations.D2.basis },
    D3: { raw: decisions.dimension_evaluations.D3.raw, basis: decisions.dimension_evaluations.D3.basis },
    D4: { raw: actions.dimension_evaluations.D4.raw, basis: actions.dimension_evaluations.D4.basis },
    D5: {
      raw: efficiency.dimension_evaluations.D5.raw,
      basis: efficiency.dimension_evaluations.D5.basis,
      reason: efficiency.dimension_evaluations.D5.unscoreable_reason,
    },
    D6: { raw: participation.dimension_evaluations.D6.raw, basis: participation.dimension_evaluations.D6.basis },
    D7: {
      raw: strategic.dimension_evaluations.D7.raw,
      basis: strategic.dimension_evaluations.D7.basis,
      reason: strategic.dimension_evaluations.D7.unscoreable_reason,
    },
    D8: {
      raw: strategic.dimension_evaluations.D8.raw,
      basis: strategic.dimension_evaluations.D8.basis,
      reason: strategic.dimension_evaluations.D8.unscoreable_reason,
    },
    D9: {
      raw: strategic.dimension_evaluations.D9.raw,
      basis: strategic.dimension_evaluations.D9.basis,
      reason: strategic.dimension_evaluations.D9.unscoreable_reason,
    },
    D10: { raw: decisions.dimension_evaluations.D10.raw, basis: decisions.dimension_evaluations.D10.basis },
  };

  const calculated = calculateCompositeScore(rawMap);

  const dimensionScoresOut = {};
  for (const dim of calculated.dimensions) {
    const rawEntry = rawMap[dim.id] || {};
    dimensionScoresOut[dim.id] = {
      raw: dim.raw,
      points: dim.points,
      weight: dim.weight,
      scoreable: dim.scoreable,
      basis: rawEntry.basis || [],
      unscoreable_reason: dim.unscoreable_reason,
    };
  }

  return {
    id: crypto.randomUUID(),
    meeting_id: meetingId,
    organisation_id: orgId,
    composite_score: calculated.composite_score,
    scoreable_weight: calculated.scoreable_weight,
    partial_label: calculated.partial_label,
    classification_band: calculated.classification_band,
    display_band: calculated.display_band,
    engine_version: ENGINE_VERSION,
    total_duration_seconds: totalDurationSeconds,
    dimension_scores: dimensionScoresOut,
    telemetry: {
      participation,
      decisions,
      actions,
      strategic,
      efficiency,
    },
  };
}
