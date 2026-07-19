/**
 * Test Supabase staging connectivity (no migrations).
 * Requires: EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * Usage: npm run test:staging:connection
 */
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

function fail(message: string): never {
  console.error(`❌ ${message}`);
  process.exit(1);
}

if (!url || url.includes('YOUR_STAGING_PROJECT') || url.includes('your-project')) {
  fail('EXPO_PUBLIC_SUPABASE_URL is missing or still a placeholder');
}

if (!anonKey || anonKey.includes('your-staging-anon-key')) {
  fail('EXPO_PUBLIC_SUPABASE_ANON_KEY is missing or still a placeholder');
}

if (process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
  fail('EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY must not be used — use SUPABASE_SERVICE_ROLE_KEY server-side only');
}

const client = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main(): Promise<void> {
  console.log('==> Supabase staging connection test');
  console.log(`    URL: ${url}`);

  const health = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: anonKey },
  });
  if (!health.ok && health.status !== 404) {
    fail(`REST health check failed with HTTP ${health.status}`);
  }
  console.log(`  ✅ REST endpoint reachable (HTTP ${health.status})`);

  const { error: authError } = await client.auth.getSession();
  if (authError) {
    fail(`Auth endpoint error: ${authError.message}`);
  }
  console.log('  ✅ Auth endpoint reachable');

  const { data, error } = await client.from('events').select('id').eq('status', 'published').limit(1);
  if (error) {
    if (error.code === 'PGRST205' || error.message.includes('does not exist')) {
      console.log('  ⚠️  events table not found — connection OK, migrations not applied yet');
    } else {
      fail(`events query failed: ${error.message} (${error.code ?? 'unknown'})`);
    }
  } else {
    console.log(`  ✅ events query OK (${data?.length ?? 0} row(s) returned)`);
  }

  console.log('==> Connection test passed');
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message);
});
