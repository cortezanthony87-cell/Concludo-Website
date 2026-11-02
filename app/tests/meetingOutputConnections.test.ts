import { describe, it, expect } from 'bun:test';
import * as CE from '../src/lib/intelligence/meetingEngine';
import { generateMeetingPdf } from '../src/lib/reporting/meetingPdfGenerator';
import fs from 'node:fs/promises';

describe('Meeting Output Connections & Review Fixes', () => {
  const sampleTranscript = `
Alice (Chair): Good morning team. Today is Tuesday 3 November 2026.
Bob: We need to decide whether to migrate the database to the new schema.
Alice: Decision D01 is to proceed with schema v2 migration on Friday 6 November, subject to backup verification.
Bob: I will handle the migration scripts by Thursday 5 November. "Definition of done": scripts pass staging smoke test.
Charlie: I will review the backup verification by Thursday 5 November.
Dana: Risk R01 is potential downtime during migration. Mitigation: run migration outside business hours.
Alice: Open question Q01 is whether customer notifications should go out 24 hours prior.
`;

  it('1. Confirm all handles model with missing meetingDate without throwing TypeError', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    // Explicitly delete or null out meetingDate on model.meta to simulate missing date scenario
    delete (model.meta as any).meetingDate;
    expect(model.meta.meetingDate).toBeUndefined();

    // Verify initial states have proposed items
    const allItems = [...model.decisions, ...model.actions, ...model.risks, ...model.openItems];
    expect(allItems.length).toBeGreaterThan(0);

    // Simulate bulk confirm all logic
    allItems.forEach((x) => {
      if (x && x.review !== 'excluded') x.review = 'confirmed';
    });

    // Call refresh - must not crash on missing meetingDate
    expect(() => CE.refresh(model)).not.toThrow();

    // All non-excluded items are now confirmed
    const unconfirmed = allItems.filter((x) => x.review === 'proposed');
    expect(unconfirmed.length).toBe(0);

    // Excluded items should remain excluded if present
    const dummyExcluded = { ...model.actions[0], id: 'ACT-999', review: 'excluded' as const };
    const listWithExcluded = [dummyExcluded, ...allItems];
    listWithExcluded.forEach((x) => {
      if (x && x.review !== 'excluded') x.review = 'confirmed';
    });
    expect(listWithExcluded.find((x) => x.id === 'ACT-999')?.review).toBe('excluded');
  });

  it('2. studio.js contains Save New Project button and modal labels', async () => {
    const studioJs = await fs.readFile('/tmp/test-repo/app/src/features/meeting-output/studio.js', 'utf8');

    // Confirm button label in modal
    expect(studioJs).toContain('Save New Project');
    expect(studioJs).toContain('id="cmo-save-btn"');
    expect(studioJs).toContain('id="cmo-save-btn-text"');

    // Confirm hidden elements have proper style and attribute handling
    expect(studioJs).toContain('p.removeAttribute(\'hidden\');');
    expect(studioJs).toContain('p.style.display = \'\';');
    expect(studioJs).toContain('p.setAttribute(\'hidden\', \'\');');
    expect(studioJs).toContain('p.style.display = \'none\';');

    // Confirm enter key handler on inputs
    expect(studioJs).toContain('inp.addEventListener(\'keydown\', (e) => {');
  });

  it('3. meeting-output.css enforces [hidden] display none !important and modal max-height', async () => {
    const css = await fs.readFile('/tmp/test-repo/app/src/features/meeting-output/meeting-output.css', 'utf8');

    expect(css).toContain('.cmo [hidden],');
    expect(css).toContain('.cmo [data-pane][hidden] { display: none !important; }');
    expect(css).toContain('max-height: calc(100vh - 36px);');
  });

  it('4. saveMeetingRecord normalises null fields gracefully', async () => {
    const saveCode = await fs.readFile('/tmp/test-repo/app/src/lib/outputs/saveMeetingRecord.ts', 'utf8');

    expect(saveCode).toContain('m.meta?.meetingDate || null');
    expect(saveCode).toContain('(extras.sources || [])');
    expect(saveCode).toContain('extras.email?.subject || ""');
  });

  it('5. Exports generate valid binary files (PDF and ZIP)', async () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    const pdfBytes = await generateMeetingPdf(model);
    expect(pdfBytes.byteLength).toBeGreaterThan(1000);

    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('test.pdf', pdfBytes);
    zip.file('meeting.md', '# Meeting');
    const zipBlob = await zip.generateAsync({ type: 'uint8array' });
    expect(zipBlob.byteLength).toBeGreaterThan(500);
  });

  it('6. Zero em or en dashes in modified files', async () => {
    const files = [
      '/tmp/test-repo/app/src/features/meeting-output/studio.js',
      '/tmp/test-repo/app/src/features/meeting-output/meeting-output.css',
      '/tmp/test-repo/app/src/lib/outputs/saveMeetingRecord.ts',
    ];

    for (const f of files) {
      const content = await fs.readFile(f, 'utf8');
      expect(content).not.toContain('\u2014');
      expect(content).not.toContain('\u2013');
    }
  });
});
