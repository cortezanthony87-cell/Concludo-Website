/**
 * What Stage 7 borrows from Stage 5, in one place.
 *
 * The agents read the pipeline composition rather than re-deriving days in
 * stage, staleness and unmet criteria. Re-deriving them would mean two
 * definitions of "stale" in one product, and the one the agent used would drift
 * from the one the board showed, which is how a person ends up arguing with a
 * proposal about a number they can see on screen.
 *
 * Re-exported through this file rather than imported directly so the borrowing
 * is visible: one import list, one place to look when Stage 5 changes.
 */
export { boardAsList, buildBoard, buildCard, pipelinesIn } from '../stage5/pipeline';
export type { BoardColumn, PipelineBoard, PipelineCard } from '../stage5/pipeline';
