/**
 * Phase 4.3.4 — Full historical production repair (all enabled active sources).
 * Run: npx tsx scripts/operations/_sprint434-historical-production-repair.ts
 * Run: npx tsx scripts/operations/_sprint434-historical-production-repair.ts --run=2
 */
import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_sprint434-historical-production-repair.ts');

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  eventRepository,
  importAggregationService,
} from '@/data/repositories/registry';
import {
  flushEntityAliasStore,
  initializeEntityAliasStore,
} from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { clearEventDetailCache } from '@/features/event-detail/feed/discovery-event-detail-client';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { formatDisplayPriceText } from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import { eventHasWrongBootshausExternalVenue } from '@/features/import/services/historical-data-repair';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { ImportJobActiveSnippet } from './ops-supabase-rows';
import { opsClient, updateImportJobRow, updateSourceRow } from './ops-supabase-rows';
import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint434_historical_production_repair.json',
);

const REPAIR_ACTOR = 'sprint434-historical-repair';

async function releaseActiveImportJobs(sourceIds: string[]): Promise<number> {
  const client = opsClient();
  const { data: activeJobs, error } = await client
    .from('import_jobs')
    .select('id,source_id,status')
    .in('source_id', sourceIds.length > 0 ? sourceIds : ['__none__'])
    .in('status', ['pending', 'running']);
  if (error) {
    throw new Error(error.message);
  }

  let released = 0;
  for (const job of (activeJobs ?? []) as ImportJobActiveSnippet[]) {
    await updateImportJobRow(job.id, {
      status: 'failed',
      finished_at: new Date().toISOString(),
    });
    released += 1;
  }
  return released;
}

async function listRepairSourceIds(): Promise<string[]> {
  const sources = await adminSourceRepository.getAll();
  return sources
    .filter((source) => source.enabled && !source.archived)
    .map((source) => source.id)
    .sort();
}

async function activateHistoricalRepairMetadata(sourceIds: string[]): Promise<number> {
  const client = opsClient();
  let updated = 0;
  for (const sourceId of sourceIds) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source) {
      continue;
    }
    const metadata = {
      ...(source.metadata ?? {}),
      historicalRepairVersion: '4.3.4',
      dataQualityRepairVersion: '4.3.4',
    };
    await updateSourceRow(sourceId, { metadata });
    updated += 1;
  }
  return updated;
}

async function snapshotMetrics() {
  const client = opsClient();
  const { data: events, error } = await client
    .from('events')
    .select('*')
    .eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }

  const rows = (events ?? []) as EventRow[];
  const isNa = (value: string | null | undefined) => !value?.trim() || /^n\/a$/i.test(value.trim());

  const { count: lineupRows } = await client
    .from('event_artists')
    .select('*', { count: 'exact', head: true });

  let wrongBootshausExternal = 0;
  let missingLineupWithTitleArtists = 0;
  for (const row of rows) {
    const admin = mapEventRowToAdminRecord(row);
    if (eventHasWrongBootshausExternalVenue(admin)) {
      wrongBootshausExternal += 1;
    }
  }

  return {
    publishedEvents: rows.length,
    realDescription: rows.filter((row) => row.description?.trim() && !isNa(row.description)).length,
    emptyDescription: rows.filter((row) => isNa(row.description)).length,
    withPriceText: rows.filter((row) => Boolean(row.price_text?.trim())).length,
    withTicketUrl: rows.filter((row) => Boolean(row.ticket_url?.trim())).length,
    withImage: rows.filter((row) => Boolean(row.image_url?.trim())).length,
    lineupRowCount: lineupRows ?? 0,
    wrongBootshausExternalVenue: wrongBootshausExternal,
    missingLineupWithTitleArtists,
  };
}

async function runRepairPass(label: string, sourceIds: string[]) {
  const results = [];
  for (const sourceId of sourceIds) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source) {
      results.push({ sourceId, skipped: true, reason: 'source_not_found' });
      continue;
    }
    if (!source.enabled || source.archived) {
      results.push({ sourceId, skipped: true, reason: 'source_inactive' });
      continue;
    }

    const job = await importAggregationService.enqueueJob(source, 'manual', `${REPAIR_ACTOR}:${label}`);
    const executed = await importAggregationService.executeExistingJob(job, source, {
      recordImportReputation: false,
    });
    results.push({
      sourceId,
      jobId: executed.id,
      status: executed.status,
      fetchedCount: executed.metrics.fetchedCount,
      createdCount: executed.metrics.createdCount,
      updatedCount: executed.metrics.updatedCount,
      unchangedCount: executed.metrics.unchangedCount,
      duplicateCount: executed.metrics.duplicateCount,
    });
  }

  clearEventDetailCache();
  await eventRepository.refresh();
  return results;
}

async function parityCheck() {
  const events = eventRepository.getPublishedEvents().slice(0, 200);
  let mismatches = 0;
  for (const event of events) {
    const projection = projectCanonicalEventFields({
      title: event.title,
      description: event.description,
      venue: event.venue,
      city: event.city,
      artists: event.artists,
      lineup: event.lineup,
      priceText: event.priceText,
      source: event.source,
      ticketUrl: event.ticketUrl,
    });
    const cardTicketLabel = projection.displayPriceText ?? event.priceText;
    const formattedPrice = formatDisplayPriceText(event.priceText) ?? event.priceText;
    if ((cardTicketLabel ?? '') !== (formattedPrice ?? '')) {
      mismatches += 1;
    }
  }
  return { sampled: events.length, priceParityMismatches: mismatches };
}

async function main(): Promise<void> {
  const runArg = process.argv.find((arg) => arg.startsWith('--run='));
  const runNumber = runArg ? Number(runArg.split('=')[1]) : 1;

  try {
    await initializeEntityAliasStore();
  } catch (error) {
    console.warn(
      'Entity alias store init failed; continuing repair.',
      error instanceof Error ? error.message : error,
    );
  }

  const sourceIds = await listRepairSourceIds();
  const releasedJobs = await releaseActiveImportJobs(sourceIds);
  const metadataStamped = await activateHistoricalRepairMetadata(sourceIds);
  const before = await snapshotMetrics();
  const repairResults = await runRepairPass(`run-${runNumber}`, sourceIds);

  try {
    await flushEntityAliasStore();
  } catch (error) {
    console.warn('Entity alias store flush failed.', error instanceof Error ? error.message : error);
  }

  const after = await snapshotMetrics();
  const parity = await parityCheck();

  const report = {
    generatedAt: new Date().toISOString(),
    runNumber,
    repairVersion: '4.3.4',
    releasedJobs,
    metadataStamped,
    sourceCount: sourceIds.length,
    sourceIds,
    before,
    after,
    delta: {
      realDescription: after.realDescription - before.realDescription,
      emptyDescription: after.emptyDescription - before.emptyDescription,
      withPriceText: after.withPriceText - before.withPriceText,
      lineupRowCount: after.lineupRowCount - before.lineupRowCount,
      wrongBootshausExternalVenue:
        after.wrongBootshausExternalVenue - before.wrongBootshausExternalVenue,
    },
    repairResults,
    parity,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
