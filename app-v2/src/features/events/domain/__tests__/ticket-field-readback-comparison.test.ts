import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { mapEventRowToAdminRecord, mapAdminRecordToEventRow, type EventRow } from '@/data/mappers/event-mapper';
import {
  compareCanonicalTicketSnapshotSemantically,
  strictTicketSnapshotEqual,
  type CanonicalTicketFieldSnapshot,
} from '@/features/events/domain/ticket-field-readback-comparison';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';

const replay = JSON.parse(
  readFileSync(join(process.cwd(), '.tmp/bootshaus-ticketio-offline-replay-result.json'), 'utf8'),
) as {
  sevenMatrix: Array<{
    eventId: string;
    goldenAfter: CanonicalTicketFieldSnapshot;
    dbBefore: CanonicalTicketFieldSnapshot;
  }>;
};

const loonylandGoldenAfter = replay.sevenMatrix[0]!.goldenAfter;

function adminTicketSnapshot(row: EventRow): CanonicalTicketFieldSnapshot {
  const admin = mapEventRowToAdminRecord(row);
  return {
    ticketUrl: admin.ticketUrl ?? null,
    priceText: admin.priceText ?? null,
    ticketStatus: admin.ticketStatus ?? null,
    ticketPhases: admin.ticketPhases ?? null,
  };
}

function simulateWriterReaderRoundtrip(goldenAfter: CanonicalTicketFieldSnapshot): CanonicalTicketFieldSnapshot {
  const row = {
    id: 'evt-1785339382025-cazpz3d',
    title: 'LOONYLAND',
    status: 'published',
    start_date: '2026-08-21T20:00:00+00:00',
    ticket_url: goldenAfter.ticketUrl,
    price_text: goldenAfter.priceText,
    ticket_status: goldenAfter.ticketStatus,
    ticket_phases: goldenAfter.ticketPhases,
  } as EventRow;
  const admin = mapEventRowToAdminRecord(row);
  const persisted = mapAdminRecordToEventRow(admin);
  return adminTicketSnapshot(persisted);
}

function reorderPhaseKeys(phases: CanonicalTicketPhase[]): CanonicalTicketPhase[] {
  return phases.map((phase) => {
    const reordered: Record<string, unknown> = {};
    for (const key of Object.keys(phase).sort()) {
      reordered[key] = phase[key as keyof CanonicalTicketPhase];
    }
    return reordered as CanonicalTicketPhase;
  });
}

describe('ticket field readback comparison', () => {
  it('reproduces Loonyland writer→reader roundtrip as semantically equal', () => {
    const actual = simulateWriterReaderRoundtrip(loonylandGoldenAfter);
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(true);
    expect(result.materialDifferences).toEqual([]);
  });

  it('fails strict JSON compare when JSONB reorders phase property keys', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketPhases: reorderPhaseKeys(loonylandGoldenAfter.ticketPhases ?? []),
    };
    expect(strictTicketSnapshotEqual(loonylandGoldenAfter, actual)).toBe(false);
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(true);
    expect(result.materialDifferences).toEqual([]);
    expect(result.normalizedDifferences.length).toBeGreaterThan(0);
  });

  it('treats null and undefined optional ticketPhases as equal', () => {
    const expected: CanonicalTicketFieldSnapshot = {
      ticketUrl: loonylandGoldenAfter.ticketUrl,
      priceText: null,
      ticketStatus: null,
      ticketPhases: null,
    };
    const actual: CanonicalTicketFieldSnapshot = {
      ticketUrl: loonylandGoldenAfter.ticketUrl,
      priceText: undefined,
      ticketStatus: undefined,
      ticketPhases: undefined,
    };
    const result = compareCanonicalTicketSnapshotSemantically(expected, actual);
    expect(result.equal).toBe(true);
  });

  it('accepts trailing-slash URL normalization', () => {
    const expected: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7',
    };
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
    };
    const result = compareCanonicalTicketSnapshotSemantically(expected, actual);
    expect(result.equal).toBe(true);
  });

  it('rejects a different price', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketPhases: [
        {
          ...(loonylandGoldenAfter.ticketPhases?.[0] as CanonicalTicketPhase),
          priceAmount: 19.9,
          priceLabel: 'ab 19,90 €',
        },
      ],
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
    expect(result.materialDifferences.some((diff) => diff.path.includes('priceAmount'))).toBe(true);
  });

  it('rejects a different currency', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketPhases: [
        {
          ...(loonylandGoldenAfter.ticketPhases?.[0] as CanonicalTicketPhase),
          priceCurrency: 'USD',
        },
      ],
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('rejects a different concrete ticket URL', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketUrl: 'https://bootshaus-club.ticket.io/OtherSlug/',
      ticketPhases: [
        {
          ...(loonylandGoldenAfter.ticketPhases?.[0] as CanonicalTicketPhase),
          purchaseUrl: 'https://bootshaus-club.ticket.io/OtherSlug/',
        },
      ],
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('rejects shop root instead of event URL', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketUrl: 'https://bootshaus-club.ticket.io/',
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('rejects a missing phase', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketPhases: [],
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('rejects an additional phase', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketPhases: [
        ...(loonylandGoldenAfter.ticketPhases ?? []),
        {
          id: 'phase-parking',
          name: 'Parking',
          kind: 'other',
          sortOrder: 901,
          priceAmount: 5,
          priceCurrency: 'EUR',
          priceLabel: 'ab 5,00 €',
          soldOut: false,
          isFree: false,
          purchaseUrl: 'https://bootshaus-club.ticket.io/parking/',
        },
      ],
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('rejects add-on instead of admission', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketPhases: [
        {
          id: 'phase-parking-addon',
          name: 'Parking',
          kind: 'vip',
          sortOrder: 900,
          priceAmount: 5,
          priceCurrency: 'EUR',
          priceLabel: 'ab 5,00 €',
          soldOut: false,
          isFree: false,
          purchaseUrl: 'https://bootshaus-club.ticket.io/tA3dBrv7/',
        },
      ],
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('rejects a different sales status', () => {
    const actual: CanonicalTicketFieldSnapshot = {
      ...loonylandGoldenAfter,
      ticketStatus: 'external_link',
    };
    const result = compareCanonicalTicketSnapshotSemantically(loonylandGoldenAfter, actual);
    expect(result.equal).toBe(false);
  });

  it('accepts golden after for all seven offline replay cases', () => {
    for (const row of replay.sevenMatrix) {
      const actual = simulateWriterReaderRoundtrip(row.goldenAfter);
      const result = compareCanonicalTicketSnapshotSemantically(row.goldenAfter, actual);
      expect(result.equal, row.eventId).toBe(true);
    }
  });

  it('does not treat rollback before as golden after', () => {
    const before = replay.sevenMatrix[0]!.dbBefore;
    const after = replay.sevenMatrix[0]!.goldenAfter;
    const result = compareCanonicalTicketSnapshotSemantically(after, before);
    expect(result.equal).toBe(false);
    expect(result.materialDifferences.length).toBeGreaterThan(0);
  });
});
