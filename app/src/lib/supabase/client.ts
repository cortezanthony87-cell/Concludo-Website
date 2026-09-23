import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Browser/client Supabase helper
// Uses SUPABASE_URL and SUPABASE_ANON_KEY
// Safe for use in browser and client-side components.
// SUPABASE_SERVICE_ROLE_KEY is strictly forbidden in browser/client code.

let browserClient: SupabaseClient | null = null;

const DEFAULT_SUPABASE_URL = 'https://dikthezsghsssnwtctem.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRpa3RoZXpzZ2hzc3Nud3RjdGVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkwOTgzNzUsImV4cCI6MjEwNDY3NDM3NX0.k_ZM3EB3GSXnQevQemvI4G_BRV3NgHtpWVjBAklXOLs';

export function getSupabaseEnv(): { supabaseUrl: string; supabaseAnonKey: string } {
  const supabaseUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
    DEFAULT_SUPABASE_URL;

  const supabaseAnonKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof import.meta !== 'undefined' && import.meta.env?.SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
    DEFAULT_SUPABASE_ANON_KEY;

  return { supabaseUrl, supabaseAnonKey };
}

export function getSupabaseBrowserClient(): SupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

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
