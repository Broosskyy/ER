import { describe, expect, it } from 'vitest';

import {
  buildVenueSlugBase,
  isValidVenueSlug,
  resolveUniqueVenueSlug,
} from '@/features/venues/domain/venue-slug';
import { validateVenueInput } from '@/features/venues/domain/venue-validation';
import { findDuplicateVenue } from '@/features/venues/domain/venue-duplicate';
import type { VenueRecord } from '@/data/types/records';

const baseVenue = (overrides: Partial<VenueRecord> = {}): VenueRecord => ({
  id: 'venue-1',
  slug: 'gewoelbe',
  name: 'Gewölbe',
  street: 'Venloer Str.',
  houseNumber: '1',
  postalCode: '50672',
  city: 'Köln',
  country: 'Germany',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('venue slug helpers', () => {
  it('builds deterministic slug bases', () => {
    expect(buildVenueSlugBase('Gewölbe Club')).toBe('gew-lbe-club');
    expect(isValidVenueSlug('gewoelbe-club')).toBe(true);
  });

  it('resolves slug collisions', () => {
    expect(resolveUniqueVenueSlug('club', ['club', 'club-2'])).toBe('club-3');
  });
});

describe('venue validation', () => {
  it('requires name, city, and country', () => {
    expect(() => validateVenueInput({ name: '', city: 'Köln', country: 'Germany' })).toThrow(
      'required',
    );
  });

  it('rejects invalid coordinates', () => {
    expect(() =>
      validateVenueInput({
        name: 'Gewölbe',
        city: 'Köln',
        country: 'Germany',
        latitude: 120,
        longitude: 6,
      }),
    ).toThrow('Latitude');
  });
});

describe('venue duplicate detection', () => {
  it('detects same address duplicates', () => {
    const duplicate = findDuplicateVenue(
      {
        name: 'Different Label',
        street: 'Venloer Str.',
        houseNumber: '1',
        postalCode: '50672',
        city: 'Köln',
        country: 'Germany',
      },
      [baseVenue()],
    );

    expect(duplicate?.venue.id).toBe('venue-1');
  });

  it('allows same name in different cities', () => {
    const duplicate = findDuplicateVenue(
      {
        name: 'Arena',
        city: 'Berlin',
        country: 'Germany',
      },
      [baseVenue({ name: 'Arena', city: 'Hamburg' })],
    );

    expect(duplicate).toBeNull();
  });
});
