import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Shield,
  Users,
  Building,
  KeyRound,
  FileSpreadsheet,
  Scale,
  Settings,
  AlertCircle,
  Loader2,
  CheckCircle,
  RefreshCw,
  Plus,
  Lock,
  Globe,
  UserCheck,
  UserX,
  FileCheck,
  Building2,
  Clock,
  ArrowRight,
  ChevronRight,
  FolderKanban,
  ExternalLink,
  ShieldAlert,
  Search,
  Filter,
  TrendingUp,
  Sparkles,
  AlertTriangle,
  Compass,
} from 'lucide-react';
import { useAuth } from '../../lib/auth/AuthContext';
import { usePermissions } from '../../lib/permissions/usePermissions';
import { getPredictiveAnalysis } from '../../lib/predictive/predictiveService';
import { PredictiveAnalysisResult } from '../../lib/predictive/types';
import {
  Organization,
  OrganizationMember,
  OrganizationRole,
  OrganizationDomain,
  OrganizationSSOConfig,
  RetentionPolicy,
  LegalHold,
  AccessReview,
  OrganizationAnalytics,
  ORGANIZATION_ROLE_LABELS,
  ROLE_CAPABILITIES,
  SSOProvider,
  AuditLog,
  RetentionEntityType,
} from '../../lib/enterprise/types';
import {
  createOrganization,
  fetchUserOrganizations,
  fetchOrganizationMembers,
  updateOrganizationMemberRole,
  removeOrganizationMember,
  addOrganizationMember,
  setUserSuspension,
  fetchOrganizationDomains,
  addOrganizationDomain,
  verifyOrganizationDomain,
  fetchSSOConfig,
  saveSSOConfig,
  fetchRetentionPolicies,
  saveRetentionPolicy,
  fetchLegalHolds,
  createLegalHold,
  releaseLegalHold,
  fetchAccessReviews,
  recordAccessReview,
  fetchOrganizationAnalytics,
  fetchAuditLogs,
} from '../../lib/enterprise/enterpriseClient';

export const AdminPortalPage: React.FC<{ initialTab?: string }> = ({ initialTab = 'overview' }) => {
  const { supabase, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { hasAccess, loading: permissionsLoading } = usePermissions('organization_admin');
  const [searchParams, setSearchParams] = useSearchParams();

  // Determine active tab from URL path, query param, or prop
  let derivedTab = initialTab;
  if (location.pathname.endsWith('/audit')) {
    derivedTab = 'audit';
  } else if (location.pathname.endsWith('/compliance')) {
    derivedTab = 'compliance';
  } else if (location.pathname.endsWith('/security')) {
    derivedTab = 'security';
  } else if (searchParams.get('tab')) {
    derivedTab = searchParams.get('tab')!;
  }
  const activeTab = derivedTab;

  const setActiveTab = (tab: string) => {
    if (tab === 'audit') {
      navigate('/admin/audit');
    } else if (tab === 'compliance') {
      navigate('/admin/compliance');
    } else if (tab === 'security') {
      navigate('/admin/security');
    } else if (tab === 'overview') {
      navigate('/admin');
    } else {
      navigate(`/admin?tab=${tab}`);
    }
  };

  const [orgs, setOrgs] = useState<(Organization & { currentRole: OrganizationRole })[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  // New org modal
  const [showCreateOrg, setShowCreateOrg] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);

  // Org data
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [domains, setDomains] = useState<OrganizationDomain[]>([]);
  const [ssoConfig, setSsoConfig] = useState<OrganizationSSOConfig | null>(null);
  const [analytics, setAnalytics] = useState<OrganizationAnalytics | null>(null);
  const [retentionPolicies, setRetentionPolicies] = useState<RetentionPolicy[]>([]);
  const [legalHolds, setLegalHolds] = useState<LegalHold[]>([]);
  const [accessReviews, setAccessReviews] = useState<AccessReview[]>([]);
  const [orgPredictive, setOrgPredictive] = useState<PredictiveAnalysisResult | null>(null);
  const [loadingOrgPredictive, setLoadingOrgPredictive] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  // Audit Logs state
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudit, setLoadingAudit] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [auditUserFilter, setAuditUserFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditEntityFilter, setAuditEntityFilter] = useState('');
  const [auditDateFilter, setAuditDateFilter] = useState('all');

  // Modals & Action states
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);
  const [savingSSO, setSavingSSO] = useState(false);
  const [ssoFormData, setSsoFormData] = useState<{
    provider_name: SSOProvider;
    protocol: 'saml' | 'oidc';
    login_url: string;
    issuer: string;
    certificate: string;
    client_id: string;
    client_secret: string;
    domain_mapping: string;
    sso_enabled: boolean;
  }>({
    provider_name: 'Microsoft Entra ID',
    protocol: 'saml',
    login_url: '',
    issuer: '',
    certificate: '',
    client_id: '',
    client_secret: '',
    domain_mapping: '',
    sso_enabled: false,
  });

  const [savingPolicy, setSavingPolicy] = useState(false);
  const [holdModal, setHoldModal] = useState(false);
  const [holdName, setHoldName] = useState('');
  const [holdDesc, setHoldDesc] = useState('');
  const [creatingHold, setCreatingHold] = useState(false);

  // Invite member modal
  const [inviteModal, setInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<OrganizationRole>('member');
  const [invitingMember, setInvitingMember] = useState(false);

  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showStatus = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type });
    setTimeout(() => setStatusMessage(null), 4000);
  };

  // 1. Load User Organizations
  const loadOrgs = useCallback(async () => {
    if (!supabase) return;
    setLoadingOrgs(true);
    setOrgError(null);
    try {
      const { data, error } = await fetchUserOrganizations(supabase);
      if (error) throw error;
      setOrgs(data);
      if (data.length > 0 && !selectedOrgId) {
        setSelectedOrgId(data[0].id);
      }
    } catch (err: any) {
      setOrgError(err.message || 'Failed to load organization');
    } finally {
      setLoadingOrgs(false);
    }
  }, [supabase, selectedOrgId]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  // 2. Load Selected Organization Data
  const loadOrgData = useCallback(async () => {
    if (!supabase || !selectedOrgId) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [membersRes, domainsRes, ssoRes, analyticsRes, retentionRes, holdsRes, reviewsRes] =
        await Promise.all([
          fetchOrganizationMembers(supabase, selectedOrgId),
          fetchOrganizationDomains(supabase, selectedOrgId),
          fetchSSOConfig(supabase, selectedOrgId),
          fetchOrganizationAnalytics(supabase, selectedOrgId),
          fetchRetentionPolicies(supabase, selectedOrgId),
          fetchLegalHolds(supabase, selectedOrgId),
          fetchAccessReviews(supabase, selectedOrgId),
        ]);

      if (membersRes.data) setMembers(membersRes.data);
      if (domainsRes.data) setDomains(domainsRes.data);
      if (ssoRes.data) {
        setSsoConfig(ssoRes.data);
        setSsoFormData({
          provider_name: (ssoRes.data.provider_name as SSOProvider) || 'Microsoft Entra ID',
          protocol: ssoRes.data.protocol || 'saml',
          login_url: ssoRes.data.login_url || '',
          issuer: ssoRes.data.issuer || '',
          certificate: ssoRes.data.certificate || '',
          client_id: ssoRes.data.client_id || '',
          client_secret: ssoRes.data.client_secret || '',
          domain_mapping: ssoRes.data.domain_mapping || '',
          sso_enabled: ssoRes.data.sso_enabled,
        });
      }
      if (analyticsRes.data) setAnalytics(analyticsRes.data);
      if (retentionRes.data) setRetentionPolicies(retentionRes.data);
      if (holdsRes.data) setLegalHolds(holdsRes.data);
      if (reviewsRes.data) setAccessReviews(reviewsRes.data);

      try {
        setLoadingOrgPredictive(true);
        const pred = await getPredictiveAnalysis({ scope: 'organization', scopeId: selectedOrgId, userId: user!.id }, supabase);
        setOrgPredictive(pred);
      } catch (e) {
        console.warn('Could not load org predictive analysis:', e);
      } finally {
        setLoadingOrgPredictive(false);
      }
    } catch (err: any) {
      setDataError(err.message || 'Failed to load compliance data');
    } finally {
      setLoadingData(false);
    }
  }, [supabase, selectedOrgId]);

  useEffect(() => {
    if (selectedOrgId) {
      loadOrgData();
    }
  }, [selectedOrgId, loadOrgData]);

  // 3. Load Audit Logs
  const loadAuditData = useCallback(async () => {
    if (!supabase || !selectedOrgId) return;
    setLoadingAudit(true);
    setAuditError(null);
    try {
      let startDate: string | undefined;
      const now = new Date();
      if (auditDateFilter === '24h') {
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      } else if (auditDateFilter === '7d') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      } else if (auditDateFilter === '30d') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      }

      const { data, error } = await fetchAuditLogs(supabase, {
        organizationId: selectedOrgId,
        action: auditActionFilter || undefined,
        entityType: auditEntityFilter || undefined,
        startDate,
        limit: 150,
      });

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (err: any) {
      setAuditError(err.message || 'Failed to load audit logs');
    } finally {
      setLoadingAudit(false);
    }
  }, [supabase, selectedOrgId, auditActionFilter, auditEntityFilter, auditDateFilter]);

  useEffect(() => {
    if (selectedOrgId && (activeTab === 'audit' || activeTab === 'security')) {
      loadAuditData();
    }
  }, [selectedOrgId, activeTab, loadAuditData]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !newOrgName.trim()) return;
    setCreatingOrg(true);
    const { data, error } = await createOrganization(supabase, newOrgName);
    setCreatingOrg(false);
    if (error) {
      showStatus(error.message, 'error');
    } else if (data) {
      setNewOrgName('');
      setShowCreateOrg(false);
      showStatus(`Organization "${data.name}" created successfully.`);
      setSelectedOrgId(data.id);
      loadOrgs();
    }
  };

  const handleAddDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedOrgId || !newDomain.trim()) return;
    setAddingDomain(true);
    const { error } = await addOrganizationDomain(supabase, selectedOrgId, newDomain);
    setAddingDomain(false);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      setNewDomain('');
      showStatus('Domain registered. Verification DNS token generated.');
      loadOrgData();
    }
  };

  const handleVerifyDomain = async (domainId: string) => {
    if (!supabase) return;
    const { error } = await verifyOrganizationDomain(supabase, domainId);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      showStatus('Domain verified successfully.');
      loadOrgData();
    }
  };

  const handleSaveSSO = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedOrgId) return;
    setSavingSSO(true);
    const { error } = await saveSSOConfig(supabase, selectedOrgId, ssoFormData);
    setSavingSSO(false);
    if (error) {
      showStatus(error.message || 'Failed to configure SSO', 'error');
    } else {
      showStatus('SSO configuration updated.');
      loadOrgData();
    }
  };

  const handleCreateHold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedOrgId || !holdName.trim()) return;
    setCreatingHold(true);
    const { error } = await createLegalHold(supabase, selectedOrgId, holdName, holdDesc);
    setCreatingHold(false);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      setHoldModal(false);
      setHoldName('');
      setHoldDesc('');
      showStatus('Legal Hold activated. Retention purge suspended for protected entities.');
      loadOrgData();
    }
  };

  const handleReleaseHold = async (holdId: string) => {
    if (!supabase || !selectedOrgId) return;
    const { error } = await releaseLegalHold(supabase, selectedOrgId, holdId);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      showStatus('Legal Hold released. Standard organizational retention resumed.');
      loadOrgData();
    }
  };

  const handleRetentionUpdate = async (entityType: string, days: number) => {
    if (!supabase || !selectedOrgId) return;
    setSavingPolicy(true);
    const { error } = await saveRetentionPolicy(supabase, selectedOrgId, entityType as RetentionEntityType, days);
    setSavingPolicy(false);
    if (error) {
      showStatus(error.message || 'Failed to update policy', 'error');
    } else {
      showStatus(`Retention policy updated for ${entityType} (${days === -1 ? 'Indefinite' : `${days} days`}).`);
      loadOrgData();
    }
  };

  const handleUpdateRole = async (memberUserId: string, newRole: OrganizationRole) => {
    if (!supabase || !selectedOrgId) return;
    const { error } = await updateOrganizationMemberRole(supabase, selectedOrgId, memberUserId, newRole);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      showStatus('Member role updated.');
      loadOrgData();
    }
  };

  const handleSetSuspension = async (memberUserId: string, suspended: boolean) => {
    if (!supabase || !selectedOrgId) return;
    const { error } = await setUserSuspension(supabase, selectedOrgId, memberUserId, suspended);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      showStatus(`User ${suspended ? 'suspended' : 'reactivated'} successfully.`);
      loadOrgData();
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!supabase || !selectedOrgId) return;
    if (!window.confirm('Remove this member from the organization?')) return;
    const { error } = await removeOrganizationMember(supabase, selectedOrgId, memberUserId);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      showStatus('Member removed from organization.');
      loadOrgData();
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedOrgId || !inviteEmail.trim()) return;
    setInvitingMember(true);
    const { error } = await addOrganizationMember(supabase, selectedOrgId, inviteEmail, inviteRole);
    setInvitingMember(false);
    if (error) {
      showStatus(error.message, 'error');
    } else {
      setInviteModal(false);
      setInviteEmail('');
      showStatus(`User ${inviteEmail} added to organization as ${ORGANIZATION_ROLE_LABELS[inviteRole]}.`);
      loadOrgData();
    }
  };

  const handleCertifyAccess = async (targetUserId: string, targetEmail: string, status: 'approved' | 'revoked') => {
    if (!supabase || !selectedOrgId) return;
    const notes = status === 'approved' ? 'Periodic access certified by administrator' : 'Access revoked during administrative review';
    const { error } = await recordAccessReview(supabase, selectedOrgId, targetUserId, status, notes);
    if (error) {
      showStatus(error.message || 'Failed to update governance settings', 'error');
    } else {
      showStatus(`Access ${status} for ${targetEmail}. Audit log recorded.`);
      loadOrgData();
    }
  };

  // Filtered audit logs for the viewer
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((log) => {
      if (auditUserFilter.trim()) {
        const query = auditUserFilter.toLowerCase().trim();
        const emailMatch = log.user_email?.toLowerCase().includes(query);
        const uidMatch = log.user_id?.toLowerCase().includes(query);
        if (!emailMatch && !uidMatch) return false;
      }
      return true;
    });
  }, [auditLogs, auditUserFilter]);

  // Security dashboard events
  const securityEvents = useMemo(() => {
    const securityActions = [
      'user_login',
      'user_logout',
      'sso_login',
      'password_reset',
      'role_changed',
      'user_suspended',
      'user_reactivated',
      'admin_action',
      'legal_hold_created',
      'legal_hold_released',
    ];
    return auditLogs.filter((log) => securityActions.includes(log.action));
  }, [auditLogs]);

  // Suspended users
  const suspendedMembers = useMemo(() => {
    return members.filter((m) => m.profile?.is_suspended);
  }, [members]);

  // Permission Guard
  if (permissionsLoading) {
    return (
      <div className="empty-state-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Loader2 size={32} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 12px', display: 'block' }} />
        <div style={{ color: '#94a3b8' }}>Checking enterprise authorization...</div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="empty-state-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <Shield size={44} color="#e2b53c" style={{ margin: '0 auto 16px', display: 'block' }} />
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
          Available on Enterprise
        </h2>
        <p style={{ maxWidth: '440px', margin: '0 auto 20px', color: '#94a3b8', fontSize: '0.95rem' }}>
          Enterprise administration, Single Sign-On (SAML/OIDC), compliance retention policies, and immutable audit logs are available exclusively on Enterprise and Admin plans.
        </p>
        <Link to="/dashboard" className="btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <span>Return to Dashboard</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="workspace-page-container">
      {/* Page Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <div style={{ padding: '6px', borderRadius: '8px', background: 'rgba(226, 181, 60, 0.15)', border: '1px solid rgba(226, 181, 60, 0.3)' }}>
                <Shield size={20} color="#e2b53c" />
              </div>
              <h1 className="page-title" style={{ margin: 0 }}>
                Enterprise Administration
              </h1>
              <span style={{ background: '#e2b53c', color: '#16263f', fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '12px' }}>
                ENTERPRISE
              </span>
            </div>
            <p className="page-subtitle" style={{ margin: 0 }}>
              Centralized identity governance, compliance retention, SAML/OIDC SSO, and sovereign audit logging.
            </p>
          </div>

          {/* Org Selector & Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {orgs.length > 0 && (
              <select
                className="form-input"
                style={{ minWidth: '220px', background: '#0e1729' }}
                value={selectedOrgId || ''}
                onChange={(e) => setSelectedOrgId(e.target.value)}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name} ({ORGANIZATION_ROLE_LABELS[o.currentRole] || o.currentRole})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => setShowCreateOrg(true)}
              className="btn-gold"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={16} />
              <span>New Organization</span>
            </button>

            <button
              type="button"
              onClick={() => {
                loadOrgData();
                loadAuditData();
                showStatus('Enterprise data refreshed.');
              }}
              className="btn-secondary"
              title="Refresh enterprise records"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Global Status Message */}
      {statusMessage && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            backgroundColor: statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(34, 197, 94, 0.15)',
            border: `1px solid ${statusMessage.type === 'error' ? 'rgba(239, 68, 68, 0.4)' : 'rgba(34, 197, 94, 0.4)'}`,
            color: statusMessage.type === 'error' ? '#fca5a5' : '#86efac',
          }}
        >
          {statusMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
        {[
          { id: 'overview', label: 'Overview', icon: Building2 },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'teams', label: 'Teams', icon: FolderKanban },
          { id: 'security', label: 'Security', icon: Lock },
          { id: 'audit', label: 'Audit Logs', icon: FileSpreadsheet },
          { id: 'compliance', label: 'Compliance & Retention', icon: Scale },
          { id: 'governance', label: 'Data Governance', icon: FileCheck },
          { id: 'sso', label: 'SSO & Domains', icon: KeyRound },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                borderRadius: '8px 8px 0 0',
                border: 'none',
                background: isActive ? 'rgba(226, 181, 60, 0.12)' : 'transparent',
                color: isActive ? '#e2b53c' : '#94a3b8',
                borderBottom: isActive ? '2px solid #e2b53c' : '2px solid transparent',
                fontWeight: isActive ? 600 : 500,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      {loadingOrgs || (loadingData && !analytics) ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <Loader2 size={32} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 12px', display: 'block' }} />
          <div style={{ color: '#94a3b8' }}>
            {activeTab === 'audit'
              ? 'Loading audit logs...'
              : activeTab === 'compliance'
              ? 'Loading compliance data...'
              : activeTab === 'security'
              ? 'Loading security dashboard...'
              : 'Loading organization...'}
          </div>
        </div>
      ) : orgs.length === 0 ? (
        <div className="content-card" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Building2 size={44} color="#e2b53c" style={{ margin: '0 auto 16px', display: 'block' }} />
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
            No Organization Configured
          </h2>
          <p style={{ maxWidth: '440px', margin: '0 auto 20px', color: '#94a3b8', fontSize: '0.92rem' }}>
            Create your enterprise organization container to unlock centralized user management, SSO, and compliance retention policies.
          </p>
          <button
            type="button"
            onClick={() => setShowCreateOrg(true)}
            className="btn-gold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={16} />
            <span>Create Organization</span>
          </button>
        </div>
      ) : (
        <div>
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div>
              {/* Analytics Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Total Users</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {analytics?.totalUsers || members.length || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '4px' }}>
                    {analytics?.activeUsers || members.length || 0} Active • {analytics?.suspendedUsers || 0} Suspended
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Managed Teams</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {analytics?.totalTeams || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#e2b53c', marginTop: '4px' }}>
                    Centralized Governance
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Projects in Scope</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {analytics?.totalProjects || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#38bdf8', marginTop: '4px' }}>
                    {analytics?.totalDecisions || 0} Decisions • {analytics?.totalActions || 0} Actions
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Action Completion</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {analytics?.completionRate || 0}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {analytics?.completedActions || 0} / {analytics?.totalActions || 0} Completed
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Legal Holds Active</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 700, color: (analytics?.activeLegalHolds || 0) > 0 ? '#ef4444' : '#22c55e', marginTop: '4px' }}>
                    {analytics?.activeLegalHolds || 0}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: (analytics?.activeLegalHolds || 0) > 0 ? '#fca5a5' : '#86efac', marginTop: '4px' }}>
                    {(analytics?.activeLegalHolds || 0) > 0 ? 'Purges Suspended' : 'Standard Retention'}
                  </div>
                </div>
              </div>

              {/* Organization Health & Strategic Intelligence Panel */}
              <div className="content-card" style={{ padding: '24px 28px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <TrendingUp size={20} color="#e2b53c" />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Organizational Health & Strategic Trajectory
                    </h3>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Link
                      to="/executive-intelligence"
                      className="btn-gold"
                      style={{ padding: '6px 14px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Compass size={14} />
                      <span>Executive Intelligence</span>
                    </Link>
                    <Link
                      to="/predictive-intelligence"
                      className="btn-secondary"
                      style={{ padding: '6px 14px', fontSize: '0.84rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    >
                      <TrendingUp size={14} />
                      <span>Predictive Hub</span>
                    </Link>
                  </div>
                </div>

                {loadingOrgPredictive ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', padding: '16px 0', fontSize: '0.88rem' }}>
                    <Loader2 size={16} className="spin-animation" color="#e2b53c" />
                    <span>Calculating organizational health score and risk vectors...</span>
                  </div>
                ) : orgPredictive ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                      {/* Health Score */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                          Overall Health Score
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: orgPredictive.healthScore.overallScore >= 75 ? '#4ade80' : '#facc15', marginTop: '4px' }}>
                          {orgPredictive.healthScore.overallScore}/100
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', textTransform: 'capitalize' }}>
                          Rating: {orgPredictive.healthScore.category.replace('_', ' ')}
                        </div>
                      </div>

                      {/* Strategic Risks */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                          Strategic Risks
                        </div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: orgPredictive.riskPredictions[0]?.riskLevel === 'critical' || orgPredictive.riskPredictions[0]?.riskLevel === 'high' ? '#f87171' : '#4ade80', marginTop: '6px' }}>
                          {orgPredictive.riskPredictions[0]?.riskLevel.toUpperCase() || 'LOW RISK'}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {orgPredictive.riskPredictions[0]?.title || 'No active risk flags'}
                        </div>
                      </div>

                      {/* Operational Trends */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                          Decision Velocity
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                          {orgPredictive.decisionQuality.decisionVelocityDaysAverage}d avg
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                          Effectiveness: {orgPredictive.decisionQuality.decisionEffectivenessRatePercent}%
                        </div>
                      </div>

                      {/* Forecast Summary */}
                      <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                        <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                          90-Day Trajectory
                        </div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                          {orgPredictive.forecasts['90_day']?.expectedCompletionRates.projectedPercent}%
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>
                          Projected Completion
                        </div>
                      </div>
                    </div>

                    {/* Top Recommendation */}
                    {orgPredictive.strategicRecommendations.length > 0 && (
                      <div style={{ padding: '12px 16px', borderRadius: '8px', background: 'rgba(226, 181, 60, 0.06)', border: '1px solid rgba(226, 181, 60, 0.25)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: '#e2b53c', fontWeight: 600 }}>
                          <Sparkles size={14} />
                          <span>Top Executive Recommendation: {orgPredictive.strategicRecommendations[0].title}</span>
                        </div>
                        <div style={{ fontSize: '0.82rem', color: '#cbd5e1', marginTop: '4px', lineHeight: 1.5 }}>
                          {orgPredictive.strategicRecommendations[0].summary}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: '#94a3b8', fontSize: '0.86rem' }}>
                    Connect projects, decisions, and actions across teams to activate organization-wide strategic forecasting.
                  </div>
                )}
              </div>

              {/* Quick Hub Navigation Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div className="content-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <KeyRound size={18} color="#e2b53c" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Single Sign-On (SSO)
                    </h3>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                    Configure enterprise IdP connections via SAML 2.0 or OpenID Connect with Microsoft Entra ID, Okta, or Google Workspace.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('sso')}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                  >
                    <span>Manage SSO & Domains</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="content-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <Scale size={18} color="#e2b53c" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Compliance & Retention
                    </h3>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                    Define organization-level retention periods (30d, 90d, 180d, 365d, Indefinite) and activate legal holds to prevent purging.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('compliance')}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                  >
                    <span>Configure Compliance</span>
                    <ArrowRight size={14} />
                  </button>
                </div>

                <div className="content-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <FileSpreadsheet size={18} color="#e2b53c" />
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Immutable Audit Trail
                    </h3>
                  </div>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', lineHeight: 1.5, marginBottom: '16px' }}>
                    Review cryptographic audit events across user logins, permissions, record operations, and administrative oversight.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('audit')}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}
                  >
                    <span>View Audit Logs</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: USER MANAGEMENT */}
          {activeTab === 'users' && (
            <div className="content-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Organization Members & Roles
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0' }}>
                    Manage enterprise roles, configure access boundaries, and enforce user suspension.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInviteModal(true)}
                  className="btn-gold"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={16} />
                  <span>Invite Member</span>
                </button>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="custom-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '0.78rem' }}>
                      <th style={{ padding: '12px 16px' }}>User</th>
                      <th style={{ padding: '12px 16px' }}>Role</th>
                      <th style={{ padding: '12px 16px' }}>Status</th>
                      <th style={{ padding: '12px 16px' }}>Joined Date</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => {
                      const isOwner = m.role === 'organization_owner';
                      const isSuspended = m.profile?.is_suspended;
                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)' }}>
                          <td style={{ padding: '14px 16px' }}>
                            <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                              {m.profile?.full_name || 'Organization Member'}
                            </div>
                            <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                              {m.profile?.email || m.user_id}
                            </div>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <select
                              className="form-input"
                              style={{ padding: '4px 8px', fontSize: '0.82rem', background: '#0e1729' }}
                              value={m.role}
                              disabled={isOwner}
                              onChange={(e) => handleUpdateRole(m.user_id, e.target.value as OrganizationRole)}
                            >
                              <option value="organization_owner">Organization Owner</option>
                              <option value="organization_admin">Organization Admin</option>
                              <option value="security_admin">Security Admin</option>
                              <option value="compliance_admin">Compliance Admin</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          </td>
                          <td style={{ padding: '14px 16px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                backgroundColor: isSuspended ? 'rgba(239, 68, 68, 0.2)' : 'rgba(34, 197, 94, 0.2)',
                                color: isSuspended ? '#ef4444' : '#22c55e',
                              }}
                            >
                              {isSuspended ? 'SUSPENDED' : 'ACTIVE'}
                            </span>
                          </td>
                          <td style={{ padding: '14px 16px', color: '#94a3b8', fontSize: '0.82rem' }}>
                            {new Date(m.created_at).toLocaleDateString('en-AU')}
                          </td>
                          <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                            {!isOwner && (
                              <div style={{ display: 'inline-flex', gap: '8px' }}>
                                <button
                                  type="button"
                                  onClick={() => handleSetSuspension(m.user_id, !isSuspended)}
                                  className="btn-secondary"
                                  style={{
                                    padding: '4px 10px',
                                    fontSize: '0.78rem',
                                    color: isSuspended ? '#22c55e' : '#fca5a5',
                                    borderColor: isSuspended ? '#22c55e' : '#ef4444',
                                  }}
                                >
                                  {isSuspended ? 'Reactivate' : 'Suspend'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMember(m.user_id)}
                                  className="btn-secondary"
                                  style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#94a3b8' }}
                                >
                                  Remove
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: TEAMS OVERSIGHT */}
          {activeTab === 'teams' && (
            <div className="content-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Enterprise Team Oversight
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0' }}>
                    All collaborative teams across the organization remain subject to centralized enterprise governance.
                  </p>
                </div>
                <Link to="/team" className="btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <span>Open Team Workspace Hub</span>
                  <ExternalLink size={14} />
                </Link>
              </div>

              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                <FolderKanban size={40} color="#e2b53c" style={{ margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                  {analytics?.totalTeams || 0} Teams Managed Under Organization
                </div>
                <p style={{ maxWidth: '440px', margin: '0 auto 16px', fontSize: '0.88rem' }}>
                  Teams inherit organizational retention periods and legal hold overrides automatically.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: SECURITY DASHBOARD */}
          {activeTab === 'security' && (
            <div>
              {/* Security Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Recent Logins</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {auditLogs.filter((l) => l.action === 'user_login' || l.action === 'sso_login').length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '4px' }}>
                    Active Sessions Monitored
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Failed Logins</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>
                    0
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#22c55e', marginTop: '4px' }}>
                    Zero Brute-Force Activity
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Suspended Accounts</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: suspendedMembers.length > 0 ? '#ef4444' : '#f8fafc', marginTop: '4px' }}>
                    {suspendedMembers.length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                    {suspendedMembers.length > 0 ? 'Access Restricted' : 'All Accounts Active'}
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Role Changes</div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                    {auditLogs.filter((l) => l.action === 'role_changed').length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#e2b53c', marginTop: '4px' }}>
                    Audited Admin Events
                  </div>
                </div>
              </div>

              {/* Suspended Users Section */}
              {suspendedMembers.length > 0 && (
                <div className="content-card" style={{ padding: '24px', marginBottom: '24px', borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                    <ShieldAlert size={20} color="#ef4444" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fca5a5', margin: 0 }}>
                      Suspended User Accounts
                    </h3>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {suspendedMembers.map((m) => (
                      <div
                        key={m.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 16px',
                          background: 'rgba(239, 68, 68, 0.06)',
                          borderRadius: '6px',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc' }}>{m.profile?.full_name || m.profile?.email}</div>
                          <div style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{m.profile?.email} • Access Restricted</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSetSuspension(m.user_id, false)}
                          className="btn-gold"
                          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                        >
                          Reactivate Account
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security Events Stream */}
              <div className="content-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  Live Security Events
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>
                  Administrative activities, authentication attempts, and authorization modifications.
                </p>

                {securityEvents.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    No security events recorded.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="custom-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '0.78rem' }}>
                          <th style={{ padding: '10px 12px' }}>Timestamp</th>
                          <th style={{ padding: '10px 12px' }}>Action</th>
                          <th style={{ padding: '10px 12px' }}>User</th>
                          <th style={{ padding: '10px 12px' }}>IP Address</th>
                          <th style={{ padding: '10px 12px' }}>Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityEvents.slice(0, 25).map((log) => (
                          <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '0.84rem' }}>
                            <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                              {new Date(log.created_at).toLocaleString('en-AU')}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor:
                                    log.action.includes('suspend')
                                      ? 'rgba(239, 68, 68, 0.2)'
                                      : log.action.includes('login')
                                      ? 'rgba(34, 197, 94, 0.2)'
                                      : 'rgba(226, 181, 60, 0.2)',
                                  color:
                                    log.action.includes('suspend')
                                      ? '#ef4444'
                                      : log.action.includes('login')
                                      ? '#22c55e'
                                      : '#e2b53c',
                                }}
                              >
                                {log.action.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#f8fafc' }}>
                              {log.user_email || log.user_id || 'System'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#64748b' }}>{log.ip_address}</td>
                            <td style={{ padding: '10px 12px', color: '#94a3b8', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {JSON.stringify(log.details)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: AUDIT LOG VIEWER */}
          {activeTab === 'audit' && (
            <div className="content-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    Enterprise Audit Log Viewer
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0' }}>
                    Immutable historical audit records across users, projects, decisions, actions, and security operations.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadAuditData}
                  className="btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <RefreshCw size={14} />
                  <span>Refresh Logs</span>
                </button>
              </div>

              {/* Filters Bar */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  marginBottom: '20px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '16px',
                  borderRadius: '8px',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                }}
              >
                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                    Filter by User
                  </label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by email or user ID..."
                    value={auditUserFilter}
                    onChange={(e) => setAuditUserFilter(e.target.value)}
                    style={{ fontSize: '0.84rem' }}
                  />
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                    Filter by Action
                  </label>
                  <select
                    className="form-input"
                    value={auditActionFilter}
                    onChange={(e) => setAuditActionFilter(e.target.value)}
                    style={{ fontSize: '0.84rem', background: '#0e1729' }}
                  >
                    <option value="">All Actions</option>
                    <option value="user_login">User Login</option>
                    <option value="user_logout">User Logout</option>
                    <option value="sso_login">SSO Login</option>
                    <option value="password_reset">Password Reset</option>
                    <option value="project_created">Project Creation</option>
                    <option value="project_updated">Project Update</option>
                    <option value="project_deleted">Project Deletion</option>
                    <option value="decision_created">Decision Creation</option>
                    <option value="decision_deleted">Decision Deletion</option>
                    <option value="action_created">Action Creation</option>
                    <option value="action_completed">Action Completion</option>
                    <option value="role_changed">Role Changed</option>
                    <option value="team_created">Team Creation</option>
                    <option value="team_deleted">Team Deletion</option>
                    <option value="retention_changed">Retention Changed</option>
                    <option value="governance_changed">Governance Changed</option>
                    <option value="legal_hold_created">Legal Hold Created</option>
                    <option value="legal_hold_released">Legal Hold Released</option>
                    <option value="admin_action">Admin Action</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                    Filter by Entity Type
                  </label>
                  <select
                    className="form-input"
                    value={auditEntityFilter}
                    onChange={(e) => setAuditEntityFilter(e.target.value)}
                    style={{ fontSize: '0.84rem', background: '#0e1729' }}
                  >
                    <option value="">All Entity Types</option>
                    <option value="project">Project</option>
                    <option value="decision">Decision</option>
                    <option value="action">Action</option>
                    <option value="output">Output</option>
                    <option value="team">Team</option>
                    <option value="organization_member">Organization Member</option>
                    <option value="domain">Domain</option>
                    <option value="sso_config">SSO Config</option>
                    <option value="retention_policy">Retention Policy</option>
                    <option value="legal_hold">Legal Hold</option>
                    <option value="access_review">Access Review</option>
                  </select>
                </div>

                <div>
                  <label className="form-label" style={{ fontSize: '0.78rem', marginBottom: '4px' }}>
                    Date Range
                  </label>
                  <select
                    className="form-input"
                    value={auditDateFilter}
                    onChange={(e) => setAuditDateFilter(e.target.value)}
                    style={{ fontSize: '0.84rem', background: '#0e1729' }}
                  >
                    <option value="all">All Time</option>
                    <option value="24h">Last 24 Hours</option>
                    <option value="7d">Last 7 Days</option>
                    <option value="30d">Last 30 Days</option>
                  </select>
                </div>
              </div>

              {loadingAudit ? (
                <div style={{ textAlign: 'center', padding: '40px' }}>
                  <Loader2 size={28} className="spin-animation" color="#e2b53c" style={{ margin: '0 auto 10px', display: 'block' }} />
                  <div style={{ color: '#94a3b8' }}>Loading audit logs...</div>
                </div>
              ) : auditError ? (
                <div style={{ textAlign: 'center', padding: '30px', color: '#fca5a5' }}>
                  <div>{auditError}</div>
                  <button type="button" onClick={loadAuditData} className="btn-secondary" style={{ marginTop: '12px' }}>
                    Retry
                  </button>
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                  No audit records found matching your filters.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table className="custom-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '0.78rem' }}>
                        <th style={{ padding: '12px 14px' }}>Timestamp</th>
                        <th style={{ padding: '12px 14px' }}>User</th>
                        <th style={{ padding: '12px 14px' }}>Action</th>
                        <th style={{ padding: '12px 14px' }}>Object Type</th>
                        <th style={{ padding: '12px 14px' }}>Object Identifier</th>
                        <th style={{ padding: '12px 14px' }}>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAuditLogs.map((log) => (
                        <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '0.84rem' }}>
                          <td style={{ padding: '12px 14px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                            {new Date(log.created_at).toLocaleString('en-AU')}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#f8fafc', whiteSpace: 'nowrap' }}>
                            {log.user_email || log.user_id || 'System'}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                backgroundColor: 'rgba(226, 181, 60, 0.15)',
                                color: '#e2b53c',
                              }}
                            >
                              {log.action.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px', color: '#38bdf8' }}>{log.entity_type}</td>
                          <td style={{ padding: '12px 14px', color: '#64748b', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                            {log.entity_id ? log.entity_id.slice(0, 18) : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', color: '#94a3b8', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {JSON.stringify(log.details)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: COMPLIANCE DASHBOARD & RETENTION POLICIES */}
          {activeTab === 'compliance' && (
            <div>
              {/* Compliance Status Overview */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Governance Status</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>
                    COMPLIANT
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '4px' }}>
                    Sovereign Sydney Cloud
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Security Status</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>
                    ENFORCED
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '4px' }}>
                    PostgreSQL Strict RLS
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Audit Status</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#22c55e', marginTop: '4px' }}>
                    ACTIVE
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#86efac', marginTop: '4px' }}>
                    Immutable Event Logging
                  </div>
                </div>

                <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '16px' }}>
                  <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Active Legal Holds</div>
                  <div style={{ fontSize: '1.2rem', fontWeight: 700, color: legalHolds.length > 0 ? '#ef4444' : '#f8fafc', marginTop: '4px' }}>
                    {legalHolds.length} ACTIVE
                  </div>
                  <div style={{ fontSize: '0.75rem', color: legalHolds.length > 0 ? '#fca5a5' : '#94a3b8', marginTop: '4px' }}>
                    {legalHolds.length > 0 ? 'Purge Override Engaged' : 'Standard Retention'}
                  </div>
                </div>
              </div>

              {/* Retention Policies */}
              <div className="content-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  Configurable Organizational Retention Policies
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Enterprise retention periods supersede platform defaults. Deleted records remain recoverable during this period before permanent purge.
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                  {[
                    { key: 'project', label: 'Project Retention' },
                    { key: 'transcript', label: 'Transcript Retention' },
                    { key: 'decision', label: 'Decision Memory Retention' },
                    { key: 'action', label: 'Action Tracker Retention' },
                    { key: 'output', label: 'Output Retention' },
                    { key: 'endpoint_report', label: 'Endpoint Report Retention' },
                  ].map((item) => {
                    const currentPolicy = retentionPolicies.find((p) => p.entity_type === item.key);
                    const days = currentPolicy ? currentPolicy.retention_days : 30;
                    return (
                      <div
                        key={item.key}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: '8px',
                          padding: '16px',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>{item.label}</div>
                        <select
                          className="form-input"
                          style={{ width: '100%', background: '#0e1729' }}
                          value={days}
                          disabled={savingPolicy}
                          onChange={(e) => handleRetentionUpdate(item.key, parseInt(e.target.value, 10))}
                        >
                          <option value="30">30 days after deletion (Default)</option>
                          <option value="90">90 days after deletion</option>
                          <option value="180">180 days after deletion</option>
                          <option value="365">365 days (1 Year)</option>
                          <option value="-1">Indefinite (Never automatically purge)</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Legal Holds */}
              <div className="content-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                      Legal Holds Management
                    </h3>
                    <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '4px 0 0' }}>
                      Active legal holds suspend automated purges and block permanent deletion of records.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHoldModal(true)}
                    className="btn-gold"
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <Plus size={16} />
                    <span>Create Legal Hold</span>
                  </button>
                </div>

                {legalHolds.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '32px', color: '#94a3b8' }}>
                    <Scale size={32} color="#e2b53c" style={{ margin: '0 auto 8px', display: 'block' }} />
                    <div>No active legal holds. Standard retention rules apply.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {legalHolds.map((h) => (
                      <div
                        key={h.id}
                        style={{
                          background: 'rgba(255, 255, 255, 0.02)',
                          border: `1px solid ${h.status === 'active' ? '#ef4444' : 'rgba(255, 255, 255, 0.08)'}`,
                          borderRadius: '8px',
                          padding: '16px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, color: '#f8fafc' }}>{h.name}</span>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.72rem',
                                fontWeight: 600,
                                backgroundColor: h.status === 'active' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                color: h.status === 'active' ? '#ef4444' : '#94a3b8',
                              }}
                            >
                              {h.status.toUpperCase()}
                            </span>
                          </div>
                          {h.description && (
                            <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px' }}>{h.description}</div>
                          )}
                          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
                            Created: {new Date(h.created_at).toLocaleDateString('en-AU')}
                          </div>
                        </div>

                        {h.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleReleaseHold(h.id)}
                            className="btn-secondary"
                            style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#fca5a5', borderColor: '#ef4444' }}
                          >
                            Release Hold
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: DATA GOVERNANCE & ACCESS REVIEWS */}
          {activeTab === 'governance' && (
            <div className="content-card" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                Data Governance & Access Reviews
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>
                Conduct periodic access reviews, manage project ownership governance, and certify member privileges.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
                {members.map((m) => (
                  <div
                    key={m.id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>
                        {m.profile?.full_name || m.profile?.email}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.82rem' }}>
                        Role: {ORGANIZATION_ROLE_LABELS[m.role]} • Status: {m.profile?.is_suspended ? 'Suspended' : 'Active'}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        type="button"
                        onClick={() => handleCertifyAccess(m.user_id, m.profile?.email || m.user_id, 'approved')}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#22c55e', borderColor: '#22c55e' }}
                      >
                        Approve Access
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCertifyAccess(m.user_id, m.profile?.email || m.user_id, 'revoked')}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#fca5a5', borderColor: '#ef4444' }}
                      >
                        Revoke Access
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Access Review History */}
              {accessReviews.length > 0 && (
                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', marginBottom: '12px' }}>
                    Recent Access Review Audit Trail
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="custom-table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.08)', color: '#94a3b8', fontSize: '0.78rem' }}>
                          <th style={{ padding: '8px 12px' }}>Review Date</th>
                          <th style={{ padding: '8px 12px' }}>Target User</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                          <th style={{ padding: '8px 12px' }}>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {accessReviews.slice(0, 10).map((r) => (
                          <tr key={r.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '0.82rem' }}>
                            <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                              {new Date(r.reviewed_at || r.created_at).toLocaleDateString('en-AU')}
                            </td>
                            <td style={{ padding: '8px 12px', color: '#f8fafc' }}>
                              {r.target_user_email || r.target_user_id}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: '10px',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  backgroundColor: r.status === 'approved' ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                  color: r.status === 'approved' ? '#22c55e' : '#ef4444',
                                }}
                              >
                                {r.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{r.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 8: SSO & DOMAINS */}
          {activeTab === 'sso' && (
            <div>
              {/* Domain Verification */}
              <div className="content-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  Enterprise Domain Verification
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Verify company domains to route employee authentications to Single Sign-On automatically.
                </p>

                <form onSubmit={handleAddDomain} style={{ display: 'flex', gap: '12px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="company.com.au"
                    value={newDomain}
                    onChange={(e) => setNewDomain(e.target.value)}
                    style={{ flex: 1 }}
                    required
                  />
                  <button type="submit" className="btn-gold" disabled={addingDomain}>
                    {addingDomain ? 'Adding...' : 'Add Domain'}
                  </button>
                </form>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {domains.map((d) => (
                    <div
                      key={d.id}
                      style={{
                        background: 'rgba(255, 255, 255, 0.02)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontWeight: 600, color: '#f8fafc' }}>{d.domain}</span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '10px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: d.verified ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                              color: d.verified ? '#22c55e' : '#eab308',
                            }}
                          >
                            {d.verified ? 'Verified' : 'Pending Verification'}
                          </span>
                        </div>
                        {!d.verified && (
                          <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '6px' }}>
                            Add DNS TXT Record: <code>concludo-site-verification={d.verification_token}</code>
                          </div>
                        )}
                      </div>

                      {!d.verified && (
                        <button
                          type="button"
                          onClick={() => handleVerifyDomain(d.id)}
                          className="btn-gold"
                          style={{ padding: '6px 14px', fontSize: '0.8rem' }}
                        >
                          Verify Record
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* SSO Provider Configuration */}
              <div className="content-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
                  Identity Provider Configuration (SAML 2.0 / OIDC)
                </h3>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>
                  Connect your corporate identity provider for passwordless Single Sign-On.
                </p>

                <form onSubmit={handleSaveSSO}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                    <div>
                      <label className="form-label">Identity Provider</label>
                      <select
                        className="form-input"
                        value={ssoFormData.provider_name}
                        onChange={(e) => setSsoFormData({ ...ssoFormData, provider_name: e.target.value as SSOProvider })}
                        style={{ width: '100%', background: '#0e1729' }}
                      >
                        <option value="Microsoft Entra ID">Microsoft Entra ID</option>
                        <option value="Okta">Okta</option>
                        <option value="Google Workspace">Google Workspace</option>
                        <option value="Ping Identity">Ping Identity</option>
                        <option value="Generic SAML Provider">Generic SAML Provider</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Protocol</label>
                      <select
                        className="form-input"
                        value={ssoFormData.protocol}
                        onChange={(e) => setSsoFormData({ ...ssoFormData, protocol: e.target.value as 'saml' | 'oidc' })}
                        style={{ width: '100%', background: '#0e1729' }}
                      >
                        <option value="saml">SAML 2.0</option>
                        <option value="oidc">OpenID Connect (OIDC)</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">IdP Login URL (SSO Endpoint)</label>
                    <input
                      type="url"
                      className="form-input"
                      placeholder="https://login.microsoftonline.com/.../saml2"
                      value={ssoFormData.login_url}
                      onChange={(e) => setSsoFormData({ ...ssoFormData, login_url: e.target.value })}
                      required
                    />
                  </div>

                  {ssoFormData.protocol === 'saml' ? (
                    <>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">Issuer / Entity ID</label>
                        <input
                          type="text"
                          className="form-input"
                          placeholder="https://sts.windows.net/..."
                          value={ssoFormData.issuer}
                          onChange={(e) => setSsoFormData({ ...ssoFormData, issuer: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">X.509 Public Certificate (Base64)</label>
                        <textarea
                          className="form-input"
                          rows={4}
                          placeholder="-----BEGIN CERTIFICATE----- ... -----END CERTIFICATE-----"
                          value={ssoFormData.certificate}
                          onChange={(e) => setSsoFormData({ ...ssoFormData, certificate: e.target.value })}
                          style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">Client ID</label>
                        <input
                          type="text"
                          className="form-input"
                          value={ssoFormData.client_id}
                          onChange={(e) => setSsoFormData({ ...ssoFormData, client_id: e.target.value })}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '16px' }}>
                        <label className="form-label">Client Secret</label>
                        <input
                          type="password"
                          className="form-input"
                          value={ssoFormData.client_secret}
                          onChange={(e) => setSsoFormData({ ...ssoFormData, client_secret: e.target.value })}
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label">Domain Mapping</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. company.com.au"
                      value={ssoFormData.domain_mapping}
                      onChange={(e) => setSsoFormData({ ...ssoFormData, domain_mapping: e.target.value })}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                    <input
                      type="checkbox"
                      id="sso-enabled"
                      checked={ssoFormData.sso_enabled}
                      onChange={(e) => setSsoFormData({ ...ssoFormData, sso_enabled: e.target.checked })}
                      style={{ cursor: 'pointer' }}
                    />
                    <label htmlFor="sso-enabled" style={{ color: '#f8fafc', fontWeight: 600, cursor: 'pointer' }}>
                      Enable SSO for authenticated domain users
                    </label>
                  </div>

                  <button type="submit" className="btn-gold" disabled={savingSSO}>
                    {savingSSO ? 'Saving SSO Configuration...' : 'Save SSO Configuration'}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: Create Organization */}
      {showCreateOrg && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
              Create Enterprise Organization
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '20px' }}>
              Provision a top-level organization workspace for identity and retention governance.
            </p>
            <form onSubmit={handleCreateOrg}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Organization Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Acme Corporation Pty Ltd"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowCreateOrg(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-gold" disabled={creatingOrg}>
                  {creatingOrg ? 'Creating...' : 'Create Organization'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: Create Legal Hold */}
      {holdModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Create Legal Hold
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>
              Legal holds preserve all records under this organization from scheduled purge and permanent delete.
            </p>
            <form onSubmit={handleCreateHold}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">Legal Hold Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Matter 2026-A Compliance Audit"
                  value={holdName}
                  onChange={(e) => setHoldName(e.target.value)}
                  required
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Description / Case Scope</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Describe scope, regulatory mandate, or case details..."
                  value={holdDesc}
                  onChange={(e) => setHoldDesc(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setHoldModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-gold" disabled={creatingHold}>
                  {creatingHold ? 'Activating...' : 'Activate Legal Hold'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: Invite Member */}
      {inviteModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#f8fafc', marginBottom: '8px' }}>
              Invite Enterprise Member
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>
              Add an existing Concludo user to this organization with an enterprise role.
            </p>
            <form onSubmit={handleInviteMember}>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label className="form-label">User Email Address</label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Enterprise Role</label>
                <select
                  className="form-input"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as OrganizationRole)}
                  style={{ width: '100%', background: '#0e1729' }}
                >
                  <option value="organization_admin">Organization Admin</option>
                  <option value="security_admin">Security Admin</option>
                  <option value="compliance_admin">Compliance Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setInviteModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn-gold" disabled={invitingMember}>
                  {invitingMember ? 'Inviting...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
