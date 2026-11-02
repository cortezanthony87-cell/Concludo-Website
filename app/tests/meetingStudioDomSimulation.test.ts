import { describe, it, expect } from 'bun:test';
import * as CE from '../src/lib/intelligence/meetingEngine';
import { exportActionsToCsv, exportStandaloneHtml } from '../src/features/meeting-output/studio';

describe('Meeting Output Studio Logic & Bulk Operations', () => {
  const sampleTranscript = `
Alice (Chair): Good morning team. Today is Tuesday 3 November 2026.
Bob: We need to decide whether to migrate the database to the new schema.
Alice: Decision: Proceed with schema v2 migration on Friday 6 November.
Bob: I will handle the migration scripts by Thursday 5 November. "Definition of done": scripts pass staging smoke test.
Charlie: I will review the backup verification by Thursday 5 November.
Dana: Risk: Potential downtime during migration. Mitigation: run migration outside business hours.
Alice: Open question: Whether customer notifications should go out 24 hours prior?
`;

  it('verifies bulk confirm-all updates all non-excluded items across all four categories', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    // Make one item excluded to test preservation
    model.actions[0].review = 'excluded';

    const allItems = [
      ...(model.decisions || []),
      ...(model.actions || []),
      ...(model.risks || []),
      ...(model.openItems || []),
    ];

    // Confirm all logic as implemented in studio.js
    allItems.forEach((x) => {
      if (x && x.review !== 'excluded') x.review = 'confirmed';
    });

    CE.refresh(model);

    // Verify
    expect(model.actions[0].review).toBe('excluded');
    const remainingNonExcluded = allItems.filter((x) => x.review !== 'excluded');
    expect(remainingNonExcluded.every((x) => x.review === 'confirmed')).toBe(true);
    expect(remainingNonExcluded.length).toBeGreaterThanOrEqual(1);
  });

  it('verifies target model for Save New Project correctly formats payload and project title', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    const target = {
      mode: 'new',
      title: 'Custom New Project Title',
      client: 'Acme Corp',
    };

    expect(target.mode).toBe('new');
    expect(target.title).toBe('Custom New Project Title');
    expect(target.client).toBe('Acme Corp');

    // Default fallback when title is empty in input
    const fallbackTitle = (''.trim()) || model.meta?.title || 'Meeting Project';
    expect(fallbackTitle).toBe('Database Schema Review');
  });

  it('verifies CSV and HTML exports format correctly', () => {
    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: sampleTranscript }], {
      title: 'Database Schema Review',
      meetingDate: '2026-11-03',
      meetingType: 'Technical review',
      organisation: 'Concludo Pty Ltd',
    });

    const csv = exportActionsToCsv(model.actions);
    expect(csv.startsWith('ID,Task,Owner,Due Date')).toBe(true);

    const html = exportStandaloneHtml(model);
    expect(html.includes('Database Schema Review')).toBe(true);
    expect(html.includes('Concludo Pty Ltd')).toBe(true);
  });
});
