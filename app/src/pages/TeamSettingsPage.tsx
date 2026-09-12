import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Users,
  Settings,
  Shield,
  ArrowLeft,
  Mail,
  UserPlus,
  Trash2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Check,
  Building,
  Calendar,
  Zap,
  UserX,
  UserCheck,
  ArrowRightLeft,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import {
  Team,
  TeamRole,
  TeamMember,
  TeamInvitation,
} from '../lib/teams/types';
import {
  fetchUserTeams,
  fetchTeamById,
  fetchTeamMembers,
  fetchTeamInvitations,
  updateTeam,
  inviteMember,
  removeMember,
  updateMemberRole,
  transferTeamOwnership,
  softDeleteTeam,
  declineInvitation,
} from '../lib/teams/teamClient';
import { PLAN_LABELS } from '../lib/profiles/types';

export const TeamSettingsPage: React.FC = () => {
  const { supabase, user, profile } = useAuth();
  const navigate = useNavigate();
  const { hasAccess, loading: permissionsLoading } = usePermissions('team_administration');

  const [teams, setTeams] = useState<(Team & { currentRole: TeamRole })[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [team, setTeam] = useState<(Team & { currentRole: TeamRole; memberCount: number }) | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Rename team state
  const [newName, setNewName] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameSuccess, setRenameSuccess] = useState(false);

  // Invite member state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  // Transfer ownership modal state
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);

  // Delete team modal state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const loadInitialData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setError(null);

    try {
      const teamsRes = await fetchUserTeams(supabase);
      if (teamsRes.error) {
        setError(teamsRes.error.message);
      } else {
        const userTeams = teamsRes.data || [];
        setTeams(userTeams);
        if (userTeams.length > 0) {
          const currentId = selectedTeamId || userTeams[0].id;
          setSelectedTeamId(currentId);
          await loadTeamDetails(currentId);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team settings');
    } finally {
      setLoading(false);
    }
  }, [supabase, user, selectedTeamId]);

  const loadTeamDetails = async (teamId: string) => {
    if (!supabase) return;
    try {
      const [teamRes, membersRes, invitesRes] = await Promise.all([
        fetchTeamById(supabase, teamId),
        fetchTeamMembers(supabase, teamId),
        fetchTeamInvitations(supabase, teamId),
      ]);

      if (teamRes.data) {
        setTeam(teamRes.data);
        setNewName(teamRes.data.name);
      }
      if (membersRes.data) setMembers(membersRes.data);
      if (invitesRes.data) setInvitations(invitesRes.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load details');
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleSelectTeam = async (id: string) => {
    setSelectedTeamId(id);
    setLoading(true);
    await loadTeamDetails(id);
    setLoading(false);
  };

  const handleRenameTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedTeamId) return;
    setRenaming(true);
    setRenameSuccess(false);

    const res = await updateTeam(supabase, selectedTeamId, { name: newName });
    setRenaming(false);
    if (!res.error && res.data) {
      setRenameSuccess(true);
      setTeam((prev) => (prev ? { ...prev, name: res.data!.name } : null));
      setTeams((prev) =>
        prev.map((t) => (t.id === selectedTeamId ? { ...t, name: res.data!.name } : t))
      );
      setTimeout(() => setRenameSuccess(false), 3000);
    } else {
      setError(res.error?.message || 'Failed to rename team');
    }
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase || !selectedTeamId) return;
    setInviting(true);
    setInviteError(null);
    setInviteSuccess(false);

    const res = await inviteMember(supabase, {
      team_id: selectedTeamId,
      email: inviteEmail,
      role: inviteRole,
    });

    setInviting(false);
    if (res.error) {
      setInviteError(res.error.message);
    } else if (res.data) {
      setInviteSuccess(true);
      setInvitations((prev) => [res.data!, ...prev]);
      setInviteEmail('');
      setTimeout(() => setInviteSuccess(false), 3000);
    }
  };

  const handleRoleChange = async (memberUserId: string, newRole: TeamRole) => {
    if (!supabase || !selectedTeamId) return;
    const res = await updateMemberRole(supabase, selectedTeamId, memberUserId, newRole);
    if (!res.error) {
      setMembers((prev) =>
        prev.map((m) => (m.user_id === memberUserId ? { ...m, role: newRole } : m))
      );
    } else {
      setError(res.error.message);
    }
  };

  const handleRemoveMember = async (memberUserId: string) => {
    if (!supabase || !selectedTeamId) return;
    const res = await removeMember(supabase, selectedTeamId, memberUserId);
    if (!res.error) {
      setMembers((prev) => prev.filter((m) => m.user_id !== memberUserId));
    } else {
      setError(res.error.message);
    }
  };

  const handleRevokeInvitation = async (invitationId: string) => {
    if (!supabase) return;
    const res = await declineInvitation(supabase, invitationId);
    if (!res.error) {
      setInvitations((prev) => prev.filter((i) => i.id !== invitationId));
    }
  };

  const handleTransferOwnership = async () => {
    if (!supabase || !selectedTeamId || !transferTargetId) return;
    setTransferring(true);
    setTransferError(null);

    const res = await transferTeamOwnership(supabase, selectedTeamId, transferTargetId);
    setTransferring(false);
    if (res.error) {
      setTransferError(res.error.message);
    } else {
      setTransferTargetId(null);
      await loadTeamDetails(selectedTeamId);
    }
  };

  const handleDeleteTeam = async () => {
    if (!supabase || !selectedTeamId) return;
    setDeleting(true);
    setDeleteError(null);

    const res = await softDeleteTeam(supabase, selectedTeamId);
    setDeleting(false);
    if (res.error) {
      setDeleteError(res.error.message);
    } else {
      setDeleteConfirmOpen(false);
      navigate('/team');
    }
  };

  const isOwner = team?.currentRole === 'owner';
  const isAdmin = team?.currentRole === 'admin' || isOwner;

  // Gate if user lacks permission
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
            Team Administration Access Required
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
            Managing team members, workspace roles, and team administration requires a Concludo Team plan.
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <Link to="/team" className="btn-secondary">
              Back to Team
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
    <div style={{ maxWidth: '880px' }}>
      <div style={{ marginBottom: '22px' }}>
        <Link
          to="/team"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            color: '#94a3b8',
            fontSize: '0.88rem',
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={16} />
          <span>Back to Team Dashboard</span>
        </Link>
      </div>

      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>WORKSPACE CONFIGURATION</span>
        </div>
        <h1 className="page-title">Team Settings</h1>
        <p className="page-subtitle">
          Manage team members, roles, permissions, and workspace parameters.
        </p>
      </div>

      {error && (
        <div
          style={{
            background: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '12px',
            padding: '14px 18px',
            marginBottom: '22px',
            color: '#fca5a5',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <AlertCircle size={18} color="#ef4444" />
          <span style={{ fontSize: '0.92rem' }}>{error}</span>
        </div>
      )}

      {loading && (
        <div className="content-card" style={{ textAlign: 'center', padding: '64px 24px' }}>
          <Loader2
            size={36}
            color="#f3c958"
            style={{ animation: 'spin 1s linear infinite', margin: '0 auto 16px auto' }}
          />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Loading Team Settings
          </h3>
        </div>
      )}

      {!loading && team && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
          {/* Workspace Switcher if multiple teams */}
          {teams.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                padding: '12px 18px',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
              }}
            >
              <Building size={16} color="#f3c958" />
              <span style={{ fontSize: '0.88rem', color: '#cbd5e1' }}>Select Team:</span>
              <select
                className="form-select"
                style={{ width: 'auto', minWidth: '220px' }}
                value={selectedTeamId || ''}
                onChange={(e) => handleSelectTeam(e.target.value)}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Section 1: Team Overview & Metadata */}
          <div className="content-card" style={{ padding: '24px 28px' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', marginBottom: '18px' }}>
              Workspace Overview
            </h3>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px',
                marginBottom: '24px',
              }}
            >
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Member Count
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc', marginTop: '4px' }}>
                  {members.length}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Your Role
                </div>
                <div
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 700,
                    color: '#f3c958',
                    marginTop: '4px',
                    textTransform: 'capitalize',
                  }}
                >
                  {team.currentRole}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Subscription Plan
                </div>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: '#38bdf8', marginTop: '4px' }}>
                  {PLAN_LABELS[profile?.plan || 'team']}
                </div>
              </div>
              <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '14px', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', textTransform: 'uppercase' }}>
                  Created Date
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 600, color: '#cbd5e1', marginTop: '6px' }}>
                  {new Date(team.created_at).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
            </div>

            {/* Rename form (Admins/Owners only) */}
            {isAdmin && (
              <form onSubmit={handleRenameTeam} style={{ maxWidth: '480px' }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="rename-team">
                    Team Name
                  </label>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <input
                      id="rename-team"
                      type="text"
                      className="form-input"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      disabled={renaming}
                    />
                    <button
                      type="submit"
                      className="btn-gold"
                      disabled={renaming || !newName.trim() || newName.trim() === team.name}
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      {renaming ? <Loader2 size={16} className="spin-animation" /> : 'Rename'}
                    </button>
                  </div>
                </div>
                {renameSuccess && (
                  <div style={{ color: '#34d399', fontSize: '0.85rem', marginTop: '4px' }}>
                    Team renamed successfully.
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Section 2: Invite Members (Admins/Owners only) */}
          {isAdmin && (
            <div className="content-card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <UserPlus size={18} color="#f3c958" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Invite Members
                </h3>
              </div>

              {inviteError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    color: '#fca5a5',
                    fontSize: '0.88rem',
                  }}
                >
                  {inviteError}
                </div>
              )}

              {inviteSuccess && (
                <div
                  style={{
                    background: 'rgba(52, 211, 153, 0.15)',
                    border: '1px solid rgba(52, 211, 153, 0.4)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    color: '#6ee7b7',
                    fontSize: '0.88rem',
                  }}
                >
                  Invitation sent successfully.
                </div>
              )}

              <form onSubmit={handleInviteMember} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <input
                  type="email"
                  className="form-input"
                  placeholder="colleague@example.com"
                  style={{ flex: '1 1 280px' }}
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  disabled={inviting}
                  required
                />
                <select
                  className="form-select"
                  style={{ width: '130px' }}
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  disabled={inviting}
                >
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="btn-gold"
                  disabled={inviting || !inviteEmail.trim()}
                >
                  {inviting ? (
                    <Loader2 size={16} className="spin-animation" />
                  ) : (
                    <span>Send Invite</span>
                  )}
                </button>
              </form>
            </div>
          )}

          {/* Section 3: Pending Invitations */}
          {invitations.length > 0 && (
            <div className="content-card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <Mail size={18} color="#f3c958" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Pending Invitations ({invitations.length})
                </h3>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {invitations.map((inv) => (
                  <div
                    key={inv.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>
                        {inv.email}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                        Invited as <span style={{ textTransform: 'capitalize' }}>{inv.role}</span> • Expires in 7 days
                      </div>
                    </div>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => handleRevokeInvitation(inv.id)}
                        className="btn-secondary"
                        style={{ padding: '6px 12px', fontSize: '0.8rem', color: '#f87171' }}
                      >
                        Revoke
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: Team Member Directory */}
          <div className="content-card" style={{ padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <Users size={18} color="#f3c958" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Member Directory ({members.length})
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {members.map((m) => {
                const isCurrentMemberOwner = m.role === 'owner';
                const canModify = isAdmin && !isCurrentMemberOwner && m.user_id !== user?.id;

                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.02)',
                      padding: '14px 18px',
                      borderRadius: '10px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      flexWrap: 'wrap',
                      gap: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '50%',
                          background: 'rgba(255, 255, 255, 0.08)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          color: '#cbd5e1',
                        }}
                      >
                        {(m.profiles?.full_name || m.profiles?.email || 'M').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.95rem' }}>
                          {m.profiles?.full_name || m.profiles?.email || 'Team Member'}
                          {m.user_id === user?.id && (
                            <span style={{ fontSize: '0.78rem', color: '#94a3b8', marginLeft: '6px' }}>
                              (You)
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {m.profiles?.email} • Joined {new Date(m.created_at).toLocaleDateString('en-AU')}
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {canModify ? (
                        <select
                          className="form-select"
                          style={{ width: 'auto', padding: '6px 10px', fontSize: '0.84rem' }}
                          value={m.role}
                          onChange={(e) => handleRoleChange(m.user_id, e.target.value as TeamRole)}
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                          <option value="viewer">Viewer</option>
                        </select>
                      ) : (
                        <span
                          style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '0.78rem',
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
                      )}

                      {canModify && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(m.user_id)}
                          className="btn-secondary"
                          style={{ padding: '6px 10px', color: '#f87171' }}
                          title="Remove member"
                        >
                          <UserX size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section 5: Transfer Ownership (Owner Only) */}
          {isOwner && (
            <div className="content-card" style={{ padding: '24px 28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <ArrowRightLeft size={18} color="#f3c958" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                  Transfer Workspace Ownership
                </h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '16px' }}>
                Transfer primary workspace ownership to another active team member. You will become an Admin.
              </p>

              {transferError && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    borderRadius: '8px',
                    padding: '10px 14px',
                    marginBottom: '16px',
                    color: '#fca5a5',
                    fontSize: '0.88rem',
                  }}
                >
                  {transferError}
                </div>
              )}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                <select
                  className="form-select"
                  style={{ flex: '1 1 260px' }}
                  value={transferTargetId || ''}
                  onChange={(e) => setTransferTargetId(e.target.value || null)}
                >
                  <option value="">Select a member to transfer ownership to...</option>
                  {members
                    .filter((m) => m.user_id !== user?.id)
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profiles?.full_name || m.profiles?.email} ({m.profiles?.email})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={!transferTargetId || transferring}
                  onClick={handleTransferOwnership}
                  style={{ color: '#f3c958' }}
                >
                  {transferring ? (
                    <Loader2 size={16} className="spin-animation" />
                  ) : (
                    <span>Transfer Ownership</span>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Section 6: Delete Team (Owner Only) */}
          {isOwner && (
            <div
              className="content-card"
              style={{
                padding: '24px 28px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                background: 'rgba(239, 68, 68, 0.03)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <Trash2 size={18} color="#ef4444" />
                <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#f87171', margin: 0 }}>
                  Delete Team Workspace
                </h3>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '18px' }}>
                Permanently delete this team workspace. All team links will be removed and team-owned records will become inaccessible. Soft-deleted records remain recoverable for 30 days under the retention framework.
              </p>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                }}
              >
                Delete Team Workspace
              </button>
            </div>
          )}
        </div>
      )}

      {/* Delete Team Confirmation Modal */}
      {deleteConfirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 11, 20, 0.85)',
            backdropFilter: 'blur(8px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            className="content-card"
            style={{
              maxWidth: '480px',
              width: '100%',
              padding: '32px',
              borderRadius: '16px',
              background: '#16263F',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Trash2 size={22} color="#ef4444" />
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                Delete Team?
              </h3>
            </div>

            <p style={{ color: '#cbd5e1', fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '8px' }}>
              This action cannot be undone.
            </p>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.5, marginBottom: '24px' }}>
              All team links will be removed. Team-owned records become inaccessible.
            </p>

            {deleteError && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.35)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                  color: '#fca5a5',
                  fontSize: '0.85rem',
                }}
              >
                {deleteError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => {
                  setDeleteConfirmOpen(false);
                  setDeleteError(null);
                }}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteTeam}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  background: '#ef4444',
                  border: 'none',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                {deleting ? (
                  <>
                    <Loader2 size={16} className="spin-animation" />
                    <span>Deleting Team...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    <span>Delete Team</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
