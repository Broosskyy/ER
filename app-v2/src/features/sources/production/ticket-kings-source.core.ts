import type { ReferenceSourceConfig } from '@/features/aggregation/connectors/types';
import type { SourceRecord } from '@/data/types/records';
import { AFFENKAEFIG_ORGANIZER_ID } from '@/features/sources/production/affenkaefig-source';

export const TICKET_KINGS_AFFENKAEFIG_SOURCE_ID = 'source-affenkaefig-ticket-kings';
export const TICKET_KINGS_AFFENKAEFIG_SOURCE_SLUG = 'affenkaefig-ticket-kings';
export const TICKET_KINGS_AFFENKAEFIG_STABLE_KEY = 'affenkaefig-ticket-kings-v1';
export const TICKET_KINGS_EVENTS_LIST_URL = 'https://ticketkings.de/all-events/';

export interface TicketKingsSourceRecordOptions {
  fixtureHtml?: string;
}

export function createAffenkaefigTicketKingsProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
  options: TicketKingsSourceRecordOptions = {},
): SourceRecord {
  const now = new Date().toISOString();
  const reference: ReferenceSourceConfig = {
    connectorKey: 'ticket_platform',
    ...(options.fixtureHtml ? { html: options.fixtureHtml } : {}),
  };

  return {
    id: TICKET_KINGS_AFFENKAEFIG_SOURCE_ID,
    slug: TICKET_KINGS_AFFENKAEFIG_SOURCE_SLUG,
    stableKey: TICKET_KINGS_AFFENKAEFIG_STABLE_KEY,
    displayName: 'Affenkäfig Ticket Kings',
    description: 'Ticket Kings enrichment source for Affenkäfig and related electronic events.',
    sourceType: 'ticket_platform',
    parserType: 'html',
    category: 'ticket_platform',
    status: 'active',
    connectorKey: 'ticket_platform',
    connectorType: 'ticket_platform',
    acquisitionStrategy: 'scheduled',
    pollingIntervalMinutes: 360,
    priority: 64,
    trustScore: 68,
    requiresAuthentication: false,
    enabled: true,
    archived: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    sourceRoles: ['ticketing'],
    baseUrl: TICKET_KINGS_EVENTS_LIST_URL,
    website: TICKET_KINGS_EVENTS_LIST_URL,
    countryCode: 'DE',
    region: 'Nordrhein-Westfalen',
    city: 'Köln',
    languageCode: 'de',
    languageCodes: ['de', 'en'],
    genreNames: ['Techno', 'House', 'Electronic'],
    organizerName: 'Affenkäfig',
    organizerId: AFFENKAEFIG_ORGANIZER_ID,
    tags: ['ticket-platform', 'ticket-kings', 'affenkaefig', 'enrichment'],
    defaultTimezone: 'Europe/Berlin',
    sourceConfig: {
      reference,
      ticketPlatform: {
        platform: 'ticket_king',
        shopSlug: 'ticketkings',
        listUrl: TICKET_KINGS_EVENTS_LIST_URL,
        timezone: 'Europe/Berlin',
        limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
        scope: {
          allowedVenues: ['essigfabrik', 'elektroküche', 'elektrokueche', 'artheater'],
          allowedOrganizers: [
            'affenkaefig',
            'affenkäfig',
            'mdma',
            'm.d.m.a',
            'underland',
            'elektroküche',
            'elektrokueche',
          ],
        },
      },
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
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

export function createAffenkaefigTicketKingsLiveProductionSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const record = createAffenkaefigTicketKingsProductionSourceRecord(overrides);
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
