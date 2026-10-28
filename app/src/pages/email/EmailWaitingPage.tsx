/**
 * Waiting.
 *
 * Threads where the next step belongs to someone else. The useful question on
 * this page is not "what is outstanding" but "how sure are we that it is
 * genuinely theirs", so ownership confidence is shown with the evidence behind
 * it rather than asserted.
 */
import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Hourglass } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { ItemActions } from '../../components/email/ItemActions';
import {
  AccountBadge,
  ConfidenceChip,
  DateChip,
  Field,
  formatDayTime,
} from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { waitingItems } from '../../lib/email/views';

const FOLLOW_UP_TEXT: Record<string, string> = {
  none_sent: 'No follow-up sent, and they gave no date.',
  overdue: 'The date they gave has passed.',
  awaiting_their_date: 'Still within the date they gave.',
};

export const EmailWaitingPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state } = useViewData(accountId);

  const items = useMemo(() => waitingItems(records, now), [records, now]);

  return (
    <ViewScaffold
      title="Waiting"
      description="You have done your part. Shown oldest first, because the quietest thread is the one most likely to have been forgotten by both sides."
      state={state}
      count={items.length}
      emptyMessage="Nothing is outstanding from anyone else."
      accountLabel={accountLabel}
      accountType={accountType}
      viewPath="/email/waiting"
      topThreadId={items[0]?.threadId ?? null}
    >
      <ul className="ecc-card-list">
        {items.map((item) => {
          const headingId = `ecc-waiting-${item.threadId}`;
          return (
            <li key={item.threadId} className="content-card ecc-card" aria-labelledby={headingId} data-thread-id={item.threadId} tabIndex={-1}>
              <div className="ecc-card-top">
                <div className="ecc-card-identity">
                  <p className="ecc-card-sender">
                    <Hourglass size={12} aria-hidden="true" /> Waiting on {item.waitingOn}
                    {item.waitingOnAddress ? (
                      <span className="ecc-card-address"> {item.waitingOnAddress}</span>
                    ) : null}
                  </p>
                  <h3 id={headingId} className="ecc-card-subject">
                    {item.subject}
                  </h3>
                </div>
                <div className="ecc-card-badges">
                  <AccountBadge accountType={accountType} label={accountLabel} />
                  <span className="ecc-badge ecc-tone-quiet">
                    {item.threadAgeDays} day{item.threadAgeDays === 1 ? '' : 's'} old
                  </span>
                </div>
              </div>

              <Field label="What is outstanding">{item.outstandingItem}</Field>

              <Field label="Last meaningful message">
                {formatDayTime(item.lastMeaningfulMessageAt)}
              </Field>

              <div className="ecc-card-meta">
                <span className="ecc-field-inline">
                  <span className="ecc-field-label">Date they gave</span>
                  {item.expectedAt ? (
                    <DateChip dueAt={item.expectedAt} origin="explicit_email" />
                  ) : (
                    <span className="ecc-date-none">They gave none</span>
                  )}
                </span>
                <span className="ecc-field-inline">
                  <span className="ecc-field-label">Suggested follow-up</span>
                  {item.suggestedFollowUpAt ? (
                    <DateChip dueAt={item.suggestedFollowUpAt} origin="suggested" />
                  ) : (
                    <span className="ecc-date-none">None suggested</span>
                  )}
                </span>
              </div>

              <p className="ecc-waiting-status">{FOLLOW_UP_TEXT[item.followUpStatus]}</p>

              <div className="ecc-ownership">
                <ConfidenceChip confidence={item.ownershipConfidence} what="who owns the next step" />
                <p className="ecc-ownership-basis">{item.ownershipBasis}</p>
              </div>

              <ItemActions
                threadId={item.threadId}
                subject={item.subject}
                linkTo={linkTo}
                suggestedFollowUpAt={item.suggestedFollowUpAt}
                recommendedNextStep={`Chase ${item.waitingOn} on: ${item.outstandingItem}`}
                draftAvailable={false}
              />
            </li>
          );
        })}
      </ul>
    </ViewScaffold>
  );
};
