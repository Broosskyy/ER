import type { AdminEventRecord } from '@/data/types/records';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';

import type { SourceEvidenceBundle } from './source-evidence-contract';

function readMeta(candidate: CanonicalImportEvent): Record<string, unknown> {
  const nested = (candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  const listCard =
    nested.listCardEvidence && typeof nested.listCardEvidence === 'object'
      ? (nested.listCardEvidence as Record<string, unknown>)
      : undefined;

  return {
    ...nested,
    pageTitle: readString(nested, 'pageTitle'),
    listRowTitle: readString(nested, 'listRowTitle') ?? readString(listCard ?? {}, 'listRowTitle'),
    eventDate: readString(nested, 'eventDate') ?? readString(listCard ?? {}, 'eventDate'),
    venueName: readString(nested, 'venueName') ?? readString(listCard ?? {}, 'venueName'),
    verifiedAt:
      readString(nested, 'verifiedAt') ?? readString(listCard ?? {}, 'verifiedAt'),
    observedAt:
      readString(nested, 'observedAt') ?? readString(listCard ?? {}, 'observedAt'),
    publicCtaCandidateUrl:
      readString(nested, 'publicCtaCandidateUrl') ??
      readString(nested, 'publicTicketPageUrl') ??
      readString(listCard ?? {}, 'publicTicketPageUrl'),
    checkoutEvidenceUrl: readString(nested, 'checkoutEvidenceUrl'),
    connectorKey: nested.connectorKey ?? nested.connector,
    platform: nested.platform,
    listCardEvidence: nested.listCardEvidence,
    identityEvidenceConflict: nested.identityEvidenceConflict,
  };
}

function readString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readUnifiedDescription(meta: Record<string, unknown>): string | undefined {
  return (
    readString(meta, 'officialDescription') ??
    readString(meta, 'unifiedDescription') ??
    readString(meta, 'publicTruthDescription')
  );
}

function readUnifiedGenres(meta: Record<string, unknown>): string[] | undefined {
  const raw = meta.unifiedGenres ?? meta.publicTruthGenres ?? meta.officialGenres;
  if (!Array.isArray(raw)) return undefined;
  const labels = raw
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim());
  return labels.length ? [...new Set(labels)] : undefined;
}

function detectEvidenceOrigin(meta: Record<string, unknown>, isTicketPlatform: boolean): string {
  if (meta.listCardEvidence) return 'ticket_io_list_card';
  if (readString(meta, 'checkoutEvidenceUrl')) return 'checkout_evidence';
  if (readUnifiedDescription(meta) || readString(meta, 'officialHtml')) return 'official_website_public_truth';
  if (readString(meta, 'unifiedDescription')) return 'unified_website_extraction';
  if (isTicketPlatform && (readString(meta, 'pageTitle') || readString(meta, 'listRowTitle'))) {
    return 'ticket_platform_metadata';
  }
  if (readString(meta, 'pageTitle') || readString(meta, 'listRowTitle')) {
    return 'connector_metadata';
  }
  return 'canonical_fallback';
}

/**
 * Maps connector metadata into the shared evidence bundle without self-derived canonical mirrors.
 */
export function canonicalImportEventToEvidenceBundle(
  candidate: CanonicalImportEvent,
  options: { sourceRole?: SourceEvidenceBundle['sourceRole']; sourceUrl?: string } = {},
): SourceEvidenceBundle {
  const metadata = readMeta(candidate);
  const isTicketPlatform =
    metadata.connectorKey === 'ticket_platform' ||
    String(metadata.platform ?? '').includes('ticket');

  const pageTitle = readString(metadata, 'pageTitle');
  const listRowTitle = readString(metadata, 'listRowTitle');
  const eventDate = readString(metadata, 'eventDate');
  const venueName = readString(metadata, 'venueName');
  const organizerFromMeta = readString(metadata, 'organizerName');
  const endDateFromMeta = readString(metadata, 'endDate');

  const publicCtaCandidateUrl =
    readString(metadata, 'publicCtaCandidateUrl') ??
    readString(metadata, 'publicTicketPageUrl');
  const checkoutEvidenceUrl = readString(metadata, 'checkoutEvidenceUrl');

  const verifiedAt =
    readString(metadata, 'verifiedAt') ?? readString(metadata, 'observedAt') ?? '';
  const observedAt = readString(metadata, 'observedAt') ?? verifiedAt;

  const outbound = Array.isArray(metadata.officialOutboundTicketUrls)
    ? metadata.officialOutboundTicketUrls.filter((u): u is string => typeof u === 'string')
    : undefined;

  const nativeIdentityFields = [pageTitle, listRowTitle, eventDate, venueName].filter(Boolean);
  const nativeTicketUrls = [publicCtaCandidateUrl, checkoutEvidenceUrl].filter(Boolean);
  const nativeContent =
    readUnifiedDescription(metadata) ??
    readString(metadata, 'ticketPlatformDescription') ??
    readString(metadata, 'officialDescription');
  const nativeGenres = readUnifiedGenres(metadata) ?? candidate.genreNames;

  const evidenceOrigin = detectEvidenceOrigin(metadata, isTicketPlatform);
  const identityEvidenceOrigin =
    pageTitle || listRowTitle
      ? evidenceOrigin
      : eventDate || venueName
        ? `${evidenceOrigin}:schedule_venue_only`
        : 'none';

  const sourceNativeEvidence =
    nativeIdentityFields.length > 0 ||
    nativeTicketUrls.length > 0 ||
    Boolean(nativeContent) ||
    Boolean(nativeGenres?.length);

  const legacyFallbackUsed = evidenceOrigin === 'canonical_fallback';
  const criticalIdentitySelfDerived =
    !pageTitle &&
    !listRowTitle &&
    !eventDate &&
    !venueName &&
    legacyFallbackUsed;

  return {
    sourceId: candidate.sourceId,
    sourceRole:
      options.sourceRole ??
      (isTicketPlatform ? 'ticket_platform' : 'official_website_source'),
    sourceUrl:
      options.sourceUrl ??
      readString(metadata, 'sourceUrl') ??
      candidate.eventUrl ??
      candidate.originalLink ??
      candidate.externalId,
    observedAt,
    verifiedAt,
    identity: {
      pageTitle,
      listRowTitle,
      eventDate,
      endDate: endDateFromMeta ?? undefined,
      venueName,
      organizerName: organizerFromMeta ?? undefined,
      officialOutboundRelationship: outbound?.length ? 'linked' : 'unknown',
    },
    tickets: {
      publicCtaCandidateUrl,
      checkoutEvidenceUrl,
      priceText: readString(metadata, 'priceText') ?? readString(metadata, 'connectorPriceText'),
      excludedProducts: Array.isArray(metadata.excludedProducts)
        ? metadata.excludedProducts.filter((p): p is string => typeof p === 'string')
        : undefined,
    },
    content: {
      description: nativeContent ?? undefined,
      genreLabels: nativeGenres,
      minimumAge:
        typeof metadata.minimumAge === 'number' ? metadata.minimumAge : candidate.minimumAge,
    },
    provenance: {
      extractionStrategy:
        readString(metadata, 'extractionStrategy') ?? evidenceOrigin,
      evidenceType: isTicketPlatform
        ? 'ticket_platform_event_page'
        : 'official_event_page',
      importerVersion: readString(metadata, 'importerVersion'),
    },
    contamination: metadata.contaminationDetected
      ? {
          detected: true,
          reasons: Array.isArray(metadata.contaminationReasons)
            ? metadata.contaminationReasons.filter((r): r is string => typeof r === 'string')
            : ['contamination_flag'],
        }
      : metadata.identityEvidenceConflict
        ? {
            detected: true,
            reasons: ['identity_evidence_conflict'],
          }
        : undefined,
    diagnostics: Array.isArray(metadata.diagnostics)
      ? metadata.diagnostics.filter((d): d is string => typeof d === 'string')
      : undefined,
    evidenceOrigin,
    identityEvidenceOrigin,
    sourceNativeEvidence,
    legacyFallbackUsed,
    criticalIdentitySelfDerived,
  };
}

/** Evidence verifiedAt only — no observedAt or apply-time fallback. */
export function readCandidateEvidenceVerifiedAt(candidate: CanonicalImportEvent): string | undefined {
  const nested = (candidate.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  const listCard =
    nested.listCardEvidence && typeof nested.listCardEvidence === 'object'
      ? (nested.listCardEvidence as Record<string, unknown>)
      : undefined;
  return readString(nested, 'verifiedAt') ?? readString(listCard ?? {}, 'verifiedAt');
}

export function adminEventToIdentitySnapshot(event: AdminEventRecord) {
  return {
    eventId: event.id,
    title: event.title,
    startDate: event.startDate,
    endDate: event.endDate,
    venueName: event.venueName,
    venueCity: event.venueCity,
    organizerName: event.organizerName,
    ticketUrl: event.ticketUrl,
    websiteUrl: event.websiteUrl,
    sourceId: event.sourceId,
  };
}
