import type { CanonicalTicketPhase } from '@/features/import/domain/canonical-ticket-phase';

/** Strict, field-separated source truth — never mixed with DB event fallbacks. */
export interface SourceEvent {
  title?: string;
  startDate?: string;
  endDate?: string;
  venueName?: string;
  venueAddress?: string;
  venuePostalCode?: string;
  venueCity?: string;
  countryCode?: string;
  websiteUrl?: string;
  ticketUrl?: string;
  description?: string;
  imageUrl?: string;
  genreLabels?: string[];
  lineup?: string[];
  minimumAge?: string;
  ticketStatus?: string;
  priceText?: string;
  ticketPhases?: CanonicalTicketPhase[];
  organizerName?: string;
  verifiedAt?: string;
}

export const SOURCE_EVENT_FIELD_ORDER = [
  'title',
  'startDate',
  'endDate',
  'venueName',
  'venueAddress',
  'venuePostalCode',
  'venueCity',
  'countryCode',
  'websiteUrl',
  'ticketUrl',
  'description',
  'imageUrl',
  'genreLabels',
  'lineup',
  'minimumAge',
  'ticketStatus',
  'priceText',
  'ticketPhases',
  'organizerName',
  'verifiedAt',
] as const satisfies ReadonlyArray<keyof SourceEvent>;
