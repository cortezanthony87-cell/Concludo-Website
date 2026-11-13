import type PptxGenJSType from 'pptxgenjs';
import { TimelineAssetBundle, TimelinePayload, TimelineRenderOptions } from './types';
import { loadTimelineAssets } from './timelineAssets';
import {
  TIMELINE_COLORS as C,
  TIMELINE_STATUS as STATUS,
  DAY_MS as DAY,
  parseUtcDate as d,
  formatTimelineDate as fmt,
  clipText as clip,
  shortOwner as short,
  firstWordOwner as first2,
  tintColor as tint,
  calculateStartMondayOfWeekBefore,
  sanitizeTimelineText,
} from './timelineData';

const W = 13.333;
const H = 7.5;
const LOGO_ASPECT = 2261 / 885;
const SHADOW = { type: 'outer' as const, blur: 6, offset: 2, angle: 90, color: '16263F', opacity: 0.18 };

// Road geometry bezier control points
const ROAD_MAP = [{ x: -0.5, y: 6.6 }, { x: 4.4, y: 6.45 }, { x: 8.6, y: 4.35 }, { x: 13.9, y: 2.55 }];
const ROAD_COVER = [{ x: -0.6, y: 6.75 }, { x: 4.8, y: 6.55 }, { x: 9.6, y: 5.3 }, { x: 13.95, y: 2.6 }];
const COLS_X = [0.6, 3.75, 6.9, 10.05];

const bez = (p: { x: number; y: number }[], t: number) => {
  const u = 1 - t;
  return {
    x: u * u * u * p[0].x + 3 * u * u * t * p[1].x + 3 * u * t * t * p[2].x + t * t * t * p[3].x,
    y: u * u * u * p[0].y + 3 * u * u * t * p[1].y + 3 * u * t * t * p[2].y + t * t * t * p[3].y,
  };
};

const tForX = (p: { x: number; y: number }[], x: number) => {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (bez(p, m).x < x) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
};

const yAtX = (p: { x: number; y: number }[], x: number) => bez(p, tForX(p, x)).y;

function drawFooter(
  s: any,
  n: number,
  total: number,
  projectTitle: string,
  logoData: string,
  darkBg = false
) {
  const textColor = darkBg ? 'C9D5EA' : C.mute;
  s.addText(projectTitle.toUpperCase(), {
    x: 0.6,
    y: 7.02,
    w: 6.5,
    h: 0.26,
    margin: 0,
    fontFace: 'Inter',
    fontSize: 8,
    bold: true,
    color: textColor,
    charSpacing: 1.5,
    valign: 'middle',
  });
  s.addText(`${String(n).padStart(2, '0')} / ${String(total).padStart(2, '0')}`, {
    x: W - 0.6 - 1.2,
    y: 7.02,
    w: 1.2,
    h: 0.26,
    margin: 0,
    fontFace: 'Inter',
    fontSize: 8,
    bold: true,
    color: textColor,
    align: 'right',
    charSpacing: 1.5,
    valign: 'middle',
  });

  if (!darkBg && logoData) {
    const lh = 0.24;
    s.addImage({
      data: logoData,
      x: W - 0.6 - 1.45 - lh * LOGO_ASPECT,
      y: 7.03,
      w: lh * LOGO_ASPECT,
      h: lh,
      altText: 'Concludo',
    });
  }
}

function drawHeading(s: any, kicker: string, title: string, w = 7.4) {
  s.addText(kicker.toUpperCase(), {
    x: 0.6,
    y: 0.42,
    w,
    h: 0.28,
    margin: 0,
    fontFace: 'Inter',
    fontSize: 9.5,
    bold: true,
    color: C.goldDeep,
    charSpacing: 3,
    valign: 'middle',
  });
  s.addText(title, {
    x: 0.6,
    y: 0.72,
    w,
    h: 0.75,
    margin: 0,
    fontFace: 'Poppins',
    fontSize: 30,
    bold: true,
    color: C.ink,
    valign: 'top',
    fit: 'none',
  });
}

function drawChip(s: any, x: number, y: number, text: string, color: string, w: number) {
  s.addText(text, {
    x,
    y,
    w,
    h: 0.26,
    margin: [0, 6, 0, 6],
    shape: 'roundRect',
    rectRadius: 0.13,
    fill: { color },
    color: C.white,
    fontFace: 'Inter',
    fontSize: 8.5,
    bold: true,
    align: 'center',
    valign: 'middle',
  });
}

/**
 * Renders the full PowerPoint presentation matching Concludo_Action_Timeline_Template_v1.pptx exactly.
 */
export async function renderTimelinePptx(
  PptxGenJS: typeof PptxGenJSType,
  payload: TimelinePayload,
  options: TimelineRenderOptions = {}
): Promise<{ pptx: InstanceType<typeof PptxGenJSType>; slideCount: number }> {
  const assets = options.assets && options.assets.cover ? (options.assets as TimelineAssetBundle) : await loadTimelineAssets();
  const F = { head: options.fonts?.head || 'Poppins', body: options.fonts?.body || 'Inter' };

  const TODAY = payload.exportedOn;
  const exportYear = TODAY.slice(0, 4);
  const acts = payload.actions;

  const count = (b: string) => acts.filter((a) => a.b === b).length;
  const open = acts.filter((a) => a.b !== 'completed');
  const dated = acts.filter((a) => a.due).sort((x, y) => (x.due || '').localeCompare(y.due || ''));
  const nextUp = open.filter((a) => a.due && a.due >= TODAY).sort((x, y) => (x.due || '').localeCompare(y.due || ''));

  const first = dated.length > 0 ? dated[0].due! : TODAY;
  const last = dated.length > 0 ? dated[dated.length - 1].due! : TODAY;

  // Group assignees who have dated actions in or near the window for slide 3
  let allAssignees: string[] = [];
  if (options.assigneesOrder && options.assigneesOrder.length > 0) {
    const present = new Set(acts.map((a) => short(a.owner)).filter((o) => o && o !== 'Owner to be agreed'));
    allAssignees = options.assigneesOrder.filter((o) => present.has(o));
    present.forEach((o) => {
      if (!allAssignees.includes(o)) allAssignees.push(o);
    });
  } else {
    allAssignees = Array.from(
      new Set(dated.map((a) => short(a.owner)).filter((o) => o && o !== 'Owner to be agreed'))
    );
  }
  if (allAssignees.length === 0) {
    allAssignees.push('Unassigned');
  }

  // Each assignee slide has up to 5 lanes
  const assigneeChunks: string[][] = [];
  for (let i = 0; i < allAssignees.length; i += 5) {
    assigneeChunks.push(allAssignees.slice(i, i + 5));
  }
  if (assigneeChunks.length === 0) {
    assigneeChunks.push(['Unassigned']);
  }

  // Base 6 slides + any additional assignee chunk slides beyond the first
  const TOTAL_SLIDES = 6 + (assigneeChunks.length - 1);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Concludo';
  pptx.company = 'Concludo';
  pptx.title = `Action timeline: ${payload.project}`;

  let currentSlideNum = 1;

  // ----------------------------------------------------
  // 1. Cover Slide
  // ----------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { data: assets.cover };

    // Top logo
    if (assets.logo) {
      const lh = 0.46;
      s.addImage({
        data: assets.logo,
        x: 0.6,
        y: 0.45,
        w: lh * LOGO_ASPECT,
        h: lh,
        altText: 'Concludo',
      });
    }

    s.addText('ACTION TIMELINE', {
      x: 0.6,
      y: 1.62,
      w: 8,
      h: 0.3,
      margin: 0,
      fontFace: F.body,
      fontSize: 11,
      bold: true,
      color: C.goldDeep,
      charSpacing: 4,
    });

    s.addText(payload.shortProject, {
      x: 0.6,
      y: 1.95,
      w: 9.5,
      h: 0.95,
      margin: 0,
      fontFace: F.head,
      fontSize: 46,
      bold: true,
      color: C.ink,
      valign: 'top',
      fit: 'none',
    });

    const coverSubtitle =
      payload.project && payload.project.includes(':')
        ? payload.project.split(':')[1].trim() + ': every open action, on one road'
        : `${acts.length} action${acts.length === 1 ? '' : 's'} from ${payload.source}`;

    s.addText(coverSubtitle, {
      x: 0.6,
      y: 2.88,
      w: 9.5,
      h: 0.45,
      margin: 0,
      fontFace: F.body,
      fontSize: 17,
      color: C.body,
    });

    const dateRangeStr =
      dated.length === 0
        ? 'No dated actions'
        : dated.length === 1
        ? `Due on ${fmt(first, false)} ${exportYear}`
        : `${fmt(first, false)} to ${fmt(last, false)} ${exportYear}`;

    s.addText(
      `${dateRangeStr}   |   Exported ${fmt(TODAY)} ${exportYear}   |   ${payload.timezone.replace('_', ' ')}`,
      {
        x: 0.6,
        y: 3.36,
        w: 9.5,
        h: 0.3,
        margin: 0,
        fontFace: F.body,
        fontSize: 10.5,
        color: C.mute,
      }
    );

    // 5 Status KPI cards
    const kpis: [string, number][] = [
      ['upcoming', count('upcoming')],
      ['today', count('today')],
      ['overdue', count('overdue')],
      ['unscheduled', count('unscheduled')],
      ['completed', count('completed')],
    ];

    kpis.forEach(([k, n], i) => {
      const x = 0.6 + i * 1.62;
      const y = 3.95;
      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w: 1.48,
        h: 1.0,
        rectRadius: 0.12,
        fill: { color: C.white },
        line: { color: C.hair, width: 0.75 },
        shadow: SHADOW,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: x + 0.16,
        y: y + 0.17,
        w: 0.36,
        h: 0.05,
        fill: { color: (STATUS as any)[k].color },
        line: { color: (STATUS as any)[k].color, width: 0 },
      });
      s.addText(String(n), {
        x: x + 0.16,
        y: y + 0.25,
        w: 1.2,
        h: 0.45,
        margin: 0,
        fontFace: F.head,
        fontSize: 24,
        bold: true,
        color: C.ink,
        valign: 'middle',
      });
      s.addText((STATUS as any)[k].label, {
        x: x + 0.16,
        y: y + 0.68,
        w: 1.25,
        h: 0.24,
        margin: 0,
        fontFace: F.body,
        fontSize: 9,
        color: C.mute,
        valign: 'middle',
      });
    });

    // Road dots on cover
    const roadColors = ['completed', 'completed', 'overdue', 'today', 'upcoming', 'upcoming', 'unscheduled'];
    roadColors.forEach((k, i) => {
      const x = 7.2 + i * 0.85;
      const y = yAtX(ROAD_COVER, x);
      const r = 0.13;
      s.addShape(pptx.ShapeType.ellipse, {
        x: x - r,
        y: y - r,
        w: r * 2,
        h: r * 2,
        fill: { color: (STATUS as any)[k].color },
        line: { color: C.white, width: 2 },
        shadow: SHADOW,
      });
    });

    s.addText(`${acts.length} action${acts.length === 1 ? '' : 's'} in total`, {
      x: 0.6,
      y: 5.08,
      w: 4,
      h: 0.28,
      margin: 0,
      fontFace: F.body,
      fontSize: 10,
      bold: true,
      color: C.navy2,
    });

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, payload.project, assets.logo);
  }

  // ----------------------------------------------------
  // 2. The Road Ahead (Next Six Actions)
  // ----------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { data: assets.roadmap };
    drawHeading(s, 'The road ahead', 'Next six actions');

    const xs = [0.85, 2.9, 4.95, 7.0, 9.05, 11.05];
    const STEM = 2.45;

    const sixActions = nextUp.slice(0, 6);
    sixActions.forEach((a, i) => {
      const x = xs[i];
      const ry = yAtX(ROAD_MAP, x);
      const col = (STATUS as any)[a.b || 'upcoming'].color;
      const pinY = ry - STEM;

      s.addShape(pptx.ShapeType.line, {
        x,
        y: pinY + 0.25,
        w: 0,
        h: STEM - 0.25,
        line: { color: col, width: 2 },
      });
      s.addShape(pptx.ShapeType.ellipse, {
        x: x - 0.11,
        y: ry - 0.11,
        w: 0.22,
        h: 0.22,
        fill: { color: col },
        line: { color: C.white, width: 2 },
        shadow: SHADOW,
      });
      s.addShape(pptx.ShapeType.ellipse, {
        x: x - 0.29,
        y: pinY - 0.29,
        w: 0.58,
        h: 0.58,
        fill: { color: col },
        line: { color: C.white, width: 2.5 },
        shadow: SHADOW,
      });
      s.addText(String(i + 1).padStart(2, '0'), {
        x: x - 0.29,
        y: pinY - 0.29,
        w: 0.58,
        h: 0.58,
        margin: 0,
        fontFace: F.head,
        fontSize: 13,
        bold: true,
        color: C.white,
        align: 'center',
        valign: 'middle',
      });

      const lx = x + 0.2;
      drawChip(s, lx, pinY + 0.36, fmt(a.due), col, 1.05);
      s.addText(clip(a.title, 55), {
        x: lx,
        y: pinY + 0.68,
        w: 1.8,
        h: 0.62,
        margin: 0,
        fontFace: F.head,
        fontSize: 11,
        bold: true,
        color: C.ink,
        valign: 'top',
        fit: 'none',
        lineSpacingMultiple: 0.95,
      });
      s.addText(`${short(a.owner)}  |  ${a.priority}`, {
        x: lx,
        y: pinY + 1.32,
        w: 1.8,
        h: 0.24,
        margin: 0,
        fontFace: F.body,
        fontSize: 8.5,
        color: C.mute,
      });
    });

    const rest = Math.max(0, nextUp.length - 6);
    const upcomingNote =
      rest > 0
        ? `After these six, ${rest} actions run to ${fmt(nextUp[nextUp.length - 1].due)}. ${count('overdue')} are overdue and ${count('unscheduled')} have no date yet; both are on slide 5.`
        : nextUp.length > 0
        ? `All upcoming actions are shown above. ${count('overdue')} are overdue and ${count('unscheduled')} have no date yet; both are on slide 5.`
        : `No upcoming dated actions. ${count('overdue')} are overdue and ${count('unscheduled')} have no date yet; both are on slide 5.`;

    s.addText(
      [
        { text: `${rest} more upcoming`, options: { bold: true, color: C.ink, breakLine: true } },
        { text: upcomingNote, options: { color: C.body } },
      ],
      {
        x: 8.3,
        y: 5.7,
        w: 4.4,
        h: 0.95,
        margin: 0,
        fontFace: F.body,
        fontSize: 10.5,
        valign: 'top',
      }
    );

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, payload.project, assets.logo);
  }

  // ----------------------------------------------------
  // 3. Week by Week (One or more continuation slides)
  // ----------------------------------------------------
  const startMonday = calculateStartMondayOfWeekBefore(TODAY);
  const WEEKS_COUNT = 7;
  const gx = 2.25;
  const gy = 1.85;
  const gw = W - 0.6 - gx;
  const colW = gw / WEEKS_COUNT;
  const laneH = 0.9;
  const headH = 0.42;

  assigneeChunks.forEach((chunkOwners, chunkIdx) => {
    const s = pptx.addSlide();
    s.background = { data: assets.grid };
    const slideHeading = chunkIdx === 0 ? 'Who is doing what, and when' : 'Who is doing what, and when (continued)';
    drawHeading(s, 'Week by week', slideHeading, 9);

    // Top right legend
    const lg = ['completed', 'overdue', 'today', 'upcoming'];
    lg.forEach((k, i) => {
      const x = 6.85 + i * 1.5;
      const y = 0.43;
      s.addShape(pptx.ShapeType.ellipse, {
        x,
        y: y + 0.06,
        w: 0.13,
        h: 0.13,
        fill: { color: (STATUS as any)[k].color },
        line: { color: (STATUS as any)[k].color, width: 0 },
      });
      s.addText((STATUS as any)[k].label, {
        x: x + 0.2,
        y,
        w: 1.3,
        h: 0.25,
        margin: 0,
        fontFace: F.body,
        fontSize: 9,
        color: C.mute,
        valign: 'middle',
      });
    });

    // Grid frame
    s.addShape(pptx.ShapeType.roundRect, {
      x: 0.6,
      y: gy,
      w: W - 1.2,
      h: headH + laneH * chunkOwners.length + 0.08,
      rectRadius: 0.1,
      fill: { color: C.white },
      line: { color: C.hair, width: 0.75 },
      shadow: SHADOW,
    });

    // Week columns
    for (let w = 0; w < WEEKS_COUNT; w++) {
      const wx = gx + w * colW;
      const wsDate = new Date(startMonday.getTime() + w * 7 * DAY);
      const ws = wsDate.toISOString().slice(0, 10);
      const nextWs = new Date(startMonday.getTime() + (w + 1) * 7 * DAY).toISOString().slice(0, 10);
      const isNow = TODAY >= ws && TODAY < nextWs;

      if (isNow) {
        s.addShape(pptx.ShapeType.rect, {
          x: wx,
          y: gy + 0.04,
          w: colW,
          h: headH + laneH * chunkOwners.length,
          fill: { color: 'FBF3DC' },
          line: { color: 'FBF3DC', width: 0 },
        });
      }

      s.addText(`Week of ${fmt(ws, false)}`, {
        x: wx,
        y: gy + 0.08,
        w: colW,
        h: headH - 0.1,
        margin: 0,
        fontFace: F.body,
        fontSize: 9,
        bold: true,
        color: isNow ? C.goldDeep : C.mute,
        align: 'center',
        valign: 'middle',
      });

      if (w > 0) {
        s.addShape(pptx.ShapeType.line, {
          x: wx,
          y: gy + 0.1,
          w: 0,
          h: headH + laneH * chunkOwners.length - 0.12,
          line: { color: 'EDF0F5', width: 0.75 },
        });
      }
    }

    // Assignee lanes
    chunkOwners.forEach((o, r) => {
      const ly = gy + headH + r * laneH;
      s.addShape(pptx.ShapeType.line, {
        x: 0.75,
        y: ly,
        w: W - 1.5,
        h: 0,
        line: { color: 'EDF0F5', width: 0.75 },
      });

      // Avatar circle with initials
      const initials = o
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      s.addShape(pptx.ShapeType.ellipse, {
        x: 0.8,
        y: ly + laneH / 2 - 0.19,
        w: 0.38,
        h: 0.38,
        fill: { color: C.navy2 },
        line: { color: C.navy2, width: 0 },
      });
      s.addText(initials, {
        x: 0.8,
        y: ly + laneH / 2 - 0.19,
        w: 0.38,
        h: 0.38,
        margin: 0,
        fontFace: F.body,
        fontSize: 9,
        bold: true,
        color: C.white,
        align: 'center',
        valign: 'middle',
      });
      s.addText(clip(o, 18), {
        x: 1.26,
        y: ly + 0.1,
        w: 0.95,
        h: laneH - 0.2,
        margin: 0,
        fontFace: F.body,
        fontSize: 9.5,
        bold: true,
        color: C.ink,
        valign: 'middle',
      });

      // Actions for this assignee in the 7-week window
      const mine = dated.filter((a) => (a.owner ? short(a.owner) === o : o === 'Owner to be agreed' || o === 'Unassigned'));
      const slots: { x: number; row: number }[] = [];
      let overflowCount = 0;

      mine.forEach((a) => {
        if (!a.due) return;
        const off = (d(a.due).getTime() - startMonday.getTime()) / DAY;
        if (off < 0 || off >= WEEKS_COUNT * 7) return; // Outside window

        let x = gx + (off / 7) * colW - 0.06;
        x = Math.max(gx + 0.04, Math.min(x, gx + gw - 1.55));

        let row = 0;
        while (slots.some((sl) => sl.row === row && Math.abs(sl.x - x) < 1.6)) {
          row++;
        }

        if (row >= 2) {
          overflowCount++;
          return;
        }

        slots.push({ x, row });
        const y = ly + 0.05 + row * 0.42;
        const col = (STATUS as any)[a.b || 'upcoming'].color;

        s.addShape(pptx.ShapeType.roundRect, {
          x,
          y,
          w: 1.52,
          h: 0.38,
          rectRadius: 0.08,
          fill: { color: tint(col, 0.14) },
          line: { color: col, width: 1 },
        });
        s.addShape(pptx.ShapeType.ellipse, {
          x: x + 0.08,
          y: y + 0.09,
          w: 0.1,
          h: 0.1,
          fill: { color: col },
          line: { color: col, width: 0 },
        });
        s.addText(fmt(a.due), {
          x: x + 0.22,
          y: y + 0.03,
          w: 1.25,
          h: 0.16,
          margin: 0,
          fontFace: F.body,
          fontSize: 7.5,
          bold: true,
          color: C.ink,
          valign: 'middle',
        });
        s.addText(clip(a.title, 24), {
          x: x + 0.22,
          y: y + 0.19,
          w: 1.27,
          h: 0.16,
          margin: 0,
          fontFace: F.body,
          fontSize: 7.5,
          color: C.body,
          valign: 'middle',
        });
      });

      if (overflowCount > 0) {
        s.addText(`+ ${overflowCount} more in lane`, {
          x: gx + gw - 1.4,
          y: ly + laneH - 0.22,
          w: 1.35,
          h: 0.18,
          margin: 0,
          fontFace: F.body,
          fontSize: 7.5,
          bold: true,
          color: C.goldDeep,
          align: 'right',
        });
      }
    });

    // Today vertical marker line and chip
    const todayOff = (d(TODAY).getTime() - startMonday.getTime()) / DAY;
    if (todayOff >= 0 && todayOff <= WEEKS_COUNT * 7) {
      const tx = gx + (todayOff / 7) * colW;
      s.addShape(pptx.ShapeType.line, {
        x: tx,
        y: gy + headH - 0.02,
        w: 0,
        h: laneH * chunkOwners.length,
        line: { color: C.goldDeep, width: 1.5, dashType: 'dash' },
      });
      drawChip(s, tx - 0.6, gy - 0.34, `Today, ${fmt(TODAY, false)}`, C.goldDeep, 1.2);
    }

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, payload.project, assets.logo);
  });

  // ----------------------------------------------------
  // 4. Milestones by Horizon
  // ----------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { data: assets.ridge };
    drawHeading(s, 'Milestones by horizon', 'From what slipped to what is next', 10);

    const todayUtc = d(TODAY);
    const dayOfWeek = todayUtc.getUTCDay();
    const daysToSunday = (7 - dayOfWeek) % 7;
    const thisWeekEndIso = new Date(todayUtc.getTime() + daysToSunday * DAY).toISOString().slice(0, 10);
    const nextWeekStartIso = new Date(todayUtc.getTime() + (daysToSunday + 1) * DAY).toISOString().slice(0, 10);
    const nextWeekEndIso = new Date(todayUtc.getTime() + (daysToSunday + 7) * DAY).toISOString().slice(0, 10);

    const phases = [
      { k: 'overdue', title: 'Overdue', items: acts.filter((a) => a.b === 'overdue') },
      {
        k: 'today',
        title: 'This week',
        items: open.filter((a) => a.due && a.due >= TODAY && a.due <= thisWeekEndIso),
      },
      {
        k: 'upcoming',
        title: 'Next week',
        items: open.filter((a) => a.due && a.due >= nextWeekStartIso && a.due <= nextWeekEndIso),
      },
      {
        k: 'upcoming',
        title: 'Later',
        items: open.filter((a) => a.due && a.due > nextWeekEndIso),
      },
    ];

    phases.forEach((p, i) => {
      const x = COLS_X[i] + 0.3;
      const col = (STATUS as any)[p.k].color;
      s.addText(
        [
          { text: p.title, options: { bold: true, color: C.ink } },
          { text: `   ${p.items.length}`, options: { bold: true, color: col } },
        ],
        {
          x,
          y: 1.88,
          w: 2.55,
          h: 0.4,
          margin: 0,
          fontFace: F.head,
          fontSize: 15,
          valign: 'middle',
        }
      );

      const shown = p.items.slice(0, 4);
      shown.forEach((a, j) => {
        const y = 2.42 + j * 0.62;
        s.addText(clip(a.title, 42), {
          x,
          y,
          w: 2.55,
          h: 0.36,
          margin: 0,
          fontFace: F.body,
          fontSize: 10,
          bold: true,
          color: C.ink,
          valign: 'top',
          fit: 'shrink',
        });
        s.addText(`${first2(a.owner)}, ${fmt(a.due)}`, {
          x,
          y: y + 0.33,
          w: 2.55,
          h: 0.22,
          margin: 0,
          fontFace: F.body,
          fontSize: 8.5,
          color: C.mute,
        });
      });

      if (p.items.length > 4) {
        s.addText(`+ ${p.items.length - 4} more`, {
          x,
          y: 2.42 + 4 * 0.62,
          w: 2.55,
          h: 0.24,
          margin: 0,
          fontFace: F.body,
          fontSize: 9,
          bold: true,
          color: col,
        });
      }
    });

    // Slide 4 uses light text on the dark navy mountain ridge
    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, payload.project, assets.logo, true);
  }

  // ----------------------------------------------------
  // 5. Needs Attention (Overdue & No Date Yet)
  // ----------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { data: assets.attention };
    drawHeading(s, 'Needs attention', 'Overdue, and still without a date', 10);

    const cards = [
      {
        k: 'overdue',
        title: 'Overdue',
        items: acts.filter((a) => a.b === 'overdue'),
        badge: (a: any) =>
          a.due ? `${Math.max(1, Math.round((d(TODAY).getTime() - d(a.due).getTime()) / DAY))} days overdue` : 'Overdue',
        next: 'Next step: agree a new date with each owner.',
      },
      {
        k: 'unscheduled',
        title: 'No date yet',
        items: acts.filter((a) => a.b === 'unscheduled'),
        badge: () => 'Date to be agreed',
        next: 'Next step: give each one an owner and a date.',
      },
    ];

    cards.forEach((c, i) => {
      const x = 0.6 + i * 6.17;
      const y = 1.85;
      const w = 5.95;
      const col = (STATUS as any)[c.k].color;
      const n = Math.min(c.items.length, 5);
      const h = 1.75 + n * 0.66;

      s.addShape(pptx.ShapeType.roundRect, {
        x,
        y,
        w,
        h,
        rectRadius: 0.12,
        fill: { color: C.white },
        line: { color: C.hair, width: 0.75 },
        shadow: SHADOW,
      });
      s.addShape(pptx.ShapeType.rect, {
        x: x + 0.3,
        y: y + 0.3,
        w: 0.5,
        h: 0.06,
        fill: { color: col },
        line: { color: col, width: 0 },
      });
      s.addText(
        [
          { text: c.title, options: { color: C.ink } },
          { text: `  ${c.items.length}`, options: { color: col } },
        ],
        {
          x: x + 0.3,
          y: y + 0.42,
          w: 5,
          h: 0.45,
          margin: 0,
          fontFace: F.head,
          fontSize: 18,
          bold: true,
          valign: 'middle',
        }
      );
      s.addText(c.next, {
        x: x + 0.3,
        y: y + h - 0.55,
        w: w - 0.6,
        h: 0.3,
        margin: 0,
        fontFace: F.body,
        fontSize: 9.5,
        italic: true,
        color: C.mute,
        valign: 'middle',
      });

      c.items.slice(0, 5).forEach((a, j) => {
        const ry = y + 1.05 + j * 0.66;
        if (j > 0) {
          s.addShape(pptx.ShapeType.line, {
            x: x + 0.3,
            y: ry - 0.08,
            w: w - 0.6,
            h: 0,
            line: { color: 'EDF0F5', width: 0.75 },
          });
        }
        s.addText(clip(a.title, 44), {
          x: x + 0.3,
          y: ry,
          w: 4.0,
          h: 0.3,
          margin: 0,
          fontFace: F.body,
          fontSize: 10.5,
          bold: true,
          color: C.ink,
          valign: 'middle',
          fit: 'shrink',
        });
        s.addText(`${a.id}  |  ${short(a.owner)}${a.due ? '  |  was due ' + fmt(a.due) : ''}`, {
          x: x + 0.3,
          y: ry + 0.29,
          w: 3.6,
          h: 0.22,
          margin: 0,
          fontFace: F.body,
          fontSize: 8.5,
          color: C.mute,
        });
        s.addText(c.badge(a), {
          x: x + w - 0.3 - 1.35,
          y: ry + 0.08,
          w: 1.35,
          h: 0.3,
          margin: 0,
          shape: 'roundRect',
          rectRadius: 0.15,
          fill: { color: tint(col, 0.14) },
          line: { color: col, width: 0.75 },
          color: c.k === 'overdue' ? 'B4303E' : C.body,
          fontFace: F.body,
          fontSize: 8.5,
          bold: true,
          align: 'center',
          valign: 'middle',
        });
      });
    });

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, payload.project, assets.logo);
  }

  // ----------------------------------------------------
  // 6. Progress Slide
  // ----------------------------------------------------
  {
    const s = pptx.addSlide();
    s.background = { data: assets.close };
    drawHeading(s, 'Progress', `${count('completed')} of ${acts.length} action${acts.length === 1 ? '' : 's'} complete`, 10);

    const order = ['completed', 'today', 'upcoming', 'overdue', 'unscheduled'];
    const bx = 0.6;
    const by = 2.25;
    const bw = W - 1.2;
    const bh = 0.62;

    s.addShape(pptx.ShapeType.roundRect, {
      x: bx - 0.06,
      y: by - 0.06,
      w: bw + 0.12,
      h: bh + 0.12,
      rectRadius: 0.37,
      fill: { color: C.white },
      line: { color: C.hair, width: 0.75 },
      shadow: SHADOW,
    });

    let cx = bx;
    order.forEach((k, i) => {
      const n = count(k);
      if (!n || acts.length === 0) return;
      const w = (n / acts.length) * bw;
      const col = (STATUS as any)[k].color;
      s.addShape(i === 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, {
        x: cx,
        y: by,
        w,
        h: bh,
        rectRadius: 0.31,
        fill: { color: col },
        line: { color: C.white, width: 1.5 },
      });
      s.addText(String(n), {
        x: cx,
        y: by,
        w,
        h: bh,
        margin: 0,
        fontFace: F.head,
        fontSize: 16,
        bold: true,
        color: C.white,
        align: 'center',
        valign: 'middle',
      });
      cx += w;
    });

    order.forEach((k, i) => {
      const x = 0.6 + i * 2.0;
      const y = by + bh + 0.25;
      s.addShape(pptx.ShapeType.ellipse, {
        x,
        y: y + 0.06,
        w: 0.14,
        h: 0.14,
        fill: { color: (STATUS as any)[k].color },
        line: { color: (STATUS as any)[k].color, width: 0 },
      });
      s.addText(
        [
          { text: (STATUS as any)[k].label + '  ', options: { color: C.body } },
          { text: String(count(k)), options: { bold: true, color: C.ink } },
        ],
        {
          x: x + 0.22,
          y,
          w: 1.75,
          h: 0.26,
          margin: 0,
          fontFace: F.body,
          fontSize: 9.5,
          valign: 'middle',
        }
      );
    });

    // Busiest owner computation
    let busiestOwnerText = 'No open actions';
    if (open.length > 0) {
      const m: Record<string, number> = {};
      open.forEach((a) => {
        const o = short(a.owner);
        m[o] = (m[o] || 0) + 1;
      });
      const sorted = Object.entries(m).sort((x, y) => y[1] - x[1]);
      if (sorted.length > 0) {
        busiestOwnerText = `${sorted[0][0]}, ${sorted[0][1]} open action${sorted[0][1] === 1 ? '' : 's'}`;
      }
    }

    const nextDueText = nextUp[0]
      ? `${nextUp[0].title}, ${short(nextUp[0].owner)}, ${fmt(nextUp[0].due)}`
      : 'Nothing scheduled';

    const lastDateText = dated.length > 0 ? `${fmt(last)} ${exportYear}` : 'No dated actions';

    const notes: [string, string][] = [
      ['Next due', nextDueText],
      ['Busiest owner', busiestOwnerText],
      ['Last date on the timeline', lastDateText],
    ];

    notes.forEach(([k, v], i) => {
      const x = 0.6 + i * 4.11;
      const y = 3.75;
      s.addText(k.toUpperCase(), {
        x,
        y,
        w: 3.8,
        h: 0.26,
        margin: 0,
        fontFace: F.body,
        fontSize: 8.5,
        bold: true,
        color: C.goldDeep,
        charSpacing: 2,
      });
      s.addText(v, {
        x,
        y: y + 0.3,
        w: 3.8,
        h: 0.75,
        margin: 0,
        fontFace: F.head,
        fontSize: 14,
        bold: true,
        color: C.ink,
        valign: 'top',
        fit: 'none',
      });
    });

    s.addText(
      `Drawn from ${payload.source} on ${fmt(TODAY)} ${exportYear}. Check owners and dates before you share it.`,
      {
        x: 0.6,
        y: 5.3,
        w: 9,
        h: 0.3,
        margin: 0,
        fontFace: F.body,
        fontSize: 10,
        color: C.mute,
      }
    );

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, payload.project, assets.logo);
  }

  return { pptx, slideCount: TOTAL_SLIDES };
}
