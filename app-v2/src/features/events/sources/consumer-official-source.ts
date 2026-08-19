import type { EventDetail, EventTicket } from '@/features/events/types/event-core';
import {
  classifyUrlKind,
  handlesMatchExactly,
  isHttpsUrl,
  isTicketProviderUrl,
  officialEventSourceLabel,
  officialSocialPostSourceLabel,
  organizerWebsiteLabel,
  socialProfileLabel,
} from './source-url-roles';

export interface ConsumerVisibleSourceLink {
  role: 'official_event' | 'official_social_post';
  label: string;
  url: string;
}

export interface ConsumerVisibleProfileLink {
  role: 'organizer_website' | 'organizer_social' | 'venue_website' | 'venue_social';
  label: string;
  url: string;
}

export interface VerifiedOfficialAccount {
  handle: string;
  verified: true;
}

export interface VerifiedSocialEventSource {
  url: string;
  accountHandle: string;
  verifiedAccount: true;
  expectedTitle: string;
  expectedVenueName?: string;
  expectedStartDate?: string;
}

export interface ConsumerOfficialSourceProjection {
  eventSourceUrl?: string;
  officialEventUrl?: string;
  organizerSocialUrl?: string;
  venueSocialUrl?: string;
  organizerWebsiteUrl?: string;
  ticketUrl?: string;
  sourceImageUrl?: string;
  officialSourceMissing: boolean;
  officialSourceMissingReason?:
    | 'official_source_missing'
    | 'ticket_url_used_as_official_source'
    | 'generic_homepage'
    | 'generic_social_profile'
    | 'social_post_unverified'
    | 'social_source_wrong_event';
  visibleLinks: ConsumerVisibleSourceLink[];
  organizerLinks: ConsumerVisibleProfileLink[];
  venueLinks: ConsumerVisibleProfileLink[];
  heading: 'Quelle' | 'Quellen';
  sourceLabel: string;
}

function normalizeIdentity(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function identityMatches(expected: string | undefined, actual: string | null | undefined): boolean {
  const left = normalizeIdentity(expected);
  const right = normalizeIdentity(actual);
  return Boolean(left && right && left === right);
}

function dateMatches(expected: string | undefined, actual: string | null | undefined): boolean {
  if (!expected) {
    return false;
  }
  if (!actual) {
    return false;
  }
  return actual.slice(0, 10) === expected.slice(0, 10);
}

function isVerifiedSocialPost(
  url: string,
  input: {
    verifiedOfficialAccounts?: VerifiedOfficialAccount[];
    verifiedSocialEventSources?: VerifiedSocialEventSource[];
    eventTitle?: string | null;
    venueName?: string | null;
    startsAt?: string | null;
  },
): { ok: true } | { ok: false; reason: NonNullable<ConsumerOfficialSourceProjection['officialSourceMissingReason']> } {
  const binding = input.verifiedSocialEventSources?.find((source) => source.url === url);
  if (!binding || binding.verifiedAccount !== true) {
    return { ok: false, reason: 'social_post_unverified' };
  }
  const account = input.verifiedOfficialAccounts?.find(
    (entry) => entry.verified === true && handlesMatchExactly(entry.handle, binding.accountHandle),
  );
  if (!account) {
    return { ok: false, reason: 'social_post_unverified' };
  }
  if (!handlesMatchExactly(binding.accountHandle, account.handle)) {
    return { ok: false, reason: 'social_post_unverified' };
  }
  if (!identityMatches(binding.expectedTitle, input.eventTitle)) {
    return { ok: false, reason: 'social_source_wrong_event' };
  }
  if (binding.expectedVenueName && !identityMatches(binding.expectedVenueName, input.venueName)) {
    return { ok: false, reason: 'social_source_wrong_event' };
  }
  if (binding.expectedStartDate && !dateMatches(binding.expectedStartDate, input.startsAt)) {
    return { ok: false, reason: 'social_source_wrong_event' };
  }
  if (!binding.expectedStartDate) {
    return { ok: false, reason: 'social_post_unverified' };
  }
  return { ok: true };
}

function classifyOfficialEventUrl(
  candidate: string | null | undefined,
  input: {
    verifiedOfficialAccounts?: VerifiedOfficialAccount[];
    verifiedSocialEventSources?: VerifiedSocialEventSource[];
    eventTitle?: string | null;
    venueName?: string | null;
    startsAt?: string | null;
  },
): {
  url?: string;
  kind?: 'official_event' | 'official_social_post';
  missingReason?: ConsumerOfficialSourceProjection['officialSourceMissingReason'];
} {
  const kind = classifyUrlKind(candidate);
  if (!candidate || kind === 'unknown') {
    return { missingReason: 'official_source_missing' };
  }
  if (kind === 'ticket') {
    return { missingReason: 'ticket_url_used_as_official_source' };
  }
  if (kind === 'generic_homepage') {
    return { missingReason: 'generic_homepage' };
  }
  if (kind === 'social_profile') {
    return { missingReason: 'generic_social_profile' };
  }
  if (kind === 'social_post') {
    const verified = isVerifiedSocialPost(candidate, input);
    if (!verified.ok) {
      return { missingReason: verified.reason };
    }
    return { url: candidate, kind: 'official_social_post' };
  }
  return { url: candidate, kind: 'official_event' };
}

function pushUnique(links: ConsumerVisibleProfileLink[], link: ConsumerVisibleProfileLink) {
  if (links.some((existing) => existing.url === link.url)) {
    return;
  }
  links.push(link);
}

export function resolveConsumerOfficialSource(input: {
  officialUrl?: string | null;
  organizerName?: string | null;
  eventTitle?: string | null;
  startsAt?: string | null;
  imageUrl?: string | null;
  venueOfficialUrl?: string | null;
  venueName?: string | null;
  ticket?: EventTicket | null;
  purchaseTicketUrl?: string | null;
  verifiedOfficialAccounts?: VerifiedOfficialAccount[];
  verifiedSocialEventSources?: VerifiedSocialEventSource[];
  verifiedOrganizerWebsiteUrl?: string | null;
  verifiedOrganizerSocialUrls?: string[];
  verifiedVenueSocialUrls?: string[];
}): ConsumerOfficialSourceProjection {
  const classified = classifyOfficialEventUrl(input.officialUrl, input);
  const eventSourceUrl = classified.url;
  const officialEventUrl = classified.kind === 'official_event' ? classified.url : undefined;
  const officialSourceMissing = !eventSourceUrl;

  const ticketUrl = isHttpsUrl(input.purchaseTicketUrl)
    ? input.purchaseTicketUrl
    : isHttpsUrl(input.ticket?.ticketUrl)
      ? input.ticket.ticketUrl
      : undefined;

  const sourceImageUrl = isHttpsUrl(input.imageUrl) ? input.imageUrl : undefined;

  const visibleLinks: ConsumerVisibleSourceLink[] = [];
  if (eventSourceUrl && classified.kind === 'official_event') {
    visibleLinks.push({
      role: 'official_event',
      label: officialEventSourceLabel(eventSourceUrl, input.organizerName),
      url: eventSourceUrl,
    });
  }
  if (eventSourceUrl && classified.kind === 'official_social_post') {
    visibleLinks.push({
      role: 'official_social_post',
      label: officialSocialPostSourceLabel(eventSourceUrl, input.organizerName),
      url: eventSourceUrl,
    });
  }

  const organizerLinks: ConsumerVisibleProfileLink[] = [];
  const venueLinks: ConsumerVisibleProfileLink[] = [];

  const organizerWebsiteUrl =
    isHttpsUrl(input.verifiedOrganizerWebsiteUrl) &&
    classifyUrlKind(input.verifiedOrganizerWebsiteUrl) !== 'ticket' &&
    !isTicketProviderUrl(input.verifiedOrganizerWebsiteUrl)
      ? input.verifiedOrganizerWebsiteUrl
      : undefined;
  if (organizerWebsiteUrl && organizerWebsiteUrl !== eventSourceUrl) {
    pushUnique(organizerLinks, {
      role: 'organizer_website',
      label: organizerWebsiteLabel(),
      url: organizerWebsiteUrl,
    });
  }

  for (const url of input.verifiedOrganizerSocialUrls ?? []) {
    if (classifyUrlKind(url) !== 'social_profile') {
      continue;
    }
    pushUnique(organizerLinks, {
      role: 'organizer_social',
      label: socialProfileLabel(url),
      url,
    });
  }

  const venueOfficialKind = classifyUrlKind(input.venueOfficialUrl);
  if (
    input.venueOfficialUrl &&
    venueOfficialKind === 'generic_homepage' &&
    input.venueOfficialUrl !== eventSourceUrl &&
    input.venueOfficialUrl !== organizerWebsiteUrl
  ) {
    pushUnique(venueLinks, {
      role: 'venue_website',
      label: organizerWebsiteLabel(),
      url: input.venueOfficialUrl,
    });
  }

  for (const url of input.verifiedVenueSocialUrls ?? []) {
    if (classifyUrlKind(url) !== 'social_profile') {
      continue;
    }
    pushUnique(venueLinks, {
      role: 'venue_social',
      label: socialProfileLabel(url),
      url,
    });
  }

  const organizerSocialUrl = organizerLinks.find((link) => link.role === 'organizer_social')?.url;
  const venueSocialUrl = venueLinks.find((link) => link.role === 'venue_social')?.url;

  return {
    eventSourceUrl,
    officialEventUrl,
    organizerSocialUrl,
    venueSocialUrl,
    organizerWebsiteUrl,
    ticketUrl,
    sourceImageUrl,
    officialSourceMissing,
    officialSourceMissingReason: officialSourceMissing ? classified.missingReason : undefined,
    visibleLinks,
    organizerLinks,
    venueLinks,
    heading: visibleLinks.length > 1 ? 'Quellen' : 'Quelle',
    sourceLabel: visibleLinks[0]?.label ?? '',
  };
}

export function resolveConsumerOfficialSourceFromDetail(
  detail: Pick<
    EventDetail,
    'officialUrl' | 'organizerName' | 'imageUrl' | 'venue' | 'primaryTicket' | 'title' | 'startsAt'
  >,
  purchaseTicketUrl?: string | null,
): ConsumerOfficialSourceProjection {
  return resolveConsumerOfficialSource({
    officialUrl: detail.officialUrl,
    organizerName: detail.organizerName,
    eventTitle: detail.title,
    startsAt: detail.startsAt,
    imageUrl: detail.imageUrl,
    venueOfficialUrl: detail.venue?.officialUrl,
    venueName: detail.venue?.name,
    ticket: detail.primaryTicket,
    purchaseTicketUrl,
  });
}
