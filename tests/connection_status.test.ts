import { describe, test, expect } from 'bun:test';
import {
  CONNECTION_STATUSES,
  CONNECTION_STATUS_META,
  normaliseStatus,
  isUsable,
  needsRecheck,
  describeStatus,
  lastCheckedText,
  statusSortRank,
} from '../app/src/lib/integrations/connectionStatus';

const verified = { status: 'connected', verified_at: '2026-10-06T00:43:00Z', last_test_at: '2026-10-06T00:43:00Z', last_test_result: 'success' };

describe('Connection status: never show Connected without evidence', () => {
  test('connected with evidence is usable and green', () => {
    expect(normaliseStatus(verified)).toBe('connected');
    expect(isUsable(verified)).toBe(true);
    expect(describeStatus(verified).label).toBe('Connected and verified');
    expect(describeStatus(verified).tone).toBe('ok');
  });

  test('connected without verified_at is shown as not verified', () => {
    const fake = { status: 'connected' };
    expect(normaliseStatus(fake)).toBe('unverified');
    expect(isUsable(fake)).toBe(false);
    expect(describeStatus(fake).label).toBe('Not verified');
  });

  test('connected with a failed last test is not usable', () => {
    expect(isUsable({ ...verified, last_test_result: 'failed' })).toBe(false);
  });

  test('legacy values map to the new vocabulary', () => {
    expect(normaliseStatus({ status: 'needs_reauth' })).toBe('reauth_required');
    expect(normaliseStatus({ status: 'service_issue' })).toBe('provider_unavailable');
    expect(normaliseStatus({ status: 'setup_required' })).toBe('not_connected');
    expect(normaliseStatus({ status: 'something_new' })).toBe('unverified');
  });

  test('only one status is green', () => {
    const green = CONNECTION_STATUSES.filter((s) => CONNECTION_STATUS_META[s].tone === 'ok');
    expect(green).toEqual(['connected']);
  });

  test('every status has a label, a sentence, and no dashes', () => {
    for (const s of CONNECTION_STATUSES) {
      const m = CONNECTION_STATUS_META[s];
      expect(m.label.length).toBeGreaterThan(0);
      expect(m.description.length).toBeGreaterThan(0);
      expect(`${m.label} ${m.description} ${m.actionLabel || ''}`).not.toMatch(/[\u2013\u2014]/);
    }
  });

  test('a check older than 24 hours needs a re-test before activation', () => {
    const now = new Date('2026-10-07T01:00:00Z');
    expect(needsRecheck(verified, now)).toBe(true);
    expect(needsRecheck(verified, new Date('2026-10-06T05:00:00Z'))).toBe(false);
    expect(needsRecheck({ status: 'unverified' })).toBe(true);
  });

  test('last checked is written in Australian English, in Melbourne time', () => {
    expect(lastCheckedText(verified)).toBe('Last checked 6 Oct 2026, 11:43 am');
    expect(lastCheckedText({ status: 'unverified' })).toBe('Never checked');
  });

  test('problems sort first, verified before untouched', () => {
    const rows = [
      { status: 'not_connected' },
      verified,
      { status: 'unverified' },
      { status: 'reauth_required' },
      { status: 'failed' },
    ];
    const order = [...rows].sort((a, b) => statusSortRank(a) - statusSortRank(b)).map((r) => normaliseStatus(r));
    expect(order).toEqual(['failed', 'reauth_required', 'unverified', 'connected', 'not_connected']);
  });
});
