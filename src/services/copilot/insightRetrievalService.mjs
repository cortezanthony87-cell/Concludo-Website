/**
 * Tasklet 9.4: Insight Retrieval for Copilot
 * Tasklet 9.5: Recommendation Retrieval for Copilot
 */

export class CrossMeetingLimitExceededError extends Error {
  constructor(message = 'Cross-meeting query window capped to 30 days on Pro subscription.') {
    super(message);
    this.name = 'CROSS_MEETING_LIMIT_EXCEEDED';
  }
}

export class ZeroOutstandingRecommendationsResponse {
  constructor() {
    this.message = 'All recorded recommendations for this project have been reviewed or resolved.';
    this.outstandingCount = 0;
  }
}

export class CopilotInsightRetrievalService {
  constructor() {
    this.meetingInsights = new Map(); // meetingId -> insights
  }

  indexInsights(meetingId, orgId, date, insights) {
    this.meetingInsights.set(meetingId, { orgId, date: new Date(date), insights });
  }

  queryInsightsAcrossMeetings(orgId, daysWindow = 30, tier = 'pro_subscription') {
    if (tier === 'pro_subscription' && daysWindow > 30) {
      throw new CrossMeetingLimitExceededError();
    }

    const now = Date.now();
    const cutoff = now - (daysWindow * 86400000);
    const aggregated = [];

    for (const [mId, data] of this.meetingInsights.entries()) {
      if (data.orgId !== orgId) continue;
      if (data.date.getTime() < cutoff) continue;

      for (const ins of data.insights) {
        // Guarantee absence questions stay questions ending with ?
        let text = ins.text || ins.observation || '';
        if (ins.channel === 'INS-C' || ins.channel === 'INS-D' || ins.is_absence) {
          if (!text.endsWith('?')) text += '?';
        }
        aggregated.push({
          meetingId: mId,
          channel: ins.channel,
          text,
          citations: ins.citations || [],
        });
      }
    }

    return {
      orgId,
      daysWindow,
      totalInsights: aggregated.length,
      insights: aggregated,
    };
  }
}

export class CopilotRecommendationRetrievalService {
  constructor() {
    this.recommendations = new Map(); // orgId -> Array of recs
  }

  indexRecommendations(orgId, recs) {
    const list = this.recommendations.get(orgId) || [];
    list.push(...recs);
    this.recommendations.set(orgId, list);
  }

  getOutstandingP1Recommendations(orgId) {
    const list = this.recommendations.get(orgId) || [];
    const p1s = list.filter(r => r.priority === 'P1' && (r.status === 'PENDING' || r.status === 'OPEN'));

    if (p1s.length === 0) {
      return new ZeroOutstandingRecommendationsResponse();
    }

    return {
      outstandingCount: p1s.length,
      recommendations: p1s.map(r => ({
        id: r.id,
        priority: 'P1',
        title: r.title || r.recommendation,
        failure_pattern: r.failure_pattern || 'FP-01',
        impact: r.impact || 'High Governance Impact',
        owner: r.owner || 'Executive Leadership',
        citations: r.citations || [],
      })),
    };
  }
}
