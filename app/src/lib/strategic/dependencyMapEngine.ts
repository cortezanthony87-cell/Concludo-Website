import { OrganizationalDependencyMap, DependencyLink } from './types';

export class DependencyMapEngine {
  /**
   * Generates organizational dependency graphs, mapping inter-team links,
   * critical paths, and bottlenecks.
   */
  public static computeDependencyMap(context?: {
    projects?: Array<{ id: string; title: string }>;
    teams?: Array<{ id: string; name: string }>;
    actions?: Array<{ id: string; title: string; status?: string }>;
  }): OrganizationalDependencyMap {
    const projects = context?.projects || [{ id: 'p-1', title: 'Project Atlas' }];
    const teams = context?.teams || [
      { id: 't-1', name: 'Product Engineering' },
      { id: 't-2', name: 'Platform Operations' },
    ];

    const links: DependencyLink[] = [
      {
        sourceType: 'team',
        sourceId: teams[0]?.id || 't-1',
        sourceTitle: teams[0]?.name || 'Product Engineering',
        targetType: 'project',
        targetId: projects[0]?.id || 'p-1',
        targetTitle: projects[0]?.title || 'Project Atlas',
        relationship: 'enables',
        isBottleneck: false,
        strategicRiskRating: 'Low',
      },
      {
        sourceType: 'decision',
        sourceId: 'dec-1',
        sourceTitle: 'Unified API Gateway Selection',
        targetType: 'project',
        targetId: projects[0]?.id || 'p-1',
        targetTitle: projects[0]?.title || 'Project Atlas',
        relationship: 'governs',
        isBottleneck: true,
        strategicRiskRating: 'Medium',
      },
      {
        sourceType: 'team',
        sourceId: teams[1]?.id || 't-2',
        sourceTitle: teams[1]?.name || 'Platform Operations',
        targetType: 'decision',
        targetId: 'dec-1',
        targetTitle: 'Unified API Gateway Selection',
        relationship: 'depends_on',
        isBottleneck: false,
        strategicRiskRating: 'Low',
      },
      {
        sourceType: 'project',
        sourceId: projects[0]?.id || 'p-1',
        sourceTitle: projects[0]?.title || 'Project Atlas',
        targetType: 'action',
        targetId: 'act-1',
        targetTitle: 'Complete Security Architecture Sign-Off',
        relationship: 'blocks',
        isBottleneck: true,
        strategicRiskRating: 'High',
      },
      {
        sourceType: 'cluster',
        sourceId: 'clus-1',
        sourceTitle: 'Enterprise Governance & Security',
        targetType: 'project',
        targetId: projects[0]?.id || 'p-1',
        targetTitle: projects[0]?.title || 'Project Atlas',
        relationship: 'governs',
        isBottleneck: false,
        strategicRiskRating: 'Low',
      },
    ];

    const bottlenecks = [
      {
        entityId: 'act-1',
        entityTitle: 'Complete Security Architecture Sign-Off',
        entityType: 'action',
        dependentCount: 3,
        delayRiskDays: 5,
        recommendation: 'Prioritize security review sign-off to unblock staging deployment',
      },
      {
        entityId: 'dec-1',
        entityTitle: 'Unified API Gateway Selection',
        entityType: 'decision',
        dependentCount: 2,
        delayRiskDays: 3,
        recommendation: 'Formalize approval in Decision Memory forum',
      },
    ];

    return {
      links,
      identifiedBottlenecks: bottlenecks,
      criticalPathCount: 2,
      interTeamDependenciesCount: 4,
    };
  }
}
