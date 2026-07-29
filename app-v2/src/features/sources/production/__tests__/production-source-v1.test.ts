import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportAuditService } from '@/features/import/admin/import-audit-service';
import { ImportReviewService } from '@/features/import/admin/import-review-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { eventLifecycleResolver } from '@/features/events/lifecycle/event-lifecycle-resolver';
import { toEventLifecycleInput } from '@/features/events/lifecycle/event-lifecycle-from-event';
import { filterProfileEvents } from '@/features/profiles/services/entity-profile-events-filter';
import { buildEventSearchIndex } from '@/features/search/constants';
import { createEternalRavePartnerV1SourceRecord, PARTNER_V1_FIELD_MAPPING } from '@/features/sources/production/eternal-rave-partner-v1-source';
import type { AuthSession } from '@/services/supabase/auth-service';
import type { Event } from '@/features/events/types/event';

const owner: AuthSession = {
  user: { id: 'owner', email: 'admin@eternalrave.app' },
  accessToken: 't',
  role: 'owner',
};

function createProductionStack() {
  const bundle = createLocalImportDatasourceBundle();
  const loggingService = new ImportLoggingService(bundle.importLogs);
  const adminEvents: AdminEventRecord[] = [];
  const adminEventRepository = {
    async list() {
      return { items: adminEvents, total: adminEvents.length, page: 1, pageSize: 50 };
    },
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
    async delete() {},
  };

  const consumerEvents: Event[] = [];
  let consumerRefreshed = false;
  const consumerEventRepository = {
    resolveCanonicalId(id: string) {
      return id;
    },
    getPublishedEvents() {
      return [...consumerEvents];
    },
    getEventById(id: string) {
      return consumerEvents.find((event) => event.id === id);
    },
    async refresh() {
      consumerRefreshed = true;
      consumerEvents.length = 0;
      for (const record of adminEvents.filter((event) => event.status === 'published')) {
        consumerEvents.push({
          id: record.id,
          slug: record.id,
          title: record.title,
          description: record.description ?? '',
          startDateTime: record.startDate ?? new Date().toISOString(),
          endDateTime: record.endDate,
          timezone: 'Europe/Berlin',
          venue: 'Bootshaus',
          city: 'Köln',
          country: 'Germany',
          genres: ['Techno'],
          artists: ['Ben Klock', 'DVS1'],
          organizer: record.organizerName ?? 'Rheinland Nights',
          venueId: record.venueId,
          organizerId: record.organizerId,
          artistIds: [],
          source: 'source-er-partner-v1',
          sourceEventId: record.id,
          status: 'published',
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          ticketUrl: record.ticketUrl,
          imageUrl: record.imageUrl,
        });
      }
    },
  } as unknown as EventRepository;

  const { matchingService } = createImportMatchingService();

  const aggregationService = new ImportAggregationService(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    loggingService,
    adminEventRepository,
    matchingService,
  );

  const auditService = new ImportAuditService(bundle.importAuditLogs);
  const reviewService = new ImportReviewService(
    bundle.importRecords,
    bundle.importAdmin,
    adminEventRepository,
    auditService,
    { replaceFromMatchedArtistIds: async () => [] },
    consumerEventRepository,
    matchingService,
  );

  return {
    bundle,
    aggregationService,
    reviewService,
    adminEvents,
    consumerEventRepository,
    consumerEvents,
    wasRefreshed: () => consumerRefreshed,
  };
}

describe('production source v1 end-to-end', () => {
  it('imports partner feed through full pipeline into needs_review', async () => {
    const stack = createProductionStack();
    const sourceRecord = createEternalRavePartnerV1SourceRecord();

    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);
    expect(job.metrics?.parsedCount).toBe(3);

    const records = await stack.bundle.importRecords.listByJobId(job.id);
    expect(records.every((record) => record.status === 'needs_review')).toBe(true);

    const warehouse = records.find((record) => record.externalId === 'rn-warehouse-2026');
    expect(warehouse?.normalizedPayload).toMatchObject({
      title: 'Warehouse Sessions Köln',
      cityName: 'Köln',
      organizerName: 'Rheinland Nights',
    });
    expect((warehouse?.normalizedPayload as { artistNames?: string[] })?.artistNames).toEqual([
      'Ben Klock',
      'DVS1',
    ]);
  });

  it('publishes reviewed event and exposes it for discovery, search and profiles', async () => {
    const stack = createProductionStack();
    const sourceRecord = createEternalRavePartnerV1SourceRecord();
    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    const record = (await stack.bundle.importRecords.listByJobId(job.id)).find(
      (entry) => entry.externalId === 'rn-warehouse-2026',
    )!;

    const { event } = await stack.reviewService.approveRecord(owner, record.id, record.updatedAt);
    expect(event.status).toBe('published');
    expect(stack.wasRefreshed()).toBe(true);

    const published = stack.consumerEvents[0];
    expect(published).toBeDefined();
    if (!published) {
      return;
    }

    const lifecycle = eventLifecycleResolver.resolve(toEventLifecycleInput(published));
    expect(['scheduled', 'on_sale', 'sold_out', 'happening_now']).toContain(lifecycle.status);

    expect(buildEventSearchIndex(published)).toContain('rheinland nights');
    expect(buildEventSearchIndex(published)).toContain('ben klock');
    expect(filterProfileEvents(stack.consumerEvents).length).toBe(1);
  });

  it('rejects invalid partner payload items during mapping', async () => {
    const stack = createProductionStack();
    const sourceRecord = createEternalRavePartnerV1SourceRecord({
      sourceConfig: {
        reference: {
          connectorKey: 'open_data_api',
          apiJson: {
            data: {
              events: [{ id: 'broken' }],
            },
          },
        },
        api: {
          resultsPath: 'data.events',
          fieldMapping: PARTNER_V1_FIELD_MAPPING,
        },
      },
    });

    const job = await stack.aggregationService.runFromSourceRecord(sourceRecord, 'manual', 'owner');
    expect(job.metrics?.parsedCount ?? 0).toBe(0);
  });
});
