import { createHash } from 'node:crypto';

import {
  extractTicketIoEventSlug,
  extractTicketIoShopSlug,
  normalizeTicketIoEventUrl,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';

import type {
  CompositeIdentityCollision,
  EventIdentitySnapshot,
  TicketPlatformCompositeIdentity,
  TicketPlatformKind,
} from './types';

function normalizeHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '');
}

function extractTicketKingsEventSlug(pathname: string): string | undefined {
  const match = pathname.match(/\/event\/([^/]+)/i);
  return match?.[1]?.replace(/\/+$/, '');
}

function extractNachtManagerCheckoutId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (!/nacht-manager\.de$/i.test(parsed.hostname)) {
      return undefined;
    }
    const id = parsed.searchParams.get('id');
    return id?.trim() || undefined;
  } catch {
    return undefined;
  }
}

export function buildTicketPlatformCompositeIdentity(
  ticketUrl: string | undefined,
): TicketPlatformCompositeIdentity | undefined {
  if (!ticketUrl?.trim()) {
    return undefined;
  }

  const ticketIoNormalized = normalizeTicketIoEventUrl(ticketUrl);
  const ticketIoSlug = extractTicketIoEventSlug(ticketUrl);
  const shopSlug = extractTicketIoShopSlug(ticketUrl);
  if (ticketIoSlug && shopSlug) {
    const host = `${shopSlug}.ticket.io`;
    const normalizedUrl = ticketIoNormalized ?? ticketUrl.trim();
    return {
      platform: 'ticket_io',
      host,
      externalId: ticketIoSlug,
      normalizedUrl,
      compositeKey: `ticket_io:${host}:${ticketIoSlug}`,
    };
  }

  try {
    const parsed = new URL(ticketUrl.trim());
    const host = normalizeHost(parsed.hostname);

    if (/ticketkings\.de$/i.test(host)) {
      const externalId = extractTicketKingsEventSlug(parsed.pathname);
      if (!externalId) {
        return undefined;
      }
      const normalizedUrl = `${parsed.protocol}//${host}${parsed.pathname.replace(/\/+$/, '')}/`;
      return {
        platform: 'ticket_king',
        host,
        externalId,
        normalizedUrl,
        compositeKey: `ticket_king:${host}:${externalId}`,
      };
    }

    const checkoutId = extractNachtManagerCheckoutId(ticketUrl);
    if (checkoutId) {
      const normalizedUrl = `https://${host}${parsed.pathname}?id=${checkoutId}`;
      return {
        platform: 'nacht_manager',
        host,
        externalId: checkoutId,
        normalizedUrl,
        compositeKey: `nacht_manager:${host}:${checkoutId}`,
      };
    }
  } catch {
    return undefined;
  }

  return undefined;
}

export function findCompositeIdentityCollisions(
  events: EventIdentitySnapshot[],
): CompositeIdentityCollision[] {
  const byKey = new Map<string, EventIdentitySnapshot[]>();

  for (const event of events) {
    const identity = buildTicketPlatformCompositeIdentity(event.ticketUrl);
    if (!identity) {
      continue;
    }
    const list = byKey.get(identity.compositeKey) ?? [];
    list.push(event);
    byKey.set(identity.compositeKey, list);
  }

  const collisions: CompositeIdentityCollision[] = [];
  for (const [compositeKey, group] of byKey) {
    if (group.length <= 1) {
      continue;
    }
    const [first] = group;
    if (!first) {
      continue;
    }
    const identity = buildTicketPlatformCompositeIdentity(first.ticketUrl)!;
    const uniqueTitles = [...new Set(group.map((e) => e.title.trim()))];
    collisions.push({
      compositeKey,
      platform: identity.platform,
      host: identity.host,
      externalId: identity.externalId,
      eventIds: group.map((e) => e.eventId),
      titles: uniqueTitles,
      collisionType:
        uniqueTitles.length === 1 ? 'stale_alias' : 'exact_duplicate',
    });
  }

  return collisions.sort((a, b) => a.compositeKey.localeCompare(b.compositeKey));
}

export function findSlugOnlyCollisionsAcrossHosts(
  events: EventIdentitySnapshot[],
): Array<{ slug: string; entries: Array<{ eventId: string; host: string; title: string }> }> {
  const bySlug = new Map<string, Array<{ eventId: string; host: string; title: string }>>();
  for (const event of events) {
    const identity = buildTicketPlatformCompositeIdentity(event.ticketUrl);
    if (!identity || identity.platform !== 'ticket_io') {
      continue;
    }
    const list = bySlug.get(identity.externalId) ?? [];
    list.push({ eventId: event.eventId, host: identity.host, title: event.title });
    bySlug.set(identity.externalId, list);
  }

  return [...bySlug.entries()]
    .filter(([, entries]) => {
      const hosts = new Set(entries.map((e) => e.host));
      return entries.length > 1 && hosts.size > 1;
    })
    .map(([slug, entries]) => ({ slug, entries }));
}

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function compositeKeysEqual(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

export function isSamePlatformHostSlug(
  leftUrl: string | undefined,
  rightUrl: string | undefined,
): boolean {
  const left = buildTicketPlatformCompositeIdentity(leftUrl);
  const right = buildTicketPlatformCompositeIdentity(rightUrl);
  return Boolean(left && right && left.compositeKey === right.compositeKey);
}

export function platformKindFromUrl(url: string): TicketPlatformKind {
  return buildTicketPlatformCompositeIdentity(url)?.platform ?? 'unknown';
}
