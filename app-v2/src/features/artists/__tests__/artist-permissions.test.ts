import { describe, expect, it } from 'vitest';

import {
  canArchiveArtists,
  canCreateArtists,
  canEditArtists,
  canPublishArtists,
  canVerifyArtists,
  canViewArtists,
} from '@/features/admin/admin-permissions';
import { resolveAdminRouteKey } from '@/features/admin/admin-route-utils';

describe('artist admin permissions', () => {
  it('allows all admin roles to view artists', () => {
    expect(canViewArtists('viewer')).toBe(true);
    expect(canViewArtists('editor')).toBe(true);
  });

  it('restricts mutations to editing roles', () => {
    expect(canCreateArtists('viewer')).toBe(false);
    expect(canEditArtists('viewer')).toBe(false);
    expect(canCreateArtists('editor')).toBe(true);
    expect(canEditArtists('editor')).toBe(true);
  });

  it('restricts publish, archive, and verify to admin roles', () => {
    expect(canPublishArtists('editor')).toBe(false);
    expect(canArchiveArtists('editor')).toBe(false);
    expect(canVerifyArtists('editor')).toBe(false);
    expect(canPublishArtists('admin')).toBe(true);
    expect(canArchiveArtists('owner')).toBe(true);
    expect(canVerifyArtists('owner')).toBe(true);
  });
});

describe('artist admin routes', () => {
  it('resolves artist list and detail routes', () => {
    expect(resolveAdminRouteKey(['admin', 'artists'])).toBe('artists');
    expect(resolveAdminRouteKey(['admin', 'artists', 'artist-1'])).toBe('artist-detail');
  });
});
