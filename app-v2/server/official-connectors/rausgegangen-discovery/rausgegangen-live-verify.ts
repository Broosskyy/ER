import type { EventMatchCatalogEntry } from '../../ingestion/identity/event-match-types';
import { classifyEventMediaAcceptability } from '../ticket-evidence/network-discovery/event-media-quality';
import type { DetailFetchResult } from '../ticket-evidence/network-discovery/detail-fetch';
import type { EnrichedTicketIoEvent } from '../ticket-evidence/network-discovery/detail-types';
import { qualifyDescription } from '../ticket-evidence/network-discovery/field-evidence';
import {
  applyDetailToCandidate,
  enrichedFromRausgegangenCandidate,
  listingEntryToCandidate,
} from './rausgegangen-enrichment';
import { fetchRausgegangenHtml } from './rausgegangen-fetch';
import { parseRausgegangenEventDetail } from './parse-rausgegangen-detail';
import type { RausgegangenLiveVerification } from './rausgegangen-controlled-import-bridge';
import { extractEventSlugFromUrl } from './rausgegangen-url';
import type { RausgegangenListingEntry } from './types';

export interface OriginalBatchEntry {
  identityKey: string;
  title: string;
  startsAt?: string;
  city?: string;
  regionSlug?: string;
  sourceUrl: string;
  relevance?: string;
  genres?: string[];
  lineupCount?: number;
  ticketUrl?: string;
  mediaUrl?: string;
  matchClassification?: string;
}

function toDetailFetchResult(html: string, finalUrl: string, status: number, liveAccessible: boolean): DetailFetchResult {
  return {
    html,
    finalUrl,
    fetchStatus: status,
    fetchMethod: 'fetch',
    detailAccess: liveAccessible ? 'DETAIL_ACCESSIBLE' : 'DETAIL_NOT_FOUND',
    blocked: false,
    contentFingerprint: undefined,
  };
}

export async function verifyRausgegangenCandidateLive(
  batchEntry: OriginalBatchEntry,
  catalog: EventMatchCatalogEntry[],
  referenceInstant: Date,
  referenceDateLocal: string,
): Promise<{
  verification: RausgegangenLiveVerification;
  enriched: EnrichedTicketIoEvent;
  fetchResult: DetailFetchResult;
  detail: ReturnType<typeof parseRausgegangenEventDetail>;
}> {
  const eventSlug = extractEventSlugFromUrl(batchEntry.sourceUrl) ?? batchEntry.identityKey.replace(/^rausgegangen:/, '');
  const listingEntry: RausgegangenListingEntry = {
    eventUrl: batchEntry.sourceUrl,
    eventSlug,
    regionSlug: batchEntry.regionSlug ?? 'cologne',
    listingSurface: `https://rausgegangen.de/${batchEntry.regionSlug ?? 'cologne'}/`,
    listingTitleHint: batchEntry.title,
  };

  const fetch = await fetchRausgegangenHtml(batchEntry.sourceUrl);
  const liveAccessible = fetch.ok && fetch.html.length > 100;
  const detail = parseRausgegangenEventDetail(fetch.html, fetch.finalUrl || batchEntry.sourceUrl);
  const fetchResult = toDetailFetchResult(
    fetch.html,
    fetch.finalUrl || batchEntry.sourceUrl,
    fetch.status,
    liveAccessible,
  );

  let candidate = listingEntryToCandidate(listingEntry, referenceInstant);
  if (liveAccessible) {
    candidate = applyDetailToCandidate(candidate, detail, referenceInstant);
  } else {
    candidate = {
      ...candidate,
      detailFetched: false,
      detailAccess: 'DETAIL_NOT_FOUND',
    };
  }

  const enriched = enrichedFromRausgegangenCandidate(candidate, catalog, referenceInstant);
  const media = classifyEventMediaAcceptability(enriched.imageUrls, { title: enriched.title });

  const verification: RausgegangenLiveVerification = {
    identityKey: enriched.identityKey,
    sourceUrl: batchEntry.sourceUrl,
    verifiedAt: referenceInstant.toISOString(),
    referenceDateLocal,
    liveAccessible,
    detailAccess: enriched.detailAccess,
    title: enriched.title,
    startsAt: enriched.startsAt,
    endsAt: enriched.endsAt,
    venueName: enriched.venueName,
    city: enriched.city,
    organizerName: enriched.organizerName,
    descriptionQualification: qualifyDescription(enriched.description),
    lineup: enriched.lineupHints,
    lineupQualification: enriched.lineupQualification,
    genres: enriched.genreCandidates,
    relevance: enriched.relevance,
    relevanceReasons: enriched.relevanceReasons,
    bestMediaUrl: media.bestMediaUrl ?? enriched.bestMediaUrl,
    mediaAcceptability: media.acceptability,
    ticketUrl: enriched.outboundLinks[0] ?? detail.ticketUrl,
    currentAdmissionPriceMinor: enriched.currentAdmissionPriceMinor,
    ticketAvailability: enriched.ticketAvailability,
    ticketAction: enriched.ticketAction,
    matchClassification: enriched.matchClassification,
    matchReasons: enriched.matchReasons,
    fetchStatus: fetch.status,
    fromCache: fetch.fromCache,
  };

  return { verification, enriched, fetchResult, detail };
}
