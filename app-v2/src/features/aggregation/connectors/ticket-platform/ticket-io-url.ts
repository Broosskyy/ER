const TICKET_IO_URL_PATTERN =
  /^(?:https?:\/\/)?([a-z0-9][a-z0-9-]*)\.ticket\.io(?:\/[^\s?#]*)?(?:\?[^\s#]*)?(?:#[^\s]*)?$/i;

const TICKET_IO_EMBEDDED_PATTERN =
  /https?:\/\/([a-z0-9][a-z0-9-]*)\.ticket\.io(?:\/[^\s"'<>]*)?/gi;

export const IGNORED_TICKET_IO_SHOP_SLUGS = new Set(['www', 'cdn', 'api', 'help', 'support']);

export interface ParsedTicketIoUrl {
  shopSlug: string;
  listUrl: string;
  normalizedUrl: string;
  externalShopId: string;
}

export function isTicketIoUrl(input: string): boolean {
  return extractTicketIoShopSlug(input) !== null;
}

export function extractTicketIoShopSlug(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) {
    return null;
  }

  if (/^[a-z0-9][a-z0-9-]*$/i.test(trimmed)) {
    const slug = trimmed.toLowerCase();
    return IGNORED_TICKET_IO_SHOP_SLUGS.has(slug) ? null : slug;
  }

  const direct = trimmed.match(TICKET_IO_URL_PATTERN);
  if (direct?.[1]) {
    const slug = direct[1].toLowerCase();
    return IGNORED_TICKET_IO_SHOP_SLUGS.has(slug) ? null : slug;
  }

  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    const hostMatch = url.hostname.match(/^([a-z0-9][a-z0-9-]*)\.ticket\.io$/i);
    if (!hostMatch?.[1]) {
      return null;
    }
    const slug = hostMatch[1].toLowerCase();
    return IGNORED_TICKET_IO_SHOP_SLUGS.has(slug) ? null : slug;
  } catch {
    return null;
  }
}

export function normalizeTicketIoListUrl(input: string): string {
  const slug = extractTicketIoShopSlug(input);
  if (!slug) {
    throw new Error(`Invalid ticket.io shop URL: ${input}`);
  }
  return `https://${slug}.ticket.io/`;
}

export function parseTicketIoUrl(input: string): ParsedTicketIoUrl | null {
  const shopSlug = extractTicketIoShopSlug(input);
  if (!shopSlug) {
    return null;
  }
  const listUrl = normalizeTicketIoListUrl(shopSlug);
  return {
    shopSlug,
    listUrl,
    normalizedUrl: listUrl,
    externalShopId: shopSlug,
  };
}

export function buildTicketIoSourceId(shopSlug: string): string {
  const slug = shopSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return `source-ticket-io-${slug}`;
}

export function buildTicketIoSourceSlug(shopSlug: string): string {
  const slug = shopSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
  return `ticket-io-${slug}`;
}

export function buildTicketIoStableKey(shopSlug: string): string {
  return `ticket-io-${shopSlug.trim().toLowerCase()}-v1`;
}

export function extractTicketIoShopSlugsFromText(corpus: string): string[] {
  const slugs = new Set<string>();
  let match: RegExpExecArray | null;
  const pattern = new RegExp(TICKET_IO_EMBEDDED_PATTERN.source, 'gi');
  while ((match = pattern.exec(corpus)) !== null) {
    const slug = (match[1] ?? '').toLowerCase();
    if (!slug || IGNORED_TICKET_IO_SHOP_SLUGS.has(slug)) {
      continue;
    }
    slugs.add(slug);
  }
  return [...slugs];
}

export function ticketIoUrlsEquivalent(left: string, right: string): boolean {
  const leftSlug = extractTicketIoShopSlug(left);
  const rightSlug = extractTicketIoShopSlug(right);
  return Boolean(leftSlug && rightSlug && leftSlug === rightSlug);
}

export function normalizeTicketIoEventUrl(url: string): string {
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    parsed.hash = '';
    const pathname = parsed.pathname.endsWith('/') ? parsed.pathname : `${parsed.pathname}/`;
    return `${parsed.protocol}//${parsed.hostname}${pathname}`;
  } catch {
    return trimmed.replace(/\/?$/, '/');
  }
}

export function isTicketIoShopRootUrl(url: string): boolean {
  const shopSlug = extractTicketIoShopSlug(url);
  if (!shopSlug) {
    return false;
  }
  const eventSlug = extractTicketIoEventSlug(url);
  return !eventSlug;
}

export function extractTicketIoEventSlug(url: string): string | undefined {
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const segments = parsed.pathname.split('/').filter(Boolean);
    const slug = segments[0];
    return slug && /^[A-Za-z0-9]{6,12}$/.test(slug) ? slug : undefined;
  } catch {
    const match = url.match(/\/([A-Za-z0-9]{6,12})\/?(?:\?|#|$)/);
    return match?.[1];
  }
}

export function normalizeTicketIoListAnchorUrl(anchorHref: string, shopRootUrl?: string): string | undefined {
  const trimmed = anchorHref.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    if (shopRootUrl?.trim()) {
      return new URL(trimmed, shopRootUrl).href;
    }
    return new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`).href;
  } catch {
    return undefined;
  }
}

export function buildShopRootEventUrl(shopRootUrl: string, eventSlug: string): string | undefined {
  return normalizeTicketIoListAnchorUrl(`/${eventSlug}/`, shopRootUrl);
}

export function ticketIoUrlsShareEventSlug(left: string, right: string, eventSlug: string): boolean {
  return (
    extractTicketIoEventSlug(left) === eventSlug && extractTicketIoEventSlug(right) === eventSlug
  );
}

export interface TicketIoEventUrlAliasProof {
  valid: boolean;
  eventSlug: string;
  linkedEventUrl?: string;
  redirectFinalUrl?: string;
}

export function validateTicketIoEventUrl(input: {
  ticketUrl: string;
  shopSlug: string;
  title?: string;
  eventSlug?: string;
  aliasProof?: TicketIoEventUrlAliasProof;
}): { valid: boolean; reason?: string } {
  const shopSlug = extractTicketIoShopSlug(input.shopSlug) ?? input.shopSlug;
  const ticketShopSlug = extractTicketIoShopSlug(input.ticketUrl);
  if (!ticketShopSlug) {
    return { valid: false, reason: 'not_ticket_io_url' };
  }

  const slug = input.eventSlug ?? extractTicketIoEventSlug(input.ticketUrl);
  if (!slug) {
    return { valid: false, reason: 'missing_event_slug' };
  }

  if (ticketShopSlug !== shopSlug.toLowerCase()) {
    const aliasProof = input.aliasProof;
    if (!aliasProof?.valid || aliasProof.eventSlug !== slug) {
      return { valid: false, reason: 'wrong_shop' };
    }
    const finalUrl = aliasProof.redirectFinalUrl ?? aliasProof.linkedEventUrl;
    if (!finalUrl || extractTicketIoEventSlug(finalUrl) !== slug) {
      return { valid: false, reason: 'alias_slug_not_proven' };
    }
    const finalHost = hostnameFromTicketIoUrl(finalUrl);
    const ticketHost = hostnameFromTicketIoUrl(input.ticketUrl);
    if (!finalHost || !ticketHost || finalHost !== ticketHost) {
      return { valid: false, reason: 'alias_host_not_proven' };
    }
  }

  const normalized = normalizeTicketIoEventUrl(input.ticketUrl);
  if (!normalized.includes(`/${slug}/`)) {
    return { valid: false, reason: 'slug_mismatch' };
  }

  const pathSegments = new URL(normalized).pathname.split('/').filter(Boolean);
  if (pathSegments.length !== 1) {
    return { valid: false, reason: 'not_event_page' };
  }

  return { valid: true };
}

function hostnameFromTicketIoUrl(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return undefined;
  }
}

export function ticketIoEventUrlsEquivalent(left: string, right: string): boolean {
  return normalizeTicketIoEventUrl(left) === normalizeTicketIoEventUrl(right);
}
