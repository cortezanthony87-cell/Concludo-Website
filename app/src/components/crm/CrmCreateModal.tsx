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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
}

export const CrmCreateModal: React.FC<Props> = ({ isOpen, onClose, onCreated }) => {
  const [organisationName, setOrganisationName] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [depth, setDepth] = useState<WorkspaceDepth>('small_team');
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
          // User is not authenticated; project linking requires an authentic session
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
            content: `# ${cleanOrg} CRM Account\n\n- Created: ${new Date().toLocaleDateString('en-AU')}\n- Business shape: ${depth}\n- Work item terminology: ${terminology}\n\nThis project stores CRM files, imports, and meeting records for ${cleanOrg}.`,
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

      // Instantiate fresh workspace data with zero synthetic demonstration content
      const freshWorkspace = createFreshWorkspaceData({
        organisationName: cleanOrg,
        workspaceName: workspaceName.trim() || `${cleanOrg} CRM`,
        depth,
        recordTerminology: terminology,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="relative w-full max-w-xl rounded-xl border border-slate-700 bg-[#0D1626] text-white shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="crm-create-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-[#142036]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E2B53C]/20 text-[#E2B53C]">
              <Building2 size={20} />
            </div>
            <div>
              <h2 id="crm-create-title" className="text-lg font-semibold text-white">
                Create Organisation CRM
              </h2>
              <p className="text-xs text-slate-400">
                Set up a fresh CRM workspace with zero demonstration or example data
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-950/40 p-3 text-sm text-red-200">
              {error}
            </div>
          )}

          {/* Organisation Name */}
          <div>
            <label htmlFor="crm-org-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Organisation Name *
            </label>
            <input
              id="crm-org-name"
              type="text"
              required
              placeholder="e.g. Cortez Mowing & Garden Maintenance"
              value={organisationName}
              onChange={handleOrgNameChange}
              className="w-full rounded-lg border border-slate-700 bg-[#16243D] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#E2B53C] focus:outline-none focus:ring-1 focus:ring-[#E2B53C]"
            />
          </div>

          {/* Workspace Name */}
          <div>
            <label htmlFor="crm-ws-name" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              CRM Workspace Name
            </label>
            <input
              id="crm-ws-name"
              type="text"
              placeholder={organisationName ? `${organisationName} CRM` : 'e.g. Sales & Service CRM'}
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-[#16243D] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#E2B53C] focus:outline-none focus:ring-1 focus:ring-[#E2B53C]"
            />
          </div>

          {/* Business Shape & Terminology Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="crm-depth" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Business Structure
              </label>
              <select
                id="crm-depth"
                value={depth}
                onChange={(e) => setDepth(e.target.value as WorkspaceDepth)}
                className="w-full rounded-lg border border-slate-700 bg-[#16243D] px-3 py-2.5 text-sm text-white focus:border-[#E2B53C] focus:outline-none focus:ring-1 focus:ring-[#E2B53C]"
              >
                <option value="small_team">Small team (standard)</option>
                <option value="sole_trader">Sole trader / consultant</option>
                <option value="mid_market">Mid market / growth</option>
                <option value="enterprise">Enterprise / cross-divisional</option>
              </select>
            </div>

            <div>
              <label htmlFor="crm-terminology" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Work Item Terminology
              </label>
              <select
                id="crm-terminology"
                value={terminology}
                onChange={(e) => setTerminology(e.target.value as WorkItemType)}
                className="w-full rounded-lg border border-slate-700 bg-[#16243D] px-3 py-2.5 text-sm text-white focus:border-[#E2B53C] focus:outline-none focus:ring-1 focus:ring-[#E2B53C]"
              >
                <option value="opportunity">Opportunities</option>
                <option value="deal">Deals</option>
                <option value="job">Jobs / Work Orders</option>
                <option value="case">Cases / Client Matters</option>
              </select>
            </div>
          </div>

          {/* Open Projects Integration */}
          <div className="rounded-lg border border-slate-700/80 bg-[#142036] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <input
                id="crm-save-project"
                type="checkbox"
                checked={saveToProject}
                onChange={(e) => setSaveToProject(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-800 text-[#E2B53C] focus:ring-[#E2B53C]"
              />
              <div>
                <label htmlFor="crm-save-project" className="text-sm font-medium text-white cursor-pointer">
                  Save this CRM account into your open projects
                </label>
                <p className="text-xs text-slate-400 mt-0.5">
                  Links this CRM to your projects dashboard for instant navigation, file sharing, and project tracking
                </p>
              </div>
            </div>

            {saveToProject && (
              <div className="pl-7 pt-2 space-y-3 border-t border-slate-700/60 mt-3">
                <div className="flex items-center gap-4 text-xs">
                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="radio"
                      name="projectMode"
                      checked={projectMode === 'new'}
                      onChange={() => setProjectMode('new')}
                      className="text-[#E2B53C] focus:ring-[#E2B53C]"
                    />
                    <span>Create new open project on Dashboard</span>
                  </label>

                  <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 hover:text-white">
                    <input
                      type="radio"
                      name="projectMode"
                      checked={projectMode === 'existing'}
                      onChange={() => setProjectMode('existing')}
                      className="text-[#E2B53C] focus:ring-[#E2B53C]"
                    />
                    <span>Link to existing project</span>
                  </label>
                </div>

                {projectMode === 'new' ? (
                  <div className="rounded bg-[#0D1626] border border-slate-700/60 p-2.5 text-xs text-slate-300 flex items-center gap-2">
                    <FolderPlus size={14} className="text-[#E2B53C]" />
                    <span>
                      Will create project:{' '}
                      <strong className="text-white">
                        {organisationName.trim() ? `${organisationName.trim()} CRM Account` : 'New CRM Account'}
                      </strong>
                    </span>
                  </div>
                ) : (
                  <div>
                    {loadingProjects ? (
                      <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                        <Loader2 size={13} className="animate-spin text-[#E2B53C]" />
                        Loading open projects...
                      </div>
                    ) : existingProjects.length === 0 ? (
                      <p className="text-xs text-amber-300/90 py-1">
                        No existing projects found. A new open project will be created instead.
                      </p>
                    ) : (
                      <select
                        value={selectedProjectId}
                        onChange={(e) => setSelectedProjectId(e.target.value)}
                        className="w-full rounded-md border border-slate-700 bg-[#0D1626] px-3 py-2 text-xs text-white focus:border-[#E2B53C] focus:outline-none"
                      >
                        {existingProjects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.title} {p.client_name ? `(${p.client_name})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Guarantee Note */}
          <p className="text-xs text-emerald-400/90 bg-emerald-950/20 border border-emerald-800/30 rounded-lg p-2.5 flex items-center gap-2">
            <Check size={14} className="text-emerald-400 shrink-0" />
            <span>
              Zero demonstration data: no example contacts, leads, reminders or notifications will appear in this workspace.
            </span>
          </p>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-lg border border-slate-700 px-4 py-2.5 min-h-[44px] text-sm font-medium text-slate-300 hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-[#E2B53C] hover:bg-[#d4a834] px-5 py-2.5 min-h-[44px] text-sm font-semibold text-[#0D1626] shadow-sm transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 size={16} className="animate-spin text-[#0D1626]" />
                  <span>Creating CRM...</span>
                </>
              ) : (
                <>
                  <Plus size={16} />
                  <span>Create Fresh CRM</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
