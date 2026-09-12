// Supabase Auth Error Translation Helper
// Maps Supabase authentication errors to user-friendly Australian English messages.

export function getAuthErrorMessage(error: unknown): string {
  if (!error) return '';

  const rawMessage = typeof error === 'string'
    ? error
    : (error as any)?.message || (error as any)?.error_description || String(error);

  const status = (error as any)?.status;
  const lower = rawMessage.toLowerCase();

  // Failed to sign in / invalid credentials
  if (
    lower.includes('invalid login credentials') ||
    lower.includes('invalid credentials') ||
    lower.includes('incorrect password') ||
    lower.includes('invalid password') ||
    lower.includes('failed to sign in')
  ) {
    return 'Incorrect email or password. Please verify your credentials and try again.';
  }

  // Failed to sign out
  if (lower.includes('failed to sign out') || lower.includes('sign out failed')) {
    return 'Failed to sign out. Please check your network connection and try again.';
  }

  // Failed to create account
  if (lower.includes('failed to create account')) {
    return 'Failed to create account. Please verify your details and try again.';
  }

  // Missing email
  if (lower.includes('missing email') || lower.includes('email is required')) {
    return 'Please enter your email address.';
  }

  // Missing password
  if (lower.includes('missing password') || lower.includes('password is required')) {
    return 'Please enter your password.';
  }

  // Invalid email
  if (
    lower.includes('invalid email') ||
    lower.includes('unable to validate email') ||
    lower.includes('invalid format') ||
    lower.includes('email address is invalid')
  ) {
    return 'Please enter a valid email address.';
  }

  // Existing account / already registered
  if (
    lower.includes('user already registered') ||
    lower.includes('already registered') ||
    lower.includes('already exists') ||
    lower.includes('email already in use') ||
    lower.includes('user with this email already exists')
  ) {
    return 'An account with this email address already exists. Please sign in or reset your password.';
  }

  // Weak password (< 8 chars or 6 chars)
  if (
    lower.includes('password should be at least') ||
    lower.includes('weak_password') ||
    lower.includes('weak password') ||
    lower.includes('password is too weak') ||
    lower.includes('at least 8 characters') ||
    lower.includes('at least 6 characters')
  ) {
    if (lower.includes('8 characters')) {
      return 'Password is too weak. Please choose a password with at least 8 characters.';
    }
    return 'Password is too weak. Please choose a password with at least 6 characters.';
  }

  // Session expired
  if (
    lower.includes('session expired') ||
    lower.includes('jwt expired') ||
    lower.includes('token expired')
  ) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  // Expired or invalid reset link / token
  if (
    lower.includes('token has expired') ||
    lower.includes('otp_expired') ||
    lower.includes('link has expired') ||
    lower.includes('expired or has expired') ||
    lower.includes('invalid or has expired') ||
    lower.includes('email link is invalid or has expired') ||
    lower.includes('auth session missing') ||
    lower.includes('session missing') ||
    lower.includes('invalid reset token')
  ) {
    return 'This password reset link is invalid or has expired. Please request a new password reset.';
  }

  // Failed to load profile / permissions
  if (lower.includes('failed to load profile') || lower.includes('profile_not_found')) {
    return 'Failed to load profile. Please refresh the page to retry.';
  }

  if (lower.includes('failed to load permissions')) {
    return 'Failed to load permissions. Please refresh the page to retry.';
  }

  // Network / server connection error
  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('connection refused') ||
    (status && status >= 500)
  ) {
    return 'Network or Supabase server connection error. Please verify your internet connection and try again.';
  }

  return rawMessage || 'An unexpected authentication error occurred. Please try again.';
}
