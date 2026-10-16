/**
 * The pipeline: one composition, three shapes.
 *
 * Kanban, list and a compact mobile view are the same data arranged three ways,
 * so they are composed once here and rendered three times. Three compositions
 * is how a column total disagrees with a row total, and the person who finds
 * that out is the one presenting the number.
 *
 * WHAT A CARD CARRIES, AND WHY EACH ONE.
 *
 * Every field on a card is there because somebody looking at a board asks for
 * it out loud. Days in stage, because "how long has that been sitting there" is
 * the first question. The next step and its date, because a board with no next
 * steps is a list of hopes. Last meaningful contact, because activity on a
 * record is not the same as contact with a customer, and only the second one
 * means anything. What is missing, named, because an absence somebody can see
 * is an absence somebody fills in.
 *
 * WHAT CONFIDENCE IS AND IS NOT.
 *
 * The brief: confidence based on evidence, not employee quality. So confidence
 * here is a count of recorded facts about the WORK, listed by name, and a word
 * rather than a number. There is no owner in the calculation, no history of
 * whose deals close, and nothing anywhere in this file takes a user id for the
 * purpose of judging anything. A percentage would be the same judgement with
 * the working hidden, which is why there is not one.
 */
import {
  CrmWorkspaceData,
  Pipeline,
  PipelineStage,
  StageCriterion,
  WorkItem,
} from '../domain';
import { CloseDateChange, closeDateHistory } from './writes';
import { onWriteInvalidate } from '../cacheBus';

const DAY = 86_400_000;

/* ------------------------------------------------- the lookups, built once
 *
 * Added in Stage 8. `buildCard` ran seven scans of a collection per card: the
 * stage, the pipeline, the stage criteria, the arrival move, the latest
 * meaningful activity, the close-date history, the reopen check, the
 * organisation and the primary contact. A board of two thousand cards against
 * ten thousand organisations and twenty thousand activities is tens of
 * millions of comparisons, and it measured at four hundred milliseconds for
 * one board.
 *
 * These are the same answers, from one pass per collection, cached against the
 * dataset object and dropped on every write through `onWriteInvalidate` at the
 * bottom of this file. Nothing about what a card SAYS changed; the Stage 5
 * suite is what says so.
 */

interface BoardIndex {
  organisationsById: Map<string, { id: string; name: string }>;
  peopleById: Map<string, { id: string; fullName: string }>;
  criteriaByStage: Map<string, StageCriterion[]>;
  movesByItem: Map<string, CrmWorkspaceData['stageMoves']>;
  meaningfulByItem: Map<string, string>;
  auditByItem: Map<string, CrmWorkspaceData['auditEvents']>;
  itemsByPipeline: Map<string, WorkItem[]>;
  stagesById: Map<string, PipelineStage>;
  pipelinesById: Map<string, Pipeline>;
  decisionMakerOrganisations: Set<string>;
}

const boardIndexes = new WeakMap<CrmWorkspaceData, BoardIndex>();

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key);
  if (existing) existing.push(value);
  else map.set(key, [value]);
}

function boardIndex(data: CrmWorkspaceData): BoardIndex {
  const cached = boardIndexes.get(data);
  if (cached) return cached;

  const index: BoardIndex = {
    organisationsById: new Map(),
    peopleById: new Map(),
    criteriaByStage: new Map(),
    movesByItem: new Map(),
    meaningfulByItem: new Map(),
    auditByItem: new Map(),
    itemsByPipeline: new Map(),
    stagesById: new Map(),
    pipelinesById: new Map(),
    decisionMakerOrganisations: new Set(),
  };

  for (const organisation of data.organisations) index.organisationsById.set(organisation.id, organisation);
  for (const person of data.people) index.peopleById.set(person.id, person);
  for (const stage of data.stages) index.stagesById.set(stage.id, stage);
  for (const pipeline of data.pipelines) index.pipelinesById.set(pipeline.id, pipeline);

  for (const criterion of data.stageCriteria) pushTo(index.criteriaByStage, criterion.stageId, criterion);
  for (const list of index.criteriaByStage.values()) {
    list.sort((a, b) => a.criterionOrder - b.criterionOrder);
  }

  for (const move of data.stageMoves) pushTo(index.movesByItem, move.workItemId, move);

  for (const activity of data.activities) {
    if (activity.deletedAt !== null || activity.workItemId === null) continue;
    if (!activity.isMeaningfulContact) continue;
    const held = index.meaningfulByItem.get(activity.workItemId);
    if (held === undefined || Date.parse(activity.occurredAt) > Date.parse(held)) {
      index.meaningfulByItem.set(activity.workItemId, activity.occurredAt);
    }
  }

  for (const event of data.auditEvents) {
    if (event.subjectTable !== 'crm_work_items' || event.subjectId === null) continue;
    pushTo(index.auditByItem, event.subjectId, event);
  }

  for (const item of data.workItems) {
    if (item.deletedAt !== null) continue;
    pushTo(index.itemsByPipeline, item.pipelineId, item);
  }

  for (const role of data.personOrganisationRoles) {
    if (role.endedOn !== null) continue;
    if (role.stakeholderRole !== 'decision_maker') continue;
    if (role.organisationId !== null) index.decisionMakerOrganisations.add(role.organisationId);
  }

  boardIndexes.set(data, index);
  return index;
}

/** Drops the cached lookups, for a caller that mutates a dataset in place. */
export function forgetBoardIndex(data: CrmWorkspaceData): void {
  boardIndexes.delete(data);
}

const daysBetween = (from: string, to: string): number =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY);

/* --------------------------------------------------------- the evidence */

export type EvidenceStrength = 'well evidenced' | 'partly evidenced' | 'thinly evidenced';

export interface EvidenceFactor {
  /** What was looked at. */
  what: string;
  /** True where the record carries it. */
  present: boolean;
  /** The fact, in words. Shown either way, so an absence is as visible. */
  detail: string;
}

export interface CardConfidence {
  strength: EvidenceStrength;
  /** Every factor, present and absent, so the word can be argued with. */
  factors: EvidenceFactor[];
  /** The sentence the interface shows under the word. */
  summary: string;
}

/* ------------------------------------------------------------- the card */

export interface PipelineCard {
  item: WorkItem;
  /** What this workspace calls it. One table, a configurable noun. */
  recordWord: string;
  organisationName: string | null;
  primaryPersonName: string | null;
  stage: PipelineStage;
  pipeline: Pipeline;

  daysInStage: number;
  /** What this stage usually takes here. Not a target, a comparison. */
  typicalDays: number;
  /** True where it has been here longer than this stage usually takes. */
  longerThanUsual: boolean;

  nextStep: string | null;
  nextStepDue: string | null;
  nextStepOverdueDays: number | null;

  lastMeaningfulAt: string | null;
  daysSinceMeaningfulContact: number | null;

  expectedValue: number | null;
  valueBasis: WorkItem['valueBasis'];
  expectedCloseDate: string | null;
  /** Every recorded move of the close date. The movement is the signal. */
  closeDateChanges: CloseDateChange[];

  criteria: { criterion: StageCriterion; met: boolean }[];
  /** Required criteria with nothing recorded against them. */
  unmetRequired: StageCriterion[];

  /** Named gaps, never a completeness score. */
  missing: string[];
  /** True where nothing has happened for longer than this workspace tolerates. */
  stale: boolean;
  staleReason: string | null;

  confidence: CardConfidence;

  lostReason: string | null;
  reopened: boolean;
}

/* ------------------------------------------------- building the cards */

function lastMeaningfulFor(data: CrmWorkspaceData, item: WorkItem): string | null {
  return boardIndex(data).meaningfulByItem.get(item.id) ?? null;
}

function criteriaFor(
  data: CrmWorkspaceData,
  item: WorkItem
): { criterion: StageCriterion; met: boolean }[] {
  const criteria = boardIndex(data).criteriaByStage.get(item.stageId) ?? [];

  // What was recorded as met on the move INTO this stage is what counts. A
  // criterion met on a different stage is a different question.
  const arrival = (boardIndex(data).movesByItem.get(item.id) ?? [])
    .filter((m) => m.toStageId === item.stageId)
    .sort((a, b) => b.movedAt.localeCompare(a.movedAt))[0];

  const met = new Set(arrival?.criteriaMet ?? []);
  return criteria.map((criterion) => ({ criterion, met: met.has(criterion.id) }));
}

function confidenceFor(
  data: CrmWorkspaceData,
  item: WorkItem,
  card: {
    unmetRequired: StageCriterion[];
    lastMeaningfulAt: string | null;
    closeDateChanges: CloseDateChange[];
  },
  now: string
): CardConfidence {
  const factors: EvidenceFactor[] = [];

  const decisionMaker =
    item.organisationId !== null &&
    boardIndex(data).decisionMakerOrganisations.has(item.organisationId);
  factors.push({
    what: 'A decision maker is recorded',
    present: decisionMaker,
    detail: decisionMaker
      ? 'Somebody at this organisation is recorded as able to decide.'
      : 'Nobody at this organisation is recorded as able to decide.',
  });

  const stated = item.valueAmount !== null && item.valueBasis === 'stated';
  factors.push({
    what: 'The value was stated by the customer',
    present: stated,
    detail:
      item.valueAmount === null
        ? 'No figure is recorded.'
        : stated
          ? 'The customer named the figure.'
          : `The figure was ${item.valueBasis} rather than stated.`,
  });

  factors.push({
    what: 'A next step is recorded',
    present: item.nextStep !== null,
    detail:
      item.nextStep === null
        ? 'Nothing is written down as the next thing to do.'
        : item.nextStepDue === null
          ? `"${item.nextStep}", with no date agreed.`
          : `"${item.nextStep}", due ${item.nextStepDue}.`,
  });

  const recentContact =
    card.lastMeaningfulAt !== null && daysBetween(card.lastMeaningfulAt, now) <= 30;
  factors.push({
    what: 'There has been recent contact',
    present: recentContact,
    detail:
      card.lastMeaningfulAt === null
        ? 'No conversation with the customer is recorded against this.'
        : `Last conversation ${daysBetween(card.lastMeaningfulAt, now)} days ago.`,
  });

  factors.push({
    what: 'The stage criteria are met',
    present: card.unmetRequired.length === 0,
    detail:
      card.unmetRequired.length === 0
        ? 'Everything this stage requires is recorded as met.'
        : `${card.unmetRequired.length} required ${card.unmetRequired.length === 1 ? 'criterion is' : 'criteria are'} not met: ${card.unmetRequired.map((c) => c.description).join('; ')}.`,
  });

  const steady = card.closeDateChanges.length <= 1;
  factors.push({
    what: 'The expected date has held',
    present: steady,
    detail:
      card.closeDateChanges.length === 0
        ? 'The expected date has not been changed.'
        : `The expected date has been changed ${card.closeDateChanges.length} times.`,
  });

  const commitments = data.commitments.filter(
    (c) => c.deletedAt === null && c.workItemId === item.id && !c.ownedByUs && c.state === 'open'
  );
  factors.push({
    what: 'The customer has committed to something',
    present: commitments.length > 0,
    detail:
      commitments.length === 0
        ? 'The customer has not promised anything that is recorded here.'
        : `${commitments.length} open ${commitments.length === 1 ? 'commitment' : 'commitments'} from their side.`,
  });

  const present = factors.filter((f) => f.present).length;
  const strength: EvidenceStrength =
    present >= 6 ? 'well evidenced' : present >= 4 ? 'partly evidenced' : 'thinly evidenced';

  return {
    strength,
    factors,
    summary: `${present} of ${factors.length} things that make work predictable are recorded against this one. The word is about the record, not about anybody.`,
  };
}

export function buildCard(
  data: CrmWorkspaceData,
  item: WorkItem,
  now: string,
  staleAfterDays = 30
): PipelineCard | null {
  const index = boardIndex(data);
  const stage = index.stagesById.get(item.stageId);
  const pipeline = index.pipelinesById.get(item.pipelineId);
  if (!stage || !pipeline) return null;

  const criteria = criteriaFor(data, item);
  const unmetRequired = criteria
    .filter((c) => c.criterion.isRequired && !c.met)
    .map((c) => c.criterion);

  const lastMeaningfulAt = lastMeaningfulFor(data, item);
  // The close-date history comes from this item's own audit rows rather than
  // from a scan of every audit row in the workspace. Same list, same order.
  const closeDateChanges = closeDateHistory(data, item.id, index.auditByItem.get(item.id) ?? []);
  const daysInStage = daysBetween(item.enteredStageAt, now);

  const missing: string[] = [];
  if (item.organisationId === null) missing.push('organisation');
  if (item.primaryPersonId === null) missing.push('primary contact');
  if (item.valueAmount === null) missing.push('value');
  if (item.expectedCloseDate === null) missing.push('expected date');
  if (item.nextStep === null) missing.push('next step');
  if (item.nextStep !== null && item.nextStepDue === null) missing.push('a date for the next step');

  const sinceContact =
    lastMeaningfulAt === null ? null : daysBetween(lastMeaningfulAt, now);

  // Stale is about the record going quiet, not about anybody being slow.
  let stale = false;
  let staleReason: string | null = null;
  if (item.status === 'open') {
    if (sinceContact === null) {
      stale = true;
      staleReason = 'No conversation with the customer is recorded against this at all.';
    } else if (sinceContact > staleAfterDays) {
      stale = true;
      staleReason = `No conversation recorded for ${sinceContact} days.`;
    } else if (daysInStage > stage.typicalDays * 2) {
      stale = true;
      staleReason = `${daysInStage} days at this stage, where ${stage.typicalDays} is usual here.`;
    }
  }

  const reopened = (index.auditByItem.get(item.id) ?? []).some(
    (e) => e.eventType === 'work_item_reopened'
  );

  return {
    item,
    recordWord: data.workspace.recordTerminology,
    organisationName:
      item.organisationId === null
        ? null
        : (index.organisationsById.get(item.organisationId)?.name ?? null),
    primaryPersonName:
      item.primaryPersonId === null
        ? null
        : (index.peopleById.get(item.primaryPersonId)?.fullName ?? null),
    stage,
    pipeline,

    daysInStage,
    typicalDays: stage.typicalDays,
    longerThanUsual: daysInStage > stage.typicalDays,

    nextStep: item.nextStep,
    nextStepDue: item.nextStepDue,
    nextStepOverdueDays:
      item.nextStepDue !== null && daysBetween(item.nextStepDue, now) > 0
        ? daysBetween(item.nextStepDue, now)
        : null,

    lastMeaningfulAt,
    daysSinceMeaningfulContact: sinceContact,

    expectedValue: item.valueAmount,
    valueBasis: item.valueBasis,
    expectedCloseDate: item.expectedCloseDate,
    closeDateChanges,

    criteria,
    unmetRequired,

    missing,
    stale,
    staleReason,

    confidence: confidenceFor(
      data,
      item,
      { unmetRequired, lastMeaningfulAt, closeDateChanges },
      now
    ),

    lostReason: item.status === 'not_proceeding' ? item.resolutionReason : null,
    reopened,
  };
}

/* ------------------------------------------------------------ the board */

/**
 * The plural word for a pipeline's work.
 *
 * A workspace has a default word, set once, and most workspaces only ever need
 * that one. But a pipeline carries its own kind, and an agency that runs a sales
 * pipeline alongside a property management pipeline needs the second board to
 * say "Jobs" over jobs rather than "Deals". The heading follows the pipeline,
 * falling back to the workspace's own plural wherever the two agree, so a
 * workspace that renamed its records keeps that name.
 */
const TYPE_PLURALS: Record<string, string> = {
  opportunity: 'Opportunities',
  deal: 'Deals',
  job: 'Jobs',
  case: 'Cases',
  application: 'Applications',
};

export function pluralFor(data: CrmWorkspaceData, pipeline: Pipeline): string {
  if (pipeline.workItemType === data.workspace.recordTerminology) {
    return data.workspace.recordTerminologyPlural;
  }
  return TYPE_PLURALS[pipeline.workItemType] ?? data.workspace.recordTerminologyPlural;
}

export interface BoardColumn {
  stage: PipelineStage;
  cards: PipelineCard[];
  /** The total of the figures recorded, and how many had none. */
  recordedValue: number | null;
  withoutValue: number;
  /** Named, because a column total that silently omits rows is a wrong number. */
  valueNote: string;
}

export interface PipelineBoard {
  pipeline: Pipeline;
  /** The word this workspace uses, plural, for headings. */
  recordsPlural: string;
  columns: BoardColumn[];
  /** Resolved work, which the board does not show but the list does. */
  closed: PipelineCard[];
  openCount: number;
  staleCount: number;
}

export function buildBoard(
  data: CrmWorkspaceData,
  pipelineId: string,
  now: string,
  staleAfterDays = 30
): PipelineBoard | null {
  const pipeline = data.pipelines.find((p) => p.id === pipelineId && p.deletedAt === null);
  if (!pipeline) return null;

  const stages = data.stages
    .filter((s) => s.pipelineId === pipeline.id)
    .sort((a, b) => a.stageOrder - b.stageOrder);

  const cards = (boardIndex(data).itemsByPipeline.get(pipeline.id) ?? [])
    .map((item) => buildCard(data, item, now, staleAfterDays))
    .filter((card): card is PipelineCard => card !== null);

  const open = cards.filter((c) => c.item.status === 'open' || c.item.status === 'on_hold');

  const columns: BoardColumn[] = stages
    .filter((stage) => !stage.isClosed)
    .map((stage) => {
      const inStage = open.filter((c) => c.item.stageId === stage.id);
      const withValue = inStage.filter((c) => c.expectedValue !== null);
      const withoutValue = inStage.length - withValue.length;

      return {
        stage,
        cards: inStage.sort((a, b) => b.daysInStage - a.daysInStage),
        recordedValue:
          withValue.length === 0
            ? null
            : withValue.reduce((sum, c) => sum + (c.expectedValue ?? 0), 0),
        withoutValue,
        valueNote:
          inStage.length === 0
            ? 'Nothing is at this stage.'
            : withoutValue === 0
            ? 'Every item here has a figure recorded.'
            : `${withoutValue} of ${inStage.length} ${inStage.length === 1 ? 'item has' : 'items have'} no figure recorded, so this total is lower than the real one.`,
      };
    });

  return {
    pipeline,
    recordsPlural: pluralFor(data, pipeline),
    columns,
    closed: cards.filter((c) => c.item.status === 'won' || c.item.status === 'not_proceeding'),
    openCount: open.length,
    staleCount: open.filter((c) => c.stale).length,
  };
}

/** Every pipeline a workspace has, for the picker. */
export function pipelinesIn(data: CrmWorkspaceData): Pipeline[] {
  return data.pipelines
    .filter((p) => p.deletedAt === null)
    .sort((a, b) => (a.isDefault === b.isDefault ? 0 : a.isDefault ? -1 : 1));
}

/** The flat list, for the list view and the mobile view. */
export function boardAsList(board: PipelineBoard): PipelineCard[] {
  return board.columns
    .flatMap((column) => column.cards)
    .sort((a, b) => {
      // Overdue next steps first, then stale, then by stage order. This is an
      // order over RECORDS and the reason for each position is on the row.
      const aScore = (a.nextStepOverdueDays ?? -1) + (a.stale ? 1000 : 0);
      const bScore = (b.nextStepOverdueDays ?? -1) + (b.stale ? 1000 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return a.stage.stageOrder - b.stage.stageOrder;
    });
}

/** The lost reasons, grouped, for the closed list. */
export function lostReasons(board: PipelineBoard): { reason: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const card of board.closed) {
    if (card.item.status !== 'not_proceeding') continue;
    const reason = card.lostReason ?? 'No reason recorded';
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count);
}

/*
 * Drop the board lookups whenever anything is written.
 *
 * The session store mutates one workspace object in place, so a cache keyed on
 * that object outlives the data it was built from. Registering here means the
 * cache is dropped by the thing that knows a write happened, rather than by
 * every caller remembering to.
 */
onWriteInvalidate(forgetBoardIndex);
