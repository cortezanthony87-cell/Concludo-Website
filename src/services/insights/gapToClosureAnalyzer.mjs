/**
 * Tasklet 3.3: Gap to Closure Analysis (Channel INS-F)
 * 
 * Analyse incomplete decision paths and unassigned commitments to identify required next steps.
 * Rule: Evaluates decision and action items against closure criteria (owner, deadline, next review).
 * Render: observation. Cap: 3.
 */

export class ClosureAnalysisIncompleteError extends Error {
  constructor(message = 'Meeting record contains no extracted actions or decisions for closure analysis') {
    super(message);
    this.name = 'ClosureAnalysisIncompleteError';
    this.code = 'CLOSURE_ANALYSIS_INCOMPLETE';
  }
}

export const INS_F_CHANNEL = {
  id: 'INS-F',
  question: 'What should happen next?',
  detector: 'gap to closure analysis',
  tier: 'T2',
  cap: 3,
  render: 'observation'
};

export function analyzeGapsToClosure(meetingRecord = {}) {
  const actions = meetingRecord.actions || [];
  const decisions = meetingRecord.decisions || [];

  if (actions.length === 0 && decisions.length === 0) {
    throw new ClosureAnalysisIncompleteError();
  }

  const findings = [];

  // 1. Audit decisions for review dates and communication plans
  for (const dec of decisions) {
    const hasReview = dec.review_date || (dec.rationale && dec.rationale.toLowerCase().includes('review'));
    const hasOwner = dec.decision_owner || dec.owner;

    if (!hasReview) {
      findings.push({
        channel_id: INS_F_CHANNEL.id,
        gap_title: `Unscheduled Review for Decision "${dec.title || 'Agreed Position'}"`,
        comparison_basis: 'Corporate governance standard: formal decisions require an explicit review milestone',
        observation_text: `Decision "${dec.title || 'Agreed Position'}" lacks a scheduled review date or milestone check. Suggested next step: appoint a review checkpoint within 30 to 60 days.`,
        suggested_closure_action: 'Schedule formal review checkpoint in workspace calendar',
        render_type: INS_F_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }

    if (findings.length >= INS_F_CHANNEL.cap) break;
  }

  // 2. Audit actions for missing Five-Field elements (escalation path, definition of done)
  for (const act of actions) {
    if (findings.length >= INS_F_CHANNEL.cap) break;

    const hasDone = act.definition_of_done || act.completion_criterion;
    const hasEscalation = act.escalation_path;

    if (!hasDone) {
      findings.push({
        channel_id: INS_F_CHANNEL.id,
        gap_title: `Missing Definition of Done on Action "${act.title || act.what || 'Task'}"`,
        comparison_basis: 'Five-field delegation standard: every delegated action requires an unambiguous completion test',
        observation_text: `Action "${act.title || act.what || 'Task'}" specifies an assignee and timeframe, but does not define an objective test for completion. Suggested next step: agree the tangible artifact or verification test.`,
        suggested_closure_action: 'Define verifiable completion artifact with action owner',
        render_type: INS_F_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    } else if (!hasEscalation) {
      findings.push({
        channel_id: INS_F_CHANNEL.id,
        gap_title: `Unspecified Escalation Path on Action "${act.title || act.what || 'Task'}"`,
        comparison_basis: 'Delegation governance standard: execution blockers require a pre-agreed escalation path',
        observation_text: `Action "${act.title || act.what || 'Task'}" lacks a nominated escalation point if deadlines slip. Suggested next step: confirm the escalation principal.`,
        suggested_closure_action: 'Confirm escalation contact in project register',
        render_type: INS_F_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }
  }

  return findings.slice(0, INS_F_CHANNEL.cap);
}
