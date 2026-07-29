/**
 * Sprint 26.9.2 — live baseline for stable published reimport reconciliation.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const BOOTSHAUS = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_stable_reimport_reconciliation.json');

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();

  const { count: recordCount } = await client
    .from('import_records')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS);

  const { data: records } = await client
    .from('import_records')
    .select('id, external_id, status, resulting_event_id, import_job_id, normalized_payload, updated_at')
    .eq('source_id', BOOTSHAUS);

  const eventIds = [...new Set((records ?? []).map((row) => row.resulting_event_id).filter(Boolean))];
  const { count: publishedEventCount } = await client
    .from('events')
    .select('id', { count: 'exact', head: true })
    .in('id', eventIds.length > 0 ? eventIds : ['__none__'])
    .eq('status', 'published');

  const { count: sourceRefCount } = await client
    .from('event_source_references')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS)
    .eq('active', true);

  const { data: activeReviews } = await client
    .from('import_review_queue')
    .select('*')
    .eq('source_id', BOOTSHAUS)
    .in('status', ['pending', 'on_hold']);

  const { data: jobs } = await client
    .from('import_jobs')
    .select('id, status, created_at, finished_at, metrics')
    .eq('source_id', BOOTSHAUS)
    .order('created_at', { ascending: false })
    .limit(5);

  const latestJobId = jobs?.[0]?.id ?? null;

  const reviewsFromLatestJob =
    latestJobId == null
      ? []
      : (activeReviews ?? []).filter((review) => review.import_job_id === latestJobId);

  const reviewGroups = new Map<string, number>();
  for (const review of activeReviews ?? []) {
    const metadata = (review.metadata ?? {}) as Record<string, unknown>;
    const key = [
      metadata.reviewType ?? 'trust',
      review.decision,
      review.status,
      ...(review.reasons ?? []).slice(0, 2),
    ].join('|');
    reviewGroups.set(key, (reviewGroups.get(key) ?? 0) + 1);
  }

  const sampleTraces: Array<Record<string, unknown>> = [];
  const sampleIds = (records ?? []).slice(0, 3).map((row) => row.id);
  for (const recordId of sampleIds) {
    const record = (records ?? []).find((row) => row.id === recordId);
    if (!record) continue;

    const { data: event } = record.resulting_event_id
      ? await client
          .from('events')
          .select('id, status, title, start_date, updated_at')
          .eq('id', record.resulting_event_id)
          .maybeSingle()
      : { data: null };

    const { data: ref } = await client
      .from('event_source_references')
      .select('id, canonical_event_id, active')
      .eq('source_id', BOOTSHAUS)
      .eq('external_event_id', record.external_id)
      .maybeSingle();

    const recordReviews = (activeReviews ?? []).filter((review) => review.import_record_id === record.id);

    sampleTraces.push({
      importRecordId: record.id,
      externalId: record.external_id,
      status: record.status,
      resultingEventId: record.resulting_event_id,
      eventStatus: event?.status ?? null,
      sourceReferenceActive: ref?.active ?? null,
      activeReviewCount: recordReviews.length,
      reviewTypes: recordReviews.map(
        (review) => ((review.metadata ?? {}) as { reviewType?: string }).reviewType ?? 'trust',
      ),
      reviewReasons: recordReviews.flatMap((review) => review.reasons ?? []),
      qualityScore: recordReviews[0]?.quality_score ?? null,
      trustScore: recordReviews[0]?.trust_score ?? null,
    });
  }

  const report = {
    capturedAt: new Date().toISOString(),
    sourceId: BOOTSHAUS,
    counts: {
      importRecords: recordCount ?? 0,
      publishedEvents: publishedEventCount ?? 0,
      activeSourceReferences: sourceRefCount ?? 0,
      activeReviews: activeReviews?.length ?? 0,
      reviewsFromLatestJob: reviewsFromLatestJob.length,
    },
    latestJobs: jobs ?? [],
    reviewGroups: Object.fromEntries(reviewGroups),
    activeReviews: (activeReviews ?? []).map((review) => ({
      id: review.id,
      importRecordId: review.import_record_id,
      importJobId: review.import_job_id,
      status: review.status,
      decision: review.decision,
      qualityScore: review.quality_score,
      trustScore: review.trust_score,
      reasons: review.reasons,
      reviewType: ((review.metadata ?? {}) as { reviewType?: string }).reviewType ?? 'trust',
      createdAt: review.created_at,
      updatedAt: review.updated_at,
    })),
    sampleTraces,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
