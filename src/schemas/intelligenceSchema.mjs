/**
 * Tasklet 8.10: Intelligence Schema
 * Upstream DAG intelligence payloads and MeetingRecord 1.1 schema validation.
 * Three structural constraints:
 *   1. health.individual_scores is typed null
 *   2. insights_v2[].about_an_individual is const false
 *   3. routing[].human_check_required is const true
 * Every opportunities[] entry requires id, opportunity, stated_by, basis_given, evidence, source_basis.
 */

export class UpstreamIntelligenceInvalidError extends Error {
  constructor(message, errors = []) {
    super(message);
    this.name = 'UPSTREAM_INTELLIGENCE_INVALID';
    this.errors = errors;
  }
}

export function validateIntelligencePayload(record) {
  const errors = [];
  if (!record || typeof record !== 'object') {
    throw new UpstreamIntelligenceInvalidError('MeetingRecord payload must be an object', ['root']);
  }

  // Constraint 1: health.individual_scores is typed null
  if (record.health) {
    if (record.health.individual_scores !== null && record.health.individual_scores !== undefined) {
      errors.push({ path: 'health.individual_scores', message: 'Structural constraint: health.individual_scores must be null' });
    }
  }

  // Constraint 2: insights_v2[].about_an_individual is const false
  if (record.insights_v2 && Array.isArray(record.insights_v2)) {
    for (let i = 0; i < record.insights_v2.length; i++) {
      const ins = record.insights_v2[i];
      if (ins.about_an_individual !== false) {
        errors.push({ path: `insights_v2[${i}].about_an_individual`, message: 'Structural constraint: about_an_individual must be const false' });
      }
    }
  }

  // Constraint 3: routing[].human_check_required is const true
  if (record.routing && Array.isArray(record.routing)) {
    for (let i = 0; i < record.routing.length; i++) {
      const route = record.routing[i];
      if (route.human_check_required !== true) {
        errors.push({ path: `routing[${i}].human_check_required`, message: 'Structural constraint: human_check_required must be const true' });
      }
    }
  }

  // Constraint 4: opportunities[] fields
  if (record.opportunities && Array.isArray(record.opportunities)) {
    for (let i = 0; i < record.opportunities.length; i++) {
      const opp = record.opportunities[i];
      const req = ['id', 'opportunity', 'stated_by', 'basis_given', 'evidence', 'source_basis'];
      for (const field of req) {
        if (!opp[field]) {
          errors.push({ path: `opportunities[${i}].${field}`, message: `Missing mandatory opportunity field: ${field}` });
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new UpstreamIntelligenceInvalidError('Upstream intelligence validation failed', errors);
  }

  return { ok: true };
}
