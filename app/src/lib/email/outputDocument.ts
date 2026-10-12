/**
 * The payload, rendered as a Concludo document.
 *
 * Two decisions worth stating, because both were the opposite of the obvious
 * thing to do.
 *
 * **It reuses the Workspace's own document stylesheet.** `/brand/concludo-documents.css`
 * is already in the application, 2,161 lines, and its own header says it is the
 * authority for colour and type in every Concludo output document: do not add a
 * token, do not change a value. So this file writes markup that stylesheet
 * already styles, rather than inventing a second document look that would drift
 * from the first within a month.
 *
 * **It renders into an iframe.** The document stylesheet styles bare elements:
 * `h1`, `table`, `td`, `p`, `section`, even `body`. Loading it into the
 * application would restyle every page in the Workspace. An iframe gives exact
 * fidelity with no leakage, and it is also what a print preview should be: the
 * document is a separate thing from the interface showing it, which is why the
 * stylesheet's own `--desk` token exists, described there as "the ground the
 * sheet sits on, screen only".
 *
 * Nothing here invents content. Every value comes from the payload, and a
 * payload section that is absent is simply not drawn.
 */
import { OutputPayload, OutputRegister } from './outputs';
import { formatFullDate } from './outputFormat';

/** Where the document stylesheet and the lockup live in the application. */
export const DOCUMENT_STYLESHEET = '/brand/concludo-documents.css';
export const DOCUMENT_LOCKUP = '/brand/Concludo_lockup_horizontal_760w.png';
const FONTS =
  'https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700&family=Inter:wght@400;500;600&display=swap';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Quotation marks around evidence, left as the author typed them.
 *
 * The builders wrap evidence in curly quotes. Escaping handles the dangerous
 * characters; the quotes are content.
 */
function cell(value: string): string {
  return escapeHtml(value);
}

function sectionNumber(n: number): string {
  return String(n).padStart(2, '0');
}

function renderRegister(register: OutputRegister, number: number): string {
  const head = register.columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('');

  const rows = register.rows
    .map((row) => {
      const cells = row
        .map((value, index) =>
          index === 0
            ? `<td class="tnum"><span class="ref">${cell(value)}</span></td>`
            : `<td>${cell(value)}</td>`
        )
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');

  const stats = register.stats
    ? `<h3>${escapeHtml(register.stats_title ?? 'Counted')}</h3>
       <table class="otab"><tbody>${register.stats
         .map(
           ([label, value]) =>
             `<tr><td>${escapeHtml(label)}</td><td class="tnum">${escapeHtml(value)}</td></tr>`
         )
         .join('')}</tbody></table>`
    : '';

  const callout = register.callout
    ? `<div class="reco">
         <p class="lbl">${escapeHtml(register.callout.title)}</p>
         <p>${escapeHtml(register.callout.lines[0] ?? '')}</p>
         ${register.callout.lines
           .slice(1)
           .map((line) => `<p class="by">${escapeHtml(line)}</p>`)
           .join('')}
       </div>`
    : '';

  return `
    <section class="pad">
      <p class="no">${sectionNumber(number)}</p>
      <div>
        <h2>${escapeHtml(register.title)}</h2>
        <p class="quiet">${escapeHtml(register.intro)}</p>
        <table class="otab"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table>
        ${stats}
        ${callout}
      </div>
    </section>`;
}

/** Renders the payload as a complete HTML document. */
export function renderOutputDocument(
  payload: OutputPayload,
  options: { producedAt: string; stylesheetHref?: string; lockupSrc?: string }
): string {
  const stylesheet = options.stylesheetHref ?? DOCUMENT_STYLESHEET;
  const lockup = options.lockupSrc ?? DOCUMENT_LOCKUP;

  let number = 0;
  const sections: string[] = [];

  if (payload.executive) {
    number += 1;
    sections.push(`
      <section class="pad">
        <p class="no">${sectionNumber(number)}</p>
        <div>
          <h2>${escapeHtml(payload.executive.title)}</h2>
          <p class="quiet">${escapeHtml(payload.executive.intro)}</p>
          ${payload.executive.points
            .map(
              (point) => `
            <h3>${escapeHtml(point.label)}</h3>
            <p>${escapeHtml(point.text)}</p>
            ${point.evidence ? `<p class="ref">${cell(point.evidence)}</p>` : ''}`
            )
            .join('')}
        </div>
      </section>`);
  }

  if (payload.inputs) {
    number += 1;
    const inputs = payload.inputs;
    sections.push(`
      <section class="pad">
        <p class="no">${sectionNumber(number)}</p>
        <div>
          <h2>${escapeHtml(inputs.title)}</h2>
          <p class="quiet">${escapeHtml(inputs.intro)}</p>
          <table class="otab">
            <thead><tr>${inputs.columns.map((c) => `<th scope="col">${escapeHtml(c)}</th>`).join('')}</tr></thead>
            <tbody>${inputs.rows
              .map(
                (row) =>
                  `<tr>${row
                    .map((value, i) =>
                      i === 0
                        ? `<td class="tnum"><span class="ref">${cell(value)}</span></td>`
                        : `<td>${cell(value)}</td>`
                    )
                    .join('')}</tr>`
              )
              .join('')}</tbody>
          </table>
          ${
            inputs.gaps && inputs.gaps.length > 0
              ? `<h3>${escapeHtml(inputs.gaps_title ?? 'Not settled by the record')}</h3>
                 <ul>${inputs.gaps.map((g) => `<li>${escapeHtml(g)}</li>`).join('')}</ul>`
              : ''
          }
          ${
            inputs.conflict
              ? `<div class="reco">
                   <p class="lbl">${escapeHtml(inputs.conflict.title)}</p>
                   <p>${escapeHtml(inputs.conflict.lines[0] ?? '')}</p>
                   ${inputs.conflict.lines
                     .slice(1)
                     .map((line) => `<p class="by">${escapeHtml(line)}</p>`)
                     .join('')}
                 </div>`
              : ''
          }
        </div>
      </section>`);
  }

  for (const key of ['decisions', 'actions', 'risks'] as const) {
    const register = payload[key];
    if (register) {
      number += 1;
      sections.push(renderRegister(register, number));
    }
  }

  if (payload.recommendations) {
    number += 1;
    const r = payload.recommendations;
    sections.push(`
      <section class="pad">
        <p class="no">${sectionNumber(number)}</p>
        <div>
          <h2>${escapeHtml(r.title)}</h2>
          <p class="quiet">${escapeHtml(r.intro)}</p>
          <table class="otab">
            <thead><tr><th scope="col">Band</th><th scope="col">Recommendation</th><th scope="col">Why, and from where</th></tr></thead>
            <tbody>
              ${r.bands
                .flatMap((band) =>
                  band.items.map(
                    (item, index) => `
                <tr${band.label === 'Critical' ? ' class="rec"' : ''}>
                  <td>${index === 0 ? `<span class="mk ${markFor(band.label)}"><i></i>${escapeHtml(band.label)}</span>` : ''}</td>
                  <td>${escapeHtml(item.title)}</td>
                  <td class="quiet">${escapeHtml(item.why)}</td>
                </tr>`
                  )
                )
                .join('')}
            </tbody>
          </table>
        </div>
      </section>`);
  }

  if (payload.closing) {
    number += 1;
    const c = payload.closing;
    sections.push(`
      <section class="pad">
        <p class="no">${sectionNumber(number)}</p>
        <div>
          <h2>${escapeHtml(c.title)}</h2>
          <p class="quiet">${escapeHtml(c.intro)}</p>
          <div class="reco">
            <p class="lbl">Next step</p>
            <p>${escapeHtml(c.items[0]?.[1] ?? '')}</p>
            ${c.items
              .slice(1)
              .map(([label, value]) => `<p class="by">${escapeHtml(label)}: ${escapeHtml(value)}</p>`)
              .join('')}
          </div>
          ${
            c.audit && c.audit.length > 0
              ? `<h3>${escapeHtml(c.audit_title ?? 'How this was built')}</h3>
                 <table class="otab"><tbody>${c.audit
                   .map(
                     ([label, value]) =>
                       `<tr><td>${escapeHtml(label)}</td><td class="tnum">${escapeHtml(value)}</td></tr>`
                   )
                   .join('')}</tbody></table>`
              : ''
          }
        </div>
      </section>`);
  }

  return `<!doctype html>
<html lang="en-AU">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(payload.document.title)}</title>
<meta name="subject" content="${escapeHtml(payload.document.subject)}">
<link rel="stylesheet" href="${FONTS}">
<link rel="stylesheet" href="${escapeHtml(stylesheet)}">
</head>
<body>
<div class="desk">

  <div class="prov">
    <span class="stamp"><img src="${escapeHtml(lockup)}" alt="Concludo"></span>
    <p>Produced by the Concludo Workspace from an email thread. <b>Human review is required before reliance.</b></p>
  </div>

  <article class="sheet">
    <header class="letterhead pad">
      <!-- The letterhead mark identifies the producer. The document kind is the
           gold kicker above the title, which is where a kicker belongs. The
           first version put the kind in both and it read as a stutter. -->
      <div class="ka">
        <b>Concludo</b>
        <span>Email Command Centre</span>
      </div>
      <div class="class">
        ${escapeHtml(payload.document.classification)}
        <em>${escapeHtml(formatFullDate(options.producedAt))}</em>
      </div>
    </header>

    <div class="titleblock pad">
      <p class="kicker">${escapeHtml(payload.document.kind)}</p>
      <h1>${payload.meeting.title_lines.map((l) => escapeHtml(l)).join(' ')}</h1>
      <p class="standfirst">${escapeHtml(payload.meeting.subtitle)}</p>
      <p class="ref">With ${escapeHtml(payload.meeting.accent_line)}</p>
    </div>

    <section class="pad">
      <p class="no"></p>
      <div>
        <table class="otab">
          <caption>The record this was built from</caption>
          <tbody>
            ${payload.meta
              .map(
                (m) =>
                  `<tr><td>${escapeHtml(m.label)}</td><td>${escapeHtml(m.value)}${
                    m.note ? `<span class="rectag">${escapeHtml(m.note)}</span>` : ''
                  }</td></tr>`
              )
              .join('')}
          </tbody>
        </table>

        <h3>Counted in this document</h3>
        <table class="otab">
          <tbody>
            <tr>${payload.counts.map((c) => `<td>${escapeHtml(c.label)}</td>`).join('')}</tr>
            <tr>${payload.counts
              .map((c) => `<td class="tnum"><strong>${escapeHtml(c.value)}</strong></td>`)
              .join('')}</tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="doc">
      ${sections.join('\n')}
    </div>

    <footer class="colophon pad">
      <p class="lbl">Notices</p>
      <h2>Read these before relying on anything above</h2>
      <ul>
        ${payload.notices.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}
      </ul>
      <p class="quiet">
        Concludo is an independent product and is not affiliated with, endorsed by, or partnered
        with any device maker, meeting platform or note-taking service. Concludo Pty Ltd,
        ACN 701 605 898, ABN 61 701 605 898.
      </p>
      <p class="ref">${escapeHtml(payload.document.footer_label)}</p>
    </footer>
  </article>

</div>
</body>
</html>`;
}

/** The status mark class for a recommendation band. Shape plus colour plus word. */
function markFor(band: 'Critical' | 'High' | 'Medium' | 'Low'): string {
  switch (band) {
    case 'Critical':
      return 'crit';
    case 'High':
      return 'serious';
    case 'Medium':
      return 'warn';
    case 'Low':
      return 'good';
  }
}

/** A file name a person can find again. */
export function documentFileName(payload: OutputPayload, producedAt: string): string {
  const stem = payload.document.kind
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const date = new Date(producedAt).toISOString().slice(0, 10);
  return `concludo-${stem}-${date}.html`;
}
