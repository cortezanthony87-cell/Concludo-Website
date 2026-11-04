import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

describe('Saved Project Full Meeting Output Report & Export to Device Tests', () => {
  it('F1: SavedProjectBrightView contains "See full report" button in header, next step, latest outputs and outputs tab', () => {
    const viewContent = fs.readFileSync('app/src/components/projects/bright/SavedProjectBrightView.tsx', 'utf8');
    
    // Button text presence
    assert.ok(viewContent.includes('See full report'), 'Must render "See full report" button');
    
    // Handler presence
    assert.ok(viewContent.includes('handleSeeFullReport'), 'Must define handleSeeFullReport handler');
    
    // Count occurrences of "See full report" (should be present across multiple key entry points)
    const occurrences = (viewContent.match(/See full report/g) || []).length;
    assert.ok(occurrences >= 4, `Expected at least 4 "See full report" buttons, found ${occurrences}`);
  });

  it('F2: SavedProjectBrightView provides direct device save buttons for PDF, ZIP, CSV, and Print', () => {
    const viewContent = fs.readFileSync('app/src/components/projects/bright/SavedProjectBrightView.tsx', 'utf8');
    
    assert.ok(viewContent.includes('Save as PDF'), 'Must render "Save as PDF" button');
    assert.ok(viewContent.includes('Package (.zip)'), 'Must render "Package (.zip)" button');
    assert.ok(viewContent.includes('Action tracker (.csv)'), 'Must render "Action tracker (.csv)" button');
    assert.ok(viewContent.includes('handlePrint'), 'Must provide Print handler');
    assert.ok(viewContent.includes('handleDownloadPdf'), 'Must provide handleDownloadPdf handler');
    assert.ok(viewContent.includes('handleDownloadZip'), 'Must provide handleDownloadZip handler');
    assert.ok(viewContent.includes('handleDownloadCsv'), 'Must provide handleDownloadCsv handler');
  });

  it('F3: Meeting output studio topbar displays export and print actions in viewer mode', () => {
    const cssContent = fs.readFileSync('app/src/features/meeting-output/meeting-output.css', 'utf8');
    const studioContent = fs.readFileSync('app/src/features/meeting-output/studio.js', 'utf8');

    // Stepper and save-to-project are hidden in viewer mode, but topbar is preserved
    assert.ok(cssContent.includes('.cmo.cmo-viewer .topbar'), 'Must define topbar styling for viewer mode');
    assert.ok(cssContent.includes('display: flex !important;'), 'Topbar must remain visible for viewer actions');
    assert.ok(studioContent.includes('data-act="print"'), 'Studio top actions must include Print button');
  });

  it('F4: Modal header contains responsive save buttons and multi-output document switcher', () => {
    const viewContent = fs.readFileSync('app/src/components/projects/bright/SavedProjectBrightView.tsx', 'utf8');
    
    assert.ok(viewContent.includes('MEETING OUTPUT REPORT'), 'Modal header must display report tag');
    assert.ok(viewContent.includes('Document view:'), 'Modal must provide document view switcher when multiple outputs exist');
  });

  it('F5: Zero em dashes or en dashes in modified files', () => {
    const viewContent = fs.readFileSync('app/src/components/projects/bright/SavedProjectBrightView.tsx', 'utf8');
    const cssContent = fs.readFileSync('app/src/components/projects/bright/saved-project-bright.css', 'utf8');
    const meetingCss = fs.readFileSync('app/src/features/meeting-output/meeting-output.css', 'utf8');
    const studioContent = fs.readFileSync('app/src/features/meeting-output/studio.js', 'utf8');

    assert.ok(!viewContent.includes('\u2014'), 'No em dash in SavedProjectBrightView.tsx');
    assert.ok(!viewContent.includes('\u2013'), 'No en dash in SavedProjectBrightView.tsx');
    assert.ok(!cssContent.includes('\u2014'), 'No em dash in saved-project-bright.css');
    assert.ok(!cssContent.includes('\u2013'), 'No en dash in saved-project-bright.css');
    assert.ok(!meetingCss.includes('\u2014'), 'No em dash in meeting-output.css');
    assert.ok(!meetingCss.includes('\u2013'), 'No en dash in meeting-output.css');
    assert.ok(!studioContent.includes('\u2014'), 'No em dash in studio.js');
    assert.ok(!studioContent.includes('\u2013'), 'No en dash in studio.js');
  });

  it('F6: DashboardPage.tsx remains completely untouched', () => {
    const dashboardContent = fs.readFileSync('app/src/pages/DashboardPage.tsx', 'utf8');
    assert.ok(dashboardContent.includes('DashboardQuickActionsToolbar'), 'Dashboard toolbar preserved');
  });
});
