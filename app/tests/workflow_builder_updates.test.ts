import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('Workflow builder updates: UI text, styles, and connection handling', () => {
  const css = readFileSync(resolve('/tmp/Concludo-Website/app/src/styles/automation-v2.css'), 'utf8');
  const studio = readFileSync(resolve('/tmp/Concludo-Website/app/src/lib/automation/automationStudio.ts'), 'utf8');
  const store = readFileSync(resolve('/tmp/Concludo-Website/app/src/lib/automation/supabaseAutomationStore.ts'), 'utf8');

  // 1. Text selection contrast
  expect(css).toContain('::selection');
  expect(css).toContain('#16263F');
  expect(css).toContain('#F4CB6A');

  // 2. Saved bar and builder head are static, not sticky
  expect(css).toMatch(/\.cma\.space-on \.saved\s*\{[^}]*position:\s*static;/);
  expect(css).toMatch(/\.b-head\s*\{[^}]*position:\s*static;/);

  // 3. Ringed planet removed from space backdrop
  expect(studio).toContain('// ringed planet removed per user instruction');
  expect(studio).not.toContain('ball(0, 0, r, \'#f1d79a\', \'#a87b2c\', \'#2a1e0c\')');

  // 4. Mentions AI agent workflow builder and connected trigger
  expect(studio).toContain('AI agent workflow builder');
  expect(studio).toContain('From your description (AI agent workflow builder)');
  expect(studio).toContain('AI agent workflow builder: creates automation from natural language.');

  // 5. Apps bar is present on the Create Workflow view
  expect(studio).toContain('appsBar(checks, new Set())');

  // 6. Supabase store maps providers and handles status correctly
  expect(store).toContain("this.providerId(app)");
  expect(store).toContain("microsoft_outlook");
  expect(store).toContain("microsoft_teams");
});
