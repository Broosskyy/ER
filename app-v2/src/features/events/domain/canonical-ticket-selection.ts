import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import type {
  CanonicalTicketSnapshot,
  TicketAvailabilityState,
  TicketDestinationClass,
} from '@/features/events/domain/canonical-ticket-domain';
import { TICKET_DESTINATION_PRIORITY, isPublicConsumerCtaDestinationClass } from '@/features/events/domain/canonical-ticket-domain';
import {
  classifyTicketDestination,
  type ClassifiedTicketDestination,
} from '@/features/events/domain/ticket-destination-classification';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import {
  deriveSummaryPriceTextFromPhases,
  deriveTicketStatusFromPhases,
  type AdminEventTicketStatus,
} from '@/features/import/domain/canonical-ticket-phase';
import { normalizeCanonicalTicketPrice } from '@/features/events/domain/canonical-ticket-price-normalization';
import { normalizeCanonicalTicketAvailability } from '@/features/events/domain/canonical-ticket-availability';

export interface TicketUrlCandidate {
  url: string;
  sourceId?: string;
  originId?: string;
  confidence?: number;
  field?: string;
}

export interface SelectCanonicalTicketInput {
  officialEventUrl?: string;
  purchaseCandidates?: TicketUrlCandidate[];
  fallbackCandidates?: TicketUrlCandidate[];
  checkoutEvidenceCandidates?: TicketUrlCandidate[];
  priceText?: string;
  ticketStatus?: AdminEventTicketStatus;
  ticketPhases?: CanonicalTicketPhase[];
  salesStartAt?: string;
  salesEndAt?: string;
  detailBlocked?: boolean;
  now?: string;
}

function classifyCandidates(candidates: TicketUrlCandidate[]): ClassifiedTicketDestination[] {
  return candidates
    .map((candidate) => {
      const classified = classifyTicketDestination(candidate.url);
      if (classified.destinationClass === 'invalid') {
        return undefined;
      }
      return {
        ...classified,
        score:
          classified.score +
          (candidate.confidence ?? 0) * 0.05,
      };
    })
    .filter((entry): entry is ClassifiedTicketDestination & { score: number } => Boolean(entry));
}

function pickBestDestination(
  pool: Array<ClassifiedTicketDestination & { score: number }>,
): ClassifiedTicketDestination | undefined {
  if (pool.length === 0) {
    return undefined;
  }
  return [...pool].sort((left, right) => {
    const priorityDelta =
      TICKET_DESTINATION_PRIORITY[right.destinationClass] -
      TICKET_DESTINATION_PRIORITY[left.destinationClass];
    if (priorityDelta !== 0) {
      return priorityDelta;
    }
    return right.score - left.score;
  })[0];
}

function isOfficialPageClass(destinationClass: TicketDestinationClass): boolean {
  return destinationClass === 'official_event_page' || destinationClass === 'organizer_or_venue_homepage';
}

export function selectCanonicalTicket(input: SelectCanonicalTicketInput): CanonicalTicketSnapshot {
  const now = input.now ?? new Date().toISOString();
  const allPurchase = classifyCandidates(input.purchaseCandidates ?? []);
  const checkoutEvidencePool = classifyCandidates(input.checkoutEvidenceCandidates ?? []);
  const purchasePool = allPurchase.filter(
    (entry) => entry.destinationClass !== 'embedded_checkout_evidence',
  );
  const embeddedFromPurchase = allPurchase.filter(
    (entry) => entry.destinationClass === 'embedded_checkout_evidence',
  );
  const checkoutPool = [...checkoutEvidencePool, ...embeddedFromPurchase];
  const fallbackPool = classifyCandidates(input.fallbackCandidates ?? []);

  const officialCandidate = meaningfulEventText(input.officialEventUrl);
  const officialClassified = officialCandidate ? classifyTicketDestination(officialCandidate) : undefined;

  const checkoutBest = pickBestDestination(checkoutPool);

  const ctaPurchaseBest = pickBestDestination(
    purchasePool.filter((entry) => isPublicConsumerCtaDestinationClass(entry.destinationClass)),
  );
  const fallbackBest = pickBestDestination(
    fallbackPool.filter((entry) => isPublicConsumerCtaDestinationClass(entry.destinationClass)),
  );

  const purchasePriority = ctaPurchaseBest
    ? TICKET_DESTINATION_PRIORITY[ctaPurchaseBest.destinationClass]
    : -1;
  const fallbackPriority = fallbackBest
    ? TICKET_DESTINATION_PRIORITY[fallbackBest.destinationClass]
    : -1;

  let purchaseUrl: string | undefined;
  let fallbackTicketUrl: string | undefined;
  let publicCtaUrl: string | undefined;
  let checkoutEvidenceUrl: string | undefined;
  let destinationClass: TicketDestinationClass = 'unknown';

  if (checkoutBest) {
    checkoutEvidenceUrl = checkoutBest.url;
  }

  if (ctaPurchaseBest && purchasePriority >= fallbackPriority) {
    purchaseUrl = ctaPurchaseBest.url;
    publicCtaUrl = ctaPurchaseBest.url;
    destinationClass = ctaPurchaseBest.destinationClass;
  } else if (fallbackBest) {
    fallbackTicketUrl = fallbackBest.url;
    publicCtaUrl = fallbackBest.url;
    destinationClass = fallbackBest.destinationClass;
  } else if (officialClassified && officialClassified.destinationClass !== 'invalid') {
    publicCtaUrl = officialClassified.url;
    destinationClass = officialClassified.destinationClass;
  }

  const officialEventUrl =
    officialClassified && isOfficialPageClass(officialClassified.destinationClass)
      ? officialClassified.url
      : officialCandidate;

  if (
    ctaPurchaseBest &&
    officialClassified &&
    ctaPurchaseBest.url === officialClassified.url &&
    ctaPurchaseBest.destinationClass === 'official_event_page'
  ) {
    purchaseUrl = undefined;
  }

  const price = normalizeCanonicalTicketPrice({
    priceText: input.priceText,
    ticketPhases: input.ticketPhases,
  });
  const availability = normalizeCanonicalTicketAvailability({
    ticketStatus: input.ticketStatus,
    ticketPhases: input.ticketPhases,
    priceText: price.priceText,
  });
  const ticketStatus =
    deriveTicketStatusFromPhases(input.ticketPhases, input.ticketStatus) ?? input.ticketStatus;

  const conflicting =
    purchasePool.filter((entry) => entry.destinationClass === 'ticket_platform_event').length > 1 &&
    new Set(
      purchasePool
        .filter((entry) => entry.destinationClass === 'ticket_platform_event')
        .map((entry) => entry.url),
    ).size > 1;

  return {
    officialEventUrl,
    purchaseUrl,
    fallbackTicketUrl,
    publicCtaUrl,
    checkoutEvidenceUrl,
    destinationClass,
    ticketPlatform: ctaPurchaseBest?.ticketPlatform ?? fallbackBest?.ticketPlatform,
    ticketStatus,
    availability,
    currency: price.currency,
    minimumPrice: price.minimumPrice,
    maximumPrice: price.maximumPrice,
    priceText: price.priceText ?? deriveSummaryPriceTextFromPhases(input.ticketPhases),
    feesIncluded: price.feesIncluded,
    feeText: price.feeText,
    ticketPhases: input.ticketPhases,
    salesStart: input.salesStartAt,
    salesEnd: input.salesEndAt,
    lastVerifiedAt: now,
    confidence: Math.max(
      ctaPurchaseBest?.score ?? 0,
      fallbackBest?.score ?? 0,
      officialClassified?.score ?? 0,
      checkoutBest?.score ?? 0,
    ),
    provenance: [],
    detailBlocked: Boolean(input.detailBlocked),
    reviewRequired: conflicting,
  };
}
