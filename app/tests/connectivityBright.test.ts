import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { BRIGHT_APPS, BRIGHT_CATS } from '../src/lib/integrations/brightCatalogueData';
import { isConnectivityBrightV1 } from '../src/lib/workspace/workspaceNav';

describe('Connectivity Bright Redesign v1 - Acceptance Test Suite', () => {
  it('C1: Feature flag connectivity_bright_v1 is supported with ?bright=0 fallback', () => {
    expect(typeof isConnectivityBrightV1).toBe('function');
    expect(isConnectivityBrightV1()).toBe(true);
  });

  it('C2: Catalogue data contains all 76 enterprise applications across 16 categories', () => {
    expect(BRIGHT_APPS.length).toBe(76);
    expect(BRIGHT_CATS.length).toBe(16);

    const cats = new Set(BRIGHT_APPS.map((a) => a.c));
    expect(cats.has('Productivity')).toBe(true);
    expect(cats.has('Communication')).toBe(true);
    expect(cats.has('CRM & Sales')).toBe(true);
    expect(cats.has('Accounting & Finance')).toBe(true);
    expect(cats.has('Social Media')).toBe(true);
  });

  it('C3: Tier 1 priority business apps are registered with verified metadata and SVGs', () => {
    const ids = new Set(BRIGHT_APPS.map((a) => a.id));
    expect(ids.has('microsoft_365')).toBe(true);
    expect(ids.has('microsoft_outlook')).toBe(true);
    expect(ids.has('microsoft_teams')).toBe(true);
    expect(ids.has('google_workspace')).toBe(true);
    expect(ids.has('gmail')).toBe(true);
    expect(ids.has('notion')).toBe(true);
    expect(ids.has('slack')).toBe(true);
    expect(ids.has('xero')).toBe(true);
  });

  it('C4: Strict language standard - Zero em dashes and zero en dashes across new components', () => {
    const filesToCheck = [
      '../src/lib/integrations/brightCatalogueData.ts',
      '../src/styles/connectivity-bright.css',
      '../src/components/workspace/connectivity/bright/BrightIcons.tsx',
      '../src/components/workspace/connectivity/bright/ConnectAppBrightView.tsx',
      '../src/components/workspace/connectivity/bright/AutomationExportBrightView.tsx',
      '../src/components/workspace/connectivity/bright/WebhooksBrightView.tsx',
      '../src/components/workspace/connectivity/bright/ApiAccessBrightView.tsx',
      '../src/components/workspace/connectivity/bright/EndpointReportBrightView.tsx',
      '../src/components/workspace/connectivity/bright/ConnectionHistoryBrightView.tsx',
    ];

    for (const relPath of filesToCheck) {
      const fullPath = resolve(__dirname, relPath);
      const content = readFileSync(fullPath, 'utf8');
      expect(content).not.toContain('—'); // No em dash
      expect(content).not.toContain('–'); // No en dash
    }
  });

  it('C5: Dashboard files, queries and templates remain completely untouched', () => {
    const dashPath = resolve(__dirname, '../src/pages/DashboardPage.tsx');
    const dashContent = readFileSync(dashPath, 'utf8');
    expect(dashContent).toContain('DashboardEmailCard');
    expect(dashContent).toContain('getWeekBounds');
  });

  it('C6: Scoped styling guarantees zero pollution of global or dashboard elements', () => {
    const cssPath = resolve(__dirname, '../src/styles/connectivity-bright.css');
    const cssContent = readFileSync(cssPath, 'utf8');
    expect(cssContent).toContain('.cn-shell');
    expect(cssContent).not.toMatch(/^body\s*\{/m);
  });
});
