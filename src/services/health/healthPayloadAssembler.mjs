/**
 * Tasklet 2.8: Health Payload Assembler
 *
 * Assembles the typed health payload from Tasklets 2.1 to 2.7 and hands it
 * to downstream generator GEN-12 (Template T17 Meeting Health Report).
 *
 * Produces no document and no outputs row. Internal coordination service.
 * Refuses to assemble for a restricted record.
 */
import { executeHealthEngine } from './meetingHealthEngine.mjs';

export class RestrictedRecordHealthRefusedError extends Error {
  constructor(message = 'Restricted records are never health-scored. Assembly refused.') {
    super(message);
    this.name = 'RestrictedRecordHealthRefusedError';
    this.code = 'RESTRICTED_RECORD_HEALTH_REFUSED';
  }
}

/**
 * Assembles a typed health report payload for GEN-12.
 * @param {object} record MeetingRecord 1.1
 * @param {object} [context]
 * @returns {object} Typed GEN-12 input payload
 */
export function assembleHealthPayload(record, context = {}) {
  if (context.restricted || record.confidentiality?.restricted) {
    throw new RestrictedRecordHealthRefusedError();
  }

  const runResult = executeHealthEngine(record, context);
  const telemetry = runResult.telemetry;

  const payload = {
    schema_version: 'v1.0',
    meeting_id: runResult.meeting_id,
    organisation_id: runResult.organisation_id,
    engine_version: runResult.engine_version,
    scoring: {
      composite_score: runResult.composite_score,
      scoreable_weight: runResult.scoreable_weight,
      classification_band: runResult.classification_band,
      display_band: runResult.display_band,
      partial_label: runResult.partial_label,
      dimensions: runResult.dimension_scores,
    },
    participation: {
      participant_count: telemetry.participation.participant_count,
      contributor_count: telemetry.participation.contributor_count,
      distribution_index: telemetry.participation.distribution_index,
      top_share_percentage: telemetry.participation.top_share_percentage,
      questions_asked_count: telemetry.participation.questions_asked_count,
      dissent_captured: telemetry.participation.dissent_captured,
      individual_scores: null, // Strictly null
    },
    efficiency: {
      scheduled_duration_minutes: telemetry.efficiency.scheduled_duration_minutes,
      actual_duration_minutes: telemetry.efficiency.actual_duration_minutes,
      start_delay_minutes: telemetry.efficiency.start_delay_minutes,
      overrun_minutes: telemetry.efficiency.overrun_minutes,
      user_supplied_hourly_rates_used: telemetry.efficiency.user_supplied_hourly_rates_used,
      illustrative_cost_aud: telemetry.efficiency.illustrative_cost_aud,
      efficiency_score: telemetry.efficiency.efficiency_score,
    },
    action_quality: {
      audited_actions_count: telemetry.actions.audits.length,
      fully_compliant_count: telemetry.actions.fully_compliant_count,
      audits: telemetry.actions.audits,
    },
    decision_quality: {
      audited_decisions_count: telemetry.decisions.audits.length,
      average_quality_score: telemetry.decisions.average_quality_score,
      audits: telemetry.decisions.audits,
    },
    strategic_alignment: {
      strategic_alignments: telemetry.strategic.strategic_alignments,
    },
    statutory_notice: 'Not a benchmark. No industry average, no pass mark, no comparison with any other organisation. The only useful comparison is against the same meeting, or the same type of meeting, scored at a different time.',
  };

  return payload;
}
