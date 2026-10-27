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
const STEP_IC = (s) => (s.action === 'run_agent' ? 'bot' : s.action === 'ask_approval' ? 'stamp' : s.action === 'only_if' ? 'branch' : s.action === 'send_email' ? 'mail' : s.action === 'post_message' ? 'chat' : s.action === 'create_event' ? 'cal' : s.action === 'create_task' ? 'list' : s.action === 'add_crm_note' || s.action === 'add_sheet_row' ? 'db' : 'bolt');
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

export async function mountAutomation(root, opts = {}) {
  const store = opts.store || new C.MemoryStore();
  const today = opts.today || new Date().toISOString().slice(0, 10);
  let ws = opts.workspace || { today, me: opts.actor || 'User', meetings: [], actions: [], decisions: [], risks: [] };
  const S = {
    actor: opts.actor || 'Mara Ellis',
    agentResults: {}, agentActivity: [], agentOpen: null,
    agentOpts: {},
    b: null, runsFilter: 'all', runSel: null, apTab: 'waiting', apSel: null, modal: null,
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
      else if (window.location.pathname !== url) {
        window.history.pushState({}, '', url);
      }
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
    if (opts.embedded) {
      root.innerHTML = `
        ${body}
        <footer class="foot">Concludo is independent. Apps named here, such as Outlook, Gmail, Google Calendar, Microsoft To Do, Slack, Microsoft Teams, Google Sheets and HubSpot, are shown only as places a workflow can send to. Concludo is not affiliated with or endorsed by any of them.</footer>
        ${S.modal ? S.modal : ''}`;
    } else {
      root.innerHTML = `
        <header class="top">
          <img class="logo" src="${esc(logo)}" alt="Concludo">
          <nav class="mainnav" aria-label="Automation">
            <a href="${toUrl('#agents')}" aria-label="AI agents" class="${area === 'agents' ? 'on' : ''}">${ic('bot')}<span>AI agents</span></a>
            <a href="${toUrl('#workflows')}" aria-label="Workflows" class="${area === 'workflows' ? 'on' : ''}">${ic('flow')}<span>Workflows</span></a>
          </nav>
          <div class="top-r"><span class="sample">Sample workspace, fictional</span>
            <a class="sys ${h.stopped ? 'stopped' : ''}" href="${toUrl('#governance')}" data-test="sys"><i></i>${h.stopped ? 'All workflows stopped' : 'Workflows running'}</a></div>
        </header>
        ${body}
        <footer class="foot">Concludo is independent. Apps named here, such as Outlook, Gmail, Google Calendar, Microsoft To Do, Slack, Microsoft Teams, Google Sheets and HubSpot, are shown only as places a workflow can send to. Concludo is not affiliated with or endorsed by any of them.</footer>
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
      <nav class="chips agent-jump" aria-label="Agent groups">${groups.map((g) => `<a class="chip" href="#agents" data-act="jump" data-g="${esc(g)}">${esc(g)} <span class="muted">${AG.AGENTS.filter((a) => a.group === g).length}</span></a>`).join('')}</nav>
      <div class="agent-groups">${groups.map((g) => `<section id="grp-${g.replace(/\W+/g, '-').toLowerCase()}"><div class="group-h"><h2>${esc(g)}</h2><span class="small muted">${esc(GROUP_LINE[g])}</span></div><div class="agents">${AG.AGENTS.filter((a) => a.group === g).map(agentCard).join('')}</div></section>`).join('')}</div>
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
    const trig = trigOf(w.trigger && w.trigger.type);
    return `<div class="flowmini"><span class="appb">${ic('bolt')}${esc(trig.label)}</span>${(w.steps || []).map((s) => {
      const app = appOf(s && s.app);
      const approval = s && s.action === 'ask_approval';
      const text = approval ? 'Approval' : app.external ? app.label : (s && s.label) || 'Step';
      return `${ic('arrow', 'arr')}<span class="appb ${approval ? 'ap' : app.external ? 'ext' : ''}">${esc(text)}</span>`;
    }).join('')}</div>`;
  }
  function wfCard(w, last) {
    let card = '';
    try {
      card = wfCardHtml(w, last);
    } catch (e) {
      card = `<article class="wf" data-test="wf-unreadable"><div class="w-h"><div><h3>${esc(w.name || 'Workflow')}</h3><div class="trig">This workflow could not be drawn.</div></div></div><div class="w-f"><a class="btn sm" href="${toUrl('#builder/' + w.id)}">${ic('flow')}Open in builder</a></div></article>`;
    }
    return card;
  }
  function wfCardHtml(w, last) {
    const trig = trigOf(w.trigger && w.trigger.type);
    return `<article class="wf" data-act="open-wf" data-id="${w.id}" data-test="wf-${esc(w.name)}" tabindex="0" role="link" aria-label="Open ${esc(w.name)} in the builder">
      <div class="w-h"><div><h3><a href="${toUrl('#builder/' + w.id)}">${esc(w.name)}</a></h3><div class="trig">${esc(trig.label)}${w.trigger && w.trigger.schedule ? ` · ${esc(w.trigger.schedule)}` : ''}</div></div>${statusPill(w)}</div>
      ${flowMini(w)}
      <div class="w-f"><a class="btn sm" href="${toUrl('#builder/' + w.id)}">${ic('flow')}Edit in builder</a>
        <button class="btn sm ${w.status === 'active' ? 'primary' : ''}" data-act="run-open" data-id="${w.id}" ${w.status === 'active' ? '' : 'disabled title="Turn it on first, or use Test run in the builder"'}>${ic('play')}Run now</button>
        <button class="btn sm ghost" data-act="toggle" data-id="${w.id}">${w.status === 'active' ? `${ic('pause')}Pause` : `${ic('play')}Turn on`}</button>
        <span class="lastrun">${last ? `Last run: <a href="${toUrl('#runs/' + last.id)}">${esc(RUN_PILL[last.status][0].toLowerCase())}</a>` : 'Not run yet'}</span></div>
    </article>`;
  }

  /* ============================================================ BUILDER */
  async function loadBuilder(id) {
    if (id === 'new') { if (!S.b || S.b.id !== 'new') S.b = { id: 'new', wf: null, history: [], view: 'diagram', sel: null, test: null, plan: null, bottom: false, draftText: S.b?.draftText || '' }; return; }
    if (!S.b || S.b.id !== id) {
      const wf = await store.getWorkflow(id);
      S.b = { id, wf, history: [], view: 'diagram', sel: null, test: null, plan: S.b?.planFor === id ? S.b.plan : null, bottom: false };
    } else {
      const wf = await store.getWorkflow(id);
      if (wf) S.b.wf = wf;
    }
  }
  async function vBuilder(id) {
    await loadBuilder(id);
    const b = S.b;
    if (!b.wf) {
      return `<div class="stageA">
        <div class="eyebrow" style="justify-content:center">Create a workflow</div>
        <h1>Describe what should happen</h1>
        <p>Write it the way you would say it. Concludo builds the steps, adds an approval before anything leaves Concludo, and shows you what it did not understand.</p>
        <div class="describe"><label class="sr" for="describe">Describe the workflow</label><textarea id="describe" data-bind="draftText" data-autofocus placeholder="After each meeting, summarise it, add the actions to the tracker, then email the attendees">${esc(b.draftText || '')}</textarea>
          <div class="row"><span class="small muted">Works best as: when this happens, do this, then that.</span><button class="btn primary" data-act="plan" data-test="plan">${ic('spark')}Build it</button></div></div>
        <div class="examples">${EXAMPLES.map((e, i) => `<button data-act="example" data-i="${i}">${esc(e)}</button>`).join('')}</div>
        <div class="eyebrow" style="justify-content:center">Or start from a template</div>
        <div class="tpls" style="text-align:left;margin-top:10px">${C.TEMPLATES.map((t) => `<button class="tpl" data-act="from-template" data-k="${t.key}"><b>${esc(t.name)}</b><span>${esc(t.summary)}</span></button>`).join('')}</div>
      </div>`;
    }
    const wf = b.wf;
    const issues = await C.validateWorkflow(wf, store);
    const blocks = issues.filter((i) => i.level === 'block');
    const explain = C.explainWorkflow(wf);
    const apps = [...new Set((wf.steps || []).filter((s) => appOf(s.app).external).map((s) => s.app))];
    const conns = await Promise.all(apps.map(async (a) => [a, await store.connection(a)]));
    const stepIssues = (sid) => issues.filter((i) => i.stepId === sid && i.level === 'block');
    const plan = b.plan;
    return `
      <div class="b-head">
        <a class="btn sm ghost" href="#workflows">${ic('back')}Workflows</a>
        <a class="btn sm primary" href="${toUrl('#builder/new')}" data-test="create">${ic('plus')}Create workflow</a>
        <label class="sr" for="wfname">Workflow name</label><input id="wfname" class="name" data-bind="wfname" value="${esc(wf.name)}">
        ${statusPill(wf)}<span class="small muted" data-test="saved">Saved</span>
        <span class="grow"></span>
        <button class="btn sm" data-act="undo" ${b.history.length ? '' : 'disabled'}>${ic('undo')}Undo</button>
        <button class="btn sm" data-act="test-open" data-test="test-open">${ic('play')}Test run</button>
        ${wf.status === 'active' ? `<button class="btn sm" data-act="toggle" data-id="${wf.id}">${ic('pause')}Pause</button>` : `<button class="btn sm primary" data-act="toggle" data-id="${wf.id}" data-test="turn-on" ${blocks.length ? `title="${esc(blocks[0].text)}"` : ''}>${ic('play')}Turn on</button>`}
      </div>
      <div class="split">
        <aside class="left">
          ${plan ? `<div><h3>From your description</h3>${plan.understood.length ? `<div class="checks">${plan.understood.map((u) => `<div class="check ok"><span class="dot">${ic('check')}</span><span>${esc(u)}</span></div>`).join('')}</div>` : ''}${plan.unclear.length ? `<div class="checks" style="margin-top:8px">${plan.unclear.map((u) => `<div class="check warn" data-test="unclear"><span class="dot">${ic('alert')}</span><span>Not understood: ${esc(u)}. Add a step for it, or leave it out.</span></div>`).join('')}</div>` : ''}${plan.addedApprovals.length ? `<div class="note" style="margin-top:8px">Concludo added an approval before ${esc(plan.addedApprovals.join(', '))}, because ${plan.addedApprovals.length === 1 ? 'it sends' : 'they send'} something outside Concludo.</div>` : ''}</div>` : ''}
          <div><h3>How it works</h3><ol class="explain">${explain.map((l, i) => `<li class="${i === 0 ? 'first' : ''}">${esc(l)}</li>`).join('')}</ol></div>
          <div><h3>Checks</h3><div class="checks" data-test="checks">${issues.length ? issues.map((i) => `<div class="check ${i.level}"><span class="dot">${ic(i.level === 'block' ? 'x' : 'alert')}</span><span>${esc(i.text)}${i.fix === 'add_approval' ? `<div class="fix"><button class="btn sm" data-act="fix-approval">${ic('stamp')}Add the approval</button></div>` : i.fix === 'connect' ? `<div class="fix"><button class="btn sm" data-act="connect-open">${ic('link')}Connect apps</button></div>` : i.stepId ? `<div class="fix"><button class="btn sm" data-act="select" data-s="${i.stepId}">Open the step</button></div>` : ''}</span></div>`).join('') : `<div class="check ok"><span class="dot">${ic('check')}</span><span>All checks pass. ${wf.status === 'active' ? 'This workflow is on.' : 'You can turn it on.'}</span></div>`}</div></div>
          ${apps.length ? `<div><h3>Apps it uses</h3><div class="conns">${conns.map(([a, c]) => `<div><b class="small">${esc(C.APPS[a].label)}</b><span class="pill ${c === 'connected' ? 'good' : 'bad'}">${esc(CONN[c] || c)}</span><span></span></div>`).join('')}</div></div>` : ''}
        </aside>
        <section class="right">
          <div class="ctool"><div class="seg" role="tablist"><button class="${b.view === 'diagram' ? 'on' : ''}" data-act="view" data-v="diagram">Diagram</button><button class="${b.view === 'steps' ? 'on' : ''}" data-act="view" data-v="steps">Steps</button></div>
            <button class="btn sm navy" data-act="add-open" data-at="${wf.steps.length}" data-test="add-step">${ic('plus')}Add step</button></div>
          <div class="canvas">${b.view === 'diagram' ? diagram(wf, stepIssues) : stepsList(wf, stepIssues)}</div>
          ${b.sel ? inspector(wf) : ''}
          <div class="bottom" data-test="bottom"><div class="bh"><b>${ic('play')} Test run ${b.test ? `· ${esc(RUN_PILL[b.test.status][0])}` : ''}</b><div style="display:flex;gap:6px;align-items:center">
            ${b.bottom ? `<label class="sr" for="testinput">Test input</label><select id="testinput" class="btn sm" data-bind="testInput"><option value="meeting" ${b.testInput !== 'open' && b.testInput !== 'empty' ? 'selected' : ''}>Latest meeting (sample)</option><option value="open" ${b.testInput === 'open' ? 'selected' : ''}>Open work across the workspace</option><option value="empty" ${b.testInput === 'empty' ? 'selected' : ''}>Nothing (empty input)</option></select><button class="btn sm primary" data-act="test-run" data-test="test-run">Run test</button>` : ''}
            <button class="btn sm ghost" data-act="bottom">${b.bottom ? 'Hide' : 'Open'}</button></div></div>
            ${b.bottom ? `<div class="bb">${b.test ? `<div class="note" style="margin-bottom:10px">Test runs never send anything and never queue approvals. They show what a live run would do with this input.</div>${timeline(b.test.steps)}` : '<div class="note">Choose an input and run a test. Nothing is sent.</div>'}</div>` : ''}
          </div>
        </section>
      </div>`;
  }
  function nodeHtml(wf, s, i, issuesFor) {
    const spec = actOf(s.action);
    const app = appOf(s.app);
    const cls = spec.kind === 'approval' ? 'approval' : spec.kind === 'only_if' ? 'cond' : '';
    const kind = spec.kind === 'approval' ? 'A person approves' : spec.kind === 'only_if' ? 'Condition' : app.external ? `Leaves Concludo · ${app.label}` : 'Inside Concludo';
    const bad = issuesFor(s.id).length;
    return `<button class="node ${cls} ${S.b.sel === s.id ? 'sel' : ''} ${bad ? 'issue' : ''}" data-act="select" data-s="${s.id}" data-test="node-${i}"><span class="n-ic">${ic(STEP_IC(s))}</span><span><span class="kind">${esc(kind)}</span><b>${esc(s.label)}</b><span>${esc(spec.explain(s))}</span></span>${bad ? `<span class="pill bad">${ic('alert')}Fix</span>` : s.autoAdded ? '<span class="pill gold">Added</span>' : ''}</button>`;
  }
  function diagram(wf, issuesFor) {
    const trig = trigOf(wf.trigger && wf.trigger.type);
    let h = `<button class="node trigger ${S.b.sel === 'trigger' ? 'sel' : ''}" data-act="select" data-s="trigger"><span class="n-ic">${ic('bolt')}</span><span><span class="kind">When</span><b>${esc(trig.label)}</b><span>${esc((wf.trigger && wf.trigger.schedule) || trig.hint)}</span></span></button>`;
    wf.steps.forEach((s, i) => { h += `<div class="link"></div><button class="plus" data-act="add-open" data-at="${i}" aria-label="Add a step here">${ic('plus')}</button><div class="link"></div>${nodeHtml(wf, s, i, issuesFor)}`; });
    h += `<div class="link"></div><button class="plus" data-act="add-open" data-at="${wf.steps.length}" aria-label="Add a step at the end">${ic('plus')}</button><div class="end">End</div>`;
    return h;
  }
  function stepsList(wf, issuesFor) {
    const trig = trigOf(wf.trigger && wf.trigger.type);
    return `<div class="stepsview"><button class="row" data-act="select" data-s="trigger"><span class="no">${ic('bolt')}</span><span><b>${esc(trig.label)}</b><br><span class="small muted">${esc((wf.trigger && wf.trigger.schedule) || 'Trigger')}</span></span><span></span></button>${(wf.steps || []).map((s, i) => { const spec = actOf(s.action); const app = appOf(s.app); return `<button class="row" data-act="select" data-s="${s.id}"><span class="no">${i + 1}</span><span><b>${esc(s.label)}</b><br><span class="small muted">${esc(spec.explain({ ...s, settings: s.settings || {} }))}</span></span>${issuesFor(s.id).length ? '<span class="pill bad">Fix</span>' : `<span class="appb ${app.external ? 'ext' : ''}">${esc(app.label)}</span>`}</button>`; }).join('')}</div>`;
  }
  function guarding(wf, idx) {
    // An approval is required if removing it leaves an external step unguarded.
    const test = { ...wf, steps: wf.steps.filter((_, i) => i !== idx) };
    let guarded = false;
    for (const s of test.steps) { const spec = actOf(s.action); const app = appOf(s.app); if (spec.kind === 'approval') guarded = true; if (spec.kind === 'do' && spec.key !== 'unsupported' && app.external && !guarded) return true; }
    return false;
  }
  function inspector(wf) {
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
    const app = appOf(s.app);
    const locked = spec.kind === 'approval' && guarding(wf, idx);
    return `<aside class="inspector" aria-label="Step settings"><div class="i-h"><h3>${esc(s.label)}</h3><button class="btn ghost sm" data-act="deselect" aria-label="Close">${ic('x')}</button></div>
      <div class="i-b">
        ${spec.apps.length > 1 ? `<div class="field"><label for="app">App</label><select id="app" data-edit="app">${spec.apps.map((a) => `<option value="${a}" ${s.app === a ? 'selected' : ''}>${esc(C.APPS[a].label)}</option>`).join('')}</select></div>` : ''}
        ${spec.fields.filter((f) => !(f.key === 'address' && s.settings.to !== 'custom')).map((f) => `<div class="field"><label for="f-${f.key}">${esc(f.label)}${f.required ? '' : ' (optional)'}</label>${f.kind === 'select' ? `<select id="f-${f.key}" data-edit="set:${f.key}">${f.options.map((o) => `<option value="${o.value}" ${s.settings[f.key] === o.value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select>` : `<input id="f-${f.key}" data-edit="set:${f.key}" value="${esc(s.settings[f.key] || '')}" placeholder="${esc(f.placeholder || '')}">`}</div>`).join('')}
        <div class="note">${esc(spec.explain({ ...s, settings: s.settings || {} }))}${app.external && spec.kind === 'do' && spec.key !== 'unsupported' ? ' It runs only after a person approves it.' : ''}</div>
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
    if (g.added.length) toast(`Concludo added an approval before “${g.added.join('”, “')}”, because it sends something outside Concludo.`);
    else if (note) toast(note);
    await render(true);
  }
  function pickerModal(at) {
    const visible = Object.values(C.ACTIONS).filter((a) => !a.hidden);
    const groups = [...new Set(visible.map((a) => a.group))];
    return `<div class="modal-bg" data-act="close-modal"><div class="modal" role="dialog" aria-label="Add a step" data-stop>
      <div class="mh"><h2>Add a step</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><div class="picker">${groups.map((g) => `<div><h4>${esc(g)}</h4><div class="opts">${visible.filter((a) => a.group === g).flatMap((a) => a.apps.length > 1 && a.kind === 'do' ? a.apps.map((app) => ({ a, app })) : [{ a, app: a.apps[0] }]).map(({ a, app }) => `<button class="opt" data-act="add-step" data-k="${a.key}" data-app="${app}" data-at="${at}" data-test="pick-${a.key}-${app}"><b>${esc(a.label)}${a.apps.length > 1 ? ` (${esc(C.APPS[app].label)})` : ''}</b><span>${C.APPS[app].external && a.kind === 'do' ? 'Leaves Concludo: needs approval' : a.kind === 'approval' ? 'Stops until a person approves' : a.kind === 'only_if' ? 'Stops the workflow if the rule is not met' : 'Stays inside Concludo'}</span></button>`).join('')}</div></div>`).join('')}</div></div></div></div>`;
  }
  async function connectModal() {
    const keys = Object.keys(C.APPS).filter((k) => C.APPS[k].external);
    const rows = await Promise.all(keys.map(async (k) => [k, await store.connection(k)]));
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Connect apps" data-stop>
      <div class="mh"><h2>Connect apps</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><div class="note">In the Workspace this opens each app’s own sign-in. In this preview, “Mark connected” only changes the preview’s record.</div>
      <div class="conns">${rows.map(([k, c]) => `<div><b class="small">${esc(C.APPS[k].label)}</b><span class="pill ${c === 'connected' ? 'good' : 'bad'}">${esc(CONN[c] || c)}</span><button class="btn sm" data-act="conn-toggle" data-k="${k}">${c === 'connected' ? 'Disconnect' : 'Mark connected'}</button></div>`).join('')}</div></div></div></div>`;
  }

  /* ============================================================ RUN DIALOG */
  function runModal(wfId, name) {
    return `<div class="modal-bg" data-act="close-modal"><div class="modal narrow" role="dialog" aria-label="Run now" data-stop>
      <div class="mh"><h2>Run “${esc(name)}”</h2><button class="btn ghost sm" data-act="close-modal" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><p class="small muted" style="margin:0">A live run uses real records. Anything that would leave Concludo stops at the approval step for you to check.</p>
        <div class="radio">
          ${[...(ws.meetings || [])].sort((a, b) => b.date.localeCompare(a.date)).map((m, i) => `<label><input type="radio" name="rin" value="m:${m.id}" ${i === 0 ? 'checked' : ''} data-test="rin-${m.id}"><span><b>${i === 0 ? 'The latest meeting' : 'Meeting'}: ${esc(m.title)}</b><span>${esc(C.auDate(m.date))}${!m.consent || m.consent === 'not_recorded' ? ' · No consent recorded: the run will be held' : ''}</span></span></label>`).join('')}
          <label><input type="radio" name="rin" value="open"><span><b>Open work across the workspace</b><span>${ws.actions.length} actions, ${ws.decisions.length} decisions, ${ws.risks.length} risks (sample)</span></span></label>
          <label><input type="radio" name="rin" value="empty"><span><b>Nothing</b><span>Shows what the workflow does with an empty input</span></span></label>
        </div></div>
      <div class="mf"><button class="btn" data-act="close-modal">Cancel</button><button class="btn primary" data-act="run-go" data-id="${wfId}" data-test="run-go">${ic('play')}Run now</button></div></div></div>`;
  }
  const inputFor = (k) => (k === 'open' ? scheduleInput(ws) : k === 'empty' ? {} : k && k.startsWith('m:') ? meetingInput(ws, k.slice(2)) : (ws.meetings && ws.meetings.length ? meetingInput(ws, [...ws.meetings].sort((a, b) => b.date.localeCompare(a.date))[0].id) : {}));

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
  async function runDetail(r) {
    const wf = await store.getWorkflow(r.workflowId);
    const inp = r.input || {};
    const inputLine = inp.meeting ? `Meeting: ${inp.meeting.title}` : (inp.actions || []).length ? `${plural(inp.actions.length, 'action')}, ${plural((inp.decisions || []).length, 'decision')}, ${plural((inp.risks || []).length, 'risk')}` : 'Empty input';
    return `<aside class="card detail" data-test="run-detail"><div class="card-h"><h2>${esc(r.workflowName)}</h2><span class="pill ${pillOf(r)[1]}">${esc(pillOf(r)[0])}</span></div><div class="card-b">
      ${r.error ? `<div class="banner bad" style="margin:0">${ic('alert')}<span>${esc(r.error)}</span></div>` : ''}
      <dl class="kv"><dt>Started</dt><dd>${esc(new Date(r.startedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' }))} by ${esc(r.startedBy)}</dd><dt>Input</dt><dd>${esc(inputLine)}</dd>${r.test ? '<dt>Type</dt><dd>Test run. Nothing was sent.</dd>' : ''}${r.retryOf ? '<dt>Retry of</dt><dd><a href="#runs/' + r.retryOf + '">earlier run</a></dd>' : ''}</dl>
      ${timeline(r.steps)}
      <div style="display:flex;gap:8px;flex-wrap:wrap">${r.status === 'requires_approval' && r.approvalId ? `<a class="btn primary sm" href="#approvals/${r.approvalId}" data-test="open-approval">${ic('stamp')}Open the approval</a>` : ''}${(r.status === 'failed' || r.status === 'cancelled') && !r.test ? `<button class="btn sm primary" data-act="retry" data-id="${r.id}" ${wf && wf.status === 'active' ? '' : 'disabled title="Resume the workflow first"'}>${ic('undo')}Retry</button>` : ''}${wf ? `<a class="btn sm" href="#builder/${wf.id}">Open workflow</a>` : ''}</div>
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
      <dl class="kv"><dt>Source</dt><dd>${esc(a.source)}</dd><dt>Requested</dt><dd>${esc(when(a.requestedAt))} by ${esc(a.requestedBy)}</dd>${run ? `<dt>Run</dt><dd><a href="#runs/${run.id}">${esc(RUN_PILL[run.status][0])}</a></dd>` : ''}${a.decidedBy ? `<dt>Decided</dt><dd>${esc(a.status)} by ${esc(a.decidedBy)}${a.note ? `: “${esc(a.note)}”` : ''}</dd>` : ''}</dl>
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
    const link = ev.target.closest('a');
    if (link && link.getAttribute('href')) {
      const href = link.getAttribute('href');
      if (href.startsWith('/workflows') || href.startsWith('/approvals') || href.startsWith('/agents') || (href.startsWith('#') && !href.startsWith('#grp-'))) {
        ev.preventDefault();
        return go(href);
      }
    }
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
      case 'conn-toggle': { const k = t.dataset.k; store.connections[k] = store.connections[k] === 'connected' ? 'disconnected' : 'connected'; S.modal = await connectModal(); return render(true); }
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
    if (t.dataset.bind === 'apNote') S.apNote = t.value;
    if (t.dataset.bind === 'stopReason') S.stopReason = t.value;
  });
  root.addEventListener('change', (ev) => guarded(async () => {
    const t = ev.target;
    if (t.dataset.bind === 'testInput') { S.b.testInput = t.value; return; }
    if (t.dataset.agentOpt) { const k = t.dataset.k; S.agentOpts[k] = { ...(S.agentOpts[k] || {}), [t.dataset.agentOpt]: t.dataset.agentOpt === 'periodDays' ? +t.value : t.value || undefined }; await runAgentNow(k); return render(true); }
    if (t.dataset.bind === 'wfname') return editWf((wf) => { wf.name = t.value.trim() || wf.name; }, 'Name saved.');
    const e = t.dataset.edit;
    if (!e) return;
    if (e === 'trigger') return editWf((wf) => { wf.trigger = { type: t.value, ...(t.value === 'workflow_schedule' ? { schedule: 'Every Monday' } : {}) }; });
    if (e === 'schedule') return editWf((wf) => { wf.trigger.schedule = t.value; });
    if (e === 'app') return editWf((wf) => { wf.steps.find((s) => s.id === S.b.sel).app = t.value; });
    if (e.startsWith('set:')) return editWf((wf) => { const st = wf.steps.find((s) => s.id === S.b.sel); const wasDefault = st.label === C.stepLabel(st); st.settings[e.slice(4)] = t.value; if (wasDefault) st.label = C.stepLabel(st); });
  }));
  window.addEventListener('hashchange', () => { S.modal = null; S.agentOpen = null; render().then(() => window.scrollTo(0, 0)); });
  window.addEventListener('popstate', () => { S.modal = null; S.agentOpen = null; render().then(() => window.scrollTo(0, 0)); });
  root.__cma = { store, S, render, get ws() { return ws; } };
  await render();
  return { store, render };
}
