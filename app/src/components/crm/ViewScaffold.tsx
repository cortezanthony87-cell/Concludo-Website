/**
 * The frame every CRM view sits in.
 *
 * It owns the four interface states, the view's heading, and the hook that
 * gives a page its dataset and its filters. A page therefore says what it
 * shows, not how to be a page, and all fourteen behave the same way when a
 * list is empty, when loading, when something is missing or when something has
 * gone wrong.
 *
 * The empty state is split in two on purpose. "No records exist" and "records
 * exist but none match your filters" are different situations with different
 * answers, and showing the same message for both sends a person looking for
 * data that is sitting behind a filter they forgot they set.
 */
import React from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { AsyncState, CrmDataset, CrmViewState } from '../../lib/crm/types';
import { CRM_DATASET } from '../../lib/crm/data/workspace';
import { useCrmViewState } from '../../lib/crm/useCrmViewState';
import { crmFiltersAreActive } from '../../lib/crm/viewState';
import { CrmModuleContext } from './CrmModuleLayout';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoMatchState,
  PartialState,
  forcedState,
} from './StateBlocks';

export interface CrmViewData {
  dataset: CrmDataset;
  viewState: CrmViewState;
  setViewState: (next: Partial<CrmViewState>) => void;
  linkTo: (path: string) => string;
  state: AsyncState;
}

export function useCrmView(): CrmViewData {
  const location = useLocation();
  const { viewState, setViewState, linkTo } = useCrmViewState();
  const forced = forcedState(location.search);

  return {
    dataset: CRM_DATASET,
    viewState,
    setViewState,
    linkTo,
    state: forced ?? 'ready',
  };
}

export function useCrmModuleContext(): CrmModuleContext {
  return useOutletContext<CrmModuleContext>();
}

interface Props {
  /** The view's own title, as its `h2`. The module title is the page `h1`. */
  title: string;
  /** The question this view answers. */
  description: string;
  /** What this view is loading, for the loading state's sentence. */
  loadingLabel: string;
  /** Said when the workspace genuinely holds nothing of this kind. */
  emptyTitle: string;
  emptyBody: string;
  /** How many rows the view has after filtering. Drives the no-match state. */
  resultCount: number;
  /** How many rows exist before filtering. */
  totalCount: number;
  /** What is missing in the partial state. */
  partialMissing?: string;
  children: React.ReactNode;
  /** Controls that belong to this view rather than the module. */
  toolbar?: React.ReactNode;
}

export const ViewScaffold: React.FC<Props> = ({
  title,
  description,
  loadingLabel,
  emptyTitle,
  emptyBody,
  resultCount,
  totalCount,
  partialMissing,
  children,
  toolbar,
}) => {
  const { state, viewState, setViewState } = useCrmView();

  const clearFilters = () =>
    setViewState({
      organisationId: 'all',
      pipelineId: 'all',
      owner: 'all',
      dateRange: 'all',
      recordType: 'all',
      search: '',
      savedView: null,
    });

  let body: React.ReactNode;

  if (state === 'loading') {
    body = <LoadingState what={loadingLabel} />;
  } else if (state === 'error') {
    body = <ErrorState what={title} />;
  } else if (state === 'empty' || totalCount === 0) {
    body = <EmptyState title={emptyTitle} body={emptyBody} />;
  } else if (resultCount === 0 && crmFiltersAreActive(viewState)) {
    body = <NoMatchState onClear={clearFilters} />;
  } else if (state === 'partial') {
    body = (
      <PartialState
        missing={
          partialMissing ??
          'One source did not respond, so some rows may be missing from this list.'
        }
      >
        {children}
      </PartialState>
    );
  } else {
    body = children;
  }

  return (
    <section className="ccrm-view" aria-labelledby="ccrm-view-title">
      <div className="ccrm-view-head">
        <div>
          <h2 className="ccrm-view-title" id="ccrm-view-title">
            {title}
          </h2>
          <p className="ccrm-view-description">{description}</p>
        </div>
        {toolbar ? <div className="ccrm-view-toolbar">{toolbar}</div> : null}
      </div>
      {body}
    </section>
  );
};
