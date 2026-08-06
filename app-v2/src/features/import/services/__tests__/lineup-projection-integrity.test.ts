import { describe, expect, it } from 'vitest';

import type { ImportRecord } from '@/features/import/models/types';
import {
  assessLineupRepairNeed,
  pickBestImportRecordForLineupRepair,
} from '@/features/import/services/lineup-projection-integrity';
import { needsLineupProjectionRepair } from '@/features/import/services/import-lineup-projection-repair';

describe('lineup projection integrity', () => {
  it('repairs invalid canonical artists even when import has no lineup', () => {
    const record = {
      normalizedPayload: {
        title: 'DEBORAH DE LUCA pres by Bootshaus',
        artistNames: [],
      },
    } as ImportRecord;

    const artistsById = new Map([['a1', { name: 'by BOOTSHAUS' }]]);

    expect(assessLineupRepairNeed(record, ['a1'], artistsById)).toMatchObject({
      shouldRepair: true,
      reason: 'invalid_artists_present',
    });
  });

  it('repairs when canonical has invalid placeholder artists', () => {
    const record = {
      normalizedPayload: {
        title: 'Sommerfest',
        artistNames: ['ASL∅', 'ANNX', 'BLACK ZUSHI'],
        sourceMetadata: { lineupEntries: [{ displayName: 'ASL∅', source: 'html_lineup' }] },
      },
    } as ImportRecord;

    const artistsById = new Map([
      ['artist-title-organization-dq95oq', { name: 'Organization' }],
    ]);

    expect(assessLineupRepairNeed(record, ['artist-title-organization-dq95oq'], artistsById)).toMatchObject({
      shouldRepair: true,
      reason: 'invalid_artists_present',
    });
  });

  it('repairs when canonical lineup is partial vs structured import', () => {
    const record = {
      normalizedPayload: {
        title: 'LEHMANN Clubnacht',
        artistNames: ['MOIA', 'GAAAS', 'ÜBERREST'],
      },
    } as ImportRecord;

    const artistsById = new Map([['a1', { name: 'MOIA' }]]);
    expect(assessLineupRepairNeed(record, ['a1'], artistsById)).toMatchObject({
      shouldRepair: true,
      reason: 'partial_canonical',
    });
  });

  it('picks the richest import record for multi-origin repair', () => {
    const shortRecord = {
      id: 'short',
      normalizedPayload: { artistNames: ['MOIA'] },
    } as ImportRecord;
    const richRecord = {
      id: 'rich',
      normalizedPayload: {
        artistNames: ['MOIA', 'GAAAS', 'ÜBERREST'],
        sourceMetadata: {
          lineupEntries: [
            { displayName: 'MOIA', source: 'html_lineup' },
            { displayName: 'GAAAS', source: 'html_lineup' },
            { displayName: 'ÜBERREST', source: 'html_lineup' },
          ],
        },
      },
    } as ImportRecord;

    const picked = pickBestImportRecordForLineupRepair([shortRecord, richRecord], [], new Map());
    expect(picked?.record.id).toBe('rich');
  });

  it('does not repair when canonical already covers import names', () => {
    const record = {
      normalizedPayload: { artistNames: ['MOIA', 'GAAAS'] },
    } as ImportRecord;
    const artistsById = new Map([
      ['a1', { name: 'MOIA' }],
      ['a2', { name: 'GAAAS' }],
    ]);
    expect(needsLineupProjectionRepair(record, ['a1', 'a2'], artistsById)).toBe(false);
  });

  it('repairs when canonical has extras not in structured import', () => {
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
    ]);

    expect(assessLineupRepairNeed(record, ['a1', 'a2', 'a3'], artistsById)).toMatchObject({
      shouldRepair: true,
      reason: 'canonical_superset_of_import',
    });
  });
});
