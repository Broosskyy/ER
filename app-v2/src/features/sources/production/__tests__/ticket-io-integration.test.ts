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
  createBootshausProductionSourceRecord,
  PRODUCTION_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/production-source-records';
import {
  createBootshausTicketIoProductionSourceRecord,
  TICKET_IO_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/ticket-io-source.fixtures.server';
import { canResolveSourceConnector } from '@/features/aggregation/connectors/source-connector-resolution';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/20260763000000_sprint31_ticket_io_production.sql',
);

async function saveImportSource(
  bundle: ReturnType<typeof createLocalImportDatasourceBundle>,
  source: ReturnType<typeof createBootshausTicketIoProductionSourceRecord>,
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
            id: 'venue-bootshaus-koeln',
            name: 'Bootshaus',
            address: 'Auenweg 173, 51063 Köln',
            cityId: 'koeln',
            cityName: 'Köln',
            latitude: 50.9517133,
            longitude: 6.9819222,
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
        })),
      }),
    publishOrchestrator,
  );

  return { bundle, aggregationService, adminEvents };
}

describe('Sprint 31 ticket.io production integration', () => {
  it('migration seeds ticket.io source with scheduler enabled', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    expect(sql).toContain("id = 'source-bootshaus-ticket-io'");
    expect(sql).toContain('ticket_platform');
    expect(sql).toContain('schedule_enabled = true');
    expect(sql).not.toContain('source-bootshaus-koeln');
  });

  it('resolves ticket_platform connector for ticket.io source', () => {
    const source = createBootshausTicketIoProductionSourceRecord();
    expect(canResolveSourceConnector(source)).toBe(true);
    expect(source.sourceType).toBe('ticket_platform');
  });

  it('enriches Bootshaus events without creating duplicates', async () => {
    const stack = createStack();
    const bootshaus = createBootshausProductionSourceRecord();
    const ticketIo = createBootshausTicketIoProductionSourceRecord();

    await saveImportSource(stack.bundle, bootshaus);
    await stack.aggregationService.runFromSourceRecord(bootshaus, 'manual', 'owner');
    const bootshausCount = stack.adminEvents.length;
    expect(bootshausCount).toBeGreaterThan(0);

    await saveImportSource(stack.bundle, ticketIo);
    const ticketJob = await stack.aggregationService.runFromSourceRecord(ticketIo, 'manual', 'owner');

    expect(stack.adminEvents.length).toBe(bootshausCount);

    const ticketRecords = await stack.bundle.importRecords.listByJobId(ticketJob.id);
    expect(ticketRecords.length).toBeGreaterThan(10);
    expect(ticketRecords.filter((record) => (record.duplicateScore ?? 0) >= 70).length).toBeGreaterThan(0);
    expect(ticketRecords.every((record) => record.sourceId === TICKET_IO_BOOTSHAUS_SOURCE_ID)).toBe(true);
  });

  it('does not regress Bootshaus website import', async () => {
    const stack = createStack();
    const source = createBootshausProductionSourceRecord();
    await saveImportSource(stack.bundle, source);
    const job = await stack.aggregationService.runFromSourceRecord(source, 'manual', 'owner');
    expect(job.status).toMatch(/completed/);
    expect(stack.adminEvents.some((event) => event.sourceId === PRODUCTION_BOOTSHAUS_SOURCE_ID)).toBe(true);
  });
});
