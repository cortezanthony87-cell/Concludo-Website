/**
 * Tasklet 1.4: Output Package Builder
 *
 * Dynamically constructs output generation bundles tailored to meeting archetype,
 * intent, subscription tier, and custom user overrides.
 *
 * Enforces the four gates strictly in Section 1.5 order:
 *   (1) confidentiality
 *   (2) evidence_sufficiency
 *   (3) coverage_floor
 *   (4) proportionality
 *
 * The restricted path is an allowlist: only outputs_permitted_ids render.
 * Computes explicit Stated Omissions with all four required fields.
 */
import { registry, loadFullRegistry } from '../registry.mjs';
import { validateOutputEligibility, getOutputById } from './outputRegistryService.mjs';

const FLOORS = registry.coverage_floors || {};

const NEXT_TIME_MAP = {
  'OUT-02': 'Confirm each decision aloud in the words that will be recorded, with the approver named.',
  'OUT-03': 'Assign each action to one person, out loud, with a date and a definition of done.',
  'OUT-05': 'Name the obstacles and failure modes before the meeting closes, with an owner for each.',
  'OUT-07': 'As above. The action plan is built from the action register.',
  'OUT-08': 'Give at least one action both a named owner and a date.',
  'OUT-09': 'Record the meeting with speaker labels and a stated duration so more dimensions can be assessed.',
  'OUT-11': 'Formulate strategic decisions with explicit trade-offs and approvals recorded.',
  'OUT-12': 'Record formal risk ratings and identified owners during executive discussions.',
  'OUT-13': 'Explicitly state the commercial opportunity and proponent during the meeting.',
};

/** Gate 1: Confidentiality */
function checkConfidentiality(outputId, variant) {
  if (variant === 'restricted') {
    if (!registry.restricted_path.outputs_permitted_ids.includes(outputId)) {
      return {
        ok: false,
        gate: 'confidentiality',
        missing: outputId === 'OUT-09'
          ? 'the record is on the restricted path, which produces no Meeting Performance Report at any tier'
          : 'the record is on the restricted path, which is limited to a private record for the person who uploaded it plus the actions they own themselves',
      };
    }
  }
  if (variant === 'client_safe' && outputId === 'OUT-09') {
    return {
      ok: false,
      gate: 'confidentiality',
      missing: 'the Meeting Performance Report is never included in a client safe output, never attached to a follow up, and never sent to attendees automatically',
    };
  }
  return { ok: true };
}

/** Gate 2: Evidence Sufficiency (confirmed or proposed only; inferred cannot satisfy) */
function checkEvidenceSufficiency(outputId, record, ctx = {}) {
  const supported = (arr) => (arr || []).filter((x) => x.evidence === 'confirmed' || x.evidence === 'proposed');
  
  switch (outputId) {
    case 'OUT-01':
    case 'OUT-04':
    case 'OUT-06':
    case 'OUT-10':
      return { ok: true };
    case 'OUT-02': {
      const d = supported(record.decisions);
      return d.length > 0
        ? { ok: true }
        : { ok: false, gate: 'evidence_sufficiency', missing: 'no decision was recorded from confirmed or proposed evidence' };
    }
    case 'OUT-03':
    case 'OUT-07': {
      const a = supported(record.actions);
      return a.length > 0
        ? { ok: true }
        : { ok: false, gate: 'evidence_sufficiency', missing: 'no action was recorded from confirmed or proposed evidence' };
    }
    case 'OUT-05': {
      const r = supported(record.risks);
      const idx = record.meeting_context?.risk_level_index ?? 0;
      if (r.length > 0 || idx >= 50) return { ok: true };
      return { ok: false, gate: 'evidence_sufficiency', missing: 'no risk or blocker was raised and the risk index is below 50' };
    }
    case 'OUT-08': {
      const a = supported(record.actions).filter((x) => x.owner?.name && x.due_date);
      return a.length > 0
        ? { ok: true }
        : { ok: false, gate: 'evidence_sufficiency', missing: 'no single action carries both a named owner and a date, so a next best action cannot be supported' };
    }
    case 'OUT-09': {
      return ctx.healthScoreable
        ? { ok: true }
        : { ok: false, gate: 'evidence_sufficiency', missing: `scoreable weight is ${ctx.scoreableWeight ?? 0} against a floor of 70` };
    }
    case 'OUT-12': {
      const r = supported(record.risks);
      return r.length > 0
        ? { ok: true }
        : { ok: false, gate: 'evidence_sufficiency', missing: 'no strategic risk was articulated with verifiable evidence' };
    }
    case 'OUT-13': {
      const o = (record.opportunities || []).filter((x) => x.status === 'stated' && x.stated_by);
      return o.length > 0
        ? { ok: true }
        : { ok: false, gate: 'evidence_sufficiency', missing: 'no stated commercial opportunity with a named proponent was identified' };
    }
    default:
      return { ok: true };
  }
}

/** Gate 3: Coverage Floor */
function checkCoverageFloor(outputId, record) {
  const floor = FLOORS[outputId];
  if (!floor) return { ok: true };
  const filled = (record.framework_slots?.[outputId] ?? []).length;
  if (filled < floor.required) {
    return {
      ok: false,
      gate: 'coverage_floor',
      missing: `${filled} of ${floor.required} required ${floor.label} were evidenced (${floor.of} in total)`,
    };
  }
  return { ok: true };
}

/** Gate 4: Proportionality */
function checkProportionality(outputId, record) {
  const maturity = record.meeting_context?.maturity ?? 'unknown';
  const heavy = ['OUT-33', 'OUT-35', 'OUT-53', 'OUT-52', 'OUT-45', 'OUT-46', 'OUT-47'];
  const small = ['pre_revenue', 'early_stage', 'established_small'];
  if (heavy.includes(outputId) && small.includes(maturity)) {
    return {
      ok: false,
      gate: 'proportionality',
      missing: `workspace maturity is ${maturity} and the record contains no explicit board or programme governance signal`,
    };
  }
  return { ok: true };
}

export function buildRecommendedBundle(record, options = {}) {
  const tier = options.tier || 'starter';
  const ctx = record.meeting_context || {};
  
  // Resolve variant
  let variant = 'internal';
  let userOverridable = true;
  const isRestricted =
    options.restricted === true ||
    (ctx.confidentiality?.restricted_categories?.length ?? 0) > 0 ||
    registry.restricted_path.applies_to_types.includes(ctx.type_primary);

  if (isRestricted) {
    variant = 'restricted';
    userOverridable = false;
  } else if (ctx.participants?.external_present || ctx.participants?.client_present) {
    variant = 'client_safe';
    userOverridable = false;
  } else if (ctx.participants?.seniority_profile === 'executive' || (ctx.strategic_importance_index ?? 0) >= 70) {
    variant = 'executive';
    userOverridable = true;
  }

  // Candidate outputs: start from spine or candidate bundle
  const candidates = options.customInclusions?.length
    ? options.customInclusions
    : registry.spine.map((s) => s.id);

  const selectedOutputs = [];
  const statedOmissions = [];

  for (const outputId of candidates) {
    // 0. Subscription tier entitlement check
    if (!validateOutputEligibility(outputId, tier)) {
      if (options.customInclusions?.includes(outputId)) {
        const err = new Error(`Subscription tier ${tier} is not entitled to output ${outputId}`);
        err.code = 'TIER_ENTITLEMENT_EXCEEDED';
        err.status = 403;
        throw err;
      }
      statedOmissions.push({
        output_id: outputId,
        output_name: getOutputById(outputId).name,
        gate_failed: 'tier_entitlement',
        missing_evidence: `Requires Pro subscription or Team subscription (current: ${tier})`,
        what_would_be_needed_next_time: 'Upgrade workspace subscription tier.',
      });
      continue;
    }

    let deliverableName = outputId;
    try {
      deliverableName = getOutputById(outputId).name;
    } catch {
      // fallback
    }

    // Evaluate 4 gates in strict Section 1.5 order
    // 1. Confidentiality (outranks evidence)
    const conf = checkConfidentiality(outputId, variant);
    if (!conf.ok) {
      statedOmissions.push({
        output_id: outputId,
        output_name: deliverableName,
        gate_failed: conf.gate,
        missing_evidence: conf.missing,
        what_would_be_needed_next_time: NEXT_TIME_MAP[outputId] ?? 'Capture the missing evidence in the meeting itself.',
      });
      continue;
    }

    // 2. Evidence Sufficiency
    const evid = checkEvidenceSufficiency(outputId, record, options);
    if (!evid.ok) {
      statedOmissions.push({
        output_id: outputId,
        output_name: deliverableName,
        gate_failed: evid.gate,
        missing_evidence: evid.missing,
        what_would_be_needed_next_time: NEXT_TIME_MAP[outputId] ?? 'Capture the missing evidence in the meeting itself.',
      });
      continue;
    }

    // 3. Coverage Floor
    const cov = checkCoverageFloor(outputId, record);
    if (!cov.ok) {
      statedOmissions.push({
        output_id: outputId,
        output_name: deliverableName,
        gate_failed: cov.gate,
        missing_evidence: cov.missing,
        what_would_be_needed_next_time: NEXT_TIME_MAP[outputId] ?? 'Capture the missing evidence in the meeting itself.',
      });
      continue;
    }

    // 4. Proportionality
    const prop = checkProportionality(outputId, record);
    if (!prop.ok) {
      statedOmissions.push({
        output_id: outputId,
        output_name: deliverableName,
        gate_failed: prop.gate,
        missing_evidence: prop.missing,
        what_would_be_needed_next_time: NEXT_TIME_MAP[outputId] ?? 'Capture the missing evidence in the meeting itself.',
      });
      continue;
    }

    selectedOutputs.push(outputId);
  }

  return {
    variant,
    variant_user_overridable: userOverridable,
    selected_output_ids: selectedOutputs,
    omitted_output_ids: statedOmissions.map((o) => o.output_id),
    stated_omissions: statedOmissions,
    estimated_generation_seconds: Math.max(10, selectedOutputs.length * 3),
    status: 'PLANNED',
  };
}
