import { describe, it, expect } from 'bun:test';
import {
  isNativeOAuthProvider,
  isDirectKeyProvider,
  connectPanelCopy,
  signInPageOwner,
} from '../src/lib/integrations/appCatalogue';
import { INTEGRATION_PROVIDERS_CATALOG } from '../src/lib/integrations/hubRegistry';

describe('YouTube Effortless Native OAuth Integration', () => {
  const youtubeDef = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === 'youtube')!;

  it('should exist in catalogue with Social Media category and oauth2 authentication', () => {
    expect(youtubeDef).toBeDefined();
    expect(youtubeDef.name).toBe('YouTube');
    expect(youtubeDef.category).toBe('Social Media');
    expect(youtubeDef.authenticationType).toBe('oauth2');
  });

  it('should identify YouTube as a native OAuth provider ($0 third-party fees)', () => {
    expect(isNativeOAuthProvider({ id: 'youtube', provider_family: 'google' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'youtube' })).toBe(true);
    expect(isNativeOAuthProvider(youtubeDef as any)).toBe(true);
  });

  it('should not treat YouTube as a direct key provider by default', () => {
    expect(isDirectKeyProvider({ id: 'youtube', authentication_type: 'oauth2' })).toBe(false);
    expect(isDirectKeyProvider(youtubeDef as any)).toBe(false);
  });

  it('should generate Google sign-in copy for effortless 1-click connection', () => {
    const providerWithFamily = { ...youtubeDef, availability: 'available' as const, provider_family: 'google' };
    const panel = connectPanelCopy(providerWithFamily as any);

    expect(panel.title).toBe('Connect YouTube');
    expect(panel.primary).toBe('Continue to Google sign-in');
    expect(panel.body[0]).toContain("You will connect YouTube by signing in on Google's own page.");
    expect(panel.body[0]).toContain("Concludo never sees your password.");
    expect(panel.permissions).toBeDefined();
    expect(panel.permissions?.willBeAbleTo).toContain('publish videos, schedule community posts, and sync channel metrics');
    expect(panel.permissions?.willNot).toContain('delete your videos, change channel ownership, or publish content without your explicit approval');
  });

  it('should attribute sign-in page to Google', () => {
    expect(signInPageOwner({ name: 'YouTube', provider_family: 'google' })).toBe("Google's");
  });
});
