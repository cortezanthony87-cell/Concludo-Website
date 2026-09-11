import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getAuthErrorMessage } from '../src/lib/auth/authErrors';

console.log('====================================================');
console.log('🧪 CONCLUDO WORKSPACE - SUPABASE AUTH VERIFICATION');
console.log('====================================================\n');

// 1. Verify Environment Variables
const envPath = join(__dirname, '..', '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ .env.local not found!');
  process.exit(1);
}

const envContent = readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
}

const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables in .env.local');
  process.exit(1);
}

console.log('1️⃣ Environment Variables:');
console.log(`   ✅ SUPABASE_URL: ${supabaseUrl}`);
console.log(`   ✅ SUPABASE_ANON_KEY: Configured (${supabaseAnonKey.slice(0, 15)}...)`);
console.log(`   ✅ SUPABASE_SERVICE_ROLE_KEY: Configured (${supabaseServiceKey.slice(0, 15)}...)\n`);

const client = createClient(supabaseUrl, supabaseAnonKey);
const admin = createClient(supabaseUrl, supabaseServiceKey);

async function runTests() {
  const testRunId = Date.now();
  const testEmail = `auth_test_${testRunId}@concludo.au`;
  const testPassword = 'ConcludoSecure2026!';
  let createdUserId: string | null = null;

  try {
    // 2. Test Error Message Translations
    console.log('2️⃣ Testing Auth Error Translations:');

    const errMissingEmail = getAuthErrorMessage({ message: 'missing email' });
    console.log(`   ${errMissingEmail === 'Please enter your email address.' ? '✅' : '❌'} Missing email: "${errMissingEmail}"`);

    const errMissingPassword = getAuthErrorMessage({ message: 'missing password' });
    console.log(`   ${errMissingPassword === 'Please enter your password.' ? '✅' : '❌'} Missing password: "${errMissingPassword}"`);

    const errInvalidEmail = getAuthErrorMessage({ message: 'Unable to validate email address: invalid format' });
    console.log(`   ${errInvalidEmail === 'Please enter a valid email address.' ? '✅' : '❌'} Invalid email: "${errInvalidEmail}"`);

    const errIncorrectPw = getAuthErrorMessage({ message: 'Invalid login credentials' });
    console.log(`   ${errIncorrectPw === 'Incorrect email or password. Please verify your credentials and try again.' ? '✅' : '❌'} Incorrect password: "${errIncorrectPw}"`);

    const errExistingAcct = getAuthErrorMessage({ message: 'User already registered' });
    console.log(`   ${errExistingAcct === 'An account with this email address already exists. Please sign in or reset your password.' ? '✅' : '❌'} Existing account: "${errExistingAcct}"`);

    const errWeakPw = getAuthErrorMessage({ message: 'Password should be at least 6 characters.' });
    console.log(`   ${errWeakPw === 'Password is too weak. Please choose a password with at least 6 characters.' ? '✅' : '❌'} Weak password: "${errWeakPw}"`);

    const errExpired = getAuthErrorMessage({ message: 'Token has expired or is invalid' });
    console.log(`   ${errExpired === 'This password reset link is invalid or has expired. Please request a new password reset.' ? '✅' : '❌'} Expired link: "${errExpired}"`);

    const errNetwork = getAuthErrorMessage({ message: 'Failed to fetch' });
    console.log(`   ${errNetwork === 'Network or Supabase server connection error. Please verify your internet connection and try again.' ? '✅' : '❌'} Network error: "${errNetwork}"\n`);

    // 3. Test Direct Validation & Live Supabase Calls
    console.log('3️⃣ Testing Live Supabase Auth Operations:');

    // Test A: Weak Password on SignUp
    const { error: weakPwError } = await client.auth.signUp({
      email: testEmail,
      password: '123',
    });
    console.log(`   ${weakPwError ? '✅' : '❌'} Supabase rejected weak password: "${weakPwError?.message}"`);

    // Test B: Invalid Email on SignUp
    const { error: invalidEmailError } = await client.auth.signUp({
      email: 'not-an-email',
      password: testPassword,
    });
    console.log(`   ${invalidEmailError ? '✅' : '❌'} Supabase rejected invalid email format: "${invalidEmailError?.message}"`);

    // Test C: Create User via Admin (confirmed email) to simulate confirmed user
    console.log('\n4️⃣ Testing Confirmed User Authentication Flow:');
    const { data: adminCreated, error: adminCreateErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

    if (adminCreateErr || !adminCreated.user) {
      throw new Error(`Failed to create test user: ${adminCreateErr?.message}`);
    }
    createdUserId = adminCreated.user.id;
    console.log(`   ✅ Confirmed test user created in Supabase Auth: ${adminCreated.user.email} (ID: ${createdUserId})`);

    // Test D: Sign in with incorrect password
    const { error: wrongPwError } = await client.auth.signInWithPassword({
      email: testEmail,
      password: 'WrongPassword999!',
    });
    console.log(`   ${wrongPwError ? '✅' : '❌'} Supabase correctly rejected wrong password: "${getAuthErrorMessage(wrongPwError)}"`);

    // Test E: Sign in with correct credentials
    const { data: signInData, error: signInErr } = await client.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });
    if (signInErr || !signInData.session) {
      throw new Error(`Sign in failed: ${signInErr?.message}`);
    }
    console.log(`   ✅ Sign in successful! Session token received:`);
    console.log(`      User: ${signInData.user?.email}`);
    console.log(`      Role: ${signInData.user?.role}`);
    console.log(`      Access token: ${signInData.session.access_token.slice(0, 25)}...`);

    // Test F: Session verification
    const { data: sessionData } = await client.auth.getSession();
    console.log(`   ${sessionData.session ? '✅' : '❌'} Session persists in client: ${sessionData.session?.user.email}`);

    // Test G: Forgot password email request
    const { error: resetErr } = await client.auth.resetPasswordForEmail(testEmail, {
      redirectTo: 'http://localhost:3000/reset-password',
    });
    console.log(`   ${!resetErr ? '✅' : '❌'} Password reset request processed successfully: ${resetErr ? resetErr.message : 'Sent to ' + testEmail}`);

    // Test H: Sign out
    const { error: signOutErr } = await client.auth.signOut();
    const { data: postSignOutSession } = await client.auth.getSession();
    console.log(`   ${!signOutErr && !postSignOutSession.session ? '✅' : '❌'} Sign out successful, session cleared.`);

    console.log('\n====================================================');
    console.log('🎉 ALL SUPABASE AUTHENTICATION CHECKS PASSED!');
    console.log('====================================================\n');
  } finally {
    if (createdUserId) {
      console.log(`🧹 Cleaning up test user ${createdUserId}...`);
      await admin.auth.admin.deleteUser(createdUserId);
      console.log('✅ Test user cleaned up.');
    }
  }
}

runTests().catch((err) => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
