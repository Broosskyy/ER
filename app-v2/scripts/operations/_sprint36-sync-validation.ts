import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  eventRepository,
  importAggregationService,
  importEventPublishService,
} from '@/data/repositories/registry';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { TICKET_IO_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/ticket-io-source';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import type { SourceRecord } from '@/data/types/records';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint36_ticket_io_corpus_expansion.json',
);

async function countCanonical(): Promise<number> {
  const { count } = await getSupabaseServiceClient()
    .from('events')
    .select('*', { count: 'exact', head: true });
  return count ?? 0;
}

async function countDiscoverableTicketIo(): Promise<number> {
  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();
  return getDiscoverablePublishedEvents().filter((event) => event.ticketUrl?.includes('.ticket.io')).length;
}

async function countOrigins(sourceId: string): Promise<number> {
  const { count } = await getSupabaseServiceClient()
    .from('event_source_references')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', sourceId);
  return count ?? 0;
}

function isExpansionTicketIoSource(source: SourceRecord): boolean {
  return (
    source.sourceConfig?.ticketPlatform?.platform === 'ticket_io' &&
    source.id !== TICKET_IO_BOOTSHAUS_SOURCE_ID &&
    source.sourceConfig?.publishPolicy?.behavior === 'auto_publish'
  );
}

async function cancelStuckJobsForSource(sourceId: string): Promise<void> {
  const client = getSupabaseServiceClient();
  const { data: stuck } = await client
    .from('import_jobs')
    .select('id,status')
    .eq('source_id', sourceId)
    .in('status', ['running', 'pending']);
  for (const job of stuck ?? []) {
    await client
      .from('import_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
  }
}

async function runImport(source: SourceRecord, label: string) {
  await cancelStuckJobsForSource(source.id);
  const job = await importAggregationService.enqueueJob(source, 'manual', `sprint36:${label}`);
  return importAggregationService.executeExistingJob(job, source, { recordImportReputation: true });
}

async function main(): Promise<void> {
  await initializeEntityAliasStore();
  await eventRepository.refresh();

  const beforeCanonical = await countCanonical();
  const beforeDiscoverable = await countDiscoverableTicketIo();
  const sources = (await adminSourceRepository.getAll()).filter(isExpansionTicketIoSource);

  const syncResults: unknown[] = [];
  for (const source of sources) {
    const slug = source.sourceConfig?.ticketPlatform?.shopSlug ?? source.id;
    const run1 = await runImport(source, `${slug}-sync-1`);
    const run2 = await runImport(source, `${slug}-sync-2`);
    syncResults.push({
      sourceId: source.id,
      shopSlug: slug,
      publishBehavior: source.sourceConfig?.publishPolicy?.behavior,
      enabled: source.enabled,
      run1: run1.metrics,
      run2: run2.metrics,
      origins: await countOrigins(source.id),
      idempotent: (run2.metrics.createdCount ?? 0) === 0 && (run2.metrics.unchangedCount ?? 0) > 0,
    });
  }

  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();

  const afterCanonical = await countCanonical();
  const afterDiscoverable = await countDiscoverableTicketIo();

  const report = {
    sprint: 36,
    phase: 'ticket-io-corpus-expansion',
    command: 'npx tsx scripts/operations/_sprint36-sync-validation.ts',
    eventsBefore: { canonical: beforeCanonical, ticketIoDiscoverable: beforeDiscoverable },
    eventsAfter: { canonical: afterCanonical, ticketIoDiscoverable: afterDiscoverable },
    ticketIoShopsActivated: sources.map((source) => ({
      id: source.id,
      shopSlug: source.sourceConfig?.ticketPlatform?.shopSlug,
      enabled: source.enabled,
      scheduleEnabled: source.scheduleEnabled,
    })),
    synchronization: syncResults,
    metrics: {
      canonicalEventsCreated: afterCanonical - beforeCanonical,
      newlyDiscoverableTicketIo: afterDiscoverable - beforeDiscoverable,
      shopsActivated: sources.length,
      shopsDiscovered: sources.length,
      additionalPlatformsImplemented: 0,
    },
    passed: sources.length >= 3 && afterDiscoverable > beforeDiscoverable,
    finishedAt: new Date().toISOString(),
  };

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await flushEntityAliasStore();
  if (!report.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
