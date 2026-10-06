import { describe, expect, it } from 'vitest';

import { resolveAccountCapabilities } from '@/features/profile/account-capability-resolver';

describe('resolveAccountCapabilities', () => {
  it('shows guest labels for unauthenticated users', () => {
    const capabilities = resolveAccountCapabilities({
      isAuthenticated: false,
      hasLinkedOrganizerProfile: false,
      displayName: 'Rave Guest',
    });

    expect(capabilities.role).toBe('guest');
    expect(capabilities.handleOrTypeLabel).toBe('Gast');
    expect(capabilities.canManageOrganizerProfile).toBe(false);
  });

  it('shows platform owner truthfully and hides organizer management without a linked profile', () => {
    const capabilities = resolveAccountCapabilities({
      isAuthenticated: true,
      email: 'admin@eternalrave.app',
      role: 'owner',
      displayName: 'Rave Guest',
      hasLinkedOrganizerProfile: false,
    });

    expect(capabilities.role).toBe('owner');
    expect(capabilities.isPlatformOwner).toBe(true);
    expect(capabilities.handleOrTypeLabel).toBe('Platform Owner');
    expect(capabilities.displayName).not.toBe('Rave Guest');
    expect(capabilities.canManageOrganizerProfile).toBe(false);
  });

  it('exposes organizer management only for a real linked organizer profile', () => {
    const capabilities = resolveAccountCapabilities({
      isAuthenticated: true,
      email: 'user@eternalrave.app',
      displayName: 'Manuel',
      username: 'manuel',
      hasLinkedOrganizerProfile: true,
    });

    expect(capabilities.role).toBe('user');
    expect(capabilities.canManageOrganizerProfile).toBe(true);
    expect(capabilities.handleOrTypeLabel).toBe('@manuel');
  });
});
