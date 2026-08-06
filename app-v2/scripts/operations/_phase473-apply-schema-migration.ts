/**
 * Phase 4.7.3 — Apply canonical event attributes schema migration only.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase473-apply-schema-migration.ts
 */
import './bootstrap-ops-supabase';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const MIGRATION_FILE = '20260803140000_phase473_canonical_event_attributes.sql';
const MIGRATION_PATH = join(ROOT, 'supabase/migrations', MIGRATION_FILE);
const OUT = join(ROOT, 'docs/real-data/_phase473_schema_apply.json');

const PHASE473_COLUMNS = [
  'event_attributes',
  'floor_count',
  'stage_count',
  'venue_environment',
  'last_entry_at',
  'dress_code',
  'accessibility_notes',
] as const;

async function probeColumn(column: string): Promise<boolean> {
  const { error } = await getSupabaseServiceClient().from('events').select(column).limit(1);
  return !error;
}

async function migrationApplied(): Promise<boolean> {
  const results = await Promise.all(PHASE473_COLUMNS.map((column) => probeColumn(column)));
  return results.every(Boolean);
}

async function publishedCount(): Promise<number> {
  const { count, error } = await getSupabaseServiceClient()
    .from('events')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'published');
  if (error) {
    throw new Error(error.message);
  }
  return count ?? 0;
}

async function main(): Promise<void> {
  const beforePublished = await publishedCount();
  const alreadyApplied = await migrationApplied();

  const result: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    migrationFile: MIGRATION_FILE,
    beforePublishedCount: beforePublished,
    alreadyApplied,
    applied: false,
    rowsChangedByMigration: 0,
  };

  if (alreadyApplied) {
    result.applied = true;
    result.status = 'already_applied';
    result.afterPublishedCount = beforePublished;
    writeFileSync(OUT, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL / SUPABASE_DB_URL required to apply migration.');
  }
  if (!existsSync(MIGRATION_PATH)) {
    throw new Error(`Migration file not found: ${MIGRATION_PATH}`);
  }

  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }

  const afterPublished = await publishedCount();
  const verified = await migrationApplied();

  result.applied = verified;
  result.status = verified ? 'applied' : 'failed_verification';
  result.afterPublishedCount = afterPublished;
  result.publishedCountStable = beforePublished === afterPublished;
  result.rowsChangedByMigration = 0;

  writeFileSync(OUT, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));

  if (!verified) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
