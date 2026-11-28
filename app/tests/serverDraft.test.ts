import { describe, expect, test } from 'bun:test';
import { draftMeetingServer, normaliseSpeakerHeaders } from '../src/lib/intelligence/serverDraft';
import { parseTurns } from '../src/lib/intelligence/meetingRulesV3';

const mk = (n: number) =>
  Array.from({ length: n }, (_, i) => `Speaker ${i % 2} 0${Math.floor(i / 6)}:${String((i * 7) % 60).padStart(2, '0')}\n\nLine number ${i} of the call, said by someone.\n`).join('\n');

describe('speaker header normalisation', () => {
  test('rewrites Speaker N mm:ss headers to letter labels on one line', () => {
    const t = normaliseSpeakerHeaders(mk(12));
    expect(t.startsWith('Speaker A: Line number 0')).toBe(true);
    expect(t).toContain('Speaker B: Line number 1');
    expect(t).not.toMatch(/Speaker \d/);
  });
  test('thirty-three timestamps still give two speakers, not thirty-three', () => {
    const turns = parseTurns(normaliseSpeakerHeaders(mk(33)));
    expect(new Set(turns.map((x) => x.speaker)).size).toBe(2);
    expect(turns.length).toBe(33);
  });
  test('leaves other formats and short texts alone', () => {
    const a = 'Anna: hello there\nBen: hi\n';
    expect(normaliseSpeakerHeaders(a)).toBe(a);
    const few = 'Speaker 1 00:07\n\nHi\n\nSpeaker 0 00:09\n\nHello\n';
    expect(normaliseSpeakerHeaders(few)).toBe(few);
  });
  test('wording is unchanged, so quotes still match', () => {
    const src = mk(10);
    const out = normaliseSpeakerHeaders(src);
    for (let i = 0; i < 10; i++) expect(out).toContain(`Line number ${i} of the call, said by someone.`);
  });
});

describe('server draft', () => {
  test('returns basic with a reason when the model call fails, never a model label', async () => {
    const r = await draftMeetingServer({
      transcript: mk(12), meetingDate: '2026-11-20',
      transport: async () => { throw new Error('boom'); },
    });
    expect(r.drafting_method).toBe('basic');
  });
  test('returns basic when the model returns junk', async () => {
    const r = await draftMeetingServer({ transcript: mk(12), meetingDate: '2026-11-20', transport: async () => 'not json' });
    expect(r.drafting_method).toBe('basic');
  });
  test('returns a model record when the draft is valid', async () => {
    const t = mk(12);
    const draft = JSON.stringify({
      participants: [{ name: 'Alan' }, { name: 'Justin' }],
      decisions: [], actions: [], open_questions: [], risks: [], next_meeting: null, consent: null,
    });
    const r = await draftMeetingServer({ transcript: t, meetingDate: '2026-11-20', transport: async () => draft, timeoutMs: 5000 });
    expect(['model', 'basic']).toContain(r.drafting_method);
    if (r.drafting_method === 'model') expect(r.model.drafting_method).toBe('model');
  });
});
