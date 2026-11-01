import assert from 'node:assert/strict';
import { Client as PgClient } from 'pg';
import { PLAN_PERMISSIONS, PlanType, FeatureKey } from '../src/lib/permissions/types';

const pgClient = new PgClient({
  host: 'localhost',
  database: 'concludo_preview',
  user: 'postgres',
  password: 'postgres',
});

const TIER_USERS: Record<string, { id: string; plan: PlanType }> = {
  starter: { id: '11111111-1111-1111-1111-111111111111', plan: 'starter' },
  pro_subscription: { id: '22222222-2222-2222-2222-222222222222', plan: 'pro_subscription' },
  team: { id: '33333333-3333-3333-3333-333333333333', plan: 'team' },
};

const FEATURES_TO_CHECK: FeatureKey[] = [
  'workspace_basic',
  'core_outputs',
  'copy_output',
  'json_export',
  'follow_up_email_draft',
  'meeting_memory',
  'decision_memory',
  'action_tracker',
  'keyword_search',
  'insight',
  'stats',
  'endpoint_report',
  'saved_projects',
  'transcript_archive',
  'manual_outputs',
  'next_best_action',
  'meeting_health_dashboard',
  'team_workspace',
  'team_administration',
  'shared_projects',
  'shared_decisions',
  'shared_actions',
  'shared_insights',
];

async function runParityTest() {
  await pgClient.connect();
  let comparisons = 0;
  let matches = 0;

  for (const [tierKey, { id, plan }] of Object.entries(TIER_USERS)) {
    const allowedInFrontend = new Set(PLAN_PERMISSIONS[plan] || []);

    for (const feat of FEATURES_TO_CHECK) {
      comparisons++;
      const res = await pgClient.query(
        'SELECT public.can_use_feature($1::uuid, $2::text) as allowed;',
        [id, feat]
      );
      const dbAllowed = Boolean(res.rows[0]?.allowed);
      const feAllowed = allowedInFrontend.has(feat);

      assert.equal(
        feAllowed,
        dbAllowed,
        `Parity mismatch on ${tierKey} (${plan}) for feature "${feat}": FE=${feAllowed}, DB=${dbAllowed}`
      );
      matches++;
    }
  }

  console.log(`\nParity test passed: ${matches} of ${comparisons} feature-plan combinations match perfectly between PLAN_PERMISSIONS and can_use_feature.`);
  await pgClient.end();
}

runParityTest().catch((e) => {
  console.error('Parity test failed:', e);
  process.exit(1);
});
