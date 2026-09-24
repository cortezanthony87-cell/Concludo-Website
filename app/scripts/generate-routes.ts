import { mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const distDir = resolve(process.cwd(), 'dist');
const indexHtmlPath = resolve(distDir, 'index.html');

if (!existsSync(indexHtmlPath)) {
  console.error('dist/index.html does not exist!');
  process.exit(1);
}

const baseIndexContent = readFileSync(indexHtmlPath, 'utf8');

// Enriched checkout template with specific preview metadata
const checkoutContent = baseIndexContent
  .replace('<title>Concludo Workspace</title>', '<title>Concludo Workspace | Checkout</title>')
  .replace('content="Concludo Workspace"', 'content="Concludo Workspace | Checkout"')
  .replace(
    'content="Turn meeting transcripts into finished work, including summaries, action items, decision logs, follow-up emails, and branded decks."',
    'content="Secure checkout for Concludo Workspace subscriptions and Meeting Mastery Workbook packages."'
  );

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
  const content = (route === 'checkout' || route === 'checkout/success') ? checkoutContent : baseIndexContent;

  // 1. Directory with index.html (e.g. dist/checkout/index.html)
  const targetDir = resolve(distDir, route);
  mkdirSync(targetDir, { recursive: true });
  writeFileSync(resolve(targetDir, 'index.html'), content);

  // 2. Direct HTML file (e.g. dist/checkout.html) for non-redirect 200 OK on GitHub Pages
  const targetHtml = resolve(distDir, `${route}.html`);
  mkdirSync(dirname(targetHtml), { recursive: true });
  writeFileSync(targetHtml, content);
}

console.log(`Generated ${routes.length} route files with noindex robots tag for GitHub Pages 200 OK responses.`);
