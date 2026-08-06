import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  eventRepository,
  importEventPublishService,
  importReviewQueueReconciliationService,
  sourceOperationalMetricsService,
} from '@/data/repositories/registry';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import { TICKET_IO_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/ticket-io-source';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint361_phase41_production_fix.json',
);

const EXPANSION_SOURCES = [
  'source-ticket-io-protontheclub',
  'source-ticket-io-lehmannclub',
  'source-ticket-io-area51events',
  'source-ticket-io-technodampfer',
  'source-ticket-io-hmg-concerts',
];

const BOOTSHAUS_TEST_SOURCE = 'source-ticket-io-bootshaus-club';

const EXPECTED_EVENT_COUNTS: Record<string, number> = {
  'source-ticket-io-protontheclub': 12,
  'source-ticket-io-lehmannclub': 11,
  'source-ticket-io-area51events': 4,
  'source-ticket-io-technodampfer': 10,
  'source-ticket-io-hmg-concerts': 19,
};

async function snapshotSources() {
  const rows = [];
  for (const id of [...EXPANSION_SOURCES, BOOTSHAUS_TEST_SOURCE]) {
    const source = await adminSourceRepository.getById(id);
    if (source) {
      rows.push({
        id: source.id,
        archived: source.archived,
        totalValidEventCount: source.totalValidEventCount,
        totalImportCount: source.totalImportCount,
        lastImportAt: source.lastImportAt,
        lastJobStatus: source.lastJobStatus,
      });
    }
  }
  return rows;
}

async function countPendingReview(sourceId?: string) {
  const client = getSupabaseServiceClient();
  let query = client
    .from('import_review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (sourceId) {
    query = query.eq('source_id', sourceId);
  }
  const { count } = await query;
  return count ?? 0;
}

async function countCanonicalAndOrigins() {
  const client = getSupabaseServiceClient();
  const { count: canonical } = await client.from('events').select('*', { count: 'exact', head: true });
  const { count: origins } = await client
    .from('event_source_references')
    .select('*', { count: 'exact', head: true });
  return { canonical: canonical ?? 0, origins: origins ?? 0 };
}

async function main(): Promise<void> {
  const beforeSources = await snapshotSources();
  const beforePending = await countPendingReview();
  const beforeCounts = await countCanonicalAndOrigins();
  await importEventPublishService.refreshConsumerFeed();
  const beforeDiscoverable = getDiscoverablePublishedEvents().length;

  const backfilled = await sourceOperationalMetricsService.backfillAll(EXPANSION_SOURCES);

  const reviewReconcile = await importReviewQueueReconciliationService.reconcileStalePendingEntries({
    resolvedBy: 'sprint361:production-fix',
  });

  const bootshausTest = await adminSourceRepository.getById(BOOTSHAUS_TEST_SOURCE);
  let bootshausDisposition: Record<string, unknown> = { found: false };
  if (bootshausTest) {
    const testReconcile = await importReviewQueueReconciliationService.reconcileTestArtifactEntries({
      sourceId: BOOTSHAUS_TEST_SOURCE,
      resolvedBy: 'sprint361:bootshaus-test-artifact',
    });
    const archived = await adminSourceRepository.save({
      ...bootshausTest,
      enabled: false,
      archived: true,
      notes: [bootshausTest.notes, 'Sprint 35 test artifact — archived in Phase 4.1.'].filter(Boolean).join('\n'),
      metadata: {
        ...(bootshausTest.metadata ?? {}),
        testArtifact: true,
        archivedReason: 'duplicate_of_bootshaus_enrichment_source',
        archivedAt: new Date().toISOString(),
      },
      updatedAt: new Date().toISOString(),
    });
    bootshausDisposition = {
      found: true,
      archived: archived.archived,
      reviewEntriesResolved: testReconcile.reconciled,
      enrichmentSourceId: TICKET_IO_BOOTSHAUS_SOURCE_ID,
    };
  }

  const secondBackfill = await sourceOperationalMetricsService.backfillAll(EXPANSION_SOURCES);
  const secondReview = await importReviewQueueReconciliationService.reconcileStalePendingEntries();

  const afterSources = await snapshotSources();
  const afterPending = await countPendingReview();
  const afterCounts = await countCanonicalAndOrigins();
  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();
  const afterDiscoverable = getDiscoverablePublishedEvents().length;

  const validation = EXPANSION_SOURCES.map((sourceId) => {
    const source = afterSources.find((entry) => entry.id === sourceId);
    return {
      sourceId,
      expectedEvents: EXPECTED_EVENT_COUNTS[sourceId],
      actualEvents: source?.totalValidEventCount ?? 0,
      passed: (source?.totalValidEventCount ?? 0) === EXPECTED_EVENT_COUNTS[sourceId],
      lastImportAt: source?.lastImportAt ?? null,
      lastJobStatus: source?.lastJobStatus ?? null,
    };
  });

  const technodampferNeedsReview = await getSupabaseServiceClient()
    .from('import_records')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', 'source-ticket-io-technodampfer')
    .eq('status', 'needs_review');

  const report = {
    sprint: 361,
    phase: 'admin-truthfulness-fix',
    before: {
      sources: beforeSources,
      reviewQueuePending: beforePending,
      canonicalEvents: beforeCounts.canonical,
      origins: beforeCounts.origins,
      discoverableEvents: beforeDiscoverable,
    },
    actions: {
      backfilledSources: backfilled.length,
      reviewReconciled: reviewReconcile.reconciled,
      reviewPreserved: reviewReconcile.preserved,
      bootshausDisposition,
    },
    after: {
      sources: afterSources,
      reviewQueuePending: afterPending,
      canonicalEvents: afterCounts.canonical,
      origins: afterCounts.origins,
      discoverableEvents: afterDiscoverable,
    },
    idempotency: {
      secondBackfillCount: secondBackfill.length,
      secondReviewReconciled: secondReview.reconciled,
    },
    validation,
    technodampferGenuineNeedsReview: technodampferNeedsReview.count ?? 0,
    passed:
      validation.every((entry) => entry.passed) &&
      afterCounts.canonical >= beforeCounts.canonical &&
      afterCounts.origins >= beforeCounts.origins &&
      afterDiscoverable >= beforeDiscoverable &&
      secondReview.reconciled === 0,
    finishedAt: new Date().toISOString(),
  };

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  if (!report.passed) {
    process.exitCode = 1;
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
