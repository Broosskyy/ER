import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  PROFILE_ADMIN_ROUTE,
  getProfileAdminHref,
  shouldShowProfileAdminLink,
} from '@/features/profile/profile-screen-utils';
import type { AuthSession } from '@/services/supabase/auth-service';

const profileScreenPath = path.resolve(__dirname, '../../../../app/(tabs)/profile.tsx');

function sessionWithRole(role: string): AuthSession {
  return {
    user: { id: 'user-1', email: 'user@test.com' },
    accessToken: 'token',
    role,
  };
}

describe('profile screen utils', () => {
  it('shows the admin link for authorized CMS users', () => {
    expect(shouldShowProfileAdminLink(sessionWithRole('editor'))).toBe(true);
    expect(getProfileAdminHref(sessionWithRole('owner'))).toBe(PROFILE_ADMIN_ROUTE);
  });

  it('hides the admin link for unauthorized users', () => {
    expect(shouldShowProfileAdminLink(null)).toBe(false);
    expect(shouldShowProfileAdminLink(sessionWithRole('guest'))).toBe(false);
    expect(getProfileAdminHref(null)).toBeNull();
  });

  it('points the admin link to /admin', () => {
    expect(PROFILE_ADMIN_ROUTE).toBe('/admin');
  });
});

describe('profile screen scrolling', () => {
  it('uses a vertical ScrollView for overflowing profile content', () => {
    const source = readFileSync(profileScreenPath, 'utf8');

    expect(source).toContain('ScrollView');
    expect(source).toContain('testID={PROFILE_SCROLL_TEST_ID}');
    expect(source).toContain('flexGrow: 1');
  });
});
