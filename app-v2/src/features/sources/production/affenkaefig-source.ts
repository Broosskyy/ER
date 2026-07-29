/**
 * Affenkäfig production source configuration.
 * Production rows live in public.sources; this module mirrors DB config for tests and ops.
 */
import type { ReferenceSourceConfig } from '@/features/aggregation/connectors/types';
import type { SourceRecord } from '@/data/types/records';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import { AFFENKAEFIG_LIST_FIXTURE_HTML } from '@/features/sources/production/affenkaefig-fixture';

export const AFFENKAEFIG_SOURCE_ID = 'source-affenkaefig';
export const AFFENKAEFIG_SOURCE_SLUG = 'affenkaefig';
export const AFFENKAEFIG_SOURCE_STABLE_KEY = 'affenkaefig-website-v1';
export const AFFENKAEFIG_SOURCE_CONNECTOR_KEY = 'organizer_website' as const;
export const AFFENKAEFIG_EVENTS_URL = 'https://affenkaefig.de/events/';
export const AFFENKAEFIG_ORGANIZER_ID = 'organizer-affenkaefig';

export const AFFENKAEFIG_WEBSITE_CONFIG: WebsiteConnectorConfig = {
  preferredStrategy: 'json_ld',
  userAgent: 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
  acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
  limits: {
    maxEventsPerRun: 50,
    maxDetailPages: 0,
    maxPaginationPages: 1,
    maxPagesPerRun: 1,
    timeoutMs: 30_000,
  },
};

export function createAffenkaefigSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const now = new Date().toISOString();
  return {
    id: AFFENKAEFIG_SOURCE_ID,
    slug: AFFENKAEFIG_SOURCE_SLUG,
    stableKey: AFFENKAEFIG_SOURCE_STABLE_KEY,
    displayName: 'Affenkäfig',
    description: 'Organizer and festival events by Affenkäfig.',
    sourceType: 'website',
    parserType: 'json-ld',
    category: 'website',
    status: 'active',
    connectorKey: AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
    connectorType: 'website',
    acquisitionStrategy: 'manual',
    pollingIntervalMinutes: 360,
    priority: 72,
    trustScore: 74,
    computedTrustScore: 74,
    requiresAuthentication: false,
    enabled: false,
    archived: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    sourceRoles: ['organizer', 'festival'],
    baseUrl: AFFENKAEFIG_EVENTS_URL,
    website: AFFENKAEFIG_EVENTS_URL,
    countryCode: 'DE',
    region: 'Nordrhein-Westfalen',
    city: 'Köln',
    languageCode: 'de',
    languageCodes: ['de'],
    organizerName: 'Affenkäfig',
    organizerId: AFFENKAEFIG_ORGANIZER_ID,
    genreNames: ['Techno', 'House', 'Electronic'],
    tags: ['organizer', 'festival', 'production-source'],
    defaultTimezone: 'Europe/Berlin',
    sourceConfig: {
      reference: {
        connectorKey: AFFENKAEFIG_SOURCE_CONNECTOR_KEY,
        html: AFFENKAEFIG_LIST_FIXTURE_HTML,
      },
      website: AFFENKAEFIG_WEBSITE_CONFIG,
      regional: { countryCode: 'DE', languageCode: 'de' },
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: true },
      defaults: {
        cityName: 'Köln',
        cityId: 'koeln',
        countryCode: 'DE',
        organizerName: 'Affenkäfig',
        organizerId: AFFENKAEFIG_ORGANIZER_ID,
        ticketUrlFallback: 'eventUrl',
      },
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Mirrors production DB config — no fixture HTML, for live smoke tests. */
export function createAffenkaefigLiveProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const record = createAffenkaefigSourceRecord(overrides);
  const sourceConfig = { ...record.sourceConfig };
  if (sourceConfig.reference) {
    const { html: _removed, ...referenceRest } = sourceConfig.reference as ReferenceSourceConfig & {
      html?: string;
    };
    sourceConfig.reference = referenceRest as ReferenceSourceConfig;
  }
  return {
    ...record,
    sourceConfig,
  };
}
