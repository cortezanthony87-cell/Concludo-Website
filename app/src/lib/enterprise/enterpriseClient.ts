import { SupabaseClient } from '@supabase/supabase-js';
import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationDomain,
  OrganizationSSOConfig,
  AuditLog,
  AuditActionType,
  RetentionPolicy,
  RetentionEntityType,
  LegalHold,
  AccessReview,
  OrganizationAnalytics,
} from './types';

/**
 * Creates an organization. User becomes the owner and first member.
 */
export async function createOrganization(
  supabase: SupabaseClient,
  name: string
): Promise<{ data: Organization | null; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: new Error('Not authenticated') };
    }

    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({
        name: name.trim(),
        owner_id: user.id,
      })
      .select()
      .single();

    if (orgErr || !org) {
      return { data: null, error: new Error(orgErr?.message || 'Failed to create organization') };
    }

    // Insert owner into organization_members
    await supabase.from('organization_members').insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'organization_owner',
    });

    // Log audit event
    await logAuditEvent(supabase, {
      organizationId: org.id,
      action: 'admin_action',
      entityType: 'organization',
      entityId: org.id,
      details: { action: 'organization_created', name: org.name },
    });

    return { data: org, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Fetches organizations the user belongs to.
 */
export async function fetchUserOrganizations(
  supabase: SupabaseClient
): Promise<{ data: (Organization & { currentRole: OrganizationRole })[]; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: [], error: new Error('Not authenticated') };
    }

    // Query memberships
    const { data: memberships, error: memErr } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(*)')
      .eq('user_id', user.id);

    if (memErr) {
      return { data: [], error: new Error(memErr.message) };
    }

    // Query owned organizations
    const { data: ownedOrgs, error: ownErr } = await supabase
      .from('organizations')
      .select('*')
      .eq('owner_id', user.id)
      .is('deleted_at', null);

    if (ownErr) {
      return { data: [], error: new Error(ownErr.message) };
    }

    const orgMap = new Map<string, Organization & { currentRole: OrganizationRole }>();

    (ownedOrgs || []).forEach((o) => {
      orgMap.set(o.id, { ...o, currentRole: 'organization_owner' });
    });

    (memberships || []).forEach((m: any) => {
      if (m.organizations && !m.organizations.deleted_at) {
        orgMap.set(m.organizations.id, {
          ...m.organizations,
          currentRole: (m.role as OrganizationRole) || 'member',
        });
      }
    });

    return { data: Array.from(orgMap.values()), error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Fetches organization by ID.
 */
export async function fetchOrganizationById(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: Organization | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .is('deleted_at', null)
      .maybeSingle();

    if (error) return { data: null, error: new Error(error.message) };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Fetches organization members.
 */
export async function fetchOrganizationMembers(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrganizationMember[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('organization_members')
      .select('id, organization_id, user_id, role, created_at, updated_at')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) return { data: [], error: new Error(error.message) };

    const memberList = data || [];
    if (memberList.length === 0) return { data: [], error: null };

    // Fetch user profiles
    const userIds = memberList.map((m) => m.user_id);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, full_name, is_suspended, plan')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

    const enriched = memberList.map((m) => ({
      ...m,
      profile: profileMap.get(m.user_id),
    }));

    return { data: enriched, error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Updates an organization member's role.
 */
export async function updateOrganizationMemberRole(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  newRole: OrganizationRole
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('organization_members')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    if (error) return { success: false, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'role_changed',
      entityType: 'organization_member',
      entityId: userId,
      details: { newRole },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Removes an organization member.
 */
export async function removeOrganizationMember(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('organization_members')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);

    if (error) return { success: false, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'admin_action',
      entityType: 'organization_member',
      entityId: userId,
      details: { action: 'member_removed' },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Suspends or reactivates a user account.
 */
export async function setUserSuspension(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  suspended: boolean
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('admin_set_user_suspension', {
      p_organization_id: orgId,
      p_target_user_id: userId,
      p_suspended: suspended,
    });

    if (rpcErr) {
      // Fallback to direct update if service role or direct policy permits
      const { error } = await supabase
        .from('profiles')
        .update({
          is_suspended: suspended,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) return { success: false, error: new Error(rpcErr.message || error.message) };
    } else if (rpcData && rpcData.success === false) {
      return { success: false, error: new Error(rpcData.error || 'Failed to update user suspension') };
    }

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: suspended ? 'user_suspended' : 'user_reactivated',
      entityType: 'user',
      entityId: userId,
      details: { suspended },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Audit Logging Helper
 */
export async function logAuditEvent(
  supabase: SupabaseClient,
  event: {
    organizationId?: string | null;
    userId?: string | null;
    action: AuditActionType | string;
    entityType: string;
    entityId?: string | null;
    details?: Record<string, any>;
    ipAddress?: string;
  }
): Promise<{ success: boolean; error: Error | null }> {
  try {
    let uid = event.userId;
    if (!uid) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      uid = user?.id || null;
    }

    let orgId = event.organizationId || null;
    if (!orgId && uid) {
      const { data: memberRec } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', uid)
        .limit(1)
        .maybeSingle();
      if (memberRec?.organization_id) {
        orgId = memberRec.organization_id;
      }
    }

    const { error } = await supabase.from('audit_logs').insert({
      organization_id: orgId,
      user_id: uid,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId || null,
      details: event.details || {},
      ip_address: event.ipAddress || '127.0.0.1',
    });

    if (error) return { success: false, error: new Error(error.message) };
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Fetches Audit Logs with filters.
 */
export async function fetchAuditLogs(
  supabase: SupabaseClient,
  filters?: {
    organizationId?: string;
    userId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }
): Promise<{ data: AuditLog[]; error: Error | null }> {
  try {
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.organizationId) {
      query = query.eq('organization_id', filters.organizationId);
    }
    if (filters?.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters?.action) {
      query = query.eq('action', filters.action);
    }
    if (filters?.entityType) {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters?.startDate) {
      query = query.gte('created_at', filters.startDate);
    }
    if (filters?.endDate) {
      query = query.lte('created_at', filters.endDate);
    }
    if (filters?.limit) {
      query = query.limit(filters.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) return { data: [], error: new Error(error.message) };

    const logs = data || [];
    // Enriched with emails if available
    const userIds = Array.from(new Set(logs.map((l) => l.user_id).filter(Boolean)));
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email')
        .in('id', userIds);
      const emailMap = new Map((profiles || []).map((p) => [p.id, p.email]));
      return {
        data: logs.map((l) => ({ ...l, user_email: emailMap.get(l.user_id) })),
        error: null,
      };
    }

    return { data: logs, error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Domains: Fetch
 */
export async function fetchOrganizationDomains(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrganizationDomain[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('organization_domains')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: true });

    if (error) return { data: [], error: new Error(error.message) };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Domains: Add
 */
export async function addOrganizationDomain(
  supabase: SupabaseClient,
  orgId: string,
  domain: string
): Promise<{ data: OrganizationDomain | null; error: Error | null }> {
  try {
    const cleanDomain = domain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    const { data, error } = await supabase
      .from('organization_domains')
      .insert({
        organization_id: orgId,
        domain: cleanDomain,
        verified: false,
      })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'admin_action',
      entityType: 'domain',
      entityId: cleanDomain,
      details: { action: 'domain_added', domain: cleanDomain },
    });

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Domains: Verify
 */
export async function verifyOrganizationDomain(
  supabase: SupabaseClient,
  domainId: string,
  orgId?: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { data: rpcData, error: rpcErr } = await supabase.rpc('verify_organization_domain', {
      p_domain_id: domainId,
    });

    if (!rpcErr && rpcData) {
      if (rpcData.success) {
        return { success: true, error: null };
      } else {
        return { success: false, error: new Error(rpcData.error || 'Failed to verify domain') };
      }
    }

    const { data, error } = await supabase
      .from('organization_domains')
      .update({
        verified: true,
        verified_at: new Date().toISOString(),
      })
      .eq('id', domainId)
      .select()
      .single();

    if (error) return { success: false, error: new Error(rpcErr?.message || error.message) };

    await logAuditEvent(supabase, {
      organizationId: data.organization_id,
      action: 'admin_action',
      entityType: 'domain',
      entityId: data.domain,
      details: { action: 'domain_verified', domain: data.domain },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * SSO: Fetch configuration
 */
export async function fetchSSOConfig(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrganizationSSOConfig | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('organization_sso_configs')
      .select('*')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (error) return { data: null, error: new Error(error.message) };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * SSO: Save configuration
 */
export async function saveSSOConfig(
  supabase: SupabaseClient,
  orgId: string,
  config: Partial<OrganizationSSOConfig>
): Promise<{ data: OrganizationSSOConfig | null; error: Error | null }> {
  try {
    const payload = {
      organization_id: orgId,
      provider_name: config.provider_name || 'Generic SAML Provider',
      protocol: config.protocol || 'saml',
      login_url: config.login_url || '',
      issuer: config.issuer || null,
      certificate: config.certificate || null,
      client_id: config.client_id || null,
      client_secret: config.client_secret || null,
      domain_mapping: config.domain_mapping || null,
      sso_enabled: config.sso_enabled ?? false,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('organization_sso_configs')
      .upsert(payload, { onConflict: 'organization_id' })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'sso_configured',
      entityType: 'sso_config',
      entityId: orgId,
      details: { provider: config.provider_name, sso_enabled: config.sso_enabled },
    });

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * SSO: Lookup SSO configuration by user email domain
 */
export async function lookupSSOByEmail(
  supabase: SupabaseClient,
  email: string
): Promise<{ ssoEnabled: boolean; ssoConfig?: OrganizationSSOConfig; domain?: string }> {
  try {
    const parts = email.split('@');
    if (parts.length !== 2) return { ssoEnabled: false };
    const domain = parts[1].toLowerCase().trim();

    // Look up verified domain
    const { data: domainRec } = await supabase
      .from('organization_domains')
      .select('organization_id, verified, domain')
      .eq('domain', domain)
      .eq('verified', true)
      .maybeSingle();

    if (!domainRec) return { ssoEnabled: false };

    // Look up active SSO config
    const { data: ssoConfig } = await supabase
      .from('organization_sso_configs')
      .select('*')
      .eq('organization_id', domainRec.organization_id)
      .eq('sso_enabled', true)
      .maybeSingle();

    if (!ssoConfig) return { ssoEnabled: false };

    return { ssoEnabled: true, ssoConfig, domain };
  } catch {
    return { ssoEnabled: false };
  }
}

/**
 * Retention Policies: Fetch
 */
export async function fetchRetentionPolicies(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: RetentionPolicy[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('retention_policies')
      .select('*')
      .eq('organization_id', orgId);

    if (error) return { data: [], error: new Error(error.message) };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Retention Policies: Save
 */
export async function saveRetentionPolicy(
  supabase: SupabaseClient,
  orgId: string,
  entityType: RetentionEntityType,
  retentionDays: number
): Promise<{ data: RetentionPolicy | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('retention_policies')
      .upsert(
        {
          organization_id: orgId,
          entity_type: entityType,
          retention_days: retentionDays,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'organization_id,entity_type' }
      )
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'retention_changed',
      entityType: 'retention_policy',
      entityId: entityType,
      details: { entityType, retentionDays },
    });

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Legal Holds: Fetch
 */
export async function fetchLegalHolds(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: LegalHold[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('legal_holds')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: new Error(error.message) };
    return { data: data || [], error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Legal Holds: Create
 */
export async function createLegalHold(
  supabase: SupabaseClient,
  orgId: string,
  name: string,
  description?: string
): Promise<{ data: LegalHold | null; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('legal_holds')
      .insert({
        organization_id: orgId,
        name: name.trim(),
        description: description?.trim() || null,
        status: 'active',
      })
      .select()
      .single();

    if (error) return { data: null, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'legal_hold_created',
      entityType: 'legal_hold',
      entityId: data.id,
      details: { name: data.name },
    });

    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err };
  }
}

/**
 * Legal Holds: Release
 */
export async function releaseLegalHold(
  supabase: SupabaseClient,
  orgId: string,
  holdId: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const { error } = await supabase
      .from('legal_holds')
      .update({
        status: 'released',
        updated_at: new Date().toISOString(),
      })
      .eq('id', holdId)
      .eq('organization_id', orgId);

    if (error) return { success: false, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'legal_hold_released',
      entityType: 'legal_hold',
      entityId: holdId,
      details: { status: 'released' },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Access Reviews: Fetch
 */
export async function fetchAccessReviews(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: AccessReview[]; error: Error | null }> {
  try {
    const { data, error } = await supabase
      .from('access_reviews')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) return { data: [], error: new Error(error.message) };

    const reviews = data || [];
    const targetIds = Array.from(new Set(reviews.map((r) => r.target_user_id)));
    if (targetIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', targetIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
      return {
        data: reviews.map((r) => ({
          ...r,
          target_user_email: profileMap.get(r.target_user_id)?.email,
          target_user_name: profileMap.get(r.target_user_id)?.full_name,
        })),
        error: null,
      };
    }

    return { data: reviews, error: null };
  } catch (err: any) {
    return { data: [], error: err };
  }
}

/**
 * Access Reviews: Update Status (Approve / Revoke)
 */
export async function updateAccessReviewStatus(
  supabase: SupabaseClient,
  orgId: string,
  reviewId: string,
  status: 'approved' | 'revoked',
  notes?: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase
      .from('access_reviews')
      .update({
        status,
        notes: notes || null,
        reviewer_id: user?.id || null,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .eq('organization_id', orgId);

    if (error) return { success: false, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'governance_changed',
      entityType: 'access_review',
      entityId: reviewId,
      details: { status, notes },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Invites / Adds an organization member by email address.
 */
export async function addOrganizationMember(
  supabase: SupabaseClient,
  orgId: string,
  email: string,
  role: OrganizationRole = 'member',
  targetUserId?: string
): Promise<{ success: boolean; error: Error | null; memberId?: string }> {
  try {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Try server-side secure RPC first
    const { data: rpcData, error: rpcErr } = await supabase.rpc('add_organization_member_by_email', {
      p_organization_id: orgId,
      p_email: cleanEmail,
      p_role: role,
    });

    if (!rpcErr && rpcData) {
      if (rpcData.success) {
        return { success: true, error: null, memberId: rpcData.member_id };
      } else {
        return { success: false, error: new Error(rpcData.error || 'Failed to add member') };
      }
    }

    // 2. Fallback path if RPC is not available
    let resolvedUserId = targetUserId;

    if (!resolvedUserId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', cleanEmail)
        .maybeSingle();

      if (profile?.id) {
        resolvedUserId = profile.id;
      }
    }

    if (!resolvedUserId) {
      return {
        success: false,
        error: new Error(rpcErr?.message || `No user found with email "${cleanEmail}". User must have an existing Concludo account.`),
      };
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('organization_members')
      .select('id')
      .eq('organization_id', orgId)
      .eq('user_id', resolvedUserId)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        error: new Error(`User "${cleanEmail}" is already a member of this organization.`),
      };
    }

    const { data: newMember, error: insertErr } = await supabase
      .from('organization_members')
      .insert({
        organization_id: orgId,
        user_id: resolvedUserId,
        role,
      })
      .select()
      .single();

    if (insertErr) {
      return { success: false, error: new Error(insertErr.message) };
    }

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'role_changed',
      entityType: 'organization_member',
      entityId: resolvedUserId,
      details: { action: 'member_added', email: cleanEmail, role },
    });

    return { success: true, error: null, memberId: newMember.id };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Records or updates an access certification review.
 */
export async function recordAccessReview(
  supabase: SupabaseClient,
  orgId: string,
  targetUserId: string,
  status: 'approved' | 'revoked',
  notes?: string
): Promise<{ success: boolean; error: Error | null }> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Query target user's current organization role
    let userRole = 'member';
    const { data: memberRec } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', targetUserId)
      .maybeSingle();

    if (memberRec?.role) {
      userRole = memberRec.role;
    }

    const { error } = await supabase
      .from('access_reviews')
      .insert({
        organization_id: orgId,
        target_user_id: targetUserId,
        reviewer_id: user?.id || null,
        role: userRole,
        teams: [],
        status,
        reviewed_at: new Date().toISOString(),
        notes: notes || null,
      });

    if (error) return { success: false, error: new Error(error.message) };

    await logAuditEvent(supabase, {
      organizationId: orgId,
      action: 'governance_changed',
      entityType: 'access_review',
      entityId: targetUserId,
      details: { status, role: userRole, notes: notes || 'Access certified by enterprise admin' },
    });

    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err };
  }
}

/**
 * Organization Analytics
 */
export async function fetchOrganizationAnalytics(
  supabase: SupabaseClient,
  orgId: string
): Promise<{ data: OrganizationAnalytics; error: Error | null }> {
  try {
    // 1. Total members
    const { count: memberCount } = await supabase
      .from('organization_members')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    // 2. Active legal holds
    const { count: legalHoldCount } = await supabase
      .from('legal_holds')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('status', 'active');

    // 3. Teams in org
    const { data: orgTeams } = await supabase
      .from('teams')
      .select('id')
      .eq('organization_id', orgId);
    const teamIds = (orgTeams || []).map((t) => t.id);
    const teamCount = teamIds.length;

    // 4. Retention policies configured
    const { count: policyCount } = await supabase
      .from('retention_policies')
      .select('*', { count: 'exact', head: true })
      .eq('organization_id', orgId);

    // Fetch members in organization
    const { data: orgMembers } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId);
    const memberUserIds = (orgMembers || []).map((m) => m.user_id);

    // Count suspended users
    let suspendedUserCount = 0;
    if (memberUserIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, is_suspended')
        .in('id', memberUserIds)
        .eq('is_suspended', true);
      suspendedUserCount = profiles?.length || 0;
    }

    // Query projects strictly belonging to this organization's teams or members
    let projectCount = 0;
    let projectIds: string[] = [];
    if (teamIds.length > 0 || memberUserIds.length > 0) {
      let pQuery = supabase
        .from('projects')
        .select('id, meeting_type')
        .is('deleted_at', null);

      if (teamIds.length > 0 && memberUserIds.length > 0) {
        pQuery = pQuery.or(`team_id.in.(${teamIds.join(',')}),user_id.in.(${memberUserIds.join(',')})`);
      } else if (teamIds.length > 0) {
        pQuery = pQuery.in('team_id', teamIds);
      } else {
        pQuery = pQuery.in('user_id', memberUserIds);
      }

      const { data: projects } = await pQuery;
      projectCount = projects?.length || 0;
      projectIds = (projects || []).map((p) => p.id);
    }

    // Query decisions strictly belonging to projects in this org
    let decisionCount = 0;
    if (projectIds.length > 0) {
      const { count } = await supabase
        .from('decision_memory')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .in('project_id', projectIds);
      decisionCount = count || 0;
    }

    // Query actions strictly belonging to projects in this org
    let totalActions = 0;
    let completedActions = 0;
    if (projectIds.length > 0) {
      const { data: actions } = await supabase
        .from('action_tracker')
        .select('id, status')
        .is('deleted_at', null)
        .in('project_id', projectIds);
      totalActions = actions?.length || 0;
      completedActions = actions?.filter((a) => a.status === 'completed').length || 0;
    }

    const completionRate = totalActions > 0 ? Math.round((completedActions / totalActions) * 100) : 0;

    return {
      data: {
        totalUsers: memberCount || 1,
        activeUsers: (memberCount || 1) - suspendedUserCount,
        totalTeams: teamCount,
        totalProjects: projectCount,
        totalDecisions: decisionCount,
        totalActions,
        completedActions,
        completionRate,
        meetingVolume: projectCount,
        activeLegalHolds: legalHoldCount || 0,
        suspendedUsers: suspendedUserCount,
        retentionPolicyCount: policyCount || 0,
      },
      error: null,
    };
  } catch (err: any) {
    return {
      data: {
        totalUsers: 0,
        activeUsers: 0,
        totalTeams: 0,
        totalProjects: 0,
        totalDecisions: 0,
        totalActions: 0,
        completedActions: 0,
        completionRate: 0,
        meetingVolume: 0,
        activeLegalHolds: 0,
        suspendedUsers: 0,
        retentionPolicyCount: 0,
      },
      error: err,
    };
  }
}
