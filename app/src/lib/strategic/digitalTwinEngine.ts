import { SupabaseClient } from '@supabase/supabase-js';
import { StrategicDigitalTwin, DigitalTwinModelState } from './types';
import { StrategicHealthEngine } from './strategicHealthEngine';

export class DigitalTwinEngine {
  /**
   * Generates or refreshes the Digital Twin model for an organization/user.
   */
  public static async computeDigitalTwin(
    client: SupabaseClient,
    userId: string,
    organizationId?: string | null,
    teamId?: string | null
  ): Promise<Omit<StrategicDigitalTwin, 'id' | 'created_at' | 'updated_at'>> {
    // 1. Fetch live workspace records
    let projectQuery = client
      .from('projects')
      .select('id, title, updated_at')
      .is('deleted_at', null);

    let decisionQuery = client
      .from('decision_memory')
      .select('id, decision_title, created_at, updated_at')
      .is('deleted_at', null);

    let actionQuery = client
      .from('action_tracker')
      .select('id, action_title, status, due_date, created_at')
      .is('deleted_at', null);

    let workflowQuery = client
      .from('workflows')
      .select('id, name, is_active')
      .is('deleted_at', null);

    let knowledgeQuery = client
      .from('knowledge_nodes')
      .select('id, node_type, title')
      .is('deleted_at', null);

    let relationshipQuery = client
      .from('knowledge_relationships')
      .select('id, relationship_type');

    let lessonsQuery = client
      .from('lessons_learned')
      .select('id, title')
      .is('deleted_at', null);

    let teamsQuery = client
      .from('teams')
      .select('id, name')
      .is('deleted_at', null);

    if (teamId) {
      projectQuery = projectQuery.eq('team_id', teamId);
      decisionQuery = decisionQuery.eq('team_id', teamId);
      actionQuery = actionQuery.eq('team_id', teamId);
      workflowQuery = workflowQuery.eq('team_id', teamId);
      knowledgeQuery = knowledgeQuery.eq('team_id', teamId);
      lessonsQuery = lessonsQuery.eq('team_id', teamId);
      teamsQuery = teamsQuery.eq('id', teamId);
    } else if (organizationId) {
      const { data: orgTeams } = await client.from('teams').select('id').eq('organization_id', organizationId);
      const teamIds = (orgTeams || []).map((t: any) => t.id);
      if (teamIds.length > 0) {
        projectQuery = projectQuery.in('team_id', teamIds);
        decisionQuery = decisionQuery.in('team_id', teamIds);
        actionQuery = actionQuery.in('team_id', teamIds);
      } else {
        projectQuery = projectQuery.eq('user_id', userId);
        decisionQuery = decisionQuery.eq('user_id', userId);
        actionQuery = actionQuery.eq('user_id', userId);
      }
      workflowQuery = workflowQuery.eq('organization_id', organizationId);
      knowledgeQuery = knowledgeQuery.eq('organization_id', organizationId);
      lessonsQuery = lessonsQuery.eq('organization_id', organizationId);
      teamsQuery = teamsQuery.eq('organization_id', organizationId);
    } else {
      projectQuery = projectQuery.eq('user_id', userId);
      decisionQuery = decisionQuery.eq('user_id', userId);
      actionQuery = actionQuery.eq('user_id', userId);
      lessonsQuery = lessonsQuery.eq('created_by', userId);
    }

    const [
      { data: projects },
      { data: decisions },
      { data: actions },
      { data: workflows },
      { data: knowledgeNodes },
      { data: relationships },
      { data: lessons },
      { data: teams },
    ] = await Promise.all([
      projectQuery,
      decisionQuery,
      actionQuery,
      workflowQuery,
      knowledgeQuery,
      relationshipQuery,
      lessonsQuery,
      teamsQuery,
    ]);

    const projectList = projects || [];
    const decisionList = decisions || [];
    const actionList = actions || [];
    const workflowList = workflows || [];
    const nodeList = knowledgeNodes || [];
    const relationshipList = relationships || [];
    const lessonsList = lessons || [];
    const teamsList = teams || [];

    const openActions = actionList.filter((a) => (a.status || '').toLowerCase() !== 'completed');
    const now = new Date();
    const overdueActions = openActions.filter((a) => a.due_date && new Date(a.due_date) < now);

    // Compute health scores via StrategicHealthEngine
    const healthResult = StrategicHealthEngine.calculateStrategicHealth({
      projects: projectList,
      decisions: decisionList.map((d: any) => ({
        id: d.id,
        decision_text: d.decision_title || d.decision_text,
        created_at: d.created_at,
        updated_at: d.updated_at,
      })),
      actions: actionList.map((a: any) => ({
        id: a.id,
        title: a.action_title || a.title,
        status: a.status,
        due_date: a.due_date,
        created_at: a.created_at,
      })),
      risksCount: overdueActions.length > 2 ? 3 : overdueActions.length,
      knowledgeNodesCount: nodeList.length,
      lessonsLearnedCount: lessonsList.length,
      workflowsCount: workflowList.length,
      teamsCount: Math.max(1, teamsList.length),
    });

    const modelState: DigitalTwinModelState = {
      organizations_count: organizationId ? 1 : 0,
      teams_count: Math.max(1, teamsList.length),
      projects_count: projectList.length,
      active_initiatives_count: projectList.length,
      decisions_count: decisionList.length,
      actions_count: actionList.length,
      open_actions_count: openActions.length,
      overdue_actions_count: overdueActions.length,
      risks_detected_count: overdueActions.length > 2 ? 3 : overdueActions.length,
      workflows_count: workflowList.length,
      knowledge_nodes_count: nodeList.length,
      knowledge_relationships_count: relationshipList.length,
      lessons_learned_count: lessonsList.length,
      last_updated: new Date().toISOString(),
    };

    const strategicHealth = healthResult.overallScore;
    const executionHealth = healthResult.categories.program_delivery;
    const operationalHealth = healthResult.categories.operational_alignment;
    const collaborationHealth = healthResult.categories.team_effectiveness;
    const decisionHealth = healthResult.categories.decision_velocity;
    const knowledgeHealth = healthResult.categories.knowledge_utilization;
    const riskExposure = Math.max(10, 100 - healthResult.categories.risk_management);
    const opportunityScore = Math.min(95, Math.round((strategicHealth + knowledgeHealth) / 2));

    return {
      organization_id: organizationId || null,
      team_id: teamId || null,
      created_by: userId,
      title: 'Concludo Enterprise Digital Twin',
      operational_health: operationalHealth,
      strategic_health: strategicHealth,
      execution_health: executionHealth,
      collaboration_health: collaborationHealth,
      decision_health: decisionHealth,
      knowledge_health: knowledgeHealth,
      risk_exposure: riskExposure,
      opportunity_score: opportunityScore,
      model_state: modelState,
    };
  }
}
