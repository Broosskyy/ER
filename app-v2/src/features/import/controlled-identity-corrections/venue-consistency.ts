export interface VenueConsistencyDiagnostic {
  consistent: boolean;
  issue?: 'venue_name_address_mismatch' | 'organizer_as_venue' | 'shop_host_as_venue';
  reason: string;
}

export function diagnoseVenueConsistency(input: {
  venueName?: string;
  venueAddress?: string;
  organizerName?: string;
  ticketShopHost?: string;
}): VenueConsistencyDiagnostic {
  const name = input.venueName?.trim().toLowerCase() ?? '';
  const address = input.venueAddress?.trim().toLowerCase() ?? '';

  if (name.includes('essigfabrik') && address.includes('auenweg 173')) {
    return {
      consistent: false,
      issue: 'venue_name_address_mismatch',
      reason: 'Essigfabrik label with Bootshaus Auenweg 173 address',
    };
  }

  if (name.includes('bootshaus') && address.includes('lichtstraße')) {
    return {
      consistent: false,
      issue: 'venue_name_address_mismatch',
      reason: 'Bootshaus label with Essigfabrik Lichtstraße address',
    };
  }

  if (
    input.organizerName &&
    input.venueName &&
    input.organizerName.trim().toLowerCase() === input.venueName.trim().toLowerCase() &&
    !name.includes('club')
  ) {
    return {
      consistent: false,
      issue: 'organizer_as_venue',
      reason: 'Organizer name equals venue without explicit venue evidence',
    };
  }

  if (
    input.ticketShopHost &&
    input.venueName &&
    input.venueName.toLowerCase().includes(input.ticketShopHost.replace('.ticket.io', ''))
  ) {
    return {
      consistent: false,
      issue: 'shop_host_as_venue',
      reason: 'Ticket shop host used as venue name',
    };
  }

  return { consistent: true, reason: 'ok' };
}
