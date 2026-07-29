import { describe, expect, it } from 'vitest';

import { ImportUpdateService } from '@/features/aggregation/services/import-update-service';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';

function candidate(overrides: Partial<CanonicalImportEvent> = {}): CanonicalImportEvent {
  return {
    externalId: 'ext-1',
    sourceId: 'source-1',
    sourceName: 'Source',
    rawSourceType: 'api_json',
    title: 'Night Shift',
    startDate: '2026-08-01T20:00:00.000Z',
    description: 'Updated description',
    ...overrides,
  };
}

function existingEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'event-1',
    title: 'Night Shift',
    description: 'Old description',
    startDate: '2026-08-01T20:00:00.000Z',
    status: 'published',
    sourceId: 'source-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ImportUpdateService phase 2 rules', () => {
  const service = new ImportUpdateService();

  it('detects created events', () => {
    expect(service.detectChanges(candidate())).toEqual({
      changeType: 'created',
      changedFields: [],
    });
  });

  it('detects updated events', () => {
    const changes = service.detectChanges(candidate({ description: 'New copy' }), existingEvent());
    expect(changes.changeType).toBe('updated');
    expect(changes.changedFields).toContain('description');
  });

  it('detects cancellation', () => {
    expect(service.detectChanges(candidate(), existingEvent(), { cancelled: true })).toEqual({
      changeType: 'cancelled',
      changedFields: ['status'],
    });
  });

  it('detects start date conflicts', () => {
    expect(
      service.detectStartDateConflict(
        '2026-08-01T20:00:00.000Z',
        '2026-08-01T22:00:00.000Z',
      ),
    ).toBe(true);
  });

  it('protects manual overrides from automatic overwrite', () => {
    const protectedUpdate = service.protectManualOverrides(
      { title: 'Canonical Title', startDate: '2026-08-01T20:00:00.000Z' },
      { title: 'Imported Title', startDate: '2026-08-01T22:00:00.000Z' },
      ['title', 'startDate'],
      { title: true },
    );

    expect(protectedUpdate.title).toBeUndefined();
    expect(protectedUpdate.startDate).toBe('2026-08-01T22:00:00.000Z');
  });

  it('finds missing external ids without deleting events', () => {
    expect(service.findMissingExternalIds(['a', 'b'], ['b', 'c'])).toEqual(['a']);
  });
});
