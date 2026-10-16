/**
 * Two forecasts, side by side, labelled, never added together.
 *
 * The layout carries the argument. The human forecast is on the left under a
 * heading that says a person said it. The system estimate is on the right under
 * a heading that says it is a description of the record. Between them is the
 * list of places where they disagree, which is the only part anybody should
 * take into a meeting.
 *
 * There is no combined number anywhere on this page, and there is nothing to
 * press that would produce one. A blended figure carries the authority of
 * arithmetic and the accountability of nobody.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { Field, RolePicker, WriteNotice } from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import {
  CATEGORY_LABELS,
  CATEGORY_MEANINGS,
  ForecastCategory,
  buildForecast,
  submitForecast,
} from '../../lib/crm/stage5/forecast';
import { pipelinesIn } from '../../lib/crm/stage5/pipeline';
import { notifyWritten } from '../../lib/crm/stage5/session';

const money = (amount: number): string =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(amount);

const CATEGORIES: ForecastCategory[] = ['commit', 'best_case', 'pipeline', 'omitted'];

export const CrmForecastPage: React.FC = () => {
  const { data, now, linkTo } = useStage4();
  const pipelines = React.useMemo(() => pipelinesIn(data), [data]);

  const [pipelineId, setPipelineId] = React.useState<string | null>(null);
  const [, bump] = React.useState(0);

  const forecast = React.useMemo(
    () => buildForecast(data, pipelineId, now),
    [data, pipelineId, now]
  );

  const [submitFor, setSubmitFor] = React.useState<string | null>(null);
  const [category, setCategory] = React.useState<ForecastCategory>('best_case');
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const member = data.members[0];

  return (
    <Stage4Scaffold
      title="Forecast"
      description="What people have said will close, and what the record actually carries. Two views, never merged."
      loadingLabel="the forecast"
      emptyTitle="No open work in this workspace"
      emptyBody="A forecast appears here once work is open in a pipeline."
      resultCount={forecast.system.items.length}
      totalCount={data.workItems.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy ccrm-not-ranked" role="note">
        There is no combined number on this page and nothing to press that would produce one. A
        blended figure carries the authority of arithmetic and the accountability of nobody.
        Nothing here measures a person, and no view of this data is broken down by who owns what.
      </p>

      {pipelines.length > 1 ? (
        <div className="ccrm-workspace-picker">
          <label className="ccrm-workspace-label" htmlFor="ccrm-forecast-pipeline">
            Pipeline
          </label>
          <select
            id="ccrm-forecast-pipeline"
            className="form-select ccrm-workspace-select"
            value={pipelineId ?? ''}
            onChange={(event) => setPipelineId(event.target.value || null)}
          >
            <option value="">Every pipeline</option>
            {pipelines.map((pipeline) => (
              <option key={pipeline.id} value={pipeline.id}>
                {pipeline.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="ccrm-forecast-pair">
        {/* ------------------------------------------- the human forecast */}
        <section className="ccrm-panel ccrm-forecast-human" aria-labelledby="f-human">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="f-human">
                What people have said
              </h3>
              <p className="ccrm-panel-description">
                A forecast is a statement somebody made and will stand behind. It has an author,
                which is what makes it accountable.
              </p>
            </div>
            <span className="ccrm-answer-count">
              {forecast.human.submittedCount} of {forecast.human.totalOpen}
            </span>
          </div>

          <ul className="ccrm-forecast-bands">
            {CATEGORIES.map((key) => (
              <li className={`ccrm-forecast-band ccrm-band-${key}`} key={key}>
                <span className="ccrm-band-label">{CATEGORY_LABELS[key]}</span>
                <span className="ccrm-band-amount">
                  {forecast.human.byCategory[key].amount > 0
                    ? money(forecast.human.byCategory[key].amount)
                    : 'Nothing'}
                </span>
                <span className="ccrm-band-count">
                  {forecast.human.byCategory[key].count}{' '}
                  {forecast.human.byCategory[key].count === 1 ? 'item' : 'items'}
                </span>
                <span className="ccrm-band-meaning">{CATEGORY_MEANINGS[key]}</span>
              </li>
            ))}
          </ul>

          {forecast.human.notSubmitted.length > 0 ? (
            <p className="ccrm-forecast-gap">
              {forecast.human.notSubmitted.length} open{' '}
              {forecast.human.notSubmitted.length === 1 ? 'item has' : 'items have'} no view
              submitted at all. That gap is itself worth knowing before a meeting.
            </p>
          ) : null}
        </section>

        {/* ------------------------------------------ the system estimate */}
        <section className="ccrm-panel ccrm-forecast-system" aria-labelledby="f-system">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="f-system">
                What the record carries
              </h3>
              <p className="ccrm-panel-description ccrm-policy">
                {forecast.system.disclaimer}
              </p>
            </div>
          </div>

          <ul className="ccrm-forecast-bands">
            {(
              [
                'the record supports this closing',
                'the record is thin',
                'the record points the other way',
              ] as const
            ).map((band) => (
              <li className="ccrm-forecast-band" key={band}>
                <span className="ccrm-band-label">{band}</span>
                <span className="ccrm-band-amount">
                  {forecast.system.byBand[band].recordedValue > 0
                    ? money(forecast.system.byBand[band].recordedValue)
                    : 'No figures recorded'}
                </span>
                <span className="ccrm-band-count">
                  {forecast.system.byBand[band].count}{' '}
                  {forecast.system.byBand[band].count === 1 ? 'item' : 'items'}
                </span>
                {/* A total that silently omits rows is a wrong number. */}
                <span className="ccrm-band-meaning">
                  {forecast.system.byBand[band].count === 0
                    ? 'No open work is in this group.'
                    : forecast.system.byBand[band].withoutValue > 0
                    ? `${forecast.system.byBand[band].withoutValue} of them have no figure recorded, so this total is lower than the real one.`
                    : 'Every item here has a figure recorded.'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* ------------------------------------------------- disagreements */}
      {forecast.disagreements.length > 0 ? (
        <section className="ccrm-panel ccrm-panel-lead" aria-labelledby="f-gap">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="f-gap">
                Where the two disagree
              </h3>
              <p className="ccrm-panel-description">
                This is the useful part, and the reason both views exist. A gap is usually not a
                sign that somebody is wrong. It is a sign that something they know is not written
                down, and the fix is two minutes of typing rather than an argument.
              </p>
            </div>
            <span className="ccrm-answer-count">{forecast.disagreements.length}</span>
          </div>

          <ul className="ccrm-item-list">
            {forecast.disagreements.map((entry) => (
              <li key={entry.workItemId}>
                <Link className="ccrm-item" to={linkTo(`/crm/work/${entry.workItemId}`)}>
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{entry.title}</span>
                    <span className="ccrm-item-context">
                      {entry.human
                        ? `${CATEGORY_LABELS[entry.human.category]}, and ${entry.estimate.band}`
                        : `Nothing submitted, and ${entry.estimate.band}`}
                    </span>
                    <span className="ccrm-reason">
                      <span className="ccrm-standing ccrm-standing-review">Needs review</span>
                      <span className="ccrm-reason-text">{entry.disagreement}</span>
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* -------------------------------------------- every item, explained */}
      <h3 className="ccrm-group-title">
        Every open item, with both views
        <span className="ccrm-stage-count">{forecast.comparison.length}</span>
      </h3>

      {forecast.comparison.length === 0 ? (
        <p className="ccrm-panel-empty">Nothing is open in this pipeline.</p>
      ) : (
        <div className="ccrm-panel-grid">
          {forecast.comparison.map((entry) => (
            <section className="ccrm-panel" key={entry.workItemId} aria-labelledby={`f-${entry.workItemId}`}>
              <div className="ccrm-panel-head">
                <div>
                  <h4 className="ccrm-panel-title" id={`f-${entry.workItemId}`}>
                    <Link className="ccrm-text-link" to={linkTo(`/crm/work/${entry.workItemId}`)}>
                      {entry.title}
                    </Link>
                  </h4>
                  <p className="ccrm-panel-description">
                    <Value
                      value={entry.estimate.card.organisationName}
                      absent="No organisation recorded"
                    />
                    , {entry.estimate.card.stage.name}
                  </p>
                </div>
              </div>

              <div className="ccrm-two-views">
                <div className="ccrm-one-view">
                  <h5 className="ccrm-sub-heading">A person said</h5>
                  {entry.human ? (
                    <>
                      <p className="ccrm-view-value">{CATEGORY_LABELS[entry.human.category]}</p>
                      <p className="ccrm-view-note">
                        {entry.human.amount !== null ? money(entry.human.amount) : 'No figure given'}
                        {entry.human.expectedCloseDate
                          ? `, by ${entry.human.expectedCloseDate}`
                          : ''}
                      </p>
                      {entry.human.note ? (
                        <p className="ccrm-view-note">&ldquo;{entry.human.note}&rdquo;</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="ccrm-panel-empty">Nothing submitted.</p>
                  )}

                  {submitFor === entry.workItemId ? (
                    <div className="ccrm-submit-forecast">
                      <Field label="Category" id={`cat-${entry.workItemId}`} required>
                        <select
                          id={`cat-${entry.workItemId}`}
                          className="form-select"
                          value={category}
                          onChange={(event) =>
                            setCategory(event.target.value as ForecastCategory)
                          }
                        >
                          {CATEGORIES.map((key) => (
                            <option key={key} value={key}>
                              {CATEGORY_LABELS[key]}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field
                        label="Why you are sure"
                        id={`note-${entry.workItemId}`}
                        required={category === 'commit'}
                        hint="Required on a commitment. A number nobody can explain is a number nobody should plan with."
                      >
                        <input
                          id={`note-${entry.workItemId}`}
                          className="form-input"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                        />
                      </Field>
                      {error ? <p className="ccrm-write-result ccrm-write-result-refused">{error}</p> : null}
                      <button
                        type="button"
                        className="btn-secondary ccrm-button ccrm-button-primary"
                        onClick={() => {
                          try {
                            submitForecast({
                              workItemId: entry.workItemId,
                              category,
                              amount: entry.estimate.recordedValue,
                              expectedCloseDate: entry.estimate.item.expectedCloseDate,
                              submittedBy: member?.userId ?? 'unknown',
                              submittedAt: now,
                              note: note || null,
                            });
                            setError(null);
                            setSubmitFor(null);
                            setNote('');
                            notifyWritten();
                            bump((n) => n + 1);
                          } catch (e) {
                            setError(e instanceof Error ? e.message : 'That did not work.');
                          }
                        }}
                      >
                        Submit it
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="btn-secondary ccrm-button"
                      onClick={() => {
                        setSubmitFor(entry.workItemId);
                        setError(null);
                      }}
                    >
                      {entry.human ? 'Change it' : 'Submit a view'}
                    </button>
                  )}
                </div>

                <div className="ccrm-one-view">
                  <h5 className="ccrm-sub-heading">The record carries</h5>
                  <p className="ccrm-view-value">{entry.estimate.band}</p>
                  <p className="ccrm-view-note">{entry.estimate.explanation}</p>

                  <details className="ccrm-factors-shell">
                    <summary className="ccrm-factors-summary">
                      All ten factors, with the fact behind each
                    </summary>
                    <ul className="ccrm-factor-list">
                      {entry.estimate.factors.map((factor) => (
                        <li
                          className={`ccrm-factor ccrm-factor-${factor.direction}`}
                          key={factor.name}
                        >
                          <span className="ccrm-factor-name">{factor.name}</span>
                          <span className="ccrm-factor-fact">{factor.fact}</span>
                          <span className="ccrm-factor-direction">{factor.direction}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                </div>
              </div>

              {entry.disagreement ? (
                <p className="ccrm-disagreement">{entry.disagreement}</p>
              ) : null}
            </section>
          ))}
        </div>
      )}
    </Stage4Scaffold>
  );
};
