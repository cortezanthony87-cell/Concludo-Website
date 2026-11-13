/**
 * Video Meeting Centre Owner Verification Client.
 *
 * Verifies whether the current user is authorized to access the Video Meeting Centre.
 * Uses server-authoritative RPC `public.is_video_owner()`.
 * Target project is configurable via environment variable (VITE_VIDEO_CENTRE_SUPABASE_URL).
 * Defaults to the primary Concludo project if unspecified.
 * Fails closed (returns false) if unauthenticated, if the RPC errors, or if any check fails.
 * Zero hard-coded email fallbacks.
 * Zero em dashes or en dashes.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient, getSupabaseEnv } from '../supabase/client';

export interface VideoOwnerCheckResult {
  isOwner: boolean;
  loading: boolean;
  error: string | null;
  userId?: string | null;
  email?: string | null;
}

let stagingClient: SupabaseClient | null = null;

function getVideoCentreClient(): SupabaseClient {
  const stagingUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIDEO_CENTRE_SUPABASE_URL) ||
    (typeof process !== 'undefined' && process.env?.VITE_VIDEO_CENTRE_SUPABASE_URL);

  const stagingAnonKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_VIDEO_CENTRE_SUPABASE_ANON_KEY) ||
    (typeof process !== 'undefined' && process.env?.VITE_VIDEO_CENTRE_SUPABASE_ANON_KEY);

  if (stagingUrl && stagingAnonKey) {
    if (!stagingClient) {
      stagingClient = createClient(stagingUrl, stagingAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    }
    return stagingClient;
  }

  // Fallback to standard client
  return getSupabaseBrowserClient();
}

export interface VideoOwnerDetails {
  isOwner: boolean;
  email: string | null;
  userId: string | null;
}

export async function getVideoOwnerDetails(): Promise<VideoOwnerDetails> {
  try {
    const supabase = getVideoCentreClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session || !session.user) {
      return { isOwner: false, email: null, userId: null };
    }

    // Call security-definer function on Supabase: public.is_video_owner()
    const { data: isOwnerRpc, error: rpcError } = await supabase.rpc('is_video_owner');
    if (rpcError || typeof isOwnerRpc !== 'boolean') {
      // Fail closed: if the RPC errors or does not return boolean, return false
      return { isOwner: false, email: null, userId: null };
    }

    return {
      isOwner: isOwnerRpc,
      email: isOwnerRpc ? (session.user.email || null) : null,
      userId: isOwnerRpc ? session.user.id : null
    };
  } catch {
    // Fail closed on any exception
    return { isOwner: false, email: null, userId: null };
  }
}

export async function checkIsVideoOwner(): Promise<boolean> {
  const details = await getVideoOwnerDetails();
  return details.isOwner;
}
