/**
 * Actions and Deadlines.
 *
 * Grouped by when, and labelled by where the date came from. The three origins
 * are kept visually distinct because they carry different weight: a date the
 * sender wrote can be planned around, a date the module worked out has to be
 * confirmed first, and a date the person set is theirs.
 */
import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { DateChip, BandBadge } from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { useLocalActions } from '../../lib/email/localActions';
import {
  DEADLINE_GROUP_LABEL,
  DatedItem,
  datedItems,
  groupDatedItems,
} from '../../lib/email/views';
import { PriorityBand } from '../../lib/email/model';

const GROUP_NOTE: Record<string, string> = {
  overdue: 'The date has passed. Nothing here has been actioned for you.',
  today: 'Due before the end of today.',
  tomorrow: 'Due tomorrow.',
  this_week: 'Due within the next seven days.',
  later: 'Beyond this week.',
  undated: 'Something you owe, with no date attached. These are the ones that disappear.',
};

export const EmailActionsDeadlinesPage: React.FC = () => {
  const { accountId } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state } = useViewData(accountId);
  const { userDates } = useLocalActions();

  const groups = useMemo(
    () => groupDatedItems(datedItems(records, now, userDates)).filter((g) => g.items.length > 0),
    [records, now, userDates]
  );

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <ViewScaffold
      title="Actions and Deadlines"
      description="Everything with a date, and everything you owe that has none. Grouped by when, labelled by where the date came from."
      state={state}
      count={total}
      countNoun={['dated item', 'dated items']}
      emptyMessage="Nothing is dated and nothing is outstanding."
      accountLabel={accountLabel}
      accountType={accountType}
      viewPath="/email/actions-deadlines"
      topThreadId={groups[0]?.items[0]?.threadId ?? null}
      backlog="dated"
      controls={
        <p className="ecc-legend-note">
          A date marked <strong>Suggested date, confirm</strong> was worked out from the wording of
          the thread. It is a reading, not a fact, and it is shown that way everywhere it appears.
        </p>
      }
    >
      <div className="ecc-groups">
        {groups.map((group) => (
          <section key={group.key} className="ecc-group" aria-labelledby={`ecc-group-${group.key}`}>
            <h3 id={`ecc-group-${group.key}`} className={`ecc-group-head ecc-group-${group.key}`}>
              {DEADLINE_GROUP_LABEL[group.key]}
              <span className="ecc-group-count">
                {group.items.length}
                <span className="ecc-visually-hidden"> items</span>
              </span>
            </h3>
            <p className="ecc-group-note">{GROUP_NOTE[group.key]}</p>
            <ul className="ecc-dated-list">
              {group.items.map((item) => (
                <DatedRow key={`${item.id}-${item.origin}`} item={item} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </ViewScaffold>
  );
};

const DatedRow: React.FC<{ item: DatedItem }> = ({ item }) => (
  <li className={`ecc-dated ecc-dated-${item.origin.replace('_', '-')}`} data-thread-id={item.threadId} tabIndex={-1}>
    <div className="ecc-dated-main">
      <p className="ecc-dated-description">{item.description}</p>
      <p className="ecc-dated-thread">
        {item.subject}
        {item.sender ? <span className="ecc-dated-sender"> · {item.sender}</span> : null}
      </p>
      <p className="ecc-dated-consequence">
        {item.ownerIsSelf ? 'Yours. ' : 'Theirs. '}
        {item.consequence}
      </p>
      {item.blockedBy ? <p className="ecc-dated-blocked">Blocked by: {item.blockedBy}</p> : null}
    </div>
    <div className="ecc-dated-meta">
      <DateChip dueAt={item.dueAt} origin={item.origin} withTime />
      <BandBadge band={item.priorityBand as PriorityBand} />
    </div>
  </li>
);
