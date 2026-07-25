import type {
  ConnectorRegistration,
  ConnectorValidationResult,
} from '@/features/connectors/contracts/connector';
import type { ConnectorContext } from '@/features/connectors/contracts/connector-context';
import { ConnectorValidationError } from '@/features/connectors/errors/connector-errors';

function issue(
  code: string,
  message: string,
  field?: string,
): ConnectorValidationResult['issues'][number] {
  return { code, message, field };
}

export function validateConnectorRegistration(
  registration: ConnectorRegistration,
): ConnectorValidationResult {
  const issues: ConnectorValidationResult['issues'] = [];

  if (!registration.connectorKey.trim()) {
    issues.push(issue('CONNECTOR_KEY_REQUIRED', 'Connector key is required.', 'connectorKey'));
  }

  if (!registration.displayName.trim()) {
    issues.push(issue('CONNECTOR_NAME_REQUIRED', 'Display name is required.', 'displayName'));
  }

  if (typeof registration.create !== 'function') {
    issues.push(issue('CONNECTOR_FACTORY_REQUIRED', 'Connector factory is required.', 'create'));
  }

  if (!registration.capabilities) {
    issues.push(issue('CONNECTOR_CAPABILITIES_REQUIRED', 'Capabilities are required.', 'capabilities'));
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function validateConnectorContext(context: ConnectorContext): ConnectorValidationResult {
  const issues: ConnectorValidationResult['issues'] = [];

  if (!context.source?.id) {
    issues.push(issue('SOURCE_REQUIRED', 'Source is required.', 'source'));
  }

  if (!context.source?.displayName?.trim()) {
    issues.push(issue('SOURCE_NAME_REQUIRED', 'Source display name is required.', 'source.displayName'));
  }

  if (!context.execution?.executionId?.trim()) {
    issues.push(issue('EXECUTION_ID_REQUIRED', 'Execution id is required.', 'execution.executionId'));
  }

  if (!context.execution?.startedAt) {
    issues.push(issue('EXECUTION_STARTED_AT_REQUIRED', 'Execution start time is required.', 'execution.startedAt'));
  }

  if (typeof context.log !== 'function') {
    issues.push(issue('LOG_REQUIRED', 'Log callback is required.', 'log'));
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}

export function assertValidConnectorContext(context: ConnectorContext): void {
  const result = validateConnectorContext(context);
  if (!result.valid) {
    const message = result.issues.map((entry) => entry.message).join(' ');
    throw new ConnectorValidationError(message);
  }
}

export function validateCapabilitiesConsistency(
  registration: ConnectorRegistration,
): ConnectorValidationResult {
  const issues: ConnectorValidationResult['issues'] = [];
  const capabilities = registration.capabilities;

  if (capabilities.supportsWebhook && capabilities.supportsPolling) {
    issues.push(
      issue(
        'CAPABILITY_CONFLICT',
        'Connectors should not declare both webhook and polling support in ER-013 framework validation.',
        'capabilities',
      ),
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
