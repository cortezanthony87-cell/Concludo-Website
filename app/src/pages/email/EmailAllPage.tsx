/**
 * All Email.
 *
 * The view a person opens when they are looking for something they know exists.
 * It includes everything: bulk, duplicates, resolved threads, and anything
 * deferred earlier in the visit. A thread a person cannot find is a thread the
 * module has taken from them.
 */
import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Search } from 'lucide-react';
import { EmailModuleContext } from '../../components/email/EmailModuleLayout';
import { ViewScaffold } from '../../components/email/ViewScaffold';
import { ThreadTable } from '../../components/email/ThreadTable';
import { FilterChips } from '../../components/email/FilterChips';
import { useViewData } from '../../lib/email/useViewData';
import { applyFilter } from '../../lib/email/filters';
import { savedViews, runSavedView } from '../../lib/email/savedViews';
import {
  AllEmailSort,
  AllEmailSortKey,
  ALL_EMAIL_COLUMNS,
  paginate,
  sortAllEmail,
} from '../../lib/email/views';
import { SavedViewKey, ThreadFilter } from '../../lib/email/model';

type QuickFilterKey = 'unread' | 'has_deadline' | 'has_attachment' | 'flagged' | 'hide_bulk';

const QUICK_FILTERS: readonly {
  key: QuickFilterKey;
  label: string;
  description: string;
  filter: ThreadFilter;
}[] = [
  { key: 'unread', label: 'Unread', description: 'Threads with at least one unread message.', filter: { isRead: false } },
  {
    key: 'has_deadline',
    label: 'Has a date',
    description: 'A date of either kind appears in the thread.',
    filter: { hasDeadline: 'any' },
  },
  {
    key: 'has_attachment',
    label: 'Has an attachment',
    description: 'A file actually arrived in the thread.',
    filter: { hasAttachment: true },
  },
  {
    key: 'flagged',
    label: 'Security flagged',
    description: 'An advisory warning is attached.',
    filter: { securityFlagged: true },
  },
  {
    key: 'hide_bulk',
    label: 'Hide bulk',
    description: 'Removes newsletters and automated notifications.',
    filter: { includeBulk: false },
  },
];

const PAGE_SIZE = 10;

export const EmailAllPage: React.FC = () => {
  const { accountId, linkTo } = useOutletContext<EmailModuleContext>();
  const { allRecords, accountLabel, accountType, now, state, deferredCount } = useViewData(accountId);

  const [search, setSearch] = useState('');
  const [quick, setQuick] = useState<QuickFilterKey[]>([]);
  const [view, setView] = useState<SavedViewKey | ''>('');
  const [sort, setSort] = useState<AllEmailSort>({ key: 'priority', direction: 'desc' });
  const [page, setPage] = useState(0);

  const records = useMemo(() => {
    // All Email starts from everything, then narrows. The three default
    // exclusions are turned off here rather than left on.
    const base: ThreadFilter = {
      includeBulk: !quick.includes('hide_bulk'),
      includeDuplicates: true,
      includeResolved: true,
      ...(search.trim() ? { search: search.trim() } : {}),
    };
    const merged = quick.reduce<ThreadFilter>((acc, key) => {
      const q = QUICK_FILTERS.find((f) => f.key === key);
      return q ? { ...acc, ...q.filter } : acc;
    }, base);

    const narrowed = view ? runSavedView(allRecords, view, now, merged) : applyFilter(allRecords, merged);
    return sortAllEmail(narrowed, sort);
  }, [allRecords, quick, search, view, sort, now]);

  const paged = paginate(records, page, PAGE_SIZE);

  const onSort = (key: AllEmailSortKey) => {
    setPage(0);
    setSort((s) => {
      if (s.key !== key) {
        const column = ALL_EMAIL_COLUMNS.find((c) => c.key === key);
        return { key, direction: column?.firstClick ?? 'asc' };
      }
      return { key, direction: s.direction === 'asc' ? 'desc' : 'asc' };
    });
  };

  const toggleQuick = (key: QuickFilterKey) => {
    setPage(0);
    setQuick((q) => (q.includes(key) ? q.filter((x) => x !== key) : [...q, key]));
  };

  return (
    <ViewScaffold
      title="All Email"
      description="Every analysed thread on this account, including bulk, duplicates, resolved threads and anything deferred."
      state={state}
      count={records.length}
      emptyMessage="Nothing matches."
      emptyNote="Clear the search or a filter to widen the list."
      accountLabel={accountLabel}
      accountType={accountType}
      controls={
        <>
          <div className="ecc-all-controls">
            <div className="ecc-control ecc-control-search">
              <label className="ecc-control-label" htmlFor="ecc-all-search">
                Search this account
              </label>
              <div className="ecc-search-wrap">
                <Search size={14} aria-hidden="true" className="ecc-search-icon" />
                <input
                  id="ecc-all-search"
                  type="search"
                  className="ecc-input"
                  placeholder="Sender, subject or summary"
                  value={search}
                  onChange={(e) => {
                    setPage(0);
                    setSearch(e.target.value);
                  }}
                />
              </div>
            </div>

            {/*
              A sort control that does not depend on the table.
              Found in a screenshot review: at 390px the table becomes cards and
              the column headers go with it, which left a phone user unable to
              change the order at all. This control works at every width and
              stays in step with the headers.
            */}
            <div className="ecc-control">
              <label className="ecc-control-label" htmlFor="ecc-all-sort">
                Sort by
              </label>
              <select
                id="ecc-all-sort"
                className="ecc-select"
                value={`${sort.key}:${sort.direction}`}
                onChange={(e) => {
                  const [key, direction] = e.target.value.split(':') as [
                    AllEmailSortKey,
                    'asc' | 'desc',
                  ];
                  setPage(0);
                  setSort({ key, direction });
                }}
              >
                {ALL_EMAIL_COLUMNS.flatMap((c) => [
                  <option key={`${c.key}:asc`} value={`${c.key}:asc`}>
                    {c.label}, ascending
                  </option>,
                  <option key={`${c.key}:desc`} value={`${c.key}:desc`}>
                    {c.label}, descending
                  </option>,
                ])}
              </select>
            </div>

            <div className="ecc-control">
              <label className="ecc-control-label" htmlFor="ecc-all-view">
                Saved view
              </label>
              <select
                id="ecc-all-view"
                className="ecc-select"
                value={view}
                onChange={(e) => {
                  setPage(0);
                  setView(e.target.value as SavedViewKey | '');
                }}
              >
                <option value="">No saved view</option>
                {savedViews(now).map((v) => (
                  <option key={v.key} value={v.key}>
                    {v.label}
                  </option>
                ))}
              </select>
              <p className="ecc-control-note">
                {view
                  ? savedViews(now).find((v) => v.key === view)?.description
                  : 'A saved view narrows what is already shown. It never widens it.'}
              </p>
            </div>
          </div>

          <FilterChips
            legend="Narrow the list"
            options={QUICK_FILTERS.map((f) => ({
              key: f.key,
              label: f.label,
              description: f.description,
            }))}
            active={quick}
            onToggle={toggleQuick}
            onClear={() => {
              setPage(0);
              setQuick([]);
            }}
          />

          {deferredCount > 0 ? (
            <p className="ecc-legend-note">
              {deferredCount} thread{deferredCount === 1 ? '' : 's'} deferred this visit
              {deferredCount === 1 ? ' is' : ' are'} still listed here. Deferring hides a thread from
              the working queues; it never hides it from you.
            </p>
          ) : null}
        </>
      }
    >
      <ThreadTable
        records={paged.items}
        sort={sort}
        onSort={onSort}
        caption={`All email on the ${accountLabel} account, sorted by ${sort.key}`}
        linkTo={linkTo}
      />

      <nav className="ecc-pagination" aria-label="Pages of results">
        <p className="ecc-pagination-count" role="status">
          Showing {paged.from} to {paged.to} of {paged.totalItems}
        </p>
        <div className="ecc-pagination-buttons">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={paged.pageIndex === 0}
          >
            Previous
            <span className="ecc-visually-hidden"> page of results</span>
          </button>
          <span className="ecc-pagination-position">
            Page {paged.pageIndex + 1} of {paged.totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setPage((p) => Math.min(paged.totalPages - 1, p + 1))}
            disabled={paged.pageIndex >= paged.totalPages - 1}
          >
            Next
            <span className="ecc-visually-hidden"> page of results</span>
          </button>
        </div>
      </nav>
    </ViewScaffold>
  );
};
