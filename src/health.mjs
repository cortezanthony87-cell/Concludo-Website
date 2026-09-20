/**
 * E5 Meeting Health. Specification section 7.
 *
 * Fully deterministic over the MeetingRecord. No model call. Every dimension
 * returns its basis so the score is debuggable and the report can quote it.
 *
 * Two rules carry the credibility of the whole feature:
 *   - a dimension the record cannot support is UNSCOREABLE, never zero;
 *   - below a 70 point scoreable weight there is no total at all.
 */
import { registry } from './registry.mjs';

const H = registry.health;
const dimMeta = Object.fromEntries(H.dimensions.map((d) => [d.id, d]));

const named = (p) => Boolean(p && p.status === 'stated' && p.name);
const pct = (n, d) => (d === 0 ? null : Math.round((100 * n) / d));

const DECISION_WORDS = /\b(decide|decision|approve|approval|choose|sign off|agree on|select)\b/i;
const OUTPUT_WORDS = /\b(produce|output|deliver|draft|agree|plan|list|register|paper|recommendation)\b/i;
const ALIGNMENT_WORDS = /\b(objective|strategy|strategic|plan|priority|priorities|target|goal|mandate)\b/i;

/** Distinct people the record shows contributing something durable. */
function contributors(record) {
  const s = new Set();
  for (const a of record.actions) if (named(a.owner)) s.add(a.owner.name);
  for (const d of record.decisions) if (named(d.approver)) s.add(d.approver.name);
  for (const q of record.open_questions) if (named(q.expected_resolver)) s.add(q.expected_resolver.name);
  for (const r of record.risks) if (named(r.owner)) s.add(r.owner.name);
  for (const o of record.opportunities ?? []) if (named(o.stated_by)) s.add(o.stated_by.name);
  return s;
}

function scoreD1(record) {
  const p = (record.meeting.purpose ?? '').trim();
  if (!p) return [0, ['meeting.purpose is empty. The meeting began with a topic.']];
  const hasDecision = DECISION_WORDS.test(p);
  const hasOutput = OUTPUT_WORDS.test(p);
  const oneSentence = p.split(/[.!?]/).filter((s) => s.trim()).length === 1;
  if (!hasDecision && !hasOutput) return [1, [`Purpose names a topic only: "${p}"`]];
  if (!(hasDecision && hasOutput) || !oneSentence) {
    return [2, [`Purpose stated but ${hasDecision ? 'the required output' : 'the decision to be made'} is left implicit.`]];
  }
  return [3, [`One sentence purpose naming the decision and the output: "${p}"`]];
}

function scoreD2(record) {
  const total = record.meeting.participants.length;
  if (total === 0) return [null, ['No participants recorded.'], 'no participants in the record'];
  const c = contributors(record).size;
  const ratio = c / total;
  const basis = [`${c} of ${total} participants appear as an owner, approver, resolver or proponent.`];
  if (ratio >= 0.9) return [3, basis];
  if (ratio >= 0.7) return [2, basis];
  if (ratio >= 0.4) return [1, basis];
  return [0, basis];
}

function scoreD3(record, ctx) {
  const ds = record.decisions;
  const objective = ctx.objective;
  const reAnchor = ['explore', 'learn', 'diagnose'].includes(objective);

  if (reAnchor) {
    const nextIdentified = (record.next_meeting?.decisions_required ?? []).length > 0;
    const assigned = record.open_questions.some((q) => named(q.expected_resolver));
    const basis = [`Objective is ${objective}. Closure is not penalised. Scored on whether the next decision was identified and assigned.`];
    if (nextIdentified && assigned) return [3, basis.concat('The decision to be taken next is named and a resolver is assigned.')];
    if (nextIdentified || assigned) return [2, basis.concat('Partially identified or partially assigned.')];
    return [1, basis.concat('Neither the next decision nor a resolver was named.')];
  }

  if (ds.length === 0) {
    const needed = ['decide', 'negotiate', 'recommend'].includes(objective);
    return [0, [needed
      ? `Objective is ${objective} and no decision was recorded. This is the primary finding, not a low score.`
      : 'No decisions were recorded.']];
  }

  const withApprover = ds.filter((d) => named(d.approver)).length;
  const withRationale = ds.filter((d) => d.rationale && d.rationale.trim()).length;
  const withRejected = ds.filter((d) => (d.options_rejected ?? []).length > 0).length;
  const provisionalOk = ds.every((d) => !d.conditions || d.review_date);
  const basis = [
    `${withApprover} of ${ds.length} decisions name an approver.`,
    `${withRationale} of ${ds.length} record a rationale.`,
    `${withRejected} of ${ds.length} record the options rejected.`,
  ];
  if (withApprover === ds.length && withRationale === ds.length && withRejected === ds.length && provisionalOk) return [3, basis];
  if (withApprover === ds.length && withRationale >= ds.length / 2) return [2, basis];
  if (withApprover > 0) return [1, basis];
  return [0, basis];
}

function scoreD4(record) {
  const as = record.actions;
  if (as.length === 0) return [0, ['No actions were recorded.']];
  const five = as.filter((a) => named(a.owner) && a.due_date && a.definition_of_done && a.confirmation_method).length;
  const confirmed = as.filter((a) => a.owner_confirmed_in_meeting === true).length;
  const owned = as.filter((a) => named(a.owner)).length;
  const dated = as.filter((a) => a.due_date).length;
  const basis = [
    `${owned} of ${as.length} actions have a single named owner.`,
    `${dated} of ${as.length} carry a date.`,
    `${five} of ${as.length} carry all five fields of the Delegation Standard.`,
    `${confirmed} of ${as.length} were confirmed aloud by the named owner.`,
  ];
  if (five === as.length && confirmed === as.length) return [3, basis];
  if (owned / as.length >= 0.8 && dated / as.length >= 0.8) return [2, basis];
  if (owned > 0) return [1, basis];
  return [0, basis];
}

function scoreD5(record) {
  const m = record.meeting;
  if (m.duration_minutes == null && !m.start_time) {
    return [null, [], 'duration unknown and the record is not time stamped'];
  }
  const topics = record.topics;
  if (topics.length === 0) return [0, ['No topic structure is visible in the record.']];
  const parked = topics.filter((t) => t.status === 'parked').length;
  const ratio = parked / topics.length;
  const closed = topics.filter((t) => t.status === 'decided').length;
  const basis = [`${closed} of ${topics.length} topics closed, ${parked} parked.`];
  if (ratio === 0 && closed > 0) return [3, basis];
  if (ratio <= 0.2) return [2, basis];
  if (ratio <= 0.4) return [1, basis];
  return [0, basis];
}

function scoreD6(record) {
  const c = contributors(record).size;
  const dissentRecorded = record.decisions.some((d) => Array.isArray(d.dissent) && d.dissent.length > 0);
  const questions = record.open_questions.length;
  const basis = [
    `${c} distinct participants contributed something durable.`,
    `${questions} open questions were carried out of the meeting.`,
    dissentRecorded ? 'At least one dissent or challenge was captured.' : 'No dissent or challenge was captured.',
  ];
  if (c >= 3 && dissentRecorded) return [3, basis];
  if (c >= 3) return [2, basis];
  if (c === 2) return [1, basis];
  return [0, basis];
}

function scoreD7(record) {
  const material = record.decisions.filter((d) => d.materiality === 'significant' || d.materiality === 'material').length;
  const commitments = material + record.actions.length;
  if (commitments === 0) {
    return [null, [], 'the meeting committed to nothing whose failure would matter, so the dimension does not bite'];
  }
  const rs = record.risks;
  if (rs.length === 0) return [0, [`${commitments} commitments were made and no risk, obstacle or failure mode was raised.`]];
  const managed = rs.filter((r) => named(r.owner) && r.mitigation && r.escalation_trigger).length;
  const partly = rs.filter((r) => named(r.owner) || r.mitigation).length;
  const basis = [`${rs.length} risks raised. ${managed} carry an owner, a mitigation and an escalation trigger.`];
  if (managed === rs.length) return [3, basis];
  if (partly >= rs.length / 2) return [2, basis];
  return [1, basis];
}

function scoreD8(record, ctx) {
  if (ctx.restricted) return [null, [], 'restricted path'];
  if (['MT-B05', 'MT-B06', 'MT-D07'].includes(ctx.typeDetailed)) {
    return [null, [], `opportunity identification is not an expectation of ${ctx.typeDetailed}`];
  }
  const os = record.opportunities ?? [];
  if (os.length === 0) return [0, ['No opportunity or forward value consideration was recorded.']];
  const assessed = os.filter((o) => o.basis_given && (o.effort_stated || o.value_stated)).length;
  const assigned = os.filter((o) => o.next_step_action_id).length;
  const basis = [`${os.length} opportunities stated, ${assessed} with a stated basis and ${assigned} with a next step assigned.`];
  if (assigned === os.length && assessed === os.length) return [3, basis];
  if (assessed > 0) return [2, basis];
  return [1, basis];
}

function scoreD9(record) {
  const ds = record.decisions;
  if (ds.length === 0) return [0, ['No decisions, so no alignment to a stated objective could be tested.']];
  const aligned = ds.filter((d) => d.rationale && ALIGNMENT_WORDS.test(d.rationale)).length;
  const tradeOffs = ds.filter((d) => (d.options_rejected ?? []).length > 0).length;
  const basis = [`${aligned} of ${ds.length} decisions connect to a stated objective, plan or priority in their rationale.`];
  if (aligned === ds.length && tradeOffs > 0) return [3, basis.concat(`${tradeOffs} record what was traded off.`)];
  if (aligned >= ds.length / 2) return [2, basis];
  if (aligned > 0) return [1, basis];
  return [0, basis];
}

function scoreD10(record) {
  const produced = record.decisions.length + record.actions.length;
  const closed = Boolean(record.meeting.outcome_one_line?.trim());
  const followUp = Boolean(record.follow_up_email?.body?.trim());
  const basis = [
    `${record.decisions.length} decisions and ${record.actions.length} actions exist now and did not before.`,
    closed ? 'The meeting outcome was stated in one line.' : 'No stated outcome was recorded at the close.',
    followUp ? 'A follow up was drafted.' : 'No follow up was drafted.',
    'The follow up timing component is excluded: Concludo cannot observe whether the send happened.',
  ];
  if (produced === 0) return [0, basis];
  if (closed && followUp && produced > 0) return [3, basis];
  if (produced > 0 && (closed || followUp)) return [2, basis];
  return [1, basis];
}

const SCORERS = {
  D1: scoreD1, D2: scoreD2, D3: scoreD3, D4: scoreD4, D5: scoreD5,
  D6: scoreD6, D7: scoreD7, D8: scoreD8, D9: scoreD9, D10: scoreD10,
};

/**
 * @param {object} record MeetingRecord 1.1
 * @param {{objective?:string, typeDetailed?:string, restricted?:boolean}} [ctx]
 */
export function scoreHealth(record, ctx = {}) {
  const context = {
    objective: ctx.objective ?? record.meeting_context?.objective ?? 'inform',
    typeDetailed: ctx.typeDetailed ?? record.meeting_context?.type_primary ?? record.meeting?.type_detailed ?? null,
    restricted: ctx.restricted ?? false,
  };

  // Governance, structural. Restricted records are never scored, at any tier.
  if (context.restricted) {
    return {
      scored: false,
      reason: 'Restricted path. Performance, coaching, hiring and remuneration records produce no Meeting Performance Report at any tier.',
      health: null,
    };
  }

  const labelsLimited = record.statistics.speaker_label_quality === 'limited';
  const truncated = record.statistics.record_completeness === 'truncated';

  const dimensions = H.dimensions.map((meta) => {
    let raw = null, basis = [], reason = null;

    if (labelsLimited && meta.unscoreable_when === 'speaker_label_quality_limited') {
      reason = 'speaker label quality is limited, so this cannot be observed';
    } else if (truncated && (meta.id === 'D10' || meta.id === 'D5')) {
      reason = 'the record is truncated, so the close of the meeting was not captured';
    } else {
      const [r, b, why] = SCORERS[meta.id](record, context);
      raw = r; basis = b ?? []; reason = why ?? null;
    }

    const scoreable = raw !== null;
    return {
      id: meta.id,
      name: meta.name,
      weight: meta.weight,
      scoreable,
      unscoreable_reason: scoreable ? null : reason,
      raw,
      points: scoreable ? (raw / 3) * meta.weight : null,
      basis,
      modifier_applied: meta.modifier ?? null,
    };
  });

  const scoreableWeight = dimensions.filter((d) => d.scoreable).reduce((s, d) => s + d.weight, 0);
  const earned = dimensions.filter((d) => d.scoreable).reduce((s, d) => s + d.points, 0);

  let total = null, bandInternal = null, band = null, partialLabel = null;
  if (scoreableWeight >= H.scoreable_weight_floor) {
    total = Math.round((100 * earned) / scoreableWeight);
    const b = H.bands.find((x) => total >= x.min && total <= x.max);
    bandInternal = b.internal;
    band = b.display;
    const n = dimensions.filter((d) => d.scoreable).length;
    if (n < 10) partialLabel = `Partial score, ${n} of 10 dimensions assessed`;
  } else {
    partialLabel = 'Not scored. The record does not support assessment.';
  }

  const sub_scores = H.sub_scores.map((s) => {
    const rows = dimensions.filter((d) => s.dimensions.includes(d.id));
    const assessed = rows.filter((d) => d.scoreable);
    return {
      name: s.name,
      points_achieved: assessed.length ? Number(assessed.reduce((a, d) => a + d.points, 0).toFixed(1)) : null,
      points_available: s.points_available,
      not_assessed: rows.filter((d) => !d.scoreable).map((d) => d.name),
    };
  });

  return {
    scored: total !== null,
    reason: null,
    health: {
      dimensions,
      scoreable_weight: scoreableWeight,
      total,
      band_internal: bandInternal,
      band,
      partial_label: partialLabel,
      sub_scores,
      not_a_benchmark: true,
      individual_scores: null,
    },
  };
}

/** The three weakest scoreable dimensions, which drive the recommendation set. */
export function weakestDimensions(health, n = 3) {
  return health.dimensions
    .filter((d) => d.scoreable)
    .map((d) => ({ ...d, lost: d.weight - d.points }))
    .sort((a, b) => b.lost - a.lost || dimMeta[a.id].weight - dimMeta[b.id].weight)
    .slice(0, n);
}

export const NOT_A_BENCHMARK = H.not_a_benchmark_statement;
