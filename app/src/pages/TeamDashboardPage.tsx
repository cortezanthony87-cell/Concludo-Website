import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  FolderKanban,
  BrainCircuit,
  CheckSquare,
  Activity,
  PlusCircle,
  Settings,
  Shield,
  Loader2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Clock,
  Calendar,
  Building,
  UserCheck,
  Mail,
  Check,
  X,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import {
  Team,
  TeamRole,
  TeamMember,
  TeamActivity,
  TeamInvitation,
  TeamOverviewStats,
} from '../lib/teams/types';
import {
  fetchUserTeams,
  fetchTeamMembers,
  fetchTeamActivities,
  fetchTeamOverviewStats,
  fetchUserInvitations,
  acceptInvitation,
  declineInvitation,
} from '../lib/teams/teamClient';
import { fetchProjects } from '../lib/projects/projectClient';
import { fetchDecisions } from '../lib/decisions/decisionClient';
import { fetchActions } from '../lib/actions/actionClient';
import { Project } from '../lib/projects/types';
import { DecisionRecord } from '../lib/decisions/types';
import { ActionRecord, isActionOverdue } from '../lib/actions/types';

export const TeamDashboardPage: React.FC = () => {
  const { supabase, user } = useAuth();
  const navigate = useNavigate();
  const { hasAccess, loading: permissionsLoading } = usePermissions('team_workspace');

  const [teams, setTeams] = useState<(Team & { currentRole: TeamRole })[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  // User pending invitations
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([]);
  const [respondingInviteId, setRespondingInviteId] = useState<string | null>(null);

  // Selected team data
  const [stats, setStats] = useState<TeamOverviewStats | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<TeamActivity[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [recentDecisions, setRecentDecisions] = useState<DecisionRecord[]>([]);
  const [recentActions, setRecentActions] = useState<ActionRecord[]>([]);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Load user's teams & pending invitations
  const loadTeamsAndInvites = useCallback(async () => {
    if (!supabase || !user) return;
    setLoadingTeams(true);
    setTeamsError(null);

    try {
      const [teamsRes, invitesRes] = await Promise.all([
        fetchUserTeams(supabase),
        fetchUserInvitations(supabase),
      ]);

      if (teamsRes.error) {
        setTeamsError(teamsRes.error.message);
      } else {
        const userTeams = teamsRes.data || [];
        setTeams(userTeams);
        if (userTeams.length > 0 && !selectedTeamId) {
          setSelectedTeamId(userTeams[0].id);
        }
      }

      if (invitesRes.data) {
        setPendingInvitations(invitesRes.data);
      }
    } catch (err: any) {
      setTeamsError(err.message || 'Failed to load teams');
    } finally {
      setLoadingTeams(false);
    }
  }, [supabase, user, selectedTeamId]);

  useEffect(() => {
    loadTeamsAndInvites();
  }, [loadTeamsAndInvites]);

  // Load data for the selected team
  const loadSelectedTeamData = useCallback(async (teamId: string) => {
    if (!supabase) return;
    setLoadingDashboard(true);
    setDashboardError(null);

    try {
      const [
        statsRes,
        membersRes,
        activitiesRes,
        projectsRes,
        decisionsRes,
        actionsRes,
      ] = await Promise.all([
        fetchTeamOverviewStats(supabase, teamId),
        fetchTeamMembers(supabase, teamId),
        fetchTeamActivities(supabase, teamId, 10),
        fetchProjects(supabase, { workspaceScope: 'team', teamId }),
        fetchDecisions(supabase, { teamId }),
        fetchActions(supabase, { teamId }),
      ]);

      if (statsRes.data) setStats(statsRes.data);
      if (membersRes.data) setMembers(membersRes.data);
      if (activitiesRes.data) setActivities(activitiesRes.data);
      if (projectsRes.data) setRecentProjects(projectsRes.data.slice(0, 5));
      if (decisionsRes.data) setRecentDecisions(decisionsRes.data.slice(0, 5));
      if (actionsRes.data) setRecentActions(actionsRes.data.slice(0, 5));
    } catch (err: any) {
      setDashboardError(err.message || 'Failed to load team data');
    } finally {
      setLoadingDashboard(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (selectedTeamId) {
      loadSelectedTeamData(selectedTeamId);
    }
  }, [selectedTeamId, loadSelectedTeamData]);

  const handleAcceptInvite = async (invitationId: string) => {
    if (!supabase) return;
    setRespondingInviteId(invitationId);
    const res = await acceptInvitation(supabase, invitationId);
    setRespondingInviteId(null);
    if (!res.error) {
      await loadTeamsAndInvites();
    }
  };

  const handleDeclineInvite = async (invitationId: string) => {
    if (!supabase) return;
    setRespondingInviteId(invitationId);
    const res = await declineInvitation(supabase, invitationId);
    setRespondingInviteId(null);
    if (!res.error) {
      setPendingInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    }
  };

  const activeTeam = teams.find((t) => t.id === selectedTeamId);

  // Permission gate
  if (!permissionsLoading && !hasAccess) {
    return (
      <div style={{ maxWidth: '640px', margin: '40px auto' }}>
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 32px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.5) 0%, rgba(14, 23, 41, 0.9) 100%)',
              border: '1px solid rgba(226, 181, 60, 0.4)',
              color: '#e2b53c',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 24px rgba(226, 181, 60, 0.25)',
            }}
          >
            <Shield size={36} />
          </div>
          <div
            style={{
              display: 'inline-block',
              padding: '4px 14px',
              borderRadius: '20px',
              background: 'rgba(226, 181, 60, 0.15)',
              border: '1px solid rgba(226, 181, 60, 0.3)',
              color: '#f3c958',
              fontSize: '0.82rem',
              fontWeight: 600,
              marginBottom: '16px',
            }}
          >
            Available on Team
          </div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc', marginBottom: '12px' }}>
            Team Workspace Access Required
          </h2>
          <p
            style={{
              color: '#94a3b8',
              fontSize: '0.95rem',
              lineHeight: 1.6,
              maxWidth: '460px',
              margin: '0 auto 28px auto',
            }}
          >
            Team Workspaces, shared meeting memory, and collaborative action tracking require a Concludo Team subscription.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/dashboard" className="btn-secondary">
              Back to Dashboard
            </Link>
            <Link to="/settings" className="btn-gold">
              View Plans
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div
        className="page-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <div className="page-eyebrow">
            <Sparkles size={13} color="#f3c958" />
            <span>COLLABORATIVE INTELLIGENCE</span>
          </div>
          <h1 className="page-title">Team Workspace</h1>
          <p className="page-subtitle">
            Shared meeting memory, collective decision logs, and team accountability.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {activeTeam && (
            <Link
              to="/team/settings"
              className="btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <Settings size={16} />
              <span>Team Settings</span>
            </Link>
          )}
          <Link
            to="/team/create"
            className="btn-gold"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <PlusCircle size={16} />
            <span>Create Team</span>
          </Link>
        </div>
      </div>

      {/* Pending Invitations Banner */}
      {pendingInvitations.length > 0 && (
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.8) 100%)',
            border: '1px solid rgba(226, 181, 60, 0.4)',
            borderRadius: '16px',
            padding: '20px 24px',
            marginBottom: '24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
            <Mail size={18} color="#f3c958" />
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
              Team Invitations Pending ({pendingInvitations.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {pendingInvitations.map((inv) => (
              <div
                key={inv.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  padding: '12px 16px',
                  borderRadius: '10px',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div>
                  <span style={{ fontWeight: 600, color: '#f8fafc' }}>
                    {inv.teams?.name || 'Workspace'}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.86rem', marginLeft: '8px' }}>
                    Invited as <strong style={{ color: '#cbd5e1' }}>{inv.role}</strong>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => handleAcceptInvite(inv.id)}
                    disabled={respondingInviteId === inv.id}
                    className="btn-gold"
                    style={{ padding: '6px 14px', fontSize: '0.84rem' }}
                  >
                    {respondingInviteId === inv.id ? (
                      <Loader2 size={14} className="spin-animation" />
                    ) : (
                      <Check size={14} />
                    )}
                    <span>Accept</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeclineInvite(inv.id)}
                    disabled={respondingInviteId === inv.id}
                    className="btn-secondary"
                    style={{ padding: '6px 14px', fontSize: '0.84rem' }}
                  >
                    <X size={14} />
                    <span>Decline</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading state for teams */}
      {loadingTeams && (
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <Loader2
            size={36}
            color="#f3c958"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}
          />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Loading Team
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
            Fetching team workspace records...
          </p>
        </div>
      )}

      {/* Error state */}
      {!loadingTeams && teamsError && (
        <div className="content-card" style={{ textAlign: 'center', padding: '56px 24px' }}>
          <AlertCircle size={40} color="#ef4444" style={{ margin: '0 auto 16px auto' }} />
          <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', marginBottom: '8px' }}>
            Failed to load team
          </h3>
          <p style={{ color: '#94a3b8', fontSize: '0.92rem', maxWidth: '440px', margin: '0 auto 24px auto' }}>
            {teamsError}
          </p>
          <button onClick={loadTeamsAndInvites} className="btn-secondary">
            <RefreshCw size={16} />
            <span>Retry</span>
          </button>
        </div>
      )}

      {/* Empty state: No teams found */}
      {!loadingTeams && !teamsError && teams.length === 0 && (
        <div className="content-card" style={{ textAlign: 'center', padding: '72px 32px' }}>
          <div
            style={{
              width: '72px',
              height: '72px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(33, 57, 92, 0.4) 0%, rgba(14, 23, 41, 0.9) 100%)',
              border: '1px solid rgba(226, 181, 60, 0.35)',
              color: '#f3c958',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '20px',
              boxShadow: '0 0 24px rgba(226, 181, 60, 0.2)',
            }}
          >
            <Users size={36} />
          </div>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '8px', fontWeight: 600 }}>
            No Team Workspaces Yet
          </h2>
          <p
            style={{
              color: '#94a3b8',
              maxWidth: '460px',
              margin: '0 auto 28px auto',
              fontSize: '0.95rem',
              lineHeight: 1.6,
            }}
          >
            Create your first Team Workspace to invite colleagues, share meeting transcripts, make collective decisions, and track group actions.
          </p>
          <Link to="/team/create" className="btn-gold">
            <PlusCircle size={18} />
            <span>Create Team Workspace</span>
          </Link>
        </div>
      )}

      {/* Main Team Dashboard */}
      {!loadingTeams && !teamsError && teams.length > 0 && activeTeam && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Team Selector bar (if multiple teams) */}
          {teams.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '10px 16px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Building size={16} color="#f3c958" />
              <span style={{ fontSize: '0.88rem', color: '#cbd5e1', fontWeight: 500 }}>
                Active Workspace:
              </span>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '220px', padding: '6px 12px' }}
                value={selectedTeamId || ''}
                onChange={(e) => setSelectedTeamId(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.currentRole})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Team Overview Card */}
          <div className="content-card" style={{ padding: '24px 28px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: '20px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '14px',
                    background: 'rgba(226, 181, 60, 0.15)',
                    border: '1px solid rgba(226, 181, 60, 0.3)',
                    color: '#f3c958',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Users size={24} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', margin: 0 }}>
                    {activeTeam.name}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                    <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                      Your role:{' '}
                      <strong style={{ color: '#f3c958', textTransform: 'capitalize' }}>
                        {activeTeam.currentRole}
                      </strong>
                    </span>
                    <span style={{ color: '#475569' }}>•</span>
                    <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>
                      {members.length} {members.length === 1 ? 'member' : 'members'}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <Link
                  to="/projects/new"
                  className="btn-gold"
                  style={{ padding: '8px 16px', fontSize: '0.88rem' }}
                >
                  <PlusCircle size={15} />
                  <span>New Team Project</span>
                </Link>
                <Link
                  to="/team/settings"
                  className="btn-secondary"
                  style={{ padding: '8px 16px', fontSize: '0.88rem' }}
                >
                  <Settings size={15} />
                  <span>Manage</span>
                </Link>
              </div>
            </div>

            {/* Metrics Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                gap: '14px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Projects
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {stats?.totalProjects ?? 0}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Decisions
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f3c958', marginTop: '4px' }}>
                  {stats?.totalDecisions ?? 0}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Open Actions
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                  {stats?.openActions ?? 0}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Overdue
                </div>
                <div
                  style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: (stats?.overdueActions ?? 0) > 0 ? '#ef4444' : '#94a3b8',
                    marginTop: '4px',
                  }}
                >
                  {stats?.overdueActions ?? 0}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Completion
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#34d399', marginTop: '4px' }}>
                  {stats?.completionRate ?? 0}%
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout: Content & Sidebar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
              gap: '24px',
            }}
          >
            {/* Left Column: Recent Shared Projects & Decisions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Recent Projects */}
              <div className="content-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FolderKanban size={18} color="#f3c958" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Shared Projects
                    </h3>
                  </div>
                  <Link
                    to="/projects"
                    style={{ fontSize: '0.84rem', color: '#f3c958', textDecoration: 'none' }}
                  >
                    View All
                  </Link>
                </div>

                {recentProjects.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                    No shared projects yet in this team workspace.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentProjects.map((p) => (
                      <Link
                        key={p.id}
                        to={`/projects/${p.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '12px 14px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: 'inherit',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                            {p.title}
                          </div>
                          <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                            {p.meeting_type || 'Meeting'} • {p.client_name || 'Internal'}
                          </div>
                        </div>
                        <ArrowRight size={14} color="#94a3b8" />
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Shared Decisions */}
              <div className="content-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <BrainCircuit size={18} color="#f3c958" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Shared Decision Memory
                    </h3>
                  </div>
                  <Link
                    to="/decision-memory"
                    style={{ fontSize: '0.84rem', color: '#f3c958', textDecoration: 'none' }}
                  >
                    View All
                  </Link>
                </div>

                {recentDecisions.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                    No decisions recorded for this team yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentDecisions.map((d) => (
                      <Link
                        key={d.id}
                        to={`/decision-memory/${d.id}`}
                        style={{
                          display: 'block',
                          padding: '12px 14px',
                          background: 'rgba(255, 255, 255, 0.02)',
                          borderRadius: '8px',
                          textDecoration: 'none',
                          color: 'inherit',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                          {d.decision_title}
                        </div>
                        <p
                          style={{
                            color: '#94a3b8',
                            fontSize: '0.82rem',
                            margin: '4px 0 0 0',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {d.decision_summary}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Actions */}
              <div className="content-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckSquare size={18} color="#f3c958" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Shared Action Tracker
                    </h3>
                  </div>
                  <Link
                    to="/actions"
                    style={{ fontSize: '0.84rem', color: '#f3c958', textDecoration: 'none' }}
                  >
                    View All
                  </Link>
                </div>

                {recentActions.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                    No actions tracked for this team yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentActions.map((a) => {
                      const overdue = isActionOverdue(a);
                      return (
                        <Link
                          key={a.id}
                          to={`/actions/${a.id}`}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 14px',
                            background: 'rgba(255, 255, 255, 0.02)',
                            borderRadius: '8px',
                            textDecoration: 'none',
                            color: 'inherit',
                            border: '1px solid rgba(255, 255, 255, 0.05)',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.92rem' }}>
                              {a.action_title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>
                              Owner: {a.assigned_user_name || a.owner_name || 'Unassigned'}
                            </div>
                          </div>
                          {overdue ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(239, 68, 68, 0.2)',
                                color: '#fca5a5',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                              }}
                            >
                              Overdue
                            </span>
                          ) : (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(255, 255, 255, 0.06)',
                                color: '#cbd5e1',
                                fontSize: '0.75rem',
                                textTransform: 'capitalize',
                              }}
                            >
                              {a.status.replace('_', ' ')}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Activity Feed & Team Members */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Activity Feed */}
              <div className="content-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Activity size={18} color="#f3c958" />
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                    Recent Team Activity
                  </h3>
                </div>

                {activities.length === 0 ? (
                  <p style={{ color: '#94a3b8', fontSize: '0.9rem', fontStyle: 'italic', margin: 0 }}>
                    No activity recorded yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activities.map((act) => (
                      <div
                        key={act.id}
                        style={{
                          paddingBottom: '12px',
                          borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.88rem' }}>
                            {act.title}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {new Date(act.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        {act.description && (
                          <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>
                            {act.description}
                          </div>
                        )}
                        <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                          By {act.actor_name || 'Team Member'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Team Members List */}
              <div className="content-card">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Users size={18} color="#f3c958" />
                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                      Members ({members.length})
                    </h3>
                  </div>
                  <Link
                    to="/team/settings"
                    style={{ fontSize: '0.84rem', color: '#f3c958', textDecoration: 'none' }}
                  >
                    Manage
                  </Link>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {members.map((m) => (
                    <div
                      key={m.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: 'rgba(255, 255, 255, 0.08)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 600,
                            fontSize: '0.82rem',
                            color: '#cbd5e1',
                          }}
                        >
                          {(m.profiles?.full_name || m.profiles?.email || 'M').charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#f8fafc', fontSize: '0.88rem' }}>
                            {m.profiles?.full_name || m.profiles?.email || 'Team Member'}
                          </div>
                          {m.profiles?.full_name && m.profiles?.email && (
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              {m.profiles.email}
                            </div>
                          )}
                        </div>
                      </div>

                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          textTransform: 'capitalize',
                          background:
                            m.role === 'owner'
                              ? 'rgba(226, 181, 60, 0.2)'
                              : m.role === 'admin'
                              ? 'rgba(56, 189, 248, 0.15)'
                              : 'rgba(255, 255, 255, 0.05)',
                          color:
                            m.role === 'owner'
                              ? '#f3c958'
                              : m.role === 'admin'
                              ? '#38bdf8'
                              : '#cbd5e1',
                        }}
                      >
                        {m.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
