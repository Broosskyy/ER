import { createHash } from 'node:crypto';

import type { DiscoveredTicketLink, TicketSourceState, TicketSourceStateEvidence } from './types';
import {
  discoverOfficialTicketCtaFromHtml,
  isPublishedTicketTargetUrl,
  officialPageHasPublishedTicketTarget,
  type OfficialTicketCtaObservation,
} from './discover-official-ticket-cta';
import { isEventEnded } from './ticket-lifecycle';
import { isMerchandiseUrl, isShopRootUrl } from './url-policy';

export interface OfficialPageCaptureMeta {
  html: string;
  sourceEventUrl: string;
  observedAt: string;
  contentFingerprint?: string;
  ctaProbeAttempted?: boolean;
  ctaProbeProducedUrl?: string;
}

export interface EvaluateTicketSourceStateInput {
  officialUrl: string;
  startsAt: string;
  endsAt?: string;
  html: string;
  discoveredLinks: DiscoveredTicketLink[];
  rejectedCandidates: Array<{ url: string; reason: string }>;
  observedAt: string;
  ctaObservation?: OfficialTicketCtaObservation;
  captureMeta?: OfficialPageCaptureMeta;
  pipelineError?: boolean;
  resolvedCanonicalUrl?: string;
  providerKey?: string;
}

function fingerprintHtml(html: string): string {
  return createHash('sha256').update(html).digest('hex');
}

function hasEmptyOrMissingHref(observation: OfficialTicketCtaObservation): boolean {
  const href = observation.rawHref?.trim() ?? '';
  const dataHref = observation.dataHref?.trim() ?? '';
  const dataUrl = observation.dataUrl?.trim() ?? '';
  return !href && !dataHref && !dataUrl || href === '';
}

export function evaluateTicketLinkNotYetPublished(input: EvaluateTicketSourceStateInput): boolean {
  if (input.pipelineError) {
    return false;
  }
  if (isEventEnded(input.startsAt, input.endsAt)) {
    return false;
  }
  const observation = input.ctaObservation ?? discoverOfficialTicketCtaFromHtml(input.html);
  if (!observation.ctaObserved || !observation.hasTicketSemantics) {
    return false;
  }
  if (!hasEmptyOrMissingHref(observation)) {
    const href = observation.rawHref?.trim() ?? '';
    if (href.startsWith('https://')) {
      return false;
    }
  }
  if (observation.dataHref?.startsWith('https://') || observation.dataUrl?.startsWith('https://')) {
    return false;
  }
  if (input.resolvedCanonicalUrl) {
    return false;
  }
  if (officialPageHasPublishedTicketTarget(input.html, input.discoveredLinks.map((link) => link.rawUrl))) {
    return false;
  }
  const rejectedPublished = input.rejectedCandidates.some(
    (candidate) => isPublishedTicketTargetUrl(candidate.url),
  );
  if (rejectedPublished) {
    return false;
  }
  if (input.captureMeta?.ctaProbeProducedUrl) {
    return false;
  }
  const merchPublished = input.discoveredLinks.some((link) => isMerchandiseUrl(link.rawUrl));
  if (merchPublished) {
    return false;
  }
  if (!input.observedAt || !input.officialUrl) {
    return false;
  }
  const fingerprint = input.captureMeta?.contentFingerprint ?? fingerprintHtml(input.html);
  if (!fingerprint) {
    return false;
  }
  if (input.captureMeta && input.captureMeta.ctaProbeAttempted !== true) {
    return false;
  }
  return true;
}

export function buildTicketSourceStateEvidence(
  input: EvaluateTicketSourceStateInput & { state: TicketSourceState },
): TicketSourceStateEvidence {
  const observation = input.ctaObservation ?? discoverOfficialTicketCtaFromHtml(input.html);
  const fingerprint = input.captureMeta?.contentFingerprint ?? fingerprintHtml(input.html);
  return {
    state: input.state,
    sourceEventUrl: input.officialUrl,
    observedAt: input.observedAt,
    contentFingerprint: fingerprint,
    ctaObserved: observation.ctaObserved,
    ctaText: observation.ctaText,
    ctaVisible: observation.ctaVisible,
    ctaDisabled: observation.ctaDisabled,
    rawHref: observation.rawHref,
    resolvedUrl: input.resolvedCanonicalUrl,
    canonicalTicketUrl: input.resolvedCanonicalUrl,
    providerKey: input.providerKey,
    evidenceOrigin: input.captureMeta?.ctaProbeAttempted ? 'official_source_runtime' : 'official_source_dom',
    reason:
      input.state === 'ticket_link_not_yet_published'
        ? 'official_ticket_cta_without_published_target'
        : undefined,
  };
}

export function resolveTicketSourceState(input: EvaluateTicketSourceStateInput): TicketSourceStateEvidence | undefined {
  if (evaluateTicketLinkNotYetPublished(input)) {
    return buildTicketSourceStateEvidence({ ...input, state: 'ticket_link_not_yet_published' });
  }
  return undefined;
}

export function mapResolutionToTicketSourceState(
  resolutionClass: string | undefined,
  actionKind?: string,
): TicketSourceState | undefined {
  switch (resolutionClass) {
    case 'verified_ticket_complete':
    case 'verified_ticket_available':
    case 'verified_sold_out_without_public_price':
      return 'current_ticket_detail';
    case 'verified_ticket_with_historical_price':
    case 'verified_sales_ended':
      return actionKind === 'waitlist' ? 'waitlist' : 'historical_ticket_detail';
    case 'verified_presale_registration':
      return actionKind === 'waitlist' ? 'waitlist' : 'presale_registration';
    case 'provider_access_unavailable':
      return 'provider_access_unavailable';
    case 'ticket_link_not_yet_published':
      return 'ticket_link_not_yet_published';
    default:
      return undefined;
  }
}
