import type { AcquisitionCandidate } from '@/features/connectors/contracts/connector-result';
import type { ConnectorErrorDetail } from '@/features/connectors/errors/connector-errors';

export const CONNECTOR_EXECUTION_TRIGGERS = ['manual', 'system', 'test'] as const;

export type ConnectorExecutionTrigger = (typeof CONNECTOR_EXECUTION_TRIGGERS)[number];

export const CONNECTOR_EXECUTION_STATUSES = ['succeeded', 'failed', 'cancelled'] as const;

export type ConnectorExecutionStatus = (typeof CONNECTOR_EXECUTION_STATUSES)[number];

export interface ConnectorExecutionRequest {
  endpointId: string;
  trigger: ConnectorExecutionTrigger;
  requestedBy?: string;
  correlationId?: string;
  /** Optional hint when the caller already knows the parent source. */
  sourceId?: string;
}

export interface ConnectorExecutionDiagnostics {
  endpointLoadDurationMs: number;
  connectorResolutionDurationMs: number;
  connectorExecutionDurationMs: number;
  totalDurationMs: number;
  candidateCount: number;
  connectorDiagnostics: Record<string, unknown>;
  cancelled: boolean;
  finalStatus: ConnectorExecutionStatus;
}

export interface ConnectorExecutionResult {
  executionId: string;
  endpointId: string;
  sourceId?: string;
  connectorKey: string;
  trigger: ConnectorExecutionTrigger;
  status: ConnectorExecutionStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  candidates: AcquisitionCandidate[];
  diagnostics: ConnectorExecutionDiagnostics;
  errors: ConnectorErrorDetail[];
  logs: ConnectorExecutionLogEntry[];
}

export interface ConnectorExecutionLogEntry {
  level: 'debug' | 'info' | 'warning' | 'error';
  code: string;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorExecutionRecord {
  executionId: string;
  endpointId: string;
  sourceId?: string;
  connectorKey: string;
  trigger: ConnectorExecutionTrigger;
  status: ConnectorExecutionStatus;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  candidateCount: number;
  correlationId?: string;
  requestedBy?: string;
  errorSummary?: string;
  diagnosticsSummary: Record<string, unknown>;
}
