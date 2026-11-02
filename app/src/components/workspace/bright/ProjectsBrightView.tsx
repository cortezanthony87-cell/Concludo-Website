import React from 'react';
import { Link } from 'react-router-dom';
import { Project } from '../../../lib/projects/types';
import { Team, TeamRole } from '../../../lib/teams/types';
import '../../../styles/workspace-pages-bright.css';

export interface ProjectsBrightViewProps {
  projects: Project[];
  loading: boolean;
  loadError: string | null;
  workspaceScope: 'all' | 'personal' | 'team';
  setWorkspaceScope: (scope: 'all' | 'personal' | 'team') => void;
  userTeams: (Team & { currentRole: TeamRole })[];
  selectedTeamId: string;
  setSelectedTeamId: (id: string) => void;
  onRetry: () => void;
  onDelete: (id: string) => Promise<void>;
  deletingId: string | null;
  deleteError: string | null;
  setDeleteError: (err: string | null) => void;
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;
  formatDate: (dateStr: string | null) => string;
  formatTimestamp: (dateStr: string) => string;
}

export const ProjectsBrightView: React.FC<ProjectsBrightViewProps> = ({
  projects,
  loading,
  loadError,
  workspaceScope,
  setWorkspaceScope,
  userTeams,
  selectedTeamId,
  setSelectedTeamId,
  onRetry,
  onDelete,
  deletingId,
  deleteError,
  setDeleteError,
  deleteConfirmId,
  setDeleteConfirmId,
  formatDate,
  formatTimestamp,
}) => {
  const projectToDelete = projects.find((p) => p.id === deleteConfirmId);

  return (
    <div className="ws-shell">
      {/* Top Header */}
      <div className="ws-top">
        <div>
          <div className="ws-eyebrow">
            <i />
            <span>TRANSCRIPT ARCHIVE &amp; MEETING MEMORY</span>
          </div>
          <h1>Projects</h1>
          <p>Permanent workspace repository of your conversations, transcripts and outputs.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <Link to="/search" className="ws-btn2">
            Search history
          </Link>
          <Link to="/projects/new" className="ws-btn">
            + Create project
          </Link>
        </div>
      </div>

      {/* Workspace Scope Filters */}
      <div className="ws-seg">
        <b>Workspace:</b>
        <button
          type="button"
          onClick={() => setWorkspaceScope('all')}
          className={`ws-chip ${workspaceScope === 'all' ? 'ws-on' : ''}`}
        >
          All projects
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceScope('personal')}
          className={`ws-chip ${workspaceScope === 'personal' ? 'ws-on' : ''}`}
        >
          Personal
        </button>
        <button
          type="button"
          onClick={() => setWorkspaceScope('team')}
          className={`ws-chip ${workspaceScope === 'team' ? 'ws-on' : ''}`}
        >
          Team
        </button>
        <span style={{ flex: 1 }} />
        {userTeams.length > 0 && (
          <select
            className="ws-in"
            style={{ margin: 0, padding: '6px 10px', width: 'auto' }}
            value={selectedTeamId}
            onChange={(e) => setSelectedTeamId(e.target.value)}
          >
            <option value="">All teams</option>
            {userTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Error Banner */}
      {loadError && (
        <div className="ws-ban ws-red">
          <div>
            <b>Failed to load projects</b>
            <div className="ws-note">{loadError}</div>
          </div>
          <button type="button" onClick={onRetry} className="ws-btn2">
            Retry
          </button>
        </div>
      )}

      {/* Header bar */}
      {!loading && !loadError && (
        <div className="ws-hd">
          <h2>Transcript archive ({projects.length})</h2>
          <span className="ws-note">Sorted by most recently modified</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="ws-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div className="ws-sub">Retrieving saved projects...</div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !loadError && projects.length === 0 && (
        <div className="ws-card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <h2>No projects found</h2>
          <p className="ws-note" style={{ maxWidth: '440px', margin: '8px auto 20px auto' }}>
            Create your first project to start building your meeting archive.
          </p>
          <Link to="/projects/new" className="ws-btn">
            + Create project
          </Link>
        </div>
      )}

      {/* Projects list */}
      {!loading &&
        !loadError &&
        projects.map((project) => {
          const displayClient = project.client_name || project.client_or_project || 'Internal';
          const isTeam = project.ownership_type === 'team' || !!project.team_id;

          return (
            <div key={project.id} className="ws-proj">
              <div>
                <h3>
                  {project.title}{' '}
                  <span className={`ws-pill ${isTeam ? 'ws-bl' : ''}`}>
                    {isTeam ? 'Team' : 'Personal'}
                  </span>
                </h3>
                <div className="ws-meta">
                  <span>&#9670; {project.meeting_type || 'Internal meeting'}</span>
                  <span>&#9632; {displayClient}</span>
                  <span>Meeting: {formatDate(project.meeting_date)}</span>
                  <span>Last updated: {formatTimestamp(project.updated_at)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <Link to={`/projects/${project.id}`} className="ws-btn3">
                  Open &rarr;
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteConfirmId(project.id);
                    setDeleteError(null);
                  }}
                  className="ws-bd"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="ws-modal-backdrop">
          <div className="ws-mb" role="dialog" aria-modal="true">
            <h2>Delete this project?</h2>
            <p>
              &ldquo;{projectToDelete?.title || 'This project'}&rdquo; will be moved to Recently deleted. You can restore it for 30 days. After that it is permanently removed.
            </p>
            {deleteError && (
              <div className="ws-note" style={{ color: 'var(--ws-red)', marginBottom: '12px' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => {
                  setDeleteConfirmId(null);
                  setDeleteError(null);
                }}
                className="ws-btn2"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId !== null}
                onClick={() => onDelete(deleteConfirmId)}
                className="ws-bdf"
              >
                {deletingId !== null ? 'Deleting...' : 'Delete project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
