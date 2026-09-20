/**
 * Tasklet 1.6: Output Lifecycle Management
 *
 * Manages the formal lifecycle states of generated outputs from raw draft through
 * QA audit, human review, publication, and obsolescence via an explicit FSM.
 */

export const LIFECYCLE_STATES = [
  'DRAFT_GENERATED',
  'QA_AUDITED',
  'PENDING_HUMAN_APPROVAL',
  'APPROVED',
  'REJECTED',
  'PUBLISHED',
  'SUPERSEDED',
  'ARCHIVED',
];

const VALID_TRANSITIONS = {
  DRAFT_GENERATED: ['QA_AUDITED', 'ARCHIVED'],
  QA_AUDITED: ['PENDING_HUMAN_APPROVAL', 'APPROVED', 'REJECTED', 'ARCHIVED'],
  PENDING_HUMAN_APPROVAL: ['APPROVED', 'REJECTED', 'ARCHIVED'],
  APPROVED: ['PUBLISHED', 'ARCHIVED'],
  REJECTED: ['DRAFT_GENERATED', 'ARCHIVED'],
  PUBLISHED: ['SUPERSEDED', 'ARCHIVED'],
  SUPERSEDED: ['ARCHIVED'],
  ARCHIVED: [], // Terminal
};

export class OutputLifecycleService {
  constructor() {
    this.events = []; // Array of transition events
  }

  canTransition(fromState, toState) {
    if (!LIFECYCLE_STATES.includes(fromState) || !LIFECYCLE_STATES.includes(toState)) {
      return false;
    }
    const allowed = VALID_TRANSITIONS[fromState] || [];
    return allowed.includes(toState);
  }

  transition({ outputInstanceId, organisationId, fromState, toState, actorId, reason }) {
    if (!this.canTransition(fromState, toState)) {
      const err = new Error(
        `ILLEGAL_LIFECYCLE_TRANSITION: Cannot transition output ${outputInstanceId} from ${fromState} to ${toState}`
      );
      err.code = 'ILLEGAL_LIFECYCLE_TRANSITION';
      err.status = 400;
      throw err;
    }

    if (!actorId) {
      const err = new Error('State transitions require explicit user identity (actorId). No anonymous transitions.');
      err.code = 'ACTOR_REQUIRED';
      err.status = 401;
      throw err;
    }

    const event = {
      id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      output_instance_id: outputInstanceId,
      organisation_id: organisationId,
      from_state: fromState,
      to_state: toState,
      actor_id: actorId,
      transition_reason: reason || 'Lifecycle progression',
      created_at: new Date().toISOString(),
    };

    this.events.push(event);
    return event;
  }

  getEventsForOutput(outputInstanceId) {
    return this.events.filter((e) => e.output_instance_id === outputInstanceId);
  }
}
