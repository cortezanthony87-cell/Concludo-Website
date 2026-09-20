/**
 * Phase 3: Concludo Insight Engine Test Suite
 * 
 * Covers Tasklets 3.1 through 3.12.
 * Enforces:
 * 1. Every finding names its comparison basis.
 * 2. Absence renders strictly as a question for INS-C and INS-D.
 * 3. INS-G is corpus gated (0-4 disabled, 5-19 exact match, 20-39 counts, 40+ full).
 * 4. INS-H never names a consulting firm.
 * 5. Strict channel caps enforced (INS-A: 5, INS-B: 4, INS-C: 3, INS-D: 2, INS-E: 6, INS-F: 3, INS-G: 3, INS-H: 2).
 * 6. Section headings use registry question strings verbatim.
 */

import { detectExpectedElementAbsences, NoComparisonBasisError, INS_A_CHANNEL } from '../src/services/insights/expectedElementAbsenceDetector.mjs';
import { inferActionDependencies, CircularDependencyDetectedError, INS_E_CHANNEL } from '../src/services/insights/dependencyInferenceEngine.mjs';
import { analyzeGapsToClosure, ClosureAnalysisIncompleteError, INS_F_CHANNEL } from '../src/services/insights/gapToClosureAnalyzer.mjs';
import { testMeetingAssumptions, INS_B_CHANNEL } from '../src/services/insights/assumptionTestingEngine.mjs';
import { detectRiskArchetypeAbsences, INS_C_CHANNEL } from '../src/services/insights/riskArchetypeAbsenceDetector.mjs';
import { detectOpportunityArchetypeAbsences, INS_D_CHANNEL } from '../src/services/insights/opportunityArchetypeAbsenceDetector.mjs';
import { matchCrossRecordPatterns, InsufficientCorpusError, INS_G_CHANNEL } from '../src/services/insights/crossRecordPatternMatcher.mjs';
import { applyAdvisoryFrames, validateNoConsultingFirms, ConsultingFirmReferenceProhibitedError, INS_H_CHANNEL } from '../src/services/insights/advisoryFrameLibrary.mjs';
import { scoreInsight } from '../src/services/insights/insightScoringEngine.mjs';
import { curateTopInsights, CHANNEL_CAPS } from '../src/services/insights/insightPrioritisationEngine.mjs';
import { renderRiskHeatmapSvg, renderPriorityMatrixSvg, renderSensitivityTornadoSvg } from '../src/services/insights/insightVisualisationService.mjs';
import { compileInsightAnnexureHtml, compileInsightAnnexureMarkdown, REGISTRY_CHANNEL_HEADINGS } from '../src/services/insights/insightReportingService.mjs';

export function runPhase3Tests(check) {
  // ------------------------------------------------------------------ Tasklet 3.1: Expected Element Absence (INS-A)
  {
    const record = { transcript: 'A brief sync without explicit purpose or financial sign-off', agenda: [] };
    const findings = detectExpectedElementAbsences(record);
    check('phase3-3.1', 'INS-A detects missing expected elements', findings.length > 0);
    check('phase3-3.1', 'INS-A findings enforce cap of 5', findings.length <= INS_A_CHANNEL.cap);
    check('phase3-3.1', 'Every INS-A finding has a comparison basis', findings.every(f => f.comparison_basis && f.comparison_basis.length > 5));

    let threw = false;
    try {
      detectExpectedElementAbsences(record, {
        expectedElements: [{ name: 'Test', category: 'AGENDA_ITEM', comparison_basis: '' }]
      });
    } catch (e) {
      if (e instanceof NoComparisonBasisError) threw = true;
    }
    check('phase3-3.1', 'Throws NoComparisonBasisError if comparison basis is missing', threw);
  }

  // ------------------------------------------------------------------ Tasklet 3.2: Dependency Inference (INS-E)
  {
    const decisions = [{ id: 'DEC-01', title: 'Adopt new pricing tier' }];
    const actions = [
      { id: 'ACT-01', title: 'Update checkout pricing tier for new customers' },
      { id: 'ACT-02', title: 'Dispatch marketing announcement following update', depends_on: 'ACT-01' }
    ];
    const deps = inferActionDependencies(actions, decisions);
    check('phase3-3.2', 'INS-E infers dependencies over decisions and actions', deps.length > 0);
    check('phase3-3.2', 'INS-E enforces cap of 6', deps.length <= INS_E_CHANNEL.cap);
    check('phase3-3.2', 'Every INS-E finding has a comparison basis', deps.every(d => d.comparison_basis && d.comparison_basis.length > 5));

    // Circular dependency check
    let cycleThrew = false;
    try {
      inferActionDependencies(
        [{ id: 'A', depends_on: 'B', title: 'following B' }, { id: 'B', depends_on: 'A', title: 'following A' }],
        []
      );
    } catch (e) {
      if (e instanceof CircularDependencyDetectedError) cycleThrew = true;
    }
    check('phase3-3.2', 'Circular dependency detection works', cycleThrew);
  }

  // ------------------------------------------------------------------ Tasklet 3.3: Gap to Closure Analysis (INS-F)
  {
    const record = {
      decisions: [{ id: 'DEC-01', title: 'Approve vendor contract', owner: 'Managing Director' }],
      actions: [{ id: 'ACT-01', title: 'Implement integration', what: 'Build connector', who: 'Lead Engineer' }]
    };
    const gaps = analyzeGapsToClosure(record);
    check('phase3-3.3', 'INS-F detects closure gaps on decisions and actions', gaps.length > 0);
    check('phase3-3.3', 'INS-F enforces cap of 3', gaps.length <= INS_F_CHANNEL.cap);
    check('phase3-3.3', 'Every INS-F gap has a comparison basis and suggested closure action',
      gaps.every(g => g.comparison_basis && g.suggested_closure_action));

    let emptyThrew = false;
    try {
      analyzeGapsToClosure({ actions: [], decisions: [] });
    } catch (e) {
      if (e instanceof ClosureAnalysisIncompleteError) emptyThrew = true;
    }
    check('phase3-3.3', 'Throws ClosureAnalysisIncompleteError on empty actions and decisions', emptyThrew);
  }

  // ------------------------------------------------------------------ Tasklet 3.4: Assumption Classification and Testing (INS-B)
  {
    const statements = [
      { text: 'We believe our enterprise pipeline will close this month', quote: 'we believe our enterprise pipeline', speaker_slot: 'Participant Slot 1' },
      { text: 'We presumably have enough runway for Q4', quote: 'we presumably have enough runway', speaker_slot: 'Participant Slot 2' }
    ];
    const assumptions = testMeetingAssumptions(statements);
    check('phase3-3.4', 'INS-B detects hedging markers', assumptions.length === 2);
    check('phase3-3.4', 'INS-B enforces cap of 4', assumptions.length <= INS_B_CHANNEL.cap);
    check('phase3-3.4', 'INS-B uses anonymous participant slots only', assumptions.every(a => a.speaker_slot.startsWith('Participant Slot')));
    check('phase3-3.4', 'INS-B provides validation requirement', assumptions.every(a => a.validation_requirement.length > 10));
    check('phase3-3.4', 'INS-B observation is about the assumption, never the person',
      assumptions.every(a => a.observation_text.includes('operational premise') && !a.observation_text.includes('wrong')));
  }

  // ------------------------------------------------------------------ Tasklet 3.5: Risk Archetype Absence (INS-C)
  {
    const record = { transcript: 'General product discussion', risks: [] };
    const riskAbsences = detectRiskArchetypeAbsences(record);
    check('phase3-3.5', 'INS-C detects unaddressed risk archetypes', riskAbsences.length > 0);
    check('phase3-3.5', 'INS-C enforces cap of 3', riskAbsences.length <= INS_C_CHANNEL.cap);
    check('phase3-3.5', 'INS-C renders strictly as a question ending with ?',
      riskAbsences.every(r => r.question_text.trim().endsWith('?')));
  }

  // ------------------------------------------------------------------ Tasklet 3.6: Opportunity Archetype Absence (INS-D)
  {
    const record = { transcript: 'Routine status review', opportunities: [] };
    const oppAbsences = detectOpportunityArchetypeAbsences(record);
    check('phase3-3.6', 'INS-D detects unaddressed opportunity archetypes', oppAbsences.length > 0);
    check('phase3-3.6', 'INS-D enforces cap of 2', oppAbsences.length <= INS_D_CHANNEL.cap);
    check('phase3-3.6', 'INS-D renders strictly as a question ending with ?',
      oppAbsences.every(o => o.question_text.trim().endsWith('?')));
  }

  // ------------------------------------------------------------------ Tasklet 3.7: Cross-Record Pattern Matching (INS-G)
  {
    const current = { id: 'M-10', actions: [{ what: 'Resolve database latency' }], organisation_id: 'org_01' };
    const priorFew = [
      { id: 'M-01', actions: [{ what: 'Resolve database latency' }], organisation_id: 'org_01' },
      { id: 'M-02', actions: [{ what: 'Resolve database latency' }], organisation_id: 'org_01' }
    ];
    // Under 5 records: channel disabled
    const dormant = matchCrossRecordPatterns(current, priorFew);
    check('phase3-3.7', 'INS-G is disabled and dormant when corpus < 5 records', dormant.enabled === false);

    const priorMany = Array.from({ length: 22 }, (_, i) => ({
      id: `M-0${i + 1}`,
      actions: [{ what: 'Resolve database latency' }],
      organisation_id: 'org_01'
    }));
    const active = matchCrossRecordPatterns(current, priorMany);
    check('phase3-3.7', 'INS-G activates when corpus >= 5 records', active.enabled === true);
    check('phase3-3.7', 'INS-G names supporting prior record IDs',
      active.findings.length > 0 && active.findings[0].prior_record_ids.length > 0);
    check('phase3-3.7', 'INS-G enforces cap of 3', active.findings.length <= INS_G_CHANNEL.cap);

    // Cross-organisation isolation
    let crossOrgThrew = false;
    try {
      matchCrossRecordPatterns(current, [{ id: 'M-99', actions: [], organisation_id: 'org_OTHER' }]);
    } catch (e) {
      crossOrgThrew = true;
    }
    check('phase3-3.7', 'Cross-organisation pattern matching prohibited', crossOrgThrew);
  }

  // ------------------------------------------------------------------ Tasklet 3.8: Advisory Frame Library (INS-H)
  {
    const frames = applyAdvisoryFrames({}, ['pre-mortem analysis', 'second order consequence analysis']);
    check('phase3-3.8', 'INS-H applies registry advisory frames', frames.length === 2);
    check('phase3-3.8', 'INS-H enforces cap of 2', frames.length <= INS_H_CHANNEL.cap);
    check('phase3-3.8', 'INS-H observations framed as public frame heuristics',
      frames.every(f => f.observation_text.includes('Applying a')));

    // Prohibition of consulting firm names
    let threwMckinsey = false;
    try {
      validateNoConsultingFirms('We recommend adopting the McKinsey 7S framework');
    } catch (e) {
      if (e instanceof ConsultingFirmReferenceProhibitedError) threwMckinsey = true;
    }
    check('phase3-3.8', 'Consulting firm names strictly prohibited', threwMckinsey);
  }

  // ------------------------------------------------------------------ Tasklet 3.9: Insight Scoring Engine
  {
    const score = scoreInsight({
      insight_id: 'ins_01',
      insight_type: 'ABSENCE',
      confidence_score: 0.9,
      corroboration_count: 3,
      business_materiality_score: 8
    });
    check('phase3-3.9', 'Insight score generates composite priority score', score.composite_priority_score > 0);
    check('phase3-3.9', 'Corroboration count reflects anonymous slots', score.corroboration_count === 3);
  }

  // ------------------------------------------------------------------ Tasklet 3.10: Insight Prioritisation & Selection
  {
    const insATopics = ['marketing', 'legal', 'technical', 'financial', 'customer', 'supplier', 'environmental', 'governance'];
    const insETopics = ['database', 'frontend', 'infrastructure', 'compliance', 'security', 'billing', 'analytics', 'reporting'];
    const insFTopics = ['contract', 'license', 'roadmap', 'deployment', 'testing'];
    const insBTopics = ['growth', 'margin', 'retention', 'expansion', 'conversion'];

    const sampleFindings = [
      ...insATopics.map(t => ({ channel_id: 'INS-A', observation_text: 'Discussion unaddressed for ' + t })),
      ...insETopics.map(t => ({ channel_id: 'INS-E', observation_text: 'Sequential dependency bottleneck in ' + t })),
      ...insFTopics.map(t => ({ channel_id: 'INS-F', observation_text: 'Closure gap identified on ' + t })),
      ...insBTopics.map(t => ({ channel_id: 'INS-B', observation_text: 'Weak operational assumption regarding ' + t }))
    ];

    // At Tier T2: INS-B should be filtered out; INS-A capped at 5; INS-E capped at 6; INS-F capped at 3
    const curatedT2 = curateTopInsights('M-01', sampleFindings, 25, 'T2');
    const countsT2 = {};
    for (const f of curatedT2) countsT2[f.channel_id] = (countsT2[f.channel_id] || 0) + 1;

    check('phase3-3.10', 'T2 limits INS-A to cap of 5', countsT2['INS-A'] === 5);
    check('phase3-3.10', 'T2 limits INS-E to cap of 6', countsT2['INS-E'] === 6);
    check('phase3-3.10', 'T2 limits INS-F to cap of 3', countsT2['INS-F'] === 3);
    check('phase3-3.10', 'T2 does not activate INS-B', !countsT2['INS-B']);

    // At Tier T3: INS-B active and capped at 4
    const curatedT3 = curateTopInsights('M-01', sampleFindings, 30, 'T3');
    const countsT3 = {};
    for (const f of curatedT3) countsT3[f.channel_id] = (countsT3[f.channel_id] || 0) + 1;
    check('phase3-3.10', 'T3 activates INS-B and caps at 4', countsT3['INS-B'] === 4);
  }

  // ------------------------------------------------------------------ Tasklet 3.11: Insight Visualisation Engine
  {
    const riskSvg = renderRiskHeatmapSvg([{ severity: 4, likelihood: 4 }]);
    check('phase3-3.11', 'Generates valid 5x5 risk heatmap SVG (VIS-03)', riskSvg.includes('<svg') && riskSvg.includes('VIS-03'));

    const prioritySvg = renderPriorityMatrixSvg([{ impact: 8, effort: 3 }]);
    check('phase3-3.11', 'Generates valid priority matrix SVG (VIS-02)', prioritySvg.includes('<svg') && prioritySvg.includes('VIS-02'));

    const tornadoSvg = renderSensitivityTornadoSvg([{ name: 'Conversion Rate', low: 10, high: 20 }]);
    check('phase3-3.11', 'Generates valid sensitivity tornado SVG (VIS-20)', tornadoSvg.includes('<svg') && tornadoSvg.includes('VIS-20'));
  }

  // ------------------------------------------------------------------ Tasklet 3.12: Insight Reporting and Export
  {
    const items = [
      { channel_id: 'INS-A', observation_text: 'Missing financial review', comparison_basis: 'Standard Agenda' },
      { channel_id: 'INS-E', observation_text: 'Action 1 blocked by Decision 1', comparison_basis: 'Sequence Rule' }
    ];
    const html = compileInsightAnnexureHtml(items, { meeting_id: 'TEST-01' });
    const md = compileInsightAnnexureMarkdown(items, { meeting_id: 'TEST-01' });

    check('phase3-3.12', 'HTML export uses exact registry question as heading for INS-A',
      html.includes(`<h2>${REGISTRY_CHANNEL_HEADINGS['INS-A']}</h2>`));
    check('phase3-3.12', 'HTML export uses exact registry question as heading for INS-E',
      html.includes(`<h2>${REGISTRY_CHANNEL_HEADINGS['INS-E']}</h2>`));
    check('phase3-3.12', 'Markdown export uses exact registry question as heading',
      md.includes(`## ${REGISTRY_CHANNEL_HEADINGS['INS-A']}`));
  }
}
