import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  PlusCircle,
  FolderKanban,
  FileText,
  CheckCircle2,
  BrainCircuit,
  ArrowRight,
  Sparkles,
  Settings,
  Lock,
  RefreshCw,
  AlertCircle,
  Loader2,
  Calendar,
  Clock,
  Briefcase,
  Search,
  BarChart3,
  Lightbulb,
  FileSpreadsheet,
  Share2,
  Users,
  Zap,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS, PlanType } from '../lib/profiles/types';
import { OutputType, OUTPUT_TYPE_LABELS } from '../lib/outputs/types';
import {
  queryBackendPermissions,
  BackendPermissionsResponse,
} from '../lib/permissions/backendCheckClient';
import { FeatureKey } from '../lib/permissions/types';

interface DashboardProject {
  id: string;
  title: string;
  meeting_type: string | null;
  client_or_project: string | null;
  meeting_date: string | null;
  updated_at: string;
}

interface DashboardOutput {
  id: string;
  project_id: string;
  output_type: OutputType;
  content: string | null;
  created_at: string;
  updated_at: string;
  projects?: {
    id: string;
    title: string;
  } | null;
}

export const DashboardPage: React.FC = () => {
  const { supabase, user, profile, loading: authLoading } = useAuth();

  // Loading states
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [loadingOutputs, setLoadingOutputs] = useState<boolean>(true);
  const [loadingPermissions, setLoadingPermissions] = useState<boolean>(true);

  // Data states
  const [recentProjects, setRecentProjects] = useState<DashboardProject[]>([]);
  const [recentOutputs, setRecentOutputs] = useState<DashboardOutput[]>([]);
  const [backendPerms, setBackendPerms] = useState<BackendPermissionsResponse | null>(null);

  // Error states
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [outputsError, setOutputsError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  // Set document title
  useEffect(() => {
    document.title = 'Concludo Workspace';
  }, []);

  // Fetch all dashboard data
  const loadDashboardData = useCallback(async () => {
    if (!supabase || !user) return;

    setLoadingDashboard(true);
    setDashboardError(null);
    setProfileError(null);
    setProjectsError(null);
    setOutputsError(null);
    setPermissionError(null);

    // 1. Profile state
    setLoadingProfile(true);
    try {
      if (!profile && !authLoading) {
        // Double check profile
        const { error: pErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (pErr) {
          setProfileError('Failed to load profile');
        }
      }
    } catch {
      setProfileError('Failed to load profile');
    } finally {
      setLoadingProfile(false);
    }

    // 2. Fetch Recent Projects (limit 5, sorted by updated_at desc, deleted_at is null)
    setLoadingProjects(true);
    try {
      const { data: projData, error: projErr } = await supabase
        .from('projects')
        .select('id, title, meeting_type, client_or_project, meeting_date, updated_at')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (projErr) {
        setProjectsError('Failed to load projects');
      } else {
        setRecentProjects(projData || []);
      }
    } catch {
      setProjectsError('Failed to load projects');
    } finally {
      setLoadingProjects(false);
    }

    // 3. Fetch Recent Outputs (limit 5, sorted by updated_at desc, deleted_at is null)
    setLoadingOutputs(true);
    try {
      const { data: outData, error: outErr } = await supabase
        .from('outputs')
        .select('id, project_id, output_type, content, created_at, updated_at, projects(id, title)')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(5);

      if (outErr) {
        setOutputsError('Failed to load outputs');
      } else {
        setRecentOutputs((outData as any) || []);
      }
    } catch {
      setOutputsError('Failed to load outputs');
    } finally {
      setLoadingOutputs(false);
    }

    // 4. Fetch Authoritative Backend Permissions
    setLoadingPermissions(true);
    try {
      const { data: permData, error: permErr } = await queryBackendPermissions(supabase);
      if (permErr || !permData) {
        setPermissionError('Permission check failed');
      } else {
        setBackendPerms(permData);
      }
    } catch {
      setPermissionError('Permission check failed');
    } finally {
      setLoadingPermissions(false);
    }

    setLoadingDashboard(false);
  }, [supabase, user, profile, authLoading]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Date formatters (en-AU)
  const formatDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return new Intl.DateTimeFormat('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  // Welcome greeting
  const fullName = profile?.full_name?.trim();
  const welcomeGreeting = fullName ? `Welcome back, ${fullName}` : 'Welcome back';

  // Plan badge text
  const currentPlan: PlanType = (profile?.plan as PlanType) || 'free_preview';
  const planBadgeText = PLAN_LABELS[currentPlan] || 'Free Preview';

  // Feature permission evaluation from backend
  const isFeatureAllowed = (key: FeatureKey): boolean => {
    if (!backendPerms) return false;
    return backendPerms.allowedFeatures.includes(key);
  };

  const isActionTrackerAllowed = isFeatureAllowed('action_tracker');
  const isDecisionMemoryAllowed = isFeatureAllowed('decision_memory');

  // Locked features list definitions
  const lockedFeatureDefinitions: {
    key: FeatureKey;
    title: string;
    description: string;
    tierBadge: 'Available on Pro' | 'Available on Team';
    icon: React.ReactNode;
  }[] = [
    {
      key: 'decision_memory',
      title: 'Decision Memory',
      description: 'Audit-ready decision logs, context rationale, and stakeholder recall across all workspace meetings.',
      tierBadge: 'Available on Pro',
      icon: <BrainCircuit size={20} />,
    },
    {
      key: 'action_tracker',
      title: 'Action Tracker',
      description: 'Verifiable accountability matrix mapping owners, agreed deadlines, and execution progress.',
      tierBadge: 'Available on Pro',
      icon: <CheckCircle2 size={20} />,
    },
    {
      key: 'keyword_search',
      title: 'Keyword Search',
      description: 'Deep indexing across all project transcripts, meeting notes, outputs, and structured decisions.',
      tierBadge: 'Available on Pro',
      icon: <Search size={20} />,
    },
    {
      key: 'insight',
      title: 'Insight',
      description: 'Continuous synthesis of recurring meeting patterns, executive sentiment, and strategic topics.',
      tierBadge: 'Available on Pro',
      icon: <Lightbulb size={20} />,
    },
    {
      key: 'stats',
      title: 'Stats',
      description: 'Comprehensive workspace metrics tracking meeting velocity, transcript conversion rate, and output generation.',
      tierBadge: 'Available on Pro',
      icon: <BarChart3 size={20} />,
    },
    {
      key: 'endpoint_report',
      title: 'Endpoint Report',
      description: 'Automated executive end-of-quarter and milestone summaries formatted for C-suite governance.',
      tierBadge: 'Available on Pro',
      icon: <FileSpreadsheet size={20} />,
    },
    {
      key: 'automation_export',
      title: 'Automation Export',
      description: 'Export structured outputs directly to downstream workflows, webhooks, and executive distribution lists.',
      tierBadge: 'Available on Pro',
      icon: <Share2 size={20} />,
    },
    {
      key: 'team_workspace',
      title: 'Team Workspace',
      description: 'Shared organizational workspaces, multi-seat governance, and role-based access for departments.',
      tierBadge: 'Available on Team',
      icon: <Users size={20} />,
    },
  ];

  // Active locked features (only show features that are locked on the current user's backend plan)
  const activeLockedFeatures = lockedFeatureDefinitions.filter(
    (item) => !isFeatureAllowed(item.key)
  );

  // Overall error presence
  const hasAnyError =
    dashboardError || profileError || projectsError || outputsError || permissionError;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', paddingBottom: '60px' }}>
      {/* Top Welcome Section */}
      <div className="page-header" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '8px' }}>
          <div className="page-eyebrow" style={{ marginBottom: 0 }}>
            <Sparkles size={13} color="#f3c958" />
            <span>CONCLUDO WORKSPACE</span>
          </div>

          {/* Real Plan Badge */}
          <div
            className="plan-badge-placeholder"
            title={`Authoritative Plan: ${planBadgeText}`}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(226, 181, 60, 0.12)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              borderRadius: '20px',
              color: '#f3c958',
              fontWeight: 600,
            }}
          >
            <span className="plan-badge-dot" style={{ background: '#f3c958', boxShadow: '0 0 8px #f3c958' }} />
            <Zap size={13} />
            <span>{planBadgeText}</span>
          </div>
        </div>

        <h1 className="page-title" style={{ fontSize: '2.2rem', marginBottom: '8px' }}>
          {welcomeGreeting}
        </h1>
        <p className="page-subtitle" style={{ fontSize: '0.96rem', color: '#94a3b8' }}>
          Concludo Workspace is your central command hub for meeting intelligence, structured records, and verifiable outcomes.
        </p>
      </div>

      {/* Dashboard Error Alert with Retry Button */}
      {hasAnyError && (
        <div
          className="auth-alert-error"
          role="alert"
          style={{
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, color: '#fca5a5' }}>Notice encountered while loading data:</div>
              <div style={{ fontSize: '0.88rem', color: '#fecaca' }}>
                {dashboardError || profileError || projectsError || outputsError || permissionError}
              </div>
            </div>
          </div>
          <button
            onClick={loadDashboardData}
            className="btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} />
            <span>Retry / Refresh Dashboard</span>
          </button>
        </div>
      )}

      {/* Primary Dashboard Action Buttons */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '36px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Link to="/projects/new" className="btn-gold" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <PlusCircle size={17} />
          <span>Create New Project</span>
        </Link>
        <Link to="/projects" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <FolderKanban size={17} />
          <span>Open Projects</span>
        </Link>
        <Link to="/projects/new" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={17} />
          <span>Paste Transcript</span>
        </Link>
        <Link to="/decision-memory" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <BrainCircuit size={17} />
          <span>View Decision Memory</span>
        </Link>
        <Link to="/actions" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={17} />
          <span>View Actions</span>
        </Link>
        <Link to="/settings" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Settings size={17} />
          <span>Open Settings</span>
        </Link>
      </div>

      {/* SECTION 1: QUICK ACTIONS */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="#f3c958" />
          <span>Quick Actions</span>
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {/* Card 1: Create New Project */}
          <Link
            to="/projects/new"
            className="content-card"
            style={{
              padding: '22px',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(226, 181, 60, 0.15)',
                  border: '1px solid rgba(226, 181, 60, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958',
                  marginBottom: '14px',
                }}
              >
                <PlusCircle size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                Create New Project
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                Start a new meeting record
              </p>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Start project</span>
              <ArrowRight size={14} />
            </div>
          </Link>

          {/* Card 2: Paste Transcript */}
          <Link
            to="/projects/new"
            className="content-card"
            style={{
              padding: '22px',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(33, 57, 92, 0.4)',
                  border: '1px solid rgba(226, 181, 60, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958',
                  marginBottom: '14px',
                }}
              >
                <FileText size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                Paste Transcript
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                Create a project and add transcript text
              </p>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Paste now</span>
              <ArrowRight size={14} />
            </div>
          </Link>

          {/* Card 3: Open Projects */}
          <Link
            to="/projects"
            className="content-card"
            style={{
              padding: '22px',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(33, 57, 92, 0.4)',
                  border: '1px solid rgba(226, 181, 60, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958',
                  marginBottom: '14px',
                }}
              >
                <FolderKanban size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                Open Projects
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                View saved meeting records
              </p>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Browse records</span>
              <ArrowRight size={14} />
            </div>
          </Link>

          {/* Card 4: Settings */}
          <Link
            to="/settings"
            className="content-card"
            style={{
              padding: '22px',
              textDecoration: 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
            }}
          >
            <div>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  background: 'rgba(33, 57, 92, 0.4)',
                  border: '1px solid rgba(226, 181, 60, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#f3c958',
                  marginBottom: '14px',
                }}
              >
                <Settings size={22} />
              </div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                Settings
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.86rem', lineHeight: 1.5, margin: 0 }}>
                Manage account and workspace settings
              </p>
            </div>
            <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '6px', color: '#f3c958', fontSize: '0.82rem', fontWeight: 600 }}>
              <span>Configure</span>
              <ArrowRight size={14} />
            </div>
          </Link>
        </div>
      </section>

      {/* TWO-COLUMN GRID: RECENT PROJECTS & RECENT OUTPUTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {/* SECTION 2: RECENT PROJECTS */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={19} color="#f3c958" />
              <span>Recent Projects</span>
            </h2>
            <Link to="/projects" style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 600 }}>
              View all
            </Link>
          </div>

          {loadingProjects ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={24} className="spin-animation" color="#f3c958" />
              <span style={{ fontSize: '0.88rem' }}>Loading recent projects...</span>
            </div>
          ) : recentProjects.length === 0 ? (
            /* Empty State */
            <div style={{ padding: '36px 16px', textAlign: 'center', background: 'rgba(14, 23, 41, 0.4)', borderRadius: '12px', border: '1px dashed rgba(226, 181, 60, 0.2)' }}>
              <FolderKanban size={32} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                No projects yet
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '16px' }}>
                Get started by creating your first meeting project record.
              </p>
              <Link to="/projects/new" className="btn-gold" style={{ fontSize: '0.84rem', padding: '8px 16px' }}>
                <PlusCircle size={15} />
                <span>Create your first project</span>
              </Link>
            </div>
          ) : (
            /* Project List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentProjects.map((proj) => (
                <div
                  key={proj.id}
                  style={{
                    padding: '14px 16px',
                    borderRadius: '10px',
                    background: 'rgba(14, 23, 41, 0.5)',
                    border: '1px solid rgba(255, 255, 255, 0.06)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ minWidth: '200px', flex: 1 }}>
                    <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.94rem', marginBottom: '4px' }}>
                      {proj.title}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#94a3b8' }}>
                      {proj.meeting_type && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Briefcase size={12} color="#f3c958" />
                          <span>{proj.meeting_type}</span>
                        </span>
                      )}
                      {proj.client_or_project && (
                        <span>Client: {proj.client_or_project}</span>
                      )}
                      {proj.meeting_date && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          <span>{formatDate(proj.meeting_date)}</span>
                        </span>
                      )}
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#64748b' }}>
                        <Clock size={12} />
                        <span>Updated {formatDateTime(proj.updated_at)}</span>
                      </span>
                    </div>
                  </div>

                  <Link
                    to={`/projects/${proj.id}`}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>Open</span>
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* SECTION 3: RECENT OUTPUTS */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={19} color="#f3c958" />
              <span>Recent Outputs</span>
            </h2>
          </div>

          {loadingOutputs ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={24} className="spin-animation" color="#f3c958" />
              <span style={{ fontSize: '0.88rem' }}>Loading recent outputs...</span>
            </div>
          ) : recentOutputs.length === 0 ? (
            /* Empty State */
            <div style={{ padding: '36px 16px', textAlign: 'center', background: 'rgba(14, 23, 41, 0.4)', borderRadius: '12px', border: '1px dashed rgba(226, 181, 60, 0.2)' }}>
              <FileText size={32} color="#64748b" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                No outputs yet
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', maxWidth: '340px', margin: '0 auto' }}>
                Saved outputs will appear here after you create them inside a project.
              </p>
            </div>
          ) : (
            /* Outputs List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {recentOutputs.map((out) => {
                const typeLabel = OUTPUT_TYPE_LABELS[out.output_type] || out.output_type;
                const projectTitle = out.projects?.title || 'Linked project';
                const contentPreview = out.content
                  ? out.content.slice(0, 110) + (out.content.length > 110 ? '...' : '')
                  : 'No content recorded';

                return (
                  <div
                    key={out.id}
                    style={{
                      padding: '14px 16px',
                      borderRadius: '10px',
                      background: 'rgba(14, 23, 41, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            background: 'rgba(226, 181, 60, 0.15)',
                            color: '#f3c958',
                            fontSize: '0.74rem',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}
                        >
                          {typeLabel}
                        </span>
                        {out.projects?.title && (
                          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                            in <strong style={{ color: '#cbd5e1' }}>{projectTitle}</strong>
                          </span>
                        )}
                      </div>

                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                        {formatDateTime(out.created_at)}
                      </span>
                    </div>

                    <p style={{ color: '#cbd5e1', fontSize: '0.84rem', margin: 0, lineHeight: 1.4, fontFamily: 'var(--font-mono, monospace)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px' }}>
                      {contentPreview}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2px' }}>
                      <Link
                        to={`/projects/${out.project_id}`}
                        className="btn-secondary"
                        style={{ padding: '4px 12px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Open project</span>
                        <ArrowRight size={12} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* TWO-COLUMN GRID: RECENT ACTIONS & DECISION MEMORY */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '24px', marginBottom: '40px' }}>
        {/* SECTION 4: RECENT ACTIONS */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={19} color="#f3c958" />
              <span>Recent Actions</span>
            </h2>

            {!isActionTrackerAllowed && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(226, 181, 60, 0.12)',
                  border: '1px solid rgba(226, 181, 60, 0.3)',
                  color: '#f3c958',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                }}
              >
                <Lock size={11} />
                <span>Available on Pro</span>
              </span>
            )}
          </div>

          <div
            style={{
              padding: '28px 18px',
              textAlign: 'center',
              background: 'rgba(14, 23, 41, 0.4)',
              borderRadius: '12px',
              border: '1px dashed rgba(226, 181, 60, 0.2)',
            }}
          >
            <CheckCircle2 size={30} color={isActionTrackerAllowed ? '#f3c958' : '#64748b'} style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
              {isActionTrackerAllowed ? 'No actions yet' : 'Available on Pro'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
              Action tracking will appear here after the Action Accountability Tracker is built.
            </p>
          </div>
        </section>

        {/* SECTION 5: DECISION MEMORY */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BrainCircuit size={19} color="#f3c958" />
              <span>Decision Memory</span>
            </h2>

            {!isDecisionMemoryAllowed && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '3px 8px',
                  borderRadius: '6px',
                  background: 'rgba(226, 181, 60, 0.12)',
                  border: '1px solid rgba(226, 181, 60, 0.3)',
                  color: '#f3c958',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                }}
              >
                <Lock size={11} />
                <span>Available on Pro</span>
              </span>
            )}
          </div>

          <div
            style={{
              padding: '28px 18px',
              textAlign: 'center',
              background: 'rgba(14, 23, 41, 0.4)',
              borderRadius: '12px',
              border: '1px dashed rgba(226, 181, 60, 0.2)',
            }}
          >
            <BrainCircuit size={30} color={isDecisionMemoryAllowed ? '#f3c958' : '#64748b'} style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
              {isDecisionMemoryAllowed ? 'No decisions yet' : 'Available on Pro'}
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
              Saved decisions will appear here after Decision Memory is built.
            </p>
          </div>
        </section>
      </div>

      {/* SECTION 6: USAGE */}
      <section className="content-card" style={{ padding: '24px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={19} color="#f3c958" />
            <span>Usage</span>
          </h2>
          <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
            Usage tracking coming soon
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(14, 23, 41, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Transcript conversions used
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-heading)' }}>
              —
            </div>
          </div>

          <div
            style={{
              padding: '16px',
              borderRadius: '10px',
              background: 'rgba(14, 23, 41, 0.5)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>
              Monthly allowance
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', fontFamily: 'var(--font-heading)' }}>
              —
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: LOCKED FEATURES */}
      <section style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lock size={18} color="#f3c958" />
            <span>Locked Features</span>
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Tier availability governed strictly by backend permission checks
          </span>
        </div>

        {activeLockedFeatures.length === 0 ? (
          <div
            className="content-card"
            style={{
              padding: '24px',
              textAlign: 'center',
              background: 'rgba(226, 181, 60, 0.06)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
            }}
          >
            <Sparkles size={28} color="#f3c958" style={{ margin: '0 auto 10px' }} />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
              All Workspace Intelligence Features Unlocked
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: 0 }}>
              Your current authoritative plan tier ({planBadgeText}) includes access to all workspace capabilities.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '16px' }}>
            {activeLockedFeatures.map((feat) => (
              <div
                key={feat.key}
                className="content-card"
                style={{
                  padding: '20px',
                  background: 'rgba(14, 23, 41, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div
                      style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        background: 'rgba(33, 57, 92, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#94a3b8',
                      }}
                    >
                      {feat.icon}
                    </div>

                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        background: feat.tierBadge === 'Available on Team' ? 'rgba(56, 189, 248, 0.12)' : 'rgba(226, 181, 60, 0.12)',
                        border: `1px solid ${feat.tierBadge === 'Available on Team' ? 'rgba(56, 189, 248, 0.3)' : 'rgba(226, 181, 60, 0.3)'}`,
                        color: feat.tierBadge === 'Available on Team' ? '#38bdf8' : '#f3c958',
                        fontSize: '0.74rem',
                        fontWeight: 600,
                      }}
                    >
                      <Lock size={11} />
                      <span>{feat.tierBadge}</span>
                    </span>
                  </div>

                  <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                    {feat.title}
                  </h3>
                  <p style={{ color: '#94a3b8', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                    {feat.description}
                  </p>
                </div>

                <div style={{ paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                    Locked on {planBadgeText}
                  </span>
                  <Link
                    to="/settings"
                    style={{ fontSize: '0.78rem', color: '#f3c958', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    <span>Upgrade required</span>
                    <ArrowRight size={11} />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
