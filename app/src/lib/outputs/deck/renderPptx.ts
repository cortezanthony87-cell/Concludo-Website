/**
 * Renders a deck plan to an editable PowerPoint file (16:9, 13.33 x 7.5 in).
 * Text stays text and tables stay tables, so the user can retitle a slide or
 * fix a cell in PowerPoint, Keynote or Google Slides.
 *
 * Works in the browser and in Node. PptxGenJS is loaded by the caller so the
 * Workspace can import it lazily, only when a Pro user exports a deck.
 */
import type PptxGenJSType from 'pptxgenjs';
import { DeckOptions, DeckPayload } from './deckPayload';
import {
  ACTION_COLS, ActionsSlide, BottomSlide, CoverSlide, DECISION_COLS, DecisionsSlide, Footer, HEADER_ROW,
  M, NextSlide, OPEN_COL_W, OPEN_TOP, OpenSlide, PAGE, SlideSpec, TABLE_TOP, estimateLines, planDeck,
} from './deckPlan';

export const C = {
  navy: '16263F', navy2: '21395C', gold: 'E2B53C', goldDeep: 'BC8A1C', light: 'F4F6FA', white: 'FFFFFF',
  slate: '5A6478', ink: '2B3850', hair: 'E4E8EF', navyLine: '3A5072', onNavy: 'AEB9CC', onNavyQuiet: '8E9BB3',
  onNavyBody: 'C9D2E1', goldTint: 'FBF3DC', tag: 'E8ECF3',
};

export const FONTS = {
  brand: { head: 'Poppins', body: 'Inter', mono: 'IBM Plex Mono' },
  safe: { head: 'Arial', body: 'Arial', mono: 'Consolas' },
};

type Pres = InstanceType<typeof PptxGenJSType>;
type Slide = ReturnType<Pres['addSlide']>;

export type PptxOutput = 'nodebuffer' | 'blob' | 'uint8array';

export async function renderDeckPptx(
  PptxGenJS: typeof PptxGenJSType,
  payload: DeckPayload,
  opts: DeckOptions = {},
  outputType: PptxOutput = 'blob',
) {
  const plan = planDeck(payload, opts);
  const F = FONTS[opts.fonts ?? 'brand'];
  const pres: Pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = plan.title;
  pres.company = 'Concludo';
  pres.subject = 'Meeting record deck';
  pres.theme = { headFontFace: F.head, bodyFontFace: F.body };

  const ctx: Ctx = { pres, F, opts };
  for (const s of plan.slides) drawSlide(ctx, s);

  const data = await pres.write({ outputType, compression: true } as any);
  return { data, fileName: `${plan.fileName}.pptx`, slideCount: plan.slides.length };
}

interface Ctx { pres: Pres; F: typeof FONTS.brand; opts: DeckOptions }

function drawSlide(ctx: Ctx, s: SlideSpec) {
  switch (s.kind) {
    case 'cover': return cover(ctx, s);
    case 'bottom': return bottom(ctx, s);
    case 'decisions': return decisions(ctx, s);
    case 'actions': return actions(ctx, s);
    case 'open': return open(ctx, s);
    case 'next': return next(ctx, s);
  }
}

/* ---------------- shared pieces ---------------- */

function base(ctx: Ctx, bg: string): Slide {
  const slide = ctx.pres.addSlide();
  slide.background = { color: bg };
  return slide;
}

function head(ctx: Ctx, slide: Slide, kicker: string, headline: string, dark: boolean) {
  slide.addText(kicker.toUpperCase(), {
    x: M.x, y: 0.5, w: M.contentW, h: 0.3, margin: 0, fontFace: ctx.F.mono, fontSize: 9.5,
    color: dark ? C.onNavy : C.slate, charSpacing: 2,
  });
  slide.addText(headline, {
    x: M.x, y: 0.82, w: 10.9, h: 1.05, margin: 0, fontFace: ctx.F.head, fontSize: 28, bold: true,
    color: dark ? C.white : C.navy, valign: 'top', lineSpacingMultiple: 1.05, fit: 'none',
  });
}

function footer(ctx: Ctx, slide: Slide, f: Footer, dark: boolean) {
  const y = 6.98;
  const col = dark ? C.onNavyQuiet : C.slate;
  slide.addText(f.left.toUpperCase(), { x: M.x, y, w: 5.2, h: 0.28, margin: 0, fontFace: ctx.F.mono, fontSize: 7.5, color: col, charSpacing: 1, valign: 'middle' });
  if (f.logo && ctx.opts.logo) {
    const h = 0.26;
    const w = h * ctx.opts.logo.aspect;
    slide.addImage({ data: ctx.opts.logo.dataUrl, x: (PAGE.w - w) / 2, y: y + 0.01, w, h, altText: 'Concludo' });
  }
  const right = `${f.preparedWith ? 'Prepared with Concludo  ·  ' : ''}${String(f.page).padStart(2, '0')}`;
  slide.addText(right.toUpperCase(), { x: PAGE.w - M.x - 4, y, w: 4, h: 0.28, margin: 0, align: 'right', fontFace: ctx.F.mono, fontSize: 7.5, color: col, charSpacing: 1, valign: 'middle' });
}

const NO_BORDER = { type: 'none' } as const;
const HAIR = (c = C.hair) => ({ type: 'solid', pt: 0.75, color: c }) as const;
const rowBorder = (c?: string) => [NO_BORDER, NO_BORDER, HAIR(c), NO_BORDER];

function gapRun(ctx: Ctx, label = 'Not stated') {
  return { text: label.toUpperCase(), options: { fontFace: ctx.F.mono, fontSize: 8.5, color: C.slate, charSpacing: 1 } };
}

function headerCell(ctx: Ctx, t: string) {
  return {
    text: t.toUpperCase(),
    options: { fill: { color: C.navy }, color: C.white, fontFace: ctx.F.mono, fontSize: 8.5, bold: true, charSpacing: 1.5, valign: 'middle' as const, border: [NO_BORDER, NO_BORDER, NO_BORDER, NO_BORDER] },
  };
}

/* ---------------- 01 cover ---------------- */

function cover(ctx: Ctx, s: CoverSlide) {
  const slide = base(ctx, C.navy);
  slide.addShape(ctx.pres.ShapeType.rect, { x: 0, y: 0, w: PAGE.w, h: 1.0, fill: { color: C.white }, line: { color: C.white, width: 0 } });
  slide.addShape(ctx.pres.ShapeType.rect, { x: 0, y: 1.0, w: PAGE.w, h: 0.04, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
  if (ctx.opts.logo) {
    const h = 0.52;
    slide.addImage({ data: ctx.opts.logo.dataUrl, x: M.x, y: 0.24, w: h * ctx.opts.logo.aspect, h, altText: 'Concludo' });
  }
  slide.addText(s.kicker.toUpperCase(), { x: M.x, y: 1.75, w: 10, h: 0.3, margin: 0, fontFace: ctx.F.mono, fontSize: 9.5, color: C.onNavy, charSpacing: 2 });
  slide.addText(s.title, { x: M.x, y: 2.08, w: 10.6, h: 1.0, margin: 0, fontFace: ctx.F.head, fontSize: 40, bold: true, color: C.white, valign: 'top', fit: 'none' });
  let y = 2.08 + 0.72 * Math.min(estimateLines(s.title, 10.6, 40), 2) + 0.12;
  if (s.outcome) {
    slide.addText(s.outcome, { x: M.x, y, w: 10.6, h: 0.45, margin: 0, fontFace: ctx.F.head, fontSize: 19, bold: true, color: C.gold, valign: 'top' });
    y += 0.55;
  }
  if (s.metaLine) slide.addText(s.metaLine, { x: M.x, y, w: 10.6, h: 0.35, margin: 0, fontFace: ctx.F.body, fontSize: 13, color: C.onNavyBody });

  s.counts.forEach((c, i) => {
    const x = M.x + i * 1.55;
    slide.addText(c.label.toUpperCase(), { x, y: 5.3, w: 1.5, h: 0.25, margin: 0, fontFace: ctx.F.mono, fontSize: 8.5, color: C.onNavy, charSpacing: 1.5 });
    slide.addText(String(c.value), { x, y: 5.55, w: 1.5, h: 0.6, margin: 0, fontFace: ctx.F.head, fontSize: 30, bold: true, color: C.white, valign: 'top' });
  });
  slide.addText([
    { text: s.preparedBy, options: { breakLine: true } },
    { text: s.approved },
  ], { x: 7.2, y: 5.62, w: PAGE.w - M.x - 7.2, h: 0.55, margin: 0, align: 'right', fontFace: ctx.F.body, fontSize: 11, color: C.onNavy, lineSpacingMultiple: 1.2 });
  slide.addText(s.recordLine.toUpperCase(), { x: M.x, y: 6.98, w: 6, h: 0.28, margin: 0, fontFace: ctx.F.mono, fontSize: 7.5, color: C.onNavyQuiet, charSpacing: 1 });
  const right = `${s.classification}${s.footer.preparedWith ? '  ·  Prepared with Concludo' : ''}`;
  slide.addText(right.toUpperCase(), { x: PAGE.w - M.x - 6, y: 6.98, w: 6, h: 0.28, margin: 0, align: 'right', fontFace: ctx.F.mono, fontSize: 7.5, color: C.onNavyQuiet, charSpacing: 1 });
}

/* ---------------- 02 bottom line ---------------- */

function bottom(ctx: Ctx, s: BottomSlide) {
  const slide = base(ctx, C.light);
  head(ctx, slide, 'The bottom line', s.headline, false);
  const n = s.cards.length;
  const gap = 0.3;
  const top = 2.3;
  const cardH = 1.95;
  if (n) {
    const w = (M.contentW - gap * (n - 1)) / n;
    s.cards.forEach((c, i) => {
      const x = M.x + i * (w + gap);
      slide.addShape(ctx.pres.ShapeType.rect, { x, y: top, w, h: cardH, fill: { color: C.white }, line: { color: C.white, width: 0 } });
      slide.addShape(ctx.pres.ShapeType.rect, { x, y: top, w, h: c.accent ? 0.05 : 0.015, fill: { color: c.accent ? C.gold : C.navy }, line: { color: c.accent ? C.gold : C.navy, width: 0 } });
      slide.addText(c.label.toUpperCase(), { x: x + 0.25, y: top + 0.25, w: w - 0.5, h: 0.25, margin: 0, fontFace: ctx.F.mono, fontSize: 8.5, color: C.slate, charSpacing: 1.5 });
      slide.addText(c.text, { x: x + 0.25, y: top + 0.55, w: w - 0.5, h: 0.95, margin: 0, fontFace: ctx.F.head, fontSize: n === 1 ? 18 : 15, bold: true, color: C.navy, valign: 'top', fit: 'shrink' });
      slide.addText(c.source.toUpperCase(), { x: x + 0.25, y: top + cardH - 0.4, w: w - 0.5, h: 0.25, margin: 0, fontFace: ctx.F.mono, fontSize: 7.5, color: C.slate, charSpacing: 1 });
    });
  }
  if (s.body) slide.addText(s.body, { x: M.x, y: n ? top + cardH + 0.4 : 2.3, w: 9.8, h: 1.2, margin: 0, fontFace: ctx.F.body, fontSize: 14, color: C.ink, valign: 'top', lineSpacingMultiple: 1.25 });
  footer(ctx, slide, s.footer, false);
}

/* ---------------- 03 decisions ---------------- */

function decisions(ctx: Ctx, s: DecisionsSlide) {
  const slide = base(ctx, C.white);
  head(ctx, slide, s.continued ? 'Decisions, continued' : 'Decisions', s.headline, false);
  const rows: any[] = [[headerCell(ctx, 'ID'), headerCell(ctx, 'Decision'), headerCell(ctx, 'Decided by'), headerCell(ctx, 'Conditions')]];
  for (const r of s.rows) {
    const textRuns: any[] = [
      { text: r.text, options: { bold: true, fontSize: 13.5, color: C.navy, breakLine: true } },
      { text: r.source, options: { fontFace: ctx.F.mono, fontSize: 8, color: C.slate, breakLine: !!r.quote } },
    ];
    if (r.quote) textRuns.push({ text: `"${r.quote}"`, options: { fontFace: ctx.F.mono, fontSize: 8, color: C.slate, italic: true } });
    const by: any[] = r.decidedBy
      ? [{ text: r.decidedBy, options: { breakLine: !!r.decidedByOrg } }, ...(r.decidedByOrg ? [{ text: r.decidedByOrg, options: { fontSize: 10.5, color: C.slate } }] : [])]
      : [gapRun(ctx)];
    rows.push([
      { text: r.id, options: { fontFace: ctx.F.mono, bold: true, fontSize: 10, color: C.navy } },
      { text: textRuns },
      { text: by },
      r.conditions ? { text: r.conditions } : { text: 'None stated', options: { color: C.slate } },
    ]);
  }
  slide.addTable(rows, {
    x: M.x, y: TABLE_TOP, w: M.contentW, colW: DECISION_COLS, fontFace: ctx.F.body, fontSize: 13.5, color: C.navy,
    valign: 'top', margin: [7, 8, 7, 8], border: rowBorder() as any, rowH: [HEADER_ROW], autoPage: false,
  } as any);
  footer(ctx, slide, s.footer, false);
}

/* ---------------- 04 actions ---------------- */

function actions(ctx: Ctx, s: ActionsSlide) {
  const slide = base(ctx, C.white);
  head(ctx, slide, s.continued ? 'Actions, continued' : 'Actions', s.headline, false);
  const rows: any[] = [[headerCell(ctx, 'ID'), headerCell(ctx, 'Action'), headerCell(ctx, 'Owner'), headerCell(ctx, 'By'), headerCell(ctx, 'Done when')]];
  for (const r of s.rows) {
    const owner: any[] = r.owner
      ? [{ text: r.owner }, ...(r.clientSide ? [{ text: '  CLIENT', options: { fontFace: ctx.F.mono, fontSize: 7.5, color: C.slate, bold: true } }] : [])]
      : [gapRun(ctx)];
    rows.push([
      { text: r.id, options: { fontFace: ctx.F.mono, bold: true, fontSize: 10, color: C.navy } },
      { text: r.text },
      { text: owner },
      r.due
        ? { text: r.due, options: r.first ? { bold: true, fill: { color: C.goldTint } } : {} }
        : { text: [gapRun(ctx)] },
      r.doneWhen ? { text: r.doneWhen } : { text: [gapRun(ctx)] },
    ]);
  }
  slide.addTable(rows, {
    x: M.x, y: TABLE_TOP, w: M.contentW, colW: ACTION_COLS, fontFace: ctx.F.body, fontSize: 13.5, color: C.navy,
    valign: 'top', margin: [7, 8, 7, 8], border: rowBorder() as any, rowH: [HEADER_ROW], autoPage: false,
  } as any);
  footer(ctx, slide, s.footer, false);
}

/* ---------------- 05 still open ---------------- */

function open(ctx: Ctx, s: OpenSlide) {
  const slide = base(ctx, C.navy);
  head(ctx, slide, s.continued ? 'Still open, continued' : 'What was not settled', s.headline, true);
  const col = (items: typeof s.questions, x: number, label: string) => {
    if (!items.length) return;
    slide.addText(label.toUpperCase(), { x, y: OPEN_TOP, w: OPEN_COL_W, h: 0.28, margin: 0, fontFace: ctx.F.mono, fontSize: 8.5, color: C.onNavy, charSpacing: 1.5 });
    slide.addShape(ctx.pres.ShapeType.line, { x, y: OPEN_TOP + 0.36, w: OPEN_COL_W, h: 0, line: { color: C.navyLine, width: 0.75 } });
    let y = OPEN_TOP + 0.52;
    for (const it of items) {
      const tl = estimateLines(it.text, OPEN_COL_W, 16);
      slide.addText(it.id, { x, y, w: 1.2, h: 0.24, margin: 0, fontFace: ctx.F.mono, fontSize: 9.5, bold: true, color: C.gold });
      slide.addText(it.text, { x, y: y + 0.27, w: OPEN_COL_W, h: tl * 0.28, margin: 0, fontFace: ctx.F.body, fontSize: 16, color: C.white, valign: 'top' });
      const dy = y + 0.3 + tl * 0.278;
      slide.addText(it.detail.toUpperCase(), { x, y: dy, w: OPEN_COL_W, h: 0.24, margin: 0, fontFace: ctx.F.mono, fontSize: 7.5, color: C.onNavyQuiet, charSpacing: 1 });
      slide.addShape(ctx.pres.ShapeType.line, { x, y: dy + 0.34, w: OPEN_COL_W, h: 0, line: { color: C.navyLine, width: 0.75 } });
      y = dy + 0.5;
    }
  };
  const x2 = M.x + OPEN_COL_W + 0.5;
  if (s.questions.length && s.risks.length) {
    col(s.questions, M.x, 'Open questions');
    col(s.risks, x2, 'Risks raised in the meeting');
  } else if (s.questions.length) {
    col(s.questions, M.x, 'Open questions');
  } else {
    col(s.risks, M.x, 'Risks raised in the meeting');
  }
  footer(ctx, slide, s.footer, true);
}

/* ---------------- 06 next meeting ---------------- */

function next(ctx: Ctx, s: NextSlide) {
  const slide = base(ctx, C.light);
  head(ctx, slide, s.kicker, s.headline, false);
  const leftW = 6.4;
  let y = 2.35;
  const label = (t: string) => {
    slide.addText(t.toUpperCase(), { x: M.x, y, w: leftW, h: 0.26, margin: 0, fontFace: ctx.F.mono, fontSize: 8.5, color: C.slate, charSpacing: 1.5 });
    slide.addShape(ctx.pres.ShapeType.line, { x: M.x, y: y + 0.34, w: leftW, h: 0, line: { color: 'D9DEE7', width: 0.75 } });
    y += 0.5;
  };
  if (s.mustProduce) {
    label('It must produce');
    const l = estimateLines(s.mustProduce, leftW, 18);
    slide.addText(s.mustProduce, { x: M.x, y, w: leftW, h: l * 0.34, margin: 0, fontFace: ctx.F.head, fontSize: 18, bold: true, color: C.navy, valign: 'top' });
    y += l * 0.34 + 0.4;
  }
  if (s.bring.length) {
    label('Bring');
    slide.addText(s.bring.map((b) => ({ text: b, options: { bullet: { indent: 14 }, breakLine: true } })), {
      x: M.x, y, w: leftW, h: Math.min(s.bring.length * 0.36, 2), margin: 0, fontFace: ctx.F.body, fontSize: 14, color: C.ink, valign: 'top', paraSpaceAfter: 4,
    });
  }
  if (s.fallback) {
    slide.addText(s.fallback, { x: M.x, y, w: leftW, h: 1.0, margin: 0, fontFace: ctx.F.body, fontSize: 15, color: C.ink, valign: 'top' });
  }
  if (s.correction) {
    const x = 7.65, w = PAGE.w - M.x - 7.65, top = 2.35, h = 1.75;
    slide.addShape(ctx.pres.ShapeType.rect, { x, y: top, w, h, fill: { color: C.white }, line: { color: C.white, width: 0 } });
    slide.addShape(ctx.pres.ShapeType.rect, { x, y: top, w: 0.05, h, fill: { color: C.gold }, line: { color: C.gold, width: 0 } });
    slide.addText('CORRECT THE RECORD', { x: x + 0.3, y: top + 0.25, w: w - 0.5, h: 0.25, margin: 0, fontFace: ctx.F.mono, fontSize: 8.5, color: C.slate, charSpacing: 1.5 });
    slide.addText([
      { text: `If anything here is wrong, tell ${s.correction.contact} by ` },
      { text: s.correction.deadline, options: { bold: true } },
      { text: '. After that, this record stands.' },
    ], { x: x + 0.3, y: top + 0.6, w: w - 0.55, h: 0.95, margin: 0, fontFace: ctx.F.body, fontSize: 14, color: C.navy, valign: 'top', lineSpacingMultiple: 1.2 });
  }
  footer(ctx, slide, s.footer, false);
}
