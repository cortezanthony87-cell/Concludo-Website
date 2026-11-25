import { describe, expect, test } from 'bun:test';
import { analyseMeeting, toMarkdown } from '../src/lib/intelligence/meetingEngine';
import { exportStandaloneHtml } from '../src/features/meeting-output/studio.js';
import { mergeModelDraft } from '../src/lib/intelligence/modelDraftValidator';
import { shapeModelRecord, locateQuote } from '../src/lib/intelligence/modelDraftShape';

// Invented snippet. Not taken from any test transcript, fixture or acceptance source.
const TRANSCRIPT = [
  '[00:00:05] Ruth Okafor: Thanks both. We agreed the garden centre launch moves to the ninth of March.',
  '[00:00:20] Dev Patel: I will send the supplier the revised order by Friday the fourth of December.',
  '[00:00:41] Ruth Okafor: My worry is that the potting mix supplier is our only source for the launch range.',
  '[00:01:02] Dev Patel: Does the council permit cover the weekend market stall or not?',
  '[00:01:15] Ruth Okafor: Nobody knows yet, we will have to check.',
  '[00:01:30] Dev Patel: I think the stall fee is roughly four hundred dollars, but I have not checked.',
  '[00:01:52] Ruth Okafor: Your shelf plan was really clear, Dev, nice work.',
  '[00:02:10] Ruth Okafor: We will meet again on Tuesday the eighth of December at ten in the morning.',
].join('\n');
const SOURCE = { text: TRANSCRIPT, kind: 'transcript' as const, name: 'invented.txt' };

const DRAFT = {
  participants: [{ name: 'Ruth Okafor' }, { name: 'Dev Patel' }],
  decisions: [{ statement: 'The garden centre launch moves to 9 March.', source_quote: 'We agreed the garden centre launch moves to the ninth of March.' }],
  actions: [{ task: 'Send the supplier the revised order.', owner: 'Dev Patel', due: '2026-12-04', source_quote: 'I will send the supplier the revised order by Friday the fourth of December.' }],
  open_questions: [{ question: 'Does the council permit cover the weekend market stall?', source_quote: 'Does the council permit cover the weekend market stall or not?' }],
  risks: [{ risk: 'The potting mix supplier is the only source for the launch range.', source_quote: 'the potting mix supplier is our only source for the launch range' }],
  insights: [
    { insight: 'Ruth is worried about relying on one supplier.', kind: 'concern', who: 'Ruth Okafor', source_quote: 'My worry is that the potting mix supplier is our only source for the launch range.' },
    { insight: 'Ruth praised the shelf plan.', kind: 'feedback_positive', who: 'Ruth Okafor', source_quote: 'Your shelf plan was really clear, Dev, nice work.' },
    { insight: 'Dev disagrees on the fee.', kind: 'disagreement', who: 'Dev Patel', source_quote: 'I think the stall fee is roughly four hundred dollars' },
  ],
  statements_to_verify: [{ statement: 'The stall fee is roughly four hundred dollars.', source_quote: 'I think the stall fee is roughly four hundred dollars, but I have not checked.' }],
  next_meeting: { date: '2026-12-08', time: '10:00 am', raw_text: 'We will meet again on Tuesday the eighth of December at ten in the morning.', source_quote: 'We will meet again on Tuesday the eighth of December at ten in the morning.' },
};

function build() {
  const rule = analyseMeeting([{ name: SOURCE.name, kind: 'transcript', text: TRANSCRIPT }], { meetingDate: '2026-11-30', sourceType: 'transcript' } as any);
  const merged: any = mergeModelDraft(rule, JSON.stringify(DRAFT), SOURCE, 'transcript');
  expect(merged.drafting_method).toBe('model');
  shapeModelRecord(merged, SOURCE);
  return merged;
}

describe('modelDraftShape', () => {
  test('S1. every category is shaped, with ids, review state and located evidence', () => {
    const m = build();
    expect(m.decisions.map((d: any) => d.id)).toEqual(['D01']);
    expect(m.actions.map((a: any) => a.id)).toEqual(['A01']);
    expect(m.risks.map((r: any) => r.id)).toEqual(['R01']);
    expect(m.openItems.map((o: any) => o.id)).toEqual(['Q01']);
    for (const c of ['decisions', 'actions', 'risks', 'openItems']) {
      for (const item of m[c]) {
        expect(item.review).toBe('proposed');
        expect(item.evidence.length).toBeGreaterThan(0);
        expect(item.evidence[0].sourceId).toBe('S1');
        expect(Number.isInteger(item.evidence[0].line)).toBe(true);
      }
    }
    expect(m.decisions[0].evidence[0]).toMatchObject({ line: 1, timestamp: '00:00:05', speaker: 'Ruth Okafor' });
    expect(m.actions[0]).toMatchObject({ owner: 'Dev Patel', due: '2026-12-04', due_date: '2026-12-04', ownerBasis: 'stated', sourceLine: 2 });
    expect(m.actions[0].evidence[0].speaker).toBe('Dev Patel');
    expect(m.risks[0]).toMatchObject({ rating: 'not_rated', likelihood: 3, consequence: 3, raisedBy: 'Ruth Okafor' });
    expect(m.openItems[0]).toMatchObject({ kind: 'unresolved', raisedBy: 'Dev Patel' });
    expect(m.open_questions[0]).toMatchObject({ raised_by: 'Dev Patel', status: 'Not answered' });
    expect(m.statements_to_verify[0]).toMatchObject({ said_by: 'Dev Patel' });
  });

  test('S2. refresh() runs on the drafted items: gaps, stats, recommendations and gate describe them', () => {
    const m = build();
    expect(m.actions[0].gaps).toEqual(['Definition of done not stated']);
    expect(m.stats).toMatchObject({ decisions: 1, actions: 1, owned: 1, dated: 1, openItems: 1, risks: 1 });
    expect(m.recommendations.every((r: any) => ['Q01', 'R01'].includes(r.ref))).toBe(true);
    expect(typeof m.bottomLine).toBe('string');
    expect(m.gate.status).toBeDefined();
  });

  test('S3. insight kinds outside the engine list are mapped, never dropped', () => {
    const m = build();
    expect(m.insights.map((i: any) => i.kind)).toEqual(['concern', 'feedback_positive', 'concern']);
  });

  test('S4. both exporters run on a fully drafted record and never print "undefined"', () => {
    const m = build();
    const md = toMarkdown(m);
    const html = exportStandaloneHtml(m);
    expect(md.length).toBeGreaterThan(100);
    expect(html.length).toBeGreaterThan(100);
    expect(md).not.toContain('undefined');
    expect(html).not.toContain('undefined');
    expect(md).toContain('S1 line 1 at 00:00:05, Ruth Okafor');
  });

  test('S5. locateQuote finds a quote that starts mid-line and returns null for a missing quote', () => {
    expect(locateQuote(SOURCE, ['Ruth Okafor', 'Dev Patel'], 'the potting mix supplier is our only source')).toMatchObject({ line: 3, speaker: 'Ruth Okafor', timestamp: '00:00:41' });
    expect(locateQuote(SOURCE, ['Ruth Okafor'], 'nothing like this appears anywhere here')).toBeNull();
  });

  test('S6. notes keep line references without inventing a speaker', () => {
    const notes = 'Minutes\nPresent: Ruth Okafor, Dev Patel\n1. The committee decided to repaint the hall in January.';
    expect(locateQuote({ text: notes, kind: 'notes' }, ['Ruth Okafor'], 'The committee decided to repaint the hall')).toEqual({ line: 3 });
  });

  test('S7. a stale consent_not_recorded warning is removed once consent shows who asked', () => {
    const rule = analyseMeeting([{ name: SOURCE.name, kind: 'transcript', text: TRANSCRIPT }], { meetingDate: '2026-11-30', sourceType: 'transcript' } as any);
    const merged: any = mergeModelDraft(rule, JSON.stringify(DRAFT), SOURCE, 'transcript');
    merged.consent = { asked_by: 'Ruth Okafor', answered_by: 'Dev Patel', at: null, note: 'Asked.', source_quote: 'Thanks both.' };
    merged.warnings = ['consent_not_recorded', 'other'];
    shapeModelRecord(merged, SOURCE);
    expect(merged.warnings).not.toContain('consent_not_recorded');
    expect(merged.warnings).toContain('other');
  });
  test('S8. locateQuote finds a quote read down a table column at the row where it starts', () => {
    const table = ['Notes', '| Item | Outcome |', '| 1. Software | Renewal agreed with |', '|  | the same vendor for one |', '|  | year only. |'].join('\n');
    expect(locateQuote({ text: table, kind: 'notes' }, [], 'Renewal agreed with the same vendor for one year only.')).toEqual({ line: 3 });
    expect(locateQuote({ text: table, kind: 'notes' }, [], 'the same vendor for one year only')).toEqual({ line: 4 });
  });
});
