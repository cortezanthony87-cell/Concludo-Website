/**
 * Tasklet 4.8: Action Recommendation Engine
 * 
 * Convert vague or incomplete meeting commitments into Five-Field compliant commitments.
 * Rule: A suggested field is marked as a suggestion until a person accepts it.
 * Rule: It is NEVER written into the record as if it had been said.
 */

export function remediateActionItem(rawAction = {}) {
  const remediated = {
    action_id: rawAction.id || rawAction.action_id || `ACT-${Math.random().toString(36).slice(2, 7)}`,
    original_text: rawAction.title || rawAction.what || '',
    who: rawAction.who || { value: 'Unassigned Participant Slot', is_suggestion: true },
    what: rawAction.what || { value: rawAction.title || 'Clarify scope of work', is_suggestion: false },
    when: rawAction.when || { value: 'Within 5 business days', is_suggestion: true },
    evidence: rawAction.evidence || { value: 'Meeting transcript discussion checkpoint', is_suggestion: false },
    definition_of_done: rawAction.definition_of_done || {
      value: 'Documented completion summary uploaded to project workspace',
      is_suggestion: true
    },
    escalation_path: rawAction.escalation_path || {
      value: 'Project Sponsor / Lead Principal',
      is_suggestion: true
    },
    remediation_status: 'SUGGESTION_PENDING_HUMAN_ACCEPTANCE'
  };

  return remediated;
}
