import { useMemo } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  FeatureKey,
  PlanType,
  PLAN_PERMISSIONS,
  FEATURE_TIER_BADGES,
} from './types';

export interface FeatureAccessDisplay {
  isAllowed: boolean;
  userPlan: PlanType;
  badgeLabel: string;
  isProOnly: boolean;
  isTeamOnly: boolean;
}

/**
 * Front-end helper hook to check feature availability for UI presentation only.
 * IMPORTANT: This helper is for display cues, button disabling, and badges only.
 * The backend server and database remain the sole source of truth for authorization.
 */
export function useFeatureAccess(featureKey: FeatureKey): FeatureAccessDisplay {
  const { profile } = useAuth();

  const userPlan: PlanType = (profile?.plan as PlanType) || 'free_preview';

  return useMemo(() => {
    const allowedFeatures = PLAN_PERMISSIONS[userPlan] || [];
    const isAllowed = allowedFeatures.includes(featureKey);

    const proAllowed = PLAN_PERMISSIONS.pro.includes(featureKey);
    const teamAllowed = PLAN_PERMISSIONS.team.includes(featureKey);
    const isProOnly = proAllowed && !PLAN_PERMISSIONS.starter.includes(featureKey);
    const isTeamOnly = teamAllowed && !proAllowed;

    let badgeLabel = 'Upgrade required';
    if (FEATURE_TIER_BADGES[featureKey]) {
      badgeLabel = FEATURE_TIER_BADGES[featureKey]!;
    } else if (isTeamOnly) {
      badgeLabel = 'Available on Team';
    } else if (isProOnly) {
      badgeLabel = 'Available on Pro';
    }

    return {
      isAllowed,
      userPlan,
      badgeLabel,
      isProOnly,
      isTeamOnly,
    };
  }, [userPlan, featureKey]);
}

/**
 * Pure helper function for client-side presentation without React hooks.
 */
export function checkClientFeatureDisplay(
  userPlan: PlanType | undefined,
  featureKey: FeatureKey
): { isAllowed: boolean; badgeLabel: string } {
  const plan: PlanType = userPlan || 'free_preview';
  const allowedFeatures = PLAN_PERMISSIONS[plan] || [];
  const isAllowed = allowedFeatures.includes(featureKey);

  let badgeLabel = 'Upgrade required';
  if (FEATURE_TIER_BADGES[featureKey]) {
    badgeLabel = FEATURE_TIER_BADGES[featureKey]!;
  }

  return { isAllowed, badgeLabel };
}
