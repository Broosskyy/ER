import type { EventTicketEvidence, TicketProviderEventEvidence } from './types';
import { buildPaylogicIdentity, buildTicketIoIdentity } from './build-provider-identity';
import { projectStatusLabel } from './ticket-status-badge';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';

function mapTicketStatus(raw?: string): EventTicketEvidence['normalizedStatus'] {
  switch (raw) {
    case 'sold_out':
      return 'sold_out';
    case 'sale_not_started':
      return 'sale_not_started';
    case 'sales_ended':
      return 'sales_ended';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'available';
  }
}

export function reconstructTicketEvidenceFromM6_3Row(
  row: Record<string, unknown>,
  officialUrl: string,
): EventTicketEvidence | undefined {
  const amountMinor = typeof row.amountMinor === 'number' ? row.amountMinor : undefined;
  const rawPrice = row.price ? String(row.price) : undefined;
  const fingerprint = row.fingerprint ? String(row.fingerprint) : '';
  const observedAt = row.observedAt ? String(row.observedAt) : '';
  const canonicalTicketUrl = row.finalTicketDetailUrl ? String(row.finalTicketDetailUrl) : undefined;
  const providerKey = row.provider ? String(row.provider) : 'ticket_io';
  const ticketStatus = mapTicketStatus(row.ticketStatus ? String(row.ticketStatus) : 'available');
  const statusLabel = row.statusBadge ? String(row.statusBadge) : projectStatusLabel(ticketStatus);

  if (!canonicalTicketUrl) {
    return undefined;
  }

  const offers: EventTicketEvidence['offers'] =
    amountMinor !== undefined || rawPrice
      ? [
          {
            rawLabel: 'Admission',
            normalizedLabel: 'Admission',
            rawPrice,
            amountMinor,
            currency: row.currency ? String(row.currency) : 'EUR',
            role: 'admission',
            availability: ticketStatus === 'sold_out' ? 'sold_out' : 'available',
            confidence: 0.9,
          },
        ]
      : [];

  const providerIdentity =
    providerKey === 'paylogic' && row.providerEventId
      ? buildPaylogicIdentity(String(row.providerEventId))
      : canonicalTicketUrl && row.providerEventId
        ? buildTicketIoIdentity(new URL(canonicalTicketUrl).hostname, String(row.providerEventId))
        : {
            providerKey,
            providerScope: canonicalTicketUrl ? new URL(canonicalTicketUrl).hostname : '',
            providerEventId: row.providerEventId ? String(row.providerEventId) : '',
            identityKey: `${providerKey}:${canonicalTicketUrl}`,
          };

  return {
    providerKey,
    providerIdentity,
    sourceUrl: canonicalTicketUrl,
    canonicalTicketUrl,
    sourceObservedAt: observedAt,
    extractedAt: observedAt,
    contentFingerprint: fingerprint,
    eventIdentityEvidence: {},
    offers,
    normalizedStatus: ticketStatus,
    statusLabel,
    rejectedOffers: [],
    confidence: offers.length > 0 ? 0.9 : 0.5,
  };
}

export function reconstructVerifiedResultFromM6_3Row(
  row: Record<string, unknown>,
  preview: {
    sourceEventKey: string;
    officialUrl: string;
    title: string;
    startsAt: string;
    venue?: { name?: string };
    endsAt?: string;
  },
): VerifiedTicketCompleteResult | undefined {
  if (!row.verifiedTicketComplete) {
    return undefined;
  }

  const ticketEvidence = reconstructTicketEvidenceFromM6_3Row(row, preview.officialUrl);
  if (!ticketEvidence) {
    return undefined;
  }

  const discoveredCandidates = (row.discoveredCandidates as VerifiedTicketCompleteResult['discoveredLinks']) ?? [];
  const primaryLink = row.rawTicketUrl
    ? {
        rawUrl: String(row.rawTicketUrl),
        relation: 'ticket_provider' as const,
        discoveredOnUrl: preview.officialUrl,
        discoveredFromSource: String(row.usedElement ?? 'a[href]'),
        observedAt: String(row.observedAt ?? ''),
        elementText: String(row.buttonText ?? ''),
      }
    : discoveredCandidates[0];

  const providerEvidence: TicketProviderEventEvidence = {
    providerKey: ticketEvidence.providerKey,
    providerIdentity: ticketEvidence.providerIdentity,
    sourceUrl: ticketEvidence.sourceUrl,
    canonicalTicketUrl: ticketEvidence.canonicalTicketUrl,
    sourceObservedAt: ticketEvidence.sourceObservedAt,
    extractedAt: ticketEvidence.extractedAt,
    contentFingerprint: ticketEvidence.contentFingerprint,
    event: ticketEvidence.eventIdentityEvidence,
    tickets: ticketEvidence,
    confidence: ticketEvidence.confidence,
  };

  return {
    sourceEventKey: preview.sourceEventKey,
    officialUrl: preview.officialUrl,
    title: preview.title,
    startsAt: preview.startsAt,
    venueName: preview.venue?.name,
    discoveredLinks: discoveredCandidates,
    rejectedCandidates: (row.rejectedCandidates as VerifiedTicketCompleteResult['rejectedCandidates']) ?? [],
    primaryLink,
    canonicalTicketUrl: ticketEvidence.canonicalTicketUrl,
    providerKey: ticketEvidence.providerKey,
    providerEvidence,
    ticketEvidence,
    identityResult: 'ticket_identity_verified',
    identityReasons: [],
    classification: String(row.classification ?? 'verified_ticket_available'),
    verifiedTicketComplete: true,
  };
}
