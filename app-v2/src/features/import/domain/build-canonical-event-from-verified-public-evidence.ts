import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { AdminEventRecord } from '@/data/types/records';
import { writeCanonicalTicketFields } from '@/features/events/domain/canonical-ticket-writer';
import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import {
  evaluateEventEvidenceIdentityGate,
  type EventEvidenceIdentityGateResult,
} from '@/features/import/domain/event-evidence-identity-gate';
import {
  evaluateOfficialPageTicketCorroboration,
  type OfficialPageIdentityEvidence,
} from '@/features/import/domain/official-page-ticket-corroboration';
import { resolveDescriptionGenrePublish } from '@/features/import/domain/description-genre-publish-resolver';
import { evaluateLineupPublishGate } from '@/features/import/domain/lineup-publish-gate';
import {
  formatMinimumAgeLabel,
  type CanonicalTicketPhase,
  type AdminEventTicketStatus,
} from '@/features/import/domain/canonical-ticket-phase';
import type { ImportPublishFieldPatch } from '@/features/import/services/import-event-field-mapper';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';
import type { EventMediaEvidence } from '@/features/import/domain/media-evidence-types';
import {
  mergeOfficialAndMediaGenreEvidence,
  mergeOfficialAndMediaLineupEvidence,
} from '@/features/import/domain/media-lineup-merge';

const EVIDENCE_ONLY_EVENT_ID = 'evidence-only';

export interface VerifiedOfficialEvidence {
  pageUrl?: string;
  pageTitle?: string;
  eventDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueCity?: string;
  description?: string;
  imageUrl?: string;
  genreLabels?: string[];
  lineupContentBlocks?: string[];
  minimumAge?: number;
  organizerName?: string;
  outboundTicketUrls?: string[];
  /** Normalized concrete ticket-event URLs from official scrape (never shop roots). */
  concreteTicketUrls?: string[];
  countryCode?: string;
  verifiedAt?: string;
}

export interface VerifiedTicketEvidence {
  publicTicketUrl?: string;
  pageTitle?: string;
  listRowTitle?: string;
  eventDate?: string;
  venueName?: string;
  priceText?: string;
  ticketPhases?: CanonicalTicketPhase[];
  ticketStatus?: AdminEventTicketStatus;
  verifiedAt?: string;
  ticketOffers?: Array<{
    name: string;
    priceAmount?: number;
    priceCurrency?: string;
    kind?: string;
  }>;
  ticketPlatformGenres?: string[];
}

export interface VerifiedCheckoutEvidence {
  checkoutUrl?: string;
  verifiedAt?: string;
}

export interface VerifiedPublicEvidenceBundle {
  officialEvidence?: VerifiedOfficialEvidence;
  ticketEvidence?: VerifiedTicketEvidence;
  checkoutEvidence?: VerifiedCheckoutEvidence;
  /** Contradictory ticket contribution — never merged into canonical. */
  conflictingTicketEvidence?: VerifiedTicketEvidence;
  /** Verified official flyer media evidence (lineup/genres only; never overrides tickets/venue). */
  mediaEvidence?: EventMediaEvidence;
}

export type GoldenImportDisposition = 'publish' | 'review' | 'blocked' | 'collision_review';

export interface GoldenLineupPatch {
  allowed: boolean;
  reason: string;
  entries: LineupEvidenceEntry[];
}

export interface BuildCanonicalEventFromVerifiedPublicEvidenceResult {
  canonicalPatch: ImportPublishFieldPatch;
  lineupPatch: GoldenLineupPatch;
  disposition: GoldenImportDisposition;
  reviewReasons: string[];
  identityGate: EventEvidenceIdentityGateResult;
  diagnostics: string[];
}

function buildOfficialPageInput(
  official: VerifiedOfficialEvidence | undefined,
  checkout: VerifiedCheckoutEvidence | undefined,
): OfficialPageIdentityEvidence | undefined {
  if (!official) {
    return undefined;
  }
  const outbound = [
    ...(official.outboundTicketUrls ?? []),
    ...(checkout?.checkoutUrl ? [checkout.checkoutUrl] : []),
  ].filter(Boolean);
  if (
    !official.pageTitle?.trim() &&
    !official.eventDate?.trim() &&
    !official.venueName?.trim() &&
    outbound.length === 0
  ) {
    return outbound.length ? { outboundTicketUrls: outbound } : undefined;
  }
  return {
    officialPageUrl: official.pageUrl,
    pageTitle: official.pageTitle,
    eventDate: official.eventDate,
    venueName: official.venueName,
    outboundTicketUrls: outbound.length ? outbound : undefined,
  };
}

function buildIdentityEvent(
  official: VerifiedOfficialEvidence | undefined,
  ticket: VerifiedTicketEvidence | undefined,
): EventIdentitySnapshot {
  return {
    eventId: EVIDENCE_ONLY_EVENT_ID,
    title:
      official?.pageTitle?.trim() ||
      ticket?.listRowTitle?.trim() ||
      ticket?.pageTitle?.trim() ||
      '',
    startDate: official?.eventDate ?? ticket?.eventDate,
    venueName: official?.venueName,
    venueCity: official?.venueCity,
    websiteUrl: official?.pageUrl,
  };
}

function applyIdentityCorrections(
  identity: EventIdentitySnapshot,
  official: VerifiedOfficialEvidence | undefined,
  ticket: VerifiedTicketEvidence | undefined,
  checkout: VerifiedCheckoutEvidence | undefined,
): EventIdentitySnapshot {
  const corroboration = evaluateOfficialPageTicketCorroboration({
    canonical: identity,
    ticketEvidence: {
      pageTitle: ticket?.pageTitle,
      listRowTitle: ticket?.listRowTitle,
      eventDate: ticket?.eventDate,
      venueName: ticket?.venueName,
    },
    officialPage: buildOfficialPageInput(official, checkout),
    publicTicketPageUrl: ticket?.publicTicketUrl ?? checkout?.checkoutUrl,
    verifiedAt: ticket?.verifiedAt ?? official?.verifiedAt ?? checkout?.verifiedAt,
  });

  const corrected = { ...identity };
  for (const correction of corroboration.suggestedIdentityCorrections) {
    if (correction.field === 'title' && correction.suggestedValue) {
      corrected.title = correction.suggestedValue;
    }
    if (correction.field === 'venueName' && correction.suggestedValue) {
      corrected.venueName = correction.suggestedValue;
    }
    if (correction.field === 'startDate' && correction.suggestedValue) {
      corrected.startDate = correction.suggestedValue;
    }
  }
  return corrected;
}

function buildTicketCandidate(
  ticket: VerifiedTicketEvidence,
  checkout: VerifiedCheckoutEvidence | undefined,
  official: OfficialPageIdentityEvidence | undefined,
  sourceId = 'golden-import-evidence',
): CanonicalImportEvent {
  const verifiedAt = ticket.verifiedAt ?? checkout?.verifiedAt;
  return {
    externalId: ticket.publicTicketUrl ?? 'ticket-evidence',
    sourceId,
    sourceName: 'Golden import evidence',
    title: ticket.listRowTitle ?? ticket.pageTitle ?? '',
    startDate: ticket.eventDate ?? '',
    ticketUrl: ticket.publicTicketUrl,
    priceText: ticket.priceText,
    rawSourceType: 'json_ld',
    sourceMetadata: {
      pageTitle: ticket.pageTitle,
      listRowTitle: ticket.listRowTitle,
      eventDate: ticket.eventDate,
      venueName: ticket.venueName,
      verifiedAt,
      publicCtaCandidateUrl: ticket.publicTicketUrl,
      checkoutEvidenceUrl: checkout?.checkoutUrl,
      ticketOffers: ticket.ticketOffers,
      soldOut: ticket.ticketStatus === 'sold_out',
      officialPageTitle: official?.pageTitle,
      officialPageEventDate: official?.eventDate,
      officialPageVenueName: official?.venueName,
      officialOutboundTicketUrls: official?.outboundTicketUrls,
    },
  };
}

function toProvisionalAdminRecord(patch: ImportPublishFieldPatch): AdminEventRecord {
  return {
    id: EVIDENCE_ONLY_EVENT_ID,
    title: patch.title ?? '',
    description: patch.description ?? '',
    startDate: patch.startDate ?? '1970-01-01T00:00:00.000Z',
    endDate: patch.endDate,
    status: 'published',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    venueName: patch.venueName,
    venueCity: patch.venueCity,
    venueAddress: patch.venueAddress,
    venuePostalCode: patch.venuePostalCode,
    websiteUrl: patch.websiteUrl,
    ticketUrl: patch.ticketUrl,
    priceText: patch.priceText,
    ticketStatus: patch.ticketStatus,
    ticketPhases: patch.ticketPhases,
    genreLabels: patch.genreLabels,
    imageUrl: patch.imageUrl,
    organizerName: patch.organizerName,
    ageRestriction: patch.ageRestriction,
  };
}

function resolveDisposition(
  identityGate: EventEvidenceIdentityGateResult,
  conflictingBlocked: boolean,
): GoldenImportDisposition {
  if (conflictingBlocked) {
    return 'collision_review';
  }
  if (identityGate.verdict === 'mismatch' || identityGate.threeWayOutcome === 'all_sources_disagree') {
    return 'blocked';
  }
  if (identityGate.canonicalIdentityReviewRequired) {
    return 'review';
  }
  if (!identityGate.criticalFieldsPublishAllowed) {
    return identityGate.verdict === 'unverifiable' ? 'blocked' : 'review';
  }
  if (identityGate.verdict === 'exact' || identityGate.verdict === 'corroborated') {
    return 'publish';
  }
  return 'review';
}

/**
 * Golden import path: orchestrates existing generic import gates without DB access or reference-specific branches.
 */
export function buildCanonicalEventFromVerifiedPublicEvidence(
  input: VerifiedPublicEvidenceBundle,
): BuildCanonicalEventFromVerifiedPublicEvidenceResult {
  const official = input.officialEvidence;
  const ticket = input.ticketEvidence;
  const checkout = input.checkoutEvidence;
  const conflicting = input.conflictingTicketEvidence;
  const diagnostics: string[] = [];
  const reviewReasons: string[] = [];

  const provisionalIdentity = buildIdentityEvent(official, ticket);
  const identityEvent = applyIdentityCorrections(provisionalIdentity, official, ticket, checkout);
  const officialPage = buildOfficialPageInput(official, checkout);

  const identityGate = evaluateEventEvidenceIdentityGate({
    event: identityEvent,
    evidence: {
      pageTitle: ticket?.pageTitle,
      listRowTitle: ticket?.listRowTitle,
      eventDate: ticket?.eventDate,
      venueName: ticket?.venueName,
    },
    officialEventUrl: official?.pageUrl,
    officialPage,
    officialOutboundTicketUrls: officialPage?.outboundTicketUrls,
    evidenceUrl: ticket?.publicTicketUrl ?? checkout?.checkoutUrl,
    verifiedAt: ticket?.verifiedAt ?? official?.verifiedAt ?? checkout?.verifiedAt,
  });

  diagnostics.push(...identityGate.diagnostics);

  let conflictingBlocked = false;
  if (conflicting) {
    const conflictGate = evaluateEventEvidenceIdentityGate({
      event: identityEvent,
      evidence: {
        pageTitle: conflicting.pageTitle,
        listRowTitle: conflicting.listRowTitle,
        eventDate: conflicting.eventDate,
        venueName: conflicting.venueName,
      },
      evidenceUrl: conflicting.publicTicketUrl,
      verifiedAt: conflicting.verifiedAt,
    });
    if (!conflictGate.criticalFieldsPublishAllowed) {
      conflictingBlocked = true;
      reviewReasons.push(`conflicting_ticket_blocked:${conflictGate.reason}`);
      diagnostics.push('conflicting_ticket:isolated');
    }
  }

  const observedAt =
    ticket?.verifiedAt ?? official?.verifiedAt ?? checkout?.verifiedAt ?? new Date().toISOString();

  const canonicalPatch: ImportPublishFieldPatch = {
    title: identityEvent.title,
    startDate: identityEvent.startDate,
    endDate: official?.endDate,
    venueName: official?.venueName ?? identityEvent.venueName,
    venueAddress: official?.venueAddress,
    venuePostalCode: official?.venuePostalCode,
    venueCity: official?.venueCity ?? identityEvent.venueCity,
    venueCountryCode: official?.countryCode,
    websiteUrl: official?.pageUrl ?? identityEvent.websiteUrl,
    imageUrl: official?.imageUrl,
    organizerName: official?.organizerName,
    ageRestriction:
      official?.minimumAge !== undefined
        ? formatMinimumAgeLabel(official.minimumAge)
        : undefined,
  };

  const descGenre = resolveDescriptionGenrePublish({
    event: identityEvent,
    officialDescription: official?.description,
    officialGenreLabels: official?.genreLabels,
    ticketPlatformDescription: undefined,
    ticketPlatformGenres: ticket?.ticketPlatformGenres,
    ticketEvidence: ticket
      ? {
          pageTitle: ticket.pageTitle,
          listRowTitle: ticket.listRowTitle,
          eventDate: ticket.eventDate,
          venueName: ticket.venueName,
        }
      : undefined,
    observedAt,
  });

  if (descGenre.description) {
    canonicalPatch.description = descGenre.description;
  }
  if (descGenre.blockedReason) {
    reviewReasons.push(descGenre.blockedReason);
  }

  if (ticket && identityGate.criticalFieldsPublishAllowed) {
    const ticketWrite = writeCanonicalTicketFields({
      existing: toProvisionalAdminRecord(canonicalPatch),
      candidate: buildTicketCandidate(ticket, checkout, officialPage),
    });
    diagnostics.push(...ticketWrite.audit.diagnostics);
    if (ticketWrite.audit.canonicalIdentityReviewRequired) {
      reviewReasons.push('canonical_identity_review_required');
    }
    if (ticketWrite.patch.ticketUrl) {
      canonicalPatch.ticketUrl = ticketWrite.patch.ticketUrl;
    }
    if (ticketWrite.patch.priceText) {
      canonicalPatch.priceText = ticketWrite.patch.priceText;
    }
    if (ticketWrite.patch.ticketPhases) {
      canonicalPatch.ticketPhases = ticketWrite.patch.ticketPhases;
    }
    if (ticketWrite.patch.ticketStatus) {
      canonicalPatch.ticketStatus = ticketWrite.patch.ticketStatus;
    }
  } else if (ticket) {
    reviewReasons.push(`ticket_fields_blocked:${identityGate.reason}`);
  }

  const lineupGate = evaluateLineupPublishGate({
    event: identityEvent,
    contentBlocks: official?.lineupContentBlocks ?? [],
    identityEvidence: {
      evidence: {
        pageTitle: ticket?.pageTitle ?? official?.pageTitle,
        listRowTitle: ticket?.listRowTitle,
        eventDate: ticket?.eventDate,
        venueName: ticket?.venueName,
      },
      officialEventUrl: official?.pageUrl,
      officialPage,
      officialOutboundTicketUrls: officialPage?.outboundTicketUrls,
      evidenceUrl: ticket?.publicTicketUrl ?? checkout?.checkoutUrl,
      verifiedAt: observedAt,
    },
    descriptionMentionsArtist: undefined,
    contaminationDetected:
      conflictingBlocked ||
      (descGenre.descriptionContaminated === true && Boolean(descGenre.description)),
  });

  const mediaLineupMerge = mergeOfficialAndMediaLineupEvidence({
    officialEntries: lineupGate.extraction.entries,
    mediaEvidence: input.mediaEvidence,
    lineupSourceText: (official?.lineupContentBlocks ?? []).join('\n'),
  });
  for (const reason of mediaLineupMerge.reviewReasons) {
    if (reason === 'lineup_evidence_conflict' || reason === 'compound_act_split') {
      reviewReasons.push(reason);
    }
  }

  const lineupPatch: GoldenLineupPatch = {
    allowed: lineupGate.allowed || mediaLineupMerge.entries.length > 0,
    reason:
      mediaLineupMerge.entries.length > 0 && lineupGate.reason === 'no_structured_lineup_or_dual_headliner_confirmation'
        ? 'structured_lineup_identity_ok'
        : lineupGate.reason,
    entries: mediaLineupMerge.entries,
  };

  const mediaGenreMerge = mergeOfficialAndMediaGenreEvidence({
    officialGenres: descGenre.genreLabels,
    mediaEvidence: input.mediaEvidence,
    artistNames: mediaLineupMerge.entries.map((entry) => entry.displayName),
    venueName: official?.venueName,
    organizerName: official?.organizerName,
  });
  if (mediaGenreMerge.genreLabels.length > 0) {
    canonicalPatch.genreLabels = mediaGenreMerge.genreLabels;
  } else if (descGenre.genreLabels?.length) {
    canonicalPatch.genreLabels = descGenre.genreLabels;
  }
  for (const reason of mediaGenreMerge.reviewReasons) {
    reviewReasons.push(reason);
  }

  const optionalLineupReasons = new Set([
    'lineup_tba_confirmed',
    'lineup_not_announced',
    'no_structured_lineup_or_dual_headliner_confirmation',
  ]);
  if (
    !lineupGate.allowed &&
    !optionalLineupReasons.has(lineupGate.reason) &&
    !lineupGate.reason.startsWith('lineup_review_only:')
  ) {
    reviewReasons.push(`lineup:${lineupGate.reason}`);
  } else if (lineupGate.reason === 'lineup_not_announced') {
    reviewReasons.push('lineup_not_announced');
  }

  const disposition = resolveDisposition(identityGate, conflictingBlocked);

  return {
    canonicalPatch,
    lineupPatch,
    disposition,
    reviewReasons,
    identityGate,
    diagnostics,
  };
}
