import { describe, it, expect } from 'bun:test';
import {
  APP_PERMISSIONS_SUMMARY,
  isDirectKeyProvider,
  getCredentialFieldInfo,
  connectPanelCopy,
  independenceLine,
  type CatalogueApp,
} from '../src/lib/integrations/appCatalogue';
import { integrationsHubService } from '../src/lib/integrations/hubRegistry';

describe('Group B Integrations (Direct Keys, Tokens & OAuth)', () => {
  const groupBApps = [
    'stripe', 'xero', 'myob', 'quickbooks', 'paypal',
    'slack', 'zoom', 'discord', 'twilio',
    'hubspot', 'salesforce', 'pipedrive', 'zoho_crm',
    'notion', 'asana', 'monday', 'clickup', 'jira', 'trello', 'airtable', 'smartsheet',
    'shopify', 'woocommerce',
    'dropbox', 'box',
    'typeform', 'jotform',
    'mailchimp', 'activecampaign', 'klaviyo',
    'zendesk', 'intercom', 'freshdesk',
    'openai', 'anthropic_claude',
    'webhooks', 'generic_http',
  ];

  it('should have permission summaries defined for all Group B apps', () => {
    for (const appId of groupBApps) {
      const perm = APP_PERMISSIONS_SUMMARY[appId];
      expect(perm).toBeDefined();
      expect(perm?.willBeAbleTo).toBeDefined();
      expect(perm?.willNot).toBeDefined();
      // Ensure no em dashes or en dashes
      expect(perm?.willBeAbleTo).not.toContain('—');
      expect(perm?.willBeAbleTo).not.toContain('–');
      expect(perm?.willNot).not.toContain('—');
      expect(perm?.willNot).not.toContain('–');
    }
  });

  it('should correctly identify direct key providers', () => {
    expect(isDirectKeyProvider({ id: 'stripe', authentication_type: 'api_key' })).toBe(true);
    expect(isDirectKeyProvider({ id: 'openai', authentication_type: 'api_key' })).toBe(true);
    expect(isDirectKeyProvider({ id: 'anthropic_claude', authentication_type: 'api_key' })).toBe(true);
    expect(isDirectKeyProvider({ id: 'webhooks', authentication_type: 'webhook_signature' })).toBe(true);
    expect(isDirectKeyProvider({ id: 'generic_http', authentication_type: 'bearer' })).toBe(true);
    expect(isDirectKeyProvider({ id: 'google_calendar', authentication_type: 'oauth2' })).toBe(false);
    expect(isDirectKeyProvider({ id: 'microsoft_outlook', authentication_type: 'oauth2' })).toBe(false);
  });

  it('should return tailored credential field info for Group B apps', () => {
    const stripeInfo = getCredentialFieldInfo({ id: 'stripe', name: 'Stripe' });
    expect(stripeInfo.label).toContain('Stripe');
    expect(stripeInfo.placeholder).toContain('rk_live_');

    const slackInfo = getCredentialFieldInfo({ id: 'slack', name: 'Slack' });
    expect(slackInfo.label).toContain('Slack');
    expect(slackInfo.placeholder).toContain('xoxb-');

    const notionInfo = getCredentialFieldInfo({ id: 'notion', name: 'Notion' });
    expect(notionInfo.label).toContain('Notion');
    expect(notionInfo.placeholder).toContain('secret_');

    const shopifyInfo = getCredentialFieldInfo({ id: 'shopify', name: 'Shopify' });
    expect(shopifyInfo.requiresSecondary).toBe(true);
    expect(shopifyInfo.secondaryLabel).toBe('Store Domain');
  });

  it('should expose connectDirect on integrationsHubService', () => {
    expect(typeof integrationsHubService.connectDirect).toBe('function');
  });

  it('should generate accurate connect panel copy adhering to Australian English and independence disclaimer', () => {
    const disclaimer = independenceLine();
    expect(disclaimer).toContain('Concludo is an independent product');
    expect(disclaimer).not.toContain('—');
    expect(disclaimer).not.toContain('–');

    for (const appId of groupBApps) {
      const app: CatalogueApp = {
        id: appId,
        name: appId.toUpperCase(),
        category: 'Test',
        description: 'Test description',
        availability: 'available',
      };
      const copy = connectPanelCopy(app);
      expect(copy.title).toBe(`Connect ${app.name}`);
      expect(copy.body[0]).not.toContain('—');
      expect(copy.body[0]).not.toContain('–');
    }
  });
});
