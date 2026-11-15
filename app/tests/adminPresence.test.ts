import { describe, it, expect } from 'bun:test';
import {
  formatMelbourneTime,
  formatRelativeTime,
  parseUserAgent,
  fetchAdminPresence,
  subscribeToAdminPresence,
} from '../src/lib/enterprise/adminPresenceClient';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Admin Presence & Real-Time Activity Suite', () => {
  it('PRES-1: formats timestamps accurately into Australia/Melbourne time', () => {
    // 2026-11-15T06:48:00Z is 2026-11-15 17:48:00 in AEDT (UTC+11)
    const formatted = formatMelbourneTime('2026-11-15T06:48:00Z');
    expect(formatted).toContain('15 Nov 2026');
    expect(formatted).toContain('5:48');
    expect(formatted).toContain('pm');
  });

  it('PRES-2: handles null or invalid timestamps gracefully', () => {
    expect(formatMelbourneTime(null)).toBe('Not recorded');
    expect(formatMelbourneTime(undefined)).toBe('Not recorded');
    expect(formatMelbourneTime('invalid-date-string')).toBe('Not recorded');
    expect(formatRelativeTime(null)).toBe('Never');
    expect(formatRelativeTime(undefined)).toBe('Never');
  });

  it('PRES-3: computes human-readable relative time offsets', () => {
    const now = Date.now();
    const tenSecAgo = new Date(now - 10 * 1000).toISOString();
    const twoMinAgo = new Date(now - 2 * 60 * 1000).toISOString();
    const threeHoursAgo = new Date(now - 3 * 60 * 60 * 1000).toISOString();

    expect(formatRelativeTime(tenSecAgo)).toBe('Just now');
    expect(formatRelativeTime(twoMinAgo)).toBe('2 mins ago');
    expect(formatRelativeTime(threeHoursAgo)).toBe('3 hrs ago');
  });

  it('PRES-4: accurately parses client browser, platform, and automated test environments', () => {
    // Windows Chrome
    const winChrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36';
    const parsedWin = parseUserAgent(winChrome);
    expect(parsedWin.browser).toBe('Google Chrome');
    expect(parsedWin.os).toBe('Windows 10/11');
    expect(parsedWin.isAutomated).toBe(false);

    // Headless Chrome (Playwright / Puppeteer / CI test)
    const headlessLinux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/156.0.0.0 Safari/537.36';
    const parsedHeadless = parseUserAgent(headlessLinux);
    expect(parsedHeadless.browser).toBe('Headless Chrome (Automated / Test)');
    expect(parsedHeadless.os).toBe('Linux');
    expect(parsedHeadless.isAutomated).toBe(true);

    // Safari on macOS
    const macSafari = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
    const parsedMac = parseUserAgent(macSafari);
    expect(parsedMac.browser).toBe('Apple Safari');
    expect(parsedMac.os).toBe('macOS');
    expect(parsedMac.isAutomated).toBe(false);
  });

  it('PRES-5: RPC fetchAdminPresence handles Supabase client calls correctly', async () => {
    const mockData = [
      {
        user_id: '91c086e8-d2d0-4060-9a7c-650e13d2245e',
        role: 'organization_owner',
        joined_at: '2026-09-18T02:47:50Z',
        email: 'hello@concludo.au',
        full_name: 'Anthony Cortez',
        last_sign_in_at: '2026-11-06T23:44:59Z',
        last_seen_at: '2026-11-15T06:48:06Z',
        current_status: 'online',
        current_path: '/admin',
        recent_sessions: [],
      },
    ];

    const mockSupabase: any = {
      rpc: async (fnName: string, args: any) => {
        expect(fnName).toBe('get_organization_admin_presence');
        expect(args.p_org_id).toBe('test-org-123');
        return { data: mockData, error: null };
      },
    };

    const result = await fetchAdminPresence(mockSupabase, 'test-org-123');
    expect(result.error).toBeNull();
    expect(result.data.length).toBe(1);
    expect(result.data[0].email).toBe('hello@concludo.au');
    expect(result.data[0].current_status).toBe('online');
  });

  it('PRES-7: presence channel track payload does not include email or private location paths', async () => {
    let trackedPayload: any = null;
    const mockChannel: any = {
      on: () => mockChannel,
      subscribe: (callback?: (status: string) => void) => {
        if (callback) callback('SUBSCRIBED');
        return mockChannel;
      },
      track: async (payload: any) => {
        trackedPayload = payload;
      },
      presenceState: () => ({}),
      untrack: () => {},
    };

    const mockSupabase: any = {
      getChannels: () => [],
      channel: () => mockChannel,
      removeChannel: () => {},
      rpc: async () => ({ data: null, error: null }),
    };

    const teardown = subscribeToAdminPresence(
      mockSupabase,
      'test-org-123',
      { id: 'user-xyz-123' },
      () => {},
      () => {}
    );

    expect(trackedPayload).not.toBeNull();
    expect(trackedPayload.user_id).toBe('user-xyz-123');
    expect(trackedPayload.online_at).toBeDefined();
    expect(trackedPayload.email).toBeUndefined();
    expect(trackedPayload.current_path).toBeUndefined();

    teardown();
  });

  it('PRES-8: multi-client presence transitions update online set dynamically', () => {
    let syncCb: any = null;
    let joinCb: any = null;
    let leaveCb: any = null;
    let currentMockState: Record<string, any> = {};

    const mockChannel: any = {
      on: (type: string, opts: any, callback: any) => {
        if (opts.event === 'sync') syncCb = callback;
        if (opts.event === 'join') joinCb = callback;
        if (opts.event === 'leave') leaveCb = callback;
        return mockChannel;
      },
      subscribe: () => mockChannel,
      track: async () => {},
      presenceState: () => currentMockState,
      untrack: () => {},
    };

    const mockSupabase: any = {
      getChannels: () => [],
      channel: () => mockChannel,
      removeChannel: () => {},
      rpc: async () => ({ data: null, error: null }),
    };

    const onlineSnapshots: Set<string>[] = [];
    const teardown = subscribeToAdminPresence(
      mockSupabase,
      'test-org-123',
      { id: 'admin-1' },
      (activeIds) => {
        onlineSnapshots.push(new Set(activeIds));
      },
      () => {}
    );

    // 1. Initial sync with admin-1
    currentMockState = { 'admin-1': [{ user_id: 'admin-1' }] };
    syncCb();
    expect(onlineSnapshots[onlineSnapshots.length - 1].has('admin-1')).toBe(true);
    expect(onlineSnapshots[onlineSnapshots.length - 1].has('admin-2')).toBe(false);

    // 2. Admin-2 joins
    joinCb({ key: 'admin-2' });
    expect(onlineSnapshots[onlineSnapshots.length - 1].has('admin-1')).toBe(true);
    expect(onlineSnapshots[onlineSnapshots.length - 1].has('admin-2')).toBe(true);

    // 3. Admin-1 leaves
    leaveCb({ key: 'admin-1' });
    expect(onlineSnapshots[onlineSnapshots.length - 1].has('admin-1')).toBe(false);
    expect(onlineSnapshots[onlineSnapshots.length - 1].has('admin-2')).toBe(true);

    teardown();
  });

  it('PRES-6: enforces zero em dashes and zero en dashes across presence modules', () => {
    const clientPath = resolve(import.meta.dir, '../src/lib/enterprise/adminPresenceClient.ts');
    const tabPath = resolve(import.meta.dir, '../src/components/admin/AdminPresenceTab.tsx');

    const clientSrc = readFileSync(clientPath, 'utf8');
    const tabSrc = readFileSync(tabPath, 'utf8');

    expect(clientSrc.includes('\u2014')).toBe(false);
    expect(clientSrc.includes('\u2013')).toBe(false);
    expect(tabSrc.includes('\u2014')).toBe(false);
    expect(tabSrc.includes('\u2013')).toBe(false);
  });
});
