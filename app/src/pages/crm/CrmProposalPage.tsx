/**
 * One proposal, with the eleven things it has to explain.
 *
 * In the same order, every time, with the same headings. Somebody working
 * through forty of these should never have to hunt for the part they care
 * about, and should never have to wonder whether a missing heading means
 * "nothing to say" or "nobody checked": an empty section says which.
 *
 * The six decisions are all here, and five of them are one press. Approve is
 * the one that takes an extra step, which is the right way round.
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Mail, ShieldAlert } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import { RolePicker, WriteNotice, useCrmWrite } from '../../components/crm/Stage5Pieces';
import { Value } from '../../components/crm/viewPrimitives';
import { AGENT_LABELS } from '../../lib/crm/stage7/contract';
import {
  approve,
  batchable,
  defer,
  diffOf,
  editProposal,
  entryFor,
  reject,
  requestMoreInformation,
} from '../../lib/crm/stage7/queue';
import { CRM_SESSION_NOW, queueChanged, sessionQueue } from '../../lib/crm/stage7/session';
import { injectionNotice } from '../../lib/crm/stage7/untrusted';

const Section: React.FC<{
  heading: string;
  items: string[];
  emptyMessage: string;
  tone?: 'plain' | 'warn';
}> = ({ heading, items, emptyMessage, tone = 'plain' }) => (
  <section className="ccrm-explain">
    <h4 className="ccrm-explain-heading">{heading}</h4>
    {items.length === 0 ? (
      <p className="ccrm-plan-empty">{emptyMessage}</p>
    ) : (
      <ul className={`ccrm-plain-list ${tone === 'warn' ? 'ccrm-plain-list-warn' : ''}`}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    )}
  </section>
);

export const CrmProposalPage: React.FC = () => {
  const { viewState, linkTo } = useStage4();
  const { proposalId } = useParams<{ proposalId: string }>();
  const write = useCrmWrite();
  const [, bump] = React.useState(0);
  const [note, setNote] = React.useState('');
  const [question, setQuestion] = React.useState('');
  const [selected, setSelected] = React.useState<Set<string> | null>(null);
  const [result, setResult] = React.useState<string | null>(null);

  const state = sessionQueue(viewState.workspaceId);
  const entry = proposalId ? entryFor(state, proposalId) : null;

  if (!entry) {
    return (
      <Stage4Scaffold
        title="That proposal is not in this workspace"
        description="Nothing is shown, because nothing here would be about the proposal you asked for."
        loadingLabel="the proposal"
        emptyTitle=""
        emptyBody=""
        resultCount={1}
        totalCount={1}
      >
        <p className="ccrm-panel-empty">
          <Link className="ccrm-text-link" to={linkTo('/crm/proposals')}>
            Back to the queue
          </Link>
        </p>
      </Stage4Scaffold>
    );
  }

  const proposal = entry.proposal;
  const rows = diffOf(entry);
  const check = batchable(entry);
  const injection = injectionNotice(
    proposal.injectionFlags.map((what) => ({ what, excerpt: '', aimedAt: 'unclear' as const }))
  );

  const decided = proposal.state !== 'awaiting_confirmation' && proposal.state !== 'deferred';
  const keys = selected ?? new Set(rows.map((row) => row.key));

  const act = (fn: () => { ok: boolean; because: string | null }) => {
    const outcome = fn();
    setResult(outcome.ok ? 'Recorded, with an audit entry.' : (outcome.because ?? 'Refused.'));
    queueChanged();
    bump((n) => n + 1);
  };

  return (
    <Stage4Scaffold
      title={proposal.proposes}
      description={`${AGENT_LABELS[proposal.agent]} agent. Nothing here has happened.`}
      loadingLabel="the proposal"
      emptyTitle=""
      emptyBody=""
      resultCount={1}
      totalCount={1}
      toolbar={<RolePicker />}
    >
      <WriteNotice />

      <Link className="ccrm-back-link" to={linkTo('/crm/proposals')}>
        Back to the queue
      </Link>

      {injection ? (
        <p className="ccrm-injection-notice" role="note">
          <ShieldAlert size={14} aria-hidden="true" />
          {injection}
        </p>
      ) : null}

      {!entry.validity.valid ? (
        <p className="ccrm-before-contact" role="alert">
          {entry.validity.message}
          {entry.validity.reasons.length > 0 ? (
            <span className="ccrm-reason-text">
              {entry.validity.reasons
                .map((reason) => `${reason.part}: was "${reason.was}", now "${reason.now}"`)
                .join('. ')}
            </span>
          ) : null}
        </p>
      ) : null}

      {/* ---------------- the eleven things ---------------- */}
      <section className="ccrm-panel" aria-labelledby="pr-explain">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="pr-explain">
              What this is
            </h3>
          </div>
        </div>

        <div className="ccrm-explain-grid">
          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">1. What it observed</h4>
            <p className="ccrm-plan-entry-body">{proposal.observed}</p>
          </section>

          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">
              2. Which records it used
              <span className="ccrm-stage-count">{proposal.sources.length}</span>
            </h4>
            <ul className="ccrm-plain-list">
              {proposal.sources.map((source) => (
                <li key={`${source.table}-${source.id}`}>
                  {source.path ? (
                    <Link className="ccrm-text-link" to={linkTo(source.path)}>
                      {source.label}
                    </Link>
                  ) : (
                    source.label
                  )}
                  {source.quote ? (
                    <span className="ccrm-source-quote">&ldquo;{source.quote}&rdquo;</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">3. What it proposes</h4>
            <p className="ccrm-plan-entry-body">{proposal.proposes}</p>
          </section>

          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">
              4. What would change
              <span className="ccrm-stage-count">{rows.length}</span>
            </h4>
            {rows.length === 0 ? (
              <p className="ccrm-plan-empty">
                Nothing. This proposal is something to read, not a change to a record.
              </p>
            ) : (
              <table className="ccrm-table ccrm-diff-table">
                <thead>
                  <tr>
                    <th scope="col">Include</th>
                    <th scope="col">Record and field</th>
                    <th scope="col">Now</th>
                    <th scope="col">Would become</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key}>
                      <td>
                        <label className="ccrm-check">
                          <input
                            type="checkbox"
                            checked={keys.has(row.key)}
                            disabled={decided}
                            onChange={(event) => {
                              const next = new Set(keys);
                              if (event.target.checked) next.add(row.key);
                              else next.delete(row.key);
                              setSelected(next);
                            }}
                          />
                          <span className="ccrm-visually-hidden">
                            Include {row.field} in the approval
                          </span>
                        </label>
                      </td>
                      <th scope="row">
                        {row.table.replace('crm_', '').replace(/_/g, ' ')}.{row.field}
                      </th>
                      <td>{row.from}</td>
                      <td>{row.to}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">5. Whether anything leaves Concludo</h4>
            {proposal.externalAction.kind === 'none' ? (
              <p className="ccrm-plan-entry-body">{proposal.externalAction.note}</p>
            ) : (
              <div className="ccrm-draft">
                <p className="ccrm-draft-note">
                  <Mail size={13} aria-hidden="true" />
                  {proposal.externalAction.note}
                </p>
                <dl className="ccrm-facts">
                  <div>
                    <dt>To</dt>
                    <dd>
                      {proposal.externalAction.recipients.length === 0 ? (
                        <span className="ccrm-absent">Nobody</span>
                      ) : (
                        proposal.externalAction.recipients.join(', ')
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt>Subject</dt>
                    <dd>
                      <Value value={proposal.externalAction.subject} absent="None" />
                    </dd>
                  </div>
                  <div>
                    <dt>Attachments</dt>
                    <dd>
                      {proposal.externalAction.attachments.length === 0
                        ? 'None'
                        : proposal.externalAction.attachments.join(', ')}
                    </dd>
                  </div>
                </dl>
                {proposal.externalAction.body ? (
                  <pre className="ccrm-draft-body">{proposal.externalAction.body}</pre>
                ) : null}
              </div>
            )}
          </section>

          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">6. Confidence</h4>
            <p className="ccrm-plan-entry-body">
              {proposal.confidence}. In words, never a percentage: a number here would be read as a
              measurement of something nobody measured.
            </p>
          </section>

          <Section
            heading="7. What it assumed"
            items={proposal.assumptions}
            emptyMessage="Nothing. Everything above comes from a record."
          />
          <Section
            heading="8. What disagrees with it"
            items={proposal.conflicts}
            emptyMessage="Nothing in the records contradicts this."
            tone="warn"
          />
          <Section
            heading="9. What it did not have"
            items={proposal.missingInformation}
            emptyMessage="Nothing it needed was missing."
          />
          <Section
            heading="10. What happens if you approve it"
            items={proposal.consequences}
            emptyMessage="Nothing beyond the change above."
          />

          <section className="ccrm-explain">
            <h4 className="ccrm-explain-heading">11. Who can approve it</h4>
            <p className="ccrm-plan-entry-body">
              {proposal.approval.role.replace('crm_', '')}. {proposal.approval.because}
            </p>
            {proposal.approval.individualOnly ? (
              <p className="ccrm-field-hint">
                <AlertTriangle size={12} aria-hidden="true" /> This one is never part of an
                approve-all. {check.because}
              </p>
            ) : null}
          </section>
        </div>
      </section>

      {/* ---------------- the decisions ---------------- */}
      <section className="ccrm-panel" aria-labelledby="pr-decide">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="pr-decide">
              What do you want to do
            </h3>
            <p className="ccrm-panel-description">
              {decided
                ? `This was ${proposal.state.replace(/_/g, ' ')}.`
                : 'Nothing has happened yet. Every one of these is recorded with your name against it.'}
            </p>
          </div>
        </div>

        <div className="ccrm-field">
          <label className="ccrm-field-label" htmlFor="pr-note">
            A note <span className="ccrm-optional">optional for approving, required for rejecting</span>
          </label>
          <input
            id="pr-note"
            className="form-input"
            value={note}
            disabled={decided}
            onChange={(event) => setNote(event.target.value)}
          />
        </div>

        <div className="ccrm-capture-actions">
          <button
            type="button"
            className="btn-secondary ccrm-button ccrm-button-primary"
            disabled={decided}
            onClick={() =>
              act(() =>
                approve(entry, write.context.userId, CRM_SESSION_NOW, {
                  changeKeys: [...keys],
                  note: note || null,
                  role: write.role,
                })
              )
            }
          >
            {keys.size === rows.length
              ? 'Approve it'
              : `Approve the ${keys.size} selected ${keys.size === 1 ? 'change' : 'changes'}`}
          </button>

          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={decided}
            onClick={() => act(() => reject(entry, write.context.userId, CRM_SESSION_NOW, note))}
          >
            Reject it
          </button>

          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={decided}
            onClick={() =>
              act(() => defer(entry, write.context.userId, CRM_SESSION_NOW, note || null))
            }
          >
            Defer it
          </button>

          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={decided || rows.length === 0}
            onClick={() =>
              act(() =>
                editProposal(
                  entry,
                  write.context.userId,
                  CRM_SESSION_NOW,
                  (p) => {
                    // A worked example of an edit: the first change is left as
                    // it is, and the note records that a person touched it. Any
                    // existing approval is invalidated by this, by construction.
                    p.observed = `${p.observed} Edited by a person before approval.`;
                  },
                  note || null
                )
              )
            }
          >
            Edit it
          </button>
        </div>

        <div className="ccrm-field">
          <label className="ccrm-field-label" htmlFor="pr-question">
            Ask for more information <span className="ccrm-required">required to send it back</span>
          </label>
          <input
            id="pr-question"
            className="form-input"
            value={question}
            disabled={decided}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            type="button"
            className="btn-secondary ccrm-button"
            disabled={decided || question.trim().length === 0}
            onClick={() =>
              act(() =>
                requestMoreInformation(entry, write.context.userId, CRM_SESSION_NOW, question)
              )
            }
          >
            Send it back
          </button>
        </div>

        {result ? (
          <p className="ccrm-write-result" role="status">
            {result}
          </p>
        ) : null}
      </section>

      {/* ---------------- the history ---------------- */}
      <section className="ccrm-panel" aria-labelledby="pr-history">
        <div className="ccrm-panel-head">
          <div>
            <h3 className="ccrm-panel-title" id="pr-history">
              Everything that happened to this proposal
            </h3>
            <p className="ccrm-panel-description">
              Append only. Nothing here can be edited, including by the person who wrote it.
            </p>
          </div>
        </div>
        <ul className="ccrm-plain-list">
          {entry.history.map((event, index) => (
            <li key={`${event.at}-${index}`}>
              <strong>{event.decision.replace(/_/g, ' ')}</strong> by {event.by} on{' '}
              {event.at.slice(0, 10)}.{event.note ? ` ${event.note}` : ''}
              {event.changeKeys ? ` Covered ${event.changeKeys.length} of ${rows.length}.` : ''}
            </li>
          ))}
        </ul>

        {entry.approval ? (
          <p className="ccrm-field-hint">
            The approval is bound to a fingerprint of exactly what was approved. If any record,
            field, value, recipient, body, attachment, source, account or external action changes,
            it stops holding and nothing is applied.
          </p>
        ) : null}
      </section>
    </Stage4Scaffold>
  );
};
