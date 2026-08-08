import type { TicketTypeViewModel, TicketSummaryViewModel } from '@/components/ticketing/view-models';
import {
  formatGermanTicketPrice,
  parseGermanPriceText,
} from '@/features/aggregation/connectors/ticket-platform/format-ticket-price';
import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';
import {
  deriveSummaryPriceTextFromPhases,
  toTicketPhaseAvailability,
} from '@/features/import/domain/canonical-ticket-phase';
import { formatTimeInTimezone, hasKnownEventClockTime } from '@/features/events/formatting/date-time';
import { isConsumerDiagnosticText } from '@/features/events/formatting/consumer-ticket-text-sanitizer';

const GENERIC_ADMISSION_LABEL = /^(?:list\s+admission|admission|general admission|entry)$/i;

export function isGenericConsumerAdmissionLabel(name: string): boolean {
  return GENERIC_ADMISSION_LABEL.test(name.trim());
}

export function localizeConsumerTicketPhaseLabel(name: string): {
  displayName: string;
  rawLabel: string;
} {
  const rawLabel = name.trim();
  if (GENERIC_ADMISSION_LABEL.test(rawLabel)) {
    return { displayName: 'Ticket', rawLabel };
  }
  return { displayName: rawLabel, rawLabel };
}

function formatSalesPeriodLabel(
  validFrom?: string,
  validUntil?: string,
  timezone?: string,
): string | undefined {
  const fromLabel =
    validFrom && hasKnownEventClockTime(validFrom, timezone ?? 'Europe/Berlin')
      ? formatTimeInTimezone(validFrom, timezone ?? 'Europe/Berlin')
      : undefined;
  const untilLabel =
    validUntil && hasKnownEventClockTime(validUntil, timezone ?? 'Europe/Berlin')
      ? formatTimeInTimezone(validUntil, timezone ?? 'Europe/Berlin')
      : undefined;
  if (fromLabel && untilLabel) {
    return `${fromLabel} – ${untilLabel}`;
  }
  return fromLabel ?? untilLabel;
}

function resolveGenericAdmissionPriceLabel(phase: CanonicalTicketPhase): string | undefined {
  if (phase.priceLabel) {
    if (/\bab\b/i.test(phase.priceLabel)) {
      return phase.priceLabel;
    }
    const parsed = parseGermanPriceText(phase.priceLabel);
    if (parsed.amount !== undefined) {
      return formatGermanTicketPrice(parsed.amount, parsed.currency ?? 'EUR', { prefix: 'ab' });
    }
    return phase.priceLabel;
  }
  if (phase.priceAmount !== undefined) {
    return formatGermanTicketPrice(phase.priceAmount, phase.priceCurrency ?? 'EUR', { prefix: 'ab' });
  }
  return undefined;
}

function resolvePhaseStatus(phase: CanonicalTicketPhase): TicketTypeViewModel['status'] {
  if (phase.soldOut || phase.available === false) {
    return 'sold_out';
  }
  if (phase.available === true || phase.soldOut === false) {
    return 'available';
  }
  return 'unavailable';
}

export function toTicketTypeViewModels(
  phases: CanonicalTicketPhase[] | undefined,
  timezone?: string,
): TicketTypeViewModel[] {
  if (!phases?.length) {
    return [];
  }
  return phases.map((phase) => {
    const status = resolvePhaseStatus(phase);
    const diagnosticNote = isConsumerDiagnosticText(phase.note);
    const localized = localizeConsumerTicketPhaseLabel(phase.name);
    const genericAdmissionPrice = isGenericConsumerAdmissionLabel(phase.name)
      ? resolveGenericAdmissionPriceLabel(phase)
      : undefined;
    const priceLabel: string =
      genericAdmissionPrice ??
      phase.priceLabel ??
      (phase.isFree
        ? 'Kostenlos'
        : phase.priceAmount !== undefined
          ? formatGermanTicketPrice(phase.priceAmount, phase.priceCurrency ?? 'EUR') ?? '—'
          : diagnosticNote
            ? '—'
            : phase.note ?? '—');

    return {
      id: phase.id,
      name: localized.displayName,
      description: diagnosticNote ? undefined : phase.note,
      priceLabel,
      availabilityLabel:
        status === 'sold_out'
          ? 'Ausverkauft'
          : status === 'available'
            ? 'Verfügbar'
            : undefined,
      salesPeriodLabel: formatSalesPeriodLabel(phase.validFrom, phase.validUntil, timezone),
      serviceFeeLabel: phase.feeLabel,
      status,
      accessibilityLabel: `${localized.rawLabel}: ${priceLabel}`,
    };
  });
}

export function toTicketSummaryViewModel(
  phases: CanonicalTicketPhase[] | undefined,
  options?: { forCartCheckout?: boolean },
): TicketSummaryViewModel | undefined {
  if (!options?.forCartCheckout) {
    return undefined;
  }
  if (!phases?.length) {
    return undefined;
  }
  const priced = phases.filter((phase) => phase.priceAmount !== undefined && !phase.soldOut);
  if (priced.length === 0) {
    const summaryText = deriveSummaryPriceTextFromPhases(phases);
    if (!summaryText) {
      return undefined;
    }
    return {
      subtotalLabel: summaryText,
      totalLabel: summaryText,
      accessibilityLabel: `Ticketpreis ${summaryText}`,
    };
  }

  const amounts = priced.map((phase) => phase.priceAmount!).filter(Number.isFinite);
  const currency = priced.find((phase) => phase.priceCurrency)?.priceCurrency ?? 'EUR';
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const subtotalLabel =
    min === max
      ? formatGermanTicketPrice(min, currency) ?? `${min}`
      : `${formatGermanTicketPrice(min, currency, { prefix: 'ab' }) ?? `${min}`} – ${formatGermanTicketPrice(max, currency) ?? `${max}`}`;

  const feePhases = phases.filter((phase) => phase.feeAmount !== undefined || phase.feeLabel);
  const serviceFeeLabel = feePhases[0]?.feeLabel;

  return {
    subtotalLabel,
    serviceFeeLabel,
    totalLabel: subtotalLabel,
    accessibilityLabel: `Tickets ${subtotalLabel}`,
  };
}

export function resolveConsumerTicketPhases(event: {
  ticketPhases?: CanonicalTicketPhase[];
  priceText?: string;
  ticketStatus?: string;
}): CanonicalTicketPhase[] | undefined {
  return event.ticketPhases;
}

export function resolveConsumerTicketPhaseAvailability(event: {
  ticketPhases?: CanonicalTicketPhase[];
}): ReturnType<typeof toTicketPhaseAvailability> {
  return toTicketPhaseAvailability(event.ticketPhases);
}
