/**
 * Apply Phase 4.6.8 service_role grants when DATABASE_URL is available.
 */
import './load-ops-env';

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const sqlPath = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../supabase/migrations/20260803130000_phase468_structured_lineup_service_grants.sql',
);

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  if (!databaseUrl) {
    console.log(
      'DATABASE_URL not set — apply 20260803130000_phase468_structured_lineup_service_grants.sql manually in Supabase SQL editor.',
    );
    process.exit(0);
  }
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  await client.query(readFileSync(sqlPath, 'utf8'));
  await client.end();
  console.log('Applied 20260803130000_phase468_structured_lineup_service_grants.sql');
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
