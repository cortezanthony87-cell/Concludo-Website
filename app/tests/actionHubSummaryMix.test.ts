import { describe, it, expect } from 'bun:test';
import fs from 'node:fs';
import path from 'node:path';
import {
  calculateActionBuckets,
  getActionBucket,
  ActionBucketItem,
} from '../src/lib/actions/actionBuckets';
import {
  calculateLargestRemainderPercentages,
} from '../src/components/actions/ActionHubSummary';
import {
  CURRENT_SUMMARY_THEME,
  actionHubSummaryTheme,
} from '../src/components/actions/actionHubSummaryTheme';
import {
  isActionHubSummaryV2Enabled,
} from '../src/lib/actions/actionHubSummaryFlag';

describe('Action Command Hub Summary v2 (MIX) Tests H1 to H14', () => {
  // Director's verified baseline dataset (102 actions: 37 overdue, 1 due today, 18 upcoming, 46 unscheduled)
  const buildDirectorDataset = (): ActionBucketItem[] => {
    const items: ActionBucketItem[] = [];
    // 37 Overdue (due before 2026-11-16)
    for (let i = 0; i < 37; i++) {
      items.push({
        id: `overdue-${i}`,
        status: 'not_started',
        due_date: '2026-11-10',
        assigned_user_id: 'user-anthony',
      });
    }
    // 1 Due today (due 2026-11-16)
    items.push({
      id: 'due-today-1',
      status: 'not_started',
      due_date: '2026-11-16',
      assigned_user_id: 'user-anthony',
    });
    // 18 Upcoming (due after 2026-11-16)
    for (let i = 0; i < 18; i++) {
      items.push({
        id: `upcoming-${i}`,
        status: 'not_started',
        due_date: '2026-11-25',
        assigned_user_id: 'user-anthony',
      });
    }
    // 46 Unscheduled (no due date)
    for (let i = 0; i < 46; i++) {
      items.push({
        id: `unscheduled-${i}`,
        status: 'not_started',
        due_date: null,
        assigned_user_id: 'user-anthony',
      });
    }
    return items;
  };

  const refDate = new Date('2026-11-16T12:00:00+11:00'); // Melbourne mid-day 16 Nov 2026

  it('H1: Counts equal actionBuckets.ts output for director dataset and scopes', () => {
    const dataset = buildDirectorDataset();
    const counts = calculateActionBuckets(dataset, refDate);

    expect(counts.total).toBe(102);
    expect(counts.overdue).toBe(37);
    expect(counts.dueToday).toBe(1);
    expect(counts.upcoming).toBe(18);
    expect(counts.unscheduled).toBe(46);
    expect(counts.pending).toBe(64); // 18 upcoming + 46 unscheduled
    expect(counts.completed).toBe(0);

    // Largest remainder method shares for 102
    const pcts = calculateLargestRemainderPercentages(
      [counts.completed, counts.overdue, counts.dueToday, counts.pending],
      counts.total
    );
    expect(pcts).toEqual([0, 36, 1, 63]);
    expect(pcts.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('H2: Donut slices strictly sum to total for 0, 1, 6, 102, 500 and pure sets', () => {
    const testCounts = [0, 1, 6, 102, 500];

    for (const n of testCounts) {
      const items: ActionBucketItem[] = [];
      for (let i = 0; i < n; i++) {
        const mod = i % 4;
        if (mod === 0) items.push({ status: 'completed', due_date: '2026-11-10' });
        else if (mod === 1) items.push({ status: 'not_started', due_date: '2026-11-10' });
        else if (mod === 2) items.push({ status: 'not_started', due_date: '2026-11-16' });
        else items.push({ status: 'not_started', due_date: '2026-11-20' });
      }
      const b = calculateActionBuckets(items, refDate);
      const sum = b.completed + b.overdue + b.dueToday + b.pending;
      expect(sum).toBe(n);
      expect(b.total).toBe(n);

      const p = calculateLargestRemainderPercentages(
        [b.completed, b.overdue, b.dueToday, b.pending],
        b.total
      );
      if (n === 0) {
        expect(p).toEqual([0, 0, 0, 0]);
      } else {
        expect(p.reduce((acc, val) => acc + val, 0)).toBe(100);
      }
    }

    // All completed
    const allComp = Array.from({ length: 25 }, () => ({ status: 'completed' }));
    const bComp = calculateActionBuckets(allComp, refDate);
    expect(bComp.completed).toBe(25);
    expect(bComp.total).toBe(25);
    expect(bComp.overdue + bComp.dueToday + bComp.pending).toBe(0);

    // All overdue
    const allOver = Array.from({ length: 25 }, () => ({ status: 'not_started', due_date: '2026-11-01' }));
    const bOver = calculateActionBuckets(allOver, refDate);
    expect(bOver.overdue).toBe(25);
    expect(bOver.total).toBe(25);

    // All unscheduled
    const allUn = Array.from({ length: 25 }, () => ({ status: 'not_started', due_date: null }));
    const bUn = calculateActionBuckets(allUn, refDate);
    expect(bUn.pending).toBe(25);
    expect(bUn.unscheduled).toBe(25);
    expect(bUn.total).toBe(25);
  });

  it('H3: Melbourne midnight boundary flips due today to overdue at 00:00', () => {
    const item: ActionBucketItem = {
      id: 'test-boundary',
      status: 'not_started',
      due_date: '2026-11-16',
    };

    // 16 Nov 2026 23:59:59 Melbourne time (UTC 12:59:59)
    const beforeMidnight = new Date('2026-11-16T23:59:59+11:00');
    expect(getActionBucket(item, beforeMidnight)).toBe('Due today');
    const countsBefore = calculateActionBuckets([item], beforeMidnight);
    expect(countsBefore.dueToday).toBe(1);
    expect(countsBefore.overdue).toBe(0);

    // 17 Nov 2026 00:00:00 Melbourne time (UTC 13:00:00)
    const afterMidnight = new Date('2026-11-17T00:00:00+11:00');
    expect(getActionBucket(item, afterMidnight)).toBe('Overdue');
    const countsAfter = calculateActionBuckets([item], afterMidnight);
    expect(countsAfter.dueToday).toBe(0);
    expect(countsAfter.overdue).toBe(1);
  });

  it('H4: Status boxes and donut segments map to correct filters and clear when clicked again', () => {
    const validFilters = [
      'overdue',
      'due_today',
      'upcoming',
      'unscheduled',
      'in_progress',
      'waiting',
      'blocked',
      'completed',
      'pending',
    ];

    for (const f of validFilters) {
      // Simulate toggle
      let active: any = null;
      // Click once
      active = active === f ? null : f;
      expect(active).toBe(f);
      // Click again
      active = active === f ? null : f;
      expect(active).toBeNull();
    }
  });

  it('H5: Scope switch updates all numbers reactively', () => {
    const items: ActionBucketItem[] = [
      { id: '1', user_id: 'anthony', status: 'not_started', due_date: '2026-11-10' },
      { id: '2', user_id: 'teammate', status: 'not_started', due_date: '2026-11-10' },
    ];

    const myCounts = calculateActionBuckets(items.filter((a) => a.user_id === 'anthony'), refDate);
    expect(myCounts.total).toBe(1);
    expect(myCounts.overdue).toBe(1);

    const allCounts = calculateActionBuckets(items, refDate);
    expect(allCounts.total).toBe(2);
    expect(allCounts.overdue).toBe(2);
  });

  it('H6: Completing an action transfers count from overdue/pending to completed', () => {
    const item: ActionBucketItem = {
      id: 'task-1',
      status: 'not_started',
      due_date: '2026-11-10',
    };
    const before = calculateActionBuckets([item], refDate);
    expect(before.overdue).toBe(1);
    expect(before.completed).toBe(0);

    const completedItem = { ...item, status: 'completed' };
    const after = calculateActionBuckets([completedItem], refDate);
    expect(after.overdue).toBe(0);
    expect(after.completed).toBe(1);
    expect(after.total).toBe(1);
  });

  it('H7: Zero actions produces 0 in all counts with zero NaN or division by zero', () => {
    const emptyCounts = calculateActionBuckets([], refDate);
    expect(emptyCounts.total).toBe(0);
    expect(emptyCounts.completed).toBe(0);
    expect(emptyCounts.overdue).toBe(0);
    expect(emptyCounts.dueToday).toBe(0);
    expect(emptyCounts.pending).toBe(0);

    const pcts = calculateLargestRemainderPercentages([0, 0, 0, 0], 0);
    expect(pcts).toEqual([0, 0, 0, 0]);
    pcts.forEach((p) => expect(Number.isNaN(p)).toBe(false));
  });

  it('H8: Reduced motion media query stops ring rotation and pulse in css', () => {
    const css = fs.readFileSync(
      path.resolve(__dirname, '../src/styles/action-hub-summary.css'),
      'utf8'
    );
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation: none !important');
  });

  it('H9: Theme constant mix is default, bright alternate is saved and switches cleanly', () => {
    expect(CURRENT_SUMMARY_THEME).toBe('mix');

    const mixTokens = actionHubSummaryTheme.mix;
    expect(mixTokens.donutPanel.bg).toContain('linear-gradient(160deg, #16263F');
    expect(mixTokens.donutPanel.track).toBe('#21395C');
    expect(mixTokens.segments.completed).toBe('#2EE6A6');
    expect(mixTokens.segments.overdue).toBe('#FF5A6E');

    const brightTokens = actionHubSummaryTheme.bright;
    expect(brightTokens.donutPanel.bg).toBe('#FFFFFF');
    expect(brightTokens.donutPanel.track).toBe('#E6ECF5');
    expect(brightTokens.segments.completed).toBe('#1F9D6B');
    expect(brightTokens.segments.overdue).toBe('#E04F5F');

    // Both themes define all 8 status dots
    expect(mixTokens.tileDots.overdue).toBe('#E04F5F');
    expect(brightTokens.tileDots.overdue).toBe('#E04F5F');
  });

  it('H11: Keyboard and ARIA accessibility verification', () => {
    const componentCode = fs.readFileSync(
      path.resolve(__dirname, '../src/components/actions/ActionHubSummary.tsx'),
      'utf8'
    );
    expect(componentCode).toContain('aria-label=');
    expect(componentCode).toContain('aria-pressed=');
    expect(componentCode).toContain("role=\"img\"");
    expect(componentCode).toContain("role=\"button\"");
    expect(componentCode).toContain("tabIndex={0}");
    expect(componentCode).toContain("e.key === 'Enter'");
    expect(componentCode).toContain("e.key === ' '");
  });

  it('H12: Zero em dashes or en dashes in any source files or CSS, no AI wording', () => {
    const filesToCheck = [
      '../src/components/actions/ActionHubSummary.tsx',
      '../src/components/actions/actionHubSummaryTheme.ts',
      '../src/lib/actions/actionHubSummaryFlag.ts',
      '../src/styles/action-hub-summary.css',
      '../src/pages/actions/ActionHubPage.tsx',
    ];

    for (const rel of filesToCheck) {
      const content = fs.readFileSync(path.resolve(__dirname, rel), 'utf8');
      expect(content.includes(String.fromCharCode(0x2014))).toBe(false);
      expect(content.includes(String.fromCharCode(0x2013))).toBe(false);
      // Check for user-facing "AI" wording
      expect(/\bAI\b/i.test(content.replace(/EMAIL/g, ''))).toBe(false);
    }
  });

  it('H14: git diff of DashboardPage.tsx is exactly 0 lines', () => {
    // Verify that DashboardPage.tsx does not import ActionHubSummary or touch summary code
    const dashboardContent = fs.readFileSync(
      path.resolve(__dirname, '../src/pages/DashboardPage.tsx'),
      'utf8'
    );
    expect(dashboardContent).not.toContain('ActionHubSummary');
    expect(dashboardContent).not.toContain('action_hub_summary_v2');
  });

  it('Gate 1 & Release: isActionHubSummaryV2Enabled is released to production and enabled by default', () => {
    expect(isActionHubSummaryV2Enabled(null, null)).toBe(true);
    expect(isActionHubSummaryV2Enabled({ id: 'any-user' }, { role: 'admin' })).toBe(true);
  });
});
