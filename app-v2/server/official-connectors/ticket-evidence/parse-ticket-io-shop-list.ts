import { createHash } from 'node:crypto';

import { normalizeTicketPriceLine } from './normalize-ticket-price';
import type { VerifiedTicketStatus } from './types';
import { canonicalizeTicketIoUrl, extractTicketIoProviderEventId } from './url-policy';

export interface TicketIoShopListEntry {
  providerEventId: string;
  eventName: string;
  eventUrl: string;
  startAt?: string;
  venueName?: string;
  rawAvailability?: string;
  rawPrice?: string;
  amountMinor?: number;
  currency?: string;
  ticketStatus: VerifiedTicketStatus;
  isMinimumPrice: boolean;
}

export interface TicketIoShopListParseResult {
  shopUrl: string;
  entries: TicketIoShopListEntry[];
  contentFingerprint: string;
  jsonLdBlockCount: number;
}

function fingerprintBody(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

function mapJsonLdAvailability(raw?: string): VerifiedTicketStatus {
  const value = String(raw ?? '').toLowerCase();
  if (value.includes('soldout') || value.includes('sold_out')) {
    return 'sold_out';
  }
  if (value.includes('preorder') || value.includes('presale')) {
    return 'sale_not_started';
  }
  if (value.includes('instock') || value.includes('in_stock')) {
    return 'available';
  }
  if (value.includes('ended')) {
    return 'sales_ended';
  }
  if (value.includes('cancel')) {
    return 'cancelled';
  }
  return 'unavailable_unknown';
}

function extractJsonLdBlocks(html: string): unknown[] {
  const blocks: unknown[] = [];
  const pattern = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) {
      continue;
    }
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // ignore malformed blocks
    }
  }
  return blocks;
}

function collectMusicEvents(node: unknown, out: Array<Record<string, unknown>>): void {
  if (!node || typeof node !== 'object') {
    return;
  }
  if (Array.isArray(node)) {
    for (const item of node) {
      collectMusicEvents(item, out);
    }
    return;
  }
  const record = node as Record<string, unknown>;
  const type = String(record['@type'] ?? '');
  if (type === 'MusicEvent' || type.endsWith('MusicEvent')) {
    out.push(record);
  }
  if (record['@graph']) {
    collectMusicEvents(record['@graph'], out);
  }
}

function offerRecord(event: Record<string, unknown>): Record<string, unknown> | undefined {
  const offers = event.offers;
  if (!offers) {
    return undefined;
  }
  if (Array.isArray(offers)) {
    return offers.find((entry) => entry && typeof entry === 'object') as Record<string, unknown> | undefined;
  }
  return typeof offers === 'object' ? (offers as Record<string, unknown>) : undefined;
}

export function parseTicketIoShopListHtml(shopUrl: string, html: string): TicketIoShopListParseResult {
  const events: Record<string, unknown>[] = [];
  const blocks = extractJsonLdBlocks(html);
  for (const block of blocks) {
    collectMusicEvents(block, events);
  }

  const entries: TicketIoShopListEntry[] = [];
  for (const event of events) {
    const offer = offerRecord(event);
    const offerUrl = String(offer?.url ?? '').trim();
    const canonicalOfferUrl = canonicalizeTicketIoUrl(offerUrl);
    const providerEventId = canonicalOfferUrl ? extractTicketIoProviderEventId(canonicalOfferUrl) : undefined;
    if (!providerEventId || !canonicalOfferUrl) {
      continue;
    }

    const priceAmount = offer?.price;
    const currency = String(offer?.priceCurrency ?? '').trim() || undefined;
    let amountMinor: number | undefined;
    let rawPrice: string | undefined;
    let isMinimumPrice = false;

    if (typeof priceAmount === 'number' && Number.isFinite(priceAmount)) {
      amountMinor = Math.round(priceAmount * 100);
      rawPrice = currency ? `ab ${priceAmount.toFixed(2).replace('.', ',')} ${currency === 'EUR' ? '€' : currency}` : String(priceAmount);
      isMinimumPrice = true;
    } else if (typeof priceAmount === 'string' && priceAmount.trim()) {
      const normalized = normalizeTicketPriceLine(priceAmount);
      amountMinor = normalized.amountMinor;
      rawPrice = normalized.rawPrice;
      isMinimumPrice = normalized.isMinimumPrice;
    }

    const location = event.location as Record<string, unknown> | undefined;
    const venueName = location ? String(location.name ?? '').trim() : undefined;
    const startAt = String(event.startDate ?? '').trim() || undefined;

    entries.push({
      providerEventId,
      eventName: String(event.name ?? '').trim(),
      eventUrl: canonicalOfferUrl,
      startAt,
      venueName,
      rawAvailability: String(offer?.availability ?? ''),
      rawPrice,
      amountMinor,
      currency,
      ticketStatus: mapJsonLdAvailability(String(offer?.availability ?? '')),
      isMinimumPrice,
    });
  }

  const byId = new Map<string, TicketIoShopListEntry>();
  for (const entry of entries) {
    byId.set(entry.providerEventId.toLowerCase(), entry);
  }

  return {
    shopUrl,
    entries: [...byId.values()],
    contentFingerprint: fingerprintBody(html),
    jsonLdBlockCount: blocks.length,
  };
}

export function findShopListEntryByProviderId(
  parsed: TicketIoShopListParseResult,
  providerEventId: string,
): TicketIoShopListEntry | undefined {
  return parsed.entries.find(
    (entry) => entry.providerEventId.toLowerCase() === providerEventId.toLowerCase(),
  );
}
