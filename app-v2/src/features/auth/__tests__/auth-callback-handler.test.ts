import { describe, expect, it } from 'vitest';

import {
  parseAuthCallbackParams,
  parseAuthCallbackUrl,
} from '@/features/auth/auth-callback-handler';

describe('auth callback parsing', () => {
  it('parses expo-router callback params', () => {
    expect(
      parseAuthCallbackParams({
        code: 'abc123',
        returnTo: '/profile',
        type: 'signup',
      }),
    ).toEqual({
      code: 'abc123',
      returnTo: '/profile',
      flow: 'signup',
      error: null,
      errorDescription: null,
    });
  });

  it('parses recovery callback urls', () => {
    expect(
      parseAuthCallbackUrl(
        'https://www.eternalrave.test/auth/callback?code=xyz&type=recovery&returnTo=%2Fprofile',
      ),
    ).toEqual({
      code: 'xyz',
      returnTo: '/profile',
      flow: 'recovery',
      error: null,
      errorDescription: null,
    });
  });

  it('parses callback errors from query params', () => {
    expect(
      parseAuthCallbackUrl(
        'https://www.eternalrave.test/auth/callback?error=access_denied&error_description=Denied',
      ),
    ).toMatchObject({
      code: null,
      error: 'access_denied',
      errorDescription: 'Denied',
    });
  });
});
