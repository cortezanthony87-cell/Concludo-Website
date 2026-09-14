import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAdminClient } from '../supabase/admin';
import { getSupabaseBrowserClient } from '../supabase/client';
import {
  ExecutiveBriefingRecord,
  ExecutiveReportType,
  PredictiveAnalysisResult,
} from './types';

export interface CreateExecutiveBriefingInput {
  title: string;
  reportType: ExecutiveReportType;
  organizationId?: string | null;
  teamId?: string | null;
  userId: string;
  analysis?: PredictiveAnalysisResult;
  customContent?: any;
}

function getClient(client?: SupabaseClient): SupabaseClient {
  if (client) return client;
  if (typeof window !== 'undefined') {
    return getSupabaseBrowserClient();
  }
  return getSupabaseAdminClient();
}

export async function createExecutiveBriefing(
  input: CreateExecutiveBriefingInput,
  client?: SupabaseClient
): Promise<{ success: boolean; data?: ExecutiveBriefingRecord; error?: string }> {
  const db = getClient(client);

  // Authoritative service-level scope authorization check
  if (input.organizationId) {
    const { data: org } = await db
      .from('organizations')
      .select('id, owner_id')
      .eq('id', input.organizationId)
      .maybeSingle();

    const isOwner = org?.owner_id === input.userId;
    if (!isOwner) {
      const { data: orgMem } = await db
        .from('organization_members')
        .select('id')
        .eq('organization_id', input.organizationId)
        .eq('user_id', input.userId)
        .maybeSingle();
      if (!orgMem) {
        return { success: false, error: 'User is not a member of the specified organization.' };
      }
    }
  }

  if (input.teamId) {
    const { data: teamMem } = await db
      .from('team_members')
      .select('id')
      .eq('team_id', input.teamId)
      .eq('user_id', input.userId)
      .maybeSingle();
    if (!teamMem) {
      return { success: false, error: 'User is not a member of the specified team.' };
    }
  }

  // Construct structured content
  const content: any = input.customContent || {};
  if (input.analysis) {
    content.executiveSummary = input.analysis.executiveIntelligence.strategicOverview;
    content.strategicOverview = input.analysis.executiveIntelligence.strategicOverview;
    content.healthScore = input.analysis.healthScore.overallScore;
    content.healthCategory = input.analysis.healthScore.category;
    content.keyRisks = input.analysis.riskPredictions.map((r) => `${r.title} (${r.riskLevel.toUpperCase()}): ${r.explanation}`);
    content.keyOpportunities = input.analysis.opportunitySignals.map((o) => `${o.title}: ${o.summary}`);
    content.topRecommendations = input.analysis.strategicRecommendations.map((r) => `${r.title} [Priority: ${r.priorityLevel}]: ${r.summary}`);
    content.forecastSummary = input.analysis.forecasts['90_day']?.expectedTrends.join(' ') || '';
    content.sections = [
      {
        heading: 'Strategic Health & Executive Overview',
        body: input.analysis.executiveIntelligence.strategicOverview,
      },
      {
        heading: 'Risk Prediction & Operational Exposure',
        body: `The operational risk is assessed at ${input.analysis.executiveIntelligence.operationalRisk.level.toUpperCase()} (Score: ${input.analysis.executiveIntelligence.operationalRisk.score}/100). ${input.analysis.executiveIntelligence.operationalRisk.summary}`,
      },
      {
        heading: 'Decision Velocity & Quality Analysis',
        body: `Total decisions analyzed: ${input.analysis.decisionQuality.decisions.length}. Decision effectiveness rate stands at ${input.analysis.decisionQuality.decisionEffectivenessRatePercent}%, with an average decision velocity of ${input.analysis.decisionQuality.decisionVelocityDaysAverage} days.`,
      },
      {
        heading: '90-Day Operational Forecast',
        body: input.analysis.forecasts['90_day']?.expectedTrends.join('\n\n') || 'Projections indicate stable delivery momentum.',
      },
      {
        heading: 'Leadership Priority Recommendations',
        body: input.analysis.strategicRecommendations.map((r, i) => `${i + 1}. **${r.title}** (${r.priorityLevel.toUpperCase()})\n${r.summary}\nEvidence: ${r.supportingEvidence.join(', ')}`).join('\n\n'),
      },
    ];
  }

  const { data, error } = await db
    .from('executive_briefings')
    .insert({
      title: input.title,
      report_type: input.reportType,
      organization_id: input.organizationId || null,
      team_id: input.teamId || null,
      generated_by: input.userId,
      content,
    })
    .select('*')
    .single();

  if (error || !data) {
    return { success: false, error: error?.message || 'Failed to create executive briefing.' };
  }

  // Audit log entry
  try {
    await db.from('audit_logs').insert({
      organization_id: input.organizationId || null,
      user_id: input.userId,
      action: 'executive_briefing_generation',
      entity_type: 'executive_briefings',
      entity_id: data.id,
      details: {
        title: data.title,
        report_type: data.report_type,
        health_score: content.healthScore,
      },
      created_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal if audit log insert encounters transient error
  }

  return { success: true, data };
}

export async function fetchExecutiveBriefings(
  filter: { organizationId?: string | null; teamId?: string | null; userId?: string },
  client?: SupabaseClient
): Promise<ExecutiveBriefingRecord[]> {
  const db = getClient(client);

  let query = db
    .from('executive_briefings')
    .select('*')
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (filter.organizationId) {
    query = query.eq('organization_id', filter.organizationId);
  } else if (filter.teamId) {
    query = query.eq('team_id', filter.teamId);
  } else if (filter.userId) {
    query = query.eq('generated_by', filter.userId);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return data as ExecutiveBriefingRecord[];
}

export async function fetchExecutiveBriefingById(
  id: string,
  client?: SupabaseClient
): Promise<ExecutiveBriefingRecord | null> {
  const db = getClient(client);

  const { data, error } = await db
    .from('executive_briefings')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;
  return data as ExecutiveBriefingRecord;
}

export async function softDeleteExecutiveBriefing(
  briefingId: string,
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const db = getClient(client);

  const { data, error } = await db.rpc('soft_delete_executive_briefing', {
    p_briefing_id: briefingId,
    p_user_id: userId,
  });

  if (error || !data) return false;

  try {
    await db.from('audit_logs').insert({
      user_id: userId,
      action: 'report_deletion',
      entity_type: 'executive_briefings',
      entity_id: briefingId,
      details: { soft_deleted: true },
      created_at: new Date().toISOString(),
    });
  } catch {}

  return true;
}

export async function restoreExecutiveBriefing(
  briefingId: string,
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const db = getClient(client);

  const { data, error } = await db.rpc('restore_executive_briefing', {
    p_briefing_id: briefingId,
    p_user_id: userId,
  });

  return !error && data === true;
}

export async function permanentDeleteExecutiveBriefing(
  briefingId: string,
  userId: string,
  client?: SupabaseClient
): Promise<boolean> {
  const db = getClient(client);

  const { data, error } = await db.rpc('permanent_delete_executive_briefing', {
    p_briefing_id: briefingId,
    p_user_id: userId,
  });

  if (error) {
    if (error.message.includes('Legal Hold')) {
      throw new Error('Cannot permanently delete record: Active Legal Hold in effect.');
    }
    return false;
  }

  return data === true;
}
