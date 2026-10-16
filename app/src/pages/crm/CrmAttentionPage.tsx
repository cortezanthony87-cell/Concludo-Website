/**
 * Attention: which accounts have unanswered questions against them.
 *
 * This is the page the product exists to answer the first question of, and it
 * is arranged around three decisions.
 *
 * THE CONDITIONS ARE THE CONTENT. The number beside an account is how many of
 * eleven named conditions are true of it. It is deliberately small on the
 * page, and the sentences are large, because the number is a way of ordering
 * the list and the sentences are the thing somebody acts on. A page that led
 * with the figure would train people to read the figure.
 *
 * EVERY SENTENCE SHOWS ITS RECORDS. A condition that cannot be checked is a
 * condition people learn to distrust and then to ignore, so every signal
 * carries the records it was read from and they are one click away.
 *
 * WHAT CANNOT BE JUDGED IS SAID, NOT HIDDEN. An account with no renewal date
 * does not have a renewal that is far away. It has a renewal nobody knows
 * about, and a page that showed nothing would report that as healthy. The
 * conditions that could not be assessed are shown, folded away, with the
 * reason for each.
 *
 * NOTHING HERE IS ABOUT A PERSON. No owner column, no filter by owner, no
 * count per person, and the standing note says so in the words the module
 * uses everywhere else.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Stage4Scaffold, useStage4 } from '../../components/crm/Stage4Scaffold';
import {
  RolePicker,
  WriteNotice,
  WriteResultLine,
  useCrmWrite,
} from '../../components/crm/Stage5Pieces';
import { AttentionCondition } from '../../lib/crm/domain';
import {
  AccountAttention,
  CONDITION_PURPOSE,
  Signal,
  workspaceAttention,
} from '../../lib/crm/phase2/signals';
import { decideSignal, restoreSignal } from '../../lib/crm/phase2/signalWrites';

const EVIDENCE_PATHS: Record<string, (id: string) => string | null> = {
  crm_organisations: (id) => `/crm/organisations/${id}`,
  crm_people: (id) => `/crm/people/${id}`,
  crm_work_items: (id) => `/crm/work/${id}`,
  crm_account_plans: () => '/crm/account-plans',
  crm_account_reviews: () => '/crm/account-plans',
  crm_service_cases: () => '/crm/service',
  crm_commitments: () => '/crm/commitments',
  crm_activities: () => '/crm/activities',
};

const EVIDENCE_WORDS: Record<string, string> = {
  crm_organisations: 'organisation',
  crm_people: 'contact',
  crm_work_items: 'work',
  crm_account_plans: 'account plan',
  crm_account_reviews: 'review',
  crm_service_cases: 'service case',
  crm_commitments: 'commitment',
  crm_activities: 'conversation',
};

/* ------------------------------------------------------- one condition */

const SignalRow: React.FC<{
  signal: Signal;
  linkTo: (p: string) => string;
  onDecide: (signal: Signal, reason: string) => void;
  onRestore: (signal: Signal, reason: string) => void;
  canWrite: boolean;
}> = ({ signal, linkTo, onDecide, onRestore, canWrite }) => {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');

  const dismissed = signal.decision?.state === 'dismissed';
  const fieldId = `dismiss-${signal.organisationId}-${signal.condition}`;

  return (
    <li className={`ccrm-signal${dismissed ? ' ccrm-signal-dismissed' : ''}`}>
      <span className="ccrm-item">
        <span className="ccrm-item-main">
          <span className="ccrm-item-title">{signal.label}</span>
          <span className="ccrm-item-context">{signal.detail}</span>
          <span className="ccrm-flag-resolution">{signal.whatWouldClearIt}</span>

          {dismissed && signal.decision ? (
            <span className="ccrm-reason-text">
              Dismissed: {signal.decision.reason} It comes back on{' '}
              {signal.decision.expiresAt?.slice(0, 10) ?? 'no recorded date'}.
            </span>
          ) : null}

          <span className="ccrm-signal-controls">
            <button
              type="button"
              className="ccrm-text-link ccrm-disclosure-button"
              aria-expanded={open}
              onClick={() => setOpen((was) => !was)}
            >
              {open ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
              {open
                ? 'Hide the records behind this'
                : `Show the ${signal.evidence.length} ${signal.evidence.length === 1 ? 'record' : 'records'} behind this`}
            </button>
          </span>

          {open ? (
            <>
              <ul className="ccrm-item-list ccrm-evidence-list">
                {signal.evidence.map((reference, index) => {
                  const path = EVIDENCE_PATHS[reference.table]?.(reference.id) ?? null;
                  const word = EVIDENCE_WORDS[reference.table] ?? reference.table;
                  return (
                    <li key={`${reference.table}-${reference.id}-${index}`}>
                      <span className="ccrm-item-context">
                        {path ? (
                          <Link className="ccrm-text-link" to={linkTo(path)}>
                            {word}
                          </Link>
                        ) : (
                          word
                        )}
                        : {reference.what}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {canWrite ? (
                dismissed && signal.decision ? (
                  <span className="ccrm-signal-decide">
                    <label className="ccrm-field-label" htmlFor={fieldId}>
                      Why put this back?
                    </label>
                    <input
                      id={fieldId}
                      className="form-control"
                      type="text"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="The renewal moved and this is live again."
                    />
                    <button
                      type="button"
                      className="btn btn-secondary ccrm-button"
                      onClick={() => {
                        onRestore(signal, reason);
                        setReason('');
                      }}
                    >
                      Put it back
                    </button>
                  </span>
                ) : (
                  <span className="ccrm-signal-decide">
                    <label className="ccrm-field-label" htmlFor={fieldId}>
                      Why does this not apply here?
                    </label>
                    <input
                      id={fieldId}
                      className="form-control"
                      type="text"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Handled by Priya in the March review."
                    />
                    <button
                      type="button"
                      className="btn btn-secondary ccrm-button"
                      onClick={() => {
                        onDecide(signal, reason);
                        setReason('');
                      }}
                    >
                      Dismiss for 90 days
                    </button>
                  </span>
                )
              ) : null}
            </>
          ) : null}
        </span>
      </span>
    </li>
  );
};

/* ------------------------------------------------------- one account */

const AccountCard: React.FC<{
  account: AccountAttention;
  linkTo: (p: string) => string;
  onDecide: (signal: Signal, reason: string) => void;
  onRestore: (signal: Signal, reason: string) => void;
  canWrite: boolean;
}> = ({ account, linkTo, onDecide, onRestore, canWrite }) => {
  const [showNotAssessable, setShowNotAssessable] = React.useState(false);

  return (
    <section className="ccrm-panel" aria-labelledby={`att-${account.organisation.id}`}>
      <div className="ccrm-panel-head">
        <div>
          <h3 className="ccrm-panel-title" id={`att-${account.organisation.id}`}>
            <Link
              className="ccrm-text-link"
              to={linkTo(`/crm/organisations/${account.organisation.id}`)}
            >
              {account.organisation.name}
            </Link>
          </h3>
          <p className="ccrm-panel-description">
            {account.attentionCount === 0
              ? 'None of the eleven conditions is true here.'
              : `${account.attentionCount} of eleven conditions ${account.attentionCount === 1 ? 'is' : 'are'} true here.`}
          </p>
        </div>
        <span className="ccrm-answer-count" aria-label={`${account.attentionCount} of eleven conditions`}>
          {account.attentionCount}
        </span>
      </div>

      {account.signals.length > 0 ? (
        <ul className="ccrm-item-list">
          {account.signals.map((signal) => (
            <SignalRow
              key={signal.condition}
              signal={signal}
              linkTo={linkTo}
              onDecide={onDecide}
              onRestore={onRestore}
              canWrite={canWrite}
            />
          ))}
        </ul>
      ) : (
        <p className="ccrm-panel-empty">Nothing is outstanding against this account.</p>
      )}

      {account.dismissed.length > 0 ? (
        <>
          <h4 className="ccrm-plan-section-title">
            Dismissed, and coming back
            <span className="ccrm-stage-count">{account.dismissed.length}</span>
          </h4>
          <ul className="ccrm-item-list">
            {account.dismissed.map((signal) => (
              <SignalRow
                key={signal.condition}
                signal={signal}
                linkTo={linkTo}
                onDecide={onDecide}
                onRestore={onRestore}
                canWrite={canWrite}
              />
            ))}
          </ul>
        </>
      ) : null}

      {account.notAssessable.length > 0 ? (
        <>
          <button
            type="button"
            className="ccrm-text-link ccrm-disclosure-button"
            aria-expanded={showNotAssessable}
            onClick={() => setShowNotAssessable((was) => !was)}
          >
            {showNotAssessable ? <ChevronDown size={12} aria-hidden="true" /> : <ChevronRight size={12} aria-hidden="true" />}
            {showNotAssessable
              ? 'Hide what could not be judged'
              : `${account.notAssessable.length} of the eleven could not be judged here`}
          </button>
          {showNotAssessable ? (
            <ul className="ccrm-flag-list">
              {account.notAssessable.map((entry) => (
                <li className="ccrm-flag" key={entry.condition}>
                  <span className="ccrm-flag-detail">{entry.because}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </section>
  );
};

/* ------------------------------------------------------- the page */

export const CrmAttentionPage: React.FC = () => {
  const { data, now, version, linkTo } = useStage4();
  const write = useCrmWrite();

  const [condition, setCondition] = React.useState<AttentionCondition | 'all'>('all');
  const [showClear, setShowClear] = React.useState(false);

  // `version` is in the dependencies on purpose. The session store mutates one
  // workspace in place, so `data` does not change identity when something is
  // written and a memo on `[data, now]` alone would show a stale list.
  const attention = React.useMemo(
    () => workspaceAttention(data, now),
    [data, now, version]
  );

  const canWrite = write.role !== 'crm_viewer';

  const shown = React.useMemo(() => {
    const withSomething = attention.accounts.filter((account) =>
      showClear ? true : account.attentionCount > 0
    );
    if (condition === 'all') return withSomething;
    return withSomething.filter((account) =>
      account.signals.some((signal) => signal.condition === condition)
    );
  }, [attention, condition, showClear]);

  const decide = (signal: Signal, reason: string) => {
    write.run('Dismissed.', (context, workspace) =>
      decideSignal(context, workspace, {
        organisationId: signal.organisationId,
        condition: signal.condition,
        state: 'dismissed',
        reason,
      })
    );
  };

  const restore = (signal: Signal, reason: string) => {
    if (!signal.decision) return;
    write.run('Put back.', (context, workspace) =>
      restoreSignal(context, workspace, signal.decision!.id, reason)
    );
  };

  return (
    <Stage4Scaffold
      title="Attention"
      description="Which accounts have unanswered questions against them, and which of eleven named conditions is true of each."
      loadingLabel="the attention list"
      emptyTitle="No organisation is recorded in this workspace yet"
      emptyBody="Accounts appear here with the conditions that are true of them as they are added."
      resultCount={shown.length}
      totalCount={attention.accounts.length}
      toolbar={<RolePicker />}
    >
      <WriteNotice />
      <WriteResultLine result={write.last} onClear={write.clearLast} />

      <p className="ccrm-not-ranked ccrm-policy" role="note">
        {attention.note}
      </p>

      <p className="ccrm-view-tenant">
        {attention.accountsNeedingAttention} of {attention.accounts.length}{' '}
        {attention.accounts.length === 1 ? 'account has' : 'accounts have'} at least one condition
        true. {attention.clear} {attention.clear === 1 ? 'has' : 'have'} none.
      </p>

      <h3 className="ccrm-group-title">The eleven conditions</h3>
      <p className="ccrm-section-description">
        Press one to see only the accounts it is true of. The count on each is accounts, never
        people.
      </p>

      <ul className="ccrm-card-rail">
        {attention.byCondition.map((entry) => (
          <li key={entry.condition}>
            <button
              type="button"
              className={`ccrm-card ccrm-card-button${condition === entry.condition ? ' ccrm-card-attention' : ''}`}
              aria-pressed={condition === entry.condition}
              onClick={() =>
                setCondition(condition === entry.condition ? 'all' : entry.condition)
              }
            >
              <span className="ccrm-card-count">{entry.count}</span>
              <span className="ccrm-card-label">{entry.label}</span>
              <span className="ccrm-card-note">{CONDITION_PURPOSE[entry.condition]}</span>
            </button>
          </li>
        ))}
      </ul>

      <h3 className="ccrm-group-title">
        {condition === 'all' ? 'Accounts' : attention.byCondition.find((e) => e.condition === condition)?.label}
        <span className="ccrm-stage-count">{shown.length}</span>
      </h3>

      <p className="ccrm-form-actions">
        <button
          type="button"
          className="ccrm-text-link ccrm-disclosure-button"
          aria-pressed={showClear}
          onClick={() => setShowClear((was) => !was)}
        >
          {showClear ? 'Hide accounts with nothing outstanding' : 'Also show accounts with nothing outstanding'}
        </button>
      </p>

      {shown.length === 0 ? (
        <p className="ccrm-panel-empty">
          {condition === 'all'
            ? 'No account in this workspace has any of the eleven conditions true.'
            : 'No account in this workspace has that condition true.'}
        </p>
      ) : (
        <div className="ccrm-panel-grid">
          {shown.map((account) => (
            <AccountCard
              key={account.organisation.id}
              account={account}
              linkTo={linkTo}
              onDecide={decide}
              onRestore={restore}
              canWrite={canWrite}
            />
          ))}
        </div>
      )}

      <p className="ccrm-policy" role="note">
        A dismissal lasts 90 days and then the condition comes back. A dismissal that never ended
        would quietly empty this page: a decision made in March about a renewal is not a decision
        about August. Where a condition genuinely does not apply, the thing to change is the record
        that makes it true, which every condition says above.
      </p>
    </Stage4Scaffold>
  );
};
