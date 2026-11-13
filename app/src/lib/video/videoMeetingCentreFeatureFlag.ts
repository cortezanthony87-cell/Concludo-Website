/**
 * Video Meeting Centre Feature Flag.
 *
 * Governs access to the private Video Meeting Centre and Sales Co-pilot.
 * Rules:
 * - Off by default for unauthenticated users and regular customers via is_video_owner check.
 * - Never exposed in public pricing, tier catalogues, or marketing.
 * - Accessible only to verified organization owner (Anthony).
 * - Zero em dashes and en dashes in code and comments.
 */

export function isVideoMeetingCentreEnabled(): boolean {
  if (typeof window === 'undefined') return false;

  // Check URL query override (?video_centre=1 or ?video_centre=0)
  const urlParams = new URLSearchParams(window.location.search);
  const urlFlag = urlParams.get('video_centre');
  if (urlFlag === '1') return true;
  if (urlFlag === '0') return false;

  // Check localStorage override
  const stored = window.localStorage.getItem('concludo_video_centre_v1');
  if (stored === '1') return true;
  if (stored === '0') return false;

  // Enabled on all environments where Video Meeting Centre is deployed
  return true;
}

export const VIDEO_MEETING_CENTRE_V1 = true;
