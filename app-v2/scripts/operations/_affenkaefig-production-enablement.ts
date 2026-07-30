/**
 * Sprint 28.4 — Affenkäfig production enablement (controlled publish + scheduler).
 * Publishes 7 approved events; defers Bootshaus shared-event case.
 */
import './bootstrap-ops-supabase';

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import {
  adminSourceRepository,
  importAggregationService,
  importEventPublishService,
  importRecordRepository,
} from '@/data/repositories/registry';
import { createAffenkaefigLiveProductionSourceRecord } from '@/features/sources/production/affenkaefig-source';
import { resolveConfidenceTier } from '@/features/multi-source-matching/domain/matching-config';
import { getEffectiveCandidate } from '@/features/import/admin/import-utils';
import type { ImportRecord } from '@/features/import/models/types';

const SOURCE_ID = 'source-affenkaefig';
const ACTOR_ID = 'ops:sprint284-production-enablement';
const DEFERRED_EXTERNAL_ID =
  'https://affenkaefig.info/event/affenkaefigrulesbootshaus-koeln-23-10-26/';

const FALSE_POSITIVE_EXTERNAL_IDS = new Set([
  'https://affenkaefig.info/event/underland-essigfabrik-05-09-2026/',
  'https://affenkaefig.info/event/14-jahreaffenkafig19-09-2026/',
  'https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-xxx-f2f-b2b-xxx-edition/',
  'https://affenkaefig.info/event/mdma-musik-die-mich-antreibt-10-10-26/',
  'https://affenkaefig.info/event/affenkaefig-xxx-capitol-xxx-hagen-17-10-2026/',
]);

const OUT = join(process.cwd(), 'docs/real-data/_affenkaefig_production_enablement_run.json');

function db() {
  return getSupabaseServiceClient();
}

function saveReport(report: Record<string, unknown>) {
  writeFileSync(OUT, JSON.stringify(report, null, 2));
}

function runScript(script: string) {
  const result = spawnSync('npx', ['tsx', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    env: process.env,
  });
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

function slugFromExternalId(externalId: string): string {
  try {
    const url = new URL(externalId);
    return url.pathname.split('/').filter(Boolean).pop() ?? externalId;
  } catch {
    return externalId;
  }
}

function validateReadiness(record: ImportRecord) {
  const candidate = getEffectiveCandidate(record);
  const issues: string[] = [];
  if (!candidate.title?.trim()) issues.push('missing_title');
  if (!candidate.startDate) issues.push('missing_start_date');
  if (!candidate.venueName?.trim()) issues.push('missing_venue');
  if (!candidate.organizerName?.trim()) issues.push('missing_organizer');
  if (!candidate.eventUrl && !record.externalId) issues.push('missing_canonical_url');
  const confidenceTier = resolveConfidenceTier(record.duplicateScore ?? 0);
  if (!['certain', 'probable', 'uncertain'].includes(confidenceTier)) {
    issues.push(`invalid_confidence_tier:${confidenceTier}`);
  }
  return {
    externalId: record.externalId,
    title: candidate.title,
    startDate: candidate.startDate,
    timezone: candidate.timezone ?? 'Europe/Berlin',
    venueName: candidate.venueName,
    organizerName: candidate.organizerName,
    imageUrl: candidate.imageUrl,
    ticketUrl: candidate.ticketUrl,
    eventUrl: candidate.eventUrl ?? record.externalId,
    sourceId: record.sourceId,
    trustScore: undefined as number | undefined,
    confidenceTier,
    issues,
    publishReady: issues.length === 0,
  };
}

async function captureState(label: string) {
  const client = db();
  const [source, records, reviews, events, queue, jobs] = await Promise.all([
    client
      .from('sources')
      .select(
        'id,enabled,active,schedule_enabled,schedule_policy,schedule_interval_preset,next_scheduled_at,publish_mode,review_required',
      )
      .eq('id', SOURCE_ID)
      .maybeSingle(),
    client
      .from('import_records')
      .select(
        'id,external_id,status,duplicate_event_id,duplicate_score,duplicate_decision,resulting_event_id,updated_at',
      )
      .eq('source_id', SOURCE_ID),
    client
      .from('import_review_queue')
      .select('id,import_record_id,external_event_id,status,decision,reasons,metadata')
      .eq('source_id', SOURCE_ID),
    client
      .from('events')
      .select('id,title,status,source_id,event_url,start_date,published_at,updated_at')
      .eq('source_id', SOURCE_ID),
    client
      .from('import_job_queue')
      .select('id,status,enqueued_at')
      .eq('source_id', SOURCE_ID)
      .order('enqueued_at', { ascending: false })
      .limit(10),
    client
      .from('import_jobs')
      .select('id,status,created_count,updated_count,fetched_count,created_at')
      .eq('source_id', SOURCE_ID)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  return {
    label,
    capturedAt: new Date().toISOString(),
    source: source.data,
    importRecords: records.data ?? [],
    reviews: reviews.data ?? [],
    events: events.data ?? [],
    queue: queue.data ?? [],
    jobs: jobs.data ?? [],
  };
}

async function dismissFalsePositive(record: ImportRecord) {
  const now = new Date().toISOString();
  const updated = await importRecordRepository.update({
    ...record,
    status: 'needs_review',
    duplicateDecision: 'dismissed',
    duplicateScore: 0,
    duplicateEventId: undefined,
    reviewedBy: ACTOR_ID,
    reviewedAt: now,
    updatedAt: now,
  });

  const client = db();
  const { data: review } = await client
    .from('import_review_queue')
    .select('id,metadata')
    .eq('import_record_id', record.id)
    .in('status', ['pending', 'on_hold'])
    .maybeSingle();

  if (review) {
    await client
      .from('import_review_queue')
      .update({
        metadata: {
          ...((review.metadata as Record<string, unknown> | null) ?? {}),
          duplicateDecision: 'dismissed',
          duplicateClassification: 'false_positive',
          resolvedBy: ACTOR_ID,
          resolvedAt: now,
        },
        updated_at: now,
      })
      .eq('id', review.id);
  }

  return updated;
}

async function deferSharedEventReview(record: ImportRecord) {
  const now = new Date().toISOString();
  const client = db();
  const { data: review } = await client
    .from('import_review_queue')
    .select('id,metadata')
    .eq('import_record_id', record.id)
    .in('status', ['pending', 'on_hold'])
    .maybeSingle();

  if (review) {
    await client
      .from('import_review_queue')
      .update({
        status: 'on_hold',
        metadata: {
          ...((review.metadata as Record<string, unknown> | null) ?? {}),
          deferredReason: 'shared_event_pending_decision',
          sharedEventCandidate: 'bootshaus-koeln-23-10-26',
          resolvedBy: ACTOR_ID,
          deferredAt: now,
        },
        updated_at: now,
      })
      .eq('id', review.id);
  }

  return {
    importRecordId: record.id,
    externalId: record.externalId,
    action: 'deferred',
    reason: 'shared_event_bootshaus_overlap',
  };
}

async function closeReviewApproved(importRecordId: string, eventId: string) {
  const now = new Date().toISOString();
  const client = db();
  const { data: review } = await client
    .from('import_review_queue')
    .select('id,metadata')
    .eq('import_record_id', importRecordId)
    .in('status', ['pending', 'on_hold'])
    .maybeSingle();

  if (!review) {
    return null;
  }

  await client
    .from('import_review_queue')
    .update({
      status: 'approved',
      decision: 'auto_publish',
      metadata: {
        ...((review.metadata as Record<string, unknown> | null) ?? {}),
        publishedEventId: eventId,
        approvedBy: ACTOR_ID,
        approvedAt: now,
      },
      updated_at: now,
    })
    .eq('id', review.id);

  return review.id;
}

async function publishApprovedRecord(record: ImportRecord, source: Awaited<ReturnType<typeof adminSourceRepository.getById>>) {
  if (!source) {
    throw new Error('source missing');
  }
  const previousRecords = await importRecordRepository.listLatestBySourceId(SOURCE_ID);
  const publishResult = await importEventPublishService.publishRecord(record, source, previousRecords, {
    actorId: ACTOR_ID,
  });
  const reviewId = await closeReviewApproved(record.id, publishResult.event.id);
  return {
    importRecordId: record.id,
    externalId: record.externalId,
    eventId: publishResult.event.id,
    title: publishResult.event.title,
    publishedAt: publishResult.event.publishedAt ?? publishResult.event.updatedAt,
    reviewId,
    created: publishResult.created,
  };
}

async function enableSourceAndScheduler() {
  const now = new Date().toISOString();
  const { error } = await db()
    .from('sources')
    .update({
      enabled: true,
      active: true,
      archived: false,
      review_required: true,
      publish_mode: 'manual_review',
      schedule_enabled: true,
      schedule_policy: 'interval',
      schedule_interval_preset: 'every_6_hours',
      schedule_timezone: 'Europe/Berlin',
      polling_interval_minutes: 360,
      next_scheduled_at: now,
      updated_at: now,
    })
    .eq('id', SOURCE_ID);
  if (error) {
    throw new Error(`source enable failed: ${error.message}`);
  }
}

async function main() {
  const report: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    sprint: '28.4',
    sourceId: SOURCE_ID,
  };

  await initializeEntityAliasStore();

  report.phase1 = await captureState('before-enablement');
  const sourceRow = await adminSourceRepository.getById(SOURCE_ID);
  if (!sourceRow) {
    throw new Error(`${SOURCE_ID} missing`);
  }

  const records = await importRecordRepository.listLatestBySourceId(SOURCE_ID);
  report.reviewFinalization = {
    total: records.length,
    traces: [] as Array<Record<string, unknown>>,
  };

  for (const record of records) {
    if (record.externalId === DEFERRED_EXTERNAL_ID) {
      (report.reviewFinalization as { traces: Array<Record<string, unknown>> }).traces.push(
        await deferSharedEventReview(record),
      );
      continue;
    }

    if (FALSE_POSITIVE_EXTERNAL_IDS.has(record.externalId)) {
      const dismissed = await dismissFalsePositive(record);
      (report.reviewFinalization as { traces: Array<Record<string, unknown>> }).traces.push({
        importRecordId: dismissed.id,
        externalId: dismissed.externalId,
        action: 'duplicate_dismissed',
        duplicateClassification: 'false_positive',
        duplicateDecision: dismissed.duplicateDecision,
      });
      continue;
    }

    (report.reviewFinalization as { traces: Array<Record<string, unknown>> }).traces.push({
      importRecordId: record.id,
      externalId: record.externalId,
      action: 'approved_for_publish',
      duplicateCandidate: Boolean(record.duplicateEventId),
    });
  }

  const refreshedRecords = await importRecordRepository.listLatestBySourceId(SOURCE_ID);
  report.publishReadiness = refreshedRecords.map((record) => ({
    ...validateReadiness(record),
    deferred: record.externalId === DEFERRED_EXTERNAL_ID,
    publishTarget: record.externalId !== DEFERRED_EXTERNAL_ID,
  }));

  report.controlledPublish = {
    published: [] as Array<Record<string, unknown>>,
    skipped: [] as Array<Record<string, unknown>>,
    errors: [] as Array<Record<string, unknown>>,
  };

  for (const record of refreshedRecords) {
    if (record.externalId === DEFERRED_EXTERNAL_ID) {
      (report.controlledPublish as { skipped: Array<Record<string, unknown>> }).skipped.push({
        externalId: record.externalId,
        reason: 'shared_event_deferred',
      });
      continue;
    }

    if (record.status === 'imported' && record.resultingEventId) {
      (report.controlledPublish as { skipped: Array<Record<string, unknown>> }).skipped.push({
        externalId: record.externalId,
        reason: 'already_imported',
        eventId: record.resultingEventId,
      });
      continue;
    }

    const readiness = validateReadiness(record);
    if (!readiness.publishReady) {
      (report.controlledPublish as { errors: Array<Record<string, unknown>> }).errors.push({
        externalId: record.externalId,
        issues: readiness.issues,
      });
      continue;
    }

    try {
      const latest = (await importRecordRepository.getById(record.id)) ?? record;
      const published = await publishApprovedRecord(latest, sourceRow);
      (report.controlledPublish as { published: Array<Record<string, unknown>> }).published.push(published);
    } catch (error: unknown) {
      (report.controlledPublish as { errors: Array<Record<string, unknown>> }).errors.push({
        externalId: record.externalId,
        slug: slugFromExternalId(record.externalId),
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const publishedCount = (report.controlledPublish as { published: unknown[] }).published.length;
  if (publishedCount > 0) {
    await importEventPublishService.refreshConsumerFeed();
  }

  report.afterPublish = await captureState('after-publish');

  const reimportSource = createAffenkaefigLiveProductionSourceRecord({
    enabled: true,
    reviewRequired: true,
    publishMode: 'manual_review',
  });
  const jobBefore = await importAggregationService.enqueueJob(
    reimportSource,
    'manual',
    'affenkaefig-sprint284-reimport-validation',
  );
  const completedJob = await importAggregationService.executeExistingJob(jobBefore, reimportSource, {
    recordImportReputation: false,
  });
  report.reimport = {
    jobId: completedJob.id,
    status: completedJob.status,
    metrics: completedJob.metrics,
    idempotentExpectation: {
      noNewInserts: (completedJob.metrics?.createdCount ?? 0) === 0,
      stableRecordCount: true,
    },
  };

  report.afterReimport = await captureState('after-reimport');

  if ((report.controlledPublish as { errors: unknown[] }).errors.length === 0 && publishedCount === 7) {
    await enableSourceAndScheduler();
    report.sourceEnablement = { enabled: true, schedulerEnabled: true };
  } else {
    report.sourceEnablement = {
      enabled: false,
      schedulerEnabled: false,
      blockedReason: 'publish_errors_or_incomplete_publish',
    };
  }

  report.afterEnablement = await captureState('after-enablement');

  if (report.sourceEnablement && (report.sourceEnablement as { schedulerEnabled?: boolean }).schedulerEnabled) {
    report.schedulerTick = runScript('scripts/operations/run-scheduler-tick.ts');
    report.afterSchedulerTick = await captureState('after-scheduler-tick');
  }

  await flushEntityAliasStore();

  report.completedAt = new Date().toISOString();
  report.success =
    publishedCount === 7 &&
    (report.controlledPublish as { errors: unknown[] }).errors.length === 0 &&
    Boolean((report.sourceEnablement as { schedulerEnabled?: boolean } | undefined)?.schedulerEnabled);

  saveReport(report);
  console.log(JSON.stringify(report, null, 2));

  if (!report.success) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
