/**
 * Phase 4.5 — Bootshaus detail extraction production activation.
 * Read-only probe → controlled import (x2) via importAggregationService.
 *
 * Usage:
 *   npx tsx scripts/operations/_sprint45-bootshaus-detail-activation.ts
 *   npx tsx scripts/operations/_sprint45-bootshaus-detail-activation.ts --probe-only
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import {
  adminSourceRepository,
  importAggregationService,
} from '@/data/repositories/registry';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import { TICKET_IO_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/ticket-io-source.core';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { EventDescriptionSampleSnippet } from './ops-supabase-rows';
import { opsClient } from './ops-supabase-rows';
import type { SourceRecord } from '@/data/types/records';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';

const BOOTSHAUS_SOURCE_ID = 'source-bootshaus-koeln';
const ACTOR = 'sprint45-bootshaus-detail-activation';
const MIGRATION_FILE = '20260801000000_sprint45_bootshaus_detail_extraction.sql';
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint45_bootshaus_detail_activation.json',
);

const SAMPLE_MATCHERS = [
  { key: 'play_open_air', needle: /play!\s*open\s*air/i, label: 'PLAY! Open Air' },
  { key: 'sommerfest', needle: /sommerfest/i, label: 'Bootshaus Sommerfest' },
  { key: 'club_event', needle: /loonyland|nature\s*one/i, label: 'Normal club event (LOONYLAND)' },
  { key: 'mallorca', needle: /mallorca/i, label: 'External location (Mallorca)' },
] as const;

const probeOnly = process.argv.includes('--probe-only');

function summarizeText(value: string | undefined | null): {
  length: number;
  meaningful: boolean;
  preview?: string;
} {
  const text = meaningfulEventText(value ?? undefined);
  return {
    length: (value ?? '').length,
    meaningful: Boolean(text),
    preview: text?.slice(0, 160),
  };
}

async function verifyMigration(source: SourceRecord) {
  const website = source.sourceConfig?.website as WebsiteConnectorConfig | undefined;
  const maxDetailPages = website?.limits?.maxDetailPages ?? 0;
  const allowedDomains = website?.eventDetailPage?.allowedDomains ?? [];
  const applied =
    maxDetailPages >= 50 &&
    allowedDomains.some((domain) => domain.includes('bootshaus.tv'));

  return {
    migrationFile: MIGRATION_FILE,
    applied,
    maxDetailPages,
    allowedDomains,
    ready: applied,
    note: applied
      ? 'Production source_config reflects Sprint 4.5 detail extraction.'
      : `Apply ${MIGRATION_FILE} in Supabase before import.`,
  };
}

async function loadBootshausSource(): Promise<SourceRecord> {
  const source = await adminSourceRepository.getById(BOOTSHAUS_SOURCE_ID);
  if (!source) {
    throw new Error(`${BOOTSHAUS_SOURCE_ID} not found in production.`);
  }
  return source;
}

async function runLiveProbe(source: SourceRecord) {
  const importSource = mapSourceRecordToImportSource(source);
  const url = source.baseUrl ?? source.website ?? 'https://bootshaus.tv/events/';
  const output = await websiteProcessor.process({
    url,
    importSource,
    connectorKey: source.connectorKey ?? 'club_website',
  });

  const listEvents = output.result.events;
  const detailUrls = listEvents
    .map((event) => event.detailUrl ?? event.sourceUrl)
    .filter((value): value is string => Boolean(value));
  const withDescription = listEvents.filter((event) => meaningfulEventText(event.rawDescription));
  const failedDetail = listEvents.filter((event) =>
    event.warnings.some((warning) => warning.includes('detail') && warning.includes('fail')),
  );

  return {
    listEventsDiscovered: listEvents.length,
    detailUrlsDiscovered: detailUrls.length,
    detailPagesFetched: output.result.diagnostics.detailPagesFetched,
    descriptionsExtracted: withDescription.length,
    failedDetailPages: failedDetail.length,
    strategy: output.result.diagnostics.strategy,
    warnings: output.result.diagnostics.warnings,
    events: listEvents.map((event) => ({
      title: event.title,
      externalId: event.externalId,
      detailUrl: event.detailUrl,
      description: summarizeText(event.rawDescription),
      warnings: event.warnings,
    })),
    rawImported: output.events as RawImportedEvent[],
  };
}

async function findCanonicalByTitle(needle: RegExp): Promise<EventRow | null> {
  const client = opsClient();
  const { data } = await client
    .from('events')
    .select('*')
    .eq('status', 'published')
    .ilike('title', '%bootshaus%')
    .limit(50);
  const eventRows = (data ?? []) as EventRow[];
  const row = eventRows.find((event) => needle.test(event.title ?? ''));
  if (!row) {
    const { data: broad } = await client.from('events').select('*').eq('status', 'published').limit(200);
    return ((broad ?? []) as EventRow[]).find((event) => needle.test(event.title ?? '')) ?? null;
  }
  return row;
}

async function loadTicketIoSnapshot(eventId: string) {
  const client = opsClient();
  const { data: origins } = await client
    .from('event_origins')
    .select('id,source_id,ticket_url,price_text,metadata')
    .eq('event_id', eventId)
    .eq('source_id', TICKET_IO_BOOTSHAUS_SOURCE_ID);
  return origins ?? [];
}

async function buildSampleValidation(
  probe: Awaited<ReturnType<typeof runLiveProbe>>,
  source: SourceRecord,
) {
  const samples = [];
  for (const matcher of SAMPLE_MATCHERS) {
    const listEvent = probe.events.find((event) => matcher.needle.test(event.title ?? ''));
    const imported = probe.rawImported.find((event) => matcher.needle.test(event.title ?? ''));
    const canonicalRow = await findCanonicalByTitle(matcher.needle);
    const ticketIoBefore = canonicalRow ? await loadTicketIoSnapshot(String(canonicalRow.id)) : [];

    const proposedDescription = imported?.description;
    const currentDescription = canonicalRow?.description ?? undefined;
    const wouldChangeDescription =
      Boolean(meaningfulEventText(proposedDescription)) &&
      !meaningfulEventText(currentDescription);

    samples.push({
      key: matcher.key,
      label: matcher.label,
      list: listEvent ?? null,
      detailDescription: listEvent?.description ?? null,
      normalized: imported
        ? {
            title: imported.title,
            description: summarizeText(imported.description),
            venueName: imported.venueName,
            cityName: imported.cityName,
            externalId: imported.externalId,
          }
        : null,
      canonical: canonicalRow
        ? {
            id: canonicalRow.id,
            title: canonicalRow.title,
            description: summarizeText(
              typeof canonicalRow.description === 'string' ? canonicalRow.description : undefined,
            ),
            venueName: canonicalRow.venue_name,
            cityName: canonicalRow.venue_city,
            ticketUrl: canonicalRow.ticket_url,
            priceText: canonicalRow.price_text,
          }
        : null,
      ticketIoOriginsBefore: ticketIoBefore,
      proposedUpdate: {
        wouldChangeDescription,
        proposedDescriptionPreview: summarizeText(
          typeof proposedDescription === 'string' ? proposedDescription : undefined,
        ),
      },
    });
  }
  return samples;
}

async function assessDuplicateRisk(probe: Awaited<ReturnType<typeof runLiveProbe>>) {
  const client = opsClient();
  const externalIds = probe.rawImported.map((event) => event.externalId).filter(Boolean);
  const { data: existingRecords } = await client
    .from('import_records')
    .select('external_id,resulting_event_id,status')
    .eq('source_id', BOOTSHAUS_SOURCE_ID)
    .in('external_id', externalIds.length > 0 ? externalIds : ['__none__']);

  const matched = (existingRecords ?? []).length;
  const unmatched = externalIds.length - matched;

  return {
    probeExternalIds: externalIds.length,
    existingImportRecordMatches: matched,
    unmatchedExternalIds: unmatched,
    duplicateRisk: unmatched > externalIds.length * 0.2 ? 'elevated' : 'low',
    expectedCanonicalMatches: matched,
  };
}

function probeIsClean(
  migration: Awaited<ReturnType<typeof verifyMigration>>,
  probe: Awaited<ReturnType<typeof runLiveProbe>>,
  duplicateRisk: Awaited<ReturnType<typeof assessDuplicateRisk>>,
): { clean: boolean; reasons: string[] } {
  const reasons: string[] = [];
  if (!migration.ready) reasons.push('migration_not_applied');
  if (probe.listEventsDiscovered < 1) reasons.push('no_list_events');
  if (probe.descriptionsExtracted < 1) reasons.push('no_descriptions_extracted');
  if (duplicateRisk.duplicateRisk === 'elevated') reasons.push('elevated_duplicate_risk');
  return { clean: reasons.length === 0, reasons };
}

async function captureMetrics(label: string) {
  const client = opsClient();
  const [
    canonicalCount,
    originCount,
    bootshausRecords,
    bootshausRefs,
    descriptions,
    duplicates,
  ] = await Promise.all([
    client.from('events').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    client.from('event_origins').select('id', { count: 'exact', head: true }),
    client
      .from('import_records')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', BOOTSHAUS_SOURCE_ID),
    client
      .from('event_source_references')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', BOOTSHAUS_SOURCE_ID),
    client
      .from('events')
      .select('id,title,description,venue_name,city_name,updated_at')
      .eq('status', 'published')
      .or('title.ilike.%PLAY!%,title.ilike.%Sommerfest%,title.ilike.%Mallorca%,title.ilike.%LOONYLAND%')
      .limit(20),
    client
      .from('import_records')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', BOOTSHAUS_SOURCE_ID)
      .eq('status', 'duplicate'),
  ]);

  return {
    label,
    capturedAt: new Date().toISOString(),
    canonicalPublishedCount: canonicalCount.count ?? 0,
    originCount: originCount.count ?? 0,
    bootshausImportRecords: bootshausRecords.count ?? 0,
    bootshausSourceReferences: bootshausRefs.count ?? 0,
    duplicateImportRecords: duplicates.count ?? 0,
    sampleDescriptions: ((descriptions.data ?? []) as EventDescriptionSampleSnippet[]).map((row) => ({
      id: row.id,
      title: row.title,
      description: summarizeText(row.description),
      venueName: row.venue_name,
      cityName: row.city_name ?? undefined,
      updatedAt: row.updated_at,
    })),
  };
}

async function runProductionImport(source: SourceRecord, label: string) {
  const job = await importAggregationService.enqueueJob(source, 'manual', `${ACTOR}:${label}`);
  const completed = await importAggregationService.executeExistingJob(job, source, {
    recordImportReputation: true,
  });
  const client = opsClient();
  const { data: jobRow } = await client
    .from('import_jobs')
    .select(
      'id,status,fetched_count,created_count,updated_count,duplicate_count,unchanged_count,warning_count,error_count',
    )
    .eq('id', completed.id)
    .maybeSingle();
  return {
    label,
    jobId: completed.id,
    status: completed.status,
    metrics: completed.metrics,
    dbRow: jobRow,
  };
}

async function verifyPostImport(before: Awaited<ReturnType<typeof captureMetrics>>) {
  const after = await captureMetrics('after-import');
  const client = opsClient();
  const { data: ticketIoOrigins } = await client
    .from('event_origins')
    .select('event_id,ticket_url,price_text,source_id')
    .eq('source_id', TICKET_IO_BOOTSHAUS_SOURCE_ID)
    .limit(20);

  const descriptionsGained = after.sampleDescriptions.filter((sample) => sample.description.meaningful).length;
  const canonicalDelta = after.canonicalPublishedCount - before.canonicalPublishedCount;
  const originDelta = after.originCount - before.originCount;

  return {
    after,
    canonicalCountDelta: canonicalDelta,
    originCountDelta: originDelta,
    descriptionsPopulatedInSamples: descriptionsGained,
    ticketIoOriginsSample: ticketIoOrigins ?? [],
    noNewCanonicalEvents: canonicalDelta === 0,
    noNewOrigins: originDelta === 0,
    duplicateImportRecords: after.duplicateImportRecords,
  };
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    phase: '4.5-bootshaus-detail-activation',
    sourceId: BOOTSHAUS_SOURCE_ID,
    probeOnly,
  };

  await initializeEntityAliasStore();

  const beforeMetrics = await captureMetrics('before');
  report.before = beforeMetrics;

  let source = await loadBootshausSource();
  const migration = await verifyMigration(source);
  report.migration = migration;
  if (!migration.ready) {
    throw new Error(
      `Migration ${MIGRATION_FILE} not applied (maxDetailPages=${migration.maxDetailPages}). Apply manually or set DATABASE_URL.`,
    );
  }

  source = await loadBootshausSource();
  const probe = await runLiveProbe(source);
  report.probe = {
    listEventsDiscovered: probe.listEventsDiscovered,
    detailUrlsDiscovered: probe.detailUrlsDiscovered,
    detailPagesFetched: probe.detailPagesFetched,
    descriptionsExtracted: probe.descriptionsExtracted,
    failedDetailPages: probe.failedDetailPages,
    strategy: probe.strategy,
    warnings: probe.warnings,
  };
  report.probeEvents = probe.events;

  report.sampleValidation = await buildSampleValidation(probe, source);
  report.duplicateRisk = await assessDuplicateRisk(probe);
  report.probeGate = probeIsClean(migration, probe, report.duplicateRisk as Awaited<ReturnType<typeof assessDuplicateRisk>>);

  if (probeOnly) {
    report.completedAt = new Date().toISOString();
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    await flushEntityAliasStore();
    return;
  }

  const gate = report.probeGate as { clean: boolean; reasons: string[] };
  if (!gate.clean) {
    report.importSkipped = true;
    report.skipReasons = gate.reasons;
    report.completedAt = new Date().toISOString();
    writeFileSync(OUT, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    throw new Error(`Probe gate failed: ${gate.reasons.join(', ')}`);
  }

  report.importRun1 = await runProductionImport(source, 'run-1');
  report.postImport1 = await verifyPostImport(beforeMetrics);

  report.importRun2 = await runProductionImport(source, 'run-2-idempotency');
  const afterRun2 = await captureMetrics('after-run-2');
  report.afterRun2 = afterRun2;
  report.idempotency = {
    run2CreatedCount: (report.importRun2 as { metrics: { createdCount?: number } }).metrics?.createdCount ?? 0,
    run2UpdatedCount: (report.importRun2 as { metrics: { updatedCount?: number } }).metrics?.updatedCount ?? 0,
    run2UnchangedCount: (report.importRun2 as { metrics: { unchangedCount?: number } }).metrics?.unchangedCount ?? 0,
    canonicalCountStable:
      afterRun2.canonicalPublishedCount === (report.postImport1 as { after: { canonicalPublishedCount: number } }).after.canonicalPublishedCount,
    originCountStable:
      afterRun2.originCount === (report.postImport1 as { after: { originCount: number } }).after.originCount,
  };

  report.sampleValidationAfter = await buildSampleValidation(
    await runLiveProbe(source),
    source,
  );

  report.completedAt = new Date().toISOString();
  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  await flushEntityAliasStore();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await flushEntityAliasStore();
  } catch {
    // ignore
  }
  process.exit(1);
});
