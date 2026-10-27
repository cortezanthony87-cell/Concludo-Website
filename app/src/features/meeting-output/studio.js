/* Concludo Meeting Output Studio v2
   Three steps: Add sources, Review, Document..
   Nothing is sent anywhere: all processing runs in the browser. */
// @ts-nocheck
/* Concludo Meeting Output Studio v2, mountable module.
   mountMeetingStudio(root, options) renders the three-step studio into root and returns an unmount function.
   Styles are scoped under .cmo (meeting-output.css). Nothing is sent anywhere unless options.onSave is supplied. */
import * as CE from '../../lib/intelligence/meetingEngine';
import { SAMPLE_TRANSCRIPT, SAMPLE_DOC } from './samples';

export function mountMeetingStudio(root, opts = {}) {
  root.classList.add('cmo');
  if (opts.embedded) root.classList.add('cmo-embedded');
  const A = { lockup: opts.logo || '/brand/Concludo_lockup_horizontal_760w.png', lockupRev: opts.logoReversed || '/brand/Concludo_logo_horizontal_reversed_for_dark.png' };
  const listeners = [];
  let finishPrint = null;
  const on = (target, type, fn) => { target.addEventListener(type, fn); listeners.push([target, type, fn]); };
  const scroller = () => {
    let el = root.parentElement;
    while (el && el !== document.body) {
      const oy = getComputedStyle(el).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };
  const getY = () => scroller().scrollTop;
  const setY = (y, smooth) => scroller().scrollTo({ top: y, behavior: smooth ? 'smooth' : 'auto' });
  const $ = (s, r = root) => r.querySelector(s);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = (iso, wd) => (iso ? CE.fmtDate(iso, { weekday: !!wd }) : '');
  const short = (iso) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-AU', { timeZone: 'UTC', day: 'numeric', month: 'short' }) : '');
  const shortTxt = (s, n) => (s.length <= n ? s : s.slice(0, s.lastIndexOf(' ', n)).replace(/[,;:]$/, '') + '…');
  const plural = (n, a, b) => `${n} ${n === 1 ? a : b || a + 's'}`;

  /* ----------------------------------------------------------- icons */
  const P = {
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',
    notes: '<path d="M5 4h10l4 4v12H5z"/><path d="M15 4v4h4M8 12h8M8 16h6"/>',
    file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    doc: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.5"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
    print: '<path d="M7 9V3h10v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M7 14h10v7H7z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 20h16"/>',
    save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>',
    spark: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5L18 18M6 18l2.5-2.5M15.5 8.5L18 6"/>',
    board: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 9h6M7 12h10"/>',
    one: '<path d="M6 3h12v18H6z"/><path d="M9 7h6M9 11h6M9 15h3"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2"/>',
    gavel: '<path d="M14 5l5 5M11 8l5 5M9 10l5 5-3 3-5-5zM4 20l6-6"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    quote: '<path d="M7 7h4v4H7zM7 11c0 3-1 4-3 5M15 7h4v4h-4zM15 11c0 3-1 4-3 5"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/>',
  };
  const ic = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;

  /* ----------------------------------------------------------- state */
  const S = {
    step: 1,
    tab: 'paste',
    draft: '',
    draftNotes: '',
    sources: [],
    meta: { title: '', meetingType: '', meetingDate: '', organisation: '', project: '' },
    detected: {},
    model: null,
    filter: 'all',
    section: 'bottom',
    template: 'board',
    error: '',
    outline: [],
  };
  const CAN_FILE = opts.canFile !== false;
  const MEETING_TYPES = ['Leadership meeting', 'Board meeting', 'Steering committee', 'Project kick-off', 'Client meeting', 'Status meeting', 'Workshop', 'Meeting'];

  const allSources = () => {
    const list = [...S.sources];
    if (S.draft.trim()) list.unshift({ name: 'Pasted transcript', kind: 'transcript', text: S.draft });
    if (S.draftNotes.trim()) list.push({ name: 'Pasted notes', kind: 'notes', text: S.draftNotes });
    return list;
  };

  /* ----------------------------------------------------------- shell */
  function render() {
    const app = root;
    const steps = [
      [1, 'Add sources'],
      [2, 'Review'],
      [3, 'Document'],
    ];
    const canGo = (n) => n === 1 || !!S.model;
    app.innerHTML = `
      <header class="topbar">
        <div class="brand">${opts.embedded ? '' : `<img src="${A.lockup}" alt="Concludo">`}<div class="crumb">${opts.embedded ? '' : 'Workspace &nbsp;/&nbsp; '}<b>Meeting output</b></div></div>
        <nav class="stepper" aria-label="Progress">
          ${steps
            .map(([n, l], i) => `${i ? '<span class="step-sep"></span>' : ''}<button class="step ${S.step === n ? 'active' : S.step > n ? 'done' : ''}" data-go="${n}" ${canGo(n) ? '' : 'disabled'} aria-current="${S.step === n ? 'step' : 'false'}"><span class="n">${S.step > n ? ic('check') : n}</span><span class="l">${l}</span></button>`)
            .join('')}
        </nav>
        <div class="top-actions">${S.model ? `<button class="btn sm" data-act="save">${ic('save')}<span>Save to project</span></button>` : ''}</div>
      </header>
      <main id="main">${S.step === 1 ? viewImport() : S.step === 2 ? viewReview() : viewDocument()}</main>`;
    if (S.step === 3) buildDocument();
    if (S.step === 2) observeSections();
  }

  /* ======================================================= STEP 1: IMPORT */
  function viewImport() {
    const srcs = allSources();
    const words = srcs.reduce((a, s) => a + s.text.split(/\s+/).filter(Boolean).length, 0);
    const speakerLines = (S.draft.match(/^\s*(?:\[?\d{1,2}:\d{2}(?::\d{2})?\]?\s*)?[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,3}\s*(?:\([^)]*\))?\s*:\s+\S/gm) || []).length;
    const stamps = (S.draft.match(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g) || []).length;
    const det = (k) => (S.detected[k] && S.meta[k] === S.detected[k] ? '<span class="detected">Detected</span>' : '');
    return `<div class="wrap">
      <div class="page-head">
        <div><div class="eyebrow">Step 1 of 3</div><h1>Add the meeting</h1>
        <p>Paste a transcript, add your notes or import files. Concludo works from what you give it, whatever recorded the meeting. Nothing leaves this browser until you save.</p></div>
        <button class="btn" data-act="sample">${ic('spark')}<span>Load fictional sample</span></button>
      </div>
      <div class="import-grid">
        <section class="card">
          <div class="card-b">
            <div class="tabs" role="tablist">
              <button class="tab ${S.tab === 'paste' ? 'active' : ''}" data-tab="paste" role="tab">${ic('paste')}Paste transcript</button>
              <button class="tab ${S.tab === 'notes' ? 'active' : ''}" data-tab="notes" role="tab">${ic('notes')}Add notes</button>
              <button class="tab ${S.tab === 'files' ? 'active' : ''}" data-tab="files" role="tab">${ic('upload')}Import files</button>
            </div>
            <div style="margin-top:14px">
            ${S.tab === 'paste'
              ? `<label class="sr" for="draft">Transcript</label><textarea id="draft" class="paste" data-bind="draft" placeholder="Paste a transcript with speaker names, for example:\n\n[00:03:02] Mara Ellis: Decision: we cut over to the new CRM on Monday 16 November.\n[00:03:48] Tom Nguyen: I'll run two training sessions the week of the 9th.">${esc(S.draft)}</textarea>
                 <div class="signals">${S.draft.trim() ? `<span class="tag ${speakerLines >= 2 ? 'ok' : 'line'}">${ic(speakerLines >= 2 ? 'check' : 'alert')}${speakerLines >= 2 ? `${speakerLines} speaker lines` : 'No speaker labels found'}</span><span class="tag ${stamps ? 'ok' : 'line'}">${stamps ? `${stamps} timestamps` : 'No timestamps'}</span><span>${S.draft.split(/\s+/).filter(Boolean).length.toLocaleString()} words</span>` : '<span>Speaker names and timestamps make owners and evidence more precise. Neither is required.</span>'}</div>`
              : S.tab === 'notes'
              ? `<label class="sr" for="notes">Notes</label><textarea id="notes" class="paste" data-bind="draftNotes" placeholder="Meeting notes, minutes or a summary. Lines that start with Decision:, Action:, Risk: or Open question: are read exactly as written.">${esc(S.draftNotes)}</textarea>`
              : `<div class="drop" id="drop"><div class="big">${ic('upload')}</div><b>Drop files here, or choose files</b><span>Transcripts (.vtt, .srt, .txt), notes (.md, .txt) and documents (.docx, .pdf)</span><button class="btn sm" data-act="pick" style="margin-top:6px">Choose files</button><input type="file" id="file" multiple accept=".txt,.md,.vtt,.srt,.csv,.json,.docx,.pdf" hidden></div>`}
            </div>
            ${srcs.length ? `<div class="sources">${srcs
              .map((s, i) => `<div class="src"><div class="ic">${ic(s.kind === 'document' ? 'doc' : s.kind === 'notes' ? 'notes' : 'paste')}</div><div><div class="nm">${esc(s.name)}</div><div class="sub">${s.kind === 'transcript' ? 'Transcript' : s.kind === 'notes' ? 'Notes' : 'Supporting document'} · ${s.text.split(/\s+/).filter(Boolean).length.toLocaleString()} words</div></div>
                <select data-kind="${i}" aria-label="Source type" class="btn sm" style="font-weight:500"><option value="transcript" ${s.kind === 'transcript' ? 'selected' : ''}>Transcript</option><option value="notes" ${s.kind === 'notes' ? 'selected' : ''}>Notes</option><option value="document" ${s.kind === 'document' ? 'selected' : ''}>Document</option></select>
                <button class="btn ghost sm" data-rm="${i}" aria-label="Remove ${esc(s.name)}">${ic('trash')}</button></div>`)
              .join('')}</div>` : ''}
            ${S.error ? `<div class="err">${esc(S.error)}</div>` : ''}
          </div>
        </section>
        <aside class="card">
          <div class="card-h"><h2>Meeting details</h2><span class="tag line">${words.toLocaleString()} words in</span></div>
          <div class="card-b">
            <div class="field"><label for="m-title">Title ${det('title')}</label><input id="m-title" data-meta="title" value="${esc(S.meta.title)}" placeholder="Found in the source if stated"></div>
            <div class="row2">
              <div class="field"><label for="m-date">Date ${det('meetingDate')}</label><input id="m-date" type="date" data-meta="meetingDate" value="${esc(S.meta.meetingDate)}"></div>
              <div class="field"><label for="m-type">Type ${det('meetingType')}</label><select id="m-type" data-meta="meetingType"><option value="">Detect from source</option>${[...new Set([S.meta.meetingType, ...MEETING_TYPES].filter(Boolean))].map((t) => `<option ${t === S.meta.meetingType ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></div>
            </div>
            <div class="field"><label for="m-org">Organisation ${det('organisation')}</label><input id="m-org" data-meta="organisation" value="${esc(S.meta.organisation)}" placeholder="Optional"></div>
            <div class="field"><label for="m-proj">Project ${det('project')}</label><input id="m-proj" data-meta="project" value="${esc(S.meta.project)}" placeholder="Optional"></div>
            <button class="btn primary lg" style="width:100%" data-act="generate" ${srcs.length ? '' : 'disabled'}>${ic('spark')}<span>Build the meeting record</span></button>
            <div class="note">Concludo proposes. You confirm. Every item it finds links back to the line it came from, and anything not said in the meeting is shown as a gap, not filled in.</div>
          </div>
        </aside>
      </div>
      <div class="how">
        <div><b><span>1</span>Add sources</b><p>Transcripts, notes and documents from any recorder or platform.</p></div>
        <div><b><span>2</span>Review</b><p>Confirm, edit or exclude each decision, action, risk and open item.</p></div>
        <div><b><span>3</span>Document</b><p>A board-ready record in four templates, plus a follow-up email draft.</p></div>
      </div>
    </div>`;
  }

  let detectTimer;
  function detectMeta() {
    clearTimeout(detectTimer);
    detectTimer = setTimeout(() => {
      const srcs = allSources();
      if (!srcs.length) return;
      try {
        const m = CE.analyseMeeting(srcs, {});
        const map = { title: m.meta.title !== 'Meeting outcome' ? m.meta.title : '', meetingDate: m.signals.dateConfirmed ? m.meta.meetingDate : '', meetingType: m.meta.meetingType !== 'Meeting' ? m.meta.meetingType : '', organisation: m.meta.organisation || '', project: m.meta.project || '' };
        let changed = false;
        Object.entries(map).forEach(([k, v]) => {
          if (v && (!S.meta[k] || S.meta[k] === S.detected[k])) {
            if (S.meta[k] !== v) changed = true;
            S.meta[k] = v;
            S.detected[k] = v;
          }
        });
        if (changed) {
          const ae = document.activeElement;
          const id = ae && ae.id;
          const pos = ae && ae.selectionStart;
          render();
          if (id && $('#' + id)) {
            $('#' + id).focus();
            try { $('#' + id).setSelectionRange(pos, pos); } catch (e) { /* not a text field */ }
          }
        }
      } catch (e) { /* not enough content yet */ }
    }, 350);
  }

  function generate() {
    S.error = '';
    try {
      const meta = {};
      Object.entries(S.meta).forEach(([k, v]) => v && (meta[k] = v));
      S.model = CE.analyseMeeting(allSources(), meta);
      S.step = 2;
      S.section = 'bottom';
      setY(0);
    } catch (e) {
      S.error = e.message || 'Could not read the sources.';
    }
    render();
  }

  async function readFile(f) {
    if (opts.parseFile) {
      const p = await opts.parseFile(f);
      const t = (p.type || '').toLowerCase();
      return { name: p.name || f.name, kind: ['vtt', 'srt'].includes(t) || /transcript/i.test(f.name) ? 'transcript' : t === 'md' ? 'notes' : 'document', text: p.text || '' };
    }
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    if (['txt', 'md', 'vtt', 'srt', 'csv', 'json', 'log'].includes(ext) || f.type.startsWith('text/')) {
      let text = await f.text();
      if (ext === 'vtt' || ext === 'srt') text = text.replace(/<v\s+([^>]+)>/gi, '$1: ').replace(/<[^>]+>/g, '');
      return { name: f.name, kind: ['vtt', 'srt'].includes(ext) || /transcript/i.test(f.name) ? 'transcript' : ext === 'md' ? 'notes' : 'document', text };
    }
    if (ext === 'docx') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js');
      const r = await window.mammoth.extractRawText({ arrayBuffer: await f.arrayBuffer() });
      return { name: f.name, kind: /transcript/i.test(f.name) ? 'transcript' : 'document', text: r.value };
    }
    if (ext === 'pdf') {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js');
      const lib = window.pdfjsLib;
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
      let text = '';
      for (let p = 1; p <= pdf.numPages; p++) {
        const c = await (await pdf.getPage(p)).getTextContent();
        let last = null;
        c.items.forEach((it) => {
          if (last !== null && Math.abs(it.transform[5] - last) > 2) text += '\n';
          text += it.str;
          last = it.transform[5];
        });
        text += '\n\n';
      }
      return { name: f.name, kind: /transcript/i.test(f.name) ? 'transcript' : 'document', text };
    }
    throw new Error(`${f.name}: this file type is not supported. Use .txt, .md, .vtt, .srt, .docx or .pdf.`);
  }
  const loadScript = (src) =>
    new Promise((res, rej) => {
      if (document.querySelector(`script[src="${src}"]`)) return res();
      const s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = () => rej(new Error('Word and PDF import needs an internet connection. Paste the text instead.'));
      document.head.appendChild(s);
    });
  async function addFiles(files) {
    S.error = '';
    for (const f of files) {
      try {
        const s = await readFile(f);
        if (!s.text.trim()) throw new Error(`${f.name} has no readable text. If it is a scanned PDF, paste the text instead.`);
        S.sources.push(s);
      } catch (e) {
        S.error = e.message;
      }
    }
    render();
    detectMeta();
  }

  /* ======================================================= STEP 2: REVIEW */
  function needsAttention(kind, x) {
    if (kind === 'actions') return x.gaps.some((g) => g !== 'Definition of done not stated');
    if (kind === 'decisions') return x.status === 'conditional';
    if (kind === 'risks') return x.rating === 'high' || !x.mitigation;
    if (kind === 'open') return true;
    return false;
  }
  function viewReview() {
    const m = S.model;
    const groups = [
      ['decisions', 'Decisions', m.decisions],
      ['actions', 'Actions', m.actions],
      ['risks', 'Risks', m.risks],
      ['open', 'Open items', m.openItems],
    ];
    const all = groups.flatMap((g) => g[2]);
    const reviewed = all.filter((x) => x.review !== 'proposed').length;
    const attn = groups.reduce((a, [k, , xs]) => a + xs.filter((x) => x.review !== 'excluded' && needsAttention(k, x)).length, 0);
    const gate = m.gate;
    const navItem = (id, label, n, dot) => `<a href="#sec-${id}" data-sec="${id}" class="${S.section === id ? 'active' : ''}"><span>${label}</span><span class="cnt">${dot ? '<i class="dot" title="Needs attention"></i>' : ''}${n ?? ''}</span></a>`;
    return `<div class="wrap">
      <div class="page-head">
        <div><div class="eyebrow">Step 2 of 3</div><h1>${esc(m.meta.title)}</h1>
        <p>${esc([m.meta.meetingType, fmt(m.meta.meetingDate, true), m.meta.organisation].filter(Boolean).join(' · '))}. Concludo proposes, you decide: confirm, edit or exclude each item. The document only uses what you keep.</p></div>
        <div style="display:flex;gap:8px"><button class="btn" data-go="1">${ic('back')}<span>Sources</span></button><button class="btn primary" data-go="3"><span>Build the document</span>${ic('arrow')}</button></div>
      </div>
      <div class="review-grid">
        <aside class="side">
          <nav class="nav" aria-label="Sections">
            ${navItem('bottom', 'Bottom line')}
            ${groups.map(([k, l, xs]) => navItem(k, l, xs.filter((x) => x.review !== 'excluded').length, xs.some((x) => x.review !== 'excluded' && needsAttention(k, x)))).join('')}
            ${navItem('figures', 'Key figures', m.figures.length)}
            ${navItem('sources', 'Sources', m.sources.length)}
          </nav>
          <div class="progress"><div style="display:flex;justify-content:space-between;font-size:12.5px;font-weight:600"><span>Reviewed</span><span>${reviewed} of ${all.length}</span></div><div class="bar"><i style="width:${all.length ? (reviewed / all.length) * 100 : 0}%"></i></div><button class="btn sm" style="width:100%;margin-top:6px" data-act="confirm-all">${ic('check')}<span>Confirm all remaining</span></button></div>
        </aside>
        <div>
          ${m.warnings.map((w) => `<div class="warn">${ic('alert')}<span>${esc(w)}</span></div>`).join('')}
          <div class="toolbar"><div class="chipset"><button class="chip ${S.filter === 'all' ? 'on' : ''}" data-filter="all">All items</button><button class="chip ${S.filter === 'attn' ? 'on' : ''}" data-filter="attn">Needs attention (${attn})</button></div><span style="font-size:12.5px;color:var(--slate)">Edits update the record and the document straight away.</span></div>
          <section class="section" id="sec-bottom"><header><div><h2>Bottom line</h2><p>Written from the items below. It updates as you review.</p></div></header><div class="answer">${esc(m.bottomLine)}</div></section>
          ${sectionDecisions(m)}${sectionActions(m)}${sectionRisks(m)}${sectionOpen(m)}
          <section class="section" id="sec-figures"><header><div><h2>Key figures</h2><p>Amounts, percentages and counts stated in the sources.</p></div></header>${m.figures.length ? `<div class="figs">${m.figures.map((f) => `<div class="fig"><b>${esc(f.value)}</b><p>${esc(f.context)}</p><p style="font-size:11.5px">${esc(CE.cite(f.evidence))}</p></div>`).join('')}</div>` : '<p class="note">No figures stated.</p>'}</section>
          <section class="section" id="sec-sources"><header><div><h2>Sources</h2><p>What this record was built from.</p></div></header><div class="sources" style="margin-top:0">${m.sources.map((s) => `<div class="src" style="grid-template-columns:34px 1fr auto"><div class="ic"><span class="id">${s.id}</span></div><div><div class="nm">${esc(s.name)}</div><div class="sub">${s.kind === 'document' ? 'Supporting document' : s.kind === 'notes' ? 'Notes' : 'Transcript'} · ${s.words.toLocaleString()} words${s.speakers ? ` · ${s.speakers} speakers` : ''}${s.firstTimestamp ? ` · ${s.firstTimestamp} to ${s.lastTimestamp}` : ''}</div></div></div>`).join('')}</div></section>
        </div>
        <aside class="side">
          <div class="card quality"><div class="card-h"><h2>Record quality</h2></div><div class="card-b">
            <div class="status ${gate.status === 'Ready to circulate' ? 'ready' : gate.status === 'Not ready' ? 'not' : ''}">${ic(gate.status === 'Ready to circulate' ? 'check' : 'alert')}${gate.status}</div>
            <ul class="checks">${gate.checks.map((c) => `<li><span class="ck ${c.pass ? 'y' : 'n'}">${ic(c.pass ? 'check' : 'x')}</span><span>${esc(c.label)}<small>${esc(c.detail)}</small></span></li>`).join('')}</ul>
            <div class="mini-stats"><div><b>${m.stats.decisions}</b><span>Decisions</span></div><div><b>${m.stats.actions}</b><span>Actions</span></div><div><b>${m.stats.openItems}</b><span>Open items</span></div><div><b>${m.stats.highRisks}</b><span>High risks</span></div></div>
          </div></div>
        </aside>
      </div>
    </div>`;
  }
  const evid = (e) => (e ? `<div class="quote">“${esc(e.quote)}”<span class="src-l">${esc(CE.cite(e))}</span></div>` : '');
  const decideBtns = (kind, x) => `<div class="decide"><button class="btn ${x.review === 'confirmed' ? 'on-c' : ''}" data-rev="${kind}:${x.id}:confirmed">${ic('check')}${x.review === 'confirmed' ? 'Confirmed' : 'Confirm'}</button><button class="btn ${x.review === 'excluded' ? 'on-x' : ''}" data-rev="${kind}:${x.id}:excluded">${x.review === 'excluded' ? 'Excluded' : 'Exclude'}</button></div>`;
  const show = (kind, x) => S.filter === 'all' || (x.review !== 'excluded' && needsAttention(kind, x));
  const cls = (x) => `item ${x.review}`;
  function sectionDecisions(m) {
    const xs = m.decisions.filter((x) => show('decisions', x));
    return `<section class="section" id="sec-decisions"><header><div><h2>Decisions</h2><p>What the meeting settled. Conditional decisions wait on an approval.</p></div></header><div class="items">${xs.length ? xs.map((d) => `<article class="${cls(d)}"><span class="id">${d.id}</span><div><div class="txt">${esc(d.statement)}</div>
      <div class="meta"><span class="tag ${d.status === 'conditional' ? 'gold' : ''}">${d.status === 'conditional' ? 'Conditional' : 'Agreed'}</span>${d.condition ? `<span class="tag line">${esc(d.condition)}</span>` : ''}${d.calledBy ? `<span class="tag line">Called by ${esc(d.calledBy)}</span>` : ''}<span class="tag line">${d.confidence === 'explicit' ? 'Stated as a decision' : 'Inferred, check wording'}</span></div>
      <div class="edit"><label style="flex:1">Decision wording<input data-edit="decisions:${d.id}:statement" value="${esc(d.statement)}" style="width:100%"></label></div>${evid(d.evidence[0])}</div>${decideBtns('decisions', d)}</article>`).join('') : '<p class="note">Nothing needs attention here.</p>'}</div></section>`;
  }
  function sectionActions(m) {
    const xs = m.actions.filter((x) => show('actions', x));
    const people = m.participants.map((p) => p.name);
    return `<section class="section" id="sec-actions"><header><div><h2>Actions</h2><p>Who does what, by when. Gaps are flagged, never filled in.</p></div></header><div class="items">${xs.length ? xs.map((a) => `<article class="${cls(a)}"><span class="id">${a.id}</span><div><div class="txt">${esc(a.task)}</div>
      <div class="meta">${a.gaps.filter((g) => g !== 'Definition of done not stated').map((g) => `<span class="tag high">${ic('alert')}${esc(g)}</span>`).join('') || '<span class="tag ok">' + ic('check') + 'Owned and dated</span>'}${a.dueText ? `<span class="tag line">Said: “${esc(a.dueText)}”</span>` : ''}<span class="tag line">${a.horizon === 'now' ? 'This week' : a.horizon === 'next' ? 'Within 30 days' : a.horizon === 'later' ? 'Later' : 'Undated'}</span></div>
      <div class="edit"><label style="flex:1;min-width:220px">Task<input data-edit="actions:${a.id}:task" value="${esc(a.task)}" style="width:100%"></label>
      <label>Owner<select data-edit="actions:${a.id}:owner" class="${a.owner ? '' : 'miss'}"><option value="">Not named</option>${people.map((p) => `<option ${p === a.owner ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
      <label>Due<input type="date" data-edit="actions:${a.id}:due" value="${a.due || ''}" class="${a.due ? '' : 'miss'}"></label></div>${evid(a.evidence[0])}</div>${decideBtns('actions', a)}</article>`).join('') : '<p class="note">Nothing needs attention here.</p>'}</div></section>`;
  }
  function sectionRisks(m) {
    const xs = m.risks.filter((x) => show('risks', x));
    return `<section class="section" id="sec-risks"><header><div><h2>Risks</h2><p>Ratings are indicative, read from the wording used. Adjust them if you know better.</p></div></header><div class="items">${xs.length ? xs.map((r) => `<article class="${cls(r)}"><span class="id">${r.id}</span><div><div class="txt">${esc(CE.riskHeadline(r.risk))}</div>
      <div class="meta"><span class="tag ${r.rating}">${r.rating[0].toUpperCase() + r.rating.slice(1)} · L${r.likelihood} × C${r.consequence}</span>${r.mitigation ? `<span class="tag line">Response: ${esc(r.mitigation)}</span>` : '<span class="tag high">' + ic('alert') + 'No response on record</span>'}${r.raisedBy ? `<span class="tag line">Raised by ${esc(r.raisedBy)}</span>` : ''}</div>
      <div class="edit"><label>Likelihood<select data-edit="risks:${r.id}:likelihood">${[1, 2, 3, 4, 5].map((n) => `<option ${n === r.likelihood ? 'selected' : ''}>${n}</option>`).join('')}</select></label><label>Consequence<select data-edit="risks:${r.id}:consequence">${[1, 2, 3, 4, 5].map((n) => `<option ${n === r.consequence ? 'selected' : ''}>${n}</option>`).join('')}</select></label></div>${evid(r.evidence[0])}</div>${decideBtns('risks', r)}</article>`).join('') : '<p class="note">Nothing needs attention here.</p>'}</div></section>`;
  }
  function sectionOpen(m) {
    const xs = m.openItems.filter((x) => show('open', x));
    return `<section class="section" id="sec-open"><header><div><h2>Open items</h2><p>Approvals pending, items parked and questions left unresolved.</p></div></header><div class="items">${xs.length ? xs.map((o) => `<article class="${cls(o)}"><span class="id">${o.id}</span><div><div class="txt">${esc(o.question)}</div><div class="meta"><span class="tag ${o.kind === 'approval' ? 'gold' : ''}">${o.kind === 'approval' ? 'Approval needed' : o.kind === 'deferred' ? 'Parked' : 'Unresolved'}</span>${o.raisedBy ? `<span class="tag line">Raised by ${esc(o.raisedBy)}</span>` : ''}</div>${evid(o.evidence[0])}</div>${decideBtns('open', o)}</article>`).join('') : '<p class="note">Nothing open.</p>'}</div></section>`;
  }
  let io;
  function observeSections() {
    if (io) io.disconnect();
    io = new IntersectionObserver((ents) => {
      ents.forEach((e) => {
        if (e.isIntersecting) {
          const id = e.target.id.replace('sec-', '');
          if (S.section !== id) {
            S.section = id;
            root.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('active', a.dataset.sec === id));
          }
        }
      });
    }, { rootMargin: '-90px 0px -70% 0px' });
    root.querySelectorAll('.section').forEach((s) => io.observe(s));
  }
  const listFor = (kind) => ({ decisions: S.model.decisions, actions: S.model.actions, risks: S.model.risks, open: S.model.openItems }[kind]);
  function rerenderKeepScroll() {
    const y = getY();
    render();
    setY(y);
  }

  /* ======================================================= STEP 3: DOCUMENT */
  const TEMPLATES = [
    ['board', 'Board briefing', 'Full record for directors and leadership', 'board'],
    ['exec', 'Executive summary', 'One page: the answer, decisions, next steps', 'one'],
    ['actions', 'Action plan', 'Five-field schedule, timeline and gaps', 'list'],
    ['decisions', 'Decision pack', 'Each decision with its evidence and links', 'gavel'],
    ['email', 'Follow-up email', 'Draft only. Never sent automatically', 'mail'],
  ];
  function viewDocument() {
    const t = TEMPLATES.find((x) => x[0] === S.template);
    return `<div class="doc-shell">
      <aside class="doc-side">
        <h3>Template</h3>
        <div class="tpls">${TEMPLATES.map(([k, n, d, i]) => `<button class="tpl ${S.template === k ? 'on' : ''}" data-tpl="${k}"><span class="ti">${ic(i)}</span><span><b>${n}</b><span>${d}</span></span></button>`).join('')}</div>
        <h3>On this document</h3>
        <ul class="outline" id="outline"></ul>
        <div class="note cmo-hide-viewer" style="margin-top:18px">Built from ${plural(S.model.stats.decisions, 'decision')}, ${plural(S.model.stats.actions, 'action')}, ${plural(S.model.stats.risks, 'risk')} and ${plural(S.model.stats.openItems, 'open item')} you kept. <a href="#" data-go="2">Back to review</a></div>
      </aside>
      <section class="doc-main">
        <div class="doc-bar"><div class="t">${t[1]}<span id="pgcount"></span></div><div class="acts">
          ${S.template === 'email' ? `<button class="btn sm" data-act="copy-email">${ic('copy')}<span>Copy email</span></button>` : (CAN_FILE ? `<button class="btn sm" data-act="copy-md">${ic('copy')}<span>Copy as text</span></button><button class="btn sm" data-act="dl-md">${ic('download')}<span>Markdown</span></button><button class="btn sm navy" data-act="print">${ic('print')}<span>Print or save PDF</span></button>` : `<span style="font-size:12px;color:var(--slate)">PDF export runs in the Workspace</span><button class="btn sm navy" data-act="copy-md">${ic('copy')}<span>Copy as text</span></button>`)}
        </div></div>
        <div class="pages" id="pages"></div>
      </section>
    </div>`;
  }

  /* --------------------------------------- shared document pieces */
  const keep = (x) => x.review !== 'excluded';
  function docData() {
    const m = S.model;
    return { m, D: m.decisions.filter(keep), Ac: m.actions.filter(keep), R: m.risks.filter(keep), Q: m.openItems.filter(keep) };
  }
  const citeShort = (e) => (e ? `${e.sourceId} · line ${e.line}${e.timestamp ? ` · ${e.timestamp}` : ''}${e.speaker ? ` · ${e.speaker}` : ''}` : '');
  function coverHtml(kind) {
    const m = S.model;
    const draft = m.gate.status !== 'Ready to circulate' || [...m.decisions, ...m.actions, ...m.risks, ...m.openItems].some((x) => x.review === 'proposed');
    return `<div class="cover"><img class="lg" src="${A.lockupRev}" alt="Concludo"><div class="stamp">${draft ? 'Draft for review' : 'Reviewed record'}</div>
      <div class="kick">${esc(kind)}</div><h1>${esc(m.meta.title)}</h1><div class="sub">${esc([m.meta.organisation, m.meta.meetingType, fmt(m.meta.meetingDate)].filter(Boolean).join('  ·  '))}</div></div>
      <div class="meta-strip">
        <div><span>Date</span><b>${esc(fmt(m.meta.meetingDate))}</b><small>${esc(new Date(m.meta.meetingDate + 'T00:00:00Z').toLocaleDateString('en-AU', { weekday: 'long', timeZone: 'UTC' }))}${m.signals.dateConfirmed ? '' : ', assumed'}</small></div>
        <div><span>Chair</span><b>${esc(m.meta.chair || 'Not recorded')}</b><small>${esc((m.participants.find((p) => p.name === m.meta.chair) || {}).role || '')}</small></div>
        <div><span>Attendance</span><b>${m.participants.filter((p) => p.present).length} present</b><small>${plural(m.participants.filter((p) => !p.present).length, 'apology', 'apologies')}</small></div>
        <div><span>Sources</span><b>${plural(m.sources.length, 'source')}</b><small>${esc(m.meta.duration || m.sources.map((s) => s.id).join(', '))}</small></div>
      </div>`;
  }
  const H = (no, title, intro, id) => `<div class="d-h" data-anchor="${id}" data-label="${esc(title)}"><span class="no">${no}</span><h2>${esc(title)}</h2></div>${intro ? `<p class="d-intro">${esc(intro)}</p>` : ''}`;
  const pillDue = (a) => (a.due ? `${short(a.due)}${a.dueApprox ? ' (approx.)' : ''}` : '<span class="miss">Not stated</span>');
  const owner = (a) => (a.owner ? esc(a.owner) : '<span class="miss">Not named</span>');
  const horizonLabel = { now: 'This week', next: '30 days', later: 'Later', undated: 'Undated' };

  function kpis({ D, Ac, R, Q }) {
    const cond = D.filter((d) => d.status === 'conditional').length;
    const owned = Ac.filter((a) => a.owner).length;
    const dated = Ac.filter((a) => a.due).length;
    const high = R.filter((r) => r.rating === 'high').length;
    const appr = Q.filter((q) => q.kind === 'approval').length;
    return `<div class="kpis">
      <div class="kpi"><b>${D.length}</b><span>Decisions</span><small>${cond ? `${cond} conditional` : 'All agreed'}</small></div>
      <div class="kpi"><b>${Ac.length}</b><span>Actions</span><small>${owned} owned, ${dated} dated</small></div>
      <div class="kpi g"><b>${Q.length}</b><span>Open items</span><small>${appr ? `${appr} need approval` : 'None need approval'}</small></div>
      <div class="kpi ${high ? 'r' : ''}"><b>${R.length}</b><span>Risks raised</span><small>${high} rated high</small></div></div>`;
  }
  function askBox() {
    const recs = S.model.recommendations.filter((r) => r.priority !== 'Medium').slice(0, 5);
    if (!recs.length) return '';
    return `<div class="ask"><h3>${ic('shield')}What this record asks of you</h3><ol>${recs.map((r) => `<li><b>${esc(r.title)}</b><br><small>${esc(r.why)}</small></li>`).join('')}</ol></div>`;
  }
  function gateRow() {
    const g = S.model.gate;
    return `<div class="status-row"><div class="gate"><span>Record status</span><b>${esc(g.status)}</b><small>${g.checks.filter((c) => c.pass).length} of ${g.checks.length} quality checks met</small></div>
      <div class="gchecks">${g.checks.map((c) => `<div><i class="${c.pass ? 'y' : 'n'}">${c.pass ? '✓' : '!'}</i><span>${esc(c.label)}<small>${esc(c.detail)}</small></span></div>`).join('')}</div></div>`;
  }
  function timeline(Ac) {
    const m = S.model;
    const dated = Ac.filter((a) => a.due).sort((a, b) => a.due.localeCompare(b.due));
    const start = m.meta.meetingDate;
    const dayN = (iso) => Math.round((Date.parse(iso) - Date.parse(start)) / 86400000);
    const span = Math.max(14, ...dated.map((a) => dayN(a.due) + 3));
    const x = (d) => `${Math.min(100, Math.max(0, (d / span) * 100))}%`;
    const bands = [[0, 7, 'This week', '#EAEFF6'], [7, Math.min(30, span), '30 days', '#F4F6FA'], ...(span > 30 ? [[30, span, 'Later', '#FBFCFE']] : [])];
    const byDay = {};
    dated.forEach((a) => (byDay[a.due] = (byDay[a.due] || []).concat(a)));
    const pins = Object.entries(byDay).map(([iso, list]) => list.map((a, k) => `<div class="tl-pin ${a.owner ? '' : 'gap'}" style="left:${x(dayN(iso))};bottom:${6.6 + 4.6 * k}mm"><b>${a.id}</b></div>`).join('')).join('');
    const ticks = [];
    const step = span <= 21 ? 7 : 14;
    for (let d = 0; d <= span; d += step) ticks.push(`<span class="tl-tick" style="left:${x(d)}">${short(new Date(Date.parse(start) + d * 86400000).toISOString().slice(0, 10))}</span>`);
    const und = Ac.filter((a) => !a.due);
    return `<div class="tl"><div class="tl-track">${bands.map(([a, b, l, c]) => `<div class="tl-band" style="left:${x(a)};width:calc(${x(b)} - ${x(a)});background:${c}"><span>${l}</span></div>`).join('')}<div class="tl-axis"></div><div class="tl-meet" style="left:0" title="Meeting"></div>${pins}${ticks.join('')}</div>
      <div class="tl-key"><span><b>●</b> Meeting, ${short(start)}</span><span>Pins show action IDs on their due date. Red pins have no owner.</span>${und.length ? `<span><b>Undated:</b> ${und.map((a) => a.id).join(', ')}</span>` : ''}</div></div>`;
  }
  function heatmap(R) {
    const tint = (l, c) => {
      const s = l * c;
      return s >= 15 ? '#F3D2CE' : s >= 9 ? '#F8E7B9' : '#DCEEE5';
    };
    let cells = '';
    for (let l = 5; l >= 1; l--) {
      cells += `<div class="ax">${l}</div>`;
      for (let c = 1; c <= 5; c++) cells += `<div class="c" style="background:${tint(l, c)}">${R.filter((r) => r.likelihood === l && r.consequence === c).map((r) => `<b>${r.id}</b>`).join('')}</div>`;
    }
    cells += '<div></div>' + [1, 2, 3, 4, 5].map((c) => `<div class="ax">${c}</div>`).join('');
    return `<div><div class="hm">${cells}</div><div class="hm-l"><span>↑ Likelihood</span><span>Consequence →</span></div><div class="hm-note">Indicative ratings, read from the wording used in the meeting and adjusted in review.</div></div>`;
  }
  function evidenceTable({ D, Ac, R, Q }) {
    const rows = [...D, ...Ac, ...R, ...Q].map((x) => {
      const e = x.evidence[0];
      return `<tr><td class="idc">${x.id}</td><td>“${esc(e.quote)}”</td><td class="muted" style="white-space:nowrap">${esc(e.sourceId)} · L${e.line}${e.timestamp ? `<br>${e.timestamp}` : ''}</td><td class="muted">${esc(e.speaker || '')}</td></tr>`;
    });
    return { type: 'table', pre: '', head: '<tr><th style="width:10mm">Ref</th><th>Quote</th><th style="width:20mm">Source</th><th style="width:26mm">Speaker</th></tr>', rows };
  }
  const pending = () => [...S.model.decisions, ...S.model.actions, ...S.model.risks, ...S.model.openItems].filter((x) => x.review === 'proposed').length;
  const reviewLine = () => (pending() ? `Draft: ${plural(pending(), 'item has', 'items have')} not yet been confirmed by a person.` : 'Every item was confirmed or excluded by a person before circulation.');
  const fine = () => `<div class="fineprint">Prepared with Concludo from the sources listed in this record. Items were extracted from those sources. ${reviewLine()} Nothing in this record is added from outside the sources; where the meeting did not state an owner, a date or a response, the record says so. Risk ratings and meeting measures are indicative and meeting level only: Concludo does not score individuals.${/fictional/i.test(S.model.meta.organisation || '') ? ' This record uses a fictional sample meeting.' : ''}</div>`;

  /* --------------------------------------- templates -> blocks */
  function tplBoard() {
    const d = docData();
    const { m, D, Ac, R, Q } = d;
    const b = [];
    b.push({ html: `<div class="bl" data-anchor="summary" data-label="Bottom line"><span class="lab">The bottom line</span>${esc(m.bottomLine)}</div>` });
    b.push({ html: kpis(d) });
    b.push({ html: askBox() });
    b.push({ html: gateRow() });
    b.push({ type: 'table', pre: H(1, 'Decisions', 'What the meeting settled, in the words used. Conditional decisions are not final until the approval shown is given.', 'decisions'), label: 'Decisions', head: '<tr><th style="width:10mm">ID</th><th>Decision and evidence</th><th style="width:24mm">Status</th><th style="width:27mm">Called by</th></tr>', rows: D.map((x) => `<tr><td class="idc">${x.id}</td><td><span class="main">${esc(x.statement)}</span><span class="q">“${esc(x.evidence[0].quote)}”</span><span class="cite">${esc(citeShort(x.evidence[0]))}</span></td><td><span class="pill ${x.status === 'conditional' ? 'cd' : 'ag'}">${x.status === 'conditional' ? 'Conditional' : 'Agreed'}</span>${x.condition ? `<span class="q" style="font-style:normal">${esc(x.condition)}</span>` : ''}</td><td>${esc(x.calledBy || '')}</td></tr>`), empty: 'No decisions were recorded.' });
    b.push({ html: H(2, 'Action plan', `${plural(Ac.length, 'action')} agreed: ${Ac.filter((a) => a.horizon === 'now').length} due this week, ${Ac.filter((a) => a.horizon === 'next').length} within 30 days, ${Ac.filter((a) => a.horizon === 'later').length} later and ${Ac.filter((a) => a.horizon === 'undated').length} without a date.`, 'actions') + timeline(Ac), keepNext: true });
    b.push({ type: 'table', label: 'Action plan', pre: '', head: '<tr><th style="width:10mm">ID</th><th>Action</th><th style="width:27mm">Owner</th><th style="width:22mm">Due</th><th style="width:30mm">Gaps</th></tr>', rows: Ac.map((a) => { const g = a.gaps.filter((x) => x !== 'Definition of done not stated'); return `<tr><td class="idc">${a.id}</td><td><span class="main">${esc(a.task)}</span><span class="cite">${esc(citeShort(a.evidence[0]))}</span></td><td>${owner(a)}</td><td>${pillDue(a)}</td><td><div class="gaps">${g.length ? g.map((x) => `<em>${esc(x)}</em>`).join('') : '<em class="okk">None</em>'}</div></td></tr>`; }), empty: 'No actions were recorded.' });
    const high = R.filter((r) => r.rating === 'high').length;
    const med = R.filter((r) => r.rating === 'medium').length;
    b.push({ html: H(3, 'Risks', 'Exposures raised in the meeting, with the response on record. Ratings are indicative.', 'risks') + `<div class="risk-wrap">${heatmap(R)}<div class="risk-sum"><div><b>${high}</b>rated high</div><div><b>${med}</b>rated medium</div><div><b>${R.filter((r) => !r.mitigation).length}</b>without a response on record</div><div><b>${R.filter((r) => r.mitigation && /owner not named/.test(r.mitigation)).length}</b>with a response that has no owner</div></div></div>`, keepNext: true });
    b.push({ type: 'table', label: 'Risks', pre: '', head: '<tr><th style="width:10mm">ID</th><th>Risk</th><th style="width:22mm">Rating</th><th style="width:52mm">Response on record</th></tr>', rows: R.map((r) => `<tr><td class="idc">${r.id}</td><td><span class="main">${esc(CE.riskHeadline(r.risk))}</span><span class="cite">${r.evidence[0].speaker ? 'Raised by ' : 'From '}${esc(citeShort(r.evidence[0]))}</span></td><td><span class="pill ${r.rating}">${r.rating}</span><span class="cite">L${r.likelihood} × C${r.consequence}</span></td><td>${r.mitigation ? esc(r.mitigation) : '<span class="miss">None stated</span>'}</td></tr>`), empty: 'No risks were raised.' });
    b.push({ type: 'table', label: 'Open items', pre: H(4, 'Open items and approvals', 'What the meeting did not settle. These seed the next agenda.', 'open'), head: '<tr><th style="width:10mm">ID</th><th>Item</th><th style="width:28mm">Type</th><th style="width:27mm">Raised by</th></tr>', rows: Q.map((q) => `<tr><td class="idc">${q.id}</td><td><span class="main">${esc(q.question)}</span><span class="cite">${esc(citeShort(q.evidence[0]))}</span></td><td><span class="pill ${q.kind === 'approval' ? 'cd' : 'ag'}">${q.kind === 'approval' ? 'Approval' : q.kind === 'deferred' ? 'Parked' : 'Unresolved'}</span></td><td>${esc(q.raisedBy || '')}</td></tr>`), empty: 'Nothing was left open.' });
    const recs = m.recommendations;
    b.push({ html: H(5, 'Recommended next steps', 'Derived only from gaps in this record: missing owners, dates, approvals and responses. Concludo proposes; the meeting owner decides.', 'recs'), keepNext: true });
    for (let i = 0; i < recs.length; i += 3) b.push({ html: `<div class="recs">${recs.slice(i, i + 3).map((r) => `<div class="rec"><span class="p ${r.priority}">${r.priority}</span><div><b>${esc(r.title)}</b><small>${esc(r.why)}</small></div></div>`).join('')}</div>` });
    if (!recs.length) b.push({ html: '<p class="d-intro">No gaps found. The record is complete.</p>' });
    b.push({ html: H(6, 'Record quality', 'How well the meeting produced a usable record. Meeting level only: no individual is scored.', 'quality') + `<div class="two"><div><div class="d-lead">Measured from the record</div><div class="hl">${m.health.dimensions.map((h) => `<div class="hl-row"><span>${esc(h.name)}</span><span class="trk"><i style="width:${h.score ?? 0}%"></i></span><span class="v">${h.score === null ? 'n/a' : h.score}</span><small>${esc(h.basis)}</small></div>`).join('')}</div><p class="hm-note">Not scored from a transcript alone: ${esc(m.health.notScored.join(', ').toLowerCase())}.</p></div>
      <div><div class="d-lead">Attendance</div><div class="people">${m.participants.map((p) => `<div><b>${esc(p.name)}</b><span>${esc(p.role || '')}${p.present ? '' : ', apology'}</span></div>`).join('')}</div><div class="d-lead">Sources</div><div class="people">${m.sources.map((s) => `<div><b>${s.id} · ${esc(s.name)}</b><span>${s.words.toLocaleString()} words</span></div>`).join('')}</div></div></div>` });
    const ev = evidenceTable(d);
    ev.label = 'Evidence appendix';
    ev.pre = H('A', 'Evidence appendix', 'Every item above, traced to the line it came from.', 'evidence');
    ev.pageBreak = true;
    b.push(ev);
    b.push({ html: fine() });
    return { kind: 'Board briefing · Meeting outcome record', blocks: b };
  }

  function tplExec(fit = 0) {
    const cap = [{ d: 5, n: 4, r: 3, u: 5, len: 95 }, { d: 4, n: 3, r: 3, u: 4, len: 85 }, { d: 4, n: 3, r: 2, u: 3, len: 75 }, { d: 3, n: 3, r: 2, u: 3, len: 65 }][Math.min(fit, 3)];
    const more = (shown, total) => (total > shown ? `<div class="cmo-more">+${total - shown} more in the Board briefing</div>` : '');
    const d = docData();
    const { m, D, Ac, R, Q } = d;
    const next = Ac.filter((a) => a.due).sort((a, b) => a.due.localeCompare(b.due)).slice(0, cap.n);
    const allNext = Ac.filter((a) => a.due).length;
    const unsettled = [...Q.map((q) => `${q.id}: ${q.question}`), ...Ac.filter((a) => !a.owner).map((a) => `${a.id} has no owner: ${a.task}`)];
    const b = [
      { html: `<div class="bl" data-anchor="summary" data-label="The answer"><span class="lab">The answer</span>${esc(m.bottomLine)}</div>` },
      { html: kpis(d) },
      { html: `<div class="cols"><div><div class="d-lead" data-anchor="decisions" data-label="Key decisions">Key decisions</div><div class="list">${D.slice(0, cap.d).map((x) => `<div><span class="idc">${x.id}</span><span><b>${esc(shortTxt(x.statement.replace(/,?\s*subject to.*$/i, ''), cap.len - 10))}</b><small>${x.status === 'conditional' ? `Conditional: ${esc(x.condition)}` : `Agreed · ${esc(x.calledBy || '')}`}</small></span></div>`).join('') || '<div><span></span><span>None recorded.</span></div>'}</div>${more(Math.min(cap.d, D.length), D.length)}</div>
        <div><div class="d-lead" data-anchor="next" data-label="Next steps">Next steps</div><div class="list">${next.map((a) => `<div><span class="idc">${a.id}</span><span><b>${esc(a.task)}</b><small>${a.owner ? esc(a.owner) : '<span style="color:var(--sig-high)">No owner</span>'} · ${esc(short(a.due))}${a.dueApprox ? ' (approx.)' : ''}</small></span></div>`).join('') || '<div><span></span><span>No dated actions.</span></div>'}</div>${more(next.length, allNext)}</div></div>` },
      { html: `<div class="cols"><div><div class="d-lead" data-anchor="risks" data-label="Critical risks">Critical risks</div><div class="list">${R.slice(0, cap.r).map((r) => `<div><span class="idc">${r.id}</span><span><b>${esc(shortTxt(r.risk.split(/(?<=\.)\s+/).reduce((a, b) => (b.length > a.length ? b : a)), cap.len))}</b><small><span class="pill ${r.rating}">${r.rating}</span> &nbsp;${r.mitigation ? 'Response: ' + esc(shortTxt(r.mitigation, 60)) : '<span style="color:var(--sig-high)">No response on record</span>'}</small></span></div>`).join('') || '<div><span></span><span>None raised.</span></div>'}</div>${more(Math.min(cap.r, R.length), R.length)}</div>
        <div>${unsettled.length ? `<div class="unsettled" data-anchor="unsettled" data-label="What was not settled" style="margin-top:4mm"><h3>What was not settled</h3><ul>${unsettled.slice(0, cap.u).map((u) => `<li>${esc(shortTxt(u, cap.len))}</li>`).join('')}</ul>${more(Math.min(cap.u, unsettled.length), unsettled.length)}</div>` : ''}</div></div>` },
      { html: `<div class="fineprint">Prepared with Concludo from ${plural(m.sources.length, 'source')}. ${reviewLine()} Nothing is added from outside the sources. The full record, with evidence for every item, is in the Board briefing.${/fictional/i.test(m.meta.organisation || '') ? ' Fictional sample meeting.' : ''}</div>` },
    ];
    return { kind: 'Executive summary · One page', blocks: b, compact: true, fitLevels: 4 };
  }

  function tplActions() {
    const d = docData();
    const { m, Ac, R } = d;
    const b = [
      { html: `<div class="bl" data-anchor="summary" data-label="Delivery brief"><span class="lab">Delivery brief</span>${plural(Ac.length, 'action')} came out of this meeting. ${Ac.filter((a) => a.horizon === 'now').length} are due this week and ${Ac.filter((a) => a.horizon === 'next').length} within 30 days. ${Ac.filter((a) => !a.owner).length ? `${plural(Ac.filter((a) => !a.owner).length, 'action has', 'actions have')} no owner. ` : ''}${Ac.filter((a) => !a.due).length ? `${plural(Ac.filter((a) => !a.due).length, 'action has', 'actions have')} no date.` : 'Every action is dated.'}</div>` },
      { html: H(1, 'Timeline', '', 'timeline') + timeline(Ac), keepNext: false },
      { type: 'table', label: 'Action schedule', pre: H(2, 'Five-field action schedule', 'Task, owner, due date, definition of done and source. Blank fields were not stated in the meeting.', 'schedule'), head: '<tr><th style="width:10mm">ID</th><th>Task</th><th style="width:26mm">Owner</th><th style="width:21mm">Due</th><th style="width:40mm">Definition of done</th></tr>', rows: Ac.map((a) => `<tr><td class="idc">${a.id}<br><span class="pill ${a.horizon}" style="margin-top:1mm">${horizonLabel[a.horizon]}</span></td><td><span class="main">${esc(a.task)}</span><span class="q">“${esc(a.evidence[0].quote)}”</span><span class="cite">${esc(citeShort(a.evidence[0]))}</span></td><td>${owner(a)}</td><td>${pillDue(a)}${a.dueText ? `<span class="cite">Said: ${esc(a.dueText)}</span>` : ''}</td><td>${a.doneDefinition ? esc(a.doneDefinition) : '<span class="muted">Not stated. Agree with the owner.</span>'}</td></tr>`) },
      { type: 'table', pre: H(3, 'Gaps to close', 'Owner and date gaps first. Each one is a reason an action could stall.', 'gaps'), head: '<tr><th style="width:10mm">ID</th><th>Gap</th><th>Action</th></tr>', rows: Ac.flatMap((a) => a.gaps.filter((g) => g !== 'Definition of done not stated').map((g) => `<tr><td class="idc">${a.id}</td><td class="miss">${esc(g)}</td><td>${esc(a.task)}</td></tr>`)), empty: 'No owner or date gaps.' },
      { type: 'table', pre: H(4, 'Actions that answer a risk', 'Where an action was agreed in response to a risk raised in the meeting.', 'linked'), head: '<tr><th style="width:10mm">Risk</th><th>Risk raised</th><th style="width:62mm">Response</th></tr>', rows: R.filter((r) => r.mitigation).map((r) => `<tr><td class="idc">${r.id}</td><td>${esc(CE.riskHeadline(r.risk))}<span class="cite"><span class="pill ${r.rating}">${r.rating}</span></span></td><td>${esc(r.mitigation)}</td></tr>`), empty: 'No risk responses recorded.' },
      { html: fine() },
    ];
    void m;
    return { kind: 'Action plan · Now, next, later', blocks: b };
  }

  function tplDecisions() {
    const d = docData();
    const { m, D, Ac, Q } = d;
    const turnBefore = (e) => {
      const src = S.model.sources.find((s) => s.id === e.sourceId);
      return src;
    };
    void turnBefore;
    const b = [{ html: `<div class="bl" data-anchor="summary" data-label="Summary"><span class="lab">Decision summary</span>${plural(D.length, 'decision was', 'decisions were')} recorded at this meeting. ${D.filter((x) => x.status === 'conditional').length ? `${D.filter((x) => x.status === 'conditional').length} ${D.filter((x) => x.status === 'conditional').length === 1 ? 'is' : 'are'} conditional and not final until the approval shown is given.` : 'All are agreed without conditions.'} Rationale and alternatives are shown only where the meeting stated them.</div>` }];
    D.forEach((x, i) => {
      const e = x.evidence[0];
      const toks = (t) => new Set((t.toLowerCase().match(/[a-z0-9$]+/g) || []).map((w) => w.replace(/'s$/, '')).filter((w) => w.length > 3 && !['that', 'this', 'with', 'from', 'until', 'subject', 'before', 'after', 'will', 'have'].includes(w)));
      const dt = toks(x.statement);
      const related = Ac.filter((a) => a.evidence.some((ae) => ae.sourceId === e.sourceId && ae.line > e.line && ae.line - e.line <= 4) && [...toks(a.task)].some((w) => dt.has(w)));
      const approvals = Q.filter((q) => q.kind === 'approval' && q.evidence.some((qe) => qe.line === e.line && qe.sourceId === e.sourceId));
      b.push({ html: `<div class="dcard" ${i === 0 ? 'data-anchor="register" data-label="Decision register"' : ''}><div class="dh"><b>${x.id}</b><span class="pill ${x.status === 'conditional' ? 'cd' : 'ag'}">${x.status === 'conditional' ? 'Conditional' : 'Agreed'}</span></div><div class="db"><div class="st">${esc(x.statement)}</div>
        <dl class="dgrid"><dt>Called by</dt><dd>${esc(x.calledBy || 'Not recorded')}, ${esc(fmt(m.meta.meetingDate))}</dd>
        <dt>Condition</dt><dd>${x.condition ? esc(x.condition) : '<span class="ns">None stated</span>'}</dd>
        <dt>Evidence</dt><dd>“${esc(e.quote)}”<span class="cite" style="display:block;color:var(--slate);font-size:7pt">${esc(citeShort(e))}</span></dd>
        <dt>Linked actions</dt><dd>${related.length ? related.map((a) => `${a.id}: ${esc(a.task)} (${a.owner ? esc(a.owner) : 'no owner'})`).join('<br>') : '<span class="ns">None agreed on the same topic</span>'}</dd>
        <dt>Approval pending</dt><dd>${approvals.length ? approvals.map((q) => `${q.id}: ${esc(q.question.split(', needed before')[0])}`).join('<br>') : '<span class="ns">None</span>'}</dd>
        <dt>Not on record</dt><dd><span class="ns">Rationale and review trigger. Add both before filing if this decision may be revisited.</span></dd></dl></div></div>` });
    });
    b.push({ html: fine() });
    return { kind: 'Decision pack · Governance record', blocks: b };
  }

  /* --------------------------------------- paginator */
  async function buildDocument() {
    const host = $('#pages');
    if (!host) return;
    if (S.template === 'email') {
      const e = CE.followUpEmail(S.model);
      host.innerHTML = `<div class="email-card"><div class="eh"><div><b>To</b>${esc(S.model.participants.filter((p) => p.present).map((p) => p.name).join(', '))}</div><div><b>Subject</b>${esc(e.subject)}</div></div><pre>${esc(e.body)}</pre><div class="ef">Draft only. Concludo never sends email. Copy it into your mail app, check it, then send.</div></div>`;
      $('#outline').innerHTML = '';
      $('#pgcount').textContent = '';
      return;
    }
    await (document.fonts ? document.fonts.ready : Promise.resolve());
    const make = { board: tplBoard, exec: tplExec, actions: tplActions, decisions: tplDecisions }[S.template];
    let fit = 0;
    let spec = make(fit);
    for (;;) {
    host.innerHTML = '';
    const pages = [];
    const runHtml = `<div class="pg-run"><img src="${A.lockup}" alt="Concludo"><div class="rt">${esc(spec.kind.split(' · ')[0])}<br><b>${esc(S.model.meta.title)}</b></div></div>`;
    const newPage = (first) => {
      const p = document.createElement('div');
      p.className = 'page';
      p.className = 'page' + (spec.compact ? ' compact' : '');
      p.innerHTML = `${first ? coverHtml(spec.kind) : runHtml}<div class="pg-body"></div><div class="pg-foot"><span>${esc(S.model.meta.organisation || 'Concludo')} · ${esc(fmt(S.model.meta.meetingDate))} · Commercial in confidence</span><span class="pn"></span></div>`;
      host.appendChild(p);
      pages.push(p);
      return p.querySelector('.pg-body');
    };
    const over = (body) => body.scrollHeight > body.clientHeight + 1;
    let body = newPage(true);
    const frag = (html) => {
      const t = document.createElement('div');
      t.innerHTML = html;
      return t;
    };
    const moveKeep = (fromBody, toBody) => {
      const last = fromBody.lastElementChild;
      if (last && last.dataset.keep === '1' && fromBody.children.length > 1) toBody.appendChild(last);
    };
    for (const blk of spec.blocks) {
      if (blk.type === 'table') {
        if (blk.pageBreak && body.children.length) body = newPage(false);
        const mk = (cont) => frag(`${cont ? `<div class="d-h"><h2 style="font-size:9.5pt;color:var(--slate)">${esc(blk.label || 'Continued')}, continued</h2></div>` : blk.pre}<table class="dt"><thead>${blk.head}</thead><tbody></tbody></table>`);
        let wrap = mk(false);
        body.appendChild(wrap);
        if (!blk.rows.length) {
          wrap.querySelector('table').outerHTML = `<p class="d-intro">${esc(blk.empty || 'None.')}</p>`;
          if (over(body)) { body.removeChild(wrap); const nb = newPage(false); moveKeep(body, nb); body = nb; body.appendChild(wrap); }
          continue;
        }
        let tb = wrap.querySelector('tbody');
        let placedHere = 0;
        for (const r of blk.rows) {
          const tmp = document.createElement('tbody');
          tmp.innerHTML = r;
          const tr = tmp.firstElementChild;
          tb.appendChild(tr);
          if (over(body)) {
            tb.removeChild(tr);
            const nb = newPage(false);
            if (placedHere === 0) {
              body.removeChild(wrap);
              moveKeep(body, nb);
              body = nb;
              body.appendChild(wrap);
            } else {
              body = nb;
              wrap = mk(true);
              body.appendChild(wrap);
              tb = wrap.querySelector('tbody');
            }
            tb.appendChild(tr);
            placedHere = 0;
          }
          placedHere++;
        }
      } else {
        if (!blk.html) continue;
        const el = frag(blk.html);
        if (blk.keepNext) el.dataset.keep = '1';
        body.appendChild(el);
        if (over(body) && body.children.length > 1) {
          body.removeChild(el);
          const nb = newPage(false);
          moveKeep(body, nb);
          body = nb;
          body.appendChild(el);
        }
      }
    }
    if (spec.fitLevels && pages.length > 1 && fit < spec.fitLevels - 1) { fit++; spec = make(fit); continue; }
    pages.forEach((p, i) => (p.querySelector('.pn').textContent = `Page ${i + 1} of ${pages.length}`));
    pages.forEach((p, i) => (p.id = `pg-${i + 1}`));
    // outline
    const out = [];
    pages.forEach((p, i) => p.querySelectorAll('[data-anchor]').forEach((a) => out.push({ label: a.dataset.label, page: i + 1, el: a })));
    $('#outline').innerHTML = out.map((o, k) => `<li><a href="#" data-jump="${k}">${esc(o.label)}<span>p. ${o.page}</span></a></li>`).join('');
    S.outline = out;
    $('#pgcount').textContent = `${pages.length} page${pages.length === 1 ? '' : 's'} · A4`;
    break;
    }
  }

  /* ======================================================= events */
  on(root, 'click', async (ev) => {
    const t = ev.target.closest('[data-go],[data-act],[data-tab],[data-rm],[data-rev],[data-filter],[data-tpl],[data-sec],[data-jump]');
    if (!t) return;
    if (t.dataset.go) {
      ev.preventDefault();
      const n = +t.dataset.go;
      if (n === 1 || S.model) { S.step = n; setY(0); render(); }
      return;
    }
    if (t.dataset.tab) { S.tab = t.dataset.tab; render(); return; }
    if (t.dataset.rm) { S.sources.splice(+t.dataset.rm - (S.draft.trim() ? 1 : 0), 1); if (S.draft.trim() && +t.dataset.rm === 0) S.draft = ''; render(); return; }
    if (t.dataset.filter) { S.filter = t.dataset.filter; rerenderKeepScroll(); return; }
    if (t.dataset.tpl) { S.template = t.dataset.tpl; render(); setY(0); return; }
    if (t.dataset.sec) { ev.preventDefault(); const el = $('#sec-' + t.dataset.sec); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
    if (t.dataset.jump) { ev.preventDefault(); const o = S.outline[+t.dataset.jump]; if (o) { const sc = scroller(); const top = o.el.getBoundingClientRect().top - (sc === document.scrollingElement ? 0 : sc.getBoundingClientRect().top) + sc.scrollTop - 140; setY(top, true); } return; }
    if (t.dataset.rev) {
      const [kind, id, val] = t.dataset.rev.split(':');
      const x = listFor(kind).find((i) => i.id === id);
      x.review = x.review === val ? 'proposed' : val;
      CE.refresh(S.model);
      rerenderKeepScroll();
      return;
    }
    const act = t.dataset.act;
    if (act === 'sample') {
      S.sources = [{ name: 'cutover-plan-notes.md', kind: 'document', text: SAMPLE_DOC }];
      S.draft = SAMPLE_TRANSCRIPT;
      S.draftNotes = '';
      S.tab = 'paste';
      S.meta = { title: '', meetingType: '', meetingDate: '', organisation: '', project: '' };
      S.detected = {};
      render();
      detectMeta();
    }
    if (act === 'pick') $('#file').click();
    if (act === 'generate') generate();
    if (act === 'confirm-all') {
      [...S.model.decisions, ...S.model.actions, ...S.model.risks, ...S.model.openItems].forEach((x) => x.review === 'proposed' && (x.review = 'confirmed'));
      CE.refresh(S.model);
      rerenderKeepScroll();
    }
    if (act === 'print') {
      if (finishPrint) finishPrint();
      // Print outside the fixed-height Workspace shell, which clips after page one.
      const portal = document.createElement('div');
      portal.className = 'cmo cmo-print-root';
      portal.appendChild($('.pages').cloneNode(true));
      document.body.appendChild(portal);
      document.documentElement.classList.add('cmo-printing');
      const pg = document.createElement('style');
      pg.textContent = '@page { size: A4; margin: 0; }';
      document.head.appendChild(pg);
      const done = () => {
        document.documentElement.classList.remove('cmo-printing');
        pg.remove(); portal.remove();
        window.removeEventListener('afterprint', done);
        finishPrint = null;
      };
      finishPrint = done;
      window.addEventListener('afterprint', done);
      try { window.print(); } catch (error) { done(); throw error; }
    }
    if (act === 'copy-md') { await copy(CE.toMarkdown(S.model)); toast('Copied as text'); }
    if (act === 'dl-md') download(`${S.model.meta.title.replace(/[^\w]+/g, '-')}.md`, CE.toMarkdown(S.model), 'text/markdown');
    if (act === 'copy-email') { const e = CE.followUpEmail(S.model); await copy(`Subject: ${e.subject}\n\n${e.body}`); toast('Email draft copied'); }
    if (act === 'save') (opts.onSave ? modalSaveWired() : modalSave());
    if (act === 'do-save') doSave(t);
    if (act === 'copy-json') { await copy(JSON.stringify(S.model, null, 2)); root.querySelector('.modal-bg')?.remove(); toast('Record copied'); }
    if (act === 'close') root.querySelector('.modal-bg')?.remove();
    if (act === 'dl-json') { download(`${S.model.meta.title.replace(/[^\w]+/g, '-')}.concludo.json`, JSON.stringify(S.model, null, 2), 'application/json'); root.querySelector('.modal-bg')?.remove(); }
  });
  on(root, 'input', (ev) => {
    const t = ev.target;
    if (t.dataset.bind) { S[t.dataset.bind] = t.value; detectMeta(); updateSignals(); }
    if (t.dataset.meta) { S.meta[t.dataset.meta] = t.value; }
  });
  function updateSignals() {
    // keep focus while typing: only refresh the Generate button state
    const btn = root.querySelector('[data-act="generate"]');
    if (btn) btn.disabled = !allSources().length;
  }
  on(root, 'change', (ev) => {
    const t = ev.target;
    if (t.dataset.meta) { S.meta[t.dataset.meta] = t.value; delete S.detected[t.dataset.meta]; }
    if (t.dataset.kind !== undefined && t.dataset.kind !== '') {
      const i = +t.dataset.kind;
      const hasDraft = !!S.draft.trim();
      if (hasDraft && i === 0) { S.sources.unshift({ name: 'Pasted transcript', kind: t.value, text: S.draft }); S.draft = ''; } else S.sources[i - (hasDraft ? 1 : 0)].kind = t.value;
      render();
    }
    if (t.id === 'file') addFiles([...t.files]);
    if (t.dataset.edit) {
      const [kind, id, field] = t.dataset.edit.split(':');
      const x = listFor(kind).find((i) => i.id === id);
      if (field === 'owner') { x.owner = t.value || undefined; x.ownerBasis = t.value ? 'stated' : 'none'; }
      else if (field === 'due') { x.due = t.value || undefined; x.dueApprox = false; x.dueText = undefined; }
      else if (field === 'likelihood' || field === 'consequence') { x[field] = +t.value; const s = x.likelihood * x.consequence; x.rating = s >= 15 ? 'high' : s >= 9 ? 'medium' : 'low'; }
      else x[field] = t.value;
      CE.refresh(S.model);
      rerenderKeepScroll();
    }
  });
  on(root, 'dragover', (e) => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); d.classList.add('over'); } });
  on(root, 'dragleave', (e) => { const d = e.target.closest && e.target.closest('#drop'); if (d) d.classList.remove('over'); });
  on(root, 'drop', (e) => { const d = e.target.closest && e.target.closest('#drop'); if (d) { e.preventDefault(); addFiles([...e.dataTransfer.files]); } });

  function modalSave() {
    const m = S.model;
    const div = document.createElement('div');
    div.className = 'modal-bg';
    div.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Save to project"><div class="mh"><h2 style="font-size:16px">Save to project</h2><button class="btn ghost sm" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="mb"><p style="margin:0">In the Workspace, saving files this record to a project and adds the items you kept to the registers:</p>
      <div class="mini-stats" style="margin:0"><div><b>${m.stats.decisions}</b><span>to Decision memory</span></div><div><b>${m.stats.actions}</b><span>to the Action tracker</span></div><div><b>${m.sources.length}</b><span>source files</span></div><div><b>1</b><span>meeting record</span></div></div>
      <p class="note" style="margin:0">This preview runs on its own and is not connected to a Workspace account, so nothing is stored. ${CAN_FILE ? 'Download' : 'Copy'} the record to keep it.</p></div>
      <div class="mf"><button class="btn" data-act="close">Close</button>${CAN_FILE ? `<button class="btn primary" data-act="dl-json">${ic('download')}Download record (.json)</button>` : `<button class="btn primary" data-act="copy-json">${ic('copy')}Copy record (JSON)</button>`}</div></div>`;
    div.addEventListener('click', (e) => e.target === div && div.remove());
    root.appendChild(div);
  }
  async function modalSaveWired() {
    const m = S.model;
    const div = document.createElement('div');
    div.className = 'modal-bg';
    div.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="Save to project"><div class="mh"><h2 style="font-size:16px">Save to project</h2><button class="btn ghost sm" data-act="close" aria-label="Close">${ic('x')}</button></div><div class="mb"><p class="note" style="margin:0">Loading projects…</p></div></div>`;
    div.addEventListener('click', (e) => e.target === div && div.remove());
    root.appendChild(div);
    let projects = [];
    try { projects = opts.listProjects ? await opts.listProjects() : []; } catch (e) { projects = []; }
    const unowned = m.actions.filter((a) => a.review !== 'excluded' && !a.owner);
    const proposed = [...m.decisions, ...m.actions, ...m.risks, ...m.openItems].filter((x) => x.review === 'proposed').length;
    div.querySelector('.modal').innerHTML = `<div class="mh"><h2 style="font-size:16px">Save to project</h2><button class="btn ghost sm" data-act="close" aria-label="Close">${ic('x')}</button></div>
      <div class="mb">
        <div class="chipset"><button class="chip ${projects.length ? 'on' : ''}" data-savemode="existing" ${projects.length ? '' : 'disabled'}>Existing project (${projects.length})</button><button class="chip ${projects.length ? '' : 'on'}" data-savemode="new">New project</button></div>
        <div class="field" data-pane="existing" ${projects.length ? '' : 'hidden'}><label for="cmo-proj">Project</label><select id="cmo-proj">${projects.map((p) => `<option value="${esc(p.id)}">${esc(p.title)}${p.client ? ` (${esc(p.client)})` : ''}</option>`).join('')}</select></div>
        <div data-pane="new" ${projects.length ? 'hidden' : ''}><div class="field"><label for="cmo-ptitle">Project title</label><input id="cmo-ptitle" value="${esc(m.meta.project || m.meta.title)}"></div><div class="field"><label for="cmo-pclient">Client or organisation</label><input id="cmo-pclient" value="${esc(m.meta.organisation || '')}"></div></div>
        <div class="mini-stats" style="margin:0"><div><b>${m.stats.decisions}</b><span>to Decision memory</span></div><div><b>${m.stats.actions}</b><span>to the Action tracker</span></div><div><b>${m.sources.length}</b><span>source files</span></div><div><b>4</b><span>outputs</span></div></div>
        ${unowned.length ? `<div class="warn" style="margin:0">${ic('alert')}<span>${plural(unowned.length, 'action has', 'actions have')} no owner (${unowned.map((a) => a.id).join(', ')}). ${unowned.length === 1 ? 'It' : 'They'} will be saved as unassigned, not given a placeholder name. <a href="#" data-go="2">Name an owner first</a></span></div>` : ''}
        ${proposed ? `<div class="note" style="margin:0">${plural(proposed, 'item is', 'items are')} not yet confirmed. Saving keeps everything you have not excluded.</div>` : ''}
        <div class="err" data-save-err hidden></div>
      </div>
      <div class="mf"><button class="btn" data-act="close">Cancel</button><button class="btn primary" data-act="do-save">${ic('save')}Save record</button></div>`;
    div.querySelectorAll('[data-savemode]').forEach((b) => b.addEventListener('click', () => {
      div.querySelectorAll('[data-savemode]').forEach((x) => x.classList.toggle('on', x === b));
      div.querySelectorAll('[data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== b.dataset.savemode));
    }));
  }
  async function doSave(btn) {
    const div = root.querySelector('.modal-bg');
    const mode = div.querySelector('[data-savemode].on')?.dataset.savemode || 'new';
    const target = mode === 'existing' ? { mode, projectId: div.querySelector('#cmo-proj').value } : { mode, title: div.querySelector('#cmo-ptitle').value.trim(), client: div.querySelector('#cmo-pclient').value.trim() };
    if (target.mode === 'new' && !target.title) { const e = div.querySelector('[data-save-err]'); e.hidden = false; e.textContent = 'Give the new project a title.'; return; }
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const res = await opts.onSave(S.model, target, { sources: allSources(), markdown: CE.toMarkdown(S.model), email: CE.followUpEmail(S.model) });
      div.remove();
      toast('Saved to project');
      if (opts.onSaved && res && res.projectId) setTimeout(() => opts.onSaved(res.projectId), 700);
    } catch (e) {
      const el = div.querySelector('[data-save-err]');
      el.hidden = false;
      el.textContent = (e && e.message) || 'The record could not be saved. Nothing was lost: try again.';
      btn.disabled = false;
      btn.innerHTML = `${ic('save')}Save record`;
    }
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); } catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  }
  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `${ic('check')}${esc(msg)}`;
    root.appendChild(t);
    setTimeout(() => t.remove(), 1800);
  }

  if (opts.model) {
    S.model = opts.model;
    S.step = 3;
    if (opts.template) S.template = opts.template;
    if (opts.viewer) root.classList.add('cmo-viewer');
  }
  render();
  const api = { S, render, generate };
  root.__cmo = api;
  return function unmount() {
    if (finishPrint) finishPrint();
    listeners.forEach(([t, ty, fn]) => t.removeEventListener(ty, fn));
    if (io) io.disconnect();
    root.innerHTML = '';
    root.classList.remove('cmo', 'cmo-embedded', 'cmo-viewer');
    delete root.__cmo;
  };
}

/** Read-only document view of a saved v2 record, for the project page. */
export function mountMeetingDocument(root, model, options = {}) {
  return mountMeetingStudio(root, { ...options, model: CE.refresh(model), viewer: true, embedded: true });
}
