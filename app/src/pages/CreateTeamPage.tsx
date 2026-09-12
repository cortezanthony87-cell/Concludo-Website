import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Users,
  Sparkles,
  ArrowLeft,
  Building,
  Check,
  Loader2,
  AlertCircle,
  RefreshCw,
  Shield,
} from 'lucide-react';
import { useAuth } from '../lib/auth/AuthContext';
import { usePermissions } from '../lib/permissions/usePermissions';
import { createTeam } from '../lib/teams/teamClient';

export const CreateTeamPage: React.FC = () => {
  const { supabase, profile } = useAuth();
  const navigate = useNavigate();
  const { hasAccess, loading: permissionsLoading } = usePermissions('team_workspace');

  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCreate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage(null);

    const trimmed = teamName.trim();
    if (!trimmed) {
      setErrorMessage('Team name is required.');
      return;
    }

    if (!supabase) {
      setErrorMessage('Database connection unavailable.');
      return;
    }

    setCreating(true);

    const result = await createTeam(supabase, { name: trimmed });

    if (result.error || !result.data) {
      setErrorMessage(result.error?.message || 'Failed to create team');
      setCreating(false);
      return;
    }

    // Success - navigate to team dashboard
    navigate('/team');
  };

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
    <div style={{ maxWidth: '720px' }}>
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
          <span>Back to Team</span>
        </Link>
      </div>

      <div className="page-header">
        <div className="page-eyebrow">
          <Sparkles size={13} color="#f3c958" />
          <span>MULTI-USER COLLABORATION</span>
        </div>
        <h1 className="page-title">Create Team Workspace</h1>
        <p className="page-subtitle">
          Establish a shared workspace for collaborative meeting memory, shared decisions, and team action tracking.
        </p>
      </div>

      {errorMessage && (
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
            justifyContent: 'space-between',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} color="#ef4444" />
            <span style={{ fontSize: '0.92rem' }}>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => handleCreate()}
            className="btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={14} />
            <span>Retry</span>
          </button>
        </div>
      )}

      <div className="content-card">
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label
              className="form-label"
              htmlFor="team-name"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Building size={15} color="#f3c958" />
              <span>Team Name</span>
              <span style={{ color: '#f3c958' }}>*</span>
            </label>
            <input
              id="team-name"
              type="text"
              className="form-input"
              placeholder="e.g. Concludo Operations or Alpha Strategy"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              disabled={creating}
              required
              autoFocus
            />
            <p style={{ color: '#94a3b8', fontSize: '0.82rem', marginTop: '6px' }}>
              You will become the Owner of this workspace and can invite colleagues with Admin, Member, or Viewer roles.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', marginTop: '28px' }}>
            <button type="submit" className="btn-gold" disabled={creating || !teamName.trim()}>
              {creating ? (
                <>
                  <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>Creating Team...</span>
                </>
              ) : (
                <>
                  <Check size={18} />
                  <span>Create Team</span>
                </>
              )}
            </button>
            <Link to="/team" className="btn-secondary" style={{ pointerEvents: creating ? 'none' : 'auto' }}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};
