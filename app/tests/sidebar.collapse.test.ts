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
    // Inner collapse button in sidebar has onClick handler
    expect(sidebarTsx).toContain('onClick={onToggleCollapse}');
    // Must NOT have mouseenter or mouseover or mouseleave hover listeners that trigger collapse
    expect(layoutTsx).not.toContain('onMouseEnter');
    expect(layoutTsx).not.toContain('onMouseOver');
    expect(sidebarTsx).not.toContain('onMouseEnter={onToggleCollapse}');
    expect(sidebarTsx).not.toContain('onMouseOver={onToggleCollapse}');
    expect(sidebarTsx).not.toContain('onMouseLeave');
  });

  it('2. Outer edge arrow is removed, and single inner arrow toggles between hide and show', () => {
    // Outer button class .cws-edge-tab is removed from WorkspaceLayout.tsx
    expect(layoutTsx).not.toContain('cws-edge-tab');
    expect(sidebarCss).not.toContain('.cws-edge-tab {');

    // Single inner arrow in sidebar handles both states
    expect(sidebarTsx).toContain('className="cws-collapse-btn"');
    expect(sidebarTsx).toContain('aria-label={isCollapsed ? "Show sidebar" : "Hide sidebar"}');
    expect(sidebarTsx).toContain(
      'title={isCollapsed ? "Show sidebar (click to expand)" : "Hide sidebar (click to collapse)"}'
    );
    expect(sidebarTsx).toContain('Icon name={isCollapsed ? "ChevronRight" : "ChevronLeft"}');
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
    // Inner content is hidden except the collapse button
    expect(sidebarCss).toContain('.cws-nav.cws-nav-collapsed .cws');
    expect(sidebarCss).toContain('.cws-nav.cws-nav-collapsed .cws-collapse-btn');
  });

  it('5. Collapsed button docks at screen edge for easy reopening', () => {
    expect(sidebarCss).toContain('.cws-nav.cws-nav-collapsed .cws-brand');
    expect(sidebarCss).toContain('position: absolute');
    expect(sidebarCss).toContain('left: 0');
    expect(sidebarCss).toContain('.cws-nav.cws-nav-collapsed .cws-collapse-btn');
  });

  it('6. Motion safety: respects prefers-reduced-motion', () => {
    expect(sidebarCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(sidebarCss).toContain('.cws-nav');
  });
});
