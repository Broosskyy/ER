import { classifySourceConnectorError } from '@/features/aggregation/connectors/framework/error-classifier';
import { SourceConnectorError } from '@/features/aggregation/connectors/framework/errors';
import {
  buildRetryMetadata,
  resolveSourceConnectorRetry,
  sleep,
} from '@/features/aggregation/connectors/framework/retry';
import type { SourceConnectorRateLimiter } from '@/features/aggregation/connectors/framework/rate-limit';
import {
  createEmptyDiagnostics,
  detectMappingIssues,
} from '@/features/aggregation/connectors/framework/diagnostics';
import type { RegisteredSourceConnector } from '@/features/aggregation/connectors/framework/base-source-connector';
import type { AggregationSource } from '@/features/aggregation/domain/aggregation-source';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';
import type { ImportSource } from '@/features/import/models/types';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { SourceConnectorDiagnostics } from '@/features/aggregation/connectors/framework/diagnostics';

export interface SourceConnectorExecutionResult {
  events: RawImportedEvent[];
  diagnostics: SourceConnectorDiagnostics;
  retryMetadata: ReturnType<typeof buildRetryMetadata>[];
}

export interface SourceConnectorExecutionObserver {
  onSuccess?: (input: {
    connectorKey: string;
    durationMs: number;
    eventCount: number;
    skippedRecords: number;
    diagnostics: SourceConnectorDiagnostics;
  }) => void;
  onFailure?: (input: {
    connectorKey: string;
    durationMs: number;
    error: SourceConnectorError;
    diagnostics: SourceConnectorDiagnostics;
  }) => void;
}

export class SourceConnectorExecutor {
  constructor(
    private readonly rateLimiter: SourceConnectorRateLimiter,
    private readonly observer: SourceConnectorExecutionObserver = {},
  ) {}

  async execute(
    connector: RegisteredSourceConnector,
    source: AggregationSource,
    importSource: ImportSource,
    context: PipelineRunContext,
  ): Promise<SourceConnectorExecutionResult> {
    const retryConfig = connector.getRetryConfig(importSource);
    const rateLimitConfig = connector.getRateLimitConfig(importSource);
    const version = connector.describeVersion();
    const diagnostics = createEmptyDiagnostics(version);
    const retryMetadata: ReturnType<typeof buildRetryMetadata>[] = [];
    const startedAt = Date.now();
    let attempt = 0;
    let rateLimited = false;

    while (attempt <= retryConfig.maxRetries) {
      attempt += 1;
      diagnostics.retryAttempts = attempt - 1;

      const acquisition = await this.rateLimiter.acquire(connector.connectorKey, rateLimitConfig);
      rateLimited = rateLimited || acquisition.rateLimited;

      try {
        const fetchStartedAt = Date.now();
        const events = await connector.fetchRawEvents(source, importSource, context);
        const mappingIssues = detectMappingIssues(events);
        const skippedRecords = mappingIssues.length;

        diagnostics.durationMs = Date.now() - startedAt;
        diagnostics.eventCount = events.length;
        diagnostics.skippedRecords = skippedRecords;
        diagnostics.mappingIssues = mappingIssues;
        diagnostics.rateLimited = rateLimited;
        diagnostics.apiVersion = version.supportedApiVersions[0];

        this.observer.onSuccess?.({
          connectorKey: connector.connectorKey,
          durationMs: diagnostics.durationMs,
          eventCount: events.length,
          skippedRecords,
          diagnostics,
        });

        return {
          events,
          diagnostics: {
            ...diagnostics,
            warnings:
              skippedRecords > 0
                ? [
                    {
                      code: 'mapping_warning',
                      message: `${skippedRecords} mapping issue(s) detected.`,
                    },
                  ]
                : [],
          },
          retryMetadata,
        };
      } catch (error) {
        const classified = classifySourceConnectorError(error);
        diagnostics.errors.push(classified);

        const decision = resolveSourceConnectorRetry(classified, attempt, retryConfig);
        if (decision.retryable && decision.delayMs !== undefined) {
          retryMetadata.push(buildRetryMetadata(attempt, retryConfig, classified, decision.delayMs));
          await sleep(decision.delayMs);
          continue;
        }

        diagnostics.durationMs = Date.now() - startedAt;
        diagnostics.rateLimited = rateLimited || classified.code === 'rate_limited';
        const connectorError = new SourceConnectorError(classified, error);
        this.observer.onFailure?.({
          connectorKey: connector.connectorKey,
          durationMs: diagnostics.durationMs,
          error: connectorError,
          diagnostics,
        });
        throw connectorError;
      } finally {
        this.rateLimiter.release(connector.connectorKey);
      }
    }

    throw new SourceConnectorError({
      code: 'upstream_unavailable',
      message: 'Connector retry loop exited unexpectedly.',
      retryable: false,
    });
  }
}
