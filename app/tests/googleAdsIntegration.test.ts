import { describe, it, expect } from 'bun:test';
import { APP_PERMISSIONS_SUMMARY, connectPanelCopy, independenceLine, type CatalogueApp } from '../src/lib/integrations/appCatalogue';
import { INTEGRATION_PROVIDERS_CATALOG } from '../src/lib/integrations/hubRegistry';
import { CONNECTOR_MANIFESTS } from '../src/lib/workflows/connectorRegistry';

describe('Google Ads Integration', () => {
  it('should have permission summaries defined in appCatalogue', () => {
    const perms = APP_PERMISSIONS_SUMMARY['google_ads'];
    expect(perms).toBeDefined();
    expect(perms.willBeAbleTo).toContain('view campaign performance');
    expect(perms.willNot).toContain('human approval');
  });

  it('should generate accurate connect panel copy for Google Ads', () => {
    const app: CatalogueApp = {
      id: 'google_ads',
      name: 'Google Ads',
      category: 'Marketing',
      description: 'Automate ad group management, pause campaigns, track conversions, and apply approved keyword adjustments.',
      provider_family: 'google',
      availability: 'available',
    };

    const panel = connectPanelCopy(app);
    expect(panel.title).toBe('Connect Google Ads');
    expect(panel.primary).toBe("Continue to Google sign-in");
    expect(panel.permissions).toBeDefined();
    expect(panel.permissions?.willBeAbleTo).toContain('view campaign performance');
    expect(panel.body[0]).toContain("Google's own page");
  });

  it('should enforce independence disclaimer line', () => {
    const line = independenceLine();
    expect(line).toContain('independent product');
    expect(line).toContain('Google');
  });

  it('should define google_ads in INTEGRATION_PROVIDERS_CATALOG with Marketing category', () => {
    const provider = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === 'google_ads');
    expect(provider).toBeDefined();
    expect(provider?.name).toBe('Google Ads');
    expect(provider?.category).toBe('Marketing');
    expect(provider?.authenticationType).toBe('oauth2');
    expect(provider?.triggers.length).toBeGreaterThan(0);
    expect(provider?.actions.length).toBeGreaterThan(0);

    const pauseAction = provider?.actions.find((a) => a.key === 'pause_campaign');
    expect(pauseAction).toBeDefined();
    expect(pauseAction?.requiredScopes).toContain('https://www.googleapis.com/auth/adwords');
  });

  it('should have google_ads registered in workflow CONNECTOR_MANIFESTS', () => {
    const manifest = CONNECTOR_MANIFESTS['google_ads'];
    expect(manifest).toBeDefined();
    expect(manifest.displayName).toBe('Google Ads');
    expect(manifest.category).toBe('integrations');
    expect(manifest.availabilityState).toBe('available');
  });
});
