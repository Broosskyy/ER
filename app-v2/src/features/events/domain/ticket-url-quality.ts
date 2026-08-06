import {
  extractTicketIoEventSlug,
  extractTicketIoShopSlug,
  isTicketIoUrl,
  normalizeTicketIoEventUrl,
} from '@/features/aggregation/connectors/ticket-platform/ticket-io-url';
import { hasMeaningfulEventValue, meaningfulEventText } from '@/features/events/domain/event-field-value';

export type TicketUrlClass =
  | 'event_specific'
  | 'event_info_page'
  | 'shop_root'
  | 'platform_root'
  | 'invalid'
  | 'stale'
  | 'conflicting';

/** Club/venue marketing pages — not ticket checkout destinations. */
const TICKET_COMMERCE_HOST_PATTERNS = [
  /\.ticket\.io$/i,
  /ticketkings\.de$/i,
  /eventim\./i,
  /reservix\./i,
  /dice\.fm$/i,
  /rausgegangen\.de$/i,
  /shotgun\.live$/i,
];

function isTicketCommerceHost(host: string): boolean {
  return TICKET_COMMERCE_HOST_PATTERNS.some((pattern) => pattern.test(host));
}

export interface TicketUrlClassification {
  class: TicketUrlClass;
  score: number;
  normalized?: string;
  host?: string;
  reason: string;
}

export type TicketUrlResolutionDecision =
  | 'kept_existing'
  | 'accepted_incoming'
  | 'filled_empty'
  | 'rejected_incoming';

export interface TicketUrlResolution {
  selected: string | undefined;
  decision: TicketUrlResolutionDecision;
  existing: TicketUrlClassification;
  incoming: TicketUrlClassification;
  reason: string;
}

const PLATFORM_ROOT_HOSTS = new Set(['ticket.io', 'www.ticket.io']);

const EVENT_PATH_PATTERNS = [
  /\/event\//i,
  /\/events\/[^/]+/i,
  /ticketkings\.de\/event\//i,
  /rausgegangen\.de\/events\//i,
  /eventim\./i,
  /reservix\./i,
];

function normalizeComparableUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = '';
    const pathname = parsed.pathname.replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname === '/' ? '/' : pathname}`;
  } catch {
    return undefined;
  }
}

function isRootLikePath(pathname: string): boolean {
  const trimmed = pathname.replace(/\/+$/, '');
  return trimmed === '' || trimmed === '/';
}

export function classifyTicketUrl(url: string | undefined | null): TicketUrlClassification {
  const text = meaningfulEventText(url);
  if (!text) {
    return { class: 'invalid', score: 0, reason: 'empty_or_placeholder' };
  }

  if (/\/search/i.test(text) || /[?&]q=/i.test(text)) {
    return {
      class: 'invalid',
      score: 5,
      normalized: normalizeComparableUrl(text),
      reason: 'search_page_not_event',
    };
  }

  if (isTicketIoUrl(text)) {
    const eventSlug = extractTicketIoEventSlug(text);
    if (eventSlug) {
      return {
        class: 'event_specific',
        score: 100,
        normalized: normalizeTicketIoEventUrl(text),
        host: extractTicketIoShopSlug(text) ?? undefined,
        reason: 'ticket_io_event_page',
      };
    }
    const shopSlug = extractTicketIoShopSlug(text);
    if (shopSlug) {
      return {
        class: 'shop_root',
        score: 20,
        normalized: `https://${shopSlug}.ticket.io/`,
        host: shopSlug,
        reason: 'ticket_io_shop_root',
      };
    }
    return {
      class: 'platform_root',
      score: 10,
      normalized: normalizeComparableUrl(text),
      reason: 'ticket_io_platform_root',
    };
  }

  try {
    const parsed = new URL(text.startsWith('http') ? text : `https://${text}`);
    const host = parsed.hostname.toLowerCase();
    if (PLATFORM_ROOT_HOSTS.has(host) && isRootLikePath(parsed.pathname)) {
      return {
        class: 'platform_root',
        score: 10,
        normalized: normalizeComparableUrl(text),
        host,
        reason: 'platform_homepage',
      };
    }
    if (isRootLikePath(parsed.pathname)) {
      return {
        class: 'shop_root',
        score: 15,
        normalized: normalizeComparableUrl(text),
        host,
        reason: 'site_homepage',
      };
    }
    if (!isTicketCommerceHost(host) && EVENT_PATH_PATTERNS.some((pattern) => pattern.test(text))) {
      return {
        class: 'event_info_page',
        score: 12,
        normalized: normalizeComparableUrl(text),
        host,
        reason: 'official_website_event_page_not_checkout',
      };
    }
    if (EVENT_PATH_PATTERNS.some((pattern) => pattern.test(text))) {
      return {
        class: 'event_specific',
        score: 80,
        normalized: normalizeComparableUrl(text),
        host,
        reason: 'official_event_page',
      };
    }
    if (parsed.pathname.split('/').filter(Boolean).length >= 1) {
      return {
        class: 'event_specific',
        score: 70,
        normalized: normalizeComparableUrl(text),
        host,
        reason: 'path_with_event_segment',
      };
    }
  } catch {
    return { class: 'invalid', score: 0, reason: 'unparseable_url' };
  }

  return { class: 'invalid', score: 0, reason: 'unclassified' };
}

export function isGenericTicketUrl(url: string | undefined | null): boolean {
  const classification = classifyTicketUrl(url);
  return classification.class === 'shop_root' || classification.class === 'platform_root';
}

export function isEventSpecificTicketUrl(url: string | undefined | null): boolean {
  return classifyTicketUrl(url).class === 'event_specific';
}

export function resolveBetterTicketUrl(
  existing: string | undefined | null,
  incoming: string | undefined | null,
): TicketUrlResolution {
  const existingClass = classifyTicketUrl(existing);
  const incomingClass = classifyTicketUrl(incoming);

  if (!hasMeaningfulEventValue(incoming)) {
    return {
      selected: meaningfulEventText(existing),
      decision: 'kept_existing',
      existing: existingClass,
      incoming: incomingClass,
      reason: 'incoming_empty',
    };
  }

  if (!hasMeaningfulEventValue(existing)) {
    return {
      selected: meaningfulEventText(incoming),
      decision: 'filled_empty',
      existing: existingClass,
      incoming: incomingClass,
      reason: 'filled_missing_canonical',
    };
  }

  if (incomingClass.score > existingClass.score) {
    return {
      selected: incomingClass.normalized ?? meaningfulEventText(incoming),
      decision: 'accepted_incoming',
      existing: existingClass,
      incoming: incomingClass,
      reason: 'incoming_higher_quality',
    };
  }

  if (incomingClass.score < existingClass.score) {
    return {
      selected: meaningfulEventText(existing),
      decision: 'kept_existing',
      existing: existingClass,
      incoming: incomingClass,
      reason: 'incoming_lower_quality',
    };
  }

  const existingNormalized = existingClass.normalized ?? normalizeComparableUrl(existing!);
  const incomingNormalized = incomingClass.normalized ?? normalizeComparableUrl(incoming!);
  if (existingNormalized && incomingNormalized && existingNormalized === incomingNormalized) {
    return {
      selected: meaningfulEventText(existing),
      decision: 'kept_existing',
      existing: existingClass,
      incoming: incomingClass,
      reason: 'equivalent_urls',
    };
  }

  return {
    selected: meaningfulEventText(existing),
    decision: 'kept_existing',
    existing: existingClass,
    incoming: incomingClass,
    reason: 'preserve_existing_on_tie',
  };
}

export function pickBestTicketUrl(candidates: Array<string | undefined | null>): string | undefined {
  const scored = candidates
    .map((candidate) => {
      const text = meaningfulEventText(candidate);
      if (!text) {
        return undefined;
      }
      return { url: text, ...classifyTicketUrl(text) };
    })
    .filter((entry): entry is { url: string; class: TicketUrlClass; score: number; normalized?: string; reason: string } =>
      Boolean(entry),
    );

  const nonGeneric = scored.filter(
    (entry) => entry.class !== 'shop_root' && entry.class !== 'platform_root',
  );
  const pool = nonGeneric.length > 0 ? nonGeneric : scored;

  let best: string | undefined;
  let bestScore = -1;
  for (const entry of pool) {
    if (entry.score > bestScore) {
      best = entry.normalized ?? entry.url;
      bestScore = entry.score;
    }
  }
  return best;
}

/** True when a re-import should re-publish to upgrade canonical ticketUrl quality. */
export function eventNeedsTicketDestinationRepair(
  existingTicketUrl: string | undefined,
  incomingCandidates: Array<string | undefined | null>,
): boolean {
  const bestIncoming = pickBestTicketUrl(incomingCandidates);
  if (!bestIncoming) {
    return false;
  }
  if (!existingTicketUrl?.trim()) {
    return true;
  }
  return resolveBetterTicketUrl(existingTicketUrl, bestIncoming).decision === 'accepted_incoming';
}
