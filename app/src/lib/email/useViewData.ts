/**
 * What every operational view needs, in one hook.
 *
 * It resolves the account, builds the thread records, applies the session's
 * deferrals, and works out which of the four states the view is in.
 *
 * The state can be forced with `?demo=loading`, `?demo=empty` or `?demo=error`.
 * That is how the loading, empty and error states are reviewed and tested
 * without a network: the four states are part of the product, and a state that
 * cannot be reached is a state nobody has ever looked at.
 */
import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { AsyncState } from './types';
import { ThreadRecord, recordsFor } from './filters';
import { getDataset } from './data';
import { DEMO_NOW } from './data/clock';
import { useLocalActions, withoutDeferred } from './localActions';

export interface ViewData {
  /** Null when the requested account does not exist. */
  dataset: ReturnType<typeof getDataset>;
  /** Every thread on the account, minus anything deferred this visit. */
  records: ThreadRecord[];
  /** Before deferrals. All Email uses this: a deferred thread is still findable. */
  allRecords: ThreadRecord[];
  accountLabel: string;
  accountType: 'work' | 'personal';
  now: string;
  /** 'ready' unless forced, or 'error' when the account is unknown. */
  state: AsyncState;
  deferredCount: number;
}

export function useViewData(accountId: string): ViewData {
  const location = useLocation();
  const { deferred, ignored } = useLocalActions();

  const forced = new URLSearchParams(location.search).get('demo');
  const dataset = useMemo(() => getDataset(accountId), [accountId]);

  const allRecords = useMemo(() => {
    if (!dataset) return [];
    const base = recordsFor(dataset);
    return base.filter((r) => !ignored.includes(r.thread.id));
  }, [dataset, ignored]);
  const records = useMemo(() => withoutDeferred(allRecords, deferred), [allRecords, deferred]);

  // An unknown account is an error, never an empty list. Silence and zero must
  // not look the same: one means nothing to do, the other means something is
  // wrong and the person is being shown nothing without being told.
  const state: AsyncState = !dataset
    ? 'error'
    : forced === 'loading' || forced === 'empty' || forced === 'error'
      ? (forced as AsyncState)
      : 'ready';

  return {
    dataset,
    records: state === 'empty' ? [] : records,
    allRecords: state === 'empty' ? [] : allRecords,
    accountLabel: dataset?.account.label ?? 'Unknown account',
    accountType: dataset?.account.accountType ?? 'work',
    now: DEMO_NOW,
    state,
    deferredCount: deferred.length,
  };
}
