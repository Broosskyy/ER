import {
  extractTicketIoEventSlug,
  isTicketIoShopRootUrl,
  normalizeTicketIoEventUrl,
  ticketIoEventUrlsEquivalent,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { buildTicketPlatformCompositeIdentity } from '@/features/import/ticket-platform-identity';
import type { KnownEventForDuplicateCheck } from '@/features/import/matching/match-result';

export function isEventSpecificTicketIoUrl(url: string | undefined): boolean {
  if (!url?.trim()) {
    return false;
  }
  if (isTicketIoShopRootUrl(url)) {
    return false;
  }
  return Boolean(extractTicketIoEventSlug(url));
}

export function extractTicketIoHost(url: string): string | undefined {
  try {
    return new URL(url.startsWith('http') ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function resolveEnrichmentTargetByTicketIoUrl(
  ticketUrl: string,
  events: KnownEventForDuplicateCheck[],
): KnownEventForDuplicateCheck | undefined {
  if (!isEventSpecificTicketIoUrl(ticketUrl)) {
    return undefined;
  }
  const normalized = normalizeTicketIoEventUrl(ticketUrl);
  const matches = events.filter((event) => {
    if (!event.ticketUrl) {
      return false;
    }
    return ticketIoEventUrlsEquivalent(event.ticketUrl, normalized);
  });
  if (matches.length === 1) {
    return matches[0];
  }
  return undefined;
}

export function findSlugCollisions(
  events: Array<{ id: string; ticketUrl?: string }>,
): Map<string, string[]> {
  const byComposite = new Map<string, string[]>();
  for (const event of events) {
    if (!event.ticketUrl || !isEventSpecificTicketIoUrl(event.ticketUrl)) {
      continue;
    }
    const identity = buildTicketPlatformCompositeIdentity(event.ticketUrl);
    if (!identity) {
      continue;
    }
    const list = byComposite.get(identity.compositeKey) ?? [];
    list.push(event.id);
    byComposite.set(identity.compositeKey, list);
  }
  const collisions = new Map<string, string[]>();
  for (const [compositeKey, ids] of byComposite) {
    if (ids.length > 1) {
      const slug = compositeKey.split(':').pop() ?? compositeKey;
      collisions.set(slug, ids);
    }
  }
  return collisions;
}
