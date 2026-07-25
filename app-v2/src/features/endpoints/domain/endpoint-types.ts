/**
 * Acquisition endpoint types.
 * Vocabulary is provider-independent — each type maps to a connector implementation.
 */
export const ENDPOINT_TYPES = [
  'website',
  'rss',
  'api',
  'ical',
  'ticket_platform',
  'social',
  'webhook',
  'unknown',
] as const;

export type EndpointType = (typeof ENDPOINT_TYPES)[number];

export function isEndpointType(value: string): value is EndpointType {
  return (ENDPOINT_TYPES as readonly string[]).includes(value);
}

/**
 * Default connector keys for endpoint types.
 *
 * Used ONLY for:
 * - default creation (applyDefaultConnectorKeyForEndpoint)
 * - migrations
 * - validation hints
 * - developer convenience (suggestConnectorKeyForEndpointType)
 *
 * Runtime execution MUST resolve connectors from Endpoint.connectorKey only.
 */
export const ENDPOINT_TYPE_CONNECTOR_KEYS: Record<EndpointType, string> = {
  website: 'website',
  rss: 'rss',
  api: 'api_json',
  ical: 'ical',
  ticket_platform: 'ticket_platform',
  social: 'social',
  webhook: 'webhook',
  unknown: 'unknown',
};

export function resolveDefaultConnectorKeyForEndpointType(
  endpointType: EndpointType,
): string {
  return ENDPOINT_TYPE_CONNECTOR_KEYS[endpointType];
}
