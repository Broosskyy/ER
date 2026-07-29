/**
 * Read-only live schema audit via Supabase service role.
 * SELECT/RPC probes only — no mutations.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '../../docs/real-data/_live_schema_audit.json');

type Probe = { ok: boolean; detail?: string };

async function probeTable(table: string): Promise<Probe> {
  const { error } = await getSupabaseServiceClient().from(table).select('*', { count: 'exact', head: true });
  return { ok: !error, detail: error?.message };
}

async function probeColumn(table: string, column: string): Promise<Probe> {
  const { error } = await getSupabaseServiceClient().from(table).select(column).limit(1);
  return { ok: !error, detail: error?.message };
}

async function probeRpc(fn: string, args: Record<string, unknown>): Promise<Probe> {
  const { error } = await getSupabaseServiceClient().rpc(fn, args);
  return { ok: !error, detail: error?.message };
}

async function main() {
  const tables = [
    'genres', 'cities', 'venues', 'artists', 'collections', 'organizers', 'events', 'event_artists',
    'festivals', 'festival_editions', 'event_series', 'sources', 'import_jobs', 'import_records',
    'import_logs', 'import_audit_logs', 'import_job_queue', 'import_schedule_locks', 'import_review_queue',
    'trust_quality_rules', 'source_reputation_events', 'source_groups', 'source_group_memberships',
    'source_relations', 'source_status_history', 'event_source_references', 'event_field_provenance',
    'duplicate_decisions', 'event_conflicts', 'entity_identity_aliases', 'entity_resolution_decisions',
    'event_blocking_keys', 'event_match_evaluations', 'event_merge_candidates', 'event_lifecycle_history',
    'event_lifecycle_changes', 'platform_operations_state', 'operations_backfill_jobs',
    'source_intelligence_snapshots', 'worker_runs', 'scheduler_runs', 'connector_health_snapshots',
    'worker_recovery_runs', 'discovery_search_documents', 'event_search_documents', 'contributor_event_drafts',
  ];

  const tableProbes: Record<string, Probe> = {};
  for (const table of tables) {
    tableProbes[table] = await probeTable(table);
  }

  const sourceColumns = [
    'publish_mode', 'source_roles', 'last_error', 'country_code', 'stable_key', 'source_config',
    'schedule_enabled', 'schedule_policy', 'schedule_interval_preset', 'computed_trust_score',
    'adapter_key', 'connector_type', 'metadata', 'next_scheduled_at', 'review_required',
  ];
  const sourcesCols: Record<string, Probe> = {};
  for (const col of sourceColumns) {
    sourcesCols[col] = await probeColumn('sources', col);
  }

  const importRecordColumns = [
    'match_evaluation_id', 'duplicate_decision', 'matched_organizer_id', 'resulting_event_id',
    'validation_errors', 'source_url',
  ];
  const importRecordCols: Record<string, Probe> = {};
  for (const col of importRecordColumns) {
    importRecordCols[col] = await probeColumn('import_records', col);
  }

  const eventColumns = ['search_document', 'organizer_id', 'festival_edition_id', 'canonical_event_id'];
  const eventCols: Record<string, Probe> = {};
  for (const col of eventColumns) {
    eventCols[col] = await probeColumn('events', col);
  }

  const venueColumns = ['slug', 'city', 'country', 'venue_type', 'postal_code', 'street'];
  const venueCols: Record<string, Probe> = {};
  for (const col of venueColumns) {
    venueCols[col] = await probeColumn('venues', col);
  }

  const queueColumns = [
    'attempt_count', 'max_attempts', 'dead_lettered_at', 'worker_id', 'processing_started_at',
    'processing_lease_expires_at', 'next_retry_at',
  ];
  const queueCols: Record<string, Probe> = {};
  for (const col of queueColumns) {
    queueCols[col] = await probeColumn('import_job_queue', col);
  }

  const claimFn = await probeRpc('claim_import_job_queue_entries', {
    p_limit: 0,
    p_now: new Date().toISOString(),
    p_worker_id: 'schema-audit-readonly',
    p_lease_ms: 60000,
  });
  // Validation error on p_limit=0 still proves function exists and is executable.
  const claimFnExists =
    claimFn.ok || (claimFn.detail?.includes('p_limit must be between 1 and 100') ?? false);

  const client = getSupabaseServiceClient();
  const { data: bootshausSource } = await client
    .from('sources')
    .select('id, enabled, active, publish_mode, review_required, schedule_enabled, schedule_policy, schedule_interval_preset, next_scheduled_at, source_config')
    .eq('id', 'source-bootshaus-koeln')
    .maybeSingle();

  const { data: bootshausVenues } = await client
    .from('venues')
    .select('id, slug, name, city, country')
    .or('id.eq.venue-bootshaus-koeln,slug.eq.bootshaus-koeln')
    .limit(5);

  const { data: bootshausOrganizers } = await client
    .from('organizers')
    .select('id, slug, name')
    .or('id.eq.organizer-bootshaus,slug.eq.bootshaus')
    .limit(5);

  const { data: koelnCities } = await client
    .from('cities')
    .select('id, slug, name')
    .or('id.eq.koeln,slug.eq.koeln')
    .limit(5);

  const { count: trustRulesCount } = await client
    .from('trust_quality_rules')
    .select('*', { count: 'exact', head: true });

  const { count: bootshausReviewCount } = await client
    .from('import_review_queue')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', 'source-bootshaus-koeln');

  const { count: bootshausImportRecords } = await client
    .from('import_records')
    .select('*', { count: 'exact', head: true })
    .eq('source_id', 'source-bootshaus-koeln');

  const report = {
    capturedAt: new Date().toISOString(),
    target: process.env.EXPO_PUBLIC_SUPABASE_URL ?? null,
    tableProbes,
    sourcesCols,
    importRecordCols,
    eventCols,
    venueCols,
    queueCols,
    claimImportJobQueueFn: { ...claimFn, exists: claimFnExists },
    bootshausSource,
    bootshausVenues: bootshausVenues ?? [],
    bootshausOrganizers: bootshausOrganizers ?? [],
    koelnCities: koelnCities ?? [],
    trustRulesCount,
    bootshausReviewCount,
    bootshausImportRecords,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
