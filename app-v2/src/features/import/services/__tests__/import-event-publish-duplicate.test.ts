import { describe, expect, it } from 'vitest';

import type { AdminEventRecord } from '@/data/types/records';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import type { ImportRecord } from '@/features/import/models/types';
import { createBootshausProductionSourceRecord } from '@/features/sources/production/production-source-records';

function createRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  const now = '2026-01-01T00:00:00.000Z';
  return {
    id: 'record-1',
    importJobId: 'job-1',
    sourceId: 'source-bootshaus-koeln',
    externalId: 'ext-1',
    rawPayload: {},
    normalizedPayload: {
      title: 'Night Session',
      startDate: '2026-08-01T22:00:00.000Z',
      venueName: 'Bootshaus',
    },
    status: 'approved',
    duplicateEventId: 'existing-event-42',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('Sprint 26.6 — publish duplicate resolution', () => {
  it('uses duplicateEventId from matching when publishing', async () => {
    const multiSource = new InMemoryMultiSourceRepositories();
    const existingEvent: AdminEventRecord = {
      id: 'existing-event-42',
      title: 'Existing Event',
      description: 'Existing',
      startDate: '2026-08-01T22:00:00.000Z',
      status: 'published',
      sourceId: 'source-other',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const adminEventRepository = {
      async getById(id: string) {
        return id === existingEvent.id ? existingEvent : null;
      },
      async save(event: AdminEventRecord) {
        return event;
      },
      async list() {
        return { items: [existingEvent], total: 1, page: 1, pageSize: 10 };
      },
      async delete() {},
    };

    const recordRepository = {
      async update(record: ImportRecord) {
        return record;
      },
    };

    const publishService = new ImportEventPublishService(
      recordRepository as never,
      adminEventRepository as never,
      multiSource.sourceReferences,
    );

    const record = createRecord();
    const source = createBootshausProductionSourceRecord();
    const resolvedId = await publishService.resolveExistingEventId(record, []);
    expect(resolvedId).toBe('existing-event-42');

    const result = await publishService.publishRecord(record, source, []);
    expect(result.created).toBe(false);
    expect(result.event.id).toBe('existing-event-42');
  });
});
