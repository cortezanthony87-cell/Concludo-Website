/**
 * Clear Backlog.
 *
 * The one place in the module that shows a person a single thread at a time and
 * asks them to decide. Everything else is a list; this is a queue with a
 * cursor.
 *
 * Four things this page refuses to do, each for a reason:
 *
 * It does not count down. "Item 4 of 25" is a position, not a target, and
 * nothing anywhere says how far behind anyone is. The progress line reports
 * what has been decided, in the words of the decisions.
 *
 * It does not decide anything itself. Every one of the eight states is a button
 * a person presses. There is no "accept all", no automatic classification of
 * the remainder and no default selection, because a default on a screen like
 * this is a decision made by whoever was last to press Enter.
 *
 * It does not act. Each recorded decision is a note in the session. The two
 * states that point at an external system, a drafted reply and an approval, go
 * through the approval gate, which refuses everything but saving a draft, and
 * refuses that too until the capability is on and a mailbox is connected.
 *
 * It does not lose work. The session is written to this browser after every
 * decision, so closing the tab and coming back resumes where it stopped. What
 * is stored is the selection, the thread ids and the decisions. The analysis is
 * rebuilt, because a stored summary goes stale and a resumed session showing a
 * stale summary is worse than no session at all.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useOutletContext } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CircleHelp,
  Layers,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import {
  AccountBadge,
  BandBadge,
  ConfidenceChip,
  DateChip,
  Field,
  StatusBadge,
  WarningBlock,
  NoticeBlock,
} from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { BACKLOG_PRESETS, parsePreset } from '../../lib/email/viewLinks';
import {
  BACKLOG_STATES,
  BATCH_SIZE_OPTIONS,
  BacklogBatchSize,
  BacklogProgressState,
  BacklogSelection,
  BacklogSession,
  DEFAULT_BACKLOG_SELECTION,
  EXCLUSION_LABEL,
  buildBacklogBatch,
  clearStoredSession,
  decisionFor,
  goBack,
  loadStoredSession,
  pauseSession,
  progressOf,
  recordDecision,
  resolvedBatchSize,
  resumeSession,
  saveStoredSession,
  skipCurrent,
  startSession,
} from '../../lib/email/backlog';
import { EMAIL_FOLDERS } from '../../lib/email/moduleNav';
import { PriorityBand, ThreadStatus } from '../../lib/email/model';

/** Icon by lucide name, so the state definitions stay data. */
const STATE_ICON: Record<BacklogProgressState, React.FC<{ size?: number }>> = {
  reviewed: ListChecks,
  reply_drafted: ListChecks,
  approved: ListChecks,
  waiting: ListChecks,
  deferred: ListChecks,
  no_action: ListChecks,
  manual_review: CircleHelp,
  security_review: ShieldAlert,
};

export const EmailClearBacklogPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state } = useViewData(accountId);

  // A list can hand its threads here with `?preset=`. The preset only ticks a
  // box this page already offers, and the box stays visible and changeable.
  const location = useLocation();
  const preset = useMemo(() => parsePreset(location.search), [location.search]);
  const [selection, setSelection] = useState<BacklogSelection>({
    ...DEFAULT_BACKLOG_SELECTION,
    accountId,
    accountType,
    ...(preset ? { [BACKLOG_PRESETS[preset].flag]: true } : {}),
  });
  const [session, setSession] = useState<BacklogSession | null>(null);
  const [storageWorks, setStorageWorks] = useState(true);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  // A paused session from an earlier visit is offered, never resumed silently.
  // Being dropped into the middle of a queue you did not start is disorienting.
  const [resumable, setResumable] = useState<BacklogSession | null>(null);
  useEffect(() => {
    const stored = loadStoredSession(now);
    if (stored && stored.selection.accountId === accountId) setResumable(stored);
  }, [accountId, now]);

  const update = useCallback(<K extends keyof BacklogSelection>(key: K, value: BacklogSelection[K]) => {
    setSelection((s) => ({ ...s, [key]: value }));
  }, []);

  const batch = useMemo(
    () => buildBacklogBatch(records, { ...selection, accountId, accountType }, now),
    [records, selection, accountId, accountType, now]
  );

  const persist = useCallback((next: BacklogSession) => {
    setSession(next);
    const ok = saveStoredSession(next);
    setStorageWorks(ok);
  }, []);

  const begin = useCallback(() => {
    const next = startSession(batch, now);
    persist(next);
    setResumable(null);
    setAnnouncement(
      next.order.length === 0
        ? 'Nothing matched that selection. Adjust it and try again.'
        : `Started with ${next.order.length} item${next.order.length === 1 ? '' : 's'}. The first one is ready.`
    );
  }, [batch, now, persist]);

  const resume = useCallback(() => {
    if (!resumable) return;
    setSelection(resumable.selection);
    persist(resumeSession(resumable, now));
    setResumable(null);
    setAnnouncement('Resumed where you stopped. Your earlier decisions are still here.');
  }, [resumable, now, persist]);

  const discard = useCallback(() => {
    clearStoredSession();
    setResumable(null);
    setSession(null);
    setAnnouncement('That session has been cleared. Nothing in any mailbox was changed by it.');
  }, []);

  const progress = session ? progressOf(session) : null;

  // The record for the item in front of the person. Rebuilt from the current
  // analysis rather than read from the stored session.
  const current = useMemo(() => {
    if (!session || !progress?.currentThreadId) return null;
    const inBatch = batch.items.find((i) => i.threadId === progress.currentThreadId);
    if (inBatch) return inBatch;
    const record = records.find((r) => r.thread.id === progress.currentThreadId);
    return record
      ? {
          threadId: record.thread.id,
          record,
          position: session.order.indexOf(record.thread.id) + 1,
          groupKey: null,
          surfacedEarly: false,
          orderReason: 'Carried over from a paused session.',
        }
      : null;
  }, [session, progress, batch.items, records]);

  const decide = useCallback(
    (decision: BacklogProgressState) => {
      if (!session || !current) return;
      const next = recordDecision(session, current.threadId, decision, now);
      persist(next);
      const definition = BACKLOG_STATES.find((s) => s.state === decision)!;
      setAnnouncement(`${definition.label} recorded. ${definition.effect}`);
    },
    [session, current, now, persist]
  );

  /* ----------------------------------------------------------- set up */

  if (!session) {
    return (
      <ViewScaffold
      viewPath="/email/clear-backlog"
        title="Clear Backlog"
        description="Choose a set of threads and work through them one at a time. You can stop whenever you like and pick it up later."
        state={state}
        count={batch.totalMatched}
        countNoun={['thread matches this selection', 'threads match this selection']}
        emptyMessage="Nothing matches this selection."
        emptyNote="Widen the date range, or turn off one of the narrowing options."
        accountLabel={accountLabel}
        accountType={accountType}
      >
        <div aria-live="polite" className="ecc-visually-hidden">
          {announcement}
        </div>

        {resumable ? (
          <div className="content-card ecc-card ecc-resume-card" role="region" aria-label="Paused session">
            <h3 className="ecc-card-subject">You have a paused session</h3>
            <p className="ecc-card-summary">
              {progressOf(resumable).decided} of {resumable.order.length} decided, last touched{' '}
              {new Date(resumable.updatedAt).toLocaleString('en-AU', {
                timeZone: 'Australia/Melbourne',
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
              . Your decisions are kept in this browser only.
            </p>
            <div className="ecc-button-row">
              <button type="button" className="btn-primary ecc-bl-button" onClick={resume}>
                <Play size={14} aria-hidden="true" /> Carry on
              </button>
              <button type="button" className="btn-secondary ecc-bl-button" onClick={discard}>
                <RotateCcw size={14} aria-hidden="true" /> Clear it and start again
              </button>
            </div>
          </div>
        ) : null}

        <form
          className="content-card ecc-card ecc-backlog-setup"
          onSubmit={(event) => {
            event.preventDefault();
            begin();
          }}
        >
          <h3 className="ecc-card-subject">What do you want to work through?</h3>
          {preset ? (
            <p className="ecc-preset-note" role="note">
              Started from <strong>{BACKLOG_PRESETS[preset].label}</strong>. The matching box below
              is already ticked. Change it if you want a wider set.
            </p>
          ) : null}

          <div className="ecc-field-grid">
            <label className="ecc-labelled-control">
              <span>Account</span>
              <input type="text" value={accountLabel} readOnly aria-readonly="true" />
              <span className="ecc-control-note">
                The account comes from the header. Work and personal are never combined.
              </span>
            </label>

            <label className="ecc-labelled-control">
              <span>Account type</span>
              <input type="text" value={accountType === 'work' ? 'Work' : 'Personal'} readOnly aria-readonly="true" />
            </label>

            <label className="ecc-labelled-control" htmlFor="ecc-bl-folder">
              <span>Folder or label</span>
              <select
                id="ecc-bl-folder"
                value={selection.folder}
                onChange={(e) => update('folder', e.target.value)}
              >
                {EMAIL_FOLDERS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="ecc-labelled-control" htmlFor="ecc-bl-range">
              <span>Date range</span>
              <select
                id="ecc-bl-range"
                value={selection.dateRange.preset}
                onChange={(e) =>
                  update('dateRange', {
                    ...selection.dateRange,
                    preset: e.target.value as BacklogSelection['dateRange']['preset'],
                  })
                }
              >
                <option value="any">Any date</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="older_than_30d">Older than 30 days</option>
                <option value="custom">Between two dates</option>
              </select>
            </label>

            {selection.dateRange.preset === 'custom' ? (
              <>
                <label className="ecc-labelled-control" htmlFor="ecc-bl-from">
                  <span>From</span>
                  <input
                    id="ecc-bl-from"
                    type="date"
                    value={(selection.dateRange.from ?? '').slice(0, 10)}
                    onChange={(e) =>
                      update('dateRange', {
                        ...selection.dateRange,
                        from: e.target.value ? `${e.target.value}T00:00:00+11:00` : undefined,
                      })
                    }
                  />
                </label>
                <label className="ecc-labelled-control" htmlFor="ecc-bl-to">
                  <span>To</span>
                  <input
                    id="ecc-bl-to"
                    type="date"
                    value={(selection.dateRange.to ?? '').slice(0, 10)}
                    onChange={(e) =>
                      update('dateRange', {
                        ...selection.dateRange,
                        to: e.target.value ? `${e.target.value}T23:59:59+11:00` : undefined,
                      })
                    }
                  />
                </label>
              </>
            ) : null}

            <label className="ecc-labelled-control" htmlFor="ecc-bl-people">
              <span>Priority people</span>
              <input
                id="ecc-bl-people"
                type="text"
                placeholder="Addresses, separated by commas"
                value={selection.priorityPeople.join(', ')}
                onChange={(e) =>
                  update(
                    'priorityPeople',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
              />
              <span className="ecc-control-note">
                Leave this empty for everyone. Nobody is ranked by how often they write to you.
              </span>
            </label>

            <label className="ecc-labelled-control" htmlFor="ecc-bl-batch">
              <span>Batch size</span>
              <select
                id="ecc-bl-batch"
                value={String(selection.batchSize)}
                onChange={(e) =>
                  update(
                    'batchSize',
                    (e.target.value === 'custom'
                      ? 'custom'
                      : Number(e.target.value)) as BacklogBatchSize
                  )
                }
              >
                {BATCH_SIZE_OPTIONS.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {selection.batchSize === 'custom' ? (
              <label className="ecc-labelled-control" htmlFor="ecc-bl-custom">
                <span>How many</span>
                <input
                  id="ecc-bl-custom"
                  type="number"
                  min={1}
                  max={200}
                  value={selection.customBatchSize ?? 25}
                  onChange={(e) => update('customBatchSize', Number(e.target.value))}
                />
                <span className="ecc-control-note">Between 1 and 200.</span>
              </label>
            ) : null}
          </div>

          <fieldset className="ecc-checkbox-set">
            <legend>Narrow it further</legend>
            {(
              [
                ['unreadOnly', 'Unread messages only'],
                ['unresolvedOnly', 'Unresolved threads only'],
                ['awaitingReplyOnly', 'Only threads awaiting a reply from me'],
                ['withDeadlineOnly', 'Only threads with a date in them'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="ecc-checkbox">
                <input
                  type="checkbox"
                  checked={Boolean(selection[key])}
                  onChange={(e) => update(key, e.target.checked as BacklogSelection[typeof key])}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>

          <p className="ecc-legend-note">
            {batch.totalMatched} thread{batch.totalMatched === 1 ? '' : 's'} match. The first{' '}
            {resolvedBatchSize(selection)} would be in this batch, highest consequence first.
          </p>

          <div className="ecc-button-row">
            <button type="submit" className="btn-primary ecc-bl-button" disabled={batch.isEmpty}>
              <Play size={14} aria-hidden="true" /> Start
            </button>
          </div>

          {!storageWorks ? (
            <NoticeBlock tone="caution" title="This browser is not keeping the session">
              You can still work through the batch, but closing the tab will lose the decisions
              recorded in it. Nothing in any mailbox is affected either way.
            </NoticeBlock>
          ) : null}
        </form>
      </ViewScaffold>
    );
  }

  /* ---------------------------------------------------------- finished */

  if (progress && (progress.status === 'complete' || !current)) {
    return (
      <ViewScaffold
      viewPath="/email/clear-backlog"
        title="Clear Backlog"
        description="This batch is finished. Here is what you decided."
        state={state}
        count={progress.total}
        countNoun={['item in this batch', 'items in this batch']}
        emptyMessage="Nothing was in this batch."
        accountLabel={accountLabel}
        accountType={accountType}
      >
        <div aria-live="polite" className="ecc-visually-hidden">
          {announcement}
        </div>
        <div className="content-card ecc-card">
          <h3 className="ecc-card-subject">What you decided</h3>
          <ul className="ecc-summary-list">
            {BACKLOG_STATES.filter((s) => progress.byState[s.state] > 0).map((s) => (
              <li key={s.state}>
                <strong>{progress.byState[s.state]}</strong> {s.label.toLowerCase()}
              </li>
            ))}
          </ul>
          <p className="ecc-card-summary">
            Nothing was sent, archived, deleted or filed. Every line above is a note in this
            session.
          </p>
          <div className="ecc-button-row">
            <button
              type="button"
              className="btn-primary ecc-bl-button"
              onClick={() => {
                clearStoredSession();
                setSession(null);
                setAnnouncement('Ready for another batch.');
              }}
            >
              Choose another batch
            </button>
          </div>
        </div>

        {batch.excluded.length > 0 ? (
          <div className="content-card ecc-card">
            <h3 className="ecc-card-subject">What was left out, and why</h3>
            <ul className="ecc-summary-list">
              {batch.excluded.map((e) => (
                <li key={e.reason}>
                  <strong>{e.threadIds.length}</strong> {EXCLUSION_LABEL[e.reason].toLowerCase()}
                </li>
              ))}
            </ul>
            <p className="ecc-card-summary">
              Nothing here was deleted or hidden. All of it is still in All Email.
            </p>
          </div>
        ) : null}
      </ViewScaffold>
    );
  }

  /* ------------------------------------------------------------ review */

  const r = current!.record;
  const decision = decisionFor(session, current!.threadId);
  const group = current!.groupKey
    ? batch.groups.find((g) => g.key === current!.groupKey)
    : undefined;
  const paused = session.status === 'paused';

  return (
    <ViewScaffold
      viewPath="/email/clear-backlog"
      title="Clear Backlog"
      description="One at a time, highest consequence first. Stop whenever you like."
      state={state}
      count={progress!.total}
      countNoun={['item in this batch', 'items in this batch']}
      emptyMessage="Nothing left in this batch."
      accountLabel={accountLabel}
      accountType={accountType}
      controls={
        <div className="ecc-backlog-bar">
          <p className="ecc-legend-note">
            Item {current!.position} of {progress!.total}. {progress!.decided} decided,{' '}
            {progress!.remaining} still open.
          </p>
          <div className="ecc-button-row">
            <button
              type="button"
              className="btn-secondary ecc-bl-button"
              onClick={() => {
                persist(goBack(session, now));
                setAnnouncement('Moved back one item.');
              }}
              disabled={session.cursor === 0}
            >
              <ArrowLeft size={14} aria-hidden="true" /> Back
            </button>
            <button
              type="button"
              className="btn-secondary ecc-bl-button"
              onClick={() => {
                persist(skipCurrent(session, now));
                setAnnouncement('Skipped without deciding. It stays on the list.');
              }}
            >
              <ArrowRight size={14} aria-hidden="true" /> Skip for now
            </button>
            <button
              type="button"
              className="btn-secondary ecc-bl-button"
              onClick={() => {
                persist(paused ? resumeSession(session, now) : pauseSession(session, now));
                setAnnouncement(
                  paused ? 'Carrying on.' : 'Paused. Your decisions are kept in this browser.'
                );
              }}
            >
              {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
              {paused ? ' Carry on' : ' Pause'}
            </button>
          </div>
        </div>
      }
    >
      <div aria-live="polite" className="ecc-visually-hidden">
        {announcement}
      </div>

      {paused ? (
        <NoticeBlock tone="info" title="Paused">
          Nothing is lost. Press Carry on when you are ready, or close the tab and come back. The
          session is kept in this browser for up to seven days.
        </NoticeBlock>
      ) : null}

      <article className="content-card ecc-card ecc-backlog-item" aria-labelledby="ecc-bl-subject">
        <div className="ecc-card-top">
          <div className="ecc-card-identity">
            <p className="ecc-card-sender">{r.counterpartyName}</p>
            <h3 id="ecc-bl-subject" className="ecc-card-subject">
              {r.thread.subject}
            </h3>
          </div>
          <div className="ecc-card-badges">
            <AccountBadge accountType={accountType} label={accountLabel} />
            <StatusBadge status={r.analysis.currentStatus as ThreadStatus} />
            <BandBadge band={r.analysis.priorityBand as PriorityBand} score={r.analysis.priorityScore} />
          </div>
        </div>

        {r.analysis.securityAlert ? (
          <WarningBlock
            kind="security"
            text={r.analysis.securityAlert.explanation}
            check={r.analysis.securityAlert.recommendedCheck}
          />
        ) : null}

        <p className="ecc-order-reason">{current!.orderReason}</p>

        {group ? (
          <p className="ecc-group-note" role="note">
            <Layers size={13} aria-hidden="true" /> {group.reason} {group.threadIds.length} threads
            in this group.
          </p>
        ) : null}

        <p className="ecc-card-summary">{r.analysis.oneLineSummary}</p>

        <Field label="Why it matters">{r.analysis.whyItMatters}</Field>
        <Field label="Recommended next step">
          {r.analysis.recommendedNextStep}{' '}
          <ConfidenceChip confidence={r.analysis.confidence} what="this recommendation" />
        </Field>

        <div className="ecc-card-meta">
          <DateChip
            dueAt={r.nextStatedDeadline ?? r.nextAnyDeadline}
            origin={r.nextStatedDeadline ? 'explicit_email' : 'suggested'}
          />
          <a className="ecc-inline-link" href={linkTo(`/email/thread/${r.thread.id}`)}>
            Open the full thread and its sources
          </a>
        </div>

        {decision ? (
          <p className="ecc-decision-note" role="status">
            Recorded: <strong>{BACKLOG_STATES.find((s) => s.state === decision.state)!.label}</strong>.
            You can change it while this batch is open.
          </p>
        ) : null}

        <fieldset className="ecc-decision-set">
          <legend>What do you want to do with this one?</legend>
          <div className="ecc-decision-grid">
            {BACKLOG_STATES.map((s) => {
              const StateIcon = STATE_ICON[s.state];
              return (
                <button
                  key={s.state}
                  type="button"
                  className={`ecc-decision-button ${decision?.state === s.state ? 'is-chosen' : ''}`}
                  onClick={() => decide(s.state)}
                  aria-pressed={decision?.state === s.state}
                >
                  <span className="ecc-decision-label">
                    <StateIcon size={14} aria-hidden="true" /> {s.label}
                  </span>
                  <span className="ecc-decision-meaning">{s.meaning}</span>
                  <span className="ecc-decision-effect">{s.effect}</span>
                </button>
              );
            })}
          </div>
        </fieldset>
      </article>
    </ViewScaffold>
  );
};
