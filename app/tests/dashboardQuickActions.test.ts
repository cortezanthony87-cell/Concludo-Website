import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Dashboard Quick Actions Toolbar Acceptance Tests', () => {
  const repoRoot = path.resolve(__dirname, '..');
  const componentPath = path.join(repoRoot, 'src/components/dashboard/DashboardQuickActionsToolbar.tsx');
  const dashboardPath = path.join(repoRoot, 'src/pages/DashboardPage.tsx');
  const cssPath = path.join(repoRoot, 'src/styles/concludo-dashboard-v2.css');

  it('Q1: DashboardQuickActionsToolbar component exists and declares all 7 quick action destinations', () => {
    assert.ok(fs.existsSync(componentPath), 'Component file must exist');
    const content = fs.readFileSync(componentPath, 'utf8');

    assert.ok(content.includes('Quick actions:'), 'Must include Quick actions label');
    assert.ok(content.includes('to="/projects/new"'), 'Must link to /projects/new');
    assert.ok(content.includes('New Project'), 'Must contain New Project label');
    assert.ok(content.includes('to: \'/projects\''), 'Must link to /projects');
    assert.ok(content.includes('to: \'/work/actions\''), 'Must link to /work/actions');
    assert.ok(content.includes('to: \'/memory/decisions\''), 'Must link to /memory/decisions');
    assert.ok(content.includes('to: \'/insight\''), 'Must link to /insight');
    assert.ok(content.includes('to: \'/insight/stats\''), 'Must link to /insight/stats');
    assert.ok(content.includes('to: \'/settings\''), 'Must link to /settings');
  });

  it('Q2: DashboardPage renders DashboardQuickActionsToolbar directly under the greeting header', () => {
    assert.ok(fs.existsSync(dashboardPath), 'DashboardPage must exist');
    const dashContent = fs.readFileSync(dashboardPath, 'utf8');

    assert.ok(
      dashContent.includes("import { DashboardQuickActionsToolbar } from '../components/dashboard/DashboardQuickActionsToolbar';"),
      'DashboardPage must import DashboardQuickActionsToolbar'
    );

    // Ensure it renders after welcomeGreeting
    const greetingIdx = dashContent.indexOf('{welcomeGreeting}');
    const toolbarIdx = dashContent.indexOf('<DashboardQuickActionsToolbar />', greetingIdx);
    assert.ok(toolbarIdx > greetingIdx, 'Toolbar must appear after welcomeGreeting');

    // Ensure old bottom bar has been removed
    assert.ok(
      !dashContent.includes('{/* ── Quick Actions (compact bottom bar) ── */}'),
      'Old compact bottom bar must be removed'
    );
  });

  it('Q3: Scoped CSS for toolbar exists with responsive styles and daylight tokens', () => {
    assert.ok(fs.existsSync(cssPath), 'CSS file must exist');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(cssContent.includes('.dashboard-v2-page .dashboard-quick-actions-toolbar'), 'Toolbar selector must exist');
    assert.ok(cssContent.includes('.dashboard-v2-page .quick-action-primary-btn'), 'Primary gold button selector must exist');
    assert.ok(cssContent.includes('.dashboard-v2-page .quick-action-nav-link'), 'Nav link selector must exist');
    assert.ok(cssContent.includes('#e2b53c'), 'Must use Concludo warm gold #e2b53c');
  });

  it('Q4: Strict language standard - Zero em dashes and zero en dashes', () => {
    const componentContent = fs.readFileSync(componentPath, 'utf8');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert.ok(!componentContent.includes('\u2014'), 'No em dash in DashboardQuickActionsToolbar.tsx');
    assert.ok(!componentContent.includes('\u2013'), 'No en dash in DashboardQuickActionsToolbar.tsx');
    assert.ok(!cssContent.includes('\u2014'), 'No em dash in concludo-dashboard-v2.css');
    assert.ok(!cssContent.includes('\u2013'), 'No en dash in concludo-dashboard-v2.css');
  });
});
