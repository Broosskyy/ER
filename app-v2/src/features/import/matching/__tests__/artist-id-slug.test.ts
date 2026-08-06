import { describe, expect, it } from 'vitest';

import { capArtistIdSlug, MAX_ARTIST_ID_SLUG_LENGTH, slugifyMatchText } from '@/features/import/matching/matching-utils';
import { isLineupBlobArtistName } from '@/features/events/domain/lineup-artist-quality';

describe('artist id slug safety', () => {
  it('caps slug length for btree-safe artist ids', () => {
    const blob = 'a'.repeat(500);
    const capped = capArtistIdSlug(slugifyMatchText(blob));
    expect(capped.length).toBeLessThanOrEqual(MAX_ARTIST_ID_SLUG_LENGTH);
    expect(`artist-title-${capped}-abcdef`.length).toBeLessThan(140);
  });

  it('detects html/footer lineup blobs', () => {
    expect(
      isLineupBlobArtistName(
        'MAKLA▔▔▔▔▔▔▔▔▔▔Einlass ab 18 Jahren / Age for admission 18 years',
      ),
    ).toBe(true);
    expect(isLineupBlobArtistName('HOTBOI2300')).toBe(false);
  });
});
