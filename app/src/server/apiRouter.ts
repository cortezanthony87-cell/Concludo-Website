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
import { INITIAL_AGENTS } from '../lib/agents/types';
import { runAgent } from '../lib/agents/agentRunner';
import {
  getAgentMemory,
  setAgentMemory,
  listAgentMemory,
  deleteAgentMemory,
  fetchAgentActivity,
} from '../lib/agents/agentMemoryService';
import {
  fetchWorkflows,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  triggerWorkflow,
  fetchWorkflowExecutions,
  fetchWorkflowApprovals,
  respondToApproval,
} from '../lib/workflows/workflowService';
import { getPredictiveAnalysis } from '../lib/predictive/predictiveService';
import {
  createExecutiveBriefing,
  fetchExecutiveBriefings,
  fetchExecutiveBriefingById,
  softDeleteExecutiveBriefing,
} from '../lib/predictive/executiveBriefingService';

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

    // Tasklet 19 AI Agents, Workflow Orchestration & Approvals
    '/api/agents/dashboard': [
      { method: 'GET', feature: 'ai_agents' },
    ],
    '/api/agents/activity': [
      { method: 'GET', feature: 'ai_agents' },
      { method: 'POST', feature: 'ai_agents' },
    ],
    '/api/agents/memory': [
      { method: 'GET', feature: 'agent_memory' },
      { method: 'POST', feature: 'agent_memory' },
      { method: 'DELETE', feature: 'agent_memory' },
    ],
    '/api/agents/run': [
      { method: 'POST', feature: 'ai_agents' },
    ],
    '/api/agents': [
      { method: 'GET', feature: 'ai_agents' },
      { method: 'POST', feature: 'ai_agents' },
    ],
    '/api/workflows/executions': [
      { method: 'GET', feature: 'workflow_orchestration' },
      { method: 'POST', feature: 'workflow_orchestration' },
    ],
    '/api/workflows': [
      { method: 'GET', feature: 'workflow_orchestration' },
      { method: 'POST', feature: 'workflow_orchestration' },
      { method: 'PUT', feature: 'workflow_orchestration' },
      { method: 'DELETE', feature: 'workflow_orchestration' },
    ],
    '/api/approvals': [
      { method: 'GET', feature: 'workflow_approvals' },
      { method: 'POST', feature: 'workflow_approvals' },
      { method: 'PUT', feature: 'workflow_approvals' },
    ],

    // Tasklet 20 Predictive Intelligence & Strategic Recommendations
    '/api/predictive/intelligence': [
      { method: 'GET', feature: 'predictive_intelligence' },
      { method: 'POST', feature: 'predictive_intelligence' },
    ],
    '/api/predictive/risks': [
      { method: 'GET', feature: 'predictive_intelligence' },
    ],
    '/api/predictive/opportunities': [
      { method: 'GET', feature: 'predictive_intelligence' },
    ],
    '/api/predictive/recommendations': [
      { method: 'GET', feature: 'strategic_recommendations' },
    ],
    '/api/predictive/health': [
      { method: 'GET', feature: 'organizational_health_scoring' },
    ],
    '/api/predictive/forecasts': [
      { method: 'GET', feature: 'forecasting' },
    ],
    '/api/executive-intelligence': [
      { method: 'GET', feature: 'executive_intelligence' },
    ],
    '/api/executive-briefings': [
      { method: 'GET', feature: 'executive_intelligence' },
      { method: 'POST', feature: 'executive_intelligence' },
      { method: 'DELETE', feature: 'executive_intelligence' },
    ],
    '/api/decisions/outcomes': [
      { method: 'GET', feature: 'predictive_intelligence' },
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

        // =============================================================
        // Tasklet 19: AI Agents, Workflows, Memory & Approvals Handlers
        // =============================================================
        if (pathname === '/api/agents') {
          if (req.method === 'GET') {
            return {
              status: 200,
              headers: jsonHeaders,
              body: { data: INITIAL_AGENTS },
            };
          }
        }

        if (pathname === '/api/agents/dashboard') {
          if (req.method === 'GET') {
            const { count: pendingApprovalsCount } = await adminClient
              .from('workflow_approvals')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'pending');

            const { count: executionsCount } = await adminClient
              .from('workflow_executions')
              .select('*', { count: 'exact', head: true });

            const { count: successExecutionsCount } = await adminClient
              .from('workflow_executions')
              .select('*', { count: 'exact', head: true })
              .eq('status', 'completed');

            const { data: recentExecutions } = await adminClient
              .from('workflow_executions')
              .select('*, workflow:workflows(name, trigger_type)')
              .order('created_at', { ascending: false })
              .limit(10);

            const successRate = executionsCount && executionsCount > 0
              ? Math.round(((successExecutionsCount || 0) / executionsCount) * 100)
              : 100;

            return {
              status: 200,
              headers: jsonHeaders,
              body: {
                activeAgents: INITIAL_AGENTS.length,
                runningWorkflows: executionsCount || 0,
                pendingApprovals: pendingApprovalsCount || 0,
                successRate: `${successRate}%`,
                recentExecutions: recentExecutions || [],
              },
            };
          }
        }

        if (pathname === '/api/agents/run') {
          if (req.method === 'POST') {
            const { agentType, projectId, teamId, organizationId, parameters } = req.body || {};
            if (!agentType) {
              return { status: 400, headers: jsonHeaders, body: { error: 'agent_type_required' } };
            }

            const result = await runAgent({
              agentType,
              userId: authenticatedUserId,
              projectId,
              teamId,
              organizationId,
              parameters,
              admin: true,
            });

            return {
              status: result.status === 'failed' ? 500 : 200,
              headers: jsonHeaders,
              body: { data: result },
            };
          }
        }

        if (pathname === '/api/agents/activity') {
          if (req.method === 'GET') {
            const activities = await fetchAgentActivity({
              userId: authenticatedUserId,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: activities } };
          }
        }

        if (pathname === '/api/agents/memory' || pathname.startsWith('/api/agents/memory/')) {
          if (req.method === 'GET') {
            const memories = await listAgentMemory({
              ownerId: authenticatedUserId,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: memories } };
          }

          if (req.method === 'POST') {
            const { agentType, memoryKey, memoryValue, teamId, organizationId } = req.body || {};
            if (!agentType || !memoryKey) {
              return { status: 400, headers: jsonHeaders, body: { error: 'invalid_memory_payload' } };
            }
            const record = await setAgentMemory({
              agentType,
              memoryKey,
              memoryValue: memoryValue || {},
              ownerId: authenticatedUserId,
              teamId,
              organizationId,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: record } };
          }

          if (req.method === 'DELETE') {
            const parts = pathname.split('/').filter(Boolean);
            const id = parts[parts.length - 1];
            await deleteAgentMemory(id, authenticatedUserId, true);
            return { status: 200, headers: jsonHeaders, body: { success: true } };
          }
        }

        if (pathname === '/api/workflows/executions') {
          if (req.method === 'GET') {
            const executions = await fetchWorkflowExecutions({
              userId: authenticatedUserId,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: executions } };
          }

          if (req.method === 'POST') {
            const { workflowId, triggerData } = req.body || {};
            if (!workflowId) {
              return { status: 400, headers: jsonHeaders, body: { error: 'workflow_id_required' } };
            }
            const executionResult = await triggerWorkflow({
              workflowId,
              userId: authenticatedUserId,
              triggerData,
              admin: true,
            });
            return { status: 201, headers: jsonHeaders, body: { data: executionResult } };
          }
        }

        if (pathname === '/api/workflows' || pathname.startsWith('/api/workflows/')) {
          if (req.method === 'GET') {
            const workflows = await fetchWorkflows({
              userId: authenticatedUserId,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: workflows } };
          }

          if (req.method === 'POST') {
            const { name, description, trigger_type, trigger_config, conditions, actions, execution_type, team_id, organization_id } = req.body || {};
            if (!name || !trigger_type) {
              return { status: 400, headers: jsonHeaders, body: { error: 'name_and_trigger_type_required' } };
            }
            const workflow = await createWorkflow({
              owner_id: authenticatedUserId,
              team_id,
              organization_id,
              name,
              description,
              trigger_type,
              trigger_config,
              conditions,
              actions,
              execution_type: execution_type || 'approval_required',
            }, true);
            return { status: 201, headers: jsonHeaders, body: { data: workflow } };
          }

          if (req.method === 'PUT') {
            const parts = pathname.split('/').filter(Boolean);
            const id = parts[parts.length - 1];
            const updated = await updateWorkflow(id, req.body || {}, authenticatedUserId, true);
            return { status: 200, headers: jsonHeaders, body: { data: updated } };
          }

          if (req.method === 'DELETE') {
            const parts = pathname.split('/').filter(Boolean);
            const id = parts[parts.length - 1];
            await deleteWorkflow(id, authenticatedUserId, true);
            return { status: 200, headers: jsonHeaders, body: { success: true } };
          }
        }

        if (pathname === '/api/approvals' || pathname.startsWith('/api/approvals/')) {
          if (req.method === 'GET') {
            const approvals = await fetchWorkflowApprovals({
              userId: authenticatedUserId,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: approvals } };
          }

          if (req.method === 'PUT') {
            const parts = pathname.split('/').filter(Boolean);
            const id = parts[parts.length - 1];
            const { decision, notes } = req.body || {};
            if (!decision || (decision !== 'approve' && decision !== 'reject')) {
              return { status: 400, headers: jsonHeaders, body: { error: 'invalid_decision' } };
            }
            const updated = await respondToApproval({
              approvalId: id,
              approverId: authenticatedUserId,
              decision,
              notes,
              admin: true,
            });
            return { status: 200, headers: jsonHeaders, body: { data: updated } };
          }
        }

        // =============================================================
        // Tasklet 20: Predictive Intelligence, Briefings & Forecasting
        // =============================================================
        if (pathname === '/api/predictive/intelligence') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
              saveSnapshot: req.method === 'POST',
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/predictive/risks') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis.riskPredictions } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/predictive/opportunities') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis.opportunitySignals } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/predictive/recommendations') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis.strategicRecommendations } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/predictive/health') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis.healthScore } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/predictive/forecasts') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis.forecasts } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/decisions/outcomes') {
          const scope = (req.body?.scope as any) || 'individual';
          const scopeId = req.body?.scopeId;
          try {
            const analysis = await getPredictiveAnalysis({
              scope,
              scopeId,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: analysis.decisionQuality } };
          } catch (err: any) {
            if (err.message && err.message.includes('Unauthorized')) {
              return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
            }
            return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
          }
        }

        if (pathname === '/api/executive-intelligence') {
          // Look up user's organization for org-wide strategic view
          const { data: memberRecord } = await adminClient
            .from('organization_members')
            .select('organization_id')
            .eq('user_id', authenticatedUserId)
            .limit(1)
            .maybeSingle();

          const analysis = await getPredictiveAnalysis({
            scope: memberRecord?.organization_id ? 'organization' : 'individual',
            scopeId: memberRecord?.organization_id || undefined,
            userId: authenticatedUserId,
          }, adminClient);

          return { status: 200, headers: jsonHeaders, body: { data: analysis.executiveIntelligence } };
        }

        if (pathname === '/api/executive-briefings' || pathname.startsWith('/api/executive-briefings/')) {
          if (req.method === 'GET') {
            const parts = pathname.split('/').filter(Boolean);
            if (parts.length > 2) {
              const briefing = await fetchExecutiveBriefingById(parts[2], adminClient);
              if (!briefing) return { status: 404, headers: jsonHeaders, body: { error: 'briefing_not_found' } };

              // Authoritative scope verification for single briefing access
              if (briefing.generated_by !== authenticatedUserId) {
                let hasAccess = false;
                if (briefing.organization_id) {
                  const { data: org } = await adminClient
                    .from('organizations')
                    .select('owner_id')
                    .eq('id', briefing.organization_id)
                    .maybeSingle();

                  if (org?.owner_id === authenticatedUserId) {
                    hasAccess = true;
                  } else {
                    const { data: orgMem } = await adminClient
                      .from('organization_members')
                      .select('id')
                      .eq('organization_id', briefing.organization_id)
                      .eq('user_id', authenticatedUserId)
                      .maybeSingle();
                    if (orgMem) hasAccess = true;
                  }
                }
                if (!hasAccess && briefing.team_id) {
                  const { data: teamMem } = await adminClient
                    .from('team_members')
                    .select('id')
                    .eq('team_id', briefing.team_id)
                    .eq('user_id', authenticatedUserId)
                    .maybeSingle();
                  if (teamMem) hasAccess = true;
                }
                if (!hasAccess) {
                  return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_briefing_access' } };
                }
              }

              return { status: 200, headers: jsonHeaders, body: { data: briefing } };
            }

            const { data: memberRecord } = await adminClient
              .from('organization_members')
              .select('organization_id')
              .eq('user_id', authenticatedUserId)
              .limit(1)
              .maybeSingle();

            const briefings = await fetchExecutiveBriefings({
              organizationId: memberRecord?.organization_id || null,
              userId: authenticatedUserId,
            }, adminClient);

            return { status: 200, headers: jsonHeaders, body: { data: briefings } };
          }

          if (req.method === 'POST') {
            const { title, reportType, organizationId, teamId } = req.body || {};
            if (!title || !reportType) {
              return { status: 400, headers: jsonHeaders, body: { error: 'title_and_report_type_required' } };
            }

            try {
              const analysis = await getPredictiveAnalysis({
                scope: organizationId ? 'organization' : teamId ? 'team' : 'individual',
                scopeId: organizationId || teamId,
                userId: authenticatedUserId,
              }, adminClient);

              const result = await createExecutiveBriefing({
                title,
                reportType,
                organizationId,
                teamId,
                userId: authenticatedUserId,
                analysis,
              }, adminClient);

              if (!result.success) {
                return { status: 500, headers: jsonHeaders, body: { error: result.error } };
              }
              return { status: 201, headers: jsonHeaders, body: { data: result.data } };
            } catch (err: any) {
              if (err.message && err.message.includes('Unauthorized')) {
                return { status: 403, headers: jsonHeaders, body: { error: 'forbidden_scope', message: err.message } };
              }
              return { status: 500, headers: jsonHeaders, body: { error: 'internal_error', message: err.message } };
            }
          }

          if (req.method === 'DELETE') {
            const parts = pathname.split('/').filter(Boolean);
            const id = parts[parts.length - 1];
            try {
              const deleted = await softDeleteExecutiveBriefing(id, authenticatedUserId, adminClient);
              return { status: 200, headers: jsonHeaders, body: { success: deleted } };
            } catch (err: any) {
              return { status: 500, headers: jsonHeaders, body: { error: err.message } };
            }
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
