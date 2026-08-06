/**
 * Read-only Bootshaus Sprint 26.8 state probe (service role).
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS_ID = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_sprint268_state.json');

async function main() {
  const client = getSupabaseServiceClient();
  const { count: importRecords } = await client
    .from('import_records')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_ID);

  const { data: activeReviews } = await client
    .from('import_review_queue')
    .select('id, external_event_id, status, quality_score, reasons')
    .eq('source_id', BOOTSHAUS_ID)
    .in('status', ['pending', 'on_hold']);

  const identities = new Set((activeReviews ?? []).map((row) => row.external_event_id));

  const { count: sourceReferences } = await client
    .from('event_source_references')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS_ID);

  const { data: sourceRow } = await client
    .from('sources')
    .select('source_config, computed_trust_score, trust_score')
    .eq('id', BOOTSHAUS_ID)
    .maybeSingle();

  const { data: sampleRecord } = await client
    .from('import_records')
    .select('external_id, normalized_payload')
    .eq('source_id', BOOTSHAUS_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = (sampleRecord?.normalized_payload ?? {}) as Record<string, unknown>;

  const report = {
    capturedAt: new Date().toISOString(),
    importRecords: importRecords ?? 0,
    activeReviewEntries: activeReviews?.length ?? 0,
    distinctActiveIdentities: identities.size,
    duplicateSurplus: (activeReviews?.length ?? 0) - identities.size,
    eventSourceReferences: sourceReferences ?? 0,
    sourceDefaultsPresent: Boolean(sourceRow?.source_config?.defaults),
    defaultsCity: sourceRow?.source_config?.defaults?.cityName ?? null,
    defaultsOrganizer: sourceRow?.source_config?.defaults?.organizerName ?? null,
    sampleNormalized: {
      cityName: payload.cityName ?? null,
      venueName: payload.venueName ?? null,
      organizerName: payload.organizerName ?? null,
      ticketUrl: payload.ticketUrl ?? null,
    },
    sampleReview: activeReviews?.[0]
      ? {
          qualityScore: activeReviews[0].quality_score,
          reasons: activeReviews[0].reasons,
        }
      : null,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
