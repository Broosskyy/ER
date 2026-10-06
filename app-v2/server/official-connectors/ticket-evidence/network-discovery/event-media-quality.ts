import { classifyTicketIoMediaUrl } from './media-classifier';
import type { TicketIoMediaRole } from './types';

export type EventMediaAcceptability =
  | 'ACCEPTABLE_EVENT_MEDIA'
  | 'NO_EVENT_MEDIA'
  | 'REJECTED_NON_EVENT_MEDIA';

export interface EventMediaAcceptabilityResult {
  acceptability: EventMediaAcceptability;
  bestMediaUrl?: string;
  acceptedUrls: string[];
  rejectedUrls: string[];
  roles: TicketIoMediaRole[];
}

const EVENT_SPECIFIC_ROLES = new Set<TicketIoMediaRole>([
  'lineup_flyer',
  'event_flyer',
  'event_hero',
  'announcement_flyer',
]);

const ROLE_PRIORITY: Record<TicketIoMediaRole, number> = {
  lineup_flyer: 4,
  event_flyer: 3,
  event_hero: 3,
  announcement_flyer: 2,
  ticket_marketing: 0,
  multi_event_poster: 0,
  organizer_branding: 0,
  venue_branding: 0,
  generic_shop_image: 0,
  decorative: 0,
  unknown: 0,
};

export function classifyEventMediaAcceptability(
  urls: string[],
  context?: { title?: string },
): EventMediaAcceptabilityResult {
  const uniqueUrls = [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
  if (uniqueUrls.length === 0) {
    return {
      acceptability: 'NO_EVENT_MEDIA',
      acceptedUrls: [],
      rejectedUrls: [],
      roles: [],
    };
  }

  const classified = uniqueUrls.map((url) => ({
    url,
    role: classifyTicketIoMediaUrl(url, context),
  }));
  const accepted = classified
    .filter((entry) => EVENT_SPECIFIC_ROLES.has(entry.role))
    .sort((left, right) => ROLE_PRIORITY[right.role] - ROLE_PRIORITY[left.role]);

  return {
    acceptability: accepted.length > 0 ? 'ACCEPTABLE_EVENT_MEDIA' : 'REJECTED_NON_EVENT_MEDIA',
    bestMediaUrl: accepted[0]?.url,
    acceptedUrls: accepted.map((entry) => entry.url),
    rejectedUrls: classified
      .filter((entry) => !EVENT_SPECIFIC_ROLES.has(entry.role))
      .map((entry) => entry.url),
    roles: classified.map((entry) => entry.role),
  };
}
