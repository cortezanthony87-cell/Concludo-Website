import { mountMeetingStudio } from '../../src/features/meeting-output/studio';
import { saveMeetingRecord } from '../../src/lib/outputs/saveMeetingRecord';
import '../../src/features/meeting-output/meeting-output.css';
import lockup from '../../public/brand/Concludo_lockup_horizontal_760w.png';
import lockupRev from '../../public/brand/Concludo_logo_horizontal_reversed_for_dark.png';

const params = new URLSearchParams(window.location.search);
const isFuturistic = params.get('meeting_input_futuristic_v1') === 'true' || params.get('flag') === 'on';

document.body.style.margin = '0';
document.body.innerHTML = `<div id="host" style="min-height:100vh"></div>`;

const fakeSupabase = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { ownership_type: 'personal', team_id: null } }) }) }) }) };
const host = document.getElementById('host') as HTMLElement;
const w = window as unknown as Record<string, unknown>;

w.__mount = (futuristic: boolean) => {
  if (typeof w.__unmount === 'function') (w.__unmount as () => void)();
  w.__unmount = mountMeetingStudio(host, {
    embedded: true,
    logo: lockup,
    logoReversed: lockupRev,
    futuristicInput: futuristic,
    canDraftEmail: true,
    canExportDeck: true,
    canExportTimeline: true,
    timelineReleased: true,
    listProjects: async () => [{ id: 'p-1', title: 'CRM cutover', client: 'Kestrel Bay (fictional)' }],
    onSave: (m, t, x) => saveMeetingRecord(fakeSupabase as never, m, t, x),
    onSaved: (id) => { w.__savedTo = id; },
  });
};

w.__mount(isFuturistic);
