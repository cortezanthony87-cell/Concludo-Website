import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Browser/client Supabase helper
// Uses SUPABASE_URL and SUPABASE_ANON_KEY
// Safe for use in browser and client-side components.
// SUPABASE_SERVICE_ROLE_KEY is strictly forbidden in browser/client code.

let browserClient: SupabaseClient | null = null;

export function getSupabaseEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    '';

  const supabaseAnonKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    '';

  return { supabaseUrl, supabaseAnonKey };
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

  if (!supabaseUrl) {
    throw new Error(
      'Missing SUPABASE_URL environment variable. Please configure SUPABASE_URL in .env.local for local development or in your hosting provider settings.'
    );
  }

  if (!supabaseAnonKey) {
    throw new Error(
      'Missing SUPABASE_ANON_KEY environment variable. Please configure SUPABASE_ANON_KEY in .env.local for local development or in your hosting provider settings.'
    );
  }

  browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return browserClient;
}

export const getSupabaseClient = getSupabaseBrowserClient;

export const supabase = {
  get client() {
    return getSupabaseBrowserClient();
  },
};
