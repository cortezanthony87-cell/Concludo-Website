/**
 * Overview, rebuilt.
 *
 * The old page was a repository: eight equal metric cards, seven equal panels,
 * 4,265 pixels tall, with the single most consequential thread in the inbox
 * appearing four separate times. It answered "what is in my inbox". It did not
 * answer "what do I do first", which is the only question a dashboard is for.
 *
 * This one answers that question and then gets out of the way:
 *
 * **One thing leads.** The highest-consequence thread sits alone at the top
 * with the reason it leads and the step to take. One large quiet statement, in
 * the Evidential Geometry sense: the field is mostly empty so that the one mark
 * carries weight.
 *
 * **Security is separate and first.** Flagged threads are never mixed into
 * routine priority, which the old page was quietly breaking by listing a
 * payment-redirection attempt in three ordinary panels.
 *
 * **Nothing repeats.** `composeOverview` claims each thread for exactly one
 * section, and a section says how many of its own queue it did not draw. The
 * counts stay true; the page stops being a copy of itself.
 *
 * **The rail is an index, not a scoreboard.** The eight counts remain, because
 * each is the way into a view, but they are a quiet row rather than eight cards
 * arguing with the thing worth reading.
 */
import React, { useMemo } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ArrowRight, ListChecks, ShieldAlert, Sparkles } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import {
  AccountBadge,
  BandBadge,
  ConfidenceChip,
  DateChip,
  StatusBadge,
  WarningBlock,
} from '../../components/email/viewPrimitives';
import { LoadingBlock, ErrorBlock } from '../../components/email/StateBlocks';
import { useViewData } from '../../lib/email/useViewData';
import { composeOverview } from '../../lib/email/overview';
import { metricCounts, METRICS } from '../../lib/email/aggregation';
import { METRIC_DESTINATION } from '../../lib/email/shellAdapter';
import { PriorityBand, ThreadStatus } from '../../lib/email/model';
import { ThreadRecord } from '../../lib/email/filters';

export const EmailOverviewPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { records, accountLabel, accountType, now, state } = useViewData(accountId);

  const page = useMemo(() => composeOverview(records, now), [records, now]);
  const counts = useMemo(() => metricCounts(records, now), [records, now]);

  if (state === 'loading') {
    return (
      <section className="ecc-page" aria-labelledby="ecc-overview-heading">
        <h2 id="ecc-overview-heading" className="ecc-page-title">
          Overview
        </h2>
        <LoadingBlock label="your inbox" rows={4} />
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="ecc-page" aria-labelledby="ecc-overview-heading">
        <h2 id="ecc-overview-heading" className="ecc-page-title">
          Overview
        </h2>
        <ErrorBlock
          label="the overview"
          message="This account could not be read. Nothing has been missed; nothing has been changed either."
        />
      </section>
    );
  }

  return (
    <section className="ecc-page ecc-overview" aria-labelledby="ecc-overview-heading">
      <header className="ecc-overview-head">
        <h2 id="ecc-overview-heading" className="ecc-page-title">
          Overview
        </h2>
        <p className="ecc-view-account">
          Showing <strong>{accountLabel}</strong>, the {accountType} account. Work and personal are
          never combined.
        </p>
      </header>

      {/* 1. Security, apart from everything else and before everything else. */}
      {page.security.length > 0 ? (
        <section className="ecc-alert-band" aria-labelledby="ecc-alert-heading">
          <div className="ecc-alert-band-head">
            <h3 id="ecc-alert-heading">
              <ShieldAlert size={16} aria-hidden="true" />
              {page.security.length} {page.security.length === 1 ? 'thread looks' : 'threads look'}{' '}
              unsafe
            </h3>
            <Link className="ecc-text-button" to={linkTo('/email/security-review')}>
              Security Review <ArrowRight size={13} aria-hidden="true" />
            </Link>
          </div>
          <p className="ecc-alert-band-note">
            Kept out of every list below, so nothing routine sits beside them. Advisory only:
            Concludo has not blocked, moved or reported anything.
          </p>
          <ul className="ecc-alert-list">
            {page.security.map((r) => (
              <li key={r.thread.id}>
                <Link className="ecc-alert-row" to={linkTo(`/email/thread/${r.thread.id}`)}>
                  <span className="ecc-alert-subject">{r.thread.subject}</span>
                  <span className="ecc-alert-why">
                    {r.analysis.securityAlert?.explanation ?? 'Flagged for review.'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* 2. The one thing to do first. */}
      {page.lead ? (
        <section className="ecc-lead" aria-labelledby="ecc-lead-heading">
          <p className="ecc-lead-kicker">Start here</p>
          <div className="ecc-lead-identity">
            <p className="ecc-lead-sender">{page.lead.counterpartyName}</p>
            <h3 id="ecc-lead-heading" className="ecc-lead-subject">
              {page.lead.thread.subject}
            </h3>
          </div>

          <p className="ecc-lead-why">{page.lead.analysis.whyItMatters}</p>

          <div className="ecc-lead-step">
            <p className="ecc-lead-step-label">Recommended next step</p>
            <p className="ecc-lead-step-text">{page.lead.analysis.recommendedNextStep}</p>
            <p className="ecc-lead-step-meta">
              <ConfidenceChip confidence={page.lead.analysis.confidence} what="this recommendation" />
            </p>
            <p className="ecc-lead-reason">{page.leadReason}</p>
          </div>

          <div className="ecc-lead-meta">
            <AccountBadge accountType={accountType} label={accountLabel} />
            <StatusBadge status={page.lead.analysis.currentStatus as ThreadStatus} />
            <BandBadge
              band={page.lead.analysis.priorityBand as PriorityBand}
              score={page.lead.analysis.priorityScore}
            />
            {page.lead.nextStatedDeadline || page.lead.nextAnyDeadline ? (
              <DateChip
                dueAt={page.lead.nextStatedDeadline ?? page.lead.nextAnyDeadline}
                origin={page.lead.nextStatedDeadline ? 'explicit_email' : 'suggested'}
              />
            ) : null}
          </div>

          <div className="ecc-lead-actions">
            <Link className="btn-primary ecc-bl-button" to={linkTo(`/email/thread/${page.lead.thread.id}`)}>
              Open the conversation <ArrowRight size={14} aria-hidden="true" />
            </Link>
            <Link className="btn-secondary ecc-bl-button" to={linkTo('/email/clear-backlog')}>
              <ListChecks size={14} aria-hidden="true" /> Work through a batch
            </Link>
            <Link className="btn-secondary ecc-bl-button" to={linkTo('/email/outputs')}>
              <Sparkles size={14} aria-hidden="true" /> Build a document
            </Link>
          </div>
        </section>
      ) : page.allClear ? (
        <section className="ecc-lead ecc-lead-clear" aria-labelledby="ecc-lead-heading">
          <p className="ecc-lead-kicker">Nothing waiting</p>
          <h3 id="ecc-lead-heading" className="ecc-lead-subject">
            There is nothing on this account that needs you.
          </h3>
          <p className="ecc-lead-why">
            Every thread is either finished or waiting on somebody else. That is the whole report.
          </p>
        </section>
      ) : null}


      {/* 3. The index. Eight counts, quiet, each a way into a view. */}
      <nav className="ecc-rail" aria-label="Counts across this account">
        <ul className="ecc-rail-list">
          {METRICS.map((metric) => {
            const count = counts.find((c) => c.key === metric.key)?.count ?? 0;
            const tone =
              metric.key === 'security_review' && count > 0
                ? 'alert'
                : count > 0
                  ? 'attention'
                  : 'quiet';
            return (
              <li key={metric.key}>
                <Link
                  className={`ecc-rail-item ecc-rail-${tone}`}
                  to={linkTo(METRIC_DESTINATION[metric.key])}
                  aria-label={`${metric.label}: ${count === 0 ? 'none' : count}. ${metric.explanation}`}
                >
                  <span className="ecc-rail-count" aria-hidden="true">
                    {count === 0 ? '0' : count}
                  </span>
                  <span className="ecc-rail-label" aria-hidden="true">
                    {metric.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 4. Four short sections, each thread appearing exactly once.

          A section with nothing left to draw does not get a panel. An empty
          panel the height of a full one is 400 pixels telling a person
          nothing, and the first version of this page had two of them side by
          side. They collapse into one line underneath instead, which says the
          same thing in a tenth of the space. */}
      <div className="ecc-section-grid">
        {page.sections.filter((s) => s.records.length > 0).map((section) => (
          <section key={section.key} className="ecc-section" aria-labelledby={`ecc-sec-${section.key}`}>
            <header className="ecc-section-head">
              <div>
                <h3 id={`ecc-sec-${section.key}`} className="ecc-section-title">
                  {section.title}
                </h3>
                <p className="ecc-section-description">{section.description}</p>
              </div>
              <Link className="ecc-text-button" to={linkTo(section.destination)}>
                All {section.total} <ArrowRight size={13} aria-hidden="true" />
              </Link>
            </header>

            <ul className="ecc-section-list">
              {section.records.map((r) => (
                <li key={r.thread.id}>
                  <OverviewRow record={r} linkTo={linkTo} />
                </li>
              ))}
            </ul>

            {section.total > section.records.length ? (
              <p className="ecc-section-more">
                {section.total - section.records.length} more
                {section.alreadyShown > 0 ? `, ${section.alreadyShown} of them already above` : ''}.
              </p>
            ) : null}
          </section>
        ))}
      </div>

      {page.sections.some((s) => s.records.length === 0) ? (
        <ul className="ecc-section-nil">
          {page.sections
            .filter((s) => s.records.length === 0)
            .map((section) => (
              <li key={section.key}>
                <Link className="ecc-nil-row" to={linkTo(section.destination)}>
                  <span className="ecc-nil-title">{section.title}</span>
                  <span className="ecc-nil-note">
                    {section.alreadyShown > 0
                      ? `All ${section.alreadyShown} already shown above.`
                      : section.emptyMessage}
                  </span>
                </Link>
              </li>
            ))}
        </ul>
      ) : null}

      {page.unanalysed > 0 ? (
        <p className="ecc-overview-foot">
          {page.unanalysed} {page.unanalysed === 1 ? 'thread has' : 'threads have'} not been analysed
          yet, so nothing above accounts for {page.unanalysed === 1 ? 'it' : 'them'}.{' '}
          <Link className="ecc-text-button" to={linkTo('/email/all')}>
            See them in All Email
          </Link>
        </p>
      ) : null}
    </section>
  );
};

/**
 * One row.
 *
 * Three registers and no more: who and what, the one line that says why, and
 * the small technical apparatus. The old panel row carried three sub-bullets at
 * the same size and colour as everything else, which is what made the page read
 * as a wall.
 */
const OverviewRow: React.FC<{ record: ThreadRecord; linkTo: (p: string) => string }> = ({
  record,
  linkTo,
}) => {
  const a = record.analysis;
  return (
    <Link className="ecc-srow" to={linkTo(`/email/thread/${record.thread.id}`)}>
      <span className="ecc-srow-main">
        <span className="ecc-srow-sender">{record.counterpartyName}</span>
        <span className="ecc-srow-subject">{record.thread.subject}</span>
        <span className="ecc-srow-summary">{a.oneLineSummary}</span>
      </span>
      <span className="ecc-srow-side">
        <span className={`ecc-srow-band ecc-srow-band-${a.priorityBand}`}>{a.priorityBand}</span>
        {record.nextStatedDeadline ? (
          <span className="ecc-srow-date">
            <DateChip dueAt={record.nextStatedDeadline} origin="explicit_email" />
          </span>
        ) : null}
      </span>
    </Link>
  );
};
