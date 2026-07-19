#!/usr/bin/env tsx
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const migrationsDir = path.resolve(__dirname, '../supabase/migrations');

const requiredTables = ['import_jobs', 'import_records', 'import_logs'];
const requiredChecks = [
  'is_admin()',
  'admin_manage_import_jobs',
  'admin_manage_import_records',
  'admin_manage_import_logs',
  'admin_read_sources',
  'admin_manage_sources',
  'completed_with_warnings',
  'fetched_count',
  'validation_errors',
  'source_config',
  'matched_city_id',
  'duplicate_score',
];

function main(): void {
  const files = readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    throw new Error('No migration files found.');
  }

  const sql = files.map((file) => readFileSync(path.join(migrationsDir, file), 'utf8')).join('\n');

  for (const table of requiredTables) {
    if (!sql.includes(`create table`) || !sql.includes(table)) {
      throw new Error(`Missing table definition for ${table}.`);
    }
  }

  for (const check of requiredChecks) {
    if (!sql.includes(check)) {
      throw new Error(`Missing migration requirement: ${check}`);
    }
  }

  console.log(`Validated ${files.length} migration file(s).`);
  console.log('Import foundation tables and admin RLS checks passed.');
}

main();
