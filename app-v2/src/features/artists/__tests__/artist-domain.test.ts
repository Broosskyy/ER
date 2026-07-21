import { describe, expect, it } from 'vitest';

import {
  buildArtistSlugBase,
  isValidArtistSlug,
  resolveUniqueArtistSlug,
} from '@/features/artists/domain/artist-slug';
import {
  assertValidArtistLifecycleTransition,
  requiresPrivilegedArtistLifecycleTransition,
} from '@/features/artists/domain/artist-status-transitions';
import {
  normalizeArtistNameForComparison,
  validateArtistInput,
} from '@/features/artists/domain/artist-validation';

describe('artist slug helpers', () => {
  it('builds a readable slug from artist names', () => {
    expect(buildArtistSlugBase('Charlotte de Witte')).toBe('charlotte-de-witte');
  });

  it('resolves slug collisions deterministically', () => {
    expect(resolveUniqueArtistSlug('dax-j', ['dax-j'])).toBe('dax-j-2');
    expect(resolveUniqueArtistSlug('dax-j', ['dax-j', 'dax-j-2'])).toBe('dax-j-3');
  });

  it('validates slug format', () => {
    expect(isValidArtistSlug('amelie-lens')).toBe(true);
    expect(isValidArtistSlug('Amelie Lens')).toBe(false);
  });
});

describe('artist validation', () => {
  it('accepts a valid artist payload', () => {
    const result = validateArtistInput({
      name: 'Ben Klock',
      website: 'https://benklock.com',
      status: 'draft',
      verificationStatus: 'unverified',
    });

    expect(result.name).toBe('Ben Klock');
    expect(result.website).toBe('https://benklock.com/');
  });

  it('rejects missing names', () => {
    expect(() => validateArtistInput({ name: '   ' })).toThrow('Artist name is required.');
  });

  it('rejects invalid URLs', () => {
    expect(() =>
      validateArtistInput({
        name: 'Test Artist',
        instagram: 'javascript:alert(1)',
      }),
    ).toThrow('Invalid URL');
  });

  it('normalizes names for duplicate comparison without rewriting stage casing', () => {
    expect(normalizeArtistNameForComparison('  DVS1 ')).toBe('dvs1');
    expect(normalizeArtistNameForComparison('I Hate Models')).toBe('i hate models');
  });
});

describe('artist lifecycle transitions', () => {
  it('allows draft to published and archived', () => {
    expect(() => assertValidArtistLifecycleTransition('draft', 'published')).not.toThrow();
    expect(() => assertValidArtistLifecycleTransition('draft', 'archived')).not.toThrow();
  });

  it('blocks invalid transitions', () => {
    expect(() => assertValidArtistLifecycleTransition('archived', 'published')).toThrow();
  });

  it('flags privileged transitions', () => {
    expect(requiresPrivilegedArtistLifecycleTransition('draft', 'published')).toBe(true);
    expect(requiresPrivilegedArtistLifecycleTransition('draft', 'draft')).toBe(false);
  });
});
