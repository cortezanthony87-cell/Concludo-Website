/**
 * Tasklet 3.5: Risk Archetype Absence (Channel INS-C)
 * 
 * Detect standard risk categories typical of the meeting archetype that were not discussed.
 * Rule: Renders strictly as a question, never an assertion.
 * Render: question. Cap: 3. Tier: T3.
 */

export const INS_C_CHANNEL = {
  id: 'INS-C',
  question: 'What risks were not discussed?',
  detector: 'risk archetype absence',
  tier: 'T3',
  cap: 3,
  render: 'question'
};

const STANDARD_RISK_ARCHETYPES = [
  {
    archetype: 'Key Person Dependency',
    question: 'Key person dependency was not discussed. Where the plan rests on one person\'s capacity or relationships, is this an unhedged operational exposure?',
    rationale: 'High execution concentration without cross-training exposes milestones to single-point delays.'
  },
  {
    archetype: 'Regulatory and Compliance Shift',
    question: 'Regulatory and statutory compliance requirements were not raised during the discussion. Are there pending jurisdictional changes that could impact this deployment?',
    rationale: 'Statutory changes in operating markets can render technical architectures obsolete if not monitored.'
  },
  {
    archetype: 'Liquidity and Cash Flow Timing',
    question: 'Working capital and timing differences were not addressed. Will the milestone commitments require upfront commitments that precede revenue realisation?',
    rationale: 'Capital timing mismatches frequently bottleneck project expansion.'
  },
  {
    archetype: 'Delivery and Vendor Bottlenecks',
    question: 'Third-party delivery risks were not examined. What mitigation exists if critical sub-suppliers or software vendors fail to deliver within agreed service levels?',
    rationale: 'External vendor delays directly cascade into internal delivery deadlines.'
  }
];

export function detectRiskArchetypeAbsences(meetingRecord = {}, options = {}) {
  const discussedRisks = (meetingRecord.risks || []).map(r => (r.title || r.risk_statement || '').toLowerCase());
  const transcriptText = (meetingRecord.transcript || '').toLowerCase();

  const findings = [];

  for (const riskItem of STANDARD_RISK_ARCHETYPES) {
    const archLower = riskItem.archetype.toLowerCase();
    const isRaised = discussedRisks.some(r => r.includes(archLower)) || transcriptText.includes(archLower);

    if (!isRaised) {
      // Must render strictly as a question ending with ?
      const questionText = riskItem.question.trim().endsWith('?') ? riskItem.question.trim() : `${riskItem.question.trim()}?`;

      findings.push({
        channel_id: INS_C_CHANNEL.id,
        risk_archetype: riskItem.archetype,
        comparison_basis: `Standard meeting archetype risk profile: ${riskItem.archetype}`,
        question_text: questionText,
        context_rationale: riskItem.rationale,
        render_type: INS_C_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }

    if (findings.length >= INS_C_CHANNEL.cap) break;
  }

  return findings.slice(0, INS_C_CHANNEL.cap);
}
