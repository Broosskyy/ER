/**
 * Declarative capability flags for source connectors.
 * Every connector exposes the same structure — no per-connector special cases.
 */
export interface SourceConnectorCapabilities {
  supportsPagination: boolean;
  supportsDeltaImports: boolean;
  supportsImages: boolean;
  supportsArtists: boolean;
  supportsVenueCoordinates: boolean;
  supportsGenres: boolean;
  supportsTicketLinks: boolean;
  supportsTimezone: boolean;
  supportsWebhooks: boolean;
  supportsRateLimits: boolean;
  supportsAuthentication: boolean;
}

export const EMPTY_SOURCE_CONNECTOR_CAPABILITIES: SourceConnectorCapabilities = {
  supportsPagination: false,
  supportsDeltaImports: false,
  supportsImages: false,
  supportsArtists: false,
  supportsVenueCoordinates: false,
  supportsGenres: false,
  supportsTicketLinks: false,
  supportsTimezone: false,
  supportsWebhooks: false,
  supportsRateLimits: false,
  supportsAuthentication: false,
};

export function createSourceConnectorCapabilities(
  overrides: Partial<SourceConnectorCapabilities> = {},
): SourceConnectorCapabilities {
  return {
    ...EMPTY_SOURCE_CONNECTOR_CAPABILITIES,
    ...overrides,
  };
}
