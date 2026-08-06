import { describe, expect, it } from 'vitest';

import { candidateCanRepairEvent } from '@/features/aggregation/connectors/ticket-platform/ticket-io-repair';
import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { needsLineupProjectionRepair } from '@/features/import/services/import-lineup-projection-repair';

describe('import lineup projection repair', () => {
  it('detects missing canonical lineup when import has structured artist names', () => {
    const record = {
      normalizedPayload: {
        title: 'LEHMANN Clubnacht w/ ÜBERREST',
        artistNames: ['ÜBERREST', 'MILA BLACK'],
      },
    } as ImportRecord;

    expect(needsLineupProjectionRepair(record, [], new Map())).toBe(true);
    expect(
      needsLineupProjectionRepair(
        record,
        ['a1', 'a2'],
        new Map([
          ['a1', { name: 'ÜBERREST' }],
          ['a2', { name: 'MILA BLACK' }],
        ]),
      ),
    ).toBe(false);
  });

  it('flags ticket.io events for repair when artistId is missing but payload has lineup', () => {
    const event = {
      id: 'evt-1',
      sourceId: 'source-ticket-io-lehmannclub',
      artistId: undefined,
    } as AdminEventRecord;
    const candidate = {
      artistNames: ['MOIA', 'GAAAS'],
    } as CanonicalImportEvent;

    expect(candidateCanRepairEvent(candidate, event)).toBe(true);
  });
});
