import { getSupabaseBrowserClient } from '../supabase/client';
import type { UserProfile } from './types';

/**
 * Client-side helper to fetch a user profile by ID using the authenticated Supabase client.
 * Protected by Row Level Security (RLS) — regular users can only read their own profile.
 */
export async function fetchUserProfile(
  userId: string
): Promise<{ profile: UserProfile | null; error: Error | null }> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return { profile: null, error: new Error(error.message) };
    }

    return { profile: data as UserProfile | null, error: null };
  } catch (err) {
    return {
      profile: null,
      error: err instanceof Error ? err : new Error('Failed to retrieve user profile'),
    };
  }
}

/**
 * Client-side helper to update the authenticated user's full name.
 * Row Level Security and database triggers ensure that regular users can only update full_name,
 * and cannot update plan, role, email, id, or created_at.
 */
export async function updateUserFullName(
  userId: string,
  fullName: string
): Promise<{ profile: UserProfile | null; error: Error | null }> {
  try {
    const supabase = getSupabaseBrowserClient();
    const { data, error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim() })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { profile: null, error: new Error(error.message) };
    }

    return { profile: data as UserProfile, error: null };
  } catch (err) {
    return {
      profile: null,
      error: err instanceof Error ? err : new Error('Failed to update profile name'),
    };
  }
}

/**
 * Self-healing helper: If a logged-in user has no profile row, create one automatically
 * with safe defaults (free_preview plan, user role).
 */
export async function repairOrEnsureProfile(user: {
  id: string;
  email: string;
  fullName?: string;
}): Promise<{ profile: UserProfile | null; error: Error | null }> {
  try {
    const supabase = getSupabaseBrowserClient();

    // 1. Check if profile already exists
    const existing = await fetchUserProfile(user.id);
    if (existing.profile) {
      return existing;
    }

    // 2. Insert fallback profile using allowed defaults
    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email,
        full_name: user.fullName || '',
        plan: 'free_preview',
        role: 'user',
      })
      .select()
      .single();

    if (error) {
      return { profile: null, error: new Error(error.message) };
    }

    return { profile: data as UserProfile, error: null };
  } catch (err) {
    return {
      profile: null,
      error: err instanceof Error ? err : new Error('Automatic profile repair failed'),
    };
  }
}
