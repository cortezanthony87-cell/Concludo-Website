import { PDFDocument, StandardFonts, rgb, Color } from 'pdf-lib';

export interface GeneratePdfOptions {
  fonts?: 'standard' | 'brand';
  confidential?: boolean;
}

const MM = 72 / 25.4; // 1 mm in points = 2.8346 pt
const PAGE_W = 595.28; // A4 Width in points
const PAGE_H = 841.89; // A4 Height in points
const MARGIN_X = 42;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 511.28 pt
const TOP_MARGIN = 48;
const BOTTOM_MARGIN = 48;

// Color palette matching Concludo Brand Specification
const COLOR_NAVY = rgb(22 / 255, 38 / 255, 63 / 255); // #16263F
const COLOR_NAVY_LIGHT = rgb(33 / 255, 57 / 255, 92 / 255); // #21395C
const COLOR_GOLD = rgb(188 / 255, 138 / 255, 28 / 255); // #BC8A1C
const COLOR_GOLD_LIGHT = rgb(226 / 255, 181 / 255, 60 / 255); // #E2B53C
const COLOR_SLATE = rgb(100 / 255, 116 / 255, 139 / 255); // #64748B
const COLOR_MUTED = rgb(148 / 255, 163 / 255, 184 / 255); // #94A3B8
const COLOR_BORDER = rgb(226 / 255, 232 / 255, 240 / 255); // #E2E8F0
const COLOR_BG_LIGHT = rgb(248 / 255, 250 / 255, 252 / 255); // #F8FAFC
const COLOR_WHITE = rgb(1, 1, 1);
const COLOR_TEXT = rgb(15 / 255, 23 / 255, 42 / 255); // #0F172A

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  if (!text) return [];
  const paragraphs = text.split(/\r?\n/);
  const allLines: string[] = [];

  for (const para of paragraphs) {
    if (!para.trim()) {
      allLines.push('');
      continue;
    }
    const words = para.trim().split(/\s+/);
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine ? currentLine + ' ' + word : word;
      const width = font.widthOfTextAtSize(candidate, size);
      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) allLines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) allLines.push(currentLine);
  }
  return allLines;
}

function formatDateDisplay(isoStr?: string): string {
  if (!isoStr) return 'Date to be agreed';
  try {
    const d = new Date(isoStr.includes('T') ? isoStr : isoStr + 'T00:00:00Z');
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-AU', {
      timeZone: 'UTC',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

/**
 * Generates a clean, branded, multi-page A4 PDF from a Concludo Meeting Model.
 * Guarantees 100% compliant PDF 1.7 binary readable by standard PDF readers.
 */
export async function generateMeetingPdf(model: any, opts: GeneratePdfOptions = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await doc.embedFont(StandardFonts.HelveticaOblique);

  const pages: any[] = [];
  let currentPage = doc.addPage([PAGE_W, PAGE_H]);
  pages.push(currentPage);
  let cursorY = PAGE_H - TOP_MARGIN;

  const docTitle = model.meta?.title || 'Meeting Record';
  const orgName = model.meta?.organisation || '';
  const meetingDateStr = formatDateDisplay(model.meta?.meetingDate);

  function newPage() {
    currentPage = doc.addPage([PAGE_W, PAGE_H]);
    pages.push(currentPage);
    cursorY = PAGE_H - TOP_MARGIN;
    drawRunningHeader();
  }

  function ensureSpace(neededHeight: number) {
    if (cursorY - neededHeight < BOTTOM_MARGIN) {
      newPage();
    }
  }

  function drawRunningHeader() {
    // Header title and rule
    currentPage.drawText('CONCLUDO', {
      x: MARGIN_X,
      y: PAGE_H - 26,
      size: 8.5,
      font: fontBold,
      color: COLOR_GOLD,
    });
    currentPage.drawText(' · MEETING RECORD', {
      x: MARGIN_X + 54,
      y: PAGE_H - 26,
      size: 8.5,
      font: fontBold,
      color: COLOR_NAVY,
    });
    const titleSnippet = docTitle.length > 50 ? docTitle.slice(0, 48) + '…' : docTitle;
    const snippetWidth = fontRegular.widthOfTextAtSize(titleSnippet, 8);
    currentPage.drawText(titleSnippet, {
      x: PAGE_W - MARGIN_X - snippetWidth,
      y: PAGE_H - 26,
      size: 8,
      font: fontRegular,
      color: COLOR_SLATE,
    });
    currentPage.drawLine({
      start: { x: MARGIN_X, y: PAGE_H - 32 },
      end: { x: PAGE_W - MARGIN_X, y: PAGE_H - 32 },
      thickness: 0.6,
      color: COLOR_BORDER,
    });
  }

  // --- PAGE 1 COVER / HEADER BLOCK ---
  drawRunningHeader();

  // Document Kicker
  currentPage.drawText('MEETING OUTCOME & EXECUTIVE PACK', {
    x: MARGIN_X,
    y: cursorY,
    size: 9,
    font: fontBold,
    color: COLOR_GOLD,
  });
  cursorY -= 18;

  // Main Title
  const titleLines = wrapText(docTitle, fontBold, 19, CONTENT_W);
  for (const line of titleLines) {
    currentPage.drawText(line, {
      x: MARGIN_X,
      y: cursorY,
      size: 19,
      font: fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 24;
  }
  cursorY -= 4;

  // Metadata pills / subtitle
  const metaParts = [
    model.meta?.meetingType || 'Meeting',
    meetingDateStr,
    orgName,
    'Commercial in confidence',
  ].filter(Boolean);

  currentPage.drawText(metaParts.join('   ·   '), {
    x: MARGIN_X,
    y: cursorY,
    size: 9.5,
    font: fontRegular,
    color: COLOR_SLATE,
  });
  cursorY -= 16;

  // Divider
  currentPage.drawLine({
    start: { x: MARGIN_X, y: cursorY },
    end: { x: PAGE_W - MARGIN_X, y: cursorY },
    thickness: 1,
    color: COLOR_GOLD_LIGHT,
  });
  cursorY -= 18;

  // Stats Box Row
  const stats = [
    { label: 'Decisions', val: String(model.stats?.decisions ?? model.decisions?.length ?? 0) },
    { label: 'Actions', val: String(model.stats?.actions ?? model.actions?.length ?? 0) },
    { label: 'Open items', val: String(model.stats?.openItems ?? model.openItems?.length ?? 0) },
    { label: 'Risks noted', val: String(model.stats?.highRisks ?? model.risks?.length ?? 0) },
  ];
  const statColW = CONTENT_W / stats.length;
  const statBoxH = 38;

  currentPage.drawRectangle({
    x: MARGIN_X,
    y: cursorY - statBoxH,
    width: CONTENT_W,
    height: statBoxH,
    color: COLOR_BG_LIGHT,
    borderColor: COLOR_BORDER,
    borderWidth: 0.8,
  });

  stats.forEach((st, idx) => {
    const bx = MARGIN_X + idx * statColW;
    currentPage.drawText(st.val, {
      x: bx + 12,
      y: cursorY - 18,
      size: 13,
      font: fontBold,
      color: COLOR_NAVY,
    });
    currentPage.drawText(st.label, {
      x: bx + 12,
      y: cursorY - 30,
      size: 8,
      font: fontRegular,
      color: COLOR_SLATE,
    });
    if (idx > 0) {
      currentPage.drawLine({
        start: { x: bx, y: cursorY - statBoxH + 6 },
        end: { x: bx, y: cursorY - 6 },
        thickness: 0.5,
        color: COLOR_BORDER,
      });
    }
  });
  cursorY -= statBoxH + 18;

  // Bottom Line Box
  if (model.bottomLine) {
    const blLines = wrapText(model.bottomLine, fontRegular, 9.5, CONTENT_W - 24);
    const blBoxHeight = 32 + blLines.length * 13;
    ensureSpace(blBoxHeight + 10);

    currentPage.drawRectangle({
      x: MARGIN_X,
      y: cursorY - blBoxHeight,
      width: CONTENT_W,
      height: blBoxHeight,
      color: COLOR_BG_LIGHT,
      borderColor: COLOR_BORDER,
      borderWidth: 0.8,
    });

    // Gold left accent bar
    currentPage.drawRectangle({
      x: MARGIN_X,
      y: cursorY - blBoxHeight,
      width: 4,
      height: blBoxHeight,
      color: COLOR_GOLD,
    });

    currentPage.drawText('BOTTOM LINE', {
      x: MARGIN_X + 14,
      y: cursorY - 15,
      size: 8.5,
      font: fontBold,
      color: COLOR_NAVY,
    });

    let lineY = cursorY - 28;
    for (const line of blLines) {
      currentPage.drawText(line, {
        x: MARGIN_X + 14,
        y: lineY,
        size: 9.5,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      lineY -= 13;
    }
    cursorY -= blBoxHeight + 16;
  }

  // Participants / Attendees
  if (model.participants && model.participants.length > 0) {
    ensureSpace(34);
    const attList = model.participants
      .map((p: any) => (p.role ? `${p.name} (${p.role})` : p.name))
      .join(', ');
    const attLines = wrapText(`Attendees: ${attList}`, fontRegular, 8.5, CONTENT_W);
    for (const l of attLines) {
      currentPage.drawText(l, {
        x: MARGIN_X,
        y: cursorY,
        size: 8.5,
        font: fontRegular,
        color: COLOR_SLATE,
      });
      cursorY -= 12;
    }
    cursorY -= 8;
  }

  // --- SECTION: DECISIONS ---
  const decisions = (model.decisions || []).filter((d: any) => d.review !== 'excluded');
  if (decisions.length > 0) {
    ensureSpace(65);
    cursorY -= 8;
    currentPage.drawText('DECISIONS', {
      x: MARGIN_X,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 16;

    for (const d of decisions) {
      const isConditional = d.status === 'conditional';
      const decText = `${d.id}  ${d.statement}`;
      const lines = wrapText(decText, fontBold, 9.5, CONTENT_W - 80);
      const metaText = [
        isConditional ? `Conditional: ${d.condition || 'approval pending'}` : 'Agreed',
        d.calledBy ? `Called by ${d.calledBy}` : '',
      ].filter(Boolean).join(' · ');
      const metaLines = wrapText(metaText, fontOblique, 8, CONTENT_W - 80);

      const blockH = lines.length * 13 + metaLines.length * 11 + 10;
      ensureSpace(blockH);

      // Draw decision bullet / tag
      currentPage.drawText(lines[0], {
        x: MARGIN_X,
        y: cursorY,
        size: 9.5,
        font: fontBold,
        color: COLOR_TEXT,
      });
      cursorY -= 13;

      for (let i = 1; i < lines.length; i++) {
        currentPage.drawText(lines[i], {
          x: MARGIN_X + 26,
          y: cursorY,
          size: 9.5,
          font: fontBold,
          color: COLOR_TEXT,
        });
        cursorY -= 13;
      }

      for (const ml of metaLines) {
        currentPage.drawText(ml, {
          x: MARGIN_X + 26,
          y: cursorY,
          size: 8,
          font: fontOblique,
          color: isConditional ? COLOR_GOLD : COLOR_SLATE,
        });
        cursorY -= 11;
      }
      cursorY -= 6;
    }
    cursorY -= 10;
  }

  // --- SECTION: ACTIONS TABLE ---
  const actions = (model.actions || []).filter((a: any) => a.review !== 'excluded');
  if (actions.length > 0) {
    ensureSpace(75);
    cursorY -= 8;
    currentPage.drawText('ACTIONS REGISTER', {
      x: MARGIN_X,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 16;

    // Table Column Widths
    const colIdW = 34;
    const colTaskW = 230;
    const colOwnerW = 95;
    const colDueW = 75;
    const colStatusW = CONTENT_W - (colIdW + colTaskW + colOwnerW + colDueW); // ~77 pt

    function drawTableHeader() {
      const thH = 20;
      currentPage.drawRectangle({
        x: MARGIN_X,
        y: cursorY - thH,
        width: CONTENT_W,
        height: thH,
        color: COLOR_NAVY,
      });
      const headerY = cursorY - 14;
      currentPage.drawText('#', { x: MARGIN_X + 6, y: headerY, size: 8, font: fontBold, color: COLOR_WHITE });
      currentPage.drawText('Task', { x: MARGIN_X + colIdW + 6, y: headerY, size: 8, font: fontBold, color: COLOR_WHITE });
      currentPage.drawText('Owner', { x: MARGIN_X + colIdW + colTaskW + 6, y: headerY, size: 8, font: fontBold, color: COLOR_WHITE });
      currentPage.drawText('Due', { x: MARGIN_X + colIdW + colTaskW + colOwnerW + 6, y: headerY, size: 8, font: fontBold, color: COLOR_WHITE });
      currentPage.drawText('Status / Gap', { x: MARGIN_X + colIdW + colTaskW + colOwnerW + colDueW + 6, y: headerY, size: 8, font: fontBold, color: COLOR_WHITE });
      cursorY -= thH;
    }

    drawTableHeader();

    actions.forEach((a: any, idx: number) => {
      const taskLines = wrapText(a.task || 'Untitled task', fontRegular, 8.5, colTaskW - 12);
      const ownerText = a.owner === 'Under review' ? 'Under review' : a.owner || 'Not named';
      const ownerLines = wrapText(ownerText, a.owner === 'Under review' ? fontOblique : fontRegular, 8, colOwnerW - 10);
      const dueText = formatDateDisplay(a.due);
      const dueLines = wrapText(dueText, fontRegular, 8, colDueW - 10);

      let statusText = 'Confirmed';
      if (a.gaps && a.gaps.length > 0) {
        statusText = a.gaps.filter((g: string) => g !== 'Definition of done not stated').join('; ');
      }
      if (!statusText) statusText = 'Confirmed';
      const statusLines = wrapText(statusText, fontRegular, 7.5, colStatusW - 10);

      const maxLineCount = Math.max(taskLines.length, ownerLines.length, dueLines.length, statusLines.length, 1);
      const rowH = Math.max(22, maxLineCount * 11 + 8);

      if (cursorY - rowH < BOTTOM_MARGIN) {
        newPage();
        drawTableHeader();
      }

      // Background row
      if (idx % 2 === 1) {
        currentPage.drawRectangle({
          x: MARGIN_X,
          y: cursorY - rowH,
          width: CONTENT_W,
          height: rowH,
          color: COLOR_BG_LIGHT,
        });
      }
      // Bottom row border
      currentPage.drawLine({
        start: { x: MARGIN_X, y: cursorY - rowH },
        end: { x: PAGE_W - MARGIN_X, y: cursorY - rowH },
        thickness: 0.5,
        color: COLOR_BORDER,
      });

      const cellTopY = cursorY - 12;

      // ID
      currentPage.drawText(a.id, {
        x: MARGIN_X + 6,
        y: cellTopY,
        size: 8,
        font: fontBold,
        color: COLOR_NAVY,
      });

      // Task lines
      taskLines.forEach((tl, li) => {
        currentPage.drawText(tl, {
          x: MARGIN_X + colIdW + 6,
          y: cellTopY - li * 10.5,
          size: 8.5,
          font: fontRegular,
          color: COLOR_TEXT,
        });
      });

      // Owner lines
      ownerLines.forEach((ol, li) => {
        currentPage.drawText(ol, {
          x: MARGIN_X + colIdW + colTaskW + 6,
          y: cellTopY - li * 10,
          size: 8,
          font: a.owner === 'Under review' ? fontOblique : (a.owner ? fontRegular : fontOblique),
          color: a.owner === 'Under review' ? COLOR_GOLD : (a.owner ? COLOR_TEXT : COLOR_SLATE),
        });
      });

      // Due lines
      dueLines.forEach((dl, li) => {
        currentPage.drawText(dl, {
          x: MARGIN_X + colIdW + colTaskW + colOwnerW + 6,
          y: cellTopY - li * 10,
          size: 8,
          font: fontRegular,
          color: a.due ? COLOR_TEXT : COLOR_SLATE,
        });
      });

      // Status / gaps lines
      statusLines.forEach((sl, li) => {
        currentPage.drawText(sl, {
          x: MARGIN_X + colIdW + colTaskW + colOwnerW + colDueW + 6,
          y: cellTopY - li * 9.5,
          size: 7.5,
          font: fontRegular,
          color: statusText === 'Confirmed' ? COLOR_NAVY : COLOR_GOLD,
        });
      });

      cursorY -= rowH;
    });
    cursorY -= 14;
  }

  // --- SECTION: DEADLINES TIMELINE ---
  const datedActions = actions.filter((a: any) => a.due);
  if (datedActions.length > 0) {
    ensureSpace(55);
    cursorY -= 6;
    currentPage.drawText('DEADLINES AND DATES', {
      x: MARGIN_X,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 16;

    // Sort dated actions chronologically
    const sorted = [...datedActions].sort((a: any, b: any) => (a.due > b.due ? 1 : -1));
    for (const act of sorted) {
      const itemText = `•  ${formatDateDisplay(act.due)}: ${act.task} (${act.owner || 'Who will own this?'})`;
      const lines = wrapText(itemText, fontRegular, 8.5, CONTENT_W);
      ensureSpace(lines.length * 12 + 4);
      for (const l of lines) {
        currentPage.drawText(l, {
          x: MARGIN_X + 6,
          y: cursorY,
          size: 8.5,
          font: fontRegular,
          color: COLOR_TEXT,
        });
        cursorY -= 12;
      }
      cursorY -= 2;
    }
    cursorY -= 10;
  }

  // --- SECTION: OPEN ITEMS & QUESTIONS ---
  const openItems = (model.openItems || []).filter((o: any) => o.review !== 'excluded');
  if (openItems.length > 0) {
    ensureSpace(55);
    cursorY -= 6;
    currentPage.drawText('OPEN ITEMS & QUESTIONS', {
      x: MARGIN_X,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 16;

    for (const item of openItems) {
      const kindBadge = item.kind === 'approval' ? 'Approval needed' : item.kind === 'deferred' ? 'Parked' : 'Unresolved';
      const itemLine = `${item.id}  ${item.question}`;
      const lines = wrapText(itemLine, fontRegular, 9, CONTENT_W - 30);
      ensureSpace(lines.length * 12 + 16);

      currentPage.drawText(lines[0], {
        x: MARGIN_X,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      cursorY -= 12;

      for (let li = 1; li < lines.length; li++) {
        currentPage.drawText(lines[li], {
          x: MARGIN_X + 24,
          y: cursorY,
          size: 9,
          font: fontRegular,
          color: COLOR_TEXT,
        });
        cursorY -= 12;
      }

      currentPage.drawText(`Status: ${kindBadge}${item.raisedBy ? ` · Raised by ${item.raisedBy}` : ''}`, {
        x: MARGIN_X + 24,
        y: cursorY,
        size: 8,
        font: fontOblique,
        color: COLOR_SLATE,
      });
      cursorY -= 14;
    }
    cursorY -= 8;
  }

  // --- SECTION: RISKS (IF ANY) ---
  const risks = (model.risks || []).filter((r: any) => r.review !== 'excluded');
  if (risks.length > 0) {
    ensureSpace(65);
    cursorY -= 6;
    currentPage.drawText('KEY RISKS & MITIGATIONS', {
      x: MARGIN_X,
      y: cursorY,
      size: 11,
      font: fontBold,
      color: COLOR_NAVY,
    });
    cursorY -= 16;

    for (const r of risks) {
      const headline = `${r.id}  ${r.risk}`;
      const lines = wrapText(headline, fontRegular, 9, CONTENT_W - 30);
      const respText = r.mitigation || r.statedResponse ? `Mitigation: ${r.mitigation || r.statedResponse}` : 'No mitigation stated on record';
      const respLines = wrapText(respText, fontOblique, 8, CONTENT_W - 30);

      ensureSpace(lines.length * 12 + respLines.length * 10 + 14);

      currentPage.drawText(lines[0], {
        x: MARGIN_X,
        y: cursorY,
        size: 9,
        font: fontRegular,
        color: COLOR_TEXT,
      });
      cursorY -= 12;

      for (let li = 1; li < lines.length; li++) {
        currentPage.drawText(lines[li], {
          x: MARGIN_X + 24,
          y: cursorY,
          size: 9,
          font: fontRegular,
          color: COLOR_TEXT,
        });
        cursorY -= 12;
      }

      respLines.forEach((rl) => {
        currentPage.drawText(rl, {
          x: MARGIN_X + 24,
          y: cursorY,
          size: 8,
          font: fontOblique,
          color: COLOR_SLATE,
        });
        cursorY -= 10;
      });
      cursorY -= 6;
    }
  }

  // --- FOOTERS PASS (PAGE X OF Y) ---
  const totalPages = pages.length;
  pages.forEach((p, idx) => {
    const pageNum = idx + 1;
    // Rule above footer
    p.drawLine({
      start: { x: MARGIN_X, y: 34 },
      end: { x: PAGE_W - MARGIN_X, y: 34 },
      thickness: 0.5,
      color: COLOR_BORDER,
    });

    // Left footer
    p.drawText(`${docTitle}   ·   Commercial in confidence`, {
      x: MARGIN_X,
      y: 22,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    });

    // Right footer
    const pageStr = `Page ${pageNum} of ${totalPages}`;
    const strW = fontRegular.widthOfTextAtSize(pageStr, 8);
    p.drawText(pageStr, {
      x: PAGE_W - MARGIN_X - strW,
      y: 22,
      size: 8,
      font: fontRegular,
      color: COLOR_MUTED,
    });
  });

  return await doc.save();
}
