import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { canUseFeature } from '../lib/permissions/canUseFeature';
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

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  try {
    const nodeCrypto = await import('crypto');
    return nodeCrypto.createHash('sha256').update(text).digest('hex');
  } catch {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length / 2);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Server-side API Router for Concludo Workspace.
 * Protects backend actions by verifying user credentials or API keys, suspension status, and authoritative profile plan.
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

  // 2. Authentication extraction (Support Bearer JWT, Service Role Key, or Concludo API Key)
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  const apiKeyHeader = req.headers['x-api-key'] || req.headers['X-Api-Key'];

  let token: string | null = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (apiKeyHeader) {
    token = apiKeyHeader.trim();
  }

  if (!token) {
    return {
      status: 401,
      headers: jsonHeaders,
      body: {
        error: 'unauthorized',
        message: 'Authentication required: Missing Bearer token or API key.',
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

  let authenticatedUserId: string = '';
  let authType: 'jwt' | 'api_key' = 'jwt';

  // Check if token is an API key (e.g. starts with "cnc_live_")
  if (token.startsWith('cnc_live_')) {
    authType = 'api_key';
    const keyHash = await sha256Hex(token);

    const { data: apiKeyRecord, error: keyError } = await adminClient
      .from('api_keys')
      .select('*')
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .maybeSingle();

    if (keyError || !apiKeyRecord) {
      return {
        status: 401,
        headers: jsonHeaders,
        body: {
          error: 'invalid_api_key',
          message: 'The provided API key is invalid or has been revoked.',
        },
      };
    }

    if (apiKeyRecord.expires_at && new Date(apiKeyRecord.expires_at).getTime() < Date.now()) {
      return {
        status: 401,
        headers: jsonHeaders,
        body: {
          error: 'api_key_expired',
          message: 'The provided API key has expired.',
        },
      };
    }

    authenticatedUserId = apiKeyRecord.owner_id;

    // Update last_used_at in background
    adminClient
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', apiKeyRecord.id)
      .then();
  } else {
    // Standard Supabase Auth JWT
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
    authenticatedUserId = userData.user.id;
  }

  // 3b. Check User Suspension Status
  const { data: userProfile } = await adminClient
    .from('profiles')
    .select('plan, role, is_suspended')
    .eq('id', authenticatedUserId)
    .single();

  if (userProfile?.is_suspended) {
    return {
      status: 403,
      headers: jsonHeaders,
      body: {
        error: 'user_suspended',
        message: 'This user account has been suspended by an enterprise administrator.',
      },
    };
  }

  // Authenticated retention purge
  if (pathname === '/api/retention/purge') {
    if (userProfile?.role === 'admin' || userProfile?.plan === 'admin') {
      const purgeResult = await executeRetentionPurge(adminClient);
      return {
        status: purgeResult.success ? 200 : 500,
        headers: jsonHeaders,
        body: purgeResult,
      };
    } else {
      const userPurgeResult = await adminClient.rpc('purge_user_expired_records', {
        p_user_id: authenticatedUserId,
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

    if (!userProfile) {
      return {
        status: 404,
        headers: jsonHeaders,
        body: { error: 'profile_not_found', message: 'User profile not found.' },
      };
    }

    const plan = (userProfile.plan as PlanType) || 'free_preview';
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
        userId: authenticatedUserId,
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

    const result = await canUseFeature(authenticatedUserId, featureKey, {
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

    const permResult = await canUseFeature(authenticatedUserId, featureKey, {
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
    '/api/projects': [
      { method: 'GET', feature: 'saved_projects' },
      { method: 'POST', feature: 'saved_projects' },
    ],
    '/api/transcripts': [
      { method: 'GET', feature: 'transcript_archive' },
      { method: 'POST', feature: 'transcript_archive' },
      { method: 'PUT', feature: 'transcript_archive' },
      { method: 'DELETE', feature: 'transcript_archive' },
    ],
    '/api/outputs': [
      { method: 'GET', feature: 'manual_outputs' },
      { method: 'POST', feature: 'manual_outputs' },
      { method: 'PUT', feature: 'manual_outputs' },
      { method: 'DELETE', feature: 'manual_outputs' },
    ],
    '/api/outputs/copy': [{ method: 'POST', feature: 'copy_output' }],
    '/api/outputs/export-json': [{ method: 'POST', feature: 'json_export' }],
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

    // Team Workspace & Collaboration
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

    // Enterprise Administration
    '/api/admin': [
      { method: 'GET', feature: 'organization_admin' },
      { method: 'POST', feature: 'organization_admin' },
      { method: 'PUT', feature: 'organization_admin' },
      { method: 'DELETE', feature: 'organization_admin' },
    ],
    '/api/admin/audit': [
      { method: 'GET', feature: 'audit_logging' },
    ],
    '/api/admin/compliance': [
      { method: 'GET', feature: 'compliance_controls' },
      { method: 'POST', feature: 'compliance_controls' },
    ],
    '/api/admin/security': [
      { method: 'GET', feature: 'security_controls' },
    ],
    '/api/admin/governance': [
      { method: 'GET', feature: 'advanced_governance' },
      { method: 'POST', feature: 'advanced_governance' },
    ],
    '/api/admin/retention': [
      { method: 'GET', feature: 'retention_policies' },
      { method: 'POST', feature: 'retention_policies' },
    ],
    '/api/admin/legal-holds': [
      { method: 'GET', feature: 'legal_hold' },
      { method: 'POST', feature: 'legal_hold' },
      { method: 'PUT', feature: 'legal_hold' },
    ],
    '/api/admin/sso': [
      { method: 'GET', feature: 'enterprise_sso' },
      { method: 'POST', feature: 'enterprise_sso' },
    ],
    '/api/sso': [
      { method: 'GET', feature: 'enterprise_sso' },
      { method: 'POST', feature: 'enterprise_sso' },
    ],
    '/api/organizations': [
      { method: 'GET', feature: 'organization_admin' },
      { method: 'POST', feature: 'organization_admin' },
    ],
    '/api/admin/analytics': [
      { method: 'GET', feature: 'organization_analytics' },
    ],

    // Tasklet 18 Integrations & Connectivity
    '/api/integrations/history': [
      { method: 'GET', feature: 'third_party_integrations' },
    ],
    '/api/integrations': [
      { method: 'GET', feature: 'third_party_integrations' },
      { method: 'POST', feature: 'third_party_integrations' },
      { method: 'PUT', feature: 'third_party_integrations' },
      { method: 'DELETE', feature: 'third_party_integrations' },
    ],
    '/api/automation-export': [
      { method: 'GET', feature: 'automation_export' },
      { method: 'POST', feature: 'automation_export' },
    ],
    '/api/webhooks': [
      { method: 'GET', feature: 'webhooks' },
      { method: 'POST', feature: 'webhooks' },
      { method: 'PUT', feature: 'webhooks' },
      { method: 'DELETE', feature: 'webhooks' },
    ],
    '/api/api-keys': [
      { method: 'GET', feature: 'api_access' },
      { method: 'POST', feature: 'api_access' },
      { method: 'PUT', feature: 'api_access' },
      { method: 'DELETE', feature: 'api_access' },
    ],

    // Public API Endpoints (/api/v1/...)
    '/api/v1/projects': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1/outputs': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1/decisions': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1/actions': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1/reports': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1/insights': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1/stats': [
      { method: 'GET', feature: 'api_access' },
    ],
    '/api/v1': [
      { method: 'GET', feature: 'api_access' },
    ],
  };

  // Match route: sort route patterns by longest first so more specific routes match before prefixes
  const sortedPatterns = Object.entries(endpointRequirements).sort(
    (a, b) => b[0].length - a[0].length
  );

  for (const [routePattern, ruleList] of sortedPatterns) {
    if (pathname === routePattern || pathname.startsWith(routePattern + '/')) {
      const matchingRule = ruleList.find(
        (r) => r.method === req.method || r.method === '*'
      );

      if (matchingRule) {
        // Enforce backend permission check
        const permCheck = await canUseFeature(authenticatedUserId, matchingRule.feature, {
          supabase: adminClient,
        });

        if (!permCheck.allowed) {
          return {
            status: permCheck.statusCode || 403,
            headers: jsonHeaders,
            body: permCheck.error,
          };
        }

        // =============================================================
        // Tasklet 18: Public API /v1 data queries with strict retention
        // =============================================================
        if (pathname.startsWith('/api/v1/')) {
          if (pathname.startsWith('/api/v1/projects')) {
            const parts = pathname.split('/').filter(Boolean);
            const projectId = parts.length > 3 ? parts[3] : null;

            if (projectId) {
              const { data: project } = await adminClient
                .from('projects')
                .select('id, title, client_name, project_name, meeting_date, transcript, notes, created_at, updated_at')
                .eq('id', projectId)
                .is('deleted_at', null)
                .maybeSingle();

              return {
                status: project ? 200 : 404,
                headers: jsonHeaders,
                body: project ? { data: project, auth: authType } : { error: 'not_found', message: 'Project not found' },
              };
            }

            const { data } = await adminClient
              .from('projects')
              .select('id, title, client_name, project_name, meeting_date, created_at, updated_at')
              .eq('user_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('updated_at', { ascending: false });

            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: data || [], auth: authType, count: data?.length || 0 },
            };
          }

          if (pathname.startsWith('/api/v1/outputs')) {
            const { data } = await adminClient
              .from('outputs')
              .select('id, project_id, output_type, content, created_at')
              .eq('user_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: data || [], auth: authType, count: data?.length || 0 },
            };
          }

          if (pathname.startsWith('/api/v1/decisions')) {
            const { data } = await adminClient
              .from('decision_memory')
              .select('id, decision_title, decision_summary, decision_reasoning, decision_owner, decision_date, project_id, created_at')
              .eq('user_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('decision_date', { ascending: false });

            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: data || [], auth: authType, count: data?.length || 0 },
            };
          }

          if (pathname.startsWith('/api/v1/actions')) {
            const { data } = await adminClient
              .from('action_tracker')
              .select('id, action_title, action_description, owner_name, due_date, status, project_id, created_at')
              .eq('user_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('due_date', { ascending: true });

            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: data || [], auth: authType, count: data?.length || 0 },
            };
          }

          if (pathname.startsWith('/api/v1/reports')) {
            const { data } = await adminClient
              .from('endpoint_reports')
              .select('id, title, report_content, report_period, generated_at, created_at')
              .eq('user_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: data || [], auth: authType, count: data?.length || 0 },
            };
          }

          if (pathname.startsWith('/api/v1/insights') || pathname.startsWith('/api/v1/stats')) {
            const { data } = await adminClient
              .from('generated_intelligence')
              .select('*')
              .eq('user_id', authenticatedUserId)
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: data || {}, auth: authType },
            };
          }

          return {
            status: 200,
            headers: jsonHeaders,
            body: {
              version: 'v1',
              endpoints: [
                '/api/v1/projects',
                '/api/v1/outputs',
                '/api/v1/decisions',
                '/api/v1/actions',
                '/api/v1/reports',
                '/api/v1/insights',
                '/api/v1/stats',
              ],
              auth: authType,
            },
          };
        }

        // =============================================================
        // Tasklet 18: Specific Integration CRUD, Exports, Webhooks & API Keys Handlers
        // =============================================================
        if (pathname === '/api/integrations') {
          if (req.method === 'GET') {
            const { data, error } = await adminClient
              .from('integrations')
              .select('*')
              .eq('user_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }

          if (req.method === 'POST') {
            const { provider, settings, team_id, organization_id } = req.body || {};
            if (!provider) return { status: 400, headers: jsonHeaders, body: { error: 'provider_required' } };

            const { data, error } = await adminClient
              .from('integrations')
              .insert({
                user_id: authenticatedUserId,
                provider,
                status: 'connected',
                settings: settings || {},
                team_id: team_id || null,
                organization_id: organization_id || null,
                connected_at: new Date().toISOString(),
              })
              .select()
              .single();

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 201, headers: jsonHeaders, body: { data } };
          }
        }

        if (pathname === '/api/integrations/history') {
          if (req.method === 'GET') {
            const { data, error } = await adminClient
              .from('integration_sync_logs')
              .select('*')
              .eq('user_id', authenticatedUserId)
              .order('created_at', { ascending: false });

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }
        }

        if (pathname === '/api/automation-export') {
          if (req.method === 'GET') {
            const { data, error } = await adminClient
              .from('automation_exports')
              .select('*')
              .eq('user_id', authenticatedUserId)
              .order('created_at', { ascending: false });

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }
        }

        if (pathname === '/api/api-keys') {
          if (req.method === 'GET') {
            // Strictly exclude key_hash
            const { data, error } = await adminClient
              .from('api_keys')
              .select('id, owner_id, team_id, organization_id, name, key_prefix, status, created_at, expires_at, last_used_at')
              .eq('owner_id', authenticatedUserId)
              .order('created_at', { ascending: false });

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }

          if (req.method === 'POST') {
            const { name, expiresInDays } = req.body || {};
            if (!name) return { status: 400, headers: jsonHeaders, body: { error: 'name_required' } };

            const rawSecret = `cnc_live_${generateRandomHex(32)}`;
            const key_prefix = rawSecret.slice(0, 16) + '...';
            const key_hash = await sha256Hex(rawSecret);

            let expires_at: string | null = null;
            if (expiresInDays && expiresInDays > 0) {
              const expDate = new Date();
              expDate.setDate(expDate.getDate() + expiresInDays);
              expires_at = expDate.toISOString();
            }

            const { data, error } = await adminClient
              .from('api_keys')
              .insert({
                owner_id: authenticatedUserId,
                name,
                key_hash,
                key_prefix,
                status: 'active',
                expires_at,
              })
              .select('id, owner_id, team_id, organization_id, name, key_prefix, status, created_at, expires_at, last_used_at')
              .single();

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return {
              status: 201,
              headers: jsonHeaders,
              body: {
                apiKey: rawSecret, // Returned ONLY once
                keyRecord: data,
              },
            };
          }
        }

        if (pathname === '/api/webhooks') {
          if (req.method === 'GET') {
            // Exclude secret_key in normal list
            const { data, error } = await adminClient
              .from('webhooks')
              .select('id, owner_id, team_id, organization_id, name, endpoint_url, status, events, created_at, updated_at')
              .eq('owner_id', authenticatedUserId)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }

          if (req.method === 'POST') {
            const { name, endpoint_url, events } = req.body || {};
            if (!name || !endpoint_url) {
              return { status: 400, headers: jsonHeaders, body: { error: 'name_and_endpoint_required' } };
            }

            const secret_key = `whsec_${generateRandomHex(32)}`;

            const { data, error } = await adminClient
              .from('webhooks')
              .insert({
                owner_id: authenticatedUserId,
                name,
                endpoint_url,
                events: events || ['action_created', 'decision_created', 'report_generated'],
                status: 'active',
                secret_key,
              })
              .select('id, owner_id, team_id, organization_id, name, endpoint_url, status, events, created_at, updated_at')
              .single();

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return {
              status: 201,
              headers: jsonHeaders,
              body: {
                webhook: data,
                signingSecret: secret_key, // Returned ONLY once
              },
            };
          }
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
            user_id: authenticatedUserId,
            auth: authType,
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
