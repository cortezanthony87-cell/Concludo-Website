import { describe, expect, it } from 'bun:test';
import {
  formatDashboardDate,
  getTimeBasedSalutation,
  getWelcomeGreeting,
  resolveUserTimezone,
} from '../src/lib/dashboard/greeting';

describe('Timezone-Aware Greeting & Date Formatter', () => {
  it('resolves valid configured timezone, browser timezone, and default fallback', () => {
    expect(resolveUserTimezone('America/New_York')).toBe('America/New_York');
    expect(resolveUserTimezone('Australia/Melbourne')).toBe('Australia/Melbourne');
    expect(resolveUserTimezone('UTC')).toBe('UTC');
    // Invalid timezone falls back cleanly
    const fallback = resolveUserTimezone('Invalid/Timezone_Name');
    expect(typeof fallback).toBe('string');
    expect(fallback.length).toBeGreaterThan(0);
  });

  it('accurately distinguishes Good morning, Good afternoon, and Good evening in Melbourne', () => {
    // 08:51 UTC on 2026-11-01 is 19:51 (7:51 PM) in Melbourne (UTC+11, AEDT)
    const melbourneEvening = new Date('2026-11-01T08:51:00Z');
    expect(getTimeBasedSalutation(melbourneEvening, 'Australia/Melbourne')).toBe('Good evening');

    // 00:00 UTC on 2026-11-01 is 11:00 AM in Melbourne
    const melbourneMorning = new Date('2026-11-01T00:00:00Z');
    expect(getTimeBasedSalutation(melbourneMorning, 'Australia/Melbourne')).toBe('Good morning');

    // 03:30 UTC on 2026-11-01 is 14:30 (2:30 PM) in Melbourne
    const melbourneAfternoon = new Date('2026-11-01T03:30:00Z');
    expect(getTimeBasedSalutation(melbourneAfternoon, 'Australia/Melbourne')).toBe('Good afternoon');

    // 13:00 UTC on 2026-11-01 is 00:00 (Midnight) next day in Melbourne
    const melbourneMidnight = new Date('2026-11-01T13:00:00Z');
    expect(getTimeBasedSalutation(melbourneMidnight, 'Australia/Melbourne')).toBe('Good morning');
  });

  it('accurately respects a user located in New York at the exact same instant', () => {
    // At 08:51 UTC on 2026-11-01:
    // Melbourne (AEDT, UTC+11) is 19:51 (7:51 PM) -> Good evening
    // New York (EDT, UTC-4) is 04:51 (4:51 AM) -> Good morning
    const instant = new Date('2026-11-01T08:51:00Z');

    expect(getTimeBasedSalutation(instant, 'Australia/Melbourne')).toBe('Good evening');
    expect(getTimeBasedSalutation(instant, 'America/New_York')).toBe('Good morning');

    expect(getWelcomeGreeting('Anthony Cortez', instant, 'Australia/Melbourne')).toBe(
      'Good evening, Anthony Cortez'
    );
    expect(getWelcomeGreeting('Sarah Jenkins', instant, 'America/New_York')).toBe(
      'Good morning, Sarah Jenkins'
    );
  });

  it('formats welcome greeting with and without full name', () => {
    const eveningDate = new Date('2026-11-01T08:51:00Z');
    expect(getWelcomeGreeting('Anthony', eveningDate, 'Australia/Melbourne')).toBe('Good evening, Anthony');
    expect(getWelcomeGreeting('  Anthony Cortez  ', eveningDate, 'Australia/Melbourne')).toBe(
      'Good evening, Anthony Cortez'
    );
    expect(getWelcomeGreeting(null, eveningDate, 'Australia/Melbourne')).toBe('Good evening');
    expect(getWelcomeGreeting('', eveningDate, 'Australia/Melbourne')).toBe('Good evening');
  });

  it('formats dashboard date according to target timezone without timezone shift errors', () => {
    // 2026-11-01T14:00:00Z:
    // In Melbourne (UTC+11): 2026-11-02 01:00 AM (Monday, 2 November 2026)
    // In New York (UTC-4): 2026-11-01 10:00 AM (Sunday, 1 November 2026)
    const transitionDate = new Date('2026-11-01T14:00:00Z');

    const melbDateStr = formatDashboardDate(transitionDate, 'Australia/Melbourne');
    const nyDateStr = formatDashboardDate(transitionDate, 'America/New_York');

    expect(melbDateStr).toContain('Monday');
    expect(melbDateStr).toContain('2 November 2026');

    expect(nyDateStr).toContain('Sunday');
    expect(nyDateStr).toContain('1 November 2026');
  });
});
