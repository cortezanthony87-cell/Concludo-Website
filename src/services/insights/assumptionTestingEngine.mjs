/**
 * Tasklet 3.4: Assumption Classification and Testing (Channel INS-B)
 * 
 * Classify and test fragile, unvalidated, or speculative assumptions underpinning decisions.
 * Rule: Never states an assumption is wrong; states unevidenced, load bearing, and what would test it.
 * Rule: The observation is about the assumption, never about the person who voiced it.
 * Render: observation. Cap: 4. Tier: T3.
 */

export const INS_B_CHANNEL = {
  id: 'INS-B',
  question: 'Which assumptions are weak?',
  detector: 'assumption classification and testing',
  tier: 'T3',
  cap: 4,
  render: 'observation'
};

const HEDGING_MARKERS = [
  { phrase: 'presumably', level: 'CRITICAL', test: 'Confirm factual baseline with current operational data' },
  { phrase: 'we believe', level: 'SIGNIFICANT', test: 'Validate customer or market sentiment through primary research' },
  { phrase: 'probably have enough', level: 'CRITICAL', test: 'Reconcile project scope against allocated budget and resources' },
  { phrase: 'assuming that', level: 'SIGNIFICANT', test: 'Stress-test dependency timeline against historical delivery velocity' },
  { phrase: 'should not be an issue', level: 'MONITOR', test: 'Verify regulatory and compliance parameters prior to launch' },
  { phrase: 'we expect', level: 'MONITOR', test: 'Establish quantitative tracking against stated milestones' }
];

export function testMeetingAssumptions(transcriptStatements = [], options = {}) {
  const findings = [];

  for (let i = 0; i < transcriptStatements.length; i++) {
    const item = transcriptStatements[i];
    const text = (item.text || item.statement || '').toLowerCase();

    for (const marker of HEDGING_MARKERS) {
      if (text.includes(marker.phrase)) {
        // Enforce anonymous speaker slots (never names or individual tracking)
        const anonymousSlot = item.speaker_slot || `Participant Slot ${(i % 3) + 1}`;

        findings.push({
          channel_id: INS_B_CHANNEL.id,
          assumption_statement: item.statement || item.text,
          speaker_slot: anonymousSlot,
          vulnerability_level: marker.level,
          comparison_basis: `Epistemic hedging analysis: "${marker.phrase}" indicates unvalidated operational premise`,
          validation_requirement: marker.test,
          evidence_quote: item.quote || item.text,
          timestamp_offset: item.timestamp || '00:00',
          observation_text: `An operational premise was voiced using speculative phrasing ("${marker.phrase}"). This assumption is load-bearing for execution but lacks stated documentary verification. Recommended validation test: ${marker.test}.`,
          render_type: INS_B_CHANNEL.render,
          created_at: new Date().toISOString()
        });
        break; // one finding per statement
      }
    }

    if (findings.length >= INS_B_CHANNEL.cap) break;
  }

  return findings.slice(0, INS_B_CHANNEL.cap);
}
