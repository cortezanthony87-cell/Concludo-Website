import { test, expect } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryStore, blankWorkflow } from '../src/lib/automation/automationCore';

test('Workflow deletion: UI buttons, modal, and store deletion', async () => {
  const css = readFileSync(resolve('/tmp/Concludo-Website/app/src/styles/automation-v2.css'), 'utf8');
  const studio = readFileSync(resolve('/tmp/Concludo-Website/app/src/lib/automation/automationStudio.ts'), 'utf8');
  const storeFile = readFileSync(resolve('/tmp/Concludo-Website/app/src/lib/automation/supabaseAutomationStore.ts'), 'utf8');

  // 1. Delete button in workflow cards on #workflows / Overview
  expect(studio).toContain('data-act="delete-wf"');
  expect(studio).toContain('title="Delete workflow"');
  expect(studio).toContain("ic('trash')");

  // 2. Delete workflow button in builder header for saved workflows
  expect(studio).toContain('data-test="delete-wf"');
  expect(studio).toContain('Delete workflow');

  // 3. Delete confirmation modal exists
  expect(studio).toContain('deleteModal(wfId, name)');
  expect(studio).toContain('Are you sure you want to delete');
  expect(studio).toContain('data-act="delete-confirm"');

  // 4. Click handling performs deletion and logs audit event
  expect(studio).toContain("case 'delete-confirm':");
  expect(studio).toContain('await store.deleteWorkflow(id)');
  expect(studio).toContain("event: 'workflow_deleted'");

  // 5. Danger styling is present in both standard and space-on modes
  expect(css).toContain('.btn.danger.ghost');
  expect(css).toContain('.cma.space-on .btn.danger');
  expect(css).toContain('.cma.space-on .btn.danger.ghost');

  // 6. Supabase store throws error if delete fails
  expect(storeFile).toContain("throw new Error(error.message || 'Failed to delete workflow');");

  // 7. Verify functional deletion against MemoryStore
  const store = new MemoryStore();
  const wf = blankWorkflow(store, 'Anthony', { type: 'meeting_completed' }, 'Test delete workflow');
  await store.saveWorkflow(wf);

  const foundBefore = await store.getWorkflow(wf.id);
  expect(foundBefore).not.toBeNull();
  expect(foundBefore?.name).toBe('Test delete workflow');

  const listBefore = await store.listWorkflows();
  expect(listBefore.some((w) => w.id === wf.id)).toBe(true);

  await store.deleteWorkflow(wf.id);

  const foundAfter = await store.getWorkflow(wf.id);
  expect(foundAfter).toBeNull();

  const listAfter = await store.listWorkflows();
  expect(listAfter.some((w) => w.id === wf.id)).toBe(false);
});
