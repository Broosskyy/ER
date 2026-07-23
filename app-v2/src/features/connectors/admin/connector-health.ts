import type { ConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import type {
  ConnectorFrameworkSettings,
  ConnectorHealthStatus,
} from '@/features/connectors/domain/connector-config';
import type { ConnectorLifecycleState } from '@/features/connectors/domain/connector-lifecycle';
import type { ConnectorRegistration } from '@/features/connectors/contracts/connector';
import {
  validateCapabilitiesConsistency,
  validateConnectorRegistration,
} from '@/features/connectors/domain/connector-validation';
import { validateConnectorFrameworkSettings } from '@/features/connectors/admin/connector-config-validation';

export function resolveConnectorLifecycleState(
  registration: ConnectorRegistration | null,
  settings: ConnectorFrameworkSettings,
  hasValidConfiguration: boolean,
): ConnectorLifecycleState {
  if (!registration) {
    return 'registered';
  }

  if (!settings.enabled) {
    return 'configured';
  }

  if (!hasValidConfiguration) {
    return 'configured';
  }

  return 'ready';
}

export function resolveConnectorHealthStatus(input: {
  registration: ConnectorRegistration | null;
  settings: ConnectorFrameworkSettings;
  globalEnabled: boolean;
  hasValidConfiguration: boolean;
  assignedToSource?: boolean;
}): ConnectorHealthStatus {
  if (!input.registration) {
    return 'unsupported';
  }

  if (!input.globalEnabled || !input.settings.enabled) {
    return 'disabled';
  }

  if (!input.hasValidConfiguration) {
    return 'configuration_required';
  }

  if (input.assignedToSource === false) {
    return 'configuration_required';
  }

  return 'ready';
}

export function evaluateConnectorConfiguration(
  registration: ConnectorRegistration,
  settings: ConnectorFrameworkSettings,
): { valid: boolean; issues: Array<{ field?: string; message: string }> } {
  const issues: Array<{ field?: string; message: string }> = [];

  const registrationResult = validateConnectorRegistration(registration);
  if (!registrationResult.valid) {
    issues.push(
      ...registrationResult.issues.map((issue) => ({
        field: issue.field,
        message: issue.message,
      })),
    );
  }

  const capabilityResult = validateCapabilitiesConsistency(registration);
  if (!capabilityResult.valid) {
    issues.push(
      ...capabilityResult.issues.map((issue) => ({
        field: issue.field,
        message: issue.message,
      })),
    );
  }

  const settingsResult = validateConnectorFrameworkSettings(settings);
  if (!settingsResult.valid) {
    issues.push(
      ...settingsResult.issues.map((issue) => ({
        field: issue.field,
        message: issue.message,
      })),
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function summarizeCapabilities(capabilities: ConnectorCapabilities): string {
  const labels: string[] = [];
  if (capabilities.supportsAuthentication) labels.push('Auth');
  if (capabilities.supportsPolling) labels.push('Polling');
  if (capabilities.supportsWebhook) labels.push('Webhooks');
  if (capabilities.supportsPagination) labels.push('Pagination');
  if (capabilities.supportsIncrementalSync) labels.push('Incremental');
  return labels.length > 0 ? labels.join(', ') : 'None declared';
}
