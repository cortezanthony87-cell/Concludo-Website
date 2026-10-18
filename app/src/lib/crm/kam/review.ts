/**
 * The KAM Copilot: six lenses over one account.
 *
 * WHAT THIS IS.
 *
 * The brief asks for an account strategist rather than a CRM assistant:
 * something that improves a person's judgement before a customer conversation
 * instead of tidying records after one. The six lenses it names are account
 * goals, research, people, opportunities, competitive positioning and action
 * planning, and the discipline it names is the one that matters most:
 *
 *   State what is known. State what is assumed. State what must be validated.
 *   Never treat an assumption as a fact.
 *
 * So that triple is the return type of every lens here, not a style of
 * writing. `known` carries findings that each point at a record. `assumed`
 * carries inferences, each saying what it was inferred FROM. `toValidate`
 * carries the questions that would settle them, each tied to the gap it
 * closes. A lens cannot return a finding without saying which of the three it
 * is, because the field it goes in decides.
 *
 * WHAT IT IS NOT, AND WHY.
 *
 * The brief also asks for power maps, influence networks, blockers, opponents,
 * and "who benefits, who loses" on named individuals. This module does not
 * produce any of that, by a decision taken on 17 October 2026, and the reason
 * is worth keeping with the code.
 *
 *   THE SCHEMA REFUSES IT. Migrations 0008 and 0009 fail the deploy if
 *   anything that scores or ranks a person reaches a CRM table. That rule is
 *   not decoration: it is what lets a customer be told, truthfully, what this
 *   system holds about their staff.
 *
 *   AN INFERRED DISPOSITION IS A RUMOUR WITH A UI. "Likely blocker" against a
 *   named person, produced by software from four meeting notes, is a judgement
 *   that will be repeated in a QBR by somebody who did not read the four
 *   meeting notes. Under Australian privacy law the person it describes can
 *   ask to see it. "She pushed back on the timeline in the March meeting",
 *   sourced and quoted, survives that question. "Resistance: high" does not.
 *
 *   THE GAP IS THE USEFUL FINDING ANYWAY. "No economic buyer is recorded on
 *   this account, and the plan commits to a decision in six weeks" is
 *   actionable, checkable, and nobody's opinion of a colleague. That is what
 *   the people lens returns.
 *
 * So: roles are reported only where a PERSON recorded them, with the sentence
 * that person gave as evidence; `blocker` additionally requires confirmation,
 * which the schema already enforces. What the module adds is the shape of the
 * buying centre and the holes in it. It never asserts a disposition, never
 * ranks two people, and emits no figure keyed to an individual.
 *
 * NO MODEL CALL. Same as the rest of Stage 7. Everything here is computed from
 * the records, which is what makes the test suite assert a property of the
 * rails rather than of a model's mood. `KAM_COPILOT_OPERATING_PROMPT` in
 * ./prompt.ts is the instruction a model will receive when one is wired in,
 * and it is kept beside the rails that will constrain it rather than in a
 * document somebody edits separately.
 */
import {
  AccountPlan,
  CrmWorkspaceData,
  Organisation,
  StakeholderRole,
  Uuid,
} from '../domain';
import { onWriteInvalidate } from '../cacheBus';
import { indexFor } from '../stage8/paging';

const DAY = 86_400_000;

/* ===================================================== the three states */

/**
 * One thing the copilot has to say, and which of the three kinds it is.
 *
 * `basis` is the field that keeps the brief's rule honest. A finding cannot be
 * built without choosing one, and the page renders the three under separate
 * headings, so an inference can never be read as a fact by somebody skimming.
 */
export interface Finding {
  key: string;
  /** The finding, in a sentence somebody can disagree with. */
  statement: string;
  /**
   * stated     somebody recorded it. The record is in `sources`.
   * inferred   the copilot worked it out. `from` says from what.
   * unknown    nothing in the records answers this.
   */
  basis: 'stated' | 'inferred' | 'unknown';
  /** What the inference was drawn from. Required when basis is inferred. */
  from: string | null;
  sources: FindingSource[];
  /** Where this matters, for ordering: a gap before a decision outranks one after. */
  weight: 'high' | 'moderate' | 'low';
}

export interface FindingSource {
  table: string;
  id: Uuid;
  label: string;
  /** The sentence from the record. Never the copilot's paraphrase of it. */
  quote: string | null;
  path: string | null;
}

/** A question that would close a gap, tied to the gap it closes. */
export interface ValidationQuestion {
  key: string;
  question: string;
  /** The finding this would settle. */
  closes: string;
  /** Who would know, by role rather than by name. */
  askWhom: string;
  kind: 'executive' | 'strategic' | 'operational' | 'risk' | 'expansion';
}

export interface Lens {
  key: LensKey;
  label: string;
  /** The question this lens answers, shown under the heading. */
  question: string;
  known: Finding[];
  assumed: Finding[];
  unknown: Finding[];
  questions: ValidationQuestion[];
  /**
   * How much of this lens the records can answer, as a whole per cent.
   *
   * Known over known plus unknown. It is a coverage figure about the RECORDS,
   * not a score of the account and not a judgement of the person who keeps
   * them. The page says so where it draws it.
   */
  coverage: number;
}

export type LensKey =
  | 'goals'
  | 'research'
  | 'people'
  | 'opportunities'
  | 'competition'
  | 'actions';

export const LENS_ORDER: LensKey[] = [
  'goals',
  'research',
  'people',
  'opportunities',
  'competition',
  'actions',
];

export const LENS_LABELS: Record<LensKey, string> = {
  goals: 'Account goals',
  research: 'Research',
  people: 'People',
  opportunities: 'Opportunities',
  competition: 'Competitive position',
  actions: 'Action planning',
};

export const LENS_QUESTIONS: Record<LensKey, string> = {
  goals: 'What is this account meant to achieve, and who said so?',
  research: 'What do we actually know about how this customer works?',
  people: 'Who is in the buying centre, and which seats are empty?',
  opportunities: 'What is open, and what has never been asked?',
  competition: 'Who else is in this account, and what is recorded about them?',
  actions: 'What was committed, and what is overdue?',
};

/* ===================================================== the buying centre */

/**
 * The seats a buying centre has, and whether anybody is in them.
 *
 * This is the people lens's whole output, and it is deliberately about SEATS
 * rather than about people. An empty economic buyer seat on an account with a
 * decision due is a finding. "Who is the blocker" is not a question this
 * module answers, because answering it would mean asserting a disposition
 * about a named individual that nobody recorded.
 */
export interface Seat {
  role: StakeholderRole;
  label: string;
  /** How many people hold this role here. Never which of them matters more. */
  filled: number;
  /** Of those, how many had the role confirmed by a person. */
  confirmed: number;
  /** Of those, how many have an objective recorded in their own words. */
  withObjective: number;
  /** True where this seat being empty is a problem worth raising. */
  requiredForDecision: boolean;
}

export const SEAT_LABELS: Record<StakeholderRole, string> = {
  decision_maker: 'Decision maker',
  economic_buyer: 'Economic buyer',
  influencer: 'Influencer',
  user: 'User',
  champion: 'Champion',
  gatekeeper: 'Gatekeeper',
  adviser: 'Adviser',
  blocker: 'Recorded as resistant',
  unknown: 'Role not recorded',
};

/** The seats whose absence is raised. A buying centre missing these cannot decide. */
const REQUIRED_SEATS: StakeholderRole[] = ['decision_maker', 'economic_buyer', 'champion'];

export interface AccountReviewResult {
  organisationId: Uuid;
  organisationName: string;
  lenses: Lens[];
  seats: Seat[];
  /** Every question from every lens, ordered by the weight of the gap it closes. */
  questions: ValidationQuestion[];
  /** Coverage across the six lenses, as a whole per cent of the records. */
  coverage: number;
  /** Said at the top of the page, every time. */
  note: string;
  computedAt: string;
}

export const KAM_REVIEW_NOTE =
  'Everything on this page is separated into what is recorded, what the copilot inferred and what nothing answers. An inference names what it was drawn from. Nothing here is a judgement about a person, a ranking, or a score.';

/* ===================================================== helpers */

function finding(
  key: string,
  statement: string,
  basis: Finding['basis'],
  weight: Finding['weight'],
  sources: FindingSource[] = [],
  from: string | null = null
): Finding {
  return { key, statement, basis, from, sources, weight };
}

function planSource(plan: AccountPlan, quote: string | null): FindingSource {
  return {
    table: 'crm_account_plans',
    id: plan.id,
    label: 'The account plan',
    quote,
    path: '/crm/plans',
  };
}

function orgSource(organisation: Organisation, quote: string | null = null): FindingSource {
  return {
    table: 'crm_organisations',
    id: organisation.id,
    label: organisation.name,
    quote,
    path: `/crm/organisations/${organisation.id}`,
  };
}

function wholePercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

/* ===================================================== the lenses */

function goalsLens(
  data: CrmWorkspaceData,
  organisation: Organisation,
  now: string
): Lens {
  const known: Finding[] = [];
  const unknown: Finding[] = [];
  const assumed: Finding[] = [];
  const questions: ValidationQuestion[] = [];

  const plan = data.accountPlans.find(
    (entry) => entry.organisationId === organisation.id && entry.deletedAt === null
  );

  if (!plan) {
    unknown.push(
      finding(
        'no_plan',
        'No account plan exists for this customer, so there is no recorded objective to work towards.',
        'unknown',
        'high',
        [orgSource(organisation)]
      )
    );
    questions.push({
      key: 'q_plan_objective',
      question: 'What is this relationship meant to achieve over the next twelve months?',
      closes: 'No account plan exists',
      askWhom: 'whoever owns this account internally',
      kind: 'strategic',
    });
  } else {
    known.push(
      finding(
        'plan_objective',
        `The plan's objective is: ${plan.objective}`,
        'stated',
        'high',
        [planSource(plan, plan.objective)]
      )
    );

    const outcomes = data.accountPlanOutcomes.filter(
      (outcome) => outcome.accountPlanId === plan.id
    );
    if (outcomes.length === 0) {
      unknown.push(
        finding(
          'no_outcomes',
          'The plan states an objective but records no outcome with a measure, so there is no way to tell whether it is being met.',
          'unknown',
          'high',
          [planSource(plan, plan.objective)]
        )
      );
      questions.push({
        key: 'q_outcome_measure',
        question:
          'How would you know, twelve months from now, whether this worked? What would you be measuring?',
        closes: 'The plan has no measurable outcome',
        askWhom: 'the customer contact who owns the outcome',
        kind: 'strategic',
      });
    } else {
      const offTrack = outcomes.filter((outcome) => outcome.state === 'needs_attention');
      known.push(
        finding(
          'outcomes',
          `${outcomes.length} ${outcomes.length === 1 ? 'outcome is' : 'outcomes are'} recorded, each with a measure${offTrack.length > 0 ? `, and ${offTrack.length} ${offTrack.length === 1 ? 'is' : 'are'} marked as needing attention` : ''}.`,
          'stated',
          offTrack.length > 0 ? 'high' : 'moderate',
          [planSource(plan, outcomes.map((outcome) => outcome.label).join('; '))]
        )
      );
    }

    /* An overdue review is an inference, not a fact, because a review may have
       happened and not been recorded. It says so. */
    if (plan.reviewDate !== null && Date.parse(plan.reviewDate) < Date.parse(now)) {
      const daysOver = Math.floor((Date.parse(now) - Date.parse(plan.reviewDate)) / DAY);
      assumed.push(
        finding(
          'review_overdue',
          `The plan has probably not been reviewed on time: its review date passed ${daysOver} ${daysOver === 1 ? 'day' : 'days'} ago.`,
          'inferred',
          'moderate',
          [planSource(plan, `Review date ${plan.reviewDate}`)],
          'the review date on the plan against today. A review that happened without being recorded would look the same.'
        )
      );
    }
  }

  const total = known.length + unknown.length;
  return {
    key: 'goals',
    label: LENS_LABELS.goals,
    question: LENS_QUESTIONS.goals,
    known,
    assumed,
    unknown,
    questions,
    coverage: wholePercent(known.length, total),
  };
}

function researchLens(data: CrmWorkspaceData, organisation: Organisation): Lens {
  const known: Finding[] = [];
  const unknown: Finding[] = [];
  const questions: ValidationQuestion[] = [];

  const plan = data.accountPlans.find(
    (entry) => entry.organisationId === organisation.id && entry.deletedAt === null
  );
  const entries = plan
    ? data.accountPlanEntries.filter(
        (entry) => entry.accountPlanId === plan.id && entry.deletedAt === null
      )
    : [];

  /* The brief asks: how does this customer make money, what are they trying to
     achieve, what threatens them. Those map onto plan sections somebody wrote.
     Where a section is empty the honest answer is that nobody has written it,
     not a paragraph of plausible industry commentary. */
  const wanted: { section: string; label: string; question: string; kind: ValidationQuestion['kind'] }[] = [
    {
      section: 'current_value',
      label: 'what this customer gets from us today',
      question: 'What would stop working for you if we disappeared tomorrow?',
      kind: 'operational',
    },
    {
      section: 'risk',
      label: 'what threatens this account',
      question: 'What is the biggest risk to this programme that we are not talking about?',
      kind: 'risk',
    },
    {
      section: 'constraint',
      label: 'what constrains them',
      question: 'What has to be true internally before a decision like this can be made?',
      kind: 'operational',
    },
    {
      section: 'swot_opportunity',
      label: 'what is changing in their favour',
      question: 'What is changing in your business over the next year that we should know about?',
      kind: 'executive',
    },
  ];

  for (const want of wanted) {
    const found = entries.filter((entry) => entry.section === want.section);
    if (found.length > 0) {
      known.push(
        finding(
          `research_${want.section}`,
          `${found.length} ${found.length === 1 ? 'note' : 'notes'} recorded on ${want.label}.`,
          'stated',
          'moderate',
          found.slice(0, 3).map((entry) => ({
            table: 'crm_account_plan_entries',
            id: entry.id,
            label: want.label,
            quote: entry.body,
            path: '/crm/plans',
          }))
        )
      );
    } else {
      unknown.push(
        finding(
          `research_missing_${want.section}`,
          `Nothing is recorded about ${want.label}.`,
          'unknown',
          'moderate',
          plan ? [planSource(plan, null)] : [orgSource(organisation)]
        )
      );
      questions.push({
        key: `q_research_${want.section}`,
        question: want.question,
        closes: `Nothing recorded about ${want.label}`,
        askWhom: 'your main contact, or their manager',
        kind: want.kind,
      });
    }
  }

  const total = known.length + unknown.length;
  return {
    key: 'research',
    label: LENS_LABELS.research,
    question: LENS_QUESTIONS.research,
    known,
    assumed: [],
    unknown,
    questions,
    coverage: wholePercent(known.length, total),
  };
}

/**
 * The people lens. Seats, not dispositions.
 *
 * Read the module header before changing anything here. The rule is that this
 * lens reports what a PERSON recorded about a role, names the seats nobody is
 * in, and never asserts anything about an individual that nobody wrote down.
 */
function peopleLens(data: CrmWorkspaceData, organisation: Organisation): {
  lens: Lens;
  seats: Seat[];
} {
  const known: Finding[] = [];
  const unknown: Finding[] = [];
  const assumed: Finding[] = [];
  const questions: ValidationQuestion[] = [];

  const roles = data.personOrganisationRoles.filter(
    (role) => role.organisationId === organisation.id && role.endedOn === null
  );

  const seats: Seat[] = (Object.keys(SEAT_LABELS) as StakeholderRole[])
    .filter((role) => role !== 'unknown')
    .map((role) => {
      const held = roles.filter((entry) => entry.stakeholderRole === role);
      return {
        role,
        label: SEAT_LABELS[role],
        filled: held.length,
        confirmed: held.filter((entry) => entry.roleConfirmedAt !== null).length,
        withObjective: held.filter(
          (entry) => entry.currentObjective !== null && entry.currentObjective.trim() !== ''
        ).length,
        requiredForDecision: REQUIRED_SEATS.includes(role),
      };
    });

  for (const seat of seats) {
    if (!seat.requiredForDecision) continue;
    if (seat.filled === 0) {
      unknown.push(
        finding(
          `seat_empty_${seat.role}`,
          `No ${seat.label.toLowerCase()} is recorded on this account.`,
          'unknown',
          'high',
          [orgSource(organisation)]
        )
      );
      questions.push({
        key: `q_seat_${seat.role}`,
        question:
          seat.role === 'economic_buyer'
            ? 'Whose budget does this come out of, and what else is that budget being asked to cover this year?'
            : seat.role === 'decision_maker'
              ? 'Who signs this off, and what do they need to see before they will?'
              : 'Who inside your organisation is making the case for this when we are not in the room?',
        closes: `No ${seat.label.toLowerCase()} recorded`,
        askWhom: 'your main contact',
        kind: seat.role === 'economic_buyer' ? 'executive' : 'strategic',
      });
    } else {
      known.push(
        finding(
          `seat_filled_${seat.role}`,
          `${seat.filled} ${seat.filled === 1 ? 'person is' : 'people are'} recorded as ${seat.label.toLowerCase()}${seat.confirmed < seat.filled ? `, ${seat.filled - seat.confirmed} of them unconfirmed` : ''}.`,
          'stated',
          'moderate',
          [orgSource(organisation)]
        )
      );
    }
  }

  /* An unconfirmed role is an inference somebody made and nobody checked. The
     copilot reports the count, never the name, because naming a person next to
     the word "unconfirmed" is the first step towards a disposition. */
  const unconfirmed = roles.filter(
    (role) => role.roleConfirmedAt === null && role.stakeholderRole !== 'unknown'
  );
  if (unconfirmed.length > 0) {
    assumed.push(
      finding(
        'roles_unconfirmed',
        `${unconfirmed.length} recorded ${unconfirmed.length === 1 ? 'role has' : 'roles have'} never been confirmed with the customer, so the shape of the buying centre is partly guesswork.`,
        'inferred',
        'moderate',
        [orgSource(organisation)],
        'roles recorded without a confirmation date. They may be right; nobody has checked.'
      )
    );
    questions.push({
      key: 'q_confirm_roles',
      question:
        'When this comes to a decision, who else needs to be in the room, and who have we not met yet?',
      closes: 'Roles recorded but never confirmed',
      askWhom: 'your main contact',
      kind: 'strategic',
    });
  }

  const withObjective = roles.filter(
    (role) => role.currentObjective !== null && role.currentObjective.trim() !== ''
  );
  if (roles.length > 0 && withObjective.length === 0) {
    unknown.push(
      finding(
        'no_objectives',
        'Nobody on this account has an objective recorded in their own words, so every claim about what they want is ours rather than theirs.',
        'unknown',
        'high',
        [orgSource(organisation)]
      )
    );
    questions.push({
      key: 'q_their_objective',
      question: 'What are you personally being measured on this year?',
      closes: 'No stakeholder objective recorded in their own words',
      askWhom: 'each contact, separately',
      kind: 'strategic',
    });
  } else if (withObjective.length > 0) {
    known.push(
      finding(
        'objectives_recorded',
        `${withObjective.length} of ${roles.length} contacts have an objective recorded in their own words.`,
        'stated',
        'moderate',
        withObjective.slice(0, 3).map((role) => ({
          table: 'crm_person_organisation_roles',
          id: role.id,
          label: 'A recorded objective',
          quote: role.currentObjective,
          path: `/crm/organisations/${organisation.id}`,
        }))
      )
    );
  }

  if (roles.length === 0) {
    unknown.push(
      finding(
        'no_contacts',
        'No contact on this account has a role recorded, so there is no buying centre to read.',
        'unknown',
        'high',
        [orgSource(organisation)]
      )
    );
  }

  const total = known.length + unknown.length;
  return {
    lens: {
      key: 'people',
      label: LENS_LABELS.people,
      question: LENS_QUESTIONS.people,
      known,
      assumed,
      unknown,
      questions,
      coverage: wholePercent(known.length, total),
    },
    seats,
  };
}

function opportunitiesLens(data: CrmWorkspaceData, organisation: Organisation): Lens {
  const known: Finding[] = [];
  const unknown: Finding[] = [];
  const assumed: Finding[] = [];
  const questions: ValidationQuestion[] = [];

  const open = data.workItems.filter(
    (item) =>
      item.organisationId === organisation.id &&
      item.status === 'open' &&
      item.deletedAt === null
  );

  if (open.length > 0) {
    known.push(
      finding(
        'open_work',
        `${open.length} ${open.length === 1 ? 'piece' : 'pieces'} of work ${open.length === 1 ? 'is' : 'are'} open with this customer.`,
        'stated',
        'moderate',
        open.slice(0, 3).map((item) => ({
          table: 'crm_work_items',
          id: item.id,
          label: item.title,
          quote: item.nextStep,
          path: `/crm/work/${item.id}`,
        }))
      )
    );
  } else {
    unknown.push(
      finding(
        'no_open_work',
        'Nothing is open with this customer.',
        'unknown',
        'moderate',
        [orgSource(organisation)]
      )
    );
    questions.push({
      key: 'q_next_work',
      question: 'What is the next thing you are trying to fix that we have not talked about?',
      closes: 'Nothing open with this customer',
      askWhom: 'your main contact',
      kind: 'expansion',
    });
  }

  /* The whitespace grid defaults every cell to `unknown`, which is a real
     answer and the most useful one here: an unasked question is not a no. */
  const cells = data.whitespaceCells.filter(
    (cell) => cell.organisationId === organisation.id && cell.deletedAt === null
  );
  const neverAsked = cells.filter((cell) => cell.state === 'unknown');
  const potential = cells.filter(
    (cell) => cell.state === 'potential_need' || cell.state === 'open_opportunity'
  );

  if (potential.length > 0) {
    known.push(
      finding(
        'whitespace_potential',
        `${potential.length} ${potential.length === 1 ? 'cell is' : 'cells are'} marked as a potential need or an open opportunity on the whitespace grid.`,
        'stated',
        'moderate',
        potential.slice(0, 3).map((cell) => ({
          table: 'crm_whitespace_cells',
          id: cell.id,
          label: `${cell.axisValue}`,
          quote: cell.note,
          path: `/crm/organisations/${organisation.id}`,
        }))
      )
    );
  }

  if (neverAsked.length > 0) {
    assumed.push(
      finding(
        'whitespace_unknown',
        `${neverAsked.length} ${neverAsked.length === 1 ? 'cell has' : 'cells have'} never been asked about. That is not a no: it is a question nobody has put.`,
        'inferred',
        'moderate',
        [orgSource(organisation)],
        'whitespace cells left in their default state, which means unasked rather than declined.'
      )
    );
    questions.push({
      key: 'q_whitespace',
      question:
        'Which parts of your business handle this differently from the team we work with, and why?',
      closes: 'Whitespace cells nobody has asked about',
      askWhom: 'your main contact, or whoever runs the other site',
      kind: 'expansion',
    });
  }

  const total = known.length + unknown.length;
  return {
    key: 'opportunities',
    label: LENS_LABELS.opportunities,
    question: LENS_QUESTIONS.opportunities,
    known,
    assumed,
    unknown,
    questions,
    coverage: wholePercent(known.length, total),
  };
}

function competitionLens(data: CrmWorkspaceData, organisation: Organisation): Lens {
  const known: Finding[] = [];
  const unknown: Finding[] = [];
  const questions: ValidationQuestion[] = [];

  const plan = data.accountPlans.find(
    (entry) => entry.organisationId === organisation.id && entry.deletedAt === null
  );
  const entries = plan
    ? data.accountPlanEntries.filter(
        (entry) =>
          entry.accountPlanId === plan.id &&
          entry.deletedAt === null &&
          (entry.section === 'competitive_position' || entry.section === 'swot_threat')
      )
    : [];

  if (entries.length > 0) {
    known.push(
      finding(
        'competitive_recorded',
        `${entries.length} ${entries.length === 1 ? 'note is' : 'notes are'} recorded on competitive position or threats.`,
        'stated',
        'moderate',
        entries.slice(0, 3).map((entry) => ({
          table: 'crm_account_plan_entries',
          id: entry.id,
          label: 'Competitive position',
          quote: entry.body,
          path: '/crm/plans',
        }))
      )
    );
  } else {
    unknown.push(
      finding(
        'competitive_missing',
        'Nothing is recorded about who else this customer could use, or is already using.',
        'unknown',
        'high',
        plan ? [planSource(plan, null)] : [orgSource(organisation)]
      )
    );
    questions.push({
      key: 'q_alternatives',
      question: 'If you were not working with us on this, what would you be doing instead?',
      closes: 'Nothing recorded about alternatives',
      askWhom: 'your main contact',
      kind: 'strategic',
    });
  }

  const total = known.length + unknown.length;
  return {
    key: 'competition',
    label: LENS_LABELS.competition,
    question: LENS_QUESTIONS.competition,
    known,
    assumed: [],
    unknown,
    questions,
    coverage: wholePercent(known.length, total),
  };
}

function actionsLens(
  data: CrmWorkspaceData,
  organisation: Organisation,
  now: string
): Lens {
  const known: Finding[] = [];
  const unknown: Finding[] = [];
  const assumed: Finding[] = [];
  const questions: ValidationQuestion[] = [];
  const nowMs = Date.parse(now);

  const ours = data.commitments.filter(
    (commitment) =>
      commitment.organisationId === organisation.id &&
      commitment.deletedAt === null &&
      commitment.state !== 'done' &&
      commitment.ownedByUs
  );
  const theirs = data.commitments.filter(
    (commitment) =>
      commitment.organisationId === organisation.id &&
      commitment.deletedAt === null &&
      commitment.state !== 'done' &&
      !commitment.ownedByUs
  );

  const overdue = ours.filter(
    (commitment) => commitment.dueDate !== null && Date.parse(commitment.dueDate) < nowMs
  );

  if (overdue.length > 0) {
    known.push(
      finding(
        'promises_overdue',
        `${overdue.length} ${overdue.length === 1 ? 'promise we made is' : 'promises we made are'} past the date we gave.`,
        'stated',
        'high',
        overdue.slice(0, 3).map((commitment) => ({
          table: 'crm_commitments',
          id: commitment.id,
          label: commitment.description,
          quote: commitment.description,
          path: '/crm/commitments',
        }))
      )
    );
  }

  if (ours.length > 0 && overdue.length === 0) {
    known.push(
      finding(
        'promises_open',
        `${ours.length} ${ours.length === 1 ? 'promise is' : 'promises are'} outstanding on our side, none of them overdue.`,
        'stated',
        'low',
        [orgSource(organisation)]
      )
    );
  }

  if (theirs.length > 0) {
    known.push(
      finding(
        'promises_theirs',
        `${theirs.length} ${theirs.length === 1 ? 'thing is' : 'things are'} outstanding on the customer's side.`,
        'stated',
        'moderate',
        theirs.slice(0, 3).map((commitment) => ({
          table: 'crm_commitments',
          id: commitment.id,
          label: commitment.description,
          quote: commitment.description,
          path: '/crm/commitments',
        }))
      )
    );
  }

  const joint = data.jointPlans.filter(
    (plan) => plan.organisationId === organisation.id && plan.deletedAt === null
  );
  if (joint.length === 0) {
    unknown.push(
      finding(
        'no_joint_plan',
        'There is no plan written with this customer, only plans written about them.',
        'unknown',
        'moderate',
        [orgSource(organisation)]
      )
    );
    questions.push({
      key: 'q_joint_plan',
      question:
        'Would it be useful to write the next six months down together, so we both know what each side owes the other?',
      closes: 'No joint plan exists',
      askWhom: 'your main contact',
      kind: 'strategic',
    });
  } else {
    const actions = data.jointPlanActions.filter(
      (action) =>
        joint.some((plan) => plan.id === action.jointPlanId) && action.deletedAt === null
    );
    const theirActions = actions.filter((action) => !action.ownedByUs);
    known.push(
      finding(
        'joint_plan',
        `A joint plan exists with ${actions.length} ${actions.length === 1 ? 'action' : 'actions'}, ${theirActions.length} of them the customer's.`,
        'stated',
        'moderate',
        joint.slice(0, 1).map((plan) => ({
          table: 'crm_joint_plans',
          id: plan.id,
          label: 'The joint plan',
          quote: plan.sharedObjective,
          path: '/crm/plans',
        }))
      )
    );
    /* A joint plan where every action is ours is a to-do list with a nicer
       name. The domain model already says so; the copilot says it out loud. */
    if (actions.length > 0 && theirActions.length === 0) {
      assumed.push(
        finding(
          'joint_plan_one_sided',
          'Every action on the joint plan is ours. A plan where the customer owes nothing is a to-do list, and it usually means the plan was written for them rather than with them.',
          'inferred',
          'moderate',
          [orgSource(organisation)],
          'the ownership flag on the joint plan actions. The customer may have agreed verbally to things nobody recorded.'
        )
      );
    }
  }

  const total = known.length + unknown.length;
  return {
    key: 'actions',
    label: LENS_LABELS.actions,
    question: LENS_QUESTIONS.actions,
    known,
    assumed,
    unknown,
    questions,
    coverage: wholePercent(known.length, total),
  };
}

/* ===================================================== the review */

const WEIGHT_ORDER: Record<Finding['weight'], number> = { high: 0, moderate: 1, low: 2 };

function build(
  data: CrmWorkspaceData,
  organisationId: Uuid,
  now: string
): AccountReviewResult | null {
  const index = indexFor(data);
  const organisation = index.organisationsById.get(organisationId);
  if (!organisation || organisation.deletedAt !== null) return null;

  const people = peopleLens(data, organisation);

  const lenses: Lens[] = [
    goalsLens(data, organisation, now),
    researchLens(data, organisation),
    people.lens,
    opportunitiesLens(data, organisation),
    competitionLens(data, organisation),
    actionsLens(data, organisation, now),
  ];

  /* Questions are ordered by the weight of the gap they close, so the first
     question on the list is the one worth the first minute of a meeting. */
  const weightOf = new Map<string, Finding['weight']>();
  for (const lens of lenses) {
    for (const item of [...lens.known, ...lens.assumed, ...lens.unknown]) {
      weightOf.set(item.statement, item.weight);
    }
  }

  const questions = lenses
    .flatMap((lens) => lens.questions)
    .sort((a, b) => {
      const wa = WEIGHT_ORDER[weightOf.get(a.closes) ?? 'moderate'];
      const wb = WEIGHT_ORDER[weightOf.get(b.closes) ?? 'moderate'];
      return wa - wb || a.key.localeCompare(b.key);
    });

  const knownTotal = lenses.reduce((sum, lens) => sum + lens.known.length, 0);
  const unknownTotal = lenses.reduce((sum, lens) => sum + lens.unknown.length, 0);

  return {
    organisationId: organisation.id,
    organisationName: organisation.name,
    lenses,
    seats: people.seats,
    questions,
    coverage: wholePercent(knownTotal, knownTotal + unknownTotal),
    note: KAM_REVIEW_NOTE,
    computedAt: now,
  };
}

/* ===================================================== caching */

/**
 * Cached per dataset, per account, per moment, and dropped on every write.
 *
 * Same contract as the rest of the module: the session store mutates one
 * workspace object in place, so a cache keyed on that object survives a write
 * and is wrong afterwards. The registration below is what makes a gap close on
 * this page when somebody records a role on another one.
 */
const cache = new WeakMap<CrmWorkspaceData, Map<string, AccountReviewResult | null>>();

export function accountReviewFor(
  data: CrmWorkspaceData,
  organisationId: Uuid,
  now: string
): AccountReviewResult | null {
  let byKey = cache.get(data);
  if (!byKey) {
    byKey = new Map();
    cache.set(data, byKey);
  }
  const key = `${organisationId}@${now}`;
  if (byKey.has(key)) return byKey.get(key) ?? null;
  const built = build(data, organisationId, now);
  byKey.set(key, built);
  return built;
}

/** Every account with something worth reading, worst coverage first. */
export function reviewableAccounts(
  data: CrmWorkspaceData,
  now: string
): AccountReviewResult[] {
  return data.organisations
    .filter((organisation) => organisation.deletedAt === null)
    .map((organisation) => accountReviewFor(data, organisation.id, now))
    .filter((review): review is AccountReviewResult => review !== null)
    .sort(
      (a, b) => a.coverage - b.coverage || a.organisationName.localeCompare(b.organisationName, 'en-AU')
    );
}

export function forgetAccountReviews(data: CrmWorkspaceData): void {
  cache.delete(data);
}

onWriteInvalidate(forgetAccountReviews);
