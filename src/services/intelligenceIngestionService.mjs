/**
 * Tasklet 1.2: Transcript Intelligence Consumption
 *
 * Ingests structured intelligence artifacts emitted by Stages 1 to 7 of the
 * Concludo Meeting Intelligence Pipeline (A0) and maps them into the output
 * generation context with Five-Field action delegation validation.
 */

export function validateFiveFieldAction(action) {
  const issues = [];
  const who = action.owner?.name?.trim();
  const what = action.action?.trim();
  const when = action.due_date?.trim();
  const evidence = action.evidence;
  const dod = action.definition_of_done?.trim();

  if (!who) {
    issues.push('Missing named owner (who)');
  }
  if (!what) {
    issues.push('Missing action statement (what)');
  }
  if (!when) {
    issues.push('Missing due date or timeframe (when)');
  }
  if (!evidence || (evidence !== 'confirmed' && evidence !== 'proposed')) {
    issues.push('Evidence must be confirmed or proposed');
  }
  if (!dod) {
    issues.push('Missing definition of done');
  }

  return {
    valid: issues.length === 0,
    issues,
    compliant_action: issues.length === 0 ? action : null,
  };
}

export function ingestPipelineArtifacts(meetingId, payload, options = {}) {
  if (!meetingId) {
    throw new Error('meetingId is required for intelligence ingestion');
  }
  if (!payload || typeof payload !== 'object') {
    const err = new Error('Invalid pipeline payload');
    err.code = 'INVALID_PAYLOAD';
    throw err;
  }

  // Ensure stages 1 to 6 completed
  const completedStages = payload.completed_stages ?? [1, 2, 3, 4, 5, 6, 7];
  const requiredStages = [1, 2, 3, 4, 5, 6];
  const hasDependencies = requiredStages.every((s) => completedStages.includes(s));
  if (!hasDependencies) {
    const err = new Error('Stages 1 to 6 must be marked completed before intelligence ingestion');
    err.code = 'MISSING_PIPELINE_DEPENDENCY';
    err.status = 422;
    throw err;
  }

  const rawSpeakers = Array.isArray(payload.speakers) ? payload.speakers : [];
  const rawActions = Array.isArray(payload.actions) ? payload.actions : [];
  const rawDecisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  const rawRisks = Array.isArray(payload.risks) ? payload.risks : [];
  const rawOpportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];

  // Diarisation & attribution verification
  const speakerQuality = payload.speaker_label_quality ?? 'normal';
  const speakerRegistry = rawSpeakers.map((s, idx) => ({
    id: s.id ?? `spk_${idx + 1}`,
    name: s.name ?? `Speaker ${idx + 1}`,
    role: s.role ?? 'Participant',
    turn_count: s.turn_count ?? 1,
    is_client: Boolean(s.is_client),
  }));

  // Validate Five-Field delegation on each action
  const actionsValidated = rawActions.map((action) => {
    const check = validateFiveFieldAction(action);
    return {
      ...action,
      five_field_compliant: check.valid,
      compliance_issues: check.issues,
      // If speaker quality was limited, suppress unverified attribution
      owner: speakerQuality === 'limited' && !action.owner?.explicitly_named
        ? { name: null, status: 'attribution_unsupported' }
        : action.owner,
    };
  });

  // Zero-invention filter: Inferred decisions can enrich but cannot satisfy formal decision status
  const decisionsSanitised = rawDecisions.map((d) => ({
    ...d,
    is_inferred: d.evidence === 'inferred',
    formal_status: d.evidence === 'confirmed' || d.evidence === 'proposed' ? 'RECORDED' : 'INFERRED_NOTE',
  }));

  return {
    meeting_id: meetingId,
    organisation_id: payload.organisation_id ?? options.organisationId,
    pipeline_version: payload.pipeline_version ?? 'v1.0',
    speaker_registry: speakerRegistry,
    speaker_quality: speakerQuality,
    extracted_topics: payload.topics ?? [],
    extracted_entities: payload.entities ?? [],
    extracted_decisions: decisionsSanitised,
    extracted_actions: actionsValidated,
    extracted_risks: rawRisks,
    extracted_opportunities: rawOpportunities,
    ingested_at: new Date().toISOString(),
  };
}
