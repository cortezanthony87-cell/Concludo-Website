/**
 * Tasklet 3.7: Cross-Record Pattern Matching (Channel INS-G)
 * 
 * Identify recurring patterns, velocity trends, and persistent gaps across meeting records.
 * Rule: Corpus gated as a truthfulness control.
 * 0 to 4 records: channel disabled and hidden.
 * 5 to 19 records: exact match patterns only.
 * 20 to 39 records: adds recurrence with explicit counts.
 * 40+ records: full channel.
 * Rule: Every finding must name supporting prior record IDs.
 * Rule: Strict workspace / organisation boundary. No cross-organisation comparison.
 * Render: observation. Cap: 3. Tier: T3.
 */

export class InsufficientCorpusError extends Error {
  constructor(recordCount) {
    super(`Channel INS-G disabled: workspace corpus has ${recordCount} records (minimum 5 required)`);
    this.name = 'InsufficientCorpusError';
    this.code = 'INSUFFICIENT_CORPUS';
    this.recordCount = recordCount;
  }
}

export const INS_G_CHANNEL = {
  id: 'INS-G',
  question: 'What patterns exist in prior work?',
  detector: 'cross record pattern matching',
  tier: 'T3',
  cap: 3,
  render: 'observation',
  corpus_gated: true
};

export function matchCrossRecordPatterns(currentMeeting, priorMeetings = [], options = {}) {
  // Cross-organisation check (strict tenant boundary must fail-closed first)
  const currentOrg = currentMeeting.organisation_id || currentMeeting.workspace_id;
  for (const pm of priorMeetings) {
    const pmOrg = pm.organisation_id || pm.workspace_id;
    if (currentOrg && pmOrg && currentOrg !== pmOrg) {
      throw new Error('Cross-organisation pattern matching prohibited: tenant isolation breach');
    }
  }

  const totalCorpus = priorMeetings.length + (currentMeeting ? 1 : 0);

  // 0 to 4 records: channel disabled and hidden
  if (totalCorpus < 5) {
    if (options.strictThrow) {
      throw new InsufficientCorpusError(totalCorpus);
    }
    return {
      channel_id: INS_G_CHANNEL.id,
      enabled: false,
      reason: `Corpus threshold not met (${totalCorpus}/5 records). Channel dormant.`,
      findings: []
    };
  }

  const findings = [];

  // Match recurring action topics or unclosed items across prior meetings
  const currentTopics = (currentMeeting.actions || []).map(a => (a.title || a.what || '').toLowerCase());

  for (const topic of currentTopics) {
    if (!topic || topic.length < 5) continue;

    const matchingPrior = priorMeetings.filter(pm => {
      const pmActions = pm.actions || [];
      return pmActions.some(pa => (pa.title || pa.what || '').toLowerCase().includes(topic));
    });

    if (matchingPrior.length > 0) {
      const priorIds = matchingPrior.map(pm => pm.id || pm.meeting_id);
      const recurrenceCount = matchingPrior.length + 1;

      let observationText = '';
      if (totalCorpus >= 20) {
        observationText = `Recurring discussion item identified: "${topic}" has been scheduled across ${recurrenceCount} meetings (prior meeting records: ${priorIds.join(', ')}).`;
      } else {
        observationText = `Exact match pattern identified: "${topic}" matches prior meeting records: ${priorIds.join(', ')}.`;
      }

      findings.push({
        channel_id: INS_G_CHANNEL.id,
        pattern_title: `Recurring Commitment: ${topic.slice(0, 50)}`,
        comparison_basis: `Supporting prior record IDs: ${priorIds.join(', ')}`,
        prior_record_ids: priorIds,
        recurrence_count: recurrenceCount,
        observation_text: observationText,
        render_type: INS_G_CHANNEL.render,
        created_at: new Date().toISOString()
      });
    }

    if (findings.length >= INS_G_CHANNEL.cap) break;
  }

  return {
    channel_id: INS_G_CHANNEL.id,
    enabled: true,
    corpus_tier: totalCorpus >= 40 ? '40+' : (totalCorpus >= 20 ? '20-39' : '5-19'),
    findings: findings.slice(0, INS_G_CHANNEL.cap)
  };
}
