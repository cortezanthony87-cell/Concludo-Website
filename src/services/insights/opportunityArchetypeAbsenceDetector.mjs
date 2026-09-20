/**
 * Tasklet 3.6: Opportunity Archetype Absence (Channel INS-D)
 * 
 * Identify standard strategic opportunity categories for the meeting archetype that were not explored.
 * Rule: Renders strictly as a question, never an assertion.
 * Render: question. Cap: 2. Tier: T3.
 */

export const INS_D_CHANNEL = {
  id: 'INS-D',
  question: 'What opportunities were not discussed?',
  detector: 'opportunity archetype absence',
  tier: 'T3',
  cap: 2,
  render: 'question'
};

const STANDARD_OPPORTUNITY_ARCHETYPES = [
  {
    archetype: 'Commercial Partnership Acceleration',
    question: 'Channel distribution and co-marketing partnerships were not explored. Could an existing ecosystem partner accelerate market access faster than direct customer acquisition?',
    rationale: 'Strategic distribution channels often bypass direct customer acquisition cost friction.'
  },
  {
    archetype: 'Operational Automation Leverage',
    question: 'Workflow automation and modular re-use opportunities were not discussed. Can repetitive reporting or delivery overhead be codified into automated software routines?',
    rationale: 'Systematising repeatable workflows frees high-value leadership capacity.'
  },
  {
    archetype: 'Product Packaging and Tier Bundling',
    question: 'Tiered offering packaging was not reviewed. Would offering a self-serve baseline alongside the tailored engagement capture broader market demand?',
    rationale: 'Packaging options expand customer addressability.'
  }
];

export function detectOpportunityArchetypeAbsences(meetingRecord = {}, options = {}) {
  const discussedOpps = (meetingRecord.opportunities || []).map(o => (o.title || o.opportunity_statement || '').toLowerCase());
  const transcriptText = (meetingRecord.transcript || '').toLowerCase();

  const findings = [];

  for (const oppItem of STANDARD_OPPORTUNITY_ARCHETYPES) {
    const archLower = oppItem.archetype.toLowerCase();
    const isExplored = discussedOpps.some(o => o.includes(archLower)) || transcriptText.includes(archLower);

    if (!isExplored) {
      // Must render strictly as a question ending with ?
      const questionText = oppItem.question.trim().endsWith('?') ? oppItem.question.trim() : `${oppItem.question.trim()}?`;

      findings.push({
        channel_id: INS_D_CHANNEL.id,
        opportunity_archetype: oppItem.archetype,
        comparison_basis: `Commercial planning archetype: ${oppItem.archetype}`,
        question_text: questionText,
        context_rationale: oppItem.rationale,
        render_type: INS_D_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }

    if (findings.length >= INS_D_CHANNEL.cap) break;
  }

  return findings.slice(0, INS_D_CHANNEL.cap);
}
