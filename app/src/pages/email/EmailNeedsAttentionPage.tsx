/**
 * Needs Attention.
 *
 * The threads with the highest consequence if they are left until tomorrow,
 * each shown in full so a decision can be made without opening the thread.
 */
import React from 'react';
import { useOutletContext } from 'react-router-dom';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { ThreadCard } from '../../components/email/ThreadCard';
import { useViewData } from '../../lib/email/useViewData';
import { needsAttentionItems } from '../../lib/email/views';

export const EmailNeedsAttentionPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state, deferredCount } = useViewData(accountId);

  const items = needsAttentionItems(records, accountLabel, now);

  return (
    <ViewScaffold
      title="Needs Attention"
      description="Highest consequence if left until tomorrow. Everything needed to decide is on the card."
      state={state}
      count={items.length}
      emptyMessage="Nothing is urgent."
      emptyNote={
        deferredCount > 0
          ? `That is a real answer, not an empty list. ${deferredCount} thread${
              deferredCount === 1 ? ' is' : 's are'
            } deferred for this visit.`
          : 'That is a real answer, not an empty list.'
      }
      accountLabel={accountLabel}
      accountType={accountType}
    >
      <ul className="ecc-card-list">
        {items.map((item) => (
          <ThreadCard key={item.threadId} item={item} linkTo={linkTo} />
        ))}
      </ul>
    </ViewScaffold>
  );
};
