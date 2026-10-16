/**
 * The whitespace grid: what they use, where, and what we have never asked.
 *
 * THE ONE RULE THIS FILE EXISTS TO PROTECT.
 *
 * "Unknown must remain a valid status."
 *
 * That sentence is doing more work than it looks. Every whitespace grid ever
 * built starts with three states, ships with two, and ends up rendering an
 * empty cell as "no". The slide looks better: a wall of green and red reads as
 * knowledge, and a wall of grey reads as laziness. But the grey is the truth,
 * and it is also the most valuable thing on the grid, because a cell nobody has
 * asked about is a conversation worth having and a cell the customer has
 * declined is not. Collapse them and you cannot tell which is which, and the
 * first consequence is somebody pitching a product the customer already
 * rejected, in front of the customer.
 *
 * So, concretely, in this module:
 *
 *   - `unknown` is the DEFAULT state of every cell, including cells that do not
 *     exist yet. A missing row renders as unknown, not as "not relevant".
 *   - Nothing here ever writes a state. The grid reads; `writes.ts` writes, and
 *     only with a person's name on it.
 *   - `in_use` is derived ONLY from a recorded fact, never from the absence of
 *     one, and the derivation is marked so a person can see it was not typed.
 *   - The counts returned always include the unknown count, so a page cannot
 *     accidentally present a partial grid as a complete one.
 */
import {
  CrmWorkspaceData,
  Organisation,
  Product,
  WhitespaceAxis,
  WhitespaceCell,
  WhitespaceState,
} from '../domain';

export const WHITESPACE_STATE_WORDS: Record<WhitespaceState, string> = {
  unknown: 'Not known yet',
  in_use: 'In use',
  potential_need: 'Possible need',
  open_opportunity: 'Open opportunity',
  not_relevant: 'Not relevant',
};

export const WHITESPACE_STATE_MEANINGS: Record<WhitespaceState, string> = {
  unknown: 'Nobody has asked, or nobody has written the answer down.',
  in_use: 'They use it here, and somebody recorded that.',
  potential_need: 'Somebody here believes there is a need, and said why.',
  open_opportunity: 'There is work open against it.',
  not_relevant: 'Somebody established it does not apply, and recorded the reason.',
};

export const AXIS_WORDS: Record<WhitespaceAxis, string> = {
  business_unit: 'Business unit',
  site: 'Site',
  region: 'Region',
};

/* ---------------------------------------------------------- one cell */

export interface GridCell {
  product: Product;
  axis: WhitespaceAxis;
  axisValue: string;
  state: WhitespaceState;
  stateWord: string;
  stateMeaning: string;
  note: string | null;
  /** Who said so. Null on an unknown cell, which is the only state with no author. */
  statedBy: string | null;
  statedAt: string | null;
  /** True where the row does not exist at all, as opposed to existing as unknown. */
  neverAsked: boolean;
  /**
   * True where the state came from elsewhere in the record rather than from
   * somebody typing it here. Marked, so nobody mistakes a derivation for a
   * statement.
   */
  derived: boolean;
  derivedBecause: string | null;
  workItemId: string | null;
  cell: WhitespaceCell | null;
}

/* --------------------------------------------------------- the grid */

export interface WhitespaceGrid {
  organisation: Organisation;
  axis: WhitespaceAxis;
  axisWord: string;
  /** The places down the side, as the customer names them. */
  columns: string[];
  /** The products across the top, in the order the workspace lists them. */
  products: Product[];
  rows: { product: Product; cells: GridCell[] }[];
  counts: Record<WhitespaceState, number>;
  /** How many cells nobody has ever recorded anything about. */
  unknownCount: number;
  totalCells: number;
  /** Said on the page, every time, in these words. */
  unknownNote: string;
  /** True where the grid has no places recorded, so there is nothing to draw. */
  empty: boolean;
}

/**
 * The places that make up the columns.
 *
 * Taken from the cells that exist, because the places are the customer's and
 * the only way we know one is that somebody wrote it down. A grid with no
 * recorded places is empty rather than invented: Concludo does not guess that
 * an agency has a "Head office" because most agencies do.
 */
export function axisValuesFor(
  data: CrmWorkspaceData,
  organisationId: string,
  axis: WhitespaceAxis
): string[] {
  const values = new Set<string>();
  for (const cell of data.whitespaceCells) {
    if (cell.deletedAt !== null) continue;
    if (cell.organisationId !== organisationId) continue;
    if (cell.axis !== axis) continue;
    values.add(cell.axisValue);
  }
  return [...values].sort((a, b) => a.localeCompare(b));
}

export function buildWhitespaceGrid(
  data: CrmWorkspaceData,
  organisationId: string,
  axis: WhitespaceAxis = 'business_unit'
): WhitespaceGrid | null {
  const organisation = data.organisations.find(
    (o) => o.id === organisationId && o.deletedAt === null
  );
  if (!organisation) return null;

  const products = data.products
    .filter((p) => p.deletedAt === null && p.isActive)
    .sort((a, b) => a.name.localeCompare(b.name));

  const columns = axisValuesFor(data, organisationId, axis);

  const counts: Record<WhitespaceState, number> = {
    unknown: 0,
    in_use: 0,
    potential_need: 0,
    open_opportunity: 0,
    not_relevant: 0,
  };

  const rows = products.map((product) => {
    const cells = columns.map((axisValue): GridCell => {
      const cell =
        data.whitespaceCells.find(
          (c) =>
            c.deletedAt === null &&
            c.organisationId === organisationId &&
            c.productId === product.id &&
            c.axis === axis &&
            c.axisValue === axisValue
        ) ?? null;

      // A derivation, and only from a recorded fact. Open work against this
      // organisation that includes this product tells us there is an
      // opportunity here; nothing tells us there is not one.
      let derived = false;
      let derivedBecause: string | null = null;
      let state: WhitespaceState = cell?.state ?? 'unknown';
      let workItemId = cell?.workItemId ?? null;

      if (!cell || cell.state === 'unknown') {
        const line = data.quoteLines.find((l) => {
          const quote = data.quotes.find((q) => q.id === l.quoteId);
          if (!quote || quote.deletedAt !== null) return false;
          const item = data.workItems.find((w) => w.id === quote.workItemId);
          return (
            l.productId === product.id &&
            item?.organisationId === organisationId &&
            item?.status === 'open'
          );
        });
        if (line) {
          state = 'open_opportunity';
          derived = true;
          derivedBecause = 'There is an open quote for this against this account.';
          const quote = data.quotes.find((q) => q.id === line.quoteId);
          workItemId = quote?.workItemId ?? null;
        }
      }

      counts[state] += 1;

      return {
        product,
        axis,
        axisValue,
        state,
        stateWord: WHITESPACE_STATE_WORDS[state],
        stateMeaning: WHITESPACE_STATE_MEANINGS[state],
        note: cell?.note ?? null,
        statedBy: cell?.statedBy ?? null,
        statedAt: cell?.statedAt ?? null,
        neverAsked: cell === null,
        derived,
        derivedBecause,
        workItemId,
        cell,
      };
    });

    return { product, cells };
  });

  const totalCells = rows.reduce((sum, row) => sum + row.cells.length, 0);

  return {
    organisation,
    axis,
    axisWord: AXIS_WORDS[axis],
    columns,
    products,
    rows,
    counts,
    unknownCount: counts.unknown,
    totalCells,
    unknownNote:
      'Not known yet is an answer, and it is the one worth acting on. A blank cell means nobody has asked, which is a different thing from the customer saying no.',
    empty: columns.length === 0 || products.length === 0,
  };
}

/**
 * The cells worth a conversation, which are the unknown ones.
 *
 * Deliberately returns unknowns rather than "opportunities": the grid's value
 * is the questions it reveals, and a module that surfaced only the cells it had
 * already filled in would be telling somebody what they already know.
 */
export function questionsWorthAsking(grid: WhitespaceGrid): GridCell[] {
  return grid.rows
    .flatMap((row) => row.cells)
    .filter((cell) => cell.state === 'unknown')
    .sort((a, b) => a.product.name.localeCompare(b.product.name));
}

/** Every axis that has anything recorded against it, so the page can offer them. */
export function axesWithData(data: CrmWorkspaceData, organisationId: string): WhitespaceAxis[] {
  return (['business_unit', 'site', 'region'] as WhitespaceAxis[]).filter(
    (axis) => axisValuesFor(data, organisationId, axis).length > 0
  );
}
