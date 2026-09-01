const TICKET_IO_HOST_PATTERN = /^[a-z0-9-]+\.ticket\.io$/i;
const TICKET_KINGS_HOST_PATTERN = /ticketkings\.|tickets\.ticketkings/i;
const MERCHANDISE_HOST_PATTERN = /\b(?:snash\.com)\b/i;
const REDIRECTOR_HOST_PATTERN = /^(?:bit\.ly|t\.co|l\.facebook\.com)$/i;

export function isMerchandiseUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return MERCHANDISE_HOST_PATTERN.test(host) || /\/collections\/|\/kollektionen\//i.test(url);
  } catch {
    return false;
  }
}

export function isRedirectorHost(hostname: string): boolean {
  return REDIRECTOR_HOST_PATTERN.test(hostname.toLowerCase()) || hostname.toLowerCase() === 'bit.ly';
}

export function isTicketKingsHost(hostname: string): boolean {
  return TICKET_KINGS_HOST_PATTERN.test(hostname);
}
const PAYLOGIC_HOST_PATTERN = /^shop\.paylogic\.com$/i;
const FOURVENUES_HOST_PATTERN = /^(?:site\.)?fourvenues\.com$/i;

const CHECKOUT_PATH_PATTERN = /\/(?:checkout|cart|basket|payment|session)(?:\/|$)/i;
const SESSION_QUERY_PATTERN = /(?:[?&])(?:session|token|sid|checkout)=/i;
const SHOP_ROOT_PATTERNS = [
  /^https:\/\/[a-z0-9-]+\.ticket\.io\/$/i,
  /^https:\/\/shop\.paylogic\.com\/$/i,
  /^https:\/\/affenkaefig\.info\/tickets\/?$/i,
  /^https:\/\/[a-z0-9.-]+\.n8manager\.de\/eventportal\/?$/i,
];

const TRACKING_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', '_gl'];

export function isTicketIoHost(hostname: string): boolean {
  return TICKET_IO_HOST_PATTERN.test(hostname);
}

export function isPaylogicHost(hostname: string): boolean {
  return PAYLOGIC_HOST_PATTERN.test(hostname);
}

export function isFourvenuesHost(hostname: string): boolean {
  return FOURVENUES_HOST_PATTERN.test(hostname);
}

export function stripTrackingParams(parsed: URL): void {
  parsed.hash = '';
  for (const key of [...TRACKING_KEYS]) {
    parsed.searchParams.delete(key);
  }
  // Google Analytics client id blobs in _gl often appear as prefixed params
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith('_ga') || key === '_gl') {
      parsed.searchParams.delete(key);
    }
  }
}

export function canonicalizeTicketIoUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') {
      return undefined;
    }
    if (!isTicketIoHost(parsed.hostname)) {
      return undefined;
    }
    stripTrackingParams(parsed);
    if (!parsed.pathname.endsWith('/')) {
      parsed.pathname = `${parsed.pathname}/`;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isTicketIoEventDetailUrl(url: string): boolean {
  const canonical = canonicalizeTicketIoUrl(url);
  if (!canonical) {
    return false;
  }
  const parsed = new URL(canonical);
  const segments = parsed.pathname.split('/').filter(Boolean);
  if (segments.length !== 1) {
    return false;
  }
  const segment = segments[0];
  if (!segment || segment === 'events' || segment === 'shop') {
    return false;
  }
  return /^[A-Za-z0-9]{6,12}$/.test(segment);
}

export function isTicketIoShopRootUrl(url: string): boolean {
  const canonical = canonicalizeTicketIoUrl(url);
  if (!canonical) {
    return false;
  }
  const parsed = new URL(canonical);
  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments.length === 0;
}

export function canonicalizePaylogicUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !isPaylogicHost(parsed.hostname)) {
      return undefined;
    }
    stripTrackingParams(parsed);
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isPaylogicEventDetailUrl(url: string): boolean {
  const canonical = canonicalizePaylogicUrl(url);
  if (!canonical) {
    return false;
  }
  const parsed = new URL(canonical);
  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments.length === 1 && /^[a-f0-9]{32}$/i.test(segments[0] ?? '');
}

export function canonicalizeFourvenuesUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !isFourvenuesHost(parsed.hostname)) {
      return undefined;
    }
    stripTrackingParams(parsed);
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isFourvenuesEventDetailUrl(url: string): boolean {
  const canonical = canonicalizeFourvenuesUrl(url);
  if (!canonical) {
    return false;
  }
  const parsed = new URL(canonical);
  const segments = parsed.pathname.split('/').filter(Boolean);
  return segments.includes('events') && segments.length >= 3;
}

export function isN8ManagerHost(hostname: string): boolean {
  return /n8manager\.de$/i.test(hostname.toLowerCase());
}

export function isN8ManagerPortalRootUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!isN8ManagerHost(parsed.hostname)) {
      return false;
    }
    return /\/eventportal\/?$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function canonicalizeN8ManagerTicketUrl(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !isN8ManagerHost(parsed.hostname)) {
      return undefined;
    }
    if (!/\/ticketing\/native_event\.php$/i.test(parsed.pathname)) {
      return undefined;
    }
    const eventId = parsed.searchParams.get('id');
    if (!eventId) {
      return undefined;
    }
    parsed.search = `?id=${encodeURIComponent(eventId)}`;
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return undefined;
  }
}

export function isCheckoutOrSessionTicketUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return CHECKOUT_PATH_PATTERN.test(parsed.pathname) || SESSION_QUERY_PATTERN.test(parsed.search);
  } catch {
    return false;
  }
}

export function isShopRootUrl(url: string): boolean {
  if (SHOP_ROOT_PATTERNS.some((pattern) => pattern.test(url))) {
    return true;
  }
  return isTicketIoShopRootUrl(url);
}

export function extractTicketIoProviderEventId(url: string): string | undefined {
  const canonical = canonicalizeTicketIoUrl(url);
  if (!canonical || !isTicketIoEventDetailUrl(canonical)) {
    return undefined;
  }
  return new URL(canonical).pathname.split('/').filter(Boolean)[0];
}

export function extractPaylogicProviderEventId(url: string): string | undefined {
  const canonical = canonicalizePaylogicUrl(url);
  if (!canonical || !isPaylogicEventDetailUrl(canonical)) {
    return undefined;
  }
  return new URL(canonical).pathname.split('/').filter(Boolean)[0];
}

export function extractFourvenuesProviderEventId(url: string): string | undefined {
  const canonical = canonicalizeFourvenuesUrl(url);
  if (!canonical || !isFourvenuesEventDetailUrl(canonical)) {
    return undefined;
  }
  const segments = new URL(canonical).pathname.split('/').filter(Boolean);
  const eventsIndex = segments.indexOf('events');
  if (eventsIndex < 0 || eventsIndex + 1 >= segments.length) {
    return undefined;
  }
  return segments[eventsIndex + 1];
}

export function classifyProviderKey(url: string): string {
  try {
    const parsed = new URL(url);
    if (isTicketIoHost(parsed.hostname)) {
      return 'ticket_io';
    }
    if (isPaylogicHost(parsed.hostname)) {
      return 'paylogic';
    }
    if (isFourvenuesHost(parsed.hostname)) {
      return 'fourvenues';
    }
    if (/eventim\./i.test(parsed.hostname)) {
      return 'eventim';
    }
    if (/rausgegangen\./i.test(parsed.hostname)) {
      return 'rausgegangen_ticketing';
    }
    if (/residentadvisor\.|ra\.co/i.test(parsed.hostname)) {
      return 'resident_advisor';
    }
    if (isTicketKingsHost(parsed.hostname)) {
      return 'ticket_kings';
    }
    if (isRedirectorHost(parsed.hostname)) {
      return 'redirector';
    }
    if (isMerchandiseUrl(url)) {
      return 'merchandise';
    }
    return 'organizer_shop';
  } catch {
    return 'unsupported';
  }
}
