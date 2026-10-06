import { describe, expect, it } from 'vitest';

import {
  expandGenreKeysForSearch,
  getGenreTaxonomyNode,
  resolveSearchQueryToGenreKey,
} from '../genre-taxonomy';

describe('genre taxonomy', () => {
  it('resolves hard techno query to hardtechno key', () => {
    expect(resolveSearchQueryToGenreKey('Hard Techno')).toBe('hardtechno');
  });

  it('expands techno search to include hard techno descendants', () => {
    const expanded = expandGenreKeysForSearch('techno');
    expect(expanded.has('techno')).toBe(true);
    expect(expanded.has('hardtechno')).toBe(true);
    expect(expanded.has('house')).toBe(false);
  });

  it('exposes parent hierarchy for tech house', () => {
    const node = getGenreTaxonomyNode('tech-house');
    expect(node?.parentGenreKey).toBe('house');
  });
});
