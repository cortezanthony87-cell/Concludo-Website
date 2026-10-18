/**
 * Overview: how this is going.
 *
 * Today answers "what do I do next". This answers "how is this going", and
 * the two are deliberately different pages. A person opens Today in the
 * morning and this before a board meeting or at the end of a week.
 *
 * FIVE RULES THIS PAGE HOLDS TO.
 *
 * 1. EVERY FIGURE OPENS ITS RECORDS. A number with no destination is a
 *    poster. The type requires a path, so one cannot be added without one.
 *
 * 2. EVERY FIGURE SAYS WHAT IT LEFT OUT. A total over work where some items
 *    have no value recorded is not wrong, but it is not the whole list
 *    either, and the person reading it decides whether that matters.
 *
 * 3. EVERY PERCENTAGE SHOWS ITS DENOMINATOR. A ring says what it is a ring
 *    of, in the hole in the middle. A bar's percentage sits beside the count
 *    it was divided from. "Forty per cent" with nothing to divide by is the
 *    most common way a dashboard misleads without printing a false number.
 *
 * 4. GOLD MARKS THE ONE THING TO ACT ON. One wedge per ring at most: the
 *    stage holding the most stuck work, and the promises that are ours to
 *    keep. Everything else is the navy ramp. Gold on everything means
 *    nothing, and gold fails contrast on light at every size, so it is a fill
 *    and never text.
 *
 * 5. NOTHING IS A SCORE, AND NOTHING IS ABOUT A PERSON. No health figure, no
 *    ranking, no count per user. The schema refuses the column and this page
 *    has no control that would group by one.
 *
 * ON DRAWING CHARTS WITHOUT A CHART LIBRARY.
 *
 * The rings are one SVG circle per wedge, dashed to its own fraction. The
 * columns and bars are divs with a height or a width. That is not a
 * limitation worked around: a chart library would add a dependency, ship its
 * own colours and tooltips to be overridden, and put the numbers inside a
 * canvas where a screen reader cannot reach them. Here every value is real
 * text in the legend, every ring carries a `<title>`, and the module computed
 * the geometry where it could be tested.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker } from '../../components/crm/Stage5Pieces';
import { Donut, formatMoney, overviewFor } from '../../lib/crm/dashboard/overview';

/** Bar length. A row with a value never draws nothing, or it reads as zero. */
function width(fraction: number, hasValue: boolean): string {
  const percent = Math.max(fraction * 100, hasValue ? 1.5 : 0);
  return `${Math.min(percent, 100)}%`;
}

function daysAgo(iso: string, now: string): string {
  const days = Math.floor((Date.parse(now) - Date.parse(iso)) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days} days ago`;
  const months = Math.round(days / 30);
  return `${months} ${months === 1 ? 'month' : 'months'} ago`;
}

/* ===================================================== the ring

   One circle per wedge, each dashed to its own fraction and offset by what
   came before, rotated so the ring starts at twelve o'clock.

   `pathLength={100}` is what makes this honest and short: it tells the
   browser to treat the circumference as 100 units whatever the radius, so the
   dash array is the percentage itself and no circumference arithmetic enters
   the component. A one-unit gap is cut from every wedge, which is why two
   adjacent navy tones still read as two wedges.                           */

const RING_GAP = 1;

const Ring: React.FC<{ donut: Donut; currency: string; isExample?: boolean }> = ({ donut, currency, isExample }) => {
  const value = (amount: number, count: number) =>
    donut.unit === 'money' ? formatMoney(amount, currency) : String(count);

  if (donut.slices.length === 0) {
    return (
      <div className="ccrm-ring-single">
        <p className="ccrm-ring-single-value">None</p>
        <p className="ccrm-ring-single-label">nothing recorded to divide, so there is no ring to draw</p>
      </div>
    );
  }

  const isSingle = donut.slices.length === 1;
  let offset = 0;
  return (
    <div className="ccrm-ring-wrap">
      <svg
        className="ccrm-ring"
        viewBox="0 0 120 120"
        role="img"
        aria-labelledby={`ring-title-${donut.key}`}
      >
        <title id={`ring-title-${donut.key}`}>
          {donut.label}, {donut.totalLabel} in total.{' '}
          {donut.slices.map((slice) => `${slice.label} ${slice.share} per cent`).join(', ')}.
        </title>
        <circle className="ccrm-ring-base" cx="60" cy="60" r="44" pathLength={100} />
        {donut.slices.map((slice) => {
          const length = isSingle ? 100 : Math.max(slice.fraction * 100 - RING_GAP, 0.4);
          const dash = isSingle ? '100 0' : `${length} ${100 - length}`;
          const thisOffset = offset;
          offset -= slice.fraction * 100;
          return (
            <circle
              key={slice.key}
              className={
                slice.tone === -1
                  ? 'ccrm-ring-seg ccrm-ring-seg-accent'
                  : `ccrm-ring-seg ccrm-ring-seg-${slice.tone}`
              }
              cx="60"
              cy="60"
              r="44"
              pathLength={100}
              strokeDasharray={dash}
              strokeDashoffset={thisOffset}
            />
          );
        })}
      </svg>
      <div className="ccrm-ring-hole">
        <span className="ccrm-ring-hole-value">{donut.totalFigure}</span>
        <span className="ccrm-ring-hole-label">{donut.totalUnit}</span>
      </div>
    </div>
  );
};

const RingLegend: React.FC<{
  donut: Donut;
  currency: string;
  linkTo: (path: string) => string;
}> = ({ donut, currency, linkTo }) => (
  <ul className="ccrm-ring-legend">
    {donut.slices.map((slice) => (
      <li key={slice.key}>
        <span
          className={
            slice.tone === -1
              ? 'ccrm-ring-key ccrm-ring-key-accent'
              : `ccrm-ring-key ccrm-ring-key-${slice.tone}`
          }
          aria-hidden="true"
        />
        <span className="ccrm-ring-legend-name">
          {slice.path ? (
            <Link className="ccrm-text-link" to={linkTo(slice.path)}>
              {slice.label}
            </Link>
          ) : (
            slice.label
          )}
          {slice.grouped ? (
            <span className="ccrm-ring-legend-grouped">
              grouped, because a ring with more wedges than this cannot be read
            </span>
          ) : null}
        </span>
        <span className="ccrm-ring-legend-share">{slice.share}%</span>
        <span className="ccrm-ring-legend-value">
          {donut.unit === 'money'
            ? formatMoney(slice.value, currency)
            : `${slice.count} ${slice.count === 1 ? 'item' : 'items'}`}
        </span>
      </li>
    ))}
  </ul>
);

interface DisplayDonutResult {
  donut: Donut;
  isExample: boolean;
}

/**
 * Returns the user's real donut if items exist.
 * If no items are recorded yet in this category, returns an authentic example
 * preview so the chart is always visual.
 * 
 * ISOLATION GUARANTEE: Example figures live strictly in this visual view layer.
 * They are never saved to session data or database, and never mixed or averaged
 * into user reports, pipeline totals, or exports.
 */
function getDisplayDonut(donut: Donut, currency: string): DisplayDonutResult {
  if (donut.slices.length > 0) {
    return { donut, isExample: false };
  }

  if (donut.key === 'pipeline_by_stage') {
    return {
      isExample: true,
      donut: {
        key: donut.key,
        label: donut.label,
        question: donut.question,
        unit: 'money',
        total: 25000,
        totalLabel: 'AU$25k in total (Example)',
        totalFigure: 'AU$25k',
        totalUnit: 'example open pipeline',
        slices: [
          {
            key: 'ex-proposal',
            label: 'Proposal (Example)',
            value: 12500,
            count: 2,
            share: 50,
            fraction: 0.5,
            startAngle: 0,
            endAngle: 180,
            tone: -1,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
          {
            key: 'ex-appraisal',
            label: 'Appraisal (Example)',
            value: 7500,
            count: 2,
            share: 30,
            fraction: 0.3,
            startAngle: 180,
            endAngle: 288,
            tone: 0,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
          {
            key: 'ex-negotiation',
            label: 'Negotiation (Example)',
            value: 5000,
            count: 1,
            share: 20,
            fraction: 0.2,
            startAngle: 288,
            endAngle: 360,
            tone: 3,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
        ],
        basis: 'Example figure shown for preview only',
        omits: 'isolated from live workspace data',
      },
    };
  }

  if (donut.key === 'enquiries_by_source') {
    return {
      isExample: true,
      donut: {
        key: donut.key,
        label: donut.label,
        question: donut.question,
        unit: 'count',
        total: 10,
        totalLabel: '10 enquiries in total (Example)',
        totalFigure: '10',
        totalUnit: 'example enquiries',
        slices: [
          {
            key: 'ex-website',
            label: 'Website (Example)',
            value: 0,
            count: 4,
            share: 40,
            fraction: 0.4,
            startAngle: 0,
            endAngle: 144,
            tone: 0,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
          {
            key: 'ex-referral',
            label: 'Referral (Example)',
            value: 0,
            count: 3,
            share: 30,
            fraction: 0.3,
            startAngle: 144,
            endAngle: 252,
            tone: 2,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
          {
            key: 'ex-event',
            label: 'Event (Example)',
            value: 0,
            count: 2,
            share: 20,
            fraction: 0.2,
            startAngle: 252,
            endAngle: 324,
            tone: 4,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
          {
            key: 'ex-direct',
            label: 'Direct (Example)',
            value: 0,
            count: 1,
            share: 10,
            fraction: 0.1,
            startAngle: 324,
            endAngle: 360,
            tone: -1,
            path: null,
            grouped: false,
            groupedCount: 0,
          },
        ],
        basis: 'Example figure shown for preview only',
        omits: 'isolated from live workspace data',
      },
    };
  }

  return {
    isExample: true,
    donut: {
      key: donut.key,
      label: donut.label,
      question: donut.question,
      unit: 'count',
      total: 4,
      totalLabel: '4 promises in total (Example)',
      totalFigure: '4',
      totalUnit: 'example promises',
      slices: [
        {
          key: 'ex-ours',
          label: 'Ours to keep (Example)',
          value: 0,
          count: 2,
          share: 50,
          fraction: 0.5,
          startAngle: 0,
          endAngle: 180,
          tone: -1,
          path: null,
          grouped: false,
          groupedCount: 0,
        },
        {
          key: 'ex-theirs',
          label: 'Waiting on them (Example)',
          value: 0,
          count: 2,
          share: 50,
          fraction: 0.5,
          startAngle: 180,
          endAngle: 360,
          tone: 0,
          path: null,
          grouped: false,
          groupedCount: 0,
        },
      ],
      basis: 'Example figure shown for preview only',
      omits: 'isolated from live workspace data',
    },
  };
}

export const CrmDashboardPage: React.FC = () => {
  const { data, now, version, linkTo } = useStage4();

  // `version` is in the dependencies on purpose. The session store mutates one
  // workspace in place, so `data` does not change identity when something is
  // written, and a memo on `[data, now]` alone would show figures from before
  // the last write. This is the line that makes every update reach this page.
  const overview = React.useMemo(() => overviewFor(data, now), [data, now, version]);

  const totalStuck = overview.stages.reduce((sum, stage) => sum + stage.stuck, 0);

  return (
    <Stage4Scaffold
      title="Overview"
      description="How this is going: what is open, what has closed, what is waiting and what changed."
      loadingLabel="the overview"
      emptyTitle="Nothing is recorded in this workspace yet"
      emptyBody="The overview fills in as organisations, work and conversations are added."
      resultCount={overview.figures.length}
      totalCount={overview.figures.length}
      toolbar={<RolePicker />}
    >
      <p className="ccrm-not-ranked ccrm-policy" role="note">
        {overview.note}
      </p>

      {/* ---------------------------------------------- the four figures */}

      <ul className="ccrm-figure-row">
        {overview.figures.map((figure) => (
          <li key={figure.key}>
            <Link className="ccrm-figure" to={linkTo(figure.path)}>
              <span className="ccrm-figure-label">
                {figure.label}
                <ArrowUpRight size={13} aria-hidden="true" />
              </span>
              <span className="ccrm-figure-value">{figure.value}</span>
              <span className="ccrm-figure-basis">{figure.basis}</span>

              {/* The proportion of the list the figure covers. A total built
                  on half the records must not look like one built on all. */}
              {figure.coverage ? (
                <span className="ccrm-figure-meter">
                  <span className="ccrm-figure-meter-head">
                    <span className="ccrm-figure-meter-percent">{figure.coverage.percent}%</span>
                    <span className="ccrm-figure-meter-label">{figure.coverage.label}</span>
                  </span>
                  <span className="ccrm-figure-meter-track">
                    <span
                      className="ccrm-figure-meter-fill"
                      style={{ width: `${figure.coverage.percent}%` }}
                    />
                  </span>
                </span>
              ) : null}

              {figure.omits ? <span className="ccrm-figure-omits">{figure.omits}</span> : null}
            </Link>
          </li>
        ))}
      </ul>

      {/* ------------------------------------------------- the three rings */}

      <div className="ccrm-ring-row">
        {overview.donuts.map((rawDonut) => {
          const display = getDisplayDonut(rawDonut, overview.currency);
          return (
            <section className="ccrm-panel ccrm-ring-panel" key={display.donut.key} aria-labelledby={`ring-${display.donut.key}`}>
              <div className="ccrm-panel-head">
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 className="ccrm-panel-title" id={`ring-${display.donut.key}`}>
                      {display.donut.label}
                    </h3>
                    {display.isExample && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: 'rgba(226, 181, 60, 0.15)',
                          border: '1px solid rgba(226, 181, 60, 0.4)',
                          color: '#e2b53c',
                          fontWeight: 600,
                          letterSpacing: '0.02em',
                        }}
                      >
                        Example Preview
                      </span>
                    )}
                  </div>
                  <p className="ccrm-panel-description">{display.donut.question}</p>
                </div>
              </div>

              <Ring donut={display.donut} currency={overview.currency} isExample={display.isExample} />
              <RingLegend donut={display.donut} currency={overview.currency} linkTo={linkTo} />

              {display.isExample ? (
                <p className="ccrm-ring-basis" style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                  Example figure shown for preview. When you record your own organisations, leads, deals or promises, this example is immediately replaced and is never mixed into your reports.
                </p>
              ) : (
                <p className="ccrm-ring-basis">
                  {display.donut.basis}.{display.donut.omits ? ` Leaves out ${display.donut.omits}.` : ''}
                </p>
              )}
            </section>
          );
        })}
      </div>

      <div className="ccrm-dash-grid">
        {/* ------------------------------------------ pipeline by stage */}

        <section className="ccrm-panel ccrm-dash-wide" aria-labelledby="dash-stages">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="dash-stages">
                Open work by stage
              </h3>
              <p className="ccrm-panel-description">
                {totalStuck === 0
                  ? 'Nothing is sitting longer than its stage usually takes.'
                  : `${totalStuck} ${totalStuck === 1 ? 'piece' : 'pieces'} of work ${totalStuck === 1 ? 'has' : 'have'} been in a stage longer than that stage usually takes. Those stages carry a gold mark.`}
              </p>
            </div>
          </div>

          {overview.stages.length === 0 ? (
            <p className="ccrm-panel-empty">No open stage is recorded in this workspace.</p>
          ) : (
            <ul className="ccrm-bar-list">
              {overview.stages.map((stage) => (
                <li key={stage.stageId}>
                  <div className="ccrm-bar-head">
                    <span className="ccrm-bar-name">{stage.name}</span>
                    <span className="ccrm-bar-figure">
                      {stage.stuck > 0 ? (
                        <span className="ccrm-bar-stuck-chip">
                          {stage.stuck} past {stage.typicalDays} days, {stage.stuckShare}% of this
                          stage
                        </span>
                      ) : null}
                      <span className="ccrm-bar-share">{stage.valueShare}%</span>
                      {formatMoney(stage.value, overview.currency)}
                      <span className="ccrm-bar-count">
                        {stage.count} {stage.count === 1 ? 'item' : 'items'}, {stage.countShare}%
                        of the list
                      </span>
                    </span>
                  </div>
                  <div
                    className={
                      stage.count > 0 && stage.value === 0
                        ? 'ccrm-bar-track ccrm-bar-track-novalue'
                        : 'ccrm-bar-track'
                    }
                  >
                    <div
                      className="ccrm-bar-fill"
                      style={{ width: `${stage.valueShare}%` }}
                    />
                    {stage.stuck > 0 ? (
                      <div
                        className="ccrm-bar-stuck"
                        style={{
                          width: `${Math.round((stage.valueShare * stage.stuck) / Math.max(stage.count, 1))}%`,
                        }}
                      />
                    ) : null}
                  </div>
                  <p className="ccrm-bar-note">
                    {stage.count === 0
                      ? `Nothing here. This stage usually takes ${stage.typicalDays} days.`
                      : stage.value === 0
                        ? `${stage.count} ${stage.count === 1 ? 'item' : 'items'} with no value recorded, so there is no bar to draw. The longest has been here ${stage.longestDays} days.`
                        : stage.stuck > 0
                          ? `${stage.stuck} of ${stage.count} past the ${stage.typicalDays} days this stage usually takes. The longest has been here ${stage.longestDays} days.`
                          : `All within the ${stage.typicalDays} days this stage usually takes. The longest has been here ${stage.longestDays} days.`}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <p className="ccrm-ring-basis">
            Bars are each stage&apos;s share of open pipeline value. They sum to 100 per cent
            across the funnel, which is why a stage with nothing recorded against it draws
            nothing.
          </p>
        </section>

        {/* ------------------------------------ the eleven conditions */}

        <section className="ccrm-panel" aria-labelledby="dash-conditions">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="dash-conditions">
                What is unanswered
              </h3>
              <p className="ccrm-panel-description">
                Accounts per condition, of eleven, with each as a share of the accounts
                here. A count of accounts, never of people.
              </p>
            </div>
          </div>

          {overview.conditions.length === 0 ? (
            <p className="ccrm-panel-empty">
              None of the eleven conditions is true of any account here.
            </p>
          ) : (
            <ul className="ccrm-bar-list ccrm-bar-list-tight">
              {overview.conditions.map((condition) => (
                <li key={condition.condition}>
                  <div className="ccrm-bar-head">
                    <span className="ccrm-bar-name">{condition.label}</span>
                    <span className="ccrm-bar-figure">
                      <span className="ccrm-bar-share">{condition.share}%</span>
                      {condition.count}
                    </span>
                  </div>
                  <div className="ccrm-bar-track ccrm-bar-track-thin">
                    <div
                      className="ccrm-bar-fill"
                      style={{ width: `${Math.max(condition.share, condition.count > 0 ? 2 : 0)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="ccrm-form-actions">
            <Link className="ccrm-text-link" to={linkTo('/crm/attention')}>
              Open the attention list
            </Link>
          </p>
        </section>

        {/* ------------------------------------------ closed by quarter */}

        <section className="ccrm-panel" aria-labelledby="dash-quarters">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="dash-quarters">
                Won by quarter
              </h3>
              <p className="ccrm-panel-description">
                Recorded value of work marked won, by the quarter it closed in. Columns
                are drawn against the tallest quarter shown.
              </p>
            </div>
          </div>

          {overview.quarters.length === 0 ? (
            <p className="ccrm-panel-empty">
              No work has been marked won in this workspace, so there is nothing to
              chart. This is the figure, not a missing chart.
            </p>
          ) : (
            <div className="ccrm-columns" role="group" aria-label="Won by quarter">
              {overview.quarters.map((quarter, index) => (
                <div className="ccrm-column" key={quarter.key}>
                  <span className="ccrm-column-value">
                    {formatMoney(quarter.won, overview.currency)}
                  </span>
                  <div className="ccrm-column-track">
                    <div
                      className={
                        index === overview.quarters.length - 1
                          ? 'ccrm-column-fill ccrm-column-fill-latest'
                          : 'ccrm-column-fill'
                      }
                      style={{ height: width(quarter.fraction, quarter.won > 0) }}
                    />
                  </div>
                  <span className="ccrm-column-share">{quarter.share}%</span>
                  <span className="ccrm-column-label">{quarter.label}</span>
                  <span className="ccrm-column-count">
                    {quarter.wonCount} {quarter.wonCount === 1 ? 'item' : 'items'}
                  </span>
                  {quarter.changePercent !== null ? (
                    <span className="ccrm-column-change">
                      {quarter.changePercent >= 0 ? '+' : ''}
                      {quarter.changePercent}% on the quarter before
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <p className="ccrm-ring-basis">
            Percentages are each quarter&apos;s share of the value won across the quarters
            shown. Change on the quarter before is only given where both quarters hold at
            least three recorded outcomes, because a move from one win to two is not a
            trend.
          </p>
        </section>

        {/* -------------------------------------- enquiries, listed */}

        <section className="ccrm-panel" aria-labelledby="dash-sources">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="dash-sources">
                Every source, listed
              </h3>
              <p className="ccrm-panel-description">
                The full list behind the ring, including anything the ring grouped into
                its last wedge.
              </p>
              {/* The denominator, in the same panel as the percentages. A
                  reader should never have to look at another panel to find
                  out what a percentage here is a share of. */}
              <p className="ccrm-panel-description">
                Each is a share of{' '}
                {overview.sources.reduce((sum, source) => sum + source.count, 0)} live
                enquiries in total, the same denominator as the ring above.
              </p>
            </div>
          </div>

          {overview.sources.length === 0 ? (
            <p className="ccrm-panel-empty">No enquiry is waiting in this workspace.</p>
          ) : (
            <ul className="ccrm-bar-list ccrm-bar-list-tight">
              {overview.sources.map((source) => (
                <li key={source.key}>
                  <div className="ccrm-bar-head">
                    <span className="ccrm-bar-name">{source.label}</span>
                    <span className="ccrm-bar-figure">
                      <span className="ccrm-bar-share">{source.share}%</span>
                      {source.count}
                    </span>
                  </div>
                  <div className="ccrm-bar-track ccrm-bar-track-thin">
                    <div
                      className="ccrm-bar-fill"
                      style={{ width: width(source.fraction, source.count > 0) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* --------------------------------------- open work by customer */}

        <section className="ccrm-panel" aria-labelledby="dash-accounts">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="dash-accounts">
                Open work by customer
              </h3>
              <p className="ccrm-panel-description">
                Each customer&apos;s share of open pipeline value, largest first. This is
                the concentration figure: read it before anybody celebrates the total.
              </p>
            </div>
          </div>

          {overview.accounts.length === 0 ? (
            <p className="ccrm-panel-empty">No open work is recorded against a customer.</p>
          ) : (
            <ul className="ccrm-bar-list ccrm-bar-list-tight">
              {overview.accounts.map((account) => (
                <li key={account.key}>
                  <div className="ccrm-bar-head">
                    <span className="ccrm-bar-name">
                      {account.path ? (
                        <Link className="ccrm-text-link" to={linkTo(account.path)}>
                          {account.label}
                        </Link>
                      ) : (
                        account.label
                      )}
                    </span>
                    <span className="ccrm-bar-figure">
                      <span className="ccrm-bar-share">{account.share}%</span>
                      {formatMoney(account.value, overview.currency)}
                      <span className="ccrm-bar-count">
                        {account.count} {account.count === 1 ? 'item' : 'items'}
                      </span>
                    </span>
                  </div>
                  <div className="ccrm-bar-track ccrm-bar-track-thin">
                    <div
                      className="ccrm-bar-fill"
                      style={{ width: width(account.fraction, account.value > 0) }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <p className="ccrm-ring-basis">
            Percentages are of all open pipeline value, not of the customers shown, so
            they sum to less than 100 where there is work further down the list.
          </p>
        </section>

        {/* ------------------------------------------------ what changed */}

        <section className="ccrm-panel ccrm-dash-full" aria-labelledby="dash-changes">
          <div className="ccrm-panel-head">
            <div>
              <h3 className="ccrm-panel-title" id="dash-changes">
                What changed
              </h3>
              <p className="ccrm-panel-description">
                The most recent twelve entries, from the same history every other view
                reads. Anything recorded anywhere in the CRM appears here.
              </p>
            </div>
          </div>

          {overview.changes.length === 0 ? (
            <p className="ccrm-panel-empty">Nothing has been recorded in this workspace.</p>
          ) : (
            <ul className="ccrm-item-list">
              {overview.changes.map((change) => (
                <li key={change.id}>
                  <span className="ccrm-item-main">
                    <span className="ccrm-item-title">{change.title}</span>
                    <span className="ccrm-item-context">
                      {change.organisationName ? `${change.organisationName}. ` : ''}
                      {daysAgo(change.occurredAt, now)}.{' '}
                      <Link className="ccrm-text-link" to={linkTo(change.path)}>
                        Open the history
                      </Link>
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <p className="ccrm-policy" role="note">
        Every percentage on this page is a share of a recorded total held in this
        workspace, and that total is shown beside it. Nothing here is measured against a
        target, because no target has been set. Computed when this page was opened and
        recomputed whenever anything is written, so nothing can disagree with the records
        it came from.
      </p>
    </Stage4Scaffold>
  );
};
