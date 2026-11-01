import { describe, it, expect } from 'bun:test';
import * as CE from '../src/lib/intelligence/meetingEngine';
import { exportActionsToCsv, exportStandaloneHtml } from '../src/features/meeting-output/studio';
import { generateMeetingPdf } from '../src/lib/reporting/meetingPdfGenerator';

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
    const studioCode = await fs.readFile('/tmp/Concludo-Website/app/src/features/meeting-output/studio.js', 'utf8');

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

    // Verify the two print options in the modal are removed and replaced with real file downloads
    expect(studioCode).not.toContain('data-act="modal-save-all-pdf"');
    expect(studioCode).not.toContain('data-act="modal-print-current"');
    expect(studioCode).toContain('data-act="modal-dl-pdf"');
    expect(studioCode).toContain('data-act="modal-dl-zip"');
    expect(studioCode).toContain('downloadMeetingPdf');

    // Custom owner and Under review support
    expect(studioCode).toContain('Under review');
    expect(studioCode).toContain('data-act="add-custom-owner-btn"');
    expect(studioCode).toContain('data-act="save-custom-owner"');
    expect(studioCode).toContain('data-act="cancel-custom-owner"');
  });

  it('verifies follow-up email gating is strictly enforced in exports', async () => {
    const fs = await import('fs/promises');
    const studioCode = await fs.readFile('/tmp/Concludo-Website/app/src/features/meeting-output/studio.js', 'utf8');

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

  it('generates a valid binary PDF that can be saved and opened on device', async () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    const pdfBytes = await generateMeetingPdf(model);
    expect(pdfBytes).toBeInstanceOf(Uint8Array);
    expect(pdfBytes.length).toBeGreaterThan(1000);

    // PDF Header signature (%PDF-1.7)
    const headerStr = String.fromCharCode(...pdfBytes.slice(0, 8));
    expect(headerStr).toContain('%PDF-');
  });

  it('supports assigning actions to custom owners or marking them under review', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
    });

    const act1 = model.actions[0];
    expect(act1).toBeDefined();

    // Assign custom owner not present in meeting attendees
    act1.owner = 'Sarah Connor';
    act1.ownerBasis = 'custom';
    CE.refresh(model);
    expect(act1.owner).toBe('Sarah Connor');
    expect(act1.gaps).not.toContain('No owner named');

    // Mark as Under review
    act1.owner = 'Under review';
    act1.ownerBasis = 'custom';
    CE.refresh(model);
    expect(act1.owner).toBe('Under review');
    expect(act1.gaps).toContain('Owner under review');
    expect(act1.gaps).not.toContain('No owner named');
  });
});
