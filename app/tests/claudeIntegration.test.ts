import { describe, it, expect } from 'bun:test';
import {
  APP_PERMISSIONS_SUMMARY,
  isNativeOAuthProvider,
  isDirectKeyProvider,
  connectPanelCopy,
  independenceLine,
  type CatalogueApp,
} from '../src/lib/integrations/appCatalogue';
import {
  INTEGRATION_PROVIDERS_CATALOG,
  integrationsHubService,
} from '../src/lib/integrations/hubRegistry';

describe('Anthropic Claude Effortless Integration', () => {
  it('should have permission summaries defined in appCatalogue without em dashes', () => {
    const permissions = APP_PERMISSIONS_SUMMARY['anthropic_claude'];
    expect(permissions).toBeDefined();
    expect(permissions.willBeAbleTo).toContain('Claude');
    expect(permissions.willNot).toContain('share');
    expect(permissions.willBeAbleTo).not.toContain('—');
    expect(permissions.willBeAbleTo).not.toContain('–');
    expect(permissions.willNot).not.toContain('—');
    expect(permissions.willNot).not.toContain('–');
  });

  it('should identify anthropic_claude as native provider for 1-click effortless workspace connection', () => {
    expect(isNativeOAuthProvider({ id: 'anthropic_claude' })).toBe(true);
    expect(isDirectKeyProvider({ id: 'anthropic_claude' })).toBe(false);
  });

  it('should generate accurate connect panel copy adhering to Australian English and independence disclaimer', () => {
    const app: CatalogueApp = {
      id: 'anthropic_claude',
      name: 'Anthropic Claude',
      category: 'AI',
      description: 'Connect Anthropic Claude models for deep document reasoning, analysis, and nuanced reporting.',
      availability: 'available',
    };
    const copy = connectPanelCopy(app);
    expect(copy.title).toBe('Connect Anthropic Claude');
    expect(copy.primary).toBe('Connect Anthropic Claude');
    expect(copy.body[0]).toContain('effortlessly');
    expect(copy.body[0]).toContain('zero API keys');
    expect(copy.body[0]).not.toContain('—');
    expect(copy.body[0]).not.toContain('–');

    const disclaimer = independenceLine();
    expect(disclaimer).toContain('Concludo is an independent product');
  });

  it('should define anthropic_claude in INTEGRATION_PROVIDERS_CATALOG with AI category', () => {
    const claude = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === 'anthropic_claude');
    expect(claude).toBeDefined();
    expect(claude?.category).toBe('AI');
    expect(claude?.enabled).toBe(true);
  });

  it('should expose connectDirect and testConnection on integrationsHubService', () => {
    expect(typeof integrationsHubService.connectDirect).toBe('function');
    expect(typeof integrationsHubService.testConnection).toBe('function');
  });
});
