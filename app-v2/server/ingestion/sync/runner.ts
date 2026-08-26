import { registerDefaultOfficialConnectors } from '../../official-connectors/register-default-connectors';
import { getOfficialSourceRegistry } from '../../official-connectors/source-registry';
import {
  getSourceOperationalConfigRegistry,
  registerDefaultSourceOperationalConfigs,
} from '../../official-connectors/source-operational-config';
import { mapWithBoundedConcurrency } from './concurrency';
import type { PlannerContext } from '../planning/event-write-planner';
import { runSourceSync, type SyncOrchestratorDependencies } from './orchestrator';
import { createInMemoryIngestionSyncPersistence } from './run-persistence';
import type { SyncRunRequest, SyncRunResult } from './types';

export interface BatchSyncRunRequest {
  connectorIds: string[];
  mode?: SyncRunRequest['mode'];
  triggerType?: SyncRunRequest['triggerType'];
  maxConcurrency?: number;
}

export interface BatchSyncRunResult {
  results: SyncRunResult[];
  durationMs: number;
  sourceIsolationFailures: number;
}

export interface DefaultSyncDependenciesOptions {
  loadPlannerContext?: (connectorId: string) => Promise<PlannerContext>;
  applyPlan?: SyncOrchestratorDependencies['applyPlan'];
  persistence?: ReturnType<typeof createInMemoryIngestionSyncPersistence>;
}

export function createDefaultSyncDependencies(
  options: DefaultSyncDependenciesOptions = {},
): SyncOrchestratorDependencies {
  registerDefaultOfficialConnectors();
  registerDefaultSourceOperationalConfigs();

  return {
    registry: getOfficialSourceRegistry(),
    operationalConfig: getSourceOperationalConfigRegistry(),
    persistence: options.persistence ?? createInMemoryIngestionSyncPersistence(),
    loadPlannerContext:
      options.loadPlannerContext ??
      (async () => ({
        existingSources: [],
        existingVenues: [],
        existingEvents: [],
        eventCatalog: [],
      })),
    applyPlan: options.applyPlan,
  };
}

export async function runSourceSyncWithDefaults(
  request: SyncRunRequest,
  options: DefaultSyncDependenciesOptions = {},
): Promise<SyncRunResult> {
  const deps = createDefaultSyncDependencies(options);
  return runSourceSync(request, deps);
}

export async function runBatchSourceSync(
  request: BatchSyncRunRequest,
  deps: SyncOrchestratorDependencies,
): Promise<BatchSyncRunResult> {
  const startedAt = Date.now();
  const maxConcurrency =
    request.maxConcurrency ??
    Math.max(1, ...request.connectorIds.map((id) => deps.operationalConfig.get(id)?.maxConcurrency ?? 1));

  const results = await mapWithBoundedConcurrency(
    request.connectorIds,
    maxConcurrency,
    async (connectorId) =>
      runSourceSync(
        {
          connectorId,
          mode: request.mode,
          triggerType: request.triggerType,
        },
        deps,
      ),
  );

  let sourceIsolationFailures = 0;
  const connectorIds = new Set(results.map((result) => result.run.connectorId));
  if (connectorIds.size !== results.length) {
    sourceIsolationFailures += 1;
  }

  for (const result of results) {
    if (result.run.connectorId !== result.health.connectorId) {
      sourceIsolationFailures += 1;
    }
  }

  return {
    results,
    durationMs: Date.now() - startedAt,
    sourceIsolationFailures,
  };
}
