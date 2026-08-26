/**
 * M8.4 scheduler boundary — prepared, not activated.
 *
 * Recommended future topology for 500+ sources:
 *   Scheduler (Supabase pg_cron / external worker)
 *     → enqueue connectorId jobs (one runSourceSync per source)
 *     → worker pool with per-source operational maxConcurrency
 *
 * M8.5 must pass before enabling unattended scheduled apply.
 * Until then, only manual/test/retry triggers may call runSourceSync().
 */

export const UNATTENDED_SCHEDULER_ENABLED = false;

export type FutureSchedulerBackend =
  | 'supabase_pg_cron'
  | 'supabase_edge_function'
  | 'github_actions'
  | 'vercel_cron'
  | 'external_worker';

export interface SchedulerBoundaryNotes {
  unattendedSchedulerEnabled: false;
  recommendedBackend: FutureSchedulerBackend;
  jobGranularity: 'one_connector_per_job';
}

export const SCHEDULER_BOUNDARY: SchedulerBoundaryNotes = {
  unattendedSchedulerEnabled: false,
  recommendedBackend: 'external_worker',
  jobGranularity: 'one_connector_per_job',
};
