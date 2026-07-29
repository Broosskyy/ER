import { describe, expect, it } from 'vitest';

import { mapAdminRecordToEventRow, mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { AdminEventRecord } from '@/data/types/records';
import { buildEventIdentityFingerprint } from '@/features/aggregation/identity/event-identity';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import {
  createEventFingerprintLookup,
  EventCanonicalIdentityService,
} from '@/features/events/services/event-canonical-identity-service';
import { applyEventPublishLifecycle } from '@/features/import/services/event-publish-lifecycle';
import { EventFieldProvenanceWriter } from '@/features/import/services/event-field-provenance-writer';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import type { ImportRecord } from '@/features/import/models/types';

function baseAdminEvent(overrides: Partial<AdminEventRecord> = {}): AdminEventRecord {
  return {
    id: 'evt-1',
    title: 'Test Event',
    description: 'Description',
    startDate: '2026-08-01T22:00:00.000Z',
    status: 'published',
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-01T10:00:00.000Z',
    ...overrides,
  };
}

describe('Sprint 14 event domain foundation', () => {
  it('round-trips lifecycle and canonical fields through event mapper', () => {
    const record = baseAdminEvent({
      canonicalEventId: 'evt-1',
      firstPublishedAt: '2026-07-01T10:00:00.000Z',
      publishedAt: '2026-07-02T10:00:00.000Z',
      lastSeenAt: '2026-07-03T10:00:00.000Z',
      lastImportedAt: '2026-07-03T10:00:00.000Z',
      cancelledAt: '2026-07-04T10:00:00.000Z',
      postponedAt: undefined,
      festivalEditionId: 'edition-2026',
      timezone: 'Europe/Berlin',
    });

    const row = mapAdminRecordToEventRow(record);
    const restored = mapEventRowToAdminRecord(row);

    expect(restored.canonicalEventId).toBe('evt-1');
    expect(restored.firstPublishedAt).toBe('2026-07-01T10:00:00.000Z');
    expect(restored.lastImportedAt).toBe('2026-07-03T10:00:00.000Z');
    expect(restored.festivalEditionId).toBe('edition-2026');
    expect(restored.cancelledAt).toBe('2026-07-04T10:00:00.000Z');
    expect(restored.timezone).toBe('Europe/Berlin');
  });

  it('applies publish lifecycle timestamps and cancellation flags', () => {
    const now = '2026-07-15T12:00:00.000Z';
    const result = applyEventPublishLifecycle(baseAdminEvent(), {
      normalizedPayload: { isCancelled: true, timezone: 'Europe/Berlin' },
      publishedAt: now,
    });

    expect(result.canonicalEventId).toBe('evt-1');
    expect(result.firstPublishedAt).toBe(now);
    expect(result.publishedAt).toBe(now);
    expect(result.lastSeenAt).toBe(now);
    expect(result.lastImportedAt).toBe(now);
    expect(result.cancelledAt).toBe(now);
    expect(result.timezone).toBe('Europe/Berlin');
  });

  it('preserves first publish timestamp on subsequent imports', () => {
    const firstPublish = '2026-07-01T10:00:00.000Z';
    const existing = baseAdminEvent({
      firstPublishedAt: firstPublish,
      publishedAt: firstPublish,
      canonicalEventId: 'evt-1',
    });
    const result = applyEventPublishLifecycle(baseAdminEvent(), {
      existing,
      publishedAt: '2026-07-10T10:00:00.000Z',
    });

    expect(result.firstPublishedAt).toBe(firstPublish);
    expect(result.publishedAt).toBe(firstPublish);
    expect(result.lastImportedAt).toBe('2026-07-10T10:00:00.000Z');
  });

  it('registers and resolves canonical event identity by fingerprint', async () => {
    const store = new InMemoryEntityAliasStore();
    const multiSource = new InMemoryMultiSourceRepositories();
    const identity = new EventCanonicalIdentityService(
      createEventFingerprintLookup(store),
      multiSource.sourceReferences,
    );

    const candidate = {
      externalId: 'ext-1',
      sourceId: 'source-a',
      sourceName: 'Source A',
      title: 'Canonical Night',
      startDate: '2026-08-01T22:00:00.000Z',
      venueName: 'Bootshaus',
      rawSourceType: 'unknown' as const,
    };

    const fingerprint = buildEventIdentityFingerprint(candidate).canonicalFingerprint;
    expect(await identity.resolveByFingerprint(candidate)).toBeUndefined();

    await identity.registerIdentity('evt-canonical', candidate, 'source-a');
    expect(store.findCanonicalId('event', 'normalized_name', fingerprint)).toBe('evt-canonical');
    expect(await identity.resolveByFingerprint(candidate)).toBe('evt-canonical');
  });

  it('writes field provenance during import publish', async () => {
    const multiSource = new InMemoryMultiSourceRepositories();
    const provenanceWriter = new EventFieldProvenanceWriter(multiSource.fieldProvenance);
    const adminEvents: AdminEventRecord[] = [];
    const adminEventRepository = {
      async getById(id: string) {
        return adminEvents.find((event) => event.id === id) ?? null;
      },
      async save(event: AdminEventRecord) {
        const index = adminEvents.findIndex((entry) => entry.id === event.id);
        if (index >= 0) {
          adminEvents[index] = event;
        } else {
          adminEvents.push(event);
        }
        return event;
      },
    };

    const records: ImportRecord[] = [];
    const recordRepository = {
      async update(record: ImportRecord) {
        const index = records.findIndex((entry) => entry.id === record.id);
        if (index >= 0) {
          records[index] = record;
        } else {
          records.push(record);
        }
        return record;
      },
    };

    const publishService = new ImportEventPublishService(
      recordRepository as never,
      adminEventRepository as never,
      multiSource.sourceReferences,
      undefined,
      provenanceWriter,
    );

    const importRecord: ImportRecord = {
      id: 'rec-1',
      importJobId: 'job-1',
      sourceId: 'source-bootshaus',
      sourceName: 'Bootshaus',
      externalId: 'bh-1',
      status: 'approved',
      rawPayload: {},
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
      retrievedAt: '2026-07-15T10:00:00.000Z',
      normalizedPayload: {
        title: 'Night Session',
        description: 'Live set',
        startDate: '2026-08-01T22:00:00.000Z',
        venueName: 'Bootshaus',
        ticketUrl: 'https://tickets.example/event',
        imageUrl: 'https://cdn.example/flyer.jpg',
      },
    };

    const result = await publishService.publishRecord(importRecord, {
      id: 'source-bootshaus',
      slug: 'bootshaus',
      displayName: 'Bootshaus',
      sourceType: 'club_website',
      parserType: 'html_selector',
      acquisitionStrategy: 'pull',
      priority: 80,
      trustScore: 0.9,
      requiresAuthentication: false,
      enabled: true,
      archived: false,
    } as never);

    expect(result.created).toBe(true);
    expect(result.event.canonicalEventId).toBe(result.event.id);
    expect(result.event.firstPublishedAt).toBeTruthy();
    expect(result.event.lastImportedAt).toBeTruthy();

    const provenance = await multiSource.fieldProvenance.findByCanonicalEventId(result.event.id);
    expect(provenance.length).toBeGreaterThan(0);
    expect(provenance.some((entry) => entry.fieldPath === 'description')).toBe(true);
    expect(provenance.some((entry) => entry.selectedSourceId === 'source-bootshaus')).toBe(true);
  });
});
