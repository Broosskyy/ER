import type { EnrichedTicketIoEvent, FirstBatchReviewPacket } from './detail-types';

export function selectFirstBatchCandidates(
  events: EnrichedTicketIoEvent[],
  limit = 5,
): EnrichedTicketIoEvent[] {
  const importCandidates = events
    .filter((event) => event.qualification === 'IMPORT_CANDIDATE')
    .sort((left, right) => (right.importReadinessScore ?? 0) - (left.importReadinessScore ?? 0));

  const selected: EnrichedTicketIoEvent[] = [];
  const usedShops = new Set<string>();
  const usedCities = new Set<string>();

  for (const candidate of importCandidates) {
    if (selected.length >= limit) {
      break;
    }
    const shopKey = candidate.shopSlug;
    const cityKey = candidate.city ?? 'unknown';
    const diversityPenalty =
      (usedShops.has(shopKey) ? 1 : 0) + (usedCities.has(cityKey) ? 1 : 0);
    if (selected.length < 3 || diversityPenalty < 2) {
      selected.push(candidate);
      usedShops.add(shopKey);
      usedCities.add(cityKey);
    }
  }

  if (selected.length < 3) {
    for (const candidate of importCandidates) {
      if (selected.length >= Math.min(limit, 3)) {
        break;
      }
      if (!selected.some((entry) => entry.identityKey === candidate.identityKey)) {
        selected.push(candidate);
      }
    }
  }

  return selected.slice(0, limit);
}

export function buildFirstBatchPacket(event: EnrichedTicketIoEvent, visualQaDir?: string): FirstBatchReviewPacket {
  const verifiedOfficial = event.verifiedOutbound.find((source) => source.verified);
  return {
    identityKey: event.identityKey,
    title: event.title,
    startsAt: event.startsAt,
    venueName: event.venueName,
    city: event.city,
    organizerName: event.organizerName,
    whyRelevant: event.relevanceReasons,
    ticketIoListingUrl: event.listingUrl,
    ticketEventUrl: event.eventUrl,
    verifiedOfficialUrl: verifiedOfficial?.url,
    descriptionSummary: event.description?.slice(0, 500),
    lineup: event.lineupHints,
    genres: event.genreCandidates.map((genre) => genre.label),
    bestMediaUrl: event.bestMediaUrl,
    products: event.products,
    currentAdmissionPriceMinor: event.currentAdmissionPriceMinor,
    currentAdmissionPhase: event.currentAdmissionPhase,
    ticketAvailability: event.ticketAvailability,
    ticketAction: event.ticketAction,
    matchClassification: event.matchClassification,
    importReadinessScore: event.importReadinessScore ?? 0,
    uncertainties: [
      ...(event.ambiguityReason ? [event.ambiguityReason] : []),
      ...(event.detailAccess !== 'DETAIL_ACCESSIBLE' ? [`detail_access:${event.detailAccess}`] : []),
    ],
    visualQaDir,
  };
}
