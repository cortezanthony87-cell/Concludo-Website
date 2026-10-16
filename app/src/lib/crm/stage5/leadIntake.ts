/**
 * The lead inbox: what happens when something arrives.
 *
 * THE FAILURE THIS FILE IS WRITTEN AGAINST.
 *
 * A lead inbox that creates a record on arrival is a database that fills with
 * duplicates at the speed of the web form. The person who enquired on Tuesday
 * and again on Thursday is now two people, the organisation they work for is
 * now three organisations, and nobody notices until a client receives two
 * emails with different names on them.
 *
 * So nothing is created on arrival. An arriving lead gets:
 *
 *   a search for people and organisations that might already be them,
 *   the duplicates shown with what matches AND what differs,
 *   the source, stated,
 *   the consent basis, stated, because what you may do next depends on it,
 *   a proposed route and a proposed next action,
 *
 * and then it waits. The brief's "require human confirmation before creating or
 * merging records" is enforced in `writes.ts`, where `convertLead` refuses
 * without a confirmer, and this file is what gives that person enough to decide
 * with.
 */
import {
  CrmWorkspaceData,
  Lead,
  Organisation,
  Person,
} from '../domain';
import {
  normaliseEmail,
  normaliseName,
  normaliseOrganisationName,
  withinEditDistance,
} from '../duplicates';
import { ROLE_WORDS } from './../stage4/relationships';

/* ---------------------------------------------------------- the sources */

export type LeadSource =
  | 'web_form'
  | 'email'
  | 'phone'
  | 'referral'
  | 'event'
  | 'existing_customer'
  | 'imported_list'
  | 'manual_entry';

export const LEAD_SOURCES: LeadSource[] = [
  'web_form',
  'email',
  'phone',
  'referral',
  'event',
  'existing_customer',
  'imported_list',
  'manual_entry',
];

export const LEAD_SOURCE_LABELS: Record<LeadSource, string> = {
  web_form: 'Web form',
  email: 'Email',
  phone: 'Phone',
  referral: 'Referral',
  event: 'Event',
  existing_customer: 'Existing customer',
  imported_list: 'Imported list',
  manual_entry: 'Entered by hand',
};

/**
 * What each source implies about consent, and what it does not.
 *
 * This is the part of a lead inbox that is usually a shrug and should not be.
 * Under the Australian Privacy Principles, APP 3 governs collection and APP 5
 * requires notification at or near the time of collection. A person who filled
 * in your form knows you have their details. A person on a list you bought does
 * not, and the difference decides what you are allowed to do on Monday morning.
 *
 * None of these is a legal opinion and the interface says so. They are the
 * starting position a person confirms or corrects, which is the honest shape
 * for something that depends on facts the software cannot see.
 */
export interface SourceConsent {
  /** The basis this source usually gives, before anybody checks. */
  basis: 'express' | 'implied' | 'legitimate_interest' | 'not_obtained';
  /** What it means for what happens next, in one sentence. */
  meaning: string;
  /** What has to be true for that basis to hold. */
  requires: string;
  /** True where the basis is thin enough that somebody must check before contact. */
  checkBeforeContact: boolean;
}

export const SOURCE_CONSENT: Record<LeadSource, SourceConsent> = {
  web_form: {
    basis: 'express',
    meaning: 'They came to you and asked to be contacted.',
    requires: 'The form said what their details would be used for.',
    checkBeforeContact: false,
  },
  email: {
    basis: 'implied',
    meaning: 'They wrote to you, so a reply is expected.',
    requires: 'A reply about what they wrote. Not a newsletter.',
    checkBeforeContact: false,
  },
  phone: {
    basis: 'implied',
    meaning: 'They rang you, so a call back is expected.',
    requires: 'Somebody recorded what was agreed on the call.',
    checkBeforeContact: false,
  },
  referral: {
    basis: 'implied',
    meaning: 'Somebody passed their details on. They may not know that.',
    requires: 'The referrer says the person agreed to the introduction.',
    checkBeforeContact: true,
  },
  event: {
    basis: 'express',
    meaning: 'They handed over their details in person.',
    requires: 'The sign-up said what the details were for.',
    checkBeforeContact: false,
  },
  existing_customer: {
    basis: 'express',
    meaning: 'An existing relationship with consent already recorded against it.',
    requires: 'The existing consent record covers this kind of contact.',
    checkBeforeContact: false,
  },
  imported_list: {
    basis: 'not_obtained',
    meaning: 'Nobody here has heard from this person. They did not ask to be contacted.',
    requires: 'A basis you can point at. A purchased list is not one.',
    checkBeforeContact: true,
  },
  manual_entry: {
    basis: 'legitimate_interest',
    meaning: 'Somebody typed this in. Where it came from is only what they wrote.',
    requires: 'The person who entered it records how the details were obtained.',
    checkBeforeContact: true,
  },
};

export function leadSourceOf(lead: Lead): LeadSource {
  const raw = (lead.source ?? 'manual_entry').toLowerCase().replace(/[\s-]+/g, '_');
  return (LEAD_SOURCES as string[]).includes(raw) ? (raw as LeadSource) : 'manual_entry';
}

/* -------------------------------------------------- possible matches */

export interface PossibleMatch {
  kind: 'person' | 'organisation';
  id: string;
  name: string;
  context: string | null;
  /** What matched. */
  matching: string[];
  /** What did not. This is what lets a person judge rather than trust. */
  differing: string[];
  /** How sure, in words. Never a percentage. */
  strength: 'the same address' | 'the same name' | 'a close name' | 'the same organisation';
  /** Plain words a person can act on. */
  reason: string;
}

/**
 * People and organisations that might already be this lead.
 *
 * Deliberately generous: it is cheaper to show somebody four candidates and
 * have them dismiss three than to create a duplicate they find out about from a
 * client. Each candidate carries what DIFFERS as well as what matches, because
 * a list that only ever says "these look the same" trains a person to press
 * yes, and the one time it is wrong they press yes to that too.
 */
export function findPossibleMatches(data: CrmWorkspaceData, lead: Lead): PossibleMatch[] {
  const matches: PossibleMatch[] = [];

  const livePeople = data.people.filter(
    (p) => p.deletedAt === null && p.mergedIntoPersonId === null
  );
  const liveOrganisations = data.organisations.filter((o) => o.deletedAt === null);

  const leadEmail = lead.email ? normaliseEmail(lead.email) : null;
  const leadName = lead.personName ? normaliseName(lead.personName) : null;
  const leadOrg = lead.organisationName ? normaliseOrganisationName(lead.organisationName) : null;
  const leadDomain = leadEmail?.includes('@') ? leadEmail.split('@')[1] : null;

  const organisationName = (id: string | null): string | null =>
    liveOrganisations.find((o) => o.id === id)?.name ?? null;

  for (const person of livePeople) {
    const personEmail = person.primaryEmail ? normaliseEmail(person.primaryEmail) : null;
    const personName = normaliseName(person.fullName);

    // The strongest signal there is, and the only one that stands alone.
    if (leadEmail && personEmail === leadEmail) {
      matches.push({
        kind: 'person',
        id: person.id,
        name: person.fullName,
        context: organisationName(person.organisationId),
        matching: ['Email address'],
        differing: personName === leadName ? [] : ['Name'],
        strength: 'the same address',
        reason:
          'The same email address is already on a person here. One address, one person, almost always.',
      });
      continue;
    }

    if (leadName && personName === leadName) {
      const sameOrg =
        leadOrg !== null &&
        normaliseOrganisationName(organisationName(person.organisationId) ?? '') === leadOrg;
      matches.push({
        kind: 'person',
        id: person.id,
        name: person.fullName,
        context: organisationName(person.organisationId),
        matching: sameOrg ? ['Name', 'Organisation'] : ['Name'],
        differing: sameOrg ? ['Email address'] : ['Organisation', 'Email address'],
        strength: 'the same name',
        reason: sameOrg
          ? 'The same name at the same organisation. Very likely the same person.'
          : 'The same name at a different organisation. People move, and people share names.',
      });
      continue;
    }

    if (leadName && withinEditDistance(personName, leadName, 2)) {
      matches.push({
        kind: 'person',
        id: person.id,
        name: person.fullName,
        context: organisationName(person.organisationId),
        matching: ['Name to within two characters'],
        differing: ['Spelling', 'Email address'],
        strength: 'a close name',
        reason: 'A name a character or two away, which is the usual shape of a typed duplicate.',
      });
    }
  }

  for (const organisation of liveOrganisations) {
    const name = normaliseOrganisationName(organisation.name);
    const domain = organisation.website
      ? organisation.website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0]
      : null;

    if (leadOrg && name === leadOrg) {
      matches.push({
        kind: 'organisation',
        id: organisation.id,
        name: organisation.name,
        context: organisation.industry,
        matching: ['Name, once company suffixes are set aside'],
        differing: organisation.parentOrganisationId
          ? ['This one is a subsidiary of another organisation here']
          : [],
        strength: 'the same name',
        reason: organisation.parentOrganisationId
          ? 'The same name, and this record is a subsidiary. Check which part of the group they mean.'
          : 'The same name, once "Pty Ltd" and the like are set aside.',
      });
      continue;
    }

    if (leadDomain && domain && domain === leadDomain) {
      matches.push({
        kind: 'organisation',
        id: organisation.id,
        name: organisation.name,
        context: organisation.industry,
        matching: ['Email domain'],
        differing: ['Name'],
        strength: 'the same organisation',
        reason: 'The address is at this organisation’s domain, under a different name.',
      });
    }
  }

  return matches;
}

/* -------------------------------------------------------- the routing */

export interface RoutingProposal {
  /** Where this should go, in the words of the workspace. */
  destination: 'existing_account' | 'new_account' | 'needs_a_decision';
  /** The organisation it would attach to, where one was found. */
  organisationId: string | null;
  organisationName: string | null;
  /** The person it would attach to, where one was found. */
  personId: string | null;
  personName: string | null;
  /** Who would hold it. Responsibility for work, never a measure of anybody. */
  suggestedOwnerUserId: string | null;
  /** Why, from something recorded. */
  reason: string;
  /** True where a person has to settle something before anything can be created. */
  blocked: boolean;
}

/**
 * Where this lead should go, proposed.
 *
 * The owner suggestion is the one to be careful with. It is drawn from who
 * already holds the relationship with the matched organisation, which is a
 * recorded fact about responsibility. It is NOT drawn from who is doing well,
 * who has capacity or whose turn it is, because each of those is a judgement
 * about a person dressed up as routing, and a CRM that makes them starts
 * measuring people the following quarter.
 */
export function proposeRouting(
  data: CrmWorkspaceData,
  lead: Lead,
  matches: PossibleMatch[]
): RoutingProposal {
  const organisationMatch = matches.find((m) => m.kind === 'organisation');
  const personMatch = matches.find((m) => m.kind === 'person');

  const strongPeople = matches.filter(
    (m) => m.kind === 'person' && m.strength === 'the same address'
  );
  const ambiguous = matches.filter((m) => m.kind === 'person').length > 1 && strongPeople.length === 0;

  if (ambiguous) {
    return {
      destination: 'needs_a_decision',
      organisationId: organisationMatch?.id ?? null,
      organisationName: organisationMatch?.name ?? null,
      personId: null,
      personName: null,
      suggestedOwnerUserId: null,
      reason:
        'More than one person here could be this lead, and none of them matches on an address. Somebody has to say which, or that none of them is.',
      blocked: true,
    };
  }

  if (organisationMatch) {
    const organisation = data.organisations.find((o) => o.id === organisationMatch.id);
    const owner =
      organisation?.relationshipOwnerUserId ?? organisation?.ownerUserId ?? null;

    return {
      destination: 'existing_account',
      organisationId: organisationMatch.id,
      organisationName: organisationMatch.name,
      personId: personMatch?.id ?? null,
      personName: personMatch?.name ?? null,
      suggestedOwnerUserId: owner,
      reason: owner
        ? `${organisationMatch.name} is already an account here, and the relationship is recorded against somebody. Routing it to them keeps one conversation in one place.`
        : `${organisationMatch.name} is already an account here, and nobody is recorded as holding the relationship.`,
      blocked: false,
    };
  }

  return {
    destination: 'new_account',
    organisationId: null,
    organisationName: lead.organisationName,
    personId: personMatch?.id ?? null,
    personName: personMatch?.name ?? null,
    suggestedOwnerUserId: lead.ownerUserId,
    reason: lead.organisationName
      ? 'Nothing here matches this organisation, so it would be a new account.'
      : 'No organisation was given, so this would be a person with no organisation recorded until somebody asks.',
    blocked: false,
  };
}

/* ------------------------------------------------------ the next action */

export interface NextActionProposal {
  /** What to do, in a sentence somebody can act on. */
  what: string;
  /** Why it is the next thing, from something recorded. */
  why: string;
  /** What has to be true before anybody contacts them. */
  beforeYouContact: string | null;
}

export function proposeNextAction(
  lead: Lead,
  matches: PossibleMatch[],
  routing: RoutingProposal
): NextActionProposal {
  const source = leadSourceOf(lead);
  const consent = SOURCE_CONSENT[source];

  const beforeYouContact = consent.checkBeforeContact
    ? `${consent.meaning} ${consent.requires}`
    : null;

  if (routing.blocked) {
    return {
      what: 'Decide which of the possible matches this is, or that it is none of them.',
      why: 'Nothing can be created until that is settled, because creating the wrong one is the duplicate this inbox exists to prevent.',
      beforeYouContact,
    };
  }

  // A source that gives no basis is not a lead you reply to. The action is to
  // find a basis, or to stop. Proposing a friendly reply here would be the
  // software telling somebody to do the one thing the consent note on the same
  // card says they may not do.
  if (consent.basis === 'not_obtained') {
    return {
      what: 'Find a basis for contacting this person, or record that there is none.',
      why: 'Nobody here has heard from them. A purchased list is not a reason to ring somebody, and the record should say which it is before anybody does.',
      beforeYouContact,
    };
  }

  if (lead.missingInformation.length > 0) {
    return {
      what: 'Reply, and ask for what is missing.',
      why: `The lead arrived without ${lead.missingInformation.length === 1 ? 'it' : 'those'}, and it is cheaper to ask now than to guess.`,
      beforeYouContact,
    };
  }

  if (routing.destination === 'existing_account') {
    return {
      what: `Add this to ${routing.organisationName} rather than creating a second account.`,
      why: 'They are already here, and two accounts for one company is how two people end up calling them in the same week.',
      beforeYouContact,
    };
  }

  return {
    what: `Reply to ${lead.personName ?? 'them'} and arrange a conversation.`,
    why: `It arrived by ${LEAD_SOURCE_LABELS[source].toLowerCase()} with enough to go on.`,
    beforeYouContact,
  };
}

/* -------------------------------------------------------- the whole thing */

export interface LeadReview {
  lead: Lead;
  source: LeadSource;
  sourceLabel: string;
  consent: SourceConsent;
  matches: PossibleMatch[];
  routing: RoutingProposal;
  nextAction: NextActionProposal;
  /** The person and organisation records the routing would use, resolved. */
  matchedPerson: Person | null;
  matchedOrganisation: Organisation | null;
  /** Days since it arrived. A lead inbox nobody opens is the usual failure. */
  waitingDays: number;
}

export function reviewLead(data: CrmWorkspaceData, lead: Lead, now: string): LeadReview {
  const matches = findPossibleMatches(data, lead);
  const routing = proposeRouting(data, lead, matches);
  const source = leadSourceOf(lead);

  return {
    lead,
    source,
    sourceLabel: LEAD_SOURCE_LABELS[source],
    consent: SOURCE_CONSENT[source],
    matches,
    routing,
    nextAction: proposeNextAction(lead, matches, routing),
    matchedPerson: data.people.find((p) => p.id === routing.personId) ?? null,
    matchedOrganisation:
      data.organisations.find((o) => o.id === routing.organisationId) ?? null,
    waitingDays: Math.floor(
      (new Date(now).getTime() - new Date(lead.receivedAt).getTime()) / 86_400_000
    ),
  };
}

export function reviewInbox(data: CrmWorkspaceData, now: string): LeadReview[] {
  return data.leads
    .filter((l) => l.deletedAt === null)
    .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
    .map((lead) => reviewLead(data, lead, now));
}

export { ROLE_WORDS };
