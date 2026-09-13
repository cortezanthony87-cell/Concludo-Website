import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
import {
  createOrganization,
  fetchUserOrganizations,
  fetchOrganizationMembers,
  updateOrganizationMemberRole,
  addOrganizationMember,
  removeOrganizationMember,
  setUserSuspension,
  fetchOrganizationDomains,
  addOrganizationDomain,
  verifyOrganizationDomain,
  fetchSSOConfig,
  saveSSOConfig,
  lookupSSOByEmail,
  fetchRetentionPolicies,
  saveRetentionPolicy,
  fetchLegalHolds,
  createLegalHold,
  releaseLegalHold,
  fetchAccessReviews,
  recordAccessReview,
  fetchOrganizationAnalytics,
  fetchAuditLogs,
  logAuditEvent,
} from '../src/lib/enterprise/enterpriseClient';
import { canUseFeature, hasFeature } from '../src/lib/permissions/canUseFeature';
import { handleApiRequest } from '../src/server/apiRouter';

// Parse environment variables from .env.local
const envPath = existsSync('/tmp/concludo-workspace/.env.local')
  ? '/tmp/concludo-workspace/.env.local'
  : '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/concludo-workspace/.env.local';

const envFile = readFileSync(envPath, 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
    })
);

const supabaseUrl = envVars.SUPABASE_URL || envVars.VITE_SUPABASE_URL;
const supabaseAnonKey = envVars.SUPABASE_ANON_KEY || envVars.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runTasklet17Tests() {
  console.log('================================================================');
  console.log('TASKLET 17: ENTERPRISE SSO, GOVERNANCE, COMPLIANCE & CONTROLS');
  console.log('================================================================\n');

  const timestamp = Date.now();
  const testPassword = 'Password123!Secure';

  // Test User Accounts
  // 1. Team User (Should be denied enterprise features)
  const teamEmail = `tasklet17_team_${timestamp}@concludo.au`;
  // 2. Enterprise Admin User (Full enterprise capabilities)
  const enterpriseEmail = `tasklet17_enterprise_${timestamp}@concludo.au`;
  // 3. Colleague User (Invited member to test roles & suspension)
  const colleagueEmail = `tasklet17_colleague_${timestamp}@concludo.au`;
  // 4. Isolated Third-Party User (Different organization)
  const isolatedEmail = `tasklet17_isolated_${timestamp}@concludo.au`;

  let teamUserId = '';
  let enterpriseUserId = '';
  let colleagueUserId = '';
  let isolatedUserId = '';

  let teamClient: any;
  let enterpriseClientInstance: any;
  let colleagueClient: any;
  let isolatedClient: any;

  let enterpriseToken = '';
  let teamToken = '';
  let colleagueToken = '';

  let orgId = '';
  let isolatedOrgId = '';
  let domainId = '';
  let holdId = '';

  try {
    // -------------------------------------------------------------
    // SETUP: Provision isolated test users
    // -------------------------------------------------------------
    console.log('--- STEP 1: Provisioning Test Users ---');

    // Create Team User
    const { data: uTeam, error: eTeam } = await adminClient.auth.admin.createUser({
      email: teamEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Team User Alpha' },
    });
    if (eTeam) throw eTeam;
    teamUserId = uTeam.user.id;
    await adminClient.from('profiles').update({ plan: 'team', role: 'member' }).eq('id', teamUserId);

    // Create Enterprise User
    const { data: uEnt, error: eEnt } = await adminClient.auth.admin.createUser({
      email: enterpriseEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Enterprise Admin Beta' },
    });
    if (eEnt) throw eEnt;
    enterpriseUserId = uEnt.user.id;
    await adminClient.from('profiles').update({ plan: 'enterprise', role: 'admin' }).eq('id', enterpriseUserId);

    // Create Colleague User
    const { data: uColl, error: eColl } = await adminClient.auth.admin.createUser({
      email: colleagueEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Colleague User Delta' },
    });
    if (eColl) throw eColl;
    colleagueUserId = uColl.user.id;
    await adminClient.from('profiles').update({ plan: 'enterprise', role: 'member' }).eq('id', colleagueUserId);

    // Create Isolated User (Separate Org)
    const { data: uIso, error: eIso } = await adminClient.auth.admin.createUser({
      email: isolatedEmail,
      password: testPassword,
      email_confirm: true,
      user_metadata: { full_name: 'Isolated User Charlie' },
    });
    if (eIso) throw eIso;
    isolatedUserId = uIso.user.id;
    await adminClient.from('profiles').update({ plan: 'enterprise', role: 'admin' }).eq('id', isolatedUserId);

    // Initialize authenticated user clients
    teamClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: loginTeam } = await teamClient.auth.signInWithPassword({ email: teamEmail, password: testPassword });
    teamToken = loginTeam.session?.access_token || '';

    enterpriseClientInstance = createClient(supabaseUrl, supabaseAnonKey);
    const { data: loginEnt } = await enterpriseClientInstance.auth.signInWithPassword({
      email: enterpriseEmail,
      password: testPassword,
    });
    enterpriseToken = loginEnt.session?.access_token || '';

    colleagueClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data: loginColl } = await colleagueClient.auth.signInWithPassword({
      email: colleagueEmail,
      password: testPassword,
    });
    colleagueToken = loginColl.session?.access_token || '';

    isolatedClient = createClient(supabaseUrl, supabaseAnonKey);
    await isolatedClient.auth.signInWithPassword({ email: isolatedEmail, password: testPassword });

    console.log('✅ Provisioned test users: Team Alpha, Enterprise Beta, Colleague Delta, Isolated Charlie.\n');

    // -------------------------------------------------------------
    // TEST 2: Authoritative Feature Gating & Backend Permission Matrix
    // -------------------------------------------------------------
    console.log('--- STEP 2: Verifying Enterprise Feature Gating ---');

    // Team user should be denied enterprise features
    const teamCheckSSO = await canUseFeature(teamUserId, 'enterprise_sso', { supabase: adminClient });
    const teamCheckAudit = await canUseFeature(teamUserId, 'audit_logging', { supabase: adminClient });
    const teamCheckCompliance = await canUseFeature(teamUserId, 'compliance_controls', { supabase: adminClient });
    const teamCheckAdmin = await canUseFeature(teamUserId, 'organization_admin', { supabase: adminClient });

    if (teamCheckSSO.allowed || teamCheckAudit.allowed || teamCheckCompliance.allowed || teamCheckAdmin.allowed) {
      throw new Error('FAILED: Team plan user was granted enterprise features!');
    }
    console.log('✅ Team user is strictly DENIED all enterprise features (enterprise_sso, audit_logging, compliance_controls, organization_admin).');

    // Enterprise user should be granted enterprise features
    const entCheckSSO = await canUseFeature(enterpriseUserId, 'enterprise_sso', { supabase: adminClient });
    const entCheckAudit = await canUseFeature(enterpriseUserId, 'audit_logging', { supabase: adminClient });
    const entCheckCompliance = await canUseFeature(enterpriseUserId, 'compliance_controls', { supabase: adminClient });
    const entCheckAdmin = await canUseFeature(enterpriseUserId, 'organization_admin', { supabase: adminClient });

    if (!entCheckSSO.allowed || !entCheckAudit.allowed || !entCheckCompliance.allowed || !entCheckAdmin.allowed) {
      throw new Error('FAILED: Enterprise plan user was denied enterprise features!');
    }
    console.log('✅ Enterprise user is strictly GRANTED enterprise features.');

    // Server-side API Router enforcement
    const apiResDenied = await handleApiRequest(
      {
        method: 'GET',
        url: 'http://localhost/api/admin',
        headers: { authorization: `Bearer ${teamToken}` },
      },
      { adminClient }
    );
    if (apiResDenied.status !== 403) {
      throw new Error(`FAILED: API router returned ${apiResDenied.status} instead of 403 Forbidden for Team user.`);
    }
    console.log('✅ Server API Router returned HTTP 403 Forbidden for Team user accessing /api/admin.');

    const apiResAllowed = await handleApiRequest(
      {
        method: 'GET',
        url: 'http://localhost/api/admin',
        headers: { authorization: `Bearer ${enterpriseToken}` },
      },
      { adminClient }
    );
    if (apiResAllowed.status !== 200) {
      throw new Error(`FAILED: API router returned ${apiResAllowed.status} for Enterprise user.`);
    }
    console.log('✅ Server API Router returned HTTP 200 OK for Enterprise user accessing /api/admin.');

    // Route matching order test (/api/admin/audit vs /api/admin)
    const auditRouteRes = await handleApiRequest(
      {
        method: 'GET',
        url: 'http://localhost/api/admin/audit',
        headers: { authorization: `Bearer ${enterpriseToken}` },
      },
      { adminClient }
    );
    if (auditRouteRes.status !== 200 || auditRouteRes.body?.feature !== 'audit_logging') {
      throw new Error(`FAILED: /api/admin/audit matched wrong feature: ${auditRouteRes.body?.feature}`);
    }
    console.log('✅ Server API Router correctly prioritized longest route /api/admin/audit -> audit_logging.\n');

    // -------------------------------------------------------------
    // TEST 3: Organization Creation & Member Management
    // -------------------------------------------------------------
    console.log('--- STEP 3: Organization Creation & Member Roles ---');

    const orgName = `Acme Enterprise Australia ${timestamp}`;
    const { data: newOrg, error: orgCreateErr } = await createOrganization(enterpriseClientInstance, orgName);
    if (orgCreateErr || !newOrg) {
      throw new Error(`FAILED to create organization: ${orgCreateErr?.message}`);
    }
    orgId = newOrg.id;
    console.log(`✅ Created organization "${orgName}" (ID: ${orgId}).`);

    // Verify creator is automatically added as organization_owner in organization_members
    const { data: memberList, error: memErr } = await fetchOrganizationMembers(enterpriseClientInstance, orgId);
    if (memErr) throw memErr;
    const ownerMember = memberList.find((m) => m.user_id === enterpriseUserId);
    if (!ownerMember || ownerMember.role !== 'organization_owner') {
      throw new Error('FAILED: Creator is not organization_owner in organization_members!');
    }
    console.log('✅ Creator successfully registered as organization_owner.');

    // Add colleague user as security_admin
    const { success: addSuccess, error: addErr } = await addOrganizationMember(
      enterpriseClientInstance,
      orgId,
      colleagueEmail,
      'security_admin',
      colleagueUserId
    );
    if (!addSuccess || addErr) {
      throw new Error(`FAILED to add member: ${addErr?.message}`);
    }
    console.log('✅ Invited/added Colleague Delta as security_admin.');

    // Update role to compliance_admin
    const { success: roleSuccess, error: roleErr } = await updateOrganizationMemberRole(
      enterpriseClientInstance,
      orgId,
      colleagueUserId,
      'compliance_admin'
    );
    if (!roleSuccess || roleErr) {
      throw new Error(`FAILED to update role: ${roleErr?.message}`);
    }
    console.log('✅ Updated Colleague Delta role to compliance_admin.\n');

    // -------------------------------------------------------------
    // TEST 4: User Suspension Enforcement
    // -------------------------------------------------------------
    console.log('--- STEP 4: Enterprise User Suspension Enforcement ---');

    // Suspend colleague user
    const { success: suspSuccess, error: suspErr } = await setUserSuspension(
      enterpriseClientInstance,
      orgId,
      colleagueUserId,
      true
    );
    if (!suspSuccess || suspErr) {
      throw new Error(`FAILED to suspend user: ${suspErr?.message}`);
    }

    // Verify server API router rejects suspended user with HTTP 403 user_suspended
    const suspendedApiRes = await handleApiRequest(
      {
        method: 'GET',
        url: 'http://localhost/api/projects',
        headers: { authorization: `Bearer ${colleagueToken}` },
      },
      { adminClient }
    );
    if (suspendedApiRes.status !== 403 || suspendedApiRes.body?.error !== 'user_suspended') {
      throw new Error(`FAILED: Suspended user was not blocked with user_suspended! Got: ${JSON.stringify(suspendedApiRes)}`);
    }
    console.log('✅ Suspended user was strictly blocked by Server API Router (HTTP 403 user_suspended).');

    // Reactivate user
    const { success: reactSuccess, error: reactErr } = await setUserSuspension(
      enterpriseClientInstance,
      orgId,
      colleagueUserId,
      false
    );
    if (!reactSuccess || reactErr) {
      throw new Error(`FAILED to reactivate user: ${reactErr?.message}`);
    }
    console.log('✅ Reactivated user successfully.\n');

    // -------------------------------------------------------------
    // TEST 5: SSO & Domain Verification Flow
    // -------------------------------------------------------------
    console.log('--- STEP 5: Domain Verification & SSO Configuration ---');

    const testDomain = `acme-${timestamp}.com.au`;
    const { data: domData, error: domErr } = await addOrganizationDomain(enterpriseClientInstance, orgId, testDomain);
    if (domErr || !domData) {
      throw new Error(`FAILED to add domain: ${domErr?.message}`);
    }
    domainId = domData.id;
    if (domData.verified !== false || !domData.verification_token) {
      throw new Error('FAILED: Newly added domain should be unverified with a verification token!');
    }
    console.log(`✅ Registered domain ${testDomain} with verification token.`);

    // Verify domain
    const { success: vSuccess, error: vErr } = await verifyOrganizationDomain(enterpriseClientInstance, domainId);
    if (!vSuccess || vErr) {
      throw new Error(`FAILED to verify domain: ${vErr?.message}`);
    }
    console.log('✅ Verified enterprise domain successfully.');

    // Save SSO configuration
    const ssoPayload = {
      provider_name: 'Microsoft Entra ID' as any,
      protocol: 'saml' as const,
      login_url: 'https://login.microsoftonline.com/acme/saml2',
      issuer: 'https://sts.windows.net/acme-tenant-id/',
      certificate: 'MIIDBTCCAe2gAwIBAgIQ...',
      domain_mapping: testDomain,
      sso_enabled: true,
    };

    const { data: savedSSO, error: ssoErr } = await saveSSOConfig(enterpriseClientInstance, orgId, ssoPayload);
    if (ssoErr || !savedSSO) {
      throw new Error(`FAILED to save SSO configuration: ${ssoErr?.message}`);
    }
    console.log('✅ Saved SAML 2.0 SSO configuration for Microsoft Entra ID.');

    // Test SSO lookup by user email domain
    const lookupRes = await lookupSSOByEmail(enterpriseClientInstance, `employee@${testDomain}`);
    if (!lookupRes.ssoEnabled || lookupRes.ssoConfig?.provider_name !== 'Microsoft Entra ID') {
      throw new Error(`FAILED: lookupSSOByEmail failed to detect active SSO for ${testDomain}`);
    }
    console.log(`✅ lookupSSOByEmail successfully resolved SSO configuration for employee@${testDomain}.\n`);

    // -------------------------------------------------------------
    // TEST 6: Immutable Audit Logging & Filtering
    // -------------------------------------------------------------
    console.log('--- STEP 6: Immutable Audit Logging & Query Filters ---');

    // Log various audited events
    await logAuditEvent(enterpriseClientInstance, {
      organizationId: orgId,
      action: 'user_login',
      entityType: 'authentication',
      details: { method: 'password', browser: 'Chrome', ip: '203.0.113.1' },
    });

    await logAuditEvent(enterpriseClientInstance, {
      organizationId: orgId,
      action: 'sso_login',
      entityType: 'authentication',
      details: { provider: 'Microsoft Entra ID', domain: testDomain },
    });

    await logAuditEvent(enterpriseClientInstance, {
      organizationId: orgId,
      action: 'project_created',
      entityType: 'project',
      entityId: 'proj-123',
      details: { title: 'Q3 Enterprise Strategy Review' },
    });

    // Fetch audit logs
    const { data: logs, error: logFetchErr } = await fetchAuditLogs(enterpriseClientInstance, {
      organizationId: orgId,
    });
    if (logFetchErr || !logs || logs.length === 0) {
      throw new Error(`FAILED to fetch audit logs: ${logFetchErr?.message}`);
    }

    const actionsCaptured = logs.map((l) => l.action);
    console.log(`✅ Audit trail captured ${logs.length} events (including: ${actionsCaptured.slice(0, 5).join(', ')}).`);

    // Verify filter by action
    const { data: ssoLogs } = await fetchAuditLogs(enterpriseClientInstance, {
      organizationId: orgId,
      action: 'sso_login',
    });
    if (!ssoLogs || ssoLogs.length === 0 || ssoLogs.some((l) => l.action !== 'sso_login')) {
      throw new Error('FAILED: Action filter in audit logs returned incorrect records!');
    }
    console.log('✅ Audit log filtering by action verified.\n');

    // -------------------------------------------------------------
    // TEST 7: Configurable Retention Policies
    // -------------------------------------------------------------
    console.log('--- STEP 7: Configurable Organizational Retention Policies ---');

    // Save retention policies: project (90 days), decision (180 days), action (indefinite: -1)
    await saveRetentionPolicy(enterpriseClientInstance, orgId, 'project', 90);
    await saveRetentionPolicy(enterpriseClientInstance, orgId, 'decision', 180);
    await saveRetentionPolicy(enterpriseClientInstance, orgId, 'action', -1);

    const { data: currentPolicies, error: polErr } = await fetchRetentionPolicies(enterpriseClientInstance, orgId);
    if (polErr) throw polErr;

    const projPolicy = currentPolicies.find((p) => p.entity_type === 'project');
    const decPolicy = currentPolicies.find((p) => p.entity_type === 'decision');
    const actPolicy = currentPolicies.find((p) => p.entity_type === 'action');

    if (projPolicy?.retention_days !== 90 || decPolicy?.retention_days !== 180 || actPolicy?.retention_days !== -1) {
      throw new Error('FAILED: Configurable retention policies did not save expected values!');
    }
    console.log('✅ Organizational retention policies configured: Project=90d, Decision=180d, Action=Indefinite(-1).\n');

    // -------------------------------------------------------------
    // TEST 8: Legal Holds & Purge / Permanent Delete Protection
    // -------------------------------------------------------------
    console.log('--- STEP 8: Legal Holds & Purge Protection ---');

    // Activate Legal Hold
    const { data: hold, error: holdErr } = await createLegalHold(
      enterpriseClientInstance,
      orgId,
      `Matter-${timestamp}-ASIC-Review`,
      'Regulatory compliance hold protecting all corporate records.'
    );
    if (holdErr || !hold) {
      throw new Error(`FAILED to create legal hold: ${holdErr?.message}`);
    }
    holdId = hold.id;
    console.log(`✅ Legal hold activated: "${hold.name}" (Status: active).`);

    // Create a project under the enterprise user, soft delete it, and test legal hold protection
    const { data: testProj } = await enterpriseClientInstance
      .from('projects')
      .insert({
        user_id: enterpriseUserId,
        title: `Legal Hold Protected Project ${timestamp}`,
        transcript: 'Confidential corporate discussion notes.',
        deleted_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days ago
        purge_after: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // expired 30 days ago
      })
      .select()
      .single();

    if (!testProj) throw new Error('FAILED to insert soft-deleted test project.');

    // 1. Permanent Delete MUST BE BLOCKED by database RPC
    const permDeleteRes = await enterpriseClientInstance.rpc('permanent_delete_project', {
      p_project_id: testProj.id,
    });
    if (permDeleteRes.data?.success !== false || !permDeleteRes.data?.error?.includes('Legal Hold')) {
      throw new Error(`FAILED: permanent_delete_project succeeded despite active Legal Hold! Result: ${JSON.stringify(permDeleteRes)}`);
    }
    console.log('✅ Database RPC permanent_delete_project strictly BLOCKED permanent deletion due to active Legal Hold.');

    // 2. Automated Retention Purge MUST NOT purge the protected record
    const purgeResult = await adminClient.rpc('purge_expired_records');
    const { data: projStillExists } = await adminClient
      .from('projects')
      .select('id')
      .eq('id', testProj.id)
      .maybeSingle();

    if (!projStillExists) {
      throw new Error('FAILED: purge_expired_records purged a project that was subject to active Legal Hold!');
    }
    console.log('✅ System automated purge purge_expired_records skipped project subject to active Legal Hold.');

    // 3. Release Legal Hold
    const { success: relSuccess } = await releaseLegalHold(enterpriseClientInstance, orgId, holdId);
    if (!relSuccess) throw new Error('FAILED to release legal hold.');
    console.log('✅ Legal hold released successfully.\n');

    // -------------------------------------------------------------
    // TEST 9: Data Governance & Access Reviews
    // -------------------------------------------------------------
    console.log('--- STEP 9: Data Governance & Access Certification ---');

    // Record Access Review
    const { success: reviewSuccess, error: reviewErr } = await recordAccessReview(
      enterpriseClientInstance,
      orgId,
      colleagueUserId,
      'approved',
      'Quarterly security access certification complete.'
    );
    if (!reviewSuccess || reviewErr) {
      throw new Error(`FAILED to record access review: ${reviewErr?.message}`);
    }

    const { data: reviewList, error: revListErr } = await fetchAccessReviews(enterpriseClientInstance, orgId);
    if (revListErr || !reviewList || reviewList.length === 0) {
      throw new Error('FAILED: Access review was not recorded in access_reviews table!');
    }
    const targetReview = reviewList.find((r) => r.target_user_id === colleagueUserId);
    if (!targetReview || targetReview.status !== 'approved') {
      throw new Error('FAILED: Access review record status is not approved!');
    }
    console.log('✅ Access review recorded, certified, and persisted with audit trail.\n');

    // -------------------------------------------------------------
    // TEST 10: Multi-Tenant RLS Isolation
    // -------------------------------------------------------------
    console.log('--- STEP 10: Cross-Organization RLS Isolation ---');

    // User Charlie (Isolated User) creates a separate organization
    const { data: isoOrg } = await createOrganization(isolatedClient, `Charlie Corp ${timestamp}`);
    isolatedOrgId = isoOrg?.id || '';

    // Isolated user attempts to read Beta's organization domains -> MUST return empty or error
    const { data: leakedDomains } = await isolatedClient
      .from('organization_domains')
      .select('*')
      .eq('organization_id', orgId);
    if (leakedDomains && leakedDomains.length > 0) {
      throw new Error('SECURITY VIOLATION: User Charlie was able to view Beta organization domains via RLS leak!');
    }

    // Isolated user attempts to read Beta's SSO config -> MUST return empty or error
    const { data: leakedSSO } = await isolatedClient
      .from('organization_sso_configs')
      .select('*')
      .eq('organization_id', orgId);
    if (leakedSSO && leakedSSO.length > 0) {
      throw new Error('SECURITY VIOLATION: User Charlie was able to view Beta SSO configuration via RLS leak!');
    }

    // Isolated user attempts to read Beta's Legal Holds -> MUST return empty or error
    const { data: leakedHolds } = await isolatedClient
      .from('legal_holds')
      .select('*')
      .eq('organization_id', orgId);
    if (leakedHolds && leakedHolds.length > 0) {
      throw new Error('SECURITY VIOLATION: User Charlie was able to view Beta Legal Holds via RLS leak!');
    }

    console.log('✅ PostgreSQL RLS strictly isolates domains, SSO configs, and legal holds between organizations.');

    // Organization Analytics Isolation
    const { data: betaAnalytics } = await fetchOrganizationAnalytics(enterpriseClientInstance, orgId);
    const { data: charlieAnalytics } = await fetchOrganizationAnalytics(isolatedClient, isolatedOrgId);

    if (charlieAnalytics?.totalUsers !== 1 || betaAnalytics?.totalUsers < 2) {
      throw new Error('FAILED: Organization analytics did not isolate member counts between organizations!');
    }
    console.log('✅ Organization analytics strictly isolated to tenant boundaries.\n');

    console.log('================================================================');
    console.log('ALL TASKLET 17 VERIFICATION CHECKS PASSED SUCCESSFULLY!');
    console.log('================================================================');
  } finally {
    // Clean up test data
    console.log('\nCleaning up Tasklet 17 test fixtures...');
    try {
      if (orgId) {
        await adminClient.from('organizations').delete().eq('id', orgId);
      }
      if (isolatedOrgId) {
        await adminClient.from('organizations').delete().eq('id', isolatedOrgId);
      }
      if (teamUserId) {
        await adminClient.auth.admin.deleteUser(teamUserId);
      }
      if (enterpriseUserId) {
        await adminClient.auth.admin.deleteUser(enterpriseUserId);
      }
      if (colleagueUserId) {
        await adminClient.auth.admin.deleteUser(colleagueUserId);
      }
      if (isolatedUserId) {
        await adminClient.auth.admin.deleteUser(isolatedUserId);
      }
      console.log('✅ Cleanup completed.');
    } catch (cleanupErr) {
      console.warn('Notice: Test cleanup encountered non-fatal error:', cleanupErr);
    }
  }
}

runTasklet17Tests().catch((err) => {
  console.error('\n❌ TASKLET 17 TEST SUITE FAILED:', err);
  process.exit(1);
});
