/**
 * Follow-up email: ready to paste.
 * The engine (CE.followUpEmail) writes plain text with UPPERCASE section labels and a pipe table for actions.
 * This module turns that body into:
 *   - html:  for the clipboard (text/html). Section titles are bold, the action list is a small table.
 *            Mail apps (Outlook, Gmail, Apple Mail) keep the bold when pasted.
 *   - text:  for the clipboard (text/plain) and the .txt download. Section titles in sentence case on their own line.
 * The email is never part of the meeting report or its PDF. It is copied or downloaded on its own.
 */

export const EMAIL_HEADINGS: Record<string, string> = {
  CONTEXT: 'Context',
  DECISIONS: 'Decisions',
  ACTIONS: 'Actions',
  'DEADLINES AND DATES': 'Deadlines and dates',
  'OPEN QUESTIONS': 'Open questions',
  RISKS: 'Risks',
  'NEXT MEETING': 'Next meeting',
};

type Block =
  | { kind: 'para'; lines: string[] }
  | { kind: 'section'; title: string; lines: string[] }
  | { kind: 'table'; title: string; head: string[]; rows: string[][] };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));

export function parseEmailBody(body: string): Block[] {
  return body
    .split(/\n{2,}/)
    .map((chunk) => chunk.split('\n').map((l) => l.trimEnd()).filter((l) => l.length))
    .filter((lines) => lines.length)
    .map((lines): Block => {
      const title = EMAIL_HEADINGS[lines[0].trim()];
      if (!title) return { kind: 'para', lines };
      const rest = lines.slice(1);
      if (rest.length >= 2 && rest[0].includes('|') && /^[-|\s]+$/.test(rest[1])) {
        const cells = (l: string) => l.split('|').map((c) => c.trim());
        return { kind: 'table', title, head: cells(rest[0]), rows: rest.slice(2).map(cells) };
      }
      return { kind: 'section', title, lines: rest };
    });
}

const FONT = "font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#16263F";

/** HTML for pasting into a mail app. Bold section titles, no classes, inline styles only. */
export function emailBodyHtml(body: string): string {
  const out: string[] = [];
  for (const b of parseEmailBody(body)) {
    if (b.kind === 'para') {
      out.push(`<p style="margin:0 0 12px">${b.lines.map(esc).join('<br>')}</p>`);
    } else if (b.kind === 'section') {
      out.push(`<p style="margin:16px 0 4px"><strong>${esc(b.title)}</strong></p>`);
      out.push(`<p style="margin:0 0 12px">${b.lines.map(esc).join('<br>')}</p>`);
    } else {
      out.push(`<p style="margin:16px 0 6px"><strong>${esc(b.title)}</strong></p>`);
      const th = b.head.map((h) => `<th align="left" style="padding:4px 10px 4px 0;border-bottom:1px solid #DCE2EC"><strong>${esc(h === '#' ? 'ID' : h)}</strong></th>`).join('');
      const tr = b.rows.map((r) => `<tr>${r.map((c) => `<td valign="top" style="padding:4px 10px 4px 0;border-bottom:1px solid #EEF1F6">${esc(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:0 0 12px;${FONT}"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table>`);
    }
  }
  return `<div style="${FONT}">${out.join('')}</div>`;
}

/** Plain text for the text/plain clipboard flavour and the .txt download. */
export function emailBodyText(body: string): string {
  return parseEmailBody(body)
    .map((b) => {
      if (b.kind === 'para') return b.lines.join('\n');
      if (b.kind === 'section') return [b.title, ...b.lines].join('\n');
      return [b.title, ...b.rows.map((r) => `${r[0]}  ${r[1]}. Owner: ${r[2]}. By: ${r[3]}.`.replace(/\.\./g, '.'))].join('\n');
    })
    .join('\n\n');
}
