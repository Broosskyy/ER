import { describe, expect, it } from 'vitest';

import type { OrganizerProfileRecord } from '@/features/organizer-profile/types/organizer-profile';
import {
  buildOrganizerProfileCompletion,
  calculateOrganizerProfileCompletion,
} from '@/features/organizer-profile/utils/organizer-profile-completion';

function profile(overrides: Partial<OrganizerProfileRecord> = {}): OrganizerProfileRecord {
  return {
    id: 'org-1',
    userId: 'user-1',
    name: '',
    description: '',
    location: '',
    website: '',
    contactEmail: '',
    contactPhone: '',
    socialLinks: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('organizer profile completion', () => {
  it('returns zero percent for an empty profile', () => {
    expect(calculateOrganizerProfileCompletion(profile())).toBe(0);
  });

  it('returns one hundred percent for a complete profile', () => {
    expect(
      calculateOrganizerProfileCompletion(
        profile({
          name: 'VOID Events',
          description: 'Underground Kollektiv',
          location: 'Köln',
          website: 'https://voidevents.de',
          contactEmail: 'hello@voidevents.de',
          logoUri: 'https://example.com/logo.png',
          bannerUri: 'https://example.com/banner.png',
          socialLinks: [{ id: 'ig', platform: 'instagram', url: 'https://instagram.com/voidevents' }],
        }),
      ),
    ).toBe(100);
  });

  it('builds completion view model with open items', () => {
    const completion = buildOrganizerProfileCompletion(profile({ name: 'VOID Events' }));
    expect(completion.percent).toBeGreaterThan(0);
    expect(completion.openItems.length).toBeGreaterThan(0);
    expect(completion.ctaLabel).toBe('Profil vervollständigen');
  });
});
