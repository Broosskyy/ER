/**
 * Read-only origin/backfill baseline metrics for Sprint 33.1.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/real-data/_sprint331_origin_metrics.json');

const PRODUCTION_SOURCE_IDS = [
  'source-bootshaus-koeln',
  'source-affenkaefig',
  'source-bootshaus-ticket-io',
  'source-affenkaefig-ticket-kings',
];

async function count(client: ReturnType<typeof getSupabaseServiceClient>, table: string, filter?: { column: string; value: string }) {
  let query = client.from(table).select('*', { count: 'exact', head: true });
  if (filter) {
    query = query.eq(filter.column, filter.value);
  }
  const { count: total, error } = await query;
  if (error) {
    throw new Error(`${table}: ${error.message}`);
  }
  return total ?? 0;
}

async function main(): Promise<void> {
  const client = getSupabaseServiceClient();
  const { data: refs, error: refsError } = await client
    .from('event_source_references')
    .select('id, source_id, external_event_id, metadata, active');
  if (refsError) {
    throw new Error(refsError.message);
  }

  const references = refs ?? [];
  const withOriginMetadata = references.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return Boolean(metadata?.role && metadata?.platform);
  });
  const withBackfill = references.filter((row) => {
    const metadata = row.metadata as Record<string, unknown> | null;
    return Boolean(metadata?.backfilledAt);
  });

  const bySource: Record<string, number> = {};
  for (const sourceId of PRODUCTION_SOURCE_IDS) {
    bySource[sourceId] = references.filter((row) => row.source_id === sourceId).length;
  }

  const { data: importCounts, error: importError } = await client
    .from('import_records')
    .select('source_id')
    .in('source_id', PRODUCTION_SOURCE_IDS);
  if (importError) {
    throw new Error(importError.message);
  }
  const importBySource: Record<string, number> = {};
  for (const sourceId of PRODUCTION_SOURCE_IDS) {
    importBySource[sourceId] = (importCounts ?? []).filter((row) => row.source_id === sourceId).length;
  }

  const metrics = {
    collectedAt: new Date().toISOString(),
    canonicalEvents: await count(client, 'events'),
    publishedEvents: await count(client, 'events', { column: 'status', value: 'published' }),
    sourceReferences: references.length,
    activeSourceReferences: references.filter((row) => row.active).length,
    originsWithMetadata: withOriginMetadata.length,
    originsBackfilled: withBackfill.length,
    sourceReferencesBySource: bySource,
    importRecordsBySource: importBySource,
    onboardingJobs: await count(client, 'source_onboarding_jobs'),
  };

  writeFileSync(OUT, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(metrics, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
