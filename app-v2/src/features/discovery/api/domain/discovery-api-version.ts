export const DISCOVERY_API_VERSIONS = ['v1'] as const;
export type DiscoveryApiVersion = (typeof DISCOVERY_API_VERSIONS)[number];

export const DEFAULT_DISCOVERY_API_VERSION: DiscoveryApiVersion = 'v1';
export const LATEST_DISCOVERY_API_VERSION: DiscoveryApiVersion = 'v1';

export interface DiscoveryApiVersionNegotiation {
  requested?: string;
  resolved: DiscoveryApiVersion;
  supported: readonly DiscoveryApiVersion[];
}

export function negotiateDiscoveryApiVersion(
  requested?: string,
): DiscoveryApiVersionNegotiation {
  const normalized = requested?.trim().toLowerCase();
  if (!normalized) {
    return {
      requested,
      resolved: DEFAULT_DISCOVERY_API_VERSION,
      supported: DISCOVERY_API_VERSIONS,
    };
  }

  if (DISCOVERY_API_VERSIONS.includes(normalized as DiscoveryApiVersion)) {
    return {
      requested,
      resolved: normalized as DiscoveryApiVersion,
      supported: DISCOVERY_API_VERSIONS,
    };
  }

  return {
    requested,
    resolved: DEFAULT_DISCOVERY_API_VERSION,
    supported: DISCOVERY_API_VERSIONS,
  };
}
