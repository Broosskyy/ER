import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockExchangeCodeForSession = vi.fn();
const mockGetSession = vi.fn();
const mockResend = vi.fn();
const mockResetPasswordForEmail = vi.fn();
const mockSignUp = vi.fn();

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({
    auth: {
      exchangeCodeForSession: mockExchangeCodeForSession,
      getSession: mockGetSession,
      resend: mockResend,
      resetPasswordForEmail: mockResetPasswordForEmail,
      signUp: mockSignUp,
      updateUser: vi.fn(),
    },
  }),
}));

import { featureFlags } from '@/core/config/feature-flags';
import { authService } from '@/services/supabase/auth-service';

describe('authService callback and resend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(featureFlags, 'useSupabase', { value: true, configurable: true });
    process.env.EXPO_PUBLIC_WEB_BASE_URL = 'https://www.eternalrave.test';
    vi.stubGlobal('document', { title: 'test' });
  });

  it('exchanges callback codes for a session once', async () => {
    mockExchangeCodeForSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-1', email: 'user@test.com', app_metadata: {} },
        },
      },
      error: null,
    });

    const result = await authService.handleAuthCallback({
      code: 'callback-code',
      returnTo: '/profile',
    });

    expect(mockExchangeCodeForSession).toHaveBeenCalledWith('callback-code');
    expect(result.session?.user.email).toBe('user@test.com');
    expect(result.flow).toBeNull();
  });

  it('falls back to getSession when detectSessionInUrl already established a session', async () => {
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
          user: { id: 'user-1', email: 'user@test.com', app_metadata: {} },
        },
      },
      error: null,
    });

    const result = await authService.handleAuthCallback({ returnTo: '/profile' });

    expect(mockExchangeCodeForSession).not.toHaveBeenCalled();
    expect(mockGetSession).toHaveBeenCalledTimes(1);
    expect(result.session?.user.email).toBe('user@test.com');
  });

  it('resends signup confirmation emails through Supabase', async () => {
    mockResend.mockResolvedValue({ error: null });

    await authService.resendConfirmationEmail('user@test.com');

    expect(mockResend).toHaveBeenCalledWith({
      type: 'signup',
      email: 'user@test.com',
      options: {
        emailRedirectTo: 'https://www.eternalrave.test/auth/callback?type=signup',
      },
    });
  });

  it('sends password reset emails with recovery callback redirect', async () => {
    mockResetPasswordForEmail.mockResolvedValue({ error: null });

    await authService.resetPasswordForEmail('user@test.com', '/profile');

    expect(mockResetPasswordForEmail).toHaveBeenCalledWith('user@test.com', {
      redirectTo: 'https://www.eternalrave.test/auth/callback?returnTo=%2Fprofile&type=recovery',
    });
  });
});
