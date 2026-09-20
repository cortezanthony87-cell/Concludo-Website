/**
 * Tasklet 2.3: Participation Quality Analysis
 *
 * Measures anonymous floor concentration, contributor ratio, and floor balance,
 * evaluating Participation Quality (Dimension D6) and Attendance Value (Dimension D2).
 *
 * Strictly prohibits per-individual scoring.
 * There is no speaker name column, no talk time column, and no per-speaker metric.
 */

export class IndividualScoringProhibitedError extends Error {
  constructor(message = 'Individual scoring, rankings, and per-speaker metrics are strictly prohibited.') {
    super(message);
    this.name = 'IndividualScoringProhibitedError';
    this.code = 'INDIVIDUAL_SCORING_PROHIBITED';
  }
}

/**
 * Calculates Gini coefficient / distribution index across anonymous slot values.
 * @param {number[]} shares
 * @returns {number} 0.0000 (perfect equality) to 1.0000 (total concentration)
 */
function calculateGini(shares) {
  if (!shares.length) return 0;
  const sorted = [...shares].sort((a, b) => a - b);
  const n = sorted.length;
  let sumDiffs = 0;
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += sorted[i];
    for (let j = 0; j < n; j++) {
      sumDiffs += Math.abs(sorted[i] - sorted[j]);
    }
  }
  if (total === 0) return 0;
  return Number((sumDiffs / (2 * n * total)).toFixed(4));
}

/**
 * Analyzes meeting participation anonymously.
 *
 * @param {object} record MeetingRecord 1.1 or meeting object
 * @param {object} [options]
 * @param {number[]} [options.anonymousSlotShares] Optional array of word/time shares across anonymous slots
 * @returns {{
 *   participant_count: number,
 *   contributor_count: number,
 *   distribution_index: number,
 *   top_share_percentage: number,
 *   questions_asked_count: number,
 *   dissent_captured: boolean,
 *   individual_scores: null,
 *   dimension_evaluations: {
 *     D2: { raw: number | null, basis: string[] },
 *     D6: { raw: number | null, basis: string[] }
 *   }
 * }}
 */
export function analyzeParticipation(record, options = {}) {
  if (options.individualSpeakerMetricsRequested || options.perSpeakerRankingsRequested) {
    throw new IndividualScoringProhibitedError();
  }

  const participants = record.meeting?.participants || [];
  const participantCount = participants.length;

  const distinctContributors = new Set();
  for (const a of record.actions || []) {
    if (a.owner?.status === 'stated' && a.owner?.name) distinctContributors.add(a.owner.name);
  }
  for (const d of record.decisions || []) {
    if (d.approver?.status === 'stated' && d.approver?.name) distinctContributors.add(d.approver.name);
  }
  for (const q of record.open_questions || []) {
    if (q.expected_resolver?.status === 'stated' && q.expected_resolver?.name) distinctContributors.add(q.expected_resolver.name);
  }
  for (const r of record.risks || []) {
    if (r.owner?.status === 'stated' && r.owner?.name) distinctContributors.add(r.owner.name);
  }
  for (const o of record.opportunities || []) {
    if (o.stated_by?.status === 'stated' && o.stated_by?.name) distinctContributors.add(o.stated_by.name);
  }

  const contributorCount = distinctContributors.size;
  const questionsCount = (record.open_questions || []).length;
  const dissentCaptured = (record.decisions || []).some((d) => Array.isArray(d.dissent) && d.dissent.length > 0);

  // Compute anonymous distribution metrics across slots (without attaching speaker identity)
  const slotShares = options.anonymousSlotShares || (participantCount > 0 ? Array(participantCount).fill(1) : []);
  const totalShares = slotShares.reduce((s, v) => s + v, 0) || 1;
  const normalizedShares = slotShares.map((v) => (v / totalShares) * 100);
  const topShare = normalizedShares.length ? Math.max(...normalizedShares) : 0;
  const distributionIndex = calculateGini(slotShares);

  // D2 Evaluation (Attendance Value, weight 8)
  let d2Raw = null;
  const d2Basis = [];
  if (participantCount === 0) {
    d2Basis.push('No participants recorded.');
  } else {
    const ratio = contributorCount / participantCount;
    d2Basis.push(`${contributorCount} of ${participantCount} participants appear as an owner, approver, resolver or proponent.`);
    if (ratio >= 0.9) d2Raw = 3;
    else if (ratio >= 0.7) d2Raw = 2;
    else if (ratio >= 0.4) d2Raw = 1;
    else d2Raw = 0;
  }

  // D6 Evaluation (Participation Quality, weight 8)
  let d6Raw = 0;
  const d6Basis = [
    `${contributorCount} distinct participants contributed something durable.`,
    `${questionsCount} open questions were carried out of the meeting.`,
    dissentCaptured ? 'At least one dissent or challenge was captured.' : 'No dissent or challenge was captured.',
  ];
  if (contributorCount >= 3 && dissentCaptured) d6Raw = 3;
  else if (contributorCount >= 3) d6Raw = 2;
  else if (contributorCount === 2) d6Raw = 1;
  else d6Raw = 0;

  return {
    participant_count: participantCount,
    contributor_count: contributorCount,
    distribution_index: distributionIndex,
    top_share_percentage: Number(topShare.toFixed(2)),
    questions_asked_count: questionsCount,
    dissent_captured: dissentCaptured,
    individual_scores: null, // Strictly null, verified by schema and CI
    dimension_evaluations: {
      D2: { raw: d2Raw, basis: d2Basis },
      D6: { raw: d6Raw, basis: d6Basis },
    },
  };
}
