// Supabase Edge Function stub — scheduler tick trigger.
// Deploy separately; uses service role credentials from environment.
//
// Deno.serve(async () => {
//   const response = await fetch(`${SUPABASE_URL}/functions/v1/...`, ...);
//   return new Response(JSON.stringify({ ok: true }));
// });

export const SCHEDULER_EDGE_FUNCTION = {
  name: 'scheduler-tick',
  description: 'Triggers ImportSchedulerEngine.tick() with processQueue=false',
  script: 'scripts/operations/run-scheduler-tick.ts',
  env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPS_ACTOR_ID'],
};

export const WORKER_EDGE_FUNCTION = {
  name: 'queue-worker',
  description: 'Triggers ImportJobQueueWorker.processBatch()',
  script: 'scripts/operations/run-queue-worker.ts',
  env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPS_WORKER_BATCH_SIZE', 'OPS_ACTOR_ID'],
};

export const RECOVERY_EDGE_FUNCTION = {
  name: 'worker-recovery',
  description: 'Runs stuck queue recovery, lock release, and stale worker reconciliation',
  script: 'scripts/operations/run-worker-recovery.ts',
  env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPS_ACTOR_ID'],
};

export const CONNECTOR_HEALTH_EDGE_FUNCTION = {
  name: 'persist-connector-health',
  description: 'Persists connector health snapshots from SourceConnectorRegistry',
  script: 'scripts/operations/run-persist-connector-health.ts',
  env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
};
