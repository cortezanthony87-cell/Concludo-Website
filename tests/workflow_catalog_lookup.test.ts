import { describe, it, expect } from 'bun:test';
import { INTEGRATION_PROVIDERS_CATALOG } from '../app/src/lib/integrations/hubRegistry';

function INTEGRATION_PROVIDERS_CATALOG_LOOKUP(appName: string) {
  if (!appName) return null;
  const norm = (s: string) => (s || '').toLowerCase().replace(/[\s_\-]+/g, '');
  const target = norm(appName);
  return (
    INTEGRATION_PROVIDERS_CATALOG.find(
      (p) =>
        norm(p.id) === target ||
        norm(p.slug) === target ||
        norm(p.name) === target
    ) ||
    INTEGRATION_PROVIDERS_CATALOG.find(
      (p) =>
        target.includes(norm(p.name)) ||
        norm(p.name).includes(target) ||
        target.includes(norm(p.id)) ||
        norm(p.id).includes(target)
    ) ||
    null
  );
}

describe('Integration Providers Catalog & Workflow Builder Lookup', () => {
  it('includes microsoft_todo with native OAuth and Tasks.ReadWrite scope', () => {
    const todo = INTEGRATION_PROVIDERS_CATALOG.find((p) => p.id === 'microsoft_todo');
    expect(todo).toBeDefined();
    expect(todo?.name).toBe('Microsoft To Do');
    expect(todo?.provider_family).toBe('microsoft');
    expect(todo?.authenticationType).toBe('oauth2');
    expect(todo?.isTier1).toBe(true);
    expect(todo?.actions.some(a => a.requiredScopes.includes('Tasks.ReadWrite'))).toBe(true);
  });

  it('correctly matches variations of Microsoft To Do from review cards and step keys', () => {
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('Microsoft Todo')?.id).toBe('microsoft_todo');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('Microsoft To Do')?.id).toBe('microsoft_todo');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('microsoft_todo')?.id).toBe('microsoft_todo');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('todo')?.id).toBe('microsoft_todo');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('To Do')?.id).toBe('microsoft_todo');
  });

  it('correctly matches other key providers without collision', () => {
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('LinkedIn')?.id).toBe('linkedin');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('Microsoft Planner')?.id).toBe('microsoft_planner');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('Microsoft Outlook')?.id).toBe('microsoft_outlook');
    expect(INTEGRATION_PROVIDERS_CATALOG_LOOKUP('Slack')?.id).toBe('slack');
  });
});
