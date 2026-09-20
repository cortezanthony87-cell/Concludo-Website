/**
 * E3 Output Selection. Specification 3.4, 3.5, 5.2 and 10.3.
 *
 * Deterministic. The load bearing step is subtraction: any system can add
 * documents, and the reason the outputs read as consulting grade is that
 * Concludo declines to produce the ones the record cannot support and says
 * which and why. `stated_omissions` is part of the plan, not an error log.
 *
 * At T1 the bundle is the spine. Type bundles arrive at T2 behind the Day 45
 * gate, so BUNDLES is deliberately empty here rather than stubbed.
 */
import { registry } from './registry.mjs';

const SPINE = registry.spine;
const FLOORS = registry.coverage_floors;
const named = (p) => Boolean(p && p.status === 'stated' && p.name);

/** Specification 3.5. client_safe is not user overridable while external participants are detected. */
export function resolveVariant(record, ctx = {}) {
  const c = record.meeting_context;
  const restricted =
    ctx.restricted === true ||
    (c?.confidentiality?.restricted_categories?.length ?? 0) > 0 ||
    registry.restricted_path.applies_to_types.includes(c?.type_primary);
  if (restricted) return { variant: 'restricted', user_overridable: false, reason: 'restricted path' };

  if (c?.participants?.external_present || c?.participants?.client_present) {
    return { variant: 'client_safe', user_overridable: false, reason: 'external or client participant present' };
  }
  if (c?.participants?.seniority_profile === 'executive' || (c?.strategic_importance_index ?? 0) >= 70) {
    return { variant: 'executive', user_overridable: true, reason: 'executive reader' };
  }
  return { variant: 'internal', user_overridable: true, reason: 'no external participants' };
}

/** Gate 1. inferred can enrich an output. It can never satisfy a precondition. */
function evidenceSufficient(outputId, record, ctx) {
  const supported = (arr) => arr.filter((x) => x.evidence === 'confirmed' || x.evidence === 'proposed');
  switch (outputId) {
    case 'OUT-01': case 'OUT-04': case 'OUT-06': case 'OUT-10':
      return { ok: true };
    case 'OUT-02': {
      const d = supported(record.decisions);
      return d.length ? { ok: true } : { ok: false, missing: 'no decision was recorded from confirmed or proposed evidence' };
    }
    case 'OUT-03': case 'OUT-07': {
      const a = supported(record.actions);
      return a.length ? { ok: true } : { ok: false, missing: 'no action was recorded from confirmed or proposed evidence' };
    }
    case 'OUT-05': {
      const r = supported(record.risks);
      const idx = record.meeting_context?.risk_level_index ?? 0;
      if (r.length || idx >= 50) return { ok: true };
      return { ok: false, missing: 'no risk or blocker was raised and the risk index is below 50' };
    }
    case 'OUT-08': {
      const a = supported(record.actions).filter((x) => named(x.owner) && x.due_date);
      return a.length ? { ok: true } : { ok: false, missing: 'no single action carries both a named owner and a date, so a next best action cannot be supported' };
    }
    case 'OUT-09': {
      return ctx.healthScoreable
        ? { ok: true }
        : { ok: false, missing: `scoreable weight is ${ctx.scoreableWeight} against a floor of 70` };
    }
    default: {
      // Catalogue outputs beyond the spine are T2 and above.
      return { ok: false, missing: 'output is not in the T1 spine' };
    }
  }
}

/** Gate 2. Structured frameworks with fixed slots. */
function coverageFloorMet(outputId, record) {
  const floor = FLOORS[outputId];
  if (!floor) return { ok: true };
  const filled = (record.framework_slots?.[outputId] ?? []).length;
  return filled >= floor.required
    ? { ok: true }
    : { ok: false, missing: `${filled} of ${floor.required} required ${floor.label} were evidenced (${floor.of} in total)` };
}

/** Gate 3. */
function confidentialityPermits(outputId, variant) {
  if (variant === 'restricted' && !registry.restricted_path.outputs_permitted_ids.includes(outputId)) {
    return {
      ok: false,
      missing: outputId === 'OUT-09'
        ? 'the record is on the restricted path, which produces no Meeting Performance Report at any tier'
        : 'the record is on the restricted path, which is limited to a private record for the person who uploaded it plus the actions they own themselves',
    };
  }
  if (variant === 'client_safe' && outputId === 'OUT-09') {
    return { ok: false, missing: 'the Meeting Performance Report is never included in a client safe output, never attached to a follow up, and never sent to attendees automatically' };
  }
  return { ok: true };
}

/** Gate 4. Maturity caps output weight. */
function proportionate(outputId, record) {
  const maturity = record.meeting_context?.maturity ?? 'unknown';
  const heavy = ['OUT-33', 'OUT-35', 'OUT-53', 'OUT-52', 'OUT-45', 'OUT-46', 'OUT-47'];
  const small = ['pre_revenue', 'early_stage', 'established_small'];
  if (heavy.includes(outputId) && small.includes(maturity)) {
    return { ok: false, missing: `workspace maturity is ${maturity} and the record contains no explicit board or programme governance signal` };
  }
  return { ok: true };
}

const NEXT_TIME = {
  'OUT-02': 'Confirm each decision aloud in the words that will be recorded, with the approver named.',
  'OUT-03': 'Assign each action to one person, out loud, with a date and a definition of done.',
  'OUT-05': 'Name the obstacles and failure modes before the meeting closes, with an owner for each.',
  'OUT-07': 'As above. The action plan is built from the action register.',
  'OUT-08': 'Give at least one action both a named owner and a date.',
  'OUT-09': 'Record the meeting with speaker labels and a stated duration so more dimensions can be assessed.',
};

/**
 * @returns {{lead_template:string, outputs:object[], variant:string,
 *            variant_user_overridable:boolean, stated_omissions:object[]}}
 */
export function selectOutputs(record, ctx = {}) {
  const v = resolveVariant(record, ctx);
  const plan = [];
  const omissions = [];

  for (const out of SPINE) {
    // Order follows specification 1.5, which outranks the listing order in 3.4:
    // confidentiality and consent constraints can suppress any output, including
    // one the user explicitly asked for, and they outrank evidence sufficiency.
    // Reporting "not enough evidence" for an output that confidentiality had
    // already closed would tell the user the wrong thing about their own record.
    const checks = [
      ['confidentiality', confidentialityPermits(out.id, v.variant)],
      ['evidence_sufficiency', evidenceSufficient(out.id, record, ctx)],
      ['coverage_floor', coverageFloorMet(out.id, record)],
      ['proportionality', proportionate(out.id, record)],
    ];
    const failed = checks.find(([, r]) => !r.ok);
    if (failed) {
      omissions.push({
        output_id: out.id,
        output_name: out.name,
        gate_failed: failed[0],
        missing_evidence: failed[1].missing,
        what_would_be_needed_next_time: NEXT_TIME[out.id] ?? 'Capture the missing evidence in the meeting itself.',
      });
      continue;
    }
    plan.push({ output_id: out.id, template: out.template, visuals: [], visual_fallbacks: [] });
  }

  return {
    lead_template: resolveLeadTemplate(record, v.variant),
    outputs: plan,
    variant: v.variant,
    variant_user_overridable: v.user_overridable,
    stated_omissions: omissions,
  };
}

/** Specification 5.2. Resolution is by reader, not by richness. One lead document, always. */
export function resolveLeadTemplate(record, variant) {
  const c = record.meeting_context;
  if (variant === 'client_safe') {
    const gaveRecommendation = (record.recommendations ?? []).length > 0 && c?.participants?.client_present;
    return gaveRecommendation ? 'T16' : 'T2';
  }
  const aboveTheRoom = record.decisions.some((d) => d.materiality === 'material') ||
    record.open_questions.some((q) => /above the room|escalat/i.test(q.why_it_matters ?? ''));
  if (aboveTheRoom) return 'T15';
  if ((c?.strategic_importance_index ?? 0) >= 75) return 'T14';
  if (c?.participants?.seniority_profile === 'executive') return 'T13';
  return 'T2';
}
