import { classifyTicketDestination } from '@/features/events/domain/ticket-destination-classification';

import type { SourceEvent } from './source-event';

const ADD_ON_PRICE =
  /\b(?:parking|locker|shuttle|camping|deposit|pfand|upgrade|add[- ]?on|versicherung|insurance|flex)\b/i;
const FULL_ADDRESS_IN_CITY =
  /\b\d{5}\b|,\s*\d{5}|straße|str\.|ufer|weg|platz|allee|avenue|street\b/i;
const HTML_OR_NAV = /<[^>]+>|^\s*(?:line[\s-]?up|artists?|transport|tickets?)\b/i;

export interface SourceEventValidationIssue {
  code: string;
  field?: string;
  message: string;
}

export function validateSourceEvent(event: SourceEvent): SourceEventValidationIssue[] {
  const issues: SourceEventValidationIssue[] = [];

  if (event.venueCity?.trim() && FULL_ADDRESS_IN_CITY.test(event.venueCity)) {
    issues.push({
      code: 'full_address_in_venue_city',
      field: 'venueCity',
      message: 'venueCity must not contain a full postal address',
    });
  }
  if (
    event.venueName?.trim() &&
    FULL_ADDRESS_IN_CITY.test(event.venueName) &&
    !event.venueAddress?.trim()
  ) {
    issues.push({
      code: 'address_used_as_venue_name',
      field: 'venueName',
      message: 'venueName must not be a street address',
    });
  }
  if (event.websiteUrl) {
    const classification = classifyTicketDestination(event.websiteUrl).destinationClass;
    if (
      [
        'ticket_platform_event',
        'ticket_platform_listing',
        'ticket_platform_root',
        'embedded_checkout_evidence',
      ].includes(classification)
    ) {
      issues.push({
        code: 'ticket_url_in_website_url',
        field: 'websiteUrl',
        message: 'websiteUrl must not be a ticket platform URL',
      });
    }
  }
  if (
    event.ticketUrl &&
    classifyTicketDestination(event.ticketUrl).destinationClass === 'official_event_page'
  ) {
    issues.push({
      code: 'official_url_in_ticket_url',
      field: 'ticketUrl',
      message: 'ticketUrl must not be an official event page URL',
    });
  }
  if (event.priceText && ADD_ON_PRICE.test(event.priceText)) {
    issues.push({
      code: 'add_on_used_as_admission_price',
      field: 'priceText',
      message: 'priceText must not describe add-ons or insurance',
    });
  }
  if (event.priceText?.trim() && /^(?:0[,.]00|0)\s*(?:€|eur)?$/i.test(event.priceText.trim())) {
    const hasVerifiedFree =
      event.ticketPhases?.some((phase) => phase.isFree === true) ||
      event.ticketStatus === 'free';
    if (!hasVerifiedFree) {
      issues.push({
        code: 'zero_price_without_free_evidence',
        field: 'priceText',
        message: 'zero admission price requires verified free ticket evidence',
      });
    }
  }
  for (const name of event.lineup ?? []) {
    if (HTML_OR_NAV.test(name)) {
      issues.push({
        code: 'invalid_lineup_value',
        field: 'lineup',
        message: `lineup contains invalid value: ${name}`,
      });
    }
  }
  for (const genre of event.genreLabels ?? []) {
    if (/venue|organizer|bootshaus|köln|koeln/i.test(genre)) {
      issues.push({
        code: 'venue_or_organizer_as_genre',
        field: 'genreLabels',
        message: `genre must not mirror venue or organizer: ${genre}`,
      });
    }
  }

  return issues;
}

export function isConsumerReadySourceEvent(
  event: SourceEvent,
  issues: SourceEventValidationIssue[],
): boolean {
  if (issues.length > 0) return false;
  return Boolean(
    event.title?.trim() &&
      event.startDate?.trim() &&
      event.venueName?.trim() &&
      event.venueCity?.trim() &&
      (event.websiteUrl?.trim() || event.ticketUrl?.trim()) &&
      event.verifiedAt?.trim(),
  );
}
