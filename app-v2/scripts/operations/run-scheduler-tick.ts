/**
 * Deployment trigger: scheduler tick (enqueue only).
 * Usage: npx tsx scripts/operations/run-scheduler-tick.ts
 *
 * Callable from cron, edge functions, or external schedulers.
 */
import './bootstrap-ops-supabase';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { operationsTriggerService } from '@/data/repositories/registry';

async function main() {
  await initializeEntityAliasStore();
  const result = await operationsTriggerService.triggerScheduler({
    triggerType: process.env.OPS_TRIGGER_TYPE === 'cron' ? 'cron' : 'external_scheduler',
    actorId: process.env.OPS_ACTOR_ID ?? 'ops-scheduler-script',
    processQueue: false,
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
