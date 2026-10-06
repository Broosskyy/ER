export type EventLineupBillingRole = 'artist' | 'headliner' | 'compound_act';

export interface EventVenue {
  id: string;
  name: string;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  countryCode: string | null;
  latitude: number | null;
  longitude: number | null;
  officialUrl: string | null;
}

export interface EventLineupAct {
  id: string;
  billingName: string;
  billingRole: EventLineupBillingRole;
  sortOrder: number;
}

export interface EventGenre {
  id: string;
  genreKey: string;
  displayName: string;
  sortOrder: number;
}

export interface EventTicket {
  id: string;
  provider: string | null;
  ticketUrl: string | null;
  priceFromMinor: number | null;
  currency: string | null;
  salesStatus: string | null;
  sortOrder: number;
}

export interface EventSummary {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  timezone: string | null;
  imageUrl: string | null;
  officialUrl: string | null;
  organizerName: string | null;
  venue: EventVenue | null;
  genres: EventGenre[];
  primaryTicket: EventTicket | null;
}

export interface EventDetail extends EventSummary {
  description: string | null;
  officialUrl: string | null;
  publishedAt: string | null;
  lineup: EventLineupAct[];
  tickets: EventTicket[];
}
