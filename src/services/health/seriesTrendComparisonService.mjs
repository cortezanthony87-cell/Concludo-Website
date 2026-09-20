/**
 * Tasklet 2.10: Series Trend Comparison
 *
 * Enables longitudinal tracking of meeting health across identical meeting series
 * over time within the caller's own workspace.
 * Strictly prohibits cross-organisation or external market comparison.
 *
 * Rules:
 * - Own comparison only. One meeting series over time.
 * - Refuses to plot across different meeting types.
 * - Minimum sample count gate: at least 4 meetings required in the series.
 * - Injects canonical "Not a benchmark..." statement verbatim into all payloads.
 */

export const NOT_A_BENCHMARK_STATEMENT =
  'Not a benchmark. No industry average, no pass mark, no comparison with any other organisation. The only useful comparison is against the same meeting, or the same type of meeting, scored at a different time.';

export class SeriesComparisonError extends Error {
  constructor(message, code = 'SERIES_COMPARISON_ERROR') {
    super(message);
    this.name = 'SeriesComparisonError';
    this.code = code;
  }
}

/**
 * Compares longitudinal health trends for a single meeting series.
 *
 * @param {string} organisationId
 * @param {string} seriesId
 * @param {Array<{
 *   meeting_id: string,
 *   organisation_id: string,
 *   series_id: string,
 *   meeting_type: string,
 *   scored_at: string | Date,
 *   composite_score: number | null,
 *   dimension_scores: Record<string, { raw: number | null, points: number | null }>
 * }>} seriesMeetings
 * @returns {{
 *   series_id: string,
 *   meeting_type: string,
 *   sample_count: number,
 *   can_compare: boolean,
 *   trend_direction: 'improving' | 'stable' | 'declining' | 'insufficient_data',
 *   score_history: Array<{ meeting_id: string, scored_at: string, score: number | null }>,
 *   dimension_trends: Record<string, { direction: string, history: number[] }>,
 *   benchmark_notice: string
 * }}
 */
export function compareSeriesTrends(organisationId, seriesId, seriesMeetings = []) {
  if (!organisationId || !seriesId) {
    throw new SeriesComparisonError('organisationId and seriesId are required', 'MISSING_REQUIRED_PARAMS');
  }

  // Enforce tenant boundary
  for (const m of seriesMeetings) {
    if (m.organisation_id !== organisationId) {
      throw new SeriesComparisonError(
        'Cross-organisation comparison is strictly prohibited.',
        'CROSS_ORGANISATION_PROHIBITED'
      );
    }
    if (m.series_id !== seriesId) {
      throw new SeriesComparisonError(
        'Cannot compare meetings across different series IDs.',
        'CROSS_SERIES_PROHIBITED'
      );
    }
  }

  // Refuse cross-meeting-type comparisons
  const meetingTypes = new Set(seriesMeetings.map((m) => m.meeting_type).filter(Boolean));
  if (meetingTypes.size > 1) {
    throw new SeriesComparisonError(
      'Cannot compare health trends across different meeting types. Series meetings must share the same meeting type.',
      'CROSS_MEETING_TYPE_PROHIBITED'
    );
  }

  const meetingType = meetingTypes.size === 1 ? Array.from(meetingTypes)[0] : 'general';
  const sampleCount = seriesMeetings.length;
  const canCompare = sampleCount >= 4; // Longitudinal gate: 4 or more records

  const sorted = [...seriesMeetings].sort(
    (a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime()
  );

  const scoreHistory = sorted.map((m) => ({
    meeting_id: m.meeting_id,
    scored_at: new Date(m.scored_at).toISOString(),
    score: m.composite_score,
  }));

  if (!canCompare) {
    return {
      series_id: seriesId,
      meeting_type: meetingType,
      sample_count: sampleCount,
      can_compare: false,
      trend_direction: 'insufficient_data',
      score_history: scoreHistory,
      dimension_trends: {},
      gate_status: `Insufficient data. Longitudinal series trend requires at least 4 meetings in the series (current: ${sampleCount}).`,
      benchmark_notice: NOT_A_BENCHMARK_STATEMENT,
    };
  }

  // Determine trend direction across scored meetings
  const validScores = sorted
    .map((m) => m.composite_score)
    .filter((s) => typeof s === 'number');

  let trendDirection = 'stable';
  if (validScores.length >= 4) {
    const firstHalf = validScores.slice(0, Math.floor(validScores.length / 2));
    const secondHalf = validScores.slice(Math.floor(validScores.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond - avgFirst >= 5) trendDirection = 'improving';
    else if (avgFirst - avgSecond >= 5) trendDirection = 'declining';
  }

  // Per-dimension trajectory
  const dimensionCodes = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10'];
  const dimensionTrends = {};

  for (const code of dimensionCodes) {
    const history = [];
    for (const m of sorted) {
      const pt = m.dimension_scores?.[code]?.points;
      if (typeof pt === 'number') history.push(pt);
    }

    let dir = 'stable';
    if (history.length >= 4) {
      const first = history[0];
      const last = history[history.length - 1];
      if (last > first + 1) dir = 'improving';
      else if (first > last + 1) dir = 'declining';
    }
    dimensionTrends[code] = { direction: dir, history };
  }

  return {
    series_id: seriesId,
    meeting_type: meetingType,
    sample_count: sampleCount,
    can_compare: true,
    trend_direction: trendDirection,
    score_history: scoreHistory,
    dimension_trends: dimensionTrends,
    gate_status: 'Eligible for own-series longitudinal comparison.',
    benchmark_notice: NOT_A_BENCHMARK_STATEMENT,
  };
}
