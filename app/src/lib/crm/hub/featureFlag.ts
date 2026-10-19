const STORAGE_KEY = 'concludo_hub_r0';
const DEMO_WORKSPACE_IDS = new Set([
  'ws-kestrel-advisory',
  'ws-consulting',
  'ws-key-accounts',
  'ws-agency',
  'ws-sole-trader',
  'ws-service',
  'ws-demo-01',
  'ws-00000000-0000-0000-0000-000000000001',
  'demo-workspace',
]);

/**
 * Returns true only if the workspace ID is an authorised synthetic demo workspace.
 */
export function isDemoWorkspace(workspaceId?: string | null): boolean {
  if (!workspaceId) return false;
  return DEMO_WORKSPACE_IDS.has(workspaceId);
}

/**
 * Feature flag governing Release 0 of the Concludo Communication Hub.
 *
 * Rule 8: Deploy dark behind the feature flag hub_r0, off by default.
 * Every screen shows "Synthetic demonstration data".
 *
 * Gate 2: Without Anthony's written instruction on the day, you may never
 * turn on hub_r0 for any real customer workspace.
 */
export function isHubR0Enabled(workspaceId?: string | null): boolean {
  if (typeof window === 'undefined') return false;

  // Strict gate: Real customer workspaces or missing workspace ID can NEVER enable hub_r0
  if (!workspaceId || !DEMO_WORKSPACE_IDS.has(workspaceId)) {
    return false;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('hub_r0') === 'true' || params.get('flag') === 'hub_r0') {
      return true;
    }
    if (params.get('hub_r0') === 'false') {
      return false;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      return true;
    }
  } catch {
    // Local storage access may fail in restricted sandboxes
  }

  // Dark by default
  return false;
}

export function setHubR0Enabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) {
      window.localStorage.setItem(STORAGE_KEY, 'true');
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Ignore storage write issues
  }
}
