/**
 * Type-specific endpoint configuration (declarative metadata only).
 * No HTTP, parsing, or runtime behaviour in ER-014 Part 1.
 */

export interface WebsiteEndpointConfig {
  /** Optional override for User-Agent header (future HTTP layer). */
  userAgent?: string;
  followRedirects?: boolean;
  maxRedirects?: number;
  acceptedContentTypes?: string[];
  /** Placeholder for future JavaScript rendering requirement. */
  requiresJavaScriptRendering?: boolean;
}

export interface RssEndpointConfig {
  feedPath?: string;
  acceptedContentTypes?: string[];
}

export interface ApiEndpointConfig {
  path?: string;
  method?: 'GET' | 'POST';
  acceptedContentTypes?: string[];
}

export interface IcalEndpointConfig {
  calendarPath?: string;
}

export interface TicketPlatformEndpointConfig {
  platformId?: string;
  venueScope?: string;
}

export interface SocialEndpointConfig {
  profileUrl?: string;
  platform?: string;
}

export interface WebhookEndpointConfig {
  secretHeaderName?: string;
}

export interface UnknownEndpointConfig {
  notes?: string;
}

export type EndpointTypeConfig =
  | { type: 'website'; website: WebsiteEndpointConfig }
  | { type: 'rss'; rss: RssEndpointConfig }
  | { type: 'api'; api: ApiEndpointConfig }
  | { type: 'ical'; ical: IcalEndpointConfig }
  | { type: 'ticket_platform'; ticketPlatform: TicketPlatformEndpointConfig }
  | { type: 'social'; social: SocialEndpointConfig }
  | { type: 'webhook'; webhook: WebhookEndpointConfig }
  | { type: 'unknown'; unknown: UnknownEndpointConfig };

export function createEmptyEndpointConfig(
  type: EndpointTypeConfig['type'],
): EndpointTypeConfig {
  switch (type) {
    case 'website':
      return { type: 'website', website: {} };
    case 'rss':
      return { type: 'rss', rss: {} };
    case 'api':
      return { type: 'api', api: {} };
    case 'ical':
      return { type: 'ical', ical: {} };
    case 'ticket_platform':
      return { type: 'ticket_platform', ticketPlatform: {} };
    case 'social':
      return { type: 'social', social: {} };
    case 'webhook':
      return { type: 'webhook', webhook: {} };
    default:
      return { type: 'unknown', unknown: {} };
  }
}
