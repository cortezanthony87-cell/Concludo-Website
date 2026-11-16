const STORAGE_KEY = 'concludo_action_hub_summary_v2';

/**
 * Feature flag governing Release 2 of the Action Command Hub Summary (Futuristic MIX).
 *
 * Built behind the feature flag `action_hub_summary_v2`, off by default.
 * Until Anthony provides explicit written authorisation ("release the summary"),
 * this flag evaluates to false by default across all accounts.
 */
export function isActionHubSummaryV2Enabled(
  user?: { id?: string; email?: string } | null,
  profile?: { plan?: string; role?: string } | null
): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action_hub_summary_v2') === 'false') {
      return false;
    }
    if (
      params.get('action_hub_summary_v2') === 'true' ||
      params.get('flag') === 'action_hub_summary_v2'
    ) {
      return true;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // Ignore restricted localStorage access
  }

  // Off by default pending explicit written authorisation
  return false;
}

export function setActionHubSummaryV2Enabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage errors
  }
}
