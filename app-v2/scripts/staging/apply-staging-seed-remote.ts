#!/usr/bin/env tsx
/**
 * Apply scripts/staging/seed-staging-app-data.sql to remote Supabase staging.
 *
 * Requires one of:
 * - SUPABASE_DB_URL or DATABASE_URL (direct Postgres connection string)
 * - Supabase CLI logged in + linked project (`npx supabase db query --linked`)
 *
 * Usage:
 *   npm run seed:staging:remote
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const scriptDir = __dirname;
const projectRoot = path.resolve(scriptDir, '../..');
const seedPath = path.join(scriptDir, 'seed-staging-app-data.sql');

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

async function applyWithPg(dbUrl: string): Promise<void> {
  const { Client } = await import('pg');
  const sql = readFileSync(seedPath, 'utf8');
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query(sql);
  } finally {
    await client.end();
  }
}

function applyWithSupabaseCli(): void {
  const quotedSeed = `"${seedPath}"`;
  execSync(`npx supabase db query --file ${quotedSeed} --linked`, {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

async function main(): Promise<void> {
  if (!readFileSync(seedPath, 'utf8').includes('staging-seed-city-koeln')) {
    fail(`Unexpected seed file content: ${seedPath}`);
  }

  const dbUrl = process.env.SUPABASE_DB_URL ?? process.env.DATABASE_URL;

  console.log('==> Applying staging seed');
  console.log(`    File: ${seedPath}`);

  if (dbUrl) {
    console.log('    Method: direct Postgres (SUPABASE_DB_URL / DATABASE_URL)');
    await applyWithPg(dbUrl);
    console.log('✅ Staging seed applied successfully');
    return;
  }

  console.log('    Method: Supabase CLI (--linked)');
  try {
    applyWithSupabaseCli();
    console.log('✅ Staging seed applied successfully');
  } catch {
    fail(
      [
        'Could not apply staging seed.',
        'Set SUPABASE_DB_URL in app-v2/.env (Supabase Dashboard → Database → Connection string),',
        'or run: supabase login && supabase link --project-ref <ref>',
        'then retry: npm run seed:staging:remote',
      ].join('\n'),
    );
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  fail(message);
});
