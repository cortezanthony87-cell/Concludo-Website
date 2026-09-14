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
import { KnowledgeEngine } from '../lib/knowledge/knowledgeEngine';
import { KnowledgeClient } from '../lib/knowledge/knowledgeClient';
import { recordAuditLog } from '../lib/enterprise/auditService';
import { CopilotEngine } from '../lib/copilot/copilotEngine';
import { AssistantType } from '../lib/copilot/types';
import {
  fetchConversations,
  fetchConversationById,
  createConversation,
  updateConversation,
  softDeleteConversation,
  fetchMessages,
  createMessage,
  fetchPrompts,
  createPrompt,
  softDeletePrompt,
} from '../lib/copilot/copilotService';
import { SpecializedAssistants } from '../lib/copilot/specializedAssistants';

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
  const queryParams = new URL(req.url, 'http://localhost').searchParams;

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
  const reqHeaders = req.headers || {};
  const authHeader = reqHeaders['authorization'] || reqHeaders['Authorization'];
  const apiKeyHeader = reqHeaders['x-api-key'] || reqHeaders['X-Api-Key'];

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

    // Tasklet 21 Knowledge Network & Organizational Memory
    '/api/knowledge/sync': [
      { method: 'POST', feature: 'knowledge_graph' },
    ],
    '/api/knowledge/nodes': [
      { method: 'GET', feature: 'knowledge_graph' },
      { method: 'POST', feature: 'knowledge_graph' },
    ],
    '/api/knowledge/relationships': [
      { method: 'GET', feature: 'relationship_discovery' },
      { method: 'POST', feature: 'relationship_discovery' },
      { method: 'PATCH', feature: 'relationship_discovery' },
      { method: 'PUT', feature: 'relationship_discovery' },
    ],
    '/api/knowledge/graph': [
      { method: 'GET', feature: 'knowledge_graph' },
    ],
    '/api/knowledge/visualization': [
      { method: 'GET', feature: 'knowledge_graph' },
    ],
    '/api/knowledge/search': [
      { method: 'POST', feature: 'knowledge_explorer' },
    ],
    '/api/knowledge/decision-network': [
      { method: 'GET', feature: 'evidence_networks' },
    ],
    '/api/knowledge/project-network': [
      { method: 'GET', feature: 'evidence_networks' },
    ],
    '/api/knowledge/evidence': [
      { method: 'GET', feature: 'evidence_networks' },
    ],
    '/api/knowledge/timeline': [
      { method: 'GET', feature: 'organizational_memory' },
    ],
    '/api/knowledge/journey': [
      { method: 'GET', feature: 'organizational_memory' },
    ],
    '/api/knowledge/clusters': [
      { method: 'GET', feature: 'organizational_memory' },
    ],
    '/api/knowledge/lessons': [
      { method: 'GET', feature: 'organizational_memory' },
      { method: 'POST', feature: 'organizational_memory' },
      { method: 'DELETE', feature: 'organizational_memory' },
    ],
    '/api/knowledge/analytics': [
      { method: 'GET', feature: 'knowledge_analytics' },
    ],
    '/api/executive-explorer': [
      { method: 'GET', feature: 'executive_knowledge_explorer' },
    ],
    // Tasklet 22 Copilot Routes
    '/api/copilot/chat': [
      { method: 'POST', feature: 'concludo_copilot' },
    ],
    '/api/copilot/query': [
      { method: 'POST', feature: 'natural_language_search' },
    ],
    '/api/copilot/conversations': [
      { method: 'GET', feature: 'concludo_copilot' },
      { method: 'POST', feature: 'concludo_copilot' },
      { method: 'DELETE', feature: 'concludo_copilot' },
    ],
    '/api/copilot/prompts': [
      { method: 'GET', feature: 'concludo_copilot' },
      { method: 'POST', feature: 'concludo_copilot' },
      { method: 'DELETE', feature: 'concludo_copilot' },
    ],
    '/api/copilot/decision-assistant': [
      { method: 'POST', feature: 'decision_assistant' },
    ],
    '/api/copilot/action-assistant': [
      { method: 'POST', feature: 'concludo_copilot' },
    ],
    '/api/copilot/risk-assistant': [
      { method: 'POST', feature: 'concludo_copilot' },
    ],
    '/api/copilot/executive-assistant': [
      { method: 'POST', feature: 'executive_assistant' },
    ],
    '/api/copilot/knowledge-assistant': [
      { method: 'POST', feature: 'knowledge_assistant' },
    ],
    '/api/copilot/briefing': [
      { method: 'POST', feature: 'executive_assistant' },
    ],
    '/api/copilot/execute-request': [
      { method: 'POST', feature: 'concludo_copilot' },
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

        // =============================================================
        // Tasklet 21: Knowledge Graph, Organizational Memory & Explorer
        // =============================================================
        const knowledgeEngine = new KnowledgeEngine(adminClient);

        // Tenant scope verification
        const requestedOrgId = queryParams.get('organization_id') || req.body?.organizationId || req.body?.organization_id;
        if (requestedOrgId) {
          const { data: member } = await adminClient
            .from('organization_members')
            .select('id')
            .eq('organization_id', requestedOrgId)
            .eq('user_id', authenticatedUserId)
            .maybeSingle();
          if (!member) {
            return { status: 403, headers: jsonHeaders, body: { error: 'Access denied: user is not an authorized member of this organization' } };
          }
        }

        const requestedTeamId = queryParams.get('team_id') || req.body?.teamId || req.body?.team_id;
        if (requestedTeamId) {
          const { data: member } = await adminClient
            .from('team_members')
            .select('id')
            .eq('team_id', requestedTeamId)
            .eq('user_id', authenticatedUserId)
            .maybeSingle();
          if (!member) {
            return { status: 403, headers: jsonHeaders, body: { error: 'Access denied: user is not an authorized member of this team' } };
          }
        }

        if (pathname === '/api/knowledge/sync' && req.method === 'POST') {
          const syncResult = await knowledgeEngine.syncKnowledgeGraph({
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });

          await recordAuditLog({
            action: 'knowledge_relationship_created',
            entityType: 'knowledge_graph',
            details: syncResult,
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 200, headers: jsonHeaders, body: { data: syncResult } };
        }

        if (pathname === '/api/knowledge/nodes') {
          if (req.method === 'GET') {
            let q = adminClient
              .from('knowledge_nodes')
              .select('*')
              .is('deleted_at', null)
              .order('updated_at', { ascending: false });

            if (requestedOrgId) q = q.eq('organization_id', requestedOrgId);
            else if (requestedTeamId) q = q.eq('team_id', requestedTeamId);
            else q = q.eq('owner_id', authenticatedUserId);

            const { data, error } = await q;
            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }
        }

        if (pathname === '/api/knowledge/relationships' || pathname.startsWith('/api/knowledge/relationships/')) {
          let nodeQuery = adminClient.from('knowledge_nodes').select('id').is('deleted_at', null);
          if (requestedOrgId) {
            nodeQuery = nodeQuery.eq('organization_id', requestedOrgId);
          } else if (requestedTeamId) {
            nodeQuery = nodeQuery.eq('team_id', requestedTeamId);
          } else {
            nodeQuery = nodeQuery.eq('owner_id', authenticatedUserId);
          }
          const { data: userNodes } = await nodeQuery;
          const accessibleNodeIds = (userNodes || []).map((n: any) => n.id);

          if (req.method === 'GET') {
            if (accessibleNodeIds.length === 0) {
              return { status: 200, headers: jsonHeaders, body: { data: [] } };
            }

            const { data, error } = await adminClient
              .from('knowledge_relationships')
              .select('*, source_node:knowledge_nodes!source_node_id(*), target_node:knowledge_nodes!target_node_id(*)')
              .in('source_node_id', accessibleNodeIds)
              .in('target_node_id', accessibleNodeIds)
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }
          if (req.method === 'POST') {
            const { source_node_id, target_node_id, relationship_type, confidence_score, context_notes } = req.body || {};

            if (!accessibleNodeIds.includes(source_node_id) || !accessibleNodeIds.includes(target_node_id)) {
              return { status: 403, headers: jsonHeaders, body: { error: 'Forbidden: source or target node outside authorized scope' } };
            }

            const { data, error } = await adminClient
              .from('knowledge_relationships')
              .insert({
                source_node_id,
                target_node_id,
                relationship_type,
                confidence_score: confidence_score || 85,
                context_notes,
              })
              .select()
              .single();

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };

            await recordAuditLog({
              action: 'knowledge_relationship_created',
              entityType: 'knowledge_relationship',
              entityId: data.id,
              details: { relationship_type, confidence_score },
              userId: authenticatedUserId,
              admin: true,
            });

            return { status: 201, headers: jsonHeaders, body: { data } };
          }
          if (req.method === 'PATCH' || req.method === 'PUT') {
            const parts = pathname.split('/').filter(Boolean);
            const relId = parts[parts.length - 1];

            // Verify relationship ownership / access
            const { data: existingRel } = await adminClient
              .from('knowledge_relationships')
              .select('id, source_node_id, target_node_id')
              .eq('id', relId)
              .maybeSingle();

            if (!existingRel) {
              return { status: 404, headers: jsonHeaders, body: { error: 'Relationship not found' } };
            }

            if (!accessibleNodeIds.includes(existingRel.source_node_id)) {
              return { status: 403, headers: jsonHeaders, body: { error: 'Forbidden: relationship outside authorized scope' } };
            }

            const { confidence_score, context_notes, relationship_type } = req.body || {};
            const updateData: any = { updated_at: new Date().toISOString() };
            if (confidence_score !== undefined) updateData.confidence_score = confidence_score;
            if (context_notes !== undefined) updateData.context_notes = context_notes;
            if (relationship_type !== undefined) updateData.relationship_type = relationship_type;

            const { data, error } = await adminClient
              .from('knowledge_relationships')
              .update(updateData)
              .eq('id', relId)
              .select()
              .single();

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };

            await recordAuditLog({
              action: 'knowledge_relationship_updated',
              entityType: 'knowledge_relationship',
              entityId: relId,
              details: updateData,
              userId: authenticatedUserId,
              admin: true,
            });

            return { status: 200, headers: jsonHeaders, body: { data } };
          }
        }

        if (pathname === '/api/knowledge/graph' || pathname === '/api/knowledge/visualization') {
          const isVis = pathname === '/api/knowledge/visualization' || queryParams.get('view') === 'visualization';

          let nodeQuery = adminClient.from('knowledge_nodes').select('*').is('deleted_at', null);
          if (requestedOrgId) nodeQuery = nodeQuery.eq('organization_id', requestedOrgId);
          else if (requestedTeamId) nodeQuery = nodeQuery.eq('team_id', requestedTeamId);
          else nodeQuery = nodeQuery.eq('owner_id', authenticatedUserId);

          const { data: nodes = [] } = await nodeQuery;
          const accessibleIds = (nodes || []).map((n: any) => n.id);

          let rels: any[] = [];
          if (accessibleIds.length > 0) {
            const { data: relData = [] } = await adminClient
              .from('knowledge_relationships')
              .select('*, source_node:knowledge_nodes!source_node_id(*), target_node:knowledge_nodes!target_node_id(*)')
              .in('source_node_id', accessibleIds)
              .in('target_node_id', accessibleIds)
              .is('deleted_at', null);
            rels = relData || [];
          }

          await recordAuditLog({
            action: isVis ? 'knowledge_visualization_access' : 'knowledge_explorer_access',
            entityType: isVis ? 'knowledge_visualization' : 'knowledge_graph',
            details: { total_nodes: (nodes || []).length, total_relationships: rels.length },
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 200, headers: jsonHeaders, body: { data: { nodes, relationships: rels } } };
        }

        if (pathname === '/api/knowledge/search' && req.method === 'POST') {
          const query = req.body?.query || '';
          const results = await knowledgeEngine.searchKnowledge(query, {
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });

          await recordAuditLog({
            action: 'knowledge_search',
            entityType: 'knowledge_search',
            details: { query, resultsCount: results.length },
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 200, headers: jsonHeaders, body: { data: results } };
        }

        if (pathname.startsWith('/api/knowledge/decision-network/')) {
          const decisionId = pathname.split('/api/knowledge/decision-network/')[1];
          const net = await knowledgeEngine.getDecisionNetwork(decisionId, {
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });
          if (!net) return { status: 404, headers: jsonHeaders, body: { error: 'decision_network_not_found' } };
          return { status: 200, headers: jsonHeaders, body: { data: net } };
        }

        if (pathname.startsWith('/api/knowledge/project-network/')) {
          const projectId = pathname.split('/api/knowledge/project-network/')[1];
          const net = await knowledgeEngine.getProjectNetwork(projectId, {
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });
          if (!net) return { status: 404, headers: jsonHeaders, body: { error: 'project_network_not_found' } };
          return { status: 200, headers: jsonHeaders, body: { data: net } };
        }

        if (pathname.startsWith('/api/knowledge/evidence/')) {
          const parts = pathname.replace('/api/knowledge/evidence/', '').split('/');
          const entityType = parts[0] || 'recommendation';
          const entityId = parts[1] || 'default';
          const evidence = await knowledgeEngine.getEvidenceNetwork(entityType, entityId, {
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });
          return { status: 200, headers: jsonHeaders, body: { data: evidence } };
        }

        if (pathname === '/api/knowledge/timeline') {
          const timeline = await knowledgeEngine.getKnowledgeTimeline({
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });
          return { status: 200, headers: jsonHeaders, body: { data: timeline } };
        }

        if (pathname.startsWith('/api/knowledge/journey/')) {
          const targetId = pathname.split('/api/knowledge/journey/')[1];
          const journey = await knowledgeEngine.getKnowledgeJourney(targetId, {
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });
          return { status: 200, headers: jsonHeaders, body: { data: journey } };
        }

        if (pathname === '/api/knowledge/clusters') {
          const clusters = await knowledgeEngine.getKnowledgeClusters({
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });

          await recordAuditLog({
            action: 'knowledge_cluster_creation',
            entityType: 'knowledge_cluster',
            details: { count: clusters.length, categories: clusters.map(c => c.category) },
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 200, headers: jsonHeaders, body: { data: clusters } };
        }

        if (pathname === '/api/knowledge/analytics') {
          const analytics = await knowledgeEngine.getKnowledgeAnalytics({
            userId: authenticatedUserId,
            teamId: requestedTeamId || null,
            organizationId: requestedOrgId || null,
          });

          await recordAuditLog({
            action: 'knowledge_analytics_access',
            entityType: 'knowledge_analytics',
            details: { total_nodes: analytics.total_nodes, total_relationships: analytics.total_relationships },
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 200, headers: jsonHeaders, body: { data: analytics } };
        }

        if (pathname === '/api/executive-explorer') {
          const [clusters, analytics, timeline] = await Promise.all([
            knowledgeEngine.getKnowledgeClusters({ userId: authenticatedUserId, organizationId: requestedOrgId || null }),
            knowledgeEngine.getKnowledgeAnalytics({ userId: authenticatedUserId, organizationId: requestedOrgId || null }),
            knowledgeEngine.getKnowledgeTimeline({ userId: authenticatedUserId, organizationId: requestedOrgId || null }),
          ]);

          await recordAuditLog({
            action: 'knowledge_explorer_access',
            entityType: 'executive_explorer',
            details: { clustersCount: clusters.length, totalNodes: analytics.total_nodes },
            userId: authenticatedUserId,
            admin: true,
          });

          return {
            status: 200,
            headers: jsonHeaders,
            body: {
              data: {
                clusters,
                analytics,
                timeline: timeline.slice(0, 10),
                strategicThemes: [
                  'Meeting-to-Execution Automation Acceleration',
                  'Enterprise Compliance, SSO and Data Governance',
                  'Cross-Project Dependency Management & Risk Triage',
                  'Decision Lineage Traceability & Audit Verification',
                ],
              },
            },
          };
        }

        if (pathname === '/api/knowledge/lessons' || pathname.startsWith('/api/knowledge/lessons/')) {
          if (req.method === 'GET') {
            let q = adminClient
              .from('lessons_learned')
              .select('*')
              .is('deleted_at', null)
              .order('created_at', { ascending: false });

            if (requestedOrgId) q = q.eq('organization_id', requestedOrgId);
            else if (requestedTeamId) q = q.eq('team_id', requestedTeamId);
            else q = q.eq('created_by', authenticatedUserId);

            const { data, error } = await q;
            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { data: data || [] } };
          }
          if (req.method === 'POST') {
            const { title, summary, outcome, cluster_category, tags, project_id, team_id, organization_id } = req.body || {};
            const { data, error } = await adminClient
              .from('lessons_learned')
              .insert({
                title,
                summary,
                outcome,
                cluster_category: cluster_category || 'operational_excellence',
                tags: tags || [],
                project_id: project_id || null,
                team_id: requestedTeamId || team_id || null,
                organization_id: requestedOrgId || organization_id || null,
                created_by: authenticatedUserId,
              })
              .select()
              .single();

            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 201, headers: jsonHeaders, body: { data } };
          }
          if (req.method === 'DELETE') {
            const parts = pathname.split('/').filter(Boolean);
            const id = parts[parts.length - 1];
            const { error } = await adminClient.rpc('soft_delete_lesson_learned', {
              p_lesson_id: id,
              p_user_id: authenticatedUserId,
            });
            if (error) return { status: 500, headers: jsonHeaders, body: { error: error.message } };
            return { status: 200, headers: jsonHeaders, body: { success: true } };
          }
        }

        // Tasklet 22: Copilot Handlers
        if (pathname === '/api/copilot/chat' || pathname === '/api/copilot/query') {
          const { query, message, conversationId, assistantType, sessionId } = req.body || {};
          const promptText = (query || message || '').trim();
          if (!promptText) {
            return { status: 400, headers: jsonHeaders, body: { error: 'query_required', message: 'Query or message string is required.' } };
          }

          const copilotEngine = new CopilotEngine(adminClient);

          // 1. Audit question asked
          await recordAuditLog({
            action: 'question_asked',
            entityType: 'copilot_query',
            details: { query: promptText, assistantType },
            userId: authenticatedUserId,
            admin: true,
          });

          // 2. Resolve or create conversation
          let conv: any = null;
          if (conversationId) {
            conv = await fetchConversationById(adminClient, conversationId);
            if (conv && conv.user_id !== authenticatedUserId) {
              let hasAccess = false;
              if (conv.organization_id) {
                const { data: mem } = await adminClient
                  .from('organization_members')
                  .select('id')
                  .eq('organization_id', conv.organization_id)
                  .eq('user_id', authenticatedUserId)
                  .maybeSingle();
                if (mem) hasAccess = true;
              }
              if (!hasAccess && conv.team_id) {
                const { data: tMem } = await adminClient
                  .from('team_members')
                  .select('id')
                  .eq('team_id', conv.team_id)
                  .eq('user_id', authenticatedUserId)
                  .maybeSingle();
                if (tMem) hasAccess = true;
              }
              if (!hasAccess) {
                return { status: 403, headers: jsonHeaders, body: { error: 'forbidden', message: 'You do not have access to this conversation.' } };
              }
            }
          }
          if (!conv) {
            const autoTitle = promptText.length > 40 ? `${promptText.slice(0, 37)}...` : promptText;
            conv = await createConversation(adminClient, {
              userId: authenticatedUserId,
              organizationId: requestedOrgId || null,
              teamId: requestedTeamId || null,
              title: autoTitle,
              sessionId: sessionId || null,
            });
          }

          // 3. Fetch past messages for continuity
          const history = await fetchMessages(adminClient, conv.id);

          // 4. Record user message
          const userMessage = await createMessage(adminClient, {
            conversationId: conv.id,
            role: 'user',
            message: promptText,
          });

          // 5. Run Copilot Engine
          const response = await copilotEngine.processQuery(promptText, {
            userId: authenticatedUserId,
            organizationId: requestedOrgId || null,
            teamId: requestedTeamId || null,
            assistantType,
            history,
            sessionId,
          });

          // 6. Record assistant message
          const assistantMessage = await createMessage(adminClient, {
            conversationId: conv.id,
            role: 'assistant',
            message: response.answer,
            response,
          });

          // 7. Audit answer generated
          await recordAuditLog({
            action: 'answer_generated',
            entityType: 'copilot_response',
            entityId: assistantMessage.id,
            details: {
              intent: response.intent,
              confidence: response.confidence,
              confidenceScore: response.confidenceScore,
            },
            userId: authenticatedUserId,
            admin: true,
          });

          // 8. Audit knowledge search if applicable
          if (response.knowledgeGraphConnections.length > 0 || response.intent === 'knowledge_discovery') {
            await recordAuditLog({
              action: 'knowledge_search',
              entityType: 'copilot_knowledge',
              details: { query: promptText, intent: response.intent },
              userId: authenticatedUserId,
              admin: true,
            });
          }

          // 9. Audit execution request if draft exists
          if (response.executionDraft) {
            await recordAuditLog({
              action: 'execution_request',
              entityType: 'copilot_execution_draft',
              details: {
                draftAction: response.executionDraft.actionType,
                title: response.executionDraft.title,
              },
              userId: authenticatedUserId,
              admin: true,
            });
          }

          return {
            status: 200,
            headers: jsonHeaders,
            body: {
              data: {
                conversation: conv,
                userMessage,
                assistantMessage,
                response,
              },
            },
          };
        }

        if (pathname === '/api/copilot/conversations' || pathname.startsWith('/api/copilot/conversations/')) {
          const parts = pathname.split('/').filter(Boolean);
          if (parts.length >= 4 && parts[3] === 'messages') {
            const convId = parts[2];
            const conv = await fetchConversationById(adminClient, convId);
            if (!conv) {
              return { status: 404, headers: jsonHeaders, body: { error: 'not_found', message: 'Conversation not found.' } };
            }
            if (conv.user_id !== authenticatedUserId) {
              let hasAccess = false;
              if (conv.organization_id) {
                const { data: mem } = await adminClient
                  .from('organization_members')
                  .select('id')
                  .eq('organization_id', conv.organization_id)
                  .eq('user_id', authenticatedUserId)
                  .maybeSingle();
                if (mem) hasAccess = true;
              }
              if (!hasAccess && conv.team_id) {
                const { data: tMem } = await adminClient
                  .from('team_members')
                  .select('id')
                  .eq('team_id', conv.team_id)
                  .eq('user_id', authenticatedUserId)
                  .maybeSingle();
                if (tMem) hasAccess = true;
              }
              if (!hasAccess) {
                return { status: 403, headers: jsonHeaders, body: { error: 'forbidden', message: 'You do not have access to this conversation.' } };
              }
            }

            if (req.method === 'GET') {
              const messages = await fetchMessages(adminClient, convId);
              return { status: 200, headers: jsonHeaders, body: { data: messages } };
            }
            if (req.method === 'POST') {
              const { role, message, response } = req.body || {};
              const msg = await createMessage(adminClient, {
                conversationId: convId,
                role: role || 'user',
                message: message || '',
                response: response || {},
              });
              return { status: 201, headers: jsonHeaders, body: { data: msg } };
            }
          }

          if (req.method === 'GET') {
            const search = (req.body?.search as string) || undefined;
            const isArchived = req.body?.isArchived !== undefined ? Boolean(req.body.isArchived) : undefined;
            const convs = await fetchConversations(adminClient, {
              userId: authenticatedUserId,
              organizationId: requestedOrgId || null,
              teamId: requestedTeamId || null,
              search,
              isArchived,
            });
            return { status: 200, headers: jsonHeaders, body: { data: convs } };
          }
          if (req.method === 'POST') {
            const { title, sessionId, metadata } = req.body || {};
            const conv = await createConversation(adminClient, {
              userId: authenticatedUserId,
              organizationId: requestedOrgId || null,
              teamId: requestedTeamId || null,
              title: title || 'New Conversation',
              sessionId: sessionId || null,
              metadata: metadata || {},
            });
            return { status: 201, headers: jsonHeaders, body: { data: conv } };
          }
          if (req.method === 'DELETE') {
            const convId = parts[parts.length - 1];
            const conv = await fetchConversationById(adminClient, convId);
            if (!conv) {
              return { status: 404, headers: jsonHeaders, body: { error: 'not_found', message: 'Conversation not found.' } };
            }
            if (conv.user_id !== authenticatedUserId) {
              let isOrgAdmin = false;
              if (conv.organization_id) {
                const { data: mem } = await adminClient
                  .from('organization_members')
                  .select('role')
                  .eq('organization_id', conv.organization_id)
                  .eq('user_id', authenticatedUserId)
                  .maybeSingle();
                if (mem && (mem.role === 'owner' || mem.role === 'admin')) isOrgAdmin = true;
              }
              if (!isOrgAdmin) {
                return { status: 403, headers: jsonHeaders, body: { error: 'forbidden', message: 'You do not have permission to delete this conversation.' } };
              }
            }
            await softDeleteConversation(adminClient, convId, authenticatedUserId);
            return { status: 200, headers: jsonHeaders, body: { success: true } };
          }
        }

        if (pathname === '/api/copilot/prompts' || pathname.startsWith('/api/copilot/prompts/')) {
          if (req.method === 'GET') {
            const { category, scope } = req.body || {};
            const prompts = await fetchPrompts(adminClient, {
              userId: authenticatedUserId,
              organizationId: requestedOrgId || null,
              teamId: requestedTeamId || null,
              category,
              scope,
            });
            return { status: 200, headers: jsonHeaders, body: { data: prompts } };
          }
          if (req.method === 'POST') {
            const { title, promptText, prompt_text, category, scope, targetRole, target_role } = req.body || {};
            const prompt = await createPrompt(adminClient, {
              userId: authenticatedUserId,
              organizationId: requestedOrgId || null,
              teamId: requestedTeamId || null,
              title: title || 'Saved Prompt',
              promptText: promptText || prompt_text || '',
              category: category || 'general',
              scope: scope || 'personal',
              targetRole: targetRole || target_role || null,
            });
            return { status: 201, headers: jsonHeaders, body: { data: prompt } };
          }
          if (req.method === 'DELETE') {
            const parts = pathname.split('/').filter(Boolean);
            const promptId = parts[parts.length - 1];
            const { data: pRec } = await adminClient
              .from('copilot_prompts')
              .select('*')
              .eq('id', promptId)
              .is('deleted_at', null)
              .maybeSingle();
            if (!pRec) {
              return { status: 404, headers: jsonHeaders, body: { error: 'not_found', message: 'Prompt not found.' } };
            }
            if (pRec.user_id !== authenticatedUserId) {
              let isOrgAdmin = false;
              if (pRec.organization_id) {
                const { data: mem } = await adminClient
                  .from('organization_members')
                  .select('role')
                  .eq('organization_id', pRec.organization_id)
                  .eq('user_id', authenticatedUserId)
                  .maybeSingle();
                if (mem && (mem.role === 'owner' || mem.role === 'admin')) isOrgAdmin = true;
              }
              if (!isOrgAdmin) {
                return { status: 403, headers: jsonHeaders, body: { error: 'forbidden', message: 'You do not have permission to delete this prompt.' } };
              }
            }
            await softDeletePrompt(adminClient, promptId, authenticatedUserId);
            return { status: 200, headers: jsonHeaders, body: { success: true } };
          }
        }

        if (
          pathname === '/api/copilot/decision-assistant' ||
          pathname === '/api/copilot/action-assistant' ||
          pathname === '/api/copilot/risk-assistant' ||
          pathname === '/api/copilot/executive-assistant' ||
          pathname === '/api/copilot/knowledge-assistant'
        ) {
          const { query, message, history } = req.body || {};
          const promptText = (query || message || '').trim();
          if (!promptText) {
            return { status: 400, headers: jsonHeaders, body: { error: 'query_required', message: 'Query is required.' } };
          }

          let assistantType: AssistantType = 'copilot';
          if (pathname.includes('decision')) assistantType = 'decision_assistant';
          else if (pathname.includes('action')) assistantType = 'action_assistant';
          else if (pathname.includes('risk')) assistantType = 'risk_assistant';
          else if (pathname.includes('executive')) assistantType = 'executive_assistant';
          else if (pathname.includes('knowledge')) assistantType = 'knowledge_assistant';

          const copilotEngine = new CopilotEngine(adminClient);
          const response = await copilotEngine.processQuery(promptText, {
            userId: authenticatedUserId,
            organizationId: requestedOrgId || null,
            teamId: requestedTeamId || null,
            assistantType,
            history: history || [],
          });

          await recordAuditLog({
            action: 'question_asked',
            entityType: 'copilot_assistant_query',
            details: { query: promptText, assistantType },
            userId: authenticatedUserId,
            admin: true,
          });

          await recordAuditLog({
            action: 'answer_generated',
            entityType: 'copilot_assistant_response',
            details: { assistantType, intent: response.intent, confidence: response.confidence },
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 200, headers: jsonHeaders, body: { data: response } };
        }

        if (pathname === '/api/copilot/briefing') {
          const { topic, title, report_type } = req.body || {};
          const briefingTitle = title || `Executive Briefing: ${topic || 'Strategic Operations'}`;
          const briefingType = report_type || 'executive_summary';

          const copilotEngine = new CopilotEngine(adminClient);
          const response = await copilotEngine.processQuery(
            `Prepare an executive briefing on ${topic || 'organizational health and strategic priorities'}`,
            {
              userId: authenticatedUserId,
              organizationId: requestedOrgId || null,
              teamId: requestedTeamId || null,
              assistantType: 'executive_assistant',
            }
          );

          const { data: briefing, error: briefErr } = await adminClient
            .from('executive_briefings')
            .insert({
              organization_id: requestedOrgId || null,
              generated_by: authenticatedUserId,
              title: briefingTitle,
              report_type: briefingType,
              content: {
                summary: response.answer,
                evidence: response.supportingEvidence,
                confidence: response.confidence,
                sources: response.sourceRecords,
              },
            })
            .select()
            .single();

          if (briefErr) {
            return { status: 500, headers: jsonHeaders, body: { error: briefErr.message } };
          }

          await recordAuditLog({
            action: 'report_generated',
            entityType: 'executive_briefing',
            entityId: briefing.id,
            details: { title: briefingTitle, report_type: briefingType },
            userId: authenticatedUserId,
            admin: true,
          });

          return { status: 201, headers: jsonHeaders, body: { data: briefing } };
        }

        if (pathname === '/api/copilot/execute-request') {
          const { actionType, title, payload } = req.body || {};

          await recordAuditLog({
            action: 'execution_request',
            entityType: 'copilot_action_dispatch',
            details: { actionType, title },
            userId: authenticatedUserId,
            admin: true,
          });

          return {
            status: 200,
            headers: jsonHeaders,
            body: {
              data: {
                status: 'pending_approval',
                requiresApproval: true,
                message: 'Action staged under human approval controls in Approval Center (/approvals). Autonomous unreviewed execution is blocked.',
                actionType,
                title,
                payload,
              },
            },
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
