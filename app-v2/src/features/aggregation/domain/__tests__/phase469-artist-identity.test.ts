import { describe, expect, it } from 'vitest';

import {
  isMinorArtistSpellingVariation,
  resolveArtistSpellingConflict,
} from '@/features/aggregation/domain/artist-identity-evidence';
import { applyArtistDisplayNameCorrection } from '@/features/import/services/artist-identity-correction';

describe('artist identity evidence', () => {
  it('detects minor spelling variation between KARAMUSTA and KARAMUSTAN', () => {
    expect(isMinorArtistSpellingVariation('KARAMUSTA', 'KARAMUSTAN')).toBe(true);
  });

  it('accepts flyer correction for minor textual typo', () => {
    const resolution = resolveArtistSpellingConflict([
      { spelling: 'KARAMUSTA', source: 'structured_text', confidence: 0.85 },
      { spelling: 'KARAMUSTAN', source: 'official_flyer', confidence: 0.92 },
    ]);
    expect(resolution.action).toBe('accept');
    expect(resolution.displayName).toBe('KARAMUSTAN');
    expect(resolution.preserveSourceSpelling).toBe('KARAMUSTA');
  });

  it('routes non-minor conflicts to review', () => {
    const resolution = resolveArtistSpellingConflict([
      { spelling: 'ARTIST A', source: 'structured_text', confidence: 0.85 },
      { spelling: 'COMPLETELY DIFFERENT', source: 'official_flyer', confidence: 0.92 },
    ]);
    expect(resolution.action).toBe('review');
  });
});

describe('artist display name correction', () => {
  it('renames display name and preserves source spelling alias', async () => {
    const aliases: unknown[] = [];
    const result = await applyArtistDisplayNameCorrection({
      artist: {
        id: 'art-1',
        name: 'KARAMUSTA',
        slug: 'karamusta',
        cityId: 'cologne',
        createdAt: '',
        updatedAt: '',
      },
      nextDisplayName: 'KARAMUSTAN',
      preserveSourceSpelling: 'KARAMUSTA',
      saveArtist: async (artist) => artist,
      saveAlias: (alias) => {
        aliases.push(alias);
      },
    });

    expect(result.updated).toBe(true);
    expect(result.nextName).toBe('KARAMUSTAN');
    expect(aliases).toHaveLength(1);
  });
});
