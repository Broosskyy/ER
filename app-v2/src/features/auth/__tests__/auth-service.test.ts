import { beforeEach, describe, expect, it, vi } from 'vitest';

import { featureFlags } from '@/core/config/feature-flags';
import { authService } from '@/services/supabase/auth-service';

describe('authService consumer mock credentials', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await authService.signOut();
  });

  it('signs in with local consumer credentials without admin role', async () => {
    const original = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });

    const session = await authService.signIn('user@eternalrave.app', 'user-local-dev');
    expect(session.user.email).toBe('user@eternalrave.app');
    expect(session.role).toBeUndefined();

    await authService.signOut();
    Object.defineProperty(featureFlags, 'useSupabase', { value: original, configurable: true });
  });
});

describe('authService signUp', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await authService.signOut();
  });

  it('creates a local consumer account without admin role', async () => {
    const original = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });

    const result = await authService.signUp('new.user@eternalrave.app', 'new-local-dev');
    expect(result.emailConfirmationRequired).toBe(false);
    expect(result.session?.user.email).toBe('new.user@eternalrave.app');
    expect(result.session?.role).toBeUndefined();

    const restored = await authService.getSession();
    expect(restored?.user.email).toBe('new.user@eternalrave.app');

    await authService.signOut();
    Object.defineProperty(featureFlags, 'useSupabase', { value: original, configurable: true });
  });

  it('rejects duplicate local sign-up for reserved accounts', async () => {
    const original = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });

    await expect(
      authService.signUp('admin@eternalrave.app', 'another-password'),
    ).rejects.toThrow('An account with this email already exists.');

    Object.defineProperty(featureFlags, 'useSupabase', { value: original, configurable: true });
  });
});
