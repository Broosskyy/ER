/**
 * Read-only migration drift audit via Supabase service role (no mutations).
 * schema_migrations requires direct Postgres; this script fingerprints public schema.
 */
import './bootstrap-ops-supabase';

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const migrationsDir = join(projectRoot, 'supabase/migrations');
const OUT = join(projectRoot, 'docs/real-data/_migration_drift_audit.json');

type ProbeResult = { ok: boolean; detail?: string };

async function probeTable(table: string): Promise<ProbeResult> {
  const client = getSupabaseServiceClient();
  const { error } = await client.from(table).select('*', { count: 'exact', head: true });
  return { ok: !error, detail: error?.message };
}

async function probeRpc(fn: string, args: Record<string, unknown>): Promise<ProbeResult> {
  const client = getSupabaseServiceClient();
  const { error } = await client.rpc(fn, args);
  return { ok: !error, detail: error?.message };
}

async function probeSourceColumns(): Promise<Record<string, ProbeResult>> {
  const client = getSupabaseServiceClient();
  const columns = [
    'publish_mode',
    'source_roles',
    'schedule_enabled',
    'schedule_policy',
    'computed_trust_score',
    'connector_key',
    'source_config',
    'last_error',
  ];
  const out: Record<string, ProbeResult> = {};
  for (const column of columns) {
    const { error } = await client.from('sources').select(column).limit(1);
    out[column] = { ok: !error, detail: error?.message };
  }
  return out;
}

async function probeBootshaus268(): Promise<Record<string, unknown>> {
  const client = getSupabaseServiceClient();
  const { data: source, error: sourceError } = await client
    .from('sources')
    .select('id, source_config')
    .eq('id', 'source-bootshaus-koeln')
    .maybeSingle();
  const { data: venues, error: venueError } = await client
    .from('venues')
    .select('id, slug, city, country')
    .or('id.eq.venue-bootshaus-koeln,slug.eq.bootshaus-koeln')
    .limit(5);
  const { data: organizers, error: organizerError } = await client
    .from('organizers')
    .select('id, slug, name')
    .or('id.eq.organizer-bootshaus,slug.eq.bootshaus')
    .limit(5);
  return {
    sourceError: sourceError?.message ?? null,
    defaultsPresent: Boolean(source?.source_config?.defaults),
    venueSelectorPresent: Boolean(source?.source_config?.website?.htmlSelector?.venueSelector),
    venues: venues ?? [],
    venueError: venueError?.message ?? null,
    organizers: organizers ?? [],
    organizerError: organizerError?.message ?? null,
  };
}

function parseRepoMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file, index) => {
      const match = /^(\d{14})_(.+)\.sql$/.exec(file);
      const version = match?.[1] ?? file;
      const name = match?.[2] ?? file.replace(/\.sql$/, '');
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      const header = sql.split('\n').find((line) => line.trim().startsWith('--')) ?? '';
      const description = header.replace(/^--\s*/, '').trim() || name.replace(/_/g, ' ');
      return { file, version, name, description, order: index + 1 };
    });
}

const MIGRATION_MARKERS: Record<string, string[]> = {
  '20260719000000': ['cities', 'venues', 'events', 'sources', 'genres'],
  '20260720000000': ['import_jobs', 'import_records'],
  '20260722000000': ['import_records'],
  '20260727000000': ['contributor_event_drafts'],
  '20260736000000': ['organizers'],
  '20260741000000': ['event_source_references'],
  '20260742000000': ['entity_identity_aliases', 'entity_resolution_decisions'],
  '20260744000000': ['sources'],
  '20260745000000': ['festivals', 'festival_editions'],
  '20260746000000': ['import_job_queue', 'scheduler_runs'],
  '20260747000000': ['import_review_queue', 'trust_quality_rules'],
  '20260748000000': ['event_match_evaluations'],
  '20260749000000': ['event_lifecycle_events'],
  '20260750000000': ['platform_operations_state', 'connector_health_snapshots'],
  '20260752000000': ['discovery_search_documents'],
  '20260756000000': ['platform_operations_state'],
  '20260757000000': ['sources', 'venues', 'organizers'],
};

async function main() {
  const repoMigrations = parseRepoMigrations();
  const tableProbes: Record<string, ProbeResult> = {};
  const tables = [
    'cities', 'venues', 'events', 'sources', 'genres', 'artists', 'collections',
    'import_jobs', 'import_records', 'import_logs', 'import_review_queue',
    'trust_quality_rules', 'source_reputation_events', 'event_source_references',
    'entity_identity_aliases', 'entity_resolution_decisions', 'organizers',
    'festivals', 'festival_editions', 'import_job_queue', 'scheduler_runs',
    'platform_operations_state', 'connector_health_snapshots', 'event_match_evaluations',
    'event_lifecycle_events', 'discovery_search_documents', 'contributor_event_drafts',
    'event_search_documents',
  ];
  for (const table of tables) {
    tableProbes[table] = await probeTable(table);
  }

  const sourceColumns = await probeSourceColumns();
  const claimFn = await probeRpc('claim_import_job_queue_entries', {
    p_limit: 0,
    p_now: new Date().toISOString(),
    p_worker_id: 'migration-audit',
    p_lease_ms: 1000,
  });
  const bootshaus268 = await probeBootshaus268();

  const inferred: Record<string, { status: string; evidence: string[] }> = {};
  for (const migration of repoMigrations) {
    const markers = MIGRATION_MARKERS[migration.version] ?? [];
    const evidence: string[] = [];
    let status = 'Unknown (no marker mapped)';

    if (migration.version === '20260744000000') {
      if (sourceColumns.publish_mode?.ok) {
        status = 'Likely Applied';
        evidence.push('sources.publish_mode exists');
      } else {
        status = 'Missing or Partial';
        evidence.push(`sources.publish_mode missing: ${sourceColumns.publish_mode?.detail}`);
      }
    } else if (migration.version === '20260757000000') {
      if (bootshaus268.defaultsPresent) {
        status = 'Likely Applied';
        evidence.push('source_config.defaults present');
      } else {
        status = 'Missing or Partial';
        evidence.push('source_config.defaults absent');
      }
      if ((bootshaus268.venues as unknown[]).length > 0) {
        evidence.push('bootshaus venue row exists');
      } else {
        evidence.push('bootshaus venue row missing');
      }
    } else if (migration.version === '20260756000000') {
      if (claimFn.ok) {
        status = 'Likely Applied';
        evidence.push('claim_import_job_queue_entries callable by service role');
      } else {
        status = 'Missing or Partial';
        evidence.push(`claim RPC failed: ${claimFn.detail}`);
      }
    } else if (markers.length > 0) {
      const results = markers.map((table) => ({ table, ...tableProbes[table] }));
      const allOk = results.every((row) => row.ok);
      const anyOk = results.some((row) => row.ok);
      if (allOk) {
        status = 'Likely Applied';
      } else if (anyOk) {
        status = 'Partial / Unclear';
      } else {
        status = 'Missing or Partial';
      }
      evidence.push(...results.map((row) => `${row.table}: ${row.ok ? 'ok' : row.detail}`));
    }

    inferred[migration.version] = { status, evidence };
  }

  const report = {
    capturedAt: new Date().toISOString(),
    targetHost: process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? null,
    schemaMigrationsReadable: false,
    schemaMigrationsNote:
      'supabase_migrations.schema_migrations requires SUPABASE_DB_URL/DATABASE_URL (not configured). Audit uses public-schema fingerprinting.',
    repoCount: repoMigrations.length,
    repoMigrations,
    tableProbes,
    sourceColumns,
    claimImportJobQueueFn: claimFn,
    bootshaus268,
    inferred,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    repoCount: report.repoCount,
    schemaMigrationsReadable: report.schemaMigrationsReadable,
    inferredSummary: Object.fromEntries(
      Object.entries(inferred).map(([version, value]) => [version, value.status]),
    ),
    missingLikely: Object.entries(inferred)
      .filter(([, value]) => value.status === 'Missing or Partial')
      .map(([version]) => version),
    bootshaus268,
    sourceColumns,
    claimFn,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
