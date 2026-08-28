import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import type { TicketIdentityResult } from '../ticket-evidence/types';
import type { OfficialEventEvidence } from '../types';
import type {
  EventMediaCandidate,
  EventMediaContentSignals,
  EventMediaIdentityResult,
  EventMediaSourceType,
} from './event-media-candidate';
import { classifyEventMediaType } from './classify-event-media-type';
import type { EventMediaEvidence } from './types';

function canonicalActKey(name: string): string {
  return name.trim().toLowerCase();
}

function lineupOverlapCount(verifiedActs: string[], candidateActs: string[]): number {
  const verified = new Set(verifiedActs.map(canonicalActKey));
  return candidateActs.filter((act) => verified.has(canonicalActKey(act))).length;
}

function mapTicketIdentity(identity?: TicketIdentityResult): EventMediaIdentityResult {
  switch (identity) {
    case 'ticket_identity_verified':
      return 'strong_match';
    case 'ticket_identity_conflict':
      return 'reject';
    case 'ticket_identity_stale_official_link':
      return 'review_required';
    case 'ticket_identity_unverifiable':
    default:
      return 'review_required';
  }
}

function buildContentSignals(input: {
  evidence: OfficialEventEvidence;
  mediaEvidence?: EventMediaEvidence;
  supplementalLineupCount: number;
}): EventMediaContentSignals {
  const verifiedLineup = input.evidence.lineupCandidates.map((act) => act.displayName);
  const mediaLineup =
    input.mediaEvidence?.lineupCandidates.map((act) => act.displayName) ??
    (input.supplementalLineupCount > 0 ? verifiedLineup : []);
  const overlap = lineupOverlapCount(verifiedLineup, mediaLineup);
  const lineupActCount = Math.max(mediaLineup.length, input.supplementalLineupCount);

  const title = input.evidence.title.trim().toLowerCase();
  const rawText = input.mediaEvidence?.rawText?.toLowerCase() ?? '';
  const hasEventTitle = title.length > 0 && rawText.includes(title.slice(0, Math.min(title.length, 12)));

  return {
    hasEventTitle,
    hasDate: /\d{4}|\d{1,2}[./]\d{1,2}/.test(rawText),
    hasVenue: Boolean(input.evidence.venue?.name && rawText.includes(input.evidence.venue.name.toLowerCase().slice(0, 8))),
    hasLineup: lineupActCount > 0,
    lineupActCount,
    lineupOverlapWithVerified: overlap,
    hasEventBranding: /rave|festival|club|event|party/.test(rawText),
    eventSpecificityScore: 0,
    ocrConfidence: input.mediaEvidence?.confidence,
  };
}

function finalizeSpecificity(signals: EventMediaContentSignals): EventMediaContentSignals {
  let score = 0;
  if (signals.hasEventTitle) score += 2;
  if (signals.hasDate) score += 1;
  if (signals.hasVenue) score += 1;
  if (signals.hasLineup) score += 2;
  if (signals.lineupActCount >= 3) score += 2;
  if (signals.lineupOverlapWithVerified >= 2) score += 3;
  if (signals.hasEventBranding) score += 1;
  return { ...signals, eventSpecificityScore: score };
}

function pushCandidate(
  candidates: EventMediaCandidate[],
  seen: Set<string>,
  input: {
    imageUrl: string;
    sourceId: string;
    sourceType: EventMediaSourceType;
    sourceUrl: string;
    identityConfidence: EventMediaIdentityResult;
    evidence: OfficialEventEvidence;
    mediaEvidence?: EventMediaEvidence;
    supplementalLineupCount?: number;
    providerKey?: string;
    discoveredAt: string;
  },
): void {
  const normalizedUrl = input.imageUrl.trim();
  if (!normalizedUrl.startsWith('https://') || seen.has(normalizedUrl)) {
    return;
  }
  seen.add(normalizedUrl);

  const contentSignals = finalizeSpecificity(
    buildContentSignals({
      evidence: input.evidence,
      mediaEvidence: input.mediaEvidence,
      supplementalLineupCount: input.supplementalLineupCount ?? 0,
    }),
  );

  const mediaType = classifyEventMediaType({
    imageUrl: normalizedUrl,
    sourceUrl: input.sourceUrl,
    mediaEvidence: input.mediaEvidence,
    lineupActCount: contentSignals.lineupActCount,
  });

  candidates.push({
    candidateId: `${input.sourceType}:${normalizedUrl}`,
    sourceId: input.sourceId,
    sourceType: input.sourceType,
    sourceUrl: input.sourceUrl,
    imageUrl: normalizedUrl,
    mediaType,
    identityConfidence: input.identityConfidence,
    contentSignals,
    provenance: {
      connectorId: input.evidence.connectorId,
      providerKey: input.providerKey,
      discoveredAt: input.discoveredAt,
      observedAt: input.evidence.fetchedAt,
    },
    discoveredAt: input.discoveredAt,
    score: 0,
    mediaEvidence: input.mediaEvidence,
  });
}

export function collectEventMediaCandidates(
  evidence: OfficialEventEvidence,
  ticketResult?: VerifiedTicketCompleteResult,
): EventMediaCandidate[] {
  const candidates: EventMediaCandidate[] = [];
  const seen = new Set<string>();
  const supplementalLineupCount =
    ticketResult?.providerEvidence?.supplementalContent?.lineupCandidates?.length ?? 0;

  if (evidence.officialImageUrl) {
    pushCandidate(candidates, seen, {
      imageUrl: evidence.officialImageUrl,
      sourceId: evidence.officialUrl,
      sourceType: 'primary_official',
      sourceUrl: evidence.officialUrl,
      identityConfidence: 'exact_match',
      evidence,
      mediaEvidence: evidence.evidenceAudit?.mediaEvidence,
      discoveredAt: evidence.fetchedAt,
    });
  }

  const ticketImageUrl = ticketResult?.providerEvidence?.event.imageUrl;
  if (ticketImageUrl && ticketResult?.canonicalTicketUrl) {
    pushCandidate(candidates, seen, {
      imageUrl: ticketImageUrl,
      sourceId: ticketResult.canonicalTicketUrl,
      sourceType: 'verified_ticket_provider',
      sourceUrl: ticketResult.canonicalTicketUrl,
      identityConfidence: mapTicketIdentity(ticketResult.identityResult),
      evidence,
      supplementalLineupCount,
      providerKey: ticketResult.providerKey,
      discoveredAt: ticketResult.providerEvidence?.sourceObservedAt ?? evidence.fetchedAt,
    });
  }

  return candidates;
}
