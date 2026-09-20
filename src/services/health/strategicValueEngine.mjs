/**
 * Tasklet 2.6: Strategic Alignment Analysis
 *
 * Measures strategic alignment, risks raised, and commercial opportunities
 * surfaced during proceedings, evaluating Strategic Alignment (Dimension D9),
 * Risk Identification (Dimension D7), and Opportunity Identification (Dimension D8).
 *
 * D7 reads from Tasklet 1.10 risk structures.
 * D8 reads from Tasklet 1.11 opportunity structures and has no other source.
 */

const ALIGNMENT_WORDS = /\b(objective|strategy|strategic|plan|priority|priorities|target|goal|mandate|growth|expansion|efficiency)\b/i;

/**
 * Evaluates strategic alignment, risks, and opportunities for a meeting.
 * @param {object} record MeetingRecord 1.1
 * @param {object} [context]
 * @param {Array<{ id: string, name: string, keywords?: string[] }>} [context.strategicPillars]
 * @returns {{
 *   strategic_alignments: Array<{
 *     strategic_pillar_id: string | null,
 *     pillar_name: string,
 *     discussion_time_seconds: number,
 *     strategic_weight: number,
 *     alignment_score: number,
 *     rationale: string
 *   }>,
 *   dimension_evaluations: {
 *     D7: { raw: number | null, basis: string[], unscoreable_reason: string | null },
 *     D8: { raw: number | null, basis: string[], unscoreable_reason: string | null },
 *     D9: { raw: number | null, basis: string[], unscoreable_reason: string | null }
 *   }
 * }}
 */
export function analyzeStrategicValue(record, context = {}) {
  const ds = record.decisions || [];
  const rs = record.risks || [];
  const os = record.opportunities || [];
  const actions = record.actions || [];
  const pillars = context.strategicPillars || [];

  // Compute pillar alignments
  const alignments = [];
  if (pillars.length > 0) {
    for (const pillar of pillars) {
      const keywords = pillar.keywords || [pillar.name.toLowerCase()];
      const matchingDecisions = ds.filter((d) => {
        const text = `${d.statement || ''} ${d.rationale || ''}`.toLowerCase();
        return keywords.some((k) => text.includes(k.toLowerCase()));
      });
      const score = ds.length ? Math.round((matchingDecisions.length / ds.length) * 100) : 50;
      alignments.push({
        strategic_pillar_id: pillar.id || null,
        pillar_name: pillar.name,
        discussion_time_seconds: matchingDecisions.length * 300,
        strategic_weight: 1.0,
        alignment_score: score,
        rationale: `${matchingDecisions.length} of ${ds.length} decisions align to ${pillar.name}.`,
      });
    }
  }

  // D7 Evaluation (Risk Identification, weight 8)
  const material = ds.filter((d) => d.materiality === 'significant' || d.materiality === 'material').length;
  const commitments = material + actions.length;
  let d7Raw = null;
  let d7Basis = [];
  let d7Reason = null;

  if (commitments === 0) {
    d7Raw = null;
    d7Reason = 'the meeting committed to nothing whose failure would matter, so the dimension does not bite';
  } else if (rs.length === 0) {
    d7Raw = 0;
    d7Basis.push(`${commitments} commitments were made and no risk, obstacle or failure mode was raised.`);
  } else {
    const managed = rs.filter((r) => r.owner?.status === 'stated' && r.mitigation && r.escalation_trigger).length;
    const partly = rs.filter((r) => r.owner?.status === 'stated' || r.mitigation).length;
    d7Basis.push(`${rs.length} risks raised. ${managed} carry an owner, a mitigation and an escalation trigger.`);
    if (managed === rs.length) d7Raw = 3;
    else if (partly >= rs.length / 2) d7Raw = 2;
    else d7Raw = 1;
  }

  // D8 Evaluation (Opportunity Identification, weight 6)
  let d8Raw = null;
  let d8Basis = [];
  let d8Reason = null;

  if (context.restricted) {
    d8Raw = null;
    d8Reason = 'restricted path';
  } else if (['MT-B05', 'MT-B06', 'MT-D07'].includes(context.typeDetailed)) {
    d8Raw = null;
    d8Reason = `opportunity identification is not an expectation of ${context.typeDetailed}`;
  } else if (os.length === 0) {
    d8Raw = 0;
    d8Basis.push('No opportunity or forward value consideration was recorded.');
  } else {
    const assessed = os.filter((o) => o.basis_given && (o.effort_stated || o.value_stated)).length;
    const assigned = os.filter((o) => o.next_step_action_id).length;
    d8Basis.push(`${os.length} opportunities stated, ${assessed} with a stated basis and ${assigned} with a next step assigned.`);
    if (assigned === os.length && assessed === os.length) d8Raw = 3;
    else if (assessed > 0) d8Raw = 2;
    else d8Raw = 1;
  }

  // D9 Evaluation (Strategic Alignment, weight 8)
  let d9Raw = 0;
  let d9Basis = [];
  let d9Reason = null;

  if (ds.length === 0) {
    d9Raw = 0;
    d9Basis.push('No decisions, so no alignment to a stated objective could be tested.');
  } else {
    const aligned = ds.filter((d) => d.rationale && ALIGNMENT_WORDS.test(d.rationale)).length;
    const tradeOffs = ds.filter((d) => (d.options_rejected || []).length > 0).length;
    d9Basis.push(`${aligned} of ${ds.length} decisions connect to a stated objective, plan or priority in their rationale.`);
    if (aligned === ds.length && tradeOffs > 0) {
      d9Raw = 3;
      d9Basis.push(`${tradeOffs} record what was traded off.`);
    } else if (aligned >= ds.length / 2) {
      d9Raw = 2;
    } else if (aligned > 0) {
      d9Raw = 1;
    } else {
      d9Raw = 0;
    }
  }

  return {
    strategic_alignments: alignments,
    dimension_evaluations: {
      D7: { raw: d7Raw, basis: d7Basis, unscoreable_reason: d7Reason },
      D8: { raw: d8Raw, basis: d8Basis, unscoreable_reason: d8Reason },
      D9: { raw: d9Raw, basis: d9Basis, unscoreable_reason: d9Reason },
    },
  };
}
