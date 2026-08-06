export type StaleEvidenceTier = 'active' | 'stale_candidate' | 'superseded';

export interface StaleEvidenceDecision {
  tier: StaleEvidenceTier;
  canWinConsumerField: boolean;
  mergePenalty: number;
  diagnosticCode?: string;
  reason: string;
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    return `${u.protocol}//${u.hostname.toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return url.trim().toLowerCase().replace(/\/+$/, '');
  }
}

function extractSlug(url: string): string {
  return normalizeUrl(url).split('/').filter(Boolean).pop() ?? '';
}

export function isStaleTicketKingsSlugCandidate(unifiedUrl: string, canonicalUrl: string): boolean {
  const u = normalizeUrl(unifiedUrl);
  const c = normalizeUrl(canonicalUrl);
  if (!u.includes('ticketkings') || !c.includes('ticketkings')) return false;
  if (u === c) return false;
  const uSlug = extractSlug(u);
  const cSlug = extractSlug(c);
  return uSlug !== cSlug;
}

export function isStaleJsonLdOfferCandidate(offerUrl: string, verifiedTicketUrl?: string): boolean {
  const offer = normalizeUrl(offerUrl);
  const verified = verifiedTicketUrl ? normalizeUrl(verifiedTicketUrl) : '';
  if (!offer) return false;
  if (!verified) return offer.includes('ticketkings');
  if (offer === verified) return false;
  const offerHost = offer.includes('ticketkings') ? 'tk' : offer.includes('ticket.io') ? 'tio' : 'other';
  const verifiedHost = verified.includes('ticketkings') ? 'tk' : verified.includes('ticket.io') ? 'tio' : 'other';
  return offerHost !== verifiedHost || (offerHost === 'tk' && extractSlug(offer) !== extractSlug(verified));
}

export function classifyStaleTicketDestination(input: {
  candidateUrl: string;
  verifiedUrl?: string;
  source: 'json_ld_offer' | 'ticket_kings_slug' | 'list_row';
  eventDateHint?: string;
}): StaleEvidenceDecision {
  const { candidateUrl, verifiedUrl, source } = input;

  if (verifiedUrl && isStaleJsonLdOfferCandidate(candidateUrl, verifiedUrl)) {
    return {
      tier: 'stale_candidate',
      canWinConsumerField: false,
      mergePenalty: 25,
      diagnosticCode: 'STALE_JSON_LD_OFFER',
      reason: `JSON-LD offer ${candidateUrl} superseded by verified ticket URL ${verifiedUrl}`,
    };
  }

  if (verifiedUrl && isStaleTicketKingsSlugCandidate(candidateUrl, verifiedUrl)) {
    return {
      tier: 'stale_candidate',
      canWinConsumerField: false,
      mergePenalty: 25,
      diagnosticCode: 'STALE_TICKET_KINGS_SLUG',
      reason: `Stale Ticket Kings slug in ${source}: ${candidateUrl}`,
    };
  }

  if (source === 'json_ld_offer' && candidateUrl.includes('ticketkings')) {
    return {
      tier: 'stale_candidate',
      canWinConsumerField: false,
      mergePenalty: 15,
      diagnosticCode: 'JSON_LD_OFFER_UNVERIFIED',
      reason: 'JSON-LD offer URL stored as candidate only until ticket platform confirms',
    };
  }

  return {
    tier: 'active',
    canWinConsumerField: true,
    mergePenalty: 0,
    reason: 'No stale conflict detected',
  };
}

export function staleEvidenceCannotWinMerge(decision: StaleEvidenceDecision): boolean {
  return !decision.canWinConsumerField;
}

export function staleEvidenceTriggersReview(decision: StaleEvidenceDecision): boolean {
  return decision.tier === 'stale_candidate';
}
