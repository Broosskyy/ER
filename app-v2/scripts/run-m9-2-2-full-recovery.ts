#!/usr/bin/env tsx
/**
 * M9.2.2 — Full current event data recovery orchestration.
 *
 * Phases:
 * 1. Preflight + snapshot
 * 2. Past event cleanup (dry-run unless --apply-cleanup)
 * 3. Staging sync apply (both connectors) unless --skip-sync
 * 4. Second identical sync for idempotency unless --skip-second-sync
 * 5. M9.2 full verification + M9.2.1 media verification
 */
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  assertProductionNotLinked,
  createSupabaseCliLinkedQueryExecutor,
  loadJsonAgg,
  verifyLinkedStagingTarget,
} from '../server/ingestion/sync/linked-db';
import { PRODUCTION_PROJECT_REF, STAGING_PROJECT_REF } from '../server/ingestion/sync/staging-guard';

const OUT_DIR = '.tmp/m9-2-2-full-recovery';
const APPLY_CLEANUP = process.argv.includes('--apply-cleanup');
const SKIP_SYNC = process.argv.includes('--skip-sync');
const SKIP_SECOND_SYNC = process.argv.includes('--skip-second-sync');

function writeJson(name: string, payload: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, name), JSON.stringify(payload, null, 2));
}

function runStep(label: string, command: string): void {
  console.log(`[m9.2.2] ${label}`);
  execSync(command, { cwd: process.cwd(), stdio: 'inherit' });
}

async function main() {
  const cwd = process.cwd();
  assertProductionNotLinked(cwd);
  const staging = verifyLinkedStagingTarget(cwd);
  const runQuery = createSupabaseCliLinkedQueryExecutor(cwd);

  const preflight = {
    branch: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(),
    head: execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(),
    remoteHead: execSync('git rev-parse origin/rebuild/event-core-clean', { encoding: 'utf8' }).trim(),
    stagingProjectRef: staging.ref,
    productionProjectRef: PRODUCTION_PROJECT_REF,
    expectedStagingRef: STAGING_PROJECT_REF,
    productionMutations: 0,
    applyCleanup: APPLY_CLEANUP,
    skipSync: SKIP_SYNC,
  };
  writeJson('preflight.json', preflight);

  if (staging.ref !== STAGING_PROJECT_REF) {
    throw new Error(`staging_ref_mismatch:${staging.ref}`);
  }

  const snapshot = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows
    FROM (
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.ends_at,
        e.status,
        e.description,
        e.image_url,
        (SELECT COUNT(*)::int FROM public.event_lineup l WHERE l.event_id = e.id) AS lineup_count,
        (SELECT COUNT(*)::int FROM public.event_genres g WHERE g.event_id = e.id) AS genre_count,
        (SELECT COUNT(*)::int FROM public.event_tickets tk WHERE tk.event_id = e.id) AS ticket_count
      FROM public.events e
      WHERE e.status = 'published'
    ) t;
    `,
  );
  writeJson('pre-snapshot.json', { events: snapshot, count: snapshot.length });

  runStep(
    'past-event-cleanup',
    `npx tsx scripts/cleanup-m9-2-2-past-events.ts${APPLY_CLEANUP ? ' --apply' : ''}`,
  );

  if (!SKIP_SYNC) {
    runStep('sync-bootshaus-apply-1', 'npx tsx scripts/run-scheduled-staging-sync.ts bootshaus-official');
    runStep('sync-affenkaefig-apply-1', 'npx tsx scripts/run-scheduled-staging-sync.ts affenkaefig-official');
  }

  if (!SKIP_SYNC && !SKIP_SECOND_SYNC) {
    runStep('sync-bootshaus-apply-2', 'npx tsx scripts/run-scheduled-staging-sync.ts bootshaus-official');
    runStep('sync-affenkaefig-apply-2', 'npx tsx scripts/run-scheduled-staging-sync.ts affenkaefig-official');
  }

  runStep('m9-2-full-verification', 'npx tsx scripts/run-m9-2-full-verification.ts');
  runStep('m9-2-1-media-verification', 'npx tsx scripts/run-m9-2-1-media-verification.ts');
  runStep('m9-2-1-media-gate', 'npx tsx scripts/run-m9-2-1-media-gate.ts');

  const postSnapshot = loadJsonAgg<Record<string, unknown>>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows
    FROM (
      SELECT
        e.id,
        e.title,
        e.starts_at,
        e.ends_at,
        e.status,
        (SELECT COUNT(*)::int FROM public.event_genres g WHERE g.event_id = e.id) AS genre_count,
        (SELECT COUNT(*)::int FROM public.event_tickets tk WHERE tk.event_id = e.id) AS ticket_count
      FROM public.events e
      WHERE e.status = 'published'
    ) t;
    `,
  );
  writeJson('post-snapshot.json', { events: postSnapshot, count: postSnapshot.length });

  console.log(
    JSON.stringify({
      status: 'M9_2_2_ORCHESTRATION_COMPLETE',
      eventsBefore: snapshot.length,
      eventsAfter: postSnapshot.length,
      outputDir: OUT_DIR,
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
