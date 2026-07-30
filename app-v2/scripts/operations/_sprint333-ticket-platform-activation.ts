/**
 * Sprint 33.3 — Ticket.io + Ticket Kings production activation validation.
 * Reuses importAggregationService; does not duplicate source rows if migrations applied.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { adminSourceRepository, importAggregationService } from '@/data/repositories/registry';
import { fetchTicketPlatformEvents } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-fetch';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import {
  TICKET_IO_BOOTSHAUS_SOURCE_ID,
  createBootshausTicketIoLiveProductionSourceRecord,
} from '@/features/sources/production/ticket-io-source';
import {
  TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
  createAffenkaefigTicketKingsLiveProductionSourceRecord,
} from '@/features/sources/production/ticket-kings-source';
import { getSupabaseServiceClient } from '@/services/supabase/client';
import type { SourceRecord } from '@/data/types/records';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/real-data/_sprint333_ticket_platform_activation.json');

const TICKET_SOURCE_IDS = [TICKET_IO_BOOTSHAUS_SOURCE_ID, TICKET_KINGS_AFFENKAEFIG_SOURCE_ID] as const;

async function loadProductionSource(sourceId: string): Promise<SourceRecord> {
  const record = await adminSourceRepository.getById(sourceId);
  if (!record) {
    throw new Error(
      `Source ${sourceId} not found. Apply migrations 20260763000000 / 20260764000000 before activation.`,
    );
  }
  return record;
}

async function validateSourceConfig(source: SourceRecord) {
  const ticketPlatform = source.sourceConfig?.ticketPlatform;
  const hasFixtureHtml = Boolean(source.sourceConfig?.reference?.html);
  return {
    sourceId: source.id,
    enabled: source.enabled,
    active: source.active,
    scheduleEnabled: source.scheduleEnabled,
    schedulePolicy: source.schedulePolicy,
    scheduleIntervalPreset: source.scheduleIntervalPreset,
    pollingIntervalMinutes: source.pollingIntervalMinutes,
    publishMode: source.publishMode,
    reviewRequired: source.reviewRequired,
    trustScore: source.trustScore,
    platform: ticketPlatform?.platform,
    shopSlug: ticketPlatform?.shopSlug,
    listUrl: ticketPlatform?.listUrl,
    requestsPerMinute: ticketPlatform?.limits?.requestsPerMinute,
    maxEventsPerRun: ticketPlatform?.limits?.maxEventsPerRun,
    hasFixtureHtml,
    connectorKey: source.connectorKey,
    credentialsRequired: false,
  };
}

async function runLiveFetch(source: SourceRecord) {
  const importSource = mapSourceRecordToImportSource(source);
  const events = await fetchTicketPlatformEvents({
    source: mapSourceRecordToAggregationSource(source),
    importSource,
    connectorKey: 'ticket_platform',
  });
  return {
    eventCount: events.length,
    sample: events.slice(0, 5).map((event) => ({
      externalId: event.externalId,
      title: event.title,
      startDate: event.startDate,
      ticketUrl: event.ticketUrl,
      priceAmount: event.priceAmount,
      priceCurrency: event.priceCurrency,
      platform: event.sourceMetadata?.platform,
    })),
  };
}

async function captureMetrics(sourceId: string, label: string) {
  const client = getSupabaseServiceClient();
  const [source, jobs, records, refs, reviews] = await Promise.all([
    client
      .from('sources')
      .select('id,enabled,schedule_enabled,trust_score,last_import_at,last_job_status,consecutive_failure_count')
      .eq('id', sourceId)
      .maybeSingle(),
    client
      .from('import_jobs')
      .select('id,status,fetched_count,created_count,updated_count,failed_count,duration_ms,created_at')
      .eq('source_id', sourceId)
      .order('created_at', { ascending: false })
      .limit(3),
    client
      .from('import_records')
      .select('id,external_id,status,duplicate_event_id,resulting_event_id', { count: 'exact' })
      .eq('source_id', sourceId),
    client
      .from('event_source_references')
      .select('id,canonical_event_id,external_event_id,metadata', { count: 'exact' })
      .eq('source_id', sourceId),
    client
      .from('import_review_queue')
      .select('id,status,external_id', { count: 'exact' })
      .eq('source_id', sourceId),
  ]);

  return {
    label,
    source: source.data,
    latestJobs: jobs.data ?? [],
    importRecordCount: records.count ?? 0,
    importRecordsSample: (records.data ?? []).slice(0, 8),
    sourceReferenceCount: refs.count ?? 0,
    sourceReferencesSample: (refs.data ?? []).slice(0, 5),
    reviewCount: reviews.count ?? 0,
  };
}

async function runImport(source: SourceRecord, label: string) {
  const job = await importAggregationService.enqueueJob(source, 'manual', `sprint333:${label}`);
  const completed = await importAggregationService.executeExistingJob(job, source, {
    recordImportReputation: true,
  });
  return {
    label,
    jobId: completed.id,
    status: completed.status,
    metrics: completed.metrics,
  };
}

async function validateOrigins(sourceId: string) {
  const client = getSupabaseServiceClient();
  const { data, error } = await client
    .from('event_source_references')
    .select('id,canonical_event_id,external_event_id,metadata,active')
    .eq('source_id', sourceId);
  if (error) {
    throw new Error(error.message);
  }
  const refs = data ?? [];
  const duplicateKeys = new Set<string>();
  const seen = new Set<string>();
  for (const ref of refs) {
    const key = `${ref.canonical_event_id}|${ref.external_event_id}`;
    if (seen.has(key)) {
      duplicateKeys.add(key);
    }
    seen.add(key);
  }
  const withTicketingRole = refs.filter((ref) => {
    const metadata = ref.metadata as Record<string, unknown> | null;
    return metadata?.role === 'ticketing';
  });
  return {
    total: refs.length,
    active: refs.filter((ref) => ref.active).length,
    withTicketingRole: withTicketingRole.length,
    duplicateKeys: [...duplicateKeys],
  };
}

async function activateSource(sourceId: string, factory: () => SourceRecord) {
  const section: Record<string, unknown> = { sourceId };
  const dbSource = await loadProductionSource(sourceId);
  section.config = await validateSourceConfig(dbSource);

  if (section.config && (section.config as { hasFixtureHtml: boolean }).hasFixtureHtml) {
    section.warning = 'source_config.reference.html present — live fetch bypasses fixture when html omitted at runtime';
  }

  section.metricsBefore = await captureMetrics(sourceId, 'before');
  section.liveFetch = await runLiveFetch(
    factory(),
  );

  section.importRun1 = await runImport(dbSource, 'run-1');
  section.metricsAfterRun1 = await captureMetrics(sourceId, 'after-run-1');
  section.originsAfterRun1 = await validateOrigins(sourceId);

  section.importRun2 = await runImport(dbSource, 'run-2');
  section.metricsAfterRun2 = await captureMetrics(sourceId, 'after-run-2');
  section.originsAfterRun2 = await validateOrigins(sourceId);

  const run1Created = (section.importRun1 as { metrics?: { createdCount?: number } }).metrics?.createdCount ?? 0;
  const run2Created = (section.importRun2 as { metrics?: { createdCount?: number } }).metrics?.createdCount ?? 0;
  section.idempotentSecondRun = run2Created === 0;
  section.passed =
    (section.liveFetch as { eventCount: number }).eventCount > 0 &&
    (section.importRun1 as { status: string }).status === 'completed' &&
    (section.importRun2 as { status: string }).status === 'completed' &&
    section.idempotentSecondRun === true &&
    (section.originsAfterRun2 as { duplicateKeys: string[] }).duplicateKeys.length === 0;

  return section;
}

async function main(): Promise<void> {
  const report: Record<string, unknown> = {
    sprint: '33.3',
    startedAt: new Date().toISOString(),
    sourceIds: TICKET_SOURCE_IDS,
  };

  await initializeEntityAliasStore();

  const { data: existing, error } = await getSupabaseServiceClient()
    .from('sources')
    .select('id')
    .in('id', [...TICKET_SOURCE_IDS]);
  if (error) {
    throw new Error(error.message);
  }
  report.sourcesPresent = (existing ?? []).map((row) => row.id);
  report.sourcesMissing = TICKET_SOURCE_IDS.filter(
    (id) => !(existing ?? []).some((row) => row.id === id),
  );

  if ((report.sourcesMissing as string[]).length > 0) {
    report.passed = false;
    report.blocker = 'Ticket platform migrations not applied in production database.';
    writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  report.ticketIo = await activateSource(
    TICKET_IO_BOOTSHAUS_SOURCE_ID,
    createBootshausTicketIoLiveProductionSourceRecord,
  );
  report.ticketKings = await activateSource(
    TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
    createAffenkaefigTicketKingsLiveProductionSourceRecord,
  );

  await flushEntityAliasStore();

  report.passed =
    (report.ticketIo as { passed: boolean }).passed && (report.ticketKings as { passed: boolean }).passed;
  report.completedAt = new Date().toISOString();

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (!report.passed) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
