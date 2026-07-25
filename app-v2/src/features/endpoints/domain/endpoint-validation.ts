import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';
import { isEndpointType } from '@/features/endpoints/domain/endpoint-types';

export interface EndpointValidationIssue {
  field?: string;
  code: string;
  message: string;
}

export interface EndpointValidationResult {
  valid: boolean;
  issues: EndpointValidationIssue[];
}

function issue(
  code: string,
  message: string,
  field?: string,
): EndpointValidationIssue {
  return { code, message, field };
}

function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Framework-level endpoint validation only.
 * No provider-specific checks (HTML structure, feed format, etc.).
 */
export function validateAcquisitionEndpoint(
  endpoint: AcquisitionEndpoint,
): EndpointValidationResult {
  const issues: EndpointValidationIssue[] = [];

  if (!endpoint.id.trim()) {
    issues.push(issue('ENDPOINT_ID_REQUIRED', 'Endpoint id is required.', 'id'));
  }

  if (!endpoint.sourceId.trim()) {
    issues.push(issue('SOURCE_ID_REQUIRED', 'Source id is required.', 'sourceId'));
  }

  if (!endpoint.displayName.trim()) {
    issues.push(issue('DISPLAY_NAME_REQUIRED', 'Display name is required.', 'displayName'));
  }

  if (!isEndpointType(endpoint.endpointType)) {
    issues.push(issue('ENDPOINT_TYPE_INVALID', 'Endpoint type is invalid.', 'endpointType'));
  }

  if (!endpoint.connectorKey.trim()) {
    issues.push(issue('CONNECTOR_KEY_REQUIRED', 'Connector key is required.', 'connectorKey'));
  }

  if (endpoint.url && !isValidHttpUrl(endpoint.url)) {
    issues.push(issue('URL_INVALID', 'Endpoint URL must be a valid HTTP(S) URL.', 'url'));
  }

  if (endpoint.config && endpoint.config.type !== endpoint.endpointType) {
    issues.push(
      issue(
        'CONFIG_TYPE_MISMATCH',
        'Endpoint config type must match endpoint type.',
        'config',
      ),
    );
  }

  const urlRequiredTypes = new Set(['website', 'rss', 'api', 'ical', 'social']);
  if (urlRequiredTypes.has(endpoint.endpointType) && !endpoint.url?.trim()) {
    issues.push(
      issue(
        'URL_REQUIRED',
        `URL is required for endpoint type "${endpoint.endpointType}".`,
        'url',
      ),
    );
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
