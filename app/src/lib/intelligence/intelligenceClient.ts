import { SupabaseClient } from '@supabase/supabase-js';
import { InsightData, StatsData, StatsPeriodFilter } from './types';
import { processUserIntelligence } from './intelligenceEngine';
import { getSupabaseClient } from '../supabase/client';

export interface IntelligenceClientOptions {
  supabase?: SupabaseClient;
  forceRefresh?: boolean;
}

/**
 * Fetch insights for authenticated user, using cached intelligence when available
 */
export async function fetchUserInsights(
  options?: IntelligenceClientOptions
): Promise<InsightData> {
  const supabase = options?.supabase || getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Authentication required');

  if (!options?.forceRefresh) {
    const { data: cached, error } = await supabase
      .from('generated_intelligence')
      .select('data, updated_at')
      .eq('user_id', userId)
      .eq('intelligence_type', 'insight')
      .is('deleted_at', null)
      .maybeSingle();

    if (!error && cached?.data && Object.keys(cached.data).length > 0) {
      return cached.data as InsightData;
    }
  }

  // Generate fresh insights
  const { insight } = await processUserIntelligence(userId, { supabase, forceRefresh: true });
  return insight;
}

/**
 * Fetch stats and trend metrics for authenticated user
 */
export async function fetchUserStats(
  periodFilter: StatsPeriodFilter = 'all',
  options?: IntelligenceClientOptions
): Promise<StatsData> {
  const supabase = options?.supabase || getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Authentication required');

  if (!options?.forceRefresh && periodFilter === 'all') {
    const { data: cached, error } = await supabase
      .from('generated_intelligence')
      .select('data, updated_at')
      .eq('user_id', userId)
      .eq('intelligence_type', 'stats')
      .is('deleted_at', null)
      .maybeSingle();

    if (!error && cached?.data && Object.keys(cached.data).length > 0) {
      return cached.data as StatsData;
    }
  }

  // Generate fresh stats with requested period filter
  const { stats } = await processUserIntelligence(userId, {
    supabase,
    periodFilter,
    forceRefresh: true,
  });
  return stats;
}

/**
 * Fetch Team Insights aggregating across team-owned projects only
 */
export async function fetchTeamInsights(
  teamId: string,
  options?: IntelligenceClientOptions
): Promise<InsightData> {
  const supabase = options?.supabase || getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Authentication required');

  const { insight } = await processUserIntelligence(userId, {
    supabase,
    workspaceScope: 'team',
    teamId,
    forceRefresh: true,
  });
  return insight;
}

/**
 * Fetch Team Stats aggregating across team-owned projects only with Team Participation breakdown
 */
export async function fetchTeamStats(
  teamId: string,
  periodFilter: StatsPeriodFilter = 'all',
  options?: IntelligenceClientOptions
): Promise<StatsData> {
  const supabase = options?.supabase || getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Authentication required');

  const { stats } = await processUserIntelligence(userId, {
    supabase,
    workspaceScope: 'team',
    teamId,
    periodFilter,
    forceRefresh: true,
  });
  return stats;
}

/**
 * Explicitly refresh and re-cache all intelligence for current user
 */
export async function refreshAllIntelligence(
  options?: IntelligenceClientOptions
): Promise<{ insight: InsightData; stats: StatsData }> {
  const supabase = options?.supabase || getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id;
  if (!userId) throw new Error('Authentication required');

  return processUserIntelligence(userId, { supabase, forceRefresh: true });
}
