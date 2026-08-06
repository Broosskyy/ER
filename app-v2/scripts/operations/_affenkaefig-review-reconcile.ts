/**
 * Sprint 28.3 — Backfill import_review_queue for Affenkäfig needs_review records.
 * Does NOT publish events or enable source/scheduler.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import {
  adminSourceRepository,
  importPublishOrchestratorService,
  importRecordRepository,
} from '@/data/repositories/registry';
import { createAffenkaefigLiveProductionSourceRecord } from '@/features/sources/production/affenkaefig-source';

const SOURCE_ID = 'source-affenkaefig';

async function captureState(label: string) {
  const client = getSupabaseServiceClient();
  const [records, reviews, evaluations] = await Promise.all([
    client
      .from('import_records')
      .select('id,external_id,status,duplicate_event_id,duplicate_score,match_evaluation_id')
      .eq('source_id', SOURCE_ID),
    client
      .from('import_review_queue')
      .select('id,import_record_id,external_event_id,status,decision,reasons', { count: 'exact' })
      .eq('source_id', SOURCE_ID),
    client
      .from('event_match_evaluations')
      .select('id,import_record_id,canonical_event_id,confidence_score,decision,reasons')
      .eq('source_id', SOURCE_ID),
  ]);

  const duplicateTargets = new Set(
    (records.data ?? [])
      .map((row) => row.duplicate_event_id)
      .filter((value): value is string => Boolean(value)),
  );

  let duplicateEvents: Array<Record<string, unknown>> = [];
  if (duplicateTargets.size > 0) {
    const { data } = await client
      .from('events')
      .select('id,title,source_id,venue_id,organizer_id,start_date,status')
      .in('id', [...duplicateTargets]);
    duplicateEvents = (data ?? []) as Array<Record<string, unknown>>;
  }

  return {
    label,
    importRecordCount: records.data?.length ?? 0,
    importRecords: records.data ?? [],
    reviewCount: reviews.count ?? 0,
    reviews: reviews.data ?? [],
    matchEvaluationCount: evaluations.data?.length ?? 0,
    matchEvaluations: evaluations.data ?? [],
    duplicateEvents,
  };
}

async function main() {
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    sprint: '28.3',
    sourceId: SOURCE_ID,
  };

  report.before = await captureState('before-reconcile');

  const dbSource = await adminSourceRepository.getById(SOURCE_ID);
  const source =
    dbSource ??
    createAffenkaefigLiveProductionSourceRecord({
      enabled: false,
      reviewRequired: true,
      publishMode: 'manual_review',
      scheduleEnabled: false,
    });

  const records = await importRecordRepository.listLatestBySourceId(SOURCE_ID);
  const reconciled = await importPublishOrchestratorService.reconcileOrphanedRecords(source, records);

  report.reconciledCount = reconciled;
  report.after = await captureState('after-reconcile');

  const sourceFlags = await getSupabaseServiceClient()
    .from('sources')
    .select('enabled,schedule_enabled,publish_mode')
    .eq('id', SOURCE_ID)
    .maybeSingle();

  report.sourceFlags = sourceFlags.data;
  report.completedAt = new Date().toISOString();

  const outPath = join(process.cwd(), 'docs/real-data/_affenkaefig_review_reconcile_run.json');
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
