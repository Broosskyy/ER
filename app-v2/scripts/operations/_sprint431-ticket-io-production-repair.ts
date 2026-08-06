/**
 * Phase 4.3.1 — Safe Ticket.io production repair (run twice for idempotency check).
 * Run: npx tsx scripts/operations/_sprint431-ticket-io-production-repair.ts
 * Run: npx tsx scripts/operations/_sprint431-ticket-io-production-repair.ts --run=2
 */
import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_sprint431-ticket-io-production-repair.ts');

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  eventRepository,
  importAggregationService,
} from '@/data/repositories/registry';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import type { EventRepairMetricsSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint431_ticket_io_production_repair.json',
);

const REPAIR_SOURCES = [
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
  'source-bootshaus-ticket-io',
];

const REPAIR_ACTOR = 'sprint431-ticket-io-repair';

async function snapshotMetrics() {
  const client = opsClient();
  const { data: events, error } = await client
    .from('events')
    .select('id,description,price_text,ticket_url,image_url,status,source_id')
    .in('source_id', REPAIR_SOURCES);
  if (error) {
    throw new Error(error.message);
  }

  const rows = (events ?? []) as EventRepairMetricsSnippet[];
  const isNa = (value: string | null | undefined) => !value?.trim() || /^n\/a$/i.test(value.trim());

  const { count: lineupRows } = await client
    .from('event_artists')
    .select('*', { count: 'exact', head: true })
    .in(
      'event_id',
      rows.map((row) => row.id),
    );

  return {
    eventCount: rows.length,
    published: rows.filter((row) => row.status === 'published').length,
    realDescription: rows.filter((row) => row.description?.trim() && !isNa(row.description)).length,
    naDescription: rows.filter((row) => isNa(row.description)).length,
    withPriceText: rows.filter((row) => Boolean(row.price_text?.trim())).length,
    withTicketUrl: rows.filter((row) => Boolean(row.ticket_url?.includes('.ticket.io/'))).length,
    withImage: rows.filter((row) => Boolean(row.image_url?.trim())).length,
    lineupRowCount: lineupRows ?? 0,
  };
}

async function runRepairPass(label: string) {
  const results = [];
  for (const sourceId of REPAIR_SOURCES) {
    const source = await adminSourceRepository.getById(sourceId);
    if (!source) {
      results.push({ sourceId, skipped: true, reason: 'source_not_found' });
      continue;
    }
    if (!source.enabled) {
      results.push({ sourceId, skipped: true, reason: 'source_disabled' });
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
      connectorVersion: executed.metrics.connectorVersion,
    });
  }

  await eventRepository.refresh();
  return results;
}

async function main(): Promise<void> {
  const runArg = process.argv.find((arg) => arg.startsWith('--run='));
  const runNumber = runArg ? Number(runArg.split('=')[1]) : 1;

  try {
    await initializeEntityAliasStore();
  } catch (error) {
    console.warn(
      'Entity alias store init failed; continuing repair without preloaded aliases.',
      error instanceof Error ? error.message : error,
    );
  }
  const before = await snapshotMetrics();

  const repairResults = await runRepairPass(`run-${runNumber}`);
  try {
    await flushEntityAliasStore();
  } catch (error) {
    console.warn(
      'Entity alias store flush failed; repair results may still be persisted.',
      error instanceof Error ? error.message : error,
    );
  }

  const after = await snapshotMetrics();
  const discoverable = getDiscoverablePublishedEvents().filter((event) =>
    REPAIR_SOURCES.some((sourceId) => event.source === sourceId),
  );

  const sample = discoverable
    .filter(
      (event) =>
        event.title.includes('SHOCKONE') ||
        event.title.includes('Saltysis') ||
        event.title.includes('WESTBAM'),
    )
    .map((event) => ({
      id: event.id,
      title: event.title,
      description: event.description,
      priceText: event.priceText,
      ticketUrl: event.ticketUrl,
      artists: event.artists,
      lineup: event.lineup,
      genres: event.genres,
      source: event.source,
    }));

  const report = {
    generatedAt: new Date().toISOString(),
    runNumber,
    before,
    after,
    delta: {
      realDescription: after.realDescription - before.realDescription,
      naDescription: after.naDescription - before.naDescription,
      withPriceText: after.withPriceText - before.withPriceText,
      lineupRowCount: after.lineupRowCount - before.lineupRowCount,
    },
    repairResults,
    publicSamples: sample,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Wrote ${OUT}`);
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
