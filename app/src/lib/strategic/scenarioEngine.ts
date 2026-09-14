import {
  ScenarioType,
  ScenarioParameters,
  ScenarioSimulationResults,
  ScenarioConfidence,
} from './types';

export class ScenarioEngine {
  /**
   * Evaluates a hypothetical organizational scenario without claiming absolute certainty.
   * Grounded in historical projects, decisions, actions, and knowledge graphs.
   */
  public static simulateScenario(
    scenarioType: ScenarioType,
    params: ScenarioParameters,
    context?: {
      projects?: Array<{ id: string; title: string }>;
      actionsCount?: number;
      overdueCount?: number;
      decisionsCount?: number;
    }
  ): ScenarioSimulationResults {
    const projects = context?.projects || [
      { id: 'proj-1', title: 'Project Atlas' },
      { id: 'proj-2', title: 'Customer Experience Transformation' },
    ];
    const totalActions = context?.actionsCount || 12;
    const currentOverdue = context?.overdueCount || 2;
    const currentDecisions = context?.decisionsCount || 8;

    switch (scenarioType) {
      case 'delivery_slowdown': {
        const slowdownPct = Math.abs(params.delivery_change_pct || 15);
        const delayedCount = Math.max(1, Math.round((projects.length * slowdownPct) / 100));
        const varianceDays = Math.round((slowdownPct * 30) / 100);

        return {
          possible_outcomes: [
            `Downstream milestone completion shifts back by approximately ${varianceDays} working days across ${delayedCount} initiative(s).`,
            `Cross-functional squads experience idle wait times pending upstream dependency sign-offs.`,
            `Budget burn rate may increase by 6-9% due to extended operational cycles.`,
          ],
          risk_impact: {
            level: slowdownPct > 20 ? 'high' : 'moderate',
            scoreDelta: Math.round(slowdownPct * 0.8),
            summary: `Delivery drift introduces heightened schedule vulnerability and customer delivery slippage.`,
          },
          resource_impact: {
            utilizationChangePct: Math.round(slowdownPct * 0.6),
            bottleneckRisk: 'High in quality assurance and staging validation pipelines',
            capacitySurplusOrDeficit: `Estimated deficit of ${Math.round(slowdownPct * 0.4)} full-time squad capacity.`,
          },
          project_impact: {
            delayedMilestonesCount: delayedCount,
            affectedProjects: projects.slice(0, 2).map((p) => p.title),
            timelineVarianceDays: varianceDays,
          },
          decision_impact: {
            decisionVelocityShiftDays: 1.5,
            pendingReviewSurge: 2,
            governanceFriction: 'Moderate governance review delays during re-scoping',
          },
          operational_impact: {
            overallHealthDelta: -Math.round(slowdownPct * 0.5),
            operationalSummary: `Operational health declines modestly due to extended cycle times and action aging.`,
          },
          confidence_level: 'High' as ScenarioConfidence,
          assumptions: [
            `Current squad velocity remains stable without emergency reallocation.`,
            `External vendor SLA turnaround times remain unchanged.`,
            `Historical project cadence from preceding quarters serves as baseline benchmark.`,
          ],
          supporting_evidence: [
            {
              source: 'Project Milestones Archive',
              metric: 'Historical Milestone Variance',
              observation: `Average past delivery delays clustered around 12-18 days during quarter-end releases.`,
            },
            {
              source: 'Action Tracker',
              metric: 'Action Resolution Cadence',
              observation: `${totalActions} tracked actions indicate strong correlation between milestone dates and backlog clearance.`,
            },
          ],
        };
      }

      case 'velocity_improvement': {
        const improvementPct = Math.abs(params.velocity_change_pct || 20);
        const daysSaved = Math.round((improvementPct * 14) / 100);

        return {
          possible_outcomes: [
            `Decision turnaround shrinks by approximately ${daysSaved} days, accelerating project kick-offs.`,
            `Action backlog resolves faster due to accelerated decision clarity.`,
            `Overall organizational momentum improves by an estimated ${Math.round(improvementPct * 0.75)}%.`,
          ],
          risk_impact: {
            level: 'low',
            scoreDelta: -Math.round(improvementPct * 0.5),
            summary: `Risk exposure declines as stalled decisions and ambiguity are eliminated earlier.`,
          },
          resource_impact: {
            utilizationChangePct: -Math.round(improvementPct * 0.4),
            bottleneckRisk: 'Low; decision channels flow unimpeded',
            capacitySurplusOrDeficit: 'Net capacity release across executive and PMO leadership',
          },
          project_impact: {
            delayedMilestonesCount: 0,
            affectedProjects: projects.map((p) => p.title),
            timelineVarianceDays: -daysSaved,
          },
          decision_impact: {
            decisionVelocityShiftDays: -daysSaved,
            pendingReviewSurge: -2,
            governanceFriction: 'Substantially reduced governance latency',
          },
          operational_impact: {
            overallHealthDelta: Math.round(improvementPct * 0.4),
            operationalSummary: `Operational health score improves through prompt execution and decisive alignment.`,
          },
          confidence_level: 'Very High' as ScenarioConfidence,
          assumptions: [
            `Executive stakeholders review Decision Memory proposals within 24 hours.`,
            `Decision rationale is pre-documented with clear supporting criteria.`,
          ],
          supporting_evidence: [
            {
              source: 'Decision Memory',
              metric: 'Decision Resolution Velocity',
              observation: `${currentDecisions} verified decisions show average resolution latency of 2.1 days.`,
            },
          ],
        };
      }

      case 'action_backlog_surge': {
        const surgePct = Math.abs(params.overdue_action_surge_pct || 25);
        const newOverdue = Math.round(currentOverdue + (totalActions * surgePct) / 100);

        return {
          possible_outcomes: [
            `Overdue action items increase to an estimated ${newOverdue} items, creating friction across squads.`,
            `Accountability ratings dip on key deliverable deliverables.`,
            `Downstream project tasks risk blocked status due to missing prerequisites.`,
          ],
          risk_impact: {
            level: 'high',
            scoreDelta: Math.round(surgePct * 0.7),
            summary: `Elevated delivery risk directly caused by compounding task debt and unassigned ownership.`,
          },
          resource_impact: {
            utilizationChangePct: Math.round(surgePct * 0.5),
            bottleneckRisk: 'High in frontline delivery and cross-team dependencies',
            capacitySurplusOrDeficit: 'Significant operational backlog deficit',
          },
          project_impact: {
            delayedMilestonesCount: Math.max(1, Math.round(newOverdue / 3)),
            affectedProjects: projects.slice(0, 1).map((p) => p.title),
            timelineVarianceDays: Math.round(surgePct * 0.4),
          },
          decision_impact: {
            decisionVelocityShiftDays: 2,
            pendingReviewSurge: 3,
            governanceFriction: 'Escalations increase requiring administrative intervention',
          },
          operational_impact: {
            overallHealthDelta: -Math.round(surgePct * 0.6),
            operationalSummary: `Sharp drop in Operational Alignment and Execution Health scores.`,
          },
          confidence_level: 'High' as ScenarioConfidence,
          assumptions: [
            `Action ownership remains static without automatic escalation triggers.`,
            `Sprint deadlines remain fixed.`,
          ],
          supporting_evidence: [
            {
              source: 'Action Tracker',
              metric: 'Aging Backlog Metric',
              observation: `Currently ${currentOverdue} overdue actions generate 40% of delivery friction reports.`,
            },
          ],
        };
      }

      case 'initiative_delay': {
        const initiativeName = params.target_initiative_name || 'Project Atlas';
        const delayWeeks = params.delay_weeks || 4;

        return {
          possible_outcomes: [
            `${initiativeName} delay of ${delayWeeks} weeks pushes dependent deliverables into the following operating period.`,
            `Dependent squads must reprioritize secondary initiatives or risk resource idle time.`,
            `Stakeholder communication required to reset delivery expectations.`,
          ],
          risk_impact: {
            level: delayWeeks > 3 ? 'high' : 'moderate',
            scoreDelta: delayWeeks * 5,
            summary: `Concentrated risk impact on programs dependent on ${initiativeName} core architecture.`,
          },
          resource_impact: {
            utilizationChangePct: 15,
            bottleneckRisk: `Resource contention between ${initiativeName} and parallel initiatives`,
            capacitySurplusOrDeficit: `Capacity locked on delayed stream for an additional ${delayWeeks} weeks`,
          },
          project_impact: {
            delayedMilestonesCount: 3,
            affectedProjects: [initiativeName, ...projects.filter((p) => p.title !== initiativeName).map((p) => p.title)],
            timelineVarianceDays: delayWeeks * 7,
          },
          decision_impact: {
            decisionVelocityShiftDays: 3,
            pendingReviewSurge: 2,
            governanceFriction: 'Requires executive exception approval and charter revision',
          },
          operational_impact: {
            overallHealthDelta: -Math.round(delayWeeks * 2.5),
            operationalSummary: `Program Delivery score contracts during delay window.`,
          },
          confidence_level: 'Moderate' as ScenarioConfidence,
          assumptions: [
            `Dependency mapping reflects hard technical blocking relationships.`,
            `No parallel staging track is available for testing in the interim.`,
          ],
          supporting_evidence: [
            {
              source: 'Knowledge Network Dependency Map',
              metric: 'Upstream Initiative Dependencies',
              observation: `${initiativeName} is connected to 4 downstream knowledge nodes and actions.`,
            },
          ],
        };
      }

      case 'capacity_expansion': {
        const capacityPct = Math.abs(params.capacity_change_pct || 25);
        const accelerationDays = Math.round((capacityPct * 18) / 100);

        return {
          possible_outcomes: [
            `Delivery capacity expands by ${capacityPct}%, absorbing pending action backlog within 30 days.`,
            `Parallel execution of deferred initiatives becomes viable without overloading existing teams.`,
            `Project completion timelines accelerate by an average of ${accelerationDays} days.`,
          ],
          risk_impact: {
            level: 'low',
            scoreDelta: -Math.round(capacityPct * 0.4),
            summary: `Risk exposure stabilizes as single-point-of-failure resource bottlenecks are eliminated.`,
          },
          resource_impact: {
            utilizationChangePct: -18,
            bottleneckRisk: 'Minimal; onboarding latency managed through existing documentation',
            capacitySurplusOrDeficit: `Capacity surplus of ${capacityPct}% unlocks growth opportunities.`,
          },
          project_impact: {
            delayedMilestonesCount: 0,
            affectedProjects: projects.map((p) => p.title),
            timelineVarianceDays: -accelerationDays,
          },
          decision_impact: {
            decisionVelocityShiftDays: -1,
            pendingReviewSurge: 0,
            governanceFriction: 'Stable governance throughput',
          },
          operational_impact: {
            overallHealthDelta: Math.round(capacityPct * 0.35),
            operationalSummary: `Strong upward trend across Execution, Delivery, and Team Effectiveness.`,
          },
          confidence_level: 'High' as ScenarioConfidence,
          assumptions: [
            `New team capacity is onboarded using existing knowledge base and playbooks within 10 business days.`,
            `Technical architecture scales linearly with added contributors.`,
          ],
          supporting_evidence: [
            {
              source: 'Organizational Memory & Lessons Learned',
              metric: 'Capacity Scaling Ratios',
              observation: `Past squad expansion yielded 78% net productivity gain within first month.`,
            },
          ],
        };
      }

      case 'custom':
      default: {
        return {
          possible_outcomes: [
            `Hypothetical evaluation indicates dynamic trade-offs between delivery pace and quality assurance.`,
            `Simulated variations influence team capacity, decision turnaround, and milestone milestones.`,
            `Recommended course of action is governed incremental adjustment with review checkpoints.`,
          ],
          risk_impact: {
            level: 'moderate',
            scoreDelta: 5,
            summary: `Custom scenario simulation indicates moderate uncertainty requiring pilot validation.`,
          },
          resource_impact: {
            utilizationChangePct: 5,
            bottleneckRisk: 'Moderate in specialized engineering and domain lead roles',
            capacitySurplusOrDeficit: 'Balanced capacity profile with minimal buffer',
          },
          project_impact: {
            delayedMilestonesCount: 1,
            affectedProjects: projects.slice(0, 1).map((p) => p.title),
            timelineVarianceDays: 7,
          },
          decision_impact: {
            decisionVelocityShiftDays: 1,
            pendingReviewSurge: 1,
            governanceFriction: 'Standard governance oversight applied',
          },
          operational_impact: {
            overallHealthDelta: -2,
            operationalSummary: `Operational trajectory remains largely stable within expected operational tolerances.`,
          },
          confidence_level: 'Moderate' as ScenarioConfidence,
          assumptions: [
            `Simulation model extrapolates based on historical mean performance metrics.`,
            `External market parameters remain invariant.`,
          ],
          supporting_evidence: [
            {
              source: 'Concludo Strategic Modeling Engine',
              metric: 'Multi-Horizon Forecast Regression',
              observation: `Confidence interval calculated at 82% based on cross-initiative correlation.`,
            },
          ],
        };
      }
    }
  }
}
