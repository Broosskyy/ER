import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createLocalImportDatasourceBundle } from '@/data/datasources/local/local-import-datasource';
import type { AdminEventRecord } from '@/data/types/records';
import type { EventRepository } from '@/data/repositories/repositories';
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { ImportAggregationService } from '@/features/aggregation/services/import-aggregation-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { ImportLoggingService } from '@/features/import/services/import-logging-service';
import { ImportEventPublishService } from '@/features/import/services/import-event-publish-service';
import { ImportPublishOrchestratorService } from '@/features/import/services/import-publish-orchestrator-service';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { createTestMatchingCatalog } from '@/features/import/matching/matching-catalog';
import { InMemoryMultiSourceRepositories } from '@/features/aggregation/__tests__/in-memory-multi-source-repositories';
import {
  createAffenkaefigProductionSourceRecord,
  PRODUCTION_AFFENKAEFIG_SOURCE_ID,
} from '@/features/sources/production/production-source-records';
import {
  createAffenkaefigTicketKingsProductionSourceRecord,
  loadTicketKingsAffenkaefigFixtureHtml,
  TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
} from '@/features/sources/production/ticket-kings-source';
import { parseTicketKingsShopHtml } from '@/features/aggregation/connectors/ticket-platform/adapters/ticket-kings-adapter';
import { canResolveSourceConnector } from '@/features/aggregation/connectors/source-connector-resolution';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260764000000_sprint32_ticket_kings_production.sql',
);

async function saveImportSource(
  bundle: ReturnType<typeof createLocalImportDatasourceBundle>,
  source: ReturnType<typeof createAffenkaefigTicketKingsProductionSourceRecord>,
) {
  await bundle.importSources.save(mapSourceRecordToImportSource(source));
}

function createStack() {
  const bundle = createLocalImportDatasourceBundle();
  const loggingService = new ImportLoggingService(bundle.importLogs);
  const multiSource = new InMemoryMultiSourceRepositories();
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

  const consumerEvents: AdminEventRecord[] = [];
  const consumerEventRepository = {
    resolveCanonicalId(id: string) {
      return id;
    },
    getPublishedEvents() {
      return consumerEvents.filter((event) => event.status === 'published');
    },
    getEventById(id: string) {
      return consumerEvents.find((event) => event.id === id);
    },
    async refresh() {
      consumerEvents.length = 0;
      for (const event of adminEvents.filter((entry) => entry.status === 'published')) {
        consumerEvents.push(event);
      }
    },
  } as unknown as EventRepository;

  const publishService = new ImportEventPublishService(
    bundle.importRecords,
    adminEventRepository,
    multiSource.sourceReferences,
    consumerEventRepository,
  );
  const publishDecision = new PublishDecisionService();
  const publishOrchestrator = new ImportPublishOrchestratorService(
    bundle.importRecords,
    publishService,
    publishDecision,
    loggingService,
    undefined,
    undefined,
    undefined,
    adminEventRepository,
  );
  const { matchingService } = createImportMatchingService();
  const aggregationService = new ImportAggregationService(
    bundle.importSources,
    bundle.importJobs,
    bundle.importRecords,
    loggingService,
    adminEventRepository,
    matchingService,
    undefined,
    async () =>
      createTestMatchingCatalog({
        venues: [
          {
            id: 'venue-essigfabrik-koeln',
            name: 'Essigfabrik',
            address: 'Siegburger Str. 110, 50679 Köln',
            cityId: 'koeln',
            cityName: 'Köln',
          },
        ],
        organizers: [
          {
            id: 'organizer-affenkaefig',
            name: 'Affenkäfig',
            city: 'Köln',
            country: 'Germany',
          },
        ],
        events: adminEvents.map((event) => ({
          id: event.id,
          title: event.title,
          startDate: event.startDate,
          externalId: event.id,
          venueId: event.venueId,
          venueName: event.venueName,
          cityName: event.venueCity,
          ticketUrl: event.ticketUrl,
        })),
      }),
    publishOrchestrator,
  );

  return { bundle, aggregationService, adminEvents, adminEventRepository };
}

describe('Sprint 32 ticket kings production integration', () => {
  it('migration seeds ticket kings source with scheduler enabled', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("id = 'source-affenkaefig-ticket-kings'");
    expect(sql).toContain('ticket_platform');
    expect(sql).toContain('schedule_enabled = true');
    expect(sql).not.toMatch(/where id = 'source-affenkaefig';/);
  });

  it('resolves ticket_platform connector for ticket kings source', () => {
    const source = createAffenkaefigTicketKingsProductionSourceRecord();
    expect(canResolveSourceConnector(source)).toBe(true);
    expect(source.sourceConfig?.ticketPlatform?.platform).toBe('ticket_king');
  });

  it('enriches Affenkäfig events without creating duplicates', async () => {
    const stack = createStack();
    const ticketKings = createAffenkaefigTicketKingsProductionSourceRecord();
    const ticketPlatformConfig = ticketKings.sourceConfig?.ticketPlatform;
    if (!ticketPlatformConfig) {
      throw new Error('Missing ticket platform config.');
    }

    const parsed = parseTicketKingsShopHtml(
      loadTicketKingsAffenkaefigFixtureHtml(),
      ticketPlatformConfig,
    );
    const now = new Date().toISOString();
    for (const [index, event] of parsed.events.slice(0, 4).entries()) {
      await stack.adminEventRepository.save({
        id: `evt-affenkaefig-seed-${index}`,
        title: event.title,
        description: 'Official Affenkäfig event',
        startDate: event.startDate,
        endDate: event.endDate,
        venueName: event.venueName,
        venueId: 'venue-essigfabrik-koeln',
        venueCity: event.cityName ?? 'Köln',
        ticketUrl: event.ticketUrl,
        sourceId: PRODUCTION_AFFENKAEFIG_SOURCE_ID,
        status: 'published',
        createdAt: now,
        updatedAt: now,
      });
    }
    const seededCount = stack.adminEvents.length;
    expect(seededCount).toBe(4);

    await saveImportSource(stack.bundle, ticketKings);
    const ticketJob = await stack.aggregationService.runFromSourceRecord(
      ticketKings,
      'manual',
      'owner',
    );

    expect(stack.adminEvents.length).toBe(seededCount);

    const ticketRecords = await stack.bundle.importRecords.listByJobId(ticketJob.id);
    expect(ticketRecords.length).toBeGreaterThanOrEqual(3);
    expect(ticketRecords.filter((record) => (record.duplicateScore ?? 0) >= 70).length).toBeGreaterThan(
      0,
    );
    expect(ticketRecords.every((record) => record.sourceId === TICKET_KINGS_AFFENKAEFIG_SOURCE_ID)).toBe(
      true,
    );
  });

  it('does not regress Affenkäfig website import', async () => {
    const stack = createStack();
    const source = createAffenkaefigProductionSourceRecord();
    await saveImportSource(stack.bundle, source);
    const job = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);
    expect(stack.adminEvents.some((event) => event.sourceId === PRODUCTION_AFFENKAEFIG_SOURCE_ID)).toBe(
      true,
    );
  });
});
