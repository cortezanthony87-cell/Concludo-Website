/**
 * The Relationship Agent, the Service Context Agent and the Renewal Agent.
 *
 * All three prepare something a person reads before talking to a customer, and
 * all three are governed by the same discipline: everything in a briefing comes
 * from a record, and anything that is not recorded is named as missing rather
 * than filled in. A briefing that reads smoothly because it invented the gaps
 * is worse than no briefing, because the person walks into the room believing
 * it.
 *
 * SERVICE CONTEXT has one constraint of its own that the others do not: it
 * tells a sales or account person THAT something is wrong and what it means for
 * the relationship, without the detail of the case. The detail is often the
 * customer's own account of a problem, sometimes with names, health, money or
 * legal exposure in it, and the account manager preparing for a renewal call
 * does not need it to do their job. So the summary carries the effect, the age
 * and the state, and never the body.
 *
 * RENEWAL must not invent value or savings claims. This is the one place in the
 * product where a model would most want to write "saving approximately twelve
 * hours a month", and that number would be made up, and somebody would say it
 * out loud to a customer who would then ask how it was calculated. So the
 * renewal review carries only what is recorded, each item with its source, and
 * where nothing is recorded it says that nothing is recorded.
 */
import { CrmWorkspaceData, ServiceCase } from '../../domain';
import { lastMeaningfulContactWith } from '../../stage4/relationships';
import {
  AgentRun,
  BuildContext,
  caseSource,
  emptyRun,
  organisationSource,
  personSource,
  propose,
  sources,
  workItemSource,
} from './build';

/* ===================================================== relationship */

export function relationshipAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  const accounts = data.organisations.filter((organisation) => organisation.deletedAt === null);

  for (const organisation of accounts) {
    const openWork = data.workItems.filter(
      (item) =>
        item.organisationId === organisation.id &&
        item.status === 'open' &&
        item.deletedAt === null
    );
    if (openWork.length === 0) continue;

    const people = data.people.filter(
      (person) => person.organisationId === organisation.id && person.deletedAt === null
    );

    const activities = data.activities
      .filter(
        (activity) =>
          activity.organisationId === organisation.id && activity.deletedAt === null
      )
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    const last = activities[0] ?? null;
    const since = last?.occurredAt ?? null;

    const changedSince = since
      ? [
          ...data.workItems
            .filter(
              (item) => item.organisationId === organisation.id && item.updatedAt > since
            )
            .map((item) => `"${item.title}" was changed`),
          ...data.serviceCases
            .filter((kase) => kase.organisationId === organisation.id && kase.raisedAt > since)
            .map((kase) => `A service issue was raised: ${kase.title}`),
        ]
      : [];

    const ourPromises = data.commitments.filter(
      (commitment) =>
        commitment.organisationId === organisation.id &&
        commitment.deletedAt === null &&
        commitment.state === 'open' &&
        commitment.ownedByUs
    );
    const theirPromises = data.commitments.filter(
      (commitment) =>
        commitment.organisationId === organisation.id &&
        commitment.deletedAt === null &&
        commitment.state === 'open' &&
        !commitment.ownedByUs
    );

    const openCases = data.serviceCases.filter(
      (kase) =>
        kase.organisationId === organisation.id &&
        kase.deletedAt === null &&
        kase.state !== 'resolved' &&
        kase.state !== 'closed'
    );

    /* ---- the agenda, built only from what is recorded ---- */
    const agenda: string[] = [];
    if (ourPromises.length > 0) {
      agenda.push(
        `What we promised and have not done: ${ourPromises.map((c) => c.description).join('; ')}.`
      );
    }
    if (openCases.length > 0) {
      agenda.push(
        `${openCases.length} open service ${openCases.length === 1 ? 'issue' : 'issues'}, which the service context briefing summarises.`
      );
    }
    for (const item of openWork) {
      agenda.push(
        item.nextStep
          ? `"${item.title}": the recorded next step is ${item.nextStep}.`
          : `"${item.title}": no next step is recorded, so agreeing one is worth the time.`
      );
    }
    if (theirPromises.length > 0) {
      agenda.push(`What they promised: ${theirPromises.map((c) => c.description).join('; ')}.`);
    }

    const missing: string[] = [];
    if (!last) missing.push('Any recorded conversation with this account');
    if (people.length === 0) missing.push('Anybody recorded at this account');
    const noRole = people.filter(
      (person) =>
        !data.personOrganisationRoles.some(
          (role) =>
            role.personId === person.id &&
            role.organisationId === organisation.id &&
            role.endedOn === null &&
            role.stakeholderRole !== 'unknown'
        )
    );
    if (noRole.length > 0) {
      missing.push(
        `What part ${noRole.map((p) => p.fullName).join(', ')} ${noRole.length === 1 ? 'plays' : 'play'} in a decision`
      );
    }

    propose(
      context,
      {
        agent: 'relationship',
        kind: 'briefing',
        observed: last
          ? `The last recorded conversation with ${organisation.name} was "${last.title}" on ${last.occurredAt.slice(0, 10)}. ${changedSince.length} ${changedSince.length === 1 ? 'thing has' : 'things have'} changed since.`
          : `No conversation is recorded with ${organisation.name} at all, and there ${openWork.length === 1 ? 'is' : 'are'} ${openWork.length} open ${openWork.length === 1 ? 'piece' : 'pieces'} of work.`,
        sources: sources(
          organisationSource(data, organisation.id),
          last ? { table: 'crm_activities', id: last.id, label: last.title, quote: last.summary, path: '/crm/activities' } : null,
          ...openWork.map((item) => workItemSource(data, item.id)),
          ...people.slice(0, 4).map((person) => personSource(data, person.id))
        ),
        proposes:
          agenda.length > 0
            ? `A briefing before the next conversation, with ${agenda.length} ${agenda.length === 1 ? 'thing' : 'things'} worth covering. Everything in it is from a record; nothing is suggested wording.`
            : 'A briefing. Nothing recorded suggests an agenda item, which is itself worth knowing before the call.',
        changes: [],
        confidence: last ? 'high' : 'moderate',
        assumptions: [],
        conflicts: [],
        missingInformation: missing,
        consequences: ['Nothing changes. A briefing is something to read.'],
        approval: {
          role: 'crm_contributor',
          because: 'Nothing is written, but the briefing is produced for a person to use.',
          individualOnly: false,
        },
        scanned: [last?.summary, ...activities.slice(0, 5).map((a) => a.summary)],
      },
      run
    );

    /* ---- a contact briefing for the person with a role that matters ---- */
    for (const person of people.slice(0, 3)) {
      const lastContact = lastMeaningfulContactWith(data, person.id);
      const theirCommitments = data.commitments.filter(
        (commitment) =>
          commitment.ownerPersonId === person.id &&
          commitment.state === 'open' &&
          commitment.deletedAt === null
      );
      if (!lastContact && theirCommitments.length === 0) continue;

      propose(
        context,
        {
          agent: 'relationship',
          kind: 'briefing',
          observed: lastContact
            ? `${person.fullName} was last in a recorded conversation on ${lastContact.slice(0, 10)}.`
            : `${person.fullName} has ${theirCommitments.length} open ${theirCommitments.length === 1 ? 'promise' : 'promises'} and no recorded conversation.`,
          sources: sources(
            personSource(data, person.id),
            organisationSource(data, organisation.id)
          ),
          proposes: 'A short briefing on this person before speaking to them.',
          changes: [],
          confidence: 'moderate',
          assumptions: [],
          conflicts: [],
          missingInformation: [
            ...(person.primaryEmail ? [] : ['Any way of contacting them by email']),
            ...(lastContact ? [] : ['Any recorded conversation with them']),
          ],
          consequences: ['Nothing changes.'],
          approval: {
            role: 'crm_contributor',
            because: 'Nothing is written.',
            individualOnly: false,
          },
        },
        run
      );
    }
  }

  return run;
}

/* ================================================== service context */

/**
 * What a sales or account person needs to know, and nothing more.
 *
 * The three things carried: that an issue is open, how long it has been open,
 * and what it does to the relationship. The three things withheld: the detail,
 * the customer's own words, and anything attached. If the account manager needs
 * the detail they can open the case, where the normal permissions apply; what
 * this agent will not do is put it in a briefing that gets pasted into an email.
 */
export const RESTRICTED_CASE_FIELDS = ['detail'] as const;

export interface ServiceSummaryLine {
  caseId: string;
  title: string;
  /** Carried: what it means for the relationship. */
  effect: string | null;
  state: ServiceCase['state'];
  severity: ServiceCase['severity'];
  daysOpen: number;
  /** Said on screen: the detail is deliberately not here. */
  withheldNote: string;
}

export function serviceContextAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  const byOrganisation = new Map<string, ServiceCase[]>();
  for (const kase of data.serviceCases) {
    if (kase.deletedAt !== null) continue;
    if (kase.state === 'resolved' || kase.state === 'closed') continue;
    const list = byOrganisation.get(kase.organisationId) ?? [];
    list.push(kase);
    byOrganisation.set(kase.organisationId, list);
  }

  for (const [organisationId, cases] of byOrganisation) {
    const lines: ServiceSummaryLine[] = cases.map((kase) => ({
      caseId: kase.id,
      title: kase.title,
      effect: kase.relationshipEffect,
      state: kase.state,
      severity: kase.severity,
      daysOpen: Math.max(
        0,
        Math.floor((new Date(now).getTime() - new Date(kase.raisedAt).getTime()) / 86_400_000)
      ),
      withheldNote:
        'The detail of this case is not included here. Open the case if you need it.',
    }));

    const oldest = lines.reduce((max, line) => Math.max(max, line.daysOpen), 0);

    propose(
      context,
      {
        agent: 'service_context',
        kind: 'briefing',
        observed: `${cases.length} service ${cases.length === 1 ? 'issue is' : 'issues are'} open at this account, the oldest for ${oldest} days.`,
        sources: sources(
          organisationSource(data, organisationId),
          ...cases.map((kase) => caseSource(data, kase.id))
        ),
        proposes:
          `A summary for whoever next speaks to this customer: ${lines
            .map((line) => `${line.title} (${line.state.replace(/_/g, ' ')}, ${line.daysOpen} days)`)
            .join('; ')}. What each one does to the relationship is included. The detail of each case is not.`,
        changes: [],
        confidence: 'high',
        assumptions: [],
        conflicts: [],
        missingInformation: lines
          .filter((line) => !line.effect)
          .map((line) => `What "${line.title}" does to the relationship. Nobody recorded it.`),
        consequences: [
          'Nothing changes. This is a summary for a person preparing for a conversation.',
          'The detail of each case stays in the case. Somebody who needs it opens it there, where the usual permissions apply.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'Nothing is written.',
          individualOnly: false,
        },
        // The case DETAIL is deliberately not scanned or carried: it is not in
        // this proposal at all, so there is nothing here to leak.
        scanned: cases.map((kase) => kase.relationshipEffect),
      },
      run
    );
  }

  return run;
}

/* ========================================================= renewal */

export function renewalAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  const approaching = data.organisations.filter((organisation) => {
    if (organisation.deletedAt !== null || !organisation.renewalDate) return false;
    const days =
      (new Date(`${organisation.renewalDate}T00:00:00.000Z`).getTime() -
        new Date(now).getTime()) /
      86_400_000;
    return days <= 120;
  });

  for (const organisation of approaching) {
    const days = Math.floor(
      (new Date(`${organisation.renewalDate}T00:00:00.000Z`).getTime() -
        new Date(now).getTime()) /
        86_400_000
    );

    const plan = data.accountPlans.find(
      (p) => p.organisationId === organisation.id && p.deletedAt === null
    );
    const objectives = plan
      ? data.accountPlanOutcomes.filter((outcome) => outcome.accountPlanId === plan.id)
      : [];

    const completedWork = data.workItems.filter(
      (item) => item.organisationId === organisation.id && item.status === 'won'
    );

    const openCommitments = data.commitments.filter(
      (commitment) =>
        commitment.organisationId === organisation.id &&
        commitment.state === 'open' &&
        commitment.deletedAt === null
    );

    const cases = data.serviceCases.filter(
      (kase) => kase.organisationId === organisation.id && kase.deletedAt === null
    );
    const openCases = cases.filter(
      (kase) => kase.state !== 'resolved' && kase.state !== 'closed'
    );

    const acceptedQuotes = data.quotes.filter((quote) => {
      const item = data.workItems.find((w) => w.id === quote.workItemId);
      return item?.organisationId === organisation.id && quote.state === 'accepted';
    });
    const productIds = new Set(
      acceptedQuotes.flatMap((quote) =>
        data.quoteLines.filter((line) => line.quoteId === quote.id).map((line) => line.productId)
      )
    );
    const products = data.products.filter((product) => productIds.has(product.id));

    /* ---- what is NOT recorded, named rather than filled in ---- */
    const missing: string[] = [];
    if (products.length === 0) {
      missing.push(
        'What they are actually paying for. No accepted quote is recorded against this account.'
      );
    }
    if (objectives.length === 0) {
      missing.push('What the customer was trying to achieve. No objective is recorded.');
    }
    if (completedWork.length === 0) {
      missing.push('What was delivered. No work is recorded as won against this account.');
    }

    propose(
      context,
      {
        agent: 'renewal',
        kind: 'briefing',
        observed: `${organisation.name} renews in ${days} days. ${products.length} ${products.length === 1 ? 'product or service is' : 'products or services are'} recorded as accepted, ${completedWork.length} ${completedWork.length === 1 ? 'piece' : 'pieces'} of work completed, ${openCommitments.length} open ${openCommitments.length === 1 ? 'promise' : 'promises'}, ${openCases.length} open service ${openCases.length === 1 ? 'issue' : 'issues'}.`,
        sources: sources(
          organisationSource(data, organisation.id),
          ...completedWork.slice(0, 4).map((item) => workItemSource(data, item.id)),
          ...openCases.slice(0, 3).map((kase) => caseSource(data, kase.id))
        ),
        proposes:
          'A renewal review built only from what is recorded. Concludo has not calculated a saving, a return or a benefit, because none of those is recorded anywhere and a number invented here would be said out loud to the customer.',
        changes: [],
        confidence: missing.length === 0 ? 'high' : 'low',
        assumptions: [],
        conflicts:
          openCases.length > 0
            ? [
                `There ${openCases.length === 1 ? 'is' : 'are'} ${openCases.length} unresolved service ${openCases.length === 1 ? 'issue' : 'issues'} going into this renewal.`,
              ]
            : [],
        missingInformation: missing,
        consequences: [
          'Nothing changes. This is a briefing.',
          'Where this says nothing is recorded, that is the finding. Filling the gap with an estimate would make the review read better and be worth less.',
        ],
        approval: {
          role: 'crm_contributor',
          because: 'Nothing is written.',
          individualOnly: false,
        },
      },
      run
    );
  }

  return run;
}

/** Words that would be a value claim, which this stage refuses to generate. */
export const FORBIDDEN_VALUE_CLAIMS = [
  'roi',
  'return on investment',
  'saved approximately',
  'estimated saving',
  'estimated savings',
  'hours saved',
  'cost saving',
  'payback period',
  'uplift of',
];

/** Used by the tests: does any text here make up a number about value. */
export function containsValueClaim(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_VALUE_CLAIMS.some((claim) => lower.includes(claim));
}

export function briefingInputs(data: CrmWorkspaceData): number {
  return data.organisations.length + data.serviceCases.length;
}
