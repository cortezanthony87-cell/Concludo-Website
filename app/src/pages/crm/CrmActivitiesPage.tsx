/**
 * The relationship timeline: eleven kinds of record, one chronology.
 *
 * WHY THE FILTERS ARE CHECKBOXES RATHER THAN A DROPDOWN.
 *
 * The question this view answers is usually a combination: "meetings and
 * decisions, but not the system noise", or "everything Concludo proposed that
 * somebody confirmed". A single-select dropdown makes those two or three
 * passes; checkboxes make them one. Each one shows the count it would leave, so
 * nobody filters their way to an empty screen without knowing why.
 *
 * `?focus=` deep links to a single entry, which is how source navigation lands
 * here from a value on another screen.
 */
import React from 'react';
import { useLocation } from 'react-router-dom';
import {
  IndependenceNote,
  Stage4Scaffold,
  TimelineList,
  useStage4,
} from '../../components/crm/Stage4Scaffold';
import {
  TIMELINE_KIND_LABELS,
  TIMELINE_SOURCE_LABELS,
  TimelineKind,
  TimelineSource,
  buildTimeline,
  filterTimeline,
  kindsPresent,
  sourcesPresent,
} from '../../lib/crm/stage4/timeline';

export const CrmActivitiesPage: React.FC = () => {
  const { data, linkTo, viewState } = useStage4();
  const location = useLocation();

  const focus = new URLSearchParams(location.search).get('focus');

  const all = React.useMemo(() => buildTimeline(data), [data]);

  const [kinds, setKinds] = React.useState<TimelineKind[]>([]);
  const [sources, setSources] = React.useState<TimelineSource[]>([]);

  // Changing workspace resets the filters, because a kind that existed in one
  // workspace may not exist in the next and a filter nobody can see is a filter
  // that makes a screen look empty for no stated reason.
  React.useEffect(() => {
    setKinds([]);
    setSources([]);
  }, [viewState.workspaceId]);

  const availableKinds = React.useMemo(() => kindsPresent(all), [all]);
  const availableSources = React.useMemo(() => sourcesPresent(all), [all]);

  const scoped = React.useMemo(
    () =>
      filterTimeline(all, {
        organisationId: viewState.organisationId === 'all' ? null : viewState.organisationId,
      }),
    [all, viewState.organisationId]
  );

  const entries = React.useMemo(() => {
    const filtered = filterTimeline(scoped, { kinds, sources });
    if (!focus) return filtered;
    const match = filtered.filter((e) => e.subjectId === focus || e.id === focus);
    return match.length > 0 ? match : filtered;
  }, [scoped, kinds, sources, focus]);

  const toggleKind = (kind: TimelineKind) =>
    setKinds((current) =>
      current.includes(kind) ? current.filter((k) => k !== kind) : [...current, kind]
    );

  const toggleSource = (source: TimelineSource) =>
    setSources((current) =>
      current.includes(source) ? current.filter((s) => s !== source) : [...current, source]
    );

  return (
    <Stage4Scaffold
      title="Relationship timeline"
      description="Meetings, emails, notes, calls, tasks, decisions, commitments, opportunity changes, service events, quotes and approved updates, in one chronology."
      loadingLabel="the timeline"
      emptyTitle="Nothing is recorded in this workspace yet"
      emptyBody="The timeline fills as conversations, decisions and changes are recorded."
      resultCount={entries.length}
      totalCount={all.length}
    >
      {focus ? (
        <p className="ccrm-focus-note" role="status">
          Showing the entry this value came from. Clear the focus in the address bar to see the whole
          timeline again.
        </p>
      ) : null}

      <div className="ccrm-filter-bar">
        <fieldset className="ccrm-filter-group">
          <legend className="ccrm-filter-legend">Type</legend>
          {availableKinds.map((kind) => {
            const count = filterTimeline(scoped, { kinds: [kind] }).length;
            return (
              <label className="ccrm-filter-option" key={kind}>
                <input
                  type="checkbox"
                  checked={kinds.includes(kind)}
                  onChange={() => toggleKind(kind)}
                />
                <span>{TIMELINE_KIND_LABELS[kind]}</span>
                <span className="ccrm-filter-count">{count}</span>
              </label>
            );
          })}
        </fieldset>

        <fieldset className="ccrm-filter-group">
          <legend className="ccrm-filter-legend">Source</legend>
          {availableSources.map((source) => {
            const count = filterTimeline(scoped, { sources: [source] }).length;
            return (
              <label className="ccrm-filter-option" key={source}>
                <input
                  type="checkbox"
                  checked={sources.includes(source)}
                  onChange={() => toggleSource(source)}
                />
                <span>{TIMELINE_SOURCE_LABELS[source]}</span>
                <span className="ccrm-filter-count">{count}</span>
              </label>
            );
          })}
        </fieldset>

        {kinds.length > 0 || sources.length > 0 ? (
          <button
            type="button"
            className="btn-secondary ccrm-button"
            onClick={() => {
              setKinds([]);
              setSources([]);
            }}
          >
            Show everything
          </button>
        ) : null}
      </div>

      <section className="ccrm-panel" aria-labelledby="ccrm-timeline-heading">
        {/* A real heading rather than an aria-label. The entries below are h4,
            and an h2 followed by an h4 is a level skipped, which is a heading
            outline a screen reader user navigates by. */}
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="ccrm-timeline-heading">
              Everything, in order
            </h3>
            <p className="ccrm-panel-description">
              Most recent first. Each entry says what kind of record it is and where it came from.
            </p>
          </div>
          <span className="ccrm-answer-count">{entries.length}</span>
        </div>
        <TimelineList
          entries={entries}
          linkTo={linkTo}
          emptyMessage="Nothing matches the types and sources you have selected."
        />
      </section>

      <IndependenceNote />
    </Stage4Scaffold>
  );
};
