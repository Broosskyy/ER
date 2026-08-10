import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { PipelineRecordEnvelope } from '@/features/aggregation/pipeline/types';
import { parseTicketKingsDetailHtml } from '@/features/aggregation/connectors/ticket-platform/ticket-kings-detail-parser';
import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
} from '@/features/aggregation/connectors/ticket-platform/ticket-kings-public-checkout';
import { buildTicketPlatformEvidenceMetadata } from '@/features/aggregation/connectors/ticket-platform/ticket-platform-evidence-metadata';
import type { SourceEvidenceBundle } from '@/features/import/generic-truth-pipeline/source-evidence-contract';
import { canonicalImportEventToEvidenceBundle } from '@/features/import/generic-truth-pipeline/evidence-from-canonical';

const TICKET_KINGS_LIST_ROW =
  /<a[^>]+class="ect-event-url"[^>]+href="(https:\/\/ticketkings\.de\/event\/[^"]+)"[^>]*>([^<]+)<\/a>/gi;

function readString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isTicketKingsCandidate(candidate: CanonicalImportEvent, meta: Record<string, unknown>): boolean {
  const platform = String(meta.platform ?? '');
  const connector = String(meta.connector ?? meta.connectorKey ?? '');
  return (
    platform.includes('ticket_king') ||
    connector.includes('ticket_kings') ||
    Boolean(candidate.ticketUrl?.includes('ticketkings.de')) ||
    Boolean(candidate.eventUrl?.includes('ticketkings.de'))
  );
}

function isOfficialWebsiteCandidate(meta: Record<string, unknown>): boolean {
  const connector = String(meta.connector ?? meta.connectorKey ?? '');
  return connector === 'website' || connector.includes('official');
}

function resolveBulkSourceRole(
  candidate: CanonicalImportEvent,
  meta: Record<string, unknown>,
): SourceEvidenceBundle['sourceRole'] {
  if (isTicketKingsCandidate(candidate, meta)) {
    return 'ticket_platform';
  }
  if (
    meta.connectorKey === 'ticket_platform' ||
    String(meta.platform ?? '').includes('ticket')
  ) {
    return 'ticket_platform';
  }
  if (isOfficialWebsiteCandidate(meta)) {
    return 'official_website_source';
  }
  return 'official_website_source';
}

function extractHtml(envelope?: PipelineRecordEnvelope): string | undefined {
  const raw = envelope?.rawPayload;
  if (!raw) return undefined;
  if (typeof raw.html === 'string') return raw.html;
  if (typeof raw.detailHtml === 'string') return raw.detailHtml;
  if (typeof raw.rawHtml === 'string') return raw.rawHtml;
  return undefined;
}

function promoteLiveWebsiteEvidence(
  candidate: CanonicalImportEvent,
  meta: Record<string, unknown>,
): void {
  if (candidate.description?.trim() && !readString(meta, 'officialDescription')) {
    meta.officialDescription = candidate.description.trim();
  }
  if (candidate.genreNames?.length && !meta.officialGenres && !meta.unifiedGenres) {
    meta.officialGenres = candidate.genreNames;
  }
  if (candidate.venueName?.trim() && !readString(meta, 'venueName')) {
    meta.venueName = candidate.venueName.trim();
  }
  if (candidate.startDate && !readString(meta, 'eventDate')) {
    meta.eventDate = candidate.startDate.slice(0, 10);
  }
  if (candidate.eventUrl?.trim() && !readString(meta, 'officialEventUrl')) {
    meta.officialEventUrl = candidate.eventUrl.trim();
  }
  if (Array.isArray(candidate.lineupEntries) && candidate.lineupEntries.length > 0) {
    meta.lineupEntries = candidate.lineupEntries;
  }
  if (candidate.artistNames?.length) {
    meta.structuredLineup = candidate.artistNames.map((name, index) => ({
      sortOrder: index,
      displayName: name,
      rawSourceSpelling: name,
      normalizedName: name,
      billingRelation: 'SOLO',
      isB2b: false,
      isF2f: false,
      isLiveSet: false,
      confidence: 0.8,
      reviewState: 'accepted',
      inclusionReason: 'live_website_parse',
    }));
  }
}

function promoteTicketKingsHtmlEvidence(
  candidate: CanonicalImportEvent,
  meta: Record<string, unknown>,
  html?: string,
): void {
  if (!html?.trim()) return;

  const detail = parseTicketKingsDetailHtml(html);
  if (detail.description && !readString(meta, 'ticketPlatformDescription')) {
    meta.ticketPlatformDescription = detail.description;
  }
  if (detail.genreNames?.length && !meta.unifiedGenres) {
    meta.unifiedGenres = detail.genreNames;
  }
  if (detail.lineupEntries?.length) {
    meta.structuredLineup = detail.lineupEntries;
  }

  const espbpMatch = html.match(/<div class="espbp-title-date"[^>]*>\s*<h2[^>]*>([\s\S]*?)<\/h2>/i);
  if (espbpMatch?.[1] && !readString(meta, 'listRowTitle')) {
    meta.listRowTitle = espbpMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  const checkoutUrl = extractNativeEventCheckoutUrl(html);
  if (checkoutUrl && !readString(meta, 'checkoutEvidenceUrl')) {
    meta.checkoutEvidenceUrl = checkoutUrl;
  }

  const checkout = parseTicketKingsCheckoutHtml(html);
  if (checkout.priceText && !readString(meta, 'priceText')) {
    meta.priceText = checkout.priceText;
    meta.connectorPriceText = checkout.priceText;
  }
  if (checkout.excludedProducts?.length) {
    meta.excludedProducts = checkout.excludedProducts.map((product) => product.rawProductName);
  }

  if (!readString(meta, 'listRowTitle')) {
    const eventUrl = candidate.eventUrl ?? candidate.ticketUrl;
    let match: RegExpExecArray | null;
    TICKET_KINGS_LIST_ROW.lastIndex = 0;
    while ((match = TICKET_KINGS_LIST_ROW.exec(html)) !== null) {
      if (eventUrl && match[1] && eventUrl.includes(match[1])) {
        meta.listRowTitle = match[2]?.trim();
        break;
      }
    }
  }

  if (!meta.platform) {
    meta.platform = 'ticket_kings';
  }
  if (!meta.connectorKey) {
    meta.connectorKey = 'ticket_platform';
  }
}

export function enrichCandidateForBulkEvidence(
  candidate: CanonicalImportEvent,
  envelope?: PipelineRecordEnvelope,
  observedAt: string = new Date().toISOString(),
): CanonicalImportEvent {
  const meta: Record<string, unknown> = {
    ...(candidate.sourceMetadata as Record<string, unknown> | undefined),
  };
  const html = extractHtml(envelope);

  if (!readString(meta, 'verifiedAt')) {
    meta.verifiedAt = observedAt;
  }
  if (!readString(meta, 'observedAt')) {
    meta.observedAt = observedAt;
  }

  if (isOfficialWebsiteCandidate(meta)) {
    promoteLiveWebsiteEvidence(candidate, meta);
  }

  if (isTicketKingsCandidate(candidate, meta)) {
    promoteTicketKingsHtmlEvidence(candidate, meta, html);
  }

  const nestedMeta =
    envelope?.rawPayload &&
    typeof envelope.rawPayload.sourceMetadata === 'object' &&
    envelope.rawPayload.sourceMetadata
      ? (envelope.rawPayload.sourceMetadata as Record<string, unknown>)
      : undefined;
  if (nestedMeta) {
    for (const [key, value] of Object.entries(nestedMeta)) {
      if (meta[key] === undefined && value !== undefined) {
        meta[key] = value;
      }
    }
  }

  return {
    ...candidate,
    sourceMetadata: meta,
  };
}

export function buildBulkRebuildEvidenceBundle(
  candidate: CanonicalImportEvent,
  envelope?: PipelineRecordEnvelope,
): SourceEvidenceBundle {
  const enriched = enrichCandidateForBulkEvidence(candidate, envelope);
  const meta = (enriched.sourceMetadata as Record<string, unknown>) ?? {};
  const role = resolveBulkSourceRole(enriched, meta);
  const bundle = canonicalImportEventToEvidenceBundle(enriched, {
    sourceRole: role,
    sourceUrl: enriched.eventUrl ?? enriched.sourceUrl,
  });

  if (bundle.content?.structuredLineup?.length) {
    return bundle;
  }

  const structured = meta.structuredLineup;
  if (Array.isArray(structured) && structured.length > 0) {
    return {
      ...bundle,
      content: {
        ...bundle.content,
        structuredLineup: structured as SourceEvidenceBundle['content'] extends { structuredLineup?: infer T }
          ? T
          : never,
      },
    };
  }

  return bundle;
}

export function buildTicketPlatformMetadataFromEnvelope(
  candidate: CanonicalImportEvent,
  envelope?: PipelineRecordEnvelope,
): Record<string, unknown> | undefined {
  const html = extractHtml(envelope);
  const meta = (candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  if (!html && !meta.listCardEvidence) return undefined;

  try {
    return buildTicketPlatformEvidenceMetadata({
      event: {
        externalId: candidate.externalId,
        title: candidate.title ?? 'unknown',
        startDate: candidate.startDate ?? '1970-01-01T00:00:00.000Z',
        endDate: candidate.endDate,
        timezone: candidate.timezone ?? 'UTC',
        venueName: candidate.venueName,
        ticketUrl: candidate.ticketUrl ?? candidate.eventUrl ?? '',
        eventUrl: candidate.eventUrl ?? candidate.ticketUrl ?? '',
        platform: (String(meta.platform ?? 'ticket_io').includes('ticket_king')
          ? 'ticket_king'
          : 'ticket_io') as 'ticket_io' | 'ticket_king',
        shopSlug: String(meta.shopSlug ?? 'unknown'),
        priceText: candidate.priceText,
        priceAmount: candidate.priceAmount,
        priceCurrency: candidate.priceCurrency,
      },
      connectorKey: String(meta.connectorKey ?? meta.connector ?? 'ticket_platform'),
      platform: String(meta.platform ?? 'ticket_io'),
      shopSlug: String(meta.shopSlug ?? 'unknown'),
      observedAt: readString(meta, 'observedAt') ?? new Date().toISOString(),
      verifiedAt: readString(meta, 'verifiedAt'),
      detailHtml: html,
      checkoutUrl: readString(meta, 'checkoutEvidenceUrl'),
      listCardEvidence:
        meta.listCardEvidence && typeof meta.listCardEvidence === 'object'
          ? (meta.listCardEvidence as import('@/features/aggregation/connectors/ticket-platform/ticket-io-list-card-evidence').TicketIoListCardEvidence)
          : undefined,
    });
  } catch {
    return undefined;
  }
}
