import type { ConnectorContext, ConnectorLogLevel } from '@/features/connectors/contracts/connector-context';
import type {
  ConnectorExecutionLogEntry,
  ConnectorExecutionRequest,
  ConnectorExecutionResult,
  ConnectorExecutionStatus,
} from '@/features/connectors/contracts/connector-execution';
import type { ConnectorResult } from '@/features/connectors/contracts/connector-result';
import type { ConnectorFrameworkService } from '@/features/connectors/services/connector-framework-service';
import type { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import type { EndpointExecutionLoader } from '@/features/connectors/domain/endpoint-execution-loader';
import type { ConnectorExecutionRepository } from '@/features/connectors/repositories/connector-execution-repository';
import { validateAcquisitionCandidates } from '@/features/connectors/domain/candidate-validation';
import {
  createCorrelationId,
  createExecutionId,
} from '@/features/connectors/domain/connector-execution-ids';
import { validateEndpointExecutable } from '@/features/connectors/domain/endpoint-execution-validation';
import { sanitizeExecutionLogMetadata } from '@/features/connectors/domain/execution-log-sanitizer';
import { mapEndpointToConnectorRef } from '@/features/endpoints/domain/endpoint-mapper';
import {
  ConnectorExecutionError,
  ConnectorRegistryError,
  ConnectorValidationError,
  createConnectorErrorDetail,
  type ConnectorErrorDetail,
} from '@/features/connectors/errors/connector-errors';
import type { ImportTriggerType } from '@/features/import/models/statuses';

export interface ConnectorExecutionEngineOptions {
  signal?: AbortSignal;
}

function mapTriggerToImportTrigger(trigger: ConnectorExecutionRequest['trigger']): ImportTriggerType {
  if (trigger === 'system') {
    return 'scheduled';
  }
  return 'manual';
}

function isCancelled(signal?: AbortSignal): boolean {
  return Boolean(signal?.aborted);
}

export class ConnectorExecutionEngine {
  constructor(
    private readonly endpointLoader: EndpointExecutionLoader,
    private readonly registry: ConnectorRegistry,
    private readonly frameworkService: ConnectorFrameworkService,
    private readonly executionRepository: ConnectorExecutionRepository,
  ) {}

  async execute(
    request: ConnectorExecutionRequest,
    options: ConnectorExecutionEngineOptions = {},
  ): Promise<ConnectorExecutionResult> {
    const executionId = createExecutionId();
    const correlationId = request.correlationId?.trim() || createCorrelationId();
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const signal = options.signal;
    const logs: ConnectorExecutionLogEntry[] = [];

    const log = async (
      level: ConnectorLogLevel,
      code: string,
      message: string,
      metadata?: Record<string, unknown>,
    ) => {
      logs.push({
        level,
        code,
        message,
        timestamp: new Date().toISOString(),
        metadata: sanitizeExecutionLogMetadata(metadata),
      });
    };

    let endpointLoadDurationMs = 0;
    let connectorResolutionDurationMs = 0;
    let connectorExecutionDurationMs = 0;
    let connectorKey = '';
    let sourceId: string | undefined;
    let endpointId = request.endpointId;
    let connectorDiagnostics: Record<string, unknown> = {};
    let candidates: ConnectorExecutionResult['candidates'] = [];
    let errors: ConnectorErrorDetail[] = [];
    let status: ConnectorExecutionStatus = 'failed';

    const finalize = async (
      finalStatus: ConnectorExecutionStatus,
      finalErrors: ConnectorErrorDetail[],
      finalCandidates: ConnectorExecutionResult['candidates'],
      finalConnectorDiagnostics: Record<string, unknown>,
    ): Promise<ConnectorExecutionResult> => {
      status = finalStatus;
      errors = finalErrors;
      candidates = finalCandidates;
      connectorDiagnostics = finalConnectorDiagnostics;

      const completedAt = new Date().toISOString();
      const durationMs = Date.now() - startedMs;

      await log('info', 'EXECUTION_COMPLETED', 'Connector execution completed.', {
        executionId,
        correlationId,
        endpointId,
        connectorKey: connectorKey || undefined,
        trigger: request.trigger,
        requestedBy: request.requestedBy,
        sourceId,
        status,
        durationMs,
        candidateCount: candidates.length,
        errorCode: errors[0]?.code,
        errorCategory: errors[0]?.category,
      });

      const result: ConnectorExecutionResult = {
        executionId,
        endpointId,
        sourceId,
        connectorKey,
        trigger: request.trigger,
        status,
        startedAt,
        completedAt,
        durationMs,
        candidates,
        diagnostics: {
          endpointLoadDurationMs,
          connectorResolutionDurationMs,
          connectorExecutionDurationMs,
          totalDurationMs: durationMs,
          candidateCount: candidates.length,
          connectorDiagnostics,
          cancelled: finalStatus === 'cancelled',
          finalStatus,
        },
        errors,
        logs,
      };

      try {
        await this.executionRepository.saveCompleted({
          executionId,
          endpointId,
          sourceId,
          connectorKey,
          trigger: request.trigger,
          status,
          startedAt,
          completedAt,
          durationMs,
          candidateCount: candidates.length,
          correlationId,
          requestedBy: request.requestedBy,
          errorSummary: errors[0]?.message,
          diagnosticsSummary: {
            endpointLoadDurationMs,
            connectorResolutionDurationMs,
            connectorExecutionDurationMs,
            candidateCount: candidates.length,
            cancelled: finalStatus === 'cancelled',
          },
        });
      } catch (error) {
        await log(
          'error',
          'EXECUTION_PERSISTENCE_FAILED',
          error instanceof Error ? error.message : 'Failed to persist execution record.',
        );
        errors = [
          ...errors,
          createConnectorErrorDetail(
            'unknown',
            'EXECUTION_PERSISTENCE_FAILED',
            'Execution completed but persistence failed.',
          ),
        ];
        result.errors = errors;
      }

      return result;
    };

    await log('info', 'EXECUTION_REQUESTED', 'Connector execution requested.', {
      executionId,
      correlationId,
      endpointId: request.endpointId,
      trigger: request.trigger,
      requestedBy: request.requestedBy,
      sourceId: request.sourceId,
    });

    try {
      await this.executionRepository.saveStarted({
        executionId,
        endpointId: request.endpointId,
        sourceId: request.sourceId,
        connectorKey: '',
        trigger: request.trigger,
        status: 'failed',
        startedAt,
        completedAt: startedAt,
        durationMs: 0,
        candidateCount: 0,
        correlationId,
        requestedBy: request.requestedBy,
        diagnosticsSummary: { phase: 'started' },
      });
    } catch (error) {
      return finalize(
        'failed',
        [
          createConnectorErrorDetail(
            'unknown',
            'EXECUTION_PERSISTENCE_FAILED',
            error instanceof Error ? error.message : 'Failed to persist execution start.',
          ),
        ],
        [],
        {},
      );
    }

    if (isCancelled(signal)) {
      return finalize(
        'cancelled',
        [
          createConnectorErrorDetail(
            'unknown',
            'EXECUTION_CANCELLED',
            'Execution was cancelled before endpoint loading.',
          ),
        ],
        [],
        {},
      );
    }

    const endpointLoadStarted = Date.now();
    const loaded = await this.endpointLoader.loadByEndpointId(
      request.endpointId,
      request.sourceId,
    );
    endpointLoadDurationMs = Date.now() - endpointLoadStarted;

    if (!loaded) {
      return finalize(
        'failed',
        [
          createConnectorErrorDetail(
            'configuration',
            'ENDPOINT_NOT_FOUND',
            `Endpoint "${request.endpointId}" was not found.`,
          ),
        ],
        [],
        {},
      );
    }

    endpointId = loaded.endpoint.id;
    sourceId = loaded.source.id;

    await log('info', 'EXECUTION_ENDPOINT_LOADED', 'Endpoint loaded for execution.', {
      executionId,
      correlationId,
      endpointId,
      sourceId,
      connectorKey: loaded.endpoint.connectorKey,
      durationMs: endpointLoadDurationMs,
    });

    if (isCancelled(signal)) {
      return finalize(
        'cancelled',
        [
          createConnectorErrorDetail(
            'unknown',
            'EXECUTION_CANCELLED',
            'Execution was cancelled before connector resolution.',
          ),
        ],
        [],
        {},
      );
    }

    const executablePreValidation = validateEndpointExecutable({
      endpoint: loaded.endpoint,
      source: loaded.source,
    });
    if (!executablePreValidation.valid) {
      return finalize(
        'failed',
        executablePreValidation.issues.map((issue) =>
          createConnectorErrorDetail('configuration', issue.code, issue.message, {
            metadata: issue.field ? { field: issue.field } : undefined,
          }),
        ),
        [],
        {},
      );
    }

    const resolutionStarted = Date.now();
    let registration;
    try {
      registration = this.registry.getRegistration(loaded.endpoint.connectorKey);
      connectorKey = registration.connectorKey;
    } catch (error) {
      connectorResolutionDurationMs = Date.now() - resolutionStarted;
      const message =
        error instanceof ConnectorRegistryError
          ? error.message
          : 'Connector could not be resolved.';
      return finalize(
        'failed',
        [
          createConnectorErrorDetail(
            'configuration',
            error instanceof ConnectorRegistryError ? error.code : 'CONNECTOR_NOT_FOUND',
            message,
          ),
        ],
        [],
        {},
      );
    }
    connectorResolutionDurationMs = Date.now() - resolutionStarted;

    const executableValidation = validateEndpointExecutable({
      endpoint: loaded.endpoint,
      source: loaded.source,
      registration,
    });
    if (!executableValidation.valid) {
      return finalize(
        'failed',
        executableValidation.issues.map((issue) =>
          createConnectorErrorDetail('configuration', issue.code, issue.message, {
            metadata: issue.field ? { field: issue.field } : undefined,
          }),
        ),
        [],
        {},
      );
    }

    connectorKey = executableValidation.connectorKey ?? connectorKey;

    await log('info', 'EXECUTION_CONNECTOR_RESOLVED', 'Connector resolved for execution.', {
      executionId,
      correlationId,
      endpointId,
      sourceId,
      connectorKey,
      durationMs: connectorResolutionDurationMs,
    });

    if (isCancelled(signal)) {
      return finalize(
        'cancelled',
        [
          createConnectorErrorDetail(
            'unknown',
            'EXECUTION_CANCELLED',
            'Execution was cancelled before connector start.',
          ),
        ],
        [],
        {},
      );
    }

    const context = this.buildContext({
      loadedSource: loaded.source,
      endpoint: loaded.endpoint,
      executionId,
      correlationId,
      trigger: request.trigger,
      requestedBy: request.requestedBy,
      signal,
      log,
    });

    await log('info', 'EXECUTION_STARTED', 'Connector execution started.', {
      executionId,
      correlationId,
      endpointId,
      sourceId,
      connectorKey,
      trigger: request.trigger,
      requestedBy: request.requestedBy,
    });

    const connectorStarted = Date.now();
    let connectorResult: ConnectorResult;
    try {
      connectorResult = await this.frameworkService.executeConnector(connectorKey, context);
    } catch (error) {
      connectorExecutionDurationMs = Date.now() - connectorStarted;
      return finalize(
        'failed',
        this.mapThrownError(error),
        [],
        {},
      );
    }
    connectorExecutionDurationMs = Date.now() - connectorStarted;

    if (isCancelled(signal)) {
      return finalize(
        'cancelled',
        [
          createConnectorErrorDetail(
            'unknown',
            'EXECUTION_CANCELLED',
            'Execution was cancelled during connector execution.',
          ),
        ],
        [],
        connectorResult.diagnostics,
      );
    }

    if (connectorResult == null || typeof connectorResult !== 'object') {
      return finalize(
        'failed',
        [
          createConnectorErrorDetail(
            'configuration',
            'CONNECTOR_CONTRACT_VIOLATION',
            'Connector returned an invalid result.',
          ),
        ],
        [],
        {},
      );
    }

    const candidateValidation = validateAcquisitionCandidates({
      candidates: connectorResult.candidates,
      endpointId: loaded.endpoint.id,
      sourceId: loaded.source.id,
    });

    if (!candidateValidation.valid) {
      return finalize(
        'failed',
        [...connectorResult.errors, ...candidateValidation.errors],
        [],
        connectorResult.diagnostics,
      );
    }

    if (connectorResult.status === 'failed' || connectorResult.errors.length > 0) {
      return finalize(
        'failed',
        connectorResult.errors.length > 0
          ? connectorResult.errors
          : [
              createConnectorErrorDetail(
                'unknown',
                'CONNECTOR_EXECUTION_FAILED',
                'Connector execution failed.',
              ),
            ],
        connectorResult.candidates,
        connectorResult.diagnostics,
      );
    }

    await log('info', 'EXECUTION_SUCCEEDED', 'Connector execution succeeded.', {
      executionId,
      correlationId,
      endpointId,
      sourceId,
      connectorKey,
      candidateCount: connectorResult.candidates.length,
      durationMs: connectorExecutionDurationMs,
    });

    return finalize('succeeded', connectorResult.errors, connectorResult.candidates, connectorResult.diagnostics);
  }

  private buildContext(input: {
    loadedSource: ConnectorContext['source'];
    endpoint: {
      id: string;
      displayName: string;
      url?: string;
      endpointType: string;
      connectorKey: string;
    };
    executionId: string;
    correlationId: string;
    trigger: ConnectorExecutionRequest['trigger'];
    requestedBy?: string;
    signal?: AbortSignal;
    log: ConnectorContext['log'];
  }): ConnectorContext {
    return {
      source: input.loadedSource,
      endpoint: mapEndpointToConnectorRef({
        id: input.endpoint.id,
        sourceId: input.loadedSource.id,
        displayName: input.endpoint.displayName,
        endpointType: input.endpoint.endpointType as never,
        connectorKey: input.endpoint.connectorKey,
        enabled: true,
        createdAt: input.loadedSource.createdAt,
        updatedAt: input.loadedSource.updatedAt,
        url: input.endpoint.url,
      }),
      execution: {
        executionId: input.executionId,
        correlationId: input.correlationId,
        triggerType: mapTriggerToImportTrigger(input.trigger),
        startedAt: new Date().toISOString(),
        initiatedBy: input.requestedBy,
      },
      runtime: {
        abortSignal: input.signal,
        cancellationRequested: isCancelled(input.signal),
      },
      log: input.log,
    };
  }

  private mapThrownError(error: unknown): ConnectorErrorDetail[] {
    if (error instanceof ConnectorValidationError) {
      return [
        createConnectorErrorDetail('configuration', error.code, error.message, {
          retryable: false,
        }),
      ];
    }

    if (error instanceof ConnectorRegistryError) {
      return [
        createConnectorErrorDetail('configuration', error.code, error.message, {
          retryable: false,
        }),
      ];
    }

    if (error instanceof ConnectorExecutionError) {
      return [
        createConnectorErrorDetail(error.category, error.code, error.message, {
          retryable: false,
        }),
      ];
    }

    if (error instanceof Error) {
      return [
        createConnectorErrorDetail(
          'unknown',
          'ENGINE_UNEXPECTED_ERROR',
          error.message,
          { retryable: false },
        ),
      ];
    }

    return [
      createConnectorErrorDetail(
        'unknown',
        'ENGINE_UNEXPECTED_ERROR',
        'Connector execution failed with an unknown error.',
        { retryable: false },
      ),
    ];
  }
}
