import type {
  EventTicketEvidence,
  NormalizedTicketStatus,
  TicketAvailabilityStatus,
  TicketStatusEvidenceOrigin,
  VerifiedTicketStatus,
} from './types';
import { isAdmissionOfferRole } from './ticket-offer-role';
import { projectStatusLabel } from './ticket-status-badge';

export interface TicketStatusProjection {
  availabilityStatus: TicketAvailabilityStatus;
  normalizedStatus: NormalizedTicketStatus;
  statusLabel: string;
  statusEvidenceOrigin: TicketStatusEvidenceOrigin;
}

export function berlinCalendarDay(value: string): string | undefined {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) {
    return undefined;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

export function isEventEnded(startsAt: string, endsAt?: string, nowMs = Date.now()): boolean {
  const endMs = endsAt ? Date.parse(endsAt) : Date.parse(startsAt) + 8 * 3_600_000;
  return Number.isFinite(endMs) && endMs < nowMs;
}

function mapProviderStatus(ticketEvidence?: EventTicketEvidence): TicketAvailabilityStatus {
  if (!ticketEvidence) {
    return 'availability_unverified';
  }
  const status = ticketEvidence.normalizedStatus;
  if (status === 'available') {
    const namedAdmission = ticketEvidence.offers.filter((offer) =>
      isAdmissionOfferRole(offer.role ?? 'unknown_addon'),
    );
    if (namedAdmission.length === 0) {
      return 'available';
    }
    const hasPurchasableAdmission = namedAdmission.some(
      (offer) => offer.availability === 'available' || offer.availability === 'free',
    );
    return hasPurchasableAdmission ? 'available' : 'sold_out';
  }
  if (status === 'sale_not_started') return 'sale_not_started';
  if (status === 'sold_out') return 'sold_out';
  if (status === 'sales_ended') return 'sales_ended';
  if (status === 'cancelled') return 'cancelled';
  return 'availability_unverified';
}

export function projectTicketStatus(input: {
  ticketEvidence?: EventTicketEvidence;
  officialStartsAt: string;
  officialEndsAt?: string;
  providerBlocked?: boolean;
  presaleRegistration?: boolean;
  nowMs?: number;
}): TicketStatusProjection {
  const nowMs = input.nowMs ?? Date.now();
  if (input.presaleRegistration) {
    return {
      availabilityStatus: 'sale_not_started',
      normalizedStatus: 'sale_not_started',
      statusLabel: projectStatusLabel('sale_not_started'),
      statusEvidenceOrigin: 'provider',
    };
  }
  if (input.providerBlocked) {
    return {
      availabilityStatus: 'availability_unverified',
      normalizedStatus: 'available',
      statusLabel: 'Status beim Anbieter prüfen',
      statusEvidenceOrigin: 'unavailable',
    };
  }

  if (isEventEnded(input.officialStartsAt, input.officialEndsAt, nowMs)) {
    return {
      availabilityStatus: 'sales_ended',
      normalizedStatus: 'sales_ended',
      statusLabel: projectStatusLabel('sales_ended'),
      statusEvidenceOrigin: 'event_lifecycle',
    };
  }

  const providerStatus = mapProviderStatus(input.ticketEvidence);
  if (providerStatus === 'availability_unverified') {
    return {
      availabilityStatus: 'availability_unverified',
      normalizedStatus: 'available',
      statusLabel: 'Status beim Anbieter prüfen',
      statusEvidenceOrigin: 'unavailable',
    };
  }

  return {
    availabilityStatus: providerStatus,
    normalizedStatus: providerStatus as NormalizedTicketStatus,
    statusLabel: projectStatusLabel(providerStatus as VerifiedTicketStatus),
    statusEvidenceOrigin: 'provider',
  };
}
