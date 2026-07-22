import { describe, expect, it } from 'vitest';

import type { OrganizerRecord } from '@/data/types/records';
import {
  findOrganizerDuplicateCandidates,
  findStrongOrganizerDuplicate,
  isGenericOrganizerName,
} from '@/features/organizers/domain/organizer-duplicate';
import {
  buildOrganizerSlugBase,
  isValidOrganizerSlug,
  resolveUniqueOrganizerSlug,
} from '@/features/organizers/domain/organizer-slug';
import { validateOrganizerInput } from '@/features/organizers/domain/organizer-validation';

const baseOrganizer = (overrides: Partial<OrganizerRecord> = {}): OrganizerRecord => ({
  id: 'organizer-1',
  slug: 'rave-rebels',
  name: 'Rave Rebels',
  city: 'Köln',
  country: 'Germany',
  website: 'https://raverebels.example',
  email: 'hello@raverebels.example',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('organizer slug helpers', () => {
  it('builds deterministic slug bases', () => {
    expect(buildOrganizerSlugBase('Rave Rebels')).toBe('rave-rebels');
    expect(isValidOrganizerSlug('rave-rebels')).toBe(true);
  });

  it('resolves slug collisions', () => {
    expect(resolveUniqueOrganizerSlug('collective', ['collective', 'collective-2'])).toBe(
      'collective-3',
    );
  });
});

describe('organizer validation', () => {
  it('requires a non-empty name', () => {
    expect(() => validateOrganizerInput({ name: '   ' })).toThrow('required');
  });

  it('preserves intentional capitalization', () => {
    const validated = validateOrganizerInput({ name: 'X:PLICIT' });
    expect(validated.name).toBe('X:PLICIT');
  });

  it('rejects invalid email', () => {
    expect(() => validateOrganizerInput({ name: 'Rave Rebels', email: 'not-an-email' })).toThrow(
      'Invalid email',
    );
  });
});

describe('organizer duplicate detection', () => {
  it('flags strong email duplicates', () => {
    const duplicate = findStrongOrganizerDuplicate(
      { name: 'Other Label', email: 'hello@raverebels.example' },
      [baseOrganizer()],
    );
    expect(duplicate?.reason).toBe('same_email');
  });

  it('does not treat same city only as strong duplicate', () => {
    const candidates = findOrganizerDuplicateCandidates(
      { name: 'Unique Name', city: 'Köln', country: 'Germany' },
      [baseOrganizer({ name: 'Different Name', city: 'Köln', country: 'Germany' })],
    );
    expect(candidates).toHaveLength(0);
  });

  it('skips generic organizer names for import matching', () => {
    expect(isGenericOrganizerName('TBA')).toBe(true);
    expect(isGenericOrganizerName('Rave Rebels')).toBe(false);
  });
});
