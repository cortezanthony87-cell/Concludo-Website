/**
 * Phase 4: Concludo Recommendation Engine Test Suite
 * 
 * Covers Tasklets 4.1 through 4.10.
 * Enforces:
 * 1. human_check_required is always true.
 * 2. Every recommendation links to concrete evidence citations.
 * 3. Never targets an individual's performance.
 * 4. Exact mathematical ranking formula: (Impact * 0.45) + (Confidence * 30) - (EffortWeight * 15).
 * 5. Strictly prohibits savings claims, ROI, or unsourced dollar figures.
 * 6. Action remediation flags suggestions until human acceptance.
 * 7. Strategy recommendations require governance_policy capability flag.
 */

import { generateRecommendations, FAILURE_PATTERNS } from '../src/services/recommendations/recommendationService.mjs';
import { calculateRankScore, rankRecommendations, EFFORT_WEIGHTS } from '../src/services/recommendations/recommendationRankingService.mjs';
import { scoreRecommendationConfidence } from '../src/services/recommendations/recommendationConfidenceEngine.mjs';
import { evaluatePriority, PRIORITY_TIERS } from '../src/services/recommendations/priorityScoringEngine.mjs';
import { scoreBusinessImpact, UnsupportedFinancialClaimError } from '../src/services/recommendations/businessImpactEngine.mjs';
import { generateExecutiveRecommendations, QUALIFIED_REVIEW_NOTE } from '../src/services/recommendations/executiveRecommendationService.mjs';
import { detectFollowUpItems } from '../src/services/recommendations/followUpRecommendationService.mjs';
import { remediateActionItem } from '../src/services/recommendations/actionRecommendationService.mjs';
import { generateStrategicRecommendations, CapabilityRestrictedError } from '../src/services/recommendations/strategyRecommendationService.mjs';
import { compileRecommendationLogOut42 } from '../src/services/recommendations/recommendationReportingService.mjs';

export function runPhase4Tests(check) {
  // ------------------------------------------------------------------ Tasklet 4.1: Recommendation Service Core
  {
    const recs = generateRecommendations({}, ['FP-01', 'FP-03', 'FP-04']);
    check('phase4-4.1', 'Generates recommendations mapped to failure patterns', recs.length === 3);
    check('phase4-4.1', 'human_check_required is strictly true on all recommendations',
      recs.every(r => r.human_check_required === true));
    check('phase4-4.1', 'Every recommendation links to evidence citations',
      recs.every(r => Array.isArray(r.evidence_citations) && r.evidence_citations.length > 0));
    check('phase4-4.1', 'Audits meeting process, never an individual person',
      recs.every(r => !r.title.includes('Performance Review') && !r.recommendation_text.includes('individual fault')));
  }

  // ------------------------------------------------------------------ Tasklet 4.2: Recommendation Ranking Engine
  {
    // Formula: (Impact * 0.45) + (Confidence * 30) - (EffortWeight * 15)
    // For Impact 8, Confidence 0.8, Effort LOW (weight 1):
    // (8 * 0.45) + (0.8 * 30) - (1 * 15) = 3.6 + 24 - 15 = 12.6
    const calculated = calculateRankScore({ business_impact_score: 8, confidence_score: 0.8, implementation_effort: 'LOW' });
    check('phase4-4.2', 'Rank score matches mathematical formula exactly', calculated === 12.6);

    const unranked = [
      { recommendation_code: 'REC-01', business_impact_score: 5, confidence_score: 0.7, implementation_effort: 'HIGH' },
      { recommendation_code: 'REC-02', business_impact_score: 9, confidence_score: 0.9, implementation_effort: 'LOW' }
    ];
    const ranked = rankRecommendations(unranked);
    check('phase4-4.2', 'Higher rank score placed at priority rank 1', ranked[0].recommendation_code === 'REC-02');
    check('phase4-4.2', 'Sequential priority_rank assigned 1 to N',
      ranked[0].priority_rank === 1 && ranked[1].priority_rank === 2);
  }

  // ------------------------------------------------------------------ Tasklet 4.3: Recommendation Confidence Scoring
  {
    const highConf = scoreRecommendationConfidence({ citations: [{ quote: 'Q1' }, { quote: 'Q2' }], corroboratingSlots: 3, clarityOfAgreement: 0.9 });
    check('phase4-4.3', 'High corroboration produces verified confidence', highConf.confidence_score >= 0.65 && !highConf.is_advisory_only);

    const lowConf = scoreRecommendationConfidence({ citations: [], corroboratingSlots: 1, clarityOfAgreement: 0.2 });
    check('phase4-4.3', 'Low confidence labelled "Advisory, requires verification"',
      lowConf.confidence_score < 0.65 && lowConf.confidence_label === 'Advisory, requires verification');
  }

  // ------------------------------------------------------------------ Tasklet 4.4: Priority Scoring Engine
  {
    const critical = evaluatePriority({ title: 'Immediate statutory compliance blocker' });
    check('phase4-4.4', 'Urgent compliance signal maps to P1 Critical', critical.code === 'P1');

    const ambiguous = evaluatePriority({ title: 'Consider minor design tweak' });
    check('phase4-4.4', 'Ambiguous urgency defaults to P3 Medium', ambiguous.code === 'P3');
  }

  // ------------------------------------------------------------------ Tasklet 4.5: Business Impact Scoring Engine
  {
    const impact = scoreBusinessImpact({ costPillar: 7, revenuePillar: 8, governancePillar: 9 });
    check('phase4-4.5', 'Computes business impact across three pillars', impact.business_impact_score >= 7);

    let savingsThrew = false;
    try {
      scoreBusinessImpact({ savingsClaimed: 'Save $50,000 annually' });
    } catch (e) {
      if (e instanceof UnsupportedFinancialClaimError) savingsThrew = true;
    }
    check('phase4-4.5', 'Strictly prohibits savings or ROI claims', savingsThrew);

    let dollarThrew = false;
    try {
      scoreBusinessImpact({ explicitDollarAmount: '$100,000 projected gain' });
    } catch (e) {
      if (e instanceof UnsupportedFinancialClaimError) dollarThrew = true;
    }
    check('phase4-4.5', 'Strictly prohibits unsourced dollar claims', dollarThrew);
  }

  // ------------------------------------------------------------------ Tasklet 4.6: Executive Recommendation Engine
  {
    const starterAttempt = generateExecutiveRecommendations({}, 'starter');
    check('phase4-4.6', 'Executive recommendations restricted from Starter tier', starterAttempt.tier_restricted === true);

    const proAccess = generateExecutiveRecommendations({}, 'pro_subscription');
    check('phase4-4.6', 'Available on Pro subscription', proAccess.tier_restricted === false && proAccess.recommendations.length > 0);
    check('phase4-4.6', 'Carries mandatory qualified review notice',
      proAccess.recommendations.every(r => r.review_note === QUALIFIED_REVIEW_NOTE));
  }

  // ------------------------------------------------------------------ Tasklet 4.7: Follow-Up Recommendation Engine
  {
    const lines = [
      'We decided on the colour palette.',
      'Let us park the database migration topic for next time.',
      'Take the vendor SLA discussion offline with legal.'
    ];
    const followUps = detectFollowUpItems(lines);
    check('phase4-4.7', 'Detects parked and offline deferral phrases', followUps.length === 2);
    check('phase4-4.7', 'Suggests follow-up agenda items',
      followUps.every(f => f.suggested_agenda_topic.startsWith('Follow-up review')));
  }

  // ------------------------------------------------------------------ Tasklet 4.8: Action Recommendation Engine
  {
    const vagueAction = { title: 'Look into customer churn', who: null };
    const remediated = remediateActionItem(vagueAction);
    check('phase4-4.8', 'Remediates action with missing Five-Field elements',
      remediated.who && remediated.when && remediated.definition_of_done && remediated.escalation_path);
    check('phase4-4.8', 'Suggested fields are explicitly flagged as suggestions',
      remediated.who.is_suggestion === true && remediated.definition_of_done.is_suggestion === true);
    check('phase4-4.8', 'Remediation status marks suggestion pending acceptance',
      remediated.remediation_status === 'SUGGESTION_PENDING_HUMAN_ACCEPTANCE');
  }

  // ------------------------------------------------------------------ Tasklet 4.9: Strategy Recommendation Engine
  {
    let restrictedThrew = false;
    try {
      generateStrategicRecommendations({}, ['audit_log']); // missing governance_policy
    } catch (e) {
      if (e instanceof CapabilityRestrictedError) restrictedThrew = true;
    }
    check('phase4-4.9', 'Gated by governance_policy capability flag', restrictedThrew);

    const permitted = generateStrategicRecommendations({}, ['governance_policy']);
    check('phase4-4.9', 'Permitted with governance_policy capability flag', permitted.length > 0);
  }

  // ------------------------------------------------------------------ Tasklet 4.10: Recommendation Reporting (OUT-42)
  {
    const recs = [
      {
        recommendation_code: 'REC-01',
        title: 'Institute Decision Register Checkpoint',
        category: 'EXECUTIVE',
        recommendation_text: 'Record formal decision entries prior to topic transition.',
        expected_business_benefit: 'Eliminates downstream decision ambiguity.',
        implementation_effort: 'LOW',
        priority_rank: 1,
        priority_code: 'P1',
        evidence_citations: [{ quote: 'Discussion checkpoint', timestamp: '10:15' }]
      }
    ];
    const html = compileRecommendationLogOut42(recs, { meeting_id: 'TEST-MEETING' });
    check('phase4-4.10', 'Compiles OUT-42 HTML report with Specimen 2 styling', html.includes('Recommendation Log (OUT-42)'));
    check('phase4-4.10', 'Includes mandatory qualified review notice', html.includes(QUALIFIED_REVIEW_NOTE));
  }
}
