/**
 * Tasklet 3.1: Expected Element Absence (Channel INS-A)
 * 
 * Detects expected meeting elements and participant roles that were absent or unaddressed.
 * Rule: Every finding names its comparison basis. No basis, no finding.
 * Render: observation. Cap: 5.
 */

export class NoComparisonBasisError extends Error {
  constructor(message = 'Finding rejected: no comparison basis specified') {
    super(message);
    this.name = 'NoComparisonBasisError';
    this.code = 'NO_COMPARISON_BASIS';
  }
}

export const INS_A_CHANNEL = {
  id: 'INS-A',
  question: 'What did participants miss?',
  detector: 'expected element absence',
  tier: 'T2',
  cap: 5,
  render: 'observation'
};

export function detectExpectedElementAbsences(meetingRecord, options = {}) {
  const expectedTemplates = options.expectedElements || [
    { name: 'Purpose and Objectives', category: 'AGENDA_ITEM', comparison_basis: 'Standard opening requirement for decision meetings' },
    { name: 'Financial Authority Sign-off', category: 'ROLE_COVERAGE', comparison_basis: 'Commercial decision archetype role requirement' },
    { name: 'Implementation Timeline', category: 'DECISION_PREREQUISITE', comparison_basis: 'Action delegation completion standard' },
    { name: 'Risk Assessment Review', category: 'AGENDA_ITEM', comparison_basis: 'Strategic alignment governance checklist' },
    { name: 'Stakeholder Impact Assessment', category: 'ROLE_COVERAGE', comparison_basis: 'Cross-functional dependency standard' },
    { name: 'Review Date and Escalation Path', category: 'DECISION_PREREQUISITE', comparison_basis: 'Five-field action delegation governance standard' }
  ];

  const coveredTopics = new Set();
  const transcriptText = (meetingRecord.transcript || '').toLowerCase();
  const agendaTopics = (meetingRecord.agenda || []).map(a => (typeof a === 'string' ? a : a.title || '').toLowerCase());

  for (const topic of agendaTopics) coveredTopics.add(topic);

  // Check extracted items
  if (meetingRecord.actions && meetingRecord.actions.length > 0) {
    coveredTopics.add('implementation timeline');
  }
  if (meetingRecord.risks && meetingRecord.risks.length > 0) {
    coveredTopics.add('risk assessment review');
  }

  const findings = [];

  for (const tpl of expectedTemplates) {
    if (!tpl.comparison_basis || tpl.comparison_basis.trim() === '') {
      throw new NoComparisonBasisError(`Missing comparison basis for expected element: ${tpl.name}`);
    }

    const tplLower = tpl.name.toLowerCase();
    const isCovered = Array.from(coveredTopics).some(topic => topic.includes(tplLower) || tplLower.includes(topic)) ||
      transcriptText.includes(tplLower);

    if (!isCovered) {
      findings.push({
        channel_id: INS_A_CHANNEL.id,
        element_name: tpl.name,
        element_category: tpl.category,
        comparison_basis: tpl.comparison_basis,
        observation_text: `${tpl.name} was not addressed in the recorded discussion. Basis: ${tpl.comparison_basis}.`,
        render_type: INS_A_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }

    if (findings.length >= INS_A_CHANNEL.cap) break;
  }

  return findings;
}
