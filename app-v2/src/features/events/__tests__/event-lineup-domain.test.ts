import { describe, expect, it } from 'vitest';

import {
  buildLineupFromMatchedArtistIds,
  derivePrimaryArtistId,
} from '@/features/events/domain/event-lineup-primary';
import { validateEventLineupInputs } from '@/features/events/domain/event-lineup-validation';
import type { ArtistRecord } from '@/data/types/records';

function artist(id: string, name: string, status: ArtistRecord['status'] = 'published'): ArtistRecord {
  const now = new Date().toISOString();
  return {
    id,
    name,
    slug: id,
    genreIds: [],
    status,
    verificationStatus: 'unverified',
    createdAt: now,
    updatedAt: now,
  };
}

describe('event lineup primary derivation', () => {
  it('uses the first headliner as primary artist', () => {
    expect(
      derivePrimaryArtistId([
        { artistId: 'a1', billingRole: 'support' },
        { artistId: 'a2', billingRole: 'headliner' },
      ]),
    ).toBe('a2');
  });

  it('falls back to the first ordered artist when no headliner exists', () => {
    expect(
      derivePrimaryArtistId([
        { artistId: 'a1', billingRole: 'support' },
        { artistId: 'a2', billingRole: 'other' },
      ]),
    ).toBe('a1');
  });

  it('returns null for an empty lineup', () => {
    expect(derivePrimaryArtistId([])).toBeNull();
  });
});

describe('event lineup validation', () => {
  const catalog = new Map([
    ['a1', artist('a1', 'Ben Klock')],
    ['a2', artist('a2', 'Dax J')],
    ['a3', artist('a3', 'Archived', 'archived')],
  ]);

  it('rejects duplicate artists', () => {
    expect(() =>
      validateEventLineupInputs(
        [
          { artistId: 'a1', billingRole: 'headliner' },
          { artistId: 'a1', billingRole: 'support' },
        ],
        catalog,
      ),
    ).toThrow('once');
  });

  it('rejects archived artists', () => {
    expect(() =>
      validateEventLineupInputs([{ artistId: 'a3', billingRole: 'headliner' }], catalog),
    ).toThrow('Archived');
  });
});

describe('import lineup builder', () => {
  it('preserves source order and defaults billing roles', () => {
    expect(buildLineupFromMatchedArtistIds(['a2', 'a1', 'a2'])).toEqual([
      { artistId: 'a2', billingRole: 'headliner' },
      { artistId: 'a1', billingRole: 'support' },
    ]);
  });
});
