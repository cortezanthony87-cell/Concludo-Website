/**
 * Tasklet 12.3 & 12.4: Grant Code Redemption and Revocation Cascading
 *
 * Implements atomic single-use grant code redemption with rate limiting,
 * constant-time scrypt verification, and immediate cascade downgrades on revocation.
 */
import { verifySecret } from '../../../tools/grant-codes.mjs';

export class GrantRedemptionService {
  constructor({ grantCodeService, entitlementResolver }) {
    this.grantCodeService = grantCodeService;
    this.entitlementResolver = entitlementResolver;
    this.redemptions = []; // grant_code_redemptions
    this.attempts = []; // grant_redemption_attempts

    // In-memory sliding-window rate limit maps
    this.attemptsByIp = new Map(); // ip -> timestamp[]
    this.attemptsByUser = new Map(); // userId -> timestamp[]
  }

  isRateLimited(ip, userId) {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Check IP limit: 5 attempts per IP per hour
    if (ip) {
      const ipHistory = (this.attemptsByIp.get(ip) || []).filter((t) => t > oneHourAgo);
      this.attemptsByIp.set(ip, ipHistory);
      if (ipHistory.length >= 5) return true;
    }

    // Check User limit: 10 attempts per user per day
    if (userId) {
      const userHistory = (this.attemptsByUser.get(userId) || []).filter((t) => t > oneDayAgo);
      this.attemptsByUser.set(userId, userHistory);
      if (userHistory.length >= 10) return true;
    }

    return false;
  }

  recordAttempt(ip, userId, publicId, succeeded) {
    const now = Date.now();
    if (ip) {
      const list = this.attemptsByIp.get(ip) || [];
      list.push(now);
      this.attemptsByIp.set(ip, list);
    }
    if (userId) {
      const list = this.attemptsByUser.get(userId) || [];
      list.push(now);
      this.attemptsByUser.set(userId, list);
    }

    this.attempts.push({
      id: `att_${now}_${Math.random().toString(36).slice(2, 7)}`,
      attempted_by: userId || null,
      ip_address: ip || null,
      public_id_tried: publicId || null,
      succeeded,
      attempted_at: new Date().toISOString(),
    });
  }

  parseCode(codeString) {
    if (typeof codeString !== 'string') return null;
    const clean = codeString.trim().toUpperCase();
    // Pattern: CONCLUDO-<publicId>-<secret1>-<secret2>-...
    const match = clean.match(/^CONCLUDO-([0-9A-Z]{8})-([0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5}-[0-9A-Z]{5})$/);
    if (!match) return null;

    const publicId = match[1];
    const secret = match[2].replace(/-/g, ''); // 20 chars secret
    return { publicId, secret };
  }

  async redeemCode({ organisationId, userId, code, ip, userAgent }) {
    // 1. Authenticate check
    if (!userId || !organisationId) {
      const err = new Error('Authentication and organisation required');
      err.code = 'UNAUTHENTICATED';
      err.status = 401;
      throw err;
    }

    // 2. Rate limit check
    if (this.isRateLimited(ip, userId)) {
      this.recordAttempt(ip, userId, null, false);
      const err = new Error('GRANT_RATE_LIMITED: Too many redemption attempts. Please retry later.');
      err.code = 'GRANT_RATE_LIMITED';
      err.status = 429;
      throw err;
    }

    // 3. Parse code
    const parsed = this.parseCode(code);
    if (!parsed) {
      this.recordAttempt(ip, userId, null, false);
      const err = new Error('GRANT_CODE_INVALID: Invalid grant code');
      err.code = 'GRANT_CODE_INVALID';
      err.status = 400;
      throw err;
    }

    const { publicId, secret } = parsed;

    // Check existing subscription on workspace
    const existingEntitlement = this.entitlementResolver.resolve(organisationId);
    if (existingEntitlement.source === 'paid') {
      this.recordAttempt(ip, userId, publicId, false);
      const err = new Error('GRANT_CONFLICTS_WITH_PAID_SUBSCRIPTION: Workspace already holds an active paid subscription.');
      err.code = 'GRANT_CONFLICTS_WITH_PAID_SUBSCRIPTION';
      err.status = 409;
      throw err;
    }

    // 4. Lookup by public_id
    const codeId = this.grantCodeService.byPublicId.get(publicId);
    if (!codeId) {
      this.recordAttempt(ip, userId, publicId, false);
      const err = new Error('GRANT_CODE_INVALID');
      err.code = 'GRANT_CODE_INVALID';
      err.status = 400;
      throw err;
    }

    const grantRecord = this.grantCodeService.codes.get(codeId);
    if (!grantRecord) {
      this.recordAttempt(ip, userId, publicId, false);
      const err = new Error('GRANT_CODE_INVALID');
      err.code = 'GRANT_CODE_INVALID';
      err.status = 400;
      throw err;
    }

    // Check validity: revoked, expired, redemption count
    const isExpired = new Date(grantRecord.expires_at) < new Date();
    const isRevoked = Boolean(grantRecord.revoked_at);
    const isMaxedOut = grantRecord.redemption_count >= grantRecord.max_redemptions;

    if (isExpired || isRevoked || isMaxedOut) {
      this.recordAttempt(ip, userId, publicId, false);
      const err = new Error('GRANT_CODE_INVALID');
      err.code = 'GRANT_CODE_INVALID';
      err.status = 400;
      throw err;
    }

    // 5. Verify secret with scrypt in constant time
    const verified = verifySecret(secret, grantRecord.secret_salt, grantRecord.secret_hash);
    if (!verified) {
      this.recordAttempt(ip, userId, publicId, false);
      const err = new Error('GRANT_CODE_INVALID');
      err.code = 'GRANT_CODE_INVALID';
      err.status = 400;
      throw err;
    }

    // 6. Atomic state update (Simulating SELECT ... FOR UPDATE)
    if (grantRecord.redemption_count >= grantRecord.max_redemptions) {
      this.recordAttempt(ip, userId, publicId, false);
      const err = new Error('GRANT_CODE_INVALID');
      err.code = 'GRANT_CODE_INVALID';
      err.status = 400;
      throw err;
    }

    grantRecord.redemption_count += 1;

    // Record redemption
    this.redemptions.push({
      id: `red_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      grant_code_id: grantRecord.id,
      organisation_id: organisationId,
      redeemed_by: userId,
      redeemed_at: new Date().toISOString(),
      ip_address: ip || null,
      user_agent: userAgent || null,
    });

    // Upsert subscription in EntitlementResolver
    this.entitlementResolver.setSubscription(organisationId, {
      organisation_id: organisationId,
      tier: grantRecord.grants_tier,
      capabilities: [...grantRecord.grants_capabilities],
      source: 'internal_grant',
      seat_count: grantRecord.grants_seat_count,
      period_start: new Date().toISOString(),
      period_end: grantRecord.expires_at,
      mor_subscription_id: null,
      granted_by_code_id: grantRecord.id,
      counts_toward_revenue: false,
    });

    this.recordAttempt(ip, userId, publicId, true);

    return {
      success: true,
      tier: grantRecord.grants_tier,
      capabilities: grantRecord.grants_capabilities,
      source: 'internal_grant',
      expires_at: grantRecord.expires_at,
    };
  }

  /**
   * Tasklet 12.4: Revoke grant code and cascade downgrade to bound workspaces
   */
  revokeCodeAndCascade(codeId, actorId, reason) {
    const revoked = this.grantCodeService.revokeCode(codeId, actorId, reason);

    // Immediate cascade downgrade without cache delay
    for (const [orgId, sub] of this.entitlementResolver.store.entries()) {
      if (sub.granted_by_code_id === codeId) {
        this.entitlementResolver.setSubscription(orgId, {
          ...sub,
          tier: 'starter',
          capabilities: [],
          source: 'lapsed',
          counts_toward_revenue: false,
        });
      }
    }

    return revoked;
  }
}
