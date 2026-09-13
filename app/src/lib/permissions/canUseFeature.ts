import { SupabaseClient } from '@supabase/supabase-js';
import {
  FeatureKey,
  PlanType,
  ALL_FEATURE_KEYS,
  PLAN_PERMISSIONS,
  PermissionResult,
} from './types';
import { createFeatureForbiddenError } from './errors';
import { getSupabaseAdminClient } from '../supabase/admin';

export interface CanUseFeatureOptions {
  supabase?: SupabaseClient;
}

const AI_AGENT_FEATURES: readonly FeatureKey[] = [
  'ai_agents',
  'workflow_orchestration',
  'intelligent_automation',
  'agent_memory',
  'workflow_approvals',
] as const;

/**
 * Server-side permission helper: canUseFeature(userId, featureKey)
 *
 * Rules:
 * - Fetches the user's profile from the database (profiles table)
 * - Reads the user's authoritative plan from the database
 * - Compares the plan against the requested feature
 * - Returns allowed or denied with 403 Forbidden details
 * - Never trusts any plan value passed from the browser/client
 * - Never relies only on front-end hiding
 * - Optional Team access: If plan is 'team', checks if an organization administrator has enabled team agents
 */
export async function canUseFeature(
  userId: string,
  featureKey: string,
  options?: CanUseFeatureOptions
): Promise<PermissionResult> {
  // 1. Validate user ID
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return {
      allowed: false,
      statusCode: 401,
      feature: featureKey,
      error: {
        error: 'unauthorized',
        message: 'Authentication required: User ID is missing or invalid.',
        feature: featureKey,
      },
    };
  }

  const cleanUserId = userId.trim();

  // 2. Validate feature key against allowed system feature keys
  if (!featureKey || typeof featureKey !== 'string') {
    return {
      allowed: false,
      statusCode: 400,
      feature: featureKey || '',
      error: {
        error: 'invalid_feature_key',
        message: 'Feature key is required and must be a valid string.',
        feature: featureKey || '',
      },
    };
  }

  const cleanFeatureKey = featureKey.trim() as FeatureKey;
  if (!ALL_FEATURE_KEYS.includes(cleanFeatureKey)) {
    return {
      allowed: false,
      statusCode: 400,
      feature: featureKey,
      error: {
        error: 'invalid_feature_key',
        message: `Invalid feature key: "${featureKey}". Feature does not exist.`,
        feature: featureKey,
      },
    };
  }

  // 3. Obtain database client for authoritative profile lookup
  let client = options?.supabase;
  if (!client) {
    try {
      // In server/node/bun environment, use admin client
      client = getSupabaseAdminClient();
    } catch {
      return {
        allowed: false,
        statusCode: 500,
        feature: featureKey,
        error: {
          error: 'database_unavailable',
          message: 'Secure database client could not be initialized.',
          feature: featureKey,
        },
      };
    }
  }

  // 4. Fetch the user's profile directly from the database
  const { data: profile, error: dbError } = await client
    .from('profiles')
    .select('id, plan, is_suspended')
    .eq('id', cleanUserId)
    .maybeSingle();

  if (dbError) {
    return {
      allowed: false,
      statusCode: 500,
      feature: featureKey,
      error: {
        error: 'database_error',
        message: `Database error querying profile: ${dbError.message}`,
        feature: featureKey,
      },
    };
  }

  // 5. Handle missing profile in database
  if (!profile) {
    return {
      allowed: false,
      statusCode: 404,
      feature: featureKey,
      error: {
        error: 'profile_not_found',
        message: `User profile not found for user ID: ${cleanUserId}`,
        feature: featureKey,
      },
    };
  }

  // 6. Check user suspension
  if (profile.is_suspended) {
    return {
      allowed: false,
      statusCode: 403,
      plan: (profile.plan as PlanType) || 'free_preview',
      feature: cleanFeatureKey,
      error: {
        error: 'user_suspended',
        message: 'Your account has been suspended by an administrator. Please contact your organization owner.',
        feature: cleanFeatureKey,
      },
    };
  }

  const userPlan = (profile.plan as PlanType) || 'free_preview';
  const allowedFeatures = PLAN_PERMISSIONS[userPlan] || [];

  // 7. Check if user plan permits access directly
  if (allowedFeatures.includes(cleanFeatureKey)) {
    return {
      allowed: true,
      statusCode: 200,
      plan: userPlan,
      feature: cleanFeatureKey,
    };
  }

  // 8. Optional Team Access for AI Agents & Workflow Orchestration
  // If plan is 'team', check if user belongs to an organization where allow_team_agents is enabled
  if (userPlan === 'team' && AI_AGENT_FEATURES.includes(cleanFeatureKey)) {
    const { data: memberships } = await client
      .from('organization_members')
      .select('organization_id, organizations!inner(allow_team_agents)')
      .eq('user_id', cleanUserId);

    const hasOrgOverride = memberships?.some(
      (m: any) => m.organizations && m.organizations.allow_team_agents === true
    );

    if (hasOrgOverride) {
      return {
        allowed: true,
        statusCode: 200,
        plan: userPlan,
        feature: cleanFeatureKey,
      };
    }
  }

  // 9. Forbidden
  return {
    allowed: false,
    statusCode: 403,
    plan: userPlan,
    feature: cleanFeatureKey,
    error: createFeatureForbiddenError(cleanFeatureKey),
  };
}

/**
 * Tasklet 12 Helper: hasFeature(userId, feature)
 *
 * Returns a boolean (true / false) based on the user's plan fetched authoritatively from the database.
 * Never trusts values sent from the browser.
 */
export async function hasFeature(
  userId: string,
  feature: string,
  options?: CanUseFeatureOptions
): Promise<boolean> {
  const result = await canUseFeature(userId, feature, options);
  return result.allowed === true;
}
