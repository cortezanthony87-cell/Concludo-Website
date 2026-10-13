import { describe, it, expect } from 'bun:test';
import { isNativeOAuthProvider } from '../src/lib/integrations/appCatalogue';
import { integrationsHubService } from '../src/lib/integrations/hubRegistry';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Native OAuth Integration ($0 third-party fees)', () => {
  it('should identify Google and Microsoft providers as native OAuth', () => {
    // Google providers
    expect(isNativeOAuthProvider({ id: 'google_ads', provider_family: 'google' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'gmail', provider_family: 'google' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'google_calendar', provider_family: 'google' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'google_drive', provider_family: 'google' })).toBe(true);

    // Microsoft providers
    expect(isNativeOAuthProvider({ id: 'microsoft_outlook', provider_family: 'microsoft' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'microsoft_365', provider_family: 'microsoft' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'onedrive', provider_family: 'microsoft' })).toBe(true);
    expect(isNativeOAuthProvider({ id: 'sharepoint', provider_family: 'microsoft' })).toBe(true);

    // Third-party providers that use Nango or direct API
    expect(isNativeOAuthProvider({ id: 'slack', provider_family: 'slack' })).toBe(false);
    expect(isNativeOAuthProvider({ id: 'hubspot', provider_family: 'hubspot' })).toBe(false);
    expect(isNativeOAuthProvider({ id: 'xero', provider_family: 'xero' })).toBe(false);
  });

  it('should expose startNativeOAuth and completeNativeOAuth on integrationsHubService', () => {
    expect(typeof integrationsHubService.startNativeOAuth).toBe('function');
    expect(typeof integrationsHubService.completeNativeOAuth).toBe('function');
  });

  it('should have integrations/callback registered in generate-routes.ts', () => {
    const routeGenPath = resolve(__dirname, '../scripts/generate-routes.ts');
    const content = readFileSync(routeGenPath, 'utf-8');
    expect(content.includes("'integrations/callback'")).toBe(true);
  });

  it('should have integrations/callback route registered in App.tsx', () => {
    const appPath = resolve(__dirname, '../src/App.tsx');
    const content = readFileSync(appPath, 'utf-8');
    expect(content.includes('OAuthCallbackPage')).toBe(true);
    expect(content.includes('/integrations/callback')).toBe(true);
  });
});
