/**
 * Phase 9 Test Suite: Copilot Consumption
 * Covers Tasklets 9.1 through 9.9.
 */

import { CopilotOutputRetrievalService, OutputExplanationEngine, GroundingGapDetectedError } from '../src/services/copilot/outputRetrievalService.mjs';
import { CopilotHealthRetrievalService, InsufficientHistoricalSamplesError } from '../src/services/copilot/healthRetrievalService.mjs';
import { CopilotInsightRetrievalService, CopilotRecommendationRetrievalService, CrossMeetingLimitExceededError } from '../src/services/copilot/insightRetrievalService.mjs';
import { CopilotBusinessPlanRetrievalService, CopilotExecutiveBriefRetrievalService, UnauthorizedDocumentAccessError, BriefNotCompiledError } from '../src/services/copilot/businessPlanRetrievalService.mjs';
import { CopilotGraphReferencesEngine, SourceAttributionService } from '../src/services/copilot/graphReferencesEngine.mjs';

export async function runPhase9Tests(check) {
  // --- Tasklet 9.1: Output Retrieval for Copilot ---
  {
    const ret = new CopilotOutputRetrievalService();
    ret.indexDocument('org_melb', {
      id: 'doc_1',
      title: 'Sales Strategy',
      standfirst: 'Growth plan for Melbourne region',
      sections: [{ heading: 'Goals', body: 'Reach 100 enterprise customers.' }],
    });

    const res = ret.retrieveRelevantOutputSnippets('Melbourne', 'org_melb');
    check('Phase 9', '9.1 Copilot retrieves relevant document snippets within tenant org', res.matchCount === 1);

    let crossTenantBlocked = false;
    try {
      ret.retrieveRelevantOutputSnippets('Melbourne', 'org_sydney');
    } catch (e) {
      if (e.name === 'RETRIEVAL_NO_MATCH') crossTenantBlocked = true;
    }
    check('Phase 9', '9.1 Copilot retrieval enforces tenant isolation', crossTenantBlocked);
  }

  // --- Tasklet 9.2: Output Explanation Engine ---
  {
    const exp = new OutputExplanationEngine();
    const doc = {
      decisions: [{ id: 'DEC-01', decision: 'Launch app in Australia', rationale: 'Home market focus', evidence_mark: 'confirmed' }],
      sections: [{ heading: 'Market', body: 'Australian SaaS market is expanding.', evidence_citations: ['Turn 12'] }],
    };

    const ans = exp.explainFromRecord('DEC-01', doc);
    check('Phase 9', '9.2 Copilot explains decision with verbatim citation', ans.grounded && ans.answer.includes('Home market focus'));

    let ungroundedRefused = false;
    try {
      exp.explainFromRecord('What is the forecast revenue for year 2030?', doc);
    } catch (e) {
      if (e instanceof GroundingGapDetectedError && e.message.includes('not discussed or recorded')) ungroundedRefused = true;
    }
    check('Phase 9', '9.2 Copilot refuses ungrounded questions without hallucinating', ungroundedRefused);
  }

  // --- Tasklet 9.3: Meeting Health Retrieval for Copilot ---
  {
    const healthCopilot = new CopilotHealthRetrievalService();
    const run = { composite_score: 75, band: 'Good', distribution_index: 0.28 };

    const individualAns = healthCopilot.answerHealthQuery('Who spoke most in yesterday session?', run);
    check('Phase 9', '9.3 Copilot refuses to answer who spoke most and cites zero individual scoring', individualAns.refused && individualAns.message.includes('does not compute, store, or display per-person metrics'));

    const benchmarkAns = healthCopilot.answerHealthQuery('How does this compare to the industry average?', run);
    check('Phase 9', '9.3 Copilot refuses external benchmark comparisons', benchmarkAns.refused && benchmarkAns.message.includes('does not compare meetings against external'));

    for (let i = 1; i <= 3; i++) {
      healthCopilot.indexHealthRun('series_board', { composite_score: 70 + i });
    }

    let min4Required = false;
    try {
      healthCopilot.compareSeriesTrend('series_board');
    } catch (e) {
      if (e instanceof InsufficientHistoricalSamplesError) min4Required = true;
    }
    check('Phase 9', '9.3 own-series comparison requires minimum of 4 meetings', min4Required);

    healthCopilot.indexHealthRun('series_board', { composite_score: 80 });
    const trend = healthCopilot.compareSeriesTrend('series_board');
    check('Phase 9', '9.3 own-series comparison succeeds with 4 meetings and canonical disclaimer', trend.meetingCount === 4 && trend.disclaimer.includes('Not a benchmark. Historical comparison is within this organisation'));
  }

  // --- Tasklet 9.4: Insight Retrieval for Copilot ---
  {
    const insightCopilot = new CopilotInsightRetrievalService();
    insightCopilot.indexInsights('m1', 'org_1', '2026-09-10', [
      { channel: 'INS-C', text: 'Has the regulatory approval timeline been accounted for', is_absence: true },
      { channel: 'INS-B', text: 'Assumption that team size doubles', is_absence: false },
    ]);

    const res = insightCopilot.queryInsightsAcrossMeetings('org_1', 15, 'pro_subscription');
    check('Phase 9', '9.4 Copilot insight retrieval ensures absence questions end with ?', res.insights[0].text.endsWith('?'));

    let limitExceeded = false;
    try {
      insightCopilot.queryInsightsAcrossMeetings('org_1', 45, 'pro_subscription');
    } catch (e) {
      if (e instanceof CrossMeetingLimitExceededError) limitExceeded = true;
    }
    check('Phase 9', '9.4 Pro subscription cross-meeting insight window is capped to 30 days', limitExceeded);
  }

  // --- Tasklet 9.5: Recommendation Retrieval for Copilot ---
  {
    const recCopilot = new CopilotRecommendationRetrievalService();
    recCopilot.indexRecommendations('org_1', [
      { id: 'REC-01', priority: 'P1', title: 'Verify RLS policies', status: 'PENDING', owner: 'Security Team' },
      { id: 'REC-02', priority: 'P3', title: 'Update documentation', status: 'OPEN', owner: 'Dev' },
    ]);

    const res = recCopilot.getOutstandingP1Recommendations('org_1');
    check('Phase 9', '9.5 Copilot retrieves outstanding P1 recommendations with owners', res.outstandingCount === 1 && res.recommendations[0].id === 'REC-01');
  }

  // --- Tasklet 9.6: Business Plan Retrieval for Copilot ---
  {
    const bpCopilot = new CopilotBusinessPlanRetrievalService();
    bpCopilot.indexPlan('org_1', 'plan_1', {
      executive_summary: 'SaaS meeting intelligence expansion.',
      financial_projections: { year1: 150000, year2: '[UNSTATED_FIGURE]' },
    });

    let accessDenied = false;
    try {
      bpCopilot.queryBusinessPlan('org_1', 'plan_1', 'financials', []);
    } catch (e) {
      if (e instanceof UnauthorizedDocumentAccessError) accessDenied = true;
    }
    check('Phase 9', '9.6 business plan retrieval requires governance_policy capability flag', accessDenied);

    const bpRes = bpCopilot.queryBusinessPlan('org_1', 'plan_1', 'financials', ['governance_policy']);
    check('Phase 9', '9.6 unstated financial figures are reported as explicit placeholders', bpRes.answer.includes('[UNSTATED_FIGURE] (explicit placeholder marker'));
  }

  // --- Tasklet 9.7: Executive Brief Retrieval for Copilot ---
  {
    const ebCopilot = new CopilotExecutiveBriefRetrievalService();
    ebCopilot.indexBrief('meet_100', {
      title: 'Executive Brief - Sprint Review',
      standfirst: 'Key deliverable review',
      decisions: [{ decision: 'Ship Phase 7-11' }],
      actions: [{ owner: 'Anthony', action: 'Verify CI' }],
    });

    const card = ebCopilot.retrieveBriefCard('meet_100');
    check('Phase 9', '9.7 executive brief card returns in under 1.2s', card.responseTimeMs < 1200 && card.keyDeterminations.length === 1);

    let uncompiledError = false;
    try {
      ebCopilot.retrieveBriefCard('meet_unknown');
    } catch (e) {
      if (e instanceof BriefNotCompiledError) uncompiledError = true;
    }
    check('Phase 9', '9.7 uncompiled brief returns BRIEF_NOT_COMPILED', uncompiledError);
  }

  // --- Tasklet 9.8: Knowledge Graph References Engine ---
  {
    const graph = new CopilotGraphReferencesEngine();
    graph.addNode({ id: 'node_org', organisation_id: 'org_1', type: 'ORGANISATION', name: 'Concludo' });
    graph.addNode({ id: 'node_proj', organisation_id: 'org_1', type: 'PROJECT', name: 'Workspace SaaS' });
    graph.addEdge({ source_id: 'node_org', target_id: 'node_proj', organisation_id: 'org_1', relation: 'OWNS' });

    const traversal = graph.traverse('node_org', 'org_1', 1, ['governance_policy']);
    check('Phase 9', '9.8 graph traversal connects entities within tenant organisation', traversal.connectedEntities.length === 2);

    let personMetricBlocked = false;
    try {
      graph.addNode({ id: 'node_person', organisation_id: 'org_1', type: 'PERSON', talk_time: 450 });
    } catch (e) {
      if (e.message.includes('Person nodes cannot store behavioural metrics')) personMetricBlocked = true;
    }
    check('Phase 9', '9.8 person nodes cannot store individual behavioural metrics', personMetricBlocked);
  }

  // --- Tasklet 9.9: Source Attribution and Citation Service ---
  {
    const attrService = new SourceAttributionService();
    attrService.registerTranscript('tr_1', 'Anthony stated that Australian data residency is a non-negotiable legal requirement for local healthcare clients.');

    const goodRes = attrService.verifyAndSanitizeResponse('Anthony said "Australian data residency is a non-negotiable legal requirement" during the call.', 'tr_1');
    check('Phase 9', '9.9 verbatim transcript quote passes attribution verification', goodRes.isFullyGrounded && goodRes.strippedCount === 0);

    const badRes = attrService.verifyAndSanitizeResponse('Anthony said "we plan to expand into outer space next year" during the call.', 'tr_1');
    check('Phase 9', '9.9 ungrounded quoted claim is stripped and recorded', !badRes.isFullyGrounded && badRes.strippedCount === 1 && badRes.cleanText.includes('[UNVERIFIABLE_CITATION_REMOVED]'));
  }
}
