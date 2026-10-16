/**
 * The pipeline, in three shapes.
 *
 * Kanban for "where is everything", list for "what do I do next", compact for a
 * phone. One composition behind all three, because three compositions is how a
 * column total disagrees with a row total in front of a customer.
 *
 * THE SHAPE IS CHOSEN, NOT GUESSED, WITH ONE EXCEPTION.
 *
 * Below 900 pixels the Kanban is not offered at all. A five-column board on a
 * 390 pixel screen is five columns of nothing, and the usual answer, horizontal
 * scrolling, is the thing the brief forbids for ordinary work. So the phone gets
 * the compact view and the control says why rather than showing a disabled
 * button with no explanation.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Columns3, List, Smartphone } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice } from '../../components/crm/Stage5Pieces';
import { Money, Value } from '../../components/crm/viewPrimitives';
import {
  PipelineCard,
  boardAsList,
  buildBoard,
  lostReasons,
  pipelinesIn,
} from '../../lib/crm/stage5/pipeline';

type Shape = 'kanban' | 'list' | 'compact';

const PHONE = '(max-width: 900px)';

function isPhone(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia(PHONE).matches;
}

/* ----------------------------------------------------------- one card */

const Card: React.FC<{ card: PipelineCard; linkTo: (p: string) => string; compact?: boolean }> = ({
  card,
  linkTo,
  compact,
}) => (
  <article className={`ccrm-kcard${card.stale ? ' ccrm-kcard-stale' : ''}`}>
    <h4 className="ccrm-kcard-title">
      <Link className="ccrm-text-link" to={linkTo(`/crm/work/${card.item.id}`)}>
        {card.item.title}
      </Link>
    </h4>

    <p className="ccrm-kcard-org">
      <Value value={card.organisationName} absent="No organisation recorded" />
    </p>

    <p className="ccrm-kcard-row">
      <span className="ccrm-kcard-value">
        <Money amount={card.expectedValue} basis={card.valueBasis} />
      </span>
      <span className="ccrm-kcard-date">
        <Value value={card.expectedCloseDate} absent="No date" />
      </span>
    </p>

    <p className="ccrm-kcard-row">
      <span className="ccrm-kcard-days">
        {card.daysInStage} days here
        {card.longerThanUsual ? `, where ${card.typicalDays} is usual` : ''}
      </span>
      {card.closeDateChanges.length > 0 ? (
        <span className="ccrm-kcard-moved">
          Date changed {card.closeDateChanges.length}&times;
        </span>
      ) : null}
    </p>

    <p className="ccrm-kcard-next">
      {card.nextStep ? (
        <>
          <span className="ccrm-kcard-next-what">{card.nextStep}</span>
          <span className="ccrm-kcard-next-when">
            {card.nextStepOverdueDays !== null
              ? `${card.nextStepOverdueDays} days past the date`
              : card.nextStepDue
                ? `due ${card.nextStepDue}`
                : 'no date agreed'}
          </span>
        </>
      ) : (
        <span className="ccrm-absent">No next step recorded</span>
      )}
    </p>

    {!compact ? (
      <>
        <p className="ccrm-kcard-contact">
          {card.daysSinceMeaningfulContact === null
            ? 'No conversation recorded with the customer'
            : `Last conversation ${card.daysSinceMeaningfulContact} days ago`}
        </p>

        {card.missing.length > 0 ? (
          <p className="ccrm-kcard-missing">Not recorded: {card.missing.join(', ')}</p>
        ) : null}

        {card.unmetRequired.length > 0 ? (
          <p className="ccrm-kcard-criteria">
            {card.unmetRequired.length} required{' '}
            {card.unmetRequired.length === 1 ? 'criterion' : 'criteria'} unmet at this stage
          </p>
        ) : null}
      </>
    ) : null}

    <p className={`ccrm-kcard-confidence ccrm-confidence-${card.confidence.strength.split(' ')[0]}`}>
      <span className="ccrm-kcard-confidence-word">{card.confidence.strength}</span>
      <span className="ccrm-kcard-confidence-note">{card.confidence.summary}</span>
    </p>

    {card.staleReason ? <p className="ccrm-kcard-stale-note">{card.staleReason}</p> : null}
    {card.reopened ? <p className="ccrm-kcard-reopened">Reopened. The history is intact.</p> : null}
  </article>
);

/* ---------------------------------------------------------------- page */

export const CrmPipelinePage: React.FC = () => {
  const { data, now, linkTo, viewState } = useStage4();

  const pipelines = React.useMemo(() => pipelinesIn(data), [data]);
  const [pipelineId, setPipelineId] = React.useState<string>('');

  const chosen =
    pipelines.find((p) => p.id === pipelineId)?.id ??
    (viewState.pipelineId !== 'all'
      ? pipelines.find((p) => p.id === viewState.pipelineId)?.id
      : undefined) ??
    pipelines[0]?.id ??
    '';

  const [shape, setShape] = React.useState<Shape>(() => (isPhone() ? 'compact' : 'kanban'));

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(PHONE);
    const onChange = (event: MediaQueryListEvent) =>
      setShape((current) =>
        event.matches ? 'compact' : current === 'compact' ? 'kanban' : current
      );
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const board = React.useMemo(
    () => (chosen ? buildBoard(data, chosen, now) : null),
    [data, chosen, now]
  );

  const list = React.useMemo(() => (board ? boardAsList(board) : []), [board]);
  const lost = React.useMemo(() => (board ? lostReasons(board) : []), [board]);

  const phone = isPhone();

  return (
    <Stage4Scaffold
      title="Pipeline"
      description={
        board
          ? `${board.recordsPlural} by stage, with how long each has been there and what is recorded against it.`
          : 'Open work by stage.'
      }
      loadingLabel="the pipeline"
      emptyTitle="No pipeline is configured in this workspace"
      emptyBody="A pipeline is a named set of stages. Work moves through them, and each stage can declare what has to be true before something leaves it."
      resultCount={board?.openCount ?? 0}
      totalCount={data.pipelines.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <div className="ccrm-pipeline-controls">
        {pipelines.length > 1 ? (
          <div className="ccrm-workspace-picker">
            <label className="ccrm-workspace-label" htmlFor="ccrm-pipeline-pick">
              Pipeline
            </label>
            <select
              id="ccrm-pipeline-pick"
              className="form-select ccrm-workspace-select"
              value={chosen}
              onChange={(event) => setPipelineId(event.target.value)}
            >
              {pipelines.map((pipeline) => (
                <option key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="ccrm-shape-picker" role="group" aria-label="How to show the pipeline">
          {!phone ? (
            <button
              type="button"
              className={`ccrm-shape ${shape === 'kanban' ? 'ccrm-shape-on' : ''}`}
              aria-pressed={shape === 'kanban'}
              onClick={() => setShape('kanban')}
            >
              <Columns3 size={14} aria-hidden="true" />
              Board
            </button>
          ) : null}
          <button
            type="button"
            className={`ccrm-shape ${shape === 'list' ? 'ccrm-shape-on' : ''}`}
            aria-pressed={shape === 'list'}
            onClick={() => setShape('list')}
          >
            <List size={14} aria-hidden="true" />
            List
          </button>
          <button
            type="button"
            className={`ccrm-shape ${shape === 'compact' ? 'ccrm-shape-on' : ''}`}
            aria-pressed={shape === 'compact'}
            onClick={() => setShape('compact')}
          >
            <Smartphone size={14} aria-hidden="true" />
            Compact
          </button>
        </div>
      </div>

      {phone ? (
        <p className="ccrm-shape-note" role="note">
          The board is not offered on a narrow screen. Five columns on a phone is five columns of
          nothing, and the usual fix, scrolling sideways, is the thing this module will not do.
        </p>
      ) : null}

      {!board ? (
        <p className="ccrm-panel-empty">That pipeline is not in this workspace.</p>
      ) : (
        <>
          <ul className="ccrm-card-rail">
            <li>
              <span className="ccrm-card">
                <span className="ccrm-card-count">{board.openCount}</span>
                <span className="ccrm-card-label">Open</span>
                <span className="ccrm-card-note">
                  {board.recordsPlural} that are neither won nor closed.
                </span>
              </span>
            </li>
            <li>
              <span className={`ccrm-card${board.staleCount > 0 ? ' ccrm-card-attention' : ''}`}>
                <span className="ccrm-card-count">{board.staleCount}</span>
                <span className="ccrm-card-label">Gone quiet</span>
                <span className="ccrm-card-note">
                  Nothing recorded for longer than this workspace usually takes, or nothing
                  recorded at all. Each one says which.
                </span>
              </span>
            </li>
            <li>
              <span className="ccrm-card">
                <span className="ccrm-card-count">{board.closed.length}</span>
                <span className="ccrm-card-label">Resolved</span>
                <span className="ccrm-card-note">Won or closed, with the reason recorded.</span>
              </span>
            </li>
          </ul>

          {shape === 'kanban' && !phone ? (
            <div className="ccrm-board" role="group" aria-label={`${board.pipeline.name} board`}>
              {board.columns.map((column) => (
                <section className="ccrm-column" key={column.stage.id}>
                  <header className="ccrm-column-head">
                    <h3 className="ccrm-column-title">{column.stage.name}</h3>
                    <span className="ccrm-column-count">{column.cards.length}</span>
                    <p className="ccrm-column-value">
                      {column.recordedValue === null
                        ? 'No figures recorded'
                        : new Intl.NumberFormat('en-AU', {
                            style: 'currency',
                            currency: 'AUD',
                            maximumFractionDigits: 0,
                          }).format(column.recordedValue)}
                    </p>
                    {/* A total that silently omits rows is a wrong number, so
                        it says what it left out. An empty stage says so once,
                        below, rather than twice. */}
                    {column.cards.length > 0 && (
                      <p className="ccrm-column-note">{column.valueNote}</p>
                    )}
                  </header>

                  {column.cards.length === 0 ? (
                    <p className="ccrm-column-empty">Nothing is at this stage.</p>
                  ) : (
                    column.cards.map((card) => (
                      <Card key={card.item.id} card={card} linkTo={linkTo} />
                    ))
                  )}
                </section>
              ))}
            </div>
          ) : null}

          {shape === 'list' ? (
            <section className="ccrm-panel" aria-label="Pipeline as a list">
              <p className="ccrm-panel-description">
                Ordered by what is overdue and what has gone quiet, with the reason on each row.
                Nothing here ranks a person.
              </p>
              <div className="ccrm-table-wrap" tabIndex={0} role="group" aria-label="Pipeline, scrollable">
                <table className="ccrm-table">
                  <caption className="ccrm-visually-hidden">
                    {board.pipeline.name}, {board.openCount} open
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">{board.recordsPlural.replace(/s$/, '')}</th>
                      <th scope="col">Stage</th>
                      <th scope="col" className="ccrm-col-narrow">Days here</th>
                      <th scope="col">Next step</th>
                      <th scope="col" className="ccrm-col-narrow">Value</th>
                      <th scope="col" className="ccrm-col-narrow">Expected</th>
                      <th scope="col">What the record carries</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((card) => (
                      <tr key={card.item.id}>
                        <th scope="row">
                          <span className="ccrm-cell-stack">
                            <Link
                              className="ccrm-cell-strong ccrm-text-link"
                              to={linkTo(`/crm/work/${card.item.id}`)}
                            >
                              {card.item.title}
                            </Link>
                            <span className="ccrm-cell-quiet">
                              <Value value={card.organisationName} absent="No organisation" />
                            </span>
                          </span>
                        </th>
                        <td>{card.stage.name}</td>
                        <td className="ccrm-col-narrow">
                          {card.daysInStage}
                          {card.longerThanUsual ? (
                            <span className="ccrm-cell-quiet"> of {card.typicalDays} usual</span>
                          ) : null}
                        </td>
                        <td>
                          <span className="ccrm-cell-stack">
                            <Value value={card.nextStep} absent="No next step recorded" />
                            {card.nextStepOverdueDays !== null ? (
                              <span className="ccrm-cell-quiet">
                                {card.nextStepOverdueDays} days past the date
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="ccrm-col-narrow">
                          <Money amount={card.expectedValue} basis={card.valueBasis} />
                        </td>
                        <td className="ccrm-col-narrow">
                          <span className="ccrm-cell-stack">
                            <Value value={card.expectedCloseDate} absent="No date" />
                            {card.closeDateChanges.length > 0 ? (
                              <span className="ccrm-cell-quiet">
                                changed {card.closeDateChanges.length}&times;
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td>
                          <span className="ccrm-cell-stack">
                            <span>{card.confidence.strength}</span>
                            {card.missing.length > 0 ? (
                              <span className="ccrm-cell-quiet">
                                Not recorded: {card.missing.join(', ')}
                              </span>
                            ) : null}
                            {card.staleReason ? (
                              <span className="ccrm-cell-quiet">{card.staleReason}</span>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {shape === 'compact' ? (
            <section className="ccrm-panel" aria-label="Pipeline, compact">
              <p className="ccrm-panel-description">
                One line of work at a time, ordered by what is overdue. Built for a phone.
              </p>
              <div className="ccrm-compact-list">
                {list.map((card) => (
                  <div className="ccrm-compact-row" key={card.item.id}>
                    <span className="ccrm-compact-stage">{card.stage.name}</span>
                    <Card card={card} linkTo={linkTo} compact />
                  </div>
                ))}
                {list.length === 0 ? (
                  <p className="ccrm-panel-empty">Nothing is open in this pipeline.</p>
                ) : null}
              </div>
            </section>
          ) : null}

          {board.closed.length > 0 ? (
            <section className="ccrm-panel" aria-labelledby="ccrm-closed">
              <div className="ccrm-panel-head">
                <div>
                  <h3 className="ccrm-panel-title" id="ccrm-closed">
                    Resolved, and why
                  </h3>
                  <p className="ccrm-panel-description">
                    A record that is closed keeps its reason. In six months it is the only thing
                    anybody wants to know, and it can be reopened without losing any of it.
                  </p>
                </div>
              </div>

              {lost.length > 0 ? (
                <ul className="ccrm-lost-reasons">
                  {lost.map((entry) => (
                    <li key={entry.reason}>
                      {/* The count says what it counts. A bare numeral beside a
                          sentence reads as a list marker, not as a tally. */}
                      <span className="ccrm-lost-count">
                        {entry.count} {entry.count === 1 ? 'record' : 'records'}
                      </span>
                      <span className="ccrm-lost-reason">{entry.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <ul className="ccrm-item-list">
                {board.closed.map((card) => (
                  <li key={card.item.id}>
                    <Link className="ccrm-item" to={linkTo(`/crm/work/${card.item.id}`)}>
                      <span className="ccrm-item-main">
                        <span className="ccrm-item-title">{card.item.title}</span>
                        <span className="ccrm-item-context">
                          {card.item.status === 'won' ? 'Won' : 'Not proceeding'}
                          {card.item.resolvedAt ? `, ${card.item.resolvedAt.slice(0, 10)}` : ''}
                        </span>
                        <span className="ccrm-reason">
                          <span className="ccrm-reason-text">
                            <Value
                              value={card.item.resolutionReason}
                              absent="No reason was recorded."
                            />
                          </span>
                        </span>
                      </span>
                      <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </Stage4Scaffold>
  );
};
