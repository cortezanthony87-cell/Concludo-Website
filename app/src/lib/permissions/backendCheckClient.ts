import { SupabaseClient } from '@supabase/supabase-js';
import {
  FeatureKey,
  PlanType,
  ALL_FEATURE_KEYS,
  FEATURE_TIER_BADGES,
} from './types';

export interface BackendPermissionsResponse {
  userId: string;
  plan: PlanType;
  allowedFeatures: FeatureKey[];
  lockedFeatures: FeatureKey[];
  features: Record<FeatureKey, { allowed: boolean; badge?: string }>;
}

/**
 * Client helper to query the authoritative backend permission check.
 * Never relies on client-side state alone.
 */
export async function queryBackendPermissions(
  supabase: SupabaseClient
): Promise<{ data: BackendPermissionsResponse | null; error: Error | null }> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    const userId = sessionData?.session?.user?.id;

    if (!token || !userId) {
      return {
        data: null,
        error: new Error('Authentication required for permission checking'),
      };
    }

    // Attempt 1: Call server API router endpoint /api/features/status
    try {
      const res = await fetch('/api/features/status', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        const json = await res.json();
        return { data: json, error: null };
      }
    } catch {
      // If server API route is unavailable (e.g. offline or client-only preview), fall back to database RPC
    }

    // Attempt 2: Direct authoritative backend RPC in PostgreSQL (check_feature_access)
    // First retrieve the authenticated profile's plan directly from the database
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', userId)
      .single();

    if (profileErr || !profile) {
      return {
        data: null,
        error: new Error(profileErr?.message || 'Failed to retrieve authoritative profile plan'),
      };
    }

    const plan = (profile.plan as PlanType) || 'free_preview';

    // Verify key features via RPC check_feature_access
    const allowedFeatures: FeatureKey[] = [];
    const lockedFeatures: FeatureKey[] = [];
    const features: Record<FeatureKey, { allowed: boolean; badge?: string }> = {} as any;

    for (const key of ALL_FEATURE_KEYS) {
      try {
        const { data: rpcRes } = await supabase.rpc('check_feature_access', {
          p_feature_key: key,
        });

        const isAllowed = rpcRes?.allowed === true;
        if (isAllowed) {
          allowedFeatures.push(key);
        } else {
          lockedFeatures.push(key);
        }

        features[key] = {
          allowed: isAllowed,
          badge: FEATURE_TIER_BADGES[key],
        };
      } catch {
        // Fallback to strict check
        lockedFeatures.push(key);
        features[key] = { allowed: false, badge: FEATURE_TIER_BADGES[key] };
      }
    }

    return {
      data: {
        userId,
        plan,
        allowedFeatures,
        lockedFeatures,
        features,
      },
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Permission check failed'),
    };
  }
}
