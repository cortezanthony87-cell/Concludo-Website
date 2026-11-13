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
  slideNum: number,
  totalSlides: number,
  projectName: string,
  logoB64: string,
  lightTheme = false
) {
  const y = 6.92;
  const textColor = lightTheme ? 'A3B2C9' : C.mute;
  const numColor = lightTheme ? 'E2E8F0' : C.ink;

  // Footer label in all caps
  const cleanProject = sanitizeTimelineText(projectName || 'Actions').toUpperCase();
  s.addText(cleanProject, {
    x: 0.6,
    y,
    w: 8.5,
    h: 0.28,
    margin: 0,
    fontFace: 'Inter',
    fontSize: 7.5,
    bold: true,
    color: textColor,
    charSpacing: 2,
    valign: 'middle',
  });

  // Centred Concludo lockup logo
  if (logoB64) {
    const lh = 0.22;
    s.addImage({
      data: logoB64,
      x: W / 2 - (lh * LOGO_ASPECT) / 2,
      y: y + 0.03,
      w: lh * LOGO_ASPECT,
      h: lh,
      altText: 'Concludo',
    });
  }

  // Running slide number: 01 / 06
  const numStr = `${String(slideNum).padStart(2, '0')} / ${String(totalSlides).padStart(2, '0')}`;
  s.addText(numStr, {
    x: W - 0.6 - 1.8,
    y,
    w: 1.8,
    h: 0.28,
    margin: 0,
    fontFace: 'Inter',
    fontSize: 8.5,
    bold: true,
    color: numColor,
    align: 'right',
    charSpacing: 2,
    valign: 'middle',
  });
}

function drawHeading(s: any, kicker: string, title: string, w = 11.5) {
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

  const isMeeting = !!payload.isMeetingMode;
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

  // Resolve slides to build
  const activeSlides = payload.activeSlides || (isMeeting
    ? ['cover', 'road', 'weeks', 'horizon', 'attention', 'nextMeeting']
    : ['cover', 'road', 'weeks', 'horizon', 'attention', 'progress']);

  const includeCover = activeSlides.includes('cover');
  const includeRoad = activeSlides.includes('road');
  const includeWeeks = activeSlides.includes('weeks');
  const includeHorizon = activeSlides.includes('horizon');
  const includeAttention = activeSlides.includes('attention') && (isMeeting ? acts.some((a) => !a.due) : true);
  const includeNextMeeting = isMeeting && activeSlides.includes('nextMeeting') && !!payload.nextMeeting?.date;
  const includeProgress = !isMeeting && activeSlides.includes('progress');

  const weeksSlideCount = includeWeeks ? Math.max(1, assigneeChunks.length) : 0;
  const TOTAL_SLIDES =
    (includeCover ? 1 : 0) +
    (includeRoad ? 1 : 0) +
    weeksSlideCount +
    (includeHorizon ? 1 : 0) +
    (includeAttention ? 1 : 0) +
    (includeNextMeeting ? 1 : 0) +
    (includeProgress ? 1 : 0);

  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.author = 'Concludo';
  pptx.company = 'Concludo';
  const docTitle = isMeeting
    ? `Action timeline: ${payload.shortProject || payload.project} - ${payload.meetingTitle || 'Meeting'}`
    : `Action timeline: ${payload.project}`;

  const footerLabel = isMeeting && payload.meetingTitle && !payload.project.toLowerCase().includes(payload.meetingTitle.toLowerCase())
    ? `${payload.project}: ${payload.meetingTitle}`
    : payload.project;
  pptx.title = docTitle;

  let currentSlideNum = 1;

  // ----------------------------------------------------
  // 1. Cover Slide
  // ----------------------------------------------------
  if (includeCover) {
    const s = pptx.addSlide();
    s.background = { data: assets.cover };

    // Top logo
    if (assets.logo) {
      const lh = 0.32;
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

    s.addText(payload.shortProject || payload.project, {
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

    const coverSubtitle = isMeeting
      ? (payload.meetingTitle || 'Meeting output')
      : (payload.project && payload.project.includes(':')
        ? payload.project.split(':')[1].trim() + ': every open action, on one road'
        : `${acts.length} action${acts.length === 1 ? '' : 's'} from ${payload.source}`);

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
        : `${fmt(first, false)} to ${fmt(payload.nextMeeting?.date || last, false)} ${exportYear}`;

    const meetingDateStr = payload.meetingDate ? fmt(payload.meetingDate) : fmt(TODAY);
    const datelineText = isMeeting
      ? `${dateRangeStr}   |   From the meeting on ${meetingDateStr} ${exportYear}   |   ${payload.timezone.replace('_', ' ')}`
      : `${dateRangeStr}   |   Exported ${fmt(TODAY)} ${exportYear}   |   ${payload.timezone.replace('_', ' ')}`;

    s.addText(datelineText, {
      x: 0.6,
      y: 3.36,
      w: 9.5,
      h: 0.3,
      margin: 0,
      fontFace: F.body,
      fontSize: 10.5,
      color: C.mute,
    });

    if (isMeeting) {
      // Meeting mode KPIs: [Dated actions] [Date to be agreed] [Next meeting (if present)]
      const datedCount = dated.length;
      const undatedCount = acts.length - datedCount;
      const meetingKpis: [string | number, string][] = [
        [datedCount, 'Dated actions'],
        [undatedCount, 'Date to be agreed'],
      ];
      if (payload.nextMeeting?.date) {
        meetingKpis.push([fmt(payload.nextMeeting.date, false), 'Next meeting']);
      }

      meetingKpis.forEach(([val, label], i) => {
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

        s.addText(String(val), {
          x,
          y: y + 0.12,
          w: 1.48,
          h: 0.45,
          margin: 0,
          fontFace: F.head,
          fontSize: typeof val === 'string' && val.length > 4 ? 20 : 28,
          bold: true,
          color: C.ink,
          align: 'center',
          valign: 'middle',
        });

        s.addText(label, {
          x: x + 0.08,
          y: y + 0.58,
          w: 1.32,
          h: 0.32,
          margin: 0,
          fontFace: F.body,
          fontSize: 10,
          color: C.mute,
          align: 'center',
          valign: 'top',
        });
      });

      s.addText(`${acts.length} open action${acts.length === 1 ? '' : 's'} agreed in the meeting`, {
        x: 0.6,
        y: 5.12,
        w: 8,
        h: 0.3,
        margin: 0,
        fontFace: F.body,
        fontSize: 12,
        color: C.body,
      });
    } else {
      // Hub KPIs (5 status cards)
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
          y: y + 0.16,
          w: 0.28,
          h: 0.04,
          fill: { color: (STATUS as any)[k].color },
          line: { color: (STATUS as any)[k].color, width: 0 },
        });

        s.addText(String(n), {
          x,
          y: y + 0.22,
          w: 1.48,
          h: 0.45,
          margin: 0,
          fontFace: F.head,
          fontSize: 28,
          bold: true,
          color: C.ink,
          align: 'center',
          valign: 'middle',
        });

        s.addText((STATUS as any)[k].label, {
          x: x + 0.08,
          y: y + 0.68,
          w: 1.32,
          h: 0.26,
          margin: 0,
          fontFace: F.body,
          fontSize: 9.5,
          color: C.mute,
          align: 'center',
          valign: 'top',
        });
      });

      s.addText(`${open.length} open action${open.length === 1 ? '' : 's'} in total`, {
        x: 0.6,
        y: 5.12,
        w: 8,
        h: 0.3,
        margin: 0,
        fontFace: F.body,
        fontSize: 12,
        color: C.body,
      });
    }

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo);
  }

  // ----------------------------------------------------
  // 2. The Road Ahead
  // ----------------------------------------------------
  if (includeRoad) {
    const s = pptx.addSlide();
    s.background = { data: assets.roadmap };
    const roadTitle = isMeeting ? 'What happens next, in order' : 'Next six actions';
    drawHeading(s, 'The road ahead', roadTitle);

    const xs = [0.85, 2.9, 4.95, 7.0, 9.05, 11.05];
    const STEM = 2.45;

    const hasNextMeet = isMeeting && !!payload.nextMeeting?.date;
    const maxRoadActions = hasNextMeet ? 4 : 6;
    const roadActions = (isMeeting ? dated : nextUp).slice(0, maxRoadActions);

    roadActions.forEach((a, i) => {
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
      s.addText(`${short(a.owner)}  |  ${a.priority || 'Medium'}`, {
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

    // If next meeting milestone is present, draw it at position xs[roadActions.length] or xs[5]
    if (hasNextMeet) {
      const meetX = xs[Math.min(roadActions.length, 5)];
      const meetRy = yAtX(ROAD_MAP, meetX);
      const meetPinY = meetRy - STEM;
      const goldCol = C.goldDeep;

      s.addShape(pptx.ShapeType.line, {
        x: meetX,
        y: meetPinY + 0.25,
        w: 0,
        h: STEM - 0.25,
        line: { color: goldCol, width: 2 },
      });
      s.addShape(pptx.ShapeType.ellipse, {
        x: meetX - 0.11,
        y: meetRy - 0.11,
        w: 0.22,
        h: 0.22,
        fill: { color: goldCol },
        line: { color: C.white, width: 2 },
        shadow: SHADOW,
      });
      s.addShape(pptx.ShapeType.ellipse, {
        x: meetX - 0.29,
        y: meetPinY - 0.29,
        w: 0.58,
        h: 0.58,
        fill: { color: goldCol },
        line: { color: C.white, width: 2.5 },
        shadow: SHADOW,
      });
      s.addText('MEET', {
        x: meetX - 0.29,
        y: meetPinY - 0.29,
        w: 0.58,
        h: 0.58,
        margin: 0,
        fontFace: F.head,
        fontSize: 9.5,
        bold: true,
        color: C.white,
        align: 'center',
        valign: 'middle',
      });

      const mlx = meetX + 0.2;
      drawChip(s, mlx, meetPinY + 0.36, fmt(payload.nextMeeting!.date), goldCol, 1.15);
      s.addText('Next meeting', {
        x: mlx,
        y: meetPinY + 0.68,
        w: 1.8,
        h: 0.32,
        margin: 0,
        fontFace: F.head,
        fontSize: 11,
        bold: true,
        color: C.ink,
        valign: 'top',
      });
      if (payload.nextMeeting!.time) {
        s.addText(payload.nextMeeting!.time, {
          x: mlx,
          y: meetPinY + 1.02,
          w: 1.8,
          h: 0.24,
          margin: 0,
          fontFace: F.body,
          fontSize: 8.5,
          color: C.mute,
        });
      }
    }

    if (isMeeting) {
      const undatedCount = acts.filter((a) => !a.due).length;
      if (undatedCount > 0) {
        s.addText(
          [
            { text: 'From the meeting record', options: { bold: true, color: C.ink, breakLine: true } },
            {
              text: `${undatedCount} action has no date yet; see the slides that follow.`,
              options: { color: C.body },
            },
          ],
          {
            x: 7.2,
            y: 5.2,
            w: 5.5,
            h: 0.85,
            margin: 0,
            fontFace: F.body,
            fontSize: 10,
            valign: 'top',
          }
        );
      }
    } else {
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
    }

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo);
  }

  // ----------------------------------------------------
  // 3. Week by Week
  // ----------------------------------------------------
  if (includeWeeks) {
    let startMonday: Date;
    let WEEKS_COUNT = 7;

    if (isMeeting && payload.meetingDate) {
      // In meeting mode, start on the Monday of the meeting week
      const mDateUtc = d(payload.meetingDate);
      const dayOfWeek = mDateUtc.getUTCDay();
      const daysToMonday = (dayOfWeek + 6) % 7;
      startMonday = new Date(mDateUtc.getTime() - daysToMonday * DAY);

      // Determine span up to next meeting or latest action
      const endDates = acts.filter((a) => a.due).map((a) => a.due!);
      if (payload.nextMeeting?.date) endDates.push(payload.nextMeeting.date);
      endDates.sort();
      const lastDate = endDates.length > 0 ? endDates[endDates.length - 1] : payload.meetingDate;
      const lastDateUtc = d(lastDate);
      const lastDaysToMonday = (lastDateUtc.getUTCDay() + 6) % 7;
      const endMonday = new Date(lastDateUtc.getTime() - lastDaysToMonday * DAY);

      const spanWeeks = Math.round((endMonday.getTime() - startMonday.getTime()) / (7 * DAY)) + 1;
      WEEKS_COUNT = Math.max(4, Math.min(7, spanWeeks + 1));
    } else {
      startMonday = calculateStartMondayOfWeekBefore(TODAY);
      WEEKS_COUNT = 7;
    }
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
      const lg = isMeeting ? ['upcoming'] : ['completed', 'overdue', 'today', 'upcoming'];
      lg.forEach((k, i) => {
        const lx = W - 0.6 - (lg.length - i) * 1.15;
        s.addShape(pptx.ShapeType.ellipse, {
          x: lx,
          y: 0.48,
          w: 0.12,
          h: 0.12,
          fill: { color: (STATUS as any)[k].color },
          line: { color: (STATUS as any)[k].color, width: 0 },
        });
        s.addText((STATUS as any)[k].label, {
          x: lx + 0.18,
          y: 0.43,
          w: 0.95,
          h: 0.22,
          margin: 0,
          fontFace: F.body,
          fontSize: 8.5,
          color: C.mute,
          valign: 'middle',
        });
      });

      // Grid background card
      const totalGridH = headH + chunkOwners.length * laneH;
      s.addShape(pptx.ShapeType.roundRect, {
        x: gx,
        y: gy,
        w: gw,
        h: totalGridH,
        rectRadius: 0.12,
        fill: { color: C.white },
        line: { color: C.hair, width: 0.75 },
        shadow: SHADOW,
      });

      // Week headers
      for (let c = 0; c < WEEKS_COUNT; c++) {
        const colMonday = new Date(startMonday.getTime() + c * 7 * DAY);
        const colMondayIso = colMonday.toISOString().slice(0, 10);
        const colX = gx + c * colW;

        if (c > 0) {
          s.addShape(pptx.ShapeType.line, {
            x: colX,
            y: gy,
            w: 0,
            h: totalGridH,
            line: { color: C.hair, width: 0.5 },
          });
        }

        s.addText(`Week of ${colMonday.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' })}`, {
          x: colX,
          y: gy + 0.1,
          w: colW,
          h: 0.24,
          margin: 0,
          fontFace: F.body,
          fontSize: 8,
          color: C.mute,
          align: 'center',
          valign: 'middle',
        });

        // Meeting flag
        if (isMeeting && payload.meetingDate) {
          const mDate = payload.meetingDate.slice(0, 10);
          const nextMondayIso = new Date(colMonday.getTime() + 7 * DAY).toISOString().slice(0, 10);
          if (mDate >= colMondayIso && mDate < nextMondayIso) {
            s.addText(`Meeting, ${fmt(mDate, false)}`, {
              x: colX + 0.1,
              y: gy - 0.28,
              w: colW - 0.2,
              h: 0.22,
              shape: 'roundRect',
              rectRadius: 0.11,
              fill: { color: C.gold },
              color: C.ink,
              fontFace: F.body,
              fontSize: 8,
              bold: true,
              align: 'center',
              valign: 'middle',
            });
          }
        }

        // Next meeting flag
        if (isMeeting && payload.nextMeeting?.date) {
          const nmDate = payload.nextMeeting.date.slice(0, 10);
          const nextMondayIso = new Date(colMonday.getTime() + 7 * DAY).toISOString().slice(0, 10);
          if (nmDate >= colMondayIso && nmDate < nextMondayIso) {
            s.addText(`Next meeting, ${fmt(nmDate, false)}`, {
              x: colX + 0.1,
              y: gy + totalGridH + 0.06,
              w: colW - 0.2,
              h: 0.22,
              shape: 'roundRect',
              rectRadius: 0.11,
              fill: { color: C.goldDeep },
              color: C.white,
              fontFace: F.body,
              fontSize: 8,
              bold: true,
              align: 'center',
              valign: 'middle',
            });
          }
        }
      }

      // Horizontal dividers
      s.addShape(pptx.ShapeType.line, {
        x: gx,
        y: gy + headH,
        w: gw,
        h: 0,
        line: { color: C.hair, width: 0.75 },
      });

      // Lanes
      chunkOwners.forEach((ownerName, laneIdx) => {
        const laneY = gy + headH + laneIdx * laneH;
        if (laneIdx > 0) {
          s.addShape(pptx.ShapeType.line, {
            x: gx,
            y: laneY,
            w: gw,
            h: 0,
            line: { color: C.hair, width: 0.5 },
          });
        }

        // Assignee avatar and name
        const initials = ownerName
          .split(' ')
          .map((p) => p[0])
          .slice(0, 2)
          .join('')
          .toUpperCase();

        s.addShape(pptx.ShapeType.ellipse, {
          x: 0.6,
          y: laneY + 0.2,
          w: 0.48,
          h: 0.48,
          fill: { color: C.navy },
          line: { color: C.navy, width: 0 },
        });

        s.addText(initials || 'UN', {
          x: 0.6,
          y: laneY + 0.2,
          w: 0.48,
          h: 0.48,
          margin: 0,
          fontFace: F.head,
          fontSize: 10,
          bold: true,
          color: C.white,
          align: 'center',
          valign: 'middle',
        });

        s.addText(clip(ownerName, 18), {
          x: 1.18,
          y: laneY + 0.24,
          w: 0.98,
          h: 0.4,
          margin: 0,
          fontFace: F.body,
          fontSize: 10,
          bold: true,
          color: C.ink,
          valign: 'middle',
        });

        // Actions in lane
        const ownerActions = acts.filter((a) => short(a.owner) === ownerName && a.due);
        ownerActions.forEach((a) => {
          const ad = d(a.due!);
          const diffDays = Math.floor((ad.getTime() - startMonday.getTime()) / DAY);
          const colIndex = Math.floor(diffDays / 7);

          if (colIndex >= 0 && colIndex < WEEKS_COUNT) {
            const dayInWeek = diffDays % 7;
            const cardX = gx + colIndex * colW + 0.08 + (dayInWeek / 7) * (colW - 1.35);
            const cardY = laneY + 0.15;
            const cardW = 1.25;
            const cardH = laneH - 0.3;
            const col = (STATUS as any)[a.b || 'upcoming'].color;

            s.addShape(pptx.ShapeType.roundRect, {
              x: cardX,
              y: cardY,
              w: cardW,
              h: cardH,
              rectRadius: 0.08,
              fill: { color: tint(col, 0.12) },
              line: { color: tint(col, 0.45), width: 0.75 },
            });

            s.addShape(pptx.ShapeType.ellipse, {
              x: cardX + 0.08,
              y: cardY + 0.1,
              w: 0.1,
              h: 0.1,
              fill: { color: col },
              line: { color: col, width: 0 },
            });

            s.addText(fmt(a.due), {
              x: cardX + 0.22,
              y: cardY + 0.06,
              w: cardW - 0.26,
              h: 0.18,
              margin: 0,
              fontFace: F.body,
              fontSize: 7.5,
              bold: true,
              color: col,
              valign: 'middle',
            });

            s.addText(clip(a.title, 26), {
              x: cardX + 0.08,
              y: cardY + 0.26,
              w: cardW - 0.16,
              h: cardH - 0.3,
              margin: 0,
              fontFace: F.body,
              fontSize: 7.5,
              color: C.ink,
              valign: 'top',
              fit: 'none',
              lineSpacingMultiple: 0.95,
            });
          }
        });
      });

      drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo);
    });
  }

  // ----------------------------------------------------
  // 4. Milestones by Horizon
  // ----------------------------------------------------
  if (includeHorizon) {
    const s = pptx.addSlide();
    s.background = { data: assets.ridge };
    const horizonTitle = isMeeting
      ? 'From this week to what still needs a date'
      : 'From what slipped to what is next';
    drawHeading(s, 'Milestones by horizon', horizonTitle);

    const colW = (W - 1.2 - 0.6) / 4;
    const colY = 2.1;
    const colH = 3.6;

    let cols: { kicker: string; count: number; items: typeof acts }[] = [];

    if (isMeeting) {
      // 4 columns: This week, Next week, Later, No date yet
      const startMon = calculateStartMondayOfWeekBefore(payload.meetingDate ? payload.meetingDate : TODAY);
      const nextMon = new Date(startMon.getTime() + 14 * DAY);
      const thisWeekMonIso = new Date(startMon.getTime() + 7 * DAY).toISOString().slice(0, 10);
      const nextWeekMonIso = nextMon.toISOString().slice(0, 10);
      const afterNextMonIso = new Date(nextMon.getTime() + 7 * DAY).toISOString().slice(0, 10);

      const thisWeekActs = acts.filter((a) => a.due && a.due >= thisWeekMonIso && a.due < nextWeekMonIso);
      const nextWeekActs = acts.filter((a) => a.due && a.due >= nextWeekMonIso && a.due < afterNextMonIso);
      const laterActs = acts.filter((a) => a.due && a.due >= afterNextMonIso);
      const noDateActs = acts.filter((a) => !a.due);

      cols = [
        { kicker: 'This week', count: thisWeekActs.length, items: thisWeekActs },
        { kicker: 'Next week', count: nextWeekActs.length, items: nextWeekActs },
        { kicker: 'Later', count: laterActs.length, items: laterActs },
        { kicker: 'No date yet', count: noDateActs.length, items: noDateActs },
      ];
    } else {
      cols = [
        { kicker: 'Overdue', count: count('overdue'), items: acts.filter((a) => a.b === 'overdue') },
        { kicker: 'This week', count: count('today') + acts.filter((a) => a.b === 'upcoming' && a.due && a.due <= new Date(Date.now() + 7 * DAY).toISOString().slice(0, 10)).length, items: acts.filter((a) => a.b === 'today') },
        { kicker: 'Next week', count: acts.filter((a) => a.b === 'upcoming').length, items: acts.filter((a) => a.b === 'upcoming').slice(0, 5) },
        { kicker: 'Later', count: count('unscheduled'), items: acts.filter((a) => a.b === 'unscheduled').slice(0, 5) },
      ];
    }

    cols.forEach((col, i) => {
      const x = 0.6 + i * (colW + 0.2);

      s.addText(
        [
          { text: col.kicker, options: { bold: true, color: C.ink } },
          { text: `   ${col.count}`, options: { color: C.goldDeep, bold: true } },
        ],
        {
          x,
          y: colY,
          w: colW,
          h: 0.35,
          margin: 0,
          fontFace: F.head,
          fontSize: 14,
          valign: 'middle',
        }
      );

      s.addShape(pptx.ShapeType.line, {
        x,
        y: colY + 0.45,
        w: colW,
        h: 0,
        line: { color: C.hair, width: 1 },
      });

      const itemsToShow = col.items.slice(0, 4);
      if (itemsToShow.length === 0) {
        s.addText('Nothing here', {
          x,
          y: colY + 0.6,
          w: colW,
          h: 0.3,
          margin: 0,
          fontFace: F.body,
          fontSize: 9.5,
          color: C.mute,
        });
      } else {
        itemsToShow.forEach((a, j) => {
          const itemY = colY + 0.6 + j * 0.72;
          s.addText(clip(a.title, 55), {
            x,
            y: itemY,
            w: colW,
            h: 0.4,
            margin: 0,
            fontFace: F.body,
            fontSize: 9,
            bold: true,
            color: C.ink,
            valign: 'top',
            fit: 'none',
          });

          const sub = a.due
            ? `${short(a.owner).split(' ')[0]}, ${fmt(a.due)}`
            : `${short(a.owner).split(' ')[0]}, date to be agreed`;

          s.addText(sub, {
            x,
            y: itemY + 0.42,
            w: colW,
            h: 0.22,
            margin: 0,
            fontFace: F.body,
            fontSize: 8,
            color: C.mute,
          });
        });
      }
    });

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo, false);
  }

  // ----------------------------------------------------
  // 5. Needs Attention
  // ----------------------------------------------------
  if (includeAttention) {
    const s = pptx.addSlide();
    s.background = { data: assets.attention };
    const attentionTitle = isMeeting
      ? 'Still without a date or an owner'
      : 'Overdue, and still without a date';
    drawHeading(s, 'Needs attention', attentionTitle);

    const undatedActs = acts.filter((a) => !a.due);
    const cardW = isMeeting ? 10.5 : 5.8;
    const cardX = 0.6;
    const cardY = 2.0;

    s.addShape(pptx.ShapeType.roundRect, {
      x: cardX,
      y: cardY,
      w: cardW,
      h: 3.8,
      rectRadius: 0.16,
      fill: { color: C.white },
      line: { color: C.hair, width: 0.75 },
      shadow: SHADOW,
    });

    s.addText(
      [
        { text: 'No date yet ', options: { bold: true, color: C.ink } },
        { text: ` ${undatedActs.length}`, options: { bold: true, color: C.mute } },
      ],
      {
        x: cardX + 0.35,
        y: cardY + 0.3,
        w: cardW - 0.7,
        h: 0.35,
        margin: 0,
        fontFace: F.head,
        fontSize: 16,
      }
    );

    s.addText('Agree a date at the next meeting, or set one in the Action Command Hub.', {
      x: cardX + 0.35,
      y: cardY + 0.7,
      w: cardW - 0.7,
      h: 0.26,
      margin: 0,
      fontFace: F.body,
      fontSize: 9.5,
      color: C.mute,
    });

    undatedActs.slice(0, 3).forEach((a, j) => {
      const iy = cardY + 1.15 + j * 0.8;
      s.addShape(pptx.ShapeType.roundRect, {
        x: cardX + 0.35,
        y: iy,
        w: cardW - 0.7,
        h: 0.68,
        rectRadius: 0.08,
        fill: { color: C.light },
        line: { color: C.hair, width: 0.5 },
      });

      s.addText(clip(a.title, 65), {
        x: cardX + 0.5,
        y: iy + 0.12,
        w: cardW - 2.8,
        h: 0.24,
        margin: 0,
        fontFace: F.head,
        fontSize: 10.5,
        bold: true,
        color: C.ink,
      });

      s.addText(`${a.id}  |  ${short(a.owner)}`, {
        x: cardX + 0.5,
        y: iy + 0.38,
        w: cardW - 2.8,
        h: 0.2,
        margin: 0,
        fontFace: F.body,
        fontSize: 8.5,
        color: C.mute,
      });

      drawChip(s, cardX + cardW - 2.1, iy + 0.2, 'Date to be agreed', C.mute, 1.4);
    });

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo);
  }

  // ----------------------------------------------------
  // 6. Before the Next Meeting (Slide 6 for meetings)
  // ----------------------------------------------------
  if (includeNextMeeting) {
    const s = pptx.addSlide();
    s.background = { data: assets.close };

    const nmDate = payload.nextMeeting?.date;
    const nmTime = payload.nextMeeting?.time || '';
    const nmTitle = nmDate ? `${fmt(nmDate)} ${exportYear}, ${nmTime}`.trim() : 'Next meeting';

    drawHeading(s, 'Before the next meeting', nmTitle);

    const colW = 3.8;
    const colGap = 0.35;
    const colY = 2.1;
    const colH = 3.6;

    // Col 1: DUE BEFORE IT
    const dueBeforeActions = acts.filter((a) => a.due && (!nmDate || a.due <= nmDate));
    const dueBeforeLines = dueBeforeActions.map((a) => `${fmt(a.due)}  ${clip(a.title, 42)}`);
    if (dueBeforeLines.length === 0) dueBeforeLines.push('No actions due before the next meeting');

    // Col 2: BRING THESE QUESTIONS
    const questions = payload.openQuestions || [];
    const questionLines = questions.length > 0 ? questions.map((q) => clip(q, 75)) : ['No open questions recorded'];

    // Col 3: STILL NEEDS A DATE
    const undated = acts.filter((a) => !a.due);
    const undatedLines = undated.length > 0 ? undated.map((a) => clip(a.title, 55)) : ['All actions are dated'];

    const cols: [string, string[]][] = [
      ['DUE BEFORE IT', dueBeforeLines],
      ['BRING THESE QUESTIONS', questionLines],
      ['STILL NEEDS A DATE', undatedLines],
    ];

    cols.forEach(([title, items], i) => {
      const x = 0.6 + i * (colW + colGap);

      s.addText(title, {
        x,
        y: colY,
        w: colW,
        h: 0.28,
        margin: 0,
        fontFace: F.body,
        fontSize: 9,
        bold: true,
        color: C.goldDeep,
        charSpacing: 2,
      });

      const bulletText = items.map((item) => `•  ${item}`).join('\n\n');
      s.addText(bulletText, {
        x,
        y: colY + 0.35,
        w: colW,
        h: colH - 0.4,
        margin: 0,
        fontFace: F.body,
        fontSize: 10,
        color: C.body,
        valign: 'top',
        lineSpacingMultiple: 1.1,
      });
    });

    const meetingDateStr = payload.meetingDate ? fmt(payload.meetingDate) : fmt(TODAY);
    s.addText(
      `Drawn from the reviewed record of the meeting on ${meetingDateStr} ${exportYear}. Check owners and dates before you share it.`,
      {
        x: 0.6,
        y: 5.85,
        w: 11,
        h: 0.3,
        margin: 0,
        fontFace: F.body,
        fontSize: 10,
        color: C.mute,
      }
    );

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo);
  }

  // ----------------------------------------------------
  // 6. Progress Slide (Hub mode)
  // ----------------------------------------------------
  if (includeProgress) {
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

    drawFooter(s, currentSlideNum++, TOTAL_SLIDES, footerLabel, assets.logo);
  }

  return { pptx, slideCount: TOTAL_SLIDES };
}
