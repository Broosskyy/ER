import './bootstrap-ops-supabase';

import { assertLegacyRepairScriptAllowed } from '@/features/operations/repair/legacy-repair-script-guard';

assertLegacyRepairScriptAllowed('scripts/operations/_sprint36-republish-queued.ts');

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  adminSourceRepository,
  eventRepository,
  importEventPublishService,
  importPublishOrchestratorService,
  importRecordRepository,
} from '@/data/repositories/registry';
import { getDiscoverablePublishedEvents } from '@/features/events/discovery/discovery-feed-helpers';
import { initializeEntityAliasStore, flushEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { TICKET_IO_BOOTSHAUS_SOURCE_ID } from '@/features/sources/production/ticket-io-source';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';
import type { SourceRecord } from '@/data/types/records';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint36_republish_queued.json',
);

function isExpansionTicketIoSource(source: SourceRecord): boolean {
  return (
    source.sourceConfig?.ticketPlatform?.platform === 'ticket_io' &&
    source.id !== TICKET_IO_BOOTSHAUS_SOURCE_ID &&
    source.sourceConfig?.publishPolicy?.behavior === 'auto_publish'
  );
}

async function cancelStuckJobs(): Promise<number> {
  const client = getSupabaseServiceClient();
  const { data: stuck } = await client
    .from('import_jobs')
    .select('id,source_id,status,created_at')
    .eq('status', 'running');

  let cancelled = 0;
  for (const job of stuck ?? []) {
    await client
      .from('import_jobs')
      .update({
        status: 'failed',
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', job.id);
    cancelled += 1;
  }
  return cancelled;
}

async function main(): Promise<void> {
  await initializeEntityAliasStore();
  const client = getSupabaseServiceClient();

  const cancelledJobs = await cancelStuckJobs();

  const beforeCanonical =
    (await client.from('events').select('*', { count: 'exact', head: true })).count ?? 0;

  const sources = (await adminSourceRepository.getAll()).filter(isExpansionTicketIoSource);
  const republishResults: unknown[] = [];

  for (const source of sources) {
    const updated = await adminSourceRepository.save({
      ...source,
      trustScore: Math.max(source.trustScore ?? 0, 72),
      computedTrustScore: Math.max(source.computedTrustScore ?? source.trustScore ?? 0, 72),
      sourceConfig: {
        ...source.sourceConfig,
        publishPolicy: {
          ...source.sourceConfig?.publishPolicy,
          mode: 'auto_publish',
          behavior: 'auto_publish',
          blockOnDuplicate: true,
          minTrustScore: 60,
          minExtractionConfidence: 0.5,
        },
      },
      updatedAt: new Date().toISOString(),
    });

    const records = await importRecordRepository.listLatestBySourceId(updated.id);
    const needsReview = records.filter((record) => record.status === 'needs_review');
    const jobIds = [...new Set(needsReview.map((record) => record.importJobId).filter(Boolean))];

    let publishedTotal = 0;
    let queuedTotal = 0;
    for (const jobId of jobIds) {
      const result = await importPublishOrchestratorService.processJobRecords(
        jobId,
        updated,
        records,
        'sprint36:republish-queued',
      );
      publishedTotal += result.publishedCount;
      queuedTotal += result.queuedCount;
    }

    const { count: origins } = await client
      .from('event_source_references')
      .select('*', { count: 'exact', head: true })
      .eq('source_id', updated.id);

    republishResults.push({
      sourceId: updated.id,
      shopSlug: updated.sourceConfig?.ticketPlatform?.shopSlug,
      needsReviewBefore: needsReview.length,
      jobsReprocessed: jobIds.length,
      published: publishedTotal,
      stillQueued: queuedTotal,
      origins: origins ?? 0,
    });
  }

  await importEventPublishService.refreshConsumerFeed();
  await eventRepository.refresh();

  const afterCanonical =
    (await client.from('events').select('*', { count: 'exact', head: true })).count ?? 0;
  const ticketIoDiscoverable = getDiscoverablePublishedEvents().filter((event) =>
    event.ticketUrl?.includes('.ticket.io'),
  ).length;

  const report = {
    sprint: 36,
    phase: 'republish-queued',
    cancelledStuckJobs: cancelledJobs,
    eventsBefore: { canonical: beforeCanonical },
    eventsAfter: { canonical: afterCanonical, ticketIoDiscoverable },
    canonicalEventsCreated: afterCanonical - beforeCanonical,
    republishResults,
    finishedAt: new Date().toISOString(),
  };

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
  await flushEntityAliasStore();
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
