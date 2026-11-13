/**
 * Video Meeting Centre Owner Verification Client.
 *
 * Verifies whether the current user is authorized to access the Video Meeting Centre.
 * Uses server-authoritative RPC `public.is_video_owner()`.
 * Defaults to the primary Concludo Supabase client.
 * Fails closed (returns false) if unauthenticated, if the RPC errors, or if any check fails.
 * Zero hard-coded email fallbacks.
 * Zero em dashes or en dashes.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';

export interface VideoOwnerDetails {
  isOwner: boolean;
  email: string | null;
  userId: string | null;
}

function getVideoCentreClient(): SupabaseClient {
  return getSupabaseBrowserClient();
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
