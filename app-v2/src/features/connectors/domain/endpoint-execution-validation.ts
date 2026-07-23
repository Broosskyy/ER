import type { SourceRecord } from '@/data/types/records';
import type { ConnectorRegistration } from '@/features/connectors/contracts/connector';
import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';
import { validateAcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-validation';
import { resolveConnectorKeyForEndpoint } from '@/features/endpoints/domain/endpoint-connector-resolution';

export interface EndpointExecutionValidationIssue {
  code: string;
  message: string;
  field?: string;
}

export interface EndpointExecutionValidationResult {
  valid: boolean;
  issues: EndpointExecutionValidationIssue[];
  connectorKey?: string;
}

function issue(
  code: string,
  message: string,
  field?: string,
): EndpointExecutionValidationIssue {
  return { code, message, field };
}

/**
 * Engine-boundary validation: is this endpoint executable?
 * Connector-specific configuration checks remain connector-owned.
 */
export function validateEndpointExecutable(input: {
  endpoint: AcquisitionEndpoint;
  source: SourceRecord;
  registration?: ConnectorRegistration;
}): EndpointExecutionValidationResult {
  const issues: EndpointExecutionValidationIssue[] = [];
  const { endpoint, source, registration } = input;

  if (!endpoint.enabled) {
    issues.push(issue('ENDPOINT_DISABLED', 'Endpoint is disabled.', 'enabled'));
  }

  if (!source.enabled) {
    issues.push(issue('SOURCE_DISABLED', 'Parent source is disabled.', 'source.enabled'));
  }

  if (source.archived) {
    issues.push(issue('SOURCE_ARCHIVED', 'Parent source is archived.', 'source.archived'));
  }

  if (endpoint.sourceId && endpoint.sourceId !== source.id) {
    issues.push(
      issue(
        'ENDPOINT_SOURCE_MISMATCH',
        'Endpoint sourceId does not match the loaded source.',
        'sourceId',
      ),
    );
  }

  const frameworkValidation = validateAcquisitionEndpoint(endpoint);
  for (const entry of frameworkValidation.issues) {
    issues.push(issue(entry.code, entry.message, entry.field));
  }

  let connectorKey: string | undefined;
  try {
    connectorKey = resolveConnectorKeyForEndpoint(endpoint);
  } catch (error) {
    issues.push(
      issue(
        'CONNECTOR_KEY_MISSING',
        error instanceof Error ? error.message : 'Connector key is required.',
        'connectorKey',
      ),
    );
  }

  if (connectorKey && registration) {
    const supported = registration.supportedEndpointTypes ?? [];
    if (supported.length > 0 && !supported.includes(endpoint.endpointType)) {
      issues.push(
        issue(
          'ENDPOINT_TYPE_INCOMPATIBLE',
          `Endpoint type "${endpoint.endpointType}" is not supported by connector "${connectorKey}".`,
          'endpointType',
        ),
      );
    }
  }

  return {
    valid: issues.length === 0,
    issues,
    connectorKey,
  };
}
