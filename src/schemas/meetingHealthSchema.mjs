/**
 * Tasklet 8.4: Meeting Health Schema (OUT-09)
 * Tasklet 8.5: Decision Pack Schema (OUT-53)
 */

export class InvalidHealthScoreRangeError extends Error {
  constructor(message, dimension = null) {
    super(message);
    this.name = 'INVALID_HEALTH_SCORE_RANGE';
    this.dimension = dimension;
  }
}

export class IndividualScoringSchemaViolationError extends Error {
  constructor(message = 'Schema violation: individual_scores must be null. Per-person metrics strictly prohibited.') {
    super(message);
    this.name = 'INDIVIDUAL_SCORING_SCHEMA_VIOLATION';
  }
}

export class DecisionRationaleMissingError extends Error {
  constructor(message = 'Decision rationale is mandatory', decisionId = null) {
    super(message);
    this.name = 'DECISION_RATIONALE_MISSING';
    this.decisionId = decisionId;
  }
}

export function validateMeetingHealthPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Health payload must be an object');
  }

  // Schema rule: individual_scores is strictly null
  if (payload.individual_scores != null || payload.participant_scores != null || payload.speaker_scores != null) {
    throw new IndividualScoringSchemaViolationError();
  }

  // Dimension scores D1 to D10
  const dims = payload.dimensions || {};
  for (const [dimKey, score] of Object.entries(dims)) {
    if (score !== null) {
      if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > 100) {
        throw new InvalidHealthScoreRangeError(`Dimension ${dimKey} score must be an integer between 0 and 100, got: ${score}`, dimKey);
      }
    }
  }

  if (payload.composite_score !== null && payload.composite_score !== undefined) {
    const cs = payload.composite_score;
    if (typeof cs !== 'number' || cs < 0 || cs > 100) {
      throw new InvalidHealthScoreRangeError(`Composite score must be between 0 and 100, got: ${cs}`, 'composite');
    }
  }

  return { ok: true };
}

export function validateDecisionPackPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Decision pack payload must be an object');
  }

  const decisions = payload.decisions || [];
  if (!Array.isArray(decisions) || decisions.length === 0) {
    throw new Error('Decision pack requires at least one decision');
  }

  for (const d of decisions) {
    if (!d.decision && !d.statement) {
      throw new Error(`Decision record missing statement: ${d.id || 'unknown'}`);
    }
    if (!d.rationale || typeof d.rationale !== 'string' || !d.rationale.trim()) {
      throw new DecisionRationaleMissingError(`Decision ${d.id || 'unassigned'} missing mandatory rationale`, d.id);
    }
    // Rejects any decision marked inferred
    if (d.evidence_mark === 'inferred' || d.isInferred || d.is_inferred) {
      throw new Error(`DECISION_INFERRED_PROHIBITED: Decision ${d.id} is marked inferred. Inferred decisions are forbidden.`);
    }
    if (d.evidence_mark && !['confirmed', 'proposed'].includes(d.evidence_mark)) {
      throw new Error(`Invalid evidence mark on decision ${d.id}: ${d.evidence_mark}. Must be confirmed or proposed.`);
    }
  }

  return { ok: true };
}
