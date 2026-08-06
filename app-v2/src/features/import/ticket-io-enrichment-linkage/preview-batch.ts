import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { parseAllTicketIoListRowContexts } from '@/features/aggregation/connectors/ticket-platform/ticket-io-list-enrichment';
import type { TicketIoPriceEvidenceDiscovery } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';
import {
  extractTicketIoEventSlug,
  extractTicketIoShopSlug,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import { normalizeCanonicalTicketPrice } from '@/features/events/domain/canonical-ticket-price-normalization';
import { projectCanonicalEventFields } from '@/features/events/formatting/canonical-event-projection';
import { valuesSemanticallyEqual } from '@/features/import/shadow/official-website-public-truth';

import type { TicketIoEnrichmentPreviewMutation } from './types';

const WEBSITE_OWNED_FROZEN_FIELDS = [
  'title',
  'description',
  'imageUrl',
  'websiteUrl',
  'venueName',
  'genreLabels',
  'organizerName',
  'sourceId',
] as const;

export function buildFrozenDomainFingerprint(event: AdminEventRecord): Record<string, unknown> {
  const fingerprint: Record<string, unknown> = {};
  for (const field of WEBSITE_OWNED_FROZEN_FIELDS) {
    fingerprint[field] = event[field] ?? null;
  }
  fingerprint.lineup = 'frozen';
  return fingerprint;
}

export function buildTicketIoEnrichmentCandidate(input: {
  event: AdminEventRecord;
  listHtml: string;
  discovery: TicketIoPriceEvidenceDiscovery;
}): CanonicalImportEvent | undefined {
  const ticketUrl = input.event.ticketUrl?.trim();
  const shopSlug = extractTicketIoShopSlug(ticketUrl ?? '');
  const slug = extractTicketIoEventSlug(ticketUrl ?? '');
  if (!shopSlug || !slug || !ticketUrl) {
    return undefined;
  }

  const listRow = parseAllTicketIoListRowContexts(input.listHtml).get(slug);
  const priceText = input.discovery.bestHit?.priceText ?? listRow?.priceText;
  if (!priceText?.trim() || priceText.trim() === 'Ausverkauft') {
    return undefined;
  }

  return {
    sourceId: 'source-bootshaus-ticket-io',
    sourceName: 'Ticket.io enrichment',
    externalId: ticketUrl,
    title: input.event.title,
    startDate: input.event.startDate,
    ticketUrl,
    priceText,
    priceAmount: input.discovery.bestHit?.priceAmount,
    venueName: input.event.venueName,
    cityName: input.event.venueCity,
    rawSourceType: 'json_ld',
    sourceMetadata: { enrichmentSource: true, platform: 'ticket_io' },
  };
}

export function simulateEnrichmentTicketWrite(input: {
  event: AdminEventRecord;
  candidate: CanonicalImportEvent;
}): {
  patch: ReturnType<typeof writeCanonicalTicketFields>['patch'];
  projection: ReturnType<typeof projectCanonicalEventFields>;
  changedFields: string[];
} {
  const result = writeCanonicalTicketFields({
    existing: input.event,
    candidate: input.candidate,
    fillOnly: true,
    detailBlocked: true,
  });
  const merged: AdminEventRecord = {
    ...input.event,
    ...result.patch,
    sourceId: input.event.sourceId,
    title: input.event.title,
    description: input.event.description,
    venueName: input.event.venueName,
    genreLabels: input.event.genreLabels,
    imageUrl: input.event.imageUrl,
    websiteUrl: input.event.websiteUrl,
  };
  const projection = projectCanonicalEventFields({
    title: merged.title,
    description: merged.description ?? '',
    venue: merged.venueName ?? '',
    city: merged.venueCity ?? '',
    artists: [],
    priceText: merged.priceText,
    source: merged.sourceId ?? '',
    ticketUrl: merged.ticketUrl,
    imageUrl: merged.imageUrl,
    genres: merged.genreLabels,
    ticketStatus: merged.ticketStatus,
    ticketPhases: merged.ticketPhases,
  });
  return {
    patch: result.patch,
    projection,
    changedFields: result.fieldChanges,
  };
}

export function buildTicketIoEnrichmentPreviewMutation(input: {
  event: AdminEventRecord;
  discovery: TicketIoPriceEvidenceDiscovery;
  candidate: CanonicalImportEvent;
  sourceReferenceState: string;
  importRecordState: string;
  slugCollision: boolean;
}): TicketIoEnrichmentPreviewMutation | undefined {
  if (input.slugCollision) {
    return undefined;
  }
  const shopSlug = extractTicketIoShopSlug(input.event.ticketUrl ?? '');
  const eventSlug = extractTicketIoEventSlug(input.event.ticketUrl ?? '');
  if (!shopSlug || !eventSlug) {
    return undefined;
  }
  const simulation = simulateEnrichmentTicketWrite({
    event: input.event,
    candidate: input.candidate,
  });
  const proposedPrice = simulation.patch.priceText;
  if (!proposedPrice?.trim()) {
    return undefined;
  }
  if (
    valuesSemanticallyEqual(input.event.priceText, proposedPrice) ||
    input.event.priceText?.trim() === proposedPrice.trim()
  ) {
    return undefined;
  }
  const normalized = normalizeCanonicalTicketPrice({ priceText: proposedPrice });
  if (normalized.minimumPrice === 0 && !input.discovery.bestHit?.soldOut) {
    return undefined;
  }

  return {
    eventId: input.event.id,
    title: input.event.title,
    shopHost: `${shopSlug}.ticket.io`,
    eventSlug,
    field: 'priceText',
    currentValue: input.event.priceText ?? '',
    proposedValue: proposedPrice,
    publicEvidence: input.discovery.bestHit?.rawSnippet ?? proposedPrice,
    connectorOutput: {
      priceText: input.candidate.priceText,
      priceAmount: input.discovery.bestHit?.priceAmount,
      soldOut: input.discovery.bestHit?.soldOut,
    },
    sourceReferenceState: input.sourceReferenceState,
    importRecordState: input.importRecordState,
    writeReason: 'Ticket.io list-row price evidence; enrichment fill-only',
    consumerVisibleResult: simulation.projection.displayPriceText ?? proposedPrice,
    frozenDomainFingerprint: buildFrozenDomainFingerprint(input.event),
    rollbackValue: input.event.priceText ?? '',
    risk: 'low',
    batch: 'A',
  };
}
