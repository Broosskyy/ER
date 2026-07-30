/**
 * Sprint 33.1 — Origin backfill dry run (no writes).
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  adminEventRepository,
  adminSourceRepository,
  importRecordRepository,
  multiSourceRepositories,
} from '@/data/repositories/registry';
import { buildOriginBackfillPlan } from '@/features/operations/backfill/event-origins-backfill-plan';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint331_origin_backfill_dry_run.json',
);

async function main(): Promise<void> {
  const report = await buildOriginBackfillPlan({
    eventRepository: adminEventRepository,
    sourceRepository: adminSourceRepository,
    sourceReferences: multiSourceRepositories.sourceReferences,
    importRecordRepository,
  });
  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
