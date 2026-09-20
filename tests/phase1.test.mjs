/**
 * Phase 1 Test Suite: Core Output Foundation
 *
 * Verifies Tasklets 1.1 to 1.8, 1.10, and 1.11.
 */
import {
  getAllOutputs,
  getOutputById,
  getOutputsByTier,
  validateOutputEligibility,
} from '../src/services/outputRegistryService.mjs';

import {
  validateFiveFieldAction,
  ingestPipelineArtifacts,
} from '../src/services/intelligenceIngestionService.mjs';

import {
  classifyMeeting,
  getMeetingTaxonomy,
} from '../src/services/meetingClassificationService.mjs';

import { buildRecommendedBundle } from '../src/services/packageBuilderService.mjs';
import { OutputOrchestrator } from '../src/services/outputOrchestrator.mjs';
import { OutputLifecycleService } from '../src/services/outputLifecycleService.mjs';
import { OutputPersistenceService } from '../src/services/outputPersistenceService.mjs';
import { OutputRetrievalService } from '../src/services/outputRetrievalService.mjs';
import {
  extractRisksFromTranscript,
  calculateRiskScore,
  validateRiskGrounding,
} from '../src/services/riskExtractionService.mjs';
import {
  extractOpportunitiesFromTranscript,
  validateOpportunity,
} from '../src/services/opportunityExtractionService.mjs';

import { baseRecord, sparseRecord, restrictedRecord } from '../fixtures/build.mjs';

export function runPhase1Tests(check) {
  // -------------------------------------------------- Tasklet 1.1: Output Registry
  {
    const outputs = getAllOutputs();
    check('phase1:registry', 'registry returns all 58 output deliverables', outputs.length === 58);

    const out01 = getOutputById('OUT-01');
    check('phase1:registry', 'OUT-01 exists and has valid name', out01.name === 'Executive Summary');

    const starterOutputs = getOutputsByTier('starter');
    const proOutputs = getOutputsByTier('pro_subscription');
    const teamOutputs = getOutputsByTier('team');
    check('phase1:registry', 'starter tier outputs are a subset of pro outputs', starterOutputs.length < proOutputs.length);
    check('phase1:registry', 'pro tier outputs are a subset of team outputs', proOutputs.length <= teamOutputs.length);

    check('phase1:registry', 'eligibility check permits starter for OUT-01', validateOutputEligibility('OUT-01', 'starter'));
    check('phase1:registry', 'eligibility check denies starter for OUT-09', !validateOutputEligibility('OUT-09', 'starter'));
    check('phase1:registry', 'eligibility check permits pro for OUT-09', validateOutputEligibility('OUT-09', 'pro_subscription'));
  }

  // -------------------------------------------------- Tasklet 1.2: Intelligence Ingestion & 5-Field Delegation
  {
    const completeAction = {
      owner: { name: 'Anthony Cortez', status: 'stated' },
      action: 'Deploy Phase 1 intelligence pipeline',
      due_date: '2026-09-20',
      evidence: 'confirmed',
      definition_of_done: 'All CI checks green in repository',
    };
    const vComplete = validateFiveFieldAction(completeAction);
    check('phase1:ingestion', 'compliant 5-field action validates', vComplete.valid);

    const incompleteAction = {
      owner: { name: '', status: 'unassigned' },
      action: 'Review document',
      due_date: null,
      evidence: 'inferred',
      definition_of_done: null,
    };
    const vIncomplete = validateFiveFieldAction(incompleteAction);
    check('phase1:ingestion', 'incomplete action is flagged with specific issues', !vIncomplete.valid && vIncomplete.issues.length >= 3);

    const ingested = ingestPipelineArtifacts('mtg_test_01', {
      speakers: [{ id: 'spk_1', name: 'Anthony', role: 'Lead' }],
      actions: [completeAction, incompleteAction],
      decisions: [{ text: 'Approved plan', evidence: 'confirmed' }],
      completed_stages: [1, 2, 3, 4, 5, 6, 7],
    });
    check('phase1:ingestion', 'pipeline artifacts ingested with compliant action flags', ingested.extracted_actions[0].five_field_compliant);
    check('phase1:ingestion', 'incomplete action flagged non-compliant in ingestion', !ingested.extracted_actions[1].five_field_compliant);
  }

  // -------------------------------------------------- Tasklet 1.3: Meeting Classification
  {
    const taxonomy = getMeetingTaxonomy();
    check('phase1:classification', 'taxonomy contains defined archetypes', taxonomy.types.length > 0);
    check('phase1:classification', 'taxonomy contains 34 standard scenario bundles', taxonomy.bundles.length === 34);

    const classification = classifyMeeting('mtg_test_02', { meeting_type: 'MT-A01', objective: 'decide' });
    check('phase1:classification', 'correctly classifies executive strategy session', classification.archetype_name === 'Executive Strategy Session');
    check('phase1:classification', 'matches scenario bundle S01', classification.recommended_bundle.scenario === 'S01');
  }

  // -------------------------------------------------- Tasklet 1.4: Output Package Builder & Gates
  {
    const sparse = sparseRecord();
    const sparseBundle = buildRecommendedBundle(sparse, { tier: 'pro_subscription' });
    check('phase1:bundle', 'omitted deliverables are populated with all 4 fields',
      sparseBundle.stated_omissions.every((o) =>
        Boolean(o.output_name && o.gate_failed && o.missing_evidence && o.what_would_be_needed_next_time)
      )
    );
    check('phase1:bundle', 'evidence sufficiency gate fires on sparse record',
      sparseBundle.stated_omissions.some((o) => o.gate_failed === 'evidence_sufficiency')
    );

    const restricted = restrictedRecord();
    const restrictedBundle = buildRecommendedBundle(restricted, { restricted: true, tier: 'team' });
    check('phase1:bundle', 'restricted record fails at confidentiality gate first',
      restrictedBundle.stated_omissions.some((o) => o.gate_failed === 'confidentiality')
    );
    check('phase1:bundle', 'restricted path only allows allowlisted outputs',
      restrictedBundle.selected_output_ids.every((id) =>
        ['OUT-01', 'OUT-03', 'OUT-04', 'OUT-07', 'OUT-10'].includes(id)
      )
    );
  }

  // -------------------------------------------------- Tasklet 1.5: Output Orchestrator
  {
    const orch = new OutputOrchestrator({ maxConcurrentPerMeeting: 2 });
    orch.enqueueJob({ bundlePlanId: 'bp_1', meetingId: 'm_1', organisationId: 'org_1', outputId: 'OUT-01' });
    orch.enqueueJob({ bundlePlanId: 'bp_1', meetingId: 'm_1', organisationId: 'org_1', outputId: 'OUT-02' });
    orch.enqueueJob({ bundlePlanId: 'bp_1', meetingId: 'm_1', organisationId: 'org_1', outputId: 'OUT-03' });

    const job1 = orch.claimNextJob('worker_A');
    const job2 = orch.claimNextJob('worker_B');
    const job3 = orch.claimNextJob('worker_C');

    check('phase1:orchestrator', 'worker A claims job 1', job1 && job1.output_id === 'OUT-01');
    check('phase1:orchestrator', 'worker B claims job 2', job2 && job2.output_id === 'OUT-02');
    check('phase1:orchestrator', 'concurrency cap of 2 prevents claiming job 3 while 2 are active', job3 === null);

    orch.completeJob(job1.id, 'worker_A', { rendered: true });
    const job3After = orch.claimNextJob('worker_C');
    check('phase1:orchestrator', 'worker C claims job 3 after job 1 completes', job3After && job3After.output_id === 'OUT-03');
  }

  // -------------------------------------------------- Tasklet 1.6: Output Lifecycle FSM
  {
    const fsm = new OutputLifecycleService();
    check('phase1:lifecycle', 'permits DRAFT_GENERATED to QA_AUDITED', fsm.canTransition('DRAFT_GENERATED', 'QA_AUDITED'));
    check('phase1:lifecycle', 'rejects illegal skip from DRAFT_GENERATED to PUBLISHED', !fsm.canTransition('DRAFT_GENERATED', 'PUBLISHED'));

    const evt1 = fsm.transition({
      outputInstanceId: 'inst_01',
      organisationId: 'org_01',
      fromState: 'DRAFT_GENERATED',
      toState: 'QA_AUDITED',
      actorId: 'usr_qa',
      reason: 'Passed automated DQI check',
    });
    check('phase1:lifecycle', 'records valid lifecycle transition event', evt1.from_state === 'DRAFT_GENERATED' && evt1.to_state === 'QA_AUDITED');

    let illegalCaught = false;
    try {
      fsm.transition({
        outputInstanceId: 'inst_01',
        organisationId: 'org_01',
        fromState: 'QA_AUDITED',
        toState: 'PUBLISHED',
        actorId: 'usr_pub',
      });
    } catch (e) {
      if (e.code === 'ILLEGAL_LIFECYCLE_TRANSITION') illegalCaught = true;
    }
    check('phase1:lifecycle', 'throws ILLEGAL_LIFECYCLE_TRANSITION on invalid transition', illegalCaught);
  }

  // -------------------------------------------------- Tasklet 1.7: Output Persistence & Versioning
  {
    const persist = new OutputPersistenceService();
    const r1 = persist.saveOutput({
      meetingId: 'mtg_01',
      organisationId: 'org_01',
      outputId: 'OUT-01',
      title: 'Executive Summary v1',
      structuredPayload: { summary: 'Initial draft', api_key: 'secret-to-strip' },
    });
    check('phase1:persistence', 'first save gets version 1', r1.version === 1);
    check('phase1:persistence', 'sensitive credentials stripped from payload', r1.structured_payload.api_key === undefined);

    const r2 = persist.saveOutput({
      meetingId: 'mtg_01',
      organisationId: 'org_01',
      outputId: 'OUT-01',
      title: 'Executive Summary v2',
      structuredPayload: { summary: 'Second draft' },
    });
    check('phase1:persistence', 'regeneration cleanly bumps version to 2', r2.version === 2);

    persist.softDelete(r1.id, 'user_admin');
    const deletedR1 = persist.getOutputById(r1.id);
    check('phase1:persistence', 'soft delete sets deleted_at and 30-day purge_after',
      deletedR1.deleted_at !== null && Boolean(deletedR1.purge_after)
    );

    // Legal hold suspends purge
    persist.setLegalHold(r1.id, true);
    const futureDate = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000); // 40 days later
    const purgedWithHold = persist.purgeExpired(futureDate);
    check('phase1:persistence', 'legal hold suspends purge of expired record', !purgedWithHold.includes(r1.id));

    persist.setLegalHold(r1.id, false);
    const purgedWithoutHold = persist.purgeExpired(futureDate);
    check('phase1:persistence', 'expired record purges once legal hold is lifted', purgedWithoutHold.includes(r1.id));
  }

  // -------------------------------------------------- Tasklet 1.8: Output Retrieval
  {
    const persist = new OutputPersistenceService();
    persist.saveOutput({
      meetingId: 'mtg_search_1',
      organisationId: 'org_1',
      outputId: 'OUT-01',
      title: 'Strategic Architecture Review',
      summary: 'Summary of the technical design',
      renderedHtml: '<div>Heavy HTML body...</div>',
      structuredPayload: { nodes: 100 },
    });

    const retrieval = new OutputRetrievalService(persist);
    const list = retrieval.getMeetingOutputs('mtg_search_1', { includeRendered: false });
    check('phase1:retrieval', 'retrieval respects projection filter and omits heavy HTML', list[0].rendered_html === undefined);

    const search = retrieval.searchOutputs('org_1', { term: 'architecture' });
    check('phase1:retrieval', 'search returns matching output by keyword', search.items.length === 1);
  }

  // -------------------------------------------------- Tasklet 1.10: Risk and Blocker Extraction
  {
    const validRisk = {
      risk_title: 'API rate limit threshold breach',
      description: 'Upstream provider throttles concurrent requests during peak hours',
      category: 'TECHNICAL',
      probability: 0.6,
      impact_severity: 4,
      evidence_citations: [
        { timestamp: '00:14:22', speaker: 'Anthony Cortez', quote: 'We are seeing throttle events on the upstream API.' },
      ],
    };

    const invalidRiskNoCitation = {
      risk_title: 'Competitor price drop',
      description: 'Competitor might reduce prices next quarter',
      category: 'STRATEGIC',
      probability: 0.5,
      impact_severity: 3,
      evidence_citations: [], // zero citations
    };

    const result = extractRisksFromTranscript([validRisk, invalidRiskNoCitation]);
    check('phase1:risks', 'valid risk with verbatim citation is extracted', result.risks.length === 1);
    check('phase1:risks', 'ungrounded risk lacking citation is rejected', result.rejected.length === 1);
    check('phase1:risks', 'calculates accurate 5x5 matrix risk score (0.6 * 4 = 2.4)', result.risks[0].risk_score === 2.4);
  }

  // -------------------------------------------------- Tasklet 1.11: Opportunity Extraction
  {
    const validOpportunity = {
      title: 'Enterprise Single Sign-On add-on',
      description: 'Several prospective customers requested SAML/Okta support',
      potential_value_category: 'REVENUE_GROWTH',
      estimated_value_aud: 15000,
      explicitly_stated_figure: true,
      feasibility_score: 4,
      strategic_fit_score: 5,
      stated_by: 'Anthony Cortez',
      status: 'stated',
    };

    const invalidInferredOpportunity = {
      title: 'Introduce mobile app',
      description: 'Concludo could benefit from an iOS native app',
      stated_by: 'Concludo AI Engine',
      status: 'inferred',
      is_inferred: true,
    };

    const invalidNoProponent = {
      title: 'Partner with cloud providers',
      description: 'General idea mentioned without owner',
      stated_by: '',
      status: 'stated',
    };

    const result = extractOpportunitiesFromTranscript([validOpportunity, invalidInferredOpportunity, invalidNoProponent]);
    check('phase1:opportunity', 'stated opportunity with named proponent is extracted', result.opportunities.length === 1);
    check('phase1:opportunity', 'inferred opportunity is rejected (prohibited in Tasklet 1.11)',
      result.rejected.some((r) => r.reason.includes('INFERRED_OPPORTUNITY_PROHIBITED'))
    );
    check('phase1:opportunity', 'opportunity without named proponent is rejected',
      result.rejected.some((r) => r.reason.includes('MISSING_PROPONENT'))
    );
    check('phase1:opportunity', 'stated financial value is accurately preserved', result.opportunities[0].estimated_value_aud === 15000);
  }
}
