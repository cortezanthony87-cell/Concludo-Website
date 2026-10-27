// A stand-in Workspace shell: dark sidebar, scrolling main, and hostile global CSS.
// If any studio style leaked, or any Workspace style reached the studio, the browser test catches it.
import { mountMeetingStudio, mountMeetingDocument } from '../../src/features/meeting-output/studio';
import { saveMeetingRecord } from '../../src/lib/outputs/saveMeetingRecord';
import '../../src/features/meeting-output/meeting-output.css';
import lockup from '../../public/brand/Concludo_lockup_horizontal_760w.png';
import lockupRev from '../../public/brand/Concludo_logo_horizontal_reversed_for_dark.png';

const hostile = document.createElement('style');
hostile.textContent = `h1 { color: rgb(255, 0, 0); } .btn { background: purple; } .card { border: 4px solid lime; } .page { width: 10px; } * { letter-spacing: 0.2em; }`;
document.head.appendChild(hostile);
const shell = document.createElement('style');
shell.textContent = '@media (max-width: 700px) { #ws-side { display: none; } }';
document.head.appendChild(shell);
document.body.style.margin = '0';
document.body.innerHTML = `<div style="display:flex;height:100vh">
  <aside id="ws-side" style="width:240px;background:#16263F;color:#fff;padding:16px;letter-spacing:normal"><h1 id="ws-h1">Workspace</h1></aside>
  <main id="ws-main" style="flex:1;overflow:auto;height:100vh"><div id="host"></div></main></div>`;

const fakeSupabase = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { ownership_type: 'personal', team_id: null } }) }) }) }) };
const host = document.getElementById('host') as HTMLElement;
const w = window as unknown as Record<string, unknown>;
w.__unmount = mountMeetingStudio(host, {
  embedded: true,
  logo: lockup,
  logoReversed: lockupRev,
  listProjects: async () => [{ id: 'p-1', title: 'CRM cutover', client: 'Kestrel Bay (fictional)' }],
  onSave: (m, t, x) => saveMeetingRecord(fakeSupabase as never, m, t, x),
  onSaved: (id) => { w.__savedTo = id; },
});
w.__mountViewer = (el: HTMLElement) => {
  const api = (host as unknown as { __cmo: { S: { model: unknown } } }).__cmo;
  return mountMeetingDocument(el, JSON.parse(JSON.stringify(api.S.model)), { logo: lockup, logoReversed: lockupRev });
};
