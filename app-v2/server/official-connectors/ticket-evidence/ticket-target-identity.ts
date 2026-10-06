import type { TicketIdentityResult, TicketTargetIdentityDecision, TicketTargetIdentityEvidence } from './types';
import { extractFourvenuesProviderEventId, extractTicketIoProviderEventId } from './url-policy';
import { verifyTicketIdentity } from './ticket-identity-verify';

export interface EvaluateTicketTargetIdentityInput {
  originalUrl: string;
  redirectChain: string[];
  terminalUrl: string;
  providerKey?: string;
  providerEventId?: string;
  terminalTitle?: string;
  terminalStartAt?: string;
  terminalVenue?: string;
  terminalOrganizer?: string;
  officialTitle: string;
  officialStartAt: string;
  officialVenue?: string;
  officialTicketUrl?: string;
  observedAt: string;
  contentFingerprint: string;
}

function extractProviderEventIdFromUrl(url: string, providerKey?: string): string | undefined {
  if (providerKey === 'ticket_io') {
    return extractTicketIoProviderEventId(url);
  }
  if (providerKey === 'fourvenues') {
    return extractFourvenuesProviderEventId(url);
  }
  const ticketIoId = extractTicketIoProviderEventId(url);
  if (ticketIoId) {
    return ticketIoId;
  }
  const fourvenuesId = extractFourvenuesProviderEventId(url);
  if (fourvenuesId) {
    return fourvenuesId;
  }
  return undefined;
}

function isProviderPastEventRedirect(url: string): boolean {
  try {
    return new URL(url).searchParams.has('redirectFromEventInPast');
  } catch {
    return false;
  }
}

function mapIdentityResultToDecision(
  result: TicketIdentityResult,
  reasons: string[],
  originalProviderEventId?: string,
  terminalProviderEventId?: string,
  redirectChain: string[] = [],
): TicketTargetIdentityDecision {
  if (result === 'ticket_identity_stale_official_link') {
    return 'stale_ticket_detail';
  }
  if (result === 'ticket_identity_conflict') {
    return 'redirected_to_different_event';
  }
  if (result === 'ticket_identity_unverifiable') {
    return 'identity_unverifiable';
  }
  if (
    originalProviderEventId &&
    terminalProviderEventId &&
    originalProviderEventId.toLowerCase() !== terminalProviderEventId.toLowerCase()
  ) {
    return 'redirected_to_different_event';
  }
  if (redirectChain.length > 1) {
    return 'redirected_same_event';
  }
  return 'verified_same_event';
}

export function evaluateTicketTargetIdentity(input: EvaluateTicketTargetIdentityInput): TicketTargetIdentityEvidence {
  const originalUrl = input.originalUrl.trim();
  const terminalUrl = input.terminalUrl.trim();
  const redirectChain = input.redirectChain.length > 0 ? input.redirectChain : [originalUrl];
  const originalProviderEventId = extractProviderEventIdFromUrl(originalUrl, input.providerKey);
  const terminalProviderEventId =
    extractProviderEventIdFromUrl(terminalUrl, input.providerKey) ?? input.providerEventId;
  const shopHost = (() => {
    try {
      return new URL(terminalUrl).hostname;
    } catch {
      return '';
    }
  })();

  const identity = verifyTicketIdentity({
    providerEventId: terminalProviderEventId ?? terminalUrl,
    shopHost,
    providerTitle: input.terminalTitle,
    providerStartAt: input.terminalStartAt,
    providerVenue: input.terminalVenue,
    officialTitle: input.officialTitle,
    officialStartAt: input.officialStartAt,
    officialVenue: input.officialVenue,
    officialTicketUrl: input.officialTicketUrl ?? originalUrl,
    canonicalTicketUrl: terminalUrl,
  });

  const reasons = [...identity.reasons];
  if (
    originalProviderEventId &&
    terminalProviderEventId &&
    originalProviderEventId.toLowerCase() !== terminalProviderEventId.toLowerCase()
  ) {
    reasons.push('provider_event_id_changed_after_redirect');
  }
  if (isProviderPastEventRedirect(terminalUrl)) {
    reasons.push('provider_redirect_from_past_event');
  }

  let identityDecision: TicketTargetIdentityDecision;
  if (
    originalProviderEventId &&
    terminalProviderEventId &&
    originalProviderEventId.toLowerCase() !== terminalProviderEventId.toLowerCase()
  ) {
    identityDecision = 'redirected_to_different_event';
  } else if (isProviderPastEventRedirect(terminalUrl)) {
    identityDecision = 'stale_ticket_detail';
  } else {
    identityDecision = mapIdentityResultToDecision(
      identity.result,
      reasons,
      originalProviderEventId,
      terminalProviderEventId,
      redirectChain,
    );
  }

  return {
    originalUrl,
    redirectChain,
    terminalUrl,
    providerKey: input.providerKey,
    providerEventId: terminalProviderEventId,
    terminalTitle: input.terminalTitle,
    terminalStartAt: input.terminalStartAt,
    terminalVenue: input.terminalVenue,
    terminalOrganizer: input.terminalOrganizer,
    observedAt: input.observedAt,
    contentFingerprint: input.contentFingerprint,
    identityDecision,
    reasons,
  };
}

export function isVerifiedTicketTargetIdentity(decision: TicketTargetIdentityDecision): boolean {
  return decision === 'verified_same_event' || decision === 'redirected_same_event';
}
