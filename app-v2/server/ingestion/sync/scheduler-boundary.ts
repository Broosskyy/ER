/**
 * M9.0 — Controlled staging scheduler boundary.
 *
 * Topology (one connector per job):
 *   GitHub Actions cron (external worker)
 *     → run-scheduled-staging-sync.ts
 *     → runSourceSync({ triggerType: 'scheduled', mode: 'apply' })
 *
 * Production automation remains disabled until a later explicit gate.
 */

import { AFFENKAEFIG_CONNECTOR_ID } from '../../official-connectors/affenkaefig/constants';
import { BOOTSHAUS_CONNECTOR_ID } from '../../official-connectors/bootshaus/constants';

/** Global kill switch for unattended staging scheduled apply. */
export const STAGING_SCHEDULER_ENABLED = true;

/** Production scheduler must remain off for M9.0. */
export const PRODUCTION_SCHEDULER_ENABLED = false;

/**
 * @deprecated Use STAGING_SCHEDULER_ENABLED. Kept for M8 script compatibility checks.
 */
export const UNATTENDED_SCHEDULER_ENABLED = STAGING_SCHEDULER_ENABLED;

export type FutureSchedulerBackend =
  | 'supabase_pg_cron'
  | 'supabase_edge_function'
  | 'github_actions'
  | 'vercel_cron'
  | 'external_worker';

export interface SchedulerBoundaryNotes {
  stagingSchedulerEnabled: boolean;
  productionSchedulerEnabled: boolean;
  recommendedBackend: FutureSchedulerBackend;
  jobGranularity: 'one_connector_per_job';
}

export const SCHEDULER_BOUNDARY: SchedulerBoundaryNotes = {
  stagingSchedulerEnabled: STAGING_SCHEDULER_ENABLED,
  productionSchedulerEnabled: PRODUCTION_SCHEDULER_ENABLED,
  recommendedBackend: 'github_actions',
  jobGranularity: 'one_connector_per_job',
};

/** Berlin-local slot labels (documentation). GHA cron uses UTC — see STAGING_CRON_UTC. */
export const STAGING_SCHEDULE_BERLIN = {
  [BOOTSHAUS_CONNECTOR_ID]: ['00:15', '06:15', '12:15', '18:15'],
  [AFFENKAEFIG_CONNECTOR_ID]: ['00:45', '06:45', '12:45', '18:45'],
} as const;

/**
 * GitHub Actions cron expressions in UTC matching Europe/Berlin CEST (UTC+2).
 * During CET (UTC+1) actual local times shift +1 hour — documented in M9 report.
 */
export const STAGING_CRON_UTC = {
  [BOOTSHAUS_CONNECTOR_ID]: ['15 22 * * *', '15 4 * * *', '15 10 * * *', '15 16 * * *'],
  [AFFENKAEFIG_CONNECTOR_ID]: ['45 22 * * *', '45 4 * * *', '45 10 * * *', '45 16 * * *'],
} as const;

export const STAGING_SCHEDULED_CONNECTOR_IDS = [
  BOOTSHAUS_CONNECTOR_ID,
  AFFENKAEFIG_CONNECTOR_ID,
] as const;

export type StagingScheduledConnectorId = (typeof STAGING_SCHEDULED_CONNECTOR_IDS)[number];

export function isStagingScheduledConnectorId(connectorId: string): connectorId is StagingScheduledConnectorId {
  return (STAGING_SCHEDULED_CONNECTOR_IDS as readonly string[]).includes(connectorId);
}
