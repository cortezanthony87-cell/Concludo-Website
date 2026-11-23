import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { analyseMeeting } from '../src/lib/intelligence/meetingEngine';

const DIR = join(import.meta.dir, '__fixtures__', 'round7');
const MEETING_DATE = '2026-11-02';
const norm = (s: string) => (s || '').toLowerCase().replace(/’/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = new Set('the a an and or of to in on at for from with by as is are was were be it its that this we us our all'.split(' '));
function blob(i: any): string {
  const parts: string[] = [];
  for (const v of Object.values(i)) {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) for (const e of v) { if (typeof e === 'string') parts.push(e); else if (e && typeof e === 'object') for (const x of Object.values(e)) if (typeof x === 'string') parts.push(x); }
  }
  return norm(parts.join(' '));
}
const cover = (exp: string, x: any) => { const w = norm(exp).split(' ').filter((t) => !STOP.has(t)); const b = blob(x).split(' '); return w.filter((t) => b.includes(t)).length / Math.max(1, w.length); };

describe('meetingRulesV3 synthetic fixtures (regression)', () => {
  for (const ef of readdirSync(DIR).filter((f) => f.endsWith('_expected.json')).sort()) {
    const ex = JSON.parse(readFileSync(join(DIR, ef), 'utf8'));
    test(ex.fixture, () => {
      const text = readFileSync(join(DIR, ex.fixture), 'utf8');
      const r: any = analyseMeeting([{ name: ex.fixture, kind: 'transcript', text }] as any, { meetingDate: MEETING_DATE } as any);
      expect(r.participants.map((p: any) => p.name).sort()).toEqual([...ex.participants].sort());
      for (const d of (ex.decisions ?? []).filter((x: any) => !x.known_gap)) expect(r.decisions.some((x: any) => cover(d.summary_includes, x) >= 0.7)).toBe(true);
      for (const a of ex.actions ?? []) {
        const c = r.actions.filter((x: any) => blob(x).includes(norm(a.text_includes)));
        expect(c.some((x: any) => norm(x.owner || '').includes(a.owner.split(' ')[0].toLowerCase()) && (!a.due_date || x.due_date === a.due_date))).toBe(true);
      }
      for (const q of ex.open_questions ?? []) expect(r.open_questions.some((x: any) => blob(x).includes(norm(q.text_includes)))).toBe(true);
      for (const k of ex.risks ?? []) expect(r.risks.some((x: any) => blob(x).includes(norm(k.text_includes)))).toBe(true);
      for (const s of ex.statements_to_verify ?? []) expect(r.statements_to_verify.some((x: any) => blob(x).includes(norm(s.text_includes)))).toBe(true);
      for (const k of ex.insights ?? []) expect(r.insights.some((x: any) => x.kind === k.kind && (!k.speaker || norm(String(x.who ?? x.speaker ?? '')).includes(k.speaker.split(' ')[0].toLowerCase())) && (!k.text_includes || blob(x).includes(norm(k.text_includes))))).toBe(true);
      const c = ex.consent;
      if (c) for (const u of c.unasked_speakers ?? []) expect((r.consent.not_asked ?? []).includes(u)).toBe(true);
    });
  }
});
