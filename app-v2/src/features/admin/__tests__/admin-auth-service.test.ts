import { beforeEach, describe, expect, it, vi } from 'vitest';

import { featureFlags } from '@/core/config/feature-flags';
import { authService } from '@/services/supabase/auth-service';

describe('authService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('signs in with local credentials in mock mode', async () => {
    const original = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });

    const session = await authService.signIn('admin@eternalrave.app', 'admin-local-dev');
    expect(session.user.email).toBe('admin@eternalrave.app');
    expect(session.role).toBe('owner');

    const restored = await authService.getSession();
    expect(restored?.accessToken).toBe('local-token');

    await authService.signOut();
    expect(await authService.getSession()).toBeNull();

    Object.defineProperty(featureFlags, 'useSupabase', { value: original, configurable: true });
  });

  it('rejects invalid local credentials', async () => {
    const original = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });

    await expect(authService.signIn('wrong@test.com', 'bad-password')).rejects.toThrow(
      'Invalid email or password.',
    );

    Object.defineProperty(featureFlags, 'useSupabase', { value: original, configurable: true });
  });

  it('returns no-op unsubscribe for local auth state listener', () => {
    const original = featureFlags.useSupabase;
    Object.defineProperty(featureFlags, 'useSupabase', { value: false, configurable: true });

    const callback = vi.fn();
    const unsubscribe = authService.onAuthStateChange(callback);
    expect(typeof unsubscribe).toBe('function');
    unsubscribe();

    Object.defineProperty(featureFlags, 'useSupabase', { value: original, configurable: true });
  });
});
