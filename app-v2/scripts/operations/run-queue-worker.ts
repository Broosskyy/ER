/**
 * Deployment trigger: queue worker batch processing.
 * Usage: npx tsx scripts/operations/run-queue-worker.ts
 *
 * Callable from cron, edge functions, or external schedulers.
 */
import './bootstrap-ops-supabase';
import { registerGracefulShutdownHandlers } from '@/features/operations/deployment/graceful-shutdown';
import { flushEntityAliasStore, initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { operationsTriggerService } from '@/data/repositories/registry';

async function main() {
  await initializeEntityAliasStore();
  await registerGracefulShutdownHandlers();

  const batchSize = process.env.OPS_WORKER_BATCH_SIZE
    ? Number(process.env.OPS_WORKER_BATCH_SIZE)
    : 10;

  const result = await operationsTriggerService.triggerWorker({
    triggerType: process.env.OPS_TRIGGER_TYPE === 'cron' ? 'cron' : 'external_scheduler',
    actorId: process.env.OPS_ACTOR_ID ?? 'ops-worker-script',
    batchSize,
  });

  await flushEntityAliasStore();

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
