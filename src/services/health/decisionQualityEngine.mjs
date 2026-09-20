/**
 * Tasklet 2.4: Decision Quality Analysis
 *
 * Evaluates whether decisions reached in the meeting carry clear rationale,
 * explicit alternatives, and recorded dissent, evaluating Decision Quality
 * (Dimension D3) and Outcome Quality (Dimension D10).
 *
 * Scores decisions, not people. Inferred decisions are strictly refused.
 */

export class InferredDecisionRefusedError extends Error {
  constructor(message = 'Inferred decisions cannot be scored or promoted to decision records.') {
    super(message);
    this.name = 'InferredDecisionRefusedError';
    this.code = 'INFERRED_DECISION_REFUSED';
  }
}

/**
 * Evaluates an individual decision against the Concludo Decision Rigour Rubric.
 * @param {object} decision
 * @returns {{
 *   decision_id: string,
 *   decision_statement: string,
 *   has_explicit_rationale: boolean,
 *   alternatives_considered_count: number,
 *   consensus_type: 'UNANIMOUS' | 'MAJORITY' | 'EXECUTIVE_DECREE' | 'RECORDED_DISSENT',
 *   quality_score: number,
 *   evaluation_notes: string
 * }}
 */
export function auditDecisionRigour(decision) {
  if (decision.evidence === 'inferred') {
    throw new InferredDecisionRefusedError(`Decision ${decision.id || 'unknown'} has inferred evidence.`);
  }

  const statement = decision.statement || decision.decision || '';
  const rationale = (decision.rationale || '').trim();
  const hasExplicitRationale = Boolean(rationale && rationale.length > 5);
  const optionsRejected = Array.isArray(decision.options_rejected) ? decision.options_rejected : [];
  const alternativesCount = optionsRejected.length;
  const dissent = Array.isArray(decision.dissent) ? decision.dissent : [];

  let consensusType = 'UNANIMOUS';
  if (dissent.length > 0) {
    consensusType = 'RECORDED_DISSENT';
  } else if (decision.approver?.status === 'stated' && !decision.ratified_by_majority) {
    consensusType = 'EXECUTIVE_DECREE';
  } else if (decision.ratified_by_majority) {
    consensusType = 'MAJORITY';
  }

  // Calculate 0 to 100 rigour score
  let score = 20; // Base presence
  const notes = [];

  if (hasExplicitRationale) {
    score += 30;
    notes.push('Clear rationale articulated.');
  } else {
    notes.push('Lacks explicit business rationale.');
  }

  if (alternativesCount > 0) {
    score += 25;
    notes.push(`${alternativesCount} alternative(s) formally evaluated.`);
  } else {
    notes.push('No alternatives or rejected options recorded.');
  }

  if (decision.approver?.status === 'stated' && decision.approver?.name) {
    score += 15;
    notes.push(`Authoritative approver identified.`);
  }

  if (!decision.conditions || decision.review_date) {
    score += 10;
  }

  return {
    decision_id: decision.id || 'DEC-UNKNOWN',
    decision_statement: statement,
    has_explicit_rationale: hasExplicitRationale,
    alternatives_considered_count: alternativesCount,
    consensus_type: consensusType,
    quality_score: Math.min(100, score),
    evaluation_notes: notes.join(' '),
  };
}

/**
 * Evaluates decisions across a meeting record.
 * @param {object} record MeetingRecord 1.1
 * @param {object} [context]
 * @returns {{
 *   audits: Array<ReturnType<typeof auditDecisionRigour>>,
 *   average_quality_score: number | null,
 *   dimension_evaluations: {
 *     D3: { raw: number | null, basis: string[] },
 *     D10: { raw: number | null, basis: string[] }
 *   }
 * }}
 */
export function analyzeDecisionQuality(record, context = {}) {
  const ds = record.decisions || [];
  for (const d of ds) {
    if (d.evidence === 'inferred') {
      throw new InferredDecisionRefusedError();
    }
  }

  const objective = context.objective || record.meeting_context?.objective || 'inform';
  const audits = ds.map((d) => auditDecisionRigour(d));

  const averageScore = audits.length
    ? Math.round(audits.reduce((acc, a) => acc + a.quality_score, 0) / audits.length)
    : null;

  // D3 Evaluation (Decision Quality, weight 15)
  let d3Raw = 0;
  const d3Basis = [];
  const reAnchor = ['explore', 'learn', 'diagnose'].includes(objective);

  if (reAnchor) {
    const nextIdentified = (record.next_meeting?.decisions_required || []).length > 0;
    const assigned = (record.open_questions || []).some((q) => q.expected_resolver?.status === 'stated');
    d3Basis.push(`Objective is ${objective}. Closure is not penalised. Scored on whether the next decision was identified and assigned.`);
    if (nextIdentified && assigned) {
      d3Raw = 3;
      d3Basis.push('The decision to be taken next is named and a resolver is assigned.');
    } else if (nextIdentified || assigned) {
      d3Raw = 2;
      d3Basis.push('Partially identified or partially assigned.');
    } else {
      d3Raw = 1;
      d3Basis.push('Neither the next decision nor a resolver was named.');
    }
  } else if (ds.length === 0) {
    const needed = ['decide', 'negotiate', 'recommend'].includes(objective);
    d3Raw = 0;
    d3Basis.push(
      needed
        ? `Objective is ${objective} and no decision was recorded. This is the primary finding, not a low score.`
        : 'No decisions were recorded.'
    );
  } else {
    const withApprover = ds.filter((d) => d.approver?.status === 'stated').length;
    const withRationale = ds.filter((d) => (d.rationale || '').trim().length > 0).length;
    const withRejected = ds.filter((d) => (d.options_rejected || []).length > 0).length;
    const provisionalOk = ds.every((d) => !d.conditions || d.review_date);

    d3Basis.push(
      `${withApprover} of ${ds.length} decisions name an approver.`,
      `${withRationale} of ${ds.length} record a rationale.`,
      `${withRejected} of ${ds.length} record the options rejected.`
    );

    if (withApprover === ds.length && withRationale === ds.length && withRejected === ds.length && provisionalOk) {
      d3Raw = 3;
    } else if (withApprover === ds.length && withRationale >= ds.length / 2) {
      d3Raw = 2;
    } else if (withApprover > 0) {
      d3Raw = 1;
    } else {
      d3Raw = 0;
    }
  }

  // D10 Evaluation (Outcome Quality, weight 12)
  const actionsCount = (record.actions || []).length;
  const produced = ds.length + actionsCount;
  const closed = Boolean((record.meeting?.outcome_one_line || '').trim());
  const followUp = Boolean((record.follow_up_email?.body || '').trim());
  const d10Basis = [
    `${ds.length} decisions and ${actionsCount} actions exist now and did not before.`,
    closed ? 'The meeting outcome was stated in one line.' : 'No stated outcome was recorded at the close.',
    followUp ? 'A follow up was drafted.' : 'No follow up was drafted.',
    'The follow up timing component is excluded: Concludo cannot observe whether the send happened.',
  ];

  let d10Raw = 1;
  if (produced === 0) d10Raw = 0;
  else if (closed && followUp && produced > 0) d10Raw = 3;
  else if (produced > 0 && (closed || followUp)) d10Raw = 2;

  return {
    audits,
    average_quality_score: averageScore,
    dimension_evaluations: {
      D3: { raw: d3Raw, basis: d3Basis },
      D10: { raw: d10Raw, basis: d10Basis },
    },
  };
}
