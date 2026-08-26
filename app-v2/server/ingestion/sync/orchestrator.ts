import { officialEvidenceToEventCandidate } from '../adapters/official-evidence-adapter';
import {
  buildOfficialEventApplySummary,
  isOfficialEventApplyNoop,
  OfficialEventApplyError,
} from '../planning/event-apply';
import { isPlanIdempotent, planOfficialEventWrites, type PlannerContext } from '../planning/event-write-planner';
import type { EventWritePlan } from '../types/event-candidate';
import { classifyIngestionError } from './error-taxonomy';
import { appendZeroResultAnomaly, detectUnexpectedZeroResults, updateSourceHealth } from './health';
import type { IngestionSyncPersistence } from './run-persistence';
import { DEFAULT_RETRY_POLICY, executeWithRetry } from './retry-policy';
import type {
  ApplyExecutionResult,
  IngestionErrorCategory,
  IngestionRunRecord,
  IngestionRunStatus,
  SyncEventProcessingResult,
  SyncRunCounters,
  SyncRunMode,
  SyncRunRequest,
  SyncRunResult,
  SyncTriggerType,
} from './types';
import { createEmptySyncRunCounters } from './types';
import type { OfficialConnector, OfficialConnectorRunResult } from '../../official-connectors/connector-contract';
import type { OfficialSourceRegistry } from '../../official-connectors/source-registry';
import type { SourceOperationalConfigRegistry } from '../../official-connectors/source-operational-config';

export interface SyncOrchestratorDependencies {
  registry: OfficialSourceRegistry;
  operationalConfig: SourceOperationalConfigRegistry;
  persistence: IngestionSyncPersistence;
  loadPlannerContext: (connectorId: string) => Promise<PlannerContext>;
  applyPlan?: (plan: EventWritePlan) => Promise<ApplyExecutionResult>;
  createRunId?: () => string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
}

function createRunIdDefault(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function recordIdentityCounters(counters: SyncRunCounters, plan: EventWritePlan): void {
  const decision = plan.identity?.decision;
  if (decision === 'exact_match') {
    counters.exactMatches += 1;
  } else if (decision === 'strong_match') {
    counters.strongMatches += 1;
  } else if (decision === 'review_required' || decision === 'possible_match') {
    counters.reviewRequired += 1;
  }
}

function isIdentityReview(plan: EventWritePlan): boolean {
  const decision = plan.identity?.decision;
  return decision === 'review_required' || decision === 'possible_match';
}

function canApplyPlan(plan: EventWritePlan): boolean {
  return (
    plan.validation.decision === 'persist_ready' &&
    !plan.reconciliation?.reviewRequired &&
    !isIdentityReview(plan) &&
    !isOfficialEventApplyNoop(plan)
  );
}

function classifyPlanOutcome(plan: EventWritePlan, mode: SyncRunMode, applied: boolean): SyncEventProcessingResult['outcome'] {
  if (plan.validation.decision === 'rejected') {
    return 'rejected';
  }
  if (
    plan.validation.decision === 'review_required' ||
    plan.reconciliation?.reviewRequired ||
    isIdentityReview(plan)
  ) {
    return 'review_required';
  }
  if (isPlanIdempotent(plan) || isOfficialEventApplyNoop(plan)) {
    return 'noop';
  }
  if (mode === 'apply' && applied) {
    return 'applied';
  }
  return 'planned_only';
}

function updatePlanCounters(counters: SyncRunCounters, plan: EventWritePlan): void {
  const identityReview = isIdentityReview(plan);
  recordIdentityCounters(counters, plan);

  if (plan.validation.decision === 'rejected') {
    counters.rejected += 1;
    return;
  }
  if (plan.validation.decision === 'review_required' || plan.reconciliation?.reviewRequired || identityReview) {
    if (!identityReview) {
      counters.reviewRequired += 1;
    }
    return;
  }
  if (isPlanIdempotent(plan)) {
    counters.noops += 1;
    return;
  }
  if (plan.eventAction === 'insert') {
    counters.newEvents += 1;
    return;
  }
  counters.safeUpdates += 1;
}

function resolveRunStatus(
  counters: SyncRunCounters,
  connectorFailed: boolean,
  errorCategories: IngestionErrorCategory[],
): IngestionRunStatus {
  if (connectorFailed && counters.planned === 0) {
    return 'failed';
  }
  if (errorCategories.includes('unexpected_zero_results')) {
    return counters.failures > 0 || counters.rejected > 0 ? 'partially_succeeded' : 'failed';
  }
  if (connectorFailed || counters.failures > 0) {
    if (counters.planned > counters.failures + counters.rejected) {
      return 'partially_succeeded';
    }
    return counters.planned > 0 ? 'partially_succeeded' : 'failed';
  }
  if (counters.rejected > 0 || counters.reviewRequired > 0) {
    return counters.planned > counters.rejected ? 'partially_succeeded' : 'succeeded';
  }
  return 'succeeded';
}

async function processConnectorResult(
  connectorResult: OfficialConnectorRunResult,
  connectorId: string,
  mode: SyncRunMode,
  counters: SyncRunCounters,
  deps: SyncOrchestratorDependencies,
): Promise<{ eventResults: SyncEventProcessingResult[]; errorCategories: IngestionErrorCategory[] }> {
  const eventResults: SyncEventProcessingResult[] = [];
  const errorCategories: IngestionErrorCategory[] = [];

  counters.discovered = connectorResult.discoveredDetailUrls.length;
  counters.fetched = connectorResult.loadedDetailUrls.length;
  counters.parsed = connectorResult.previews.length;

  const context = await deps.loadPlannerContext(connectorId);
  const candidates = connectorResult.previews.map((preview) => officialEvidenceToEventCandidate(preview));
  counters.candidates = candidates.length;

  const plans = planOfficialEventWrites(candidates, context);
  counters.planned = plans.length;

  for (const plan of plans) {
    const sourceEventKey =
      plan.candidate.origin.kind === 'official_connector' ? plan.candidate.origin.sourceEventKey : 'unknown';
    const officialUrl =
      plan.candidate.origin.kind === 'official_connector' ? plan.candidate.origin.officialUrl : '';

    try {
      updatePlanCounters(counters, plan);
      let applied = false;

      if (mode === 'apply' && canApplyPlan(plan) && deps.applyPlan) {
        const applyResult = await deps.applyPlan(plan);
        if (applyResult.applied) {
          counters.appliedWrites += 1;
          applied = true;
        }
      }

      const outcome = classifyPlanOutcome(plan, mode, applied);
      if (outcome === 'review_required') {
        errorCategories.push('reconciliation_review');
      }
      if (outcome === 'rejected') {
        errorCategories.push('validation_rejected');
      }

      eventResults.push({ sourceEventKey, officialUrl, outcome });
    } catch (error) {
      counters.failures += 1;
      const classified = classifyIngestionError(error);
      errorCategories.push(classified.category);
      eventResults.push({
        sourceEventKey,
        officialUrl,
        outcome: 'failed',
        errorCategory: classified.category,
        errorMessage: classified.message,
      });
    }
  }

  return { eventResults, errorCategories: [...new Set(errorCategories)] };
}

export async function runSourceSync(
  request: SyncRunRequest,
  deps: SyncOrchestratorDependencies,
): Promise<SyncRunResult> {
  const mode: SyncRunMode = request.mode ?? 'dry_run';
  const triggerType: SyncTriggerType = request.triggerType ?? 'manual';
  const now = deps.now ?? (() => new Date());
  const createRunId = deps.createRunId ?? createRunIdDefault;
  const startedAt = now().toISOString();
  const runId = createRunId();
  const counters = createEmptySyncRunCounters();
  const operational = deps.operationalConfig.get(request.connectorId);
  const enabled = operational?.enabled ?? false;

  const previousHealth = await deps.persistence.getHealth(request.connectorId);

  if (!enabled) {
    const run: IngestionRunRecord = {
      runId,
      connectorId: request.connectorId,
      mode,
      triggerType,
      status: 'cancelled',
      startedAt,
      finishedAt: startedAt,
      durationMs: 0,
      counters,
      errorCategories: ['source_disabled'],
      errorSummary: 'source_disabled',
      retryCount: 0,
    };
    await deps.persistence.createRun(run);
    const health = updateSourceHealth({
      connectorId: request.connectorId,
      enabled: false,
      previousHealth,
      run,
    });
    health.healthStatus = 'disabled';
    health.lastDurationMs = 0;
    await deps.persistence.upsertHealth(health);
    return { run, eventResults: [], health };
  }

  const runningRecord: IngestionRunRecord = {
    runId,
    connectorId: request.connectorId,
    mode,
    triggerType,
    status: 'running',
    startedAt,
    counters,
    errorCategories: [],
    retryCount: 0,
  };
  await deps.persistence.createRun(runningRecord);

  let connector: OfficialConnector;
  try {
    connector = deps.registry.get(request.connectorId);
  } catch (error) {
    const classified = classifyIngestionError(error);
    const finishedAt = now().toISOString();
    const run: IngestionRunRecord = {
      ...runningRecord,
      status: 'failed',
      finishedAt,
      durationMs: 0,
      errorCategories: [classified.category],
      errorSummary: classified.message,
    };
    await deps.persistence.completeRun(runId, run);
    const health = updateSourceHealth({
      connectorId: request.connectorId,
      enabled,
      previousHealth,
      run,
    });
    health.lastDurationMs = 0;
    await deps.persistence.upsertHealth(health);
    return { run, eventResults: [], health };
  }

  const retryPolicy = {
    ...DEFAULT_RETRY_POLICY,
    ...operational?.retryPolicy,
  };

  const connectorExecution = await executeWithRetry(
    () =>
      connector.runPreview({
        maxDetailPages: request.maxDetailPages,
        now: () => now(),
      }),
    retryPolicy,
    deps.sleep,
  );

  let eventResults: SyncEventProcessingResult[] = [];
  let errorCategories: IngestionErrorCategory[] = [];
  let connectorFailed = false;

  if (connectorExecution.result) {
    const processed = await processConnectorResult(
      connectorExecution.result,
      request.connectorId,
      mode,
      counters,
      deps,
    );
    eventResults = processed.eventResults;
    errorCategories = processed.errorCategories;
  } else {
    connectorFailed = true;
    if (connectorExecution.errorCategory) {
      errorCategories.push(connectorExecution.errorCategory);
    }
  }

  const zeroResultAnomaly = detectUnexpectedZeroResults(
    counters,
    previousHealth,
    operational?.expectedMinParsedOnSuccess,
  );
  if (zeroResultAnomaly) {
    errorCategories = appendZeroResultAnomaly(errorCategories);
  }

  const finishedAt = now().toISOString();
  const durationMs = now().getTime() - new Date(startedAt).getTime();
  const status = resolveRunStatus(counters, connectorFailed, errorCategories);

  const run: IngestionRunRecord = {
    ...runningRecord,
    status,
    finishedAt,
    durationMs,
    counters,
    errorCategories,
    errorSummary: connectorExecution.errorMessage ?? errorCategories.join(','),
    retryCount: Math.max(0, connectorExecution.attempts - 1),
  };

  await deps.persistence.completeRun(runId, run);

  const health = updateSourceHealth({
    connectorId: request.connectorId,
    enabled,
    previousHealth,
    run,
  });
  health.lastDurationMs = durationMs;
  await deps.persistence.upsertHealth(health);

  return { run, eventResults, health };
}

export function simulateApplyExecution(plan: EventWritePlan): ApplyExecutionResult {
  if (!canApplyPlan(plan)) {
    return {
      applied: false,
      logicalOperations: 0,
      databaseRowsInserted: 0,
      databaseRowsUpdated: 0,
      databaseRowsDeleted: 0,
      ticketRowsChanged: 0,
    };
  }

  try {
    const summary = buildOfficialEventApplySummary(plan, {
      eventId: plan.resolvedEventId ?? '00000000-0000-4000-8000-000000000001',
      sourceId: plan.existingSource?.sourceId ?? '00000000-0000-4000-8000-000000000002',
      venueId:
        plan.existingVenueId ??
        (plan.venueAction === 'insert' ? '00000000-0000-4000-8000-000000000003' : undefined),
    });

    return {
      applied: summary.logicalOperations > 0,
      logicalOperations: summary.logicalOperations,
      databaseRowsInserted: summary.databaseRowsInserted,
      databaseRowsUpdated: summary.databaseRowsUpdated,
      databaseRowsDeleted: summary.databaseRowsDeleted,
      ticketRowsChanged: 0,
    };
  } catch (error) {
    if (error instanceof OfficialEventApplyError) {
      throw error;
    }
    throw error;
  }
}
