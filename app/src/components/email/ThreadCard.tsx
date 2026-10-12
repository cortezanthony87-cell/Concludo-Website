/**
 * The full thread card.
 *
 * Every field the brief lists is on the face of the card, not behind a hover or
 * a tooltip. That is the point of the view: a person working through a large
 * inbox should be able to decide what to do without opening the thread.
 *
 * Order is deliberate. The warning comes before the summary, because a person
 * who reads "pay this new account" and then reads the warning has already
 * started thinking about paying.
 */
import React from 'react';
import { NeedsAttentionItem } from '../../lib/email/views';
import { ThreadStatus, PriorityBand } from '../../lib/email/model';
import {
  AccountBadge,
  BandBadge,
  StatusBadge,
  DateChip,
  ConfidenceChip,
  AttachmentChip,
  DraftChip,
  WarningBlock,
  Field,
} from './viewPrimitives';
import { ItemActions } from './ItemActions';

interface Props {
  item: NeedsAttentionItem;
  linkTo: (path: string) => string;
}

export const ThreadCard: React.FC<Props> = ({ item, linkTo }) => {
  const headingId = `ecc-card-${item.threadId}`;

  return (
    <li className="content-card ecc-card" aria-labelledby={headingId}>
      <div className="ecc-card-top">
        <div className="ecc-card-identity">
          <p className="ecc-card-sender">
            {item.sender}
            {item.senderAddress ? (
              <span className="ecc-card-address"> {item.senderAddress}</span>
            ) : null}
          </p>
          <h3 id={headingId} className="ecc-card-subject">
            {item.subject}
          </h3>
        </div>
        <div className="ecc-card-badges">
          <AccountBadge accountType={item.accountType} label={item.accountLabel} />
          <BandBadge band={item.priorityBand as PriorityBand} score={item.priorityScore} />
          <StatusBadge status={item.status as ThreadStatus} />
        </div>
      </div>

      {item.warning ? (
        <WarningBlock kind={item.warning.kind} text={item.warning.text} />
      ) : null}

      <p className="ecc-card-summary">{item.summary}</p>

      <Field label="Why it matters">{item.whyItMatters}</Field>

      <Field label="Why it is here">
        <ul className="ecc-reason-list">
          {item.priorityReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      </Field>

      <Field label="Recommended next step">{item.recommendedNextStep}</Field>

      <div className="ecc-card-meta">
        <DateChip
          dueAt={item.deadline?.dueAt ?? null}
          origin={item.deadline?.basis === 'stated' ? 'explicit_email' : 'suggested'}
        />
        <DraftChip status={item.draftStatus} />
        <ConfidenceChip confidence={item.confidence} what="this thread's reading" />
        <AttachmentChip count={item.attachmentCount} awaiting={item.awaitingAttachment} />
      </div>

      {item.deadline ? (
        <p className="ecc-card-consequence">
          <strong>If the date passes:</strong> {item.deadline.consequence}
        </p>
      ) : null}

      <ItemActions
        threadId={item.threadId}
        subject={item.subject}
        linkTo={linkTo}
        recommendedNextStep={item.recommendedNextStep}
        draftAvailable={item.draftStatus === 'available'}
      />
    </li>
  );
};
