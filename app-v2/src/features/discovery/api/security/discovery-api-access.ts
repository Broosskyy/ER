export const DISCOVERY_API_ACCESS_TIERS = ['public', 'internal'] as const;
export type DiscoveryApiAccessTier = (typeof DISCOVERY_API_ACCESS_TIERS)[number];

export interface DiscoveryRateLimitPolicy {
  tier: DiscoveryApiAccessTier;
  requestsPerMinute: number;
  burstLimit: number;
}

export interface DiscoveryRateLimitState {
  clientId: string;
  remaining: number;
  resetAt: string;
  limited: boolean;
}

export interface DiscoveryRateLimitStore {
  check(clientId: string, policy: DiscoveryRateLimitPolicy): DiscoveryRateLimitState;
}

export const DEFAULT_DISCOVERY_RATE_LIMIT_POLICIES: Record<
  DiscoveryApiAccessTier,
  DiscoveryRateLimitPolicy
> = {
  public: {
    tier: 'public',
    requestsPerMinute: 120,
    burstLimit: 30,
  },
  internal: {
    tier: 'internal',
    requestsPerMinute: 10_000,
    burstLimit: 500,
  },
};

export interface DiscoveryApiAuthContext {
  authenticated: false;
  tier: DiscoveryApiAccessTier;
  clientId?: string;
}

export function resolveDiscoveryAccessTier(
  headers: Record<string, string | undefined> = {},
): DiscoveryApiAuthContext {
  const internalKey = headers['x-er-internal'] ?? headers['x-er-internal-key'];
  if (internalKey?.trim()) {
    return { authenticated: false, tier: 'internal', clientId: 'internal-service' };
  }
  return {
    authenticated: false,
    tier: 'public',
    clientId: headers['x-er-client-id'] ?? 'anonymous',
  };
}
