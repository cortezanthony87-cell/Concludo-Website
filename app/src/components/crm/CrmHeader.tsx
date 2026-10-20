/**
 * The module header and every global control the brief asks for.
 *
 * Search, organisation, pipeline, owner, date range, saved views, record type,
 * refresh, last synchronised, create, import and the proposals indicator.
 * That is twelve controls, and twelve controls stacked at the top of a 390
 * pixel screen is the first third of the phone gone before the page title
 * appears.
 *
 * So below 900 pixels they sit inside a disclosure whose closed summary still
 * says what is narrowing the view, for example "All organisations, last 30
 * days, 2 filters". The disclosure starts closed on a phone and opens to the
 * same controls, not a reduced set. Above 900 pixels there is no disclosure at
 * all: the summary is `display: none` and the controls are simply the controls,
 * so this is one control set rather than two code paths.
 *
 * The AI proposals indicator is not a notification badge. It is a link with a
 * count and a word, because a number in a circle tells a person that something
 * is wrong without telling them what, which is how an interface creates anxiety
 * with no information.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Download, FolderOpen, Plus, RefreshCw, Search, Settings2, Sparkles } from 'lucide-react';
import { CrmDataset, CrmViewState } from '../../lib/crm/types';
import { CRM_DATE_RANGE_LABELS, crmFiltersAreActive } from '../../lib/crm/viewState';
import { CRM_SAVED_VIEWS } from '../../lib/crm/moduleNav';
import { ownersIn } from '../../lib/crm/selectors';
import { formatDayTime } from '../../lib/crm/today';
import { isAuthenticWorkspace } from '../../lib/crm/customWorkspaceStore';
import { CrmCreateModal } from './CrmCreateModal';
import { CrmImportModal } from './CrmImportModal';

interface Props {
  dataset: CrmDataset;
  viewState: CrmViewState;
  setViewState: (next: Partial<CrmViewState>) => void;
  onRefresh: () => void;
  refreshing: boolean;
  awaitingConfirmation: number;
  linkTo: (path: string) => string;
}

const PHONE_WIDTH = '(max-width: 900px)';

function isPhoneWidth(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PHONE_WIDTH).matches;
}

export const CrmHeader: React.FC<Props> = ({
  dataset,
  viewState,
  setViewState,
  onRefresh,
  refreshing,
  awaitingConfirmation,
  linkTo,
}) => {
  const [controlsOpen, setControlsOpen] = React.useState(true);
  const [createModalOpen, setCreateModalOpen] = React.useState(false);
  const [importModalOpen, setImportModalOpen] = React.useState(false);

  const isAuthentic = Boolean(
    (dataset.workspace as any).isAuthentic ||
    isAuthenticWorkspace(viewState.workspaceId) ||
    dataset.workspace.id.startsWith('ws-org-')
  );
  const linkedProjectId = (dataset.workspace as any).linkedProjectId;
  const linkedProjectTitle = (dataset.workspace as any).linkedProjectTitle;

  const onControlsToggle = React.useCallback((event: React.SyntheticEvent<HTMLDetailsElement>) => {
    setControlsOpen(event.currentTarget.open);
  }, []);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE_WIDTH);
    const onChange = (event: MediaQueryListEvent) => setControlsOpen(!event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const owners = React.useMemo(() => ownersIn(dataset), [dataset]);

  /** What is currently narrowing the view, in one line. */
  const filterSummary = React.useMemo(() => {
    const parts: string[] = [];
    parts.push(
      viewState.organisationId === 'all'
        ? 'All organisations'
        : (dataset.organisations.find((o) => o.id === viewState.organisationId)?.name ??
          'Unknown organisation')
    );
    parts.push(CRM_DATE_RANGE_LABELS[viewState.dateRange]);
    if (viewState.pipelineId !== 'all') {
      parts.push(dataset.pipelines.find((p) => p.id === viewState.pipelineId)?.name ?? 'Pipeline');
    }
    if (viewState.owner !== 'all') parts.push(viewState.owner);
    if (viewState.recordType !== 'all') parts.push(viewState.recordType);
    if (viewState.search.trim()) parts.push(`"${viewState.search.trim().slice(0, 18)}"`);
    if (viewState.savedView) {
      parts.push(CRM_SAVED_VIEWS.find((v) => v.key === viewState.savedView)?.label ?? 'Saved view');
    }
    return parts.join(' · ');
  }, [dataset, viewState]);

  return (
    <header className="ccrm-header">
      <div className="page-header ccrm-header-titles">
        <p className="page-eyebrow">Concludo Workspace</p>
        <h1 className="page-title">Concludo CRM</h1>
        <p className="page-subtitle">
          Who needs your attention, what was last discussed, and what happens next.
        </p>
      </div>

      <p className="ccrm-demo-note" role="status">
        {isAuthentic
          ? `Authentic organisation CRM workspace for ${dataset.workspace.name}. Records and imported documents are saved and connected to your open projects.`
          : 'Demonstration data. No customer information, mailbox or accounting system is connected, and nothing here is sent anywhere.'}
      </p>

      <details className="ccrm-controls-shell" open={controlsOpen} onToggle={onControlsToggle}>
        <summary className="ccrm-controls-summary">
          <span className="ccrm-controls-summary-label">
            <Settings2 size={14} aria-hidden="true" />
            Filters and controls
          </span>
          <span className="ccrm-controls-summary-state">{filterSummary}</span>
        </summary>

        <div className="ccrm-controls">
          <div className="ccrm-control ccrm-control-wide">
            <label className="form-label" htmlFor="ccrm-search">
              Search
            </label>
            <div className="ccrm-search-wrap">
              <Search size={15} aria-hidden="true" className="ccrm-search-icon" />
              <input
                id="ccrm-search"
                type="search"
                className="form-input ccrm-search-input"
                placeholder="Person, organisation or work"
                value={viewState.search}
                onChange={(event) => setViewState({ search: event.target.value })}
              />
            </div>
          </div>

          <div className="ccrm-control">
            <label className="form-label" htmlFor="ccrm-org">
              Organisation
            </label>
            <select
              id="ccrm-org"
              className="form-select"
              value={viewState.organisationId}
              onChange={(event) => setViewState({ organisationId: event.target.value })}
            >
              <option value="all">All organisations</option>
              {dataset.organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ccrm-control">
            <label className="form-label" htmlFor="ccrm-pipeline">
              Pipeline
            </label>
            <select
              id="ccrm-pipeline"
              className="form-select"
              value={viewState.pipelineId}
              onChange={(event) => setViewState({ pipelineId: event.target.value })}
            >
              <option value="all">All pipelines</option>
              {dataset.pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>

          <div className="ccrm-control">
            <label className="form-label" htmlFor="ccrm-owner">
              Owner
            </label>
            <select
              id="ccrm-owner"
              className="form-select"
              value={viewState.owner}
              onChange={(event) => setViewState({ owner: event.target.value })}
            >
              <option value="all">Everyone</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner}
                </option>
              ))}
            </select>
          </div>

          <div className="ccrm-control">
            <label className="form-label" htmlFor="ccrm-range">
              Date range
            </label>
            <select
              id="ccrm-range"
              className="form-select"
              value={viewState.dateRange}
              onChange={(event) =>
                setViewState({ dateRange: event.target.value as CrmViewState['dateRange'] })
              }
            >
              {Object.entries(CRM_DATE_RANGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="ccrm-control">
            <label className="form-label" htmlFor="ccrm-type">
              Record type
            </label>
            <select
              id="ccrm-type"
              className="form-select"
              value={viewState.recordType}
              onChange={(event) =>
                setViewState({ recordType: event.target.value as CrmViewState['recordType'] })
              }
            >
              <option value="all">All types</option>
              <option value="opportunity">Opportunities</option>
              <option value="job">Jobs</option>
              <option value="case">Cases</option>
              <option value="application">Applications</option>
            </select>
          </div>

          <div className="ccrm-control">
            <label className="form-label" htmlFor="ccrm-view">
              Saved view
            </label>
            <select
              id="ccrm-view"
              className="form-select"
              value={viewState.savedView ?? ''}
              onChange={(event) => setViewState({ savedView: event.target.value || null })}
            >
              <option value="">No saved view</option>
              {CRM_SAVED_VIEWS.map((view) => (
                <option key={view.key} value={view.key}>
                  {view.label}
                </option>
              ))}
            </select>
          </div>

          <div className="ccrm-control-actions">
            <button type="button" className="btn-secondary ccrm-button min-h-[44px] flex items-center gap-1.5" onClick={onRefresh}>
              <RefreshCw size={14} className={refreshing ? 'ccrm-spin' : undefined} aria-hidden="true" />
              {refreshing ? 'Refreshing' : 'Refresh'}
            </button>
            <button
              type="button"
              className="btn-primary ccrm-button ccrm-button-primary min-h-[44px] flex items-center gap-1.5"
              onClick={() => setCreateModalOpen(true)}
              title="Create a new, fresh CRM for your organisation"
            >
              <Plus size={14} aria-hidden="true" />
              Create
            </button>
            <button
              type="button"
              className="btn-secondary ccrm-button min-h-[44px] flex items-center gap-1.5"
              onClick={() => setImportModalOpen(true)}
              title="Import files from device or open projects"
            >
              <Download size={14} aria-hidden="true" />
              Import
            </button>
            {linkedProjectId ? (
              <Link
                className="btn-secondary ccrm-button min-h-[44px] flex items-center gap-1.5"
                to={`/projects/${linkedProjectId}`}
                title="Open linked dashboard project"
              >
                <FolderOpen size={14} className="text-[#E2B53C]" aria-hidden="true" />
                {linkedProjectTitle ? `Project: ${linkedProjectTitle}` : 'Open Project'}
              </Link>
            ) : null}
            {crmFiltersAreActive(viewState) ? (
              <button
                type="button"
                className="btn-secondary ccrm-button"
                onClick={() =>
                  setViewState({
                    organisationId: 'all',
                    pipelineId: 'all',
                    owner: 'all',
                    dateRange: 'last_30',
                    recordType: 'all',
                    search: '',
                    savedView: null,
                  })
                }
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>
      </details>

      <div className="ccrm-header-foot">
        <p className="ccrm-sync">
          <span className="ccrm-sync-dot" aria-hidden="true" />
          Last synchronised {formatDayTime(dataset.lastSynchronisedAt)}. {isAuthentic ? 'Authentic organisation workspace.' : 'Demonstration data only.'}
        </p>
        <Link className="ccrm-proposal-indicator" to={linkTo('/crm/proposals')}>
          <Sparkles size={14} aria-hidden="true" />
          <span>
            <strong>{awaitingConfirmation}</strong> proposed CRM{' '}
            {awaitingConfirmation === 1 ? 'update' : 'updates'} awaiting confirmation
          </span>
        </Link>
      </div>

      {/* Modals */}
      <CrmCreateModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreated={(newWorkspaceId) => {
          setViewState({ workspaceId: newWorkspaceId });
          onRefresh();
        }}
      />

      <CrmImportModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        workspaceId={viewState.workspaceId}
        onImportComplete={onRefresh}
      />
    </header>
  );
};
