/**
 * The queue, held for the life of the tab.
 *
 * Same arrangement as Stage 5's session store and for the same reason: the
 * agents run against a working copy, the decisions a person makes are held in
 * memory, and closing the tab puts everything back. Nothing is persisted and
 * nothing is applied to a customer system, because there is no customer system
 * connected.
 *
 * Kept separate from Stage 5's store because the thing being held is different:
 * Stage 5 holds a workspace, this holds decisions ABOUT proposals over that
 * workspace. Re-running the agents produces fresh proposals; the decisions
 * already made have to survive that, which is what `reconcile` below is for.
 */
import { CrmWorkspaceData } from '../domain';
import { CRM_WORKSPACES } from '../data/workspaces';
import { sessionWorkspace, CRM_SESSION_NOW, notifyWritten } from '../stage5/session';
import { QueueState, QueueRun, openQueue, revalidate, runAgents } from './queue';

const queues = new Map<string, QueueState>();

/** Other workspaces, so a cross-tenant source is caught rather than missed. */
function othersThan(workspaceId: string): CrmWorkspaceData[] {
  return CRM_WORKSPACES.filter((data) => data.workspace.id !== workspaceId);
}

/**
 * The queue for one workspace.
 *
 * Built on first use and kept. Re-reading does not re-run the agents, because
 * a queue that reshuffled itself while somebody was working through it would be
 * unusable, and because a proposal whose id changed under an approval is
 * exactly the invalidation case this stage exists to prevent.
 */
export function sessionQueue(workspaceId: string): QueueState {
  const existing = queues.get(workspaceId);
  if (existing) return revalidate(existing, CRM_SESSION_NOW);

  const data = sessionWorkspace(workspaceId);
  const run: QueueRun = runAgents(data, CRM_SESSION_NOW, othersThan(workspaceId));
  const state = openQueue(run, CRM_SESSION_NOW);
  queues.set(workspaceId, state);
  return state;
}

/** What the agents refused to admit, for the page that says so. */
export function sessionRefusals(workspaceId: string): QueueRun['refused'] {
  const data = sessionWorkspace(workspaceId);
  return runAgents(data, CRM_SESSION_NOW, othersThan(workspaceId)).refused;
}

/**
 * Run the agents again, keeping the decisions already made.
 *
 * The interesting case is a proposal that EXISTED, was approved, and has
 * changed because the records changed under it. That proposal keeps its
 * approval record and fails revalidation, which is the behaviour the brief
 * requires. A proposal nobody has decided on is simply replaced.
 */
export function rerunAgents(workspaceId: string): QueueState {
  const data = sessionWorkspace(workspaceId);
  const fresh = runAgents(data, CRM_SESSION_NOW, othersThan(workspaceId));
  const previous = queues.get(workspaceId);

  const next = openQueue(fresh, CRM_SESSION_NOW);

  if (previous) {
    for (const entry of next.entries) {
      const before = previous.entries.find((e) => e.proposal.id === entry.proposal.id);
      if (!before) continue;
      // A decision survives a re-run. The approval is checked against the NEW
      // proposal, so anything that moved invalidates it rather than riding
      // along under an approval given for something else.
      entry.approval = before.approval;
      entry.history = [...before.history];
      if (before.proposal.state !== 'awaiting_confirmation') {
        entry.proposal.state = before.proposal.state;
      }
    }
  }

  queues.set(workspaceId, revalidate(next, CRM_SESSION_NOW));
  notifyWritten();
  return queues.get(workspaceId) as QueueState;
}

/** Back to the start. */
export function resetQueue(workspaceId?: string): void {
  if (workspaceId) queues.delete(workspaceId);
  else queues.clear();
  notifyWritten();
}

/** Tells the mounted views that a decision was made. */
export function queueChanged(): void {
  notifyWritten();
}

export { CRM_SESSION_NOW };
