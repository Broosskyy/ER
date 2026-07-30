import type { ImportSourceConfig } from '@/features/import/models/source-config';
import type { SourceRecord } from '@/data/types/records';
import { createBootshausTicketIoLiveProductionSourceRecord } from '@/features/sources/production/ticket-io-source';
import { createAffenkaefigTicketKingsLiveProductionSourceRecord } from '@/features/sources/production/ticket-kings-source';
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

export function buildTicketIoShopSourceRecord(
  candidate: TicketIoShopCandidate,
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const base = createBootshausTicketIoLiveProductionSourceRecord({
    id: `source-ticket-io-${slugify(candidate.shopSlug)}`,
    slug: `ticket-io-${slugify(candidate.shopSlug)}`,
    stableKey: `ticket-io-${candidate.shopSlug}-v1`,
    displayName: `Ticket.io — ${candidate.shopSlug}`,
    description: `Ticket.io enrichment source discovered for shop ${candidate.shopSlug}.`,
    enabled: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    scheduleEnabled: false,
    schedulePolicy: 'manual_only',
    scheduleIntervalPreset: 'manual',
    baseUrl: candidate.listUrl,
    website: candidate.listUrl,
    sourceConfig: {
      reference: { connectorKey: 'ticket_platform' },
      ticketPlatform: {
        platform: 'ticket_io',
        shopSlug: candidate.shopSlug,
        listUrl: candidate.listUrl,
        timezone: 'Europe/Berlin',
        limits: { maxEventsPerRun: 50, requestsPerMinute: 15 },
        scope: { requireElectronicSignal: true },
      },
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
    } as ImportSourceConfig,
    metadata: {
      category: 'ticket_platform',
      platform: 'ticket_io',
      enrichment: true,
      discoveryShopSlug: candidate.shopSlug,
    },
    ...overrides,
  });
  return base;
}

export function buildTicketKingsPlatformSourceRecord(
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  return createAffenkaefigTicketKingsLiveProductionSourceRecord({
    id: 'source-ticket-kings-platform',
    slug: 'ticket-kings-platform',
    stableKey: 'ticket-kings-platform-v1',
    displayName: 'Ticket Kings Platform',
    description: 'Platform-wide Ticket Kings enrichment source (all-events discovery).',
    enabled: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    scheduleEnabled: false,
    schedulePolicy: 'manual_only',
    scheduleIntervalPreset: 'manual',
    baseUrl: TICKET_KINGS_PLATFORM_LIST_URL,
    website: TICKET_KINGS_PLATFORM_LIST_URL,
    sourceConfig: {
      reference: { connectorKey: 'ticket_platform' },
      ticketPlatform: {
        platform: 'ticket_king',
        shopSlug: 'ticketkings',
        listUrl: TICKET_KINGS_PLATFORM_LIST_URL,
        timezone: 'Europe/Berlin',
        limits: { maxEventsPerRun: 100, requestsPerMinute: 15 },
        scope: { requireElectronicSignal: true },
      },
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
    } as ImportSourceConfig,
    metadata: {
      category: 'ticket_platform',
      platform: 'ticket_king',
      enrichment: true,
      discoveryMode: 'platform_list',
    },
    ...overrides,
  });
}

export function buildTicketKingsOrganizerSourceRecord(
  organizerName: string,
  overrides: Partial<SourceRecord> = {},
): SourceRecord {
  const slug = slugify(organizerName);
  return createAffenkaefigTicketKingsLiveProductionSourceRecord({
    id: `source-ticket-kings-org-${slug}`,
    slug: `ticket-kings-${slug}`,
    stableKey: `ticket-kings-org-${slug}-v1`,
    displayName: `Ticket Kings — ${organizerName}`,
    description: `Ticket Kings organizer-scoped enrichment candidate for ${organizerName}.`,
    enabled: false,
    reviewRequired: true,
    publishMode: 'manual_review',
    scheduleEnabled: false,
    sourceConfig: {
      reference: { connectorKey: 'ticket_platform' },
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
      publishPolicy: { mode: 'manual_review', blockOnDuplicate: false },
    } as ImportSourceConfig,
    metadata: {
      category: 'ticket_platform',
      platform: 'ticket_king',
      enrichment: true,
      discoveryOrganizer: organizerName,
    },
    ...overrides,
  });
}
