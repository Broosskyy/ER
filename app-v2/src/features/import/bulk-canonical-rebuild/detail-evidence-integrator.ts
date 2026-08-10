import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { SourceEvidenceBundle } from '@/features/import/generic-truth-pipeline/source-evidence-contract';

import type { DetailEvidenceResult } from './detail-evidence-types';

function toStructuredLineup(names: string[]) {
  return names.map((name, index) => ({
    sortOrder: index,
    displayName: name,
    rawSourceSpelling: name,
    normalizedName: name,
    billingRelation: 'SOLO' as const,
    isB2b: false,
    isF2f: false,
    isLiveSet: false,
    confidence: 0.85,
    reviewState: 'accepted' as const,
    inclusionReason: 'detail_evidence',
  }));
}

export function applyDetailEvidenceToCandidate(
  candidate: CanonicalImportEvent,
  detail: DetailEvidenceResult,
): CanonicalImportEvent {
  const meta: Record<string, unknown> = {
    ...(candidate.sourceMetadata as Record<string, unknown> | undefined),
    detailEvidenceStatus: detail.fetchStatus,
    detailEvidenceDiagnostics: detail.diagnostics,
  };

  if (detail.verifiedAt) {
    meta.verifiedAt = detail.verifiedAt;
  }

  if (detail.identity?.pageTitle) {
    meta.pageTitle = detail.identity.pageTitle;
    meta.listRowTitle = detail.identity.pageTitle;
  }

  if (detail.content?.description) {
    meta.officialDescription = detail.content.description;
    meta.ticketPlatformDescription = detail.content.description;
  }

  if (detail.content?.genreLabels?.length) {
    meta.officialGenres = detail.content.genreLabels;
    meta.unifiedGenres = detail.content.genreLabels;
  }

  if (detail.content?.lineup?.length) {
    meta.structuredLineup = toStructuredLineup(detail.content.lineup);
  }

  if (detail.content?.minimumAge !== undefined) {
    meta.minimumAge = detail.content.minimumAge;
  }

  if (detail.content?.venueEnvironment) {
    meta.venueEnvironment = detail.content.venueEnvironment;
  }

  if (detail.content?.imageUrl) {
    meta.imageUrl = detail.content.imageUrl;
  }

  const ticketEvidence = detail.ticketEvidence as Record<string, unknown> | undefined;
  if (ticketEvidence?.priceText && typeof ticketEvidence.priceText === 'string') {
    meta.priceText = ticketEvidence.priceText;
    meta.connectorPriceText = ticketEvidence.priceText;
  }

  if (ticketEvidence?.checkoutOnly) {
    meta.checkoutOnly = true;
  }

  if (ticketEvidence?.publicCtaUrl && typeof ticketEvidence.publicCtaUrl === 'string') {
    meta.publicCtaUrl = ticketEvidence.publicCtaUrl;
  }

  return {
    ...candidate,
    description: detail.content?.description ?? candidate.description,
    genreNames: detail.content?.genreLabels ?? candidate.genreNames,
    minimumAge: detail.content?.minimumAge ?? candidate.minimumAge,
    imageUrl: detail.content?.imageUrl ?? candidate.imageUrl,
    startDate: detail.content?.startDate ?? candidate.startDate,
    endDate: detail.content?.endDate ?? candidate.endDate,
    venueName: detail.identity?.venueName ?? candidate.venueName,
    sourceMetadata: meta,
  };
}

export function applyDetailEvidenceToBundle(
  bundle: SourceEvidenceBundle,
  detail: DetailEvidenceResult,
): SourceEvidenceBundle {
  const updated: SourceEvidenceBundle = { ...bundle };

  if (detail.identity?.pageTitle) {
    updated.identity = {
      ...updated.identity,
      pageTitle: detail.identity.pageTitle,
      listRowTitle: detail.identity.pageTitle ?? updated.identity.listRowTitle,
      eventDate: detail.identity.eventDate ?? updated.identity.eventDate,
      venueName: detail.identity.venueName ?? updated.identity.venueName,
    };
  }

  if (detail.content) {
    updated.content = {
      ...updated.content,
      description: detail.content.description ?? updated.content?.description,
      genreLabels: detail.content.genreLabels ?? updated.content?.genreLabels,
      structuredLineup:
        detail.content.lineup?.length
          ? toStructuredLineup(detail.content.lineup)
          : updated.content?.structuredLineup,
    };
  }

  if (detail.verifiedAt) {
    updated.verifiedAt = detail.verifiedAt;
  }

  updated.observedAt = detail.observedAt;

  return updated;
}
