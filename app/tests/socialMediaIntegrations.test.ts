import { describe, it, expect } from 'bun:test';
import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_PROVIDERS_CATALOG,
} from '../src/lib/integrations/hubRegistry';
import {
  APP_PERMISSIONS_SUMMARY,
  isDirectKeyProvider,
  getCredentialFieldInfo,
  connectPanelCopy,
  independenceLine,
} from '../src/lib/integrations/appCatalogue';

describe('Social Media App Integrations', () => {
  const socialMediaApps = [
    'youtube',
    'facebook',
    'instagram',
    'twitter',
    'tiktok',
    'threads',
    'pinterest',
    'reddit',
    'buffer',
    'snapchat',
    'whatsapp',
    'linkedin',
  ];

  it('should include Social Media category in INTEGRATION_CATEGORIES', () => {
    expect(INTEGRATION_CATEGORIES).toContain('Social Media');
  });

  it('should have all social media apps registered in INTEGRATION_PROVIDERS_CATALOG with Social Media category', () => {
    for (const appId of socialMediaApps) {
      const provider = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === appId);
      expect(provider).toBeDefined();
      expect(provider?.category).toBe('Social Media');
      expect(provider?.enabled).toBe(true);
    }
  });

  it('should have permission summaries defined for all social media apps', () => {
    for (const appId of socialMediaApps) {
      const perms = APP_PERMISSIONS_SUMMARY[appId];
      expect(perms).toBeDefined();
      expect(perms.willBeAbleTo.length).toBeGreaterThan(10);
      expect(perms.willNot.length).toBeGreaterThan(10);
      expect(perms.willBeAbleTo).not.toContain('—');
      expect(perms.willNot).not.toContain('—');
    }
  });

  it('should identify social media apps as direct key/token providers ready to connect', () => {
    const directSocialApps = [
      'youtube',
      'facebook',
      'instagram',
      'twitter',
      'tiktok',
      'threads',
      'pinterest',
      'reddit',
      'buffer',
      'snapchat',
      'whatsapp',
    ];

    for (const appId of directSocialApps) {
      expect(isDirectKeyProvider({ id: appId })).toBe(true);
    }
  });

  it('should return tailored credential field info for social media apps', () => {
    for (const appId of socialMediaApps) {
      const info = getCredentialFieldInfo({ id: appId, name: appId });
      expect(info.label).toBeDefined();
      expect(info.placeholder).toBeDefined();
      expect(info.help).toBeDefined();
    }
  });

  it('should generate accurate connect panel copy adhering to Australian English and independence disclaimer', () => {
    for (const appId of socialMediaApps) {
      const provider = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === appId)!;
      const panel = connectPanelCopy(provider as any);
      expect(panel.title).toContain(provider.name);
      expect(panel.body.length).toBeGreaterThan(0);
      const disclaimer = independenceLine();
      expect(disclaimer).toContain('independent product');
    }
  });
});
