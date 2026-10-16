/**
 * The one way an agent builds a proposal.
 *
 * Every agent in Stage 7 goes through `propose` below. That is not tidiness: it
 * is what makes the eleven explanation fields impossible to skip, the injection
 * scan impossible to forget, and the admission check impossible to route
 * around. An agent that assembled its own object literal would eventually ship
 * one missing `conflicts`, and the first person to notice would be the person
 * approving it.
 *
 * `propose` returns `null` for a proposal that fails the contract or the
 * grounding check, and records why. It does not throw: an agent that finds
 * eleven things and builds one badly should still deliver the other ten, and
 * the refusal belongs in a list a developer can read rather than in a stack
 * trace that loses the other ten.
 */
import { Confidence, CrmWorkspaceData } from '../../domain';
import {
  AgentName,
  AgentProposal,
  Admission,
  ApprovalRequirement,
  ExternalAction,
  FieldChange,
  NO_EXTERNAL_ACTION,
  ProposalSource,
  admit,
} from '../contract';
import { InjectionSignal, scanAll } from '../untrusted';

export interface ProposalDraft {
  agent: AgentName;
  kind: AgentProposal['kind'];
  observed: string;
  sources: ProposalSource[];
  proposes: string;
  changes?: FieldChange[];
  externalAction?: ExternalAction;
  confidence: Confidence;
  assumptions?: string[];
  conflicts?: string[];
  missingInformation?: string[];
  consequences?: string[];
  approval: ApprovalRequirement;
  isDestructive?: boolean;
  /** Content the proposal leaned on, scanned for text addressed to software. */
  scanned?: (string | null | undefined)[];
}

export interface AgentRun {
  proposals: AgentProposal[];
  /** Proposals the agent built and the door refused, with why. */
  refused: { draft: ProposalDraft; because: string[] }[];
}

export interface BuildContext {
  data: CrmWorkspaceData;
  now: string;
  /** Other workspaces, so a cross-tenant source is caught rather than missed. */
  otherWorkspaces?: CrmWorkspaceData[];
  /** Deterministic ids, so a test can name a proposal. */
  nextId: () => string;
}

export function makeIds(prefix: string): () => string {
  let counter = 0;
  return () => {
    counter += 1;
    return `${prefix}-${String(counter).padStart(3, '0')}`;
  };
}

export function propose(
  context: BuildContext,
  draft: ProposalDraft,
  into: AgentRun
): AgentProposal | null {
  const signals: InjectionSignal[] = scanAll([
    ...(draft.scanned ?? []),
    ...draft.sources.map((source) => source.quote),
  ]);

  const proposal: AgentProposal = {
    id: context.nextId(),
    crmWorkspaceId: context.data.workspace.id,
    agent: draft.agent,
    kind: draft.kind,
    observed: draft.observed,
    sources: draft.sources,
    proposes: draft.proposes,
    changes: draft.changes ?? [],
    externalAction: draft.externalAction ?? NO_EXTERNAL_ACTION,
    confidence: draft.confidence,
    assumptions: draft.assumptions ?? [],
    conflicts: draft.conflicts ?? [],
    missingInformation: draft.missingInformation ?? [],
    consequences: draft.consequences ?? [],
    approval: {
      ...draft.approval,
      // Content that addressed the software, or anything irreversible, is read
      // by a person on its own. Neither may ride along in an approve-all.
      individualOnly:
        draft.approval.individualOnly || signals.length > 0 || Boolean(draft.isDestructive),
    },
    isDestructive: draft.isDestructive ?? false,
    injectionFlags: signals.map((signal) => signal.what),
    proposedAt: context.now,
    state: 'awaiting_confirmation',
  };

  const admission: Admission = admit(context.data, proposal, context.otherWorkspaces ?? []);
  if (!admission.admitted) {
    into.refused.push({ draft, because: admission.refusedBecause });
    return null;
  }

  into.proposals.push(proposal);
  return proposal;
}

export function emptyRun(): AgentRun {
  return { proposals: [], refused: [] };
}

/* ------------------------------------------------- source helpers */

export function personSource(
  data: CrmWorkspaceData,
  personId: string,
  quote: string | null = null
): ProposalSource | null {
  const person = data.people.find((p) => p.id === personId && p.deletedAt === null);
  if (!person) return null;
  return {
    table: 'crm_people',
    id: person.id,
    label: person.fullName,
    quote,
    path: `/crm/people/${person.id}`,
  };
}

export function organisationSource(
  data: CrmWorkspaceData,
  organisationId: string,
  quote: string | null = null
): ProposalSource | null {
  const organisation = data.organisations.find(
    (o) => o.id === organisationId && o.deletedAt === null
  );
  if (!organisation) return null;
  return {
    table: 'crm_organisations',
    id: organisation.id,
    label: organisation.name,
    quote,
    path: `/crm/organisations/${organisation.id}`,
  };
}

export function activitySource(
  data: CrmWorkspaceData,
  activityId: string
): ProposalSource | null {
  const activity = data.activities.find((a) => a.id === activityId && a.deletedAt === null);
  if (!activity) return null;
  return {
    table: 'crm_activities',
    id: activity.id,
    label: `${activity.title}, ${activity.occurredAt.slice(0, 10)}`,
    quote: activity.summary,
    path: '/crm/activities',
  };
}

export function workItemSource(
  data: CrmWorkspaceData,
  workItemId: string
): ProposalSource | null {
  const item = data.workItems.find((w) => w.id === workItemId && w.deletedAt === null);
  if (!item) return null;
  return {
    table: 'crm_work_items',
    id: item.id,
    label: item.title,
    quote: item.nextStep,
    path: `/crm/work/${item.id}`,
  };
}

export function caseSource(data: CrmWorkspaceData, caseId: string): ProposalSource | null {
  const kase = data.serviceCases.find((c) => c.id === caseId && c.deletedAt === null);
  if (!kase) return null;
  return {
    table: 'crm_service_cases',
    id: kase.id,
    label: kase.title,
    quote: kase.relationshipEffect,
    path: '/crm/service',
  };
}

/** Drops the nulls, so an agent can build a source list without ceremony. */
export function sources(...candidates: (ProposalSource | null)[]): ProposalSource[] {
  return candidates.filter((source): source is ProposalSource => source !== null);
}
