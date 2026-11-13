// Full report harness: same hostile shell as meetingOutput.harness.ts, mounted as Pro with both written releases on,
// so the full report shows every part. window.__mount(flags) remounts with other plan and release settings.
import { mountMeetingStudio } from '../../src/features/meeting-output/studio';
import '../../src/features/meeting-output/meeting-output.css';
import lockup from '../../public/brand/Concludo_lockup_horizontal_760w.png';
import lockupRev from '../../public/brand/Concludo_logo_horizontal_reversed_for_dark.png';

const hostile = document.createElement('style');
hostile.textContent = `h1 { color: rgb(255, 0, 0); } .btn { background: purple; } .card { border: 4px solid lime; } .page { width: 10px; } * { letter-spacing: 0.2em; }`;
document.head.appendChild(hostile);
document.body.style.margin = '0';
document.body.innerHTML = `<div style="display:flex;height:100vh">
  <aside style="width:240px;background:#16263F;color:#fff;padding:16px;letter-spacing:normal"><h1>Workspace</h1></aside>
  <main style="flex:1;overflow:auto;height:100vh"><div id="host"></div></main></div>`;
const host = document.getElementById('host') as HTMLElement;
const w = window as unknown as Record<string, unknown>;
w.__mount = (f: Record<string, boolean> = {}) => {
  if (typeof w.__unmount === 'function') (w.__unmount as () => void)();
  w.__unmount = mountMeetingStudio(host, {
    embedded: true, logo: lockup, logoReversed: lockupRev,
    canDraftEmail: f.canDraftEmail ?? true, canExportDeck: f.canExportDeck ?? true, canExportTimeline: f.canExportTimeline ?? true,
    timelineReleased: f.timelineReleased ?? true, deckReleased: f.deckReleased ?? true,
  });
};
(w.__mount as () => void)();
