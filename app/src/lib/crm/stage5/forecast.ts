/**
 * Two forecasts, labelled apart, and never merged.
 *
 * WHY TWO, AND WHY THEY ARE NEVER ADDED TOGETHER.
 *
 * A human forecast is a STATEMENT somebody made: "I think this closes in
 * March." It can be wrong, it can be optimistic, and it is accountable, because
 * a person said it and their name is on it.
 *
 * A system estimate is an ARITHMETIC over recorded facts: this has been at the
 * same stage for ninety days, the close date has moved four times, nobody is
 * recorded as able to decide. It cannot be wrong in the same way, because it
 * does not predict anything. It describes what is written down.
 *
 * Blend them and you get a number with the authority of arithmetic and the
 * accountability of nobody, which is the worst object in any sales meeting.
 * They are rendered side by side, labelled, and the difference between them is
 * presented as the useful part, because a gap between what somebody believes
 * and what is recorded is a conversation worth having.
 *
 * WHAT THE SYSTEM ESTIMATE IS NOT ALLOWED TO BE.
 *
 * It is never a probability. There is no "68 per cent likely", because that
 * number would be invented: Concludo has no history of closed work to calibrate
 * against, and presenting an uncalibrated number as a probability is the single
 * most common dishonest thing a CRM does.
 *
 * It uses no private employee characteristic, and produces no score for any
 * person. The factors below are all facts about the WORK. Not one of them takes
 * a user id, and the summary has nowhere to put one.
 */
import { CrmWorkspaceData, WorkItem } from '../domain';
import { PipelineCard, buildCard } from './pipeline';

const DAY = 86_400_000;
const daysBetween = (from: string, to: string): number =>
  Math.floor((new Date(to).getTime() - new Date(from).getTime()) / DAY);

/* ================================================ the human forecast */

export type ForecastCategory = 'commit' | 'best_case' | 'pipeline' | 'omitted';

export const CATEGORY_LABELS: Record<ForecastCategory, string> = {
  commit: 'Committed',
  best_case: 'Best case',
  pipeline: 'In the pipeline',
  omitted: 'Left out of the forecast',
};

export const CATEGORY_MEANINGS: Record<ForecastCategory, string> = {
  commit: 'The person who owns this says it will close in the period, and will stand behind that.',
  best_case: 'It could close in the period if things go well.',
  pipeline: 'It is live, and nobody is saying it closes in the period.',
  omitted: 'Deliberately not counted, with the reason recorded.',
};

export interface HumanForecastEntry {
  workItemId: string;
  category: ForecastCategory;
  /** The figure the person is forecasting, which may differ from the record. */
  amount: number | null;
  /** When they say it closes. */
  expectedCloseDate: string | null;
  /** Who said it. A statement has an author; that is what makes it one. */
  submittedBy: string;
  submittedAt: string;
  /** Their words. Not optional on a commit. */
  note: string | null;
}

export interface HumanForecast {
  entries: HumanForecastEntry[];
  byCategory: Record<ForecastCategory, { count: number; amount: number }>;
  /** Open work with no submission at all. The gap is the point. */
  notSubmitted: PipelineCard[];
  submittedCount: number;
  totalOpen: number;
}

/** The submissions, held in the session store beside everything else. */
const submissions = new Map<string, HumanForecastEntry>();

export function submitForecast(entry: HumanForecastEntry): void {
  if (entry.category === 'commit' && !entry.note?.trim()) {
    throw new Error('A commitment to a number carries the reason the person is sure.');
  }
  submissions.set(`${entry.workItemId}`, entry);
}

export function clearForecastSubmissions(): void {
  submissions.clear();
}

export function humanForecast(cards: PipelineCard[]): HumanForecast {
  const byCategory: HumanForecast['byCategory'] = {
    commit: { count: 0, amount: 0 },
    best_case: { count: 0, amount: 0 },
    pipeline: { count: 0, amount: 0 },
    omitted: { count: 0, amount: 0 },
  };

  const entries: HumanForecastEntry[] = [];
  const notSubmitted: PipelineCard[] = [];

  for (const card of cards) {
    const entry = submissions.get(card.item.id);
    if (!entry) {
      notSubmitted.push(card);
      continue;
    }
    entries.push(entry);
    byCategory[entry.category].count += 1;
    byCategory[entry.category].amount += entry.amount ?? 0;
  }

  return {
    entries,
    byCategory,
    notSubmitted,
    submittedCount: entries.length,
    totalOpen: cards.length,
  };
}

/* ============================================ the evidence-based estimate */

export type FactorDirection = 'supports' | 'weakens' | 'neutral';

export interface EstimateFactor {
  /** The factor, as the brief names it. */
  name: string;
  direction: FactorDirection;
  /** The recorded fact. Never an interpretation of a person. */
  fact: string;
}

export type EstimateBand =
  | 'the record supports this closing'
  | 'the record is thin'
  | 'the record points the other way';

export interface WorkItemEstimate {
  item: WorkItem;
  card: PipelineCard;
  band: EstimateBand;
  factors: EstimateFactor[];
  supporting: number;
  weakening: number;
  /** The whole thing in one sentence a person can disagree with. */
  explanation: string;
  /** The figure recorded against the work, which the estimate does not change. */
  recordedValue: number | null;
}

/**
 * The ten factors the brief names, each one a fact about the work.
 *
 * Every factor returns its evidence whether it supports or weakens, so the
 * explanation can be read as a whole rather than as a list of problems. A
 * screen that only shows what is wrong teaches people that the feature is a
 * telling-off.
 */
export function estimateFactors(
  data: CrmWorkspaceData,
  card: PipelineCard,
  now: string
): EstimateFactor[] {
  const factors: EstimateFactor[] = [];
  const item = card.item;

  // 1. Current stage.
  const stages = data.stages
    .filter((s) => s.pipelineId === item.pipelineId && !s.isClosed)
    .sort((a, b) => a.stageOrder - b.stageOrder);
  const position = stages.findIndex((s) => s.id === item.stageId);
  const late = position >= 0 && position >= stages.length - 2;
  factors.push({
    name: 'Current stage',
    direction: late ? 'supports' : position <= 0 ? 'weakens' : 'neutral',
    fact: `At ${card.stage.name}, which is ${position + 1} of ${stages.length} open stages in ${card.pipeline.name}.`,
  });

  // 2. Stage history.
  const moves = data.stageMoves
    .filter((m) => m.workItemId === item.id)
    .sort((a, b) => a.movedAt.localeCompare(b.movedAt));
  const backwards = moves.filter((m, index) => {
    if (index === 0 || !m.fromStageId) return false;
    const from = data.stages.find((s) => s.id === m.fromStageId);
    const to = data.stages.find((s) => s.id === m.toStageId);
    return from && to && to.stageOrder < from.stageOrder;
  }).length;
  factors.push({
    name: 'Stage history',
    direction: backwards > 0 ? 'weakens' : moves.length > 1 ? 'supports' : 'neutral',
    fact:
      backwards > 0
        ? `${moves.length} stage ${moves.length === 1 ? 'move' : 'moves'} recorded, ${backwards} of them backwards.`
        : `${moves.length} stage ${moves.length === 1 ? 'move' : 'moves'} recorded, all forwards.`,
  });

  // 3. Stage age.
  factors.push({
    name: 'Stage age',
    direction: card.daysInStage > card.typicalDays * 2 ? 'weakens' : card.longerThanUsual ? 'neutral' : 'supports',
    fact: `${card.daysInStage} days at this stage, where ${card.typicalDays} is usual here.`,
  });

  // 4. Missing next step.
  factors.push({
    name: 'Next step',
    direction: item.nextStep === null ? 'weakens' : 'supports',
    fact:
      item.nextStep === null
        ? 'Nothing is recorded as the next thing to do.'
        : `"${item.nextStep}"${item.nextStepDue ? `, due ${item.nextStepDue}` : ', with no date agreed'}.`,
  });

  // 5. Missing decision maker.
  const decisionMaker = data.personOrganisationRoles.find(
    (r) =>
      r.organisationId === item.organisationId &&
      r.endedOn === null &&
      r.stakeholderRole === 'decision_maker'
  );
  const decisionMakerName = decisionMaker
    ? data.people.find((p) => p.id === decisionMaker.personId)?.fullName
    : null;
  factors.push({
    name: 'Decision maker',
    direction: decisionMaker ? 'supports' : 'weakens',
    fact: decisionMaker
      ? `${decisionMakerName ?? 'Somebody'} is recorded as able to decide.`
      : 'Nobody at this organisation is recorded as able to decide.',
  });

  // 6. Repeated close-date changes.
  const changes = card.closeDateChanges;
  const pushedOut = changes.filter((c) => (c.movedDays ?? 0) > 0).length;
  factors.push({
    name: 'Close-date movement',
    direction: pushedOut >= 2 ? 'weakens' : changes.length === 0 ? 'neutral' : 'supports',
    fact:
      changes.length === 0
        ? 'The expected date has not been changed.'
        : `Changed ${changes.length} ${changes.length === 1 ? 'time' : 'times'}, ${pushedOut} of them later.`,
  });

  // 7. Recent activity.
  factors.push({
    name: 'Recent activity',
    direction:
      card.daysSinceMeaningfulContact === null
        ? 'weakens'
        : card.daysSinceMeaningfulContact <= 14
          ? 'supports'
          : card.daysSinceMeaningfulContact <= 45
            ? 'neutral'
            : 'weakens',
    fact:
      card.daysSinceMeaningfulContact === null
        ? 'No conversation with the customer is recorded against this.'
        : `Last conversation ${card.daysSinceMeaningfulContact} days ago.`,
  });

  // 8. Required stage criteria.
  factors.push({
    name: 'Stage criteria',
    direction: card.unmetRequired.length > 0 ? 'weakens' : 'supports',
    fact:
      card.unmetRequired.length === 0
        ? 'Everything this stage requires is recorded as met.'
        : `${card.unmetRequired.length} required ${card.unmetRequired.length === 1 ? 'criterion is' : 'criteria are'} unmet.`,
  });

  // 9. Customer commitments.
  const theirs = data.commitments.filter(
    (c) => c.deletedAt === null && c.workItemId === item.id && !c.ownedByUs && c.state === 'open'
  );
  const overdue = theirs.filter(
    (c) => c.dueDate !== null && daysBetween(c.dueDate, now) > 0
  ).length;
  factors.push({
    name: 'Customer commitments',
    direction: theirs.length === 0 ? 'neutral' : overdue > 0 ? 'weakens' : 'supports',
    fact:
      theirs.length === 0
        ? 'The customer has not promised anything that is recorded here.'
        : overdue > 0
          ? `${theirs.length} open from their side, ${overdue} past the agreed date.`
          : `${theirs.length} open from their side, none overdue.`,
  });

  // 10. Unresolved service issues.
  const unresolved = data.serviceCases.filter(
    (c) =>
      c.deletedAt === null &&
      c.organisationId === item.organisationId &&
      c.state !== 'resolved' &&
      c.state !== 'closed'
  );
  factors.push({
    name: 'Service issues',
    direction: unresolved.length > 0 ? 'weakens' : 'supports',
    fact:
      unresolved.length === 0
        ? 'No unresolved service matter at this organisation.'
        : `${unresolved.length} unresolved service ${unresolved.length === 1 ? 'matter' : 'matters'} at this organisation: ${unresolved.map((c) => c.title).join('; ')}.`,
  });

  return factors;
}

export function estimateFor(
  data: CrmWorkspaceData,
  card: PipelineCard,
  now: string
): WorkItemEstimate {
  const factors = estimateFactors(data, card, now);
  const supporting = factors.filter((f) => f.direction === 'supports').length;
  const weakening = factors.filter((f) => f.direction === 'weakens').length;

  const band: EstimateBand =
    supporting >= weakening + 3
      ? 'the record supports this closing'
      : weakening >= supporting + 2
        ? 'the record points the other way'
        : 'the record is thin';

  const headline = factors
    .filter((f) => f.direction === 'weakens')
    .slice(0, 2)
    .map((f) => f.fact);

  return {
    item: card.item,
    card,
    band,
    factors,
    supporting,
    weakening,
    explanation:
      weakening === 0
        ? `All ${supporting} of the things that make work predictable are recorded here.`
        : `${supporting} of ten factors support this and ${weakening} do not. ${headline.join(' ')}`,
    recordedValue: card.expectedValue,
  };
}

export interface SystemEstimate {
  items: WorkItemEstimate[];
  byBand: Record<EstimateBand, { count: number; recordedValue: number; withoutValue: number }>;
  /** Said on screen, every time, in these words. */
  disclaimer: string;
}

export function systemEstimate(
  data: CrmWorkspaceData,
  cards: PipelineCard[],
  now: string
): SystemEstimate {
  const items = cards.map((card) => estimateFor(data, card, now));

  const byBand: SystemEstimate['byBand'] = {
    'the record supports this closing': { count: 0, recordedValue: 0, withoutValue: 0 },
    'the record is thin': { count: 0, recordedValue: 0, withoutValue: 0 },
    'the record points the other way': { count: 0, recordedValue: 0, withoutValue: 0 },
  };

  for (const estimate of items) {
    const bucket = byBand[estimate.band];
    bucket.count += 1;
    if (estimate.recordedValue === null) bucket.withoutValue += 1;
    else bucket.recordedValue += estimate.recordedValue;
  }

  return {
    items,
    byBand,
    disclaimer:
      'This is not a forecast and it is not a prediction. It is a description of what is written down against each piece of work, grouped by how much of it is there. Concludo has no history of closed work to calibrate a probability against, so it does not offer one.',
  };
}

/* ====================================================== the comparison */

export interface ForecastComparison {
  workItemId: string;
  title: string;
  /** What a person said. */
  human: HumanForecastEntry | null;
  /** What the record says. */
  estimate: WorkItemEstimate;
  /** Where the two disagree, and in which direction. Never resolved for them. */
  disagreement: string | null;
}

/**
 * Where the two views disagree.
 *
 * This is the useful part and the reason both exist. A deal somebody has
 * committed to, where the record points the other way, is not a sign that the
 * person is wrong. It is a sign that something they know is not written down,
 * and the fix is usually two minutes of typing rather than an argument.
 */
export function compareForecasts(
  human: HumanForecast,
  system: SystemEstimate
): ForecastComparison[] {
  const byItem = new Map(human.entries.map((e) => [e.workItemId, e]));

  return system.items.map((estimate) => {
    const entry = byItem.get(estimate.item.id) ?? null;

    let disagreement: string | null = null;
    if (entry?.category === 'commit' && estimate.band === 'the record points the other way') {
      disagreement =
        'Committed, and the record points the other way. Something known is probably not written down.';
    } else if (
      entry?.category === 'pipeline' &&
      estimate.band === 'the record supports this closing'
    ) {
      disagreement =
        'Not forecast to close, and the record supports it closing. Worth a second look.';
    } else if (entry === null && estimate.band === 'the record supports this closing') {
      disagreement = 'Nobody has submitted a view on this, and the record supports it closing.';
    }

    return {
      workItemId: estimate.item.id,
      title: estimate.item.title,
      human: entry,
      estimate,
      disagreement,
    };
  });
}

/** Everything a forecast view needs, composed once. */
export interface ForecastView {
  human: HumanForecast;
  system: SystemEstimate;
  comparison: ForecastComparison[];
  disagreements: ForecastComparison[];
}

export function buildForecast(
  data: CrmWorkspaceData,
  pipelineId: string | null,
  now: string
): ForecastView {
  const cards = data.workItems
    .filter(
      (w) =>
        w.deletedAt === null &&
        w.status === 'open' &&
        (pipelineId === null || w.pipelineId === pipelineId)
    )
    .map((item) => buildCard(data, item, now))
    .filter((card): card is PipelineCard => card !== null);

  const human = humanForecast(cards);
  const system = systemEstimate(data, cards, now);
  const comparison = compareForecasts(human, system);

  return {
    human,
    system,
    comparison,
    disagreements: comparison.filter((c) => c.disagreement !== null),
  };
}
