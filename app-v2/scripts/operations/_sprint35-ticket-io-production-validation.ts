/**
 * Sprint 35 / Phase 3 — Full Ticket.io production flow validation.
 * Run: npx tsx scripts/operations/_sprint35-ticket-io-production-validation.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import {
  adminSourceRepository,
  eventOriginService,
  eventRepository,
  importAggregationService,
  importEventPublishService,
} from '@/data/repositories/registry';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { probeTicketIoShopUrl } from '@/features/ticket-platform-discovery/discovery/ticket-io-probe';
import { discoverTicketIoShops } from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-discovery';
import { collectDiscoveryCorpusFromSources } from '@/features/ticket-platform-discovery/discovery/discovery-corpus';
import {
  TICKET_IO_BOOTSHAUS_SHOP_URL,
  TICKET_IO_BOOTSHAUS_SOURCE_ID,
  createTicketIoShopSourceRecord,
} from '@/features/sources/production/ticket-io-source.core';
import { PRODUCTION_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/production-source-records';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import type { SourceRecord } from '@/data/types/records';
import type { ImportJob } from '@/features/import/models/types';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint35_ticket_io_production_validation.json',
);

const VALIDATION_ACTOR = 'sprint35-production-validation';

async function countCanonicalEvents(): Promise<number> {
  const { count, error } = await getSupabaseServiceClient()
    .from('events')
    .select('*', { count: 'exact', head: true });
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function loadSource(sourceId: string): Promise<SourceRecord> {
  const source = await adminSourceRepository.getById(sourceId);
  if (!source) {
    throw new Error(`Source ${sourceId} not found.`);
  }
  return source;
}

async function runLiveConnectorFetch(source: SourceRecord) {
  const events = await fetchTicketPlatformEvents({
    source: mapSourceRecordToAggregationSource(source),
    importSource: mapSourceRecordToImportSource(source),
    connectorKey: 'ticket_platform',
  });
  return events;
}

async function runImport(source: SourceRecord, label: string): Promise<ImportJob> {
  const job = await importAggregationService.enqueueJob(source, 'manual', `${VALIDATION_ACTOR}:${label}`);
  return importAggregationService.executeExistingJob(job, source, { recordImportReputation: true });
}

async function fetchJobRow(jobId: string) {
  const { data, error } = await getSupabaseServiceClient()
    .from('import_jobs')
    .select(
      'id,status,fetched_count,parsed_count,created_count,updated_count,duplicate_count,unchanged_count,missing_count,pages_processed,connector_version,warning_count,error_count,created_at',
    )
    .eq('id', jobId)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function sampleImportRecords(sourceId: string, limit = 8) {
  const { data, error } = await getSupabaseServiceClient()
    .from('import_records')
    .select('id,external_id,status,duplicate_event_id,resulting_event_id,raw_payload,normalized_payload')
    .eq('source_id', sourceId)
    .order('updated_at', { ascending: false })
    .limit(limit);
  if (error) {
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => ({
    id: row.id,
    externalId: row.external_id,
    status: row.status,
    duplicateEventId: row.duplicate_event_id,
    resultingEventId: row.resulting_event_id,
    normalizedHash:
      (row.normalized_payload as Record<string, unknown> | null)?.normalizedHash ??
      ((row.raw_payload as Record<string, unknown> | null)?.sourceMetadata as Record<string, unknown> | undefined)
        ?.normalizedHash,
  }));
}

async function countOrigins(sourceId: string): Promise<number> {
  const { count, error } = await getSupabaseServiceClient()
    .from('event_source_references')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', sourceId);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

function summarizePublishPolicy(source: SourceRecord) {
  return {
    publishMode: source.publishMode,
    behavior: source.sourceConfig?.publishPolicy?.behavior,
    reviewRequired: source.reviewRequired,
    blockOnDuplicate: source.sourceConfig?.publishPolicy?.blockOnDuplicate,
  };
}

async function ensureAutoPublishShopSource(shopSlug: string, listUrl: string): Promise<SourceRecord> {
  const sourceId = `source-ticket-io-${shopSlug}`;
  const existing = await adminSourceRepository.getById(sourceId);
  if (existing) {
    return existing;
  }

  const record = createTicketIoShopSourceRecord({
    shopSlug,
    listUrl,
    publishMode: 'auto_publish',
    publishBehavior: 'auto_publish',
    reviewRequired: false,
    enabled: true,
    scheduleEnabled: false,
    metadata: {
      validationShop: true,
      validationActor: VALIDATION_ACTOR,
    },
  });

  return adminSourceRepository.save({
    ...record,
    enabled: true,
    scheduleEnabled: false,
    notes: 'Sprint 35 production validation — auto_publish primary ticket.io shop.',
  });
}

async function publishNeedsReviewEnrichment(source: SourceRecord) {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from('import_records')
    .select('*')
    .eq('source_id', source.id)
    .eq('status', 'needs_review')
    .not('duplicate_event_id', 'is', null);
  if (error) {
    throw new Error(error.message);
  }

  const published: unknown[] = [];
  const previousRecords = await client
    .from('import_records')
    .select('*')
    .eq('source_id', source.id);
  const recordList = previousRecords.data ?? [];

  for (const row of data ?? []) {
    try {
      const result = await importEventPublishService.publishRecord(
        {
          id: row.id,
          importJobId: row.import_job_id,
          sourceId: row.source_id,
          externalId: row.external_id,
          rawPayload: row.raw_payload,
          normalizedPayload: row.normalized_payload ?? undefined,
          status: row.status,
          duplicateEventId: row.duplicate_event_id ?? undefined,
          resultingEventId: row.resulting_event_id ?? undefined,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        },
        source,
        recordList as never,
        { actorId: VALIDATION_ACTOR },
      );
      published.push({
        recordId: row.id,
        eventId: result.event.id,
        title: result.event.title,
        ticketUrl: result.event.ticketUrl,
        created: result.created,
      });
    } catch (publishError) {
      published.push({
        recordId: row.id,
        error: publishError instanceof Error ? publishError.message : String(publishError),
      });
    }
  }
  return published;
}

async function findAdminEventsForSource(sourceId: string) {
  const client = getSupabaseServiceClient();
  const { data: refs, error } = await client
    .from('event_source_references')
    .select('canonical_event_id')
    .eq('source_id', sourceId)
    .eq('active', true);
  if (error) {
    throw new Error(error.message);
  }
  const eventIds = [...new Set((refs ?? []).map((ref) => ref.canonical_event_id).filter(Boolean))];
  if (eventIds.length === 0) {
    return [];
  }
  const { data: events, error: eventsError } = await client
    .from('events')
    .select('id,title,status,start_date,ticket_url,source_id')
    .in('id', eventIds.slice(0, 20));
  if (eventsError) {
    throw new Error(eventsError.message);
  }
  return events ?? [];
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    sprint: '35',
    phase: 'ticket-io-production',
    command: 'npx tsx scripts/operations/_sprint35-ticket-io-production-validation.ts',
    startedAt: new Date().toISOString(),
    errors: [] as string[],
    warnings: [] as string[],
  };

  await initializeEntityAliasStore();
  await eventRepository.refresh();

  const canonicalBefore = await countCanonicalEvents();
  report.canonicalEventsBefore = canonicalBefore;

  // --- Probe ---
  const probe = await probeTicketIoShopUrl(TICKET_IO_BOOTSHAUS_SHOP_URL);
  report.probe = probe;
  report.ticketIoShopUsed = {
    bootshaus: {
      shopSlug: 'bootshaus-club',
      listUrl: TICKET_IO_BOOTSHAUS_SHOP_URL,
    },
  };

  if (!probe?.valid) {
    (report.errors as string[]).push('Bootshaus ticket.io probe failed.');
  }

  // --- Bootshaus enrichment source ---
  const bootshausBefore = await loadSource(TICKET_IO_BOOTSHAUS_SOURCE_ID);
  const bootshausPolicyBefore = summarizePublishPolicy(bootshausBefore);
  report.bootshausSourceBefore = {
    ...bootshausPolicyBefore,
    shopSlug: bootshausBefore.sourceConfig?.ticketPlatform?.shopSlug,
    connectorVersion: bootshausBefore.metadata?.connectorVersion,
  };

  if (bootshausPolicyBefore.behavior !== 'enrichment') {
    (report.errors as string[]).push(
      `Bootshaus Ticket.io must remain enrichment, got ${String(bootshausPolicyBefore.behavior)}.`,
    );
  }

  const connectorEvents = await runLiveConnectorFetch(bootshausBefore);
  report.connectorFetch = {
    eventCount: connectorEvents.length,
    sample: connectorEvents.slice(0, 3).map((event) => ({
      title: event.title,
      externalId: event.externalId,
      normalizedHash: event.sourceMetadata?.normalizedHash,
      connectorVersion: event.sourceMetadata?.connectorVersion,
    })),
    allHaveHash: connectorEvents.every((event) => Boolean(event.sourceMetadata?.normalizedHash)),
  };

  if (connectorEvents.length === 0) {
    (report.errors as string[]).push('Connector fetch returned zero Bootshaus events.');
  }
  if (!report.connectorFetch || !(report.connectorFetch as { allHaveHash: boolean }).allHaveHash) {
    (report.errors as string[]).push('Connector fetch missing normalized hashes.');
  }

  const bootshausRun1 = await runImport(bootshausBefore, 'bootshaus-run-1');
  const bootshausRun1Row = await fetchJobRow(bootshausRun1.id);
  await publishNeedsReviewEnrichment(bootshausBefore);
  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();

  const bootshausRun2 = await runImport(bootshausBefore, 'bootshaus-run-2');
  const bootshausRun2Row = await fetchJobRow(bootshausRun2.id);
  const bootshausAfter = await loadSource(TICKET_IO_BOOTSHAUS_SOURCE_ID);
  const bootshausPolicyAfter = summarizePublishPolicy(bootshausAfter);

  report.firstSynchronization = {
    sourceId: TICKET_IO_BOOTSHAUS_SOURCE_ID,
    jobId: bootshausRun1.id,
    status: bootshausRun1.status,
    metrics: bootshausRun1.metrics,
    dbRow: bootshausRun1Row,
    importRecordsSample: await sampleImportRecords(TICKET_IO_BOOTSHAUS_SOURCE_ID),
    originsAfter: await countOrigins(TICKET_IO_BOOTSHAUS_SOURCE_ID),
  };

  report.secondSynchronization = {
    sourceId: TICKET_IO_BOOTSHAUS_SOURCE_ID,
    jobId: bootshausRun2.id,
    status: bootshausRun2.status,
    metrics: bootshausRun2.metrics,
    dbRow: bootshausRun2Row,
    unchangedReported:
      (bootshausRun2.metrics.unchangedCount ?? 0) > 0 ||
      (bootshausRun2Row?.unchanged_count ?? 0) > 0,
    noNewCreates: (bootshausRun2.metrics.createdCount ?? 0) === 0,
  };

  report.publishPolicy = {
    bootshausBefore: bootshausPolicyBefore,
    bootshausAfter: bootshausPolicyAfter,
    unchanged:
      bootshausPolicyBefore.behavior === bootshausPolicyAfter.behavior &&
      bootshausPolicyBefore.publishMode === bootshausPolicyAfter.publishMode,
  };

  if (!(report.publishPolicy as { unchanged: boolean }).unchanged) {
    (report.errors as string[]).push('Bootshaus publish policy was overwritten during validation.');
  }
  if (!(report.secondSynchronization as { unchangedReported: boolean }).unchangedReported) {
    (report.warnings as string[]).push(
      'Second Bootshaus run did not report unchangedCount > 0 (may be expected if first run created records).',
    );
  }

  // --- Independent auto_publish shop ---
  const allSources = await adminSourceRepository.getAll();
  const corpus = collectDiscoveryCorpusFromSources(allSources);
  const knownSlugs = allSources
    .map((source) => source.sourceConfig?.ticketPlatform?.shopSlug)
    .filter((slug): slug is string => Boolean(slug));

  const discoveredShops = await discoverTicketIoShops({
    corpusTexts: corpus,
    knownShopSlugs: knownSlugs.filter((slug) => slug !== 'bootshaus-club'),
    maxShops: 10,
  });

  const autoShop =
    discoveredShops.find((shop) => shop.shopSlug !== 'bootshaus-club' && shop.eventCount > 0) ??
    discoveredShops[0];

  if (!autoShop) {
    (report.errors as string[]).push('No independent ticket.io shop discovered for auto_publish validation.');
  } else {
    const autoSource = await ensureAutoPublishShopSource(autoShop.shopSlug, autoShop.listUrl);
    (report.ticketIoShopUsed as Record<string, unknown>).autoPublish = {
      shopSlug: autoShop.shopSlug,
      listUrl: autoShop.listUrl,
      sourceId: autoSource.id,
      publishPolicy: summarizePublishPolicy(autoSource),
    };

    if (autoSource.sourceConfig?.publishPolicy?.behavior !== 'auto_publish') {
      (report.errors as string[]).push('Independent shop source is not auto_publish.');
    }

    const canonicalBeforeAuto = await countCanonicalEvents();
    const autoRun1 = await runImport(autoSource, `auto-${autoShop.shopSlug}-run-1`);
    const autoRun1Row = await fetchJobRow(autoRun1.id);
    await importEventPublishService.refreshConsumerFeed();
    await eventRepository.refresh();

    const autoRun2 = await runImport(autoSource, `auto-${autoShop.shopSlug}-run-2`);
    const autoRun2Row = await fetchJobRow(autoRun2.id);
    const canonicalAfterAuto = await countCanonicalEvents();

    report.autoPublishValidation = {
      firstRun: {
        jobId: autoRun1.id,
        status: autoRun1.status,
        metrics: autoRun1.metrics,
        dbRow: autoRun1Row,
      },
      secondRun: {
        jobId: autoRun2.id,
        status: autoRun2.status,
        metrics: autoRun2.metrics,
        dbRow: autoRun2Row,
        unchangedReported:
          (autoRun2.metrics.unchangedCount ?? 0) > 0 || (autoRun2Row?.unchanged_count ?? 0) > 0,
        noNewCreates: (autoRun2.metrics.createdCount ?? 0) === 0,
      },
      canonicalEventsCreated: canonicalAfterAuto - canonicalBeforeAuto,
      importRecordsSample: await sampleImportRecords(autoSource.id),
      origins: await countOrigins(autoSource.id),
      adminEvents: await findAdminEventsForSource(autoSource.id),
    };

    if ((report.autoPublishValidation as { canonicalEventsCreated: number }).canonicalEventsCreated <= 0) {
      (report.warnings as string[]).push(
        'auto_publish shop did not create new canonical events — may have matched existing events.',
      );
    }
  }

  const canonicalAfter = await countCanonicalEvents();
  report.canonicalEventsAfter = canonicalAfter;
  report.duplicateCanonicalEventsCreated = canonicalAfter - canonicalBefore;

  // --- Visibility ---
  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();

  const discoverable = getDiscoverablePublishedEvents();
  const bootshausAdminEvents = await findAdminEventsForSource(TICKET_IO_BOOTSHAUS_SOURCE_ID);
  const bootshausWebsiteAdmin = await findAdminEventsForSource(PRODUCTION_BOOTSHAUS_SOURCE_ID);

  const bootshausTicketOrigins = await eventOriginService.listByEventId(
    bootshausAdminEvents[0]?.id ?? bootshausWebsiteAdmin[0]?.id ?? '',
  ).catch(() => []);

  report.canonicalEvents = {
    bootshausTicketOrigins: await countOrigins(TICKET_IO_BOOTSHAUS_SOURCE_ID),
    bootshausAdminSample: bootshausAdminEvents.slice(0, 5),
    bootshausWebsiteAdminSample: bootshausWebsiteAdmin.slice(0, 3),
  };

  report.adminVisibility = {
    bootshausTicketSourceEvents: bootshausAdminEvents.length,
    sample: bootshausAdminEvents.slice(0, 5),
  };

  const publicMatches = discoverable.filter((event) =>
    Boolean(event.ticketUrl?.includes('ticket.io')),
  );
  report.publicApiVisibility = {
    discoverableCount: discoverable.length,
    ticketIoUrlCount: publicMatches.length,
    sample: publicMatches.slice(0, 5).map((event) => ({
      id: event.id,
      title: event.title,
      ticketUrl: event.ticketUrl,
      status: event.status,
      city: event.city,
    })),
  };

  report.frontendVisibility = {
    note: 'Frontend event page reads the same published/discoverable event repository.',
    eventPageResolvable: publicMatches.slice(0, 3).map((event) => ({
      id: event.id,
      title: event.title,
      hasTicketUrl: Boolean(event.ticketUrl),
      hasStartDate: Boolean(event.startDate),
      origins: bootshausTicketOrigins.length,
    })),
  };

  report.passed =
    (report.errors as string[]).length === 0 &&
    Boolean(probe?.valid) &&
    bootshausPolicyBefore.behavior === 'enrichment' &&
    (report.connectorFetch as { eventCount: number }).eventCount > 0 &&
    (report.adminVisibility as { bootshausTicketSourceEvents: number }).bootshausTicketSourceEvents > 0;

  report.finishedAt = new Date().toISOString();
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  try {
    await flushEntityAliasStore();
  } catch (error) {
    (report.warnings as string[]).push(
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
