import type { SourceRecord } from '@/data/types/records';
import type { CsvFieldMapping } from '@/features/import/models/source-config';

import { PARTNER_V1_API_FIXTURE } from './partner-v1-fixture';

export const PRODUCTION_SOURCE_V1_ID = 'source-er-partner-v1';
export const PRODUCTION_SOURCE_V1_SLUG = 'eternal-rave-partner-v1';
export const PRODUCTION_SOURCE_V1_CONNECTOR_KEY = 'open_data_api' as const;
export const PRODUCTION_SOURCE_V1_ENV_URL = 'ER_PARTNER_V1_API_URL';
export const PRODUCTION_SOURCE_V1_ENV_TOKEN = 'ER_PARTNER_V1_API_TOKEN';

export const PARTNER_V1_FIELD_MAPPING: CsvFieldMapping = {
  externalId: 'id',
  title: 'name',
  description: 'description',
  startDate: 'starts_at',
  endDate: 'ends_at',
  venueName: 'venue.name',
  venueAddress: 'venue.address',
  cityName: 'venue.city',
  organizerName: 'organizer.name',
  ticketUrl: 'tickets.url',
  imageUrl: 'images.primary',
  eventUrl: 'url',
  artistNames: 'artists',
  genreNames: 'genres',
};

export function createEternalRavePartnerV1SourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const now = new Date().toISOString();

  return {
    id: PRODUCTION_SOURCE_V1_ID,
    slug: PRODUCTION_SOURCE_V1_SLUG,
    displayName: 'Rheinland Nights Partner Feed',
    sourceType: 'api',
    parserType: 'api',
    acquisitionStrategy: 'manual',
    priority: 85,
    trustScore: 82,
    requiresAuthentication: true,
    enabled: true,
    archived: false,
    reviewRequired: true,
    baseUrl: `env:${PRODUCTION_SOURCE_V1_ENV_URL}`,
    sourceConfig: {
      reference: {
        connectorKey: PRODUCTION_SOURCE_V1_CONNECTOR_KEY,
        apiJson: PARTNER_V1_API_FIXTURE,
      },
      api: {
        resultsPath: 'data.events',
        fieldMapping: PARTNER_V1_FIELD_MAPPING,
        headerNames: ['Authorization'],
      },
      regional: {
        countryCode: 'DE',
        languageCode: 'de',
      },
      auth: {
        type: 'bearer',
        tokenEnvKey: PRODUCTION_SOURCE_V1_ENV_TOKEN,
        prepared: true,
      },
    },
    notes:
      'First production partner feed (V1). Requires contractual approval before live URL activation.',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
