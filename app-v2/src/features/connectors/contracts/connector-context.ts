import type { SourceRecord } from '@/data/types/records';
import type { ImportTriggerType } from '@/features/import/models/statuses';

/**
 * Execution-time endpoint reference passed to ConnectorContext.
 * Populated from AcquisitionEndpoint via mapEndpointToConnectorRef() (ER-014).
 * One Source may own multiple endpoints; each execution targets one.
 *
 * Read-only at runtime — connectors must not mutate endpoint references.
 */
export interface ConnectorEndpointRef {
  readonly id?: string;
  readonly label?: string;
  readonly url?: string;
  readonly endpointType?: string;
}

export interface ConnectorExecutionMetadata {
  readonly executionId: string;
  readonly correlationId?: string;
  readonly jobId?: string;
  readonly triggerType?: ImportTriggerType;
  readonly startedAt: string;
  readonly initiatedBy?: string;
}

export interface ConnectorRuntimeHints {
  /** Prepared for future cancellation support. */
  readonly cancellationRequested?: boolean;
  /** Optional abort signal propagated by the execution engine. */
  readonly abortSignal?: AbortSignal;
  /** Prepared for distributed tracing. */
  readonly traceId?: string;
}

export interface ConnectorAuthenticationContext {
  /** Whether authentication is required — never stores secrets. */
  readonly requiresAuthentication: boolean;
  /** Prepared for future auth mechanism selection. */
  readonly mechanism?: string;
}

export interface ConnectorRateLimitContext {
  /** Configured limit — enforcement belongs to future epics. */
  readonly maxRequestsPerHour?: number;
}

export type ConnectorLogLevel = 'debug' | 'info' | 'warning' | 'error';

/**
 * Immutable execution input for connectors.
 *
 * Connectors receive read-only context and must not mutate source, endpoint,
 * execution metadata, runtime hints, authentication, or rate-limit fields.
 */
export interface ConnectorContext {
  readonly source: Readonly<SourceRecord>;
  readonly endpoint?: Readonly<ConnectorEndpointRef>;
  readonly execution: Readonly<ConnectorExecutionMetadata>;
  readonly runtime?: Readonly<ConnectorRuntimeHints>;
  readonly authentication?: Readonly<ConnectorAuthenticationContext>;
  readonly rateLimit?: Readonly<ConnectorRateLimitContext>;
  readonly log: (
    level: ConnectorLogLevel,
    code: string,
    message: string,
    metadata?: Record<string, unknown>,
  ) => Promise<void>;
}
