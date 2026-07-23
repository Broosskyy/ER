export const ENDPOINT_HEALTH_STATUSES = [
  'ready',
  'configuration_required',
  'disabled',
  'unsupported',
  'unknown',
] as const;

export type EndpointHealthStatus = (typeof ENDPOINT_HEALTH_STATUSES)[number];

export function isEndpointHealthStatus(value: string): value is EndpointHealthStatus {
  return (ENDPOINT_HEALTH_STATUSES as readonly string[]).includes(value);
}
