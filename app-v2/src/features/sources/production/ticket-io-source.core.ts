import type { ReferenceSourceConfig } from '@/features/aggregation/connectors/types';
import type { SourceRecord } from '@/data/types/records';

export const TICKET_IO_BOOTSHAUS_SOURCE_ID = 'source-bootshaus-ticket-io';
export const TICKET_IO_BOOTSHAUS_SOURCE_SLUG = 'bootshaus-ticket-io';
export const TICKET_IO_BOOTSHAUS_STABLE_KEY = 'bootshaus-ticket-io-v1';
export const TICKET_IO_BOOTSHAUS_SHOP_URL = 'https://bootshaus-club.ticket.io/';

export interface TicketIoSourceRecordOptions {
  fixtureHtml?: string;
}

export function createBootshausTicketIoProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
  options: TicketIoSourceRecordOptions = {},
): SourceRecord {
  const now = new Date().toISOString();
  const reference: ReferenceSourceConfig = {
    connectorKey: 'ticket_platform',
    ...(options.fixtureHtml ? { html: options.fixtureHtml } : {}),
  };

  return {
    id: TICKET_IO_BOOTSHAUS_SOURCE_ID,
    slug: TICKET_IO_BOOTSHAUS_SOURCE_SLUG,
    stableKey: TICKET_IO_BOOTSHAUS_STABLE_KEY,
    displayName: 'Bootshaus Ticket.io',
    description: 'Ticket.io enrichment source for Bootshaus Cologne electronic events.',
    sourceType: 'ticket_platform',
    parserType: 'html',
    category: 'ticket_platform',
    status: 'active',
    connectorKey: 'ticket_platform',
    connectorType: 'ticket_platform',
    acquisitionStrategy: 'scheduled',
    pollingIntervalMinutes: 360,
    priority: 65,
    trustScore: 70,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    sourceRoles: ['ticketing'],
    baseUrl: TICKET_IO_BOOTSHAUS_SHOP_URL,
    website: TICKET_IO_BOOTSHAUS_SHOP_URL,
    countryCode: 'DE',
    region: 'Nordrhein-Westfalen',
    city: 'Köln',
    languageCode: 'de',
    languageCodes: ['de', 'en'],
    genreNames: ['Techno', 'House', 'Electronic'],
    venueName: 'Bootshaus',
    tags: ['ticket-platform', 'ticket-io', 'bootshaus', 'enrichment'],
    defaultTimezone: 'Europe/Berlin',
    sourceConfig: {
      reference,
      ticketPlatform: {
        platform: 'ticket_io',
        shopSlug: 'bootshaus-club',
        listUrl: TICKET_IO_BOOTSHAUS_SHOP_URL,
        timezone: 'Europe/Berlin',
        limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
        scope: {
          allowedVenues: ['bootshaus'],
          allowedOrganizers: ['bootshaus', 'bootshaus cologne'],
        },
      },
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
      defaults: {
        cityName: 'Köln',
        cityId: 'koeln',
        venueName: 'Bootshaus',
        venueId: 'venue-bootshaus-koeln',
        organizerName: 'Bootshaus Cologne',
        organizerId: 'organizer-bootshaus',
        countryCode: 'DE',
        address: 'Auenweg 173',
        postalCode: '51063',
        venueAddress: 'Auenweg 173, 51063 Köln',
      },
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

export function createBootshausTicketIoLiveProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const record = createBootshausTicketIoProductionSourceRecord(overrides);
  const sourceConfig = { ...record.sourceConfig };
  if (sourceConfig.reference) {
    const { html: _removed, ...referenceRest } = sourceConfig.reference as {
      html?: string;
      connectorKey?: string;
    };
    sourceConfig.reference = referenceRest as ReferenceSourceConfig;
  }
  return { ...record, sourceConfig };
}
