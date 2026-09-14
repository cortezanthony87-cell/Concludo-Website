import { EnterpriseRiskNetwork, EnterpriseRiskNode } from './types';

export class RiskNetworkEngine {
  /**
   * Constructs enterprise risk relationships connecting risks, initiatives, decisions, and actions.
   */
  public static computeRiskNetwork(context?: {
    projects?: Array<{ id: string; title: string }>;
    overdueActions?: Array<{ id: string; title: string }>;
    decisions?: Array<{ id: string; decision_text?: string }>;
  }): EnterpriseRiskNetwork {
    const projects = context?.projects || [{ id: 'proj-1', title: 'Project Atlas' }];
    const overdue = context?.overdueActions || [];

    const nodes: EnterpriseRiskNode[] = [
      {
        id: 'risk-node-1',
        title: 'Delivery Schedule Variance on Critical Milestones',
        severity: overdue.length > 2 ? 'high' : 'medium',
        riskScore: overdue.length > 2 ? 72 : 48,
        originEntityType: 'project',
        originEntityId: projects[0]?.id || 'proj-1',
        originTitle: projects[0]?.title || 'Project Atlas',
        dependencies: ['Cross-team staging review', 'Security audit sign-off'],
        escalationPaths: ['Lead Architect -> Program Director -> Executive Committee'],
        impactAreas: ['Product Delivery', 'Customer Launch Timeline', 'SLA Commitments'],
        mitigationRecommendation: 'Reallocate 1 floating squad resource and conduct mid-sprint checkpoint',
      },
      {
        id: 'risk-node-2',
        title: 'Pending Architectural Decision Latency',
        severity: 'low',
        riskScore: 28,
        originEntityType: 'decision',
        originEntityId: 'dec-arch-1',
        originTitle: 'Database Connection Pooling Standard',
        dependencies: ['Infrastructure engineering approval'],
        escalationPaths: ['Engineering Lead -> VP Engineering'],
        impactAreas: ['System Scalability', 'Operational Overhead'],
        mitigationRecommendation: 'Review in upcoming architectural decision forum',
      },
      {
        id: 'risk-node-3',
        title: 'Action Item Backlog Accumulation',
        severity: overdue.length > 0 ? 'medium' : 'low',
        riskScore: Math.min(80, 25 + overdue.length * 15),
        originEntityType: 'action',
        originEntityId: overdue[0]?.id || 'act-1',
        originTitle: overdue[0]?.title || 'Finalize Security Audit Documentation',
        dependencies: ['Team capacity allocation'],
        escalationPaths: ['Squad Lead -> Operations Manager'],
        impactAreas: ['Execution Velocity', 'Compliance Tracking'],
        mitigationRecommendation: 'Stage action review session to unblock dependencies',
      },
    ];

    const maxRisk = Math.max(...nodes.map((n) => n.riskScore));
    let overallRiskLevel: 'Low' | 'Moderate' | 'Elevated' | 'Critical' = 'Low';
    if (maxRisk >= 80) overallRiskLevel = 'Critical';
    else if (maxRisk >= 60) overallRiskLevel = 'Elevated';
    else if (maxRisk >= 40) overallRiskLevel = 'Moderate';

    return {
      nodes,
      overallRiskLevel,
      topRiskAreas: ['Project Delivery Cadence', 'Action Follow-Through', 'Architecture Decisions'],
      activeEscalationsCount: nodes.filter((n) => n.severity === 'high' || n.severity === 'critical').length,
      mitigationCoverageRate: 88,
    };
  }
}
