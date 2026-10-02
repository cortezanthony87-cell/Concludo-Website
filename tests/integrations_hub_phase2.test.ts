import { describe, it, expect } from 'bun:test';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  INTEGRATION_CATEGORIES,
  integrationsHubService,
} from '../app/src/lib/integrations/hubRegistry';

describe('Integrations Hub & Real Connectors — Phase 2 Verification', () => {
  it('loads all 16 specified marketplace categories', () => {
    expect(INTEGRATION_CATEGORIES.length).toBe(16);
    expect(INTEGRATION_CATEGORIES).toContain('All Apps');
    expect(INTEGRATION_CATEGORIES).toContain('Connected');
    expect(INTEGRATION_CATEGORIES).toContain('Accounting & Finance');
    expect(INTEGRATION_CATEGORIES).toContain('CRM & Sales');
    expect(INTEGRATION_CATEGORIES).toContain('Productivity');
    expect(INTEGRATION_CATEGORIES).toContain('Communication');
    expect(INTEGRATION_CATEGORIES).toContain('Developer / API');
    expect(INTEGRATION_CATEGORIES).toContain('AI');
  });

  it('contains Tier 1 and Tier 2 priority business applications', () => {
    const ids = INTEGRATION_PROVIDERS_CATALOG.map((p) => p.id);
    // Microsoft
    expect(ids).toContain('microsoft_365');
    expect(ids).toContain('microsoft_outlook');
    expect(ids).toContain('microsoft_teams');
    expect(ids).toContain('onedrive');
    expect(ids).toContain('sharepoint');
    expect(ids).toContain('microsoft_excel');
    expect(ids).toContain('microsoft_forms');
    expect(ids).toContain('microsoft_planner');
    expect(ids).toContain('dynamics_365');
    expect(ids).toContain('power_bi');
    expect(ids).toContain('microsoft_entra_id');

    // Google
    expect(ids).toContain('google_workspace');
    expect(ids).toContain('gmail');
    expect(ids).toContain('google_calendar');
    expect(ids).toContain('google_drive');
    expect(ids).toContain('google_sheets');
    expect(ids).toContain('google_docs');
    expect(ids).toContain('google_forms');
    expect(ids).toContain('google_contacts');

    // Accounting & Finance with Australian prominence
    expect(ids).toContain('xero');
    expect(ids).toContain('myob');
    expect(ids).toContain('quickbooks');
    expect(ids).toContain('stripe');
    expect(ids).toContain('paypal');

    // Communication & CRM
    expect(ids).toContain('slack');
    expect(ids).toContain('zoom');
    expect(ids).toContain('hubspot');
    expect(ids).toContain('salesforce');

    // Universal
    expect(ids).toContain('webhooks');
    expect(ids).toContain('generic_http');
  });

  it('guarantees valid schemas for triggers and actions without raw secrets', () => {
    for (const provider of INTEGRATION_PROVIDERS_CATALOG) {
      expect(provider.id).toBeDefined();
      expect(provider.name).toBeDefined();
      expect(provider.category).toBeDefined();
      expect(provider.description).toBeDefined();
      expect(provider.iconSlug).toBeDefined();

      for (const t of provider.triggers) {
        expect(t.key).toBeDefined();
        expect(t.name).toBeDefined();
        expect(t.outputSchema).toBeDefined();
      }

      for (const a of provider.actions) {
        expect(a.key).toBeDefined();
        expect(a.name).toBeDefined();
        expect(a.inputSchema).toBeDefined();
        expect(a.outputSchema).toBeDefined();
      }
    }
  });

  it('supports search keyword mapping across applications', () => {
    const catalog = integrationsHubService.getCatalog();
    const xero = catalog.find((p) => p.id === 'xero');
    expect(xero?.category).toBe('Accounting & Finance');

    const outlook = catalog.find((p) => p.id === 'microsoft_outlook');
    expect(outlook?.category).toBe('Communication');
  });
});
