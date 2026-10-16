/**
 * The living account plan.
 *
 * WHY "LIVING" IS A DESIGN CONSTRAINT AND NOT A WORD ON A SLIDE.
 *
 * The usual account plan is a document. Somebody fills it in during planning
 * week, it is accurate for nine days, and for the rest of the year it is a
 * record of what was true in February that everybody quotes as though it were
 * true now. The failure is not laziness. It is that re-typing facts the CRM
 * already holds is work nobody will do twice, so the plan rots from the data
 * end first: the renewal date moves, two people leave, three service cases
 * open, and the plan still says what it said.
 *
 * So this module splits the plan in two, and the split is the whole idea:
 *
 *   DERIVED, never typed. Current value delivered, products in use, open
 *   service issues, renewal date, relationship coverage, opportunities, pending
 *   proposals, source evidence, last reviewed. These are read from the records
 *   every time the plan is opened, so they cannot go stale, and the plan never
 *   asks anybody to copy them in.
 *
 *   WRITTEN, by a person, with their name on it. Customer objectives and their
 *   measures, risks, constraints, competitive position, SWOT, growth
 *   opportunities, the action plan, the cadence, the owner. These are judgement,
 *   they cannot be derived, and software that tried would be making things up.
 *
 * The interface shows which is which, because a reader who cannot tell a
 * recorded fact from somebody's opinion will treat the opinion as a fact.
 *
 * WHAT IS NOT HERE.
 *
 * No account score. No health rating. No "plan completeness" percentage. A
 * completeness bar is the same mistake as a relationship score wearing a
 * different hat: it makes filling in boxes look like understanding an account,
 * and it rewards the person who writes nine shallow risks over the one who
 * writes the real one. What this module returns instead is a list of what is
 * not recorded, in words, which a person can read and decide about.
 */
import {
  AccountPlan,
  AccountPlanAction,
  AccountPlanEntry,
  AccountPlanOutcome,
  Commitment,
  CrmWorkspaceData,
  InvoiceReference,
  Organisation,
  PlanSection,
  Product,
  Proposal,
  ReviewCadence,
  ServiceCase,
  WorkItem,
} from '../domain';
import { Coverage, coverageFor } from '../stage4/hierarchy';
import { SourceTrail, trailsFor } from '../stage4/sources';
import { lastMeaningfulContactWith } from '../stage4/relationships';
import { StakeholderMap, buildStakeholderMap } from './stakeholderMap';
import { WhitespaceGrid, buildWhitespaceGrid, axesWithData } from './whitespace';
import { JointPlanView, buildJointPlan } from './jointPlan';
import { planFor } from './visibility';

export const SECTION_WORDS: Record<PlanSection, string> = {
  risk: 'Risks',
  constraint: 'Constraints',
  competitive_position: 'Competitive position',
  swot_strength: 'Strengths',
  swot_weakness: 'Weaknesses',
  swot_opportunity: 'Opportunities',
  swot_threat: 'Threats',
  growth_opportunity: 'Growth opportunities',
  current_value: 'Value delivered so far',
};

export const CADENCE_WORDS: Record<ReviewCadence, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  half_yearly: 'Every six months',
  yearly: 'Yearly',
  not_set: 'Not set',
};

/* ------------------------------------------------------- the sections */

export interface PlanSectionView {
  section: PlanSection;
  word: string;
  entries: { entry: AccountPlanEntry; evidence: SourceTrail | null }[];
  /** Said where a section is empty, so a blank reads as a question. */
  emptyMessage: string;
}

const EMPTY_MESSAGES: Record<PlanSection, string> = {
  risk: 'No risk is recorded. That usually means nobody has written one down, not that there are none.',
  constraint: 'No constraint is recorded. Budget cycles, approval chains and freeze periods go here.',
  competitive_position:
    'Nothing is recorded about who else they are talking to, or why they chose us.',
  swot_strength: 'Nothing recorded.',
  swot_weakness: 'Nothing recorded.',
  swot_opportunity: 'Nothing recorded.',
  swot_threat: 'Nothing recorded.',
  growth_opportunity:
    'No growth opportunity is written down. The whitespace grid is where the questions usually come from.',
  current_value:
    'Nothing is recorded about what they have got out of this so far. It is the hardest section to fill in and the one a renewal conversation needs most.',
};

/* ------------------------------------------------------- the whole plan */

export interface AccountPlanView {
  plan: AccountPlan;
  organisation: Organisation;

  /* ---- written by a person ---- */
  summary: string | null;
  objectives: AccountPlanOutcome[];
  sections: PlanSectionView[];
  swot: { strengths: PlanSectionView; weaknesses: PlanSectionView; opportunities: PlanSectionView; threats: PlanSectionView };
  actions: AccountPlanAction[];
  openActions: AccountPlanAction[];
  overdueActions: AccountPlanAction[];
  reviewCadence: ReviewCadence;
  reviewCadenceWord: string;
  planOwnerUserId: string | null;

  /* ---- derived from the records, never typed ---- */
  productsInUse: Product[];
  openWork: WorkItem[];
  openServiceCases: ServiceCase[];
  invoices: InvoiceReference[];
  openCommitments: { ours: Commitment[]; theirs: Commitment[] };
  /** The organisations the derived figures above cover. */
  rolledUpFrom: Organisation[];
  /** Said on the page wherever a figure includes a subsidiary's records. */
  rollUpNote: string | null;
  renewalDate: string | null;
  renewalInDays: number | null;
  coverage: Coverage;
  stakeholders: StakeholderMap | null;
  whitespace: WhitespaceGrid | null;
  jointPlans: JointPlanView[];
  pendingProposals: Proposal[];
  evidence: SourceTrail[];
  lastReviewedAt: string | null;
  daysSinceReview: number | null;
  reviewDate: string | null;
  reviewOverdueDays: number | null;

  /* ---- what nobody has written down ---- */
  notRecorded: string[];
  /** Said on the page: which half of this is fact and which is judgement. */
  derivationNote: string;
}

function daysBetween(fromIso: string | null, now: string): number | null {
  if (!fromIso) return null;
  return Math.floor((new Date(now).getTime() - new Date(fromIso).getTime()) / 86_400_000);
}

function sectionView(
  data: CrmWorkspaceData,
  planId: string,
  section: PlanSection
): PlanSectionView {
  const entries = data.accountPlanEntries
    .filter((e) => e.accountPlanId === planId && e.section === section && e.deletedAt === null)
    .sort((a, b) => a.entryOrder - b.entryOrder)
    .map((entry) => ({
      entry,
      evidence: entry.evidenceId
        ? ((): SourceTrail | null => {
            const row = data.evidence.find((e) => e.id === entry.evidenceId);
            if (!row) return null;
            return trailsFor(data, row.subjectTable, row.subjectId).find(
              (t) => t.evidenceId === row.id
            ) ?? null;
          })()
        : null,
    }));

  return {
    section,
    word: SECTION_WORDS[section],
    entries,
    emptyMessage: EMPTY_MESSAGES[section],
  };
}

export function buildAccountPlan(
  data: CrmWorkspaceData,
  organisationId: string,
  now: string
): AccountPlanView | null {
  // Gate one and gate two, in that order. A plan that does not exist and a
  // workspace with planning switched off are different conditions, and both
  // return nothing here rather than an empty scaffold.
  const plan = planFor(data, organisationId);
  if (!plan) return null;

  const organisation = data.organisations.find(
    (o) => o.id === organisationId && o.deletedAt === null
  );
  if (!organisation) return null;

  /* ---- derived ---- */

  /**
   * THE GROUP PROBLEM.
   *
   * A plan for a parent company whose work all sits in its divisions showed
   * zero work, zero products and zero commitments, which is exactly backwards:
   * the group plan is the one place somebody needs to see all of it. So
   * everything derived below is rolled up through the hierarchy, and anything
   * that came from a subsidiary is marked rather than silently merged, because
   * "four open deals" and "four open deals, three of them at Logistics" are
   * different facts in a review meeting.
   *
   * One level of children, not the whole subtree, because the hierarchy is
   * already guarded against cycles but a plan that silently aggregated five
   * levels would present a number nobody could check.
   */
  const childIds = data.organisations
    .filter((o) => o.parentOrganisationId === organisation.id && o.deletedAt === null)
    .map((o) => o.id);
  const accountIds = [organisation.id, ...childIds];
  const atThisAccount = (id: string | null): boolean => id !== null && accountIds.includes(id);

  const openWork = data.workItems.filter(
    (w) => atThisAccount(w.organisationId) && w.status === 'open' && w.deletedAt === null
  );

  const quotedProductIds = new Set(
    data.quotes
      .filter((q) => {
        const item = data.workItems.find((w) => w.id === q.workItemId);
        return atThisAccount(item?.organisationId ?? null) && q.state === 'accepted';
      })
      .flatMap((q) => data.quoteLines.filter((l) => l.quoteId === q.id).map((l) => l.productId))
  );
  /**
   * Two records say what a customer uses, and they must not disagree.
   *
   * An accepted quote is one. A whitespace cell somebody marked "in use" is
   * the other, and it is usually the better one, because it is how a person
   * records something the customer was already doing before we sold them
   * anything. The first version of this read only the quotes, so this panel
   * said "nothing recorded" directly above a whitespace grid showing three
   * products in use at the same account.
   */
  const inUseProductIds = new Set(
    data.whitespaceCells
      .filter(
        (c) => c.deletedAt === null && atThisAccount(c.organisationId) && c.state === 'in_use'
      )
      .map((c) => c.productId)
  );

  const productsInUse = data.products.filter(
    (p) => p.deletedAt === null && (quotedProductIds.has(p.id) || inUseProductIds.has(p.id))
  );

  const openServiceCases = data.serviceCases.filter(
    (c) =>
      atThisAccount(c.organisationId) &&
      c.deletedAt === null &&
      c.state !== 'resolved' &&
      c.state !== 'closed'
  );

  const commitments = data.commitments.filter(
    (c) => atThisAccount(c.organisationId) && c.deletedAt === null && c.state === 'open'
  );

  const coverage = coverageFor(data, organisation, (personId) =>
    lastMeaningfulContactWith(data, personId)
  );

  const axes = axesWithData(data, organisation.id);
  const whitespace = axes.length > 0 ? buildWhitespaceGrid(data, organisation.id, axes[0]) : null;

  const jointPlans = data.jointPlans
    .filter((p) => p.organisationId === organisation.id && p.deletedAt === null)
    .map((p) => buildJointPlan(data, p.id, now))
    .filter((v): v is JointPlanView => v !== null);

  // Proposals awaiting a person, about this account or about its plan. A
  // proposal that has been confirmed has already happened and belongs in the
  // record, not in a list of things waiting for somebody.
  const pendingProposals = data.proposals.filter(
    (p) =>
      p.state === 'awaiting_confirmation' &&
      p.deletedAt === null &&
      ((p.subjectTable === 'crm_organisations' && p.subjectId === organisation.id) ||
        (p.subjectTable === 'crm_account_plans' && p.subjectId === plan.id) ||
        // A proposal about one of this account's people is about this account.
        (p.subjectTable === 'crm_people' &&
          data.people.some((person) => person.id === p.subjectId && person.organisationId === organisation.id)))
  );

  /* ---- written ---- */

  const objectives = data.accountPlanOutcomes
    .filter((o) => o.accountPlanId === plan.id)
    .sort((a, b) => a.outcomeOrder - b.outcomeOrder);

  const sections = (
    [
      'current_value',
      'risk',
      'constraint',
      'competitive_position',
      'growth_opportunity',
    ] as PlanSection[]
  ).map((section) => sectionView(data, plan.id, section));

  const swot = {
    strengths: sectionView(data, plan.id, 'swot_strength'),
    weaknesses: sectionView(data, plan.id, 'swot_weakness'),
    opportunities: sectionView(data, plan.id, 'swot_opportunity'),
    threats: sectionView(data, plan.id, 'swot_threat'),
  };

  const actions = data.accountPlanActions
    .filter((a) => a.accountPlanId === plan.id && a.deletedAt === null)
    .sort((a, b) => a.actionOrder - b.actionOrder);
  const openActions = actions.filter((a) => a.state === 'open');

  const today = now.slice(0, 10);
  const overdueActions = openActions.filter((a) => a.dueDate !== null && a.dueDate < today);

  /* ---- what nobody has written down ---- */

  const notRecorded: string[] = [];
  if (!plan.summary) notRecorded.push('A summary of where this account stands');
  if (objectives.length === 0) notRecorded.push('What the customer is trying to achieve');
  if (sections.find((s) => s.section === 'risk')?.entries.length === 0) {
    notRecorded.push('Any risk to this account');
  }
  if (sections.find((s) => s.section === 'current_value')?.entries.length === 0) {
    notRecorded.push('What they have got out of this so far');
  }
  if (sections.find((s) => s.section === 'competitive_position')?.entries.length === 0) {
    notRecorded.push('Who else they are talking to, or why they chose us');
  }
  if (actions.length === 0) notRecorded.push('An action plan');
  if (plan.reviewCadence === 'not_set') notRecorded.push('How often this account is reviewed');
  if (!plan.planOwnerUserId) notRecorded.push('Who keeps this plan current');
  if (!plan.lastReviewedAt) notRecorded.push('A review. This plan has never been reviewed.');

  const reviewOverdueDays =
    plan.reviewDate && plan.reviewDate < today
      ? Math.floor(
          (new Date(now).getTime() - new Date(`${plan.reviewDate}T00:00:00.000Z`).getTime()) /
            86_400_000
        )
      : null;

  return {
    plan,
    organisation,

    summary: plan.summary,
    objectives,
    sections,
    swot,
    actions,
    openActions,
    overdueActions,
    reviewCadence: plan.reviewCadence,
    reviewCadenceWord: CADENCE_WORDS[plan.reviewCadence],
    planOwnerUserId: plan.planOwnerUserId,

    productsInUse,
    openWork,
    openServiceCases,
    invoices: data.invoiceReferences.filter((i) => i.organisationId === organisation.id),
    openCommitments: {
      ours: commitments.filter((c) => c.ownedByUs),
      theirs: commitments.filter((c) => !c.ownedByUs),
    },
    rolledUpFrom: data.organisations.filter((o) => childIds.includes(o.id)),
    rollUpNote:
      childIds.length === 0
        ? null
        : `These figures include ${childIds.length} ${childIds.length === 1 ? 'organisation' : 'organisations'} under ${organisation.name}, because the work at a group sits in its divisions.`,
    renewalDate: organisation.renewalDate,
    renewalInDays: organisation.renewalDate
      ? Math.floor(
          (new Date(`${organisation.renewalDate}T00:00:00.000Z`).getTime() -
            new Date(now).getTime()) /
            86_400_000
        )
      : null,
    coverage,
    stakeholders: buildStakeholderMap(data, organisation.id, now),
    whitespace,
    jointPlans,
    pendingProposals,
    evidence: trailsFor(data, 'crm_organisations', organisation.id),
    lastReviewedAt: plan.lastReviewedAt,
    daysSinceReview: daysBetween(plan.lastReviewedAt, now),
    reviewDate: plan.reviewDate,
    reviewOverdueDays,

    notRecorded,
    derivationNote:
      'The left of this plan is read from the records every time it is opened, so it cannot go out of date. The right is what people here have written, and it is only as current as the last person who wrote it.',
  };
}

/** Every plan in the workspace, for the index. Empty where planning is off. */
export function accountPlansIn(data: CrmWorkspaceData, now: string): AccountPlanView[] {
  return data.accountPlans
    .filter((p) => p.deletedAt === null)
    .map((p) => buildAccountPlan(data, p.organisationId, now))
    .filter((v): v is AccountPlanView => v !== null)
    .sort((a, b) => a.organisation.name.localeCompare(b.organisation.name));
}
