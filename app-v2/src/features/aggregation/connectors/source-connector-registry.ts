import { ClubWebsiteConnector } from '@/features/aggregation/connectors/club-website-connector';
import { CsvImportConnector } from '@/features/aggregation/connectors/csv-import-connector';
import { AtomFeedConnector, RssFeedConnector } from '@/features/aggregation/connectors/feed-source-connector';
import { IcalFeedConnector } from '@/features/aggregation/connectors/ical-feed-connector';
import { ManualReferenceConnector } from '@/features/aggregation/connectors/manual-reference-connector';
import { OpenDataApiConnector } from '@/features/aggregation/connectors/open-data-api-connector';
import { OrganizerWebsiteConnector } from '@/features/aggregation/connectors/organizer-website-connector';
import { TicketPlatformConnector } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-connector';
import { resolveSourceConnectorKey } from '@/features/aggregation/connectors/source-connector-resolution';
import type { RegisteredSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import {
  resolveRateLimitConfig,
  resolveRetryConfig,
} from '@/features/aggregation/connectors/framework/config';
import { getSourceConnectorDefinition } from '@/features/aggregation/connectors/framework/connector-definitions';
import type { SourceConnectorDescriptor } from '@/features/aggregation/connectors/framework/descriptor';
import {
  createInitialHealthSnapshot,
  resolveHealthStatusFromErrorCode,
  type SourceConnectorHealthSnapshot,
} from '@/features/aggregation/connectors/framework/health';
import {
  createInitialMetrics,
  recordConnectorRunMetrics,
  type SourceConnectorMetrics,
} from '@/features/aggregation/connectors/framework/metrics';
import {
  SourceConnectorExecutor,
  type SourceConnectorExecutionObserver,
} from '@/features/aggregation/connectors/framework/source-connector-executor';
import {
  SourceConnectorRateLimiter,
  sourceConnectorRateLimiter,
} from '@/features/aggregation/connectors/framework/rate-limit';
import type { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import {
  adaptRegisteredConnectorToSourceModule,
  type SourceModule,
} from '@/features/aggregation/connectors/framework/source-module-contract';
import type { SourceConnector, SourceConnectorKey } from '@/features/aggregation/connectors/types';

interface ConnectorRuntimeState {
  health: SourceConnectorHealthSnapshot;
  metrics: SourceConnectorMetrics;
}

function buildDescriptor(connector: RegisteredSourceConnector, state: ConnectorRuntimeState): SourceConnectorDescriptor {
  const definition = connector.getDefinition();
  return {
    connectorKey: connector.connectorKey,
    displayName: connector.displayName,
    connectorType: definition.connectorType,
    dataFormat: definition.dataFormat,
    authentication: definition.authentication,
    timeoutMs: definition.timeoutMs,
    version: connector.describeVersion(),
    capabilities: connector.describeCapabilities(),
    retryConfig: resolveRetryConfig(definition.retryConfig),
    rateLimitConfig: resolveRateLimitConfig(definition.rateLimitConfig),
    health: state.health,
    metrics: state.metrics,
    limitations: definition.limitations,
  };
}

function recordSuccess(
  state: ConnectorRuntimeState,
  durationMs: number,
  eventCount: number,
  skippedRecords: number,
): ConnectorRuntimeState {
  const totalRuns = state.health.totalRunCount + 1;
  const successRuns = Math.round(state.health.successRate * state.health.totalRunCount) + 1;
  const averageDurationMs =
    (state.health.averageDurationMs * state.health.totalRunCount + durationMs) / totalRuns;

  return {
    health: {
      status: 'healthy',
      lastSuccessfulRunAt: new Date().toISOString(),
      successRate: successRuns / totalRuns,
      errorCount: state.health.errorCount,
      totalRunCount: totalRuns,
      averageDurationMs,
      lastResponseTimeMs: durationMs,
      updatedAt: new Date().toISOString(),
    },
    metrics: recordConnectorRunMetrics(state.metrics, {
      importedEvents: eventCount,
      skippedEvents: skippedRecords,
      durationMs,
    }),
  };
}

function recordFailure(
  state: ConnectorRuntimeState,
  durationMs: number,
  error: SourceConnectorError,
): ConnectorRuntimeState {
  const totalRuns = state.health.totalRunCount + 1;
  const successRuns = Math.round(state.health.successRate * state.health.totalRunCount);

  return {
    health: {
      status: resolveHealthStatusFromErrorCode(error.code),
      lastSuccessfulRunAt: state.health.lastSuccessfulRunAt,
      lastErrorAt: new Date().toISOString(),
      lastErrorCode: error.code,
      lastErrorMessage: error.message,
      successRate: totalRuns > 0 ? successRuns / totalRuns : 0,
      errorCount: state.health.errorCount + 1,
      totalRunCount: totalRuns,
      averageDurationMs:
        (state.health.averageDurationMs * state.health.totalRunCount + durationMs) / totalRuns,
      lastResponseTimeMs: durationMs,
      updatedAt: new Date().toISOString(),
    },
    metrics: {
      ...state.metrics,
      totalRuns: state.metrics.totalRuns + 1,
      lastUpdatedAt: new Date().toISOString(),
    },
  };
}

export class SourceConnectorRegistry {
  private readonly connectors = new Map<SourceConnectorKey, RegisteredSourceConnector>();
  private readonly runtime = new Map<SourceConnectorKey, ConnectorRuntimeState>();
  private readonly rateLimiter: SourceConnectorRateLimiter;
  private readonly executor: SourceConnectorExecutor;

  constructor(
    connectors: RegisteredSourceConnector[] = [],
    options: {
      rateLimiter?: SourceConnectorRateLimiter;
      observer?: SourceConnectorExecutionObserver;
    } = {},
  ) {
    this.rateLimiter = options.rateLimiter ?? sourceConnectorRateLimiter;
    this.executor = new SourceConnectorExecutor(this.rateLimiter, {
      onSuccess: ({ connectorKey, durationMs, eventCount, skippedRecords, diagnostics }) => {
        const current = this.runtime.get(connectorKey as SourceConnectorKey);
        if (!current) return;
        this.runtime.set(
          connectorKey as SourceConnectorKey,
          recordSuccess(current, durationMs, eventCount, skippedRecords),
        );
        options.observer?.onSuccess?.({
          connectorKey,
          durationMs,
          eventCount,
          skippedRecords,
          diagnostics,
        });
      },
      onFailure: ({ connectorKey, durationMs, error, diagnostics }) => {
        const current = this.runtime.get(connectorKey as SourceConnectorKey);
        if (!current) return;
        this.runtime.set(
          connectorKey as SourceConnectorKey,
          recordFailure(current, durationMs, error),
        );
        options.observer?.onFailure?.({
          connectorKey,
          durationMs,
          error,
          diagnostics,
        });
      },
    });

    for (const connector of connectors) {
      this.register(connector);
    }
  }

  register(connector: RegisteredSourceConnector): void {
    this.connectors.set(connector.connectorKey, connector);
    this.runtime.set(connector.connectorKey, {
      health: createInitialHealthSnapshot(),
      metrics: createInitialMetrics(),
    });
  }

  get(key: SourceConnectorKey): RegisteredSourceConnector {
    const connector = this.connectors.get(key);
    if (!connector) {
      throw new Error(`Source connector "${key}" is not registered.`);
    }
    return connector;
  }

  getExecutor(): SourceConnectorExecutor {
    return this.executor;
  }

  getDescriptor(key: SourceConnectorKey): SourceConnectorDescriptor {
    const connector = this.get(key);
    const state = this.runtime.get(key) ?? {
      health: createInitialHealthSnapshot(),
      metrics: createInitialMetrics(),
    };
    return buildDescriptor(connector, state);
  }

  listDescriptors(): SourceConnectorDescriptor[] {
    return [...this.connectors.keys()].map((key) => this.getDescriptor(key));
  }

  listSourceModules(): SourceModule[] {
    return [...this.connectors.values()].map(adaptRegisteredConnectorToSourceModule);
  }

  getSourceModule(key: SourceConnectorKey): SourceModule {
    return adaptRegisteredConnectorToSourceModule(this.get(key));
  }

  getHealth(key: SourceConnectorKey): SourceConnectorHealthSnapshot {
    return this.getDescriptor(key).health;
  }

  getMetrics(key: SourceConnectorKey): SourceConnectorMetrics {
    return this.getDescriptor(key).metrics;
  }

  getRateLimiter(): SourceConnectorRateLimiter {
    return this.rateLimiter;
  }

  resolveConnectorKey(input: {
    connectorKey?: SourceConnectorKey;
    parserType?: string;
    sourceType?: string;
    adapterKey?: string;
    sourceRoles?: import('@/features/sources/domain/source-entity-roles').SourceEntityRole[];
  }): SourceConnectorKey {
    return resolveSourceConnectorKey(input);
  }

  inspectDefinition(key: SourceConnectorKey) {
    return getSourceConnectorDefinition(key);
  }
}

export function createDefaultSourceConnectorRegistry(): SourceConnectorRegistry {
  return new SourceConnectorRegistry([
    new ManualReferenceConnector(),
    new ClubWebsiteConnector(),
    new OrganizerWebsiteConnector(),
    new IcalFeedConnector(),
    new OpenDataApiConnector(),
    new RssFeedConnector(),
    new AtomFeedConnector(),
    new CsvImportConnector(),
    new TicketPlatformConnector(),
  ]);
}

export const sourceConnectorRegistry = createDefaultSourceConnectorRegistry();

export type { SourceConnector };
