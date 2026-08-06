/**
 * Sprint 33.5 — Publish ticket platform needs_review records and validate app visibility.
 * Run: npx tsx scripts/operations/_sprint335-ticket-platform-publish-e2e.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminEventRepository,
  adminSourceRepository,
  eventOriginService,
  eventRepository,
  importEventPublishService,
  importRecordRepository,
} from '@/data/repositories/registry';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import {
  TICKET_IO_BOOTSHAUS_SOURCE_ID,
} from '@/features/sources/production/ticket-io-source';
import {
  TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
} from '@/features/sources/production/ticket-kings-source';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import type { ImportRecord } from '@/features/import/models/types';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint335_ticket_platform_publish_e2e.json',
);

const TICKET_SOURCE_IDS = [
  TICKET_IO_BOOTSHAUS_SOURCE_ID,
  TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
  'source-ticket-kings-org-elektrokuche',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
] as const;

const TARGET_EVENT_TITLES = [
  'Sommerfest Elektroküche',
  'MDMA',
  'Underland',
  '10.10.26',
];

async function listNeedsReviewRecords(sourceId: string): Promise<ImportRecord[]> {
  const records = await importRecordRepository.listLatestBySourceId(sourceId);
  return records.filter((record) => record.status === 'needs_review');
}

async function countOriginsForSource(sourceId: string): Promise<number> {
  const client = getSupabaseServiceClient();
  const { count, error } = await client
    .from('event_source_references')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', sourceId);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

function findInDiscoverable(titleFragment: string) {
  const events = getDiscoverablePublishedEvents();
  return events.filter((event) => event.title.toLowerCase().includes(titleFragment.toLowerCase()));
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    sprint: '33.5',
    startedAt: new Date().toISOString(),
    sources: {} as Record<string, unknown>,
    published: [] as unknown[],
    visibility: [] as unknown[],
    errors: [] as string[],
    warnings: [] as string[],
  };

  await initializeEntityAliasStore();
  await eventRepository.refresh();

  const canonicalBefore = (await getSupabaseServiceClient()
    .from('events')
    .select('*', { count: 'exact', head: true })).count ?? 0;
  report.canonicalEventsBefore = canonicalBefore;

  for (const sourceId of TICKET_SOURCE_IDS) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source) {
      (report.sources as Record<string, unknown>)[sourceId] = { missing: true };
      continue;
    }

    const pending = await listNeedsReviewRecords(sourceId);
    const originsBefore = await countOriginsForSource(sourceId);
    const section: Record<string, unknown> = {
      displayName: source.displayName,
      pendingReview: pending.length,
      originsBefore,
      publishResults: [] as unknown[],
    };

    const previousRecords = await importRecordRepository.listLatestBySourceId(sourceId);
    for (const record of pending) {
      try {
        const result = await importEventPublishService.publishRecord(
          record,
          source,
          previousRecords,
          { actorId: 'sprint335-e2e' },
        );
        (section.publishResults as unknown[]).push({
          recordId: record.id,
          externalId: record.externalId,
          duplicateEventId: record.duplicateEventId,
          resultingEventId: result.record.resultingEventId,
          eventTitle: result.event.title,
          eventStatus: result.event.status,
          ticketUrl: result.event.ticketUrl,
          created: result.created,
        });
        (report.published as unknown[]).push({
          sourceId,
          recordId: record.id,
          eventId: result.event.id,
          title: result.event.title,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        (section.publishResults as unknown[]).push({
          recordId: record.id,
          externalId: record.externalId,
          error: message,
        });
        (report.errors as string[]).push(`${sourceId}/${record.id}: ${message}`);
      }
    }

    section.originsAfter = await countOriginsForSource(sourceId);
    (report.sources as Record<string, unknown>)[sourceId] = section;
  }

  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();

  const discoverable = getDiscoverablePublishedEvents();
  report.discoverableEventCount = discoverable.length;

  for (const fragment of TARGET_EVENT_TITLES) {
    const matches = findInDiscoverable(fragment);
    const origins = matches.length
      ? await Promise.all(
          matches.map(async (event) => ({
            eventId: event.id,
            title: event.title,
            ticketUrl: event.ticketUrl,
            origins: await eventOriginService.listByEventId(event.id),
          })),
        )
      : [];
    (report.visibility as unknown[]).push({
      titleFragment: fragment,
      discoverableMatches: matches.map((event) => ({
        id: event.id,
        title: event.title,
        startDate: event.startDate,
        ticketUrl: event.ticketUrl,
        city: event.city,
        status: event.status,
      })),
      origins,
    });
  }

  const canonicalAfter = (await getSupabaseServiceClient()
    .from('events')
    .select('*', { count: 'exact', head: true })).count ?? 0;
  report.canonicalEventsAfter = canonicalAfter;

  const ticketIoOrigins = await countOriginsForSource(TICKET_IO_BOOTSHAUS_SOURCE_ID);
  const ticketKingsOrigins = await countOriginsForSource(TICKET_KINGS_AFFENKAEFIG_SOURCE_ID);

  report.summary = {
    publishedCount: (report.published as unknown[]).length,
    errorCount: (report.errors as string[]).length,
    newCanonicalEvents: canonicalAfter - canonicalBefore,
    ticketIoOrigins,
    ticketKingsOrigins,
    discoverableWithTicketKings: (report.visibility as Array<{ discoverableMatches: unknown[] }>).some(
      (entry) => entry.discoverableMatches.length > 0,
    ),
    enrichmentOriginsPresent: ticketIoOrigins > 0 || ticketKingsOrigins > 0,
  };

  report.passed =
    (report.errors as string[]).length === 0 &&
    (report.published as unknown[]).length > 0 &&
    ((report.summary as { discoverableWithTicketKings: boolean }).discoverableWithTicketKings ||
      (report.summary as { enrichmentOriginsPresent: boolean }).enrichmentOriginsPresent);

  report.completedAt = new Date().toISOString();

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  try {
    await flushEntityAliasStore();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    (report.warnings as string[] | undefined) ??= [];
    (report.warnings as string[]).push(`entity_alias_flush: ${message}`);
  }

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
