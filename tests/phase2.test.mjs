/**
 * Phase 2: Meeting Health Intelligence Test Suite
 *
 * Covers Tasklets 2.1 through 2.10.
 * Enforces:
 * 1. Zero individual scoring under any condition.
 * 2. No waste or savings claims.
 * 3. Fixed registry weights and bands.
 * 4. 70-point scoreable weight floor.
 * 5. Own-series comparison only with mandatory disclaimer.
 */
import { executeHealthEngine } from '../src/services/health/meetingHealthEngine.mjs';
import { calculateCompositeScore, FIXED_DIMENSION_WEIGHTS, REGISTRY_BANDS } from '../src/services/health/healthScoringService.mjs';
import { analyzeParticipation, IndividualScoringProhibitedError } from '../src/services/health/participationAnalysisEngine.mjs';
import { auditDecisionRigour, analyzeDecisionQuality, InferredDecisionRefusedError } from '../src/services/health/decisionQualityEngine.mjs';
import { auditActionDelegation, auditMeetingActions } from '../src/services/health/actionQualityAuditEngine.mjs';
import { analyzeStrategicValue } from '../src/services/health/strategicValueEngine.mjs';
import { analyzeTimeEfficiency, SavingsClaimsProhibitedError } from '../src/services/health/timeEfficiencyService.mjs';
import { assembleHealthPayload, RestrictedRecordHealthRefusedError } from '../src/services/health/healthPayloadAssembler.mjs';
import { aggregateOrgHealthDashboard, CrossOrganisationAggregationProhibitedError } from '../src/services/health/healthDashboardService.mjs';
import { compareSeriesTrends, SeriesComparisonError, NOT_A_BENCHMARK_STATEMENT } from '../src/services/health/seriesTrendComparisonService.mjs';
import { baseRecord, sparseRecord, restrictedRecord } from '../fixtures/build.mjs';

export function runPhase2Tests(check) {
  // ------------------------------------------------------------------ Tasklet 2.1: Health Engine Harness
  {
    const base = baseRecord();
    const run = executeHealthEngine(base, { objective: 'decide' });
    check('phase2-2.1', 'Health engine executes base record', run && run.composite_score !== null);
    check('phase2-2.1', 'Health engine produces duration in seconds', run.total_duration_seconds === base.meeting.duration_minutes * 60);
    check('phase2-2.1', 'Health engine evaluates all 10 dimensions', Object.keys(run.dimension_scores).length === 10);

    const restr = restrictedRecord();
    const restRun = executeHealthEngine(restr, { restricted: true });
    check('phase2-2.1', 'Restricted records are never scored', restRun.composite_score === null && restRun.scoreable_weight === 0);
  }

  // ------------------------------------------------------------------ Tasklet 2.2: Fixed Weights and Bands
  {
    const sum = Object.values(FIXED_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
    check('phase2-2.2', 'Fixed registry weights sum to exactly 100', sum === 100);

    const lowScore = calculateCompositeScore({
      D1: { raw: 0 },
      D2: { raw: 0 },
      D3: { raw: 0 },
      D4: { raw: 0 },
      D5: { raw: 0 },
      D6: { raw: 0 },
      D7: { raw: 0 },
      D8: { raw: 0 },
      D9: { raw: 0 },
      D10: { raw: 0 },
    });
    check('phase2-2.2', 'Composite score 0 maps to Waste of Time internal band', lowScore.classification_band === 'Waste of Time');
    check('phase2-2.2', 'Waste of Time displays as Did not justify the time', lowScore.display_band === 'Did not justify the time');

    const highScore = calculateCompositeScore({
      D1: { raw: 3 }, D2: { raw: 3 }, D3: { raw: 3 }, D4: { raw: 3 }, D5: { raw: 3 },
      D6: { raw: 3 }, D7: { raw: 3 }, D8: { raw: 3 }, D9: { raw: 3 }, D10: { raw: 3 },
    });
    check('phase2-2.2', 'Perfect score maps to Excellent band', highScore.composite_score === 100 && highScore.classification_band === 'Excellent');

    // Scoreable weight floor
    const thin = calculateCompositeScore({
      D1: { raw: 3 }, // 12
      D2: { raw: 3 }, // 8 -> 20 weight total, well below 70
    });
    check('phase2-2.2', 'Scoreable weight below 70 floor sets composite score to null', thin.composite_score === null);
    check('phase2-2.2', 'Scoreable weight below 70 floor sets bands to null', thin.classification_band === null && thin.display_band === null);
    check('phase2-2.2', 'Unmet floor produces explicit partial label', thin.partial_label.includes('below 70-point floor'));
  }

  // ------------------------------------------------------------------ Tasklet 2.3: Anonymous Participation
  {
    const base = baseRecord();
    const p = analyzeParticipation(base, { anonymousSlotShares: [40, 30, 20, 10] });
    check('phase2-2.3', 'Measures distribution index across anonymous slots', typeof p.distribution_index === 'number');
    check('phase2-2.3', 'Calculates top share percentage without names', p.top_share_percentage === 40);
    check('phase2-2.3', 'individual_scores is strictly null', p.individual_scores === null);

    let threw = false;
    try {
      analyzeParticipation(base, { individualSpeakerMetricsRequested: true });
    } catch (e) {
      if (e instanceof IndividualScoringProhibitedError) threw = true;
    }
    check('phase2-2.3', 'Requesting individual speaker metrics throws prohibited error', threw);
  }

  // ------------------------------------------------------------------ Tasklet 2.4: Decision Quality
  {
    const base = baseRecord();
    const dq = analyzeDecisionQuality(base, { objective: 'decide' });
    check('phase2-2.4', 'Audits all decisions against rigour rubric', dq.audits.length === base.decisions.length);
    check('phase2-2.4', 'Evaluates explicit rationale', dq.audits.every((a) => typeof a.has_explicit_rationale === 'boolean'));
    check('phase2-2.4', 'Classifies consensus type', dq.audits.every((a) => ['UNANIMOUS', 'MAJORITY', 'EXECUTIVE_DECREE', 'RECORDED_DISSENT'].includes(a.consensus_type)));

    let inferredThrew = false;
    try {
      auditDecisionRigour({ id: 'DEC-99', statement: 'Test', evidence: 'inferred' });
    } catch (e) {
      if (e instanceof InferredDecisionRefusedError) inferredThrew = true;
    }
    check('phase2-2.4', 'Inferred decision cannot be scored', inferredThrew);
  }

  // ------------------------------------------------------------------ Tasklet 2.5: Action Quality Audit
  {
    const base = baseRecord();
    const aq = auditMeetingActions(base);
    check('phase2-2.5', 'Audits all actions', aq.audits.length === base.actions.length);
    check('phase2-2.5', 'Evaluates Five-Field Delegation Standard', aq.audits.every((a) => typeof a.compliance_percentage === 'number'));
    check('phase2-2.5', 'Classifies audit status', aq.audits.every((a) => ['FULLY_COMPLIANT', 'PARTIAL', 'DEFECTIVE'].includes(a.audit_status)));

    const perfectAction = auditActionDelegation({
      id: 'ACT-1',
      action: 'Finalise contract',
      owner: { status: 'stated', name: 'Alice' },
      due_date: '2026-10-01',
      definition_of_done: 'Signed copy in drive',
      escalation_path: 'Escalate to VP',
      confirmation_method: 'Email signoff',
    });
    check('phase2-2.5', 'Action with all 5 fields is 100% compliant', perfectAction.compliance_percentage === 100 && perfectAction.audit_status === 'FULLY_COMPLIANT');

    const defectiveAction = auditActionDelegation({
      id: 'ACT-2',
      action: 'Follow up',
      owner: null,
    });
    check('phase2-2.5', 'Action lacking fields is marked defective', defectiveAction.audit_status === 'DEFECTIVE');
  }

  // ------------------------------------------------------------------ Tasklet 2.6: Strategic Alignment
  {
    const base = baseRecord();
    const sv = analyzeStrategicValue(base, {
      strategicPillars: [
        { id: 'PIL-1', name: 'Delivery Execution', keywords: ['delivery', 'schedule', 'riverstone'] },
      ],
    });
    check('phase2-2.6', 'Matches decisions against strategic pillars', sv.strategic_alignments.length === 1);
    check('phase2-2.6', 'Evaluates D7 risk identification from record', sv.dimension_evaluations.D7.raw !== null);
    check('phase2-2.6', 'Evaluates D8 opportunity identification from record', sv.dimension_evaluations.D8.raw !== null);

    const rest = analyzeStrategicValue(base, { restricted: true });
    check('phase2-2.6', 'Restricted records unscore opportunity identification', rest.dimension_evaluations.D8.raw === null);
  }

  // ------------------------------------------------------------------ Tasklet 2.7: Time Efficiency
  {
    const base = baseRecord();
    const eff = analyzeTimeEfficiency(base, {
      scheduledDurationMinutes: 45,
      startDelayMinutes: 5,
      userSuppliedHourlyRateAud: 120,
    });
    check('phase2-2.7', 'Calculates overrun minutes', eff.overrun_minutes === base.meeting.duration_minutes - 45);
    check('phase2-2.7', 'Calculates illustrative cost with supplied rate', typeof eff.illustrative_cost_aud === 'number');
    check('phase2-2.7', 'Carries illustrative cost notice', eff.illustrative_cost_notice.includes('Illustrative cost only'));

    let savingsThrew = false;
    try {
      analyzeTimeEfficiency(base, { calculateSavings: true });
    } catch (e) {
      if (e instanceof SavingsClaimsProhibitedError) savingsThrew = true;
    }
    check('phase2-2.7', 'Savings claims are strictly prohibited and throw', savingsThrew);
  }

  // ------------------------------------------------------------------ Tasklet 2.8: Health Payload Assembler
  {
    const base = baseRecord();
    const payload = assembleHealthPayload(base, { objective: 'decide' });
    check('phase2-2.8', 'Assembles typed GEN-12 payload', payload && payload.scoring && payload.participation);
    check('phase2-2.8', 'Carries verbatim not a benchmark statement', payload.statutory_notice.includes('Not a benchmark'));

    let restrThrew = false;
    try {
      assembleHealthPayload(base, { restricted: true });
    } catch (e) {
      if (e instanceof RestrictedRecordHealthRefusedError) restrThrew = true;
    }
    check('phase2-2.8', 'Assembler refuses restricted records', restrThrew);
  }

  // ------------------------------------------------------------------ Tasklet 2.9: Health Dashboards
  {
    const orgId = 'org-1111';
    const runs = [
      { id: '1', organisation_id: orgId, composite_score: 80, created_at: '2026-09-01T10:00:00Z', illustrative_cost_aud: 300 },
      { id: '2', organisation_id: orgId, composite_score: 60, created_at: '2026-09-02T10:00:00Z', illustrative_cost_aud: 250 },
      { id: '3', organisation_id: orgId, composite_score: 40, created_at: '2026-09-03T10:00:00Z', illustrative_cost_aud: 400 },
    ];
    const dash = aggregateOrgHealthDashboard(orgId, runs);
    check('phase2-2.9', 'Aggregates total meetings for caller organisation', dash.summary.total_meetings === 3);
    check('phase2-2.9', 'Aggregates average score', dash.summary.average_score === 60);
    check('phase2-2.9', 'Aggregates illustrative cost only', dash.summary.total_illustrative_cost_aud === 950);
    check('phase2-2.9', 'Carries benchmark notice', dash.benchmark_notice.includes('Not a benchmark'));

    let crossOrgThrew = false;
    try {
      aggregateOrgHealthDashboard(orgId, [
        { id: '1', organisation_id: orgId, composite_score: 80 },
        { id: '2', organisation_id: 'rival-org', composite_score: 70 },
      ]);
    } catch (e) {
      if (e instanceof CrossOrganisationAggregationProhibitedError) crossOrgThrew = true;
    }
    check('phase2-2.9', 'Cross-organisation aggregation throws prohibited error', crossOrgThrew);
  }

  // ------------------------------------------------------------------ Tasklet 2.10: Series Trend Comparison
  {
    const orgId = 'org-1111';
    const seriesId = 'SERIES-OPS-WEEKLY';
    const fourMeetings = [
      { meeting_id: 'm1', organisation_id: orgId, series_id: seriesId, meeting_type: 'weekly_ops', scored_at: '2026-08-01', composite_score: 65, dimension_scores: { D1: { points: 8 } } },
      { meeting_id: 'm2', organisation_id: orgId, series_id: seriesId, meeting_type: 'weekly_ops', scored_at: '2026-08-08', composite_score: 70, dimension_scores: { D1: { points: 9 } } },
      { meeting_id: 'm3', organisation_id: orgId, series_id: seriesId, meeting_type: 'weekly_ops', scored_at: '2026-08-15', composite_score: 75, dimension_scores: { D1: { points: 10 } } },
      { meeting_id: 'm4', organisation_id: orgId, series_id: seriesId, meeting_type: 'weekly_ops', scored_at: '2026-08-22', composite_score: 80, dimension_scores: { D1: { points: 11 } } },
    ];

    const trend = compareSeriesTrends(orgId, seriesId, fourMeetings);
    check('phase2-2.10', 'Longitudinal comparison succeeds with >= 4 series meetings', trend.can_compare === true);
    check('phase2-2.10', 'Detects improving trend direction', trend.trend_direction === 'improving');
    check('phase2-2.10', 'Contains verbatim canonical benchmark statement', trend.benchmark_notice === NOT_A_BENCHMARK_STATEMENT);

    // Insufficient data gate
    const twoMeetings = fourMeetings.slice(0, 2);
    const thinTrend = compareSeriesTrends(orgId, seriesId, twoMeetings);
    check('phase2-2.10', 'Refuses comparison with < 4 meetings', thinTrend.can_compare === false && thinTrend.trend_direction === 'insufficient_data');

    // Reject cross-meeting-type
    let crossTypeThrew = false;
    try {
      compareSeriesTrends(orgId, seriesId, [
        ...fourMeetings.slice(0, 3),
        { meeting_id: 'm4', organisation_id: orgId, series_id: seriesId, meeting_type: 'all_hands', scored_at: '2026-08-22', composite_score: 80 },
      ]);
    } catch (e) {
      if (e instanceof SeriesComparisonError && e.code === 'CROSS_MEETING_TYPE_PROHIBITED') crossTypeThrew = true;
    }
    check('phase2-2.10', 'Refuses to compare across different meeting types', crossTypeThrew);

    // Reject cross-organisation
    let crossOrgThrew = false;
    try {
      compareSeriesTrends(orgId, seriesId, [
        ...fourMeetings.slice(0, 3),
        { meeting_id: 'm4', organisation_id: 'other-org', series_id: seriesId, meeting_type: 'weekly_ops', scored_at: '2026-08-22', composite_score: 80 },
      ]);
    } catch (e) {
      if (e instanceof SeriesComparisonError && e.code === 'CROSS_ORGANISATION_PROHIBITED') crossOrgThrew = true;
    }
    check('phase2-2.10', 'Refuses to compare across different organisations', crossOrgThrew);
  }
}
