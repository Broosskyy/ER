import type {
  DiscoveredTicketLink,
  ResolvedTicketAction,
  ResolvedTicketLink,
  TicketEventResolutionClass,
  TicketIdentityResult,
  TicketPriceEvidence,
  TicketProviderEventEvidence,
  TicketSourceStateEvidence,
  TicketStatusEvidenceOrigin,
} from './types';
import { buildResolvedTicketAction, consumerActionLabel } from './ticket-action';
import { hasActivePurchaseCta, hasVerifiedPresaleCta } from './consumer-ticket-safety-gate';
import { isEventEnded, projectTicketStatus } from './ticket-lifecycle';
import { extractOfficialDoorAdmissionFromHtml } from './extract-official-door-admission';
import { buildTicketPriceEvidence, projectConsumerPriceLabel } from './ticket-price-evidence';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';
import { mapResolutionToTicketSourceState } from './ticket-source-state';

const REGISTRATION_DISCOVERED_LINK_PATTERN =
  /sibforms\.com|mailchimp|newsletter|waitlist|vormerken|presale.?reg|pre-?register|registrier/i;

function findRegistrationDiscoveredLink(links: DiscoveredTicketLink[] | undefined): DiscoveredTicketLink | undefined {
  return links?.find((link) => REGISTRATION_DISCOVERED_LINK_PATTERN.test(link.rawUrl));
}

function isRegistrationTargetUrl(url: string | undefined): boolean {
  return Boolean(url && REGISTRATION_DISCOVERED_LINK_PATTERN.test(url));
}

function isSoldOutPreregistrationTarget(result: VerifiedTicketCompleteResult): boolean {
  if (result.classification !== 'verified_presale_registration') {
    return false;
  }
  const targetUrl = result.canonicalTicketUrl ?? result.resolvedAction?.canonicalTicketUrl;
  if (!isRegistrationTargetUrl(targetUrl)) {
    return false;
  }
  const ctaText = result.primaryLink?.elementText ?? '';
  return /\btickets?\b/i.test(ctaText) && !/\bvorverkauf\b|\bpresale\b/i.test(ctaText);
}

export interface M6_4ConsumerPreview {
  title: string;
  startsAt: string;
  venueName?: string;
  providerKey?: string;
  canonicalTicketUrl?: string;
  priceLabel: string;
  priceEvidenceState: string;
  status: string;
  badge: string;
  statusEvidenceOrigin: TicketStatusEvidenceOrigin;
  actionKind: string;
  actionLabel: string;
  evidenceObservedAt: string;
  identityResult: TicketIdentityResult;
}

export function classifyTicketEventResolution(input: {
  identityResult: TicketIdentityResult;
  identityReasons: string[];
  primaryLink?: DiscoveredTicketLink;
  resolvedAction?: ResolvedTicketAction;
  priceEvidence?: TicketPriceEvidence;
  statusAvailability?: string;
  pipelineError?: boolean;
  ticketSourceState?: string;
}): TicketEventResolutionClass {
  if (input.pipelineError) {
    return 'internal_pipeline_failure';
  }
  if (input.ticketSourceState === 'ticket_link_not_yet_published') {
    return 'ticket_link_not_yet_published';
  }
  if (!input.primaryLink || !input.resolvedAction) {
    return 'unresolved_ticket_relationship';
  }
  if (input.resolvedAction.kind === 'presale_registration') {
    return 'verified_presale_registration';
  }
  if (input.statusAvailability === 'sales_ended') {
    return input.priceEvidence?.state === 'verified_historical'
      ? 'verified_ticket_with_historical_price'
      : 'verified_sales_ended';
  }
  if (input.identityResult === 'ticket_identity_conflict') {
    return 'ticket_identity_conflict';
  }
  if (input.statusAvailability === 'availability_unverified' && input.priceEvidence?.state === 'provider_access_unavailable') {
    return 'provider_access_unavailable';
  }
  if (input.statusAvailability === 'sold_out' && input.priceEvidence?.state === 'no_longer_public') {
    return 'verified_sold_out_without_public_price';
  }
  if (input.priceEvidence?.state === 'verified_historical') {
    return 'verified_ticket_with_historical_price';
  }
  if (
    input.identityResult === 'ticket_identity_verified' &&
    input.resolvedAction &&
    (input.statusAvailability === 'available' || input.statusAvailability === 'sold_out')
  ) {
    if (input.priceEvidence?.state === 'verified_current') {
      return 'verified_ticket_complete';
    }
    if (input.statusAvailability === 'sold_out') {
      return 'verified_sold_out_without_public_price';
    }
    return 'verified_ticket_available';
  }
  if (
    input.identityResult === 'ticket_identity_verified' &&
    input.statusAvailability === 'sold_out' &&
    input.priceEvidence?.state === 'no_longer_public'
  ) {
    return 'verified_sold_out_without_public_price';
  }
  if (input.identityResult === 'ticket_identity_verified' && input.priceEvidence?.state) {
    if (input.priceEvidence.state === 'verified_current') {
      return 'verified_ticket_complete';
    }
    if (input.priceEvidence.state === 'not_yet_published' && input.statusAvailability === 'sale_not_started') {
      return 'verified_presale_registration';
    }
    if (input.priceEvidence.state === 'no_longer_public' && input.statusAvailability === 'sold_out') {
      return 'verified_sold_out_without_public_price';
    }
    if (input.priceEvidence.state === 'provider_access_unavailable') {
      return 'provider_access_unavailable';
    }
  }
  if (input.identityResult === 'ticket_identity_unverifiable') {
    return 'unresolved_ticket_relationship';
  }
  return 'unresolved_ticket_relationship';
}

export function enrichResultWithM6_4(
  result: VerifiedTicketCompleteResult,
  options?: {
    officialEndsAt?: string;
    providerBlocked?: boolean;
    blockedFingerprint?: string;
    pipelineError?: boolean;
    historicalCapture?: {
      amountMinor: number;
      currency: string;
      rawPriceText?: string;
      sourceUrl: string;
      sourceObservedAt: string;
      contentFingerprint: string;
    };
    ticketSourceStateEvidence?: TicketSourceStateEvidence;
    officialPageHtml?: string;
  },
): VerifiedTicketCompleteResult {
  const eventEnded = isEventEnded(result.startsAt, options?.officialEndsAt);
  const isTicketLinkNotYetPublished = options?.ticketSourceStateEvidence?.state === 'ticket_link_not_yet_published';
  const officialDoorAdmission =
    isTicketLinkNotYetPublished && options?.officialPageHtml
      ? extractOfficialDoorAdmissionFromHtml(options.officialPageHtml)
      : undefined;

  const resolvedAction =
    !isTicketLinkNotYetPublished && result.primaryLink
      ? buildResolvedTicketAction({
          discovered: result.primaryLink,
          resolved: result.canonicalTicketUrl
            ? {
                discovered: result.primaryLink,
                resolvedUrl: result.canonicalTicketUrl,
                canonicalTicketUrl: result.canonicalTicketUrl,
                providerKey: result.providerKey ?? 'unknown',
                redirectChain: [],
                isEventDetailUrl: true,
              }
            : undefined,
          observedAt: result.ticketEvidence?.sourceObservedAt ?? options?.historicalCapture?.sourceObservedAt ?? '',
          contentFingerprint:
            result.ticketEvidence?.contentFingerprint ??
            options?.blockedFingerprint ??
            options?.historicalCapture?.contentFingerprint ??
            '',
          eventEnded,
        })
      : undefined;

  const registrationLink = findRegistrationDiscoveredLink(result.discoveredLinks);
  let effectiveResolvedAction = resolvedAction;
  const soldOutPreregistration = isSoldOutPreregistrationTarget(result);

  const statusProjection = isTicketLinkNotYetPublished
    ? {
        availabilityStatus: 'availability_unverified' as const,
        normalizedStatus: 'available',
        statusLabel: 'Ticketlink noch nicht veröffentlicht',
        statusEvidenceOrigin: 'official_source_dom' as TicketStatusEvidenceOrigin,
      }
    : soldOutPreregistration
      ? {
          availabilityStatus: 'sold_out' as const,
          normalizedStatus: 'sold_out' as const,
          statusLabel: 'Ausverkauft',
          statusEvidenceOrigin: 'official_source_dom' as TicketStatusEvidenceOrigin,
        }
      : projectTicketStatus({
          ticketEvidence: result.ticketEvidence,
          officialStartsAt: result.startsAt,
          officialEndsAt: options?.officialEndsAt,
          providerBlocked: options?.providerBlocked,
          presaleRegistration:
            result.classification === 'verified_presale_registration' ||
            effectiveResolvedAction?.kind === 'presale_registration',
        });

  if (
    registrationLink &&
    (statusProjection.availabilityStatus === 'sold_out' ||
      result.ticketEvidence?.normalizedStatus === 'sold_out')
  ) {
    effectiveResolvedAction = buildResolvedTicketAction({
      discovered: registrationLink,
      resolved: {
        discovered: registrationLink,
        resolvedUrl: registrationLink.rawUrl,
        canonicalTicketUrl: registrationLink.rawUrl,
        providerKey: 'presale_registration',
        redirectChain: [],
        isEventDetailUrl: true,
      },
      observedAt: result.ticketEvidence?.sourceObservedAt ?? options?.historicalCapture?.sourceObservedAt ?? '',
      contentFingerprint:
        result.ticketEvidence?.contentFingerprint ??
        options?.blockedFingerprint ??
        options?.historicalCapture?.contentFingerprint ??
        '',
      eventEnded,
    });
  }

  const isPresaleRegistration =
    result.classification === 'verified_presale_registration' ||
    effectiveResolvedAction?.kind === 'presale_registration';

  const priceEvidence: TicketPriceEvidence = isTicketLinkNotYetPublished
    ? officialDoorAdmission
      ? {
          state: 'verified_current',
          evidenceOrigin: 'provider_detail',
          reason: 'official_door_admission_without_purchase_target',
          sourceUrl: options!.ticketSourceStateEvidence!.sourceEventUrl,
          sourceObservedAt: options!.ticketSourceStateEvidence!.observedAt,
          contentFingerprint: options!.ticketSourceStateEvidence!.contentFingerprint,
          amountMinor: officialDoorAdmission.amountMinor,
          currency: officialDoorAdmission.currency,
          rawPriceText: officialDoorAdmission.rawPriceText,
        }
      : {
          state: 'not_yet_published',
          evidenceOrigin: 'provider_detail',
          reason: 'ticket_link_not_yet_published',
          sourceUrl: options!.ticketSourceStateEvidence!.sourceEventUrl,
          sourceObservedAt: options!.ticketSourceStateEvidence!.observedAt,
          contentFingerprint: options!.ticketSourceStateEvidence!.contentFingerprint,
        }
    : buildTicketPriceEvidence({
        ticketEvidence: result.ticketEvidence,
        providerBlocked: options?.providerBlocked,
        eventEnded,
        saleNotStarted: statusProjection.availabilityStatus === 'sale_not_started' || isPresaleRegistration,
        soldOut: statusProjection.availabilityStatus === 'sold_out',
        historicalCapture: options?.historicalCapture,
        presaleRegistration: isPresaleRegistration,
        targetIdentityEvidence: result.targetIdentityEvidence,
      });

  const resolutionClass = classifyTicketEventResolution({
    identityResult: result.identityResult,
    identityReasons: result.identityReasons,
    primaryLink: result.primaryLink,
    resolvedAction: effectiveResolvedAction,
    priceEvidence,
    statusAvailability: statusProjection.availabilityStatus,
    pipelineError: options?.pipelineError,
    ticketSourceState: options?.ticketSourceStateEvidence?.state,
  });

  const tentativeSourceState =
    options?.ticketSourceStateEvidence?.state ??
    mapResolutionToTicketSourceState(resolutionClass, effectiveResolvedAction?.kind);

  const consumerPreview: M6_4ConsumerPreview = {
    title: result.title,
    startsAt: result.startsAt,
    venueName: result.venueName,
    providerKey: isTicketLinkNotYetPublished ? undefined : result.providerKey,
    canonicalTicketUrl: isTicketLinkNotYetPublished
      ? undefined
      : effectiveResolvedAction?.canonicalTicketUrl ?? result.canonicalTicketUrl,
    priceLabel: projectConsumerPriceLabel(priceEvidence, {
      identityResult: result.identityResult,
      identityDecision: result.targetIdentityEvidence?.identityDecision,
      salesStatus: statusProjection.availabilityStatus,
    }),
    priceEvidenceState: priceEvidence.state,
    status: statusProjection.normalizedStatus,
    badge: statusProjection.statusLabel,
    statusEvidenceOrigin: statusProjection.statusEvidenceOrigin,
    actionKind: isTicketLinkNotYetPublished ? 'ticket_detail' : effectiveResolvedAction?.kind ?? 'ticket_detail',
    actionLabel: isTicketLinkNotYetPublished
      ? ''
      : hasActivePurchaseCta({
          ticketSourceState: tentativeSourceState ?? 'provider_access_unavailable',
          identityResult: result.identityResult,
          identityDecision: result.targetIdentityEvidence?.identityDecision,
          salesStatus: statusProjection.availabilityStatus,
          actionKind: effectiveResolvedAction?.kind,
          actionLabel: consumerActionLabel(effectiveResolvedAction?.kind ?? 'ticket_detail'),
          canonicalTicketUrl: resolvedAction?.canonicalTicketUrl ?? result.canonicalTicketUrl,
          priceEvidenceState: priceEvidence.state,
        }) || hasVerifiedPresaleCta({
          ticketSourceState: tentativeSourceState ?? 'presale_registration',
          identityResult: result.identityResult,
          identityDecision: result.targetIdentityEvidence?.identityDecision,
          salesStatus: statusProjection.availabilityStatus,
          actionKind: effectiveResolvedAction?.kind,
          actionLabel: consumerActionLabel(effectiveResolvedAction?.kind ?? 'ticket_detail'),
          canonicalTicketUrl: resolvedAction?.canonicalTicketUrl ?? result.canonicalTicketUrl,
          priceEvidenceState: priceEvidence.state,
        })
        ? consumerActionLabel(effectiveResolvedAction?.kind ?? 'ticket_detail')
        : '',
    evidenceObservedAt: priceEvidence.sourceObservedAt,
    identityResult: result.identityResult,
  };

  return {
    ...result,
    resolvedAction: effectiveResolvedAction,
    priceEvidence,
    statusProjection,
    resolutionClass,
    ticketSourceStateEvidence: options?.ticketSourceStateEvidence,
    consumerPreview: consumerPreview as VerifiedTicketCompleteResult['consumerPreview'],
    verifiedTicketComplete: resolutionClass === 'verified_ticket_complete',
  };
}
