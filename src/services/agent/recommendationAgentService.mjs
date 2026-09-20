/**
 * Tasklet 10.3: Recommendation Consumption by Agents
 * Tasklet 10.4: Insight Consumption by Agents
 */

export class RecommendationNotAcceptedError extends Error {
  constructor(message = 'Recommendation must be in ACCEPTED status before drafting execution tickets') {
    super(message);
    this.name = 'RECOMMENDATION_NOT_ACCEPTED';
  }
}

export class RecommendationAgentService {
  constructor(governanceBarrier = null) {
    this.governanceBarrier = governanceBarrier;
  }

  draftExecutionTicket(recommendation, agentId, orgId) {
    if (!recommendation) throw new Error('Recommendation required');

    // Rule: Reject execution if recommendation is not ACCEPTED
    if (recommendation.status !== 'ACCEPTED') {
      throw new RecommendationNotAcceptedError();
    }

    const ticketDraft = {
      title: `[EXECUTION DRAFT] ${recommendation.title || recommendation.recommendation}`,
      description: recommendation.description || recommendation.recommendation,
      priority: recommendation.priority || 'P2',
      failure_pattern: recommendation.failure_pattern || 'FP-01',
      deadline: recommendation.deadline || 'Pending review',
      owner: recommendation.owner || 'Unassigned',
      citations: recommendation.citations || [],
      is_draft: true,
      requires_human_approval: true,
    };

    if (this.governanceBarrier) {
      return this.governanceBarrier.submitActionRequest({
        organisation_id: orgId,
        requesting_agent: agentId,
        action_type: 'CREATE_TICKET',
        proposed_payload: ticketDraft,
      });
    }

    return ticketDraft;
  }
}

export class InsightAgentStream {
  constructor() {
    this.auditLog = [];
  }

  streamInsight(orgId, insight, targetSystem) {
    if (!insight) throw new Error('Insight is required');

    // Absence questions stay questions ending with ?
    let text = insight.text || insight.observation || '';
    if (insight.channel === 'INS-C' || insight.channel === 'INS-D' || insight.is_absence) {
      if (!text.endsWith('?')) text += '?';
    }

    const payload = {
      organisation_id: orgId,
      target_system: targetSystem,
      channel: insight.channel,
      insight_text: text,
      citations: insight.citations || [],
      dispatched_at: new Date().toISOString(),
    };

    // Mandatory audit trail recording
    this.auditLog.push({
      action: 'INSIGHT_DISPATCH',
      orgId,
      targetSystem,
      timestamp: payload.dispatched_at,
    });

    return payload;
  }
}
