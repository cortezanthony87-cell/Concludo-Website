/**
 * The pieces the eight relationship views share.
 *
 * Stage 2's `ViewScaffold` already owns the four interface states and the view
 * heading, and it reads the Stage 2 view data. These views read the Stage 3
 * domain model instead, so this file gives them the same frame over a different
 * source rather than a second frame.
 *
 * Three of the components here carry a product rule rather than a layout:
 *
 *   `WorkspacePicker` exists because the model is tenanted. A view that renders
 *   one tenant without saying which is a lie about the model underneath it.
 *
 *   `FlagList` renders the seven record-level indicators, each with what would
 *   resolve it. An indicator a person cannot act on is an accusation, so the
 *   resolution is not optional in the markup.
 *
 *   `SourceTrailList` is how an extracted value gets back to the sentence it
 *   came from. Where there is nothing to open it says why in words, because
 *   "no source recorded" and "the source record is gone" are different facts
 *   and an empty space says neither.
 */
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, CircleAlert, FileText, Quote as QuoteIcon } from 'lucide-react';
import { CrmWorkspaceData } from '../../lib/crm/domain';
import { CRM_DEMO_NOW } from '../../lib/crm/data/factory';
import { useCrmViewState } from '../../lib/crm/useCrmViewState';
import { crmFiltersAreActive } from '../../lib/crm/viewState';
import { CrmViewState } from '../../lib/crm/types';
import { getLiveWorkspaceChoices } from '../../lib/crm/stage4/workspace';
import {
  sessionVersion,
  sessionWorkspace,
  subscribeToWrites,
} from '../../lib/crm/stage5/session';
import { QUALITY_LABELS, QualityFlag } from '../../lib/crm/stage4/quality';
import { SourceTrail } from '../../lib/crm/stage4/sources';
import {
  TIMELINE_KIND_LABELS,
  TIMELINE_SOURCE_LABELS,
  TimelineEntry,
} from '../../lib/crm/stage4/timeline';
import { BasisChip } from './viewPrimitives';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  NoMatchState,
  PartialState,
  forcedState,
} from './StateBlocks';

/* ----------------------------------------------------------------- hook */

export interface Stage4View {
  data: CrmWorkspaceData;
  /**
   * Bumped on every write.
   *
   * The session store mutates ONE workspace object in place, so `data` is
   * reference-stable for the life of the tab. A view that memoises on `[data]`
   * therefore never recomputes after a write, which is a bug a page only shows
   * once it does real work in a `useMemo`. Depend on this as well.
   */
  version: number;
  /** The fixed demonstration moment, so nothing moves with the wall clock. */
  now: string;
  viewState: CrmViewState;
  setViewState: (next: Partial<CrmViewState>) => void;
  linkTo: (path: string) => string;
  state: ReturnType<typeof forcedState> extends infer T ? NonNullable<T> | 'ready' : never;
}

/**
 * The workspace on screen.
 *
 * Stage 4 read the fixture directly. Stage 5 added a write path, so this reads
 * the SESSION copy instead: one store, so a lead converted on one screen is a
 * person on the next. The alternative, writes going somewhere the read views
 * cannot see, is the bug that makes people stop trusting a demonstration.
 *
 * The subscription is what makes a write show up without a reload. It is a
 * version counter rather than anything cleverer, because the whole store is a
 * few hundred rows and the honest simple thing beats the clever thing that is
 * wrong once a week.
 */
export function useStage4(): Stage4View {
  const location = useLocation();
  const { viewState, setViewState, linkTo } = useCrmViewState();
  const forced = forcedState(location.search);

  const [, bump] = React.useState(0);
  React.useEffect(() => subscribeToWrites(() => bump((n) => n + 1)), []);

  return {
    data: sessionWorkspace(viewState.workspaceId),
    version: sessionVersion(),
    now: CRM_DEMO_NOW,
    viewState,
    setViewState,
    linkTo,
    state: forced ?? 'ready',
  };
}

/* ------------------------------------------------------- workspace picker */

export const WorkspacePicker: React.FC = () => {
  const { viewState, setViewState } = useStage4();
  const choices = getLiveWorkspaceChoices();

  return (
    <div className="ccrm-workspace-picker">
      <label className="ccrm-workspace-label" htmlFor="ccrm-workspace">
        Workspace
      </label>
      <select
        id="ccrm-workspace"
        className="form-select ccrm-workspace-select"
        value={viewState.workspaceId}
        onChange={(event) => setViewState({ workspaceId: event.target.value })}
      >
        {choices.map((choice) => (
          <option key={choice.id} value={choice.id}>
            {choice.name}, {choice.shape.toLowerCase()}
          </option>
        ))}
      </select>
    </div>
  );
};

/* -------------------------------------------------------------- scaffold */

interface ScaffoldProps {
  title: string;
  description: string;
  loadingLabel: string;
  emptyTitle: string;
  emptyBody: string;
  resultCount: number;
  totalCount: number;
  partialMissing?: string;
  /** Extra controls beside the workspace picker. */
  toolbar?: React.ReactNode;
  children: React.ReactNode;
}

export const Stage4Scaffold: React.FC<ScaffoldProps> = ({
  title,
  description,
  loadingLabel,
  emptyTitle,
  emptyBody,
  resultCount,
  totalCount,
  partialMissing,
  toolbar,
  children,
}) => {
  const { state, viewState, setViewState, data } = useStage4();
  const isAuthentic = Boolean((data.workspace as any).isAuthentic || data.workspace.id.startsWith('ws-org-'));

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
          partialMissing ?? 'One source did not respond, so some rows may be missing from this list.'
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
          <p className="ccrm-view-tenant">
            {isAuthentic
              ? `Showing ${data.workspace.name}. Authentic organisation records.`
              : `Showing ${data.workspace.name}. Demonstration data, synthetic throughout.`}
          </p>
        </div>
        <div className="ccrm-view-toolbar">
          <WorkspacePicker />
          {toolbar}
        </div>
      </div>
      {body}
    </section>
  );
};

/* ------------------------------------------------------------ the flags */

export const FlagList: React.FC<{ flags: QualityFlag[]; heading?: string }> = ({
  flags,
  heading,
}) => {
  if (flags.length === 0) {
    return <p className="ccrm-panel-empty">Nothing on this record needs attention.</p>;
  }

  return (
    <>
      {heading ? <p className="ccrm-flag-heading">{heading}</p> : null}
      <ul className="ccrm-flag-list">
        {flags.map((flag, index) => (
          <li className={`ccrm-flag ccrm-flag-${flag.kind}`} key={`${flag.kind}-${index}`}>
            <span className="ccrm-flag-label">{QUALITY_LABELS[flag.kind]}</span>
            <span className="ccrm-flag-detail">{flag.detail}</span>
            {/* Never optional. An indicator with no way out is an accusation. */}
            <span className="ccrm-flag-resolution">{flag.resolution}</span>
          </li>
        ))}
      </ul>
    </>
  );
};

/* ------------------------------------------------------ the source trail */

export const SourceTrailList: React.FC<{
  trails: SourceTrail[];
  linkTo: (path: string) => string;
  emptyMessage?: string;
}> = ({ trails, linkTo, emptyMessage }) => {
  if (trails.length === 0) {
    return (
      <p className="ccrm-panel-empty">
        {emptyMessage ?? 'Nothing on this record was extracted from a conversation.'}
      </p>
    );
  }

  return (
    <ul className="ccrm-trail-list">
      {trails.map((trail) => (
        <li className="ccrm-trail" key={trail.evidenceId}>
          <div className="ccrm-trail-head">
            <span className="ccrm-trail-field">{trail.fieldName}</span>
            <BasisChip basis={trail.basis} />
            <span className="ccrm-trail-confidence">Confidence: {trail.confidence}</span>
          </div>

          <p className="ccrm-trail-value">
            {trail.assertedValue ?? <span className="ccrm-absent">Nothing recorded</span>}
          </p>

          {trail.sourceText ? (
            <blockquote className="ccrm-trail-quote">
              <QuoteIcon size={13} aria-hidden="true" className="ccrm-trail-quote-icon" />
              <span>{trail.sourceText}</span>
            </blockquote>
          ) : null}

          {trail.record ? (
            <p className="ccrm-trail-source">
              <FileText size={13} aria-hidden="true" />
              {trail.record.path ? (
                <Link className="ccrm-text-link" to={linkTo(trail.record.path)}>
                  Open {trail.record.label}
                  <ArrowRight size={13} aria-hidden="true" />
                </Link>
              ) : (
                <span>
                  {trail.record.label}. This release has no view that opens it.
                </span>
              )}
              {trail.sourceLocation ? (
                <span className="ccrm-trail-where">{trail.sourceLocation}</span>
              ) : null}
            </p>
          ) : (
            <p className="ccrm-trail-source ccrm-trail-unavailable">
              <CircleAlert size={13} aria-hidden="true" />
              <span>{trail.unavailableBecause}</span>
            </p>
          )}

          <p className="ccrm-trail-meta">
            Captured {trail.capturedAt.slice(0, 10)}.
            {trail.modelVersion
              ? ` Produced by ${trail.modelVersion} with prompt ${trail.promptVersion}.`
              : ' Entered by a person.'}
            {trail.confirmedAt ? ` Confirmed ${trail.confirmedAt.slice(0, 10)}.` : ''}
            {trail.conflictsWithId
              ? ' This value is in conflict with another recorded value.'
              : ''}
          </p>
        </li>
      ))}
    </ul>
  );
};

/* ---------------------------------------------------------- the timeline */

export const TimelineList: React.FC<{
  entries: TimelineEntry[];
  linkTo: (path: string) => string;
  emptyMessage: string;
  limit?: number;
}> = ({ entries, linkTo, emptyMessage, limit }) => {
  const shown = limit ? entries.slice(0, limit) : entries;

  if (shown.length === 0) {
    return <p className="ccrm-panel-empty">{emptyMessage}</p>;
  }

  return (
    <>
      <ol className="ccrm-timeline">
        {shown.map((entry) => (
          <li className="ccrm-timeline-item" key={entry.id}>
            <div className="ccrm-timeline-when">
              <span className="ccrm-timeline-kind">{TIMELINE_KIND_LABELS[entry.kind]}</span>
              <span className="ccrm-timeline-date">{entry.occurredAt.slice(0, 10)}</span>
            </div>
            <div className="ccrm-timeline-body">
              <h4 className="ccrm-timeline-title">{entry.title}</h4>
              {entry.context ? <p className="ccrm-timeline-context">{entry.context}</p> : null}
              {entry.detail ? <p className="ccrm-timeline-summary">{entry.detail}</p> : null}
              <p className="ccrm-timeline-source">
                <span className="ccrm-timeline-origin">
                  {TIMELINE_SOURCE_LABELS[entry.source]}
                </span>
                {entry.captureMethod ? (
                  <span className="ccrm-timeline-capture">{entry.captureMethod}</span>
                ) : null}
                {entry.evidenceId ? (
                  <Link
                    className="ccrm-text-link"
                    to={linkTo(`/crm/activities?focus=${entry.subjectId}`)}
                  >
                    Open the source
                    <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                ) : null}
              </p>
            </div>
          </li>
        ))}
      </ol>
      {limit && entries.length > limit ? (
        <p className="ccrm-panel-more">
          {entries.length - limit} older {entries.length - limit === 1 ? 'entry' : 'entries'} are not
          shown here.
        </p>
      ) : null}
    </>
  );
};

/**
 * The independence line.
 *
 * Shown wherever a capture method is named. Concludo is an independent product
 * and the column records what the input was, never a relationship with whoever
 * made the device.
 */
export const IndependenceNote: React.FC = () => (
  <p className="ccrm-independence" role="note">
    Concludo is an independent product and is not affiliated with, endorsed by, or partnered with any
    device maker, meeting platform or note-taking service. Capture method records what the
    conversation came from, nothing more.
  </p>
);
