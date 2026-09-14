import { SupabaseClient } from '@supabase/supabase-js';
import {
  StrategicDigitalTwin,
  StrategicHealthScore,
  StrategicScenario,
  StrategicBriefing,
  StrategicAlert,
  StrategicRecommendationItem,
  ScenarioType,
  ScenarioParameters,
  StrategicBriefingType,
  StrategicAlertType,
  AlertSeverity,
} from './types';
import { DigitalTwinEngine } from './digitalTwinEngine';
import { StrategicHealthEngine } from './strategicHealthEngine';
import { ScenarioEngine } from './scenarioEngine';
import { StrategicBriefingService } from './strategicBriefingService';

export class StrategicService {
  /**
   * Fetches latest Digital Twin snapshot or computes fresh state.
   */
  public static async getLatestDigitalTwin(
    client: SupabaseClient,
    userId: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicDigitalTwin> {
    let query = client
      .from('strategic_digital_twins')
      .select('*')
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else {
      query = query.eq('created_by', userId);
    }

    const { data } = await query;
    if (data && data.length > 0) {
      return data[0] as StrategicDigitalTwin;
    }

    // Compute fresh and persist
    return await this.refreshDigitalTwin(client, userId, organizationId, teamId);
  }

  /**
   * Refreshes the Digital Twin snapshot.
   */
  public static async refreshDigitalTwin(
    client: SupabaseClient,
    userId: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicDigitalTwin> {
    const computed = await DigitalTwinEngine.computeDigitalTwin(client, userId, organizationId, teamId);

    const { data, error } = await client
      .from('strategic_digital_twins')
      .insert({
        ...computed,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to persist strategic digital twin:', error);
      throw error;
    }

    return data as StrategicDigitalTwin;
  }

  /**
   * Record and fetch Strategic Health Score history.
   */
  public static async recordHealthScore(
    client: SupabaseClient,
    userId: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicHealthScore> {
    const twin = await this.getLatestDigitalTwin(client, userId, organizationId, teamId);
    const healthResult = StrategicHealthEngine.calculateStrategicHealth({
      projectsCount: twin.model_state.projects_count,
      decisionsCount: twin.model_state.decisions_count,
      actionsCount: twin.model_state.actions_count,
      risksCount: twin.model_state.risks_detected_count,
      knowledgeNodesCount: twin.model_state.knowledge_nodes_count,
      lessonsLearnedCount: twin.model_state.lessons_learned_count,
      workflowsCount: twin.model_state.workflows_count,
      teamsCount: twin.model_state.teams_count,
    });

    const { data, error } = await client
      .from('strategic_health_scores')
      .insert({
        organization_id: organizationId || null,
        team_id: teamId || null,
        overall_score: healthResult.overallScore,
        classification: healthResult.classification,
        categories: healthResult.categories,
        supporting_rationale: healthResult.rationale,
        recorded_by: userId,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to record strategic health score:', error);
      throw error;
    }

    return data as StrategicHealthScore;
  }

  /**
   * Fetches health scores history.
   */
  public static async fetchHealthScoreHistory(
    client: SupabaseClient,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicHealthScore[]> {
    let query = client
      .from('strategic_health_scores')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(10);

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data } = await query;
    return (data || []) as StrategicHealthScore[];
  }

  /**
   * Scenarios & Simulations
   */
  public static async createScenario(
    client: SupabaseClient,
    userId: string,
    title: string,
    scenarioType: ScenarioType,
    params: ScenarioParameters,
    description?: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicScenario> {
    let pQuery = client.from('projects').select('id, title').is('deleted_at', null).limit(10);
    let aQuery = client.from('action_tracker').select('id, due_date, status').is('deleted_at', null);
    if (teamId) {
      pQuery = pQuery.eq('team_id', teamId);
      aQuery = aQuery.eq('team_id', teamId);
    } else if (organizationId) {
      pQuery = pQuery.eq('organization_id', organizationId);
      aQuery = aQuery.eq('organization_id', organizationId);
    } else {
      pQuery = pQuery.eq('user_id', userId);
      aQuery = aQuery.eq('user_id', userId);
    }
    const [{ data: pData }, { data: aData }] = await Promise.all([pQuery, aQuery]);
    const actions = aData || [];
    const overdueCount = actions.filter((a: any) => a.status !== 'completed' && a.due_date && new Date(a.due_date) < new Date()).length;

    const simulationResults = ScenarioEngine.simulateScenario(scenarioType, params, {
      projects: pData && pData.length > 0 ? pData : undefined,
      actionsCount: actions.length > 0 ? actions.length : undefined,
      overdueCount,
    });

    const { data, error } = await client
      .from('strategic_scenarios')
      .insert({
        organization_id: organizationId || null,
        team_id: teamId || null,
        created_by: userId,
        title,
        description: description || null,
        scenario_type: scenarioType,
        parameters: params,
        simulation_results: simulationResults,
        confidence_level: simulationResults.confidence_level,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create scenario:', error);
      throw error;
    }

    return data as StrategicScenario;
  }

  public static async fetchScenarios(
    client: SupabaseClient,
    userId: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicScenario[]> {
    let query = client
      .from('strategic_scenarios')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else {
      query = query.eq('created_by', userId);
    }

    const { data } = await query;
    return (data || []) as StrategicScenario[];
  }

  public static async softDeleteScenario(
    client: SupabaseClient,
    scenarioId: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await client.rpc('soft_delete_strategic_scenario', {
      p_scenario_id: scenarioId,
      p_user_id: userId,
    });
    if (error) throw error;
    return !!data;
  }

  public static async restoreScenario(
    client: SupabaseClient,
    scenarioId: string
  ): Promise<boolean> {
    const { data, error } = await client.rpc('restore_strategic_scenario', {
      p_scenario_id: scenarioId,
    });
    if (error) throw error;
    return !!data;
  }

  public static async permanentDeleteScenario(
    client: SupabaseClient,
    scenarioId: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await client.rpc('permanent_delete_strategic_scenario', {
      p_scenario_id: scenarioId,
      p_user_id: userId,
    });
    if (error) throw error;
    return !!data;
  }

  /**
   * Strategic Briefings & Board Reports
   */
  public static async createBriefing(
    client: SupabaseClient,
    userId: string,
    briefingType: StrategicBriefingType,
    title?: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicBriefing> {
    let pQuery = client.from('projects').select('id, title, status').is('deleted_at', null).limit(10);
    if (teamId) pQuery = pQuery.eq('team_id', teamId);
    else if (organizationId) pQuery = pQuery.eq('organization_id', organizationId);
    else pQuery = pQuery.eq('user_id', userId);
    const { data: pData } = await pQuery;

    const healthHistory = await this.fetchHealthScoreHistory(client, organizationId, teamId);
    const latestHealth = healthHistory[0];

    const { title: finalTitle, sections } = StrategicBriefingService.generateBriefingContent(
      briefingType,
      title,
      {
        projects: pData && pData.length > 0 ? pData : undefined,
        healthScore: latestHealth ? Math.round(Number(latestHealth.overall_score)) : undefined,
      }
    );

    const { data, error } = await client
      .from('strategic_briefings')
      .insert({
        organization_id: organizationId || null,
        team_id: teamId || null,
        generated_by: userId,
        title: finalTitle,
        briefing_type: briefingType,
        sections,
        status: 'published',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create strategic briefing:', error);
      throw error;
    }

    return data as StrategicBriefing;
  }

  public static async fetchBriefings(
    client: SupabaseClient,
    userId: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicBriefing[]> {
    let query = client
      .from('strategic_briefings')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId);
    } else {
      query = query.eq('generated_by', userId);
    }

    const { data } = await query;
    return (data || []) as StrategicBriefing[];
  }

  public static async softDeleteBriefing(
    client: SupabaseClient,
    briefingId: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await client.rpc('soft_delete_strategic_briefing', {
      p_briefing_id: briefingId,
      p_user_id: userId,
    });
    if (error) throw error;
    return !!data;
  }

  public static async restoreBriefing(
    client: SupabaseClient,
    briefingId: string
  ): Promise<boolean> {
    const { data, error } = await client.rpc('restore_strategic_briefing', {
      p_briefing_id: briefingId,
    });
    if (error) throw error;
    return !!data;
  }

  public static async permanentDeleteBriefing(
    client: SupabaseClient,
    briefingId: string,
    userId: string
  ): Promise<boolean> {
    const { data, error } = await client.rpc('permanent_delete_strategic_briefing', {
      p_briefing_id: briefingId,
      p_user_id: userId,
    });
    if (error) throw error;
    return !!data;
  }

  /**
   * Strategic Alerts (Informational Only)
   */
  public static async createAlert(
    client: SupabaseClient,
    alertType: StrategicAlertType,
    severity: AlertSeverity,
    title: string,
    description: string,
    organizationId?: string | null,
    teamId?: string | null,
    details: Record<string, any> = {}
  ): Promise<StrategicAlert> {
    const { data, error } = await client
      .from('strategic_alerts')
      .insert({
        organization_id: organizationId || null,
        team_id: teamId || null,
        alert_type: alertType,
        severity,
        title,
        description,
        details,
        is_dismissed: false,
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create strategic alert:', error);
      throw error;
    }

    return data as StrategicAlert;
  }

  public static async fetchAlerts(
    client: SupabaseClient,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<StrategicAlert[]> {
    let query = client
      .from('strategic_alerts')
      .select('*')
      .is('deleted_at', null)
      .eq('is_dismissed', false)
      .order('created_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    const { data } = await query;
    return (data || []) as StrategicAlert[];
  }

  public static async dismissAlert(
    client: SupabaseClient,
    alertId: string
  ): Promise<boolean> {
    const { error } = await client
      .from('strategic_alerts')
      .update({ is_dismissed: true })
      .eq('id', alertId);

    if (error) throw error;
    return true;
  }

  /**
   * Enhanced Strategic Recommendations
   */
  public static getStrategicRecommendations(): StrategicRecommendationItem[] {
    return [
      {
        id: 'strat-rec-1',
        category: 'immediate_priority',
        title: 'Accelerate Project Atlas Milestone Sign-Off',
        summary: 'Finalize outstanding security architecture documentation to prevent staging deployment slippage.',
        confidenceScore: 94,
        explanation: 'Project Atlas delivery cadence directly influences 3 downstream team workflows and partner integration deadlines.',
        supportingRecords: [
          { recordType: 'project', recordId: 'proj-1', title: 'Project Atlas' },
          { recordType: 'action', recordId: 'act-1', title: 'Security Architecture Sign-Off' },
        ],
        evidence: [
          'Historical milestone lead times indicate 4-day critical path buffer.',
          'Decision Memory confirms architectural prerequisites were met.',
        ],
        impactScore: 92,
        effortRating: 'Low',
      },
      {
        id: 'strat-rec-2',
        category: 'strategic_priority',
        title: 'Expand Organizational Memory Graph for Q4 Initiatives',
        summary: 'Link recent retrospective findings to new initiative charters to maximize knowledge reuse.',
        confidenceScore: 91,
        explanation: 'Teams reusing verified knowledge clusters demonstrate 22% higher decision velocity and fewer rework cycles.',
        supportingRecords: [
          { recordType: 'knowledge_cluster', recordId: 'clus-1', title: 'Enterprise Governance' },
        ],
        evidence: [
          'Lessons Learned analysis shows 76% decision reuse rate across mature squads.',
        ],
        impactScore: 88,
        effortRating: 'Moderate',
      },
      {
        id: 'strat-rec-3',
        category: 'emerging_concern',
        title: 'Monitor Aging Secondary Action Backlog',
        summary: 'Action backlog in secondary support streams shows 15% increase over past 14 days.',
        confidenceScore: 86,
        explanation: 'Unassigned secondary items risk compounding into delivery bottlenecks if left unaddressed before sprint boundary.',
        supportingRecords: [
          { recordType: 'action', recordId: 'act-2', title: 'Review Secondary Integration Specs' },
        ],
        evidence: [
          'Action Tracker metrics show 3 actions approaching due date threshold.',
        ],
        impactScore: 75,
        effortRating: 'Low',
      },
      {
        id: 'strat-rec-4',
        category: 'quick_win',
        title: 'Standardize Decision Memory Proposals Across PMO',
        summary: 'Implement standard rationale templates for upcoming procurement decisions.',
        confidenceScore: 96,
        explanation: 'Pre-formatted decision templates reduce governance turnaround by an average of 1.2 business days.',
        supportingRecords: [
          { recordType: 'decision', recordId: 'dec-1', title: 'Vendor Selection Template' },
        ],
        evidence: [
          'Decision velocity was 40% faster on decisions utilizing structured criteria.',
        ],
        impactScore: 82,
        effortRating: 'Low',
      },
      {
        id: 'strat-rec-5',
        category: 'risk_mitigation',
        title: 'Schedule Cross-Squad Architecture Checkpoint',
        summary: 'Conduct 30-minute sync between Engineering and Platform Operations to review shared dependencies.',
        confidenceScore: 89,
        explanation: 'Dependency mapping detected 2 inter-team bottlenecks on the shared API Gateway pipeline.',
        supportingRecords: [
          { recordType: 'dependency', recordId: 'dep-1', title: 'API Gateway Dependency' },
        ],
        evidence: [
          'Enterprise Risk Network identified delivery schedule variance risk.',
        ],
        impactScore: 85,
        effortRating: 'Low',
      },
      {
        id: 'strat-rec-6',
        category: 'long_term_opportunity',
        title: 'Automate Executive Briefing Distribution via Approval Center',
        summary: 'Stage recurring weekly briefings for executive sign-off and automated stakeholder dispatch.',
        confidenceScore: 92,
        explanation: 'Human-governed workflow automation ensures consistent board communication while preserving oversight.',
        supportingRecords: [
          { recordType: 'workflow', recordId: 'wf-1', title: 'Weekly Briefing Workflow' },
        ],
        evidence: [
          'Workflow Approvals engine logged 100% compliance on audited dispatches.',
        ],
        impactScore: 90,
        effortRating: 'Moderate',
      },
    ];
  }
}
