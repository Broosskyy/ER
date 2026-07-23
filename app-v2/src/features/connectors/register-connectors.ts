import type { ConnectorRegistry } from '@/features/connectors/registry/connector-registry';
import { createConnectorCapabilities } from '@/features/connectors/domain/connector-capabilities';
import { DefaultHttpClient } from '@/features/endpoints/http/default-http-client';
import { WebsiteConnector } from '@/features/connectors/providers/website/website-connector';
import { WEBSITE_CONNECTOR_KEY } from '@/features/connectors/providers/website/website-connector-constants';

const sharedHttpClient = new DefaultHttpClient();

export function registerConnectors(registry: ConnectorRegistry): void {
  const registration = {
    connectorKey: WEBSITE_CONNECTOR_KEY,
    displayName: 'Website Connector',
    version: '1.0.0',
    supportedEndpointTypes: ['website'],
    capabilities: createConnectorCapabilities({
      supportsPolling: true,
      supportsPagination: false,
    }),
    create: () => new WebsiteConnector(sharedHttpClient),
  };

  if (!registry.has(registration.connectorKey)) {
    registry.register(registration);
  }
}
