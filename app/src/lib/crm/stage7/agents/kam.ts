/**
 * The KAM Copilot agent.
 *
 * The review engine in ../../kam/review.ts works out what is known, assumed
 * and unanswered about an account. This turns a subset of that into proposals
 * a person works through in the queue, under exactly the same contract as the
 * other ten agents: eleven explanation fields, every claim grounded in a
 * record that resolves in this workspace, nothing marked as authorised to
 * send, nothing applied without a human decision.
 *
 * WHAT IT PROPOSES, AND WHAT IT DELIBERATELY DOES NOT.
 *
 * It proposes three things:
 *
 *   A REVIEW REQUEST where a required seat in the buying centre is empty. The
 *   proposal does not fill the seat. It asks a person to find out, and carries
 *   the question to ask.
 *
 *   A REVIEW REQUEST where the account plan has an objective but no outcome
 *   with a measure, because an objective with no measure is an aspiration and
 *   the model should keep saying so.
 *
 *   A FLAG FOR ATTENTION where a promise we made has passed the date we gave.
 *   That one is a fact with a date on it, which is why it is the only one of
 *   the three that states something rather than asking.
 *
 * It proposes NO change to any person record, any stakeholder role, or any
 * field that describes an individual. There is no code path here that could:
 * every `changes` array this agent builds is empty, and the suite asserts it.
 * The reason is in the header of ../../kam/review.ts and in PROMPT_DEPARTURES.
 */
import { CrmWorkspaceData } from '../../domain';
import { accountReviewFor } from '../../kam/review';
import { AgentRun, BuildContext, emptyRun, organisationSource, propose, sources } from './build';

const DAY = 86_400_000;

export function kamCopilotAgent(context: BuildContext): AgentRun {
  const run = emptyRun();
  const { data, now } = context;

  const accounts = data.organisations.filter(
    (organisation) => organisation.deletedAt === null
  );

  for (const organisation of accounts) {
    const review = accountReviewFor(data, organisation.id, now);
    if (!review) continue;

    const orgSource = organisationSource(data, organisation.id);
    if (!orgSource) continue;

    /* ---- 1. an empty seat in the buying centre ---- */

    const emptyRequired = review.seats.filter(
      (seat) => seat.requiredForDecision && seat.filled === 0
    );

    if (emptyRequired.length > 0) {
      const openWork = data.workItems.filter(
        (item) =>
          item.organisationId === organisation.id &&
          item.status === 'open' &&
          item.deletedAt === null
      );

      const question = review.questions.find((entry) =>
        emptyRequired.some((seat) => entry.key === `q_seat_${seat.role}`)
      );

      propose(
        context,
        {
          agent: 'kam_copilot',
          kind: 'review_request',
          observed: `${emptyRequired.map((seat) => seat.label.toLowerCase()).join(' and ')} ${emptyRequired.length === 1 ? 'is' : 'are'} not recorded on ${organisation.name}${openWork.length > 0 ? `, and ${openWork.length} ${openWork.length === 1 ? 'piece' : 'pieces'} of work ${openWork.length === 1 ? 'is' : 'are'} open there` : ''}.`,
          sources: sources(
            orgSource,
            ...openWork.slice(0, 2).map((item) => ({
              table: 'crm_work_items',
              id: item.id,
              label: item.title,
              quote: item.nextStep,
              path: `/crm/work/${item.id}`,
            }))
          ),
          proposes: question
            ? `Find out before the next conversation, by asking: "${question.question}" Record the answer as a role on the account, not as a note.`
            : 'Find out who holds these roles before the next conversation, and record them on the account.',
          /* No changes. The agent does not know who holds the seat, and
             guessing is the failure this whole module is built to avoid. */
          changes: [],
          confidence: 'high',
          assumptions: [
            'That an empty seat means nobody has recorded one, rather than that the customer genuinely has nobody in that role. Both happen, and this cannot tell them apart.',
          ],
          conflicts: [],
          missingInformation: emptyRequired.map(
            (seat) => `Nobody is recorded as ${seat.label.toLowerCase()}.`
          ),
          consequences: [
            'Nothing changes on any record. This is a request for somebody to find something out.',
          ],
          approval: {
            role: 'crm_contributor',
            because:
              'It asks a person to go and find something out. It changes no record, so it needs no approver.',
            individualOnly: false,
          },
          scanned: openWork.map((item) => item.nextStep),
        },
        run
      );
    }

    /* ---- 2. an objective with no measure ---- */

    const plan = data.accountPlans.find(
      (entry) => entry.organisationId === organisation.id && entry.deletedAt === null
    );
    const outcomes = plan
      ? data.accountPlanOutcomes.filter((outcome) => outcome.accountPlanId === plan.id)
      : [];

    if (plan && outcomes.length === 0) {
      propose(
        context,
        {
          agent: 'kam_copilot',
          kind: 'review_request',
          observed: `The plan for ${organisation.name} states an objective and records no outcome with a measure against it.`,
          sources: sources({
            table: 'crm_account_plans',
            id: plan.id,
            label: 'The account plan',
            quote: plan.objective,
            path: '/crm/plans',
          }),
          proposes:
            'Agree one measurable outcome with the customer and record it with its measure. An objective with no measure is an aspiration, and nobody can tell at the review whether it was met.',
          changes: [],
          confidence: 'high',
          assumptions: [],
          conflicts: [],
          missingInformation: [
            'What the customer would accept as evidence that the objective was met.',
          ],
          consequences: [
            'Nothing changes on any record. Adding the outcome is a separate action a person takes on the plan.',
          ],
          approval: {
            role: 'crm_contributor',
            because: 'It changes no record. It asks for a conversation with the customer.',
            individualOnly: false,
          },
          scanned: [plan.objective, plan.summary],
        },
        run
      );
    }

    /* ---- 3. a promise past the date we gave ---- */

    const overdue = data.commitments.filter(
      (commitment) =>
        commitment.organisationId === organisation.id &&
        commitment.deletedAt === null &&
        commitment.state !== 'done' &&
        commitment.ownedByUs &&
        commitment.dueDate !== null &&
        Date.parse(commitment.dueDate) < Date.parse(now)
    );

    if (overdue.length > 0) {
      const worst = overdue.reduce((oldest, commitment) =>
        (commitment.dueDate ?? '') < (oldest.dueDate ?? '') ? commitment : oldest
      );
      const daysOver = Math.floor(
        (Date.parse(now) - Date.parse(worst.dueDate as string)) / DAY
      );

      propose(
        context,
        {
          agent: 'kam_copilot',
          kind: 'flag_for_attention',
          observed: `${overdue.length} ${overdue.length === 1 ? 'promise' : 'promises'} we made to ${organisation.name} ${overdue.length === 1 ? 'is' : 'are'} past the date we gave. The oldest is ${daysOver} ${daysOver === 1 ? 'day' : 'days'} over.`,
          sources: sources(
            orgSource,
            ...overdue.slice(0, 3).map((commitment) => ({
              table: 'crm_commitments',
              id: commitment.id,
              label: commitment.description,
              quote: commitment.description,
              path: '/crm/commitments',
            }))
          ),
          proposes:
            'Say something to the customer before the next scheduled contact. A missed date that nobody mentions costs more trust than the delay itself, and the customer already knows.',
          changes: [],
          confidence: 'high',
          assumptions: [
            'That the promise is still wanted. A promise overtaken by events looks identical to one that was forgotten.',
          ],
          conflicts: [],
          missingInformation: [
            'Whether anybody has already raised it outside Concludo.',
          ],
          consequences: [
            'Nothing changes on any record, and nothing is sent. This flags something for a person to act on.',
          ],
          approval: {
            role: 'crm_contributor',
            because: 'It changes no record and sends nothing.',
            individualOnly: false,
          },
          scanned: overdue.map((commitment) => commitment.description),
        },
        run
      );
    }
  }

  return run;
}

/**
 * Every proposal this agent can build, for the suite to assert against.
 *
 * Kept here rather than inferred from a run, so that a new proposal kind added
 * without a test is a failure rather than an omission nobody notices.
 */
export const KAM_PROPOSAL_KINDS = ['review_request', 'flag_for_attention'] as const;

/** True where this agent would change any record. It never does. See the header. */
export function kamProposesNoChanges(data: CrmWorkspaceData, run: AgentRun): boolean {
  void data;
  return run.proposals.every((proposal) => proposal.changes.length === 0);
}
