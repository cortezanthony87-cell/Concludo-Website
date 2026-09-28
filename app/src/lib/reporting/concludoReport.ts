function b64ToUint8Array(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return Uint8Array.from(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

/**
 * Concludo output document renderer, boardroom edition (TypeScript Port).
 * Faithful implementation of concludo_report.py and DESIGN_SPEC.md.
 * 
 * Generates the identical branded A4 PDF from ConcludoReportPayload.
 */

import { PDFDocument, PDFPage, PDFFont, PDFImage, rgb, Color } from 'pdf-lib';
import * as fontkit from 'fontkit';
import { ConcludoReportPayload } from './payloadTypes';
import {
  FONT_POPPINS_BOLD_TTF_B64,
  FONT_POPPINS_MEDIUM_TTF_B64,
  FONT_WORKSANS_REGULAR_TTF_B64,
  FONT_WORKSANS_BOLD_TTF_B64,
  FONT_IBMPLEXMONO_REGULAR_TTF_B64,
  FONT_IBMPLEXMONO_BOLD_TTF_B64,
  ASSET_LOGO_H_PNG_B64,
} from './reportAssets';

// Geometry & Dimensions (A4: 595.28 x 841.89 pt)
const MM = 72 / 25.4; // 1 mm in PDF points = 2.834645669
const W = 210 * MM;
const H = 297 * MM;
const MG = 20 * MM;
const XL = MG;
const XR = W - MG;
const CW = XR - XL;
const TOPRULE = H - 17 * MM;
const FOOTRULE = 16 * MM;
const BOTTOM = FOOTRULE + 14 * MM; // lowest usable baseline
const LOCK_AR = 885 / 2261;

// Colors from DESIGN_SPEC.md
const HEX = (hex: string) => {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) / 255;
  const g = parseInt(clean.substring(2, 4), 16) / 255;
  const b = parseInt(clean.substring(4, 6), 16) / 255;
  return rgb(r, g, b);
};

const NAVY = HEX('#16263F');
const NAVY2 = HEX('#21395C');
const GOLD = HEX('#E2B53C');
const GOLDD = HEX('#BC8A1C');
const LIGHT = HEX('#F4F6FA');
const PAPER = HEX('#FFFFFF');
const SLATE = HEX('#5A6478');
const HAIR = HEX('#D9DFE9');

function mix(a: Color, b: Color, t: number): Color {
  return rgb(
    (a as any).red + ((b as any).red - (a as any).red) * t,
    (a as any).green + ((b as any).green - (a as any).green) * t,
    (a as any).blue + ((b as any).blue - (a as any).blue) * t
  );
}

// Entitlement
export const TIERS: Record<string, { label: string; max_pages: number | null; sections: Set<string> | null }> = {
  starter: {
    label: 'Workspace Starter',
    max_pages: 15,
    sections: new Set([
      'inputs', 'executive', 'meeting_summary', 'decisions', 'actions',
      'risks', 'recommendations', 'health', 'closing'
    ]),
  },
  pro: {
    label: 'Workspace Pro',
    max_pages: 50,
    sections: new Set([
      'inputs', 'executive', 'meeting_summary', 'decisions', 'actions',
      'risks', 'recommendations', 'health', 'closing', 'board_report',
      'evidence_register', 'traceability', 'strategic', 'coaching'
    ]),
  },
  team: {
    label: 'Workspace Team',
    max_pages: null,
    sections: null,
  },
};

const TIER_ORDER = ['starter', 'pro', 'team'];

function entitled(tier: string | null | undefined, section: string): boolean {
  const key = (tier || 'starter').toLowerCase();
  const spec = TIERS[key] || TIERS['starter'];
  return spec.sections === null || spec.sections.has(section);
}

function requiredTier(section: string): string {
  for (const key of TIER_ORDER) {
    if (entitled(key, section)) return TIERS[key].label;
  }
  return TIERS['team'].label;
}

export function wrapText(txt: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  let line = '';
  const words = String(txt).split(/\s+/);
  for (const w of words) {
    const t = (line + ' ' + w).trim();
    if (font.widthOfTextAtSize(t, size) > maxWidth && line) {
      out.push(line);
      line = w;
    } else {
      line = t;
    }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

export function fitText(txt: string, font: PDFFont, size: number, maxW: number): string {
  let str = String(txt || '').trim();
  try {
    if (font.widthOfTextAtSize(str, size) <= maxW) return str;
    while (str.length > 2 && font.widthOfTextAtSize(str + '...', size) > maxW) {
      str = str.slice(0, -1).trim();
    }
    return str + '...';
  } catch {
    return str.slice(0, Math.floor(maxW / (size * 0.55)));
  }
}

interface LoadedFonts {
  H: PDFFont;
  HB: PDFFont;
  HM: PDFFont;
  B: PDFFont;
  BB: PDFFont;
  M: PDFFont;
  MB: PDFFont;
}

class Doc {
  pdf: PDFDocument;
  payload: ConcludoReportPayload;
  total?: number;
  pageCount = 0;
  section = '';
  dark = false;
  y = H;
  fonts!: LoadedFonts;
  logoImg?: PDFImage;
  currentPage!: PDFPage;

  constructor(pdf: PDFDocument, payload: ConcludoReportPayload, total?: number) {
    this.pdf = pdf;
    this.payload = payload;
    this.total = total;
  }

  async init() {
    this.pdf.registerFontkit((fontkit as any).default || fontkit);

    const poppinsBold = await this.pdf.embedFont(b64ToUint8Array(FONT_POPPINS_BOLD_TTF_B64));
    const poppinsMed = await this.pdf.embedFont(b64ToUint8Array(FONT_POPPINS_MEDIUM_TTF_B64));
    const workSansReg = await this.pdf.embedFont(b64ToUint8Array(FONT_WORKSANS_REGULAR_TTF_B64));
    const workSansBold = await this.pdf.embedFont(b64ToUint8Array(FONT_WORKSANS_BOLD_TTF_B64));
    const monoReg = await this.pdf.embedFont(b64ToUint8Array(FONT_IBMPLEXMONO_REGULAR_TTF_B64));
    const monoBold = await this.pdf.embedFont(b64ToUint8Array(FONT_IBMPLEXMONO_BOLD_TTF_B64));

    this.fonts = {
      H: poppinsBold,
      HB: poppinsBold,
      HM: poppinsMed,
      B: workSansReg,
      BB: workSansBold,
      M: monoReg,
      MB: monoBold,
    };

    try {
      const logoBytes = b64ToUint8Array(ASSET_LOGO_H_PNG_B64);
      this.logoImg = await this.pdf.embedPng(logoBytes);
    } catch (e) {
      console.warn('Could not embed logo image:', e);
    }

    const doc = this.payload.document || { kind: 'Meeting outcome report', footer_label: '' };
    this.pdf.setTitle(doc.title || 'Concludo output document');
    this.pdf.setAuthor('Concludo Pty Ltd');
    this.pdf.setSubject(doc.subject || '');
  }

  charWidth(font: PDFFont, ch: string, size: number): number {
    if (ch === ' ') {
      try {
        return font.widthOfTextAtSize('0', size);
      } catch {
        return size * 0.5;
      }
    }
    try {
      return font.widthOfTextAtSize(ch, size);
    } catch {
      return size * 0.5;
    }
  }

  tracked(txt: string, x: number, y: number, fontKey: keyof LoadedFonts, size: number, tr: number, color: Color, align: 'l' | 'r' | 'c' = 'l'): number {
    const font = this.fonts[fontKey];
    const chars = Array.from(txt);
    const ws = chars.map((ch) => this.charWidth(font, ch, size));
    const total = ws.reduce((a, b) => a + b, 0) + tr * Math.max(chars.length - 1, 0);

    let drawX = x;
    if (align === 'r') drawX -= total;
    else if (align === 'c') drawX -= total / 2;

    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      if (ch !== ' ') {
        this.currentPage.drawText(ch, {
          x: drawX,
          y: y,
          size: size,
          font: font,
          color: color,
        });
      }
      drawX += ws[i] + tr;
    }
    return total;
  }

  para(txt: string, x: number, y: number, width: number, fontKey: keyof LoadedFonts = 'B', size = 8.6, lead = 4.8 * MM, color?: Color): number {
    const col = color || (this.dark ? mix(LIGHT, NAVY, 0.16) : NAVY);
    const font = this.fonts[fontKey];
    const lines = wrapText(txt, font, size, width);
    for (let i = 0; i < lines.length; i++) {
      this.currentPage.drawText(lines[i], {
        x: x,
        y: y - i * lead,
        size: size,
        font: font,
        color: col,
      });
    }
    return y - lines.length * lead;
  }

  newPage(section?: string, dark?: boolean): number {
    this.pageCount += 1;
    if (section !== undefined) this.section = section;
    if (dark !== undefined) this.dark = dark;

    this.currentPage = this.pdf.addPage([W, H]);
    this.currentPage.drawRectangle({
      x: 0,
      y: 0,
      width: W,
      height: H,
      color: this.dark ? NAVY : PAPER,
    });

    this.chrome();
    this.y = H - 34 * MM;
    return this.y;
  }

  chrome() {
    const ink = this.dark ? LIGHT : NAVY;
    const sub = this.dark ? mix(LIGHT, NAVY, 0.48) : SLATE;
    const hair = this.dark ? mix(NAVY2, LIGHT, 0.26) : HAIR;

    const doc = this.payload.document || { kind: 'MEETING OUTCOME REPORT', footer_label: '' };
    const footerLabel = doc.footer_label || '';
    const classification = doc.classification || 'Commercial in confidence';

    this.tracked('CONCLUDO', XL, TOPRULE + 3.4 * MM, 'MB', 6.0, 1.6, ink);
    this.tracked((doc.kind || 'MEETING OUTCOME REPORT').toUpperCase(), XL + 28 * MM, TOPRULE + 3.4 * MM, 'M', 6.0, 1.3, sub);
    this.tracked(this.section.toUpperCase(), XR, TOPRULE + 3.4 * MM, 'M', 6.0, 1.3, sub, 'r');

    // Top lines
    this.currentPage.drawLine({
      start: { x: XL, y: TOPRULE },
      end: { x: XR, y: TOPRULE },
      thickness: 0.5,
      color: hair,
    });
    this.currentPage.drawLine({
      start: { x: XL, y: TOPRULE },
      end: { x: XL + 16 * MM, y: TOPRULE },
      thickness: 1.1,
      color: this.dark ? GOLD : GOLDD,
    });

    // Foot lines
    this.currentPage.drawLine({
      start: { x: XL, y: FOOTRULE },
      end: { x: XR, y: FOOTRULE },
      thickness: 0.5,
      color: hair,
    });
    this.tracked(footerLabel.toUpperCase(), XL, FOOTRULE - 5 * MM, 'M', 5.4, 1.2, sub);
    this.tracked(classification.toUpperCase(), W / 2, FOOTRULE - 5 * MM, 'M', 5.4, 1.2, sub, 'c');

    const totalStr = this.total ? ` / ${String(this.total).padStart(2, '0')}` : '';
    this.tracked(`${String(this.pageCount).padStart(2, '0')}${totalStr}`, XR, FOOTRULE - 5 * MM, 'MB', 5.8, 1.2, ink, 'r');
  }

  need(height: number, section?: string, dark?: boolean, continuedTitle?: [string, string]): number {
    if (this.y - height < BOTTOM) {
      this.newPage(section || this.section, dark !== undefined ? dark : this.dark);
      if (continuedTitle) {
        this.y = this.h1(continuedTitle[0], continuedTitle[1] + ', continued', this.y);
      }
    }
    return this.y;
  }

  h1(kick: string, title: string, y: number, size = 23): number {
    const ink = this.dark ? LIGHT : NAVY;
    this.tracked(kick.toUpperCase(), XL, y, 'M', 5.8, 1.6, this.dark ? GOLD : GOLDD);
    y -= 9.6 * MM;

    const lines = wrapText(title, this.fonts.HB, size, CW);
    for (let i = 0; i < lines.length; i++) {
      this.currentPage.drawText(lines[i], {
        x: XL,
        y: y - i * 11 * MM,
        size: size,
        font: this.fonts.HB,
        color: ink,
      });
    }
    y -= (lines.length - 1) * 11 * MM + 5.6 * MM;

    this.currentPage.drawLine({
      start: { x: XL, y: y },
      end: { x: XL + 22 * MM, y: y },
      thickness: 1.4,
      color: this.dark ? GOLD : GOLDD,
    });
    this.y = y - 9 * MM;
    return this.y;
  }

  h2(title: string, y: number): number {
    const ink = this.dark ? LIGHT : NAVY;
    this.currentPage.drawText(title, {
      x: XL,
      y: y,
      size: 12.5,
      font: this.fonts.H,
      color: ink,
    });
    this.currentPage.drawLine({
      start: { x: XL, y: y - 3.4 * MM },
      end: { x: XR, y: y - 3.4 * MM },
      thickness: 0.6,
      color: this.dark ? mix(NAVY2, LIGHT, 0.3) : HAIR,
    });
    this.y = y - 11 * MM;
    return this.y;
  }

  bullets(items: string[], y: number, width?: number): number {
    const w = width || CW - 12 * MM;
    for (const it of items) {
      const lines = wrapText(it, this.fonts.B, 8.4, w);
      y = this.need(lines.length * 4.4 * MM + 4 * MM);
      this.currentPage.drawRectangle({
        x: XL,
        y: y + 1.0 * MM,
        width: 1.6 * MM,
        height: 1.6 * MM,
        color: GOLD,
      });
      for (let i = 0; i < lines.length; i++) {
        this.currentPage.drawText(lines[i], {
          x: XL + 6 * MM,
          y: y - i * 4.4 * MM,
          size: 8.4,
          font: this.fonts.B,
          color: this.dark ? mix(LIGHT, NAVY, 0.16) : NAVY,
        });
      }
      y -= lines.length * 4.4 * MM + 2.6 * MM;
      this.y = y;
    }
    return this.y;
  }

  callout(title: string, lines: string[], y: number, tone?: Color): number {
    const col = tone || (this.dark ? GOLD : GOLDD);
    const pad = 6 * MM;
    const tw = CW - 2 * pad;
    const body: string[] = [];
    for (const ln of lines) {
      body.push(...wrapText(ln, this.fonts.B, 8.4, tw), '');
    }
    if (body.length) body.pop();
    const hgt = 15.4 * MM + body.length * 4.4 * MM;
    y = this.need(hgt + 6 * MM);

    this.currentPage.drawRectangle({
      x: XL,
      y: y - hgt,
      width: CW,
      height: hgt,
      color: this.dark ? mix(NAVY, LIGHT, 0.08) : mix(LIGHT, PAPER, 0.15),
    });
    this.currentPage.drawRectangle({
      x: XL,
      y: y - hgt,
      width: 1.6 * MM,
      height: hgt,
      color: col,
    });
    this.currentPage.drawText(title, {
      x: XL + pad,
      y: y - 8.2 * MM,
      size: 9.8,
      font: this.fonts.H,
      color: this.dark ? LIGHT : NAVY,
    });

    let yy = y - 15.4 * MM;
    for (const ln of body) {
      if (ln) {
        this.currentPage.drawText(ln, {
          x: XL + pad,
          y: yy,
          size: 8.4,
          font: this.fonts.B,
          color: this.dark ? mix(LIGHT, NAVY, 0.16) : NAVY,
        });
      }
      yy -= 4.4 * MM;
    }
    this.y = y - hgt - 8 * MM;
    return this.y;
  }

  table(cols: string[], widths: number[], rows: string[][], y: number, size = 8.0, lead = 4.3 * MM, pad = 4.0 * MM, continued?: [string, string]): number {
    const sumW = widths.reduce((a, b) => a + b, 0);
    const normWidths = widths.map((w) => (w * CW) / sumW);

    const header = (yy: number) => {
      const hf = this.dark ? mix(NAVY, LIGHT, 0.14) : NAVY;
      const hh = 7.2 * MM;
      this.currentPage.drawRectangle({
        x: XL,
        y: yy - hh + 2.2 * MM,
        width: CW,
        height: hh,
        color: hf,
      });
      let cx = XL + 3 * MM;
      for (let i = 0; i < cols.length; i++) {
        this.tracked(cols[i].toUpperCase(), cx, yy - 2.0 * MM, 'MB', 5.6, 1.2, this.dark ? GOLD : LIGHT);
        cx += normWidths[i];
      }
      return yy - hh - 2.2 * MM;
    };

    y = header(y);
    const ink = this.dark ? LIGHT : NAVY;
    const sub = this.dark ? mix(LIGHT, NAVY, 0.22) : mix(NAVY, SLATE, 0.55);
    const hair = this.dark ? mix(NAVY2, LIGHT, 0.22) : HAIR;

    for (const r of rows) {
      const cells = r.map((t, i) => wrapText(t, this.fonts.B, size, normWidths[i] - 6 * MM));
      const n = Math.max(...cells.map((x) => x.length));
      const block = (n - 1) * lead + pad * 2 + 1.2 * MM;

      if (y - block < BOTTOM) {
        this.newPage();
        if (continued) {
          this.h1(continued[0], continued[1] + ', continued', this.y);
          y = this.y;
        } else {
          y = this.y;
        }
        y = header(y);
      }

      let cx = XL + 3 * MM;
      for (let j = 0; j < cells.length; j++) {
        const ls = cells[j];
        for (let k = 0; k < ls.length; k++) {
          const yy = y - k * lead;
          if (j === 0) {
            this.tracked(ls[k], cx, yy, 'MB', 6.6, 0.7, this.dark ? GOLD : GOLDD);
          } else {
            this.currentPage.drawText(ls[k], {
              x: cx,
              y: yy,
              size: size,
              font: this.fonts.B,
              color: j === 1 ? ink : sub,
            });
          }
        }
        cx += normWidths[j];
      }
      y -= (n - 1) * lead + pad;
      this.currentPage.drawLine({
        start: { x: XL, y: y },
        end: { x: XR, y: y },
        thickness: 0.4,
        color: hair,
      });
      y -= pad + 1.2 * MM;
    }
    this.y = y;
    return y;
  }
}

// Section renderers
function renderCover(d: Doc) {
  d.pageCount += 1;
  d.dark = true;
  d.currentPage = d.pdf.addPage([W, H]);
  d.currentPage.drawRectangle({
    x: 0,
    y: 0,
    width: W,
    height: H,
    color: NAVY,
  });

  const band = 34 * MM;
  d.currentPage.drawRectangle({
    x: 0,
    y: H - band,
    width: W,
    height: band,
    color: PAPER,
  });

  if (d.logoImg) {
    const lw = 62 * MM;
    d.currentPage.drawImage(d.logoImg, {
      x: XL,
      y: H - band + (band - lw * LOCK_AR) / 2,
      width: lw,
      height: lw * LOCK_AR,
    });
  }

  const doc = d.payload.document || { kind: 'MEETING OUTCOME REPORT', footer_label: '' };
  d.tracked((doc.kind || 'MEETING OUTCOME REPORT').toUpperCase(), XR, H - band / 2 - 1.4 * MM, 'M', 6.4, 1.6, SLATE, 'r');

  d.currentPage.drawRectangle({
    x: 0,
    y: H - band - 1.6 * MM,
    width: W,
    height: 1.6 * MM,
    color: GOLD,
  });

  const m = d.payload.meeting || {};
  let y = H - band - 30 * MM;
  d.tracked((m.kicker || 'CONCLUDO WORKSPACE · EXTRACT AND GENERATE OUTPUTS').toUpperCase(), XL, y, 'M', 6.0, 1.6, mix(LIGHT, NAVY, 0.45));
  y -= 16 * MM;

  const rawLines = m.title_lines || [];
  const lines: string[] = [];
  for (const rawLine of rawLines) {
    const wrapped = wrapText(rawLine, d.fonts.HB, 30, CW);
    lines.push(...wrapped);
  }
  for (let i = 0; i < lines.length; i++) {
    d.currentPage.drawText(lines[i], {
      x: XL,
      y: y - i * 13 * MM,
      size: 30,
      font: d.fonts.HB,
      color: LIGHT,
    });
  }
  y -= Math.max(lines.length - 1, 0) * 13 * MM;

  if (m.accent_line) {
    d.currentPage.drawText(m.accent_line, {
      x: XL,
      y: y - 13 * MM,
      size: 30,
      font: d.fonts.HM,
      color: GOLD,
    });
    y -= 13 * MM;
  }

  if (m.subtitle) {
    d.currentPage.drawText(m.subtitle, {
      x: XL,
      y: y - 10 * MM,
      size: 12,
      font: d.fonts.HM,
      color: mix(LIGHT, NAVY, 0.22),
    });
  }

  const meta = (d.payload.meta || []).slice(0, 4);
  if (meta.length > 0) {
    const ys = FOOTRULE + 118 * MM;
    const sh = 26 * MM;
    d.currentPage.drawRectangle({
      x: XL,
      y: ys - sh,
      width: CW,
      height: sh,
      color: mix(NAVY, LIGHT, 0.10),
    });
    const cwid = CW / Math.max(meta.length, 1);
    for (let i = 0; i < meta.length; i++) {
      const cell = meta[i];
      const cx = XL + i * cwid + 6 * MM;
      d.tracked((cell.label || '').toUpperCase(), cx, ys - 8 * MM, 'M', 5.2, 1.3, mix(LIGHT, NAVY, 0.50));
      const maxCellTextW = cwid - 10 * MM;
      const fitVal = fitText(String(cell.value || ''), d.fonts.H, 9.6, maxCellTextW);
      const fitNote = fitText(String(cell.note || ''), d.fonts.B, 7.4, maxCellTextW);
      d.currentPage.drawText(fitVal, {
        x: cx,
        y: ys - 14.4 * MM,
        size: 9.6,
        font: d.fonts.H,
        color: LIGHT,
      });
      d.currentPage.drawText(fitNote, {
        x: cx,
        y: ys - 19.6 * MM,
        size: 7.4,
        font: d.fonts.B,
        color: mix(LIGHT, NAVY, 0.42),
      });
      if (i > 0) {
        d.currentPage.drawLine({
          start: { x: XL + i * cwid, y: ys - sh + 5 * MM },
          end: { x: XL + i * cwid, y: ys - 5 * MM },
          thickness: 0.5,
          color: mix(NAVY2, LIGHT, 0.20),
        });
      }
    }
  }

  const counts = (d.payload.counts || []).slice(0, 4);
  if (counts.length > 0) {
    const yc = FOOTRULE + 62 * MM;
    const cwid = CW / Math.max(counts.length, 1);
    for (let i = 0; i < counts.length; i++) {
      const cell = counts[i];
      const cx = XL + i * cwid;
      d.currentPage.drawText(String(cell.value || ''), {
        x: cx,
        y: yc,
        size: 26,
        font: d.fonts.HB,
        color: i === 0 ? GOLD : LIGHT,
      });
      d.tracked((cell.label || '').toUpperCase(), cx, yc - 6.4 * MM, 'M', 5.2, 1.3, mix(LIGHT, NAVY, 0.46));
    }
  }

  d.currentPage.drawLine({
    start: { x: XL, y: FOOTRULE + 26 * MM },
    end: { x: XR, y: FOOTRULE + 26 * MM },
    thickness: 0.5,
    color: mix(NAVY2, LIGHT, 0.20),
  });

  let notices = [...(d.payload.notices || [])];
  if (!d.payload.tier) {
    notices.unshift('Subscription level not provided');
  }
  notices = notices.slice(0, 3);
  for (let i = 0; i < notices.length; i++) {
    d.tracked(notices[i].toUpperCase(), XL, FOOTRULE + 19 * MM - i * 5.6 * MM, 'M', 5.4, 1.2, i === 1 ? GOLD : mix(LIGHT, NAVY, 0.46));
  }

  // Cover does not call d.chrome() so logo band remains pristine
}

function renderInputs(d: Doc, s: any) {
  d.newPage('section 01  inputs', false);
  d.h1('Section 01', s.title || 'Inputs and evidence', d.y);
  if (s.intro) d.y = d.para(s.intro, XL, d.y, CW - 30 * MM, 'B', 8.6, 4.8 * MM, SLATE) - 2 * MM;
  if (s.rows) {
    d.y = d.table(
      s.columns || ['ID', 'Source', 'Owner', 'State', 'Class'],
      s.widths || [22, 60, 30, 42, 16],
      s.rows,
      d.y,
      8.0,
      4.3 * MM,
      4.0 * MM,
      ['Section 01', s.title || 'Inputs and evidence']
    );
  }
  if (s.gaps) {
    d.y = d.need(20 * MM) - 4 * MM;
    d.y = d.h2(s.gaps_title || 'What the meeting left open', d.y);
    d.y = d.bullets(s.gaps, d.y);
  }
  if (s.conflict) {
    d.y -= 4 * MM;
    d.callout(s.conflict.title || 'Evidence conflict', s.conflict.lines || [], d.y);
  }
}

function renderExecutive(d: Doc, s: any) {
  d.newPage('section 02  summary', true);
  d.h1('Section 02', s.title || 'Executive summary', d.y);
  if (s.intro) {
    d.y = d.para(s.intro, XL, d.y, CW - 26 * MM, 'B', 9.4, 5.2 * MM, mix(LIGHT, NAVY, 0.10)) - 7 * MM;
  }
  for (const pt of s.points || []) {
    const lines = wrapText(pt.text || '', d.fonts.B, 8.8, CW - 30 * MM);
    const block = 6.2 * MM + lines.length * 4.8 * MM + 5.0 * MM;
    const y = d.need(block + 9 * MM);

    d.currentPage.drawRectangle({
      x: XL,
      y: y - block,
      width: 1.6 * MM,
      height: block,
      color: GOLD,
    });
    d.currentPage.drawText(pt.label || '', {
      x: XL + 8 * MM,
      y: y - 4.2 * MM,
      size: 11.0,
      font: d.fonts.H,
      color: d.dark ? LIGHT : NAVY,
    });
    for (let i = 0; i < lines.length; i++) {
      d.currentPage.drawText(lines[i], {
        x: XL + 8 * MM,
        y: y - 11.4 * MM - i * 4.8 * MM,
        size: 8.8,
        font: d.fonts.B,
        color: d.dark ? mix(LIGHT, NAVY, 0.14) : NAVY,
      });
    }
    if (pt.evidence) {
      d.tracked(
        pt.evidence,
        XL + 8 * MM,
        y - 11.4 * MM - lines.length * 4.8 * MM - 0.4 * MM,
        'M',
        5.4,
        1.2,
        d.dark ? mix(LIGHT, NAVY, 0.50) : SLATE
      );
    }
    d.y = y - block - 8.4 * MM;
  }
}

function renderRegister(d: Doc, s: any, num: string, label: string, dark = false, defaultCols?: string[], defaultWidths?: number[]) {
  d.newPage(label, dark);
  d.h1(`Section ${num}`, s.title || 'Register', d.y);
  if (s.intro) {
    d.y = d.para(s.intro, XL, d.y, CW - 30 * MM, 'B', 8.6, 4.8 * MM, dark ? mix(LIGHT, NAVY, 0.34) : SLATE) - 2 * MM;
  }
  d.y = d.table(
    s.columns || defaultCols,
    s.widths || defaultWidths,
    s.rows,
    d.y,
    s.size || 8.0,
    4.3 * MM,
    4.0 * MM,
    [`Section ${num}`, s.title || 'Register']
  );

  if (s.stats) {
    const block = 18 * MM + s.stats.length * 9.4 * MM;
    d.y = d.need(block, undefined, undefined, [`Section ${num}`, s.title || 'Register']) - 6 * MM;
    d.y = d.h2(s.stats_title || 'Accountability check', d.y);
    for (const [k, v] of s.stats) {
      d.currentPage.drawText(k, {
        x: XL,
        y: d.y,
        size: 8.8,
        font: d.fonts.B,
        color: dark ? LIGHT : NAVY,
      });
      d.currentPage.drawLine({
        start: { x: XL + 62 * MM, y: d.y + 1.0 * MM },
        end: { x: XR - 34 * MM, y: d.y + 1.0 * MM },
        thickness: 0.4,
        color: dark ? mix(NAVY2, LIGHT, 0.22) : HAIR,
      });
      d.tracked(String(v), XR, d.y, 'MB', 7.6, 0.8, dark ? GOLD : NAVY, 'r');
      d.y -= 9.4 * MM;
    }
  }

  if (s.callout) {
    d.y -= 2 * MM;
    d.callout(s.callout.title || '', s.callout.lines || [], d.y);
  }
  return d.y;
}

function renderRecommendations(d: Doc, s: any) {
  d.newPage('section 06  recommendations', false);
  d.h1('Section 06', s.title || 'Recommendations', d.y);
  if (s.intro) d.y = d.para(s.intro, XL, d.y, CW - 30 * MM, 'B', 8.6, 4.8 * MM, SLATE) - 2 * MM;

  const tones: Record<string, [Color, Color]> = {
    CRITICAL: [GOLD, NAVY],
    HIGH: [NAVY2, LIGHT],
    MEDIUM: [mix(SLATE, NAVY, 0.3), LIGHT],
    LOW: [mix(SLATE, HAIR, 0.4), NAVY],
  };

  for (const band of s.bands || []) {
    const label = (band.label || '').toUpperCase();
    const [fill, ink] = tones[label] || [NAVY2, LIGHT];
    let y = d.need(26 * MM);

    d.currentPage.drawRectangle({
      x: XL,
      y: y - 1.2 * MM,
      width: 26 * MM,
      height: 4.9 * MM,
      color: fill,
    });
    d.tracked(label, XL + 13 * MM, y + 0.45 * MM, 'MB', 5.6, 1.0, ink, 'c');
    d.currentPage.drawLine({
      start: { x: XL + 30 * MM, y: y + 1.2 * MM },
      end: { x: XR, y: y + 1.2 * MM },
      thickness: 0.4,
      color: HAIR,
    });
    y -= 11 * MM;

    for (const item of band.items || []) {
      const tl = wrapText(item.title || '', d.fonts.H, 10.4, CW - 20 * MM);
      const wl = wrapText(item.why || '', d.fonts.B, 8.4, CW - 20 * MM);
      const block = tl.length * 5.2 * MM + wl.length * 4.4 * MM + 7 * MM;
      d.y = y;
      y = d.need(block);
      for (let i = 0; i < tl.length; i++) {
        d.currentPage.drawText(tl[i], {
          x: XL,
          y: y - i * 5.2 * MM,
          size: 10.4,
          font: d.fonts.H,
          color: NAVY,
        });
      }
      y -= tl.length * 5.2 * MM + 0.4 * MM;
      for (let i = 0; i < wl.length; i++) {
        d.currentPage.drawText(wl[i], {
          x: XL,
          y: y - i * 4.4 * MM,
          size: 8.4,
          font: d.fonts.B,
          color: SLATE,
        });
      }
      y -= wl.length * 4.4 * MM + 6.4 * MM;
    }
    d.y = y - 2 * MM;
  }
}

function renderHealth(d: Doc, s: any) {
  d.newPage('section 07  meeting health', false);
  d.h1('Section 07', s.title || 'Meeting health', d.y);
  if (s.intro) d.y = d.para(s.intro, XL, d.y, CW - 30 * MM, 'B', 8.6, 4.8 * MM, SLATE) - 3 * MM;

  const tx0 = XL + 62 * MM;
  const tx1 = XR - 14 * MM;

  for (const dim of s.dimensions || []) {
    const y = d.need(17 * MM);
    d.currentPage.drawText(dim.name || '', {
      x: XL,
      y: y,
      size: 9.4,
      font: d.fonts.H,
      color: NAVY,
    });
    const noteLines = wrapText(dim.note || '', d.fonts.B, 7.2, 54 * MM);
    for (let i = 0; i < noteLines.length; i++) {
      d.currentPage.drawText(noteLines[i], {
        x: XL,
        y: y - 4.6 * MM - i * 3.6 * MM,
        size: 7.2,
        font: d.fonts.B,
        color: SLATE,
      });
    }

    const score = dim.score;
    d.currentPage.drawRectangle({
      x: tx0,
      y: y - 0.4 * MM,
      width: tx1 - tx0,
      height: 2.6 * MM,
      color: HAIR,
    });

    if (typeof score === 'number') {
      d.currentPage.drawRectangle({
        x: tx0,
        y: y - 0.4 * MM,
        width: ((tx1 - tx0) * score) / 100,
        height: 2.6 * MM,
        color: score >= 70 ? NAVY : GOLDD,
      });
      d.tracked(String(Math.round(score)), XR, y, 'MB', 8.4, 0.8, NAVY, 'r');
    } else {
      d.tracked('OPEN', XR, y, 'M', 6.0, 1.0, SLATE, 'r');
    }
    d.y = y - 15.2 * MM;
  }

  const v = s.verdict;
  if (v) {
    const note = wrapText(v.note || '', d.fonts.B, 8.2, CW - 18 * MM);
    const hh = 23 * MM + note.length * 4.2 * MM;
    const y = d.need(hh + 6 * MM);

    d.currentPage.drawRectangle({
      x: XL,
      y: y - hh,
      width: CW,
      height: hh,
      color: NAVY,
    });
    d.currentPage.drawRectangle({
      x: XL,
      y: y - hh,
      width: 1.6 * MM,
      height: hh,
      color: GOLD,
    });
    d.tracked('VERDICT', XL + 7 * MM, y - 8 * MM, 'M', 5.4, 1.4, mix(LIGHT, NAVY, 0.46));
    d.currentPage.drawText(v.headline || '', {
      x: XL + 7 * MM,
      y: y - 15.4 * MM,
      size: 13,
      font: d.fonts.HB,
      color: LIGHT,
    });
    for (let i = 0; i < note.length; i++) {
      d.currentPage.drawText(note[i], {
        x: XL + 7 * MM,
        y: y - 21.2 * MM - i * 4.2 * MM,
        size: 8.2,
        font: d.fonts.B,
        color: mix(LIGHT, NAVY, 0.28),
      });
    }
    d.y = y - hh - 8 * MM;
  }
}

function renderClosing(d: Doc, s: any) {
  d.newPage('section 08  next meeting', true);
  d.h1('Section 08', s.title || 'Next meeting and audit', d.y);
  if (s.intro) d.y = d.para(s.intro, XL, d.y, CW - 26 * MM, 'B', 8.6, 4.6 * MM, mix(LIGHT, NAVY, 0.30)) - 3 * MM;

  for (const [k, v] of s.items || []) {
    const lines = wrapText(v, d.fonts.B, 8.6, CW - 44 * MM);
    const y = d.need(lines.length * 4.6 * MM + 6 * MM);
    d.tracked(k.toUpperCase(), XL, y, 'M', 5.6, 1.3, GOLD);
    for (let i = 0; i < lines.length; i++) {
      d.currentPage.drawText(lines[i], {
        x: XL + 40 * MM,
        y: y - i * 4.6 * MM,
        size: 8.6,
        font: d.fonts.B,
        color: mix(LIGHT, NAVY, 0.14),
      });
    }
    d.y = y - Math.max(lines.length * 4.6 * MM, 4.6 * MM) - 5.0 * MM;
  }

  if (s.audit) {
    d.y = d.need(40 * MM) - 4 * MM;
    d.y = d.h2(s.audit_title || 'Audit register', d.y);
    const cwid = CW / 2;
    const rows = s.audit;
    for (let i = 0; i < rows.length; i++) {
      const [k, v] = rows[i];
      const cx = XL + (i % 2) * cwid;
      const ly = d.y - Math.floor(i / 2) * 9.2 * MM;
      d.currentPage.drawText(k, {
        x: cx,
        y: ly,
        size: 8.4,
        font: d.fonts.B,
        color: mix(LIGHT, NAVY, 0.18),
      });
      d.currentPage.drawLine({
        start: { x: cx + 46 * MM, y: ly + 1.0 * MM },
        end: { x: cx + cwid - 22 * MM, y: ly + 1.0 * MM },
        thickness: 0.4,
        color: mix(NAVY2, LIGHT, 0.22),
      });
      d.tracked(String(v), cx + cwid - 18 * MM, ly, 'MB', 7.4, 0.8, GOLD);
    }
    d.y -= (Math.floor((rows.length + 1) / 2)) * 9.2 * MM + 6 * MM;
  }

  const g = s.gate;
  if (g) {
    const note = wrapText(g.note || '', d.fonts.B, 8.2, CW - 16 * MM);
    const hh = 23.4 * MM + note.length * 4.2 * MM;
    const y = d.need(hh + 4 * MM);

    d.currentPage.drawRectangle({
      x: XL,
      y: y - hh,
      width: CW,
      height: hh,
      color: mix(NAVY, LIGHT, 0.08),
    });
    d.currentPage.drawRectangle({
      x: XL,
      y: y - hh,
      width: 1.6 * MM,
      height: hh,
      color: GOLD,
    });
    d.tracked('QUALITY GATE', XL + 7 * MM, y - 8 * MM, 'M', 5.4, 1.4, mix(LIGHT, NAVY, 0.46));
    d.currentPage.drawText((g.status || '').toUpperCase(), {
      x: XL + 7 * MM,
      y: y - 16 * MM,
      size: 14,
      font: d.fonts.HB,
      color: GOLD,
    });
    for (let i = 0; i < note.length; i++) {
      d.currentPage.drawText(note[i], {
        x: XL + 7 * MM,
        y: y - 21.6 * MM - i * 4.2 * MM,
        size: 8.2,
        font: d.fonts.B,
        color: mix(LIGHT, NAVY, 0.22),
      });
    }
    d.y = y - hh - 6 * MM;
  }
}

function renderLocked(d: Doc, section: string, tier?: string | null) {
  d.newPage('entitlement', true);
  d.h1('Not included', 'Available in a higher Concludo subscription tier', d.y, 20);
  const pretty = section.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const currentTierLabel = TIERS[(tier || 'starter').toLowerCase()]?.label || TIERS['starter'].label;
  const reqTierLabel = requiredTier(section);
  d.para(
    `Requested output: ${pretty}. Current tier: ${currentTierLabel}. Required tier: ${reqTierLabel}.`,
    XL,
    d.y,
    CW - 26 * MM,
    'B',
    8.6,
    4.8 * MM,
    mix(LIGHT, NAVY, 0.20)
  );
}

const ORDER: Array<[string, any]> = [
  ['inputs', renderInputs],
  ['executive', renderExecutive],
  ['meeting_summary', null],
  ['decisions', null],
  ['actions', null],
  ['risks', null],
  ['recommendations', renderRecommendations],
  ['health', renderHealth],
  ['closing', renderClosing],
  ['board_report', null],
  ['evidence_register', null],
  ['traceability', null],
  ['strategic', null],
  ['coaching', null],
];

async function buildPass(payload: ConcludoReportPayload, total?: number): Promise<{ pdf: PDFDocument; pages: number }> {
  const pdf = await PDFDocument.create();
  const d = new Doc(pdf, payload, total);
  await d.init();

  renderCover(d);
  const tier = payload.tier;

  for (const [key, fn] of ORDER) {
    const s = payload[key];
    if (!s) continue;

    if (!entitled(tier, key)) {
      renderLocked(d, key, tier);
      continue;
    }

    if (key === 'decisions') {
      renderRegister(d, s, '03', 'section 03  decisions', false, ['ID', 'Decision', 'Owner', 'At', 'Class'], [22, 78, 32, 16, 22]);
    } else if (key === 'actions') {
      renderRegister(d, s, '04', 'section 04  actions', false, ['ID', 'Action', 'Owner', 'Due', 'At'], [22, 74, 32, 28, 14]);
    } else if (key === 'risks') {
      renderRegister(d, s, '05', 'section 05  risks', true, ['ID', 'Risk', 'Owner', 'Mitigation as stated'], [22, 60, 26, 62]);
    } else if (key === 'meeting_summary') {
      renderRegister(d, s, '02b', 'section 02  meeting summary', false, ['ID', 'Topic', 'Outcome', 'At'], [22, 60, 78, 14]);
    } else if (fn) {
      fn(d, s);
    }
  }

  return { pdf, pages: d.pageCount };
}

export async function renderConcludoReport(payload: ConcludoReportPayload): Promise<{ pdfBytes: Uint8Array; pages: number }> {
  // Pass 1: measure total pages
  const pass1 = await buildPass(payload);
  const total = pass1.pages;

  // Pass 2: render with accurate total page count in footer
  const pass2 = await buildPass(payload, total);

  const limit = TIERS[(payload.tier || 'starter').toLowerCase()]?.max_pages;
  if (limit && total > limit) {
    throw new Error(`Output is ${total} pages, above the ${limit} page limit for this tier.`);
  }

  const pdfBytes = await pass2.pdf.save();
  return { pdfBytes, pages: total };
}
