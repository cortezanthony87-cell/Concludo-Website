// Concludo Action Timeline: one engine for two sources.
//   source 'hub'      Action Command Hub view (approved template, six slides).
//   source 'meeting'  A reviewed meeting record, built at the end of the meeting output (Pro and above).
// planTimeline() decides whether a timeline is needed and which slides it gets. It is pure and deterministic.
// renderTimeline() draws the plan with pptxgenjs. Decorative layers are fixed images; every word is a native, editable object.

// ---------- Brand ----------
const W = 13.333;
const C = { navy: '16263F', navy2: '21395C', gold: 'E2B53C', goldDeep: 'BC8A1C', white: 'FFFFFF', ink: '16263F', body: '3C4A63', mute: '6B778C', hair: 'DCE2EC' };
export const STATUS = {
  completed: { label: 'Completed', color: '1F9D6B' },
  overdue: { label: 'Overdue', color: 'E04F5F' },
  today: { label: 'Due today', color: 'E2B53C' },
  upcoming: { label: 'Upcoming', color: '3D7BE0' },
  unscheduled: { label: 'Date to be agreed', color: '8A94A6' },
  meeting: { label: 'Next meeting', color: 'BC8A1C' },
};
const F = { head: 'Poppins', body: 'Inter' };

// ---------- Dates ----------
const DAY = 86400000;
const d = (iso) => new Date(iso + 'T00:00:00Z');
const iso = (x) => x.toISOString().slice(0, 10);
const addDays = (s, n) => iso(new Date(d(s).getTime() + n * DAY));
const mondayOf = (s) => { const x = d(s); const dow = (x.getUTCDay() + 6) % 7; return addDays(s, -dow); };
export const fmt = (s, withDay = true) => {
  const x = d(s);
  const wd = x.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' });
  const dm = x.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return withDay ? `${wd} ${dm}` : dm;
};
const clean = (t) => String(t || '').replace(/\s*[–—]\s*/g, ', ').trim();
const clip = (t, n) => { t = clean(t); return t.length <= n ? t : t.slice(0, t.lastIndexOf(' ', n - 1)) + '…'; };
const ownerText = (o) => (o ? o : 'Owner to be agreed');
const firstName = (o) => (o ? o.split(' ')[0] : 'Unassigned');

/**
 * @typedef {{id:string,title:string,owner:string|null,due:string|null,status:'open'|'in_progress'|'completed',priority?:string|null}} TAction
 * @typedef {{source:'hub'|'meeting', title:string, subtitle:string, refDate:string, timezone:string, actions:TAction[],
 *   nextMeeting?:{date:string,timeLabel?:string|null}|null, openQuestions?:{id:string,text:string,resolver:string|null}[], sourceLabel:string}} TimelineInput
 */

// ---------- Adapters ----------
/** A reviewed meeting record (Meeting Output v2 / MeetingRecord v1 shape). Only confirmed items go in. */
export function fromMeetingRecord(r, opts = {}) {
  const ok = (id) => !opts.review || opts.review[id] === 'confirmed';
  const stated = (p) => (p && p.status === 'stated' && p.name ? p.name : null);
  return {
    source: 'meeting',
    title: r.meeting.client_or_project ? `${r.meeting.client_or_project}` : r.meeting.title,
    subtitle: r.meeting.title,
    refDate: r.meeting.date,
    timezone: opts.timezone || 'Australia/Melbourne',
    sourceLabel: `the meeting on ${fmt(r.meeting.date)} ${r.meeting.date.slice(0, 4)}`,
    actions: r.actions.filter((a) => ok(a.id)).map((a) => ({
      id: a.id, title: a.action, owner: stated(a.owner),
      due: (a.due_date_status ?? 'stated') === 'stated' && a.due_date && a.due_date >= r.meeting.date ? a.due_date : null,
      status: 'open', priority: null,
    })),
    nextMeeting: opts.nextMeeting || null,
    openQuestions: (r.open_questions || []).filter((q) => ok(q.id)).map((q) => ({ id: q.id, text: q.question, resolver: stated(q.expected_resolver) })),
  };
}

// ---------- Plan: is a timeline needed, and which slides ----------
export const RULES = {
  minMilestones: 2,      // dated actions plus a dated next meeting
  minDatedActions: 1,    // a next meeting alone is not a timeline
  weekGridMinDated: 3,   // or two or more owners among dated actions
  roadPins: 6,
  lanesPerSlide: 5,
};

/** @param {TimelineInput} input */
export function planTimeline(input) {
  const ref = input.refDate;
  const bucket = (a) => {
    if (a.status === 'completed') return 'completed';
    if (!a.due) return 'unscheduled';
    if (a.due < ref) return 'overdue';
    if (a.due === ref) return 'today';
    return 'upcoming';
  };
  const acts = input.actions.map((a) => ({ ...a, title: clean(a.title), b: bucket(a) }));
  const open = acts.filter((a) => a.b !== 'completed');
  const dated = acts.filter((a) => a.due).sort((x, y) => x.due.localeCompare(y.due) || x.id.localeCompare(y.id));
  const openDated = open.filter((a) => a.due).sort((x, y) => x.due.localeCompare(y.due) || x.id.localeCompare(y.id));
  const undated = open.filter((a) => !a.due);
  const unowned = open.filter((a) => !a.owner);
  const nm = input.nextMeeting && input.nextMeeting.date && input.nextMeeting.date >= ref ? input.nextMeeting : null;
  const milestones = openDated.length + (nm ? 1 : 0);
  const distinct = new Set([...openDated.map((a) => a.due), ...(nm ? [nm.date] : [])]).size;
  const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, acts.filter((a) => a.b === k).length]));

  // Eligibility, meeting source only. The hub always builds when it has at least one action.
  let eligible = true, reason = null, code = 'ok';
  if (input.source === 'meeting') {
    if (open.length === 0) { eligible = false; code = 'no_actions'; reason = 'No actions were agreed in this meeting, so there is nothing to put on a timeline.'; }
    else if (openDated.length < RULES.minDatedActions) { eligible = false; code = 'no_dates'; reason = `${open.length} ${open.length === 1 ? 'action was' : 'actions were'} agreed, but none has a date. Add dates during review to build a timeline.`; }
    else if (milestones < RULES.minMilestones || distinct < 2) { eligible = false; code = 'one_date'; reason = 'Only one dated item came out of this meeting. A timeline needs at least two dates.' + (open.length > openDated.length ? ' Add a date to another action during review to build one.' : ''); }
  } else if (acts.length === 0) { eligible = false; code = 'no_actions'; reason = 'No actions in this view.'; }

  const slides = [];
  if (eligible) {
    slides.push({ kind: 'cover' });
    // Road: next dated open actions; a dated next meeting takes the last free pin.
    const roadItems = (input.source === 'meeting' ? openDated : openDated.filter((a) => a.due >= ref)).slice(0, RULES.roadPins).map((a) => ({ ...a }));
    if (nm && input.source === 'meeting' && roadItems.length < RULES.roadPins) roadItems.push({ id: 'NM', title: 'Next meeting', owner: null, due: nm.date, b: 'meeting', timeLabel: nm.timeLabel || null });
    slides.push({ kind: 'road', items: roadItems, more: Math.max(0, openDated.length - RULES.roadPins) });
    // Week by week
    const owners = [...new Set(dated.map((a) => a.owner || 'Owner to be agreed'))];
    if (input.source === 'hub' || openDated.length >= RULES.weekGridMinDated || owners.length >= 2) {
      const start = input.source === 'hub' ? addDays(mondayOf(ref), -7) : mondayOf(ref);
      const lastDue = [...dated.map((a) => a.due), ...(nm ? [nm.date] : [])].sort().pop();
      const weeks = Math.min(7, Math.max(4, Math.ceil((d(lastDue) - d(start)) / DAY / 7) + 1));
      const counted = owners.map((o) => [o, dated.filter((a) => (a.owner || 'Owner to be agreed') === o).length]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([o]) => o);
      for (let i = 0; i < counted.length; i += RULES.lanesPerSlide) slides.push({ kind: 'weeks', start, weeks, owners: counted.slice(i, i + RULES.lanesPerSlide), part: Math.floor(i / RULES.lanesPerSlide) + 1, parts: Math.ceil(counted.length / RULES.lanesPerSlide) });
    }
    // Horizon columns
    const endWeek = addDays(mondayOf(ref), 6), endNext = addDays(endWeek, 7);
    const cols = input.source === 'hub'
      ? [{ k: 'overdue', title: 'Overdue', items: open.filter((a) => a.b === 'overdue') },
         { k: 'today', title: 'This week', items: open.filter((a) => a.due && a.due >= ref && a.due <= endWeek) },
         { k: 'upcoming', title: 'Next week', items: open.filter((a) => a.due && a.due > endWeek && a.due <= endNext) },
         { k: 'upcoming', title: 'Later', items: open.filter((a) => a.due && a.due > endNext) }]
      : [{ k: 'today', title: 'This week', items: openDated.filter((a) => a.due <= endWeek) },
         { k: 'upcoming', title: 'Next week', items: openDated.filter((a) => a.due > endWeek && a.due <= endNext) },
         { k: 'upcoming', title: 'Later', items: openDated.filter((a) => a.due > endNext) },
         { k: 'unscheduled', title: 'No date yet', items: undated }];
    if (cols.filter((c) => c.items.length).length >= 2) slides.push({ kind: 'horizon', cols });
    // Needs attention
    if (input.source === 'hub') {
      const overdue = open.filter((a) => a.b === 'overdue');
      if (overdue.length || undated.length) slides.push({ kind: 'attention', cards: [
        { k: 'overdue', title: 'Overdue', items: overdue, badge: (a) => `${Math.round((d(ref) - d(a.due)) / DAY)} days overdue`, next: 'Next step: agree a new date with each owner.' },
        { k: 'unscheduled', title: 'No date yet', items: undated, badge: () => 'Date to be agreed', next: 'Next step: give each one an owner and a date.' }].filter((c) => c.items.length) });
      slides.push({ kind: 'progress' });
    } else {
      if (undated.length || unowned.length) slides.push({ kind: 'attention', cards: [
        { k: 'unscheduled', title: 'No date yet', items: undated, badge: () => 'Date to be agreed', next: 'Agree a date at the next meeting, or set one in the Action Command Hub.' },
        { k: 'overdue', title: 'No owner yet', items: unowned, badge: () => 'Owner to be agreed', next: 'Name an owner so it can be tracked.' }].filter((c) => c.items.length) });
      if (nm) slides.push({ kind: 'nextMeeting', nm, before: openDated.filter((a) => a.due <= nm.date), questions: input.openQuestions || [] });
    }
  }
  return { eligible, code, reason, slides, acts, open, dated, openDated, undated, counts, nm, refDate: ref };
}

// ---------- Render ----------
const ROAD_MAP = [{ x: -0.5, y: 6.6 }, { x: 4.4, y: 6.45 }, { x: 8.6, y: 4.35 }, { x: 13.9, y: 2.55 }];
const ROAD_COVER = [{ x: -0.6, y: 6.75 }, { x: 4.8, y: 6.55 }, { x: 9.6, y: 5.3 }, { x: 13.95, y: 2.6 }];
const COLS_X = [0.6, 3.75, 6.9, 10.05];
const bez = (p, t) => { const u = 1 - t; return { x: u*u*u*p[0].x + 3*u*u*t*p[1].x + 3*u*t*t*p[2].x + t*t*t*p[3].x, y: u*u*u*p[0].y + 3*u*u*t*p[1].y + 3*u*t*t*p[2].y + t*t*t*p[3].y }; };
const yAtX = (p, x) => { let lo = 0, hi = 1; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (bez(p, m).x < x) lo = m; else hi = m; } return bez(p, (lo + hi) / 2).y; };
const tint = (hex, a) => { const n = parseInt(hex, 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; const m = (c) => Math.round(c + (255 - c) * (1 - a)).toString(16).padStart(2, '0'); return (m(r) + m(g) + m(b)).toUpperCase(); };
const shadow = () => ({ type: 'outer', blur: 6, offset: 2, angle: 90, color: '16263F', opacity: 0.18 });

/**
 * @param PptxGenJS pptxgenjs constructor
 * @param {TimelineInput} input
 * @param {ReturnType<typeof planTimeline>} plan
 * @param {{bg:Record<string,string>, logo:string, logoAspect:number}} assets  file paths or data URLs
 */
export function renderTimeline(PptxGenJS, input, plan, assets) {
  if (!plan.eligible) throw new Error('Timeline not eligible: ' + plan.code);
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE'; pptx.author = 'Concludo'; pptx.company = 'Concludo';
  pptx.title = `Action timeline: ${input.title}`;
  const img = (s) => (s.startsWith('data:') ? { data: s } : { path: s });
  const TOTAL = plan.slides.length;
  const footerName = (input.source === 'meeting' && input.subtitle && input.subtitle !== input.title ? `${input.title}: ${input.subtitle}` : input.title).toUpperCase();
  const footer = (s, n, light) => {
    const col = light ? 'C9D5EA' : C.mute;
    s.addText(clip(footerName, 70), { x: 0.6, y: 7.02, w: 7.5, h: 0.26, margin: 0, fontFace: F.body, fontSize: 8, bold: true, color: col, charSpacing: 1.5, valign: 'middle' });
    s.addText(`${String(n).padStart(2, '0')} / ${String(TOTAL).padStart(2, '0')}`, { x: W - 1.8, y: 7.02, w: 1.2, h: 0.26, margin: 0, fontFace: F.body, fontSize: 8, bold: true, color: col, align: 'right', charSpacing: 1.5, valign: 'middle' });
    if (!light) { const lh = 0.24; s.addImage({ ...img(assets.logo), x: W - 0.6 - 1.45 - lh * assets.logoAspect, y: 7.03, w: lh * assets.logoAspect, h: lh, altText: 'Concludo' }); }
  };
  const heading = (s, kicker, title, w = 7.4) => {
    s.addText(kicker.toUpperCase(), { x: 0.6, y: 0.42, w, h: 0.28, margin: 0, fontFace: F.body, fontSize: 9.5, bold: true, color: C.goldDeep, charSpacing: 3, valign: 'middle' });
    s.addText(title, { x: 0.6, y: 0.72, w, h: 0.75, margin: 0, fontFace: F.head, fontSize: 30, bold: true, color: C.ink, valign: 'top', fit: 'none' });
  };
  const chip = (s, x, y, text, color, w) => s.addText(text, { x, y, w, h: 0.26, margin: [0, 6, 0, 6], shape: 'roundRect', rectRadius: 0.13, fill: { color }, color: C.white, fontFace: F.body, fontSize: 8.5, bold: true, align: 'center', valign: 'middle' });
  const ref = plan.refDate;
  const datedAll = plan.openDated;
  const first = [...plan.dated.map((a) => a.due), ...(plan.nm ? [plan.nm.date] : [])].sort()[0];
  const last = [...plan.dated.map((a) => a.due), ...(plan.nm ? [plan.nm.date] : [])].sort().pop();

  plan.slides.forEach((sl, idx) => {
    const n = idx + 1;
    const s = pptx.addSlide();
    if (sl.kind === 'cover') {
      s.background = img(assets.bg.cover);
      const lh = 0.46; s.addImage({ ...img(assets.logo), x: 0.6, y: 0.45, w: lh * assets.logoAspect, h: lh, altText: 'Concludo' });
      s.addText('ACTION TIMELINE', { x: 0.6, y: 1.62, w: 8, h: 0.3, margin: 0, fontFace: F.body, fontSize: 11, bold: true, color: C.goldDeep, charSpacing: 4 });
      s.addText(clip(input.title, 34), { x: 0.6, y: 1.95, w: 10.5, h: 0.95, margin: 0, fontFace: F.head, fontSize: 44, bold: true, color: C.ink, valign: 'top', fit: 'none' });
      s.addText(clip(input.subtitle, 80), { x: 0.6, y: 2.88, w: 10.5, h: 0.45, margin: 0, fontFace: F.body, fontSize: 17, color: C.body });
      s.addText(`${fmt(first, false)} to ${fmt(last, false)} ${last.slice(0, 4)}   |   ${input.source === 'meeting' ? 'From ' + input.sourceLabel : 'Exported ' + fmt(ref) + ' ' + ref.slice(0, 4)}   |   ${input.timezone.replace('_', ' ')}`, { x: 0.6, y: 3.36, w: 10.5, h: 0.3, margin: 0, fontFace: F.body, fontSize: 10.5, color: C.mute });
      const kp = input.source === 'meeting'
        ? [['upcoming', plan.openDated.length], ['unscheduled', plan.undated.length], ...(plan.nm ? [['meeting', fmt(plan.nm.date, false)]] : [])]
        : ['upcoming', 'today', 'overdue', 'unscheduled', 'completed'].map((k) => [k, plan.counts[k]]);
      kp.forEach(([k, v], i) => {
        const x = 0.6 + i * 1.62, y = 3.95;
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: 1.48, h: 1.0, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.hair, width: 0.75 }, shadow: shadow() });
        s.addShape(pptx.ShapeType.rect, { x: x + 0.16, y: y + 0.17, w: 0.36, h: 0.05, fill: { color: STATUS[k].color }, line: { color: STATUS[k].color, width: 0 } });
        s.addText(String(v), { x: x + 0.16, y: y + 0.25, w: 1.25, h: 0.45, margin: 0, fontFace: F.head, fontSize: typeof v === 'number' ? 24 : 18, bold: true, color: C.ink, valign: 'middle' });
        s.addText(input.source === 'meeting' && k === 'upcoming' ? 'Dated actions' : STATUS[k].label, { x: x + 0.16, y: y + 0.68, w: 1.25, h: 0.24, margin: 0, fontFace: F.body, fontSize: 9, color: C.mute, valign: 'middle' });
      });
      s.addText(`${plan.open.length} open ${plan.open.length === 1 ? 'action' : 'actions'}${input.source === 'meeting' ? ' agreed in the meeting' : ' in total'}`, { x: 0.6, y: 5.08, w: 5, h: 0.28, margin: 0, fontFace: F.body, fontSize: 10, bold: true, color: C.navy2 });
      const dots = datedAll.slice(0, 7).map((a) => a.b);
      dots.forEach((k, i) => { const x = 7.2 + i * 0.85, y = yAtX(ROAD_COVER, x), r = 0.13; s.addShape(pptx.ShapeType.ellipse, { x: x - r, y: y - r, w: r * 2, h: r * 2, fill: { color: STATUS[k].color }, line: { color: C.white, width: 2 }, shadow: shadow() }); });
      footer(s, n);
    }
    if (sl.kind === 'road') {
      s.background = img(assets.bg.roadmap);
      heading(s, 'The road ahead', input.source === 'meeting' ? (sl.items.length === 1 ? 'What happens next' : `What happens next, in order`) : 'Next six actions');
      const slots = [0.85, 2.9, 4.95, 7.0, 9.05, 11.05];
      const k = sl.items.length;
      const xs = k >= 6 ? slots : slots.slice(6 - k);
      sl.items.forEach((a, i) => {
        const x = xs[i], ry = yAtX(ROAD_MAP, x), col = STATUS[a.b === 'meeting' ? 'meeting' : a.b].color, pinY = ry - 2.45;
        s.addShape(pptx.ShapeType.line, { x, y: pinY + 0.25, w: 0, h: 2.2, line: { color: col, width: 2 } });
        s.addShape(pptx.ShapeType.ellipse, { x: x - 0.11, y: ry - 0.11, w: 0.22, h: 0.22, fill: { color: col }, line: { color: C.white, width: 2 }, shadow: shadow() });
        s.addShape(pptx.ShapeType.ellipse, { x: x - 0.29, y: pinY - 0.29, w: 0.58, h: 0.58, fill: { color: col }, line: { color: C.white, width: 2.5 }, shadow: shadow() });
        s.addText(a.b === 'meeting' ? 'MEET' : String(i + 1).padStart(2, '0'), { x: x - 0.29, y: pinY - 0.29, w: 0.58, h: 0.58, margin: 0, fontFace: F.head, fontSize: a.b === 'meeting' ? 8 : 13, bold: true, color: C.white, align: 'center', valign: 'middle' });
        const lx = x + 0.2;
        chip(s, lx, pinY + 0.36, fmt(a.due), col, 1.05);
        s.addText(clip(a.title, 46), { x: lx, y: pinY + 0.68, w: 1.8, h: 0.62, margin: 0, fontFace: F.head, fontSize: 11, bold: true, color: C.ink, valign: 'top', fit: 'none', lineSpacingMultiple: 0.95 });
        s.addText(a.b === 'meeting' ? (a.timeLabel || 'Time to be confirmed') : `${ownerText(a.owner)}${a.priority ? '  |  ' + a.priority : ''}`, { x: lx, y: pinY + 1.32, w: 1.8, h: 0.24, margin: 0, fontFace: F.body, fontSize: 8.5, color: C.mute });
      });
      const note = input.source === 'meeting'
        ? `${sl.more ? sl.more + ' more dated actions follow. ' : ''}${plan.undated.length ? plan.undated.length + (plan.undated.length === 1 ? ' action has' : ' actions have') + ' no date yet; see the slides that follow.' : 'Every action from the meeting has a date.'}`
        : `After these six, ${sl.more} actions run on. ${plan.counts.overdue} are overdue and ${plan.counts.unscheduled} have no date yet.`;
      s.addText([{ text: input.source === 'meeting' ? 'From the meeting record' : `${sl.more} more upcoming`, options: { bold: true, color: C.ink, breakLine: true } }, { text: note, options: { color: C.body } }], { x: 8.3, y: 5.7, w: 4.4, h: 0.95, margin: 0, fontFace: F.body, fontSize: 10.5, valign: 'top' });
      footer(s, n);
    }
    if (sl.kind === 'weeks') {
      s.background = img(assets.bg.grid);
      heading(s, 'Week by week', sl.parts > 1 ? `Who is doing what, and when (${sl.part} of ${sl.parts})` : 'Who is doing what, and when', 9);
      const gx = 2.25, gy = 1.85, gw = W - 0.6 - gx, colW = gw / sl.weeks, laneH = 0.9, headH = 0.42, lanes = sl.owners.length;
      s.addShape(pptx.ShapeType.roundRect, { x: 0.6, y: gy, w: W - 1.2, h: headH + laneH * lanes + 0.08, rectRadius: 0.1, fill: { color: C.white }, line: { color: C.hair, width: 0.75 }, shadow: shadow() });
      for (let w = 0; w < sl.weeks; w++) {
        const ws = addDays(sl.start, w * 7), we = addDays(ws, 7), isNow = ref >= ws && ref < we, wx = gx + w * colW;
        if (isNow) s.addShape(pptx.ShapeType.rect, { x: wx, y: gy + 0.04, w: colW, h: headH + laneH * lanes, fill: { color: 'FBF3DC' }, line: { color: 'FBF3DC', width: 0 } });
        s.addText(`Week of ${fmt(ws, false)}`, { x: wx, y: gy + 0.08, w: colW, h: headH - 0.1, margin: 0, fontFace: F.body, fontSize: 9, bold: true, color: isNow ? C.goldDeep : C.mute, align: 'center', valign: 'middle' });
        if (w > 0) s.addShape(pptx.ShapeType.line, { x: wx, y: gy + 0.1, w: 0, h: headH + laneH * lanes - 0.12, line: { color: 'EDF0F5', width: 0.75 } });
      }
      const pillW = Math.min(1.52, colW - 0.08), titleN = Math.max(12, Math.round(pillW * 14.5));
      sl.owners.forEach((o, r) => {
        const ly = gy + headH + r * laneH;
        s.addShape(pptx.ShapeType.line, { x: 0.75, y: ly, w: W - 1.5, h: 0, line: { color: 'EDF0F5', width: 0.75 } });
        s.addShape(pptx.ShapeType.ellipse, { x: 0.8, y: ly + laneH / 2 - 0.19, w: 0.38, h: 0.38, fill: { color: o === 'Owner to be agreed' ? '8A94A6' : C.navy2 }, line: { color: C.navy2, width: 0 } });
        s.addText(o === 'Owner to be agreed' ? '?' : o.split(' ').map((p) => p[0]).join('').slice(0, 2), { x: 0.8, y: ly + laneH / 2 - 0.19, w: 0.38, h: 0.38, margin: 0, fontFace: F.body, fontSize: 9, bold: true, color: C.white, align: 'center', valign: 'middle' });
        s.addText(o, { x: 1.26, y: ly + 0.1, w: 0.95, h: laneH - 0.2, margin: 0, fontFace: F.body, fontSize: 9.5, bold: true, color: C.ink, valign: 'middle' });
        const mine = plan.dated.filter((a) => (a.owner || 'Owner to be agreed') === o);
        const slots = []; let hidden = 0;
        mine.forEach((a) => {
          let x = gx + ((d(a.due) - d(sl.start)) / DAY / 7) * colW - 0.06; x = Math.max(gx + 0.04, Math.min(x, gx + gw - pillW - 0.03));
          let row = 0; while (slots.some((q) => q.row === row && Math.abs(q.x - x) < pillW + 0.08)) row++;
          if (row > 1) { hidden++; return; }
          slots.push({ x, row });
          const y = ly + 0.05 + row * 0.42, col = STATUS[a.b].color;
          s.addShape(pptx.ShapeType.roundRect, { x, y, w: pillW, h: 0.38, rectRadius: 0.08, fill: { color: tint(col, 0.14) }, line: { color: col, width: 1 } });
          s.addShape(pptx.ShapeType.ellipse, { x: x + 0.08, y: y + 0.09, w: 0.1, h: 0.1, fill: { color: col }, line: { color: col, width: 0 } });
          s.addText(fmt(a.due), { x: x + 0.22, y: y + 0.03, w: pillW - 0.27, h: 0.16, margin: 0, fontFace: F.body, fontSize: 7.5, bold: true, color: C.ink, valign: 'middle' });
          s.addText(clip(a.title, titleN), { x: x + 0.22, y: y + 0.19, w: pillW - 0.25, h: 0.16, margin: 0, fontFace: F.body, fontSize: 7.5, color: C.body, valign: 'middle' });
        });
        if (hidden) s.addText(`+${hidden} more`, { x: gx + gw - 0.75, y: ly + laneH - 0.24, w: 0.7, h: 0.2, margin: 0, fontFace: F.body, fontSize: 7.5, bold: true, color: C.navy2, align: 'right' });
      });
      const tx = gx + ((d(ref) - d(sl.start)) / DAY / 7) * colW;
      s.addShape(pptx.ShapeType.line, { x: tx, y: gy + headH - 0.02, w: 0, h: laneH * lanes, line: { color: C.goldDeep, width: 1.5, dashType: 'dash' } });
      chip(s, tx - 0.6, gy - 0.34, `${input.source === 'meeting' ? 'Meeting' : 'Today'}, ${fmt(ref, false)}`, C.goldDeep, 1.2);
      if (plan.nm && input.source === 'meeting') {
        const mx = gx + ((d(plan.nm.date) - d(sl.start)) / DAY / 7) * colW;
        if (mx < gx + gw) { s.addShape(pptx.ShapeType.line, { x: mx, y: gy + headH - 0.02, w: 0, h: laneH * lanes, line: { color: STATUS.meeting.color, width: 1.5 } }); chip(s, Math.min(mx - 0.6, gx + gw - 1.25), gy + headH + laneH * lanes + 0.14, `Next meeting, ${fmt(plan.nm.date, false)}`, STATUS.meeting.color, 1.6); }
      }
      const lg = input.source === 'meeting' ? ['upcoming', ...(plan.counts.today ? ['today'] : [])] : ['completed', 'overdue', 'today', 'upcoming'];
      lg.forEach((k, i) => { const x = 6.85 + i * 1.5, y = 0.43; s.addShape(pptx.ShapeType.ellipse, { x, y: y + 0.06, w: 0.13, h: 0.13, fill: { color: STATUS[k].color }, line: { color: STATUS[k].color, width: 0 } }); s.addText(STATUS[k].label, { x: x + 0.2, y, w: 1.3, h: 0.25, margin: 0, fontFace: F.body, fontSize: 9, color: C.mute, valign: 'middle' }); });
      footer(s, n);
    }
    if (sl.kind === 'horizon') {
      s.background = img(assets.bg.ridge);
      heading(s, 'Milestones by horizon', input.source === 'meeting' ? 'From this week to what still needs a date' : 'From what slipped to what is next', 10);
      sl.cols.forEach((p, i) => {
        const x = COLS_X[i] + 0.3, col = STATUS[p.k].color;
        s.addText([{ text: p.title, options: { bold: true, color: C.ink } }, { text: `   ${p.items.length}`, options: { bold: true, color: col } }], { x, y: 1.88, w: 2.55, h: 0.4, margin: 0, fontFace: F.head, fontSize: 15, valign: 'middle' });
        if (!p.items.length) s.addText('Nothing here', { x, y: 2.42, w: 2.55, h: 0.3, margin: 0, fontFace: F.body, fontSize: 10, italic: true, color: C.mute });
        p.items.slice(0, 4).forEach((a, j) => {
          const y = 2.42 + j * 0.62;
          s.addText(clip(a.title, 60), { x, y, w: 2.55, h: 0.36, margin: 0, fontFace: F.body, fontSize: 10, bold: true, color: C.ink, valign: 'top' });
          s.addText(`${firstName(a.owner)}, ${a.due ? fmt(a.due) : 'date to be agreed'}`, { x, y: y + 0.33, w: 2.55, h: 0.22, margin: 0, fontFace: F.body, fontSize: 8.5, color: C.mute });
        });
        if (p.items.length > 4) s.addText(`+ ${p.items.length - 4} more`, { x, y: 2.42 + 4 * 0.62, w: 2.55, h: 0.24, margin: 0, fontFace: F.body, fontSize: 9, bold: true, color: col });
      });
      footer(s, n, true);
    }
    if (sl.kind === 'attention') {
      s.background = img(assets.bg.attention);
      heading(s, 'Needs attention', input.source === 'meeting' ? 'Still without a date or an owner' : 'Overdue, and still without a date', 10);
      const cw = sl.cards.length === 1 ? W - 1.2 : 5.95;
      sl.cards.forEach((c, i) => {
        const x = 0.6 + i * 6.17, y = 1.85, col = STATUS[c.k].color, k = Math.min(c.items.length, 5), h = 1.75 + k * 0.66;
        s.addShape(pptx.ShapeType.roundRect, { x, y, w: cw, h, rectRadius: 0.12, fill: { color: C.white }, line: { color: C.hair, width: 0.75 }, shadow: shadow() });
        s.addShape(pptx.ShapeType.rect, { x: x + 0.3, y: y + 0.3, w: 0.5, h: 0.06, fill: { color: col }, line: { color: col, width: 0 } });
        s.addText([{ text: c.title, options: { color: C.ink } }, { text: `  ${c.items.length}`, options: { color: col } }], { x: x + 0.3, y: y + 0.42, w: 5, h: 0.45, margin: 0, fontFace: F.head, fontSize: 18, bold: true, valign: 'middle' });
        s.addText(c.next, { x: x + 0.3, y: y + h - 0.55, w: cw - 0.6, h: 0.3, margin: 0, fontFace: F.body, fontSize: 9.5, italic: true, color: C.mute, valign: 'middle' });
        c.items.slice(0, 5).forEach((a, j) => {
          const ry = y + 1.05 + j * 0.66;
          if (j > 0) s.addShape(pptx.ShapeType.line, { x: x + 0.3, y: ry - 0.08, w: cw - 0.6, h: 0, line: { color: 'EDF0F5', width: 0.75 } });
          s.addText(clip(a.title, cw > 7 ? 90 : 44), { x: x + 0.3, y: ry, w: cw - 2.0, h: 0.3, margin: 0, fontFace: F.body, fontSize: 10.5, bold: true, color: C.ink, valign: 'middle' });
          s.addText(`${a.id}  |  ${ownerText(a.owner)}${a.due ? '  |  was due ' + fmt(a.due) : ''}`, { x: x + 0.3, y: ry + 0.29, w: cw - 2.0, h: 0.22, margin: 0, fontFace: F.body, fontSize: 8.5, color: C.mute });
          s.addText(c.badge(a), { x: x + cw - 0.3 - 1.35, y: ry + 0.08, w: 1.35, h: 0.3, margin: 0, shape: 'roundRect', rectRadius: 0.15, fill: { color: tint(col, 0.14) }, line: { color: col, width: 0.75 }, color: c.k === 'overdue' ? 'B4303E' : C.body, fontFace: F.body, fontSize: 8.5, bold: true, align: 'center', valign: 'middle' });
        });
      });
      footer(s, n);
    }
    if (sl.kind === 'nextMeeting') {
      s.background = img(assets.bg.close);
      heading(s, 'Before the next meeting', `${fmt(sl.nm.date)} ${sl.nm.date.slice(0, 4)}${sl.nm.timeLabel ? ', ' + sl.nm.timeLabel : ''}`, 11);
      const cols = [
        ['DUE BEFORE IT', sl.before.length ? sl.before.map((a) => `${fmt(a.due)}  ${clip(a.title, 40)}`) : ['Nothing is due before the next meeting']],
        ['BRING THESE QUESTIONS', sl.questions.length ? sl.questions.map((q) => clip(q.text, 70) + (q.resolver ? ` (${firstName(q.resolver)})` : '')) : ['No open questions']],
        ['STILL NEEDS A DATE', plan.undated.length ? plan.undated.map((a) => clip(a.title, 60)) : ['Every action has a date']],
      ];
      cols.forEach(([k, lines], i) => {
        const x = 0.6 + i * 4.11, y = 2.0;
        s.addText(k, { x, y, w: 3.8, h: 0.26, margin: 0, fontFace: F.body, fontSize: 8.5, bold: true, color: C.goldDeep, charSpacing: 2 });
        s.addText(lines.slice(0, 5).map((t, j) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: j < Math.min(lines.length, 5) - 1 } })), { x, y: y + 0.32, w: 3.8, h: 2.6, margin: 0, fontFace: F.body, fontSize: 11, color: C.ink, valign: 'top', paraSpaceAfter: 6 });
      });
      s.addText(`Drawn from the reviewed record of ${input.sourceLabel}. Check owners and dates before you share it.`, { x: 0.6, y: 5.0, w: 10, h: 0.3, margin: 0, fontFace: F.body, fontSize: 10, color: C.mute });
      footer(s, n);
    }
    if (sl.kind === 'progress') {
      s.background = img(assets.bg.close);
      heading(s, 'Progress', `${plan.counts.completed} of ${plan.acts.length} actions complete`, 10);
      const order = ['completed', 'today', 'upcoming', 'overdue', 'unscheduled'];
      const bx = 0.6, by = 2.25, bw = W - 1.2, bh = 0.62;
      s.addShape(pptx.ShapeType.roundRect, { x: bx - 0.06, y: by - 0.06, w: bw + 0.12, h: bh + 0.12, rectRadius: 0.37, fill: { color: C.white }, line: { color: C.hair, width: 0.75 }, shadow: shadow() });
      let cx = bx;
      order.forEach((k, i) => { const c = plan.counts[k]; if (!c) return; const w = (c / plan.acts.length) * bw; s.addShape(i === 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect, { x: cx, y: by, w, h: bh, rectRadius: 0.31, fill: { color: STATUS[k].color }, line: { color: C.white, width: 1.5 } }); s.addText(String(c), { x: cx, y: by, w, h: bh, margin: 0, fontFace: F.head, fontSize: 16, bold: true, color: C.white, align: 'center', valign: 'middle' }); cx += w; });
      order.forEach((k, i) => { const x = 0.6 + i * 2.0, y = by + bh + 0.25; s.addShape(pptx.ShapeType.ellipse, { x, y: y + 0.06, w: 0.14, h: 0.14, fill: { color: STATUS[k].color }, line: { color: STATUS[k].color, width: 0 } }); s.addText([{ text: STATUS[k].label + '  ', options: { color: C.body } }, { text: String(plan.counts[k]), options: { bold: true, color: C.ink } }], { x: x + 0.22, y, w: 1.75, h: 0.26, margin: 0, fontFace: F.body, fontSize: 9.5, valign: 'middle' }); });
      const nextUp = plan.openDated.filter((a) => a.due >= ref);
      const m = {}; plan.open.forEach((a) => { if (a.owner) m[a.owner] = (m[a.owner] || 0) + 1; });
      const busiest = Object.entries(m).sort((x, y) => y[1] - x[1])[0];
      [['Next due', nextUp[0] ? `${nextUp[0].title}, ${ownerText(nextUp[0].owner)}, ${fmt(nextUp[0].due)}` : 'Nothing scheduled'], ['Busiest owner', busiest ? `${busiest[0]}, ${busiest[1]} open actions` : 'No owners yet'], ['Last date on the timeline', `${fmt(last)} ${last.slice(0, 4)}`]].forEach(([k, v], i) => {
        const x = 0.6 + i * 4.11, y = 3.75;
        s.addText(k.toUpperCase(), { x, y, w: 3.8, h: 0.26, margin: 0, fontFace: F.body, fontSize: 8.5, bold: true, color: C.goldDeep, charSpacing: 2 });
        s.addText(v, { x, y: y + 0.3, w: 3.8, h: 0.75, margin: 0, fontFace: F.head, fontSize: 14, bold: true, color: C.ink, valign: 'top', fit: 'none' });
      });
      s.addText(`Drawn from ${input.sourceLabel} on ${fmt(ref)} ${ref.slice(0, 4)}. Check owners and dates before you share it.`, { x: 0.6, y: 5.3, w: 9, h: 0.3, margin: 0, fontFace: F.body, fontSize: 10, color: C.mute });
      footer(s, n);
    }
  });
  return pptx;
}

/** File name with no dashes or spaces. */
export function timelineFileName(input) {
  const base = (input.source === 'meeting' ? `${input.title} ${input.refDate}` : `${input.title} ${input.refDate}`).replace(/[^A-Za-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return `Concludo_Timeline_${base}.pptx`;
}

/** The validated record the drafting engine returns (draft-meeting-record, after review). */
export function fromValidatedRecord(rec, meeting, opts = {}) {
  return {
    source: 'meeting',
    title: meeting.client || meeting.title,
    subtitle: meeting.title,
    refDate: meeting.date,
    timezone: opts.timezone || 'Australia/Melbourne',
    sourceLabel: `the meeting on ${fmt(meeting.date)} ${meeting.date.slice(0, 4)}`,
    actions: (rec.actions || []).map((a, i) => ({ id: a.id || `A-${String(i + 1).padStart(2, '0')}`, title: a.text, owner: a.owner || null, due: a.due_date && !a.due_approximate && a.due_date >= meeting.date ? a.due_date : null, status: a.status === 'completed' ? 'completed' : 'open', priority: null })),
    nextMeeting: rec.next_meeting && rec.next_meeting.date ? { date: rec.next_meeting.date, timeLabel: rec.next_meeting.time ? to12(rec.next_meeting.time) : null } : null,
    openQuestions: (rec.open_questions || []).map((q, i) => ({ id: `Q-${String(i + 1).padStart(2, '0')}`, text: q.text, resolver: q.resolver || null })),
  };
}
function to12(t) { if (/\b[ap]\.?m\.?\b/i.test(t)) return t.replace(/\s+/g, ' ').trim(); const m = /^(\d{1,2}):(\d{2})/.exec(t); if (!m) return t; let h = +m[1]; const ap = h >= 12 ? 'pm' : 'am'; h = h % 12 || 12; return `${h}:${m[2]} ${ap}`; }

/** The studio's engine model (MeetingModel v2). Excluded items never go in; approximate or pre-meeting dates count as undated. */
export function fromEngineModel(m, opts = {}) {
  const keep = (x) => x.review !== 'excluded';
  const ref = m.meta.meetingDate;
  const nm = m.nextMeeting && m.nextMeeting.date && m.nextMeeting.date >= ref ? { date: m.nextMeeting.date, timeLabel: m.nextMeeting.time ? to12(m.nextMeeting.time) : null } : null;
  return {
    source: 'meeting',
    title: m.meta.organisation || m.meta.project || m.meta.title,
    subtitle: m.meta.title,
    refDate: ref,
    timezone: opts.timezone || 'Australia/Melbourne',
    sourceLabel: `the meeting on ${fmt(ref)} ${ref.slice(0, 4)}`,
    actions: m.actions.filter(keep).map((a) => ({ id: a.id, title: a.task, owner: a.owner || null, due: a.due && !a.dueApprox && a.due >= ref ? a.due : null, status: a.status === 'completed' ? 'completed' : 'open', priority: null })),
    nextMeeting: nm,
    openQuestions: m.openItems.filter(keep).map((q) => ({ id: q.id, text: q.question, resolver: q.resolver || null })),
  };
}
