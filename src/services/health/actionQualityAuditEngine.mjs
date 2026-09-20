/**
 * Tasklet 2.5: Action Quality Analysis
 *
 * Audits all meeting commitments against the Concludo Five-Field Delegation Standard
 * and clarity of stated objectives, evaluating Action Quality (Dimension D4)
 * and Purpose Clarity (Dimension D1).
 *
 * Audits actions, not owners. No per-owner aggregation is computed.
 */

/**
 * Audits an action against the Five-Field Delegation Standard:
 * 1. Single owner
 * 2. Verifiable deadline
 * 3. Completion criterion (definition of done)
 * 4. Escalation path
 * 5. Authority / confirmation method allocated
 *
 * @param {object} action
 * @returns {{
 *   action_id: string,
 *   action_description: string,
 *   has_single_owner: boolean,
 *   has_verifiable_deadline: boolean,
 *   has_completion_criterion: boolean,
 *   has_escalation_path: boolean,
 *   has_authority_allocated: boolean,
 *   compliance_percentage: number,
 *   audit_status: 'FULLY_COMPLIANT' | 'PARTIAL' | 'DEFECTIVE'
 * }}
 */
export function auditActionDelegation(action) {
  const hasOwner = Boolean(action.owner?.status === 'stated' && action.owner?.name);
  const hasDeadline = Boolean(action.due_date && String(action.due_date).trim().length > 0);
  const hasDod = Boolean(action.definition_of_done && String(action.definition_of_done).trim().length > 0);
  const hasEscalation = Boolean(action.escalation_path || action.escalate_to || action.escalation_trigger);
  const hasAuthority = Boolean(
    action.confirmation_method ||
    action.authority_allocated ||
    action.budget_allocated ||
    action.owner_confirmed_in_meeting
  );

  const fieldsPresent = [hasOwner, hasDeadline, hasDod, hasEscalation, hasAuthority].filter(Boolean).length;
  const compliancePercentage = fieldsPresent * 20;

  let auditStatus = 'PARTIAL';
  if (compliancePercentage === 100) auditStatus = 'FULLY_COMPLIANT';
  else if (compliancePercentage <= 20) auditStatus = 'DEFECTIVE';

  return {
    action_id: action.id || 'ACT-UNKNOWN',
    action_description: action.action || action.description || '',
    has_single_owner: hasOwner,
    has_verifiable_deadline: hasDeadline,
    has_completion_criterion: hasDod,
    has_escalation_path: hasEscalation,
    has_authority_allocated: hasAuthority,
    compliance_percentage: compliancePercentage,
    audit_status: auditStatus,
  };
}

/**
 * Audits all actions in a meeting record and evaluates D1 & D4.
 * @param {object} record MeetingRecord 1.1
 * @returns {{
 *   audits: Array<ReturnType<typeof auditActionDelegation>>,
 *   fully_compliant_count: number,
 *   dimension_evaluations: {
 *     D1: { raw: number | null, basis: string[] },
 *     D4: { raw: number | null, basis: string[] }
 *   }
 * }}
 */
export function auditMeetingActions(record) {
  const actions = record.actions || [];
  const audits = actions.map((a) => auditActionDelegation(a));
  const fullyCompliant = audits.filter((a) => a.audit_status === 'FULLY_COMPLIANT').length;

  // D1 Evaluation (Purpose Clarity, weight 12)
  const p = (record.meeting?.purpose || '').trim();
  const DECISION_WORDS = /\b(decide|decision|approve|approval|choose|sign off|agree on|select)\b/i;
  const OUTPUT_WORDS = /\b(produce|output|deliver|draft|agree|plan|list|register|paper|recommendation)\b/i;

  let d1Raw = 0;
  let d1Basis = [];
  if (!p) {
    d1Raw = 0;
    d1Basis.push('meeting.purpose is empty. The meeting began with a topic.');
  } else {
    const hasDecision = DECISION_WORDS.test(p);
    const hasOutput = OUTPUT_WORDS.test(p);
    const oneSentence = p.split(/[.!?]/).filter((s) => s.trim()).length === 1;

    if (!hasDecision && !hasOutput) {
      d1Raw = 1;
      d1Basis.push(`Purpose names a topic only: "${p}"`);
    } else if (!(hasDecision && hasOutput) || !oneSentence) {
      d1Raw = 2;
      d1Basis.push(`Purpose stated but ${hasDecision ? 'the required output' : 'the decision to be made'} is left implicit.`);
    } else {
      d1Raw = 3;
      d1Basis.push(`One sentence purpose naming the decision and the output: "${p}"`);
    }
  }

  // D4 Evaluation (Action Quality, weight 15)
  let d4Raw = 0;
  let d4Basis = [];
  if (actions.length === 0) {
    d4Raw = 0;
    d4Basis.push('No actions were recorded.');
  } else {
    const five = actions.filter((a) => a.owner?.status === 'stated' && a.due_date && a.definition_of_done && a.confirmation_method).length;
    const confirmed = actions.filter((a) => a.owner_confirmed_in_meeting === true).length;
    const owned = actions.filter((a) => a.owner?.status === 'stated').length;
    const dated = actions.filter((a) => a.due_date).length;

    d4Basis = [
      `${owned} of ${actions.length} actions have a single named owner.`,
      `${dated} of ${actions.length} carry a date.`,
      `${five} of ${actions.length} carry all five fields of the Delegation Standard.`,
      `${confirmed} of ${actions.length} were confirmed aloud by the named owner.`,
    ];

    if (five === actions.length && confirmed === actions.length) {
      d4Raw = 3;
    } else if (owned / actions.length >= 0.8 && dated / actions.length >= 0.8) {
      d4Raw = 2;
    } else if (owned > 0) {
      d4Raw = 1;
    } else {
      d4Raw = 0;
    }
  }

  return {
    audits,
    fully_compliant_count: fullyCompliant,
    dimension_evaluations: {
      D1: { raw: d1Raw, basis: d1Basis },
      D4: { raw: d4Raw, basis: d4Basis },
    },
  };
}
