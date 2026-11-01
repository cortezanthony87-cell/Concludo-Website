import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Notification Bell Yellow Glowing Effect', () => {
  const layoutTsx = readFileSync(
    resolve(__dirname, '../src/components/WorkspaceLayout.tsx'),
    'utf8'
  );
  const shellCss = readFileSync(
    resolve(__dirname, '../src/styles/workspace-shell.css'),
    'utf8'
  );
  const modalTsx = readFileSync(
    resolve(__dirname, '../src/components/collaboration/NotificationCentreModal.tsx'),
    'utf8'
  );

  it('1. WorkspaceLayout applies has-unread-glow class when effectiveUnreadNotifsCount > 0', () => {
    expect(layoutTsx).toContain("effectiveUnreadNotifsCount > 0 ? 'has-unread-glow' : ''");
    expect(layoutTsx).toContain('top-navbar-bell-btn');
  });

  it('2. WorkspaceLayout applies yellow glowing background, border, boxShadow, and bell icon color when unread > 0', () => {
    expect(layoutTsx).toContain("effectiveUnreadNotifsCount > 0 ? 'rgba(226, 181, 60, 0.12)' : 'rgba(255, 255, 255, 0.06)'");
    expect(layoutTsx).toContain("effectiveUnreadNotifsCount > 0 ? '1px solid rgba(243, 201, 88, 0.75)' : '1px solid rgba(255, 255, 255, 0.14)'");
    expect(layoutTsx).toContain("effectiveUnreadNotifsCount > 0 ? '#F3C958' : '#F8FAFC'");
    expect(layoutTsx).toContain('rgba(243, 201, 88, 0.55)');
    expect(layoutTsx).toContain('bell-yellow-glow 2.2s infinite ease-in-out');
  });

  it('3. workspace-shell.css defines .top-navbar-bell-btn.has-unread-glow and @keyframes bell-yellow-glow', () => {
    expect(shellCss).toContain('.top-navbar .top-navbar-bell-btn.has-unread-glow');
    expect(shellCss).toContain('@keyframes bell-yellow-glow');
    expect(shellCss).toContain('rgba(243, 201, 88, 0.85)');
    expect(shellCss).toContain('#F3C958');
  });

  it('4. workspace-shell.css respects prefers-reduced-motion for the bell glow', () => {
    expect(shellCss).toContain('@media (prefers-reduced-motion: reduce)');
    expect(shellCss).toContain('.top-navbar .top-navbar-bell-btn.has-unread-glow');
  });

  it('5. NotificationCentreModal supports mark all read for both authentic and demo workspaces', () => {
    expect(modalTsx).toContain('store.getNotifications().forEach((n) => store.markNotificationRead(n.id))');
    expect(modalTsx).toContain('accountNotifs.markAllAsRead()');
  });
});
