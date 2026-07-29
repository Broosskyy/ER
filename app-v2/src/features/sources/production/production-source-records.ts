/**
 * Test-only factories mirroring production DB seeds (migration 20260744000000).
 * Production configuration lives exclusively in public.sources.
 */
import type { ReferenceSourceConfig } from '@/features/aggregation/connectors/types';
import type { SourceRecord } from '@/data/types/records';
import type { WebsiteConnectorConfig } from '@/features/aggregation/connectors/website/config';
import { BOOTSHAUS_LIST_FIXTURE_HTML } from '@/features/sources/production/bootshaus-fixture';
import {
  AFFENKAEFIG_SOURCE_ID,
  createAffenkaefigSourceRecord,
  createAffenkaefigLiveProductionSourceRecord,
} from '@/features/sources/production/affenkaefig-source';

export const PRODUCTION_BOOTSHAUS_SOURCE_ID = 'source-bootshaus-koeln';
export const PRODUCTION_AFFENKAEFIG_SOURCE_ID = AFFENKAEFIG_SOURCE_ID;

export const BOOTSHAUS_WEBSITE_CONFIG: WebsiteConnectorConfig = {
  preferredStrategy: 'html_selector',
  userAgent: 'EternalRave-SourceBot/1.0 (+https://eternalrave.app; event-import)',
  acceptLanguage: 'de-DE,de;q=0.9,en;q=0.8',
  htmlSelector: {
    baseUrl: 'https://bootshaus.tv',
    eventContainerSelector: '.upcoming-item',
    titleSelector: '.upcoming-title',
    dateSelector: '.date-day',
    monthSelector: '.date-month',
    timeSelector: '.date-time',
    imageSelector: 'img',
    imageAttribute: 'src',
    eventUrlSelector: '.upcoming-item',
    eventUrlAttribute: 'href',
    linkIncludePattern: '^/events/[^/]+$',
    timezone: 'Europe/Berlin',
    requiredFields: ['title'],
  },
  limits: {
    maxEventsPerRun: 50,
    maxDetailPages: 0,
    maxPaginationPages: 1,
    maxPagesPerRun: 1,
    timeoutMs: 30_000,
  },
  transforms: [
    { type: 'regex_replace', value: '\\s*\\|\\s*Bootshaus Club\\s*$', replacement: '' },
    { type: 'trim' },
  ],
};

export function createBootshausProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const now = new Date().toISOString();
  return {
    id: PRODUCTION_BOOTSHAUS_SOURCE_ID,
    slug: 'bootshaus-koeln',
    stableKey: 'bootshaus-koeln-website-v1',
    displayName: 'Bootshaus Köln',
    description: 'Official public event calendar of Bootshaus Cologne.',
    sourceType: 'website',
    parserType: 'html',
    category: 'website',
    status: 'active',
    connectorKey: 'club_website',
    connectorType: 'website',
    acquisitionStrategy: 'manual',
    pollingIntervalMinutes: 360,
    priority: 78,
    trustScore: 76,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: false,
    publishMode: 'auto_publish',
    sourceRoles: ['club', 'venue'],
    baseUrl: 'https://bootshaus.tv/events/',
    website: 'https://bootshaus.tv/events/',
    countryCode: 'DE',
    region: 'Nordrhein-Westfalen',
    city: 'Köln',
    languageCode: 'de',
    languageCodes: ['de', 'en'],
    genreNames: ['Techno', 'House', 'Electronic'],
    venueName: 'Bootshaus',
    tags: ['club', 'koeln', 'production-source'],
    defaultTimezone: 'Europe/Berlin',
    sourceConfig: {
      reference: {
        connectorKey: 'club_website',
        html: BOOTSHAUS_LIST_FIXTURE_HTML,
      },
      website: BOOTSHAUS_WEBSITE_CONFIG,
      regional: { countryCode: 'DE', languageCode: 'de' },
      publishPolicy: { mode: 'auto_publish', blockOnDuplicate: true },
      defaults: {
        cityName: 'Köln',
        cityId: 'koeln',
        venueName: 'Bootshaus',
        venueId: 'venue-bootshaus-koeln',
        organizerName: 'Bootshaus',
        organizerId: 'organizer-bootshaus',
        countryCode: 'DE',
        address: 'Auenweg 173',
        postalCode: '51063',
        venueAddress: 'Auenweg 173, 51063 Köln',
        ticketUrlFallback: 'eventUrl',
      },
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/** Mirrors production DB config — no fixture HTML, for live smoke tests. */
export function createBootshausLiveProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const record = createBootshausProductionSourceRecord(overrides);
  const sourceConfig = { ...record.sourceConfig };
  if (sourceConfig.reference) {
    const { html: _removed, ...referenceRest } = sourceConfig.reference as {
      html?: string;
      connectorKey?: string;
    };
    sourceConfig.reference = referenceRest as ReferenceSourceConfig;
  }
  return {
    ...record,
    sourceConfig,
  };
}

export function createAffenkaefigProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return createAffenkaefigSourceRecord({
    enabled: true,
    reviewRequired: false,
    publishMode: 'auto_publish',
    sourceConfig: {
      ...createAffenkaefigSourceRecord().sourceConfig,
      publishPolicy: { mode: 'auto_publish', blockOnDuplicate: true },
    },
    ...overrides,
  });
}

export { createAffenkaefigLiveProductionSourceRecord };
