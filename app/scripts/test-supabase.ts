import { getSupabaseBrowserClient } from '../src/lib/supabase/client';
import { createSupabaseServerClient } from '../src/lib/supabase/server';
import { getSupabaseAdminClient } from '../src/lib/supabase/admin';

async function main() {
  console.log('====================================================');
  console.log(' Concludo Workspace — Supabase Diagnostic Suite');
  console.log('====================================================\n');

  const supabaseUrl = process.env.SUPABASE_URL || '';
  const anonKey = process.env.SUPABASE_ANON_KEY || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  console.log('1. Environment Variables Inspection:');
  console.log(`   - SUPABASE_URL: ${supabaseUrl ? `Configured (${supabaseUrl})` : 'MISSING'}`);
  console.log(`   - SUPABASE_ANON_KEY: ${anonKey ? 'Configured (Public Key Present)' : 'MISSING'}`);
  console.log(`   - SUPABASE_SERVICE_ROLE_KEY: ${serviceRoleKey ? 'Configured (Server Secret Present)' : 'MISSING'}\n`);

  if (!supabaseUrl || !anonKey) {
    console.error('❌ Diagnostic Result: Missing required environment variables.');
    console.error('   Please define SUPABASE_URL and SUPABASE_ANON_KEY in .env.local.\n');
  }

  // 2. Client initialisation tests
  console.log('2. Client Initialisation Tests:');
  try {
    const browserClient = getSupabaseBrowserClient();
    console.log('   ✅ Browser Client: Initialised successfully');
  } catch (err: any) {
    console.log(`   ⚠️ Browser Client: ${err.message}`);
  }

  try {
    const serverClient = createSupabaseServerClient();
    console.log('   ✅ Server Client: Initialised successfully');
  } catch (err: any) {
    console.log(`   ⚠️ Server Client: ${err.message}`);
  }

  try {
    const adminClient = getSupabaseAdminClient();
    console.log('   ✅ Admin Client: Initialised successfully');
  } catch (err: any) {
    console.log(`   ⚠️ Admin Client: ${err.message}`);
  }

  // 3. Database query test
  if (supabaseUrl && anonKey) {
    console.log('\n3. Database Query Test:');
    try {
      const client = getSupabaseBrowserClient();
      const { data, error } = await client
        .from('connection_test')
        .select('*')
        .limit(1);

      if (error) {
        console.log(`   ⚠️ Supabase Query executed without crashing: ${error.message}`);
      } else if (data && data.length > 0) {
        console.log(`   ✅ Supabase Query succeeded! Found test row: "${data[0].message}"`);
      } else {
        console.log('   ✅ Supabase Query succeeded (table exists, 0 rows).');
      }
    } catch (err: any) {
      console.log(`   ❌ Database Query Error: ${err.message}`);
    }
  }

  console.log('\n====================================================');
}

main().catch(console.error);
