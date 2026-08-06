import { describe, expect, it } from 'vitest';

import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';

describe('canonical genre normalizer', () => {
  it('normalizes aliases to canonical labels', () => {
    expect(normalizeCanonicalGenreLabels(['tech house', 'TECHNO', 'dnb'])).toEqual([
      'Tech House',
      'Techno',
      'DnB',
    ]);
  });
});
