/**
 * Who sees account planning, and who never has to know it exists.
 *
 * THE REQUIREMENT THIS FILE IS WRITTEN AGAINST.
 *
 * "Build practical account planning that works for strategic accounts but
 * remains hidden by default for users who do not need it."
 *
 * The second half of that sentence is the harder half, and it is the one most
 * CRMs get wrong. A sole trader with eleven customers opens an account plan,
 * finds a SWOT grid, a stakeholder map and a whitespace matrix, and concludes
 * one of two things: that the software is not for them, or that they have been
 * running their business wrong. Neither is true, and both cost more than the
 * feature was ever worth.
 *
 * So the rule is not "show it collapsed" or "show it greyed out". It is that
 * nothing about account planning appears anywhere until somebody turns it on:
 * not the navigation destination, not an empty state inviting them to start
 * one, not a tab with a lock on it. A feature advertised to somebody who does
 * not need it is still a tax on their attention.
 *
 * THREE GATES, NOT ONE.
 *
 *   1. The workspace switch. Off by default, in the fixture, in the factory and
 *      in the migration. Nothing below matters while this is off.
 *   2. The account. Inside an enabled workspace, a plan exists only for the
 *      accounts somebody started one for. Most accounts never need one, and an
 *      organisation with no plan shows no planning scaffolding, only a quiet
 *      offer to start one, and only to somebody who could.
 *   3. The role. Starting a plan, approving a joint plan and confirming a
 *      stakeholder role are not viewer actions. The write path enforces this;
 *      this file is what stops the control being drawn in the first place.
 *
 * WHY THIS IS A MODULE AND NOT A BOOLEAN IN EACH PAGE.
 *
 * Because the failure mode is one page forgetting. A single place that answers
 * "may this person see planning here" is testable in one suite, and the nine
 * callers that ask it cannot each be wrong in a different way.
 */
import { CrmRole, CrmWorkspaceData, Organisation, roleAtLeast } from '../domain';

/* ------------------------------------------------------ the three gates */

/** Gate one. Nothing else matters while this is false. */
export function planningEnabled(data: CrmWorkspaceData): boolean {
  return data.workspace.accountPlanningEnabled === true;
}

/** Gate two. A plan exists for this organisation, and has not been deleted. */
export function planFor(data: CrmWorkspaceData, organisationId: string) {
  if (!planningEnabled(data)) return null;
  return (
    data.accountPlans.find((p) => p.organisationId === organisationId && p.deletedAt === null) ??
    null
  );
}

/** Gate three, for the actions a plan carries. */
export function mayStartPlan(data: CrmWorkspaceData, role: CrmRole): boolean {
  return planningEnabled(data) && roleAtLeast(role, 'crm_contributor');
}

export function mayApprove(data: CrmWorkspaceData, role: CrmRole): boolean {
  return planningEnabled(data) && roleAtLeast(role, 'crm_approver');
}

/** Turning the feature on for a whole workspace is an administrator's act. */
export function maySwitchPlanningOn(role: CrmRole): boolean {
  return roleAtLeast(role, 'crm_admin');
}

/* ------------------------------------------- what the interface asks for */

export interface PlanningVisibility {
  /** Whether the planning destinations appear in the navigation at all. */
  showDestinations: boolean;
  /** Organisations in this workspace that have a plan. */
  plannedOrganisationIds: string[];
  /** How many accounts are planned, and how many are not. */
  plannedCount: number;
  unplannedCount: number;
  /**
   * What to say where somebody asks why they cannot see planning. Null while
   * the feature is on, because there is nothing to explain.
   */
  offBecause: string | null;
}

export function planningVisibility(data: CrmWorkspaceData): PlanningVisibility {
  const live = data.organisations.filter((o) => o.deletedAt === null);
  const planned = data.accountPlans
    .filter((p) => p.deletedAt === null)
    .map((p) => p.organisationId)
    .filter((id) => live.some((o) => o.id === id));

  if (!planningEnabled(data)) {
    return {
      showDestinations: false,
      plannedOrganisationIds: [],
      plannedCount: 0,
      unplannedCount: live.length,
      offBecause:
        'Account planning is turned off for this workspace. It is off until somebody turns it on, because most work does not need it.',
    };
  }

  return {
    showDestinations: true,
    plannedOrganisationIds: planned,
    plannedCount: planned.length,
    unplannedCount: live.length - planned.length,
    offBecause: null,
  };
}

/**
 * What an account page should offer, which is usually nothing.
 *
 * Returning `offer_to_start` only where the feature is on, the account has no
 * plan and the person could actually start one. Everywhere else this returns
 * `nothing`, and `nothing` means draw nothing at all: not a disabled button,
 * not an empty panel with a heading, not a tab.
 */
export type PlanAffordance = 'nothing' | 'offer_to_start' | 'open_plan';

export function affordanceFor(
  data: CrmWorkspaceData,
  organisation: Organisation,
  role: CrmRole
): PlanAffordance {
  if (!planningEnabled(data)) return 'nothing';
  if (planFor(data, organisation.id)) return 'open_plan';
  if (!mayStartPlan(data, role)) return 'nothing';
  return 'offer_to_start';
}

/**
 * Which accounts are worth a plan, as a question rather than an answer.
 *
 * NOT A SCORE, AND NOT A RECOMMENDATION. This returns the facts that usually
 * mean an account is strategic enough to be worth the effort of planning: more
 * than one contact, a renewal date, open work, more than one site or unit in
 * the hierarchy. It never ranks them, never adds them up, and never says an
 * account "should" have a plan. The person decides; this is what they decide
 * with.
 */
export interface PlanCandidate {
  organisation: Organisation;
  /** Plain facts, in words. Never weighted, never totalled. */
  reasons: string[];
  hasPlan: boolean;
}

export function planCandidates(data: CrmWorkspaceData): PlanCandidate[] {
  if (!planningEnabled(data)) return [];

  return data.organisations
    .filter((o) => o.deletedAt === null)
    .map((organisation) => {
      const reasons: string[] = [];

      const contacts = data.personOrganisationRoles.filter(
        (r) => r.organisationId === organisation.id && r.endedOn === null
      );
      if (contacts.length > 1) {
        reasons.push(`${contacts.length} people are recorded against it.`);
      }
      if (organisation.renewalDate) {
        reasons.push('It has a renewal date.');
      }

      const openWork = data.workItems.filter(
        (w) => w.organisationId === organisation.id && w.status === 'open' && w.deletedAt === null
      );
      if (openWork.length > 0) {
        reasons.push(
          `${openWork.length} ${openWork.length === 1 ? 'piece' : 'pieces'} of work are open against it.`
        );
      }

      const children = data.organisations.filter(
        (o) => o.parentOrganisationId === organisation.id && o.deletedAt === null
      );
      if (children.length > 0) {
        reasons.push(
          `It has ${children.length} ${children.length === 1 ? 'organisation' : 'organisations'} under it.`
        );
      }

      return {
        organisation,
        reasons,
        hasPlan: Boolean(planFor(data, organisation.id)),
      };
    })
    .filter((candidate) => candidate.hasPlan || candidate.reasons.length > 0);
}
