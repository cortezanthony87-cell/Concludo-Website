/**
 * Phase 8 Test Suite: Output JSON Schema Framework
 * Covers Tasklets 8.1 through 8.11.
 */

import { validateCoreOutputEnvelope, CoreSchemaValidationError } from '../src/schemas/coreOutputSchema.mjs';
import { validateBusinessPlanPayload, validateExecutiveBriefPayload, ExecutiveBriefLengthExceededError } from '../src/schemas/businessPlanSchema.mjs';
import { validateMeetingHealthPayload, validateDecisionPackPayload, IndividualScoringSchemaViolationError, DecisionRationaleMissingError } from '../src/schemas/meetingHealthSchema.mjs';
import { validateRoadmapPayload, validateRiskPayload, validateOpportunityPayload, InvalidDateFormatError, RiskCitationMissingError, OpportunityProponentMissingError } from '../src/schemas/roadmapSchema.mjs';
import { validateVisualisationPayload, VisualSchemaMismatchError, VISUAL_MODELS } from '../src/schemas/visualisationSchema.mjs';
import { validateIntelligencePayload, UpstreamIntelligenceInvalidError } from '../src/schemas/intelligenceSchema.mjs';
import { SchemaMigrationService } from '../src/services/schemaMigrationService.mjs';

export async function runPhase8Tests(check) {
  // --- Tasklet 8.1: Core Output Schema ---
  {
    const validEnvelope = {
      outputId: 'out_001',
      version: '1.0',
      organisationId: 'org_001',
      meetingMetadata: { title: 'Strategy' },
      provenance: { capture: 'Upload' },
      sections: [{ heading: 'Overview', body: 'Content' }],
    };
    check('Phase 8', '8.1 valid core output envelope passes', validateCoreOutputEnvelope(validEnvelope).ok);

    let missingBlocked = false;
    try {
      validateCoreOutputEnvelope({ outputId: 'out_001' });
    } catch (e) {
      if (e instanceof CoreSchemaValidationError) missingBlocked = true;
    }
    check('Phase 8', '8.1 core output schema blocks missing mandatory fields', missingBlocked);
  }

  // --- Tasklet 8.2: Business Plan Schema ---
  {
    const validPlan = {
      executive_summary: 'Summary text',
      company_description: 'Concludo Pty Ltd',
      market_analysis: 'SaaS meeting intelligence',
      operational_plan: 'Cloud infrastructure',
      financial_projections: {
        year1_arr: 120000,
        year2_arr: '[UNSTATED_FIGURE]',
      },
    };
    check('Phase 8', '8.2 business plan validates with numeric and placeholder figures', validateBusinessPlanPayload(validPlan).ok);
  }

  // --- Tasklet 8.3: Executive Brief Schema ---
  {
    const validBrief = {
      executiveSummary: 'Short executive summary under 1500 chars.',
      determinations: ['Approved next step'],
    };
    check('Phase 8', '8.3 executive brief validates under length ceiling', validateExecutiveBriefPayload(validBrief).ok);

    let lengthExceeded = false;
    try {
      validateExecutiveBriefPayload({
        executiveSummary: 'A'.repeat(1501),
        determinations: ['Exceeded'],
      });
    } catch (e) {
      if (e instanceof ExecutiveBriefLengthExceededError) lengthExceeded = true;
    }
    check('Phase 8', '8.3 executive brief schema rejects summaries exceeding 1,500 chars', lengthExceeded);
  }

  // --- Tasklet 8.4: Meeting Health Schema ---
  {
    const validHealth = {
      dimensions: { D1: 85, D2: 70, D3: 90 },
      composite_score: 82,
      individual_scores: null,
    };
    check('Phase 8', '8.4 meeting health schema validates meeting-level scores', validateMeetingHealthPayload(validHealth).ok);

    let individualScoreBlocked = false;
    try {
      validateMeetingHealthPayload({
        composite_score: 80,
        individual_scores: { speaker_1: 85 },
      });
    } catch (e) {
      if (e instanceof IndividualScoringSchemaViolationError) individualScoreBlocked = true;
    }
    check('Phase 8', '8.4 meeting health schema rejects any per-person score', individualScoreBlocked);
  }

  // --- Tasklet 8.5: Decision Pack Schema ---
  {
    const validPack = {
      decisions: [
        { id: 'DEC-01', decision: 'Launch Workspace', rationale: 'Product ready', evidence_mark: 'confirmed' }
      ],
    };
    check('Phase 8', '8.5 decision pack validates confirmed decisions with rationale', validateDecisionPackPayload(validPack).ok);

    let missingRationale = false;
    try {
      validateDecisionPackPayload({
        decisions: [{ id: 'DEC-01', decision: 'Launch Workspace', rationale: '' }],
      });
    } catch (e) {
      if (e instanceof DecisionRationaleMissingError) missingRationale = true;
    }
    check('Phase 8', '8.5 decision pack schema rejects decisions with missing rationale', missingRationale);

    let inferredRejected = false;
    try {
      validateDecisionPackPayload({
        decisions: [{ id: 'DEC-02', decision: 'Guessed action', rationale: 'Inferred by model', evidence_mark: 'inferred' }],
      });
    } catch (e) {
      if (e.message.includes('DECISION_INFERRED_PROHIBITED')) inferredRejected = true;
    }
    check('Phase 8', '8.5 decision pack schema strictly rejects inferred decisions', inferredRejected);
  }

  // --- Tasklet 8.6: Roadmap Schema ---
  {
    const validRoadmap = {
      milestones: [
        { id: 'MS-01', title: 'Beta Launch', date: '2026-10-01' },
        { id: 'MS-02', title: 'Enterprise SSO', date: 'unscheduled' },
      ],
    };
    check('Phase 8', '8.6 roadmap validates ISO dates and unscheduled marker', validateRoadmapPayload(validRoadmap).ok);

    let invalidDateBlocked = false;
    try {
      validateRoadmapPayload({
        milestones: [{ id: 'MS-03', title: 'Bad Date', date: 'Tomorrow afternoon' }],
      });
    } catch (e) {
      if (e instanceof InvalidDateFormatError) invalidDateBlocked = true;
    }
    check('Phase 8', '8.6 roadmap schema rejects non-ISO date formats', invalidDateBlocked);
  }

  // --- Tasklet 8.7: Risk Schema ---
  {
    const validRisks = {
      risks: [
        { id: 'RSK-01', risk: 'Latency in transcribing', probability: 2, impact: 3, citations: ['Turn 14'] }
      ],
    };
    check('Phase 8', '8.7 risk schema validates grounded risk record', validateRiskPayload(validRisks).ok);

    let missingCitation = false;
    try {
      validateRiskPayload({
        risks: [{ id: 'RSK-02', risk: 'Ungrounded speculative risk', probability: 4, impact: 4, citations: [] }],
      });
    } catch (e) {
      if (e instanceof RiskCitationMissingError) missingCitation = true;
    }
    check('Phase 8', '8.7 risk schema rejects risks without verifiable citations', missingCitation);
  }

  // --- Tasklet 8.8: Opportunity Schema ---
  {
    const validOpp = {
      opportunities: [
        { id: 'OPP-01', opportunity: 'Commercial pilot', stated_by: 'Managing Director', stated_aud_value: 50000 }
      ],
    };
    check('Phase 8', '8.8 opportunity schema validates stated opportunity with proponent', validateOpportunityPayload(validOpp).ok);

    let missingProponent = false;
    try {
      validateOpportunityPayload({
        opportunities: [{ id: 'OPP-02', opportunity: 'Hallucinated partnership', stated_by: '' }],
      });
    } catch (e) {
      if (e instanceof OpportunityProponentMissingError) missingProponent = true;
    }
    check('Phase 8', '8.8 opportunity schema rejects opportunities without stated_by proponent', missingProponent);
  }

  // --- Tasklet 8.9: Visualisation Schema ---
  {
    check('Phase 8', '8.9 all 28 visual models are defined with preconditions and fallbacks', Object.keys(VISUAL_MODELS).length === 28);
    check('Phase 8', '8.9 VIS-03 5x5 heatmap requires risks', validateVisualisationPayload('VIS-03', { risks: [{ probability: 3, impact: 3 }] }).ok);

    let vis27Blocked = false;
    try {
      validateVisualisationPayload('VIS-27', { individual_scores: { speaker_a: 50 } });
    } catch (e) {
      if (e instanceof VisualSchemaMismatchError) vis27Blocked = true;
    }
    check('Phase 8', '8.9 VIS-27 schema strictly rejects per-speaker measurements', vis27Blocked);
  }

  // --- Tasklet 8.10: Intelligence Schema ---
  {
    const validRecord = {
      meeting_context: { title: 'Executive Session' },
      health: { individual_scores: null, composite_score: 80 },
      insights_v2: [{ id: 'INS-01', text: 'Assumption tested', about_an_individual: false }],
      routing: [{ id: 'RT-01', human_check_required: true }],
      opportunities: [{ id: 'OP-01', opportunity: 'Pilot', stated_by: 'Anthony', basis_given: 'Discussion', evidence: 'Quote', source_basis: 'Audio' }],
    };
    check('Phase 8', '8.10 intelligence schema validates MeetingRecord 1.1 constraints', validateIntelligencePayload(validRecord).ok);

    let individualAboutBlocked = false;
    try {
      validateIntelligencePayload({
        insights_v2: [{ id: 'INS-02', text: 'Personal comment', about_an_individual: true }],
      });
    } catch (e) {
      if (e instanceof UpstreamIntelligenceInvalidError) individualAboutBlocked = true;
    }
    check('Phase 8', '8.10 intelligence schema rejects about_an_individual = true', individualAboutBlocked);

    let humanCheckBypassBlocked = false;
    try {
      validateIntelligencePayload({
        routing: [{ id: 'RT-02', human_check_required: false }],
      });
    } catch (e) {
      if (e instanceof UpstreamIntelligenceInvalidError) humanCheckBypassBlocked = true;
    }
    check('Phase 8', '8.10 intelligence schema rejects human_check_required = false', humanCheckBypassBlocked);
  }

  // --- Tasklet 8.11: Version Control Framework ---
  {
    const migrator = new SchemaMigrationService();
    const doc10 = { id: 'doc_10', title: 'Old Record 1.0', summary: 'Original text' };
    const doc11 = migrator.migratePayload(doc10, '1.0', '1.1');

    check('Phase 8', '8.11 migration from 1.0 to 1.1 preserves original content', doc11.summary === 'Original text' && doc11.schema_version === '1.1');
    check('Phase 8', '8.11 migration injects typed null individual_scores', doc11.health.individual_scores === null);
  }
}
