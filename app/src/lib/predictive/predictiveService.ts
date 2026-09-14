import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase/admin';
import { getSupabaseBrowserClient } from '../supabase/client';
import { runPredictiveEngine } from './predictiveEngine';
import { PredictiveAnalysisResult } from './types';

export interface FetchPredictiveOptions {
  scope: 'organization' | 'team' | 'individual';
  scopeId?: string;
  userId: string;
  saveSnapshot?: boolean;
}

function getClient(client?: SupabaseClient): SupabaseClient {
  if (client) return client;
  if (typeof window !== 'undefined') {
    return getSupabaseBrowserClient();
  }
  return getSupabaseAdminClient();
}

export async function getPredictiveAnalysis(
  options: FetchPredictiveOptions,
  client?: SupabaseClient
): Promise<PredictiveAnalysisResult> {
  const db = getClient(client);

  // 1. Authoritative Scope Authorization Check
  if (options.scope === 'organization' && options.scopeId) {
    const [{ data: isMember }, { data: isOwner }] = await Promise.all([
      db
        .from('organization_members')
        .select('id')
        .eq('organization_id', options.scopeId)
        .eq('user_id', options.userId)
        .maybeSingle(),
      db
        .from('organizations')
        .select('id')
        .eq('id', options.scopeId)
        .eq('owner_id', options.userId)
        .maybeSingle(),
    ]);

    if (!isMember && !isOwner) {
      throw new Error(`Unauthorized: User does not belong to organization ${options.scopeId}`);
    }
  } else if (options.scope === 'team' && options.scopeId) {
    const [{ data: isMember }, { data: isOwner }] = await Promise.all([
      db
        .from('team_members')
        .select('id')
        .eq('team_id', options.scopeId)
        .eq('user_id', options.userId)
        .maybeSingle(),
      db
        .from('teams')
        .select('id')
        .eq('id', options.scopeId)
        .eq('owner_id', options.userId)
        .maybeSingle(),
    ]);

    if (!isMember && !isOwner) {
      throw new Error(`Unauthorized: User does not belong to team ${options.scopeId}`);
    }
  }

  // 1b. Resolve organization teams and members if org scope
  let orgTeamIds: string[] = [];
  let orgMemberIds: string[] = [];
  if (options.scope === 'organization' && options.scopeId) {
    const [{ data: orgTeams }, { data: orgMembers }] = await Promise.all([
      db.from('teams').select('id').eq('organization_id', options.scopeId),
      db.from('organization_members').select('user_id').eq('organization_id', options.scopeId),
    ]);
    orgTeamIds = (orgTeams || []).map((t) => t.id);
    orgMemberIds = (orgMembers || []).map((m) => m.user_id);
    const { data: org } = await db.from('organizations').select('owner_id').eq('id', options.scopeId).maybeSingle();
    if (org?.owner_id && !orgMemberIds.includes(org.owner_id)) {
      orgMemberIds.push(org.owner_id);
    }
  }

  // 2. Fetch non-deleted projects based on scope
  let projectsQuery = db
    .from('projects')
    .select('id, title, project_name, client_name, created_at, updated_at, team_id, user_id')
    .is('deleted_at', null);

  if (options.scope === 'organization' && options.scopeId) {
    if (orgTeamIds.length > 0 && orgMemberIds.length > 0) {
      projectsQuery = projectsQuery.or(`team_id.in.(${orgTeamIds.join(',')}),user_id.in.(${orgMemberIds.join(',')})`);
    } else if (orgTeamIds.length > 0) {
      projectsQuery = projectsQuery.in('team_id', orgTeamIds);
    } else if (orgMemberIds.length > 0) {
      projectsQuery = projectsQuery.in('user_id', orgMemberIds);
    } else {
      projectsQuery = projectsQuery.eq('user_id', options.userId);
    }
  } else if (options.scope === 'team' && options.scopeId) {
    projectsQuery = projectsQuery.eq('team_id', options.scopeId);
  } else {
    projectsQuery = projectsQuery.eq('user_id', options.userId);
  }

  // 3. Fetch non-deleted decisions
  let decisionsQuery = db
    .from('decision_memory')
    .select('id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date, created_at, updated_at, project_id, team_id, user_id')
    .is('deleted_at', null);

  if (options.scope === 'organization' && options.scopeId) {
    if (orgTeamIds.length > 0 && orgMemberIds.length > 0) {
      decisionsQuery = decisionsQuery.or(`team_id.in.(${orgTeamIds.join(',')}),user_id.in.(${orgMemberIds.join(',')})`);
    } else if (orgTeamIds.length > 0) {
      decisionsQuery = decisionsQuery.in('team_id', orgTeamIds);
    } else if (orgMemberIds.length > 0) {
      decisionsQuery = decisionsQuery.in('user_id', orgMemberIds);
    } else {
      decisionsQuery = decisionsQuery.eq('user_id', options.userId);
    }
  } else if (options.scope === 'team' && options.scopeId) {
    decisionsQuery = decisionsQuery.eq('team_id', options.scopeId);
  } else {
    decisionsQuery = decisionsQuery.eq('user_id', options.userId);
  }

  // 4. Fetch non-deleted actions
  let actionsQuery = db
    .from('action_tracker')
    .select('id, action_title, action_description, due_date, status, assigned_user_id, created_at, updated_at, project_id, team_id, user_id')
    .is('deleted_at', null);

  if (options.scope === 'organization' && options.scopeId) {
    if (orgTeamIds.length > 0 && orgMemberIds.length > 0) {
      actionsQuery = actionsQuery.or(`team_id.in.(${orgTeamIds.join(',')}),user_id.in.(${orgMemberIds.join(',')})`);
    } else if (orgTeamIds.length > 0) {
      actionsQuery = actionsQuery.in('team_id', orgTeamIds);
    } else if (orgMemberIds.length > 0) {
      actionsQuery = actionsQuery.in('user_id', orgMemberIds);
    } else {
      actionsQuery = actionsQuery.eq('user_id', options.userId);
    }
  } else if (options.scope === 'team' && options.scopeId) {
    actionsQuery = actionsQuery.eq('team_id', options.scopeId);
  } else {
    actionsQuery = actionsQuery.eq('user_id', options.userId);
  }

  // 5. Fetch non-deleted reports
  let reportsQuery = db
    .from('endpoint_reports')
    .select('id, title, report_type, created_at, user_id')
    .is('deleted_at', null);

  if (options.scope === 'organization' && options.scopeId && orgMemberIds.length > 0) {
    reportsQuery = reportsQuery.in('user_id', orgMemberIds);
  } else {
    reportsQuery = reportsQuery.eq('user_id', options.userId);
  }

  // 6. Fetch non-deleted workflows
  let workflowsQuery = db
    .from('workflows')
    .select('id, name, is_active, created_at')
    .is('deleted_at', null);

  if (options.scope === 'organization' && options.scopeId) {
    workflowsQuery = workflowsQuery.eq('organization_id', options.scopeId);
  } else if (options.scope === 'team' && options.scopeId) {
    workflowsQuery = workflowsQuery.eq('team_id', options.scopeId);
  } else {
    workflowsQuery = workflowsQuery.eq('owner_id', options.userId);
  }

  // 7. Fetch team members if team or org scope
  let teamMembersQuery = db
    .from('team_members')
    .select('id, team_id, user_id, role');
  if (options.scope === 'team' && options.scopeId) {
    teamMembersQuery = teamMembersQuery.eq('team_id', options.scopeId);
  }

  // 8. Fetch agent activity logs
  let agentActivityQuery = db
    .from('agent_activity')
    .select('id, agent_type, action_type, status, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  const [
    { data: projects },
    { data: decisions },
    { data: actions },
    { data: reports },
    { data: workflows },
    { data: teamMembers },
    { data: agentActivities },
  ] = await Promise.all([
    projectsQuery,
    decisionsQuery,
    actionsQuery,
    reportsQuery,
    workflowsQuery,
    teamMembersQuery,
    agentActivityQuery,
  ]);

  // Run predictive engine
  const analysis = runPredictiveEngine({
    scope: options.scope,
    scopeId: options.scopeId,
    projects: projects || [],
    decisions: decisions || [],
    actions: actions || [],
    reports: reports || [],
    workflows: workflows || [],
    agentActivities: agentActivities || [],
    teamMembers: teamMembers || [],
  });

  // Optional: save snapshot to predictive_snapshots
  if (options.saveSnapshot) {
    try {
      await db.from('predictive_snapshots').insert({
        organization_id: options.scope === 'organization' ? options.scopeId : null,
        team_id: options.scope === 'team' ? options.scopeId : null,
        user_id: options.userId,
        scope_type: options.scope,
        health_score: analysis.healthScore.overallScore,
        health_category: analysis.healthScore.category,
        category_scores: analysis.healthScore.categoryScores,
        risk_predictions: analysis.riskPredictions,
        opportunity_signals: analysis.opportunitySignals,
        strategic_recommendations: analysis.strategicRecommendations,
        forecast_data: analysis.forecasts,
      });

      // Audit log entries for health score update & prediction generation
      await Promise.all([
        db.from('audit_logs').insert({
          organization_id: options.scope === 'organization' ? options.scopeId : null,
          user_id: options.userId,
          action: 'health_score_update',
          entity_type: 'predictive_intelligence',
          details: {
            overall_score: analysis.healthScore.overallScore,
            category: analysis.healthScore.category,
            scope: options.scope,
          },
          created_at: new Date().toISOString(),
        }),
        db.from('audit_logs').insert({
          organization_id: options.scope === 'organization' ? options.scopeId : null,
          user_id: options.userId,
          action: 'prediction_generation',
          entity_type: 'predictive_intelligence',
          details: {
            scope: options.scope,
            risks_count: analysis.riskPredictions.length,
            opportunities_count: analysis.opportunitySignals.length,
            recommendations_count: analysis.strategicRecommendations.length,
          },
          created_at: new Date().toISOString(),
        }),
      ]);
    } catch {
      // Non-fatal if snapshot insert encounters minor transient issue
    }
  }

  return analysis;
}
