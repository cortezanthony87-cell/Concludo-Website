import { describe, expect, test } from 'bun:test';
import { analyseMeeting } from '../src/lib/intelligence/meetingEngine';

// Regression guards for behaviour the base engine already had (Round 7 fix, 23 Nov 2026).
const run = (kind: 'transcript' | 'notes' | 'document', text: string) =>
  analyseMeeting([{ name: 'x.txt', kind, text }], { meetingDate: '2026-10-27' }) as any;

describe('meetingRulesV3 regression guards', () => {
  test('a capitalised "Can you ...?" request is resolved when the reply is "I can do that"', () => {
    const m = run('transcript', [
      "Sarah Connor: Why don't we switch our cloud storage provider to Sydney next quarter?",
      'Kyle Reese: Works for me.',
      'Sarah Connor: Can you audit the database permissions before Friday?',
      'Kyle Reese: I can do that tonight.',
    ].join('\n'));
    const a = m.actions.find((x: any) => x.owner === 'Kyle Reese');
    expect(a).toBeDefined();
    expect(String(a.task).toLowerCase()).toContain('audit');
  });

  test('tag questions are not raised as open questions', () => {
    const m = run('transcript', [
      'Sarah Connor: This rollout has been a lot of work for everyone, hasn\'t it, and the vendor is still quiet, isn\'t it?',
      'Kyle Reese: Yes, it has.',
    ].join('\n'));
    expect(m.openItems.some((q: any) => /isn't it\?/i.test(q.question))).toBe(false);
  });

  test('an unrecorded consent note keeps the base wording', () => {
    const m = run('transcript', [
      'Sarah Connor: Let us start with the rollout plan for next month.',
      'Kyle Reese: Fine, I will draft the plan by Friday.',
    ].join('\n'));
    expect(m.consent?.note).toContain('Consent was not recorded');
  });

  test('notes and document sources are left to the base extractor', () => {
    const m = run('notes', '# Ops sync\nDate: 2 November 2026\n- Decision: Move stocktake to Thursdays\n- Action: order new signage');
    expect(m.actions.length).toBeGreaterThanOrEqual(1);
    expect(m.actions[0].owner).toBeUndefined();
  });
});
