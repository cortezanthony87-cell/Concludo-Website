/**
 * Renders a deck plan to a self-contained HTML document of 16:9 pages
 * (13.333 x 7.5 in). Printing it from the browser, or with any headless
 * browser, produces the PDF copy of the deck with fonts embedded.
 *
 * Same plan, same wording and same page breaks as the PPTX.
 */
import { DeckOptions, DeckPayload } from './deckPayload';
import {
  ACTION_COLS, ActionsSlide, BottomSlide, CoverSlide, DECISION_COLS, DecisionsSlide, Footer, M, NextSlide,
  OPEN_COL_W, OPEN_TOP, OpenSlide, SlideSpec, TABLE_TOP, planDeck,
} from './deckPlan';

export interface HtmlDeckOptions extends DeckOptions {
  /** Extra CSS, normally the @font-face rules the Workspace already ships. */
  fontCss?: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inch = (n: number) => `${+n.toFixed(3)}in`;

export function renderDeckHtml(payload: DeckPayload, opts: HtmlDeckOptions = {}): { html: string; fileName: string; slideCount: number } {
  const plan = planDeck(payload, opts);
  const safe = opts.fonts === 'safe';
  const head = safe ? 'Arial, sans-serif' : `'Concludo Poppins', Poppins, Montserrat, Arial, sans-serif`;
  const body = safe ? 'Arial, sans-serif' : `'Concludo Inter', Inter, 'Segoe UI', Arial, sans-serif`;
  const mono = safe ? 'Consolas, monospace' : `'IBM Plex Mono', Consolas, monospace`;
  const logo = opts.logo;

  function footer(f: Footer, dark: boolean) {
    const right = `${f.preparedWith ? 'Prepared with Concludo &nbsp;·&nbsp; ' : ''}${String(f.page).padStart(2, '0')}`;
    return `<div class="foot${dark ? ' dk' : ''}"><span>${esc(f.left)}</span>${f.logo && logo ? `<img src="${logo.dataUrl}" alt="Concludo">` : '<i></i>'}<span>${right}</span></div>`;
  }
  const headBlock = (kicker: string, headline: string) => `<div class="kick" style="top:0.5in">${esc(kicker)}</div><h1>${esc(headline)}</h1>`;
  const gap = '<span class="gap">Not stated</span>';

  function page(s: SlideSpec): string {
    switch (s.kind) {
      case 'cover': return cover(s);
      case 'bottom': return bottom(s);
      case 'decisions': return decisions(s);
      case 'actions': return actions(s);
      case 'open': return open(s);
      case 'next': return next(s);
    }
  }

  function cover(s: CoverSlide) {
    return `<section class="pg navy">
      <div class="band">${logo ? `<img src="${logo.dataUrl}" alt="Concludo">` : ''}</div>
      <div class="kick" style="top:1.75in">${esc(s.kicker)}</div>
      <div class="ctitle">${esc(s.title)}${s.outcome ? `<div class="outcome">${esc(s.outcome)}</div>` : ''}${s.metaLine ? `<div class="meta">${esc(s.metaLine)}</div>` : ''}</div>
      <div class="counts">${s.counts.map((c) => `<div><span>${esc(c.label)}</span><b>${c.value}</b></div>`).join('')}</div>
      <div class="stamp">${esc(s.preparedBy)}<br>${esc(s.approved)}</div>
      <div class="foot dk"><span>${esc(s.recordLine)}</span><i></i><span>${esc(s.classification)}</span></div>
    </section>`;
  }

  function bottom(s: BottomSlide) {
    const cards = s.cards.map((c) => `<div class="card${c.accent ? ' acc' : ''}"><div class="lab">${esc(c.label)}</div><div class="ct${s.cards.length === 1 ? ' big' : ''}">${esc(c.text)}</div><div class="src">${esc(c.source)}</div></div>`).join('');
    return `<section class="pg light">${headBlock('The bottom line', s.headline)}
      ${s.cards.length ? `<div class="cards">${cards}</div>` : ''}
      ${s.body ? `<p class="lead" style="top:${s.cards.length ? '4.65in' : '2.3in'}">${esc(s.body)}</p>` : ''}
      ${footer(s.footer, false)}</section>`;
  }

  function table(cols: number[], headers: string[], rows: string[]) {
    return `<table style="top:${inch(TABLE_TOP)}"><colgroup>${cols.map((w) => `<col style="width:${inch(w)}">`).join('')}</colgroup>
      <thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>`;
  }

  function decisions(s: DecisionsSlide) {
    const rows = s.rows.map((r) => `<tr><td class="id">${esc(r.id)}</td>
      <td><b>${esc(r.text)}</b><div class="src">${esc(r.source)}</div>${r.quote ? `<div class="src q">"${esc(r.quote)}"</div>` : ''}</td>
      <td>${r.decidedBy ? `${esc(r.decidedBy)}${r.decidedByOrg ? `<div class="org">${esc(r.decidedByOrg)}</div>` : ''}` : gap}</td>
      <td>${r.conditions ? esc(r.conditions) : '<span class="quiet">None stated</span>'}</td></tr>`);
    return `<section class="pg">${headBlock(s.continued ? 'Decisions, continued' : 'Decisions', s.headline)}
      ${table(DECISION_COLS, ['ID', 'Decision', 'Decided by', 'Conditions'], rows)}${footer(s.footer, false)}</section>`;
  }

  function actions(s: ActionsSlide) {
    const rows = s.rows.map((r) => `<tr><td class="id">${esc(r.id)}</td><td>${esc(r.text)}</td>
      <td>${r.owner ? `${esc(r.owner)}${r.clientSide ? '<span class="tag">Client</span>' : ''}` : gap}</td>
      <td${r.first ? ' class="first"' : ''}>${r.due ? esc(r.due) : gap}</td>
      <td>${r.doneWhen ? esc(r.doneWhen) : gap}</td></tr>`);
    return `<section class="pg">${headBlock(s.continued ? 'Actions, continued' : 'Actions', s.headline)}
      ${table(ACTION_COLS, ['ID', 'Action', 'Owner', 'By', 'Done when'], rows)}${footer(s.footer, false)}</section>`;
  }

  function open(s: OpenSlide) {
    const col = (items: OpenSlide['questions'], label: string, left: number) => items.length
      ? `<div class="ocol" style="left:${inch(left)}"><div class="olab">${label}</div>${items.map((i) => `<div class="oi"><div class="oid">${esc(i.id)}</div><div class="ot">${esc(i.text)}</div><div class="od">${esc(i.detail)}</div></div>`).join('')}</div>`
      : '';
    const x2 = M.x + OPEN_COL_W + 0.5;
    const both = s.questions.length && s.risks.length;
    return `<section class="pg navy">${headBlock(s.continued ? 'Still open, continued' : 'What was not settled', s.headline)}
      ${col(s.questions, 'Open questions', M.x)}${col(s.risks, 'Risks raised in the meeting', both ? x2 : M.x)}
      ${footer(s.footer, true)}</section>`;
  }

  function next(s: NextSlide) {
    return `<section class="pg light">${headBlock(s.kicker, s.headline)}
      <div class="nleft">
        ${s.mustProduce ? `<div class="nlab">It must produce</div><div class="must">${esc(s.mustProduce)}</div>` : ''}
        ${s.bring.length ? `<div class="nlab">Bring</div><ul>${s.bring.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : ''}
        ${s.fallback ? `<p class="fb">${esc(s.fallback)}</p>` : ''}
      </div>
      ${s.correction ? `<div class="corr"><div class="lab">Correct the record</div><p>If anything here is wrong, tell ${esc(s.correction.contact)} by <b>${esc(s.correction.deadline)}</b>. After that, this record stands.</p></div>` : ''}
      ${footer(s.footer, false)}</section>`;
  }

  const pages = plan.slides.map((s) => page(s)).join('\n');

  const css = `
  @page{size:13.333in 7.5in;margin:0}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:#fff}
  body{font-family:${body};color:#16263F;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pg{position:relative;width:13.333in;height:7.5in;overflow:hidden;background:#fff;page-break-after:always;break-after:page}
  .pg:last-child{page-break-after:auto;break-after:auto}
  .pg.navy{background:#16263F;color:#fff}.pg.light{background:#F4F6FA}
  .kick{position:absolute;left:${inch(M.x)};font-family:${mono};font-size:9.5pt;letter-spacing:.16em;text-transform:uppercase;color:#5A6478}
  .navy .kick{color:#AEB9CC}
  h1{position:absolute;left:${inch(M.x)};top:0.82in;width:10.9in;font-family:${head};font-weight:700;font-size:28pt;line-height:1.12}
  .foot{position:absolute;left:${inch(M.x)};right:${inch(M.x)};top:6.98in;height:.28in;display:flex;justify-content:space-between;align-items:center;font-family:${mono};font-size:7.5pt;letter-spacing:.08em;text-transform:uppercase;color:#5A6478}
  .foot span{flex:1}.foot span:last-child{text-align:right}.foot img{height:.26in}.foot i{flex:0}
  .foot.dk{color:#8E9BB3}
  .band{position:absolute;left:0;top:0;width:100%;height:1in;background:#fff;border-bottom:.04in solid #E2B53C}
  .band img{position:absolute;left:${inch(M.x)};top:.24in;height:.52in}
  .ctitle{position:absolute;left:${inch(M.x)};top:2.08in;width:10.6in;font-family:${head};font-weight:700;font-size:40pt;line-height:1.1}
  .outcome{font-size:19pt;color:#E2B53C;margin-top:.14in;line-height:1.25}
  .meta{font-family:${body};font-weight:400;font-size:13pt;color:#C9D2E1;margin-top:.14in}
  .counts{position:absolute;left:${inch(M.x)};top:5.3in;display:flex;gap:.05in}
  .counts div{width:1.5in}.counts span{display:block;font-family:${mono};font-size:8.5pt;letter-spacing:.12em;text-transform:uppercase;color:#AEB9CC}
  .counts b{display:block;font-family:${head};font-size:30pt;margin-top:.02in}
  .stamp{position:absolute;right:${inch(M.x)};top:5.62in;text-align:right;font-size:11pt;line-height:1.45;color:#AEB9CC}
  .cards{position:absolute;left:${inch(M.x)};top:2.3in;width:${inch(M.contentW)};display:flex;gap:.3in}
  .card{flex:1;height:1.95in;background:#fff;border-top:.015in solid #16263F;padding:.23in .25in;position:relative}
  .card.acc{border-top:.05in solid #E2B53C}
  .lab{font-family:${mono};font-size:8.5pt;letter-spacing:.12em;text-transform:uppercase;color:#5A6478}
  .ct{font-family:${head};font-weight:700;font-size:15pt;line-height:1.25;margin-top:.12in}.ct.big{font-size:18pt}
  .card .src{position:absolute;left:.25in;bottom:.18in}
  .src{font-family:${mono};font-size:7.5pt;letter-spacing:.06em;text-transform:uppercase;color:#5A6478;margin-top:.03in}
  .src.q{text-transform:none;font-style:italic}
  .lead{position:absolute;left:${inch(M.x)};width:9.8in;font-size:14pt;line-height:1.45;color:#2B3850}
  table{position:absolute;left:${inch(M.x)};width:${inch(M.contentW)};border-collapse:collapse;table-layout:fixed;font-size:13.5pt}
  th{background:#16263F;color:#fff;font-family:${mono};font-size:8.5pt;letter-spacing:.12em;text-transform:uppercase;text-align:left;font-weight:600;height:.42in;padding:0 8pt}
  td{padding:7pt 8pt;border-bottom:.75pt solid #E4E8EF;vertical-align:top;line-height:1.25}
  td b{font-weight:600}
  td.id{font-family:${mono};font-weight:600;font-size:10pt}
  td.first{background:#FBF3DC;font-weight:600}
  .org{font-size:10.5pt;color:#5A6478;margin-top:2pt}
  .quiet{color:#5A6478}
  .gap{font-family:${mono};font-size:8.5pt;letter-spacing:.1em;text-transform:uppercase;color:#5A6478}
  .tag{font-family:${mono};font-size:7.5pt;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#5A6478;margin-left:6pt}
  .ocol{position:absolute;top:${inch(OPEN_TOP)};width:${inch(OPEN_COL_W)}}
  .olab{font-family:${mono};font-size:8.5pt;letter-spacing:.12em;text-transform:uppercase;color:#AEB9CC;padding-bottom:.1in;border-bottom:.75pt solid #3A5072}
  .oi{padding:.16in 0;border-bottom:.75pt solid #3A5072}
  .oid{font-family:${mono};font-weight:600;font-size:9.5pt;color:#E2B53C}
  .ot{font-size:16pt;line-height:1.3;margin-top:.03in}
  .od{font-family:${mono};font-size:7.5pt;letter-spacing:.06em;text-transform:uppercase;color:#8E9BB3;margin-top:.05in}
  .nleft{position:absolute;left:${inch(M.x)};top:2.35in;width:6.4in}
  .nlab{font-family:${mono};font-size:8.5pt;letter-spacing:.12em;text-transform:uppercase;color:#5A6478;padding-bottom:.08in;border-bottom:.75pt solid #D9DEE7;margin-bottom:.14in}
  .must{font-family:${head};font-weight:700;font-size:18pt;line-height:1.3;margin-bottom:.35in}
  ul{padding-left:.22in;font-size:14pt;line-height:1.5;color:#2B3850}
  .fb{font-size:15pt;line-height:1.4;color:#2B3850}
  .corr{position:absolute;left:7.65in;right:${inch(M.x)};top:2.35in;min-height:1.75in;background:#fff;border-left:.05in solid #E2B53C;padding:.25in .3in}
  .corr p{font-size:14pt;line-height:1.4;margin-top:.12in}.corr b{font-weight:600}
  ${opts.fontCss ?? ''}`;

  const html = `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>${esc(plan.title)}</title><style>${css}</style></head><body>${pages}</body></html>`;
  return { html, fileName: `${plan.fileName}.pdf`, slideCount: plan.slides.length };
}
