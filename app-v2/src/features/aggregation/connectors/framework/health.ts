import type { SourceConnectorErrorCode } from '@/features/aggregation/connectors/framework/errors';

export const SOURCE_CONNECTOR_HEALTH_STATUSES = [
  'healthy',
  'degraded',
  'offline',
  'unauthorized',
  'rate_limited',
  'maintenance',
] as const;

export type SourceConnectorHealthStatus = (typeof SOURCE_CONNECTOR_HEALTH_STATUSES)[number];

export interface SourceConnectorHealthSnapshot {
  status: SourceConnectorHealthStatus;
  lastSuccessfulRunAt?: string;
  lastErrorAt?: string;
  lastErrorCode?: SourceConnectorErrorCode;
  lastErrorMessage?: string;
  successRate: number;
  errorCount: number;
  totalRunCount: number;
  averageDurationMs: number;
  lastResponseTimeMs?: number;
  updatedAt: string;
}

export function createInitialHealthSnapshot(now = new Date().toISOString()): SourceConnectorHealthSnapshot {
  return {
    status: 'healthy',
    successRate: 1,
    errorCount: 0,
    totalRunCount: 0,
    averageDurationMs: 0,
    updatedAt: now,
  };
}

export function resolveHealthStatusFromErrorCode(
  code: SourceConnectorErrorCode,
): SourceConnectorHealthStatus {
  switch (code) {
    case 'authentication_failed':
      return 'unauthorized';
    case 'rate_limited':
      return 'rate_limited';
    case 'maintenance':
      return 'maintenance';
    case 'timeout':
    case 'network_error':
    case 'upstream_unavailable':
      return 'offline';
    default:
      return 'degraded';
  }
}
