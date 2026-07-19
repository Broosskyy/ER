/**
 * Remote Supabase staging validation.
 * Requires: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 * Optional: STAGING_ADMIN_JWT, STAGING_VIEWER_JWT, etc. for role matrix tests
 *
 * Usage: npx tsx scripts/staging/validate-rls-remote.ts
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabaseUrl: string = url;
const supabaseAnonKey: string = anonKey;

interface TestCase {
  label: string;
  jwt?: string;
  table: string;
  operation: 'select' | 'insert';
  expectSuccess: boolean;
}

async function runTest(test: TestCase): Promise<boolean> {
  const client = createClient(supabaseUrl, test.jwt ?? supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    if (test.operation === 'select') {
      const { data, error } = await client.from(test.table).select('id').limit(1);
      if (test.expectSuccess) {
        if (error) {
          console.log(`  ❌ ${test.label}: ${error.message}`);
          return false;
        }
        console.log(`  ✅ ${test.label}: ${data?.length ?? 0} rows`);
        return true;
      }
      if (error || (data && data.length === 0)) {
        console.log(`  ✅ ${test.label}: denied/empty`);
        return true;
      }
      console.log(`  ❌ ${test.label}: unexpected data`);
      return false;
    }

    const { error } = await client.from(test.table).insert({
      id: `test-${Date.now()}`,
      actor_id: 'test',
      action: 'test',
      entity_type: 'test',
      entity_id: 'test',
      summary: 'staging validation probe',
    });
    if (test.expectSuccess && !error) {
      console.log(`  ✅ ${test.label}: insert allowed`);
      return true;
    }
    if (!test.expectSuccess && error) {
      console.log(`  ✅ ${test.label}: insert denied`);
      return true;
    }
    console.log(`  ❌ ${test.label}: unexpected result`);
    return false;
  } catch (e) {
    if (!test.expectSuccess) {
      console.log(`  ✅ ${test.label}: denied`);
      return true;
    }
    console.log(`  ❌ ${test.label}: ${e}`);
    return false;
  }
}

async function main() {
  console.log('==> Remote RLS validation');
  console.log(`    Target: ${url}`);

  const tests: TestCase[] = [
    { label: 'anon: import_jobs read', table: 'import_jobs', operation: 'select', expectSuccess: false },
    { label: 'anon: import_records read', table: 'import_records', operation: 'select', expectSuccess: false },
    { label: 'anon: published events read', table: 'events', operation: 'select', expectSuccess: true },
  ];

  if (process.env.STAGING_VIEWER_JWT) {
    tests.push({
      label: 'viewer: import_jobs read',
      jwt: process.env.STAGING_VIEWER_JWT,
      table: 'import_jobs',
      operation: 'select',
      expectSuccess: true,
    });
  }

  let passed = 0;
  for (const test of tests) {
    if (await runTest(test)) passed++;
  }

  console.log(`\n==> ${passed}/${tests.length} remote RLS tests passed`);
  if (!process.env.STAGING_VIEWER_JWT) {
    console.log('    ℹ️  Set STAGING_VIEWER_JWT etc. for full role matrix');
  }
  process.exit(passed === tests.length ? 0 : 1);
}

main();
