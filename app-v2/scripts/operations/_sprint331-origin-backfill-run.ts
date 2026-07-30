/**
 * Sprint 33.1 — Production origin backfill (direct execution, no operations_backfill_jobs DDL dependency).
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
import { createEventOriginsBackfillHandler } from '@/features/operations/backfill/event-origins-backfill-handler';
import { getSupabaseServiceClient } from '@/services/supabase/client';

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../docs/real-data/_sprint331_origin_backfill_run.json',
);

async function countOrigins(): Promise<{ total: number; withRole: number; backfilled: number }> {
  const client = getSupabaseServiceClient();
  const { data, error } = await client.from('event_source_references').select('metadata');
  if (error) {
    throw new Error(error.message);
  }
  const references = data ?? [];
  return {
    total: references.length,
    withRole: references.filter((row) => Boolean((row.metadata as Record<string, unknown>)?.role)).length,
    backfilled: references.filter((row) => Boolean((row.metadata as Record<string, unknown>)?.backfilledAt)).length,
  };
}

async function runPass(label: string, cursorStart = '0'): Promise<Record<string, unknown>> {
  const before = await countOrigins();
  const handler = createEventOriginsBackfillHandler(
    adminEventRepository,
    adminSourceRepository,
    multiSourceRepositories.sourceReferences,
    importRecordRepository,
  );

  let cursor = cursorStart;
  let processed = 0;
  let errors = 0;
  let completed = false;

  while (!completed) {
    const result = await handler.processBatch(
      {
        id: `sprint331-${label}`,
        backfillType: 'event_origins',
        status: 'running',
        processedCount: processed,
        errorCount: errors,
        batchSize: 50,
        cursorValue: cursor,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      50,
    );
    processed += result.processed;
    errors += result.errors;
    completed = result.completed;
    cursor = result.nextCursor ?? cursor;
    if (!result.nextCursor && !completed) {
      break;
    }
  }

  const after = await countOrigins();
  return { label, processed, errors, before, after, completed };
}

async function main(): Promise<void> {
  const passOne = await runPass('production');
  const passTwo = await runPass('idempotency');

  const report = {
    completedAt: new Date().toISOString(),
    passOne,
    passTwo,
    idempotent:
      passTwo.after.backfilled === passOne.after.backfilled &&
      passTwo.after.withRole === passOne.after.withRole &&
      passTwo.after.total === passOne.after.total &&
      passTwo.errors === 0,
  };

  writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));

  if (!passOne.completed || !passTwo.completed) {
    throw new Error('Origin backfill did not complete all batches.');
  }
  if (!report.idempotent) {
    throw new Error('Origin backfill idempotency check failed.');
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
