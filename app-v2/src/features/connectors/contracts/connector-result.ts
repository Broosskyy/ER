import type { ConnectorErrorDetail } from '@/features/connectors/errors/connector-errors';

export const CONNECTOR_RESULT_STATUSES = ['completed', 'failed'] as const;

export type ConnectorResultStatus = (typeof CONNECTOR_RESULT_STATUSES)[number];

/**
 * Acquisition output only — never an Event entity.
 * Connectors produce candidates; review and publishing happen downstream.
 */
export interface AcquisitionCandidate {
  externalId: string;
  sourceUrl?: string;
  rawPayload: Record<string, unknown>;
  normalizedPayload?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface ConnectorWarning {
  code: string;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface ConnectorResultStatistics {
  candidateCount: number;
  skippedCount: number;
  warningCount: number;
  errorCount: number;
}

export interface ConnectorResult {
  status: ConnectorResultStatus;
  candidates: AcquisitionCandidate[];
  warnings: ConnectorWarning[];
  errors: ConnectorErrorDetail[];
  statistics: ConnectorResultStatistics;
  diagnostics: Record<string, unknown>;
  durationMs: number;
  metadata: Record<string, unknown>;
}

export function createEmptyConnectorResult(
  overrides: Partial<ConnectorResult> = {},
): ConnectorResult {
  return {
    status: 'completed',
    candidates: [],
    warnings: [],
    errors: [],
    statistics: {
      candidateCount: 0,
      skippedCount: 0,
      warningCount: 0,
      errorCount: 0,
    },
    diagnostics: {},
    durationMs: 0,
    metadata: {},
    ...overrides,
  };
}

export function buildConnectorResultStatistics(
  result: Pick<ConnectorResult, 'candidates' | 'warnings' | 'errors'> & {
    skippedCount?: number;
  },
): ConnectorResultStatistics {
  return {
    candidateCount: result.candidates.length,
    skippedCount: result.skippedCount ?? 0,
    warningCount: result.warnings.length,
    errorCount: result.errors.length,
  };
}
