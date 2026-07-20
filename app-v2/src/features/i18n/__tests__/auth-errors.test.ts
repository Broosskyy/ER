import { describe, expect, it } from 'vitest';

import { AuthError } from '@supabase/supabase-js';

import { AppError } from '@/core/errors/app-error';
import {
  isEmailNotConfirmedAuthError,
  isInvalidCredentialsAuthError,
  isNetworkAuthError,
  isRateLimitAuthError,
  resolveAuthErrorTranslationKey,
  resolveSupabaseAuthErrorCode,
  translateAuthError,
} from '@/features/i18n/auth-errors';

const translate = (key: string) => key;

describe('auth error mapping', () => {
  it('maps email_not_confirmed by Supabase error code', () => {
    const cause = new AuthError('Email not confirmed', 400, 'email_not_confirmed');
    const error = new AppError('Login failed.', { code: 'UNAUTHORIZED', cause });

    expect(resolveSupabaseAuthErrorCode(error)).toBe('email_not_confirmed');
    expect(isEmailNotConfirmedAuthError(error)).toBe(true);
    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.emailNotConfirmed');
    expect(resolveAuthErrorTranslationKey(error)).not.toBe('auth.errors.invalidCredentials');
  });

  it('maps email_not_confirmed from localized message fallback', () => {
    const cause = new AuthError('E-Mail-Adresse nicht bestätigt', 400);
    const error = new AppError('Login failed.', { code: 'UNAUTHORIZED', cause });

    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.emailNotConfirmed');
  });

  it('maps invalid_credentials by Supabase error code', () => {
    const cause = new AuthError('Invalid login credentials', 400, 'invalid_credentials');
    const error = new AppError('Login failed.', { code: 'UNAUTHORIZED', cause });

    expect(isInvalidCredentialsAuthError(error)).toBe(true);
    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.invalidCredentials');
  });

  it('maps network errors', () => {
    const cause = new AuthError('Failed to fetch', 0, 'unexpected_failure');
    Object.defineProperty(cause, 'name', { value: 'AuthRetryableFetchError' });
    const error = new AppError('Failed to fetch', { code: 'NETWORK', cause });

    expect(isNetworkAuthError(error)).toBe(true);
    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.network');
  });

  it('maps rate limit errors', () => {
    const cause = new AuthError('Too many requests', 429, 'over_request_rate_limit');
    const error = new AppError('Too many requests', { code: 'VALIDATION', cause });

    expect(isRateLimitAuthError(error)).toBe(true);
    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.rateLimit');
  });

  it('maps supabase user_already_exists validation errors', () => {
    const cause = new AuthError('User already registered', 400, 'user_already_exists');
    const error = new AppError('Registration failed.', { code: 'VALIDATION', cause });
    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.emailAlreadyRegistered');
    expect(translateAuthError(error, translate)).toBe('auth.errors.emailAlreadyRegistered');
  });

  it('maps unauthorized AppError without cause to invalid credentials', () => {
    const error = new AppError('Invalid email or password.', { code: 'UNAUTHORIZED' });
    expect(resolveAuthErrorTranslationKey(error)).toBe('auth.errors.invalidCredentials');
  });

  it('falls back to generic errors', () => {
    expect(resolveAuthErrorTranslationKey(new Error('boom'))).toBe('auth.errors.generic');
  });
});
