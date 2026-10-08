import { describe, test, expect } from 'bun:test';
import {
  appCardState,
  connectPanelCopy,
  independenceLine,
  sortCatalogue,
  connectedCount,
  normaliseAvailability,
  type CatalogueApp,
} from '../app/src/lib/integrations/appCatalogue';

const outlook: CatalogueApp = {
  id: 'microsoft_outlook', name: 'Outlook email', category: 'Email',
  description: 'Send follow-up emails from your Outlook mailbox after you approve them in Concludo.',
  provider_family: 'microsoft', availability: 'available', sort_order: 10,
};
const sheets: CatalogueApp = {
  id: 'google_sheets', name: 'Google Sheets', category: 'Spreadsheets',
  description: 'Add approved action items as rows in a Google Sheet you pick.',
  provider_family: 'google', availability: 'coming_soon', sort_order: 32,
};
const chat: CatalogueApp = {
  id: 'google_chat', name: 'Google Chat', category: 'Messaging', description: 'x',
  provider_family: 'google', availability: 'not_planned', availability_note: 'Not planned this year.', sort_order: 42,
};
const verified = { status: 'connected', verified_at: '2026-10-08T00:00:00Z', last_test_at: '2026-10-08T00:00:00Z', last_test_result: 'success' };

describe('App cards never promise more than the server has proven', () => {
  test('coming soon app offers to notify, never to connect', () => {
    const s = appCardState(sheets);
    expect(s.badge).toBe('Coming soon');
    expect(s.action).toBe('notify');
    expect(s.tone).not.toBe('ok');
  });

  test('coming soon app already requested shows no button', () => {
    expect(appCardState(sheets, null, true).action).toBe('none');
  });

  test('coming soon app stays coming soon even if a connection row claims connected', () => {
    expect(appCardState(sheets, verified).badge).toBe('Coming soon');
  });

  test('not planned app has no action', () => {
    expect(appCardState(chat).action).toBe('none');
  });

  test('available app with no connection shows Connect', () => {
    const s = appCardState(outlook);
    expect(s.action).toBe('connect');
    expect(s.actionLabel).toBe('Connect');
  });

  test('available app is green only with verification evidence', () => {
    expect(appCardState(outlook, verified).tone).toBe('ok');
    expect(appCardState(outlook, { status: 'connected' }).tone).not.toBe('ok');
    expect(appCardState(outlook, { status: 'connected' }).badge).toBe('Not verified');
  });

  test('expired sign-in asks to reconnect', () => {
    expect(appCardState(outlook, { status: 'reauth_required' }).action).toBe('reconnect');
  });

  test('unknown availability is treated as coming soon', () => {
    expect(normaliseAvailability('maybe')).toBe('coming_soon');
    expect(normaliseAvailability(undefined)).toBe('coming_soon');
  });
});

describe('Copy', () => {
  test('panel names the real sign-in page', () => {
    expect(connectPanelCopy(outlook).body[0]).toContain("Microsoft's own page");
    expect(connectPanelCopy(sheets).body[0]).toContain("Google's own page");
    expect(connectPanelCopy(outlook).primary).toBe('Continue to Microsoft sign-in');
  });

  test('coming soon panel never says the app is unsupported in the same breath as signing in', () => {
    const body = connectPanelCopy(sheets).body.join(' ');
    expect(body).not.toContain('does not support');
    expect(connectPanelCopy(sheets).title).toBe('Google Sheets is coming soon');
  });

  test('no em or en dashes anywhere', () => {
    const all = [outlook, sheets, chat].flatMap((a) => {
      const p = connectPanelCopy(a);
      const c = appCardState(a);
      return [p.title, ...p.body, p.primary || '', c.badge, c.detail, c.actionLabel || ''];
    }).concat(independenceLine()).join(' ');
    expect(all).not.toMatch(/[\u2013\u2014]/);
  });

  test('independence line names the app makers', () => {
    expect(independenceLine()).toContain('not affiliated with or endorsed by Microsoft, Google');
  });
});

describe('Catalogue helpers', () => {
  test('Microsoft first, then Google, then others', () => {
    const other: CatalogueApp = { id: 'xero', name: 'Xero', category: 'Accounting', description: 'x', availability: 'coming_soon' };
    expect(sortCatalogue([other, sheets, outlook]).map((a) => a.id)).toEqual(['microsoft_outlook', 'google_sheets', 'xero']);
  });

  test('connected count only counts verified connections', () => {
    expect(connectedCount([verified, { status: 'connected' }, { status: 'unverified' }])).toBe(1);
  });
});
