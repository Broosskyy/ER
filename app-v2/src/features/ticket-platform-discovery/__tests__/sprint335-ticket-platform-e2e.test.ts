import { describe, expect, it } from 'vitest';

import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import type { ImportRecord } from '@/features/import/models/types';
import { EventOriginService } from '@/features/events/services/event-origin-service';
import {
  canApproveRecord,
  isTicketPlatformEnrichmentApproval,
} from '@/features/import/admin/import-utils';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';

const ticketSource: SourceRecord = {
  id: 'source-ticket-kings-test',
  slug: 'ticket-kings-test',
  displayName: 'Ticket Kings Test',
  sourceType: 'ticket_platform',
  parserType: 'html',
  acquisitionStrategy: 'scheduled',
  priority: 60,
  trustScore: 65,
  requiresAuthentication: false,
  enabled: true,
  archived: false,
  reviewRequired: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

const existingEvent: AdminEventRecord = {
  id: 'evt-existing-1',
  title: 'Techno Night',
  description: 'Official listing',
  startDate: '2026-08-15T22:00:00+02:00',
  status: 'published',
  sourceId: 'source-bootshaus-koeln',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

function createNeedsReviewRecord(overrides: Partial<ImportRecord> = {}): ImportRecord {
  return {
    id: 'rec-ticket-1',
    sourceId: ticketSource.id,
    externalId: 'https://ticketkings.de/event/test/',
    sourceUrl: 'https://ticketkings.de/all-events/',
    originalUrl: 'https://ticketkings.de/event/test/',
    status: 'needs_review',
    duplicateScore: 85,
    duplicateEventId: existingEvent.id,
    createdAt: '2026-01-01T00:00:00.000Z',
    retrievedAt: '2026-01-01T00:00:00.000Z',
    normalizedPayload: {
      title: 'Techno Night',
      startDate: '2026-08-15T22:00:00+02:00',
      ticketUrl: 'https://ticketkings.de/event/test/',
      eventUrl: 'https://ticketkings.de/event/test/',
      venueName: 'Essigfabrik',
      organizerName: 'MDMA',
    },
    ...overrides,
  };
}

describe('Sprint 33.5 ticket platform publish e2e', () => {
  it('allows approving matched ticket platform enrichment duplicates', () => {
    const record = createNeedsReviewRecord();
    expect(isTicketPlatformEnrichmentApproval(record, 'ticket_platform')).toBe(true);
    expect(canApproveRecord(record)).toBe(false);
    expect(canApproveRecord(record, { allowMatchedDuplicate: true })).toBe(true);
  });

  it('publishes enrichment without creating a new canonical event', async () => {
    const multiSource = new InMemoryMultiSourceRepositories();
    const originService = new EventOriginService(multiSource.sourceReferences);
    const adminEvents = new Map<string, AdminEventRecord>([[existingEvent.id, { ...existingEvent }]]);
    const records = new Map<string, ImportRecord>();

    const publishService = new ImportEventPublishService(
      {
        async update(record) {
          records.set(record.id, record);
          return record;
        },
      },
      {
        async getById(id) {
          return adminEvents.get(id) ?? null;
        },
        async save(event) {
          adminEvents.set(event.id, event);
          return event;
        },
        async list() {
          return { items: [...adminEvents.values()], total: adminEvents.size, page: 1, pageSize: 50 };
        },
        async delete() {},
      },
      multiSource.sourceReferences,
      undefined,
      undefined,
      undefined,
      undefined,
      originService,
    );

    const record = createNeedsReviewRecord();
    const result = await publishService.publishRecord(record, ticketSource, [], { actorId: 'test' });

    expect(result.created).toBe(false);
    expect(result.event.id).toBe(existingEvent.id);
    expect(result.event.ticketUrl).toBe('https://ticketkings.de/event/test/');
    expect(result.record.status).toBe('imported');

    const origins = await originService.listByEventId(existingEvent.id);
    expect(origins.length).toBe(1);
    expect(origins[0]?.role).toBe('ticketing');
  });

  it('creates a new canonical event when no duplicate exists', async () => {
    const multiSource = new InMemoryMultiSourceRepositories();
    const adminEvents = new Map<string, AdminEventRecord>();
    const publishService = new ImportEventPublishService(
      {
        async update(record) {
          return record;
        },
      },
      {
        async getById(id) {
          return adminEvents.get(id) ?? null;
        },
        async save(event) {
          adminEvents.set(event.id, event);
          return event;
        },
        async list() {
          return { items: [...adminEvents.values()], total: adminEvents.size, page: 1, pageSize: 50 };
        },
        async delete() {},
      },
      multiSource.sourceReferences,
    );

    const record = createNeedsReviewRecord({
      duplicateEventId: undefined,
      duplicateScore: undefined,
      normalizedPayload: {
        title: 'Underland Essigfabrik 05.09.2026',
        startDate: '2026-09-05T22:00:00+02:00',
        ticketUrl: 'https://ticketkings.de/event/underland/',
        eventUrl: 'https://ticketkings.de/event/underland/',
        venueName: 'Essigfabrik',
        cityName: 'Köln',
      },
    });

    const result = await publishService.publishRecord(record, ticketSource, [], { actorId: 'test' });
    expect(result.created).toBe(true);
    expect(result.event.status).toBe('published');
    expect(importUpdateService.isTicketPlatformEnrichmentSource(ticketSource.sourceType)).toBe(true);
  });
});
