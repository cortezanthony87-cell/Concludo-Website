import { ErrorTaxonomyCategory, NormalizedError } from './types';

/**
 * Maps raw system, HTTP, or provider errors into Concludo's normalized 15-category taxonomy.
 */
export function normalizeWorkflowError(rawError: any, context?: { action?: string; provider?: string }): NormalizedError {
  const message = rawError?.message || (typeof rawError === 'string' ? rawError : 'Unknown error occurred');
  const status = rawError?.status || rawError?.statusCode || 0;

  // 1. DUPLICATE_EVENT / Idempotency
  if (
    message.includes('idempotency') ||
    message.includes('already processed') ||
    message.includes('duplicate key') ||
    message.includes('unique constraint')
  ) {
    return {
      category: 'DUPLICATE_EVENT',
      isRetryable: false,
      code: 'ERR_DUPLICATE_EVENT',
      plainLanguage: 'This event has already been processed, so Concludo did not create it again.',
      technicalDetails: message,
    };
  }

  // 2. PERMISSION_ERROR
  if (status === 403 || message.includes('Permission Denied') || message.includes('unauthorized') || message.includes('forbidden')) {
    return {
      category: 'PERMISSION_ERROR',
      isRetryable: false,
      code: 'ERR_PERMISSION_DENIED',
      plainLanguage: 'You do not have permission to perform this workflow action.',
      technicalDetails: message,
    };
  }

  // 3. AUTHENTICATION_ERROR
  if (status === 401 || message.includes('invalid_token') || message.includes('token expired') || message.includes('unauthenticated')) {
    return {
      category: 'AUTHENTICATION_ERROR',
      isRetryable: false,
      code: 'ERR_AUTH_EXPIRED',
      plainLanguage: `The connection to ${context?.provider || 'the external service'} requires re-authentication.`,
      technicalDetails: message,
    };
  }

  // 4. RATE_LIMIT_ERROR
  if (status === 429 || message.includes('rate limit') || message.includes('too many requests') || message.includes('throttled')) {
    return {
      category: 'RATE_LIMIT_ERROR',
      isRetryable: true,
      code: 'ERR_RATE_LIMITED',
      plainLanguage: `The application reached its current request limit. Concludo paused execution and will resume safely.`,
      technicalDetails: message,
    };
  }

  // 5. OUTCOME_UNCERTAIN
  if (
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('socket hang up') ||
    message.includes('outcome uncertain') ||
    message.includes('network failure after write')
  ) {
    return {
      category: 'OUTCOME_UNCERTAIN',
      isRetryable: false,
      code: 'ERR_OUTCOME_UNCERTAIN',
      plainLanguage: 'The request was dispatched, but the network connection was interrupted before Concludo received the result. A reconciliation check is underway.',
      technicalDetails: message,
      reconciliationRequired: true,
    };
  }

  // 6. TIMEOUT_ERROR
  if (message.includes('timeout') || message.includes('timed out') || status === 504) {
    return {
      category: 'TIMEOUT_ERROR',
      isRetryable: true,
      code: 'ERR_TIMEOUT',
      plainLanguage: 'The external application took too long to respond.',
      technicalDetails: message,
    };
  }

  // 7. TRANSIENT_PROVIDER_ERROR
  if (status === 502 || status === 503 || message.includes('Service Unavailable') || message.includes('Bad Gateway')) {
    return {
      category: 'TRANSIENT_PROVIDER_ERROR',
      isRetryable: true,
      code: 'ERR_PROVIDER_UNAVAILABLE',
      plainLanguage: `This application is temporarily unavailable. Concludo has paused calls to prevent repeated failures.`,
      technicalDetails: message,
    };
  }

  // 8. POLICY_ERROR
  if (message.includes('policy') || message.includes('SSRF') || message.includes('governance')) {
    return {
      category: 'POLICY_ERROR',
      isRetryable: false,
      code: 'ERR_POLICY_VIOLATION',
      plainLanguage: 'This action was blocked by an organizational governance policy.',
      technicalDetails: message,
    };
  }

  // 9. VALIDATION_ERROR
  if (message.includes('validation') || message.includes('invalid schema') || message.includes('missing required')) {
    return {
      category: 'VALIDATION_ERROR',
      isRetryable: false,
      code: 'ERR_VALIDATION_FAILED',
      plainLanguage: 'The information provided did not match the expected format.',
      technicalDetails: message,
    };
  }

  // Default INTERNAL_ERROR
  return {
    category: 'INTERNAL_ERROR',
    isRetryable: false,
    code: 'ERR_INTERNAL',
    plainLanguage: 'An unexpected internal error occurred while executing this step.',
    technicalDetails: message,
  };
}
