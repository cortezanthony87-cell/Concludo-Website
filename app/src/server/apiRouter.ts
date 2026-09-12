import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { canUseFeature, hasFeature } from '../lib/permissions/canUseFeature';
import {
  FeatureKey,
  ALL_FEATURE_KEYS,
  PLAN_PERMISSIONS,
  FEATURE_TIER_BADGES,
  PlanType,
} from '../lib/permissions/types';
import { getSupabaseAdminClient } from '../lib/supabase/admin';
import {
  executeRetentionPurge,
  executeUserRetentionPurge,
  getRetentionPolicy,
} from '../lib/retention';

export interface ApiRequest {
  method: string;
  url: string;
  headers: Record<string, string | undefined>;
  body?: any;
}

export interface ApiResponse {
  status: number;
  headers: Record<string, string>;
  body: any;
}

/**
 * Server-side API Router for Concludo Workspace.
 * Protects backend actions by verifying user credentials and authoritative profile plan.
 */
export async function handleApiRequest(
  req: ApiRequest,
  options?: { adminClient?: SupabaseClient }
): Promise<ApiResponse> {
  const jsonHeaders = { 'Content-Type': 'application/json' };
  const pathname = req.url.startsWith('http') ? new URL(req.url).pathname : req.url.split('?')[0];

  const adminClient = options?.adminClient || getSupabaseAdminClient();

  // 1. Public / Developer diagnostic routes
  if (req.method === 'GET' && pathname === '/api/permissions/matrix') {
    return {
      status: 200,
      headers: jsonHeaders,
      body: {
        plans: PLAN_PERMISSIONS,
        featureKeys: ALL_FEATURE_KEYS,
      },
    };
  }

  // Data Retention Policy endpoint
  if (req.method === 'GET' && pathname === '/api/retention/policy') {
    return {
      status: 200,
      headers: jsonHeaders,
      body: getRetentionPolicy(),
    };
  }

  // Automated Retention Purge Endpoint (Background worker / Cron / Scheduled function)
  if (pathname === '/api/retention/purge') {
    if (req.method !== 'POST') {
      return {
        status: 405,
        headers: jsonHeaders,
        body: { error: 'method_not_allowed', message: 'Method Not Allowed' },
      };
    }

    const cronSecret = req.headers['x-cron-secret'] || req.headers['x-retention-secret'];
    const expectedSecret = process.env.CRON_SECRET || 'concludo-retention-daily-purge';

    // If authorized via background worker secret
    if (cronSecret && cronSecret === expectedSecret) {
      const purgeResult = await executeRetentionPurge(adminClient);
      return {
        status: purgeResult.success ? 200 : 500,
        headers: jsonHeaders,
        body: purgeResult,
      };
    }
  }

  // 2. Authentication extraction
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  if (!token) {
    return {
      status: 401,
      headers: jsonHeaders,
      body: {
        error: 'unauthorized',
        message: 'Authentication required: Missing Bearer token.',
      },
    };
  }

  // Check if token is the service role key directly (for server-to-server calls)
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceKey && token === serviceKey) {
    if (pathname === '/api/retention/purge') {
      const purgeResult = await executeRetentionPurge(adminClient);
      return {
        status: purgeResult.success ? 200 : 500,
        headers: jsonHeaders,
        body: purgeResult,
      };
    }
  }

  // 3. Verify user session with Supabase
  const { data: userData, error: authError } = await adminClient.auth.getUser(token);
  if (authError || !userData?.user) {
    return {
      status: 401,
      headers: jsonHeaders,
      body: {
        error: 'unauthorized',
        message: 'Authentication failed: Invalid or expired token.',
      },
    };
  }

  const authenticatedUser = userData.user;

  // Authenticated retention purge
  if (pathname === '/api/retention/purge') {
    // Authoritative check if user is admin
    const { data: profile } = await adminClient
      .from('profiles')
      .select('plan, role')
      .eq('id', authenticatedUser.id)
      .single();

    if (profile?.role === 'admin' || profile?.plan === 'admin') {
      const purgeResult = await executeRetentionPurge(adminClient);
      return {
        status: purgeResult.success ? 200 : 500,
        headers: jsonHeaders,
        body: purgeResult,
      };
    } else {
      // User-scoped purge
      const userPurgeResult = await adminClient.rpc('purge_user_expired_records', {
        p_user_id: authenticatedUser.id,
      });
      if (userPurgeResult.error) {
        return {
          status: 500,
          headers: jsonHeaders,
          body: {
            success: false,
            error: userPurgeResult.error.message,
          },
        };
      }
      return {
        status: 200,
        headers: jsonHeaders,
        body: userPurgeResult.data,
      };
    }
  }

  // 4a. Batch Feature Permission Status Endpoint: GET /api/features/status
  if (pathname === '/api/features/status' || pathname === '/api/features/permissions') {
    if (req.method !== 'GET') {
      return {
        status: 405,
        headers: jsonHeaders,
        body: { error: 'method_not_allowed', message: 'Method Not Allowed' },
      };
    }

    // Authoritative lookup from database profiles table
    const { data: profileData, error: profileErr } = await adminClient
      .from('profiles')
      .select('*')
      .eq('id', authenticatedUser.id)
      .single();

    if (profileErr || !profileData) {
      return {
        status: 404,
        headers: jsonHeaders,
        body: { error: 'profile_not_found', message: 'User profile not found.' },
      };
    }

    const plan = (profileData.plan as PlanType) || 'free_preview';
    const allowedFeatures = PLAN_PERMISSIONS[plan] || [];

    const featureStatus: Record<string, { allowed: boolean; badge?: string }> = {};
    for (const key of ALL_FEATURE_KEYS) {
      const allowed = allowedFeatures.includes(key);
      featureStatus[key] = {
        allowed,
        badge: FEATURE_TIER_BADGES[key],
      };
    }

    return {
      status: 200,
      headers: jsonHeaders,
      body: {
        userId: authenticatedUser.id,
        plan,
        allowedFeatures,
        lockedFeatures: ALL_FEATURE_KEYS.filter((k) => !allowedFeatures.includes(k)),
        features: featureStatus,
      },
    };
  }

  // 4b. Feature Permission Checking Endpoint: POST /api/features/check
  if (pathname === '/api/features/check') {
    if (req.method !== 'POST') {
      return {
        status: 405,
        headers: jsonHeaders,
        body: { error: 'method_not_allowed', message: 'Method Not Allowed' },
      };
    }

    const featureKey = req.body?.feature || req.body?.featureKey;
    if (!featureKey) {
      return {
        status: 400,
        headers: jsonHeaders,
        body: {
          error: 'invalid_feature_key',
          message: 'Feature key is required.',
        },
      };
    }

    // Call server-side canUseFeature
    const result = await canUseFeature(authenticatedUser.id, featureKey, {
      supabase: adminClient,
    });

    if (!result.allowed) {
      return {
        status: result.statusCode || 403,
        headers: jsonHeaders,
        body: result.error,
      };
    }

    return {
      status: 200,
      headers: jsonHeaders,
      body: {
        allowed: true,
        plan: result.plan,
        feature: result.feature,
      },
    };
  }

  // 4c. Feature Boolean Helper Endpoint: POST /api/features/has
  if (pathname === '/api/features/has') {
    if (req.method !== 'POST') {
      return {
        status: 405,
        headers: jsonHeaders,
        body: { error: 'method_not_allowed', message: 'Method Not Allowed' },
      };
    }

    const featureKey = req.body?.feature || req.body?.featureKey;
    if (!featureKey) {
      return {
        status: 400,
        headers: jsonHeaders,
        body: {
          error: 'invalid_feature_key',
          message: 'Feature key is required.',
        },
      };
    }

    const permResult = await canUseFeature(authenticatedUser.id, featureKey, {
      supabase: adminClient,
    });

    if (permResult.statusCode === 400) {
      return {
        status: 400,
        headers: jsonHeaders,
        body: permResult.error,
      };
    }

    return {
      status: 200,
      headers: jsonHeaders,
      body: {
        hasFeature: permResult.allowed,
        feature: featureKey,
      },
    };
  }

  // 5. Mapping of Protected API Endpoints to their required feature keys
  const endpointRequirements: Record<string, { method: string; feature: FeatureKey }[]> = {
    // Projects endpoints require 'saved_projects'
    '/api/projects': [
      { method: 'GET', feature: 'saved_projects' },
      { method: 'POST', feature: 'saved_projects' },
    ],
    // Transcripts endpoints require 'transcript_archive'
    '/api/transcripts': [
      { method: 'GET', feature: 'transcript_archive' },
      { method: 'POST', feature: 'transcript_archive' },
      { method: 'PUT', feature: 'transcript_archive' },
      { method: 'DELETE', feature: 'transcript_archive' },
    ],
    // Outputs endpoints require 'manual_outputs'
    '/api/outputs': [
      { method: 'GET', feature: 'manual_outputs' },
      { method: 'POST', feature: 'manual_outputs' },
      { method: 'PUT', feature: 'manual_outputs' },
      { method: 'DELETE', feature: 'manual_outputs' },
    ],
    // Output actions
    '/api/outputs/copy': [{ method: 'POST', feature: 'copy_output' }],
    '/api/outputs/export-json': [{ method: 'POST', feature: 'json_export' }],
    // Intelligence endpoints (Tasklet 14 Pro Features)
    '/api/search': [
      { method: 'GET', feature: 'keyword_search' },
      { method: 'POST', feature: 'keyword_search' },
    ],
    '/api/search/keywords': [
      { method: 'GET', feature: 'keyword_search' },
      { method: 'POST', feature: 'keyword_search' },
    ],
    '/api/decisions': [
      { method: 'GET', feature: 'decision_memory' },
      { method: 'POST', feature: 'decision_memory' },
      { method: 'PUT', feature: 'decision_memory' },
      { method: 'DELETE', feature: 'decision_memory' },
    ],
    '/api/decision-memory': [
      { method: 'GET', feature: 'decision_memory' },
      { method: 'POST', feature: 'decision_memory' },
      { method: 'PUT', feature: 'decision_memory' },
      { method: 'DELETE', feature: 'decision_memory' },
    ],
    '/api/actions': [
      { method: 'GET', feature: 'action_tracker' },
      { method: 'POST', feature: 'action_tracker' },
      { method: 'PUT', feature: 'action_tracker' },
      { method: 'DELETE', feature: 'action_tracker' },
    ],
    // Tasklet 15 Conversation Intelligence Endpoints
    '/api/insight': [
      { method: 'GET', feature: 'insight' },
      { method: 'POST', feature: 'insight' },
    ],
    '/api/stats': [
      { method: 'GET', feature: 'stats' },
      { method: 'POST', feature: 'stats' },
    ],
    '/api/intelligence/refresh': [
      { method: 'POST', feature: 'insight' },
    ],
    '/api/endpoint-reports': [
      { method: 'GET', feature: 'endpoint_report' },
      { method: 'POST', feature: 'endpoint_report' },
      { method: 'DELETE', feature: 'endpoint_report' },
    ],
    '/api/endpoint-report': [
      { method: 'GET', feature: 'endpoint_report' },
      { method: 'POST', feature: 'endpoint_report' },
      { method: 'DELETE', feature: 'endpoint_report' },
    ],
    '/api/reports/endpoint': [
      { method: 'GET', feature: 'endpoint_report' },
      { method: 'POST', feature: 'endpoint_report' },
    ],
    '/api/export/automation': [{ method: 'POST', feature: 'automation_export' }],

    // Tasklet 16 Team Workspace & Collaboration Endpoints
    '/api/team': [
      { method: 'GET', feature: 'team_workspace' },
      { method: 'POST', feature: 'team_workspace' },
      { method: 'PUT', feature: 'team_workspace' },
      { method: 'DELETE', feature: 'team_workspace' },
    ],
    '/api/teams': [
      { method: 'GET', feature: 'team_workspace' },
      { method: 'POST', feature: 'team_workspace' },
      { method: 'PUT', feature: 'team_workspace' },
      { method: 'DELETE', feature: 'team_workspace' },
    ],
    '/api/team/admin': [
      { method: 'GET', feature: 'team_administration' },
      { method: 'POST', feature: 'team_administration' },
      { method: 'PUT', feature: 'team_administration' },
      { method: 'DELETE', feature: 'team_administration' },
    ],
    '/api/team/invitations': [
      { method: 'GET', feature: 'team_administration' },
      { method: 'POST', feature: 'team_administration' },
      { method: 'PUT', feature: 'team_administration' },
      { method: 'DELETE', feature: 'team_administration' },
    ],
    '/api/team/activity': [
      { method: 'GET', feature: 'team_workspace' },
    ],
    '/api/team/insights': [
      { method: 'GET', feature: 'shared_insights' },
    ],
    '/api/team/stats': [
      { method: 'GET', feature: 'shared_insights' },
    ],
  };

  // Match route
  for (const [routePattern, ruleList] of Object.entries(endpointRequirements)) {
    if (pathname === routePattern || pathname.startsWith(routePattern + '/')) {
      const matchingRule = ruleList.find(
        (r) => r.method === req.method || r.method === '*'
      );

      if (matchingRule) {
        // Enforce backend permission check
        const permCheck = await canUseFeature(authenticatedUser.id, matchingRule.feature, {
          supabase: adminClient,
        });

        if (!permCheck.allowed) {
          return {
            status: permCheck.statusCode || 403,
            headers: jsonHeaders,
            body: permCheck.error,
          };
        }

        // Action is permitted for this user
        return {
          status: 200,
          headers: jsonHeaders,
          body: {
            success: true,
            action: `${req.method} ${pathname}`,
            feature: matchingRule.feature,
            plan: permCheck.plan,
            user_id: authenticatedUser.id,
            timestamp: new Date().toISOString(),
          },
        };
      }
    }
  }

  return {
    status: 404,
    headers: jsonHeaders,
    body: { error: 'not_found', message: `API route not found: ${req.method} ${pathname}` },
  };
}
