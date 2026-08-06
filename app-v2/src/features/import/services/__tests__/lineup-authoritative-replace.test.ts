import { describe, expect, it } from 'vitest';

import type { ImportRecord } from '@/features/import/models/types';
import { shouldAuthoritativeStructuredLineupReplace } from '@/features/import/services/lineup-authoritative-replace';

describe('authoritative structured lineup replace', () => {
  it('replaces canonical when import has fewer structured artists than canonical extras', () => {
    const record = {
      normalizedPayload: {
        artistNames: ['ASL∅', 'ANNX', 'BLACK ZUSHI'],
        sourceMetadata: {
          lineupEntries: [{ displayName: 'ASL∅', source: 'html_lineup' }],
        },
      },
    } as ImportRecord;

    const artistsById = new Map([
      ['a1', { name: 'ASL∅' }],
      ['a2', { name: 'ANNX' }],
      ['a3', { name: 'HYPNO TIZED' }],
      ['a4', { name: 'STIMU LATE' }],
    ]);

    expect(
      shouldAuthoritativeStructuredLineupReplace(
        record,
        { names: ['ASL∅', 'ANNX', 'BLACK ZUSHI'], source: 'structured', completeness: 'full' },
        ['a1', 'a2', 'a3', 'a4'],
        artistsById,
      ),
    ).toBe(true);
  });

  it('does not replace when canonical matches structured import', () => {
    const record = {
      normalizedPayload: {
        artistNames: ['LEVI'],
        sourceMetadata: {
          lineupEntries: [{ displayName: 'LEVI', source: 'html_lineup' }],
        },
      },
    } as ImportRecord;

    const artistsById = new Map([['a1', { name: 'LEVI' }]]);

    expect(
      shouldAuthoritativeStructuredLineupReplace(
        record,
        { names: ['LEVI'], source: 'structured', completeness: 'full' },
        ['a1'],
        artistsById,
      ),
    ).toBe(false);
  });
});
