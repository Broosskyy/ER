import { parseTicketIoVisibleEventMetadata } from '../ticket-evidence/parse-ticketio-visible-event-metadata';

/** A provider rejecting checkout evidence must not erase independently
 * published event details from the same, approved, event-specific URL.
 * This function NEVER verifies a ticket link, sale status or price. */
export function readTicketIoOfficialCore(
  html: string,
  provider: {
    rawTitle?: string;
    startAt?: string;
    venueName?: string;
    cityName?: string;
    venueAddress?: string;
    description?: string;
  },
): {
  title: string;
  startsAt: string;
  venueName: string;
  cityName: string;
  venueAddress?: string;
  descriptionClean?: string;
  sourceTitleFound: boolean;
  sourceDateFound: boolean;
  sourceVenueFound: boolean;
} {
  const source = parseTicketIoVisibleEventMetadata(html);
  return {
    title: provider.rawTitle?.trim() || source.title || '',
    startsAt: provider.startAt || source.startsAt || '',
    venueName: provider.venueName?.trim() || source.venueName || '',
    cityName: provider.cityName?.trim() || source.cityName || '',
    venueAddress: provider.venueAddress || source.venueAddress,
    descriptionClean: provider.description || source.descriptionClean,
    sourceTitleFound: !!source.title,
    sourceDateFound: !!source.startsAt,
    sourceVenueFound: !!(source.venueName && source.cityName),
  };
}
