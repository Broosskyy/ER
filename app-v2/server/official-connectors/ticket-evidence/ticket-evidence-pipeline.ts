import type {
  DiscoveredTicketLink,
  EventTicketEvidence,
  ResolvedTicketLink,
  TicketAuditCounters,
  TicketIdentityResult,
  TicketProviderEventEvidence,
} from './types';
import { createEmptyTicketAuditCounters } from './types';
import {
  discoverRejectedTicketCandidates,
  discoverTicketLinksFromHtml,
  selectPrimaryTicketLink,
} from './discover-ticket-links';
import { fetchTicketPage } from './fetch-ticket-page';
import { defaultTicketProviderRegistry } from './provider-registry';
import { resolveTicketLink, extractProviderEventIdFromResolved } from './resolve-ticket-link';
import {
  computeCoverageMetrics,
  computeTicketAuditCountersFromResults,
  isVerifiedTicketComplete,
  type VerifiedTicketCompleteResult,
} from './ticket-audit-metrics';
import { verifyTicketIdentity } from './ticket-identity-verify';
import { lowestAdmissionOffer } from './ticket-io-evidence-provider';
import type { TicketBrowserOps } from './ticket-browser-ops';
import { isAdmissionOfferRole } from './ticket-offer-role';
import { enrichResultWithM6_4 } from './ticket-event-resolution';
import { isCheckoutOrSessionTicketUrl, isMerchandiseUrl, isShopRootUrl } from './url-policy';
import { discoverOfficialTicketCtaFromHtml } from './discover-official-ticket-cta';
import { resolveTicketSourceState } from './ticket-source-state';
import type { OfficialPageCaptureResult } from './ticket-browser-ops';

export interface OfficialEventTicketInput {
  sourceEventKey: string;
  officialUrl: string;
  title: string;
  startsAt: string;
  venueName?: string;
  organizerName?: string;
  endsAt?: string;
}

export interface TicketConsumerPreviewRow {
  title: string;
  startsAt: string;
  venueName?: string;
  providerKey?: string;
  visiblePrice?: string;
  priceFromMinor?: number;
  currency?: string;
  status?: string;
  badge?: string;
  canonicalTicketUrl?: string;
  admissionOfferCount: number;
  rejectedAddonCount: number;
  evidenceOrigin?: string;
  identityResult: TicketIdentityResult;
}

export type TicketEvidencePipelineResult = VerifiedTicketCompleteResult;

const fetchedCanonicalUrls = new Set<string>();
const providerEvidenceCache = new Map<string, TicketProviderEventEvidence>();

export interface ProcessOfficialEventTicketsOptions {
  browserOps?: TicketBrowserOps;
  prefetchedHtml?: string;
  observedAt?: string;
}

export async function processOfficialEventTickets(
  input: OfficialEventTicketInput,
  options: ProcessOfficialEventTicketsOptions = {},
): Promise<TicketEvidencePipelineResult> {
  const observedAt = options.observedAt ?? new Date().toISOString();
  let html = options.prefetchedHtml ?? '';
  let officialCapture: OfficialPageCaptureResult | undefined;

  if (!html && options.browserOps) {
    officialCapture = await options.browserOps.captureOfficialEventPage(input.officialUrl);
    html = officialCapture.html;
  } else if (!html) {
    const response = await fetch(input.officialUrl, {
      headers: { 'User-Agent': 'EternalRave/0.2.0 (ticket-discovery)' },
    });
    html = await response.text();
  }

  const discoveredLinks = discoverTicketLinksFromHtml(html, input.officialUrl, observedAt);
  const rejectedCandidates = discoverRejectedTicketCandidates(html, input.officialUrl);
  const primary = selectPrimaryTicketLink(discoveredLinks);

  if (!primary) {
    const ctaObservation = discoverOfficialTicketCtaFromHtml(html);
    const ticketSourceStateEvidence = resolveTicketSourceState({
      officialUrl: input.officialUrl,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      html,
      discoveredLinks,
      rejectedCandidates,
      observedAt,
      ctaObservation,
      captureMeta: officialCapture
        ? {
            html,
            sourceEventUrl: input.officialUrl,
            observedAt,
            contentFingerprint: officialCapture.contentFingerprint,
            ctaProbeAttempted: officialCapture.ctaProbe?.attempted ?? false,
            ctaProbeProducedUrl: officialCapture.ctaProbe?.producedTicketUrl,
          }
        : undefined,
    });

    if (ticketSourceStateEvidence?.state === 'ticket_link_not_yet_published') {
      return enrichResultWithM6_4(
        buildIncompleteResult(
          input,
          discoveredLinks,
          rejectedCandidates,
          'ticket_identity_unverifiable',
          [],
          'ticket_link_not_yet_published',
        ),
        {
          officialEndsAt: input.endsAt,
          ticketSourceStateEvidence,
        },
      );
    }

    return enrichResultWithM6_4(
      buildIncompleteResult(input, discoveredLinks, rejectedCandidates, 'ticket_identity_unverifiable', [
        'ticket_link_detection_failed',
      ], 'ticket_evidence_missing'),
      { officialEndsAt: input.endsAt },
    );
  }

  try {
    return await continueWithResolvedLink(input, primary, discoveredLinks, rejectedCandidates, observedAt, options);
  } catch (error) {
    return enrichResultWithM6_4(
      buildIncompleteResult(
        input,
        discoveredLinks,
        rejectedCandidates,
        'ticket_identity_unverifiable',
        [error instanceof Error ? error.message : 'pipeline_error'],
        'internal_pipeline_failure',
        primary,
      ),
      { officialEndsAt: input.endsAt, pipelineError: true },
    );
  }
}

async function continueWithResolvedLink(
  input: OfficialEventTicketInput,
  primary: DiscoveredTicketLink,
  discoveredLinks: DiscoveredTicketLink[],
  rejectedCandidates: Array<{ url: string; reason: string }>,
  observedAt: string,
  options: ProcessOfficialEventTicketsOptions,
): Promise<TicketEvidencePipelineResult> {
  const resolved = await resolveTicketLink(primary);
  if (resolved.rejectedUrlReason) {
    rejectedCandidates.push({ url: resolved.canonicalTicketUrl, reason: resolved.rejectedUrlReason });
  }

  if (
    resolved.rejectedUrlReason ||
    isMerchandiseUrl(resolved.canonicalTicketUrl) ||
    isShopRootUrl(resolved.canonicalTicketUrl) ||
    isCheckoutOrSessionTicketUrl(resolved.canonicalTicketUrl)
  ) {
    return buildIncompleteResult(
      input,
      discoveredLinks,
      rejectedCandidates,
      'ticket_identity_unverifiable',
      [resolved.rejectedUrlReason ?? 'invalid_ticket_url'],
      'ticket_evidence_missing',
      primary,
      resolved,
    );
  }

  const isPresaleRegistration = /sibforms\.com/i.test(resolved.canonicalTicketUrl);
  if (isPresaleRegistration) {
    const identity = verifyTicketIdentity({
      providerEventId: resolved.canonicalTicketUrl,
      shopHost: new URL(resolved.canonicalTicketUrl).hostname,
      officialTitle: input.title,
      officialStartAt: input.startsAt,
      officialVenue: input.venueName,
      officialTicketUrl: primary.rawUrl,
      canonicalTicketUrl: resolved.canonicalTicketUrl,
    });
    const partial: VerifiedTicketCompleteResult = {
      sourceEventKey: input.sourceEventKey,
      officialUrl: input.officialUrl,
      title: input.title,
      startsAt: input.startsAt,
      venueName: input.venueName,
      discoveredLinks,
      rejectedCandidates,
      primaryLink: primary,
      canonicalTicketUrl: resolved.canonicalTicketUrl,
      providerKey: 'presale_registration',
      identityResult: identity.result,
      identityReasons: identity.reasons,
      classification: 'verified_presale_registration',
      verifiedTicketComplete: false,
    };
    return enrichResultWithM6_4(partial, { officialEndsAt: input.endsAt });
  }

  const canonicalKey = resolved.canonicalTicketUrl.toLowerCase();
  let providerEvidence: TicketProviderEventEvidence | undefined = providerEvidenceCache.get(canonicalKey);

  if (!providerEvidence && !fetchedCanonicalUrls.has(canonicalKey)) {
    fetchedCanonicalUrls.add(canonicalKey);
    const fetchResult = options.browserOps
      ? await options.browserOps.fetchTicketPage(resolved.canonicalTicketUrl)
      : await fetchTicketPage(resolved.canonicalTicketUrl);

    if (fetchResult.blocked) {
      const identity = verifyTicketIdentity({
        providerEventId:
          resolved.providerKey === 'fourvenues'
            ? (resolved.canonicalTicketUrl.match(/events\/([^/]+)/i)?.[1] ?? resolved.canonicalTicketUrl)
            : resolved.canonicalTicketUrl,
        shopHost: new URL(resolved.canonicalTicketUrl).hostname,
        officialTitle: input.title,
        officialStartAt: input.startsAt,
        officialVenue: input.venueName,
        officialTicketUrl: primary.rawUrl,
        canonicalTicketUrl: resolved.canonicalTicketUrl,
      });
      const partial: VerifiedTicketCompleteResult = {
        sourceEventKey: input.sourceEventKey,
        officialUrl: input.officialUrl,
        title: input.title,
        startsAt: input.startsAt,
        venueName: input.venueName,
        discoveredLinks,
        rejectedCandidates,
        primaryLink: primary,
        canonicalTicketUrl: resolved.canonicalTicketUrl,
        providerKey: resolved.providerKey,
        identityResult: identity.result,
        identityReasons: identity.reasons,
        classification: 'ticket_provider_blocked',
        verifiedTicketComplete: false,
      };
      return enrichResultWithM6_4(partial, {
        officialEndsAt: input.endsAt,
        providerBlocked: true,
        blockedFingerprint: fetchResult.fingerprint,
      });
    }

    const provider = defaultTicketProviderRegistry.resolveProvider(new URL(fetchResult.finalUrl));
    if (!provider) {
      return buildIncompleteResult(
        input,
        discoveredLinks,
        rejectedCandidates,
        'ticket_identity_unverifiable',
        ['ticket_provider_unsupported'],
        'ticket_provider_unsupported',
        primary,
        resolved,
      );
    }

    const extractedAt = new Date().toISOString();
    providerEvidence = await provider.fetchEventEvidence({
      url: new URL(fetchResult.finalUrl),
      canonicalTicketUrl: resolved.canonicalTicketUrl,
      redirectChain: fetchResult.redirectChain,
      body: fetchResult.body,
      contentType: fetchResult.contentType,
      fingerprint: fetchResult.fingerprint,
      observedAt,
      extractedAt,
    });
    providerEvidenceCache.set(canonicalKey, providerEvidence);
  }

  if (!providerEvidence) {
    return buildIncompleteResult(
      input,
      discoveredLinks,
      rejectedCandidates,
      'ticket_identity_unverifiable',
      ['duplicate_fetch_skipped'],
      'ticket_evidence_missing',
      primary,
      resolved,
    );
  }

  const identity = verifyTicketIdentity({
    providerEventId:
      extractProviderEventIdFromResolved(resolved) ?? providerEvidence.providerIdentity.providerEventId,
    shopHost: providerEvidence.providerIdentity.providerScope ?? new URL(resolved.canonicalTicketUrl).hostname,
    providerTitle: providerEvidence.event.rawTitle,
    providerStartAt: providerEvidence.event.startAt,
    providerVenue: providerEvidence.event.venueName,
    officialTitle: input.title,
    officialStartAt: input.startsAt,
    officialVenue: input.venueName,
    officialTicketUrl: primary.rawUrl,
    canonicalTicketUrl: resolved.canonicalTicketUrl,
  });

  const tickets = providerEvidence.tickets;
  const lowest = lowestAdmissionOffer(tickets);
  const admissionOffers = tickets.offers.filter((o) => isAdmissionOfferRole(o.role ?? 'unknown_addon'));

  const consumerPreview: TicketConsumerPreviewRow = {
    title: input.title,
    startsAt: input.startsAt,
    venueName: input.venueName,
    providerKey: tickets.providerKey,
    visiblePrice: lowest?.rawPrice,
    priceFromMinor: lowest?.amountMinor,
    currency: lowest?.currency,
    status: tickets.normalizedStatus,
    badge: tickets.statusLabel,
    canonicalTicketUrl: tickets.canonicalTicketUrl,
    admissionOfferCount: admissionOffers.length,
    rejectedAddonCount: tickets.rejectedOffers.length,
    evidenceOrigin: primary.discoveredFromSource,
    identityResult: identity.result,
  };

  let classification = 'ticket_evidence_missing';
  if (identity.result === 'ticket_identity_verified' && lowest?.amountMinor !== undefined) {
    classification = `verified_ticket_${tickets.normalizedStatus}`;
  } else if (identity.result === 'ticket_identity_conflict') {
    classification = 'ticket_identity_conflict';
  } else if (identity.result === 'ticket_identity_unverifiable') {
    classification = 'ticket_identity_unverifiable';
  }

  const result: VerifiedTicketCompleteResult = {
    sourceEventKey: input.sourceEventKey,
    officialUrl: input.officialUrl,
    title: input.title,
    startsAt: input.startsAt,
    venueName: input.venueName,
    discoveredLinks,
    rejectedCandidates,
    primaryLink: primary,
    canonicalTicketUrl: resolved.canonicalTicketUrl,
    providerKey: tickets.providerKey,
    providerEvidence,
    ticketEvidence: tickets,
    identityResult: identity.result,
    identityReasons: identity.reasons,
    classification,
    consumerPreview,
    verifiedTicketComplete: false,
  };
  result.verifiedTicketComplete = isVerifiedTicketComplete(result);
  return enrichResultWithM6_4(result, { officialEndsAt: input.endsAt });
}

function buildIncompleteResult(
  input: OfficialEventTicketInput,
  discoveredLinks: DiscoveredTicketLink[],
  rejectedCandidates: Array<{ url: string; reason: string }>,
  identityResult: TicketIdentityResult,
  identityReasons: string[],
  classification: string,
  primaryLink?: DiscoveredTicketLink,
  resolved?: ResolvedTicketLink,
): VerifiedTicketCompleteResult {
  const result: VerifiedTicketCompleteResult = {
    sourceEventKey: input.sourceEventKey,
    officialUrl: input.officialUrl,
    title: input.title,
    startsAt: input.startsAt,
    venueName: input.venueName,
    discoveredLinks,
    rejectedCandidates,
    primaryLink,
    canonicalTicketUrl: resolved?.canonicalTicketUrl,
    providerKey: resolved?.providerKey,
    identityResult,
    identityReasons,
    classification,
    verifiedTicketComplete: false,
  };
  return result;
}

export function computeTicketAuditCounters(results: TicketEvidencePipelineResult[]): TicketAuditCounters {
  return computeTicketAuditCountersFromResults(results);
}

export function computeTicketCoverageMetrics(results: TicketEvidencePipelineResult[]) {
  return computeCoverageMetrics(results);
}

export function resetTicketFetchCache(): void {
  fetchedCanonicalUrls.clear();
  providerEvidenceCache.clear();
}

export function ticketEvidenceToCandidateTicket(evidence: EventTicketEvidence) {
  const lowest = lowestAdmissionOffer(evidence);
  return {
    provider: evidence.providerKey,
    ticketUrl: evidence.canonicalTicketUrl,
    priceFromMinor: lowest?.amountMinor,
    currency: lowest?.currency,
    salesStatus: evidence.normalizedStatus,
    sortOrder: 0,
  };
}
