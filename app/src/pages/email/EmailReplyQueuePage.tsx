/**
 * Reply Queue.
 *
 * Threads where someone is waiting on an answer, with the prepared draft beside
 * what the sender actually asked for.
 *
 * Nothing on this page sends anything. There is no send control, because there
 * is no send. The draft is text for a person to read, change and use.
 */
import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { FilterChips } from '../../components/email/FilterChips';
import { ItemActions } from '../../components/email/ItemActions';
import {
  AccountBadge,
  BandBadge,
  StatusBadge,
  ConfidenceChip,
  DraftChip,
  WarningBlock,
  Field,
} from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { REPLY_FILTERS, ReplyFilterKey, replyQueueItems } from '../../lib/email/views';
import { DraftStyle, DRAFT_STYLE_LABEL, PriorityBand, ThreadStatus } from '../../lib/email/model';

const STYLES: readonly DraftStyle[] = ['concise', 'warm', 'detailed'];

export const EmailReplyQueuePage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { dataset, records, accountLabel, accountType, now, state } = useViewData(accountId);

  const [active, setActive] = useState<ReplyFilterKey[]>([]);
  const [style, setStyle] = useState<DraftStyle>('concise');

  const drafts = dataset?.drafts ?? [];
  const items = useMemo(
    () => replyQueueItems(records, drafts, now, active, style),
    [records, drafts, now, active, style]
  );

  // Counts come from each filter on its own, so a person can see what a chip
  // would give them before pressing it.
  const unfiltered = useMemo(() => replyQueueItems(records, drafts, now, [], style), [records, drafts, now, style]);
  const options = REPLY_FILTERS.map((f) => ({
    key: f.key,
    label: f.label,
    description: f.description,
    count: unfiltered.filter((i) => f.match(i.record, now)).length,
  }));

  const toggle = (key: ReplyFilterKey) =>
    setActive((a) => (a.includes(key) ? a.filter((x) => x !== key) : [...a, key]));

  return (
    <ViewScaffold
      title="Reply Queue"
      description="Someone is waiting on an answer from you. The draft is for your review; nothing is sent from here."
      state={state}
      count={items.length}
      emptyMessage={
        active.length > 0 ? 'No thread matches every filter you have chosen.' : 'Nobody is waiting on a reply from you.'
      }
      emptyNote={active.length > 0 ? 'Clear a filter to widen the list.' : undefined}
      accountLabel={accountLabel}
      accountType={accountType}
      controls={
        <>
          <FilterChips
            legend="Filter the reply queue"
            options={options}
            active={active}
            onToggle={toggle}
            onClear={() => setActive([])}
          />
          <fieldset className="ecc-style-picker">
            <legend className="ecc-chips-legend">Draft style</legend>
            <p className="ecc-chips-note">
              Three written drafts, not one draft with the adjectives changed. Compare the
              commitments, not just the tone.
            </p>
            <div className="ecc-chip-row">
              {STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ecc-chip ${style === s ? 'ecc-chip-on' : ''}`}
                  aria-pressed={style === s}
                  onClick={() => setStyle(s)}
                >
                  {DRAFT_STYLE_LABEL[s]}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      }
    >
      <ul className="ecc-card-list">
        {items.map((item) => {
          const r = item.record;
          const headingId = `ecc-reply-${r.thread.id}`;
          return (
            <li key={r.thread.id} className="content-card ecc-card" aria-labelledby={headingId}>
              <div className="ecc-card-top">
                <div className="ecc-card-identity">
                  <p className="ecc-card-sender">{r.counterpartyName}</p>
                  <h3 id={headingId} className="ecc-card-subject">
                    {r.thread.subject}
                  </h3>
                </div>
                <div className="ecc-card-badges">
                  <AccountBadge accountType={accountType} label={accountLabel} />
                  <BandBadge band={r.analysis.priorityBand as PriorityBand} score={r.analysis.priorityScore} />
                  <StatusBadge status={r.analysis.currentStatus as ThreadStatus} />
                </div>
              </div>

              {item.sensitive ? (
                <WarningBlock
                  kind="sensitive"
                  text="Classified sensitive. No draft is written for this thread, and its contents are not summarised into any shared view."
                />
              ) : null}

              <Field label="What the sender wants">{item.senderRequest}</Field>

              {item.openQuestions.length > 0 ? (
                <Field label={`Questions waiting on an answer (${item.openQuestions.length})`}>
                  <ul className="ecc-reason-list">
                    {item.openQuestions.map((q) => (
                      <li key={q.id}>
                        {q.question}
                        {q.blockedBy ? <em> Blocked by: {q.blockedBy}</em> : null}
                      </li>
                    ))}
                  </ul>
                </Field>
              ) : null}

              {item.recipients.length > 0 ? (
                <Field label="Recipients">
                  {item.recipients.map((p) => `${p.displayName} (${p.address})`).join(', ')}
                </Field>
              ) : null}

              <div className="ecc-draft-block">
                <div className="ecc-draft-head">
                  <DraftChip status={item.record.analysis.draftStatus} />
                  <ConfidenceChip confidence={item.confidence} what="this draft" />
                </div>

                {item.draftBody ? (
                  <>
                    <p className="ecc-draft-style-note">
                      {DRAFT_STYLE_LABEL[style]} version. Read it before you use it.
                    </p>
                    <pre className="ecc-draft-body" tabIndex={0} aria-label={`Proposed reply to ${r.thread.subject}`}>
                      {item.draftBody}
                    </pre>
                  </>
                ) : (
                  <p className="ecc-draft-withheld">
                    {item.draft?.statusReason ?? 'No draft has been written for this thread.'}
                  </p>
                )}

                {item.commitmentsInDraft.length > 0 ? (
                  <Field label="What this draft commits you to">
                    <ul className="ecc-reason-list ecc-commitments">
                      {item.commitmentsInDraft.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </Field>
                ) : null}

                {item.factsToVerify.length > 0 ? (
                  <Field label="Check these before you use it">
                    <ul className="ecc-reason-list">
                      {item.factsToVerify.map((f) => (
                        <li key={f.id}>
                          <strong>{f.claim}</strong> {f.howToVerify}
                        </li>
                      ))}
                    </ul>
                  </Field>
                ) : null}

                {item.missingInformation.length > 0 ? (
                  <Field label="Missing before this can be drafted">
                    <ul className="ecc-reason-list">
                      {item.missingInformation.map((m) => (
                        <li key={m}>{m}</li>
                      ))}
                    </ul>
                  </Field>
                ) : null}

                {item.attachmentReminder ? (
                  <p className="ecc-attach-reminder">{item.attachmentReminder}</p>
                ) : null}
              </div>

              <ItemActions
                threadId={r.thread.id}
                subject={r.thread.subject}
                linkTo={linkTo}
                recommendedNextStep={r.analysis.recommendedNextStep}
                draftAvailable={r.analysis.draftStatus === 'available'}
              />
            </li>
          );
        })}
      </ul>
    </ViewScaffold>
  );
};
