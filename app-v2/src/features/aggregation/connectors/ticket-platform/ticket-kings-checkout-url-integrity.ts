import {
  extractNativeEventCheckoutUrl,
  parseTicketKingsCheckoutHtml,
  type TicketKingsPublicCheckoutEvidence,
} from './ticket-kings-public-checkout';

export type TicketKingsCheckoutUrlClass =
  | 'valid_event_checkout'
  | 'valid_embedded_checkout'
  | 'event_not_found'
  | 'missing_event_identifier'
  | 'required_query_parameters_lost'
  | 'required_form_context_lost'
  | 'transient_session_url'
  | 'expired_checkout'
  | 'redirect_only'
  | 'generic_endpoint'
  | 'review_required';

export interface TicketKingsCheckoutEmbedEvidence {
  checkoutUrl?: string;
  nativeEventId?: string;
  embedParams?: Record<string, string>;
  formActions: string[];
  hiddenFields: Record<string, string>;
  iframeSrcs: string[];
  scriptConfigSnippets: string[];
}

export interface TicketKingsCheckoutValidation {
  url: string;
  classification: TicketKingsCheckoutUrlClass;
  httpStatus?: number;
  responseSnippet?: string;
  eventNotFound: boolean;
  requiredEventIdentifier?: string;
  preservedQueryParameters: string[];
  missingQueryParameters: string[];
  proposedCorrection?: string;
  checkoutEvidence?: TicketKingsPublicCheckoutEvidence;
}

const EVENT_NOT_FOUND_PATTERN = /event\s+nicht\s+gefunden/i;
const BARE_NATIVE_EVENT_PATTERN = /native_event\.php\/?(?:\?|#|$)/i;
const NATIVE_EVENT_ID_PATTERN = /[?&]id=(\d+)/i;
const TRANSIENT_SESSION_PATTERN = /(?:PHPSESSID|session=|csrf|token=)/i;

const EMBED_QUERY_KEYS = ['id', 'embed', 'embed_layout', 'embed_flow', 'return_url'] as const;

function parseQueryParams(url: string): URLSearchParams | undefined {
  try {
    return new URL(url).searchParams;
  } catch {
    return undefined;
  }
}

export function extractTicketKingsCheckoutEmbedEvidence(detailHtml: string): TicketKingsCheckoutEmbedEvidence {
  const checkoutUrl = extractNativeEventCheckoutUrl(detailHtml);
  const nativeEventId = checkoutUrl?.match(NATIVE_EVENT_ID_PATTERN)?.[1];
  const embedParams: Record<string, string> = {};
  if (checkoutUrl) {
    const params = parseQueryParams(checkoutUrl);
    for (const key of EMBED_QUERY_KEYS) {
      const value = params?.get(key);
      if (value) {
        embedParams[key] = value;
      }
    }
  }

  const formActions = [
    ...detailHtml.matchAll(/<form[^>]+action=["']([^"']+)["']/gi),
  ].map((match) => match[1]?.replace(/&amp;/g, '&')).filter((value): value is string => Boolean(value));

  const hiddenFields: Record<string, string> = {};
  for (const match of detailHtml.matchAll(
    /<input[^>]+type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi,
  )) {
    if (match[1]) {
      hiddenFields[match[1]] = (match[2] ?? '').replace(/&amp;/g, '&');
    }
  }

  const iframeSrcs = [
    ...detailHtml.matchAll(/<iframe[^>]+src=["']([^"']+)["']/gi),
  ].map((match) => match[1]?.replace(/&amp;/g, '&')).filter((value): value is string => Boolean(value));

  const scriptConfigSnippets = [
    ...detailHtml.matchAll(/native_event\.php\?id=\d+[^"'<\s]*/gi),
  ].map((match) => match[0]);

  return {
    checkoutUrl,
    nativeEventId,
    embedParams,
    formActions,
    hiddenFields,
    iframeSrcs,
    scriptConfigSnippets,
  };
}

export function classifyPersistedNachtManagerUrl(url: string | undefined | null): TicketKingsCheckoutUrlClass {
  const text = url?.trim();
  if (!text) {
    return 'review_required';
  }

  if (/ticketkings\.de\/event\//i.test(text)) {
    return 'valid_event_checkout';
  }

  if (!/nacht-manager\.de\/ticketing\/native_event\.php/i.test(text)) {
    return 'review_required';
  }

  if (BARE_NATIVE_EVENT_PATTERN.test(text) && !NATIVE_EVENT_ID_PATTERN.test(text)) {
    return 'generic_endpoint';
  }

  if (TRANSIENT_SESSION_PATTERN.test(text)) {
    return 'transient_session_url';
  }

  const params = parseQueryParams(text);
  const eventId = params?.get('id');
  if (!eventId) {
    return 'missing_event_identifier';
  }

  const missing = EMBED_QUERY_KEYS.filter((key) => key !== 'id' && !params?.get(key));
  if (missing.length > 0 && !params?.get('embed')) {
    return 'required_query_parameters_lost';
  }

  if (params?.get('embed') === '1') {
    return 'valid_embedded_checkout';
  }

  return 'valid_event_checkout';
}

export function detectEventNotFoundResponse(html: string): boolean {
  return EVENT_NOT_FOUND_PATTERN.test(html);
}

export async function validateNachtManagerCheckoutUrl(
  url: string,
  fetchHtml: (url: string) => Promise<{ status: number; html: string }>,
): Promise<TicketKingsCheckoutValidation> {
  const structural = classifyPersistedNachtManagerUrl(url);
  const params = parseQueryParams(url);
  const preservedQueryParameters = params ? [...params.keys()] : [];
  const missingQueryParameters = EMBED_QUERY_KEYS.filter((key) => key !== 'id' && !params?.get(key));
  const requiredEventIdentifier = params?.get('id') ?? undefined;

  if (structural === 'generic_endpoint' || structural === 'missing_event_identifier') {
    return {
      url,
      classification: structural,
      eventNotFound: true,
      preservedQueryParameters,
      missingQueryParameters,
      requiredEventIdentifier,
    };
  }

  if (!/nacht-manager\.de/i.test(url)) {
    return {
      url,
      classification: structural,
      eventNotFound: false,
      preservedQueryParameters,
      missingQueryParameters,
      requiredEventIdentifier,
    };
  }

  try {
    const response = await fetchHtml(url);
    const eventNotFound = detectEventNotFoundResponse(response.html);
    const checkoutEvidence = eventNotFound ? undefined : parseTicketKingsCheckoutHtml(response.html);
    let classification = structural;
    if (eventNotFound) {
      classification = 'event_not_found';
    } else if (checkoutEvidence && checkoutEvidence.releases.length > 0) {
      classification = params?.get('embed') === '1' ? 'valid_embedded_checkout' : 'valid_event_checkout';
    }

    return {
      url,
      classification,
      httpStatus: response.status,
      responseSnippet: response.html.slice(0, 240).replace(/\s+/g, ' '),
      eventNotFound,
      preservedQueryParameters,
      missingQueryParameters,
      requiredEventIdentifier,
      checkoutEvidence,
    };
  } catch {
    return {
      url,
      classification: 'review_required',
      eventNotFound: false,
      preservedQueryParameters,
      missingQueryParameters,
      requiredEventIdentifier,
    };
  }
}

export function resolveTicketKingsOfficialFallbackUrl(
  officialTicketKingsEventUrl?: string,
  websiteUrl?: string,
): string | undefined {
  if (officialTicketKingsEventUrl && /ticketkings\.de\/event\//i.test(officialTicketKingsEventUrl)) {
    return officialTicketKingsEventUrl;
  }
  if (websiteUrl && /ticketkings\.de\/event\//i.test(websiteUrl)) {
    return websiteUrl;
  }
  return officialTicketKingsEventUrl ?? websiteUrl;
}

export function isBrokenTicketKingsCheckoutClass(
  classification: TicketKingsCheckoutUrlClass,
): boolean {
  return (
    classification === 'event_not_found' ||
    classification === 'missing_event_identifier' ||
    classification === 'required_query_parameters_lost' ||
    classification === 'required_form_context_lost' ||
    classification === 'transient_session_url' ||
    classification === 'expired_checkout' ||
    classification === 'generic_endpoint'
  );
}
