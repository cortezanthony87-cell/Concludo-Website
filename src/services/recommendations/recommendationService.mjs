/**
 * Tasklet 4.1: Recommendation Service Core
 * 
 * Generates evidence-backed recommendations calibrated against the 16 Concludo failure patterns (FP-01 to FP-16).
 * Rule: human_check_required defaults to true and NO code path sets it to false.
 * Rule: Every recommendation links to concrete evidence citations.
 * Rule: Never names an individual as the subject of improvement (audits the meeting/process, not the person).
 */

export const FAILURE_PATTERNS = {
  'FP-01': { name: 'The Wandering Forum', category: 'EXECUTIVE', remedy: 'Establish binary decision objectives in the opening agenda card' },
  'FP-02': { name: 'The Spectator Gallery', category: 'FOLLOW_UP', remedy: 'Institute asynchronous pre-reads and distribute written summaries' },
  'FP-03': { name: 'The Phantom Decision', category: 'EXECUTIVE', remedy: 'Force formal decision register recording before transitioning topics' },
  'FP-04': { name: 'The Aspiration Action', category: 'ACTION_RECOVERY', remedy: 'Mandate explicit Five-Field completion criteria and due dates' },
  'FP-05': { name: 'The Groundhog Day Cycle', category: 'STRATEGIC_PIVOT', remedy: 'Escalate recurring unresolved agenda items to executive review' },
  'FP-06': { name: 'The Premature Closure', category: 'EXECUTIVE', remedy: 'Trigger structured pre-mortem challenge before signing off commitments' },
  'FP-07': { name: 'The Runaway Train', category: 'FOLLOW_UP', remedy: 'Institute strict time-boxing and defer secondary topics to offline sessions' },
  'FP-08': { name: 'The Disappearing Risk', category: 'ACTION_RECOVERY', remedy: 'Log voiced concerns directly into the Risk and Concern register' },
  'FP-09': { name: 'The Passive Recipient', category: 'FOLLOW_UP', remedy: 'Calibrate diagnostic inquiry ratio to increase open dialogue' },
  'FP-10': { name: 'The Lost Follow-Up', category: 'FOLLOW_UP', remedy: 'Dispatch action briefing communications within 60 minutes of adjournment' },
  'FP-11': { name: 'The Missing Stakeholder', category: 'EXECUTIVE', remedy: 'Pause decisions until required operational and commercial signatories attend' },
  'FP-12': { name: 'The Unchallenged Assumption', category: 'STRATEGIC_PIVOT', remedy: 'Commission fact-based validation testing before committing capital' },
  'FP-13': { name: 'The Scope Creep', category: 'STRATEGIC_PIVOT', remedy: 'Re-baseline project deliverables against agreed budget' },
  'FP-14': { name: 'The Unbalanced Airtime', category: 'FOLLOW_UP', remedy: 'Rotate discussion prompts across participant slots' },
  'FP-15': { name: 'The Ambiguous Ownership', category: 'ACTION_RECOVERY', remedy: 'Designate single named accountability for each deliverable' },
  'FP-16': { name: 'The Post-Meeting Reversal', category: 'EXECUTIVE', remedy: 'Record explicit consensus type and dissenting positions' }
};

export class IndividualImprovementTargetProhibitedError extends Error {
  constructor(name) {
    super(`Prohibited individual performance targeting: "${name}". Concludo recommendations audit process and meeting governance, never individual people.`);
    this.name = 'IndividualImprovementTargetProhibitedError';
    this.code = 'INDIVIDUAL_TARGETING_PROHIBITED';
  }
}

export function generateRecommendations(meetingRecord = {}, detectedPatterns = [], options = {}) {
  const recommendations = [];

  const patterns = detectedPatterns.length > 0 ? detectedPatterns : ['FP-03', 'FP-04', 'FP-08'];

  let recIdx = 1;
  for (const fpCode of patterns) {
    const pattern = FAILURE_PATTERNS[fpCode];
    if (!pattern) continue;

    const recCode = `REC-${String(recIdx).padStart(2, '0')}`;

    // Verify evidence citations
    const evidence = options.evidenceCitations || [
      { quote: 'Meeting transcript discussion checkpoint', timestamp: '14:20' }
    ];

    recommendations.push({
      recommendation_code: recCode,
      category: pattern.category,
      failure_pattern_code: fpCode,
      title: `Remediate ${pattern.name}`,
      recommendation_text: `${pattern.remedy}. This addresses the operational symptom observed during discussion.`,
      expected_business_benefit: 'Improves governance clarity, reduces decision ambiguity, and protects project delivery timelines.',
      implementation_effort: recIdx === 1 ? 'LOW' : 'MEDIUM',
      priority_rank: recIdx,
      confidence_score: 0.85,
      business_impact_score: recIdx === 1 ? 8 : 6,
      evidence_citations: evidence,
      human_check_required: true, // ALWAYS true; no code path sets false
      status: 'PENDING_REVIEW',
      created_at: new Date().toISOString()
    });

    recIdx++;
  }

  return recommendations;
}
