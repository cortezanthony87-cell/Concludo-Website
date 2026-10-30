import { SupabaseClient } from '@supabase/supabase-js';
import {
  FeatureKey,
  PlanType,
  ALL_FEATURE_KEYS,
  FEATURE_TIER_BADGES,
  PLAN_PERMISSIONS,
} from './types';

export interface BackendPermissionsResponse {
  userId: string;
  plan: PlanType;
  allowedFeatures: FeatureKey[];
  lockedFeatures: FeatureKey[];
  features: Record<FeatureKey, { allowed: boolean; badge?: string }>;
}

const permissionsCache = new Map<string, { data: BackendPermissionsResponse; timestamp: number }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

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

    // Return from in-memory cache if available and fresh
    const cached = permissionsCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      return { data: cached.data, error: null };
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
        permissionsCache.set(userId, { data: json, timestamp: Date.now() });
        return { data: json, error: null };
      }
    } catch {
      // If server API route is unavailable (e.g. offline or client-only preview), fall back to database RPC
    }

    // Attempt 2: Direct authoritative backend lookup for authenticated profile's plan in PostgreSQL
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
    const planAllowedList = PLAN_PERMISSIONS[plan] || [];

    const allowedFeatures: FeatureKey[] = [];
    const lockedFeatures: FeatureKey[] = [];
    const features: Record<FeatureKey, { allowed: boolean; badge?: string }> = {} as any;

    for (const key of ALL_FEATURE_KEYS) {
      const isAllowed = planAllowedList.includes(key);
      if (isAllowed) {
        allowedFeatures.push(key);
      } else {
        lockedFeatures.push(key);
      }

      features[key] = {
        allowed: isAllowed,
        badge: FEATURE_TIER_BADGES[key],
      };
    }

    const resultData: BackendPermissionsResponse = {
      userId,
      plan,
      allowedFeatures,
      lockedFeatures,
      features,
    };
    permissionsCache.set(userId, { data: resultData, timestamp: Date.now() });

    return {
      data: resultData,
      error: null,
    };
  } catch (err) {
    return {
      data: null,
      error: err instanceof Error ? err : new Error('Permission check failed'),
    };
  }
}
