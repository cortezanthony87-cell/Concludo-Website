import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'fs';
import { executeRetentionPurge } from '../src/lib/retention/purgeWorker';

// Parse environment variables from .env.local
const envPath = existsSync('/tmp/concludo-workspace/.env.local')
  ? '/tmp/concludo-workspace/.env.local'
  : '/tasklet/threads/a_ryn25wcsemyhsbbvdzk5/work/concludo-workspace/.env.local';

const envFile = readFileSync(envPath, 'utf8');
const envVars = Object.fromEntries(
  envFile
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const idx = l.indexOf('=');
      return [l.slice(0, idx), l.slice(idx + 1)];
    })
);

const supabaseUrl = envVars.SUPABASE_URL;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for automated purge.');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, serviceKey);

async function runDailyRetentionPurge() {
  console.log('========================================================');
  console.log('CONCLUDO WORKSPACE: AUTOMATED RETENTION PURGE WORKER');
  console.log('Frequency: Daily');
  console.log('Purge Criteria: deleted_at is not null AND purge_after < now()');
  console.log('========================================================\n');

  console.log(`Starting automated purge at ${new Date().toISOString()}...`);

  const result = await executeRetentionPurge(adminClient);

  if (!result.success) {
    console.error('❌ Automated retention purge failed:', result.error);
    process.exit(1);
  }

  console.log('\n✅ Automated retention purge completed successfully:');
  console.log(`   - Execution Timestamp: ${result.executed_at}`);
  console.log(`   - Expired Projects Purged: ${result.purged_projects}`);
  console.log(`   - Expired Outputs Purged: ${result.purged_outputs}`);
  console.log(`   - Expired Decisions Purged: ${result.purged_decisions ?? 0}`);
  console.log(`   - Expired Actions Purged: ${result.purged_actions ?? 0}`);
  console.log('   - Retention Policy: 30 days recovery window enforced\n');
}

runDailyRetentionPurge().catch((err) => {
  console.error('Fatal purge worker error:', err);
  process.exit(1);
});
