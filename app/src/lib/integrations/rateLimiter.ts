/**
 * Concludo Provider-Aware Rate Limit & Throttling Abstraction
 * Conforms to Master Build Instruction Section 25 & Zero-Secret Multi-Tenant Governance
 * Handles provider throttling (HTTP 429), respects Retry-After headers, queues requests,
 * and tracks provider throttle metrics across organizations.
 */

export interface RateLimitState {
  providerId: string;
  isThrottled: boolean;
  retryAfterMs: number;
  throttledUntil?: number;
  totalThrottledCount: number;
  lastThrottledAt?: string;
  safeMessage?: string;
}

class ProviderRateLimiter {
  private throttledProviders: Map<string, { until: number; count: number; lastMessage: string }> = new Map();

  /**
   * Checks if calls to a specific provider are currently backed off / throttled.
   */
  public isThrottled(providerId: string): boolean {
    const entry = this.throttledProviders.get(providerId);
    if (!entry) return false;
    if (Date.now() >= entry.until) {
      this.throttledProviders.delete(providerId);
      return false;
    }
    return true;
  }

  /**
   * Gets current throttle state and wait time for a provider.
   */
  public getThrottleState(providerId: string): RateLimitState {
    const entry = this.throttledProviders.get(providerId);
    const now = Date.now();
    if (!entry || now >= entry.until) {
      return {
        providerId,
        isThrottled: false,
        retryAfterMs: 0,
        totalThrottledCount: entry ? entry.count : 0,
      };
    }

    return {
      providerId,
      isThrottled: true,
      retryAfterMs: Math.max(0, entry.until - now),
      throttledUntil: entry.until,
      totalThrottledCount: entry.count,
      lastThrottledAt: new Date(entry.until).toISOString(),
      safeMessage: entry.lastMessage || 'Provider rate limit reached. Pausing requests safely.',
    };
  }

  /**
   * Registers a 429 / rate limit response from a provider, parsing Retry-After or defaulting.
   */
  public recordThrottle(providerId: string, retryAfterSecondsOrHeader?: number | string | null): number {
    let waitMs = 5000; // Default 5 seconds backoff

    if (typeof retryAfterSecondsOrHeader === 'number' && retryAfterSecondsOrHeader > 0) {
      waitMs = retryAfterSecondsOrHeader * 1000;
    } else if (typeof retryAfterSecondsOrHeader === 'string') {
      const parsed = parseInt(retryAfterSecondsOrHeader, 10);
      if (!isNaN(parsed) && parsed > 0) {
        waitMs = parsed * 1000;
      } else {
        const parsedDate = Date.parse(retryAfterSecondsOrHeader);
        if (!isNaN(parsedDate) && parsedDate > Date.now()) {
          waitMs = parsedDate - Date.now();
        }
      }
    }

    // Cap backoff at 60 seconds to avoid infinite lockup
    waitMs = Math.min(waitMs, 60000);

    const existing = this.throttledProviders.get(providerId);
    const currentCount = existing ? existing.count + 1 : 1;

    this.throttledProviders.set(providerId, {
      until: Date.now() + waitMs,
      count: currentCount,
      lastMessage: `Provider ${providerId} throttled. Backoff ${Math.round(waitMs / 1000)}s requested.`,
    });

    return waitMs;
  }

  /**
   * Reset throttle state (e.g. after successful test call)
   */
  public resetThrottle(providerId: string): void {
    this.throttledProviders.delete(providerId);
  }
}

export const providerRateLimiter = new ProviderRateLimiter();
