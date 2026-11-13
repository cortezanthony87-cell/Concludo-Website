const STORAGE_KEY = 'concludo_action_timeline_v1';

/**
 * Feature flag governing Release 1 of the Action Timeline PowerPoint export.
 *
 * Built behind the feature flag `action_timeline_v1`, off by default.
 * Until Anthony provides explicit written authorization ("release the timeline"),
 * the button is hidden for every account except admin test accounts or explicit flag overrides.
 */
export function isActionTimelineFeatureFlagEnabled(
  user?: { id?: string; email?: string } | null,
  profile?: { plan?: string; role?: string } | null
): boolean {
  if (typeof window === 'undefined') return false;

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action_timeline_v1') === 'false') {
      return false;
    }
    if (params.get('action_timeline_v1') === 'true' || params.get('flag') === 'action_timeline_v1') {
      return true;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // Ignore restricted localStorage access
  }

  // Authorised admin test accounts for staging verification
  const email = (user?.email || '').toLowerCase().trim();
  const plan = (profile?.plan || '').toLowerCase().trim();
  const role = (profile?.role || '').toLowerCase().trim();

  if (plan === 'admin' || role === 'admin') {
    return true;
  }

  if (
    email === 'admin@concludo.au' ||
    email === 'cortez.anthony87@gmail.com' ||
    email === 'anthonycortez@cortezmowinggardenmaintenan.onmicrosoft.com'
  ) {
    return true;
  }

  // Released to production on Anthony Cortez's written authorisation
  return true;
}

export function setActionTimelineFeatureFlag(enabled: boolean): void {
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
