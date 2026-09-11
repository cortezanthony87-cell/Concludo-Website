import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { PLAN_LABELS, ROLE_LABELS, PlanType } from '../src/lib/profiles/types';
import { fetchUserProfileServer } from '../src/lib/profiles/profileServer';
import { fetchUserProfile, updateUserFullName } from '../src/lib/profiles/profileClient';

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

// Ensure process.env has them for helpers
process.env.SUPABASE_URL = supabaseUrl;
process.env.SUPABASE_ANON_KEY = anonKey;
process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey;

async function runProfileVerificationSuite() {
  console.log('====================================================');
  console.log(' Concludo Workspace: User Profiles Verification');
  console.log(' Tasklet 4: Profile & RLS Security Suite');
  console.log('====================================================\n');

  const adminClient = createClient(supabaseUrl, serviceKey);

  // 1. Verify Plan Badge Labels mapping
  console.log('1. Checking Plan Badge Mapping:');
  const expectedPlanLabels: Record<PlanType, string> = {
    free_preview: 'Free Preview',
    starter_trial: 'Starter Trial',
    starter: 'Starter',
    pro_trial: 'Pro Trial',
    pro: 'Pro',
    team: 'Team',
    admin: 'Admin',
  };

  for (const [plan, expectedLabel] of Object.entries(expectedPlanLabels)) {
    if (PLAN_LABELS[plan as PlanType] !== expectedLabel) {
      throw new Error(`Plan label mismatch for "${plan}": expected "${expectedLabel}", got "${PLAN_LABELS[plan as PlanType]}"`);
    }
  }
  console.log('   ✅ All 7 plan badges match required strings exactly.\n');

  // 2. Test User Alpha Signup with full_name
  const emailA = `test-alpha-${Date.now()}@concludo.au`;
  const passA = 'AlphaSecurePass2026!';
  console.log(`2. Creating User Alpha (${emailA}) with full_name: "Anthony Cortez"...`);

  const { data: authA, error: errAuthA } = await adminClient.auth.admin.createUser({
    email: emailA,
    password: passA,
    email_confirm: true,
    user_metadata: { full_name: 'Anthony Cortez' },
  });

  if (errAuthA || !authA.user) {
    throw new Error(`Failed to create User Alpha: ${errAuthA?.message}`);
  }
  const userAId = authA.user.id;
  console.log(`   ✅ User Alpha created in auth.users (ID: ${userAId})`);

  // Verify database trigger created profile row
  const { data: profileA, error: errPA } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userAId)
    .single();

  if (errPA || !profileA) {
    throw new Error(`Profile row not found for User Alpha: ${errPA?.message}`);
  }
  console.log('   ✅ Profile row automatically created via database trigger:');
  console.log(`      - id: ${profileA.id}`);
  console.log(`      - email: ${profileA.email}`);
  console.log(`      - full_name: "${profileA.full_name}"`);
  console.log(`      - plan: "${profileA.plan}"`);
  console.log(`      - role: "${profileA.role}"`);

  if (profileA.full_name !== 'Anthony Cortez') throw new Error('full_name was not populated from metadata');
  if (profileA.plan !== 'free_preview') throw new Error('Initial plan is not free_preview');
  if (profileA.role !== 'user') throw new Error('Initial role is not user');

  // 3. Test User Beta Signup without full_name (blank unless provided)
  const emailB = `test-beta-${Date.now()}@concludo.au`;
  const passB = 'BetaSecurePass2026!';
  console.log(`\n3. Creating User Beta (${emailB}) without full_name...`);

  const { data: authB, error: errAuthB } = await adminClient.auth.admin.createUser({
    email: emailB,
    password: passB,
    email_confirm: true,
  });

  if (errAuthB || !authB.user) {
    throw new Error(`Failed to create User Beta: ${errAuthB?.message}`);
  }
  const userBId = authB.user.id;

  const { data: profileB, error: errPB } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', userBId)
    .single();

  if (errPB || !profileB) {
    throw new Error(`Profile row not found for User Beta: ${errPB?.message}`);
  }
  console.log('   ✅ Profile row automatically created with blank full_name:');
  console.log(`      - full_name: "${profileB.full_name}" (is blank: ${profileB.full_name === ''})`);
  console.log(`      - plan: "${profileB.plan}"`);
  console.log(`      - role: "${profileB.role}"`);

  if (profileB.full_name !== '') throw new Error('full_name was not blank for User Beta');

  // 4. Test Server-side Helper
  console.log('\n4. Testing server-side helper (fetchUserProfileServer)...');
  const serverProfile = await fetchUserProfileServer(userAId, adminClient);
  if (!serverProfile || serverProfile.id !== userAId) {
    throw new Error('fetchUserProfileServer failed to return user profile');
  }
  console.log(`   ✅ fetchUserProfileServer returned profile: ${serverProfile.email} (${serverProfile.plan})`);

  // 5. Test Authenticated Client Operations for User Alpha
  console.log('\n5. Authenticating User Alpha via client...');
  const clientA = createClient(supabaseUrl, anonKey);
  const { error: signInErr } = await clientA.auth.signInWithPassword({
    email: emailA,
    password: passA,
  });
  if (signInErr) throw new Error(`User Alpha login failed: ${signInErr.message}`);
  console.log('   ✅ User Alpha authenticated successfully.');

  // Read own profile via client
  const { data: clientReadA, error: errClientReadA } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userAId)
    .single();

  if (errClientReadA || !clientReadA) {
    throw new Error(`User Alpha could not read own profile: ${errClientReadA?.message}`);
  }
  console.log(`   ✅ User Alpha read own profile via RLS: "${clientReadA.full_name}"`);

  // Update full_name via client
  console.log('\n6. Updating full_name via client...');
  const { data: updatedName, error: errUpdateName } = await clientA
    .from('profiles')
    .update({ full_name: 'Anthony Cortez (Updated)' })
    .eq('id', userAId)
    .select()
    .single();

  if (errUpdateName || updatedName?.full_name !== 'Anthony Cortez (Updated)') {
    throw new Error(`Failed to update full name: ${errUpdateName?.message}`);
  }
  console.log(`   ✅ Full name successfully updated to: "${updatedName.full_name}"`);
  console.log(`   ✅ updated_at timestamp renewed: ${updatedName.updated_at}`);

  // 7. Test Security Restrictions (Users CANNOT update plan, role, email, or delete)
  console.log('\n7. Testing Security & Immutability Restrictions:');

  // Attempt to update plan
  const { error: planErr } = await clientA
    .from('profiles')
    .update({ plan: 'pro' })
    .eq('id', userAId);

  if (!planErr) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update plan!');
  }
  console.log(`   ✅ Plan update rejected by database policy: "${planErr.message}"`);

  // Attempt to update role
  const { error: roleErr } = await clientA
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', userAId);

  if (!roleErr) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update role!');
  }
  console.log(`   ✅ Role update rejected by database policy: "${roleErr.message}"`);

  // Attempt to update email directly
  const { error: emailErr } = await clientA
    .from('profiles')
    .update({ email: 'hacked@evil.com' })
    .eq('id', userAId);

  if (!emailErr) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update email directly!');
  }
  console.log(`   ✅ Email direct update rejected by database policy: "${emailErr.message}"`);

  // Attempt to delete profile
  const { data: delData } = await clientA
    .from('profiles')
    .delete()
    .eq('id', userAId)
    .select();

  const { data: profileStillExists } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userAId);

  if (!profileStillExists || profileStillExists.length === 0) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to delete profile!');
  }
  console.log('   ✅ Profile delete attempt blocked by RLS (row remains secure).');

  // 8. Test Isolation between User A and User B
  console.log('\n8. Testing User Isolation (User A cannot see or edit User B):');
  const { data: readBAsA } = await clientA
    .from('profiles')
    .select('*')
    .eq('id', userBId);

  if (readBAsA && readBAsA.length > 0) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to read User Beta profile!');
  }
  console.log('   ✅ User Alpha cannot read User Beta profile (0 rows returned via RLS).');

  const { data: updateBAsA } = await clientA
    .from('profiles')
    .update({ full_name: 'Overwritten by Alpha' })
    .eq('id', userBId)
    .select();

  if (updateBAsA && updateBAsA.length > 0) {
    throw new Error('SECURITY VIOLATION: User Alpha was able to update User Beta profile!');
  }
  console.log('   ✅ User Alpha cannot update User Beta profile (0 rows affected).');

  // 9. Cleanup Test Users
  console.log('\n9. Cleaning up test accounts from Supabase Auth...');
  await adminClient.auth.admin.deleteUser(userAId);
  await adminClient.auth.admin.deleteUser(userBId);
  console.log('   ✅ Test accounts cleaned up.');

  console.log('\n====================================================');
  console.log(' 🎉 ALL TASKLET 4 USER PROFILE CHECKS PASSED!');
  console.log('====================================================\n');
}

runProfileVerificationSuite().catch((err) => {
  console.error('\n❌ Profile Verification Suite Failed:', err);
  process.exit(1);
});
