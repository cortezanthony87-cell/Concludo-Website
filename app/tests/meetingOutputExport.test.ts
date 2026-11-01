import { describe, it, expect } from 'bun:test';
import * as CE from '../src/lib/intelligence/meetingEngine';
import { exportActionsToCsv, exportStandaloneHtml } from '../src/features/meeting-output/studio';

describe('Meeting Output Export & PDF Wiring', () => {
  const sampleTranscript = `
Alice (Chair): Good morning team. Today is Tuesday 3 November 2026.
Bob: We need to decide whether to migrate the database to the new schema.
Alice: Decision D01 is to proceed with schema v2 migration on Friday 6 November, subject to backup verification.
Bob: I will handle the migration scripts by Thursday 5 November. "Definition of done": scripts pass staging smoke test.
Charlie: I will review the backup verification by Thursday 5 November.
`;

  it('generates a valid model and exports actions to CSV using exportActionsToCsv', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    expect(model).toBeDefined();
    expect(model.actions.length).toBeGreaterThanOrEqual(1);

    const csv = exportActionsToCsv(model.actions);
    expect(csv).toContain('ID,Task,Owner,Due Date');
    expect(csv).toContain('Bob');
    expect(csv).toContain('Charlie');
    expect(csv).toContain('"2026-11-05"');
    expect(csv).toContain('\r\n');
  });

  it('generates standalone printable HTML using exportStandaloneHtml', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    const html = exportStandaloneHtml(model);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Database Schema Review');
    expect(html).toContain('Concludo Pty Ltd');
    expect(html).toContain('2026-11-03');
    expect(html).toContain('Commercial in confidence');
    expect(html).toContain('@media print');
  });

  it('verifies that studio.js contains the top-actions with Save to project, Save all as PDF, and Export', async () => {
    const fs = await import('fs/promises');
    const studioPath = new URL('../src/features/meeting-output/studio.js', import.meta.url).pathname;
    const studioCode = await fs.readFile(studioPath, 'utf8');

    // Top bar action buttons
    expect(studioCode).toContain('data-act="save"');
    expect(studioCode).toContain('Save to project');
    expect(studioCode).toContain('data-act="save-all-pdf"');
    expect(studioCode).toContain('Save all as PDF');
    expect(studioCode).toContain('data-act="export-options"');
    expect(studioCode).toContain('Export');

    // Action handlers
    expect(studioCode).toContain("if (act === 'save-all-pdf') saveAllAsPdf();");
    expect(studioCode).toContain("if (act === 'export-options') modalExport();");
    expect(studioCode).toContain('downloadExportZip');
    expect(studioCode).toContain('downloadCsvActions');
    expect(studioCode).toContain('downloadFollowUpEmailTxt');
    expect(studioCode).toContain('modalExport');
  });

  it('verifies follow-up email gating is strictly enforced in exports', async () => {
    const fs = await import('fs/promises');
    const studioPath = new URL('../src/features/meeting-output/studio.js', import.meta.url).pathname;
    const studioCode = await fs.readFile(studioPath, 'utf8');

    // Gated in Save all as PDF pack
    expect(studioCode).toContain('...(CAN_DRAFT_EMAIL ? [() => tplEmailPage()] : [])');

    // Gated in ZIP export
    expect(studioCode).toContain('if (CAN_DRAFT_EMAIL) {');

    // Gated in single email download
    expect(studioCode).toContain("toast('Follow-up email drafts are included in Pro and Team.');");

    // Gated in modal export card
    expect(studioCode).toContain("${!CAN_DRAFT_EMAIL ? 'cmo-card-locked' : ''}");
    expect(studioCode).toContain('PRO &amp; TEAM');
  });
});
