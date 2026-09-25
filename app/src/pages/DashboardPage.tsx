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
  FileBarChart,
  Award,
  TrendingUp,
  ShieldAlert,
  Layers,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { PLAN_LABELS, PlanType } from '../lib/profiles/types';
import { OutputType, OUTPUT_TYPE_LABELS } from '../lib/outputs/types';
import {
  queryBackendPermissions,
  BackendPermissionsResponse,
} from '../lib/permissions/backendCheckClient';
import { FeatureKey } from '../lib/permissions/types';
import { fetchDecisions } from '../lib/decisions/decisionClient';
import { DecisionRecord } from '../lib/decisions/types';
import { fetchActions } from '../lib/actions/actionClient';
import { ActionRecord, isActionOverdue, STATUS_LABELS } from '../lib/actions/types';
import { fetchUserInsights, fetchUserStats } from '../lib/intelligence/intelligenceClient';
import { InsightData, StatsData } from '../lib/intelligence/types';
import { fetchEndpointReports } from '../lib/reports/reportClient';
import { EndpointReport } from '../lib/reports/types';
import { fetchUserTeams } from '../lib/teams/teamClient';
import { Team, TeamRole } from '../lib/teams/types';
import { getPredictiveAnalysis } from '../lib/predictive/predictiveService';
import { PredictiveAnalysisResult } from '../lib/predictive/types';

interface DashboardProject {
  id: string;
  title: string;
  meeting_type: string | null;
  client_name?: string | null;
  project_name?: string | null;
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

  // Data states
  const [recentProjects, setRecentProjects] = useState<DashboardProject[]>([]);
  const [recentOutputs, setRecentOutputs] = useState<DashboardOutput[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<DecisionRecord[]>([]);
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [insights, setInsights] = useState<InsightData | null>(null);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentReports, setRecentReports] = useState<EndpointReport[]>([]);
  const [userTeams, setUserTeams] = useState<(Team & { currentRole: TeamRole })[]>([]);
  const [backendPerms, setBackendPerms] = useState<BackendPermissionsResponse | null>(null);

  // Loading states
  const [loadingDashboard, setLoadingDashboard] = useState<boolean>(true);
  const [loadingProfile, setLoadingProfile] = useState<boolean>(true);
  const [loadingProjects, setLoadingProjects] = useState<boolean>(true);
  const [loadingOutputs, setLoadingOutputs] = useState<boolean>(true);
  const [loadingDecisions, setLoadingDecisions] = useState<boolean>(false);
  const [loadingActions, setLoadingActions] = useState<boolean>(false);
  const [loadingInsights, setLoadingInsights] = useState<boolean>(false);
  const [loadingStats, setLoadingStats] = useState<boolean>(false);
  const [loadingReports, setLoadingReports] = useState<boolean>(false);
  const [loadingPermissions, setLoadingPermissions] = useState<boolean>(true);
  const [predictiveData, setPredictiveData] = useState<PredictiveAnalysisResult | null>(null);
  const [loadingPredictive, setLoadingPredictive] = useState<boolean>(false);

  // Error states
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [outputsError, setOutputsError] = useState<string | null>(null);
  const [decisionsError, setDecisionsError] = useState<string | null>(null);
  const [actionsError, setActionsError] = useState<string | null>(null);
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
    setDecisionsError(null);
    setActionsError(null);
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
        .select('id, title, meeting_type, client_name, project_name, client_or_project, meeting_date, updated_at')
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
    let permDataResult: BackendPermissionsResponse | null = null;
    try {
      const { data: permData, error: permErr } = await queryBackendPermissions(supabase);
      if (permErr || !permData) {
        setPermissionError('Permission check failed');
      } else {
        setBackendPerms(permData);
        permDataResult = permData;
      }
    } catch {
      setPermissionError('Permission check failed');
    } finally {
      setLoadingPermissions(false);
    }

    // 5. Fetch Recent Decisions (limit 5) if allowed by plan
    if (permDataResult?.allowedFeatures.includes('decision_memory')) {
      setLoadingDecisions(true);
      try {
        const decRes = await fetchDecisions(supabase, { limit: 5 });
        if (decRes.error) {
          setDecisionsError('Failed to load decisions');
        } else {
          setRecentDecisions(decRes.data || []);
        }
      } catch {
        setDecisionsError('Failed to load decisions');
      } finally {
        setLoadingDecisions(false);
      }
    }

    // 6. Fetch Recent Open Actions (limit 5) if allowed by plan
    if (permDataResult?.allowedFeatures.includes('action_tracker')) {
      setLoadingActions(true);
      try {
        const actRes = await fetchActions(supabase);
        if (actRes.error) {
          setActionsError('Failed to load actions');
        } else {
          const openActions = (actRes.data || [])
            .filter((a) => a.status !== 'completed')
            .slice(0, 5);
          setRecentActions(openActions);
        }
      } catch {
        setActionsError('Failed to load actions');
      } finally {
        setLoadingActions(false);
      }
    }

    // 7. Fetch Insights if allowed
    if (permDataResult?.allowedFeatures.includes('insight')) {
      setLoadingInsights(true);
      try {
        const insData = await fetchUserInsights({ supabase });
        setInsights(insData);
      } catch (err) {
        console.warn('Could not load dashboard insights:', err);
      } finally {
        setLoadingInsights(false);
      }
    }

    // 8. Fetch Stats if allowed
    if (permDataResult?.allowedFeatures.includes('stats')) {
      setLoadingStats(true);
      try {
        const statsData = await fetchUserStats('all', { supabase });
        setStats(statsData);
      } catch (err) {
        console.warn('Could not load dashboard stats:', err);
      } finally {
        setLoadingStats(false);
      }
    }

    // 9. Fetch Recent Endpoint Reports (limit 3) if allowed
    if (permDataResult?.allowedFeatures.includes('endpoint_report')) {
      setLoadingReports(true);
      try {
        const reports = await fetchEndpointReports({ supabase });
        setRecentReports(reports.slice(0, 3));
      } catch (err) {
        console.warn('Could not load dashboard reports:', err);
      } finally {
        setLoadingReports(false);
      }
    }

    // 10. Fetch User Teams if team_workspace is allowed
    if (permDataResult?.allowedFeatures.includes('team_workspace')) {
      try {
        const teamsRes = await fetchUserTeams(supabase);
        if (teamsRes.data) {
          setUserTeams(teamsRes.data);
        }
      } catch (err) {
        console.warn('Could not load user teams:', err);
      }
    }

    // 11. Fetch Predictive Intelligence Snapshot if allowed
    if (permDataResult?.allowedFeatures.includes('predictive_intelligence')) {
      setLoadingPredictive(true);
      try {
        const pred = await getPredictiveAnalysis({ scope: 'individual', userId: user.id }, supabase);
        setPredictiveData(pred);
      } catch (err) {
        console.warn('Could not load predictive intelligence:', err);
      } finally {
        setLoadingPredictive(false);
      }
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
  const isInsightAllowed = isFeatureAllowed('insight');
  const isStatsAllowed = isFeatureAllowed('stats');
  const isEndpointReportAllowed = isFeatureAllowed('endpoint_report');
  const isPredictiveAllowed = isFeatureAllowed('predictive_intelligence');

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
    {
      key: 'predictive_intelligence',
      title: 'Predictive Intelligence',
      description: 'Continuous machine-assisted risk predictions, strategic recommendations, and 30-to-365 day operational trajectory forecasts.',
      tierBadge: 'Available on Team',
      icon: <TrendingUp size={20} />,
    },
  ];

  // Active locked features (only show features that are locked on the current user's backend plan)
  const activeLockedFeatures = lockedFeatureDefinitions.filter(
    (item) => !isFeatureAllowed(item.key)
  );

  // Overall error presence
  const hasAnyError =
    dashboardError ||
    profileError ||
    projectsError ||
    outputsError ||
    decisionsError ||
    actionsError ||
    permissionError;

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

        <h1 className="page-title" style={{ marginBottom: '8px' }}>
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

      {/* SECTION: TEAM WORKSPACE SNAPSHOT (When on Team / Admin Tier) */}
      {isFeatureAllowed('team_workspace') && (
        <section
          className="content-card"
          style={{
            padding: '22px 24px',
            marginBottom: '32px',
            background: 'linear-gradient(135deg, #16263f 0%, #1a2f4d 100%)',
            border: '1px solid rgba(56, 189, 248, 0.3)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '8px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38bdf8',
                }}
              >
                <Users size={20} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Team Workspaces</span>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      color: '#38bdf8',
                    }}
                  >
                    TEAM PLAN ACTIVE
                  </span>
                </h2>
                <p style={{ color: '#94a3b8', fontSize: '0.86rem', margin: '2px 0 0 0' }}>
                  {userTeams.length > 0
                    ? `You are an active member of ${userTeams.length} collaborative workspace${userTeams.length > 1 ? 's' : ''}.`
                    : 'Set up your shared workspace to collaborate on meeting archives, decisions, and action plans.'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              {userTeams.length > 0 ? (
                <>
                  <Link
                    to="/team"
                    className="btn btn-primary"
                    style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    <span>Open Team Workspace</span>
                    <ArrowRight size={14} />
                  </Link>
                  <Link
                    to="/team/settings"
                    className="btn btn-secondary"
                    style={{ padding: '8px 14px', fontSize: '0.85rem' }}
                  >
                    <span>Manage Team</span>
                  </Link>
                </>
              ) : (
                <Link
                  to="/team/create"
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <PlusCircle size={15} />
                  <span>Create Team Workspace</span>
                </Link>
              )}
            </div>
          </div>
        </section>
      )}

      {/* TWO-COLUMN GRID: RECENT PROJECTS & RECENT OUTPUTS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* SECTION 2: RECENT PROJECTS */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FolderKanban size={19} color="#f3c958" />
              <span>Transcript Archive / Recent Projects</span>
            </h2>
            <Link to="/projects" style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 600 }}>
              View all
            </Link>
          </div>

          {loadingProjects ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={24} className="spin-animation" color="#f3c958" />
              <span style={{ fontSize: '0.88rem' }}>Loading projects</span>
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
                      {(proj.client_name || proj.client_or_project) && (
                        <span>Client: {proj.client_name || proj.client_or_project}</span>
                      )}
                      {proj.project_name && (
                        <span>Project: {proj.project_name}</span>
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
              <span style={{ fontSize: '0.88rem' }}>Loading outputs</span>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', marginBottom: '32px' }}>
        {/* SECTION 4: RECENT ACTIONS */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={19} color="#f3c958" />
              <span>Action Tracker / Open Actions</span>
            </h2>

            {isActionTrackerAllowed ? (
              <Link to="/actions" style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 600 }}>
                View all
              </Link>
            ) : (
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

          {!isActionTrackerAllowed ? (
            <div
              style={{
                padding: '28px 18px',
                textAlign: 'center',
                background: 'rgba(14, 23, 41, 0.4)',
                borderRadius: '12px',
                border: '1px dashed rgba(226, 181, 60, 0.2)',
              }}
            >
              <CheckCircle2 size={30} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                Available on Pro
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
                Action Tracker is available on Pro plans. Track owners, deadlines, and execution progress.
              </p>
            </div>
          ) : loadingActions ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={24} className="spin-animation" color="#f3c958" />
              <span style={{ fontSize: '0.88rem' }}>Loading actions</span>
            </div>
          ) : actionsError ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertCircle size={24} color="#f87171" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.88rem', color: '#fca5a5', marginBottom: '10px' }}>Failed to load actions</div>
              <button onClick={loadDashboardData} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          ) : recentActions.length === 0 ? (
            <div
              style={{
                padding: '28px 18px',
                textAlign: 'center',
                background: 'rgba(14, 23, 41, 0.4)',
                borderRadius: '12px',
                border: '1px dashed rgba(226, 181, 60, 0.2)',
              }}
            >
              <CheckCircle2 size={30} color="#f3c958" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                No actions tracked yet
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
                Actions saved from meeting outputs will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentActions.map((act) => {
                const overdue = act.status === 'overdue' || (act.status !== 'completed' && isActionOverdue(act));
                const statusLabel = overdue ? 'Overdue' : (STATUS_LABELS[act.status] || act.status);
                const projectTitle = act.projects?.title || 'Linked project';

                return (
                  <div
                    key={act.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(14, 23, 41, 0.5)',
                      border: overdue ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                        {act.action_title}
                      </span>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          background: overdue ? 'rgba(239, 68, 68, 0.2)' : 'rgba(226, 181, 60, 0.15)',
                          color: overdue ? '#f87171' : '#f3c958',
                          border: overdue ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(226, 181, 60, 0.3)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        {overdue && <AlertCircle size={10} />}
                        <span>{statusLabel}</span>
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#94a3b8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {act.owner_name && <span>Owner: <strong style={{ color: '#cbd5e1' }}>{act.owner_name}</strong></span>}
                        {act.due_date && <span>Due: <strong style={{ color: overdue ? '#fca5a5' : '#cbd5e1' }}>{formatDate(act.due_date)}</strong></span>}
                        {act.projects?.title && <span>in <strong style={{ color: '#cbd5e1' }}>{projectTitle}</strong></span>}
                      </div>

                      <Link
                        to={`/actions/${act.id}`}
                        className="btn-secondary"
                        style={{ padding: '3px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Open</span>
                        <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* SECTION 5: DECISION MEMORY */}
        <section className="content-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <BrainCircuit size={19} color="#f3c958" />
              <span>Decision Memory / Latest Decisions</span>
            </h2>

            {isDecisionMemoryAllowed ? (
              <Link to="/decision-memory" style={{ fontSize: '0.82rem', color: '#f3c958', fontWeight: 600 }}>
                View all
              </Link>
            ) : (
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

          {!isDecisionMemoryAllowed ? (
            <div
              style={{
                padding: '28px 18px',
                textAlign: 'center',
                background: 'rgba(14, 23, 41, 0.4)',
                borderRadius: '12px',
                border: '1px dashed rgba(226, 181, 60, 0.2)',
              }}
            >
              <BrainCircuit size={30} color="#64748b" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                Available on Pro
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
                Decision Memory is available on Pro plans. Search decisions made, rationale, and owners across meetings.
              </p>
            </div>
          ) : loadingDecisions ? (
            <div style={{ padding: '36px 0', textAlign: 'center', color: '#94a3b8', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
              <Loader2 size={24} className="spin-animation" color="#f3c958" />
              <span style={{ fontSize: '0.88rem' }}>Loading decisions</span>
            </div>
          ) : decisionsError ? (
            <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              <AlertCircle size={24} color="#f87171" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: '0.88rem', color: '#fca5a5', marginBottom: '10px' }}>Failed to load decisions</div>
              <button onClick={loadDashboardData} className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
                <RefreshCw size={12} />
                <span>Retry</span>
              </button>
            </div>
          ) : recentDecisions.length === 0 ? (
            <div
              style={{
                padding: '28px 18px',
                textAlign: 'center',
                background: 'rgba(14, 23, 41, 0.4)',
                borderRadius: '12px',
                border: '1px dashed rgba(226, 181, 60, 0.2)',
              }}
            >
              <BrainCircuit size={30} color="#f3c958" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
                No decisions saved yet
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: 0, lineHeight: 1.5 }}>
                Saved decisions from Decision Logs will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentDecisions.map((dec) => {
                const projectTitle = dec.projects?.title || 'Linked project';
                const summaryText = dec.decision_summary || 'No summary recorded';

                return (
                  <div
                    key={dec.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '10px',
                      background: 'rgba(14, 23, 41, 0.5)',
                      border: '1px solid rgba(255, 255, 255, 0.06)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                        {dec.decision_title}
                      </span>
                      {dec.decision_date && (
                        <span style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {formatDate(dec.decision_date)}
                        </span>
                      )}
                    </div>

                    <p style={{ color: '#cbd5e1', fontSize: '0.82rem', margin: 0, lineHeight: 1.4 }}>
                      {summaryText.length > 120 ? summaryText.slice(0, 120) + '...' : summaryText}
                    </p>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        {dec.decision_owner && <span>Owner: <strong style={{ color: '#cbd5e1' }}>{dec.decision_owner}</strong></span>}
                        {dec.projects?.title && <span>in <strong style={{ color: '#cbd5e1' }}>{projectTitle}</strong></span>}
                      </div>

                      <Link
                        to={`/decision-memory/${dec.id}`}
                        className="btn-secondary"
                        style={{ padding: '3px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <span>Open</span>
                        <ArrowRight size={11} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* SECTION 6: CONVERSATION INTELLIGENCE SNAPSHOT */}
      <section className="content-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Lightbulb size={19} color="#e2b53c" />
            <span>Conversation Intelligence Snapshot</span>
          </h2>
          {isInsightAllowed ? (
            <Link to="/insight" style={{ color: '#e2b53c', fontSize: '0.84rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Explore Insights</span>
              <ArrowRight size={14} />
            </Link>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              Available on Pro
            </span>
          )}
        </div>

        {!isInsightAllowed ? (
          <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(226, 181, 60, 0.04)', border: '1px dashed rgba(226, 181, 60, 0.25)', textAlign: 'center' }}>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
              Upgrade to Pro to unlock automated synthesis of recurring themes, risks, and meeting opportunities.
            </p>
            <Link to="/insight" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
              <Lock size={14} color="#e2b53c" />
              <span>Learn about Conversation Intelligence</span>
            </Link>
          </div>
        ) : loadingInsights ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
            <Loader2 size={18} className="spin-animation" color="#e2b53c" />
            <span>Loading intelligence snapshot...</span>
          </div>
        ) : insights ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
            {/* Health Score */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                <Award size={14} color="#e2b53c" />
                <span>Meeting Health Score</span>
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: insights.projectIntelligenceSummary.meetingHealthScore >= 75 ? '#4ade80' : '#f59e0b' }}>
                {insights.projectIntelligenceSummary.meetingHealthScore}%
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                Execution velocity & action reliability
              </div>
            </div>

            {/* Key Theme */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                <Layers size={14} color="#e2b53c" />
                <span>Top Key Theme</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {insights.keyThemes[0]?.name || 'Baseline Operations'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                {insights.keyThemes[0]?.relevance ? `${insights.keyThemes[0].relevance}% relevance` : 'Recurring organizational focus'}
              </div>
            </div>

            {/* Top Opportunity / Risk */}
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '6px' }}>
                <TrendingUp size={14} color="#4ade80" />
                <span>Top Opportunity</span>
              </div>
              <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {insights.topOpportunities[0]?.title || 'Standardised Automation'}
              </div>
              <div style={{ fontSize: '0.78rem', color: '#4ade80', marginTop: '4px' }}>
                {insights.topOpportunities[0]?.impact ? `${insights.topOpportunities[0].impact.toUpperCase()} impact` : 'High value'}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '12px 0' }}>
            Create projects with meeting transcripts to generate conversation intelligence.
          </div>
        )}
      </section>

      {/* SECTION 7: WORKSPACE ANALYTICS & STATS SNAPSHOT */}
      <section className="content-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart3 size={19} color="#e2b53c" />
            <span>Workspace Analytics Snapshot</span>
          </h2>
          {isStatsAllowed ? (
            <Link to="/stats" style={{ color: '#e2b53c', fontSize: '0.84rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View Full Analytics</span>
              <ArrowRight size={14} />
            </Link>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              Available on Pro
            </span>
          )}
        </div>

        {!isStatsAllowed ? (
          <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(226, 181, 60, 0.04)', border: '1px dashed rgba(226, 181, 60, 0.25)', textAlign: 'center' }}>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
              Upgrade to Pro to track longitudinal trends, meeting volumes, and action completion rates.
            </p>
            <Link to="/stats" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
              <Lock size={14} color="#e2b53c" />
              <span>Learn about Workspace Analytics</span>
            </Link>
          </div>
        ) : loadingStats ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
            <Loader2 size={18} className="spin-animation" color="#e2b53c" />
            <span>Loading workspace metrics...</span>
          </div>
        ) : stats ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Total Projects</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>{stats.totalProjects}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>{stats.totalTranscripts} with transcript</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Decisions Recorded</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#e2b53c' }}>{stats.totalDecisions}</div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Audit-ready memory</div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Actions Tracked</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>{stats.totalActions}</div>
              <div style={{ fontSize: '0.75rem', color: stats.overdueActions > 0 ? '#f87171' : '#94a3b8', marginTop: '2px' }}>
                {stats.overdueActions > 0 ? `${stats.overdueActions} overdue` : `${stats.completedActions} completed`}
              </div>
            </div>

            <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px' }}>Action Completion</div>
              <div style={{ fontSize: '1.6rem', fontWeight: 700, color: stats.actionCompletionRate >= 70 ? '#4ade80' : '#f59e0b' }}>
                {stats.actionCompletionRate}%
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '2px' }}>Organizational throughput</div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '12px 0' }}>
            No workspace activity recorded yet.
          </div>
        )}
      </section>

      {/* SECTION 8: RECENT ENDPOINT REPORTS */}
      <section className="content-card" style={{ padding: '24px', marginBottom: '40px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileBarChart size={19} color="#e2b53c" />
            <span>Executive Endpoint Reports</span>
          </h2>
          {isEndpointReportAllowed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link to="/endpoint-report" style={{ color: '#e2b53c', fontSize: '0.84rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>All Reports</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              Available on Pro
            </span>
          )}
        </div>

        {!isEndpointReportAllowed ? (
          <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(226, 181, 60, 0.04)', border: '1px dashed rgba(226, 181, 60, 0.25)', textAlign: 'center' }}>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
              Generate comprehensive executive briefings synthesizing meeting decisions, action throughput, risks, and performance ratings.
            </p>
            <Link to="/endpoint-report" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
              <Lock size={14} color="#e2b53c" />
              <span>Learn about Endpoint Reports</span>
            </Link>
          </div>
        ) : loadingReports ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
            <Loader2 size={18} className="spin-animation" color="#e2b53c" />
            <span>Loading recent reports...</span>
          </div>
        ) : recentReports.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {recentReports.map((report) => (
              <div
                key={report.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderRadius: '8px',
                  background: 'rgba(14, 23, 41, 0.5)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>{report.title}</div>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '0.78rem', color: '#94a3b8', marginTop: '3px' }}>
                    <span style={{ color: '#e2b53c', fontWeight: 600 }}>{report.report_period}</span>
                    <span>Generated {formatDate(report.generated_at || report.created_at)}</span>
                  </div>
                </div>

                <Link
                  to={`/endpoint-report`}
                  className="btn-secondary"
                  style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <span>View Report</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: '8px' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.88rem' }}>No executive endpoint reports generated yet.</span>
            <Link to="/endpoint-report" className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.84rem', textDecoration: 'none' }}>
              + Generate Report
            </Link>
          </div>
        )}
      </section>

      {/* SECTION 9: PREDICTIVE INTELLIGENCE & STRATEGIC HEALTH SNAPSHOT */}
      <section className="content-card" style={{ padding: '24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
          <h2 style={{ fontSize: '1.18rem', fontWeight: 600, color: '#f8fafc', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={19} color="#e2b53c" />
            <span>Predictive Intelligence & Organizational Health</span>
          </h2>
          {isPredictiveAllowed ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Link to="/predictive-intelligence" style={{ color: '#e2b53c', fontSize: '0.84rem', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Open Intelligence Hub</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            <span style={{ fontSize: '0.75rem', background: 'rgba(226, 181, 60, 0.15)', color: '#e2b53c', padding: '2px 8px', borderRadius: '12px', fontWeight: 600 }}>
              Available on Enterprise & Team
            </span>
          )}
        </div>

        {!isPredictiveAllowed ? (
          <div style={{ padding: '20px', borderRadius: '10px', background: 'rgba(226, 181, 60, 0.04)', border: '1px dashed rgba(226, 181, 60, 0.25)', textAlign: 'center' }}>
            <p style={{ color: '#cbd5e1', fontSize: '0.9rem', margin: '0 0 12px 0' }}>
              Unlock machine-assisted risk prediction, 30-to-365 day completion forecasts, and strategic leadership recommendations.
            </p>
            <Link to="/predictive-intelligence" className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
              <Lock size={14} color="#e2b53c" />
              <span>Learn about Predictive Intelligence</span>
            </Link>
          </div>
        ) : loadingPredictive ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px', color: '#94a3b8', fontSize: '0.9rem' }}>
            <Loader2 size={18} className="spin-animation" color="#e2b53c" />
            <span>Calculating organizational health score and predictive trajectories...</span>
          </div>
        ) : predictiveData ? (
          <div>
            {/* Top row: Health score + Top Risk + Top Opportunity */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', marginBottom: '20px' }}>
              {/* Organizational Health Score */}
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    <ShieldAlert size={14} color="#e2b53c" />
                    <span>Health Score</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: predictiveData.healthScore.overallScore >= 75 ? 'rgba(34, 197, 94, 0.15)' : 'rgba(234, 179, 8, 0.15)',
                      color: predictiveData.healthScore.overallScore >= 75 ? '#4ade80' : '#facc15',
                    }}
                  >
                    {predictiveData.healthScore.category.replace('_', ' ')}
                  </span>
                </div>
                <div style={{ fontSize: '2rem', fontWeight: 700, color: predictiveData.healthScore.overallScore >= 75 ? '#4ade80' : '#facc15' }}>
                  {predictiveData.healthScore.overallScore}<span style={{ fontSize: '1rem', color: '#94a3b8' }}>/100</span>
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px' }}>
                  Execution: {predictiveData.healthScore.categoryScores.execution}% • Delivery: {predictiveData.healthScore.categoryScores.delivery}%
                </div>
              </div>

              {/* Emerging Risk Indicator */}
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    <AlertCircle size={14} color="#f87171" />
                    <span>Top Predicted Risk</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171' }}>
                    {predictiveData.riskPredictions[0]?.riskLevel || 'Low'}
                  </span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {predictiveData.riskPredictions[0]?.title || 'No critical risks detected'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '4px', lineHeight: 1.4 }}>
                  {predictiveData.riskPredictions[0]?.explanation || 'All operational workstreams are tracking within delivery windows.'}
                </div>
              </div>

              {/* Opportunity Indicator */}
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(14, 23, 41, 0.5)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                    <Sparkles size={14} color="#38bdf8" />
                    <span>Top Opportunity</span>
                  </div>
                  <span style={{ fontSize: '0.72rem', fontWeight: 600, textTransform: 'uppercase', padding: '2px 8px', borderRadius: '6px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}>
                    High Impact
                  </span>
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {predictiveData.opportunitySignals[0]?.title || 'Cross-Workstream Scaling'}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '4px', lineHeight: 1.4 }}>
                  {predictiveData.opportunitySignals[0]?.potentialGain || 'Documented rationale drives faster team execution.'}
                </div>
              </div>
            </div>

            {/* Strategic Recommendations Snapshot */}
            {predictiveData.strategicRecommendations.length > 0 && (
              <div style={{ padding: '16px', borderRadius: '10px', background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#e2b53c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Lightbulb size={15} />
                  <span>Strategic Leadership Recommendation</span>
                </div>
                <div style={{ fontSize: '0.94rem', fontWeight: 600, color: '#f8fafc', marginBottom: '4px' }}>
                  {predictiveData.strategicRecommendations[0].title}
                </div>
                <p style={{ color: '#94a3b8', fontSize: '0.84rem', margin: '0 0 10px 0', lineHeight: 1.5 }}>
                  {predictiveData.strategicRecommendations[0].summary}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <span style={{ fontSize: '0.76rem', color: '#64748b' }}>
                    Confidence: <strong>{predictiveData.strategicRecommendations[0].confidenceIndicator.replace(/_/g, ' ')}</strong>
                  </span>
                  <Link to="/predictive-intelligence" style={{ color: '#e2b53c', fontSize: '0.82rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span>View all recommendations</span>
                    <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#94a3b8', fontSize: '0.9rem', padding: '12px 0' }}>
            No predictive data available. Add projects and decisions to generate predictive trajectories.
          </div>
        )}
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
