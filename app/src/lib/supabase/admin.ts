import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Admin/server-only Supabase helper
// Uses SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// STRICT SECURITY RULE: This client has elevated administrative privileges (bypassing RLS).
// It must ONLY be executed on the secure server/backend and NEVER bundled or invoked in the browser.

export function getSupabaseAdminClient(): SupabaseClient {
  // Hard runtime guard against browser execution
  if (typeof window !== 'undefined') {
    throw new Error(
      'Security Exception: SUPABASE_SERVICE_ROLE_KEY and admin client cannot be accessed in the browser.'
    );
  }

  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) || '';
  const supabaseServiceRoleKey =
    (typeof process !== 'undefined' && process.env?.SUPABASE_SERVICE_ROLE_KEY) || '';

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL environment variable. Please configure SUPABASE_URL in your secure server environment.'
    );
  }

  if (!supabaseServiceRoleKey) {
    throw new Error(
      'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. Please configure SUPABASE_SERVICE_ROLE_KEY in your secure server environment.'
    );
  }

  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
