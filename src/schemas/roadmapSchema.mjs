/**
 * Tasklet 8.6: Roadmap Schema (OUT-32)
 * Tasklet 8.7: Risk Schema (OUT-05, OUT-12)
 * Tasklet 8.8: Opportunity Schema (OUT-13)
 */

export class InvalidDateFormatError extends Error {
  constructor(message, path = 'date') {
    super(message);
    this.name = 'INVALID_DATE_FORMAT';
    this.path = path;
  }
}

export class RiskCitationMissingError extends Error {
  constructor(message, riskId = null) {
    super(message);
    this.name = 'RISK_CITATION_MISSING';
    this.riskId = riskId;
  }
}

export class OpportunityProponentMissingError extends Error {
  constructor(message, oppId = null) {
    super(message);
    this.name = 'OPPORTUNITY_PROPONENT_MISSING';
    this.oppId = oppId;
  }
}

export function validateRoadmapPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Roadmap payload must be an object');

  const milestones = payload.milestones || [];
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?)?$/;

  for (const m of milestones) {
    const d = m.date || m.target_date || m.deadline;
    if (d && d !== 'unscheduled' && d !== '[UNSCHEDULED]') {
      if (typeof d !== 'string' || !isoDateRegex.test(d) || isNaN(Date.parse(d))) {
        throw new InvalidDateFormatError(`Milestone ${m.id || 'unassigned'} date '${d}' is not valid ISO 8601`, m.id);
      }
    }
  }

  return { ok: true };
}

export function validateRiskPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Risk payload must be an object');

  const risks = Array.isArray(payload) ? payload : (payload.risks || []);
  if (!risks.length) throw new Error('At least one risk required');

  for (const r of risks) {
    if (!r.citations || !Array.isArray(r.citations) || r.citations.length === 0) {
      throw new RiskCitationMissingError(`Risk ${r.id || 'unknown'} has no verifiable citation array`, r.id);
    }
    // Probability & Impact 1 to 5
    if (r.probability != null && (r.probability < 1 || r.probability > 5)) {
      throw new Error(`Risk ${r.id} probability must be between 1 and 5`);
    }
    if (r.impact != null && (r.impact < 1 || r.impact > 5)) {
      throw new Error(`Risk ${r.id} impact must be between 1 and 5`);
    }
  }

  return { ok: true };
}

export function validateOpportunityPayload(payload) {
  if (!payload || typeof payload !== 'object') throw new Error('Opportunity payload must be an object');

  const opps = Array.isArray(payload) ? payload : (payload.opportunities || []);
  if (!opps.length) throw new Error('At least one opportunity required');

  for (const o of opps) {
    if (!o.stated_by || typeof o.stated_by !== 'string' || !o.stated_by.trim()) {
      throw new OpportunityProponentMissingError(`Opportunity ${o.id || 'unknown'} missing mandatory stated_by proponent`, o.id);
    }
    if (o.stated_aud_value !== undefined && o.stated_aud_value !== null && o.stated_aud_value !== '[UNSTATED]') {
      if (typeof o.stated_aud_value !== 'number' || isNaN(o.stated_aud_value)) {
        throw new Error(`Opportunity ${o.id} stated AUD value must be a number or '[UNSTATED]'`);
      }
    }
  }

  return { ok: true };
}
