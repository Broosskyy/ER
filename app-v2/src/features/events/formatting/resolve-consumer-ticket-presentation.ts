import type { TicketSummaryViewModel, TicketTypeViewModel } from '@/components/ticketing/view-models';
import type { EventTicketMode } from '@/components/event-detail/view-models';
import type { CanonicalTicketPhase, AdminEventTicketStatus } from '@/features/import/domain/canonical-ticket-phase';
import type { LifecycleStatus } from '@/features/events/lifecycle/lifecycle-types';
import { readCanonicalTicket } from '@/features/events/domain/canonical-ticket-read';
import { formatTicketAvailabilityLabelDe } from '@/features/events/domain/canonical-ticket-availability-label';
import {
  auditConsumerPricePresentation,
  type ConsumerPricePresentationSlots,
} from '@/features/events/domain/ticket-price-presentation-contract';
import { resolveEventPriceAvailabilitySemantics } from '@/features/events/domain/event-price-availability-semantics';
import {
  toTicketSummaryViewModel,
  toTicketTypeViewModels,
} from '@/features/events/formatting/ticket-phase-consumer-bridge';
import { resolvePublicTicketPresentation } from '@/features/events/formatting/ticket-presentation';

export interface ConsumerTicketPresentationSource {
  id?: string;
  title?: string;
  priceText?: string;
  displayPriceText?: string;
  ticketUrl?: string;
  officialEventUrl?: string;
  sourceUrl?: string;
  ticketAvailability?: AdminEventTicketStatus;
  ticketPhases?: CanonicalTicketPhase[];
  ticketProviderLabel?: string;
  timezone?: string;
  lifecycleStatus?: LifecycleStatus;
}

export interface ConsumerTicketPresentationModel {
  headerPriceLabel?: string;
  sectionPriceLabel?: string;
  ticketTypes: TicketTypeViewModel[];
  summary?: TicketSummaryViewModel;
  showSummary: boolean;
  availabilityLabel?: string;
  providerLabel?: string;
  cta: string;
}

export interface ResolveConsumerTicketPresentationOptions {
  mode?: EventTicketMode;
  ctaLabel?: string;
  /** True only when the user has selected ticket quantities in an in-app cart. */
  hasCartSelection?: boolean;
}

function phaseDedupeKey(phase: CanonicalTicketPhase): string {
  const name = phase.name.trim().toLowerCase();
  const price =
    phase.priceAmount !== undefined
      ? `${phase.priceAmount}`
      : (phase.priceLabel ?? '').trim().toLowerCase();
  const soldOut = phase.soldOut === true ? '1' : '0';
  return `${name}|${price}|${soldOut}`;
}

export function dedupeConsumerTicketPhases(
  phases: CanonicalTicketPhase[] | undefined,
): CanonicalTicketPhase[] {
  if (!phases?.length) {
    return [];
  }

  const seen = new Set<string>();
  const deduped: CanonicalTicketPhase[] = [];

  for (const phase of [...phases].sort((left, right) => left.sortOrder - right.sortOrder)) {
    const key = phaseDedupeKey(phase);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(phase);
  }

  return deduped;
}

function resolveHeaderPriceLabel(source: ConsumerTicketPresentationSource): string | undefined {
  const publicTicket = resolvePublicTicketPresentation(
    source as Parameters<typeof resolvePublicTicketPresentation>[0],
  );
  return publicTicket.ticketLabel;
}

function resolveVerifiedSectionPriceLabel(
  source: ConsumerTicketPresentationSource,
  headerPriceLabel: string | undefined,
): string | undefined {
  if (headerPriceLabel) {
    return undefined;
  }

  const semantics = resolveEventPriceAvailabilitySemantics({
    priceText: source.displayPriceText ?? source.priceText,
    lifecycleStatus: source.lifecycleStatus,
    ticketAvailability: source.ticketAvailability,
    ticketPhases: source.ticketPhases?.map((phase) => ({
      soldOut: phase.soldOut,
      available: phase.available,
      label: phase.name,
    })),
  });

  if (!semantics.showPrice || !semantics.displayPriceText) {
    return undefined;
  }

  return semantics.displayPriceText;
}

export function resolveConsumerTicketPresentation(
  source: ConsumerTicketPresentationSource,
  options: ResolveConsumerTicketPresentationOptions = {},
): ConsumerTicketPresentationModel {
  const canonicalTicket = readCanonicalTicket({
    ticketUrl: source.ticketUrl,
    websiteUrl: source.officialEventUrl,
    sourceUrl: source.sourceUrl,
    priceText: source.priceText ?? source.displayPriceText,
    ticketStatus: source.ticketAvailability,
    ticketPhases: source.ticketPhases,
  });

  const dedupedPhases = dedupeConsumerTicketPhases(source.ticketPhases);
  const ticketTypes = toTicketTypeViewModels(dedupedPhases, source.timezone);
  const hasPhases = ticketTypes.length > 0;

  const headerPriceLabel = resolveHeaderPriceLabel(source);
  const sectionPriceLabel = hasPhases
    ? undefined
    : resolveVerifiedSectionPriceLabel(source, headerPriceLabel);

  const mode = options.mode ?? 'external';
  const hasCartSelection = options.hasCartSelection === true;
  const showSummary = mode === 'native' && hasCartSelection && hasPhases;
  const summary = showSummary
    ? toTicketSummaryViewModel(dedupedPhases, { forCartCheckout: true })
    : undefined;

  const availabilityLabel =
    canonicalTicket.availability !== 'unknown'
      ? formatTicketAvailabilityLabelDe(canonicalTicket.availability)
      : undefined;

  const providerLabel = canonicalTicket.publicCtaUrl ? source.ticketProviderLabel : undefined;
  const cta = options.ctaLabel ?? canonicalTicket.ctaLabel ?? 'Tickets ansehen';

  return {
    headerPriceLabel,
    sectionPriceLabel,
    ticketTypes,
    summary,
    showSummary,
    availabilityLabel,
    providerLabel,
    cta,
  };
}

export function presentationToConsumerSlots(
  presentation: ConsumerTicketPresentationModel,
): ConsumerPricePresentationSlots {
  return {
    headerPrice: presentation.headerPriceLabel,
    sectionStandalonePrice: presentation.sectionPriceLabel,
    phasePrices: presentation.ticketTypes.map((ticketType) => ticketType.priceLabel),
    subtotal: presentation.showSummary ? presentation.summary?.subtotalLabel : undefined,
    total: presentation.showSummary ? presentation.summary?.totalLabel : undefined,
    availabilityLabel: presentation.availabilityLabel,
    ctaLabel: presentation.cta,
  };
}

export function auditConsumerTicketPresentationForEvent(
  source: ConsumerTicketPresentationSource,
  options: ResolveConsumerTicketPresentationOptions = {},
) {
  const presentation = resolveConsumerTicketPresentation(source, options);
  const slots = presentationToConsumerSlots(presentation);
  return {
    presentation,
    audit: auditConsumerPricePresentation({
      eventId: source.id ?? 'unknown',
      title: source.title ?? 'unknown',
      slots,
    }),
  };
}
