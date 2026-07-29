/**
 * Sprint 26.9.1 Phase 1 — read-only live baseline for Bootshaus production closure.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const BOOTSHAUS = 'source-bootshaus-koeln';
const CANONICAL_VENUE = 'venue-bootshaus-koeln';
const STAGING_VENUE = 'staging-seed-venue-bootshaus';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_production_closure.json');

async function countBy(
  client: ReturnType<typeof getSupabaseServiceClient>,
  table: string,
  filters: Record<string, string>,
): Promise<number> {
  let query = client.from(table).select('id', { count: 'exact', head: true });
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value);
  }
  const { count, error } = await query;
  if (error) throw new Error(`${table} count failed: ${error.message}`);
  return count ?? 0;
}

async function main(): Promise<void> {
  const service = getSupabaseServiceClient();
  const anon = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const importRecords = await countBy(service, 'import_records', { source_id: BOOTSHAUS });
  const sourceReferences = await countBy(service, 'event_source_references', {
    source_id: BOOTSHAUS,
  });

  const { data: publishedEvents } = await service
    .from('events')
    .select('id, venue_id, search_document, title, venue_name, organizer')
    .eq('source_id', BOOTSHAUS)
    .eq('status', 'published');

  const venueCounts = {
    canonical: publishedEvents?.filter((e) => e.venue_id === CANONICAL_VENUE).length ?? 0,
    staging: publishedEvents?.filter((e) => e.venue_id === STAGING_VENUE).length ?? 0,
    nullVenue: publishedEvents?.filter((e) => !e.venue_id).length ?? 0,
    other: publishedEvents?.filter(
      (e) => e.venue_id && e.venue_id !== CANONICAL_VENUE && e.venue_id !== STAGING_VENUE,
    ).length ?? 0,
  };

  const searchDocCounts = {
    populated: publishedEvents?.filter((e) => e.search_document != null).length ?? 0,
    empty: publishedEvents?.filter((e) => e.search_document == null).length ?? 0,
  };

  const { data: activeReviews } = await service
    .from('import_review_queue')
    .select(
      'id, import_record_id, external_event_id, status, decision, quality_score, trust_score, reasons, metadata, created_at, updated_at',
    )
    .eq('source_id', BOOTSHAUS)
    .in('status', ['pending', 'on_hold']);

  const reviewBreakdown = {
    total: activeReviews?.length ?? 0,
    byStatus: {} as Record<string, number>,
    byDecision: {} as Record<string, number>,
    byReviewType: {} as Record<string, number>,
    byResolutionReason: {} as Record<string, number>,
    lifecycleReviews: 0,
    entries: (activeReviews ?? []).map((row) => ({
      id: row.id,
      importRecordId: row.import_record_id,
      externalEventId: row.external_event_id,
      status: row.status,
      decision: row.decision,
      qualityScore: row.quality_score,
      trustScore: row.trust_score,
      reasons: row.reasons,
      reviewType:
        (row.metadata as { reviewType?: string } | null)?.reviewType ?? 'unknown',
      resolutionReason:
        (row.metadata as { resolutionReason?: string } | null)?.resolutionReason ?? null,
    })),
  };

  for (const row of activeReviews ?? []) {
    reviewBreakdown.byStatus[row.status] = (reviewBreakdown.byStatus[row.status] ?? 0) + 1;
    const decision = row.decision ?? 'null';
    reviewBreakdown.byDecision[decision] = (reviewBreakdown.byDecision[decision] ?? 0) + 1;
    const reviewType =
      (row.metadata as { reviewType?: string } | null)?.reviewType ?? 'unknown';
    reviewBreakdown.byReviewType[reviewType] =
      (reviewBreakdown.byReviewType[reviewType] ?? 0) + 1;
    if (reviewType === 'lifecycle') {
      reviewBreakdown.lifecycleReviews += 1;
    }
    const resolutionReason =
      (row.metadata as { resolutionReason?: string } | null)?.resolutionReason ?? 'none';
    reviewBreakdown.byResolutionReason[resolutionReason] =
      (reviewBreakdown.byResolutionReason[resolutionReason] ?? 0) + 1;
  }

  const { data: sourceRow } = await service
    .from('sources')
    .select(
      'schedule_enabled, schedule_policy, last_scheduled_at, backoff_until, source_config, computed_trust_score, trust_score',
    )
    .eq('id', BOOTSHAUS)
    .maybeSingle();

  const { data: aliases } = await service
    .from('entity_identity_aliases')
    .select('id, entity_type, canonical_id, alias_type, alias_value, source_id')
    .eq('entity_type', 'venue')
    .or(`alias_value.ilike.%bootshaus%,canonical_id.eq.${STAGING_VENUE},canonical_id.eq.${CANONICAL_VENUE}`);

  const { data: sampleRecord } = await service
    .from('import_records')
    .select('id, external_id, matched_venue_id, normalized_payload, status, canonical_event_id')
    .eq('source_id', BOOTSHAUS)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const normalized = (sampleRecord?.normalized_payload ?? {}) as Record<string, unknown>;
  const sourceMetadata = (normalized.sourceMetadata ?? {}) as Record<string, unknown>;

  const { count: anonPublished } = await anon
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('source_id', BOOTSHAUS);

  const { count: anonVenueFilter } = await anon
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published')
    .eq('venue_id', CANONICAL_VENUE);

  const { data: schedulerJobs } = await service
    .from('import_jobs')
    .select('id, status, job_type, created_at')
    .eq('source_id', BOOTSHAUS)
    .order('created_at', { ascending: false })
    .limit(5);

  const report = {
    capturedAt: new Date().toISOString(),
    phase: 'baseline',
    counters: {
      importRecords,
      publishedEvents: publishedEvents?.length ?? 0,
      eventSourceReferences: sourceReferences,
      anonPublishedCount: anonPublished ?? 0,
      anonVenueFilterCount: anonVenueFilter ?? 0,
    },
    venueDistribution: venueCounts,
    searchDocument: searchDocCounts,
    activeReviews: reviewBreakdown,
    reviewCountDiscrepancyNote:
      'Prior reports mixed lifecycle-only count (metadata.reviewType=lifecycle) with total active queue rows.',
    source: {
      scheduleEnabled: sourceRow?.schedule_enabled ?? null,
      schedulePolicy: sourceRow?.schedule_policy ?? null,
      lastScheduledAt: sourceRow?.last_scheduled_at ?? null,
      backoffUntil: sourceRow?.backoff_until ?? null,
      defaultsVenueId:
        (sourceRow?.source_config as { defaults?: { venueId?: string } } | null)?.defaults
          ?.venueId ?? null,
      trustScore: sourceRow?.trust_score ?? null,
      computedTrustScore: sourceRow?.computed_trust_score ?? null,
    },
    venueAliases: aliases ?? [],
    sampleImportTrace: {
      importRecordId: sampleRecord?.id ?? null,
      externalId: sampleRecord?.external_id ?? null,
      matchedVenueId: sampleRecord?.matched_venue_id ?? null,
      canonicalEventId: sampleRecord?.canonical_event_id ?? null,
      normalizedVenueName: normalized.venueName ?? null,
      normalizedVenueId: normalized.venueId ?? null,
      sourceMetadataDefaultVenueId: sourceMetadata.defaultVenueId ?? null,
      sourceMetadataDefaultCityId: sourceMetadata.defaultCityId ?? null,
    },
    recentImportJobs: schedulerJobs ?? [],
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
