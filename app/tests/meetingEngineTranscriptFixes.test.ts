import { describe, it, expect } from 'bun:test';
import * as CE from '../src/lib/intelligence/meetingEngine';
import { exportActionsToCsv, exportStandaloneHtml } from '../src/features/meeting-output/studio';

describe('Meeting Engine Transcript & Guardrail Fixes', () => {
  it('parses standalone Name mm:ss headers without splitting minute counters into synthetic surnames', () => {
    const transcript = `
Meeting: Strategy Review
Date: 2026-11-19

Anthony 00:07
Good morning Alan, how are you going today?

Alan 00:10
I am doing well Anthony, thanks for making time.

Anthony 01:22
I am happy to provide a trial account so you can test the platform.

Alan 01:45
That sounds great, I will test one or two features and give you feedback by Friday.
`;

    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: transcript }]);

    // Exactly 2 real participants, not Anthony 00, Alan 00, Anthony 01, etc.
    const names = model.participants.map(p => p.name);
    expect(names).toContain('Anthony');
    expect(names).toContain('Alan');
    expect(names.length).toBe(2);
    expect(names.some(n => /\d/.test(n))).toBe(false);

    // Turn text is cleaned of leading minute/second numbers
    const action = model.actions.find(a => a.owner === 'Anthony');
    expect(action).toBeDefined();
    expect(action?.task).toContain('Provide a trial account');
  });

  it('correctly reports Not applicable for zero actions in quality gate', () => {
    const transcriptWithNoActions = `
Alice: Hello everyone.
Bob: Hi Alice.
Alice: Decision: We will continue using Australian English across all Concludo interfaces.
Bob: Agreed.
`;

    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: transcriptWithNoActions }]);

    expect(model.actions.length).toBe(0);
    const ownerCheck = model.gate.checks.find(c => c.label === 'Every action has an owner');
    const dateCheck = model.gate.checks.find(c => c.label === 'Every action has a date');

    expect(ownerCheck?.detail).toBe('Not applicable, 0 actions.');
    expect(dateCheck?.detail).toBe('Not applicable, 0 actions.');
    expect(ownerCheck?.detail).not.toContain('All owned');
    expect(dateCheck?.detail).not.toContain('All dated');
  });

  it('reports source extraction limitation rather than declaring absolute absence in bottom line', () => {
    const transcriptWithNoDecisions = `
Alice: Let's review the pending items.
Bob: I will update the documentation by Thursday 26 November.
`;

    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: transcriptWithNoDecisions }]);

    expect(model.decisions.length).toBe(0);
    expect(model.bottomLine).toContain('No decisions were extracted from the supplied transcript.');
    expect(model.bottomLine).not.toContain('No decision was recorded in this meeting.');
  });

  it('filters out rhetorical tag questions from open items', () => {
    const transcript = `
Alice: That is very important, isn't it?
Bob: I don't know, maybe we should think about it.
Alice: What is the target customer onboarding timeline?
Bob: I will check with the product team and let you know.
`;

    const model = CE.analyseMeeting([{ name: 'transcript.txt', kind: 'transcript', text: transcript }]);

    const questionTexts = model.openItems.map(q => q.question);
    expect(questionTexts.some(q => /isn't it\?/i.test(q))).toBe(false);
    expect(questionTexts.some(q => /onboarding timeline/i.test(q))).toBe(true);
  });

  it('flags a low extraction yield warning when large transcript yields two or fewer items', () => {
    // Generate a 1,100 word transcript of casual chatting with no business outcomes
    const fillerWords = 'The quick brown fox jumps over the lazy dog and talks about the weather in Melbourne today. ';
    const longText = 'Alice 00:01\n' + fillerWords.repeat(70) + '\nBob 10:00\n' + fillerWords.repeat(70);

    const model = CE.analyseMeeting([{ name: 'long_chat.txt', kind: 'transcript', text: longText }]);

    expect(model.warnings.some(w => /Low extraction yield/i.test(w))).toBe(true);
  });

  it('exports actions to CSV and standalone HTML cleanly without error', () => {
    const sample = `
Alice: Decision: Launch staging environment.
Bob: I will configure DNS by Friday 20 November.
`;
    const model = CE.analyseMeeting([{ name: 'meeting.txt', kind: 'transcript', text: sample }]);

    const csv = exportActionsToCsv(model.actions);
    expect(csv).toContain('ID,Task,Owner,Due Date');
    expect(csv).toContain('Bob');

    const html = exportStandaloneHtml(model);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Commercial in confidence');
  });
});
