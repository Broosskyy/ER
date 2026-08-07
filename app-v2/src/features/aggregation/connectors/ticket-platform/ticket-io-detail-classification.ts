import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import { normalizeExtractedTicketPlatformPageTitle } from '@/features/import/ticket-platform-identity/identity-match';

import type { TicketIoTicketOffer } from './ticket-io-detail-parser';
import { isTicketIoPowChallengePage } from './ticket-io-field-quality';

export type TicketIoDetailFetchStatus = 'ok' | 'pow_challenge' | 'missing';

export interface TicketIoChallengeMarkers {
  securityCheckTitle: boolean;
  altcha: boolean;
  waitioPow: boolean;
}

export interface TicketIoPageIdentity {
  pageTitle?: string;
  eventDate?: string;
  venueName?: string;
  publicTicketPageUrl?: string;
}

export interface TicketIoExcludedProduct {
  name: string;
  reason: string;
  priceAmount?: number;
  priceCurrency?: string;
}

export interface TicketIoDetailClassification {
  detailFetchStatus: TicketIoDetailFetchStatus;
  challengeMarkers: TicketIoChallengeMarkers;
  identity: TicketIoPageIdentity;
  admissionProducts: TicketIoTicketOffer[];
  excludedProducts: TicketIoExcludedProduct[];
  diagnostics: string[];
  hasUsableIdentity: boolean;
  hasAdmissionProducts: boolean;
}

const TICKET_IO_ADD_ON_PATTERN =
  /\b(locker|parking|parkplatz|versicherung|insurance|versand|shipping|garderobe|schließfach|cloak\s*room|fee|gebühr|merch(andise)?)\b/i;

function detectChallengeMarkers(html: string): TicketIoChallengeMarkers {
  return {
    securityCheckTitle: /<title>\s*Security check/i.test(html),
    altcha: /altcha/i.test(html),
    waitioPow: /x-waitio-location:\s*pow/i.test(html),
  };
}

function extractHtmlPageTitle(html: string): string | undefined {
  const ogMatch =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  if (ogMatch?.[1]) {
    const decoded = decodeHtmlEntities(ogMatch[1]).trim();
    return decoded || undefined;
  }
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return titleMatch?.[1] ? decodeHtmlEntities(titleMatch[1]).trim() || undefined : undefined;
}

function isSecurityCheckTitle(title: string | undefined): boolean {
  return !title?.trim() || /security check/i.test(title);
}

export function isTicketIoAdmissionProductName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) {
    return false;
  }
  return !TICKET_IO_ADD_ON_PATTERN.test(trimmed);
}

function parseOfferRecord(record: Record<string, unknown>): TicketIoTicketOffer | undefined {
  const name = record.name ? String(record.name).trim() : '';
  if (!name) {
    return undefined;
  }
  const availability = record.availability ? String(record.availability) : undefined;
  const availabilityToken = availability?.split('/').pop()?.toLowerCase();
  const soldOut = availabilityToken === 'soldout' || availabilityToken === 'outofstock';
  const priceAmount =
    record.price !== undefined
      ? Number(record.price)
      : record.lowPrice !== undefined
        ? Number(record.lowPrice)
        : record.amount !== undefined
          ? Number(record.amount)
          : undefined;

  return {
    name,
    priceAmount: Number.isFinite(priceAmount) ? priceAmount : undefined,
    priceCurrency: record.priceCurrency ? String(record.priceCurrency) : 'EUR',
    availability: availabilityToken,
    soldOut,
    purchaseUrl: record.url ? String(record.url) : undefined,
  };
}

function collectJsonLdOffers(html: string): TicketIoTicketOffer[] {
  const offers: TicketIoTicketOffer[] = [];
  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const rawOffers = (node as Record<string, unknown>).offers;
      const offerList = Array.isArray(rawOffers) ? rawOffers : rawOffers ? [rawOffers] : [];
      for (const offer of offerList) {
        if (!offer || typeof offer !== 'object') {
          continue;
        }
        const parsed = parseOfferRecord(offer as Record<string, unknown>);
        if (parsed) {
          offers.push(parsed);
        }
      }
    }
  }
  return offers;
}

function collectEmbeddedJsonOffers(html: string): TicketIoTicketOffer[] {
  const offers: TicketIoTicketOffer[] = [];
  const scripts =
    html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const body = script.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    if (!body || !/offer|ticket|price/i.test(body)) {
      continue;
    }
    try {
      const payload = JSON.parse(body) as unknown;
      collectOffersFromUnknown(payload, offers);
    } catch {
      const nameMatches = body.matchAll(/"name"\s*:\s*"([^"]+)"/gi);
      for (const nameMatch of nameMatches) {
        const name = nameMatch[1]?.trim();
        if (!name) {
          continue;
        }
        const slice = body.slice(nameMatch.index ?? 0, (nameMatch.index ?? 0) + 240);
        const priceMatch = slice.match(/"(?:price|lowPrice|amount)"\s*:\s*"?([\d.]+)"?/i);
        const amount = priceMatch?.[1] ? Number.parseFloat(priceMatch[1]) : undefined;
        offers.push({
          name,
          priceAmount: Number.isFinite(amount) ? amount : undefined,
          priceCurrency: 'EUR',
        });
      }
    }
  }
  return offers;
}

function collectOffersFromUnknown(node: unknown, offers: TicketIoTicketOffer[]): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectOffersFromUnknown(item, offers);
    }
    return;
  }
  const record = node as Record<string, unknown>;
  if (record.name && (record.price !== undefined || record.lowPrice !== undefined || record.amount !== undefined)) {
    const parsed = parseOfferRecord(record);
    if (parsed) {
      offers.push(parsed);
    }
  }
  for (const value of Object.values(record)) {
    if (value && typeof value === 'object') {
      collectOffersFromUnknown(value, offers);
    }
  }
}

function dedupeOffers(offers: TicketIoTicketOffer[]): TicketIoTicketOffer[] {
  const seen = new Set<string>();
  const deduped: TicketIoTicketOffer[] = [];
  for (const offer of offers) {
    const key = `${offer.name.toLowerCase()}|${offer.priceAmount ?? 'na'}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    deduped.push(offer);
  }
  return deduped;
}

export function partitionTicketIoAdmissionProducts(offers: TicketIoTicketOffer[]): {
  admissionProducts: TicketIoTicketOffer[];
  excludedProducts: TicketIoExcludedProduct[];
} {
  const admissionProducts: TicketIoTicketOffer[] = [];
  const excludedProducts: TicketIoExcludedProduct[] = [];

  for (const offer of offers) {
    if (isTicketIoAdmissionProductName(offer.name)) {
      admissionProducts.push(offer);
      continue;
    }
    excludedProducts.push({
      name: offer.name,
      reason: 'supplementary_add_on_product',
      priceAmount: offer.priceAmount,
      priceCurrency: offer.priceCurrency,
    });
  }

  return { admissionProducts, excludedProducts };
}

export function extractTicketIoPageIdentity(html: string): TicketIoPageIdentity {
  let pageTitle: string | undefined;
  let eventDate: string | undefined;
  let venueName: string | undefined;
  let publicTicketPageUrl: string | undefined;

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const parsed = parseJsonLdEvent(node);
      const fields = parsed.fields;
      if (fields.title && !pageTitle) {
        pageTitle = String(fields.title).trim();
      }
      if (fields.startDate && !eventDate) {
        eventDate = String(fields.startDate);
      }
      if (fields.venueName && !venueName) {
        venueName = String(fields.venueName).trim();
      }
      const url = fields.ticketUrl ?? fields.eventUrl ?? parsed.externalId;
      if (url && !publicTicketPageUrl) {
        publicTicketPageUrl = String(url).trim();
      }
    }
  }

  const htmlTitle = extractHtmlPageTitle(html);
  if (!pageTitle && htmlTitle && !isSecurityCheckTitle(htmlTitle)) {
    pageTitle = normalizeExtractedTicketPlatformPageTitle(htmlTitle);
  }

  return {
    pageTitle,
    eventDate,
    venueName,
    publicTicketPageUrl,
  };
}

export function hasTicketIoUsablePageIdentity(identity: TicketIoPageIdentity): boolean {
  return Boolean(
    identity.pageTitle?.trim() &&
      identity.eventDate?.trim() &&
      identity.venueName?.trim() &&
      !isSecurityCheckTitle(identity.pageTitle),
  );
}

/** Content-aware Ticket.io detail classification: semantic extraction precedes PoW blocking. */
export function classifyTicketIoDetailHtml(html: string | undefined): TicketIoDetailClassification {
  if (!html?.trim()) {
    return {
      detailFetchStatus: 'missing',
      challengeMarkers: {
        securityCheckTitle: false,
        altcha: false,
        waitioPow: false,
      },
      identity: {},
      admissionProducts: [],
      excludedProducts: [],
      diagnostics: ['detail_html:missing'],
      hasUsableIdentity: false,
      hasAdmissionProducts: false,
    };
  }

  const challengeMarkers = detectChallengeMarkers(html);
  const identity = extractTicketIoPageIdentity(html);
  const rawOffers = dedupeOffers([...collectJsonLdOffers(html), ...collectEmbeddedJsonOffers(html)]);
  const { admissionProducts, excludedProducts } = partitionTicketIoAdmissionProducts(rawOffers);
  const hasUsableIdentity = hasTicketIoUsablePageIdentity(identity);
  const hasAdmissionProducts = admissionProducts.some((offer) => offer.name.trim().length > 0);
  const diagnostics: string[] = [];

  if (challengeMarkers.securityCheckTitle) {
    diagnostics.push('challenge_marker:security_check_title');
  }
  if (challengeMarkers.altcha) {
    diagnostics.push('challenge_marker:altcha');
  }
  if (challengeMarkers.waitioPow) {
    diagnostics.push('challenge_marker:waitio_pow');
  }

  let detailFetchStatus: TicketIoDetailFetchStatus;
  if (hasUsableIdentity) {
    detailFetchStatus = 'ok';
    if (isTicketIoPowChallengePage(html)) {
      diagnostics.push('challenge_markers_present_content_usable');
    }
    if (!hasAdmissionProducts) {
      diagnostics.push('identity_usable_without_admission_products');
    }
  } else if (isTicketIoPowChallengePage(html)) {
    detailFetchStatus = 'pow_challenge';
    diagnostics.push('pow_blocked:no_usable_semantic_content');
  } else {
    detailFetchStatus = 'pow_challenge';
    diagnostics.push('detail_blocked:insufficient_semantic_content');
  }

  return {
    detailFetchStatus,
    challengeMarkers,
    identity,
    admissionProducts,
    excludedProducts,
    diagnostics,
    hasUsableIdentity,
    hasAdmissionProducts,
  };
}
