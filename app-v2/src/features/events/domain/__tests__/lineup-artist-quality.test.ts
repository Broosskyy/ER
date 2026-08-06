import { describe, expect, it } from 'vitest';

import {
  isLineupPlaceholderArtist,
  pickBetterArtistNames,
  sanitizeLineupArtistNames,
} from '@/features/events/domain/lineup-artist-quality';

describe('lineup-artist-quality', () => {
  it('filters section labels and organization placeholders', () => {
    expect(isLineupPlaceholderArtist('Organization')).toBe(true);
    expect(isLineupPlaceholderArtist('Artists')).toBe(true);
    expect(isLineupPlaceholderArtist('Line-up')).toBe(true);
    expect(isLineupPlaceholderArtist('Special Guests')).toBe(true);
    expect(isLineupPlaceholderArtist('by Bootshaus')).toBe(true);
    expect(sanitizeLineupArtistNames(['Organization', 'LEVI', 'Artists'])).toEqual(['LEVI']);
  });

  it('never returns a smaller lineup when incoming is poorer', () => {
    const current = ['A', 'B', 'C'];
    const incoming = ['A'];
    expect(pickBetterArtistNames(current, incoming)).toEqual(current);
  });

  it('unions equal-length lineups with distinct artists', () => {
    expect(pickBetterArtistNames(['LEVI'], ['MOIA'])).toEqual(['LEVI', 'MOIA']);
  });

  it('prefers larger incoming lineup', () => {
    expect(pickBetterArtistNames(['LEVI'], ['LEVI', 'MOIA', 'GAAAS'])).toEqual([
      'LEVI',
      'MOIA',
      'GAAAS',
    ]);
  });
});
