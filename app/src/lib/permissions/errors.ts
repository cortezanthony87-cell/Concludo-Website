import { PermissionErrorResponse } from './types';

/**
 * Creates the exact required 403 error response format:
 * {
 *   "error": "feature_not_available",
 *   "message": "Your current plan does not include this feature.",
 *   "feature": "[featureKey]",
 *   "requiredUpgrade": true
 * }
 */
export function createFeatureForbiddenError(featureKey: string): PermissionErrorResponse {
  return {
    error: 'feature_not_available',
    message: 'Your current plan does not include this feature.',
    feature: featureKey,
    requiredUpgrade: true,
  };
}
