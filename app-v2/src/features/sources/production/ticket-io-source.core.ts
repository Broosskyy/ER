import type { ReferenceSourceConfig } from '@/features/aggregation/connectors/types';

import type { TicketPlatformScopeConfig } from '@/features/aggregation/connectors/ticket-platform/types';

import {

  buildTicketIoSourceId,

  buildTicketIoSourceSlug,

  buildTicketIoStableKey,

  normalizeTicketIoListUrl,

} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';

import type { SourcePublishBehavior } from '@/features/import/domain/publish-behavior';

import type { PublishMode } from '@/features/import/domain/publish-mode';

import type { ImportSourceConfig } from '@/features/import/models/source-config';

import type { SourceRecord } from '@/data/types/records';



export const TICKET_IO_BOOTSHAUS_SOURCE_ID = 'source-bootshaus-ticket-io';

export const TICKET_IO_BOOTSHAUS_SOURCE_SLUG = 'bootshaus-ticket-io';

export const TICKET_IO_BOOTSHAUS_STABLE_KEY = 'bootshaus-ticket-io-v1';

export const TICKET_IO_BOOTSHAUS_SHOP_URL = 'https://bootshaus-club.ticket.io/';

export const TICKET_IO_CONNECTOR_VERSION = '1.2.0';



export interface TicketIoSourceRecordOptions {

  fixtureHtml?: string;

}



export interface TicketIoShopSourceOptions {

  shopSlug: string;

  displayName?: string;

  description?: string;

  listUrl?: string;

  publishMode?: PublishMode;

  publishBehavior?: SourcePublishBehavior;

  reviewRequired?: boolean;

  scope?: TicketPlatformScopeConfig;

  defaults?: ImportSourceConfig['defaults'];

  enabled?: boolean;

  scheduleEnabled?: boolean;

  tags?: string[];

  metadata?: Record<string, unknown>;

}



function slugifyDisplayName(value: string): string {

  return value

    .normalize('NFKD')

    .replace(/[\u0300-\u036f]/g, '')

    .toLowerCase()

    .replace(/[^a-z0-9]+/g, ' ')

    .trim();

}



export function createTicketIoShopSourceRecord(

  options: TicketIoShopSourceOptions,

  overrides: Partial<SourceRecord> = {},

  fixtureOptions: TicketIoSourceRecordOptions = {},

): SourceRecord {

  const shopSlug = options.shopSlug.trim().toLowerCase();

  const listUrl = options.listUrl ?? normalizeTicketIoListUrl(shopSlug);

  const displayName = options.displayName ?? `Ticket.io — ${shopSlug}`;

  const publishBehavior = options.publishBehavior ?? 'auto_publish';

  const publishMode = options.publishMode ?? (publishBehavior === 'auto_publish' ? 'auto_publish' : 'manual_review');

  const isEnrichment = publishBehavior === 'enrichment';

  const now = new Date().toISOString();

  const reference: ReferenceSourceConfig = {

    connectorKey: 'ticket_platform',

    ...(fixtureOptions.fixtureHtml ? { html: fixtureOptions.fixtureHtml } : {}),

  };



  return {

    id: buildTicketIoSourceId(shopSlug),

    slug: buildTicketIoSourceSlug(shopSlug),

    stableKey: buildTicketIoStableKey(shopSlug),

    displayName,

    description:

      options.description ??

      (isEnrichment

        ? `Ticket.io enrichment source for shop ${shopSlug}.`

        : `Ticket.io primary source for shop ${shopSlug}.`),

    sourceType: 'ticket_platform',

    parserType: 'html',

    category: 'ticket_platform',

    status: 'active',

    connectorKey: 'ticket_platform',

    connectorType: 'ticket_platform',

    acquisitionStrategy: 'scheduled',

    pollingIntervalMinutes: 360,

    priority: isEnrichment ? 65 : 60,

    trustScore: isEnrichment ? 70 : 72,

    requiresAuthentication: false,

    enabled: options.enabled ?? false,

    archived: false,

    reviewRequired: options.reviewRequired ?? publishBehavior !== 'auto_publish',

    publishMode,

    sourceRoles: ['ticketing'],

    baseUrl: listUrl,

    website: listUrl,

    countryCode: 'DE',

    languageCode: 'de',

    languageCodes: ['de', 'en'],

    genreNames: ['Techno', 'House', 'Electronic'],

    tags: options.tags ?? ['ticket-platform', 'ticket-io', shopSlug, ...(isEnrichment ? ['enrichment'] : ['primary'])],

    defaultTimezone: 'Europe/Berlin',

    scheduleEnabled: options.scheduleEnabled ?? false,

    schedulePolicy: options.scheduleEnabled ? 'interval' : 'manual_only',

    scheduleIntervalPreset: options.scheduleEnabled ? 'every_6_hours' : 'manual',

    scheduleTimezone: 'Europe/Berlin',

    consecutiveFailureCount: 0,

    totalImportCount: 0,

    totalValidEventCount: 0,

    totalRejectedEventCount: 0,

    duplicateRate: 0,

    updateRate: 0,

    errorRate: 0,

    sourceConfig: {

      reference,

      ticketPlatform: {

        platform: 'ticket_io',

        shopSlug,

        listUrl,

        timezone: 'Europe/Berlin',

        limits: { maxEventsPerRun: 50, requestsPerMinute: 15, maxDetailPages: 15 },

        scope: {

          requireElectronicSignal: true,

          ...options.scope,

        },

      },

      publishPolicy: {

        mode: publishMode,

        behavior: publishBehavior,

        blockOnDuplicate: publishBehavior === 'auto_publish',

        ...(publishBehavior === 'auto_publish'
          ? { minTrustScore: 60, minExtractionConfidence: 0.5 }
          : {}),

      },

      ...(options.defaults ? { defaults: options.defaults } : {}),

    },

    metadata: {

      category: 'ticket_platform',

      platform: 'ticket_io',

      enrichment: isEnrichment,

      discoveryShopSlug: shopSlug,

      connectorVersion: TICKET_IO_CONNECTOR_VERSION,

      ...options.metadata,

    },

    createdAt: now,

    updatedAt: now,

    ...overrides,

  };

}



export function createBootshausTicketIoProductionSourceRecord(

  overrides: Partial<SourceRecord> = {},

  options: TicketIoSourceRecordOptions = {},

): SourceRecord {

  return createTicketIoShopSourceRecord(

    {

      shopSlug: 'bootshaus-club',

      displayName: 'Bootshaus Ticket.io',

      description: 'Ticket.io enrichment source for Bootshaus Cologne electronic events.',

      listUrl: TICKET_IO_BOOTSHAUS_SHOP_URL,

      publishMode: 'manual_review',

      publishBehavior: 'enrichment',

      reviewRequired: true,

      enabled: true,

      scheduleEnabled: true,

      scope: {

        allowedVenues: ['bootshaus'],

        allowedOrganizers: ['bootshaus', 'bootshaus cologne'],

      },

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

      tags: ['ticket-platform', 'ticket-io', 'bootshaus', 'enrichment'],

      metadata: { category: 'ticket_platform', platform: 'ticket_io', enrichment: true },

    },

    {

      id: TICKET_IO_BOOTSHAUS_SOURCE_ID,

      slug: TICKET_IO_BOOTSHAUS_SOURCE_SLUG,

      stableKey: TICKET_IO_BOOTSHAUS_STABLE_KEY,

      region: 'Nordrhein-Westfalen',

      city: 'Köln',

      venueName: 'Bootshaus',

      priority: 65,

      trustScore: 70,

      ...overrides,

    },

    options,

  );

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


