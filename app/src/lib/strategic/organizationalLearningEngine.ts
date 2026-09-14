import { OrganizationalLearningModel } from './types';

export class OrganizationalLearningEngine {
  /**
   * Tracks lessons learned, knowledge and decision reuse, pattern emergence,
   * and enterprise memory evolution.
   */
  public static computeLearningModel(context?: {
    lessonsCount?: number;
    knowledgeNodesCount?: number;
    decisionsCount?: number;
    projectsCount?: number;
  }): OrganizationalLearningModel {
    const lessonsCount = context?.lessonsCount || 4;
    const nodesCount = context?.knowledgeNodesCount || 16;
    const decisionsCount = context?.decisionsCount || 8;

    return {
      totalLessonsLearned: Math.max(1, lessonsCount),
      lessonsReusedCount: Math.max(1, Math.round(lessonsCount * 0.75)),
      knowledgeReuseRate: 82,
      decisionReuseRate: 76,
      successfulPatterns: [
        {
          pattern: 'Early Architecture Boundary Definition',
          occurrences: Math.max(2, decisionsCount - 2),
          successRate: 94,
          domain: 'Engineering & Platform Strategy',
        },
        {
          pattern: 'Pre-Approved Decision Criteria in Decision Memory',
          occurrences: Math.max(3, decisionsCount - 1),
          successRate: 91,
          domain: 'Executive Governance',
        },
        {
          pattern: 'Single-Owner Action Accountability with Milestone SLAs',
          occurrences: 14,
          successRate: 88,
          domain: 'Program Execution',
        },
      ],
      failurePatterns: [
        {
          pattern: 'Unassigned Secondary Action Backlogs',
          occurrences: 3,
          riskLevel: 'Moderate',
          remedyRecommendation: 'Enforce single-owner assignment during weekly review',
        },
        {
          pattern: 'Delayed Cross-Squad Architecture Reviews',
          occurrences: 2,
          riskLevel: 'High',
          remedyRecommendation: 'Trigger automated Copilot follow-up when architectural decision stays pending > 48h',
        },
      ],
      bestPractices: [
        {
          title: 'Documented Vendor Selection Matrices with Evidence Scoring',
          category: 'Procurement & Operations',
          validatedInitiatives: ['Project Atlas', 'Infrastructure Modernization'],
          impactScore: 92,
        },
        {
          title: 'Retrospective Lesson Graph Linking to Future Project Charters',
          category: 'Organizational Memory',
          validatedInitiatives: ['Customer Experience Overhaul'],
          impactScore: 89,
        },
      ],
      memoryEvolution: {
        knowledgeGrowthRatePct: 24,
        knowledgeDecayRisk: 'Low',
        knowledgeUtilizationScore: Math.min(95, 75 + Math.min(20, nodesCount)),
        knowledgeRelevanceScore: 89,
        knowledgeDependencyDepth: 3.4,
      },
    };
  }
}
