/**
 * The small pieces every CRM view is built from.
 *
 * The application has no component library and no table, badge or empty-state
 * class in its shared stylesheet, so these are the module's own. They are
 * prefixed `.ccrm-` and defined in `styles/concludo-crm.css`, which means the
 * module can be reviewed, moved or removed without touching the 1,710-line
 * file every other page depends on.
 *
 * Three of them carry a product rule rather than a visual preference:
 *
 * - `StatusMark` never signals with colour alone. Every status has a shape and
 *   a word, because about one man in twelve cannot reliably separate the red
 *   from the green, and a CRM that signals risk with a coloured dot is unusable
 *   for them.
 * - `BasisChip` shows whether a value was stated, inferred, calculated or is
 *   unknown. A reader can always tell what the module knows from what it
 *   worked out.
 * - `ReasonLine` is how an item says why it is on the screen. It takes a
 *   standing drawn from the approved phrases, so a panel row cannot be written
 *   without one.
 */
import React from 'react';
import { Basis } from '../../lib/crm/types';
import { ApprovedPhrase } from '../../lib/crm/language';

/* ------------------------------------------------------------- status */

export type StatusShape = 'open' | 'waiting' | 'review' | 'none';

const SHAPE_GLYPH: Record<StatusShape, string> = {
  // Three distinct silhouettes, not three colours of the same dot.
  open: '●', // filled circle
  waiting: '◐', // half-filled circle
  review: '▲', // triangle
  none: '○', // hollow circle
};

const SHAPE_WORD: Record<StatusShape, string> = {
  open: 'Open',
  waiting: 'Waiting',
  review: 'Needs review',
  none: 'No status',
};

export const StatusMark: React.FC<{ shape: StatusShape; label?: string | null }> = ({
  shape,
  label,
}) => {
  if (shape === 'none' && !label) return null;
  return (
    <span className={`ccrm-status ccrm-status-${shape}`}>
      <span className="ccrm-status-glyph" aria-hidden="true">
        {SHAPE_GLYPH[shape]}
      </span>
      <span className="ccrm-status-word">{label ?? SHAPE_WORD[shape]}</span>
      {/* The shape carries meaning, so a screen reader is told it in words. */}
      <span className="ccrm-visually-hidden">{`. ${SHAPE_WORD[shape]}.`}</span>
    </span>
  );
};

/* -------------------------------------------------------------- basis */

const BASIS_LABEL: Record<Basis, string> = {
  stated: 'Stated',
  inferred: 'Inferred',
  calculated: 'Calculated',
  unknown: 'Unknown',
};

const BASIS_EXPLANATION: Record<Basis, string> = {
  stated: 'Someone wrote or said this.',
  inferred: 'Worked out from something that was said. Worth confirming.',
  calculated: 'Arithmetic over recorded values.',
  unknown: 'Not recorded. This is absent, not zero.',
};

export const BasisChip: React.FC<{ basis: Basis }> = ({ basis }) => (
  <span className={`ccrm-basis ccrm-basis-${basis}`} title={BASIS_EXPLANATION[basis]}>
    {BASIS_LABEL[basis]}
    <span className="ccrm-visually-hidden">{`. ${BASIS_EXPLANATION[basis]}`}</span>
  </span>
);

/* ------------------------------------------------------------ reasons */

export const ReasonLine: React.FC<{ standing: ApprovedPhrase; reason: string }> = ({
  standing,
  reason,
}) => (
  <p className="ccrm-reason">
    <span className="ccrm-standing">{standing}</span>
    <span className="ccrm-reason-text">{reason}</span>
  </p>
);

/* ------------------------------------------------------------- values */

/**
 * A value that may be absent.
 *
 * Absence is rendered as a sentence, never as a dash, a zero or an empty cell.
 * "0" and "we do not know" are different facts and a CRM that draws them the
 * same way will have someone act on the wrong one.
 */
export const Value: React.FC<{ value: string | null; absent?: string }> = ({
  value,
  absent = 'Not recorded',
}) =>
  value ? <>{value}</> : <span className="ccrm-absent">{absent}</span>;

/** Money, in Australian dollars, or a sentence saying no figure is recorded. */
export const Money: React.FC<{ amount: number | null; basis: Basis }> = ({ amount, basis }) => {
  if (amount === null) {
    return <span className="ccrm-absent">No figure recorded</span>;
  }
  return (
    <span className="ccrm-money">
      {new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD',
        maximumFractionDigits: 0,
      }).format(amount)}{' '}
      <BasisChip basis={basis} />
    </span>
  );
};

/* -------------------------------------------------------------- table */

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  /** True for the column that carries the row's own name. */
  isRowHeader?: boolean;
  /** A narrow column, for status and dates. */
  narrow?: boolean;
}

/**
 * A real table.
 *
 * The application's mobile stylesheet sets `table { display: block }` below
 * 900px, which destroys row and column alignment on every page that uses a raw
 * table. This one puts the scroll on a wrapper and restores
 * `display: table` on itself, so the columns still line up on a phone and the
 * header row still associates with its cells.
 */
export function DataTable<T extends { id: string }>(props: {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  emptyMessage: string;
}): React.ReactElement {
  const { caption, columns, rows, emptyMessage } = props;

  if (rows.length === 0) {
    return <p className="ccrm-empty-row">{emptyMessage}</p>;
  }

  return (
    <div className="ccrm-table-wrap" tabIndex={0} role="group" aria-label={`${caption}, scrollable`}>
      <table className="ccrm-table">
        <caption className="ccrm-visually-hidden">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={column.narrow ? 'ccrm-col-narrow' : undefined}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              {columns.map((column) =>
                column.isRowHeader ? (
                  <th key={column.key} scope="row">
                    {column.render(row)}
                  </th>
                ) : (
                  <td key={column.key} className={column.narrow ? 'ccrm-col-narrow' : undefined}>
                    {column.render(row)}
                  </td>
                )
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------- layout */

export const SectionHeading: React.FC<{
  title: string;
  description?: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <div className="ccrm-section-head">
    <div>
      <h2 className="ccrm-section-title">{title}</h2>
      {description ? <p className="ccrm-section-description">{description}</p> : null}
    </div>
    {action ? <div className="ccrm-section-action">{action}</div> : null}
  </div>
);

/** A short definition list, used on detail cards. */
export const Facts: React.FC<{ items: { term: string; value: React.ReactNode }[] }> = ({ items }) => (
  <dl className="ccrm-facts">
    {items.map((item) => (
      <div className="ccrm-fact" key={item.term}>
        <dt>{item.term}</dt>
        <dd>{item.value}</dd>
      </div>
    ))}
  </dl>
);

/**
 * A note explaining what this release deliberately cannot do.
 *
 * Used wherever a view would otherwise look like a working feature. A shell
 * that does not say it is a shell is a demonstration that will be believed.
 */
export const NotYetBuilt: React.FC<{ what: string; why: string; when: string }> = ({
  what,
  why,
  when,
}) => (
  <div className="ccrm-not-built" role="note">
    <p className="ccrm-not-built-head">{what}</p>
    <p className="ccrm-not-built-body">{why}</p>
    <p className="ccrm-not-built-when">{when}</p>
  </div>
);
