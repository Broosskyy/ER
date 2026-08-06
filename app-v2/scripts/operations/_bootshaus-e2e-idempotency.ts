/**
 * Bootshaus E2E idempotency — two controlled import runs with metrics.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const BOOTSHAUS = 'source-bootshaus-koeln';
const OUT = join(process.cwd(), 'docs/real-data/_bootshaus_e2e_idempotency.json');

function runScript(script: string) {
  const r = spawnSync('npx', ['tsx', script], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    env: process.env,
    timeout: 300_000,
  });
  return { exitCode: r.status, stdout: r.stdout?.slice(-2000) ?? '', stderr: r.stderr?.slice(-1000) ?? '' };
}

async function metrics(label: string) {
  const c = getSupabaseServiceClient();
  const { count: records } = await c
    .from('import_records')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS);
  const { data: reviews } = await c
    .from('import_review_queue')
    .select('status')
    .eq('source_id', BOOTSHAUS);
  const activeReviews = (reviews ?? []).filter((r) => r.status === 'pending' || r.status === 'on_hold').length;
  const { count: events } = await c
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS)
    .eq('status', 'published');
  const { count: refs } = await c
    .from('event_source_references')
    .select('id', { count: 'exact', head: true })
    .eq('source_id', BOOTSHAUS);
  const { data: job } = await c
    .from('import_jobs')
    .select('created_count, updated_count, fetched_count')
    .eq('source_id', BOOTSHAUS)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return { label, importRecords: records ?? 0, activeReviews, publishedEvents: events ?? 0, sourceReferences: refs ?? 0, latestJob: job };
}

async function runImport(label: string) {
  const c = getSupabaseServiceClient();
  const now = new Date().toISOString();
  await c.from('sources').update({ next_scheduled_at: now }).eq('id', BOOTSHAUS);
  const scheduler = runScript('scripts/operations/run-scheduler-tick.ts');
  const worker = runScript('scripts/operations/run-queue-worker.ts');
  return { label, scheduler, worker, metrics: await metrics(label) };
}

async function main() {
  const before = await metrics('before');
  const run1 = await runImport('run1');
  const mid = await metrics('after-run1');
  const run2 = await runImport('run2');
  const after = await metrics('after-run2');
  const artifact = { before, run1, mid, run2, after, capturedAt: new Date().toISOString() };
  writeFileSync(OUT, JSON.stringify(artifact, null, 2));
  console.log(JSON.stringify(artifact, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
