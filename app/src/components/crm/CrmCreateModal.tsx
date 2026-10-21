import React, { useEffect, useState } from 'react';
import { Building2, Check, FolderPlus, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { getSupabaseBrowserClient } from '../../lib/supabase/client';
import { createProject, fetchProjects } from '../../lib/projects/projectClient';
import { createProjectFile } from '../../lib/projects/projectFilesClient';
import { Project } from '../../lib/projects/types';
import {
  createFreshWorkspaceData,
  saveCustomWorkspace,
  setActiveWorkspaceId,
} from '../../lib/crm/customWorkspaceStore';
import { WorkspaceDepth, WorkItemType } from '../../lib/crm/domain';
import '../../styles/crm-modals.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
  onSwitchToImport?: () => void;
}

const TERMINOLOGY_PLURALS: Record<WorkItemType, string> = {
  opportunity: 'Opportunities',
  project: 'Projects',
  engagement: 'Engagements',
  matter: 'Matters',
  case: 'Cases',
  job: 'Jobs',
  mandate: 'Mandates',
  deal: 'Deals',
  contract: 'Contracts',
  assignment: 'Assignments',
  brief: 'Briefs',
  service: 'Services',
};

export const CrmCreateModal: React.FC<Props> = ({ isOpen, onClose, onCreated, onSwitchToImport }) => {
  const [organisationName, setOrganisationName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [bizStructure, setBizStructure] = useState<string>('sole_trader');
  const [terminology, setTerminology] = useState<WorkItemType>('opportunity');

  const [saveToProject, setSaveToProject] = useState(true);
  const [projectMode, setProjectMode] = useState<'new' | 'existing'>('new');
  const [existingProjects, setExistingProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loadingProjects, setLoadingProjects] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load existing open projects when modal opens
  useEffect(() => {
    if (!isOpen) return;
    let isMounted = true;
    const loadProjects = async () => {
      setLoadingProjects(true);
      try {
        const supabase = getSupabaseBrowserClient();
        const res = await fetchProjects(supabase);
        if (isMounted && res.data) {
          setExistingProjects(res.data);
          if (res.data.length > 0) {
            setSelectedProjectId(res.data[0].id);
          }
        }
      } catch (err) {
        console.error('Error fetching open projects:', err);
      } finally {
        if (isMounted) setLoadingProjects(false);
      }
    };
    loadProjects();
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Update default workspace name as organisation name changes
  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setOrganisationName(val);
    if (!workspaceName || workspaceName === `${organisationName} CRM`) {
      setWorkspaceName(val ? `${val} CRM` : '');
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanOrg = organisationName.trim();
    if (!cleanOrg) {
      setError('Please provide an organisation or business name.');
      return;
    }

    setSubmitting(true);
    try {
      let linkedProjectId: string | null = null;
      let linkedProjectTitle: string | null = null;

      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (saveToProject) {
        if (!user) {
          console.warn('User not authenticated, project link will be skipped for this local session.');
        } else if (projectMode === 'new') {
          const projectTitle = `${cleanOrg} CRM Account`;
          const createdRes = await createProject(supabase, {
            title: projectTitle,
            client_name: cleanOrg,
            project_name: workspaceName.trim() || `${cleanOrg} CRM`,
            meeting_type: 'Strategy & Planning',
            notes: JSON.stringify({
              accountType: 'crm_workspace',
              organisation: cleanOrg,
              businessStructure: bizStructure,
              created_at: new Date().toISOString(),
            }),
          });

          if (createdRes.error || !createdRes.data) {
            throw new Error(`Failed to create dashboard project: ${createdRes.error?.message || 'Unknown error'}`);
          }

          linkedProjectId = createdRes.data.id;
          linkedProjectTitle = createdRes.data.title;

          // Create an initial markdown summary file in the project
          const overviewRes = await createProjectFile(supabase, {
            project_id: createdRes.data.id,
            name: `${cleanOrg.replace(/[^a-zA-Z0-9]/g, '_')}_CRM_Overview.md`,
            file_type: 'notes',
            mime_type: 'text/markdown',
            content: `# ${cleanOrg} CRM Account\n\n- Created: ${new Date().toLocaleDateString('en-AU')}\n- Business structure: ${bizStructure}\n- Work item terminology: ${terminology}\n\nThis project stores CRM files, imports, and meeting records for ${cleanOrg}.`,
            description: 'Authentic CRM Workspace initialisation file',
          });
          if (overviewRes.error) {
            console.warn('Overview project file notice:', overviewRes.error.message);
          }
        } else if (projectMode === 'existing' && selectedProjectId) {
          linkedProjectId = selectedProjectId;
          const found = existingProjects.find((p) => p.id === selectedProjectId);
          linkedProjectTitle = found?.title || 'Open Project';
        }
      }

      // Map business structure to domain WorkspaceDepth
      const depth: WorkspaceDepth =
        bizStructure === 'sole_trader'
          ? 'sole_trader'
          : bizStructure === 'partnership' || bizStructure === 'company'
          ? 'small_team'
          : bizStructure === 'govt' || bizStructure === 'enterprise'
          ? 'enterprise'
          : 'mid_market';

      // Instantiate fresh workspace data with zero synthetic demonstration content
      const freshWorkspace = createFreshWorkspaceData({
        organisationName: cleanOrg,
        workspaceName: workspaceName.trim() || `${cleanOrg} CRM`,
        depth,
        recordTerminology: terminology,
        recordTerminologyPlural: TERMINOLOGY_PLURALS[terminology] || 'Opportunities',
        linkedProjectId,
        linkedProjectTitle,
        userId: user ? user.id : 'usr-admin',
      });

      // If project is linked and user is authenticated, persist workspace definition in project_files
      if (linkedProjectId && user) {
        try {
          const jsonRes = await createProjectFile(supabase, {
            project_id: linkedProjectId,
            name: 'crm_workspace_data.json',
            file_type: 'document',
            mime_type: 'application/json',
            content: JSON.stringify(freshWorkspace),
            description: 'Authentic CRM Workspace definition and records',
          });
          if (jsonRes.error) {
            console.warn('Workspace data file notice:', jsonRes.error.message);
          }
        } catch (fileErr) {
          console.warn('Could not store crm_workspace_data.json in project files:', fileErr);
        }
      }

      // Save to custom store and local storage
      saveCustomWorkspace(freshWorkspace);
      setActiveWorkspaceId(freshWorkspace.workspace.id);

      // Notify parent to switch active view state
      onCreated(freshWorkspace.workspace.id);
      onClose();
    } catch (err: any) {
      console.error('Failed to create fresh CRM:', err);
      setError(err?.message || 'Failed to create fresh CRM workspace. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="crm-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="crm-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-create-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="crm-modal-header">
          <div className="crm-modal-header-left">
            <div className="crm-modal-icon" aria-hidden="true">
              <Building2 size={18} />
            </div>
            <div>
              <div className="crm-modal-title" id="crm-create-title">
                Create Organisation CRM
              </div>
              <div className="crm-modal-sub">
                Set up a dedicated workspace for a client or business.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="crm-modal-close-btn"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Switcher Bar */}
        {onSwitchToImport && (
          <div className="crm-modal-switcher" role="tablist" aria-label="Modal preview switcher">
            <button
              type="button"
              className="crm-modal-switcher-btn active"
              role="tab"
              aria-selected="true"
            >
              <Building2 size={14} />
              Create Organisation CRM
            </button>
            <button
              type="button"
              onClick={onSwitchToImport}
              className="crm-modal-switcher-btn"
              role="tab"
              aria-selected="false"
            >
              <Sparkles size={14} />
              CRM Document Importer
            </button>
          </div>
        )}

        {/* Modal Body & Form */}
        <form onSubmit={handleSubmit}>
          <div className="crm-modal-body">
            {error && (
              <div style={{
                borderRadius: '8px',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                background: 'rgba(239, 68, 68, 0.1)',
                padding: '10px 14px',
                fontSize: '13px',
                color: '#ef4444'
              }}>
                {error}
              </div>
            )}

            {/* Organisation Name */}
            <div className="crm-modal-field">
              <label className="crm-modal-label" htmlFor="crm-org-name">
                Organisation name <span className="crm-modal-req" aria-label="required">*</span>
              </label>
              <input
                id="crm-org-name"
                type="text"
                required
                placeholder="e.g. Kestrel Advisory Group"
                value={organisationName}
                onChange={handleOrgNameChange}
                autoComplete="off"
                className="crm-modal-input"
              />
            </div>

            {/* Two-column Row: Business structure & Work item terminology */}
            <div className="crm-modal-field-row">
              {/* Business Structure */}
              <div className="crm-modal-field">
                <label className="crm-modal-label" htmlFor="crm-biz-structure">
                  Business structure
                </label>
                <div className="crm-modal-select-wrap">
                  <select
                    id="crm-biz-structure"
                    value={bizStructure}
                    onChange={(e) => setBizStructure(e.target.value)}
                    className="crm-modal-select"
                  >
                    <option value="sole_trader">Sole Trader</option>
                    <option value="partnership">Partnership</option>
                    <option value="company">Company (Pty Ltd)</option>
                    <option value="trust">Trust</option>
                    <option value="inc_assoc">Incorporated Association</option>
                    <option value="govt">Government Body</option>
                    <option value="non_profit">Non-Profit Organisation</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              {/* Work Item Terminology */}
              <div className="crm-modal-field">
                <label className="crm-modal-label" htmlFor="crm-work-term">
                  Work item terminology
                </label>
                <div className="crm-modal-term-wrap">
                  <div className="crm-modal-select-wrap">
                    <select
                      id="crm-work-term"
                      value={terminology}
                      onChange={(e) => setTerminology(e.target.value as WorkItemType)}
                      className="crm-modal-select"
                    >
                      <option value="opportunity">Opportunities</option>
                      <option value="project">Projects</option>
                      <option value="engagement">Engagements</option>
                      <option value="matter">Matters</option>
                      <option value="case">Cases</option>
                      <option value="job">Jobs</option>
                      <option value="mandate">Mandates</option>
                      <option value="deal">Deals</option>
                      <option value="contract">Contracts</option>
                      <option value="assignment">Assignments</option>
                      <option value="brief">Briefs</option>
                      <option value="service">Services</option>
                    </select>
                  </div>
                  <div className="crm-modal-term-badge" aria-live="polite">
                    <span className="crm-modal-term-dot" aria-hidden="true" />
                    <span>
                      Pipeline will show <strong>{TERMINOLOGY_PLURALS[terminology] ?? 'Opportunities'}</strong>
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* CRM Workspace Name */}
            <div className="crm-modal-field">
              <label className="crm-modal-label" htmlFor="crm-workspace-name">
                CRM workspace name <span className="crm-modal-req" aria-label="required">*</span>
              </label>
              <input
                id="crm-workspace-name"
                type="text"
                placeholder={organisationName ? `${organisationName} 2026 Pipeline` : 'e.g. Kestrel Advisory Group 2026 Pipeline'}
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                autoComplete="off"
                className="crm-modal-input"
              />
            </div>

            {/* Save as Project Divider & Section */}
            <div className="crm-modal-section-divider">Workspace settings</div>

            <label className="crm-modal-checkbox-row" htmlFor="crm-save-project">
              <input
                type="checkbox"
                id="crm-save-project"
                checked={saveToProject}
                onChange={(e) => setSaveToProject(e.target.checked)}
              />
              <div className="crm-modal-checkbox-label">
                <strong>Save as workspace project</strong>
                <span>Attach this CRM to a project so team members can find it quickly.</span>
              </div>
            </label>

            {saveToProject && (
              <div className="crm-modal-radio-group">
                <label className={`crm-modal-radio-row ${projectMode === 'new' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="crm-proj-action"
                    value="new"
                    checked={projectMode === 'new'}
                    onChange={() => setProjectMode('new')}
                  />
                  <span>Create a new project</span>
                </label>
                <label className={`crm-modal-radio-row ${projectMode === 'existing' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="crm-proj-action"
                    value="existing"
                    checked={projectMode === 'existing'}
                    onChange={() => setProjectMode('existing')}
                  />
                  <span>Add to an existing project</span>
                </label>

                {projectMode === 'new' ? (
                  <div style={{
                    marginTop: '4px',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    background: 'var(--crm-m-surface)',
                    border: '1px solid var(--crm-m-border)',
                    fontSize: '12.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: 'var(--crm-m-text)'
                  }}>
                    <FolderPlus size={14} style={{ color: 'var(--crm-m-gold)' }} />
                    <span>
                      Will create project:{' '}
                      <strong>
                        {organisationName.trim() ? `${organisationName.trim()} CRM Account` : 'New CRM Account'}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <div style={{ marginTop: '4px' }}>
                    {loadingProjects ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--crm-m-text-2)' }}>
                        <Loader2 size={13} className="animate-spin" />
                        Loading open projects...
                      </div>
                    ) : existingProjects.length === 0 ? (
                      <p style={{ fontSize: '12px', color: 'var(--crm-m-gold-d)' }}>
                        No existing projects found. A new open project will be created instead.
                      </p>
                    ) : (
                      <div className="crm-modal-select-wrap">
                        <select
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="crm-modal-select"
                        >
                          {existingProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} {p.client_name ? `(${p.client_name})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="crm-modal-footer">
            <button
              className="crm-modal-btn crm-modal-btn-ghost"
              type="button"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              className="crm-modal-btn crm-modal-btn-primary"
              type="submit"
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Creating CRM...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>+ Create Fresh CRM</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
