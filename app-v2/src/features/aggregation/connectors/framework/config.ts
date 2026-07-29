export interface SourceConnectorRetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface SourceConnectorRateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  cooldownMs: number;
  concurrentRequests: number;
}

export const DEFAULT_SOURCE_CONNECTOR_RETRY_CONFIG: SourceConnectorRetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export const DEFAULT_SOURCE_CONNECTOR_RATE_LIMIT_CONFIG: SourceConnectorRateLimitConfig = {
  requestsPerMinute: 60,
  burstLimit: 10,
  cooldownMs: 5_000,
  concurrentRequests: 2,
};

export interface SourceConnectorFrameworkOverrides {
  retry?: Partial<SourceConnectorRetryConfig>;
  rateLimit?: Partial<SourceConnectorRateLimitConfig>;
}

export function resolveRetryConfig(
  defaults: Partial<SourceConnectorRetryConfig> = {},
  overrides?: SourceConnectorFrameworkOverrides,
): SourceConnectorRetryConfig {
  return {
    ...DEFAULT_SOURCE_CONNECTOR_RETRY_CONFIG,
    ...defaults,
    ...overrides?.retry,
  };
}

export function resolveRateLimitConfig(
  defaults: Partial<SourceConnectorRateLimitConfig> = {},
  overrides?: SourceConnectorFrameworkOverrides,
): SourceConnectorRateLimitConfig {
  return {
    ...DEFAULT_SOURCE_CONNECTOR_RATE_LIMIT_CONFIG,
    ...defaults,
    ...overrides?.rateLimit,
  };
}
