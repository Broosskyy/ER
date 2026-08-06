import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
} from '@/features/import/adapters/parsers/json-ld-parser';

import { formatTicketPriceFromOverviewText, parseGermanPriceText } from './format-ticket-price';
import { isTicketIoPowChallengePage } from './ticket-io-field-quality';
import { parseTicketIoCardRowContexts } from './ticket-io-list-card-enrichment';
import {
  extractTicketIoEventSlugFromUrl,
  parseTicketIoListRowContexts,
  type TicketIoListRowContext,
} from './ticket-io-list-enrichment';
import { resolveTicketIoPriceStrategy } from './ticket-io-price-strategy-registry';

export type TicketIoPriceFailureClass =
  | 'LIST_PRICE_AVAILABLE_NOT_EXTRACTED'
  | 'DETAIL_PRICE_AVAILABLE_NOT_EXTRACTED'
  | 'EMBEDDED_PRICE_AVAILABLE_NOT_EXTRACTED'
  | 'PUBLIC_ENDPOINT_PRICE_NOT_EXTRACTED'
  | 'PRICE_LOST_IN_CONNECTOR_MAPPING'
  | 'PRICE_LOST_IN_IMPORT_PAYLOAD'
  | 'PRICE_NOT_PERSISTED'
  | 'DETAIL_EXTERNALLY_BLOCKED_LIST_HAS_NO_PRICE'
  | 'SHOP_ROOT_WITHOUT_EVENT_ID'
  | 'EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST'
  | 'PUBLIC_PAGE_CONFIRMED_NO_PRICE'
  | 'REVIEW_REQUIRED'
  | 'NONE';

export type TicketIoPriceEvidenceSurface =
  | 'list_overview_row'
  | 'list_card_html'
  | 'list_json_ld'
  | 'detail_json_ld'
  | 'embedded_json'
  | 'detail_html'
  | 'none';

export interface TicketIoPriceEvidenceHit {
  surface: TicketIoPriceEvidenceSurface;
  priceText?: string;
  priceAmount?: number;
  soldOut?: boolean;
  rawSnippet?: string;
  strategyVersion: string;
}

export interface TicketIoPriceEvidenceDiscovery {
  shopSlug: string;
  listUrl: string;
  eventSlug?: string;
  eventUrl?: string;
  listAccessible: boolean;
  detailAccessible: boolean;
  detailAltchaBlocked: boolean;
  listRowCount: number;
  hits: TicketIoPriceEvidenceHit[];
  bestHit?: TicketIoPriceEvidenceHit;
  embeddedJsonScriptCount: number;
  listJsonLdOfferCount: number;
  registeredStrategy: ReturnType<typeof resolveTicketIoPriceStrategy>;
}

const EVIDENCE_STRATEGY_VERSION = 'phase4721-v1';

function mergeListContexts(
  classic: Map<string, TicketIoListRowContext>,
  cards: Map<string, TicketIoListRowContext>,
): Map<string, TicketIoListRowContext> {
  const merged = new Map(classic);
  for (const [slug, context] of cards) {
    if (!merged.has(slug) || (!merged.get(slug)?.priceText && context.priceText)) {
      merged.set(slug, context);
    }
  }
  return merged;
}

function extractJsonLdOffers(html: string, eventSlug?: string): TicketIoPriceEvidenceHit[] {
  const hits: TicketIoPriceEvidenceHit[] = [];
  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const offers = (node as Record<string, unknown>).offers;
      const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
      for (const offer of offerList) {
        if (!offer || typeof offer !== 'object') {
          continue;
        }
        const record = offer as Record<string, unknown>;
        const offerUrl = String(record.url ?? '');
        if (eventSlug && offerUrl && !offerUrl.includes(`/${eventSlug}/`)) {
          continue;
        }
        const low = record.lowPrice ?? record.price;
        const amount = low !== undefined ? Number(low) : undefined;
        if (amount === undefined || !Number.isFinite(amount)) {
          continue;
        }
        if (amount <= 0 && !/outofstock|soldout/i.test(String(record.availability ?? ''))) {
          continue;
        }
        hits.push({
          surface: 'list_json_ld',
          priceAmount: amount,
          priceText: amount > 0 ? `ab ${amount.toFixed(2).replace('.', ',')} €` : 'Ausverkauft',
          soldOut: /outofstock|soldout/i.test(String(record.availability ?? '')),
          strategyVersion: EVIDENCE_STRATEGY_VERSION,
          rawSnippet: JSON.stringify(record).slice(0, 200),
        });
      }
    }
  }
  return hits;
}

function extractEmbeddedJsonPriceHits(html: string): TicketIoPriceEvidenceHit[] {
  const hits: TicketIoPriceEvidenceHit[] = [];
  const scripts = html.match(/<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const script of scripts) {
    const body = script.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    if (!/price|offer|ticket/i.test(body)) {
      continue;
    }
    const priceMatches = body.match(/"(?:lowPrice|price|amount)"\s*:\s*"?([\d.]+)"?/gi) ?? [];
    for (const match of priceMatches) {
      const amountMatch = match.match(/([\d.]+)/);
      const amount = amountMatch?.[1] ? Number.parseFloat(amountMatch[1]) : undefined;
      if (amount === undefined || !Number.isFinite(amount) || amount < 1) {
        continue;
      }
      hits.push({
        surface: 'embedded_json',
        priceAmount: amount,
        priceText: `ab ${amount.toFixed(2).replace('.', ',')} €`,
        strategyVersion: EVIDENCE_STRATEGY_VERSION,
        rawSnippet: match,
      });
    }
  }
  return hits;
}

function pickBestHit(
  hits: TicketIoPriceEvidenceHit[],
  eventSlug?: string,
): TicketIoPriceEvidenceHit | undefined {
  const surfacePriority: TicketIoPriceEvidenceSurface[] = [
    'list_overview_row',
    'list_card_html',
    'detail_json_ld',
    'detail_html',
    'embedded_json',
    'list_json_ld',
  ];

  const eligible = hits.filter((hit) => {
    if (hit.soldOut) {
      return true;
    }
    if (hit.priceAmount !== undefined && hit.priceAmount <= 0) {
      return false;
    }
    if (eventSlug && hit.surface === 'list_json_ld') {
      return hit.rawSnippet?.includes(eventSlug) ?? false;
    }
    return hit.priceAmount !== undefined || Boolean(hit.priceText);
  });

  if (eligible.length === 0) {
    return undefined;
  }

  return [...eligible].sort((left, right) => {
    const leftPriority = surfacePriority.indexOf(left.surface);
    const rightPriority = surfacePriority.indexOf(right.surface);
    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority;
    }
    return (left.priceAmount ?? Number.MAX_SAFE_INTEGER) - (right.priceAmount ?? Number.MAX_SAFE_INTEGER);
  })[0];
}

export function discoverTicketIoPriceEvidence(input: {
  shopSlug: string;
  listUrl: string;
  listHtml: string;
  eventUrl?: string;
  detailHtml?: string;
}): TicketIoPriceEvidenceDiscovery {
  const shopSlug = input.shopSlug.trim().toLowerCase();
  const eventSlug = input.eventUrl ? extractTicketIoEventSlugFromUrl(input.eventUrl) : undefined;
  const listAccessible = input.listHtml.length > 500 && !isTicketIoPowChallengePage(input.listHtml);
  const detailAltchaBlocked = input.detailHtml ? isTicketIoPowChallengePage(input.detailHtml) : false;
  const detailAccessible = Boolean(input.detailHtml && input.detailHtml.length > 500 && !detailAltchaBlocked);

  const classicRows = parseTicketIoListRowContexts(input.listHtml);
  const cardRows = parseTicketIoCardRowContexts(input.listHtml);
  const listRows = mergeListContexts(classicRows, cardRows);

  const hits: TicketIoPriceEvidenceHit[] = [];

  for (const [slug, row] of listRows) {
    if (eventSlug && slug !== eventSlug) {
      continue;
    }
    if (row.priceText || row.priceOverviewText) {
      const parsed = parseGermanPriceText(row.priceOverviewText ?? row.priceText);
      hits.push({
        surface: classicRows.has(slug) ? 'list_overview_row' : 'list_card_html',
        priceText: row.priceText,
        priceAmount: parsed.amount,
        soldOut: row.soldOut,
        rawSnippet: row.priceOverviewText,
        strategyVersion: EVIDENCE_STRATEGY_VERSION,
      });
    }
  }

  hits.push(...extractJsonLdOffers(input.listHtml, eventSlug));
  hits.push(...extractEmbeddedJsonPriceHits(input.listHtml));

  if (detailAccessible && input.detailHtml) {
    hits.push(
      ...extractJsonLdOffers(input.detailHtml, eventSlug).map((hit) => ({
        ...hit,
        surface: 'detail_json_ld' as const,
      })),
    );
    const detailPrice = input.detailHtml.match(/([\d]+[.,]\d{2})\s*(?:€|EUR)/i);
    if (detailPrice?.[1]) {
      const amount = Number.parseFloat(detailPrice[1].replace(',', '.'));
      if (Number.isFinite(amount)) {
        hits.push({
          surface: 'detail_html',
          priceAmount: amount,
          priceText: `ab ${detailPrice[1].replace('.', ',')} €`,
          strategyVersion: EVIDENCE_STRATEGY_VERSION,
        });
      }
    }
  }

  return {
    shopSlug,
    listUrl: input.listUrl,
    eventSlug,
    eventUrl: input.eventUrl,
    listAccessible,
    detailAccessible,
    detailAltchaBlocked,
    listRowCount: listRows.size,
    hits,
    bestHit: pickBestHit(hits, eventSlug),
    embeddedJsonScriptCount: (input.listHtml.match(/type=["']application\/json["']/gi) ?? []).length,
    listJsonLdOfferCount: extractJsonLdOffers(input.listHtml, eventSlug).length,
    registeredStrategy: resolveTicketIoPriceStrategy(shopSlug),
  };
}

export function classifyTicketIoPriceFailure(input: {
  hasEventSlug: boolean;
  isShopRootUrl: boolean;
  discovery: TicketIoPriceEvidenceDiscovery;
  importPriceText?: string;
  dbPriceText?: string;
  canonicalPriceText?: string;
  uiPriceVisible?: boolean;
}): { failure: TicketIoPriceFailureClass; codePath: string; rawEvidence?: string } {
  const { discovery } = input;
  const publicPrice = discovery.bestHit?.priceText;
  const hasPublicPrice = Boolean(publicPrice?.trim() && publicPrice !== 'Ausverkauft');

  if (input.canonicalPriceText?.trim() || input.uiPriceVisible) {
    return { failure: 'NONE', codePath: 'canonical_or_ui_price_present' };
  }

  if (input.isShopRootUrl || !input.hasEventSlug) {
    return {
      failure: 'SHOP_ROOT_WITHOUT_EVENT_ID',
      codePath: 'ticket-io-url.ts:extractTicketIoEventSlugFromUrl',
    };
  }

  if (discovery.listAccessible && discovery.eventSlug && discovery.listRowCount > 0) {
    const rowHit = discovery.hits.find(
      (hit) => hit.surface === 'list_overview_row' || hit.surface === 'list_card_html',
    );
    if (!rowHit && !hasPublicPrice) {
      return {
        failure: 'EVENT_NOT_PRESENT_ON_ACCESSIBLE_LIST',
        codePath: 'ticket-io-list-enrichment.ts:parseTicketIoListRowContexts|parseTicketIoCardRowContexts',
      };
    }
  }

  if (hasPublicPrice && !input.importPriceText?.trim()) {
    const surface = discovery.bestHit?.surface;
    if (surface === 'embedded_json') {
      return {
        failure: 'EMBEDDED_PRICE_AVAILABLE_NOT_EXTRACTED',
        codePath: 'ticket-io-price-evidence.ts:extractEmbeddedJsonPriceHits',
        rawEvidence: discovery.bestHit?.rawSnippet,
      };
    }
    if (surface === 'list_json_ld' || surface === 'list_overview_row' || surface === 'list_card_html') {
      return {
        failure: 'LIST_PRICE_AVAILABLE_NOT_EXTRACTED',
        codePath: 'ticket-io-adapter.ts:parseTicketIoShopHtml',
        rawEvidence: discovery.bestHit?.rawSnippet,
      };
    }
    if (surface === 'detail_json_ld' || surface === 'detail_html') {
      return {
        failure: 'DETAIL_PRICE_AVAILABLE_NOT_EXTRACTED',
        codePath: 'ticket-io-detail-parser.ts',
        rawEvidence: discovery.bestHit?.rawSnippet,
      };
    }
    return {
      failure: 'LIST_PRICE_AVAILABLE_NOT_EXTRACTED',
      codePath: 'ticket-io-price-evidence.ts:discoverTicketIoPriceEvidence',
      rawEvidence: publicPrice,
    };
  }

  if (hasPublicPrice && input.importPriceText?.trim() && !input.dbPriceText?.trim()) {
    return {
      failure: 'PRICE_NOT_PERSISTED',
      codePath: 'import-event-field-mapper.ts:buildImportPublishFieldPatch',
      rawEvidence: publicPrice,
    };
  }

  if (hasPublicPrice && !input.importPriceText?.trim() && !input.dbPriceText?.trim()) {
    return {
      failure: 'PRICE_LOST_IN_IMPORT_PAYLOAD',
      codePath: 'import pipeline normalized_payload.priceText',
      rawEvidence: publicPrice,
    };
  }

  if (discovery.detailAltchaBlocked && !hasPublicPrice) {
    return {
      failure: 'DETAIL_EXTERNALLY_BLOCKED_LIST_HAS_NO_PRICE',
      codePath: 'ticket-io-field-quality.ts:isTicketIoPowChallengePage',
    };
  }

  if (!hasPublicPrice && discovery.listAccessible && discovery.listRowCount === 0) {
    return {
      failure: 'PUBLIC_PAGE_CONFIRMED_NO_PRICE',
      codePath: 'discoverTicketIoPriceEvidence:no_hits',
    };
  }

  return {
    failure: 'REVIEW_REQUIRED',
    codePath: 'ticket-io-price-evidence.ts:classifyTicketIoPriceFailure',
  };
}
