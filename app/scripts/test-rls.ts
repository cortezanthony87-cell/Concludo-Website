import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Parse environment variables from .env.local
const envFile = readFileSync('/tmp/concludo-workspace/.env.local', 'utf8');
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
const anonKey = envVars.SUPABASE_ANON_KEY;
const serviceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceKey) {
  throw new Error('Missing required Supabase environment variables in .env.local');
}

async function runSecurityTestSuite() {
  console.log('====================================================');
  console.log(' Concludo Workspace: Row-Level Security Verification');
  console.log(' Tasklet 5: Security & Isolation Test Suite');
  console.log('====================================================\n');

  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Verify Service Role administrative capabilities
  console.log('1. Testing Service Role Admin Capabilities:');
  const { data: adminCheck, error: errAdminCheck } = await adminClient
    .from('profiles')
    .select('id')
    .limit(1);

  if (errAdminCheck) {
    throw new Error(`Service role failed basic read: ${errAdminCheck.message}`);
  }
  console.log('   ✅ Service role successfully performs server-side/admin queries.\n');

  // 2. Test Logged-out / Unauthenticated (anon) access
  console.log('2. Testing Logged-out (Anon) Access Restriction:');
  const anonClient = createClient(supabaseUrl, anonKey);
  const { data: anonData, error: anonError } = await anonClient
    .from('profiles')
    .select('*');

  // anon should receive an error or 0 rows (empty list) due to revoked privileges / RLS
  if (anonError) {
    console.log(`   ✅ Logged-out user read rejected by database: "${anonError.message}"`);
  } else if (!anonData || anonData.length === 0) {
    console.log('   ✅ Logged-out user received 0 rows (profile data is strictly private).');
  } else {
    throw new Error('SECURITY VIOLATION: Logged-out user was able to access profiles data!');
  }

  // 3. Setup User Alpha and User Beta
  console.log('\n3. Provisioning Test Accounts:');
  const emailA = `security-alpha-${Date.now()}@concludo.au`;
  const passA = 'AlphaSecurePass2026!';
  const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
    email: emailA,
    password: passA,
    email_confirm: true,
    user_metadata: { full_name: 'Alpha User' },
  });
  if (errA || !authA.user) throw new Error(`Failed to create User Alpha: ${errA?.message}`);
  const userAId = authA.user.id;
  console.log(`   ✅ User Alpha created (${emailA}, ID: ${userAId})`);

  const emailB = `security-beta-${Date.now()}@concludo.au`;
  const passB = 'BetaSecurePass2026!';
  const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
    email: emailB,
    password: passB,
    email_confirm: true,
    user_metadata: { full_name: 'Beta User' },
  });
  if (errB || !authB.user) throw new Error(`Failed to create User Beta: ${errB?.message}`);
  const userBId = authB.user.id;
  console.log(`   ✅ User Beta created (${emailB}, ID: ${userBId})`);

  // Authenticate as User Alpha
  console.log('\n4. Authenticating as User Alpha (Client):');
  const clientA = createClient(supabaseUrl, anonKey);
  const { error: signInErrA } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: passA,
  });
  if (signInErrA) throw new Error(`User Alpha login failed: ${signInErrA.message}`);
  console.log('   ✅ User Alpha session active.');

  // Authenticate as User Beta
  console.log('\n5. Authenticating as User Beta (Client):');
  const clientB = createClient(supabaseUrl, anonKey);
  const { error: signInErrB } = await clientB.auth.signInWithPassword({
    email: emailB,
    password: passB,
  });
  if (signInErrB) throw new Error(`User Beta login failed: ${signInErrB.message}`);
  console.log('   ✅ User Beta session active.');

  // 6. User A can read their own profile
  console.log('\n6. Checking User A can read their own profile:');
  const { data: readSelfA, error: errReadSelfA } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userAId)
    .single();

  if (errReadSelfA || !readSelfA) {
    throw new Error(`User Alpha could not read own profile: ${errReadSelfA?.message}`);
  }
  console.log(`   ✅ User Alpha read own profile: "${readSelfA.full_name}" (${readSelfA.email})`);

  // 7. User A cannot read User B's profile
  console.log('\n7. Checking User A CANNOT read User B profile:');
  const { data: readBAsA } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userBId);

  if (readBAsA && readBAsA.length > 0) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to read User Beta profile!');
  }
  console.log('   ✅ User Alpha cannot read User Beta profile (0 rows returned via RLS).');

  // Also check User B cannot read User A's profile
  const { data: readAAsB } = await clientB
    .from('profiles')
    .select('*')
    .eq('id', userAId);

  if (readAAsB && readAAsB.length > 0) {
    throw new Error('SECURITY VIOLATION: User Beta was able to read User Alpha profile!');
  }
  console.log('   ✅ User Beta cannot read User Alpha profile (0 rows returned via RLS).');

  // 8. User A can update their own full_name
  console.log('\n8. Checking User A can update their own full_name:');
  const { data: updateNameA, error: errUpdateNameA } = await clientA
    .from('profiles')
    .update({ full_name: 'Alpha User Updated' })
    .eq('id', userAId)
    .select()
    .single();

  if (errUpdateNameA || updateNameA?.full_name !== 'Alpha User Updated') {
    throw new Error(`User Alpha failed to update own full_name: ${errUpdateNameA?.message}`);
  }
  console.log(`   ✅ User Alpha successfully updated own full_name to "${updateNameA.full_name}"`);

  // 9. User A cannot update their own plan
  console.log('\n9. Checking User A CANNOT update their own plan:');
  const { error: errPlanA } = await clientA
    .from('profiles')
    .update({ plan: 'pro' })
    .eq('id', userAId);

  if (!errPlanA) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update plan!');
  }
  console.log(`   ✅ Plan update blocked by database security: "${errPlanA.message}"`);

  // 10. User A cannot update their own role
  console.log('\n10. Checking User A CANNOT update their own role:');
  const { error: errRoleA } = await clientA
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userAId);

  if (!errRoleA) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update role!');
  }
  console.log(`   ✅ Role update blocked by database security: "${errRoleA.message}"`);

  // 11. User A cannot update their own email
  console.log('\n11. Checking User A CANNOT update their own email:');
  const { error: errEmailA } = await clientA
    .from('profiles')
    .update({ email: 'exploit@attack.com' })
    .eq('id', userAId);

  if (!errEmailA) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update email directly!');
  }
  console.log(`   ✅ Email direct update blocked by database security: "${errEmailA.message}"`);

  // 12. User A cannot update their own created_at
  console.log('\n12. Checking User A CANNOT update their own created_at:');
  const { error: errCreatedA } = await clientA
    .from('profiles')
    .update({ created_at: '2020-01-01T00:00:00Z' })
    .eq('id', userAId);

  if (!errCreatedA) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update created_at!');
  }
  console.log(`   ✅ created_at update blocked by database security: "${errCreatedA.message}"`);

  // 13. Service role can still perform admin maintenance (e.g. adjust plan or role server-side)
  console.log('\n13. Checking Service Role can perform administrative maintenance:');
  const { data: adminUpdate, error: errAdminUpdate } = await adminClient
    .from('profiles')
    .update({ plan: 'pro' })
    .eq('id', userAId)
    .select()
    .single();

  if (errAdminUpdate || adminUpdate?.plan !== 'pro') {
    throw new Error(`Admin service role maintenance failed: ${errAdminUpdate?.message}`);
  }
  console.log(`   ✅ Admin service role successfully performed plan upgrade: plan is now "${adminUpdate.plan}"`);

  // 14. Cleanup
  console.log('\n14. Cleaning up test accounts...');
  await adminClient.auth.admin.deleteUser(userAId);
  await adminClient.auth.admin.deleteUser(userBId);
  console.log('   ✅ Test accounts cleaned up.');

  console.log('\n====================================================');
  console.log(' 🎉 ALL TASKLET 5 RLS & SECURITY CHECKS PASSED!');
  console.log('====================================================\n');
}

runSecurityTestSuite().catch((err) => {
  console.error('\n❌ Security Test Suite Failed:', err);
  process.exit(1);
});
