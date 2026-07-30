/**
 * Apply Sprint 33.1 grants and policies when DATABASE_URL is available.
 */
import './load-ops-env';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
 '../../supabase/migrations/20260766000000_sprint331_source_onboarding_rls.sql',
);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.log('DATABASE_URL not set — apply 20260766000000 manually in Supabase SQL editor.');
    process.exit(0);
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(readFileSync(sqlPath, 'utf8'));
  await client.end();
  console.log('Applied 20260766000000_sprint331_source_onboarding_rls.sql');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
