import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Workspace Sidebar Collapse and Expand Toggle Arrow Invariants', () => {
  const sidebarTsx = readFileSync(
    resolve(__dirname, '../src/components/workspace/WorkspaceSidebar.tsx'),
    'utf8'
  );
  const layoutTsx = readFileSync(
    resolve(__dirname, '../src/components/WorkspaceLayout.tsx'),
    'utf8'
  );
  const sidebarCss = readFileSync(
    resolve(__dirname, '../src/styles/workspace-sidebar.css'),
    'utf8'
  );

  it('1. Arrow button is click-triggered only with zero hover sensitivity', () => {
    // Must have onClick handler
    expect(layoutTsx).toContain('onClick={handleToggleSidebar}');
    expect(sidebarTsx).toContain('onClick={onToggleCollapse}');
    // Must NOT have mouseenter or mouseover or mouseleave hover listeners that trigger collapse
    expect(layoutTsx).not.toContain('onMouseEnter={handleToggleSidebar}');
    expect(layoutTsx).not.toContain('onMouseOver={handleToggleSidebar}');
    expect(sidebarTsx).not.toContain('onMouseEnter={onToggleCollapse}');
    expect(sidebarTsx).not.toContain('onMouseOver={onToggleCollapse}');
    expect(sidebarTsx).not.toContain('onMouseLeave');
  });

  it('2. Arrow button toggles between hide and show with correct accessibility labels', () => {
    expect(layoutTsx).toContain("aria-label={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}");
    expect(layoutTsx).toContain(
      "title={sidebarCollapsed ? 'Show sidebar (click to expand)' : 'Hide sidebar (click to collapse)'}"
    );
    expect(layoutTsx).toContain('ChevronRight');
    expect(layoutTsx).toContain('ChevronLeft');

    // Header button in sidebar has Hide sidebar
    expect(sidebarTsx).toContain('aria-label="Hide sidebar"');
    expect(sidebarTsx).toContain('title="Hide sidebar (click to collapse)"');
  });

  it('3. Persists collapsed state in localStorage for session continuity', () => {
    expect(layoutTsx).toContain("window.localStorage.getItem('concludo.sidebar.collapsed')");
    expect(layoutTsx).toContain("window.localStorage.setItem('concludo.sidebar.collapsed'");
  });

  it('4. Stylesheet guarantees sidebar collapses to 0 width to expand screen view', () => {
    // .cws-nav-collapsed must set width: 0 and flex: 0 0 0px
    expect(sidebarCss).toContain('.cws-nav.cws-nav-collapsed');
    expect(sidebarCss).toContain('flex: 0 0 0px !important');
    expect(sidebarCss).toContain('width: 0px !important');
    expect(sidebarCss).toContain('overflow: hidden');
    // Inner content is hidden when collapsed
    expect(sidebarCss).toContain('.cws-nav.cws-nav-collapsed .cws');
    expect(sidebarCss).toContain('visibility: hidden');
  });

  it('5. Fixed edge toggle button is styled and positioned at the dividing border', () => {
    expect(sidebarCss).toContain('.cws-edge-tab');
    expect(sidebarCss).toContain('position: absolute');
    expect(sidebarCss).toContain('z-index: 40');
    expect(sidebarCss).toContain('.cws-edge-tab-collapsed');
    expect(sidebarCss).toContain('left: 0 !important');
  });

  it('6. Motion safety: respects prefers-reduced-motion', () => {
    expect(sidebarCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(sidebarCss).toContain('.cws-edge-tab');
  });
});
