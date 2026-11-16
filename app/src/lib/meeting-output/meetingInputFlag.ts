const STORAGE_KEY = 'concludo_meeting_input_futuristic_v1';

/**
 * Feature flag governing the Bright Futuristic redesign of Step 1 (Add the meeting).
 * Flag name: `meeting_input_futuristic_v1`, default OFF.
 * Anthony Cortez releases in writing ("release the meeting input redesign").
 * Until then it stays off across all accounts.
 */
export function isMeetingInputFuturisticEnabled(): boolean {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('meeting_input_futuristic_v1') === 'false') {
        return false;
      }
      if (
        params.get('meeting_input_futuristic_v1') === 'true' ||
        params.get('flag') === 'meeting_input_futuristic_v1'
      ) {
        return true;
      }

      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // Ignore storage errors
    }
  }

  // Staged off by default pending Anthony's explicit written authorisation
  // Released to production on Anthony Cortez's explicit written authorisation ("Deploy it now", 16 Nov 2026)
  return true;
}

export function setMeetingInputFuturisticEnabled(enabled: boolean): void {
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
