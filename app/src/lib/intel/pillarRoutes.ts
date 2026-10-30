/**
 * Pillar tabs and legacy route redirects for Memory and Briefings.
 * Nothing is deleted. A redirect is only active when its replacement exists.
 * Exact paths only, so /decision-memory/:id keeps working.
 */
export interface PillarTab { id: string; label: string; to: string; feature: string }
export interface Pillar { path: string; title: string; purpose: string; defaultTab: string; tabs: PillarTab[] }

export const MEMORY_PILLAR: Pillar = {
  path: '/memory',
  title: 'Memory',
  purpose: 'What was decided, what was learned, and where in the records it came from.',
  defaultTab: '/memory/decisions',
  tabs: [
    { id: 'decisions', label: 'Decisions', to: '/memory/decisions', feature: 'decision_memory' },
    { id: 'lessons', label: 'Lessons', to: '/memory/lessons', feature: 'meeting_memory' },
    { id: 'timeline', label: 'Timeline', to: '/memory/timeline', feature: 'meeting_memory' },
    { id: 'explore', label: 'Explore', to: '/memory/explore', feature: 'meeting_memory' },
  ],
};

export const BRIEFINGS_PILLAR: Pillar = {
  path: '/briefings',
  title: 'Briefings',
  purpose: 'Briefings drafted from saved records, for a person to review and approve.',
  defaultTab: '/briefings/centre',
  tabs: [
    { id: 'centre', label: 'Briefing Centre', to: '/briefings/centre', feature: 'executive_intelligence' },
    { id: 'command-centre', label: 'Command Centre', to: '/briefings/command-centre', feature: 'executive_command_center' },
  ],
};

export interface LegacyRedirect { from: string; to: string; ready: boolean; note?: string }

export const LEGACY_REDIRECTS: LegacyRedirect[] = [
  { from: '/decision-memory', to: '/memory/decisions', ready: true },
  { from: '/knowledge', to: '/memory/explore', ready: true },
  { from: '/organizational-memory', to: '/memory/explore', ready: true },
  { from: '/knowledge/timeline', to: '/memory/timeline', ready: true },
  { from: '/knowledge/memory', to: '/memory/lessons', ready: true, note: 'Copilot citations link here.' },
  { from: '/executive-command-center', to: '/briefings/command-centre', ready: true },
  { from: '/executive-center', to: '/briefings/centre', ready: true },
  { from: '/executive-briefings', to: '/briefings/centre', ready: false, note: 'Predictive briefings page not yet reviewed; stays routed as it is.' },
  { from: '/executive-intelligence', to: '/briefings/centre', ready: false, note: 'Predictive intelligence page not yet reviewed; stays routed as it is.' },
];

export function activeRedirects(): LegacyRedirect[] { return LEGACY_REDIRECTS.filter((r) => r.ready); }

/** Exact-match lookup. Returns null for anything not an active legacy path. */
export function resolveLegacy(pathname: string): string | null {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  const hit = activeRedirects().find((r) => r.from === clean);
  return hit ? hit.to : null;
}

export function activeTab(pillar: Pillar, pathname: string): PillarTab | undefined {
  return pillar.tabs.find((t) => pathname === t.to || pathname.startsWith(t.to + '/'));
}
