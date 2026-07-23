import type {
  ConnectorFrameworkSettings,
  ConnectorGlobalFrameworkSettings,
} from '@/features/connectors/domain/connector-config';

export interface ConnectorConfigValidationIssue {
  field: string;
  message: string;
}

export interface ConnectorConfigValidationResult {
  valid: boolean;
  issues: ConnectorConfigValidationIssue[];
}

const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 600_000;
const MAX_RETRIES = 10;
const MAX_CONCURRENT = 50;

export function validateConnectorFrameworkSettings(
  settings: ConnectorFrameworkSettings,
): ConnectorConfigValidationResult {
  const issues: ConnectorConfigValidationIssue[] = [];

  if (!Number.isFinite(settings.defaultTimeoutMs)) {
    issues.push({
      field: 'defaultTimeoutMs',
      message: 'Default timeout must be a number.',
    });
  } else if (
    settings.defaultTimeoutMs < MIN_TIMEOUT_MS ||
    settings.defaultTimeoutMs > MAX_TIMEOUT_MS
  ) {
    issues.push({
      field: 'defaultTimeoutMs',
      message: `Default timeout must be between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS} ms.`,
    });
  }

  if (!Number.isFinite(settings.maxRetries) || settings.maxRetries < 0 || settings.maxRetries > MAX_RETRIES) {
    issues.push({
      field: 'maxRetries',
      message: `Max retries must be between 0 and ${MAX_RETRIES}.`,
    });
  }

  if (
    !Number.isFinite(settings.maxConcurrentExecutions) ||
    settings.maxConcurrentExecutions < 1 ||
    settings.maxConcurrentExecutions > MAX_CONCURRENT
  ) {
    issues.push({
      field: 'maxConcurrentExecutions',
      message: `Max concurrent executions must be between 1 and ${MAX_CONCURRENT}.`,
    });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateConnectorGlobalSettings(
  settings: ConnectorGlobalFrameworkSettings,
): ConnectorConfigValidationResult {
  return validateConnectorFrameworkSettings(settings);
}
