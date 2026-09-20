/**
 * Phase 5 Business Document Generation Test Suite (Tasklets 5.1 to 5.17)
 * 
 * Verifies all 17 document generators (GEN-01 to GEN-17) producing publication-ready
 * HTML/document artefacts across templates T1 to T17.
 * Tests coverage floors, restricted record refusals, qualified review notices,
 * brand language, and zero invented data.
 */

import {
  GENERATOR_CATALOGUE,
  getGeneratorByTemplate,
  getGeneratorById
} from '../src/services/generators/generatorRegistry.mjs';

import {
  compileDocumentByTemplate,
  generateBusinessPlanT4,
  generateLeadershipBriefT13,
  generateBoardBriefingT14,
  generateDecisionPackT15,
  generateActionPlanT7,
  generateStrategyPaperT6,
  generateTransformationPlanT9,
  generateRoadmapT8,
  generateRiskRegisterT10,
  generateOpportunityReportT11,
  generateMeetingReportT2,
  generateMeetingPerformanceReportT17,
  generateExecutiveSummaryT1,
  generateBusinessCaseT3,
  generateOperatingModelT5,
  generateProgramReportT12,
  generateRecommendationPaperT16,
  QUALIFIED_REVIEW_NOTICE,
  NOT_A_BENCHMARK,
  RestrictedReportGenerationRefusedError,
  CoverageFloorUnmetError,
  escapeHtml
} from '../src/services/generators/documentGenerators.mjs';

import { baseRecord, restrictedRecord, sparseRecord } from '../fixtures/build.mjs';

export function runPhase5Tests(check) {
  // 1. Generator Registry Mapping
  {
    const allGens = Object.keys(GENERATOR_CATALOGUE);
    check('phase5', 'all 17 generators GEN-01 to GEN-17 are registered', allGens.length === 17);
    check('phase5', 'GEN-01 maps to T4 and OUT-23', GENERATOR_CATALOGUE['GEN-01']?.template === 'T4' && GENERATOR_CATALOGUE['GEN-01']?.primary_output === 'OUT-23');
    check('phase5', 'GEN-11 maps to T2 and OUT-37', GENERATOR_CATALOGUE['GEN-11']?.template === 'T2' && GENERATOR_CATALOGUE['GEN-11']?.primary_output === 'OUT-37');
    check('phase5', 'GEN-12 maps to T17 and OUT-09', GENERATOR_CATALOGUE['GEN-12']?.template === 'T17' && GENERATOR_CATALOGUE['GEN-12']?.primary_output === 'OUT-09');
    check('phase5', 'lookup by template works for T14', getGeneratorByTemplate('T14')?.id === 'GEN-03');
    check('phase5', 'lookup by id works for GEN-05', getGeneratorById('GEN-05')?.template === 'T7');
  }

  // 2. Tasklet 5.1 (GEN-01): Business Plan Generator (T4 / OUT-23)
  {
    const rec = baseRecord();
    const doc = generateBusinessPlanT4(rec);
    check('phase5', 'GEN-01 compiles T4 business plan', doc.generator_id === 'GEN-01' && doc.template_id === 'T4' && doc.output_id === 'OUT-23');
    check('phase5', 'GEN-01 includes qualified review notice', doc.html.includes(QUALIFIED_REVIEW_NOTICE));
    
    // Coverage floor check
    const thin = sparseRecord();
    let floorBlocked = false;
    try {
      generateBusinessPlanT4(thin, { enforceFloor: true });
    } catch (err) {
      if (err instanceof CoverageFloorUnmetError) floorBlocked = true;
    }
    check('phase5', 'GEN-01 enforces 6 section coverage floor when required', floorBlocked);
  }

  // 3. Tasklet 5.2 (GEN-02): Leadership Brief Generator (T13 / OUT-51)
  {
    const rec = baseRecord();
    const doc = generateLeadershipBriefT13(rec);
    check('phase5', 'GEN-02 compiles T13 leadership brief', doc.generator_id === 'GEN-02' && doc.template_id === 'T13' && doc.output_id === 'OUT-51');
    check('phase5', 'GEN-02 includes qualified review notice', doc.html.includes(QUALIFIED_REVIEW_NOTICE));
  }

  // 4. Tasklet 5.3 (GEN-03): Board Briefing Paper (T14 / OUT-52)
  {
    const rec = baseRecord();
    const doc = generateBoardBriefingT14(rec);
    check('phase5', 'GEN-03 compiles T14 board briefing paper', doc.generator_id === 'GEN-03' && doc.template_id === 'T14');
    check('phase5', 'GEN-03 designates working record rather than minutes', doc.is_working_record === true && doc.html.includes('Not Legal Minutes'));
    check('phase5', 'GEN-03 includes qualified review notice', doc.html.includes(QUALIFIED_REVIEW_NOTICE));
  }

  // 5. Tasklet 5.4 (GEN-04): Decision Pack Generator (T15 / OUT-53, OUT-11)
  {
    const rec = baseRecord();
    const doc = generateDecisionPackT15(rec);
    check('phase5', 'GEN-04 compiles T15 decision pack', doc.generator_id === 'GEN-04' && doc.template_id === 'T15' && doc.output_id === 'OUT-53');
    check('phase5', 'GEN-04 counts stated decisions accurately', doc.decision_count === (rec.decisions?.length || 0));
  }

  // 6. Tasklet 5.5 (GEN-05): Action Plan Generator (T7 / OUT-07, OUT-03)
  {
    const rec = baseRecord();
    const doc = generateActionPlanT7(rec);
    check('phase5', 'GEN-05 compiles T7 action plan', doc.generator_id === 'GEN-05' && doc.template_id === 'T7');
    check('phase5', 'GEN-05 partitions actions across Now Next Later', doc.html.includes('Now') && doc.html.includes('Next') && doc.html.includes('Later'));
  }

  // 7. Tasklet 5.6 (GEN-06) to Tasklet 5.10 (GEN-10): Strategy, Transformation, Roadmap, Risk, Opportunity
  {
    const rec = baseRecord();
    const t6 = generateStrategyPaperT6(rec);
    const t9 = generateTransformationPlanT9(rec);
    const t8 = generateRoadmapT8(rec);
    const t10 = generateRiskRegisterT10(rec);
    const t11 = generateOpportunityReportT11(rec);

    check('phase5', 'GEN-06 compiles T6 strategy paper', t6.generator_id === 'GEN-06' && t6.template_id === 'T6');
    check('phase5', 'GEN-07 compiles T9 transformation plan', t9.generator_id === 'GEN-07' && t9.template_id === 'T9');
    check('phase5', 'GEN-08 compiles T8 roadmap view', t8.generator_id === 'GEN-08' && t8.template_id === 'T8');
    check('phase5', 'GEN-09 compiles T10 risk register', t10.generator_id === 'GEN-09' && t10.template_id === 'T10' && t10.risk_count === (rec.risks?.length || 0));
    check('phase5', 'GEN-10 compiles T11 opportunity report', t11.generator_id === 'GEN-10' && t11.template_id === 'T11');
  }

  // 8. Tasklet 5.11 (GEN-11): Meeting Report Generator (T2 / OUT-37)
  {
    const rec = baseRecord();
    const doc = generateMeetingReportT2(rec);
    check('phase5', 'GEN-11 compiles T2 meeting report', doc.generator_id === 'GEN-11' && doc.template_id === 'T2' && doc.output_id === 'OUT-37');
  }

  // 9. Tasklet 5.12 (GEN-12): Meeting Performance Report Generator (T17 / OUT-09)
  {
    const rec = baseRecord();
    const healthPayload = {
      composite_score: 82,
      band: 'Good',
      dimension_scores: {
        D1: { score: 10, weight: 12 },
        D2: { score: 7, weight: 8 }
      }
    };
    const doc = generateMeetingPerformanceReportT17(rec, healthPayload);
    check('phase5', 'GEN-12 compiles T17 meeting performance report', doc.generator_id === 'GEN-12' && doc.template_id === 'T17');
    check('phase5', 'GEN-12 is designated internal diagnostic only', doc.internal_only === true);
    check('phase5', 'GEN-12 renders verbatim NOT_A_BENCHMARK statement', doc.html.includes(NOT_A_BENCHMARK));
    check('phase5', 'GEN-12 accurately captures authoritative score', doc.score === 82 && doc.band === 'Good');

    // Does not invent default score 78 or 'Good' when payload is null
    const unscoredDoc = generateMeetingPerformanceReportT17(rec, null);
    check('phase5', 'GEN-12 does not invent score 78 when payload is null', unscoredDoc.score === null && unscoredDoc.band === null);
    check('phase5', 'GEN-12 displays unscored notice when score is null', unscoredDoc.html.includes('Unscored'));

    // Refuses restricted records
    const rRec = restrictedRecord();
    let refused = false;
    try {
      generateMeetingPerformanceReportT17(rRec, healthPayload);
    } catch (err) {
      if (err instanceof RestrictedReportGenerationRefusedError) refused = true;
    }
    check('phase5', 'GEN-12 strictly refuses generation for restricted health records', refused);
  }

  // 10. Tasklet 5.13 (GEN-13) to Tasklet 5.17 (GEN-17)
  {
    const rec = baseRecord();
    const t1 = generateExecutiveSummaryT1(rec);
    const t3 = generateBusinessCaseT3(rec);
    const t5 = generateOperatingModelT5(rec);
    const t12 = generateProgramReportT12(rec);
    const t16 = generateRecommendationPaperT16(rec, [{ priority: 'P1', recommendation: 'Refactor schedule', confidence: '0.90' }]);

    check('phase5', 'GEN-13 compiles T1 executive summary', t1.generator_id === 'GEN-13' && t1.template_id === 'T1' && t1.target_pages === 1);
    check('phase5', 'GEN-14 compiles T3 business case', t3.generator_id === 'GEN-14' && t3.template_id === 'T3');
    check('phase5', 'GEN-15 compiles T5 operating model', t5.generator_id === 'GEN-15' && t5.template_id === 'T5');
    check('phase5', 'GEN-16 compiles T12 program report', t12.generator_id === 'GEN-16' && t12.template_id === 'T12');
    check('phase5', 'GEN-17 compiles T16 recommendation paper', t16.generator_id === 'GEN-17' && t16.template_id === 'T16' && t16.recommendation_count === 1);
  }

  // 11. Dispatcher across all templates
  {
    const rec = baseRecord();
    const templates = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16'];
    const allDispatched = templates.every((t) => {
      const doc = compileDocumentByTemplate(t, rec);
      return doc && doc.template_id === t;
    });
    check('phase5', 'dispatcher successfully compiles all standard templates T1 to T16', allDispatched);

    // T17 dispatch with health payload
    const t17Doc = compileDocumentByTemplate('T17', rec, { healthPayload: { composite_score: 75, band: 'Good' } });
    check('phase5', 'dispatcher compiles T17 with health payload', t17Doc && t17Doc.template_id === 'T17' && t17Doc.score === 75);

    // Unknown template throws
    let threw = false;
    try {
      compileDocumentByTemplate('T99', rec);
    } catch {
      threw = true;
    }
    check('phase5', 'dispatcher throws on unknown template ID', threw);
  }

  // 12. Security and HTML Escaping
  {
    const escaped = escapeHtml('<script>alert("xss")</script>&"test"\'');
    check('phase5', 'escapeHtml neutralizes angle brackets, quotes, and ampersands',
      !escaped.includes('<') && !escaped.includes('>') && escaped.includes('&lt;script&gt;') && escaped.includes('&quot;'));
  }
}
