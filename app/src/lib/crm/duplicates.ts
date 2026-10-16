/**
 * Finding possible duplicates, and knowing when two records are not one.
 *
 * THE FAILURE MODE THIS FILE IS WRITTEN AGAINST.
 *
 * A duplicate detector that only ever says "these two are the same" trains a
 * person to click yes, and a person who clicks yes without reading will
 * eventually merge a parent company into its subsidiary, or two genuinely
 * different people who share a surname at the same firm. Merge is the one CRM
 * operation that cannot be undone by editing a field afterwards.
 *
 * So this returns candidates of both kinds. A pair that looks similar and is
 * demonstrably not one record comes back with `likely_separate` and the reason,
 * and that recommendation is as much a result as a match is. Every candidate
 * also carries what DIFFERS, not only what matches, because that is what lets
 * a person judge rather than trust.
 *
 * Nothing here merges anything. It proposes.
 */
import { DuplicateCandidate, Organisation, Person, Uuid } from './domain';

/* -------------------------------------------------------- normalising */

/** Lower case, collapse whitespace, drop punctuation that carries no meaning. */
export function normaliseName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.,'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Company suffixes carry no identity. "Acme Pty Ltd" and "Acme" are one firm. */
const COMPANY_SUFFIXES = [
  'pty ltd',
  'pty limited',
  'proprietary limited',
  'limited',
  'ltd',
  'inc',
  'incorporated',
  'llc',
  'group',
  'holdings',
  'co',
];

export function normaliseOrganisationName(value: string): string {
  let out = normaliseName(value);
  for (const suffix of COMPANY_SUFFIXES) {
    if (out.endsWith(' ' + suffix)) {
      out = out.slice(0, -(suffix.length + 1)).trim();
    }
  }
  return out;
}

export function normaliseEmail(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Edit distance, capped.
 *
 * Capped because the only question is "are these within two edits", and a full
 * matrix over two long strings to answer that is work nobody needs. Two is the
 * threshold a typed surname tends to be out by.
 */
export function withinEditDistance(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (a === b) return true;

  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, i) => i);

  for (let i = 1; i < rows; i += 1) {
    const current = [i];
    let best = i;
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
      current.push(value);
      if (value < best) best = value;
    }
    if (best > max) return false;
    previous = current;
  }

  return previous[cols - 1] <= max;
}

/* -------------------------------------------------- person candidates */

export interface CandidateDraft {
  subjectTable: 'crm_people' | 'crm_organisations';
  leftId: Uuid;
  rightId: Uuid;
  matchingFields: string[];
  differingFields: string[];
  recommendation: 'review_together' | 'likely_separate';
  reason: string;
}

export function findPersonDuplicates(people: Person[]): CandidateDraft[] {
  const live = people.filter((p) => p.deletedAt === null && p.mergedIntoPersonId === null);
  const drafts: CandidateDraft[] = [];

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const left = live[i];
      const right = live[j];
      const draft = comparePeople(left, right);
      if (draft) drafts.push(draft);
    }
  }

  return drafts;
}

function comparePeople(left: Person, right: Person): CandidateDraft | null {
  const matching: string[] = [];
  const differing: string[] = [];

  const sameOrg = left.organisationId !== null && left.organisationId === right.organisationId;
  const leftName = normaliseName(left.fullName);
  const rightName = normaliseName(right.fullName);
  const nameExact = leftName === rightName;
  const nameClose = !nameExact && withinEditDistance(leftName, rightName, 2);

  const leftEmail = left.primaryEmail ? normaliseEmail(left.primaryEmail) : null;
  const rightEmail = right.primaryEmail ? normaliseEmail(right.primaryEmail) : null;
  const emailExact = leftEmail !== null && leftEmail === rightEmail;

  // The strongest signal, and the only one strong enough to stand alone.
  if (emailExact) {
    matching.push('Email address');
    if (sameOrg) matching.push('Organisation');
    if (nameExact) matching.push('Name');
    else differing.push('Name');
    if (left.roleLabel !== right.roleLabel) differing.push('Role');

    return {
      subjectTable: 'crm_people',
      leftId: left.id,
      rightId: right.id,
      matchingFields: matching,
      differingFields: differing,
      recommendation: 'review_together',
      reason: 'The same email address appears on both records, which is the strongest signal there is.',
    };
  }

  if (!sameOrg) {
    // Two people with the same name at different organisations are usually two
    // people. Saying so is a result: it stops the same pair being re-proposed
    // every time the detector runs.
    if (nameExact && left.organisationId !== null && right.organisationId !== null) {
      return {
        subjectTable: 'crm_people',
        leftId: left.id,
        rightId: right.id,
        matchingFields: ['Name'],
        differingFields: ['Organisation', 'Email address'],
        recommendation: 'likely_separate',
        reason:
          'The same name at two different organisations. People move and people share names; merging these would lose one of them.',
      };
    }
    return null;
  }

  if (nameExact) {
    matching.push('Name', 'Organisation');
    if (left.roleLabel === right.roleLabel && left.roleLabel !== null) matching.push('Role');
    else differing.push('Role');
    if (leftEmail && rightEmail) differing.push('Email address');
    else differing.push('One record has no email address');

    return {
      subjectTable: 'crm_people',
      leftId: left.id,
      rightId: right.id,
      matchingFields: matching,
      differingFields: differing,
      recommendation: 'review_together',
      reason: 'The same name at the same organisation, with different contact details.',
    };
  }

  if (nameClose) {
    matching.push('Organisation', 'Name to within two characters');
    if (left.roleLabel === right.roleLabel && left.roleLabel !== null) matching.push('Role');
    differing.push('Spelling of the name');
    if (leftEmail !== rightEmail) differing.push('Email address');

    return {
      subjectTable: 'crm_people',
      leftId: left.id,
      rightId: right.id,
      matchingFields: matching,
      differingFields: differing,
      recommendation: 'review_together',
      reason:
        'Two names at the same organisation differing by a character or two, which is the usual shape of a typed duplicate.',
    };
  }

  return null;
}

/* -------------------------------------------- organisation candidates */

export function findOrganisationDuplicates(organisations: Organisation[]): CandidateDraft[] {
  const live = organisations.filter((o) => o.deletedAt === null);
  const drafts: CandidateDraft[] = [];

  for (let i = 0; i < live.length; i += 1) {
    for (let j = i + 1; j < live.length; j += 1) {
      const draft = compareOrganisations(live[i], live[j]);
      if (draft) drafts.push(draft);
    }
  }

  return drafts;
}

function compareOrganisations(left: Organisation, right: Organisation): CandidateDraft | null {
  // The case this exists to get right. A parent and its child share a name
  // prefix, an industry and often a domain, and every name-matching rule in
  // existence calls them a duplicate. They are not: the relationship is already
  // recorded, and merging them would destroy it.
  const related =
    left.parentOrganisationId === right.id || right.parentOrganisationId === left.id;

  if (related) {
    return {
      subjectTable: 'crm_organisations',
      leftId: left.id,
      rightId: right.id,
      matchingFields: ['Part of the same name', 'Industry'],
      differingFields: [
        'One is already recorded as the parent of the other',
        'Different people',
        'Different owners',
      ],
      recommendation: 'likely_separate',
      reason:
        'These are a parent and its subsidiary, and that relationship is already recorded. Merging them would lose it.',
    };
  }

  const leftName = normaliseOrganisationName(left.name);
  const rightName = normaliseOrganisationName(right.name);

  if (leftName.length < 3 || rightName.length < 3) return null;

  const abnMatch = left.abn !== null && left.abn === right.abn;
  if (abnMatch) {
    return {
      subjectTable: 'crm_organisations',
      leftId: left.id,
      rightId: right.id,
      matchingFields: ['ABN'],
      differingFields: left.name === right.name ? ['Nothing else differs'] : ['Name'],
      recommendation: 'review_together',
      reason: 'The same ABN on two records. One company has one ABN.',
    };
  }

  if (leftName === rightName) {
    const differing: string[] = [];
    if (left.industry !== right.industry) differing.push('Industry');
    if (left.ownerUserId !== right.ownerUserId) differing.push('Owner');
    if (left.abn !== right.abn) differing.push('ABN');
    if (differing.length === 0) differing.push('Nothing substantial differs');

    return {
      subjectTable: 'crm_organisations',
      leftId: left.id,
      rightId: right.id,
      matchingFields: ['Name, once company suffixes are set aside'],
      differingFields: differing,
      recommendation: 'review_together',
      reason:
        'The same name once "Pty Ltd" and the like are set aside, and no parent relationship is recorded between them.',
    };
  }

  return null;
}

/* ------------------------------------------------------- the pipeline */

/**
 * Every candidate, with the pairs already decided filtered out.
 *
 * A pair somebody has already said to keep separate must never be proposed
 * again. Without this the data quality view is a list of the same decisions
 * being asked for weekly, which is how a person learns to ignore it.
 */
export function proposeCandidates(args: {
  people: Person[];
  organisations: Organisation[];
  existing: DuplicateCandidate[];
}): CandidateDraft[] {
  const decided = new Set(
    args.existing
      .filter((c) => c.state !== 'open')
      .flatMap((c) => [`${c.leftId}|${c.rightId}`, `${c.rightId}|${c.leftId}`])
  );

  const drafts = [...findPersonDuplicates(args.people), ...findOrganisationDuplicates(args.organisations)];

  return drafts.filter((d) => !decided.has(`${d.leftId}|${d.rightId}`));
}

/**
 * What a merge would do, for a person to read before approving one.
 *
 * Returns the fields that would be kept, the ones that would be carried over
 * from the record being merged in, and the ones that would be lost. The last
 * list is the one that matters and is the one a naive merge screen omits.
 */
export function describeMerge(
  keep: Person,
  mergeIn: Person
): { kept: string[]; carriedOver: string[]; lost: string[] } {
  const kept: string[] = [];
  const carriedOver: string[] = [];
  const lost: string[] = [];

  const compare = (label: string, a: unknown, b: unknown) => {
    if (b === null || b === undefined || b === '') return;
    if (a === null || a === undefined || a === '') {
      carriedOver.push(label);
    } else if (a === b) {
      kept.push(label);
    } else {
      kept.push(label);
      lost.push(`${label} on the merged record: ${String(b)}`);
    }
  };

  compare('Name', keep.fullName, mergeIn.fullName);
  compare('Email address', keep.primaryEmail, mergeIn.primaryEmail);
  compare('Phone', keep.phone, mergeIn.phone);
  compare('Role', keep.roleLabel, mergeIn.roleLabel);
  compare('Organisation', keep.organisationId, mergeIn.organisationId);

  return { kept, carriedOver, lost };
}
