import { parseTicketIoDetailDom } from '../parse-ticket-io-detail-dom';
import { resolveCityFromEvidence } from './city-resolution';
import { classifyEventMediaAcceptability } from './event-media-quality';
import {
  extractImageUrlsFromHtml,
  extractOutboundLinksFromHtml,
} from './event-candidate';
import { mergeLineupHints } from './lineup-from-title';
import { classifyDetailRelevance } from './detail-relevance';
import type { DetailFetchResult } from './detail-fetch';
import {
  buildFieldEvidence,
  buildGenreCandidates,
  dedupeDescription,
  qualifyDescription,
  qualifyLineup,
  verifyOutboundSources,
} from './field-evidence';
import { classifyMediaUrls, mediaQualityScore } from './media-classifier';
import { matchDiscoveryCandidateAgainstCatalog } from './match-staging-catalog';
import type { EventMatchCatalogEntry } from '../../../ingestion/identity/event-match-types';
import { enumerateTicketProducts } from './product-qualification';
import {
  calculateImportReadinessScore,
  protectGoldenDuplicates,
  qualifyEnrichedEvent,
} from './qualification';
import type { EnrichedTicketIoEvent } from './detail-types';
import type { TicketIoEventDiscoveryCandidate } from './types';

export function enrichCandidateWithDetail(
  candidate: TicketIoEventDiscoveryCandidate,
  fetchResult: DetailFetchResult,
  catalog: EventMatchCatalogEntry[],
  listingUrl: string,
): EnrichedTicketIoEvent {
  const dom = fetchResult.html ? parseTicketIoDetailDom(fetchResult.html, { sourceUrl: candidate.ticketUrl }) : undefined;
  const outboundLinks = fetchResult.html ? extractOutboundLinksFromHtml(fetchResult.html) : candidate.outboundLinks;
  const imageUrls = [
    ...new Set([
      ...candidate.imageUrls,
      ...(fetchResult.html ? extractImageUrlsFromHtml(fetchResult.html) : []),
      dom?.imageUrl,
    ].filter(Boolean) as string[]),
  ];
  const lineupHints = mergeLineupHints(
    dom?.eventTitle ?? candidate.title,
    dom?.lineupCandidates.map((entry) => entry.displayName) ?? candidate.lineupHints,
  );
  const description = dedupeDescription(dom?.descriptionClean ?? candidate.description);
  const genreHints = [
    ...new Set([...candidate.genreHints, ...(dom?.genreLabels ?? [])]),
  ];
  const productState = dom
    ? enumerateTicketProducts(dom.offers, candidate.ticketUrl)
    : {
        products: candidate.visibleProducts.map((product) => ({
          label: product.productName ?? 'unknown',
          category: 'UNKNOWN' as const,
          rawPrice: product.rawPrice,
          amountMinor: product.amountMinor,
          currency: product.currency,
          availability: 'UNKNOWN' as const,
          soldOut: false,
          purchasable: false,
          grantsAdmission: false,
          selectedAsCurrentAdmission: false,
        })),
        currentAdmissionPriceMinor: candidate.listAmountMinor,
        currentAdmissionPhase: undefined,
        currentAdmissionLabel: candidate.listRawPrice,
        ticketAvailability: 'UNKNOWN' as const,
        ticketAction: 'NONE' as const,
      };

  const relevanceResult =
    fetchResult.detailAccess === 'DETAIL_ACCESSIBLE' || fetchResult.detailAccess === 'PARTIAL_DETAIL'
      ? classifyDetailRelevance({
          title: dom?.eventTitle ?? candidate.title,
          description,
          genreHints,
          lineupHints,
          venueName: dom?.venueName ?? candidate.venueName,
          organizerName: candidate.organizerName,
          detailAccess: fetchResult.detailAccess,
        })
      : {
          relevance: candidate.relevance,
          reasons: [
            ...candidate.relevanceReasons,
            `detail_access:${fetchResult.detailAccess}`,
          ],
          ambiguityReason:
            fetchResult.detailAccess === 'BLOCKED_BY_SECURITY' ||
            fetchResult.detailAccess === 'PROVIDER_ACCESS_UNAVAILABLE'
              ? 'provider_access_unavailable'
              : candidate.relevance === 'AMBIGUOUS'
                ? 'insufficient_detail_evidence'
                : undefined,
        };

  const matched = matchDiscoveryCandidateAgainstCatalog(
    {
      ...candidate,
      title: dom?.eventTitle ?? candidate.title,
      startsAt: dom?.startAt ?? candidate.startsAt,
      venueName: dom?.venueName ?? candidate.venueName,
      description,
      lineupHints,
      genreHints,
      relevance: relevanceResult.relevance,
      relevanceReasons: relevanceResult.reasons,
    },
    catalog,
  );

  const mediaRoles = classifyMediaUrls(imageUrls, { title: matched.title });
  const mediaSelection = classifyEventMediaAcceptability(imageUrls, { title: matched.title });
  const bestMediaUrl = mediaSelection.bestMediaUrl;

  let enriched: EnrichedTicketIoEvent = {
    identityKey: candidate.identityKey,
    ticketIoEventId: candidate.ticketIoEventId,
    shopId: candidate.shopId,
    shopSlug: candidate.shopSlug,
    listingUrl,
    eventUrl: fetchResult.finalUrl || candidate.ticketUrl,
    canonicalUrl: candidate.canonicalUrl,
    title: dom?.eventTitle ?? candidate.title,
    startsAt: dom?.startAt ?? candidate.startsAt,
    endsAt: candidate.endsAt,
    lifecycle: candidate.lifecycle,
    venueName: dom?.venueName ?? candidate.venueName,
    city:
      candidate.city ??
      resolveCityFromEvidence({
        title: matched.title,
        description,
        address: candidate.address,
        venueName: dom?.venueName ?? candidate.venueName,
        outboundLinks: [...new Set([...candidate.outboundLinks, ...outboundLinks])],
      }).city,
    address: candidate.address,
    organizerName: candidate.organizerName,
    description,
    descriptionQualification: qualifyDescription(description),
    lineupHints,
    lineupQualification: qualifyLineup(lineupHints),
    genreHints,
    genreCandidates: buildGenreCandidates(genreHints, matched.title, description),
    outboundLinks: [...new Set([...candidate.outboundLinks, ...outboundLinks])],
    verifiedOutbound: verifyOutboundSources({
      title: matched.title,
      startsAt: dom?.startAt ?? candidate.startsAt,
      venueName: dom?.venueName ?? candidate.venueName,
      eventUrl: candidate.ticketUrl,
      outboundLinks: [...new Set([...candidate.outboundLinks, ...outboundLinks])],
    }),
    imageUrls,
    mediaRoles,
    bestMediaUrl,
    products: productState.products,
    currentAdmissionPriceMinor: productState.currentAdmissionPriceMinor ?? candidate.listAmountMinor,
    currentAdmissionPhase: productState.currentAdmissionPhase,
    currentAdmissionLabel: productState.currentAdmissionLabel,
    ticketAvailability: productState.ticketAvailability,
    ticketAction: productState.ticketAction,
    detailAccess: fetchResult.detailAccess,
    fetchMethod: fetchResult.fetchMethod,
    fetchStatus: fetchResult.fetchStatus,
    evidenceTimestamp: new Date().toISOString(),
    relevance: relevanceResult.relevance,
    relevanceReasons: relevanceResult.reasons,
    ambiguityReason: relevanceResult.ambiguityReason,
    matchClassification: matched.matchClassification,
    matchedEventId: matched.matchedEventId,
    matchedEventTitle: matched.matchedEventTitle,
    matchReasons: matched.matchReasons,
    qualification: 'AMBIGUOUS_REVIEW',
    fieldEvidence: [],
    contentFingerprint: dom?.contentFingerprint ?? fetchResult.contentFingerprint,
  };

  enriched = protectGoldenDuplicates(enriched);
  enriched.qualification = qualifyEnrichedEvent(enriched);
  enriched.importReadinessScore = calculateImportReadinessScore(enriched);
  enriched.fieldEvidence = buildFieldEvidence(enriched);

  if (mediaQualityScore(enriched.mediaRoles) === 0 && enriched.bestMediaUrl) {
    enriched.fieldEvidence.push({
      field: 'media',
      candidateSource: enriched.bestMediaUrl,
      authorityType: 'ticket_io_detail',
      confidence: 0.7,
      selectedValue: enriched.bestMediaUrl,
      conflicts: [],
    });
  }

  return enriched;
}
