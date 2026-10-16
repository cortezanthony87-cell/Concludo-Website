/**
 * Six role views, and the line none of them crosses.
 *
 * "Do not include employee rankings or individual productivity scores."
 *
 * That instruction is the most important sentence in this file and it is also
 * the hardest to hold, because every one of these six views is one small step
 * away from breaking it. A manager view showing pipeline coverage is a
 * reasonable thing. The same view grouped by owner, sorted descending, is a
 * leaderboard, and nobody had to decide to build one: it happens by adding a
 * `groupBy` to a function that already existed.
 *
 * So the rule here is structural rather than editorial. The report functions
 * return work, not people. Where ownership appears it is a FILTER (show me
 * mine) and never a GROUPING (show me everyone's, ordered). There is no
 * function in this file that takes a list of users and returns a number per
 * user, and the test asserts that no report output contains a per-person
 * aggregate.
 *
 * The honest version of what a manager actually needs is here instead: where
 * work is stuck, which stages lose things, what is not recorded, and where the
 * process has a bottleneck. All of those are properties of the process. A
 * manager who wants to know how somebody is doing should talk to them, and a
 * CRM that answers that question with a number is a CRM that makes that
 * conversation worse.
 */
import { CrmWorkspaceData, WorkItem } from '../domain';
import { buildBoard, pipelinesIn } from '../stage5/pipeline';
import { buildForecast } from '../stage5/forecast';
import { workspaceCoverage } from '../stage4/hierarchy';
import { lastMeaningfulContactWith } from '../stage4/relationships';
// countByKind and workspaceFlags are reached through qualitySource, which caps
// the sweep by size rather than running it on the way to a page.
import { qualityCounts, qualityFigure } from './qualitySource';
import { accountPlansIn } from '../stage6/accountPlan';
import { buildServiceInbox } from './service';
import { indexFor } from './paging';
import { CrmRole } from '../domain';

/* ============================================= the shape of a report */

export interface ReportLine {
  /** What it is, in words. */
  label: string;
  /**
   * The number, where there is one. Null where the figure genuinely is not
   * available, which is a different thing from zero: a zero says nothing is
   * wrong and a blank says nobody has looked. A line that cannot be computed
   * says so in `meaning` and carries null here.
   */
  count: number | null;
  /** What it means and what to do, in a sentence. Never a target. */
  meaning: string;
  /** Where to go. */
  path: string | null;
  /** Rows a person can act on, where listing them is more use than counting. */
  items?: { id: string; title: string; context: string; path: string | null }[];
}

export interface RoleReport {
  role: ReportRole;
  title: string;
  /** Who it is for, and what it deliberately does not do. */
  description: string;
  lines: ReportLine[];
  /** Said on every report. */
  notRankedNote: string;
}

export type ReportRole =
  | 'owner_operator'
  | 'sales'
  | 'manager'
  | 'account_manager'
  | 'service_lead'
  | 'executive';

export const REPORT_ROLES: ReportRole[] = [
  'owner_operator',
  'sales',
  'manager',
  'account_manager',
  'service_lead',
  'executive',
];

export const REPORT_TITLES: Record<ReportRole, string> = {
  owner_operator: 'Owner-operator',
  sales: 'Sales',
  manager: 'Manager',
  account_manager: 'Account manager',
  service_lead: 'Service lead',
  executive: 'Executive',
};

export const NOT_RANKED_NOTE =
  'Nothing on this page counts anything per person. There is no leaderboard, no productivity score and nothing to sort people by, because a number beside somebody’s name gets acted on as though it were a measurement and it never is. What is counted here is work.';

/* ================================================= owner-operator */

export function ownerOperatorReport(data: CrmWorkspaceData, now: string): RoleReport {
  const today = now.slice(0, 10);

  const followUps = data.tasks.filter(
    (task) => task.deletedAt === null && task.state === 'open' && task.dueDate !== null && task.dueDate <= today
  );

  const quotes = data.quotes.filter(
    (quote) => quote.deletedAt === null && (quote.state === 'sent' || quote.state === 'draft')
  );

  const weekEnd = new Date(new Date(now).getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
  const jobsThisWeek = data.workItems.filter(
    (item) =>
      item.deletedAt === null &&
      item.status === 'open' &&
      item.nextStepDue !== null &&
      item.nextStepDue <= weekEnd
  );

  // The invoice record is a cached reference to an external accounting system,
  // never Concludo's own ledger, so every field here is read as "what the last
  // sync saw" rather than as fact. An invoice whose cache has never been filled
  // is not counted as overdue, because Concludo does not know that it is.
  const overdueInvoices = data.invoiceReferences.filter((invoice) => {
    if (invoice.deletedAt !== null) return false;
    if (invoice.cachedStatus === 'paid' || invoice.cachedStatus === 'void') return false;
    if (invoice.cachedStatus === 'overdue') return true;
    return invoice.cachedDueDate !== null && invoice.cachedDueDate < today;
  });

  // The index, not a filter per organisation: that filter was a pass over
  // every contact for every organisation, which at a hundred thousand contacts
  // and ten thousand organisations is the difference between a page and a
  // minute.
  const index = indexFor(data);

  const needingAttention = index.liveOrganisations.filter((organisation) => {
    const people = index.peopleByOrganisation.get(organisation.id) ?? [];
    const lastContact = people
      .map((person) => lastMeaningfulContactWith(data, person.id))
      .filter((at): at is string => at !== null)
      .sort()
      .at(-1);
    if (!lastContact) return true;
    return (new Date(now).getTime() - new Date(lastContact).getTime()) / 86_400_000 > 60;
  });

  return {
    role: 'owner_operator',
    title: REPORT_TITLES.owner_operator,
    description:
      'For somebody who does the work and runs the business. Five things, all of them due or overdue.',
    notRankedNote: NOT_RANKED_NOTE,
    lines: [
      {
        label: 'Follow-ups due',
        count: followUps.length,
        meaning: 'Tasks with a date that has arrived or passed.',
        path: '/crm',
        items: followUps.slice(0, 8).map((task) => ({
          id: task.id,
          title: task.title,
          context: task.dueDate ? `Due ${task.dueDate}` : 'No date',
          path: null,
        })),
      },
      {
        label: 'Quotes outstanding',
        count: quotes.length,
        meaning: 'Sent or drafted, and not yet accepted or declined.',
        path: '/crm/pipeline',
      },
      {
        label: 'Jobs this week',
        count: jobsThisWeek.length,
        meaning: 'Open work with a next step due in the next seven days.',
        path: '/crm/pipeline',
        items: jobsThisWeek.slice(0, 8).map((item) => ({
          id: item.id,
          title: item.title,
          context: item.nextStep ?? 'No next step recorded',
          path: `/crm/work/${item.id}`,
        })),
      },
      {
        label: 'Invoice references overdue',
        count: overdueInvoices.length,
        meaning:
          'Concludo holds a reference and a state, never the invoice itself. The accounting system is the record.',
        path: '/crm/organisations',
      },
      {
        label: 'Customers needing attention',
        count: needingAttention.length,
        meaning: 'No recorded conversation in the last 60 days, or none at all.',
        path: '/crm/relationships',
        items: needingAttention.slice(0, 8).map((organisation) => ({
          id: organisation.id,
          title: organisation.name,
          context: 'No recent recorded conversation',
          path: `/crm/organisations/${organisation.id}`,
        })),
      },
    ],
  };
}

/* ========================================================= sales */

export function salesReport(data: CrmWorkspaceData, now: string): RoleReport {
  const today = now.slice(0, 10);

  const dueToday = data.tasks.filter(
    (task) => task.deletedAt === null && task.state === 'open' && task.dueDate !== null && task.dueDate <= today
  );

  const needingReview: WorkItem[] = [];
  const missingNextStep: WorkItem[] = [];

  for (const pipeline of pipelinesIn(data)) {
    const board = buildBoard(data, pipeline.id, now);
    if (!board) continue;
    for (const column of board.columns) {
      for (const card of column.cards) {
        if (card.stale) needingReview.push(card.item);
        if (!card.item.nextStep) missingNextStep.push(card.item);
      }
    }
  }

  const commitments = data.commitments.filter(
    (commitment) => commitment.deletedAt === null && commitment.state === 'open'
  );

  const proposals = data.proposals.filter(
    (proposal) => proposal.state === 'awaiting_confirmation' && proposal.deletedAt === null
  );

  return {
    role: 'sales',
    title: REPORT_TITLES.sales,
    description: 'For somebody selling. What is due, what is stuck, and what is waiting on them.',
    notRankedNote: NOT_RANKED_NOTE,
    lines: [
      {
        label: 'Today’s actions',
        count: dueToday.length,
        meaning: 'Tasks due today or earlier.',
        path: '/crm',
      },
      {
        label: 'Pipeline requiring review',
        count: needingReview.length,
        meaning: 'Work that has been at its stage longer than this workspace usually takes.',
        path: '/crm/pipeline',
        items: needingReview.slice(0, 8).map((item) => ({
          id: item.id,
          title: item.title,
          context: 'Has gone quiet',
          path: `/crm/work/${item.id}`,
        })),
      },
      {
        label: 'Missing next steps',
        count: missingNextStep.length,
        meaning: 'Open work with nothing recorded as the next thing to do.',
        path: '/crm/pipeline',
        items: missingNextStep.slice(0, 8).map((item) => ({
          id: item.id,
          title: item.title,
          context: 'No next step',
          path: `/crm/work/${item.id}`,
        })),
      },
      {
        label: 'Commitments',
        count: commitments.length,
        meaning: 'Promises open on both sides.',
        path: '/crm/commitments',
      },
      {
        label: 'AI proposals',
        count: proposals.length,
        meaning: 'Waiting for somebody. Nothing has been applied.',
        path: '/crm/proposals',
      },
    ],
  };
}

/* ======================================================= manager */

export function managerReport(data: CrmWorkspaceData, now: string): RoleReport {
  const pipelines = pipelinesIn(data);

  let open = 0;
  let stale = 0;
  let totalStageAge = 0;
  let cards = 0;
  const bottlenecks: { id: string; title: string; context: string; path: string | null }[] = [];

  for (const pipeline of pipelines) {
    const board = buildBoard(data, pipeline.id, now);
    if (!board) continue;
    open += board.openCount;
    stale += board.staleCount;

    for (const column of board.columns) {
      for (const card of column.cards) {
        cards += 1;
        totalStageAge += card.daysInStage;
      }
      // A stage where work sits far longer than that stage expects is a
      // bottleneck in the PROCESS. It names a stage, never a person.
      const inStage = column.cards.length;
      if (inStage === 0) continue;
      const averageAge =
        column.cards.reduce((sum, card) => sum + card.daysInStage, 0) / inStage;
      if (averageAge > column.stage.typicalDays * 1.5) {
        bottlenecks.push({
          id: column.stage.id,
          title: `${pipeline.name}: ${column.stage.name}`,
          context: `${Math.round(averageAge)} days on average, where ${column.stage.typicalDays} is usual`,
          path: '/crm/pipeline',
        });
      }
    }
  }

  const resolved = data.workItems.filter(
    (item) => item.deletedAt === null && (item.status === 'won' || item.status === 'not_proceeding')
  );
  const won = resolved.filter((item) => item.status === 'won');

  const forecast = pipelines[0] ? buildForecast(data, pipelines[0].id, now) : null;
  // Not a sweep of every record on the way to a page. Above the threshold this
  // reads what the record-quality job wrote, and where no job has run it says
  // so rather than showing a zero.
  const quality = qualityFigure(data, now);

  return {
    role: 'manager',
    title: REPORT_TITLES.manager,
    description:
      'For somebody running a team. Everything here is about the work and the process. Nothing is about a person.',
    notRankedNote: NOT_RANKED_NOTE,
    lines: [
      {
        label: 'Pipeline coverage',
        count: open,
        meaning:
          'Open work across every pipeline. Coverage against a target needs a target, and no target has been agreed.',
        path: '/crm/pipeline',
      },
      {
        label: 'Stage conversion',
        count: resolved.length === 0 ? 0 : Math.round((won.length / resolved.length) * 100),
        meaning:
          resolved.length < 10
            ? `Only ${resolved.length} ${resolved.length === 1 ? 'piece' : 'pieces'} of work have been resolved. That is too few to read anything into, and the figure is shown so nobody treats it as a rate.`
            : `${won.length} of ${resolved.length} resolved pieces of work were won.`,
        path: '/crm/reports',
      },
      {
        label: 'Average stage age',
        count: cards === 0 ? 0 : Math.round(totalStageAge / cards),
        meaning: 'Days, across every open piece of work.',
        path: '/crm/pipeline',
      },
      {
        label: 'Human forecast against the system estimate',
        count: forecast?.disagreements.length ?? 0,
        meaning:
          'Where the two disagree. They are never merged, and the disagreement is the useful part.',
        path: '/crm/forecast',
      },
      {
        label: 'Data quality',
        count: quality.flaggedRecords,
        meaning: `Records with something recorded against them for review. ${quality.note}${
          quality.whatWouldFixIt ? ` ${quality.whatWouldFixIt}` : ''
        }`,
        path: '/crm/data-quality',
      },
      {
        label: 'Process bottlenecks',
        count: bottlenecks.length,
        meaning:
          'Stages where work sits far longer than that stage expects. This names a stage, never a person.',
        path: '/crm/pipeline',
        items: bottlenecks,
      },
    ],
  };
}

/* ================================================ account manager */

export function accountManagerReport(data: CrmWorkspaceData, now: string): RoleReport {
  const plans = accountPlansIn(data, now);
  const today = now.slice(0, 10);

  const reviewsDue = plans.filter(
    (plan) => plan.reviewOverdueDays !== null || plan.lastReviewedAt === null
  );

  const coverage = workspaceCoverage(data, (personId) =>
    lastMeaningfulContactWith(data, personId)
  );
  const gaps = coverage.filter((entry) => entry.absent.length > 0 || entry.singleContact);

  const renewals = data.organisations
    .filter((organisation) => organisation.deletedAt === null && organisation.renewalDate !== null)
    .filter((organisation) => (organisation.renewalDate as string) >= today)
    .sort((a, b) => (a.renewalDate as string).localeCompare(b.renewalDate as string));

  const unknownCells = data.whitespaceCells.filter(
    (cell) => cell.deletedAt === null && cell.state === 'unknown'
  );

  const serviceRisks = data.serviceCases.filter(
    (kase) =>
      kase.deletedAt === null &&
      kase.state !== 'resolved' &&
      kase.state !== 'closed' &&
      kase.severity !== 'low'
  );

  return {
    role: 'account_manager',
    title: REPORT_TITLES.account_manager,
    description:
      'For somebody holding accounts. Where planning is off for this workspace, the first two lines are empty and say so.',
    notRankedNote: NOT_RANKED_NOTE,
    lines: [
      {
        label: 'Account-plan reviews',
        count: reviewsDue.length,
        meaning: data.workspace.accountPlanningEnabled
          ? 'Plans overdue for review, or never reviewed.'
          : 'Account planning is off for this workspace, so there are no plans to review.',
        path: '/crm/account-plans',
        items: reviewsDue.slice(0, 8).map((plan) => ({
          id: plan.plan.id,
          title: plan.organisation.name,
          context:
            plan.lastReviewedAt === null
              ? 'Never reviewed'
              : `${plan.reviewOverdueDays} days overdue`,
          path: `/crm/account-plans/${plan.organisation.id}`,
        })),
      },
      {
        label: 'Relationship gaps',
        count: gaps.length,
        meaning: 'Accounts with a role nobody holds, or only one contact.',
        path: '/crm/coverage',
      },
      {
        label: 'Renewal dates',
        count: renewals.length,
        meaning: 'Recorded renewal dates still ahead.',
        path: '/crm/organisations',
        items: renewals.slice(0, 8).map((organisation) => ({
          id: organisation.id,
          title: organisation.name,
          context: `Renews ${organisation.renewalDate}`,
          path: `/crm/organisations/${organisation.id}`,
        })),
      },
      {
        label: 'Whitespace',
        count: unknownCells.length,
        meaning:
          'Cells nobody has answered. These are questions worth asking, not opportunities.',
        path: '/crm/account-plans',
      },
      {
        label: 'Open service risks',
        count: serviceRisks.length,
        meaning: 'Open cases above low severity. The detail stays in the case.',
        path: '/crm/service',
      },
    ],
  };
}

/* ==================================================== service lead */

export function serviceLeadReport(
  data: CrmWorkspaceData,
  now: string,
  role: CrmRole
): RoleReport {
  const inbox = buildServiceInbox(data, now, role);

  return {
    role: 'service_lead',
    title: REPORT_TITLES.service_lead,
    description:
      'For somebody running service. Ordered by what the consequence says, never by who complained loudest.',
    notRankedNote: NOT_RANKED_NOTE,
    lines: [
      {
        label: 'Backlog',
        count: inbox.open.length,
        meaning: 'Open cases, ordered by consequence.',
        path: '/crm/service',
        items: inbox.open.slice(0, 8).map((view) => ({
          id: view.kase.id,
          title: view.kase.title,
          context: `${view.priority.priority.replace(/_/g, ' ')}: ${view.consequenceWord.toLowerCase()}`,
          path: '/crm/service',
        })),
      },
      {
        label: 'Past a Concludo target',
        count: inbox.atRisk.length,
        meaning: inbox.slaNote,
        path: '/crm/service',
      },
      {
        label: 'Cases requiring review',
        count: inbox.withoutConsequence.length + inbox.unassigned.length,
        meaning:
          'Cases with nobody assigned, or with nothing recorded about what it does to the customer.',
        path: '/crm/service',
      },
      {
        label: 'Customer history',
        count: inbox.open.filter((view) => view.customerHistory.length > 3).length,
        meaning:
          'Open cases at customers with something else recorded. The history is on the case.',
        path: '/crm/service',
      },
      {
        label: 'Draft responses waiting',
        count: inbox.open.filter((view) => view.draft !== null).length,
        meaning: 'Drafts are never sent by Concludo. Somebody copies and sends them.',
        path: '/crm/service',
      },
    ],
  };
}

/* ======================================================= executive */

export function executiveReport(data: CrmWorkspaceData, now: string): RoleReport {
  const pipelines = pipelinesIn(data);
  const forecast = pipelines[0] ? buildForecast(data, pipelines[0].id, now) : null;

  const won = data.workItems.filter((item) => item.status === 'won' && item.deletedAt === null);
  const wonValue = won.reduce((sum, item) => sum + (item.valueAmount ?? 0), 0);

  /* Customer concentration: what share of recorded value sits with the largest
     account. A real risk, and a property of the book rather than of a person. */
  const byOrganisation = new Map<string, number>();
  for (const item of won) {
    if (!item.organisationId) continue;
    byOrganisation.set(
      item.organisationId,
      (byOrganisation.get(item.organisationId) ?? 0) + (item.valueAmount ?? 0)
    );
  }
  const largest = [...byOrganisation.values()].sort((a, b) => b - a)[0] ?? 0;
  const concentration = wonValue === 0 ? 0 : Math.round((largest / wonValue) * 100);

  const today = now.slice(0, 10);
  const within90 = new Date(new Date(now).getTime() + 90 * 86_400_000).toISOString().slice(0, 10);
  const renewalsSoon = data.organisations.filter(
    (organisation) =>
      organisation.deletedAt === null &&
      organisation.renewalDate !== null &&
      organisation.renewalDate >= today &&
      organisation.renewalDate <= within90
  );

  const openCases = data.serviceCases.filter(
    (kase) => kase.deletedAt === null && kase.state !== 'resolved' && kase.state !== 'closed'
  );
  const accountsWithCases = new Set(openCases.map((kase) => kase.organisationId));

  const quality = qualityFigure(data, now);
  const counts = qualityCounts(quality);
  const qualityKinds =
    counts === null ? null : Object.entries(counts).filter(([, n]) => n > 0).length;
  const liveRecords =
    indexFor(data).livePeople.length + indexFor(data).liveOrganisations.length;

  return {
    role: 'executive',
    title: REPORT_TITLES.executive,
    description:
      'For somebody who needs the shape of the business. Every figure says how thin the evidence under it is, because a confident number on a small base is worse than no number.',
    notRankedNote: NOT_RANKED_NOTE,
    lines: [
      {
        label: 'Recorded value of won work',
        count: Math.round(wonValue),
        meaning:
          won.length < 10
            ? `From ${won.length} ${won.length === 1 ? 'piece' : 'pieces'} of won work. Too few to read a trend into, and no trend is shown.`
            : `From ${won.length} pieces of won work.`,
        path: '/crm/reports',
      },
      {
        label: 'Forecast range',
        count: forecast?.system.items.length ?? 0,
        meaning:
          'Open work, grouped by how well it is recorded. Concludo offers no probability, because it has no history of closed work to calibrate one against.',
        path: '/crm/forecast',
      },
      {
        label: 'Data-quality coverage',
        count:
          quality.flaggedRecords === null || liveRecords === 0
            ? null
            : Math.round(((liveRecords - quality.flaggedRecords) / liveRecords) * 100),
        meaning:
          quality.flaggedRecords === null
            ? `Per cent of live records with nothing flagged against them. ${quality.note}${
                quality.whatWouldFixIt ? ` ${quality.whatWouldFixIt}` : ''
              }`
            : `Per cent of live records with nothing flagged against them. ${quality.flaggedRecords.toLocaleString('en-AU')} of ${liveRecords.toLocaleString('en-AU')} carry a flag${
                qualityKinds === null ? '' : `, across ${qualityKinds} ${qualityKinds === 1 ? 'kind' : 'kinds'} of issue`
              }. ${quality.note}`,
        path: '/crm/data-quality',
      },
      {
        label: 'Customer concentration',
        count: concentration,
        meaning:
          wonValue === 0
            ? 'Nothing is recorded as won, so there is no concentration to report.'
            : `Per cent of recorded won value at the largest single account, across ${byOrganisation.size} ${byOrganisation.size === 1 ? 'account' : 'accounts'}.`,
        path: '/crm/organisations',
      },
      {
        label: 'Renewal exposure',
        count: renewalsSoon.length,
        meaning: 'Accounts with a recorded renewal date in the next 90 days.',
        path: '/crm/organisations',
      },
      {
        label: 'Service exposure',
        count: accountsWithCases.size,
        meaning:
          'Accounts with an open service issue. The detail stays in the case; this is a count of accounts.',
        path: '/crm/service',
      },
    ],
  };
}

/* ========================================================= all six */

export function buildReport(
  role: ReportRole,
  data: CrmWorkspaceData,
  now: string,
  actingRole: CrmRole
): RoleReport {
  switch (role) {
    case 'owner_operator':
      return ownerOperatorReport(data, now);
    case 'sales':
      return salesReport(data, now);
    case 'manager':
      return managerReport(data, now);
    case 'account_manager':
      return accountManagerReport(data, now);
    case 'service_lead':
      return serviceLeadReport(data, now, actingRole);
    case 'executive':
      return executiveReport(data, now);
  }
}

export function allReports(
  data: CrmWorkspaceData,
  now: string,
  actingRole: CrmRole
): RoleReport[] {
  return REPORT_ROLES.map((role) => buildReport(role, data, now, actingRole));
}
