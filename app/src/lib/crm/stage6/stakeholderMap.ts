/**
 * The stakeholder map: who is in the buying centre, and what we actually know.
 *
 * THE TWO FAILURES THIS FILE IS WRITTEN AGAINST.
 *
 * The first is the stakeholder map that becomes a scoreboard. Give software a
 * list of people and a set of attributes and it will reliably produce a ranking:
 * engagement scores, influence ratings, a traffic light beside somebody's name.
 * The brief forbids it, and the reason is not squeamishness. A number beside a
 * person is acted on as though it were measured, it is defended in meetings as
 * though it were evidence, and the person it describes never sees it and cannot
 * correct it. So nothing here ranks, sorts by quality, scores, or infers
 * anything about a person from anything other than what somebody wrote down.
 *
 * The second is the map that looks complete because it is empty. A grid with
 * eight role slots and three people in it reads as "we have three stakeholders"
 * when what it means is "nobody has asked". So every field here distinguishes
 * NOT RECORDED from a recorded answer, and the information gaps are returned as
 * first-class output rather than left as blank cells for somebody to misread.
 *
 * WHAT IS DERIVED AND WHAT IS NOT.
 *
 * Derived, because it is a fact about records: last contact, open commitments,
 * whether a role is recorded, what is missing. Never derived: the role itself,
 * how the relationship stands, what the person is trying to achieve, how they
 * prefer to be contacted. Those are things a person was told and wrote down,
 * and the module's job is to show them with the name of whoever wrote them.
 */
import {
  Commitment,
  CrmWorkspaceData,
  Organisation,
  Person,
  PersonOrganisationRole,
  RelationshipState,
  StakeholderRole,
} from '../domain';
import { ROLE_WORDS, lastMeaningfulContactWith } from '../stage4/relationships';
import { SourceTrail, trailsFor } from '../stage4/sources';

/* --------------------------------------------------------- the words */

export const RELATIONSHIP_STATE_WORDS: Record<RelationshipState, string> = {
  not_recorded: 'Not recorded',
  new: 'New',
  working_well: 'Working well',
  needs_attention: 'Needs attention',
  on_hold: 'On hold',
};

/**
 * What each role means, in one sentence.
 *
 * Shown in the interface beside the role, because "economic buyer" and
 * "decision maker" are the same thing to most people until somebody explains
 * that they are frequently different people, and the plan is wrong in a way
 * nobody notices until the signature does not arrive.
 */
export const ROLE_MEANINGS: Record<StakeholderRole, string> = {
  decision_maker: 'Says yes or no to the thing itself.',
  economic_buyer: 'Whose budget it comes out of. Often not the same person.',
  influencer: 'Shapes the decision without making it.',
  user: 'Will actually use what we deliver.',
  champion: 'Argues for it internally when we are not in the room.',
  gatekeeper: 'Controls access to somebody else.',
  adviser: 'Consulted, with no authority over the outcome.',
  blocker: 'Recorded as standing in the way. Only ever set by a person, with a reason.',
  unknown: 'Nobody has recorded what part they play.',
};

/** The roles a decision usually needs filled before anybody can sign. */
export const ROLES_A_DECISION_NEEDS: StakeholderRole[] = [
  'decision_maker',
  'economic_buyer',
  'user',
];

/* ---------------------------------------------- one person on the map */

export interface MappedStakeholder {
  person: Person;
  role: PersonOrganisationRole | null;

  /** The role, in words, including "Role not recorded". */
  roleWord: string;
  roleMeaning: string;
  stakeholderRole: StakeholderRole;

  /**
   * Who confirmed the role and what they said. Null where nobody has.
   * For a blocker these are never null, because the write path refuses.
   */
  confirmedBy: string | null;
  roleEvidence: string | null;
  /** Evidence rows attached to this person, so a claim leads back to a source. */
  evidence: SourceTrail[];

  /** Responsibility for the relationship. Never a measure of the owner. */
  relationshipOwnerUserId: string | null;

  lastContactAt: string | null;
  daysSinceContact: number | null;

  preferredContactMethod: string | null;
  currentObjective: string | null;

  /** Open commitments either side has made, as recorded. */
  openCommitments: Commitment[];

  /** Described, never computed. */
  relationshipState: RelationshipState;
  relationshipStateWord: string;
  relationshipStateBy: string | null;

  /** Named, so an empty field reads as a question rather than an answer. */
  informationGaps: string[];
}

function daysBetween(fromIso: string | null, now: string): number | null {
  if (!fromIso) return null;
  const ms = new Date(now).getTime() - new Date(fromIso).getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}

function gapsFor(
  person: Person,
  role: PersonOrganisationRole | null,
  lastContactAt: string | null
): string[] {
  const gaps: string[] = [];

  if (!role || role.stakeholderRole === 'unknown') {
    gaps.push('What part they play in a decision');
  }
  if (!role?.preferredContactMethod) gaps.push('How they prefer to be contacted');
  if (!role?.currentObjective) gaps.push('What they are trying to achieve');
  if (!person.primaryEmail && !person.phone) gaps.push('Any way of contacting them');
  if (!person.relationshipOwnerUserId) gaps.push('Who here holds the relationship');
  if (lastContactAt === null) gaps.push('Any recorded conversation with them');
  if (!role || role.relationshipState === 'not_recorded') {
    gaps.push('How the relationship stands, in somebody’s words');
  }

  return gaps;
}

export function mapStakeholder(
  data: CrmWorkspaceData,
  person: Person,
  organisationId: string,
  now: string
): MappedStakeholder {
  const role =
    data.personOrganisationRoles.find(
      (r) => r.personId === person.id && r.organisationId === organisationId && r.endedOn === null
    ) ?? null;

  const lastContactAt = lastMeaningfulContactWith(data, person.id);

  const openCommitments = data.commitments.filter(
    (c) => c.deletedAt === null && c.state === 'open' && c.ownerPersonId === person.id
  );

  const stakeholderRole: StakeholderRole = role?.stakeholderRole ?? 'unknown';

  return {
    person,
    role,
    roleWord: ROLE_WORDS[stakeholderRole],
    roleMeaning: ROLE_MEANINGS[stakeholderRole],
    stakeholderRole,
    confirmedBy: role?.roleConfirmedBy ?? null,
    roleEvidence: role?.roleEvidence ?? null,
    evidence: trailsFor(data, 'crm_people', person.id),
    relationshipOwnerUserId: person.relationshipOwnerUserId,
    lastContactAt,
    daysSinceContact: daysBetween(lastContactAt, now),
    preferredContactMethod: role?.preferredContactMethod ?? null,
    currentObjective: role?.currentObjective ?? null,
    openCommitments,
    relationshipState: role?.relationshipState ?? 'not_recorded',
    relationshipStateWord: RELATIONSHIP_STATE_WORDS[role?.relationshipState ?? 'not_recorded'],
    relationshipStateBy: role?.relationshipStateBy ?? null,
    informationGaps: gapsFor(person, role, lastContactAt),
  };
}

/* ------------------------------------------------------ process risks */

/**
 * Risks about the PROCESS, never about the people in it.
 *
 * Every one of these is a statement about what is recorded: nobody is named as
 * the cause, no behaviour is attributed, and the sentence would be the same if
 * the people were different. "No decision maker identified" is a gap in our
 * knowledge, not a failing of the customer or of whoever owns the account.
 */
export type ProcessRiskKind =
  | 'single_contact'
  | 'no_decision_maker'
  | 'no_senior_contact'
  | 'owner_unclear'
  | 'important_contact_quiet';

export interface ProcessRisk {
  kind: ProcessRiskKind;
  /** The risk, in a sentence that names no person as its cause. */
  what: string;
  /** What would resolve it. Always an action, never a judgement. */
  whatWouldHelp: string;
  /** People the risk concerns, where it concerns anybody in particular. */
  people: Person[];
}

export interface StakeholderMapOptions {
  /**
   * How long without a conversation counts as quiet, in days.
   *
   * User-defined, as the brief requires, with a default rather than a hidden
   * constant: a quarterly account and a weekly one disagree about what quiet
   * means, and the software has no business deciding for them.
   */
  quietAfterDays?: number;
  /** Role labels that mean senior, as this workspace writes them. */
  seniorRoleWords?: string[];
}

const DEFAULT_QUIET_DAYS = 60;
const DEFAULT_SENIOR_WORDS = [
  'director',
  'head',
  'chief',
  'partner',
  'principal',
  'owner',
  'general manager',
  'managing',
  'executive',
];

function looksSenior(label: string | null, words: string[]): boolean {
  if (!label) return false;
  const lower = label.toLowerCase();
  return words.some((word) => lower.includes(word));
}

/* --------------------------------------------------------- the map */

export interface StakeholderMap {
  organisation: Organisation;
  stakeholders: MappedStakeholder[];
  /** Grouped by role, in a fixed order, so a missing role is visibly missing. */
  byRole: { role: StakeholderRole; word: string; meaning: string; people: MappedStakeholder[] }[];
  /** Which of the roles a decision needs nobody is recorded in. */
  rolesNobodyHolds: StakeholderRole[];
  risks: ProcessRisk[];
  /** The quiet threshold actually used, so the page can say what it means. */
  quietAfterDays: number;
  /** Everything nobody has recorded, counted once. */
  gapCount: number;
}

export function buildStakeholderMap(
  data: CrmWorkspaceData,
  organisationId: string,
  now: string,
  options: StakeholderMapOptions = {}
): StakeholderMap | null {
  const organisation = data.organisations.find(
    (o) => o.id === organisationId && o.deletedAt === null
  );
  if (!organisation) return null;

  const quietAfterDays = options.quietAfterDays ?? DEFAULT_QUIET_DAYS;
  const seniorWords = options.seniorRoleWords ?? DEFAULT_SENIOR_WORDS;

  const people = data.people.filter(
    (p) =>
      p.deletedAt === null && p.mergedIntoPersonId === null && p.organisationId === organisation.id
  );

  // Sorted by name. NOT by role importance, not by recency, not by anything
  // that could be read as a ranking of the people in the list.
  const stakeholders = people
    .map((person) => mapStakeholder(data, person, organisation.id, now))
    .sort((a, b) => a.person.fullName.localeCompare(b.person.fullName));

  const ROLE_ORDER: StakeholderRole[] = [
    'decision_maker',
    'economic_buyer',
    'champion',
    'influencer',
    'user',
    'adviser',
    'gatekeeper',
    'blocker',
    'unknown',
  ];

  const byRole = ROLE_ORDER.map((role) => ({
    role,
    word: ROLE_WORDS[role],
    meaning: ROLE_MEANINGS[role],
    people: stakeholders.filter((s) => s.stakeholderRole === role),
  })).filter((group) => group.role === 'unknown' ? group.people.length > 0 : true);

  const held = new Set(stakeholders.map((s) => s.stakeholderRole));
  const rolesNobodyHolds = ROLES_A_DECISION_NEEDS.filter((role) => !held.has(role));

  /* ---- the five process risks the brief names ---- */

  const risks: ProcessRisk[] = [];

  if (stakeholders.length === 1) {
    risks.push({
      kind: 'single_contact',
      what: `Everything here runs through one person: ${stakeholders[0].person.fullName}.`,
      whatWouldHelp:
        'Ask them who else is involved. If they leave, change role or go on leave, the account goes with them.',
      people: [stakeholders[0].person],
    });
  }

  if (!held.has('decision_maker')) {
    risks.push({
      kind: 'no_decision_maker',
      what: 'Nobody here is recorded as the person who says yes.',
      whatWouldHelp:
        'Ask who signs this off. It is a normal question and the answer is usually given straight away.',
      people: [],
    });
  }

  const senior = stakeholders.filter(
    (s) => looksSenior(s.person.roleLabel, seniorWords) || looksSenior(s.role?.roleLabel ?? null, seniorWords)
  );
  const seniorSeenRecently = senior.filter(
    (s) => s.daysSinceContact !== null && s.daysSinceContact <= quietAfterDays
  );
  if (senior.length > 0 && seniorSeenRecently.length === 0) {
    risks.push({
      kind: 'no_senior_contact',
      what: `No conversation is recorded with anybody senior here in the last ${quietAfterDays} days.`,
      whatWouldHelp: 'Arrange one, or record one that happened and was never written down.',
      people: senior.map((s) => s.person),
    });
  }

  const unowned = stakeholders.filter((s) => s.relationshipOwnerUserId === null);
  if (unowned.length > 0) {
    risks.push({
      kind: 'owner_unclear',
      what: `${unowned.length} ${unowned.length === 1 ? 'person has' : 'people have'} nobody here recorded as holding the relationship.`,
      whatWouldHelp:
        'Record who holds it. Ownership here is responsibility for keeping in touch, not a measure of anybody.',
      people: unowned.map((s) => s.person),
    });
  }

  // An important contact who has gone quiet. "Important" means a role a
  // decision needs, which is a fact about the process, not an opinion about
  // the person.
  const quietImportant = stakeholders.filter(
    (s) =>
      ROLES_A_DECISION_NEEDS.includes(s.stakeholderRole) &&
      (s.daysSinceContact === null || s.daysSinceContact > quietAfterDays)
  );
  if (quietImportant.length > 0) {
    risks.push({
      kind: 'important_contact_quiet',
      what: `${quietImportant.length} ${quietImportant.length === 1 ? 'person' : 'people'} in a role this decision needs ${quietImportant.length === 1 ? 'has' : 'have'} no conversation recorded in the last ${quietAfterDays} days.`,
      whatWouldHelp:
        'Check whether a conversation happened and was not recorded before assuming it did not.',
      people: quietImportant.map((s) => s.person),
    });
  }

  return {
    organisation,
    stakeholders,
    byRole,
    rolesNobodyHolds,
    risks,
    quietAfterDays,
    gapCount: stakeholders.reduce((sum, s) => sum + s.informationGaps.length, 0),
  };
}
