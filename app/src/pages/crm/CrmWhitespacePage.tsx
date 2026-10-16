/**
 * The whitespace grid.
 *
 * THE ONE THING THIS PAGE MUST NOT DO.
 *
 * It must not make "not known yet" look like "no". Every design instinct pulls
 * the other way: grey reads as empty, empty reads as nothing to do, and a grid
 * of mostly grey looks like a grid nobody has filled in. So on this page the
 * unknown cells are the loudest thing on it. They carry a visible mark, they
 * are counted at the top, and the page says in words what the grey means before
 * anybody reads a single cell.
 *
 * The second rule follows from the first: a cell that was DERIVED from an open
 * quote says so, and a cell somebody answered says who answered it. A reader
 * who cannot tell "we checked" from "we guessed" will quote the guess.
 *
 * ACCESSIBILITY NOTE. The state of every cell is a word, not only a colour and
 * not only a shape. A grid that encodes five states in five fills fails SC
 * 1.4.1 and fails anybody printing it in black and white for a meeting.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, WriteResultLine, useCrmWrite } from '../../components/crm/Stage5Pieces';
import {
  AXIS_WORDS,
  WHITESPACE_STATE_MEANINGS,
  WHITESPACE_STATE_WORDS,
  axesWithData,
  buildWhitespaceGrid,
  questionsWorthAsking,
} from '../../lib/crm/stage6/whitespace';
import { setWhitespace } from '../../lib/crm/stage6/planWrites';
import { planningEnabled } from '../../lib/crm/stage6/visibility';
import { WhitespaceAxis, WhitespaceState } from '../../lib/crm/domain';

const STATE_ORDER: WhitespaceState[] = [
  'unknown',
  'in_use',
  'potential_need',
  'open_opportunity',
  'not_relevant',
];

export const CrmWhitespacePage: React.FC = () => {
  const { data, linkTo } = useStage4();
  const { organisationId } = useParams<{ organisationId: string }>();
  const write = useCrmWrite();

  const axes = React.useMemo(
    () => (organisationId ? axesWithData(data, organisationId) : []),
    [data, organisationId]
  );
  const [axis, setAxis] = React.useState<WhitespaceAxis>('business_unit');

  const chosen = axes.includes(axis) ? axis : (axes[0] ?? 'business_unit');

  const grid = React.useMemo(
    () =>
      organisationId && planningEnabled(data)
        ? buildWhitespaceGrid(data, organisationId, chosen)
        : null,
    [data, organisationId, chosen]
  );

  if (!grid) {
    return (
      <Stage4Scaffold
        title="No whitespace grid here"
        description="Either account planning is off in this workspace, or this account is not in it."
        loadingLabel="the whitespace grid"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
      >
        <p className="ccrm-panel-empty">
          <Link className="ccrm-text-link" to={linkTo('/crm/organisations')}>
            Back to organisations
          </Link>
        </p>
      </Stage4Scaffold>
    );
  }

  const questions = questionsWorthAsking(grid);

  return (
    <Stage4Scaffold
      title={`Whitespace: ${grid.organisation.name}`}
      description="What they use, where, and what nobody has asked."
      loadingLabel="the whitespace grid"
      emptyTitle="Nothing is recorded against this account yet"
      emptyBody="The grid appears once somebody records a business unit, site or region for this account."
      resultCount={grid.empty ? 0 : grid.totalCells}
      totalCount={grid.totalCells}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy ccrm-unknown-note" role="note">
        {grid.unknownNote}
      </p>

      <Link className="ccrm-back-link" to={linkTo(`/crm/account-plans/${grid.organisation.id}`)}>
        Back to the account plan
      </Link>

      {axes.length > 1 ? (
        <div className="ccrm-shape-row" role="group" aria-label="Which places to show">
          {axes.map((option) => (
            <button
              type="button"
              key={option}
              className={`ccrm-shape ${chosen === option ? 'ccrm-shape-on' : ''}`}
              aria-pressed={chosen === option}
              onClick={() => setAxis(option)}
            >
              {AXIS_WORDS[option]}
            </button>
          ))}
        </div>
      ) : null}

      <ul className="ccrm-card-rail">
        {STATE_ORDER.map((state) => (
          <li key={state}>
            <span className={`ccrm-card ccrm-ws-card-${state}`}>
              <span className="ccrm-card-count">{grid.counts[state]}</span>
              <span className="ccrm-card-label">{WHITESPACE_STATE_WORDS[state]}</span>
              <span className="ccrm-card-note">{WHITESPACE_STATE_MEANINGS[state]}</span>
            </span>
          </li>
        ))}
      </ul>

      {grid.empty ? (
        <p className="ccrm-panel-empty">
          No business unit, site or region is recorded for this account, so there is nothing to lay
          a grid over. Concludo does not invent places a customer might have.
        </p>
      ) : (
        <section className="ccrm-panel" aria-labelledby="ws-grid">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="ws-grid">
                By {grid.axisWord.toLowerCase()}
              </h3>
              <p className="ccrm-panel-description">
                {grid.unknownCount} of {grid.totalCells} cells are still not known.
              </p>
            </div>
          </div>

          <div className="ccrm-grid-scroll">
            <table className="ccrm-table ccrm-whitespace-table">
              <caption className="ccrm-visually-hidden">
                Products down the side, {grid.axisWord.toLowerCase()} across the top. Each cell says
                its state in words.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Product or service</th>
                  {grid.columns.map((column) => (
                    <th scope="col" key={column}>
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row) => (
                  <tr key={row.product.id}>
                    <th scope="row">{row.product.name}</th>
                    {row.cells.map((cell) => (
                      <td
                        key={`${row.product.id}-${cell.axisValue}`}
                        className={`ccrm-ws-cell ccrm-ws-${cell.state}`}
                      >
                        {/* The state is a WORD. Not a colour, not a tick, not a
                            shape somebody has to learn. */}
                        <span className="ccrm-ws-state">{cell.stateWord}</span>
                        {cell.derived ? (
                          <span className="ccrm-ws-derived">Worked out: {cell.derivedBecause}</span>
                        ) : null}
                        {cell.note ? <span className="ccrm-ws-note">{cell.note}</span> : null}
                        {cell.state !== 'unknown' && cell.statedBy ? (
                          <span className="ccrm-ws-by">
                            Recorded by a person on {cell.statedAt?.slice(0, 10)}
                          </span>
                        ) : null}
                        {cell.state === 'unknown' ? (
                          <button
                            type="button"
                            className="ccrm-ws-ask"
                            onClick={() =>
                              write.run('The cell was answered.', (context, workspace) =>
                                setWhitespace(context, workspace, {
                                  organisationId: grid.organisation.id,
                                  productId: row.product.id,
                                  axis: grid.axis,
                                  axisValue: cell.axisValue,
                                  state: 'potential_need',
                                  note: 'Recorded from the whitespace grid.',
                                })
                              )
                            }
                          >
                            Mark as a possible need
                          </button>
                        ) : null}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <WriteResultLine result={write.last} onClear={write.clearLast} />
        </section>
      )}

      <section className="ccrm-panel" aria-labelledby="ws-questions">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="ws-questions">
              Questions worth asking
              <span className="ccrm-stage-count">{questions.length}</span>
            </h3>
            <p className="ccrm-panel-description">
              The cells nobody has answered. This is the useful half of the grid, and it is the half
              a coloured heat map hides.
            </p>
          </div>
        </div>

        {questions.length === 0 ? (
          <p className="ccrm-panel-empty">
            Every cell on this grid has been answered by somebody.
          </p>
        ) : (
          <ul className="ccrm-plain-list">
            {questions.map((cell) => (
              <li key={`${cell.product.id}-${cell.axisValue}`}>
                Does <strong>{cell.axisValue}</strong> use {cell.product.name}?
                {cell.note ? ` ${cell.note}` : ''}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Stage4Scaffold>
  );
};
