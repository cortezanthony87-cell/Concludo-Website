import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { User } from '@supabase/supabase-js';
import { Team, TeamRole, TeamMember, TeamInvitation } from '../../../lib/teams/types';
import '../../../styles/workspace-pages-bright.css';

export interface TeamSettingsBrightViewProps {
  hasAccess: boolean;
  permissionsLoading: boolean;
  teams: (Team & { currentRole: TeamRole })[];
  selectedTeamId: string | null;
  onSelectTeam: (id: string) => void;
  team: (Team & { currentRole: TeamRole; memberCount: number }) | null;
  members: TeamMember[];
  invitations: TeamInvitation[];
  loading: boolean;
  error: string | null;
  newName: string;
  setNewName: (name: string) => void;
  renaming: boolean;
  renameSuccess: boolean;
  handleRenameSubmit: (e: React.FormEvent) => void;
  inviteEmail: string;
  setInviteEmail: (email: string) => void;
  inviteRole: 'admin' | 'member' | 'viewer';
  setInviteRole: (role: 'admin' | 'member' | 'viewer') => void;
  inviting: boolean;
  inviteError: string | null;
  inviteSuccess: boolean;
  handleInviteSubmit: (e: React.FormEvent) => void;
  transferTargetId: string | null;
  setTransferTargetId: (id: string | null) => void;
  transferring: boolean;
  transferError: string | null;
  handleTransferOwnership: () => void;
  confirmTransferOpen: boolean;
  setConfirmTransferOpen: (open: boolean) => void;
  deleteConfirmOpen: boolean;
  setDeleteConfirmOpen: (open: boolean) => void;
  deleting: boolean;
  deleteError: string | null;
  handleDeleteTeam: () => void;
  user: User | null;
  onUpdateRole: (memberId: string, newRole: 'admin' | 'member' | 'viewer') => void;
  onRemoveMember: (memberId: string) => void;
  onResendInvite: (inviteId: string) => void;
  onRevokeInvite: (inviteId: string) => void;
  formatDate: (dateStr: string) => string;
}

export const TeamSettingsBrightView: React.FC<TeamSettingsBrightViewProps> = ({
  hasAccess,
  permissionsLoading,
  teams,
  selectedTeamId,
  onSelectTeam,
  team,
  members,
  invitations,
  loading,
  error,
  newName,
  setNewName,
  renaming,
  renameSuccess,
  handleRenameSubmit,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviting,
  inviteError,
  inviteSuccess,
  handleInviteSubmit,
  transferTargetId,
  setTransferTargetId,
  transferring,
  transferError,
  handleTransferOwnership,
  confirmTransferOpen,
  setConfirmTransferOpen,
  deleteConfirmOpen,
  setDeleteConfirmOpen,
  deleting,
  deleteError,
  handleDeleteTeam,
  user,
  onUpdateRole,
  onRemoveMember,
  onResendInvite,
  onRevokeInvite,
  formatDate,
}) => {
  if (permissionsLoading) {
    return (
      <div className="ws-shell">
        <div className="ws-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="ws-sub">Checking permissions...</div>
        </div>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="ws-shell">
        <div className="ws-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="ws-eyebrow" style={{ justifyContent: 'center' }}>
            <i />
            <span>WORKSPACE CONFIGURATION</span>
          </div>
          <h2>Team Administration</h2>
          <p className="ws-note" style={{ maxWidth: '460px', margin: '8px auto 20px auto' }}>
            Team Administration is an exclusive feature of the Team Workspace tier.
          </p>
          <Link to="/account" className="ws-btn">
            View subscription tiers
          </Link>
        </div>
      </div>
    );
  }

    const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const isOwner = team?.currentRole === 'owner';
  const targetMember = members.find((m) => m.user_id === transferTargetId);

  return (
    <div className="ws-shell">
      {/* Back link */}
      <Link to="/settings" className="ws-back">
        &larr; Back to Workspace settings
      </Link>

      {/* Header */}
      <div className="ws-top">
        <div>
          <div className="ws-eyebrow">
            <i />
            <span>WORKSPACE CONFIGURATION</span>
          </div>
          <h1>Team settings</h1>
          <p>Manage team members, roles, permissions and workspace parameters.</p>
        </div>
        {teams.length > 1 && (
          <div className="ws-seg" style={{ margin: 0, padding: '6px 10px' }}>
            <b>Select team:</b>
            <select
              className="ws-in"
              style={{ margin: 0, padding: '5px 10px', width: 'auto' }}
              value={selectedTeamId || ''}
              onChange={(e) => onSelectTeam(e.target.value)}
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Global Error Banner */}
      {error && (
        <div className="ws-ban ws-red">
          <div>
            <b>Team configuration error</b>
            <div className="ws-note">{error}</div>
          </div>
        </div>
      )}

      {/* Card 1: Team details */}
      <div className="ws-card">
        <h2>Team details</h2>
        <div className="ws-sub">
          {members.length} members &middot; Your role:{' '}
          <span className="ws-pill">{team?.currentRole || 'member'}</span>
        </div>
        <form onSubmit={handleRenameSubmit} style={{ maxWidth: '480px' }}>
          <label className="ws-label">
            Team name
            <input
              className="ws-in"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              required
              disabled={!isOwner}
            />
          </label>
          {isOwner && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
              <button type="submit" disabled={renaming} className="ws-btn">
                {renaming ? 'Saving...' : 'Save team name'}
              </button>
              {renameSuccess && <span className="ws-pill ws-ok">&#10003; Saved</span>}
            </div>
          )}
        </form>
      </div>

      {/* Card 2: Members */}
      <div className="ws-card">
        <div className="ws-row" style={{ paddingTop: 0 }}>
          <h2>Members</h2>
          <span className="ws-note">Roles: owner, admin, member, viewer</span>
        </div>
        <table className="ws-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Role</th>
              <th>Joined</th>
              <th style={{ width: '150px' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const isCurrentUser = m.user_id === user?.id;
              return (
                <tr key={m.id}>
                  <td>
                    <b>{m.profiles?.full_name || 'Team member'}</b>
                    <br />
                    <span className="ws-note">{m.profiles?.email || m.user_id}</span>
                  </td>
                  <td>
                    {isOwner && !isCurrentUser && m.role !== 'owner' ? (
                      <select
                        className="ws-in"
                        style={{ margin: 0, padding: '4px 8px', width: 'auto' }}
                        value={m.role}
                        onChange={(e) =>
                          onUpdateRole(m.id, e.target.value as 'admin' | 'member' | 'viewer')
                        }
                      >
                        <option value="admin">admin</option>
                        <option value="member">member</option>
                        <option value="viewer">viewer</option>
                      </select>
                    ) : (
                      <span className="ws-pill">{m.role}</span>
                    )}
                  </td>
                  <td>{formatDate(m.created_at)}</td>
                  <td>
                    {isCurrentUser ? (
                      <span className="ws-note">You</span>
                    ) : isOwner ? (
                      <button
                        type="button"
                        onClick={() => setMemberToRemove(m)}
                        className="ws-bd"
                      >
                        Remove
                      </button>
                    ) : (
                      <span className="ws-note">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="ws-note" style={{ marginTop: '8px' }}>
          Only owners change roles. Removing a member asks for confirmation.
        </div>
      </div>

      {/* Grid: Invite a member & Pending invitations */}
      <div className="ws-grid2">
        <div className="ws-card">
          <h2>Invite a member</h2>
          <div className="ws-sub">Send an email invitation with a role.</div>
          <form onSubmit={handleInviteSubmit}>
            <label className="ws-label">
              Email
              <input
                type="email"
                className="ws-in"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@example.com"
                required
              />
            </label>
            <label className="ws-label">
              Role
              <select
                className="ws-in"
                value={inviteRole}
                onChange={(e) =>
                  setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')
                }
              >
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
            </label>
            {inviteError && (
              <div className="ws-note" style={{ color: 'var(--ws-red)', marginTop: '8px' }}>
                {inviteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
              <button type="submit" disabled={inviting} className="ws-btn">
                {inviting ? 'Sending...' : 'Send invite'}
              </button>
              {inviteSuccess && <span className="ws-pill ws-ok">&#10003; Sent</span>}
            </div>
          </form>
        </div>

        <div className="ws-card">
          <h2>Pending invitations ({invitations.length})</h2>
          <div className="ws-sub">Revoke or resend an invitation.</div>
          {invitations.length === 0 ? (
            <div className="ws-note" style={{ marginTop: '12px' }}>
              No pending invitations.
            </div>
          ) : (
            invitations.map((inv) => (
              <div key={inv.id} className="ws-row">
                <div>
                  <b>{inv.email}</b>
                  <div className="ws-note">
                    {inv.role} &middot; Sent {formatDate(inv.created_at)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => onResendInvite(inv.id)}
                    className="ws-btn2"
                  >
                    Resend
                  </button>
                  <button
                    type="button"
                    onClick={() => onRevokeInvite(inv.id)}
                    className="ws-bd"
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Card 5: Transfer ownership (Owner only) */}
      {isOwner && (
        <div className="ws-card">
          <h2>Transfer ownership</h2>
          <div className="ws-sub">Hand the team to another member. You become an admin.</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              className="ws-in"
              style={{ margin: 0, flex: 1, minWidth: '220px' }}
              value={transferTargetId || ''}
              onChange={(e) => setTransferTargetId(e.target.value)}
            >
              <option value="">Select a member to transfer ownership to...</option>
              {members
                .filter((m) => m.user_id !== user?.id)
                .map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.profiles?.full_name || m.profiles?.email || m.user_id} ({m.role})
                  </option>
                ))}
            </select>
            <button
              type="button"
              disabled={!transferTargetId || transferring}
              onClick={() => setConfirmTransferOpen(true)}
              className="ws-btn3"
            >
              Transfer ownership
            </button>
          </div>
          {transferError && (
            <div className="ws-note" style={{ color: 'var(--ws-red)', marginTop: '8px' }}>
              {transferError}
            </div>
          )}
        </div>
      )}

      {/* Card 6: Delete team (Owner only) */}
      {isOwner && (
        <div className="ws-card ws-card-danger">
          <h2 style={{ color: 'var(--ws-red)' }}>Delete team</h2>
          <div className="ws-sub">
            Owner only. The team is soft deleted and recoverable for 30 days.
          </div>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            className="ws-bd"
          >
            Delete team
          </button>
        </div>
      )}

      {/* Transfer Ownership Modal */}
      {confirmTransferOpen && (
        <div className="ws-modal-backdrop">
          <div className="ws-mb" role="dialog" aria-modal="true">
            <h2>Transfer team ownership?</h2>
            <p>
              You are transferring ownership of &ldquo;{team?.name}&rdquo; to{' '}
              <b>{targetMember?.profiles?.full_name || targetMember?.profiles?.email || 'this member'}</b>.
              You will become an admin.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={transferring}
                onClick={() => setConfirmTransferOpen(false)}
                className="ws-btn2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={transferring}
                onClick={handleTransferOwnership}
                className="ws-btn3"
              >
                {transferring ? 'Transferring...' : 'Confirm transfer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Team Modal */}
      {deleteConfirmOpen && (
        <div className="ws-modal-backdrop">
          <div className="ws-mb" role="dialog" aria-modal="true">
            <h2>Delete this team?</h2>
            <p>
              &ldquo;{team?.name || 'This team'}&rdquo; will be soft deleted. Members lose access now. You can restore it for 30 days.
            </p>
            {deleteError && (
              <div className="ws-note" style={{ color: 'var(--ws-red)', marginBottom: '12px' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmOpen(false)}
                className="ws-btn2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeleteTeam}
                className="ws-bdf"
              >
                {deleting ? 'Deleting...' : 'Delete team'}
              </button>
            </div>
          </div>
        </div>
      )}
          {/* Member Removal Confirmation Modal */}
      {memberToRemove && (
        <div className="ws-modal-backdrop">
          <div className="ws-mb" role="dialog" aria-modal="true">
            <h2>Remove team member?</h2>
            <p>
              Are you sure you want to remove{' '}
              <b>{memberToRemove.profiles?.full_name || memberToRemove.profiles?.email || 'this member'}</b> from &ldquo;{team?.name}&rdquo;? They will lose access to team projects and outputs.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '16px' }}>
              <button
                type="button"
                onClick={() => setMemberToRemove(null)}
                className="ws-btn2"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onRemoveMember(memberToRemove.id);
                  setMemberToRemove(null);
                }}
                className="ws-bdf"
              >
                Remove member
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
