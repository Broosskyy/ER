import { AuthError } from '@supabase/supabase-js';

import { AppError } from '@/core/errors/app-error';

export type AuthErrorTranslationKey =
  | 'auth.errors.invalidCredentials'
  | 'auth.errors.emailNotConfirmed'
  | 'auth.errors.invalidEmail'
  | 'auth.errors.emailAlreadyRegistered'
  | 'auth.errors.weakPassword'
  | 'auth.errors.validation'
  | 'auth.errors.network'
  | 'auth.errors.rateLimit'
  | 'auth.errors.generic';

const RATE_LIMIT_CODES = new Set([
  'over_request_rate_limit',
  'over_email_send_rate_limit',
  'over_sms_send_rate_limit',
]);

const INVALID_CREDENTIALS_CODES = new Set(['invalid_credentials', 'invalid_grant']);

const EMAIL_NOT_CONFIRMED_MESSAGE_PATTERNS = [
  /email not confirmed/i,
  /email.*not.*confirmed/i,
  /e-mail.*nicht.*bestätigt/i,
  /bestätige.*e-mail/i,
];

const INVALID_CREDENTIALS_MESSAGE_PATTERNS = [
  /invalid login credentials/i,
  /invalid credentials/i,
  /ungültige.*anmeldedaten/i,
  /e-mail oder passwort/i,
];

export function extractSupabaseAuthError(error: unknown): AuthError | null {
  if (error instanceof AuthError) {
    return error;
  }

  if (error instanceof AppError && error.cause instanceof AuthError) {
    return error.cause;
  }

  return null;
}

export function resolveSupabaseAuthErrorCode(error: unknown): string | null {
  const authError = extractSupabaseAuthError(error);
  if (authError?.code) {
    return authError.code;
  }

  if (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }

  return null;
}

function getAuthErrorMessage(error: unknown): string {
  const authError = extractSupabaseAuthError(error);
  if (authError?.message) {
    return authError.message;
  }

  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return '';
}

export function isEmailNotConfirmedAuthError(error: unknown): boolean {
  const code = resolveSupabaseAuthErrorCode(error);
  if (code === 'email_not_confirmed') {
    return true;
  }

  const message = getAuthErrorMessage(error);
  return EMAIL_NOT_CONFIRMED_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isInvalidCredentialsAuthError(error: unknown): boolean {
  const code = resolveSupabaseAuthErrorCode(error);
  if (code && INVALID_CREDENTIALS_CODES.has(code)) {
    return true;
  }

  const message = getAuthErrorMessage(error);
  return INVALID_CREDENTIALS_MESSAGE_PATTERNS.some((pattern) => pattern.test(message));
}

export function isRateLimitAuthError(error: unknown): boolean {
  const code = resolveSupabaseAuthErrorCode(error);
  return code ? RATE_LIMIT_CODES.has(code) : false;
}

export function isNetworkAuthError(error: unknown): boolean {
  if (error instanceof AppError && (error.code === 'NETWORK' || error.code === 'OFFLINE')) {
    return true;
  }

  const authError = extractSupabaseAuthError(error);
  if (authError?.name === 'AuthRetryableFetchError') {
    return true;
  }

  const message = getAuthErrorMessage(error).toLowerCase();
  return (
    message.includes('failed to fetch') ||
    message.includes('network request failed') ||
    message.includes('network error')
  );
}

export function resolveAuthErrorTranslationKey(error: unknown): AuthErrorTranslationKey {
  if (isEmailNotConfirmedAuthError(error)) {
    return 'auth.errors.emailNotConfirmed';
  }

  if (isNetworkAuthError(error)) {
    return 'auth.errors.network';
  }

  if (isRateLimitAuthError(error)) {
    return 'auth.errors.rateLimit';
  }

  if (error instanceof AppError) {
    if (error.code === 'VALIDATION') {
      if (error.cause === 'invalid_email') {
        return 'auth.errors.invalidEmail';
      }

      const supabaseCode = resolveSupabaseAuthErrorCode(error);
      if (supabaseCode === 'user_already_exists') {
        return 'auth.errors.emailAlreadyRegistered';
      }
      if (supabaseCode === 'weak_password') {
        return 'auth.errors.weakPassword';
      }
      if (isRateLimitAuthError(error)) {
        return 'auth.errors.rateLimit';
      }
      return 'auth.errors.validation';
    }

    if (error.code === 'UNAUTHORIZED') {
      if (isInvalidCredentialsAuthError(error)) {
        return 'auth.errors.invalidCredentials';
      }
      return 'auth.errors.invalidCredentials';
    }
  }

  if (isInvalidCredentialsAuthError(error)) {
    return 'auth.errors.invalidCredentials';
  }

  const supabaseCode = resolveSupabaseAuthErrorCode(error);
  if (supabaseCode === 'user_already_exists') {
    return 'auth.errors.emailAlreadyRegistered';
  }
  if (supabaseCode === 'weak_password') {
    return 'auth.errors.weakPassword';
  }

  return 'auth.errors.generic';
}

export function translateAuthError(
  error: unknown,
  translate: (key: AuthErrorTranslationKey) => string,
): string {
  return translate(resolveAuthErrorTranslationKey(error));
}
