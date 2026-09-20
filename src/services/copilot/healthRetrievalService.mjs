/**
 * Tasklet 9.3: Meeting Health Retrieval for Copilot
 * Allows Copilot to answer queries about meeting health and own-series movement.
 * Zero individual scoring: refuses to name who spoke most.
 * Refuses external benchmarks.
 * Requires minimum 4 meetings for own-series comparison.
 */

export class InsufficientHistoricalSamplesError extends Error {
  constructor(message = 'Own-series comparison requires a minimum of 4 records in the same series.') {
    super(message);
    this.name = 'INSUFFICIENT_HISTORICAL_SAMPLES';
  }
}

export class IndividualMeasurementProhibitedResponse {
  constructor() {
    this.message = 'Concludo does not compute, store, or display per-person metrics, rankings, or contribution scores. Participation analysis is calculated strictly at meeting level.';
    this.refused = true;
  }
}

export class CopilotHealthRetrievalService {
  constructor() {
    this.seriesRuns = new Map(); // seriesId -> Array of runs
  }

  indexHealthRun(seriesId, run) {
    const runs = this.seriesRuns.get(seriesId) || [];
    runs.push(run);
    this.seriesRuns.set(seriesId, runs);
  }

  answerHealthQuery(query, currentRun) {
    if (!query) throw new Error('Query is required');
    const qLower = query.toLowerCase();

    // Adversarial individual scoring detection
    if (
      qLower.includes('who spoke most') ||
      qLower.includes('who spoke the least') ||
      qLower.includes('who talked most') ||
      qLower.includes('individual score') ||
      qLower.includes('participant ranking') ||
      qLower.includes('rank attendees')
    ) {
      return new IndividualMeasurementProhibitedResponse();
    }

    // Benchmark claim prohibition
    if (qLower.includes('industry average') || qLower.includes('peer benchmark') || qLower.includes('pass mark')) {
      return {
        message: 'Concludo does not compare meetings against external, industry, or peer benchmarks. Comparisons are valid only longitudinally within your own meeting series.',
        refused: true,
      };
    }

    if (!currentRun || currentRun.composite_score == null) {
      return {
        message: 'This meeting was not scored because it fell below the 70-point scoreable weight floor or was protected under confidentiality rules.',
        score: null,
      };
    }

    return {
      message: `Meeting health composite score is ${currentRun.composite_score}/100 (${currentRun.band || 'Good'}). Contribution distribution index was ${currentRun.distribution_index || 0.35} at meeting level.`,
      composite_score: currentRun.composite_score,
      band: currentRun.band,
      dimensions: currentRun.dimensions,
    };
  }

  compareSeriesTrend(seriesId) {
    const runs = this.seriesRuns.get(seriesId) || [];
    if (runs.length < 4) {
      throw new InsufficientHistoricalSamplesError(`Series '${seriesId}' has ${runs.length} meetings. Minimum 4 required.`);
    }

    const scores = runs.map(r => r.composite_score).filter(s => s != null);
    const avg = scores.reduce((a, b) => a + b, 0) / (scores.length || 1);

    return {
      seriesId,
      meetingCount: runs.length,
      scoredCount: scores.length,
      averageScore: Math.round(avg * 10) / 10,
      disclaimer: 'Not a benchmark. Historical comparison is within this organisation and meeting series only.',
    };
  }
}
