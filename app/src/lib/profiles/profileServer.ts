import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserProfile } from './types';
import { createSupabaseServerClient } from '../supabase/server';
import { getSupabaseAdminClient } from '../supabase/admin';

/**
 * Server-side helper to fetch a user profile by ID using an authenticated server client or admin client.
 */
export async function fetchUserProfileServer(
  userId: string,
  serverClient?: SupabaseClient
): Promise<UserProfile | null> {
  const client = serverClient || getSupabaseAdminClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[Server] Failed to fetch user profile:', error.message);
    return null;
  }

  return data as UserProfile | null;
}

/**
 * Server-side helper to fetch the currently authenticated user's profile from request context.
 */
export async function getCurrentUserProfileServer(
  req?: { headers: { get: (name: string) => string | null } }
): Promise<UserProfile | null> {
  const authHeader = req?.headers?.get('Authorization') || req?.headers?.get('authorization');
  const serverClient = createSupabaseServerClient(authHeader || undefined);

  const {
    data: { user },
    error: userError,
  } = await serverClient.auth.getUser();

  if (userError || !user) {
    return null;
  }

  return fetchUserProfileServer(user.id, serverClient);
}
