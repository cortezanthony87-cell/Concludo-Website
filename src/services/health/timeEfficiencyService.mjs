/**
 * Tasklet 2.7: Time Efficiency Analysis
 *
 * Quantifies meeting duration variance, punctuality, agenda pacing, and
 * illustrative meeting cost based on user-supplied inputs, evaluating
 * Time Efficiency (Dimension D5).
 *
 * Governance: No waste or savings claim. Cost figures are user-input driven
 * illustrations only. Concludo never claims savings or ROI.
 */

export class SavingsClaimsProhibitedError extends Error {
  constructor(message = 'Concludo does not calculate savings or waste; cost figures are user-input driven illustrations only.') {
    super(message);
    this.name = 'SavingsClaimsProhibitedError';
    this.code = 'SAVINGS_CLAIMS_PROHIBITED';
  }
}

/**
 * Evaluates meeting time efficiency and optional illustrative cost.
 * @param {object} record MeetingRecord 1.1
 * @param {object} [options]
 * @param {number} [options.scheduledDurationMinutes]
 * @param {number} [options.startDelayMinutes]
 * @param {number} [options.userSuppliedHourlyRateAud]
 * @returns {{
 *   scheduled_duration_minutes: number,
 *   actual_duration_minutes: number,
 *   start_delay_minutes: number,
 *   overrun_minutes: number,
 *   user_supplied_hourly_rates_used: boolean,
 *   illustrative_cost_aud: number | null,
 *   illustrative_cost_notice: string | null,
 *   efficiency_score: number,
 *   dimension_evaluations: {
 *     D5: { raw: number | null, basis: string[], unscoreable_reason: string | null }
 *   }
 * }}
 */
export function analyzeTimeEfficiency(record, options = {}) {
  if (options.calculateSavings || options.calculateRoi || options.calculateWaste) {
    throw new SavingsClaimsProhibitedError();
  }

  const m = record.meeting || {};
  const actualDuration = m.duration_minutes != null ? m.duration_minutes : 60;
  const scheduledDuration = options.scheduledDurationMinutes != null ? options.scheduledDurationMinutes : actualDuration;
  const startDelay = options.startDelayMinutes != null ? options.startDelayMinutes : 0;
  const overrun = Math.max(0, actualDuration - scheduledDuration);

  // Illustrative cost calculation based solely on user-supplied hourly rate
  let illustrativeCost = null;
  let illustrativeNotice = null;
  let userRatesUsed = false;

  if (typeof options.userSuppliedHourlyRateAud === 'number' && options.userSuppliedHourlyRateAud > 0) {
    userRatesUsed = true;
    const participantCount = (m.participants || []).length || 1;
    const hours = actualDuration / 60;
    illustrativeCost = Number((options.userSuppliedHourlyRateAud * participantCount * hours).toFixed(2));
    illustrativeNotice = 'Illustrative cost only. Calculated directly from user-supplied hourly rates and participant count. Concludo does not measure actual financial cost or assert financial waste.';
  }

  // Calculate efficiency score (0 to 100)
  let efficiencyScore = 100;
  if (startDelay > 0) efficiencyScore -= Math.min(25, startDelay * 2);
  if (overrun > 0) efficiencyScore -= Math.min(35, overrun * 2);

  const topics = record.topics || [];
  const parked = topics.filter((t) => t.status === 'parked').length;
  if (topics.length > 0) {
    const parkedRatio = parked / topics.length;
    if (parkedRatio > 0.3) efficiencyScore -= 20;
  }
  efficiencyScore = Math.max(0, Math.min(100, efficiencyScore));

  // D5 Evaluation (Time Efficiency, weight 8)
  let d5Raw = null;
  let d5Basis = [];
  let d5Reason = null;

  if (m.duration_minutes == null && !m.start_time) {
    d5Raw = null;
    d5Reason = 'duration unknown and the record is not time stamped';
  } else if (topics.length === 0) {
    d5Raw = 0;
    d5Basis.push('No topic structure is visible in the record.');
  } else {
    const closed = topics.filter((t) => t.status === 'decided').length;
    const ratio = parked / topics.length;
    d5Basis.push(`${closed} of ${topics.length} topics closed, ${parked} parked.`);
    if (ratio === 0 && closed > 0) d5Raw = 3;
    else if (ratio <= 0.2) d5Raw = 2;
    else if (ratio <= 0.4) d5Raw = 1;
    else d5Raw = 0;
  }

  return {
    scheduled_duration_minutes: scheduledDuration,
    actual_duration_minutes: actualDuration,
    start_delay_minutes: startDelay,
    overrun_minutes: overrun,
    user_supplied_hourly_rates_used: userRatesUsed,
    illustrative_cost_aud: illustrativeCost,
    illustrative_cost_notice: illustrativeNotice,
    efficiency_score: efficiencyScore,
    dimension_evaluations: {
      D5: { raw: d5Raw, basis: d5Basis, unscoreable_reason: d5Reason },
    },
  };
}
