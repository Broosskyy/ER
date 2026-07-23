import type { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';
import { ConnectorRegistryError } from '@/features/connectors/errors/connector-errors';
import {
  resolveDefaultConnectorKeyForEndpointType,
  type EndpointType,
} from '@/features/endpoints/domain/endpoint-types';

export class EndpointConnectorResolutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EndpointConnectorResolutionError';
  }
}

export interface EndpointConnectorResolution {
  connectorKey: string;
  endpoint: AcquisitionEndpoint;
  registrationFound: boolean;
}

/**
 * Runtime connector resolution — connectorKey is the single source of truth.
 *
 * Endpoint.endpointType is NOT used at runtime. Use
 * applyDefaultConnectorKeyForEndpoint() or suggestConnectorKeyForEndpointType()
 * when creating or migrating endpoints.
 */
export function resolveConnectorKeyForEndpoint(endpoint: AcquisitionEndpoint): string {
  const connectorKey = endpoint.connectorKey.trim();
  if (!connectorKey) {
    throw new EndpointConnectorResolutionError(
      'Endpoint connectorKey is required for runtime resolution. ' +
        'Assign connectorKey explicitly or use applyDefaultConnectorKeyForEndpoint() at creation time.',
    );
  }
  return connectorKey;
}

/**
 * Applies the endpoint-type default connector key when persisting new endpoints.
 * NOT for runtime execution — use only at creation, migration, or admin save.
 */
export function applyDefaultConnectorKeyForEndpoint(
  endpoint: AcquisitionEndpoint,
): AcquisitionEndpoint {
  if (endpoint.connectorKey.trim()) {
    return endpoint;
  }
  return {
    ...endpoint,
    connectorKey: resolveDefaultConnectorKeyForEndpointType(endpoint.endpointType),
  };
}

export function resolveEndpointConnector(
  registry: ConnectorRegistry,
  endpoint: AcquisitionEndpoint,
): EndpointConnectorResolution {
  const connectorKey = resolveConnectorKeyForEndpoint(endpoint);

  let registrationFound = false;
  try {
    registry.getRegistration(connectorKey);
    registrationFound = true;
  } catch (error) {
    if (!(error instanceof ConnectorRegistryError)) {
      throw error;
    }
  }

  return {
    connectorKey,
    endpoint,
    registrationFound,
  };
}

export function assertEndpointConnectorRegistered(
  registry: ConnectorRegistry,
  endpoint: AcquisitionEndpoint,
): EndpointConnectorResolution {
  const resolution = resolveEndpointConnector(registry, endpoint);
  if (!resolution.registrationFound) {
    throw new ConnectorRegistryError(
      `No connector registered for endpoint "${endpoint.id}" (key "${resolution.connectorKey}").`,
      'CONNECTOR_NOT_FOUND',
    );
  }
  return resolution;
}

/** Developer convenience — default connector key for a new endpoint of this type. */
export function suggestConnectorKeyForEndpointType(endpointType: EndpointType): string {
  return resolveDefaultConnectorKeyForEndpointType(endpointType);
}
