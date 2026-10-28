/**
 * Security Review.
 *
 * Kept separate from the priority queues on purpose. A suspected payment
 * redirection is not a high priority email; it is a different kind of thing,
 * and putting it in the same list as a client asking about a meeting invites a
 * person to work through it at the same speed.
 *
 * The disclaimer is not decoration. Every item on this page is a pattern match,
 * and a pattern match can be wrong in both directions. It appears above the
 * list, where it is read before the warnings rather than after them.
 */
import React, { useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { ShieldAlert, Phone } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { ItemActions } from '../../components/email/ItemActions';
import { AccountBadge, Field, formatDayTime } from '../../components/email/viewPrimitives';
import { useViewData } from '../../lib/email/useViewData';
import { SECURITY_CATEGORIES, SECURITY_DISCLAIMER, securityItems } from '../../lib/email/views';

/** Turns a raw flag into a sentence-case label, in code rather than in CSS. */
function humanise(flag: string): string {
  const words = flag.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const SEVERITY_LABEL: Record<'high' | 'medium' | 'low', string> = {
  high: 'High severity',
  medium: 'Medium severity',
  low: 'Low severity',
};

export const EmailSecurityReviewPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, state } = useViewData(accountId);

  const items = useMemo(() => securityItems(records), [records]);

  return (
    <ViewScaffold
      viewPath="/email/security-review"
      topThreadId={items[0]?.record.thread.id ?? null}
      title="Security Review"
      description="Messages flagged as possibly unsafe, kept separate from the priority queues."
      state={state}
      count={items.length}
      emptyMessage="Nothing is flagged."
      emptyNote="That is not proof an inbox is safe, only that nothing matched a pattern this module checks for."
      accountLabel={accountLabel}
      accountType={accountType}
      notice={
        <div className="ecc-disclaimer" role="note">
          <p className="ecc-disclaimer-text">
            <ShieldAlert size={15} aria-hidden="true" />
            {SECURITY_DISCLAIMER}
          </p>
          <p className="ecc-disclaimer-sub">
            Nothing here is blocked, quarantined or deleted. Every item is advisory and the decision
            is yours.
          </p>
        </div>
      }
    >
      <ul className="ecc-card-list">
        {items.map((item) => {
          const r = item.record;
          const headingId = `ecc-security-${r.thread.id}`;
          return (
            <li key={r.thread.id} className="content-card ecc-card ecc-card-security" aria-labelledby={headingId} data-thread-id={r.thread.id} tabIndex={-1}>
              <div className="ecc-card-top">
                <div className="ecc-card-identity">
                  <p className="ecc-card-sender">
                    {r.counterpartyName}
                    {r.counterpartyAddress ? (
                      <span className="ecc-card-address"> {r.counterpartyAddress}</span>
                    ) : null}
                  </p>
                  <h3 id={headingId} className="ecc-card-subject">
                    {r.thread.subject}
                  </h3>
                </div>
                <div className="ecc-card-badges">
                  <AccountBadge accountType={accountType} label={accountLabel} />
                  <span className={`ecc-badge ecc-severity-${item.severity}`}>
                    {SEVERITY_LABEL[item.severity]}
                  </span>
                </div>
              </div>

              <Field label={`What was found (${item.categories.length})`}>
                <ul className="ecc-category-list">
                  {item.categories.map((c) => (
                    <li key={c.flag} className="ecc-category">
                      <span className="ecc-category-label">{c.label}</span>
                      <span className="ecc-category-meaning">{c.meaning}</span>
                    </li>
                  ))}
                  {item.otherFlags.map((f) => (
                    <li key={f} className="ecc-category">
                      <span className="ecc-category-label">{humanise(f)}</span>
                      <span className="ecc-category-meaning">
                        A further signal outside the nine standard categories.
                      </span>
                    </li>
                  ))}
                </ul>
              </Field>

              <p className="ecc-security-explanation">{item.explanation}</p>

              <p className="ecc-security-check">
                <Phone size={13} aria-hidden="true" />
                <strong>What to do:</strong> {item.recommendedCheck}
              </p>

              <div className="ecc-card-meta">
                <span className="ecc-attach-chip">
                  Last message {formatDayTime(r.thread.lastMessageAt)}
                </span>
                <span className="ecc-attach-chip">
                  No reply is recommended, and no draft has been written
                </span>
              </div>

              <ItemActions
                threadId={r.thread.id}
                subject={r.thread.subject}
                linkTo={linkTo}
                recommendedNextStep={r.analysis.recommendedNextStep}
                draftAvailable={false}
              />
            </li>
          );
        })}
      </ul>

      <section className="content-card ecc-category-reference" aria-labelledby="ecc-cat-ref">
        <h3 id="ecc-cat-ref" className="ecc-settings-title">
          What this module checks for
        </h3>
        <p className="ecc-settings-note">
          Nine categories. A message can match several at once, and matching none does not mean a
          message is safe.
        </p>
        <ul className="ecc-category-list">
          {SECURITY_CATEGORIES.map((c) => (
            <li key={c.flag} className="ecc-category">
              <span className="ecc-category-label">{c.label}</span>
              <span className="ecc-category-meaning">{c.meaning}</span>
            </li>
          ))}
        </ul>
      </section>
    </ViewScaffold>
  );
};
