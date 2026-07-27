export const SOURCE_AUTH_TYPES = ['none', 'api_key', 'bearer', 'basic', 'oauth'] as const;

export type SourceAuthType = (typeof SOURCE_AUTH_TYPES)[number];

/** Auth metadata prepared for future integrations — never stores secrets. */
export interface SourceAuthConfig {
  type: SourceAuthType;
  headerName?: string;
  tokenEnvKey?: string;
  oauthProvider?: string;
  prepared: boolean;
}

export function createPreparedAuthConfig(
  type: SourceAuthType = 'none',
): SourceAuthConfig {
  return {
    type,
    prepared: type !== 'none',
  };
}

export function isSourceAuthType(value: string): value is SourceAuthType {
  return (SOURCE_AUTH_TYPES as readonly string[]).includes(value);
}
