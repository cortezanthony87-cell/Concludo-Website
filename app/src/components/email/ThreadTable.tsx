/**
 * All Email: a real table on desktop, real cards on a phone.
 *
 * Both are rendered from the same rows and the switch is a CSS media query, so
 * the two cannot drift apart. Two things this does not do, deliberately:
 *
 * It does not use a div grid with ARIA table roles. A real `<table>` gives row
 * and column announcement, header association and keyboard navigation for free,
 * and those are the parts that get quietly broken by a div grid.
 *
 * It does not make the whole row clickable. The link is the subject, so the
 * tab order has one target per row instead of a target that announces the
 * entire row's text.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { ThreadRecord } from '../../lib/email/filters';
import { AllEmailSort, AllEmailSortKey, ALL_EMAIL_COLUMNS } from '../../lib/email/views';
import { ThreadStatus, PriorityBand } from '../../lib/email/model';
import { AccountBadge, BandBadge, StatusBadge, DateChip, formatDay } from './viewPrimitives';

interface Props {
  records: readonly ThreadRecord[];
  sort: AllEmailSort;
  onSort: (key: AllEmailSortKey) => void;
  caption: string;
  /** Builds the link into the thread workspace, keeping the account in the URL. */
  linkTo: (path: string) => string;
}

/**
 * `aria-sort` goes on the `th`, and the control inside it is a button whose
 * accessible name says what the next click will do. Announcing only "sorted
 * ascending" leaves a person guessing what pressing it again achieves.
 */
function sortState(sort: AllEmailSort, key: AllEmailSortKey): 'ascending' | 'descending' | 'none' {
  if (sort.key !== key) return 'none';
  return sort.direction === 'asc' ? 'ascending' : 'descending';
}

export const ThreadTable: React.FC<Props> = ({ records, sort, onSort, caption, linkTo }) => (
  <>
    <table className="ecc-table">
      <caption className="ecc-visually-hidden">{caption}</caption>
      <thead>
        <tr>
          {ALL_EMAIL_COLUMNS.map((column) => {
            const state = sortState(sort, column.key);
            const next =
              state === 'none'
                ? column.firstClick === 'asc'
                  ? 'ascending'
                  : 'descending'
                : state === 'ascending'
                  ? 'descending'
                  : 'ascending';
            return (
              <th key={column.key} scope="col" aria-sort={state}>
                <button type="button" className="ecc-sort-button" onClick={() => onSort(column.key)}>
                  {column.label}
                  {state === 'none' ? (
                    <ArrowUpDown size={12} aria-hidden="true" className="ecc-sort-idle" />
                  ) : state === 'ascending' ? (
                    <ArrowUp size={12} aria-hidden="true" />
                  ) : (
                    <ArrowDown size={12} aria-hidden="true" />
                  )}
                  <span className="ecc-visually-hidden">
                    {state === 'none'
                      ? `, not sorted. Activate to sort ${next}.`
                      : `, sorted ${state}. Activate to sort ${next}.`}
                  </span>
                </button>
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {records.map((r) => (
          <tr key={r.thread.id}>
            <td>
              <BandBadge band={r.analysis.priorityBand as PriorityBand} score={r.analysis.priorityScore} />
            </td>
            <td>
              <span className="ecc-table-sender">{r.counterpartyName}</span>
              <AccountBadge accountType={r.thread.accountType} />
            </td>
            <th scope="row" className="ecc-table-subject">
              <Link to={linkTo(`/email/thread/${r.thread.id}`)} className="ecc-table-subject-link">
                <span className="ecc-table-subject-text">{r.thread.subject}</span>
              </Link>
              <span className="ecc-table-summary">{r.analysis.oneLineSummary}</span>
            </th>
            <td>
              <StatusBadge status={r.analysis.currentStatus as ThreadStatus} />
            </td>
            <td>
              {r.nextStatedDeadline ? (
                <DateChip dueAt={r.nextStatedDeadline} origin="explicit_email" />
              ) : r.analysis.suggestedDates[0] ? (
                <DateChip dueAt={r.analysis.suggestedDates[0].dueAt} origin="suggested" />
              ) : (
                <span className="ecc-date-none">No date</span>
              )}
            </td>
            <td className="ecc-table-date">{formatDay(r.thread.lastMessageAt)}</td>
          </tr>
        ))}
      </tbody>
    </table>

    {/*
      The phone view. Same rows, same order, same sort control above it. It is
      a list rather than a table because a six column table on a 390px screen
      is a horizontal scroll with a table in it.
    */}
    <ul className="ecc-table-cards" aria-label={caption}>
      {records.map((r) => (
        <li key={r.thread.id} className="content-card ecc-table-card">
          <div className="ecc-table-card-top">
            <BandBadge band={r.analysis.priorityBand as PriorityBand} score={r.analysis.priorityScore} />
            <StatusBadge status={r.analysis.currentStatus as ThreadStatus} />
            <AccountBadge accountType={r.thread.accountType} />
          </div>
          <p className="ecc-table-card-sender">{r.counterpartyName}</p>
          <p className="ecc-table-card-subject">
            <Link to={linkTo(`/email/thread/${r.thread.id}`)} className="ecc-table-subject-link">
              {r.thread.subject}
            </Link>
          </p>
          <p className="ecc-table-card-summary">{r.analysis.oneLineSummary}</p>
          <p className="ecc-table-card-meta">
            {r.nextStatedDeadline ? (
              <DateChip dueAt={r.nextStatedDeadline} origin="explicit_email" />
            ) : r.analysis.suggestedDates[0] ? (
              <DateChip dueAt={r.analysis.suggestedDates[0].dueAt} origin="suggested" />
            ) : (
              <span className="ecc-date-none">No date</span>
            )}
            <span className="ecc-table-card-last">Last message {formatDay(r.thread.lastMessageAt)}</span>
          </p>
        </li>
      ))}
    </ul>
  </>
);
