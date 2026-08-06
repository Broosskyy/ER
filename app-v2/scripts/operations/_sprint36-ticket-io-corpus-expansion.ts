/**
 * Sprint 36 / Phase 4 — Ticket.io corpus expansion (live production).
 * Run: npx tsx scripts/operations/_sprint36-ticket-io-corpus-expansion.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  eventRepository,
  importAggregationService,
  importEventPublishService,
  ticketIoCorpusExpansionService,
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

const VALIDATION_ACTOR = 'sprint36-corpus-expansion';

async function countCanonicalEvents(): Promise<number> {
  const { count, error } = await getSupabaseServiceClient()
    .from('events')
    .select('*', { count: 'exact', head: true });
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function countTicketIoDiscoverable(): Promise<number> {
  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();
  return getDiscoverablePublishedEvents().filter((event) => event.ticketUrl?.includes('.ticket.io')).length;
}

async function countOriginsForSource(sourceId: string): Promise<number> {
  const { count, error } = await getSupabaseServiceClient()
    .from('event_source_references')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', sourceId);
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function runImport(source: SourceRecord, label: string) {
  const job = await importAggregationService.enqueueJob(source, 'manual', `${VALIDATION_ACTOR}:${label}`);
  const completed = await importAggregationService.executeExistingJob(job, source, {
    recordImportReputation: true,
  });
  return completed;
}

async function listTicketIoSources(): Promise<SourceRecord[]> {
  const sources = await adminSourceRepository.getAll();
  return sources.filter(
    (source) =>
      source.sourceConfig?.ticketPlatform?.platform === 'ticket_io' &&
      source.id !== TICKET_IO_BOOTSHAUS_SOURCE_ID,
  );
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    sprint: '36',
    phase: 'ticket-io-corpus-expansion',
    command: 'npx tsx scripts/operations/_sprint36-ticket-io-corpus-expansion.ts',
    startedAt: new Date().toISOString(),
    errors: [] as string[],
    warnings: [] as string[],
  };

  await initializeEntityAliasStore();
  await eventRepository.refresh();

  report.eventsBefore = {
    canonical: await countCanonicalEvents(),
    ticketIoDiscoverable: await countTicketIoDiscoverable(),
    ticketIoSources: (await listTicketIoSources()).length,
  };

  const discovery = await ticketIoCorpusExpansionService.discoverQualifiedShops('admin');
  report.discovery = {
    corpus: discovery.corpus,
    shopsDiscovered: discovery.discoveredShops.length,
    shops: discovery.discoveredShops.map((entry) => ({
      shopSlug: entry.candidate.shopSlug,
      listUrl: entry.candidate.listUrl,
      eventCount: entry.candidate.eventCount,
      tier: entry.qualification.tier,
      acceptanceRate: entry.qualification.acceptanceRate,
      publishBehavior: entry.qualification.recommendedPublishBehavior,
      reasons: entry.qualification.reasons,
      warnings: entry.probeWarnings,
    })),
    limitations: discovery.limitations,
  };

  const activation = await ticketIoCorpusExpansionService.discoverAndActivateShops('admin', {
    minTier: 'relevant',
    maxActivations: 8,
  });
  report.activation = {
    activatedCount: activation.activatedSources.length,
    activatedSources: activation.activatedSources.map((source) => ({
      id: source.id,
      shopSlug: source.sourceConfig?.ticketPlatform?.shopSlug,
      publishBehavior: source.sourceConfig?.publishPolicy?.behavior,
      enabled: source.enabled,
      scheduleEnabled: source.scheduleEnabled,
    })),
    skipped: activation.skippedShops,
  };

  const syncResults: unknown[] = [];
  const activatedSources = await listTicketIoSources();
  for (const source of activatedSources) {
    const shopSlug = source.sourceConfig?.ticketPlatform?.shopSlug ?? source.id;
    const run1 = await runImport(source, `${shopSlug}-run-1`);
    const run2 = await runImport(source, `${shopSlug}-run-2`);
    const origins = await countOriginsForSource(source.id);
    syncResults.push({
      sourceId: source.id,
      shopSlug,
      run1: { jobId: run1.id, status: run1.status, metrics: run1.metrics },
      run2: { jobId: run2.id, status: run2.status, metrics: run2.metrics },
      origins,
      idempotent:
        (run2.metrics.createdCount ?? 0) === 0 &&
        ((run2.metrics.unchangedCount ?? 0) > 0 || (run2.metrics.updatedCount ?? 0) === 0),
    });
  }
  report.synchronization = syncResults;

  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();

  const canonicalAfter = await countCanonicalEvents();
  const discoverableAfter = await countTicketIoDiscoverable();
  report.eventsAfter = {
    canonical: canonicalAfter,
    ticketIoDiscoverable: discoverableAfter,
    ticketIoSources: activatedSources.length,
  };

  report.metrics = {
    canonicalEventsCreated: canonicalAfter - (report.eventsBefore as { canonical: number }).canonical,
    newlyDiscoverableTicketIo:
      discoverableAfter - (report.eventsBefore as { ticketIoDiscoverable: number }).ticketIoDiscoverable,
    shopsDiscovered: discovery.discoveredShops.length,
    shopsActivated: activation.activatedSources.length,
    additionalPlatformsImplemented: 0,
    originsCreated: syncResults.reduce(
      (sum, entry) => sum + ((entry as { origins: number }).origins ?? 0),
      0,
    ),
  };

  report.passed =
    (report.errors as string[]).length === 0 &&
    discovery.discoveredShops.length >= 3 &&
    activation.activatedSources.length >= 3 &&
    (report.metrics as { canonicalEventsCreated: number }).canonicalEventsCreated > 0;

  report.finishedAt = new Date().toISOString();
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  try {
    await flushEntityAliasStore();
  } catch (error) {
    (report.warnings as string[]).push(error instanceof Error ? error.message : String(error));
  }

  if (!report.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exit(1);
});
