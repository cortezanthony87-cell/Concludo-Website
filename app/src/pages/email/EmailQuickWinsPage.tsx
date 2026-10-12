/**
 * Quick Wins.
 *
 * Two rules from the brief are load-bearing here.
 *
 * The labels are neutral. "Possible archive candidate", not "junk"; "No action
 * detected", not "ignore". A label that tells a person what to do with a
 * message will eventually be wrong about one that mattered, and the cost of
 * being wrong falls entirely on them.
 *
 * A high-consequence thread is never hidden for being quick. The renewal terms
 * thread takes one line and costs a year of revenue if it is missed. Those
 * threads are kept, marked, and sorted to the top.
 */
import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { AlertTriangle, Timer } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { ItemActions } from '../../components/email/ItemActions';
import { AccountBadge, BandBadge, StatusBadge, Field } from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { QUICK_WIN_LABEL, quickWinItems } from '../../lib/email/views';
import { PriorityBand, ThreadStatus } from '../../lib/email/model';

export const EmailQuickWinsPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state } = useViewData(accountId);

  const items = useMemo(() => quickWinItems(records, now), [records, now]);
  const highConsequence = items.filter((i) => i.highConsequence).length;

  return (
    <ViewScaffold
      title="Quick Wins"
      description="Threads that should take very little time. Short to answer is not the same as small to get wrong."
      state={state}
      count={items.length}
      emptyMessage="No short jobs waiting."
      accountLabel={accountLabel}
      accountType={accountType}
      controls={
        highConsequence > 0 ? (
          <p className="ecc-legend-note ecc-legend-warn">
            <AlertTriangle size={14} aria-hidden="true" />
            {highConsequence} of these {highConsequence === 1 ? 'is' : 'are'} quick to answer and
            expensive to miss. They are marked and kept at the top rather than filtered out for
            being short.
          </p>
        ) : undefined
      }
    >
      <ul className="ecc-card-list">
        {items.map((item) => {
          const r = item.record;
          const headingId = `ecc-quick-${r.thread.id}`;
          return (
            <li
              key={r.thread.id}
              className={`content-card ecc-card ${item.highConsequence ? 'ecc-card-flagged' : ''}`}
              aria-labelledby={headingId}
            >
              <div className="ecc-card-top">
                <div className="ecc-card-identity">
                  <p className="ecc-card-sender">{r.counterpartyName}</p>
                  <h3 id={headingId} className="ecc-card-subject">
                    {r.thread.subject}
                  </h3>
                </div>
                <div className="ecc-card-badges">
                  <AccountBadge accountType={accountType} label={accountLabel} />
                  <span className="ecc-badge ecc-tone-quiet">{QUICK_WIN_LABEL[item.label]}</span>
                  <StatusBadge status={r.analysis.currentStatus as ThreadStatus} />
                </div>
              </div>

              {item.highConsequence ? (
                <p className="ecc-high-consequence" role="note">
                  <AlertTriangle size={13} aria-hidden="true" />
                  <strong>Quick, but high consequence.</strong> {r.analysis.whyItMatters}
                </p>
              ) : null}

              <p className="ecc-card-summary">{r.analysis.oneLineSummary}</p>

              <Field label="Why this label">{item.labelReason}</Field>

              <div className="ecc-card-meta">
                <span className="ecc-attach-chip">
                  <Timer size={12} aria-hidden="true" />
                  {item.estimatedMinutes === null
                    ? 'No estimate'
                    : `About ${item.estimatedMinutes} minute${item.estimatedMinutes === 1 ? '' : 's'}`}
                </span>
                <BandBadge band={r.analysis.priorityBand as PriorityBand} score={r.analysis.priorityScore} />
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
