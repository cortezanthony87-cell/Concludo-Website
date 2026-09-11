import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Server/API Supabase helper
// Intended for server-side environments, edge functions, API routes, or server actions.
// Uses SUPABASE_URL and SUPABASE_ANON_KEY (with optional authenticated user JWT context).

export function createSupabaseServerClient(authToken?: string): SupabaseClient {
  const supabaseUrl =
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    '';

  const supabaseAnonKey =
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    '';

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL environment variable. Please configure SUPABASE_URL in your server environment.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing SUPABASE_ANON_KEY environment variable. Please configure SUPABASE_ANON_KEY in your server environment.'
    );
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    },
  });
}
