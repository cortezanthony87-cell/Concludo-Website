// Concludo Automation studio v2: AI agents, Workflows, builder, Runs, Approvals, Governance.
// Every screen reads the same records through the automation core, so the three functions stay connected.
// @ts-nocheck
import * as C from './automationCore';
import * as AG from './agentsCore';

export function meetingInput(ws, meetingId) {
  const m = meetingId ? ws.meetings.find((x) => x.id === meetingId) : (ws.meetings && ws.meetings[0]);
  if (!m) return { event: { today: ws.today } };
  return {
    meeting: {
      id: m.id,
      title: m.title,
      date: m.date,
      attendees: m.attendees || [],
      summary: m.summary || '',
      consent: m.consent && m.consent !== 'not_recorded' ? 'recorded' : 'not_recorded',
    },
    decisions: (ws.decisions || []).filter((d) => (m.decisionIds || []).includes(d.id)).map((d) => ({ id: d.id, statement: d.decision_title })),
    actions: (ws.actions || []).filter((a) => (m.actionIds || []).includes(a.id)).map((a) => ({ id: a.id, title: a.action_title, owner: a.owner_name, due: a.due_date, status: a.status })),
    risks: (ws.risks || []).filter((r) => (m.riskIds || []).includes(r.id)).map((r) => ({ id: r.id, text: r.text, rating: r.rating })),
    event: { today: ws.today },
  };
}

export function scheduleInput(ws) {
  return {
    actions: (ws.actions || []).map((a) => ({ id: a.id, title: a.action_title, owner: a.owner_name, due: a.due_date, status: a.status })),
    decisions: (ws.decisions || []).map((d) => ({ id: d.id, statement: d.decision_title })),
    risks: (ws.risks || []).map((r) => ({ id: r.id, text: r.text, rating: r.rating })),
    event: { today: ws.today },
  };
}
// Concludo Automation studio v2: AI agents, Workflows, builder, Runs, Approvals, Governance.
// Every screen reads the same records through the automation core, so the three functions stay connected.

const P = {
  bot: '<rect x="4" y="8" width="16" height="11" rx="3"/><path d="M12 4v4M9 13h.01M15 13h.01M9 16.5h6"/>',
  flow: '<rect x="3" y="3" width="7" height="6" rx="1.5"/><rect x="14" y="15" width="7" height="6" rx="1.5"/><path d="M6.5 9v3a3 3 0 0 0 3 3h4.5"/>',
  runs: '<path d="M4 6h16M4 12h10M4 18h6"/><circle cx="18" cy="16" r="3"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  stamp: '<path d="M9 4h6v5l3 3v3H6v-3l3-3z"/><path d="M5 20h14"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
  play: '<path d="M7 5l12 7-12 7z"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
  bolt: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  gavel: '<path d="M14 5l5 5M11 8l5 5M9 10l5 5-3 3-5-5zM4 20l6-6"/>',
  inbox: '<path d="M3 13h5l2 3h4l2-3h5"/><path d="M5 5h14l2 8v6H3v-6z"/>',
  filter: '<path d="M4 5h16l-6 7v6l-4 2v-8z"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
  cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  chat: '<path d="M4 5h16v11H8l-4 4z"/>',
  db: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  home: '<path d="M4 11l8-7 8 7"/><path d="M6 10v10h12V10"/><path d="M10 20v-5h4v5"/>',
  deck: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M12 16v4M8 20h8M7 12l3-3 2 2 4-4"/>',
  hand: '<path d="M8 13V6a1.5 1.5 0 0 1 3 0v6M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7c0 4-2.5 7-6 7-2.5 0-4-1.5-5.5-3.5L3.8 13a1.5 1.5 0 0 1 2.4-1.8L8 13"/>',
  broom: '<path d="M14 4l6 6M12 10l2-2 2 2-2 2M12 10l-7 7 2 2 7-7"/><path d="M5 17l-2 4 4-2"/>',
  branch: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="12" r="2"/><path d="M6 8v8M8 6c6 0 4 6 8 6"/>',
};
const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
const CONN = { connected: 'Connected', needs_reauth: 'Sign in again', permission_required: 'Needs permission', service_issue: 'Service problem', disconnected: 'Not connected' };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const appOf = (k) => C.appInfo(k);
const actOf = (k) => C.actionInfo(k);
const trigOf = (k) => C.triggerInfo(k);
const plural = (n, w, p) => `${n} ${n === 1 ? w : p || w + 's'}`;
const when = (iso) => {
  const d = Date.now() - Date.parse(iso);
  if (d < 60000) return 'just now';
  if (d < 3600000) return `${Math.round(d / 60000)} min ago`;
  if (d < 86400000) return `${Math.round(d / 3600000)} h ago`;
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
};
const AGENT_IC = { meeting_prep: 'cal', consent_check: 'shield', record_hygiene: 'broom', client_commitments: 'hand', vendor_campaign_update: 'home', board_pack: 'deck', meeting_followup: 'mail', decision_followup: 'gavel', action_accountability: 'list', project_intelligence: 'chart', risk_monitoring: 'flag', report_generation: 'doc', workflow_coordinator: 'flow', document_intelligence: 'doc', inbox_command_centre: 'inbox' };
const STEP_IC = (s) => (s.action === 'run_agent' ? 'bot' : s.action === 'ask_approval' ? 'stamp' : s.action === 'only_if' ? 'branch' : s.action === 'send_email' ? 'mail' : s.action === 'post_message' ? 'chat' : s.action === 'create_event' ? 'cal' : s.action === 'create_task' || s.action === 'create_actions' ? 'list' : s.action === 'summarise_meeting' ? 'doc' : s.action === 'save_decisions' ? 'gavel' : s.action === 'build_report' ? 'chart' : s.action === 'notify_me' ? 'spark' : s.action === 'add_crm_note' || s.action === 'add_sheet_row' ? 'db' : 'bolt');
const isHeld = (r) => r.status === 'cancelled' && /^Held:/.test(r.error || '');
const pillOf = (r) => (isHeld(r) ? ['Held for consent', 'warn'] : RUN_PILL[r.status]);
const RUN_PILL = { running: ['Running', ''], requires_approval: ['Waiting for approval', 'gold'], completed: ['Completed', 'good'], failed: ['Failed', 'bad'], rejected: ['Rejected', 'warn'], cancelled: ['Cancelled', 'line'] };
const STEP_ICON = { done: 'check', nothing_to_do: 'check', failed: 'x', waiting: 'stamp', previewed: 'spark', skipped: 'arrow', pending: 'arrow' };
const EXAMPLES = [
  'After each meeting, summarise it, add the actions to the tracker, then email the attendees',
  'Every Monday build a status report and notify me',
  'After each meeting, if a risk is rated high, post to #leadership on Slack',
  'After each meeting, put the deadlines in my calendar',
];

/* ------------------------------------------------------------ space backdrop
   One canvas, created once, fixed behind the builder only. Stars twinkle, a shooting star crosses every few
   seconds, and a ringed planet, a banded planet and a spiral galaxy sit far away. It honours reduced motion. */
function createSpace(host) {
  const cv = document.createElement('canvas');
  cv.className = 'cma-space-canvas';
  cv.setAttribute('aria-hidden', 'true');
  cv.dataset.test = 'space';
  const g = cv.getContext('2d');
  const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1, active = false, raf = 0, last = 0, stars = [], shoots = [], nextShoot = 0, bg = null, bgKey = '';
  const seed = (n) => () => { n |= 0; n = (n + 0x6D2B79F5) | 0; let t = Math.imul(n ^ (n >>> 15), 1 | n); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const stats = { frames: 0, shot: 0 };

  function makeStars() {
    const rnd = seed(20261028);
    const n = Math.round(Math.min(420, Math.max(120, (W * H) / 5200)));
    stars = Array.from({ length: n }, () => {
      const layer = rnd() < 0.62 ? 0 : rnd() < 0.8 ? 1 : 2;
      const tint = rnd();
      return { x: rnd(), y: rnd(), layer, r: layer === 0 ? 0.45 + rnd() * 0.45 : layer === 1 ? 0.8 + rnd() * 0.5 : 1.2 + rnd() * 0.7,
        a: layer === 0 ? 0.35 + rnd() * 0.35 : 0.55 + rnd() * 0.4, sp: 0.6 + rnd() * 2.2, ph: rnd() * 6.28, drift: (layer + 1) * 0.35,
        c: tint < 0.12 ? '255,226,170' : tint < 0.3 ? '186,208,255' : '244,246,250', flare: layer === 2 && rnd() < 0.5 };
    });
  }

  function paintBackdrop() {
    const key = `${W}x${H}x${dpr}`;
    if (bg && bgKey === key) return;
    bgKey = key;
    bg = document.createElement('canvas'); bg.width = Math.round(W * dpr); bg.height = Math.round(H * dpr);
    const b = bg.getContext('2d'); if (!b) return; b.scale(dpr, dpr);
    const u = Math.max(0.7, Math.min(1.35, Math.min(W, H) / 800));
    let gr = b.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#060b16'); gr.addColorStop(0.55, '#0a1427'); gr.addColorStop(1, '#101e38');
    b.fillStyle = gr; b.fillRect(0, 0, W, H);
    const glow = (x, y, r, rgb, a) => { const rg = b.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, `rgba(${rgb},${a})`); rg.addColorStop(1, `rgba(${rgb},0)`); b.fillStyle = rg; b.fillRect(x - r, y - r, r * 2, r * 2); };
    glow(W * 0.18, H * 0.2, Math.max(W, H) * 0.55, '33,57,92', 0.55);
    glow(W * 0.85, H * 0.82, Math.max(W, H) * 0.5, '33,57,92', 0.4);
    glow(W * 0.62, H * 0.38, Math.max(W, H) * 0.35, '60,86,130', 0.16);
    glow(W * 0.92, H * 0.1, Math.max(W, H) * 0.28, '226,181,60', 0.05);
    // planets, galaxies, and celestial artwork removed per user directive
    // vignette keeps the edges calm behind the panels
    const vg = b.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.8);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(2,5,12,0.55)'); b.fillStyle = vg; b.fillRect(0, 0, W, H);
  }

  function size() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = host ? Math.max(320, host.clientWidth || window.innerWidth) : window.innerWidth;
    H = host ? Math.max(window.innerHeight, host.scrollHeight || 0, host.clientHeight || 0) : window.innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeStars(); paintBackdrop();
  }

  function shoot(now) {
    const rnd = Math.random;
    const dir = rnd() < 0.7 ? 1 : -1, ang = (18 + rnd() * 20) * Math.PI / 180;
    const len = 140 + rnd() * 120, sp = 780 + rnd() * 520;
    shoots.push({ x: dir > 0 ? W * (0.05 + rnd() * 0.55) : W * (0.45 + rnd() * 0.5), y: H * (0.04 + rnd() * 0.42), vx: Math.cos(ang) * sp * dir, vy: Math.sin(ang) * sp, len, born: now, life: 0.9 + rnd() * 0.5 });
    stats.shot++;
    nextShoot = now + 3800 + rnd() * 6200;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!g) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    if (now - last < 33) return; // about 30 frames a second is plenty for a backdrop
    const dt = Math.min(0.1, (now - last) / 1000); last = now; stats.frames++;
    g.clearRect(0, 0, W, H);
    if (bg) g.drawImage(bg, 0, 0, W, H);
    const t = now / 1000;
    for (const s of stars) {
      if (!reduce) { s.x += (s.drift * dt) / W * 14; if (s.x > 1.01) s.x = -0.01; }
      const tw = reduce ? 1 : 0.62 + 0.38 * Math.sin(t * s.sp + s.ph), a = s.a * tw, x = s.x * W, y = s.y * H;
      g.fillStyle = `rgba(${s.c},${a.toFixed(3)})`; g.beginPath(); g.arc(x, y, s.r, 0, 6.2832); g.fill();
      if (s.flare) { g.strokeStyle = `rgba(${s.c},${(a * 0.45).toFixed(3)})`; g.lineWidth = 0.7; g.beginPath(); g.moveTo(x - s.r * 5, y); g.lineTo(x + s.r * 5, y); g.moveTo(x, y - s.r * 5); g.lineTo(x, y + s.r * 5); g.stroke(); }
    }
    if (!reduce) {
      if (!nextShoot) nextShoot = now + 1800;
      if (now >= nextShoot) shoot(now);
      shoots = shoots.filter((s) => {
        const age = (now - s.born) / 1000; if (age > s.life) return false;
        const hx = s.x + s.vx * age, hy = s.y + s.vy * age, mag = Math.hypot(s.vx, s.vy), tx = hx - (s.vx / mag) * s.len, ty = hy - (s.vy / mag) * s.len;
        const fade = Math.sin(Math.min(1, age / s.life) * Math.PI);
        const gr = g.createLinearGradient(tx, ty, hx, hy); gr.addColorStop(0, 'rgba(190,208,255,0)'); gr.addColorStop(1, `rgba(255,250,235,${(0.95 * fade).toFixed(3)})`);
        g.strokeStyle = gr; g.lineWidth = 1.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(tx, ty); g.lineTo(hx, hy); g.stroke();
        const hg = g.createRadialGradient(hx, hy, 0, hx, hy, 7); hg.addColorStop(0, `rgba(255,248,225,${(0.9 * fade).toFixed(3)})`); hg.addColorStop(1, 'rgba(255,248,225,0)');
        g.fillStyle = hg; g.fillRect(hx - 7, hy - 7, 14, 14);
        return true;
      });
    }
  }

  let attached = false;
  return {
    el: cv, stats,
    shoot: () => shoot(performance.now()),
    count: () => shoots.length,
    setActive(on) {
      if (on && !attached) { (host || document.body).appendChild(cv); attached = true; window.addEventListener('resize', () => { if (active) size(); }); size(); }
      if (on === active) return;
      active = on; cv.style.display = on ? 'block' : 'none';
      cancelAnimationFrame(raf);
      if (on) { size(); last = 0; nextShoot = 0; raf = requestAnimationFrame(frame); if (reduce) requestAnimationFrame(() => frame(performance.now())); }
    },
  };
}

export async function mountAutomation(root, opts = {}) {
  const store = opts.store || new C.MemoryStore();
  const today = opts.today || new Date().toISOString().slice(0, 10);
  let ws = opts.workspace || { today, me: opts.actor || 'User', meetings: [], actions: [], decisions: [], risks: [] };
  const S = {
    actor: opts.actor || 'Mara Ellis',
    agentResults: {}, agentActivity: [], agentOpen: null,
    agentOpts: {},
    b: null, checks: null, checksAt: 0, repair: null, cols: 0, runsFilter: 'all', runSel: null, apTab: 'waiting', apSel: null, modal: null,
  };
  const logo = opts.logo || 'assets/lockup.png';
  const logoRev = opts.logoRev || logo;
  const logAgent = (res) => { const def = AG.AGENTS.find((a) => a.key === res.agent); S.agentResults[res.agent] = res; S.agentActivity.unshift({ at: res.ranAt, key: res.agent, name: def.name, headline: res.headline }); };
  // A "Run an AI agent" workflow step runs the same agents on the current records.
  AG.attachAgents(store, () => ws, () => S.actor, logAgent);
  const runAgentNow = async (key) => {
    const res = await AG.runAgent(key, ws, { store, now: store.now(), ...(S.agentOpts[key] || {}) });
    logAgent(res);
    await store.appendAudit({ id: store.id('aud'), at: store.now(), actor: S.actor, event: 'agent_run', objectType: 'agent', objectId: key, detail: res.headline });
    if (opts.onLogActivity) {
      await opts.onLogActivity(key, res.headline, res.basis, res.status || 'success');
    }
    return res;
  };
  root.classList.add('cma');
  const view = document.createElement('div');
  view.className = 'cma-view';
  root.appendChild(view);

  const space = createSpace(opts.embedded ? root : null);

  /* ------------------------------------------------------------ routing */
  const toUrl = (hash) => {
    if (!opts.usePathRouting) return hash;
    if (hash === '#agents') return '/agents';
    if (hash === '#workflows') return '/workflows';
    if (hash === '#builder/new') return '/workflows/builder/new';
    if (hash.startsWith('#builder/')) return '/workflows/builder/' + hash.slice('#builder/'.length);
    if (hash === '#runs') return '/workflows/runs';
    if (hash.startsWith('#runs/')) return '/workflows/runs/' + hash.slice('#runs/'.length);
    if (hash === '#approvals') return '/approvals';
    if (hash.startsWith('#approvals/')) return '/approvals/' + hash.slice('#approvals/'.length);
    if (hash === '#governance') return '/workflows/governance';
    return hash;
  };
  const route = () => {
    if (opts.initialRoute && !opts.usePathRouting) {
      return { page: opts.initialRoute.page || 'workflows', id: opts.initialRoute.id || null };
    }
    if (opts.usePathRouting) {
      const p = window.location.pathname;
      if (p.startsWith('/workflows/builder/new')) return { page: 'builder', id: 'new' };
      if (p.startsWith('/workflows/builder/')) return { page: 'builder', id: p.slice('/workflows/builder/'.length) || 'new' };
      if (p.startsWith('/workflows/builder')) return { page: 'builder', id: 'new' };
      if (p.startsWith('/workflows/runs/')) return { page: 'runs', id: p.slice('/workflows/runs/'.length) || null };
      if (p.startsWith('/workflows/runs')) return { page: 'runs', id: null };
      if (p.startsWith('/workflows/governance')) return { page: 'governance', id: null };
      if (p.startsWith('/workflows')) return { page: 'workflows', id: null };
      if (p.startsWith('/approvals/')) return { page: 'approvals', id: p.slice('/approvals/'.length) || null };
      if (p.startsWith('/approvals')) return { page: 'approvals', id: null };
      if (p.startsWith('/agents')) return { page: 'agents', id: null };
      return { page: opts.initialRoute?.page || 'workflows', id: opts.initialRoute?.id || null };
    }
    const h = (location.hash || '#workflows').slice(1).split('/');
    return { page: h[0] || 'workflows', id: h[1] || null };
  };
  const go = (target) => {
    if (opts.usePathRouting) {
      const url = toUrl(target);
      if (opts.onNavigate) opts.onNavigate(url);
      else if (window.location.pathname !== url) window.history.pushState({}, '', url);
      return render();
    }
    if (location.hash !== target) location.hash = target;
    else render();
  };

  /* ------------------------------------------------------------ shell */
  let renderSeq = 0;
  async function render(keepScroll) {
    const mine = ++renderSeq;
    const y = window.scrollY;
    const r = route();
    const h = await C.health(store);
    const pending = (await store.listApprovals()).filter((a) => a.status === 'pending').length;
    const area = r.page === 'agents' ? 'agents' : 'workflows';
    let body = '';
    if (r.page === 'agents') body = await vAgents();
    else if (r.page === 'builder') body = await vBuilder(r.id);
    else if (r.page === 'runs') body = await vRuns(r.id, h, pending);
    else if (r.page === 'approvals') body = await vApprovals(r.id, h, pending);
    else if (r.page === 'governance') body = await vGovernance(h, pending);
    else body = await vWorkflows(h, pending);
    if (mine !== renderSeq) return; // a newer render started while this one was reading records
    const spaceOn = r.page === 'builder';
    root.classList.toggle('space-on', spaceOn);
    document.documentElement.classList.toggle('cma-space', spaceOn && !opts.embedded);
    space.setActive(spaceOn);
    const foot = `<footer class="foot">Concludo is independent. Apps named here, such as Outlook, Gmail, Google Calendar, Microsoft To Do, Slack, Microsoft Teams, Google Sheets and HubSpot, are shown only as places a workflow can send to. Concludo is not affiliated with or endorsed by any of them.</footer>`;
    if (opts.embedded) {
      view.innerHTML = `
        ${body}
        ${foot}
        ${S.modal ? S.modal : ''}`;
    } else {
      view.innerHTML = `
        <header class="top">
          <img class="logo" src="${esc(spaceOn ? logoRev : logo)}" alt="Concludo">
          <nav class="mainnav" aria-label="Automation">
            <a href="${toUrl('#agents')}" aria-label="AI agents" class="${area === 'agents' ? 'on' : ''}">${ic('bot')}<span>AI agents</span></a>
            <a href="${toUrl('#workflows')}" aria-label="Workflows" class="${area === 'workflows' ? 'on' : ''}">${ic('flow')}<span>Workflows</span></a>
          </nav>
          <div class="top-r"><span class="sample">Sample workspace, fictional</span>
            <a class="sys ${h.stopped ? 'stopped' : ''}" href="${toUrl('#governance')}" data-test="sys"><i></i>${h.stopped ? 'All workflows stopped' : 'Workflows running'}</a></div>
        </header>
        ${body}
        ${foot}
        ${S.modal ? S.modal : ''}`;
    }
    if (keepScroll) window.scrollTo(0, y);
    const focus = root.querySelector('[data-autofocus]');
    if (focus) focus.focus();
  }

  function fnTiles(active, h, pending) {
    return `<nav class="fn" aria-label="Workflow functions">
      <a href="${toUrl('#runs')}" class="${active === 'runs' ? 'on' : ''}" data-test="tile-runs"><span class="ic">${ic('runs')}</span><span><b>Workflow runs</b><span>What ran, what it did, what failed</span></span><span class="num ${h.failed7d ? 'alert' : ''}">${h.runs7d}<small>${h.failed7d ? `${h.failed7d} failed` : 'this week'}</small></span></a>
      <a href="${toUrl('#approvals')}" class="${active === 'approvals' ? 'on' : ''}" data-test="tile-approvals"><span class="ic">${ic('stamp')}</span><span><b>Approval Centre</b><span>What is waiting for a person</span></span><span class="num ${pending ? 'alert' : ''}">${pending}<small>waiting</small></span></a>
      <a href="${toUrl('#governance')}" class="${active === 'governance' ? 'on' : ''}" data-test="tile-governance"><span class="ic">${ic('shield')}</span><span><b>Governance Centre</b><span>Stop, pause, incidents, audit</span></span><span class="num ${h.stopped || h.openIncidents ? 'alert' : ''}">${h.stopped ? 'Stop' : h.openIncidents}<small>${h.stopped ? 'is on' : h.openIncidents === 1 ? 'incident' : 'incidents'}</small></span></a>
    </nav>`;
  }

  /* ============================================================ AGENTS */
  async function vAgents() {
    const groups = ['Meetings and decisions', 'Actions and delivery', 'Clients and campaigns', 'Trust and oversight', 'Inputs'];
    const GROUP_LINE = { 'Meetings and decisions': 'Before and after each meeting', 'Actions and delivery': 'Keeping work owned, dated and moving', 'Clients and campaigns': 'What clients and vendors are owed', 'Trust and oversight': 'Consent, risk and the health of your workflows', Inputs: 'Agents that need a document or a mailbox' };
    const ready = AG.AGENTS.filter((a) => !a.needs).length;
    const fresh = AG.AGENTS.filter((a) => a.isNew).length;
    let drawer = '';
    if (S.agentOpen) {
      const def = AG.AGENTS.find((a) => a.key === S.agentOpen);
      const res = S.agentResults[S.agentOpen];
      drawer = `<div class="drawer-bg" data-act="close-drawer"></div><aside class="drawer" role="dialog" aria-label="${esc(def.name)} result">
        <div class="d-h"><div><div class="eyebrow">Agent result</div><h2>${esc(def.name)}</h2><div class="small muted">${res ? `Ran ${when(res.ranAt)}` : ''}</div></div><button class="btn ghost sm" data-act="close-drawer" aria-label="Close">${ic('x')}</button></div>
        <div class="d-b">
          <div class="headline" data-test="agent-headline">${esc(res.headline)}</div>
          ${res.fixes && res.fixes.length ? `<section class="fixes" data-test="fixes"><div class="eyebrow">Fixes you confirm. Nothing changes until you press Confirm</div>${res.fixes.map(fixHtml).join('')}</section>` : ''}
          ${res.findings.length ? `<div class="findings">${res.findings.map((f) => `<div class="finding ${f.tone || ''}"><i></i><div><b>${esc(f.title)}</b><span>${esc(f.detail)}</span></div></div>`).join('')}</div>` : ''}
          ${agentControls(def.key)}
          ${res.doc ? docHtml(res.doc) : ''}
          ${res.deck ? deckHtml(res.deck) : ''}
          ${res.drafts.map((d, i) => { const copyOnly = /^Paste /.test(d.to); return `<div class="draft"><div class="dh"><span><b>${copyOnly ? 'Use:' : 'To:'}</b> ${esc(d.to)}</span><span><b>${copyOnly ? 'Text:' : 'Subject:'}</b> ${esc(d.subject)}</span></div><pre>${esc(d.body)}</pre><div class="df">${copyOnly ? '' : `<button class="btn sm primary" data-act="draft-approve" data-i="${i}" data-test="draft-approve">${ic('stamp')}Ask for approval</button>`}<button class="btn sm" data-act="draft-copy" data-i="${i}">${ic('copy')}Copy</button></div></div>`; }).join('')}
          <div class="basis">${esc(res.basis)} Concludo never sends agent drafts on its own: approved drafts are copied into your mail app by you.</div>
        </div></aside>`;
    }
    return `<div class="wrap">
      <div class="head"><div><div class="eyebrow">Automation</div><h1>AI agents</h1><p>Agents read your Concludo records and prepare work. They never send anything: anything that would leave Concludo goes to the Approval Centre first.</p></div>
        <div class="chips"><span class="pill good"><i></i>${ready} ready</span><span class="pill gold">${fresh} new</span><span class="pill line">${AG.AGENTS.length - ready} need an input or a connection</span></div></div>
      <nav class="chips agent-jump" aria-label="Agent groups">${groups.map((g) => `<a class="chip" href="${toUrl('#agents')}" data-act="jump" data-g="${esc(g)}">${esc(g)} <span class="muted">${AG.AGENTS.filter((a) => a.group === g && !a.hidden).length}</span></a>`).join('')}</nav>
      <div class="agent-groups">${groups.map((g) => `<section id="grp-${g.replace(/\W+/g, '-').toLowerCase()}"><div class="group-h"><h2>${esc(g)}</h2><span class="small muted">${esc(GROUP_LINE[g])}</span></div><div class="agents">${AG.AGENTS.filter((a) => a.group === g && !a.hidden).map(agentCard).join('')}</div></section>`).join('')}</div>
      <section class="sect"><h2>Recent agent runs</h2><p>Every run is listed with what it read. Nothing here is a score of a person.</p>
        <div class="card"><div class="card-b">${S.agentActivity.length ? `<div class="activity">${S.agentActivity.slice(0, 12).map((x) => `<div><span class="muted small">${esc(when(x.at))}</span><span><b>${esc(x.name)}</b>: ${esc(x.headline)}</span><button class="btn sm ghost" data-act="agent-open" data-k="${x.key}">View</button></div>`).join('')}</div>` : '<div class="empty"><b>No agent runs yet</b>Run an agent above to see its findings here.</div>'}</div></div></section>
    </div>${drawer}`;
  }
  function agentControls(key) {
    const o = S.agentOpts[key] || {};
    if (key === 'meeting_prep') return `<div class="ctl"><label for="ctl-prep">Prepare for</label><select id="ctl-prep" data-agent-opt="project" data-k="${key}"><option value="">The next meeting in the calendar</option>${AG.projectsOf(ws).map((p) => `<option ${o.project === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>`;
    if (key === 'board_pack') return `<div class="ctl"><label for="ctl-period">Period</label><select id="ctl-period" data-agent-opt="periodDays" data-k="${key}">${[[7, 'Last 7 days'], [30, 'Last 30 days'], [90, 'Last 90 days']].map(([v, l]) => `<option value="${v}" ${(o.periodDays || 30) === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>`;
    return '';
  }
  function docHtml(doc) {
    return `<article class="brief" data-test="brief"><div class="b-top"><img src="${esc(logo)}" alt="Concludo"><span>${esc(doc.subtitle || '')}</span></div><h3>${esc(doc.title)}</h3>${doc.sections.map((s) => `<section><h4>${esc(s.heading)}</h4>${s.items.length ? `<${s.ordered ? 'ol' : 'ul'}>${s.items.map((i) => `<li>${esc(i)}</li>`).join('')}</${s.ordered ? 'ol' : 'ul'}>` : `<p class="muted small">${esc(s.empty || 'Nothing recorded.')}</p>`}</section>`).join('')}</article>`;
  }
  function deckHtml(deck) {
    return `<section class="deck" data-test="deck"><div class="eyebrow">Deck outline, ${deck.length} slides</div><div class="slides">${deck.map((sl, i) => `<div class="slide ${sl.kind}"><span class="sn">${i + 1}</span>${sl.kind === 'title' ? `<img src="${esc(logoRev)}" alt=""><b>${esc(sl.title)}</b><span>${esc(sl.subtitle || '')}</span><small>${esc(sl.note || '')}</small>` : `<b>${esc(sl.title)}</b>${sl.subtitle ? `<span class="sub">${esc(sl.subtitle)}</span>` : ''}${sl.stats ? `<div class="stats">${sl.stats.map((x) => `<div><strong>${esc(x.value)}</strong><span>${esc(x.label)}</span></div>`).join('')}</div>` : ''}${sl.bullets && sl.bullets.length ? `<ul>${sl.bullets.slice(0, 5).map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}${sl.note ? `<small>${esc(sl.note)}</small>` : ''}`}</div>`).join('')}</div>
      <div class="df"><button class="btn sm primary" data-act="deck-approve" data-test="deck-approve">${ic('stamp')}Ask for approval to share</button><button class="btn sm" data-act="deck-copy">${ic('copy')}Copy outline</button></div>
      <div class="note">In the Workspace this exports through the branded PowerPoint output. Every stat names the records it counts.</div></section>`;
  }
  function fixHtml(f) {
    return `<form class="fix" data-fix="${esc(f.id)}"><b>${esc(f.label)}</b><div class="fx">${f.fields.map((x) => `<label><span class="sr">${esc(x.label)}</span>${x.kind === 'select' ? `<select name="${x.key}">${x.options.map((o) => `<option value="${esc(o.value)}" ${x.value === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>` : `<input name="${x.key}" type="${x.kind === 'date' ? 'date' : 'text'}" placeholder="${esc(x.placeholder || x.label)}" value="${esc(x.value || '')}" aria-label="${esc(x.label)}">`}</label>`).join('')}<button class="btn sm navy" data-test="fix-${esc(f.kind)}">${ic('check')}Confirm</button></div></form>`;
  }
  function agentCard(a) {
    const res = S.agentResults[a.key];
    const status = a.needs ? `<span class="pill ${a.needs.kind === 'connection' ? 'warn' : 'line'}">${a.needs.kind === 'connection' ? 'Needs a mailbox' : 'Needs a document'}</span>` : `<span class="pill good"><i></i>Ready</span>`;
    return `<article class="agent ${a.isNew ? 'new' : ''}" data-test="agent-${a.key}">
      <div class="a-top"><div class="a-ic">${ic(AGENT_IC[a.key])}</div><div><h3>${esc(a.name)}${a.isNew ? ' <span class="pill gold sm">New</span>' : ''}</h3><p class="line">${esc(a.line)}</p>${a.forWho ? `<p class="for">For ${esc(a.forWho)}</p>` : ''}</div></div>
      <dl><dt>Watches</dt><dd>${esc(a.watches)}</dd><dt>Hands you</dt><dd><ul>${a.handsYou.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></dd>${a.draftsNeedApproval ? '<dt>Approval</dt><dd>Drafts wait for you</dd>' : ''}</dl>
      <div class="a-foot"><div>${status}${res ? `<div class="last">Last run ${esc(when(res.ranAt))}</div>` : ''}</div>
        <div style="display:flex;gap:6px">${res ? `<button class="btn sm ghost" data-act="agent-open" data-k="${a.key}">Result</button>` : ''}<button class="btn sm ${a.needs ? '' : 'primary'}" data-act="agent-run" data-k="${a.key}" ${a.needs ? `disabled title="${esc(a.needs.text)}"` : ''}>${ic('play')}Run</button></div></div>
    </article>`;
  }

  /* ============================================================ WORKFLOWS */
  async function vWorkflows(h, pending) {
    const wfs = await store.listWorkflows();
    const runs = await store.listRuns();
    return `<div class="wrap">
      <div class="head"><div><div class="eyebrow">Automation</div><h1>Workflows</h1><p>The steps that run when something happens. Anything that would leave Concludo waits for a person in the Approval Centre.</p></div>
        <a class="btn primary lg" href="${toUrl('#builder/new')}" data-test="create">${ic('plus')}Create workflow</a></div>
      ${fnTiles('', h, pending)}
      ${h.stopped ? `<div class="banner bad">${ic('alert')}<span><b>All workflows are stopped.</b> Nothing runs and nothing can be approved until the stop is released in the <a href="${toUrl('#governance')}">Governance Centre</a>.</span></div>` : ''}
      <div class="wfs">${wfs.map((w) => wfCard(w, runs.find((r) => r.workflowId === w.id && !r.test))).join('') || '<div class="empty card"><b>No workflows yet</b>Create one from a sentence or a template.</div>'}</div>
      <section class="sect"><h2>Start from a template</h2><p>Each template already has its approval step in place.</p>
        <div class="tpls">${C.TEMPLATES.map((t) => `<button class="tpl" data-act="from-template" data-k="${t.key}"><b>${esc(t.name)}</b><span>${esc(t.summary)}</span></button>`).join('')}</div></section>
    </div>`;
  }
  function statusPill(w) {
    if (w.status === 'active') return '<span class="pill good"><i></i>On</span>';
    if (w.status === 'draft') return '<span class="pill line">Draft</span>';
    return `<span class="pill ${w.pausedBy === 'you' ? 'warn' : 'bad'}"><i></i>${w.pausedBy === 'workspace_stop' ? 'Stopped' : w.pausedBy === 'quarantine' ? 'Paused after failures' : 'Paused'}</span>`;
  }
  function flowMini(w) {
    try {
      const trig = trigOf(w.trigger && w.trigger.type);
      return `<div class="flowmini"><span class="appb">${ic('bolt')}${esc(trig.label)}</span>${(w.steps || []).map((s) => {
        const app = appOf(s && s.app);
        const approval = s && s.action === 'ask_approval';
        const text = approval ? 'Approval' : app.external ? app.label : (s && s.label) || 'Step';
        return `${ic('arrow', 'arr')}<span class="appb ${approval ? 'ap' : app.external ? 'ext' : ''}">${esc(text)}</span>`;
      }).join('')}</div>`;
    } catch (e) {
      return `<div class="flowmini"><span class="appb">This workflow could not be drawn.</span></div>`;
    }
  }
  function wfCard(w, last) {
    try { return wfCardHtml(w, last); }
    catch (e) {
      return `<article class="wf" data-test="wf-unreadable"><div class="w-h"><div><h3>${esc(w.name || 'Workflow')}</h3><div class="trig">This workflow could not be drawn.</div></div></div><div class="w-f"><a class="btn sm" href="${toUrl('#builder/' + w.id)}">${ic('flow')}Open in builder</a><button class="btn sm danger ghost" data-act="delete-wf" data-id="${w.id}" data-test="delete-wf-${w.id}" title="Delete workflow">${ic('trash')}Delete</button></div></article>`;
    }
  }
  function wfCardHtml(w, last) {
    const trig = trigOf(w.trigger && w.trigger.type);
    return `<article class="wf" data-act="open-wf" data-id="${w.id}" data-test="wf-${esc(w.name)}" tabindex="0" role="link" aria-label="Open ${esc(w.name)} in the builder">
      <div class="w-h"><div><h3><a href="${toUrl('#builder/' + w.id)}">${esc(w.name)}</a></h3><div class="trig">${esc(trig.label)}${w.trigger && w.trigger.schedule ? ` · ${esc(w.trigger.schedule)}` : ''}</div></div>${statusPill(w)}</div>
      ${flowMini(w)}
      <div class="w-f"><a class="btn sm" href="${toUrl('#builder/' + w.id)}">${ic('flow')}Edit in builder</a>
        <button class="btn sm ${w.status === 'active' ? 'primary' : ''}" data-act="run-open" data-id="${w.id}" ${w.status === 'active' ? '' : 'disabled title="Turn it on first, or use Test run in the builder"'}>${ic('play')}Run now</button>
        <button class="btn sm ghost" data-act="toggle" data-id="${w.id}">${w.status === 'active' ? `${ic('pause')}Pause` : `${ic('play')}Turn on`}</button>
        <button class="btn sm danger ghost" data-act="delete-wf" data-id="${w.id}" data-test="delete-wf-${w.id}" title="Delete workflow">${ic('trash')}Delete</button>
        <span class="lastrun">${last ? `Last run: <a href="${toUrl('#runs/' + last.id)}">${esc((pillOf(last) || RUN_PILL[last.status] || ['Unknown'])[0].toLowerCase())}</a>` : 'Not run yet'}</span></div>
    </article>`;
  }


  /* ============================================================ BUILDER */
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const NODE = 92, GAPX = 64, ROWH = 196, PADX = 46, PADY = 34;
  const newB = (id) => ({ id, wf: null, history: [], view: 'diagram', sel: null, test: null, plan: null, bottom: false, leftTab: 'overview', mode: S.b?.mode || 'describe', draftText: S.b?.draftText || '', mname: S.b?.mname || '', mtrig: S.b?.mtrig || 'meeting_completed', msched: S.b?.msched || 'Every Monday' });
  async function loadBuilder(id) {
    if (id === 'new') { if (!S.b || S.b.id !== 'new') S.b = newB('new'); return; }
    const wf = await store.getWorkflow(id);
    if (!S.b || S.b.id !== id) S.b = { ...newB(id), id, wf, mode: 'describe', plan: S.b?.planFor === id ? S.b.plan : null };
    else if (wf) S.b.wf = wf;
    else S.b.wf = null;
  }
  async function getChecks(force) {
    if (force || !S.checks || Date.now() - S.checksAt > 60000) { S.checks = await C.checkAllConnections(store); S.checksAt = Date.now(); }
    return S.checks;
  }
  const dotClass = (c) => (c.state === 'connected' ? (c.verified ? 'ok' : 'unk') : c.state === 'disconnected' ? 'off' : 'warn');
  const connWords = (c) => (c.state === 'connected' && !c.verified ? 'Connected, not checked' : CONN[c.state]);
  async function savedBar(cur) {
    const wfs = (await store.listWorkflows()).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return `<nav class="saved" aria-label="Saved workflows" data-test="saved-bar"><span class="saved-l">${ic('flow')}Saved workflows <span class="n">${wfs.length}</span></span>
      <div class="saved-s"><a class="sv new ${cur === 'new' ? 'on' : ''}" href="${toUrl('#builder/new')}" data-test="sv-new">${ic('plus')}New workflow</a>${wfs.map((w) => `<a class="sv ${w.id === cur ? 'on' : ''}" href="${toUrl('#builder/' + w.id)}" data-test="sv-${esc(w.name)}" title="${esc(w.name)}"><i class="d ${w.status}"></i><span>${esc(w.name)}</span></a>`).join('')}</div></nav>`;
  }
  async function vBuilder(id) {
    await loadBuilder(id);
    const b = S.b;
    const bar = await savedBar(id === 'new' ? 'new' : b.wf ? b.wf.id : id);
    if (!b.wf) {
      const checks = await getChecks(false);
      return `<div class="space-page">${bar}${createView(b)}<div class="dock" style="max-width:960px;margin:0 auto 32px;border-radius:14px;">${appsBar(checks, new Set())}</div></div>`;
    }
    const wf = b.wf;
    const issues = await C.validateWorkflow(wf, store);
    const blocks = issues.filter((i) => i.level === 'block');
    const explain = C.explainWorkflow(wf);
    const checks = await getChecks(false);
    const usedApps = new Set(wf.steps.filter((s) => appOf(s.app).external).map((s) => s.app));
    const stepIssues = (sid) => issues.filter((i) => i.stepId === sid && i.level === 'block');
    const plan = b.plan;
    const fixBtn = (i) => {
      if (i.fix === 'add_approval') return `<div class="fix"><button class="btn sm primary" data-act="fix-approval" data-test="fix-approval">${ic('stamp')}Fix it</button><span class="small muted">Adds the approval step</span></div>`;
      if (i.fix === 'connect') { const app = wf.steps.find((s) => s.id === i.stepId)?.app; return app ? `<div class="fix"><button class="btn sm primary" data-act="fix-conn" data-app="${app}" data-test="fix-conn">${ic('bot')}Fix it</button><span class="small muted">The repair agent checks ${esc(appOf(app).label)} and reconnects what it can</span></div>` : ''; }
      return i.stepId ? `<div class="fix"><button class="btn sm" data-act="select" data-s="${i.stepId}">Open the step</button></div>` : '';
    };
    const overview = `
      ${plan ? `<div><h3>From your description (AI agent workflow builder)</h3>${plan.understood.length ? `<div class="checks">${plan.understood.map((u) => `<div class="check ok"><span class="dot">${ic('check')}</span><span>${esc(u)}</span></div>`).join('')}</div>` : ''}${plan.unclear.length ? `<div class="checks" style="margin-top:8px">${plan.unclear.map((u) => `<div class="check warn" data-test="unclear"><span class="dot">${ic('alert')}</span><span>Not understood: ${esc(u)}. Add a step for it, or leave it out.</span></div>`).join('')}</div>` : ''}${plan.addedApprovals.length ? `<div class="note" style="margin-top:8px">Concludo added an approval before ${esc(plan.addedApprovals.join(', '))}, because ${plan.addedApprovals.length === 1 ? 'it sends' : 'they send'} something outside Concludo.</div>` : ''}</div>` : ''}
      <div><h3>How it works</h3><ol class="explain">${explain.map((l, i) => `<li class="${i === 0 ? 'first' : ''}">${esc(l)}</li>`).join('')}</ol></div>`;
    const checksBlock = `<div><h3>Checks</h3><div class="checks" data-test="checks">${issues.length ? issues.map((i) => `<div class="check ${i.level}"><span class="dot">${ic(i.level === 'block' ? 'x' : 'alert')}</span><span>${esc(i.text)}${fixBtn(i)}</span></div>`).join('') : `<div class="check ok"><span class="dot">${ic('check')}</span><span>All checks pass. ${wf.status === 'active' ? 'This workflow is on.' : 'You can turn it on.'}</span></div>`}</div></div>`;
    const palette = `<div class="palette" data-test="palette"><p class="small muted" style="margin:0 0 4px">Click a step to add it${b.sel && b.sel !== 'trigger' ? ' after the selected one' : ' at the end'}, or drag it onto a plus on the diagram.</p>${[...new Set(Object.values(C.ACTIONS).map((a) => a.group))].map((g) => `<div><h4>${esc(g)}</h4>${Object.values(C.ACTIONS).filter((a) => a.group === g && !a.hidden).flatMap((a) => (a.apps.length > 1 && a.kind === 'do' ? a.apps.map((app) => ({ a, app })) : [{ a, app: a.apps[0] }])).map(({ a, app }) => `<button class="pal" draggable="true" data-act="pal-add" data-k="${a.key}" data-app="${app}" data-test="pal-${a.key}-${app}">${ic(STEP_IC({ action: a.key }))}<span><b>${esc(a.label)}${a.apps.length > 1 ? ` (${esc(appOf(app).label)})` : ''}</b><small>${appOf(app).external && a.kind === 'do' ? 'Leaves Concludo, needs approval' : a.kind === 'approval' ? 'Stops until a person approves' : a.kind === 'only_if' ? 'Stops if the rule is not met' : 'Stays inside Concludo'}</small></span></button>`).join('')}</div>`).join('')}</div>`;
    const total = root.clientWidth || 1200;
    const wide = total > 1100;
    const availW = total - (wide ? 340 : 0) - (b.sel && wide ? 350 : 0);
    const cols = Math.max(1, Math.min(6, Math.floor((availW - PADX * 2 + GAPX) / (NODE + GAPX))));
    S.cols = cols;
    return `<div class="space-page">
      ${bar}
      <div class="b-head">
        <a class="btn sm ghost" href="${toUrl('#workflows')}">${ic('back')}Workflows</a>
        <a class="btn sm primary" href="${toUrl('#builder/new')}" data-test="create">${ic('plus')}Create workflow</a>
        <label class="sr" for="wfname">Workflow name</label><input id="wfname" class="name" data-bind="wfname" value="${esc(wf.name)}">
        ${statusPill(wf)}<span class="small muted" data-test="saved">Saved</span>
        <span class="grow"></span>
        <button class="btn sm" data-act="undo" ${b.history.length ? '' : 'disabled'}>${ic('undo')}Undo</button>
        <button class="btn sm" data-act="test-open" data-test="test-open">${ic('play')}Test run</button>
        ${wf.status === 'active' ? `<button class="btn sm" data-act="toggle" data-id="${wf.id}">${ic('pause')}Pause</button>` : `<button class="btn sm primary" data-act="toggle" data-id="${wf.id}" data-test="turn-on" ${blocks.length ? `title="${esc(blocks[0].text)}"` : ''}>${ic('play')}Turn on</button>`}
        <button class="btn sm danger" data-act="delete-wf" data-id="${wf.id}" data-test="delete-wf" title="Delete this workflow">${ic('trash')}Delete workflow</button>
      </div>
      <div class="split">
        <aside class="left">
          <div class="ltabs" role="tablist"><button class="${b.leftTab === 'palette' ? '' : 'on'}" data-act="ltab" data-t="overview" role="tab">Overview</button><button class="${b.leftTab === 'palette' ? 'on' : ''}" data-act="ltab" data-t="palette" data-test="tab-palette" role="tab">Step palette</button></div>
          ${b.leftTab === 'palette' ? palette : overview}
          ${checksBlock}
        </aside>
        <section class="right">
          <div class="ctool"><div class="seg" role="tablist"><button class="${b.view === 'diagram' ? 'on' : ''}" data-act="view" data-v="diagram">Diagram</button><button class="${b.view === 'steps' ? 'on' : ''}" data-act="view" data-v="steps">Steps</button></div>
            <button class="btn sm navy" data-act="add-open" data-at="${wf.steps.length}" data-test="add-step">${ic('plus')}Add step</button></div>
          <div class="canvas ${b.sel && wide ? 'has-ins' : ''}" data-test="canvas">${b.view === 'diagram' ? graph(wf, stepIssues, cols) : stepsList(wf, stepIssues)}</div>
          ${b.sel ? inspector(wf, issues) : ''}
          <div class="dock">
            <div class="bottom" data-test="bottom"><div class="bh"><b>${ic('play')} Test run ${b.test ? `· ${esc(RUN_PILL[b.test.status][0])}` : ''}</b><div style="display:flex;gap:6px;align-items:center">
              ${b.bottom ? `<label class="sr" for="testinput">Test input</label><select id="testinput" class="btn sm" data-bind="testInput"><option value="meeting" ${b.testInput !== 'open' && b.testInput !== 'empty' ? 'selected' : ''}>Latest meeting</option><option value="open" ${b.testInput === 'open' ? 'selected' : ''}>Open work across the workspace</option><option value="empty" ${b.testInput === 'empty' ? 'selected' : ''}>Nothing (empty input)</option></select><button class="btn sm primary" data-act="test-run" data-test="test-run">Run test</button>` : ''}
              <button class="btn sm ghost" data-act="bottom">${b.bottom ? 'Hide' : 'Open'}</button></div></div>
              ${b.bottom ? `<div class="bb">${b.test ? `<div class="note" style="margin-bottom:10px">Test runs never send anything and never queue approvals. They show what a live run would do with this input.</div>${timeline(b.test.steps)}` : '<div class="note">Choose an input and run a test. Nothing is sent.</div>'}</div>` : ''}
            </div>
            ${appsBar(checks, usedApps)}
          </div>
        </section>
      </div>
    </div>`;
  }
  function appsBar(checks, used) {
    const sim = checks.some((c) => c.simulated);
    const live = checks.length ? checks.reduce((a, c) => (c.checkedAt > a ? c.checkedAt : a), '') : '';
    return `<div class="appsbar" data-test="apps-bar"><div class="ab-h"><b>${ic('link')}Connected apps</b>
        <span class="small muted" data-test="checked-line">${live ? `Checked ${esc(when(live))}` : 'Not checked yet'}${sim ? '. Preview check: reads the sample record, not the real app.' : checks.some((c) => !c.verified) ? '. Some apps could not be checked.' : ''}</span><span class="grow"></span>
        <button class="btn sm" data-act="check-apps" data-test="check-apps">${ic('undo')}Check all now</button><button class="btn sm" data-act="connect-open" data-test="manage-apps">Manage</button></div>
      <div class="ab-list">${checks.map((c) => `<div class="appchip ${dotClass(c)} ${used.has(c.app) ? 'used' : ''}" data-test="app-${c.app}" title="${esc(c.detail)}"><i></i><span class="ac-t"><b>${esc(appOf(c.app).label)}</b><small>${esc(connWords(c))}${used.has(c.app) ? ' · used here' : ''}</small></span>${c.state !== 'connected' || !c.verified ? `<button class="btn sm ${used.has(c.app) ? 'primary' : ''}" data-act="fix-conn" data-app="${c.app}" data-test="fix-${c.app}">${ic(used.has(c.app) ? 'bot' : 'link')}${used.has(c.app) ? 'Fix it' : c.state === 'connected' ? 'Check' : 'Connect'}</button>` : ''}</div>`).join('')}</div>
      <p class="indep">Concludo is independent. Outlook, Gmail, Google Calendar, Microsoft To Do, Slack, Microsoft Teams, Google Sheets and HubSpot are named only as apps a workflow can send to. Concludo is not affiliated with or endorsed by any of them.</p></div>`;
  }
  function createView(b) {
    const manual = b.mode === 'manual';
    return `<div class="stageA">
      <div class="eyebrow" style="justify-content:center">Create a workflow</div>
      <h1>${manual ? 'Build it step by step' : 'Describe what should happen'}</h1>
      <p>${manual ? 'Choose when it runs, then add each step yourself from the palette. Concludo still adds an approval before anything leaves Concludo.' : 'Write it the way you would say it. The AI agent workflow builder creates your automation using natural language, adds an approval before anything leaves Concludo, and shows you what it did not understand.'}</p>
      <div class="seg modes" role="tablist" aria-label="How to build"><button class="${manual ? '' : 'on'}" data-act="mode" data-m="describe" role="tab" data-test="mode-describe">${ic('spark')}Describe it</button><button class="${manual ? 'on' : ''}" data-act="mode" data-m="manual" role="tab" data-test="mode-manual">${ic('flow')}Build manually</button></div>
      ${manual ? `<div class="describe manual" data-test="manual-form">
          <div class="field"><label for="mname">Workflow name</label><input id="mname" data-bind="mname" data-autofocus value="${esc(b.mname)}" placeholder="For example: Client follow-up"></div>
          <div class="grid2"><div class="field"><label for="mtrig">When should it run?</label><select id="mtrig" data-bind="mtrig">${Object.entries(C.TRIGGERS).map(([k, t]) => `<option value="${k}" ${b.mtrig === k ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>
          ${b.mtrig === 'workflow_schedule' ? `<div class="field"><label for="msched">Schedule</label><select id="msched" data-bind="msched">${['Every Monday', 'Every weekday', 'Every Friday', 'Daily', 'First Monday of the month'].map((x) => `<option ${b.msched === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : '<div></div>'}</div>
          <div class="row"><span class="small muted">${esc(trigOf(b.mtrig).hint)}.</span><button class="btn primary" data-act="manual-start" data-test="manual-start">${ic('plus')}Start building</button></div></div>`
      : `<div class="describe"><label class="sr" for="describe">Describe the workflow</label><textarea id="describe" data-bind="draftText" data-autofocus placeholder="After each meeting, summarise it, add the actions to the tracker, then email the attendees">${esc(b.draftText || '')}</textarea>
          <div class="row"><span class="small muted">AI agent workflow builder: creates automation from natural language.</span><button class="btn primary" data-act="plan" data-test="plan">${ic('spark')}Build it</button></div></div>
        <div class="examples">${EXAMPLES.map((e, i) => `<button data-act="example" data-i="${i}">${esc(e)}</button>`).join('')}</div>`}
      <div class="eyebrow" style="justify-content:center;margin-top:${manual ? 28 : 0}px">Or start from a template</div>
      <div class="tpls" style="text-align:left;margin-top:10px">${C.TEMPLATES.map((t) => `<button class="tpl" data-act="from-template" data-k="${t.key}"><b>${esc(t.name)}</b><span>${esc(t.summary)}</span></button>`).join('')}</div>
    </div>`;
  }
  function nodeHtml(s, i, issuesFor, x, y) {
    const spec = actOf(s.action);
    const cls = spec.kind === 'approval' ? 'approval' : spec.kind === 'only_if' ? 'cond' : appOf(s.app).external ? 'ext' : '';
    const kind = spec.kind === 'approval' ? 'A person approves' : spec.kind === 'only_if' ? 'Condition' : appOf(s.app).external ? `Leaves Concludo · ${appOf(s.app).label}` : 'Inside Concludo';
    const bad = issuesFor(s.id).length;
    return `<button class="node ${cls} ${S.b.sel === s.id ? 'sel' : ''} ${bad ? 'issue' : ''}" style="left:${x - 28}px;top:${y}px" data-act="select" data-s="${s.id}" data-test="node-${i}"><span class="n-box"><span class="n-ic">${ic(STEP_IC(s))}</span>${bad ? `<span class="n-bad">${ic('alert')}Fix</span>` : s.autoAdded ? '<span class="n-new">Added</span>' : ''}</span><span class="n-t"><b>${esc(s.label)}</b><span class="kind">${esc(kind)}</span></span></button>`;
  }
  function graph(wf, issuesFor, cols) {
    const items = [{ t: 'trigger' }, ...wf.steps.map((s, i) => ({ t: 'step', s, i })), { t: 'end' }];
    const rows = Math.ceil(items.length / cols);
    const W = PADX * 2 + cols * NODE + (cols - 1) * GAPX;
    const H = PADY + rows * ROWH - 30;
    const at = (k) => { const c = k % cols, r = Math.floor(k / cols); return { x: PADX + c * (NODE + GAPX), y: PADY + r * ROWH, r }; };
    const R = 12;
    let paths = '', plus = '', nodes = '', ports = '';
    items.forEach((it, k) => {
      const p = at(k), yc = p.y + NODE / 2;
      if (it.t === 'trigger') {
        nodes += `<button class="node trigger ${S.b.sel === 'trigger' ? 'sel' : ''}" style="left:${p.x - 28}px;top:${p.y}px" data-act="select" data-s="trigger" data-test="node-trigger"><span class="n-box"><span class="n-ic">${ic('bolt')}</span></span><span class="n-t"><b>${esc(trigOf(wf.trigger && wf.trigger.type).label)}</b><span class="kind">When${wf.trigger.schedule ? ` · ${esc(wf.trigger.schedule)}` : ''}</span></span></button>`;
      } else if (it.t === 'step') nodes += nodeHtml(it.s, it.i, issuesFor, p.x, p.y);
      else nodes += `<button class="plus end-plus" style="left:${p.x + NODE / 2 - 22}px;top:${yc - 22}px" data-act="add-open" data-at="${wf.steps.length}" data-drop="${wf.steps.length}" aria-label="Add a step at the end" data-test="add-end">${ic('plus')}</button>`;
      const left = it.t === 'end' ? p.x + NODE / 2 - 22 : p.x, right = p.x + NODE;
      if (k > 0) ports += `<circle cx="${left}" cy="${yc}" r="5" class="port"/>`;
      if (k < items.length - 1) ports += `<circle cx="${right}" cy="${yc}" r="5" class="port"/>`;
      if (k < items.length - 1) {
        const q = at(k + 1), nyc = q.y + NODE / 2, nIsEnd = items[k + 1].t === 'end';
        const x2 = nIsEnd ? q.x + NODE / 2 - 22 : q.x;
        const bad = items[k + 1].t === 'step' && issuesFor(items[k + 1].s.id).length;
        if (q.r === p.r) {
          paths += `<path class="wire ${bad ? 'bad' : ''}" d="M${right + 5} ${yc} H${x2 - 7}" marker-end="url(#arr)"/>`;
          if (!nIsEnd) plus += `<button class="plus" style="left:${(right + x2) / 2 - 11}px;top:${yc - 11}px" data-act="add-open" data-at="${k}" data-drop="${k}" aria-label="Add a step here">${ic('plus')}</button>`;
        } else {
          const xa = right + 38, xb = PADX - 26, yr = p.y + NODE + 82;
          paths += `<path class="wire ${bad ? 'bad' : ''}" d="M${right + 5} ${yc} H${xa - R} Q${xa} ${yc} ${xa} ${yc + R} V${yr - R} Q${xa} ${yr} ${xa - R} ${yr} H${xb + R} Q${xb} ${yr} ${xb} ${yr + R} V${nyc - R} Q${xb} ${nyc} ${xb + R} ${nyc} H${x2 - 7}" marker-end="url(#arr)"/>`;
          if (!nIsEnd) plus += `<button class="plus" style="left:${(xa + xb) / 2 - 11}px;top:${yr - 11}px" data-act="add-open" data-at="${k}" data-drop="${k}" aria-label="Add a step here">${ic('plus')}</button>`;
        }
      }
    });
    return `<div class="graph" style="width:${W}px;height:${H}px" data-cols="${cols}" data-test="graph"><svg class="wires" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs><marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M1 1.5L8 5 1 8.5z" class="arrowhead"/></marker></defs>${paths}${ports}</svg>${nodes}${plus}</div>`;
  }
  function stepsList(wf, issuesFor) {
    return `<div class="stepsview"><button class="row" data-act="select" data-s="trigger"><span class="no">${ic('bolt')}</span><span><b>${esc(trigOf(wf.trigger && wf.trigger.type).label)}</b><br><span class="small muted">${esc(wf.trigger.schedule || 'Trigger')}</span></span><span></span></button>${wf.steps.map((s, i) => `<button class="row" data-act="select" data-s="${s.id}"><span class="no">${i + 1}</span><span><b>${esc(s.label)}</b><br><span class="small muted">${esc(actOf(s.action).explain(s))}</span></span>${issuesFor(s.id).length ? '<span class="pill bad">Fix</span>' : `<span class="appb ${appOf(s.app).external ? 'ext' : ''}">${esc(appOf(s.app).label)}</span>`}</button>`).join('')}</div>`;
  }
  function guarding(wf, idx) {
    // An approval is required if removing it leaves an external step unguarded.
    const test = { ...wf, steps: wf.steps.filter((_, i) => i !== idx) };
    let guarded = false;
    for (const s of test.steps) { if (actOf(s.action).kind === 'approval') guarded = true; if (actOf(s.action).kind === 'do' && appOf(s.app).external && !guarded) return true; }
    return false;
  }
  function inspector(wf, issues) {
    if (S.b.sel === 'trigger') {
      return `<aside class="inspector" aria-label="Trigger"><div class="i-h"><h3>When should it run?</h3><button class="btn ghost sm" data-act="deselect" aria-label="Close">${ic('x')}</button></div><div class="i-b">
        <div class="field"><label for="trig">Trigger</label><select id="trig" data-edit="trigger">${Object.entries(C.TRIGGERS).map(([k, t]) => `<option value="${k}" ${wf.trigger.type === k ? 'selected' : ''}>${esc(t.label)}</option>`).join('')}</select></div>
        ${wf.trigger.type === 'workflow_schedule' ? `<div class="field"><label for="sched">Schedule</label><select id="sched" data-edit="schedule">${['Every Monday', 'Every weekday', 'Every Friday', 'Daily', 'First Monday of the month'].map((x) => `<option ${wf.trigger.schedule === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>` : ''}
        <div class="note">${esc(trigOf(wf.trigger && wf.trigger.type).hint)}.</div></div></aside>`;
    }
    const idx = wf.steps.findIndex((s) => s.id === S.b.sel);
    if (idx < 0) return '';
    const s = wf.steps[idx];
    const spec = actOf(s.action);
    const locked = spec.kind === 'approval' && guarding(wf, idx);
    const own = (issues || []).filter((i) => i.stepId === s.id && i.level === 'block');
    return `<aside class="inspector" aria-label="Step settings"><div class="i-h"><h3>${esc(s.label)}</h3><button class="btn ghost sm" data-act="deselect" aria-label="Close">${ic('x')}</button></div>
      <div class="i-b">
        ${own.map((i) => `<div class="check block" style="margin-bottom:10px"><span class="dot">${ic('x')}</span><span>${esc(i.text)}${i.fix === 'connect' ? `<div class="fix"><button class="btn sm primary" data-act="fix-conn" data-app="${s.app}" data-test="fix-conn-inspector">${ic('bot')}Fix it</button></div>` : i.fix === 'add_approval' ? `<div class="fix"><button class="btn sm primary" data-act="fix-approval">${ic('stamp')}Fix it</button></div>` : ''}</span></div>`).join('')}
        ${spec.apps.length > 1 ? `<div class="field"><label for="app">App</label><select id="app" data-edit="app">${spec.apps.map((a) => `<option value="${a}" ${s.app === a ? 'selected' : ''}>${esc(appOf(a).label)}</option>`).join('')}</select></div>` : ''}
        ${spec.fields.filter((f) => !(f.key === 'address' && s.settings.to !== 'custom')).map((f) => `<div class="field"><label for="f-${f.key}">${esc(f.label)}${f.required ? '' : ' (optional)'}</label>${f.kind === 'select' ? `<select id="f-${f.key}" data-edit="set:${f.key}">${f.options.map((o) => `<option value="${o.value}" ${s.settings[f.key] === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>` : `<input id="f-${f.key}" data-edit="set:${f.key}" value="${esc(s.settings[f.key] || '')}" placeholder="${esc(f.placeholder || '')}">`}</div>`).join('')}
        <div class="note">${esc(spec.explain(s))}${appOf(s.app).external && spec.kind === 'do' ? ' It runs only after a person approves it.' : ''}</div>
        ${locked ? '<div class="note" style="margin-top:8px">This approval protects a later step that sends outside Concludo, so it cannot be removed.</div>' : ''}
      </div>
      <div class="i-f"><button class="btn sm" data-act="move" data-d="-1" ${idx === 0 ? 'disabled' : ''}>${ic('up')}Up</button><button class="btn sm" data-act="move" data-d="1" ${idx === wf.steps.length - 1 ? 'disabled' : ''}>${ic('down')}Down</button><span style="flex:1"></span><button class="btn sm" data-act="remove" ${locked ? 'disabled' : ''} data-test="remove-step">${ic('trash')}Remove</button></div></aside>`;
  }
  function timeline(steps) {
    return `<ol class="tl">${steps.map((s) => `<li class="${s.status}"><span class="st">${ic(STEP_ICON[s.status] || 'arrow')}</span><div><b>${esc(s.label)}</b><span>${esc(s.note || (s.status === 'pending' ? 'Not reached' : ''))}</span></div></li>`).join('')}</ol>`;
  }
  async function editWf(mutate, note) {
    const b = S.b;
    b.history.push(JSON.parse(JSON.stringify(b.wf)));
    if (b.history.length > 40) b.history.shift();
    mutate(b.wf);
    const g = C.ensureApprovals(b.wf, store);
    b.wf = g.workflow;
    b.wf.updatedAt = store.now();
    await store.saveWorkflow(b.wf);
    S.checks = null;
    if (g.added.length) toast(`Concludo added an approval before “${g.added.join('”, “')}”, because it sends something outside Concludo.`);
    else if (note) toast(note);
    await render(true);
  }
  function pickerModal(at) {
    const groups = [...new Set(Object.values(C.ACTIONS).map((a) => a.group))];
    return `<div class="modal-bg" data-act="close-modal"><div class="modal" role="dialog" aria-label="Add a step" data-stop>
      <div class="mh"><h2>Add a step</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><div class="picker">${groups.map((g) => `<div><h4>${esc(g)}</h4><div class="opts">${Object.values(C.ACTIONS).filter((a) => a.group === g && !a.hidden).flatMap((a) => a.apps.length > 1 && a.kind === 'do' ? a.apps.map((app) => ({ a, app })) : [{ a, app: a.apps[0] }]).map(({ a, app }) => `<button class="opt" data-act="add-step" data-k="${a.key}" data-app="${app}" data-at="${at}" data-test="pick-${a.key}-${app}"><b>${esc(a.label)}${a.apps.length > 1 ? ` (${esc(appOf(app).label)})` : ''}</b><span>${appOf(app).external && a.kind === 'do' ? 'Leaves Concludo: needs approval' : a.kind === 'approval' ? 'Stops until a person approves' : a.kind === 'only_if' ? 'Stops the workflow if the rule is not met' : 'Stays inside Concludo'}</span></button>`).join('')}</div></div>`).join('')}</div></div></div></div>`;
  }
  async function connectModal() {
    const checks = await getChecks(true);
    const canSim = typeof store.completeSignIn === 'function';
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Connect apps" data-stop>
      <div class="mh"><h2>Connected apps</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><div class="note">Each app is checked, not assumed. ${checks.some((c) => c.simulated) ? 'In this preview the check reads the sample record. In the Workspace it asks the app itself.' : ''} Only a person can sign in to an app.</div>
      <div class="conns">${checks.map((c) => `<div><span><b class="small">${esc(appOf(c.app).label)}</b><br><span class="small muted">${esc(c.detail)}</span></span><span class="pill ${c.state === 'connected' && c.verified ? 'good' : c.state === 'connected' ? 'line' : 'bad'}">${esc(connWords(c))}</span>${c.state === 'connected' && c.verified ? (canSim ? `<button class="btn sm" data-act="conn-toggle" data-k="${c.app}" title="Preview only">Preview: disconnect</button>` : '<span></span>') : `<button class="btn sm primary" data-act="fix-conn" data-app="${c.app}">${ic('bot')}${c.state === 'connected' ? 'Check' : 'Fix it'}</button>`}</div>`).join('')}</div></div></div></div>`;
  }
  /* The workflow repair agent: checks, retries, starts the sign-in, offers a connected alternative. It never signs in for a person and never sends anything. */
  function repairModal() {
    const R = S.repair, label = appOf(R.app).label, rep = R.report;
    const steps = R.steps.map((s) => `<li class="${s.status === 'done' ? 'done' : s.status === 'failed' ? 'failed' : 'previewed'}"><span class="st">${ic(s.status === 'done' ? 'check' : s.status === 'failed' ? 'x' : 'alert')}</span><div><b>${esc(s.label)}</b><span>${esc(s.note)}</span></div></li>`).join('');
    let head, foot;
    if (!rep) { head = `<div class="agentline"><span class="spin" aria-hidden="true"></span><span><b>Workflow repair agent is working</b><small>Checking ${esc(label)}. This takes a few seconds.</small></span></div>`; foot = ''; }
    else {
      const tone = rep.outcome === 'fixed' ? 'good' : rep.outcome === 'needs_person' ? 'warn' : 'bad';
      head = `<div class="banner ${tone}" data-test="repair-outcome" data-outcome="${rep.outcome}" style="margin:0">${ic(rep.outcome === 'fixed' ? 'check' : 'alert')}<span><b>${rep.outcome === 'fixed' ? 'Fixed' : rep.outcome === 'needs_person' ? 'Needs you' : 'Not fixed'}.</b> ${esc(rep.summary)}</span></div>`;
      const alts = rep.alternatives.map((a) => `<button class="btn sm" data-act="use-alt" data-step="${a.stepId}" data-app="${a.app}" data-test="use-alt-${a.app}">${ic('arrow')}Use ${esc(a.label)} for “${esc(a.stepLabel)}”</button>`).join('');
      foot = rep.outcome === 'fixed'
        ? `${R.runId ? `<button class="btn primary" data-act="repair-retry" data-test="repair-retry">${ic('undo')}Retry the run</button>` : ''}<button class="btn" data-act="close-modal">Close</button>`
        : `<div class="alts">${rep.outcome === 'needs_person' ? `<button class="btn primary" data-act="signin" data-app="${R.app}" data-test="signin">${ic('link')}Sign in to ${esc(label)}</button>` : ''}<button class="btn" data-act="recheck" data-test="recheck">${ic('undo')}Check again</button>${alts ? `<div class="alt-h small muted">Or change this workflow only. You can undo it.</div>${alts}` : ''}</div><button class="btn" data-act="close-modal">Close</button>`;
    }
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Fix the ${esc(label)} connection" data-stop>
      <div class="mh"><h2>${ic('bot')} Fix the ${esc(label)} connection</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb">${head}<ol class="tl rtl">${steps}</ol><div class="note">The repair agent checks the app, retries a service problem and starts the sign-in. It cannot sign in for you, it never sends anything, and it says Fixed only when a check confirms it.</div></div>
      ${foot ? `<div class="mf">${foot}</div>` : ''}</div></div>`;
  }
  function signinModal(app) {
    const label = appOf(app).label;
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Sign in to ${esc(label)}" data-stop>
      <div class="mh"><h2>Sign in to ${esc(label)}</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><div class="note">Preview sign-in. In the Workspace this opens ${esc(label)}'s own sign-in page, and Concludo never sees your password. Here it only stands in for that page.</div></div>
      <div class="mf"><button class="btn" data-act="signin-cancel">Back</button><button class="btn primary" data-act="signin-done" data-app="${app}" data-test="signin-done">Sign in as the sample account</button></div></div></div>`;
  }
  async function runRepair(app, wfId, runId) {
    let wf = wfId && wfId !== 'new' ? await store.getWorkflow(wfId) : null;
    if (!wf) {
      wf = C.blankWorkflow(store, S.actor, { type: 'meeting_completed' }, 'Draft workflow');
    }
    S.repair = { app, wfId: wf.id, runId, steps: [], report: null };
    S.modal = repairModal(); await render(true);
    await sleep(350);
    const rep = await C.repairConnection(store, wf, app, S.actor, { wait: (ms) => sleep(Math.min(ms, 500)), onStep: (s) => { S.repair.steps.push(s); S.modal = repairModal(); render(true); } });
    S.repair.report = rep;
    S.checks = null;
    S.modal = repairModal();
    await render(true);
  }

  /* ============================================================ RUN DIALOG */
  function runModal(wfId, name) {
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Run now" data-stop>
      <div class="mh"><h2>Run “${esc(name)}”</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><p class="small muted" style="margin:0">A live run uses real records. Anything that would leave Concludo stops at the approval step for you to check.</p>
        <div class="radio">
          ${[...ws.meetings].sort((a, b) => b.date.localeCompare(a.date)).map((m, i) => `<label><input type="radio" name="rin" value="m:${m.id}" ${i === 0 ? 'checked' : ''} data-test="rin-${m.id}"><span><b>${i === 0 ? 'The latest meeting' : 'Meeting'}: ${esc(m.title)}</b><span>${esc(C.auDate(m.date))} (sample)${!m.consent || m.consent === 'not_recorded' ? ' · No consent recorded: the run will be held' : ''}</span></span></label>`).join('')}
          <label><input type="radio" name="rin" value="open"><span><b>Open work across the workspace</b><span>${ws.actions.length} actions, ${ws.decisions.length} decisions, ${ws.risks.length} risks (sample)</span></span></label>
          <label><input type="radio" name="rin" value="empty"><span><b>Nothing</b><span>Shows what the workflow does with an empty input</span></span></label>
        </div></div>
      <div class="mf"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="run-go" data-id="${wfId}" data-test="run-go">${ic('play')}Run now</button></div></div></div>`;
  }
  function deleteModal(wfId, name) {
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Delete workflow" data-stop>
      <div class="mh"><h2>${ic('trash')} Delete workflow</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><p style="margin:0;font-size:14px;line-height:1.5;">Are you sure you want to delete <b>“${esc(name)}”</b>? This action permanently removes this saved workflow.</p></div>
      <div class="mf"><button class="btn" data-act="close-modal">Cancel</button><button class="btn danger" data-act="delete-confirm" data-id="${wfId}" data-test="delete-confirm">${ic('trash')}Delete workflow</button></div></div></div>`;
  }
  const inputFor = (k) => (k === 'open' ? scheduleInput(ws) : k === 'empty' ? {} : k && k.startsWith('m:') ? meetingInput(ws, k.slice(2)) : meetingInput(ws, [...ws.meetings].sort((a, b) => b.date.localeCompare(a.date))[0].id));

  /* ============================================================ RUNS */
  async function vRuns(id, h, pending) {
    const all = await store.listRuns();
    const f = S.runsFilter;
    const runs = all.filter((r) => f === 'all' ? !r.test : f === 'tests' ? r.test : !r.test && r.status === f);
    const sel = all.find((r) => r.id === (id || S.runSel)) || runs[0];
    const counts = (st) => all.filter((r) => !r.test && r.status === st).length;
    const filters = [['all', 'All live runs'], ['requires_approval', `Waiting (${counts('requires_approval')})`], ['completed', 'Completed'], ['failed', `Failed (${counts('failed')})`], ['rejected', 'Rejected'], ['tests', 'Test runs']];
    return `<div class="wrap">
      <div class="head"><div><div class="eyebrow">Workflows</div><h1>Workflow runs</h1><p>Every run, what each step did with its input, and where it stopped. Failed runs can be retried; nothing is retried on its own.</p></div></div>
      ${fnTiles('runs', h, pending)}
      <div class="chips" style="margin-bottom:14px">${filters.map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="runs-filter" data-f="${k}">${esc(l)}</button>`).join('')}</div>
      <div class="twopane"><div class="list" data-test="runs-list"><div class="lh"><span>Workflow</span><span>Status</span><span>Steps</span><span>Started</span></div>
        ${runs.map((r) => `<button class="row ${sel && sel.id === r.id ? 'sel' : ''}" data-act="run-sel" data-id="${r.id}"><span><b>${esc(r.workflowName)}</b><small>By ${esc(r.startedBy)}${r.retryOf ? ' · retry' : ''}${r.test ? ' · test' : ''}</small></span><span><span class="pill ${pillOf(r)[1]}">${esc(pillOf(r)[0])}</span></span><span class="prog">${r.steps.map((s) => `<i class="${s.status}" title="${esc(s.label)}"></i>`).join('')}</span><small>${esc(when(r.startedAt))}</small></button>`).join('') || '<div class="empty"><b>No runs here</b>Runs appear when a workflow runs.</div>'}</div>
        ${sel ? await runDetail(sel) : '<div></div>'}</div>
    </div>`;
  }
  /* A run that failed because an app was not connected offers the same repair agent. */
  function connFix(r, wf) {
    if (r.test || r.status !== 'failed' || !wf) return '';
    const bad = r.steps.find((x) => x.status === 'failed');
    const st = bad && wf.steps.find((x) => x.id === bad.stepId);
    if (!st || !appOf(st.app).external || !/(not connected|signing in again|more permission|service problem)/.test(r.error || '')) return '';
    return `<button class="btn sm primary" data-act="fix-run-conn" data-app="${st.app}" data-wf="${wf.id}" data-run="${r.id}" data-test="fix-run-conn">${ic('bot')}Fix the ${esc(appOf(st.app).label)} connection</button>`;
  }
  async function runDetail(r) {
    const wf = await store.getWorkflow(r.workflowId);
    const inp = r.input || {};
    const inputLine = inp.meeting ? `Meeting: ${inp.meeting.title}` : (inp.actions || []).length ? `${plural(inp.actions.length, 'action')}, ${plural((inp.decisions || []).length, 'decision')}, ${plural((inp.risks || []).length, 'risk')}` : 'Empty input';
    return `<aside class="card detail" data-test="run-detail"><div class="card-h"><h2>${esc(r.workflowName)}</h2><span class="pill ${pillOf(r)[1]}">${esc(pillOf(r)[0])}</span></div><div class="card-b">
      ${r.error ? `<div class="banner bad" style="margin:0">${ic('alert')}<span>${esc(r.error)}</span></div>` : ''}
      <dl class="kv"><dt>Started</dt><dd>${esc(new Date(r.startedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }))} by ${esc(r.startedBy)}</dd><dt>Input</dt><dd>${esc(inputLine)}</dd>${r.test ? '<dt>Type</dt><dd>Test run. Nothing was sent.</dd>' : ''}${r.retryOf ? '<dt>Retry of</dt><dd><a href="' + toUrl('#runs/' + r.retryOf) + '">earlier run</a></dd>' : ''}</dl>
      ${timeline(r.steps)}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${r.status === 'requires_approval' && r.approvalId ? `<a class="btn primary sm" href="${toUrl('#approvals/' + r.approvalId)}" data-test="open-approval">${ic('stamp')}Open the approval</a>` : ''}${(r.status === 'failed' || r.status === 'cancelled') && !r.test ? `<button class="btn sm primary" data-act="retry" data-id="${r.id}" ${wf && wf.status === 'active' ? '' : 'disabled title="Resume the workflow first"'}>${ic('undo')}Retry</button>` : ''}${wf ? `<a class="btn sm" href="${toUrl('#builder/' + wf.id)}">Open workflow</a>` : ''}${connFix(r, wf)}</div>
    </div></aside>`;
  }

  /* ============================================================ APPROVALS */
  async function vApprovals(id, h, pending) {
    const all = await store.listApprovals();
    const list = all.filter((a) => S.apTab === 'waiting' ? a.status === 'pending' : a.status !== 'pending');
    const sel = all.find((a) => a.id === (id || S.apSel)) || list[0];
    if (sel && id && sel.status !== 'pending' && S.apTab === 'waiting') S.apTab = 'decided';
    return `<div class="wrap">
      <div class="head"><div><div class="eyebrow">Workflows</div><h1>Approval Centre</h1><p>Nothing leaves Concludo until a person approves it here. You see exactly what will be sent, and to whom, before you decide.</p></div></div>
      ${fnTiles('approvals', h, pending)}
      <div class="inbox"><div class="ilist" data-test="ap-list"><div class="tabs"><button class="${S.apTab === 'waiting' ? 'on' : ''}" data-act="ap-tab" data-t="waiting">Waiting (${pending})</button><button class="${S.apTab === 'decided' ? 'on' : ''}" data-act="ap-tab" data-t="decided">Decided</button></div>
        ${list.map((a) => `<button class="it ${sel && sel.id === a.id ? 'sel' : ''}" data-act="ap-sel" data-id="${a.id}"><b>${esc(a.title)}</b><small>${esc(plural(a.outgoing.length, 'item'))} · ${esc(a.kind === 'agent_draft' ? 'Agent draft' : 'Workflow')} · ${esc(when(a.requestedAt))}${a.status !== 'pending' ? ` · ${esc(a.status)}` : ''}</small></button>`).join('') || `<div class="empty"><b>${S.apTab === 'waiting' ? 'Nothing waiting' : 'No decisions yet'}</b>${S.apTab === 'waiting' ? 'You are up to date.' : ''}</div>`}</div>
        ${sel ? await apDetail(sel) : '<div></div>'}</div>
    </div>`;
  }
  async function apDetail(a) {
    const wf = a.workflowId ? await store.getWorkflow(a.workflowId) : null;
    const blocked = a.status === 'pending' && wf && wf.status === 'paused';
    const run = a.runId ? await store.getRun(a.runId) : null;
    return `<section class="card ap-detail" data-test="ap-detail"><div class="card-h"><div><div class="eyebrow">${a.kind === 'agent_draft' ? 'Agent draft' : 'Workflow approval'}</div><h2>${esc(a.title)}</h2></div><span class="pill ${a.status === 'pending' ? 'gold' : a.status === 'approved' ? 'good' : a.status === 'rejected' ? 'warn' : 'line'}">${esc(a.status === 'pending' ? 'Waiting' : a.status[0].toUpperCase() + a.status.slice(1))}</span></div><div class="card-b">
      <dl class="kv"><dt>Source</dt><dd>${esc(a.source)}</dd><dt>Requested</dt><dd>${esc(when(a.requestedAt))} by ${esc(a.requestedBy)}</dd>${run ? `<dt>Run</dt><dd><a href="${toUrl('#runs/' + run.id)}">${esc(RUN_PILL[run.status][0])}</a></dd>` : ''}${a.decidedBy ? `<dt>Decided</dt><dd>${esc(a.status)} by ${esc(a.decidedBy)}${a.note ? `: “${esc(a.note)}”` : ''}</dd>` : ''}</dl>
      ${blocked ? `<div class="banner bad" style="margin:0">${ic('alert')}<span><b>${wf.pausedBy === 'workspace_stop' ? 'All workflows are stopped.' : 'This workflow is paused.'}</b> Resume it in the <a href="${toUrl('#governance')}">Governance Centre</a> before approving. This request keeps waiting.</span></div>` : ''}
      <div><div class="eyebrow">${a.status === 'pending' ? 'If you approve' : 'What was approved'}</div><div class="outgoing">${a.outgoing.length ? a.outgoing.map((o) => `<div class="og"><div class="oh"><b>${esc(o.what)}</b><span class="muted">To: ${esc(o.to)}</span></div><pre>${esc(o.preview)}</pre></div>`).join('') : '<div class="note">Nothing would leave Concludo.</div>'}</div></div>
      ${a.kind === 'agent_draft' ? '<div class="note">Approving marks the draft ready. Concludo never sends agent drafts: copy it into your mail app.</div>' : ''}
      ${a.status === 'pending' ? `<div class="decide"><div class="field" style="margin:0"><label for="apnote">Note (required to reject)</label><textarea id="apnote" rows="2" data-bind="apNote" placeholder="Why you are approving or rejecting">${esc(S.apNote || '')}</textarea></div>
        <div class="btns"><button class="btn primary" data-act="ap-decide" data-d="approve" data-id="${a.id}" data-test="approve" ${blocked ? 'disabled' : ''}>${ic('check')}Approve and continue</button><button class="btn" data-act="ap-decide" data-d="reject" data-id="${a.id}" data-test="reject">${ic('x')}Reject</button></div></div>` : ''}
    </div></section>`;
  }

  /* ============================================================ GOVERNANCE */
  async function vGovernance(h, pending) {
    const wfs = await store.listWorkflows();
    const incidents = await store.listIncidents();
    const auditLog = (await store.listAudit()).slice(0, 40);
    return `<div class="wrap">
      <div class="head"><div><div class="eyebrow">Workflows</div><h1>Governance Centre</h1><p>One place to stop, pause and check your workflows. Every control here changes the same records Runs and Approvals read, so a stop takes effect everywhere at once.</p></div></div>
      ${fnTiles('governance', h, pending)}
      <section class="gov-status ${h.stopped ? 'stopped' : 'running'}" data-test="gov-status">
        <div><h2>${h.stopped ? 'All workflows are stopped' : 'Workflows are running normally'}</h2><p>${h.stopped ? 'Nothing runs and nothing can be approved. Releasing turns back on only the workflows the stop paused.' : 'Stopping pauses every active workflow at once. Waiting approvals stay waiting until you release it.'}</p></div>
        ${h.stopped ? `<button class="btn navy" data-act="release" data-test="release">${ic('play')}Release the stop</button>` : `<div class="stopform"><label class="sr" for="stopreason">Reason</label><input id="stopreason" data-bind="stopReason" placeholder="Reason, kept in the audit log" value="${esc(S.stopReason || '')}"><button class="btn danger" data-act="stop" data-test="stop">${ic('pause')}Stop all workflows</button></div>`}
      </section>
      <div class="tiles">
        <div class="tile"><b>${h.runs7d}</b><span>Runs this week</span><small>${h.completed7d} completed, ${h.failed7d} failed</small></div>
        <div class="tile"><b>${h.successRate === null ? 'n/a' : h.successRate + '%'}</b><span>Finished successfully</span><small>${h.successRate === null ? 'No finished runs yet' : 'Of runs that finished'}</small></div>
        <div class="tile ${pending ? 'alert' : ''}"><b>${pending}</b><span>Waiting for approval</span><small>${h.oldestWaitHours === null ? 'None waiting' : h.oldestWaitHours < 1 ? 'Oldest under 1 hour' : `Oldest ${h.oldestWaitHours} h`}</small></div>
        <div class="tile ${h.openIncidents ? 'alert' : ''}"><b>${h.openIncidents}</b><span>Open incidents</span><small>Opened when a run fails</small></div>
        <div class="tile"><b>${h.pausedWorkflows}</b><span>Paused workflows</span><small>${h.quarantined} after repeated failures</small></div>
      </div>
      <div class="govgrid"><div style="display:grid;gap:18px">
        <section class="card"><div class="card-h"><h2>Workflows</h2><span class="small muted">Switch any workflow off here</span></div><div class="card-b" style="overflow-x:auto">
          <table class="tbl"><thead><tr><th>Workflow</th><th>State</th><th>Failures in a row</th><th>On</th></tr></thead><tbody>
          ${wfs.map((w) => `<tr><td><a href="${toUrl('#builder/' + w.id)}">${esc(w.name)}</a></td><td>${statusPill(w)}</td><td>${w.consecutiveFailures || 0} of ${C.QUARANTINE_AFTER}</td><td><button class="switch ${w.status === 'active' ? 'on' : ''}" role="switch" aria-checked="${w.status === 'active'}" aria-label="${esc(w.name)} on or off" data-act="toggle" data-id="${w.id}"></button></td></tr>`).join('')}
          </tbody></table></div></section>
        <section class="card"><div class="card-h"><h2>Incidents</h2><span class="small muted">One per failed run</span></div><div class="card-b" style="display:grid;gap:10px" data-test="incidents">
          ${incidents.length ? incidents.map((i) => `<div class="inc"><div class="ih"><div><b>${esc(wfs.find((w) => w.id === i.workflowId)?.name || 'Workflow')}: ${esc(i.stepLabel)}</b><div class="small muted">${esc(i.message)}</div><div class="small muted">${esc(when(i.createdAt))} · <a href="${toUrl('#runs/' + i.runId)}">the run</a></div></div><span class="pill ${i.status === 'resolved' ? 'good' : 'bad'}">${i.status === 'resolved' ? 'Resolved' : i.severity}</span></div>
            ${i.status === 'resolved' ? `<div class="small muted">Resolved by ${esc(i.resolvedBy)}: ${esc(i.resolution)}</div>` : `<form data-act-form="resolve" data-id="${i.id}"><label class="sr" for="res-${i.id}">What fixed it</label><input id="res-${i.id}" name="res" placeholder="What fixed it"><button class="btn sm">Resolve</button></form>`}</div>`).join('') : '<div class="empty"><b>No incidents</b>A failed run opens one here.</div>'}
        </div></section></div>
        <div style="display:grid;gap:18px">
        <section class="card"><div class="card-h"><h2>Always on</h2></div><div class="card-b rules">
          <div class="rule"><span class="ri">${ic('stamp')}</span><span><b>A person approves anything that leaves Concludo</b><span class="small muted">The builder adds the approval step and will not turn a workflow on without it.</span></span></div>
          <div class="rule"><span class="ri">${ic('pause')}</span><span><b>Paused after ${C.QUARANTINE_AFTER} failures in a row</b><span class="small muted">The workflow stops itself and opens an incident for each failure.</span></span></div>
          <div class="rule"><span class="ri">${ic('shield')}</span><span><b>Measure work, never people</b><span class="small muted">Workflows that score, rank or monitor individuals cannot be built.</span></span></div>
          <div class="rule"><span class="ri">${ic('doc')}</span><span><b>Only what the input contains</b><span class="small muted">Empty input means nothing to do, never sample content.</span></span></div>
          <div class="rule"><span class="ri">${ic('cal')}</span><span><b>Approvals expire after 72 hours</b><span class="small muted">The run is cancelled, not sent late.</span></span></div>
        </div></section>
        <section class="card"><div class="card-h"><h2>Audit log</h2><span class="small muted">Latest ${auditLog.length}</span></div><div class="card-b audit" data-test="audit">${auditLog.map((e) => `<div><span class="muted">${esc(when(e.at))}</span><span class="ev">${esc(e.event.replace(/_/g, ' '))}</span><span>${esc(e.actor)}: ${esc(e.detail)}</span></div>`).join('')}</div></section>
        </div></div>
    </div>`;
  }

  /* ============================================================ events */
  let toastTimer;
  function toast(msg, bad) {
    document.querySelector('.cma-toast')?.remove();
    const t = document.createElement('div');
    t.className = `toast cma-toast ${bad ? 'bad' : ''}`;
    t.setAttribute('role', 'status');
    t.innerHTML = `${ic(bad ? 'alert' : 'check')}<span>${esc(msg)}</span>`;
    document.body.appendChild(t);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 3800);
  }
  async function guarded(fn) {
    try { await fn(); } catch (e) { toast(e.message || 'Something went wrong.', true); await render(true); }
  }

  root.addEventListener('click', (ev) => guarded(async () => {
    const t = ev.target.closest('[data-act]');
    if (!t) return;
    if (t.matches('.modal-bg') && ev.target.closest('[data-stop]')) return;
    const act = t.dataset.act;
    const wfOf = async (id) => store.getWorkflow(id);
    switch (act) {
      case 'agent-run': {
        await runAgentNow(t.dataset.k);
        S.agentOpen = t.dataset.k;
        return render(true);
      }
      case 'jump': { ev.preventDefault(); document.getElementById(`grp-${t.dataset.g.replace(/\W+/g, '-').toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
      case 'open-wf': { if (ev.target.closest('a,button,input,select,label')) return; return go(`#builder/${t.dataset.id}`); }
      case 'deck-approve': {
        const res = S.agentResults[S.agentOpen];
        await C.requestDraftApproval(store, { title: `Board pack: ${res.deck[0].subtitle}`, actor: S.actor, source: 'Board pack agent', items: [{ stepId: 'board_pack_deck', app: 'concludo', what: 'Board pack outline', to: 'The people you choose when sharing', preview: AG.deckToText(res.deck) }] });
        toast('Sent to the Approval Centre.');
        return render(true);
      }
      case 'deck-copy': { try { await navigator.clipboard.writeText(AG.deckToText(S.agentResults[S.agentOpen].deck)); toast('Outline copied.'); } catch (e) { toast('Copy is not available here. Select the text instead.', true); } return; }
      case 'agent-open': S.agentOpen = t.dataset.k; return render(true);
      case 'close-drawer': S.agentOpen = null; return render(true);
      case 'draft-approve': {
        const res = S.agentResults[S.agentOpen];
        const d = res.drafts[+t.dataset.i];
        const def = AG.AGENTS.find((a) => a.key === S.agentOpen);
        await C.requestDraftApproval(store, { title: d.subject, actor: S.actor, source: `${def.name} agent`, items: [{ stepId: `${def.key}_${t.dataset.i}`, app: 'concludo', what: 'Email draft', to: d.to, preview: `Subject: ${d.subject}\n\n${d.body}` }] });
        toast('Sent to the Approval Centre.');
        return render(true);
      }
      case 'draft-copy': { const d = S.agentResults[S.agentOpen].drafts[+t.dataset.i]; try { await navigator.clipboard.writeText(`Subject: ${d.subject}\n\n${d.body}`); toast('Draft copied.'); } catch (e) { toast('Copy is not available here. Select the text instead.', true); } return; }
      case 'from-template': { const wf = C.workflowFromTemplate(store, t.dataset.k, S.actor); await store.saveWorkflow(wf); S.b = null; return go(`#builder/${wf.id}`); }
      case 'example': S.b = { ...(S.b || {}), id: 'new', wf: null, history: [], draftText: EXAMPLES[+t.dataset.i] }; return render(true);
      case 'plan': {
        const text = (S.b?.draftText || '').trim();
        if (!text) return toast('Describe what should happen first.', true);
        const p = C.planFromDescription(text, store, S.actor);
        await store.saveWorkflow(p.workflow);
        S.b = { id: p.workflow.id, wf: p.workflow, history: [], view: 'diagram', sel: null, test: null, plan: p, planFor: p.workflow.id, bottom: false };
        return go(`#builder/${p.workflow.id}`);
      }
      case 'toggle': {
        const wf = await wfOf(t.dataset.id);
        await C.setActive(store, wf.id, wf.status !== 'active', S.actor);
        toast(wf.status === 'active' ? `${wf.name} paused.` : `${wf.name} is on.`);
        return render(true);
      }
      case 'run-open': { const wf = await wfOf(t.dataset.id); S.modal = runModal(wf.id, wf.name); return render(true); }
      case 'delete-wf': {
        const wf = await wfOf(t.dataset.id);
        if (!wf) return;
        S.modal = deleteModal(wf.id, wf.name);
        return render(true);
      }
      case 'delete-confirm': {
        const id = t.dataset.id;
        S.modal = null;
        const wf = await wfOf(id);
        const name = wf ? wf.name : 'Workflow';
        await store.deleteWorkflow(id);
        await store.appendAudit({ id: store.id('aud'), at: store.now(), actor: S.actor, event: 'workflow_deleted', objectType: 'workflow', objectId: id, detail: `Deleted workflow “${name}”.` });
        toast(`“${name}” deleted.`);
        if (S.b && S.b.id === id) {
          S.b = null;
          return go('#workflows');
        }
        return render(true);
      }
      case 'close-modal': if (ev.target === t || t.tagName === 'BUTTON') { S.modal = null; return render(true); } return;
      case 'run-go': {
        const k = root.querySelector('input[name="rin"]:checked')?.value || '';
        S.modal = null;
        const run = await C.runWorkflow(store, t.dataset.id, { input: inputFor(k), actor: S.actor });
        toast(run.status === 'requires_approval' ? 'Run started. It is waiting for approval.' : run.status === 'cancelled' && run.error ? 'Run held: no consent basis recorded for that meeting.' : `Run ${RUN_PILL[run.status][0].toLowerCase()}.`, run.status === 'failed' || run.status === 'cancelled');
        S.runsFilter = 'all';
        return go(`#runs/${run.id}`);
      }
      case 'view': S.b.view = t.dataset.v; return render(true);
      case 'select': S.b.sel = t.dataset.s; return render(true);
      case 'deselect': S.b.sel = null; return render(true);
      case 'add-open': S.modal = pickerModal(+t.dataset.at); return render(true);
      case 'add-step': {
        const at = +t.dataset.at;
        const step = C.newStep(store, t.dataset.k, t.dataset.app);
        S.modal = null;
        S.b.sel = step.id;
        return editWf((wf) => wf.steps.splice(at, 0, step), `${step.label} added.`);
      }
      case 'remove': { const id = S.b.sel; S.b.sel = null; return editWf((wf) => { wf.steps = wf.steps.filter((s) => s.id !== id); }, 'Step removed.'); }
      case 'move': {
        const d = +t.dataset.d;
        return editWf((wf) => { const i = wf.steps.findIndex((s) => s.id === S.b.sel); const j = i + d; if (j < 0 || j >= wf.steps.length) return; [wf.steps[i], wf.steps[j]] = [wf.steps[j], wf.steps[i]]; });
      }
      case 'undo': { const prev = S.b.history.pop(); if (prev) { S.b.wf = prev; await store.saveWorkflow(prev); toast('Undone.'); } return render(true); }
      case 'fix-approval': return editWf(() => {}, 'Approval added.');
      case 'connect-open': S.modal = await connectModal(); return render(true);
      case 'conn-toggle': { const k = t.dataset.k; if (typeof store.completeSignIn !== 'function') return; store.connections[k] = store.connections[k] === 'connected' ? 'disconnected' : 'connected'; S.modal = await connectModal(); return render(true); }
      case 'check-apps': { const cs = await getChecks(true); toast(cs.some((c) => c.simulated) ? 'Checked all apps. Checked against the saved connections.' : 'Checked all apps.'); return render(true); }
      case 'fix-conn': { const wfId = S.b?.wf?.id || S.repair?.wfId || 'new'; return runRepair(t.dataset.app, wfId, S.repair?.runId && S.repair.wfId === wfId ? S.repair.runId : null); }
      case 'fix-run-conn': return runRepair(t.dataset.app, t.dataset.wf, t.dataset.run);
      case 'recheck': return runRepair(S.repair.app, S.repair.wfId, S.repair.runId);
      case 'signin': {
        const app = t.dataset.app;
        if (opts.onSignIn) { const done = await opts.onSignIn(app); return runRepair(app, S.repair.wfId, S.repair.runId); }
        if (typeof store.completeSignIn !== 'function') { toast('Open Connect App in the Workspace to sign in, then press Check again.', true); return; }
        S.modal = signinModal(app); return render(true);
      }
      case 'signin-cancel': S.modal = repairModal(); return render(true);
      case 'signin-done': { if (typeof store.completeSignIn === 'function') store.completeSignIn(t.dataset.app); return runRepair(t.dataset.app, S.repair.wfId, S.repair.runId); }
      case 'use-alt': {
        const wf = await store.getWorkflow(S.repair.wfId);
        const before = JSON.parse(JSON.stringify(wf));
        await C.applyAlternative(store, wf, t.dataset.step, t.dataset.app, S.actor);
        if (S.b && S.b.wf && S.b.wf.id === wf.id) S.b.history.push(before);
        S.modal = null; S.checks = null;
        toast(`That step now uses ${appOf(t.dataset.app).label}. Undo puts it back.`);
        return render(true);
      }
      case 'repair-retry': {
        const run = await C.retryRun(store, S.repair.runId, S.actor);
        S.modal = null;
        toast('Retried as a new run.');
        return go(`#runs/${run.id}`);
      }
      case 'ltab': S.b.leftTab = t.dataset.t; return render(true);
      case 'mode': S.b = { ...(S.b || newB('new')), id: 'new', wf: null, mode: t.dataset.m }; return render(true);
      case 'manual-start': {
        const name = (S.b.mname || '').trim() || 'New workflow';
        const wf = C.blankWorkflow(store, S.actor, { type: S.b.mtrig, ...(S.b.mtrig === 'workflow_schedule' ? { schedule: S.b.msched } : {}) }, name);
        await store.saveWorkflow(wf);
        await store.appendAudit({ id: store.id('aud'), at: store.now(), actor: S.actor, event: 'workflow_created', objectType: 'workflow', objectId: wf.id, detail: `Started building “${name}” step by step.` });
        S.b = { ...newB(wf.id), id: wf.id, wf, leftTab: 'palette', mode: 'manual' };
        return go(`#builder/${wf.id}`);
      }
      case 'pal-add': {
        const wf = S.b.wf;
        const i = wf.steps.findIndex((x) => x.id === S.b.sel);
        const step = C.newStep(store, t.dataset.k, t.dataset.app);
        S.b.sel = step.id;
        return editWf((w) => w.steps.splice(i >= 0 ? i + 1 : w.steps.length, 0, step), `${step.label} added.`);
      }
      case 'test-open': S.b.bottom = true; return render(true);
      case 'bottom': S.b.bottom = !S.b.bottom; return render(true);
      case 'test-run': {
        S.b.test = await C.runWorkflow(store, S.b.wf.id, { input: inputFor(S.b.testInput || 'meeting'), actor: S.actor, test: true });
        S.b.bottom = true;
        return render(true);
      }
      case 'runs-filter': S.runsFilter = t.dataset.f; S.runSel = null; return go('#runs');
      case 'run-sel': S.runSel = t.dataset.id; return go(`#runs/${t.dataset.id}`);
      case 'retry': { const old = await store.getRun(t.dataset.id); const mid = old?.input?.meeting?.id; const run = await C.retryRun(store, t.dataset.id, S.actor, mid && ws.meetings.some((m) => m.id === mid) ? meetingInput(ws, mid) : undefined); toast('Retried as a new run.'); return go(`#runs/${run.id}`); }
      case 'ap-tab': S.apTab = t.dataset.t; S.apSel = null; return go('#approvals');
      case 'ap-sel': S.apSel = t.dataset.id; S.apNote = ''; return go(`#approvals/${t.dataset.id}`);
      case 'ap-decide': {
        const { approval, run } = await C.decideApproval(store, t.dataset.id, t.dataset.d, S.actor, S.apNote || '');
        S.apNote = '';
        toast(approval.status === 'approved' ? (run ? `Approved. The run ${RUN_PILL[run.status][0].toLowerCase()}.` : 'Approved. Copy the draft into your mail app.') : 'Rejected. The run was stopped.', run?.status === 'failed');
        return render(true);
      }
      case 'stop': {
        const n = await C.stopEverything(store, S.actor, S.stopReason || '');
        S.stopReason = '';
        toast(`${plural(n, 'workflow')} stopped.`);
        return render(true);
      }
      case 'release': { const n = await C.releaseStop(store, S.actor); toast(`${plural(n, 'workflow')} back on.`); return render(true); }
      default:
    }
  }));
  root.addEventListener('submit', (ev) => guarded(async () => {
    const fx = ev.target.closest('[data-fix]');
    if (fx) {
      ev.preventDefault();
      const res = S.agentResults[S.agentOpen];
      const fix = res.fixes.find((x) => x.id === fx.dataset.fix);
      const values = Object.fromEntries(new FormData(fx).entries());
      let detail = '';
      if (opts.onApplyFix) {
        detail = await opts.onApplyFix(fix, values);
      } else {
        const out = AG.applyFix(ws, fix, values);
        ws = out.data;
        detail = out.detail;
      }
      await store.appendAudit({ id: store.id('aud'), at: store.now(), actor: S.actor, event: 'record_updated', objectType: 'agent', objectId: fix.ref, detail });
      await runAgentNow(S.agentOpen);
      toast(detail);
      return render(true);
    }
    const f = ev.target.closest('[data-act-form="resolve"]');
    if (!f) return;
    ev.preventDefault();
    await C.resolveIncident(store, f.dataset.id, S.actor, f.querySelector('input').value);
    toast('Incident resolved.');
    await render(true);
  }));
  root.addEventListener('keydown', (ev) => {
    const card = ev.target.closest && ev.target.closest('.wf[data-act="open-wf"]');
    if (card && ev.target === card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); go(`#builder/${card.dataset.id}`); }
  });
  root.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.bind === 'draftText') S.b.draftText = t.value;
    if (t.dataset.bind === 'mname') S.b.mname = t.value;
    if (t.dataset.bind === 'apNote') S.apNote = t.value;
    if (t.dataset.bind === 'stopReason') S.stopReason = t.value;
  });
  root.addEventListener('change', (ev) => guarded(async () => {
    const t = ev.target;
    if (t.dataset.bind === 'testInput') { S.b.testInput = t.value; return; }
    if (t.dataset.bind === 'mtrig') { S.b.mtrig = t.value; return render(true); }
    if (t.dataset.bind === 'msched') { S.b.msched = t.value; return; }
    if (t.dataset.agentOpt) { const k = t.dataset.k; S.agentOpts[k] = { ...(S.agentOpts[k] || {}), [t.dataset.agentOpt]: t.dataset.agentOpt === 'periodDays' ? +t.value : t.value || undefined }; await runAgentNow(k); return render(true); }
    if (t.dataset.bind === 'wfname') return editWf((wf) => { wf.name = t.value.trim() || wf.name; }, 'Name saved.');
    const e = t.dataset.edit;
    if (!e) return;
    if (e === 'trigger') return editWf((wf) => { wf.trigger = { type: t.value, ...(t.value === 'workflow_schedule' ? { schedule: 'Every Monday' } : {}) }; });
    if (e === 'schedule') return editWf((wf) => { wf.trigger.schedule = t.value; });
    if (e === 'app') return editWf((wf) => { wf.steps.find((s) => s.id === S.b.sel).app = t.value; });
    if (e.startsWith('set:')) return editWf((wf) => { const st = wf.steps.find((s) => s.id === S.b.sel); const wasDefault = st.label === C.stepLabel(st); st.settings[e.slice(4)] = t.value; if (wasDefault) st.label = C.stepLabel(st); });
  }));
  const dropAt = (el) => { const d = el.closest('[data-drop]'); if (d) return +d.dataset.drop; return el.closest('.graph') ? S.b.wf.steps.length : null; };
  root.addEventListener('dragstart', (ev) => { const p = ev.target.closest && ev.target.closest('.pal'); if (!p) return; ev.dataTransfer.setData('text/plain', `${p.dataset.k}|${p.dataset.app}`); ev.dataTransfer.effectAllowed = 'copy'; root.classList.add('dragging'); });
  root.addEventListener('dragend', () => { root.classList.remove('dragging'); root.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); });
  root.addEventListener('dragover', (ev) => { if (!ev.target.closest || dropAt(ev.target) === null) return; ev.preventDefault(); root.querySelectorAll('.drop').forEach((x) => x.classList.remove('drop')); ev.target.closest('[data-drop]')?.classList.add('drop'); });
  root.addEventListener('drop', (ev) => guarded(async () => {
    const at = ev.target.closest ? dropAt(ev.target) : null;
    const [k, app] = (ev.dataTransfer.getData('text/plain') || '').split('|');
    if (at === null || !Object.prototype.hasOwnProperty.call(C.ACTIONS, k) || actOf(k).hidden) return;
    ev.preventDefault();
    root.classList.remove('dragging');
    const step = C.newStep(store, k, app);
    S.b.sel = step.id;
    return editWf((w) => w.steps.splice(at, 0, step), `${step.label} added.`);
  }));
  let rzT = 0;
  window.addEventListener('resize', () => { clearTimeout(rzT); rzT = setTimeout(() => { if (route().page !== 'builder' || !S.b?.wf) return; const w = root.clientWidth || 1200; const wide = w > 1100; const a = w - (wide ? 340 : 0) - (S.b.sel && wide ? 350 : 0); const c = Math.max(1, Math.min(6, Math.floor((a - PADX * 2 + GAPX) / (NODE + GAPX)))); if (c !== S.cols) render(true); }, 150); });
  if (!opts.usePathRouting) window.addEventListener('hashchange', () => { S.modal = null; S.agentOpen = null; render().then(() => window.scrollTo(0, 0)); });
  root.__cma = { store, S, render, space, get ws() { return ws; } };
  await render();
  return { store, render };
}
