/**
 * The AI proposal queue.
 *
 * This is the view that carries the product's central claim, so it is the one
 * most worth getting right: AI proposes, a human disposes.
 *
 * WHAT THE LIST IS ARRANGED AROUND.
 *
 * Reading is cheap and approving is not, so the list shows enough to decide
 * without opening anything, and the things that must not be batched are visibly
 * separate from the things that can. Three groups, in this order:
 *
 *   1. Needs you to read it. A message to a customer, something that cannot be
 *      undone, or a record carrying text addressed to software.
 *   2. Routine. Reversible, no message, no flags. These are what approve-all
 *      covers, and the button says how many it will take.
 *   3. Already decided, with what was decided and by whom.
 *
 * APPROVE ALL SAYS WHAT IT SKIPPED. A batch that silently left four proposals
 * behind is a batch that teaches somebody the queue is empty when it is not.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Mail, ShieldAlert } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, useCrmWrite } from '../../components/crm/Stage5Pieces';
import { AGENT_LABELS, AGENT_PURPOSES, AgentProposal } from '../../lib/crm/stage7/contract';
import {
  QueueEntry,
  approveAll,
  batchable,
  summarise,
} from '../../lib/crm/stage7/queue';
import {
  CRM_SESSION_NOW,
  queueChanged,
  rerunAgents,
  resetQueue,
  sessionQueue,
} from '../../lib/crm/stage7/session';

const STATE_WORDS: Record<AgentProposal['state'], string> = {
  awaiting_confirmation: 'Waiting for somebody',
  confirmed: 'Approved',
  declined: 'Rejected',
  deferred: 'Deferred',
  needs_more_information: 'More information asked for',
  superseded: 'Superseded',
  invalidated: 'Approval no longer valid',
};

const Row: React.FC<{ entry: QueueEntry; linkTo: (p: string) => string }> = ({
  entry,
  linkTo,
}) => {
  const proposal = entry.proposal;
  const check = batchable(entry);

  return (
    <li>
      <span className="ccrm-item ccrm-proposal-row">
        <span className="ccrm-item-main">
          <span className="ccrm-item-title">
            <Link className="ccrm-text-link" to={linkTo(`/crm/proposals/${proposal.id}`)}>
              {proposal.proposes}
            </Link>
          </span>
          <span className="ccrm-item-context">
            {AGENT_LABELS[proposal.agent]} agent. {proposal.observed}
          </span>

          <span className="ccrm-proposal-marks">
            {proposal.externalAction.kind !== 'none' ? (
              <span className="ccrm-mark ccrm-mark-message">
                <Mail size={12} aria-hidden="true" />
                Carries a message to {proposal.externalAction.recipients.length}{' '}
                {proposal.externalAction.recipients.length === 1 ? 'person' : 'people'}
              </span>
            ) : null}
            {proposal.isDestructive ? (
              <span className="ccrm-mark ccrm-mark-destructive">
                <AlertTriangle size={12} aria-hidden="true" />
                Cannot be undone
              </span>
            ) : null}
            {proposal.injectionFlags.length > 0 ? (
              <span className="ccrm-mark ccrm-mark-injection">
                <ShieldAlert size={12} aria-hidden="true" />
                A source contains text addressed to software
              </span>
            ) : null}
            {proposal.changes.length > 0 ? (
              <span className="ccrm-mark">
                {proposal.changes.length}{' '}
                {proposal.changes.length === 1 ? 'field would change' : 'fields would change'}
              </span>
            ) : (
              <span className="ccrm-mark">Changes nothing</span>
            )}
            <span className="ccrm-mark">{proposal.confidence} confidence</span>
          </span>

          {proposal.state !== 'awaiting_confirmation' ? (
            <span className="ccrm-reason">
              <span className="ccrm-standing">{STATE_WORDS[proposal.state]}</span>
              {entry.validity.message ? (
                <span className="ccrm-reason-text">{entry.validity.message}</span>
              ) : null}
            </span>
          ) : !check.ok ? (
            <span className="ccrm-reason-text">Not part of approve-all: {check.because}</span>
          ) : null}
        </span>

        <Link className="ccrm-text-link" to={linkTo(`/crm/proposals/${proposal.id}`)}>
          Read it
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </span>
    </li>
  );
};

export const CrmProposalsPage: React.FC = () => {
  const { viewState, linkTo } = useStage4();
  const write = useCrmWrite();
  const [, bump] = React.useState(0);
  const [batchNote, setBatchNote] = React.useState<string | null>(null);

  const state = sessionQueue(viewState.workspaceId);
  const summary = summarise(state);

  const waiting = state.entries.filter((e) => e.proposal.state === 'awaiting_confirmation');
  const needsReading = waiting.filter((e) => !batchable(e).ok);
  const routine = waiting.filter((e) => batchable(e).ok);
  const decided = state.entries.filter((e) => e.proposal.state !== 'awaiting_confirmation');

  return (
    <Stage4Scaffold
      title="What the agents propose"
      description="Nothing here has happened. Each one says what it saw, what it would change, and what it would take to approve it."
      loadingLabel="the proposal queue"
      emptyTitle="Nothing is proposed in this workspace"
      emptyBody="The agents read the records and found nothing worth raising."
      resultCount={state.entries.length}
      totalCount={state.entries.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <p className="ccrm-policy" role="note">
        No model is called anywhere in this release. These proposals are produced from the records
        by rules you can read, which is why the same data always produces the same list. What is
        built here is the part that has to be right before a model is wired in: the contract every
        proposal must satisfy, the check that refuses one pointing at a record that does not exist,
        and the approval that stops holding the moment anything it covered changes.
      </p>

      <ul className="ccrm-card-rail">
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{summary.waiting}</span>
            <span className="ccrm-card-label">Waiting for somebody</span>
            <span className="ccrm-card-note">Nothing has been applied.</span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{summary.notBatchable}</span>
            <span className="ccrm-card-label">Need reading on their own</span>
            <span className="ccrm-card-note">
              A message, something that cannot be undone, or a source carrying text addressed to
              software.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{summary.withExternalAction}</span>
            <span className="ccrm-card-label">Carry a draft message</span>
            <span className="ccrm-card-note">
              Nothing is sent. Concludo has no way to send anything in this release.
            </span>
          </span>
        </li>
        <li>
          <span className="ccrm-card">
            <span className="ccrm-card-count">{summary.invalidated}</span>
            <span className="ccrm-card-label">Approvals no longer valid</span>
            <span className="ccrm-card-note">
              Something they covered changed after approval, so nothing was applied.
            </span>
          </span>
        </li>
      </ul>

      <div className="ccrm-capture-actions">
        <button
          type="button"
          className="btn-secondary ccrm-button ccrm-button-primary"
          disabled={routine.length === 0}
          onClick={() => {
            const result = approveAll(state, write.context.userId, CRM_SESSION_NOW, write.role);
            setBatchNote(
              `${result.approved.length} approved. ${result.skipped.length} left for somebody to read: ${
                [...new Set(result.skipped.map((s) => s.because))].join(' ')
              }`
            );
            queueChanged();
            bump((n) => n + 1);
          }}
        >
          Approve the {routine.length} routine {routine.length === 1 ? 'one' : 'ones'}
        </button>
        <button
          type="button"
          className="btn-secondary ccrm-button"
          onClick={() => {
            rerunAgents(viewState.workspaceId);
            bump((n) => n + 1);
          }}
        >
          Run the agents again
        </button>
        <button
          type="button"
          className="btn-secondary ccrm-button"
          onClick={() => {
            resetQueue(viewState.workspaceId);
            bump((n) => n + 1);
          }}
        >
          Put the queue back
        </button>
      </div>

      {batchNote ? (
        <p className="ccrm-write-result" role="status">
          {batchNote}
        </p>
      ) : null}

      <h3 className="ccrm-group-title">
        Need you to read them
        <span className="ccrm-stage-count">{needsReading.length}</span>
      </h3>
      {needsReading.length === 0 ? (
        <p className="ccrm-panel-empty">Nothing is waiting that needs reading on its own.</p>
      ) : (
        <ul className="ccrm-item-list">
          {needsReading.map((entry) => (
            <Row key={entry.proposal.id} entry={entry} linkTo={linkTo} />
          ))}
        </ul>
      )}

      <h3 className="ccrm-group-title">
        Routine
        <span className="ccrm-stage-count">{routine.length}</span>
      </h3>
      <p className="ccrm-field-hint">
        Reversible, no message to anybody, and no source carrying anything addressed to software.
        These are what approve-all covers.
      </p>
      {routine.length === 0 ? (
        <p className="ccrm-panel-empty">Nothing routine is waiting.</p>
      ) : (
        <ul className="ccrm-item-list">
          {routine.map((entry) => (
            <Row key={entry.proposal.id} entry={entry} linkTo={linkTo} />
          ))}
        </ul>
      )}

      {decided.length > 0 ? (
        <>
          <h3 className="ccrm-group-title">
            Already decided
            <span className="ccrm-stage-count">{decided.length}</span>
          </h3>
          <ul className="ccrm-item-list">
            {decided.map((entry) => (
              <Row key={entry.proposal.id} entry={entry} linkTo={linkTo} />
            ))}
          </ul>
        </>
      ) : null}

      <section className="ccrm-panel" aria-labelledby="pq-agents">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="pq-agents">
              The ten agents
            </h3>
            <p className="ccrm-panel-description">
              Each one reads records and writes proposals. None of them writes a customer record,
              sends anything, or merges anything, and there is no code path by which one could.
            </p>
          </div>
        </div>
        <dl className="ccrm-facts ccrm-agent-list">
          {(Object.keys(AGENT_LABELS) as (keyof typeof AGENT_LABELS)[]).map((agent) => (
            <div key={agent}>
              <dt>{AGENT_LABELS[agent]}</dt>
              <dd>{AGENT_PURPOSES[agent]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </Stage4Scaffold>
  );
};
