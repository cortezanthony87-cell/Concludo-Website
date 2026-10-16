/**
 * Data-quality review: seven neutral indicators, by record.
 *
 * THE WORD THAT DOES THE WORK IS "NEUTRAL".
 *
 * It is easy to satisfy in a type and break in the copy, so three things hold
 * on this screen:
 *
 *   Every indicator describes the RECORD. There is no owner column anywhere on
 *   this page, no count by person, and nothing to sort by that would produce
 *   one. A league table of whose records carry the most flags is one `groupBy`
 *   away from any other design, and that is exactly why it is absent here.
 *
 *   Every indicator says what would resolve it. A list of problems with no
 *   route out is a list people learn to close.
 *
 *   The counts at the top are counts of RECORDS in each condition, not a score
 *   out of anything. There is no total and nothing adds up to a percentage.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { SourceTrailList, Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Value } from '../../components/crm/viewPrimitives';
import {
  QUALITY_LABELS,
  QUALITY_ORDER,
  QualityFlagKind,
  countByKind,
  workspaceFlags,
} from '../../lib/crm/stage4/quality';
import { openConflicts } from '../../lib/crm/stage4/sources';
import {
  DASHBOARD_NOTE,
  Indicator,
  buildDataQualityDashboard,
} from '../../lib/crm/stage8/dataQuality';
import { qualityFigure } from '../../lib/crm/stage8/qualitySource';

const WHAT_IT_MEANS: Record<QualityFlagKind, string> = {
  missing: 'Something the record needs to be useful is not written down.',
  unconfirmed: 'A value was worked out rather than stated, and nobody has checked it.',
  stale: 'Nothing has been recorded against this for a long time.',
  conflicting: 'Two recorded values disagree and neither has been withdrawn.',
  duplicate_candidate: 'This may be the same record as another. Nothing is merged without a decision.',
  source_unavailable: 'A value is recorded and the source it came from cannot be opened.',
  review_recommended: 'Something here needs a person to settle it.',
};

const STATE_WORD: Record<Indicator['state'], string> = {
  clear: 'Nothing to do',
  nothing_to_measure: 'Nothing to measure yet',
  attention: 'Worth a look',
};

/**
 * One of the ten indicators.
 *
 * The state is shown as a word rather than as a colour alone, because a colour
 * is the one thing a reader with no colour vision does not get, and because
 * "nothing to measure" and "nothing to do" look identical as a green zero while
 * meaning opposite things.
 */
const IndicatorCard: React.FC<{ indicator: Indicator; linkTo: (p: string) => string }> = ({
  indicator,
  linkTo,
}) => (
  <section
    className={`ccrm-panel ccrm-indicator ccrm-indicator-${indicator.state}`}
    aria-labelledby={`ind-${indicator.key}`}
  >
    <div className="ccrm-panel-head">
      <div>
        <h4 className="ccrm-panel-title" id={`ind-${indicator.key}`}>
          {indicator.label}
        </h4>
        <p className="ccrm-panel-description">{indicator.meaning}</p>
      </div>
      <span className="ccrm-answer-count">
        {indicator.count}
        {indicator.unit === 'percent' ? '%' : ''}
      </span>
    </div>

    <p className="ccrm-indicator-state">
      <span className="ccrm-mark">{STATE_WORD[indicator.state]}</span>
      {indicator.outOf !== null ? (
        <span className="ccrm-cell-quiet">
          {indicator.unit === 'percent'
            ? `Across ${indicator.outOf} recorded values.`
            : `Out of ${indicator.outOf}.`}
        </span>
      ) : null}
    </p>

    {indicator.zeroBecause ? (
      <p className="ccrm-reason-text">{indicator.zeroBecause}</p>
    ) : (
      <p className="ccrm-flag-resolution">{indicator.whatToDo}</p>
    )}

    {indicator.subjects.length > 0 ? (
      <ul className="ccrm-item-list">
        {indicator.subjects.map((subject) => (
          <li key={`${subject.table}-${subject.id}`}>
            <span className="ccrm-item">
              <span className="ccrm-item-main">
                <span className="ccrm-item-title">
                  {subject.path ? (
                    <Link className="ccrm-text-link" to={linkTo(subject.path)}>
                      {subject.name}
                    </Link>
                  ) : (
                    subject.name
                  )}
                </span>
                <span className="ccrm-item-context">{subject.detail}</span>
              </span>
            </span>
          </li>
        ))}
      </ul>
    ) : null}
  </section>
);

export const CrmDataQualityPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();

  // The per-record sweep is capped by size. In a workspace of a hundred
  // thousand records this page lists what the nightly job found and says when
  // it ran, rather than spending six seconds assembling a figure while
  // somebody waits for it.
  const figure = React.useMemo(() => qualityFigure(data, now), [data, now]);
  const records = React.useMemo(() => figure.flags ?? [], [figure]);
  const dashboard = React.useMemo(() => buildDataQualityDashboard(data, now), [data, now]);
  const counts = React.useMemo(() => countByKind(records), [records]);
  const conflicts = React.useMemo(() => openConflicts(data), [data]);

  const [kind, setKind] = React.useState<QualityFlagKind | 'all'>('all');

  const shown =
    kind === 'all' ? records : records.filter((r) => r.flags.some((f) => f.kind === kind));

  const pathFor = (table: string, id: string): string | null => {
    if (table === 'crm_people') return `/crm/people/${id}`;
    if (table === 'crm_organisations') return `/crm/organisations/${id}`;
    return null;
  };

  return (
    <Stage4Scaffold
      title="Data-quality review"
      description="What is missing, unconfirmed, stale, conflicting, possibly duplicated or unsourced, by record."
      loadingLabel="the data-quality review"
      emptyTitle="Nothing is recorded in this workspace yet"
      emptyBody="Records appear here with their indicators as they are added."
      resultCount={shown.length}
      totalCount={records.length}
    >
      <p className="ccrm-not-ranked ccrm-policy" role="note">
        {DASHBOARD_NOTE} Every indicator here is about a record, never about a person. There is no owner column on
        this page and nothing to sort by that would produce one, because a list of whose records
        carry the most flags is a performance tool wearing a data-quality name.
      </p>

      <h3 className="ccrm-group-title">
        The ten indicators
        <span className="ccrm-stage-count">{dashboard.needingAttention} worth a look</span>
      </h3>
      <p className="ccrm-section-description">
        {dashboard.nothingToMeasure > 0
          ? `${dashboard.nothingToMeasure} of the ten ${dashboard.nothingToMeasure === 1 ? 'is zero' : 'are zero'} because there is nothing there to measure yet, which is said on each one rather than shown as a healthy zero.`
          : 'Every indicator has something to measure.'}
      </p>

      <div className="ccrm-panel-grid">
        {dashboard.indicators.map((indicator) => (
          <IndicatorCard indicator={indicator} key={indicator.key} linkTo={linkTo} />
        ))}
      </div>

      {dashboard.namedOwners.length > 0 ? (
        <p className="ccrm-section-description">
          Data quality is named to{' '}
          {dashboard.namedOwners.length === 1
            ? 'one person'
            : `${dashboard.namedOwners.length} people`}{' '}
          in this workspace, across{' '}
          {dashboard.namedOwners.reduce((sum, owner) => sum + owner.recordCount, 0)} records. That is
          responsibility for a record. It is never counted against the person named.
        </p>
      ) : null}

      <h3 className="ccrm-group-title">By indicator, per record</h3>
      <p className="ccrm-section-description">{figure.note}</p>
      {figure.whatWouldFixIt ? (
        <p className="ccrm-reason-text">{figure.whatWouldFixIt}</p>
      ) : null}

      <ul className="ccrm-card-rail">
        {QUALITY_ORDER.map((candidate) => (
          <li key={candidate}>
            <button
              type="button"
              className={`ccrm-card ccrm-card-button${kind === candidate ? ' ccrm-card-attention' : ''}`}
              aria-pressed={kind === candidate}
              onClick={() => setKind(kind === candidate ? 'all' : candidate)}
            >
              <span className="ccrm-card-count">{counts[candidate]}</span>
              <span className="ccrm-card-label">{QUALITY_LABELS[candidate]}</span>
              <span className="ccrm-card-note">{WHAT_IT_MEANS[candidate]}</span>
            </button>
          </li>
        ))}
      </ul>

      {conflicts.length > 0 ? (
        <section className="ccrm-panel ccrm-panel-lead" aria-labelledby="ccrm-conflicts">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="ccrm-conflicts">
                Conflicting information
              </h3>
              <p className="ccrm-panel-description">
                Two live values for the same field, with both sources. Neither wins until somebody
                decides, which is why both are shown.
              </p>
            </div>
            <span className="ccrm-answer-count">{conflicts.length}</span>
          </div>

          {conflicts.map((pair) => (
            <div className="ccrm-conflict" key={pair.map((t) => t.evidenceId).join('|')}>
              <h4 className="ccrm-conflict-field">{pair[0].fieldName}</h4>
              <SourceTrailList trails={pair} linkTo={linkTo} />
            </div>
          ))}
        </section>
      ) : null}

      <h3 className="ccrm-group-title">
        {kind === 'all' ? 'Every record with something recorded against it' : QUALITY_LABELS[kind]}
        <span className="ccrm-stage-count">{shown.length}</span>
      </h3>

      {kind !== 'all' ? (
        <p className="ccrm-section-description">
          {WHAT_IT_MEANS[kind]} Press the card again to see everything.
        </p>
      ) : null}

      {shown.length === 0 ? (
        <p className="ccrm-panel-empty">
          No record in this workspace carries that indicator.
        </p>
      ) : (
        <div className="ccrm-panel-grid">
          {shown.map((record) => {
            const path = pathFor(record.subjectTable, record.subjectId);
            return (
              <section
                className="ccrm-panel"
                key={`${record.subjectTable}-${record.subjectId}`}
                aria-labelledby={`dq-${record.subjectId}`}
              >
                <div className="ccrm-panel-head">
                  <div>
                    <h4 className="ccrm-panel-title" id={`dq-${record.subjectId}`}>
                      {path ? (
                        <Link className="ccrm-text-link" to={linkTo(path)}>
                          {record.name}
                        </Link>
                      ) : (
                        record.name
                      )}
                    </h4>
                    <p className="ccrm-panel-description">
                      <Value value={record.context} absent="No context recorded" />
                    </p>
                  </div>
                </div>

                <ul className="ccrm-flag-list">
                  {record.flags.map((flag, index) => (
                    <li className={`ccrm-flag ccrm-flag-${flag.kind}`} key={`${flag.kind}-${index}`}>
                      <span className="ccrm-flag-label">{QUALITY_LABELS[flag.kind]}</span>
                      <span className="ccrm-flag-detail">{flag.detail}</span>
                      <span className="ccrm-flag-resolution">{flag.resolution}</span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </Stage4Scaffold>
  );
};
