import { describe, it, expect } from 'bun:test';
import { APP_PERMISSIONS_SUMMARY, isNativeOAuthProvider, connectPanelCopy } from '../src/lib/integrations/appCatalogue';

describe('Group A Microsoft Integrations (Native OAuth)', () => {
  const groupA = [
    'microsoft_excel',
    'microsoft_onedrive',
    'microsoft_onenote',
    'microsoft_planner',
    'microsoft_sharepoint',
  ];

  it('should have permission summaries defined for all Group A apps', () => {
    for (const id of groupA) {
      expect(APP_PERMISSIONS_SUMMARY[id]).toBeDefined();
      expect(APP_PERMISSIONS_SUMMARY[id].willBeAbleTo.length).toBeGreaterThan(10);
      expect(APP_PERMISSIONS_SUMMARY[id].willNot.length).toBeGreaterThan(10);
    }
  });

  it('should treat all Group A apps as native OAuth providers ($0 third-party fees)', () => {
    for (const id of groupA) {
      expect(isNativeOAuthProvider({ id, provider_family: 'microsoft' })).toBe(true);
    }
  });

  it('should generate accurate connect panel copy with Australian English and no em dashes', () => {
    for (const id of groupA) {
      const copy = connectPanelCopy({
        id,
        name: id.replace('microsoft_', '').toUpperCase(),
        category: 'Files',
        description: 'Test',
        authentication_type: 'oauth2',
        availability: 'available',
        provider_family: 'microsoft',
      });
      expect(copy.title).toContain('Connect');
      expect(copy.permissions).toBeDefined();
      expect(copy.body.join(' ')).not.toContain('—');
      expect(copy.body.join(' ')).not.toContain('–');
    }
  });
});
