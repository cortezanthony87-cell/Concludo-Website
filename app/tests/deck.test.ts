/**
 * Deck renderer tests. Run: npx tsx --test tests/deck.test.ts
 * No network, no database, no browser.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import PptxGenJS from 'pptxgenjs';
import JSZip from 'jszip';
import { DECK_SAMPLE } from '../src/features/meeting-output/deckSample';
import {
  DeckExportBlocked, DeckPayload, planDeck, renderDeckHtml, renderDeckPptx, validateDeck, fromMeetingRecordV1, fromEngineRecord,
} from '../src/lib/outputs/deck';
import { shortDay, longDate, clean } from '../src/lib/outputs/deck/deckPlan';

const clone = (): DeckPayload => JSON.parse(JSON.stringify(DECK_SAMPLE));
const DASH = /[\u2013\u2014]/;

async function pptxText(p: DeckPayload, opts = {}) {
  const r = await renderDeckPptx(PptxGenJS as any, p, opts, 'nodebuffer');
  const zip = await JSZip.loadAsync(r.data as Buffer);
  const names = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .sort((a, b) => Number(a.match(/\d+/)![0]) - Number(b.match(/\d+/)![0]));
  const slides: string[] = [];
  for (const n of names) {
    const xml = await zip.file(n)!.async('string');
    slides.push([...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]).join(' ').replace(/&apos;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
  }
  return { slides, all: slides.join('\n'), count: r.slideCount };
}

const htmlText = (p: DeckPayload, opts = {}) => renderDeckHtml(p, opts).html.replace(/<style>[\s\S]*?<\/style>/, '').replace(/<[^>]+>/g, ' ');

test('1. sample renders six slides with every confirmed id and no dashes', async () => {
  const t = await pptxText(DECK_SAMPLE);
  assert.equal(t.count, 6);
  assert.equal(t.slides.length, 6);
  for (const id of ['D-01', 'D-02', 'D-03', 'A-01', 'A-02', 'A-03', 'A-04', 'A-05', 'Q-01', 'Q-02', 'R-01']) assert.ok(t.all.includes(id), `missing ${id}`);
  assert.ok(!DASH.test(t.all));
  assert.ok(!DASH.test(htmlText(DECK_SAMPLE)));
});

test('2. export is refused without an approval stamp', () => {
  const p = clone(); p.approval = null;
  assert.throws(() => planDeck(p), DeckExportBlocked);
  assert.ok(validateDeck(p).errors.some((e) => /not been approved/.test(e)));
});

test('3. export is refused while any item is still proposed', () => {
  const p = clone(); p.actions[2].review = 'proposed'; p.risks[0].review = 'proposed';
  const v = validateDeck(p);
  assert.equal(v.ok, false);
  assert.ok(v.errors.includes('2 items are still to review.'));
});

test('4. excluded items never reach either output', async () => {
  const p = clone(); p.decisions[1].review = 'excluded'; p.actions[0].review = 'excluded';
  const t = await pptxText(p);
  assert.ok(!t.all.includes('D-02') && !t.all.includes('AU$42,000 '.trim() + ' Jo'));
  assert.ok(!t.all.includes('A-01'));
  assert.ok(!htmlText(p).includes('A-01'));
  assert.ok(t.all.includes('Two decisions were made'));
});

test('5. gaps print as Not stated and nothing fills them', async () => {
  const t = await pptxText(DECK_SAMPLE);
  const actionsSlide = t.slides[3];
  assert.ok(/A-04 Confirm IT access/.test(actionsSlide));
  assert.ok((actionsSlide.match(/NOT STATED/g) ?? []).length >= 2);
  assert.ok(!/Project Team|TBC|TBD/.test(t.all));
  assert.ok(t.slides[4].includes('OWNER NOT STATED'));
});

test('6. empty meeting: no invented decision, action or next meeting', async () => {
  const p = clone();
  p.decisions = []; p.actions = []; p.openQuestions = []; p.risks = [];
  p.summary = { headline: null, body: null };
  p.nextMeeting = null; p.meeting.outcomeLine = null;
  const t = await pptxText(p);
  assert.equal(t.count, 3); // cover, bottom line, next step
  assert.ok(t.all.includes('No decisions, actions or open questions were recorded'));
  assert.ok(t.all.includes('No next meeting set'));
  assert.ok(!/D-0|A-0|Q-0|R-0/.test(t.all));
  assert.ok(!t.all.includes('Nothing left open'));
});

test('7. Nothing left open prints only when the reviewer confirmed it', async () => {
  const p = clone(); p.openQuestions = []; p.risks = [];
  assert.ok(!(await pptxText(p)).all.includes('Nothing left open'));
  p.nothingLeftOpenConfirmed = true;
  assert.ok((await pptxText(p)).all.includes('Nothing left open'));
});

test('8. overflow: fourteen actions split into continued slides, none lost, none repeated', async () => {
  const p = clone();
  p.actions = Array.from({ length: 14 }, (_, i) => ({
    id: `A-${String(i + 1).padStart(2, '0')}`, review: 'confirmed' as const,
    text: i % 3 === 0 ? 'Prepare the detailed cost comparison across all three supplier options, including freight and installation' : `Action number ${i + 1}`,
    owner: i % 4 === 0 ? null : 'Sam Ortiz', clientSide: false,
    dueISO: i % 5 === 0 ? null : `2026-11-${String(10 + i).padStart(2, '0')}`, doneWhen: 'Filed', source: {},
  }));
  const plan = planDeck(p);
  const pages = plan.slides.filter((s) => s.kind === 'actions') as any[];
  assert.ok(pages.length >= 3);
  assert.ok(pages.every((s) => s.rows.length <= 6));
  assert.equal(pages[1].headline, 'Actions, continued');
  const ids = pages.flatMap((s) => s.rows.map((r: any) => r.id));
  assert.equal(ids.length, 14);
  assert.equal(new Set(ids).size, 14);
  const t = await pptxText(p);
  assert.equal(t.count, plan.slides.length);
});

test('9. long decisions paginate at five or fewer per slide', () => {
  const p = clone();
  p.decisions = Array.from({ length: 9 }, (_, i) => ({
    id: `D-${String(i + 1).padStart(2, '0')}`, review: 'confirmed' as const,
    text: 'Approve the revised governance arrangement for the steering committee, including the change to quorum and the reporting cycle',
    decidedBy: 'Jo Han', decidedByOrg: null, conditions: 'Subject to board ratification at the December meeting', source: { line: 100 + i },
  }));
  const pages = planDeck(p).slides.filter((s) => s.kind === 'decisions') as any[];
  assert.ok(pages.length >= 2);
  assert.ok(pages.every((s) => s.rows.length <= 5));
  assert.equal(pages.flatMap((s) => s.rows).length, 9);
});

test('10. en and em dashes in source text are removed before rendering', async () => {
  const p = clone();
  p.decisions[0].text = 'Proceed with Option B \u2014 the phased rollout';
  p.summary.body = 'Budget AU$40,000\u201342,000, provisional.';
  const t = await pptxText(p);
  assert.ok(!DASH.test(t.all));
  assert.ok(t.all.includes('Proceed with Option B, the phased rollout'));
  assert.ok(t.all.includes('AU$40,000 to 42,000'));
  assert.equal(clean('a \u2013 b'), 'a, b');
});

test('11. verbatim quotes are off by default and on only when asked', async () => {
  assert.ok(!(await pptxText(DECK_SAMPLE)).all.includes("Let's go with B"));
  assert.ok((await pptxText(DECK_SAMPLE, { quotes: true })).all.includes("Let's go with B"));
});

test('12. a headline over two lines blocks export', () => {
  const p = clone(); p.summary.headline = 'x'.repeat(111);
  assert.equal(validateDeck(p).ok, false);
});

test('13. "all by the client" only when every decision names the client organisation', () => {
  const p = clone();
  assert.equal((planDeck(p).slides[2] as any).headline, 'Three decisions were made');
  p.decisions[2].decidedByOrg = 'Kestrel and Vale';
  assert.equal((planDeck(p).slides[2] as any).headline, 'Three decisions were made, all by Kestrel and Vale');
});

test('14. dates are calendar safe in any time zone', () => {
  assert.equal(shortDay('2026-11-04'), 'Wed 4 Nov');
  assert.equal(longDate('2026-10-28'), 'Wednesday 28 October 2026');
  const t = planDeck(DECK_SAMPLE).slides[0] as any;
  assert.equal(t.approved, 'Reviewed and approved 28 Oct 2026, 4:12 pm');
});

test('15. PPTX and HTML print view carry the same slides', async () => {
  for (const p of [DECK_SAMPLE, (() => { const x = clone(); x.nextMeeting = null; return x; })()]) {
    const h = renderDeckHtml(p);
    const t = await pptxText(p);
    assert.equal(h.slideCount, t.count);
    assert.equal((h.html.match(/<section class="pg/g) ?? []).length, t.count);
  }
});

test('16. actions sort by due date with undated last, and only the earliest is marked', () => {
  const s = planDeck(DECK_SAMPLE).slides.find((x) => x.kind === 'actions') as any;
  assert.deepEqual(s.rows.map((r: any) => r.id), ['A-01', 'A-02', 'A-03', 'A-05', 'A-04']);
  assert.deepEqual(s.rows.filter((r: any) => r.first).map((r: any) => r.id), ['A-01']);
});

test('17. adapter: unreviewed items count as proposed and unstated values stay empty', () => {
  const record = {
    meeting: { id: 'M1', title: 'Review', date: '2026-10-28', client_or_project: 'Kestrel and Vale', outcome_one_line: 'Approved' },
    executive_summary: 'Option B was approved. Budget is provisional.',
    decisions: [{ id: 'D-01', decision: 'Approve B', approver: { name: 'Jo Han', organisation: 'Kestrel and Vale', status: 'stated' as const }, conditions: null, evidence: 'confirmed', source_basis: 'line 112 at 14:05' }],
    actions: [{ id: 'A-01', action: 'Send scope', owner: { name: null, status: 'not_stated' as const }, definition_of_done: null, due_date: null, due_date_status: 'not_stated' as const, evidence: 'confirmed', source_basis: 'line 131' }],
    open_questions: [],
    risks: [{ id: 'R-01', risk: 'Inferred risk', mitigation: null, owner: { name: null, status: 'not_stated' as const }, evidence: 'inferred' }],
  };
  const ctx = {
    review: { 'D-01': 'confirmed' as const }, approval: { by: 'Sam', atISO: '2026-10-28T05:12:00Z' }, audience: 'client' as const,
    version: 1, preparedBy: { name: 'Sam Ortiz', organisation: null }, clientOrganisation: 'Kestrel and Vale',
    outcomeConfirmed: false, nothingLeftOpenConfirmed: false, nextMeeting: null, correctionDeadline: null,
  };
  const p = fromMeetingRecordV1(record, ctx);
  assert.equal(p.actions[0].review, 'proposed');
  assert.equal(p.actions[0].owner, null);
  assert.equal(p.meeting.outcomeLine, null);
  assert.equal(p.risks.length, 0); // inferred risks never reach a deck
  assert.deepEqual(p.decisions[0].source, { line: 112, time: '14:05', quote: null });
  assert.equal(validateDeck(p).ok, false); // A-01 still to review
  ctx.review = { 'D-01': 'confirmed', 'A-01': 'confirmed' } as any;
  assert.equal(validateDeck(fromMeetingRecordV1(record, ctx)).ok, true);
});

test('18. engine adapter: unreviewed items count as proposed and unstated values stay empty', () => {
  const model: any = {
    version: '2.0',
    meta: { title: 'Review', meetingType: 'Internal review', meetingDate: '2026-10-28', organisation: 'Kestrel and Vale', project: 'Cutover' },
    bottomLine: 'Option B was approved. Budget is provisional.',
    decisions: [{ id: 'D01', statement: 'Approve B', calledBy: 'Jo Han', status: 'agreed', evidence: [{ line: 112, timestamp: '14:05', quote: 'Approve B' }], review: 'proposed' }],
    actions: [{ id: 'A01', task: 'Send scope', owner: undefined, ownerBasis: 'none', due: undefined, evidence: [{ line: 131, timestamp: '15:00', quote: 'Send scope' }], review: 'proposed' }],
    openItems: [],
    risks: [],
    figures: [],
    recommendations: [],
    sources: [],
    participants: [],
  };
  const ctx: any = {
    review: { D01: 'confirmed' },
    approval: { by: 'Sam', atISO: '2026-10-28T05:12:00Z' },
    audience: 'client',
    version: 1,
    preparedBy: { name: 'Sam Ortiz', organisation: null },
    clientOrganisation: 'Kestrel and Vale',
    outcomeConfirmed: false,
    nothingLeftOpenConfirmed: false,
    nextMeeting: null,
    correctionDeadline: null,
  };
  const p = fromEngineRecord(model, ctx);
  assert.equal(p.actions[0].review, 'proposed');
  assert.equal(p.actions[0].owner, null);
  assert.equal(p.meeting.outcomeLine, null);
  assert.deepEqual(p.decisions[0].source, { line: 112, time: '14:05', quote: null });
  assert.equal(validateDeck(p).ok, false); // A01 still to review
  ctx.review = { D01: 'confirmed', A01: 'confirmed' };
  assert.equal(validateDeck(fromEngineRecord(model, ctx)).ok, true);
});

test('19. engine adapter: unstated stays null and does not use placeholder owners', () => {
  const model: any = {
    version: '2.0',
    meta: { title: 'Review', meetingType: 'Review', meetingDate: '2026-10-28' },
    bottomLine: 'Headline text. Body text.',
    decisions: [{ id: 'D01', statement: 'Approved', calledBy: undefined, status: 'agreed', evidence: [], review: 'confirmed' }],
    actions: [{ id: 'A01', task: 'Task 1', owner: 'Project Team', ownerBasis: 'none', due: undefined, evidence: [], review: 'confirmed' }],
    openItems: [],
    risks: [],
    figures: [],
    recommendations: [],
    sources: [],
    participants: [],
  };
  const ctx: any = {
    review: { D01: 'confirmed', A01: 'confirmed' },
    approval: { by: 'Sam', atISO: '2026-10-28T05:12:00Z' },
    audience: 'client',
    version: 1,
    preparedBy: { name: 'Sam Ortiz', organisation: null },
    clientOrganisation: null,
    outcomeConfirmed: false,
    nothingLeftOpenConfirmed: false,
    nextMeeting: null,
    correctionDeadline: null,
  };
  const p = fromEngineRecord(model, ctx);
  assert.equal(p.decisions[0].decidedBy, null);
  assert.equal(p.actions[0].owner, null);
  assert.equal(p.actions[0].dueISO, null);
});

test('20. engine adapter: inferred risks are dropped and only risks said aloud reach deck', () => {
  const model: any = {
    version: '2.0',
    meta: { title: 'Review', meetingType: 'Review', meetingDate: '2026-10-28' },
    bottomLine: 'Headline text. Body text.',
    decisions: [{ id: 'D01', statement: 'Approved', calledBy: 'Mara', status: 'agreed', evidence: [], review: 'confirmed' }],
    actions: [],
    openItems: [],
    risks: [
      { id: 'R01', risk: 'Risk said aloud', raisedBy: 'Priya Shah', evidence: [], review: 'confirmed' },
      { id: 'R02', risk: 'Inferred risk by Concludo', raisedBy: undefined, evidence: [], review: 'confirmed' },
    ],
    figures: [],
    recommendations: [],
    sources: [],
    participants: [],
  };
  const ctx: any = {
    review: { D01: 'confirmed', R01: 'confirmed', R02: 'confirmed' },
    approval: { by: 'Sam', atISO: '2026-10-28T05:12:00Z' },
    audience: 'client',
    version: 1,
    preparedBy: { name: 'Sam Ortiz', organisation: null },
    clientOrganisation: null,
    outcomeConfirmed: false,
    nothingLeftOpenConfirmed: false,
    nextMeeting: null,
    correctionDeadline: null,
  };
  const p = fromEngineRecord(model, ctx);
  assert.equal(p.risks.length, 1);
  assert.equal(p.risks[0].id, 'R01');
  assert.equal(p.risks[0].raisedBy, 'Priya Shah');
});
