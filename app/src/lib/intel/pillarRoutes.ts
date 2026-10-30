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
    { id: 'executive', label: 'Executive Intelligence', to: '/briefings/executive', feature: 'executive_intelligence' },
    { id: 'saved', label: 'Saved', to: '/briefings/saved', feature: 'executive_intelligence' },
  ],
};

export const INSIGHT_PILLAR: Pillar = {
  path: '/insight',
  title: 'Insight',
  purpose: 'What the saved records say about the work and the knowledge.',
  defaultTab: '/insight/overview',
  tabs: [
    { id: 'overview', label: 'Insight', to: '/insight/overview', feature: 'insight' },
    { id: 'stats', label: 'Stats', to: '/insight/stats', feature: 'stats' },
    { id: 'knowledge', label: 'Knowledge', to: '/insight/knowledge', feature: 'knowledge_analytics' },
    { id: 'performance', label: 'Performance', to: '/insight/performance', feature: 'insight' },
  ],
};

export const FORECASTS_PILLAR: Pillar = {
  path: '/forecasts',
  title: 'Forecasts',
  purpose: 'What is expected next, shown only when the records are enough to say.',
  defaultTab: '/forecasts/predictive',
  tabs: [
    { id: 'predictive', label: 'Predictive', to: '/forecasts/predictive', feature: 'predictive_intelligence' },
    { id: 'trend', label: 'Forecasts', to: '/forecasts/trend', feature: 'forecasting' },
    { id: 'scenarios', label: 'Scenarios', to: '/forecasts/scenarios', feature: 'scenario_modeling' },
    { id: 'twin', label: 'Digital Twin', to: '/forecasts/twin', feature: 'digital_twin' },
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
  { from: '/executive-briefings', to: '/briefings/saved', ready: true, note: 'Old generator stopped; saved briefings kept read-only.' },
  { from: '/executive-intelligence', to: '/briefings/executive', ready: true },
  { from: '/predictive-intelligence', to: '/forecasts/predictive', ready: true },
  { from: '/scenario-modeling', to: '/forecasts/scenarios', ready: true },
  { from: '/digital-twin', to: '/forecasts/twin', ready: true },
  { from: '/stats', to: '/insight/stats', ready: true },
  { from: '/knowledge-analytics', to: '/insight/knowledge', ready: true },
  { from: '/performance', to: '/insight/performance', ready: true },
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
