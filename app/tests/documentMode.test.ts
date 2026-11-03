import { describe, it, expect } from 'bun:test';
import {
  analyseMeeting,
  detectSourceType,
  toDocumentModeRecord,
} from '../src/lib/intelligence/meetingEngine';

describe('Document Mode Action Extraction (D1 - D6 Independent Unit Tests)', () => {
  it('D1: Source type detection distinguishes transcripts, minutes and documents', () => {
    const transcriptText = [
      '[09:00] Alice Walker: Good morning everyone, let us review the quarterly release.',
      '[09:02] Bob Stone: The mobile build is ready for deployment.',
    ].join('\n');
    expect(detectSourceType([{ name: 'call.txt', kind: 'transcript', text: transcriptText }])).toBe('transcript');

    const minutesText = [
      'Attendees: Clara Vance (Chair), David Lee, Fiona Green',
      'RESOLVED: Adopt the updated financial delegation schedule.',
      'ACTION: David Lee to submit the bank authority by Friday.',
    ].join('\n');
    expect(detectSourceType([{ name: 'minutes.txt', kind: 'notes', text: minutesText }])).toBe('minutes');

    const docText = [
      '# Product Rollout Strategy 2026',
      'Day 1 is Monday 3 August 2026.',
      '## Actions',
      '- [ ] Day 1: Notify key stakeholders of the launch date.',
      '- [ ] Days 2 to 5: Run integration tests across all payment gateways.',
    ].join('\n');
    expect(detectSourceType([{ name: 'strategy.md', kind: 'document', text: docText }])).toBe('document');
  });

  it('D2 & D3: Day 1 anchor resolution and stage end date inheritance', () => {
    const docText = [
      '# Strategic Implementation Roadmap',
      'Version 2.0. Day 1 is Wednesday 1 July 2026.',
      '',
      '## Stage 1: Setup and Baseline (1 to 14 July 2026)',
      '| Actions |',
      '| --- |',
      '| ☐ Day 1: Configure repository permissions and CI pipeline. |',
      '| ☐ Days 3 to 5: Establish database replicas and verify automated snapshots. |',
      '| ☐ Conduct initial architecture review with external auditor. |',
      '',
      '## Stage 2: Scaling (August to October 2026)',
      '| Actions |',
      '| --- |',
      '| ☐ Deploy multi-region CDN caching for static assets. |',
    ].join('\n');

    const m = analyseMeeting([{ name: 'roadmap.md', kind: 'document', text: docText }]);
    expect(m.sourceType).toBe('document');
    expect(m.actions.length).toBe(4);

    // Day 1: 1 July 2026
    const a1 = m.actions[0];
    expect(a1.task).toContain('Configure repository permissions');
    expect(a1.due).toBe('2026-07-01');
    expect(a1.dueBasis).toBe('stated');

    // Days 3 to 5: 1 July + 4 days = 5 July 2026
    const a2 = m.actions[1];
    expect(a2.task).toContain('Establish database replicas');
    expect(a2.due).toBe('2026-07-05');
    expect(a2.dueBasis).toBe('stated');

    // Action without stated day in Stage 1 inherits stage end date (14 July 2026)
    const a3 = m.actions[2];
    expect(a3.task).toContain('Conduct initial architecture review');
    expect(a3.due).toBe('2026-07-14');
    expect(a3.dueBasis).toBe('stage_end');

    // Action in Stage 2 inherits month-only precision without guessing a day
    const a4 = m.actions[3];
    expect(a4.task).toContain('Deploy multi-region CDN caching');
    expect(a4.due).toBe('2026-10');
    expect(a4.dueBasis).toBe('stage_end');
  });

  it('D4: Purpose clauses and descriptions are excluded from actions', () => {
    const docText = [
      '# Organisation Record Keeping Principles',
      'Each client archive has a purpose: to preserve legal agreements and to protect confidential client data.',
      'The primary aim of this directive is to ensure regulatory compliance across all teams.',
      'Our goal is to resolve client queries within twenty-four hours.',
      'Training seminars are intended to reinforce information governance standards.',
      'In order to reduce system latency, caches are cleared periodically.',
      'Nobody has yet been asked to own the records management policy refresh.',
    ].join('\n');

    const m = analyseMeeting([{ name: 'principles.md', kind: 'document', text: docText }]);
    expect(m.actions.length).toBe(0);
    expect(m.excludedItems?.length).toBeGreaterThanOrEqual(5);
    expect(m.excludedItems?.every((e) => ['purpose clause', 'unassigned gap', 'policy description'].includes(e.reason))).toBe(true);
  });

  it('D5: Tables preserve unassigned team owners and extract decision gates', () => {
    const docText = [
      '# Operational Handover Plan',
      'Prepared 10 August 2026.',
      '',
      '## Action Matrix',
      '| ID | Action | Owner | Due | Done when |',
      '| --- | --- | --- | --- | --- |',
      '| 1 | Circulate updated shift roster to clinical staff | Team | Friday 14 August | Roster published to staff portal |',
      '| 2 | Finalise equipment maintenance service agreement | Rachel Tan | 28 August | Agreement signed by vendor |',
      '',
      '## Phase 1 Review',
      '| Decision gate | 31 August 2026. Zero critical operational incidents and budget verified. |',
      '| If missed, stop | Pause phase two procurement. Reassess risk controls. |',
      '| If exceeded, accelerate | Expand shift coverage to satellite facility two weeks ahead of schedule. |',
    ].join('\n');

    const m = analyseMeeting([{ name: 'handover.md', kind: 'document', text: docText }]);
    expect(m.actions.length).toBe(2);

    // Row 1: Team owner remains unassigned with raw owner preserved
    const a1 = m.actions[0];
    expect(a1.owner).toBeUndefined();
    expect(a1.ownerRaw).toBe('Team');
    expect(a1.due).toBe('2026-08-14');
    expect(a1.doneWhen).toBe('Roster published to staff portal');

    // Row 2: Named person owner
    const a2 = m.actions[1];
    expect(a2.owner).toBe('Rachel Tan');
    expect(a2.due).toBe('2026-08-28');
    expect(a2.doneWhen).toBe('Agreement signed by vendor');

    // Decision gate extracted cleanly
    expect(m.gates?.length).toBe(1);
    const g = m.gates![0];
    expect(g.passTest).toContain('Zero critical operational incidents');
    expect(g.ifMissedStop).toContain('Pause phase two procurement');
    expect(g.ifExceededAccelerate).toContain('Expand shift coverage');
  });

  it('D2.4 & F3 check: Named person commitment in prose and next meeting extraction', () => {
    const docText = [
      '# Quarterly Strategy Update',
      'Held 18 May 2026.',
      'Simon Zhou will deliver the compliance risk assessment by Friday 29 May.',
      'The leadership team agreed to meet again on Wednesday 10 June to evaluate progress.',
    ].join('\n');

    const m = analyseMeeting([{ name: 'strategy.md', kind: 'document', text: docText }]);
    expect(m.actions.length).toBe(1);
    expect(m.actions[0].owner).toBe('Simon Zhou');
    expect(m.actions[0].task).toContain('deliver the compliance risk assessment');
    expect(m.actions[0].due).toBe('2026-05-29');

    expect(m.nextMeeting).toBeDefined();
    expect(m.nextMeeting?.date).toBe('2026-06-10');
  });

  it('D6: Coverage reconciliation satisfies candidates = extracted + excluded + needsAttention', () => {
    const docText = [
      '# Work Package Alpha',
      'The purpose of this document is to track deliverable milestones.',
      '- [ ] Confirm cloud storage provider contract terms.',
      '- [ ] Migrate legacy records to encrypted object store.',
    ].join('\n');

    const m = analyseMeeting([{ name: 'alpha.md', kind: 'document', text: docText }]);
    const cov = m.coverage;
    expect(cov).toBeDefined();
    expect(cov!.extracted).toBe(2);
    expect(cov!.excluded).toBe(1);
    expect(cov!.candidates).toBe(cov!.extracted + cov!.excluded + cov!.needsAttention);
    expect(cov!.unresolved.length).toBe(0);

    const rec = toDocumentModeRecord(m);
    expect(rec.source_type).toBe('document');
    expect(rec.actions.every((a) => a.evidence === 'Planned in source')).toBe(true);
  });
});
