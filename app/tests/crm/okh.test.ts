import { describe, it, expect } from 'bun:test';
import { OKH_SECTION_TITLES } from '../../src/lib/okh/client';
import { CRM_DETAIL_ROUTES } from '../../src/pages/crm/crmRouteTable';

describe('Organisation Knowledge Hub (OKH) Suite', () => {
  it('exposes exactly 10 canonical sections matching specification', () => {
    const keys = Object.keys(OKH_SECTION_TITLES);
    expect(keys.length).toBe(10);
    expect(keys).toEqual([
      'overview',
      'customers',
      'products_services',
      'marketing',
      'sales',
      'customer_success',
      'operations',
      'strategy',
      'policies',
      'ai_layer',
    ]);
  });

  it('routes /crm/organisations/:organisationId/knowledge to OrganisationKnowledgeHubPage', () => {
    const route = CRM_DETAIL_ROUTES.find(
      (r) => r.segment === 'organisations/:organisationId/knowledge'
    );
    expect(route).toBeDefined();
    expect(route?.Component.name).toContain('OrganisationKnowledgeHubPage');
  });

  it('enforces Australian English and zero em/en dashes in section titles', () => {
    for (const [key, title] of Object.entries(OKH_SECTION_TITLES)) {
      expect(title).not.toContain('—');
      expect(title).not.toContain('–');
      if (key === 'overview') {
        expect(title).toContain('Organisation');
        expect(title).not.toContain('Organization');
      }
    }
  });
});
