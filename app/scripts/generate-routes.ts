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
  'calendar',
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
  'integrations/connect/microsoft_365',
  'integrations/connect/microsoft_outlook',
  'integrations/connect/microsoft_teams',
  'integrations/connect/onedrive',
  'integrations/connect/sharepoint',
  'integrations/connect/microsoft_excel',
  'integrations/connect/microsoft_forms',
  'integrations/connect/microsoft_planner',
  'integrations/connect/dynamics_365',
  'integrations/connect/power_bi',
  'integrations/connect/microsoft_entra_id',
  'integrations/connect/google_workspace',
  'integrations/connect/gmail',
  'integrations/connect/google_calendar',
  'integrations/connect/google_drive',
  'integrations/connect/google_sheets',
  'integrations/connect/google_docs',
  'integrations/connect/google_forms',
  'integrations/connect/google_contacts',
  'integrations/connect/xero',
  'integrations/connect/myob',
  'integrations/connect/quickbooks',
  'integrations/connect/stripe',
  'integrations/connect/paypal',
  'integrations/connect/slack',
  'integrations/connect/zoom',
  'integrations/connect/discord',
  'integrations/connect/twilio',
  'integrations/connect/hubspot',
  'integrations/connect/salesforce',
  'integrations/connect/pipedrive',
  'integrations/connect/zoho_crm',
  'integrations/connect/monday',
  'integrations/connect/asana',
  'integrations/connect/trello',
  'integrations/connect/clickup',
  'integrations/connect/jira',
  'integrations/connect/notion',
  'integrations/connect/airtable',
  'integrations/connect/smartsheet',
  'integrations/connect/dropbox',
  'integrations/connect/box',
  'integrations/connect/mailchimp',
  'integrations/connect/activecampaign',
  'integrations/connect/klaviyo',
  'integrations/connect/shopify',
  'integrations/connect/woocommerce',
  'integrations/connect/zendesk',
  'integrations/connect/freshdesk',
  'integrations/connect/intercom',
  'integrations/connect/typeform',
  'integrations/connect/jotform',
  'integrations/connect/webhooks',
  'integrations/connect/generic_http',
  'integrations/connect/json_tool',
  'integrations/connect/email_universal',
  'integrations/connect/sftp_universal',
  'integrations/connect/openai',
  'integrations/connect/anthropic_claude',
  'integrations/history',
  'automation-export',
  'webhooks',
  'api',
  'agents',
  'agents/dashboard',
  'workflows',
  'workflows/builder',
  'workflows/governance',
  'workflows/runs',
  'connections',
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
