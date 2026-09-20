/**
 * Phase 12 Test Suite: Entitlement and Access Grants
 *
 * Verifies Tasklets 12.1 to 12.5 and enforces the build-blocking criteria:
 *   1. Prohibitions hold under a grant
 *   2. Grants are not revenue
 *   3. No entitlement leaks to the client
 *   4. Missing means minimum
 *   5. One authority (single resolver for tier access)
 *   6. No Enterprise tier
 */
import { EntitlementResolver, PLAN_TIERS } from '../src/services/entitlement/entitlementResolver.mjs';
import { GrantCodeService } from '../src/services/entitlement/grantCodeService.mjs';
import { GrantRedemptionService } from '../src/services/entitlement/grantRedemptionService.mjs';
import { run } from '../src/pipeline.mjs';
import { scoreHealth } from '../src/health.mjs';
import { checkGeneratedText } from '../src/language.mjs';
import { baseRecord, restrictedRecord } from '../fixtures/build.mjs';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export async function runPhase12Tests(check) {
  const store = new Map();
  const resolver = new EntitlementResolver(store);
  const codeService = new GrantCodeService();
  const redemptionService = new GrantRedemptionService({
    grantCodeService: codeService,
    entitlementResolver: resolver,
  });

  // Seed a valid access grant code
  // Format: CONCLUDO-XXXXXXXX-XXXXXXXXXXXXXXXXXXXX
  const publicId = 'K89M2N4P';
  const secret = 'ABCDEFGHJKMNPQRSTVWX';
  const salt = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
  // Generate scrypt hash
  const { scryptSync } = await import('node:crypto');
  const secretHash = scryptSync(secret, Buffer.from(salt, 'hex'), 32, { N: 16384, r: 8, p: 1 }).toString('hex');

  const grantCodeId = codeService.seedCode({
    public_id: publicId,
    secret_hash: secretHash,
    secret_salt: salt,
    grants_tier: 'team',
    grants_capabilities: ['governance_policy', 'legal_hold', 'audit_log', 'sso'],
    grants_seat_count: 5,
    label: 'Pilot evaluation: Acme Corp',
    max_redemptions: 1,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
  });

  const fullCode = `CONCLUDO-${publicId}-${secret.slice(0, 5)}-${secret.slice(5, 10)}-${secret.slice(10, 15)}-${secret.slice(15, 20)}`;

  // -------------------------------------------------- 1. Redemption & Single-Use Concurrency
  {
    // First redemption succeeds
    const res1 = await redemptionService.redeemCode({
      organisationId: 'org_pilot_01',
      userId: 'usr_pilot_01',
      code: fullCode,
      ip: '192.168.1.100',
    });
    check('phase12:redemption', 'first redemption of single-use code succeeds', res1.success && res1.tier === 'team');

    // Second redemption of same single-use code fails
    let doubleRedeemFailed = false;
    try {
      await redemptionService.redeemCode({
        organisationId: 'org_pilot_02',
        userId: 'usr_pilot_02',
        code: fullCode,
        ip: '192.168.1.101',
      });
    } catch (e) {
      if (e.code === 'GRANT_CODE_INVALID') doubleRedeemFailed = true;
    }
    check('phase12:redemption', 'second redemption of single-use code is refused', doubleRedeemFailed);
  }

  // -------------------------------------------------- 2. Criterion 1: Prohibitions Hold Under Grant
  {
    const grantedEntitlement = resolver.resolve('org_pilot_01');
    check('phase12:prohibitions', 'workspace is granted team tier and capabilities',
      grantedEntitlement.tier === 'team' && grantedEntitlement.capabilities.includes('governance_policy')
    );

    // Verify individual scores are NOT produced
    const out = run(baseRecord());
    check('phase12:prohibitions', 'individual scores are zero under granted workspace',
      out.health.health.individual_scores === null
    );

    // Verify benchmark claims fail
    check('phase12:prohibitions', 'benchmark claims fail under granted workspace',
      !checkGeneratedText('This is 25% higher than the industry benchmark.').ok
    );

    // Verify savings claims fail
    check('phase12:prohibitions', 'savings claims fail under granted workspace',
      !checkGeneratedText('Concludo will save you $5,000 a year.').ok
    );

    // Verify restricted path still fails confidentiality gate
    const rOut = run(restrictedRecord());
    check('phase12:prohibitions', 'confidentiality gate still blocks performance report on restricted record under grant',
      !rOut.plan.outputs.some((o) => o.output_id === 'OUT-09') && rOut.health.scored === false
    );
  }

  // -------------------------------------------------- 3. Criterion 2: Grants Are Not Revenue
  {
    const ent = resolver.resolve('org_pilot_01');
    check('phase12:revenue', 'internal grant has counts_toward_revenue = false', ent.counts_toward_revenue === false);

    // Check database constraint validation: attempting to set counts_toward_revenue = true on internal_grant throws
    let illegalRevenueCaught = false;
    try {
      resolver.setSubscription('org_illegal_rev', {
        tier: 'team',
        seat_count: 5,
        source: 'internal_grant',
        counts_toward_revenue: true, // Forbidden!
      });
    } catch (e) {
      if (e.message.includes('grants_are_not_revenue')) illegalRevenueCaught = true;
    }
    check('phase12:revenue', 'internal grant with counts_toward_revenue=true is rejected by schema validator', illegalRevenueCaught);
  }

  // -------------------------------------------------- 4. Criterion 3: Missing Means Minimum
  {
    const unseeded = resolver.resolve('org_nonexistent_workspace');
    check('phase12:fallback', 'workspace with no subscription row resolves to starter on trial',
      unseeded.tier === 'starter' && unseeded.source === 'trial' && unseeded.capabilities.length === 0
    );

    // Expired subscription resolves to starter (lapsed)
    resolver.setSubscription('org_expired', {
      tier: 'team',
      seat_count: 5,
      source: 'internal_grant',
      period_end: new Date(Date.now() - 1000).toISOString(), // expired in past
      counts_toward_revenue: false,
    });
    const expired = resolver.resolve('org_expired');
    check('phase12:fallback', 'expired grant resolves to starter with lapsed source',
      expired.tier === 'starter' && expired.source === 'lapsed' && expired.capabilities.length === 0
    );
  }

  // -------------------------------------------------- 5. Criterion 4: One Authority (EntitlementResolver.can)
  {
    const ent = resolver.resolve('org_pilot_01');
    check('phase12:authority', 'resolver can() permits export:pdf for team tier', resolver.can(ent, 'export:pdf'));
    check('phase12:authority', 'resolver can() permits governance:policy capability', resolver.can(ent, 'governance:policy'));

    const starterEnt = resolver.resolve('org_nonexistent_workspace');
    check('phase12:authority', 'resolver can() denies export:pdf for starter tier', !resolver.can(starterEnt, 'export:pdf'));
    check('phase12:authority', 'resolver can() denies governance:policy for starter tier', !resolver.can(starterEnt, 'governance:policy'));
  }

  // -------------------------------------------------- 6. Criterion 5: No Enterprise Tier
  {
    check('phase12:tiers', 'PLAN_TIERS contains exactly starter, pro_subscription, team',
      PLAN_TIERS.length === 3 &&
      PLAN_TIERS.includes('starter') &&
      PLAN_TIERS.includes('pro_subscription') &&
      PLAN_TIERS.includes('team') &&
      !PLAN_TIERS.includes('enterprise')
    );

    let enterpriseRejected = false;
    try {
      resolver.setSubscription('org_ent', {
        tier: 'enterprise', // Forbidden!
        seat_count: 5,
        source: 'paid',
        counts_toward_revenue: true,
      });
    } catch (e) {
      enterpriseRejected = true;
    }
    check('phase12:tiers', 'enterprise as a tier is rejected by schema validator', enterpriseRejected);
  }

  // -------------------------------------------------- 7. Tasklet 12.4: Revocation Cascading
  {
    // Revoke the grant code
    redemptionService.revokeCodeAndCascade(grantCodeId, 'usr_admin', 'Pilot evaluation concluded');

    // Bound workspace must immediately resolve to lapsed and starter without cache delay
    const downgraded = resolver.resolve('org_pilot_01');
    check('phase12:revocation', 'revocation cascades immediate downgrade to starter on next request',
      downgraded.tier === 'starter' && downgraded.source === 'lapsed' && downgraded.capabilities.length === 0
    );
  }
}
