/**
 * The Drafting Agent, the Account Planning Agent, and the Privacy and Consent
 * Agent.
 *
 * DRAFTING: do not send automatically. In this release that is not a setting,
 * it is an absence: there is no send function anywhere in Concludo, no
 * transport, no queue, no scheduled job. A draft is a proposal carrying a body
 * and a recipient list, and the recipient list is read from the CRM record
 * rather than from anything the customer wrote. The one thing a drafting agent
 * must never do is take "reply to accounts@elsewhere.example" out of an email
 * body and address a draft to it.
 *
 * ACCOUNT PLANNING: drafts the parts of a plan nobody has written. Everything
 * it writes is marked as a draft from a person's own records, and each line
 * carries the record it came from, because a plan section that reads as insight
 * and turns out to be a restatement of the last meeting note is worse than a
 * blank one: somebody will quote it.
 *
 * PRIVACY AND CONSENT: finds what the record and the Australian Privacy
 * Principles require before anybody is contacted. This is the one agent whose
 * findings can stop another agent's proposal, and it is wired that way
 * deliberately: the drafting agent asks it before addressing anything.
 */
import { ConsentRecord, CrmWorkspaceData, Person } from '../../domain';
import { allowedRecipients, isKnownRecipient } from '../untrusted';
import {
  AgentRun,
  BuildContext,
  emptyRun,
  organisationSource,
  personSource,
  propose,
  sources,
  workItemSource,
} from './build';

/* ============================================ privacy and consent */

export interface ContactRestriction {
  personId: string;
  personName: string;
  /** Why they may not be contacted this way, in words. */
  because: string;
  /** Which kind of contact this blocks. */
  blocks: 'all' | 'marketing' | 'none';
}

/**
 * May this person be sent this kind of message, on what is recorded.
 *
 * Returns the restriction rather than a boolean, because "no" with no reason is
 * the kind of answer that gets overridden. Where nothing is recorded at all the
 * answer is also a restriction: an absent consent record is not permission.
 */
export function restrictionFor(
  data: CrmWorkspaceData,
  person: Person,
  purpose: 'contact' | 'marketing'
): ContactRestriction | null {
  const consents = data.consentRecords.filter(
    (record) => record.personId === person.id && record.consentType === purpose
  );

  const preference = data.communicationPreferences.find(
    (pref) => pref.personId === person.id
  );

  if (preference && preference.preference === 'do_not_contact') {
    return {
      personId: person.id,
      personName: person.fullName,
      because: `A do-not-contact preference is recorded against ${person.fullName}: ${preference.note}`,
      blocks: 'all',
    };
  }

  if (consents.length === 0) {
    return {
      personId: person.id,
      personName: person.fullName,
      because: `No ${purpose} consent is recorded for ${person.fullName}. An absent record is not permission.`,
      blocks: purpose === 'marketing' ? 'marketing' : 'all',
    };
  }

  const withdrawn = consents.find((record) => record.withdrawnAt !== null);
  if (withdrawn) {
    return {
      personId: person.id,
      personName: person.fullName,
      because: `${person.fullName} withdrew ${purpose} consent on ${withdrawn.withdrawnAt?.slice(0, 10)}.`,
      blocks: purpose === 'marketing' ? 'marketing' : 'all',
    };
  }

  const notObtained = consents.find((record) => record.basis === 'not_obtained');
  if (notObtained) {
    return {
      personId: person.id,
      personName: person.fullName,
      because: `${purpose} consent for ${person.fullName} is recorded as not obtained.`,
      blocks: purpose === 'marketing' ? 'marketing' : 'all',
    };
  }

  if (preference && preference.preference === 'limited') {
    return {
      personId: person.id,
      personName: person.fullName,
      because: `${person.fullName} has a limited communication preference recorded: ${preference.note}`,
      blocks: 'marketing',
    };
  }

  return null;
}

export function privacyConsentAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  /* ---- people with no consent record at all ---- */
  const people = data.people.filter(
    (person) => person.deletedAt === null && person.mergedIntoPersonId === null
  );

  const withoutConsent = people.filter(
    (person) => !data.consentRecords.some((record) => record.personId === person.id)
  );

  if (withoutConsent.length > 0) {
    propose(
      context,
      {
        agent: 'privacy_consent',
        kind: 'flag_for_attention',
        observed: `${withoutConsent.length} ${withoutConsent.length === 1 ? 'person has' : 'people have'} no consent record of any kind: ${withoutConsent.slice(0, 5).map((p) => p.fullName).join(', ')}${withoutConsent.length > 5 ? ', and others' : ''}.`,
        sources: sources(...withoutConsent.slice(0, 6).map((person) => personSource(data, person.id))),
        proposes:
          'Somebody records how each person’s details were obtained and what they were told at the time. Under APP 5 that notice is required at or near collection, and recording it afterwards is the next best thing.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: ['How each person’s details were obtained'],
        consequences: [
          'Nothing changes. Until a basis is recorded, Concludo treats these people as not contactable and no draft will be addressed to them.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'Recording a consent basis creates a record.',
          individualOnly: false,
        },
      },
      run
    );
  }

  /* ---- communication restrictions, stated ---- */
  for (const person of people) {
    const restriction = restrictionFor(data, person, 'marketing');
    if (!restriction || restriction.blocks === 'none') continue;
    // The no-record case is reported once, above, rather than per person.
    if (restriction.because.startsWith('No marketing consent')) continue;

    propose(
      context,
      {
        agent: 'privacy_consent',
        kind: 'flag_for_attention',
        observed: restriction.because,
        sources: sources(personSource(data, person.id)),
        proposes: `Nothing is sent to ${person.fullName} that this restriction covers. This is here so a person knows before they ask for a draft.`,
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: [],
        consequences: [
          'Nothing changes. The restriction is already enforced: the drafting agent will not address a message to somebody this covers.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'Nothing is written, but a person should see this before contacting them.',
          individualOnly: false,
        },
      },
      run
    );
  }

  /* ---- retention deadlines ---- */
  const dueForPurge = [
    ...data.people.filter((person) => person.purgeAfter !== null && person.purgeAfter < now),
    ...data.organisations.filter(
      (organisation) => organisation.purgeAfter !== null && organisation.purgeAfter < now
    ),
  ];

  if (dueForPurge.length > 0) {
    propose(
      context,
      {
        agent: 'privacy_consent',
        kind: 'flag_for_attention',
        observed: `${dueForPurge.length} ${dueForPurge.length === 1 ? 'record is' : 'records are'} past the date recorded for permanent deletion.`,
        sources: sources(
          ...dueForPurge
            .slice(0, 5)
            .map((record) =>
              'fullName' in record
                ? personSource(data, record.id)
                : organisationSource(data, record.id)
            )
        ),
        proposes:
          'Somebody with the authority to destroy records does so, or records why the date moved. Concludo does not delete anything on a timer.',
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: [],
        consequences: [
          'Permanent deletion cannot be undone, which is why it needs an administrator and not a schedule.',
        ],
        approval: {
          role: 'crm_admin',
          because: 'Destroying a record permanently is an administrator’s act.',
          individualOnly: true,
        },
        isDestructive: true,
      },
      run
    );
  }

  return run;
}

/* ========================================================= drafting */

export type DraftKind =
  | 'follow_up_email'
  | 'meeting_confirmation'
  | 'proposal_cover_email'
  | 'quote_follow_up'
  | 'customer_check_in'
  | 'service_acknowledgement'
  | 'renewal_message'
  | 'referral_request'
  | 'joint_plan_update';

export const DRAFT_KINDS: DraftKind[] = [
  'follow_up_email',
  'meeting_confirmation',
  'proposal_cover_email',
  'quote_follow_up',
  'customer_check_in',
  'service_acknowledgement',
  'renewal_message',
  'referral_request',
  'joint_plan_update',
];

export const DRAFT_LABELS: Record<DraftKind, string> = {
  follow_up_email: 'Follow-up email',
  meeting_confirmation: 'Meeting confirmation',
  proposal_cover_email: 'Proposal cover email',
  quote_follow_up: 'Quote follow-up',
  customer_check_in: 'Customer check-in',
  service_acknowledgement: 'Service acknowledgement',
  renewal_message: 'Renewal message',
  referral_request: 'Referral request',
  joint_plan_update: 'Joint plan update',
};

/** Said on every draft, every time. Not configurable. */
export const DRAFT_NOTE =
  'This is a draft. Concludo has no way to send anything in this release: there is no transport, no queue and no scheduled job. Copy it, change it, and send it yourself from your own mail.';

/**
 * The body of a draft, assembled from records.
 *
 * Deliberately plain and deliberately short. A drafting agent that writes four
 * warm paragraphs produces something people send unread, and the first time it
 * is wrong it is wrong in the customer's inbox. What this writes is the
 * skeleton: what the conversation was, what was agreed, what happens next, with
 * every fact traceable to a record. The person adds the warmth, which is also
 * the part that should be theirs.
 */
function bodyFor(
  kind: DraftKind,
  person: Person,
  lines: string[]
): string {
  const greeting = `Hello ${person.givenName ?? person.fullName.split(' ')[0]},`;
  const closing = 'Thanks,';
  return [greeting, '', ...lines, '', closing].join('\n');
}

export function draftingAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data } = context;

  /* ---- a follow-up after a meeting with commitments ---- */
  const recentMeetings = data.activities
    .filter(
      (activity) =>
        activity.deletedAt === null &&
        activity.activityType === 'meeting' &&
        activity.organisationId !== null
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
    .slice(0, 4);

  for (const meeting of recentMeetings) {
    const participantIds = data.activityParticipants
      .filter((participant) => participant.activityId === meeting.id && participant.personId)
      .map((participant) => participant.personId as string);

    const participants = data.people.filter(
      (person) => participantIds.includes(person.id) && person.deletedAt === null
    );
    if (participants.length === 0) continue;

    /* THE RECIPIENT RULE.
     *
     * Addresses come from the person records of the people who were in the
     * meeting. Nothing reads the meeting summary, the email body or any
     * attachment to find an address, so a customer cannot redirect a draft by
     * writing an address in a note. */
    const allowed = allowedRecipients(participants);

    // And anybody the privacy agent restricts is removed, with the reason kept.
    const restrictions = participants
      .map((person) => restrictionFor(data, person, 'contact'))
      .filter((restriction): restriction is ContactRestriction => restriction !== null)
      .filter((restriction) => restriction.blocks === 'all');

    const blockedIds = new Set(restrictions.map((restriction) => restriction.personId));
    const addressable = participants.filter((person) => !blockedIds.has(person.id));
    const recipients = allowedRecipients(addressable);

    const commitments = data.commitments.filter(
      (commitment) => commitment.activityId === meeting.id && commitment.deletedAt === null
    );

    const lines: string[] = [];
    lines.push(`Thank you for your time on ${meeting.occurredAt.slice(0, 10)}.`);
    if (commitments.filter((c) => c.ownedByUs).length > 0) {
      lines.push('');
      lines.push('What we said we would do:');
      for (const commitment of commitments.filter((c) => c.ownedByUs)) {
        lines.push(
          `- ${commitment.description}${commitment.dueDate ? `, by ${commitment.dueDate}` : ''}`
        );
      }
    }
    if (commitments.filter((c) => !c.ownedByUs).length > 0) {
      lines.push('');
      lines.push('What you said you would do:');
      for (const commitment of commitments.filter((c) => !c.ownedByUs)) {
        lines.push(
          `- ${commitment.description}${commitment.dueDate ? `, by ${commitment.dueDate}` : ''}`
        );
      }
    }

    const organisation = data.organisations.find((o) => o.id === meeting.organisationId);

    propose(
      context,
      {
        agent: 'drafting',
        kind: 'draft_message',
        observed: `"${meeting.title}" on ${meeting.occurredAt.slice(0, 10)} has ${commitments.length} ${commitments.length === 1 ? 'commitment' : 'commitments'} recorded against it and no follow-up recorded since.`,
        sources: sources(
          { table: 'crm_activities', id: meeting.id, label: meeting.title, quote: meeting.summary, path: '/crm/activities' },
          meeting.organisationId ? organisationSource(data, meeting.organisationId) : null,
          ...addressable.map((person) => personSource(data, person.id))
        ),
        // The note about sending belongs on the external action, where the
        // body and the recipients are. Repeating it in `proposes` made the
        // queue row four lines long and said the same thing twice.
        proposes:
          recipients.length === 0
            ? 'A follow-up email, addressed to nobody: everybody in the meeting is either restricted or has no address recorded.'
            : `A follow-up email to ${recipients.join(', ')}, for somebody to read, change and send themselves.`,
        changes: [],
        externalAction: {
          kind: recipients.length > 0 ? 'send_email' : 'none',
          recipients,
          subject: `Following up on ${meeting.title}`,
          body: addressable[0] ? bodyFor('follow_up_email', addressable[0], lines) : null,
          attachments: [],
          authorisedToSend: false,
          note: DRAFT_NOTE,
        },
        confidence: commitments.length > 0 ? 'high' : 'moderate',
        assumptions: [],
        conflicts: restrictions.map((restriction) => restriction.because),
        missingInformation: [
          ...(commitments.length === 0
            ? ['What was actually agreed. Nothing is recorded against this meeting.']
            : []),
          ...participants
            .filter((person) => !person.primaryEmail)
            .map((person) => `An address for ${person.fullName}`),
        ],
        consequences: [
          'Nothing is sent. Approving this records that the draft was approved; it does not deliver anything, and this release has no way to.',
          ...(restrictions.length > 0
            ? [
                `${restrictions.length} ${restrictions.length === 1 ? 'person has' : 'people have'} been left out of the addresses because of what is recorded about contacting them.`,
              ]
            : []),
        ],
        approval: {
          role: 'crm_approver',
          because:
            'A message addressed to a customer is approved by somebody who can take responsibility for what it says.',
          individualOnly: true,
        },
        scanned: [meeting.summary, organisation?.name],
      },
      run
    );
  }

  return run;
}

/**
 * Could this draft be addressed to this address, on the record alone.
 *
 * Exported for the tests. The property: an address that appears in message
 * content but not on a person record is never addressable.
 */
export function addressIsAllowed(
  data: CrmWorkspaceData,
  address: string,
  organisationId: string
): boolean {
  const people = data.people.filter(
    (person) => person.organisationId === organisationId && person.deletedAt === null
  );
  return isKnownRecipient(address, allowedRecipients(people));
}

/* ================================================ account planning */

export function accountPlanningAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data } = context;

  if (!data.workspace.accountPlanningEnabled) return run;

  for (const plan of data.accountPlans.filter((p) => p.deletedAt === null)) {
    const organisation = data.organisations.find(
      (o) => o.id === plan.organisationId && o.deletedAt === null
    );
    if (!organisation) continue;

    const entries = data.accountPlanEntries.filter(
      (entry) => entry.accountPlanId === plan.id && entry.deletedAt === null
    );
    const sections = new Set(entries.map((entry) => entry.section));

    const outcomes = data.accountPlanOutcomes.filter(
      (outcome) => outcome.accountPlanId === plan.id
    );

    const openWork = data.workItems.filter(
      (item) =>
        item.organisationId === organisation.id &&
        item.status === 'open' &&
        item.deletedAt === null
    );

    const unknownCells = data.whitespaceCells.filter(
      (cell) =>
        cell.organisationId === organisation.id &&
        cell.deletedAt === null &&
        cell.state === 'unknown'
    );

    const roles = data.personOrganisationRoles.filter(
      (role) => role.organisationId === organisation.id && role.endedOn === null
    );
    const held = new Set(roles.map((role) => role.stakeholderRole));
    const gaps = (['decision_maker', 'economic_buyer', 'user'] as const).filter(
      (role) => !held.has(role)
    );

    const missingSections: string[] = [];
    if (!plan.summary) missingSections.push('a summary');
    if (outcomes.length === 0) missingSections.push('any objective');
    if (!sections.has('risk')) missingSections.push('any risk');
    if (!sections.has('swot_strength')) missingSections.push('a SWOT');
    if (!sections.has('growth_opportunity')) missingSections.push('any growth opportunity');

    if (missingSections.length === 0 && gaps.length === 0 && unknownCells.length === 0) continue;

    const drafted: string[] = [];
    if (!plan.summary) {
      drafted.push(
        `Summary, drafted from the records: ${openWork.length} ${openWork.length === 1 ? 'piece' : 'pieces'} of work open, ${roles.length} ${roles.length === 1 ? 'person' : 'people'} recorded, renewal ${organisation.renewalDate ?? 'not recorded'}.`
      );
    }
    if (gaps.length > 0) {
      drafted.push(
        `Stakeholder gaps: nobody is recorded as ${gaps.join(', ').replace(/_/g, ' ')}.`
      );
    }
    if (unknownCells.length > 0) {
      drafted.push(
        `Whitespace: ${unknownCells.length} ${unknownCells.length === 1 ? 'cell has' : 'cells have'} never been answered, which is ${unknownCells.length === 1 ? 'a question' : 'questions'} rather than ${unknownCells.length === 1 ? 'an opportunity' : 'opportunities'}.`
      );
    }

    propose(
      context,
      {
        agent: 'account_planning',
        kind: 'review_request',
        observed: `The plan for ${organisation.name} is missing ${missingSections.length > 0 ? missingSections.join(', ') : 'nothing'}${gaps.length > 0 ? `, and nobody is recorded in ${gaps.length} ${gaps.length === 1 ? 'role' : 'roles'} a decision needs` : ''}.`,
        sources: sources(
          organisationSource(data, organisation.id),
          { table: 'crm_account_plans', id: plan.id, label: `Account plan for ${organisation.name}`, quote: plan.objective, path: `/crm/account-plans/${organisation.id}` },
          ...openWork.slice(0, 3).map((item) => workItemSource(data, item.id))
        ),
        proposes:
          drafted.length > 0
            ? `A first draft of the missing parts, from the records: ${drafted.join(' ')} Somebody rewrites these in their own words, because a plan section that is a restatement of the record is one nobody learns anything from.`
            : 'Somebody fills in the missing parts of this plan.',
        changes: [],
        confidence: 'moderate',
        assumptions: [
          'That what is recorded is what matters about this account. It is a starting point for a person, not an analysis.',
        ],
        conflicts: [],
        missingInformation: missingSections.map((section) => `The plan has ${section}`),
        consequences: [
          'Nothing changes. A plan entry is written by a person and carries their name, so nothing here can be applied without somebody taking authorship of it.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'A plan entry records who wrote it, so it needs a person to write it.',
          individualOnly: false,
        },
      },
      run
    );
  }

  return run;
}

/** Consent records, exported for the tests that check an absent one is not permission. */
export function consentFor(
  data: CrmWorkspaceData,
  personId: string,
  purpose: ConsentRecord['consentType']
): ConsentRecord[] {
  return data.consentRecords.filter(
    (record) => record.personId === personId && record.consentType === purpose
  );
}
