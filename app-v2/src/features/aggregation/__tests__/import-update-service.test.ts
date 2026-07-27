import { describe, expect, it } from 'vitest';

import { ImportUpdateService } from '@/features/aggregation/services/import-update-service';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';

function candidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'evt-1',
    sourceId: 'source-1',
    sourceName: 'Club Feed',
    title: 'Warehouse Night',
    description: 'Original description',
    startDate: '2026-08-01T20:00:00.000Z',
    venueName: 'Tresor',
    cityName: 'Berlin',
    rawSourceType: 'json_ld',
    ...overrides,
  };
}

function existingEvent(): AdminEventRecord {
  return {
    id: 'evt-existing',
    title: 'Warehouse Night',
    description: 'Original description',
    startDate: '2026-08-01T20:00:00.000Z',
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

describe('import update service', () => {
  it('detects created events', () => {
    const service = new ImportUpdateService();
    expect(service.detectChanges(candidate()).changeType).toBe('created');
  });

  it('detects updated fields', () => {
    const service = new ImportUpdateService();
    const result = service.detectChanges(
      candidate({ description: 'Updated description', ticketUrl: 'https://tickets.example/new' }),
      existingEvent(),
    );
    expect(result.changeType).toBe('updated');
    expect(result.changedFields).toContain('description');
    expect(result.changedFields).toContain('ticketUrl');
  });

  it('detects cancelled source events', () => {
    const service = new ImportUpdateService();
    expect(service.detectChanges(candidate(), existingEvent(), { cancelled: true }).changeType).toBe(
      'cancelled',
    );
  });

  it('finds missing external ids for archive handling', () => {
    const service = new ImportUpdateService();
    expect(service.findMissingExternalIds(['a', 'b', 'c'], ['a', 'c'])).toEqual(['b']);
  });
});
