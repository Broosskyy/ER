export type RawSourceType =
  | 'json_ld'
  | 'rss'
  | 'atom'
  | 'ical'
  | 'csv'
  | 'api_json'
  | 'unknown';

export interface NormalizedEventCandidate {
  externalId: string;
  sourceUrl?: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  timezone?: string;
  isAllDay?: boolean;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  countryCode?: string;
  latitude?: number;
  longitude?: number;
  artistNames?: string[];
  genreNames?: string[];
  ticketUrl?: string;
  eventUrl?: string;
  imageUrl?: string;
  minimumAge?: number;
  doorsOpenAt?: string;
  organizerName?: string;
  subtitle?: string;
  importId?: string;
  originalLink?: string;
  priceAmount?: number;
  priceCurrency?: string;
  priceText?: string;
  imageUrls?: string[];
  sourceId?: string;
  sourceName?: string;
  rawSourceType: RawSourceType;
  sourceMetadata?: Record<string, unknown>;
}
