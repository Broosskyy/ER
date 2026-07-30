import type { TicketPlatformSourceConfig } from '@/features/aggregation/connectors/ticket-platform/types';
import type { ImportSourceConfig } from '@/features/import/models/source-config';
import type { SourceRecord } from '@/data/types/records';
import type { TicketIoShopCandidate } from '@/features/ticket-platform-discovery/discovery/ticket-io-shop-discovery';
import { TICKET_KINGS_PLATFORM_LIST_URL } from '@/features/ticket-platform-discovery/discovery/ticket-kings-platform-crawler';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function createDiscoveredTicketPlatformSourceRecord(input: {
  id: string;
  slug: string;
  stableKey: string;
  displayName: string;
  description: string;
  listUrl: string;
  ticketPlatform: TicketPlatformSourceConfig;
  metadata: Record<string, unknown>;
  overrides?: Partial<SourceRecord>;
}): SourceRecord {
  const now = new Date().toISOString();
  return {
    id: input.id,
    slug: input.slug,
    stableKey: input.stableKey,
    displayName: input.displayName,
    description: input.description,
    sourceType: 'ticket_platform',
    parserType: 'html',
    category: 'ticket_platform',
    status: 'active',
    connectorKey: 'ticket_platform',
    connectorType: 'ticket_platform',
    acquisitionStrategy: 'scheduled',
    pollingIntervalMinutes: 360,
    priority: 60,
    trustScore: 65,
    requiresAuthentication: false,
    enabled: false,
    archived: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    sourceRoles: ['ticketing'],
    baseUrl: input.listUrl,
    website: input.listUrl,
    countryCode: 'DE',
    languageCode: 'de',
    languageCodes: ['de', 'en'],
    genreNames: ['Techno', 'House', 'Electronic'],
    tags: ['ticket-platform', 'discovery', 'enrichment'],
    defaultTimezone: 'Europe/Berlin',
    consecutiveFailureCount: 0,
    totalImportCount: 0,
    totalValidEventCount: 0,
    totalRejectedEventCount: 0,
    duplicateRate: 0,
    updateRate: 0,
    errorRate: 0,
    scheduleTimezone: 'Europe/Berlin',
    sourceConfig: {
      reference: { connectorKey: 'ticket_platform' },
      ticketPlatform: input.ticketPlatform,
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
    } as ImportSourceConfig,
    metadata: input.metadata,
    createdAt: now,
    updatedAt: now,
    ...input.overrides,
  };
}

export function buildTicketIoShopSourceRecord(
  candidate: TicketIoShopCandidate,
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return createDiscoveredTicketPlatformSourceRecord({
    id: `source-ticket-io-${slugify(candidate.shopSlug)}`,
    slug: `ticket-io-${slugify(candidate.shopSlug)}`,
    stableKey: `ticket-io-${candidate.shopSlug}-v1`,
    displayName: `Ticket.io — ${candidate.shopSlug}`,
    description: `Ticket.io enrichment source discovered for shop ${candidate.shopSlug}.`,
    listUrl: candidate.listUrl,
    ticketPlatform: {
      platform: 'ticket_io',
      shopSlug: candidate.shopSlug,
      listUrl: candidate.listUrl,
      timezone: 'Europe/Berlin',
      limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
      scope: { requireElectronicSignal: true },
    },
    metadata: {
      category: 'ticket_platform',
      platform: 'ticket_io',
      enrichment: true,
      discoveryShopSlug: candidate.shopSlug,
    },
    overrides: {
      scheduleEnabled: false,
      schedulePolicy: 'manual_only',
      scheduleIntervalPreset: 'manual',
      ...overrides,
    },
  });
}

export function buildTicketKingsPlatformSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return createDiscoveredTicketPlatformSourceRecord({
    id: 'source-ticket-kings-platform',
    slug: 'ticket-kings-platform',
    stableKey: 'ticket-kings-platform-v1',
    displayName: 'Ticket Kings Platform',
    description: 'Platform-wide Ticket Kings enrichment source (all-events discovery).',
    listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
    ticketPlatform: {
      platform: 'ticket_king',
      shopSlug: 'ticketkings',
      listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
      timezone: 'Europe/Berlin',
      limits: { maxEventsPerRun: 100, requestsPerMinute: 15 },
      scope: { requireElectronicSignal: true },
    },
    metadata: {
      category: 'ticket_platform',
      platform: 'ticket_king',
      enrichment: true,
      discoveryMode: 'platform_list',
    },
    overrides: {
      scheduleEnabled: false,
      schedulePolicy: 'manual_only',
      scheduleIntervalPreset: 'manual',
      ...overrides,
    },
  });
}

export function buildTicketKingsOrganizerSourceRecord(
  organizerName: string,
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const slug = slugify(organizerName);
  return createDiscoveredTicketPlatformSourceRecord({
    id: `source-ticket-kings-org-${slug}`,
    slug: `ticket-kings-${slug}`,
    stableKey: `ticket-kings-org-${slug}-v1`,
    displayName: `Ticket Kings — ${organizerName}`,
    description: `Ticket Kings organizer-scoped enrichment candidate for ${organizerName}.`,
    listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
    ticketPlatform: {
      platform: 'ticket_king',
      shopSlug: 'ticketkings',
      listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
      timezone: 'Europe/Berlin',
      limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
      scope: {
        requireElectronicSignal: true,
        allowedOrganizers: [organizerName],
      },
    },
    metadata: {
      category: 'ticket_platform',
      platform: 'ticket_king',
      enrichment: true,
      discoveryOrganizer: organizerName,
    },
    overrides: {
      scheduleEnabled: false,
      ...overrides,
    },
  });
}
