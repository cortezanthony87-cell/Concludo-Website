import { describe, it, expect } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('Action Command Hub Calendar Auto-fill, Floating Scrollbar and Edit Modal v2', () => {
  const pagePath = resolve(__dirname, '../src/pages/actions/ActionHubPage.tsx');
  const cssPath = resolve(__dirname, '../src/styles/action-hub.css');
  const pageSource = readFileSync(pagePath, 'utf8');
  const cssSource = readFileSync(cssPath, 'utf8');

  it('0. verifies "Edit" menu item exists at the very top of the dots menu in table and mobile cards', () => {
    expect(pageSource).toContain('handleOpenEditModal');
    expect(pageSource).toContain('Edit Action Item');
    
    // Check that Edit appears before Add to Calendar in dots menu
    const editIndex = pageSource.indexOf('handleOpenEditModal(row)');
    const addIndex = pageSource.indexOf('handleAddToCalendarClick(row)');
    const delIndex = pageSource.indexOf('setDeleteModalTask(row)');
    expect(editIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeGreaterThan(-1);
    expect(delIndex).toBeGreaterThan(-1);
    expect(editIndex).toBeLessThan(addIndex);
    expect(addIndex).toBeLessThan(delIndex);
  });

  it('0b. verifies Edit modal provides editing for action titles, due dates, and assignees with calendar sync', () => {
    expect(pageSource).toContain('editModalTask');
    expect(pageSource).toContain('editTaskTitle');
    expect(pageSource).toContain('editTaskDueDate');
    expect(pageSource).toContain('editTaskAssignee');
    expect(pageSource).toContain('editTaskPriority');
    expect(pageSource).toContain('editTaskStatus');
    expect(pageSource).toContain('editSyncCalendar');
    expect(pageSource).toContain('handleSaveEdit');
    expect(pageSource).toContain('Sync changes to Concludo Calendar');
  });

  it('1. verifies "Add to Calendar" menu item exists above Delete task in table and mobile cards', () => {
    expect(pageSource).toContain('handleAddToCalendarClick');
    expect(pageSource).toContain('Add to Calendar');
    expect(pageSource).toContain('Re-sync to Calendar');
    
    // Check that Add to Calendar appears before Delete task in the dots menu
    const addIndex = pageSource.indexOf('handleAddToCalendarClick(row)');
    const delIndex = pageSource.indexOf('setDeleteModalTask(row)');
    expect(addIndex).toBeGreaterThan(-1);
    expect(delIndex).toBeGreaterThan(-1);
    expect(addIndex).toBeLessThan(delIndex);
  });

  it('2. verifies auto-fill Calendar call maps action title, description, priority, and date', () => {
    expect(pageSource).toContain('createCalendarItem(supabase, {');
    expect(pageSource).toContain('creator_id: user.id');
    expect(pageSource).toContain('type: \'task\'');
    expect(pageSource).toContain('title: row.action_title');
    expect(pageSource).toContain('source_id: row.id');
    expect(pageSource).toContain('source_reference: row.id');
  });

  it('3. verifies unscheduled action prompts for date and auto-fills all other fields', () => {
    expect(pageSource).toContain('setCalendarPromptTask(row)');
    expect(pageSource).toContain('calendarPromptTask');
    expect(pageSource).toContain('handleConfirmCalendarPrompt');
    expect(pageSource).toContain('Add to Concludo Calendar');
    expect(pageSource).toContain('Details are auto-filled from the action item below');
  });

  it('4. verifies Calendar sync column displays Linked badge when synced and Not linked when not', () => {
    expect(pageSource).toContain('ach-cal-linked-badge');
    expect(pageSource).toContain('Linked');
    expect(pageSource).toContain('Not linked');
    expect(cssSource).toContain('.ach-cal-linked-badge');
  });

  it('5. verifies floating sticky horizontal scrollbar is defined with sync handlers', () => {
    expect(pageSource).toContain('tableWrapperRef');
    expect(pageSource).toContain('ach-floating-scrollbar-thumb');
    expect(pageSource).toContain('handleThumbPointerDown');
    expect(pageSource).toContain('showFloatingScroll');
    expect(pageSource).toContain('ach-floating-scrollbar');
    expect(pageSource).toContain('handleTableScroll');
    expect(pageSource).toContain('handleTableScroll');
    expect(pageSource).toContain('isDraggingThumb');
    expect(cssSource).toContain('.ach-floating-scrollbar');
    expect(cssSource).toContain('position: fixed');
    expect(cssSource).toContain('bottom: 0');
  });

  it('5b. verifies table layout is fixed with shortened column gaps and wrapped titles', () => {
    expect(cssSource).toContain('table-layout: fixed');
    expect(cssSource).toContain('min-width: 1100px');
    expect(cssSource).toContain('word-break: break-word');
    expect(pageSource).toContain('<col style={{ width: \'38px\' }} />');
    expect(pageSource).toContain('<col style={{ width: \'320px\' }} />');
  });

  it('6. verifies zero em dashes or en dashes in new code', () => {
    expect(pageSource).not.toContain('\u2014'); // em dash
    expect(pageSource).not.toContain('\u2013'); // en dash
  });
});
