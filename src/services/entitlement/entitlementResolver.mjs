/**
 * Tasklet 12.1: Entitlement Resolution Service
 *
 * Establishes the single service that answers "what is this workspace allowed to do",
 * so that no other code in the system decides entitlement for itself.
 *
 * Rules:
 * - A workspace with no subscription row resolves as starter on trial (missing means minimum).
 * - An entitlement whose period_end has passed resolves as lapsed and falls back to starter.
 * - Team subscription requires minimum 5 seats.
 * - An internal_grant row is never revenue (counts_toward_revenue = false).
 * - Cache per-request only, never across requests.
 */

export const PLAN_TIERS = ['starter', 'pro_subscription', 'team'];

export const TIER_LIMITS = {
  starter: {
    monthly_transcripts: 5,
    max_transcript_words: 10000,
    export_formats: ['txt', 'html'],
  },
  pro_subscription: {
    monthly_transcripts: 30,
    max_transcript_words: 50000,
    export_formats: ['txt', 'html', 'pdf', 'docx', 'markdown'],
  },
  team: {
    monthly_transcripts: 200,
    max_transcript_words: 100000,
    export_formats: ['txt', 'html', 'pdf', 'docx', 'markdown', 'json'],
  },
};

const ACTION_REQUIREMENTS = {
  'transcripts:upload': 'starter',
  'reports:view_t2': 'starter',
  'reports:view_t17': 'starter',
  'export:pdf': 'pro_subscription',
  'health:full_10_dimensions': 'pro_subscription',
  'insights:advanced_gaps': 'pro_subscription',
  'governance:audit_log': { capability: 'audit_log' },
  'governance:legal_hold': { capability: 'legal_hold' },
  'governance:policy': { capability: 'governance_policy' },
  'team:collaborate': 'team',
};

export class EntitlementResolver {
  constructor(subscriptionsStore = new Map()) {
    this.store = subscriptionsStore; // orgId -> subscriptionRecord
  }

  setSubscription(orgId, record) {
    // Schema constraint checks
    if (record.tier === 'team' && (record.seat_count ?? 1) < 5) {
      throw new Error('team_seat_minimum: Team subscription carries a 5 seat minimum');
    }
    if (record.source === 'internal_grant' && record.counts_toward_revenue === true) {
      throw new Error('grants_are_not_revenue: An internal grant is never revenue');
    }
    if (!PLAN_TIERS.includes(record.tier)) {
      throw new Error(`Invalid subscription tier "${record.tier}". Valid: starter, pro_subscription, team`);
    }

    this.store.set(orgId, {
      ...record,
      updated_at: new Date().toISOString(),
    });
  }

  /**
   * Resolves entitlement for an organisation.
   * Per-request resolution, never cached cross-request.
   */
  resolve(organisationId) {
    if (!organisationId) {
      // Safe fallback: minimum starter on trial
      return this.buildDefaultStarter('trial');
    }

    const record = this.store.get(organisationId);
    if (!record) {
      // Safe state: Missing row resolves as starter on trial. Never unlimited.
      return this.buildDefaultStarter('trial');
    }

    const now = new Date();
    // Check expiration / lapsed status
    if (record.period_end && new Date(record.period_end) < now) {
      return {
        tier: 'starter',
        capabilities: [],
        seatCount: 1,
        source: 'lapsed',
        periodEnd: record.period_end,
        limits: TIER_LIMITS.starter,
        counts_toward_revenue: false,
        granted_by_code_id: record.granted_by_code_id || null,
      };
    }

    return {
      tier: record.tier || 'starter',
      capabilities: Array.isArray(record.capabilities) ? [...record.capabilities] : [],
      seatCount: record.seat_count || 1,
      source: record.source || 'trial',
      periodEnd: record.period_end || null,
      limits: TIER_LIMITS[record.tier] || TIER_LIMITS.starter,
      counts_toward_revenue: Boolean(record.counts_toward_revenue),
      granted_by_code_id: record.granted_by_code_id || null,
    };
  }

  buildDefaultStarter(source = 'trial') {
    return {
      tier: 'starter',
      capabilities: [],
      seatCount: 1,
      source,
      periodEnd: null,
      limits: TIER_LIMITS.starter,
      counts_toward_revenue: source === 'paid',
      granted_by_code_id: null,
    };
  }

  /**
   * The single authority in the system that decides access.
   */
  can(entitlement, action) {
    if (!entitlement) return false;

    const req = ACTION_REQUIREMENTS[action];
    if (!req) {
      // Unknown actions default to denied
      return false;
    }

    // Capability check
    if (typeof req === 'object' && req.capability) {
      return entitlement.capabilities.includes(req.capability);
    }

    // Tier comparison
    const TIER_RANK = { starter: 1, pro_subscription: 2, team: 3 };
    const requiredRank = TIER_RANK[req] || 1;
    const userRank = TIER_RANK[entitlement.tier] || 1;

    return userRank >= requiredRank;
  }
}
