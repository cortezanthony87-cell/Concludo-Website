import { mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const indexHtml = resolve(distDir, 'index.html');

if (!existsSync(indexHtml)) {
  console.error('dist/index.html does not exist!');
  process.exit(1);
}

const routes = [
  'checkout',
  'checkout/success',
  'login',
  'signup',
  'forgot-password',
  'reset-password',
  'dashboard',
  'projects',
  'projects/new',
  'search',
  'account',
  'settings',
  'settings/deleted',
  'decision-memory',
  'actions',
  'insight',
  'stats',
  'endpoint-report',
  'team',
  'team/create',
  'team/settings',
  'admin',
  'admin/audit',
  'admin/compliance',
  'admin/security',
  'integrations',
  'integrations/history',
  'automation-export',
  'webhooks',
  'api',
  'agents',
  'agents/dashboard',
  'workflows',
  'approvals',
  'predictive-intelligence',
  'executive-intelligence',
  'forecasts',
  'executive-briefings',
  'knowledge',
  'organizational-memory',
  'knowledge/timeline',
  'executive-explorer',
  'knowledge-analytics',
  'copilot',
  'digital-twin',
  'executive-command-center',
  'scenario-modeling',
  'performance',
  'executive-center',
  'test-connection',
  'pricing',
  'demo'
];

for (const route of routes) {
  const targetDir = resolve(distDir, route);
  mkdirSync(targetDir, { recursive: true });
  copyFileSync(indexHtml, resolve(targetDir, 'index.html'));
}

console.log(`Generated ${routes.length} route index.html files for GitHub Pages 200 OK responses.`);
