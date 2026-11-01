import { describe, it, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { calculateEmailStatusFromDataset } from '../src/lib/email/sharedEmailStatus';
import { WORK_DATASET, PERSONAL_DATASET } from '../src/lib/email/data';
import { DEMO_NOW } from '../src/lib/email/data/clock';
import { metricCounts } from '../src/lib/email/aggregation';
import { composeOverview } from '../src/lib/email/overview';
import { recordsFor } from '../src/lib/email/filters';
import { getWeekBounds, getWeekDays } from '../src/pages/DashboardPage';
import { DashboardEmailCard } from '../src/components/dashboard/DashboardEmailCard';

describe('Task 2.1 & 3.1: Shared function returns identical counts for Dashboard and ECC', () => {
  it('produces identical counts from the shared function as ECC computes directly on WORK_DATASET', () => {
    // 1. Direct computation as done inside EmailOverviewPage.tsx:
    const records = recordsFor(WORK_DATASET);
    const countsList = metricCounts(records, DEMO_NOW);
    const page = composeOverview(records, DEMO_NOW);

    const eccNeedsReply = countsList.find((c) => c.key === 'replies_due')?.count ?? 0;
    const eccUnread = records.filter((r) => !r.thread.isRead).length;
    const eccFlagged = page.security.length;
    const eccProcessed = records.filter((r) => r.analysis.currentStatus === 'resolved').length;

    // 2. Computation via shared function:
    const sharedResult = calculateEmailStatusFromDataset(WORK_DATASET, DEMO_NOW);

    expect(sharedResult.counts.needsReply).toBe(eccNeedsReply);
    expect(sharedResult.counts.unread).toBe(eccUnread);
    expect(sharedResult.counts.flagged).toBe(eccFlagged);
    expect(sharedResult.counts.processedToday).toBe(eccProcessed);

    // Verify exact expected numbers on WORK_DATASET
    expect(sharedResult.counts.needsReply).toBe(9);
    expect(sharedResult.counts.unread).toBe(9);
    expect(sharedResult.counts.flagged).toBe(2);
    expect(sharedResult.counts.processedToday).toBe(2);
    expect(sharedResult.recentThreads.length).toBe(5);
  });

  it('produces identical counts on PERSONAL_DATASET', () => {
    const records = recordsFor(PERSONAL_DATASET);
    const countsList = metricCounts(records, DEMO_NOW);
    const page = composeOverview(records, DEMO_NOW);

    const eccNeedsReply = countsList.find((c) => c.key === 'replies_due')?.count ?? 0;
    const eccUnread = records.filter((r) => !r.thread.isRead).length;
    const eccFlagged = page.security.length;
    const eccProcessed = records.filter((r) => r.analysis.currentStatus === 'resolved').length;

    const sharedResult = calculateEmailStatusFromDataset(PERSONAL_DATASET, DEMO_NOW);

    expect(sharedResult.counts.needsReply).toBe(eccNeedsReply);
    expect(sharedResult.counts.unread).toBe(eccUnread);
    expect(sharedResult.counts.flagged).toBe(eccFlagged);
    expect(sharedResult.counts.processedToday).toBe(eccProcessed);

    expect(sharedResult.counts.needsReply).toBe(1);
    expect(sharedResult.counts.unread).toBe(1);
    expect(sharedResult.counts.flagged).toBe(0);
    expect(sharedResult.counts.processedToday).toBe(0);
  });
});

describe('Task 2.2 & 3.2: Error state and non-zero guarantee', () => {
  it('renders explicit error state with Retry button and never displays zeros on failure', () => {
    const errorStateOverride = {
      data: null,
      loading: false,
      error: new Error('Network timeout contacting mailbox'),
      refresh: () => {},
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <DashboardEmailCard statusOverride={errorStateOverride} />
      </MemoryRouter>
    );

    // Must show exact error string from brief:
    expect(markup).toContain('Could not load email status. Try again');
    expect(markup).toContain('Retry');

    // Must NOT render four stat tiles showing 0:
    expect(markup).not.toContain('data-testid="stat-tile-need-reply"');
    expect(markup).not.toContain('data-testid="stat-tile-unread"');
  });

  it('renders loading placeholder during initial fetch without showing false zeros', () => {
    const loadingStateOverride = {
      data: null,
      loading: true,
      error: null,
      refresh: () => {},
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <DashboardEmailCard statusOverride={loadingStateOverride} />
      </MemoryRouter>
    );

    expect(markup).toContain('data-testid="email-card-loading-state"');
    expect(markup).toContain('Loading email threads...');
    expect(markup).not.toContain('data-testid="stat-tile-need-reply"');
  });

  it('renders authentic stat counts and recent thread links when data is loaded', () => {
    const sharedResult = calculateEmailStatusFromDataset(WORK_DATASET, DEMO_NOW);
    const readyStateOverride = {
      data: {
        ...sharedResult,
        accountId: WORK_DATASET.account.id,
        accountLabel: WORK_DATASET.account.label,
        hasLiveAccounts: false,
      },
      loading: false,
      error: null,
      refresh: () => {},
    };

    const markup = renderToStaticMarkup(
      <MemoryRouter>
        <DashboardEmailCard statusOverride={readyStateOverride} />
      </MemoryRouter>
    );

    expect(markup).toContain('Work');
    expect(markup).toContain('/email/reply-queue');
    expect(markup).toContain('9'); // needsReply count
    expect(markup).toContain('/email/thread/');
  });
});

describe('Task 2.6 & 3.3: Week Overview on Sunday and Wednesday (Melbourne date)', () => {
  it('shows coming Monday to Friday when evaluated on Sunday in Melbourne', () => {
    // Sunday 1 November 2026 at 18:00 Melbourne time (07:00 UTC)
    const sundayDate = new Date('2026-11-01T07:00:00Z');

    const bounds = getWeekBounds(sundayDate);
    // On Sunday 1 Nov, it must show the coming week: Monday 2 Nov to Friday 6 Nov
    expect(bounds.weekStart).toBe('2026-11-02');
    expect(bounds.weekEnd).toBe('2026-11-06');

    const days = getWeekDays(sundayDate);
    expect(days).toHaveLength(5);
    expect(days[0].label).toBe('Mon');
    expect(days[0].dateStr).toBe('2026-11-02');
    expect(days[0].isToday).toBe(false);

    expect(days[4].label).toBe('Fri');
    expect(days[4].dateStr).toBe('2026-11-06');
    expect(days[4].isToday).toBe(false);

    // No day is marked today since today is Sunday
    expect(days.some((d) => d.isToday)).toBe(false);
  });

  it('shows current Monday to Friday when evaluated on Wednesday in Melbourne', () => {
    // Wednesday 4 November 2026 at 14:00 Melbourne time (03:00 UTC)
    const wednesdayDate = new Date('2026-11-04T03:00:00Z');

    const bounds = getWeekBounds(wednesdayDate);
    expect(bounds.weekStart).toBe('2026-11-02');
    expect(bounds.weekEnd).toBe('2026-11-06');

    const days = getWeekDays(wednesdayDate);
    expect(days).toHaveLength(5);
    expect(days[0].dateStr).toBe('2026-11-02');
    expect(days[0].isToday).toBe(false);

    expect(days[2].label).toBe('Wed');
    expect(days[2].dateStr).toBe('2026-11-04');
    expect(days[2].isToday).toBe(true);

    expect(days[4].dateStr).toBe('2026-11-06');
    expect(days[4].isToday).toBe(false);
  });
});
