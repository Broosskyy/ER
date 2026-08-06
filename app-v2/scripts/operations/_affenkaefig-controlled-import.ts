/**
 * Sprint 28.2 — Affenkäfig controlled live import (ops, service role).
 * Does NOT enable scheduler or auto-publish.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { importAggregationService } from '@/data/repositories/registry';
import { mapSourceRecordToRow } from '@/data/mappers/source-mapper';
import {
  compareAffenkaefigDryRunIdempotency,
  runAffenkaefigLiveFetch,
  summarizePublishReadiness,
} from '@/features/sources/production/affenkaefig-controlled-import';
import { createAffenkaefigLiveProductionSourceRecord } from '@/features/sources/production/affenkaefig-source';

const SOURCE_ID = 'source-affenkaefig';

async function ensureAffenkaefigSourceRow() {
  const client = getSupabaseServiceClient();
  const { data: existing } = await client.from('sources').select('id').eq('id', SOURCE_ID).maybeSingle();
  if (existing) {
    return { seeded: false };
  }

  const record = createAffenkaefigLiveProductionSourceRecord({
    enabled: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    scheduleEnabled: false,
    schedulePolicy: 'manual_only',
    scheduleIntervalPreset: 'manual',
    scheduleTimezone: 'Europe/Berlin',
    consecutiveFailureCount: 0,
    totalImportCount: 0,
    totalValidEventCount: 0,
    totalRejectedEventCount: 0,
    duplicateRate: 0,
    updateRate: 0,
    errorRate: 0,
    schedulerMaintenanceMode: false,
    metadata: {
      connectorKey: 'organizer_website',
      officialDomain: 'affenkaefig.info',
      legacyDomain: 'affenkaefig.de',
      organizerName: 'Affenkäfig',
      organizerId: 'organizer-affenkaefig',
      genreNames: ['Techno', 'House', 'Electronic'],
      tags: ['organizer', 'festival', 'koeln', 'production-source', 'sprint282'],
    },
  });
  const payload = mapSourceRecordToRow(record) as Record<string, unknown>;
  for (const optionalColumn of [
    'last_error',
    'computed_trust_score',
    'trust_score_updated_at',
    'source_roles',
    'publish_mode',
    'country_code',
  ]) {
    delete payload[optionalColumn];
  }
  payload.enabled = false;
  payload.active = false;
  payload.schedule_enabled = false;
  payload.schedule_policy = 'manual_only';
  payload.schedule_timezone = 'Europe/Berlin';
  payload.schedule_interval_preset = 'manual';
  payload.polling_interval_minutes = 360;
  payload.review_required = true;
  payload.publish_mode = 'manual_review';
  payload.consecutive_failure_count ??= 0;
  payload.total_import_count ??= 0;
  payload.total_valid_event_count ??= 0;
  payload.total_rejected_event_count ??= 0;
  payload.duplicate_rate ??= 0;
  payload.update_rate ??= 0;
  payload.error_rate ??= 0;

  const { error } = await client.from('sources').upsert(payload, { onConflict: 'id' });
  if (error) {
    throw new Error(`affenkaefig source seed failed: ${error.message}`);
  }
  return { seeded: true };
}

async function readSourceFlags() {
  const { data, error } = await getSupabaseServiceClient()
    .from('sources')
    .select('id,enabled,schedule_enabled,publish_mode,review_required')
    .eq('id', SOURCE_ID)
    .maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data;
}

async function captureDbMetrics(label: string) {
  const client = getSupabaseServiceClient();
  const [source, jobs, records, reviews, events, published] = await Promise.all([
    client.from('sources').select('enabled,schedule_enabled,publish_mode').eq('id', SOURCE_ID).maybeSingle(),
    client
      .from('import_jobs')
      .select('id,status,created_count,updated_count,fetched_count,created_at')
      .eq('source_id', SOURCE_ID)
      .order('created_at', { ascending: false })
      .limit(3),
    client.from('import_records').select('id,external_id,status,duplicate_event_id', { count: 'exact' }).eq('source_id', SOURCE_ID),
    client
      .from('import_review_queue')
      .select('id,status,external_id', { count: 'exact' })
      .eq('source_id', SOURCE_ID),
    client.from('events').select('id,status,title,source_id', { count: 'exact' }).eq('source_id', SOURCE_ID),
    client
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', SOURCE_ID)
      .eq('status', 'published'),
  ]);

  return {
    label,
    sourceFlags: source.data,
    latestJobs: jobs.data ?? [],
    importRecordCount: records.count ?? 0,
    importRecordsSample: (records.data ?? []).slice(0, 12),
    reviewCount: reviews.count ?? 0,
    reviewSample: (reviews.data ?? []).slice(0, 12),
    eventCount: events.count ?? 0,
    publishedCount: published.count ?? 0,
  };
}

async function runDbImport(label: string) {
  const sourceRecord = createAffenkaefigLiveProductionSourceRecord({
    enabled: true,
    reviewRequired: true,
    publishMode: 'manual_review',
  });
  const job = await importAggregationService.enqueueJob(
    sourceRecord,
    'manual',
    `affenkaefig-controlled-import:${label}`,
  );
  const completed = await importAggregationService.executeExistingJob(job, sourceRecord, {
    recordImportReputation: false,
  });
  return { label, jobId: completed.id, status: completed.status, metrics: completed.metrics };
}

async function main() {
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    sprint: '28.2',
    sourceId: SOURCE_ID,
  };

  await initializeEntityAliasStore();

  report.sourceSeed = await ensureAffenkaefigSourceRow();
  report.sourceFlagsBefore = await readSourceFlags();
  report.liveFetch = await runAffenkaefigLiveFetch();

  const dryRun = await compareAffenkaefigDryRunIdempotency();
  report.dryRunFirst = dryRun.firstRun;
  report.dryRunSecond = dryRun.secondRun;
  report.dryRunIdempotency = dryRun.comparison;
  report.publishReadinessPreview = summarizePublishReadiness(dryRun.firstRun.events);

  report.dbBefore = await captureDbMetrics('before-import');

  report.importRun1 = await runDbImport('run-1');
  report.dbAfterRun1 = await captureDbMetrics('after-run-1');
  report.importRun2 = await runDbImport('run-2');
  report.dbAfterRun2 = await captureDbMetrics('after-run-2');
  await flushEntityAliasStore();

  report.sourceFlagsAfter = await readSourceFlags();

  const idempotentDb =
    (report.dbAfterRun2 as { importRecordCount?: number }).importRecordCount ===
      (report.dbAfterRun1 as { importRecordCount?: number }).importRecordCount &&
    ((report.importRun2 as { metrics?: { createdCount?: number } }).metrics?.createdCount ?? 0) === 0;

  report.dbIdempotent = idempotentDb;
  report.completedAt = new Date().toISOString();

  const outPath = join(process.cwd(), 'docs/real-data/_affenkaefig_controlled_import_run.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
