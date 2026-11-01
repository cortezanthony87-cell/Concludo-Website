/**
 * Concludo Workspace - Timezone-Aware Greeting
 *
 * Produces accurate, respectful greetings ("Good morning", "Good afternoon", "Good evening")
 * based on the user's configured profile timezone, falling back to the browser's
 * detected IANA timezone, and defaulting cleanly to 'Australia/Melbourne'.
 *
 * Thresholds:
 * - 00:00 - 11:59: "Good morning"
 * - 12:00 - 16:59: "Good afternoon"
 * - 17:00 - 23:59: "Good evening"
 */

export function resolveUserTimezone(configuredTimezone?: string | null): string {
  if (configuredTimezone && configuredTimezone.trim()) {
    const trimmed = configuredTimezone.trim();
    try {
      // Validate timezone name with Intl
      Intl.DateTimeFormat(undefined, { timeZone: trimmed });
      return trimmed;
    } catch {
      // Invalid timezone string, fall through to browser or default
    }
  }

  try {
    const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (browserTz && browserTz.trim()) {
      return browserTz.trim();
    }
  } catch {
    // Ignore error
  }

  return 'Australia/Melbourne';
}

export function getTimeBasedSalutation(now: Date = new Date(), timeZone?: string | null): string {
  const targetTz = resolveUserTimezone(timeZone);
  let hour = now.getHours();

  try {
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: targetTz,
      hour: 'numeric',
      hour12: false,
    }).formatToParts(now);
    const hourPart = parts.find((p) => p.type === 'hour');
    if (hourPart) {
      const parsed = parseInt(hourPart.value, 10);
      // In en-AU with hour12: false, midnight can format as 24 or 0 depending on runtime
      hour = parsed === 24 ? 0 : parsed;
    }
  } catch {
    hour = now.getHours();
  }

  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

export function formatDashboardDate(now: Date = new Date(), timeZone?: string | null): string {
  const targetTz = resolveUserTimezone(timeZone);
  try {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: targetTz,
    }).format(now);
  } catch {
    return now.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}

export function getWelcomeGreeting(
  fullName?: string | null,
  now: Date = new Date(),
  timeZone?: string | null
): string {
  const salutation = getTimeBasedSalutation(now, timeZone);
  const name = fullName?.trim();
  return name ? `${salutation}, ${name}` : salutation;
}
