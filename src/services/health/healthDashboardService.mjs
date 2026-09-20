/**
 * Tasklet 2.9: Health Dashboards
 *
 * Aggregates organisation-wide meeting health over time within the caller's
 * own workspace. Own workspace aggregation only, illustrative cost only.
 */

export class CrossOrganisationAggregationProhibitedError extends Error {
  constructor(message = 'Cross-organisation aggregation and peer benchmarking are strictly prohibited.') {
    super(message);
    this.name = 'CrossOrganisationAggregationProhibitedError';
    this.code = 'CROSS_ORGANISATION_PROHIBITED';
  }
}

/**
 * Aggregates health runs into time-series dashboard metrics for a single organisation.
 * @param {string} organisationId
 * @param {Array<{
 *   id: string,
 *   organisation_id: string,
 *   composite_score: number | null,
 *   created_at: string | Date,
 *   illustrative_cost_aud?: number | null
 * }>} healthRuns
 * @returns {{
 *   organisation_id: string,
 *   summary: {
 *     total_meetings: number,
 *     scored_count: number,
 *     unscored_count: number,
 *     average_score: number | null,
 *     total_illustrative_cost_aud: number,
 *     low_health_count: number
 *   },
 *   weekly_trends: Array<{
 *     week_bucket: string,
 *     total_meetings: number,
 *     scored_meeting_count: number,
 *     unscored_meeting_count: number,
 *     avg_health_score: number | null,
 *     illustrative_meeting_cost: number,
 *     low_health_meeting_count: number
 *   }>,
 *   benchmark_notice: string
 * }}
 */
export function aggregateOrgHealthDashboard(organisationId, healthRuns = []) {
  if (!organisationId) {
    throw new Error('organisationId is required');
  }

  // Validate tenant boundary
  for (const run of healthRuns) {
    if (run.organisation_id !== organisationId) {
      throw new CrossOrganisationAggregationProhibitedError();
    }
  }

  let totalMeetings = healthRuns.length;
  let scoredCount = 0;
  let unscoredCount = 0;
  let sumScore = 0;
  let totalCost = 0;
  let lowHealthCount = 0;

  const weeklyMap = new Map();

  for (const run of healthRuns) {
    const isScored = typeof run.composite_score === 'number';
    if (isScored) {
      scoredCount++;
      sumScore += run.composite_score;
      if (run.composite_score < 50) lowHealthCount++;
    } else {
      unscoredCount++;
    }

    const cost = Number(run.illustrative_cost_aud || 0);
    totalCost += cost;

    // Bucket by week (YYYY-WW)
    const date = new Date(run.created_at || Date.now());
    const weekKey = `${date.getUTCFullYear()}-W${String(Math.ceil((date.getUTCDate() + date.getUTCDay()) / 7)).padStart(2, '0')}`;

    if (!weeklyMap.has(weekKey)) {
      weeklyMap.set(weekKey, {
        week_bucket: weekKey,
        total_meetings: 0,
        scored_meeting_count: 0,
        unscored_meeting_count: 0,
        scores_sum: 0,
        illustrative_meeting_cost: 0,
        low_health_meeting_count: 0,
      });
    }

    const b = weeklyMap.get(weekKey);
    b.total_meetings++;
    if (isScored) {
      b.scored_meeting_count++;
      b.scores_sum += run.composite_score;
      if (run.composite_score < 50) b.low_health_meeting_count++;
    } else {
      b.unscored_meeting_count++;
    }
    b.illustrative_meeting_cost += cost;
  }

  const weeklyTrends = Array.from(weeklyMap.values()).map((b) => ({
    week_bucket: b.week_bucket,
    total_meetings: b.total_meetings,
    scored_meeting_count: b.scored_meeting_count,
    unscored_meeting_count: b.unscored_meeting_count,
    avg_health_score: b.scored_meeting_count > 0 ? Math.round(b.scores_sum / b.scored_meeting_count) : null,
    illustrative_meeting_cost: Number(b.illustrative_meeting_cost.toFixed(2)),
    low_health_meeting_count: b.low_health_meeting_count,
  })).sort((a, b) => a.week_bucket.localeCompare(b.week_bucket));

  return {
    organisation_id: organisationId,
    summary: {
      total_meetings: totalMeetings,
      scored_count: scoredCount,
      unscored_count: unscoredCount,
      average_score: scoredCount > 0 ? Math.round(sumScore / scoredCount) : null,
      total_illustrative_cost_aud: Number(totalCost.toFixed(2)),
      low_health_count: lowHealthCount,
    },
    weekly_trends: weeklyTrends,
    benchmark_notice: 'Not a benchmark. Aggregate metrics reflect meetings within your own organisation only. No comparison with any other organisation is computed or displayed.',
  };
}
