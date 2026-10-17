/**
 * Old paths that must keep working.
 *
 * Two destinations are removed from the sidebar and seventeen are eventually
 * folded into four. Removing a link does not remove the URL from somebody's
 * bookmarks, a Slack message, a calendar invite or an email Concludo sent
 * them. A path that silently 404s is how a person decides the product broke.
 *
 * So every path that leaves the sidebar gets a redirect, and the redirects
 * stay for at least one release after the change that caused them.
 *
 * `scripts/check-nav.mjs` reports any entry here whose target no longer
 * resolves, so this file cannot rot quietly.
 */

/**
 * The two removals, which take effect with this package.
 *
 * Projects and New Transcript are not gone, they moved. Both now live on the
 * Dashboard: Projects as a panel, New Transcript as the primary button.
 * A hash is used so the Dashboard can scroll to, or open, the right thing.
 */
export const REMOVED_PATHS: Record<string, string> = {
  '/transcripts/new': '/projects/new',
  '/new-transcript': '/projects/new',
};

/**
 * The merges, which take effect only when MERGED_PAGES_READY is true in
 * workspaceNav.ts.
 *
 * Each target carries a tab, so the redirect sends somebody to the view they
 * asked for rather than to the top of a page they then have to navigate.
 */
export const MERGED_PATHS: Record<string, string> = {
  '/decision-memory': '/memory?tab=decisions',
  '/knowledge': '/memory?tab=explore',
  '/organizational-memory': '/memory?tab=organisation',
  '/knowledge/timeline': '/memory?tab=timeline',

  '/insight': '/insight?tab=overview',
  '/stats': '/insight?tab=usage',
  '/knowledge-analytics': '/insight?tab=knowledge',
  '/performance': '/insight?tab=delivery',

  '/predictive-intelligence': '/forecasts?tab=forecast',
  '/forecasts': '/forecasts?tab=forecast',
  '/scenario-modeling': '/forecasts?tab=scenarios',
  '/digital-twin': '/forecasts?tab=model',

  '/executive-briefings': '/briefings?tab=briefings',
  '/executive-intelligence': '/briefings?tab=signals',
  '/executive-center': '/briefings?tab=briefings',
  '/executive-command-center': '/briefings?tab=command',

  '/agents/dashboard': '/agents?tab=dashboard',
};

/**
 * Spelling corrections.
 *
 * Three American spellings are on screen today, and one of them, Executive
 * Center, sits four rows below Command Centre. The labels are fixed in the
 * manifest; these keep the old URLs working for anyone who saved one.
 */
export const SPELLING_PATHS: Record<string, string> = {
  '/strategic/scenario-modeling': '/scenario-modeling',
  '/knowledge/organizational-memory': '/organizational-memory',
};

/** Everything that should resolve, for the router and the checker. */
export function activeRedirects(mergedPagesReady: boolean): Record<string, string> {
  return {
    ...REMOVED_PATHS,
    ...SPELLING_PATHS,
    ...(mergedPagesReady ? MERGED_PATHS : {}),
  };
}
