import type { AcquisitionEndpoint } from '@/features/endpoints/domain/endpoint-model';
import type { ConnectorEndpointRef } from '@/features/connectors/contracts/connector-context';

/**
 * Maps a persisted AcquisitionEndpoint into the ConnectorContext endpoint reference.
 * Keeps ConnectorContext provider-independent while allowing rich endpoint metadata upstream.
 */
export function mapEndpointToConnectorRef(
  endpoint: AcquisitionEndpoint,
): ConnectorEndpointRef {
  return {
    id: endpoint.id,
    label: endpoint.displayName,
    url: endpoint.url,
    endpointType: endpoint.endpointType,
  };
}

/**
 * Builds execution-ready endpoint reference from minimal fields.
 */
export function createConnectorEndpointRef(input: {
  id: string;
  displayName: string;
  url?: string;
  endpointType: string;
}): ConnectorEndpointRef {
  return {
    id: input.id,
    label: input.displayName,
    url: input.url,
    endpointType: input.endpointType,
  };
}
