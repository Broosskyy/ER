/**
 * Deployment trigger: worker recovery sweep.
 * Usage: npx tsx scripts/operations/run-worker-recovery.ts
 */
import './bootstrap-ops-supabase';
import { initializeEntityAliasStore } from '@/features/entity-resolution/entity-alias-store-bootstrap';
import { operationsTriggerService } from '@/data/repositories/registry';

async function main() {
  await initializeEntityAliasStore();
  const result = await operationsTriggerService.triggerRecovery(
    process.env.OPS_ACTOR_ID ?? 'ops-recovery-script',
  );
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
