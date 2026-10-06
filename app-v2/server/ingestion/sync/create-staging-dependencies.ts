import { randomUUID } from 'node:crypto';

import { registerDefaultOfficialConnectors } from '../../official-connectors/register-default-connectors';
import { getOfficialSourceRegistry } from '../../official-connectors/source-registry';
import {
  getSourceOperationalConfigRegistry,
  registerDefaultSourceOperationalConfigs,
} from '../../official-connectors/source-operational-config';
import { createOfficialEventApplyExecutor } from './execute-official-event-apply';
import { executeTicketPersistenceFromResults, planTicketPersistenceFromResults } from './execute-ticket-persistence';
import { loadPlannerContextFromLinkedDb } from './load-planner-context';
import {
  createSupabaseCliLinkedQueryExecutor,
  type LinkedQueryExecutor,
  verifyLinkedStagingTarget,
} from './linked-db';
import type { SyncOrchestratorDependencies } from './orchestrator';
import { createSqlIngestionSyncPersistence } from './sql-run-persistence';
import type { IngestionSyncPersistence } from './run-persistence';
import { STAGING_PROJECT_REF } from './staging-guard';

export interface StagingSyncDependenciesOptions {
  cwd?: string;
  runQuery?: LinkedQueryExecutor;
  persistence?: IngestionSyncPersistence;
  verifyTarget?: boolean;
}

export function createStagingSyncDependencies(
  options: StagingSyncDependenciesOptions = {},
): SyncOrchestratorDependencies {
  const cwd = options.cwd ?? process.cwd();
  if (options.verifyTarget !== false) {
    verifyLinkedStagingTarget(cwd);
  }

  const runQuery = options.runQuery ?? createSupabaseCliLinkedQueryExecutor(cwd);
  registerDefaultOfficialConnectors();
  registerDefaultSourceOperationalConfigs();

  return {
    registry: getOfficialSourceRegistry(),
    operationalConfig: getSourceOperationalConfigRegistry(),
    persistence: options.persistence ?? createSqlIngestionSyncPersistence(runQuery),
    loadPlannerContext: async () => loadPlannerContextFromLinkedDb(runQuery),
    applyPlan: createOfficialEventApplyExecutor(runQuery),
    applyTicketResults: async (results, mode) => {
      if (mode === 'dry_run') {
        const planned = planTicketPersistenceFromResults(runQuery, results);
        return {
          applied: false,
          inserts: planned.currentTicketInsertsRequired,
          updates: planned.currentTicketUpdatesRequired,
          deletes: planned.currentTicketDeletesRequired,
          ticketRowsChanged:
            planned.currentTicketInsertsRequired +
            planned.currentTicketUpdatesRequired +
            planned.currentTicketDeletesRequired,
          allIdempotent: planned.allIdempotent,
        };
      }
      return executeTicketPersistenceFromResults(runQuery, results);
    },
    createRunId: () => randomUUID(),
    linkedProjectRef: STAGING_PROJECT_REF,
  };
}
