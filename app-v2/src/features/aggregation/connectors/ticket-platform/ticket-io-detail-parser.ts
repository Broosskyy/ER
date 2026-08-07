import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { decodeHtmlEntities, stripHtml } from '@/features/import/normalization/text-normalizer';

import { formatGermanTicketPrice } from './format-ticket-price';
import {
  classifyTicketIoDetailHtml,
  partitionTicketIoAdmissionProducts,
} from './ticket-io-detail-classification';
import {
  isTicketIoPlaceholderArtist,
  isTicketIoPlaceholderDescription,
  sanitizeTicketIoArtistNames,
  sanitizeTicketIoDescription,
} from './ticket-io-field-quality';
import { expandSegmentedLineupNames } from '@/features/aggregation/domain/lineup-billing-parser';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { extractAttributesFromDescriptionText } from '@/features/aggregation/domain/textual-attribute-parser';
import {
  extractRunningOrderFromDescriptionText,
  extractTimetableFromDescriptionText,
} from '@/features/aggregation/domain/textual-timetable-parser';
import { extractArtistsFromEventTitle } from './ticket-io-title-artists';

export interface TicketIoLineupEntry {
  displayName: string;
  normalizedName: string;
  role?: string;
  source: 'json_ld' | 'html_lineup' | 'title';
  confidence: number;
}

export interface TicketIoTicketOffer {
  name: string;
  priceAmount?: number;
  priceCurrency?: string;
  availability?: string;
  soldOut?: boolean;
  purchaseUrl?: string;
  validFrom?: string;
  validUntil?: string;
}

import type { RunningOrderEntry, TimetableSlotEntry, SourcedEventAttribute } from '@/features/aggregation/domain/event-structured-detail';

export interface TicketIoDetailEnrichment {
  description?: string;
  artistNames?: string[];
  lineupEntries?: TicketIoLineupEntry[];
  ticketOffers?: TicketIoTicketOffer[];
  priceAmount?: number;
  priceCurrency?: string;
  priceText?: string;
  availability?: string;
  soldOut?: boolean;
  blockedByPow?: boolean;
  eventAttributes?: SourcedEventAttribute[];
  minimumAge?: string;
  doorsOpenAt?: string;
  floorCount?: number;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
  runningOrder?: RunningOrderEntry[];
  timetable?: TimetableSlotEntry[];
}

const LINEUP_SECTION_PATTERN =
  /<(?:h[2-4]|strong)[^>]*>\s*(?:line[-\s]?up|lineup|artists?|acts?|dj[s]?)\s*<\/(?:h[2-4]|strong)>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i;

const LINEUP_LIST_ITEM_PATTERN = /<li[^>]*>([\s\S]*?)<\/li>/gi;

function normalizeArtistName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parsePerformersFromJsonLd(node: Record<string, unknown>): string[] | undefined {
  const performers = node.performer;
  const names: string[] = [];

  const pushName = (value: unknown) => {
    if (!value) return;
    if (typeof value === 'string') {
      if (!isTicketIoPlaceholderArtist(value)) {
        names.push(value.trim());
      }
      return;
    }
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>;
      const name = record.name ? String(record.name) : '';
      if (name && !isTicketIoPlaceholderArtist(name)) {
        names.push(name.trim());
      }
    }
  };

  if (Array.isArray(performers)) {
    for (const performer of performers) {
      pushName(performer);
    }
  } else {
    pushName(performers);
  }

  return sanitizeTicketIoArtistNames(expandSegmentedLineupNames(names));
}

function parseLineupFromHtml(html: string): string[] | undefined {
  const sectionMatch = html.match(LINEUP_SECTION_PATTERN);
  if (!sectionMatch?.[1]) {
    return undefined;
  }

  const names: string[] = [];
  let itemMatch: RegExpExecArray | null;
  const itemPattern = new RegExp(LINEUP_LIST_ITEM_PATTERN.source, 'gi');
  while ((itemMatch = itemPattern.exec(sectionMatch[1])) !== null) {
    const text = stripHtml(decodeHtmlEntities(itemMatch[1] ?? ''));
    if (text && !isTicketIoPlaceholderArtist(text)) {
      names.push(text);
    }
  }

  return sanitizeTicketIoArtistNames(names);
}

function parseOffersFromJsonLd(node: Record<string, unknown>): TicketIoTicketOffer[] {
  const offers = node.offers;
  const rawOffers = Array.isArray(offers) ? offers : offers ? [offers] : [];
  const parsed: TicketIoTicketOffer[] = [];

  for (const offer of rawOffers) {
    if (!offer || typeof offer !== 'object') {
      continue;
    }
    const record = offer as Record<string, unknown>;
    const availability = record.availability ? String(record.availability) : undefined;
    const availabilityToken = availability?.split('/').pop()?.toLowerCase();
    const soldOut = availabilityToken === 'soldout' || availabilityToken === 'outofstock';
    const priceAmount =
      record.price !== undefined
        ? Number(record.price)
        : record.lowPrice !== undefined
          ? Number(record.lowPrice)
          : undefined;

    parsed.push({
      name: record.name ? String(record.name) : 'Ticket',
      priceAmount: Number.isFinite(priceAmount) ? priceAmount : undefined,
      priceCurrency: record.priceCurrency ? String(record.priceCurrency) : 'EUR',
      availability: availabilityToken,
      soldOut,
      purchaseUrl: record.url ? String(record.url) : undefined,
      validFrom: record.validFrom ? String(record.validFrom) : undefined,
      validUntil: record.validThrough ? String(record.validThrough) : undefined,
    });
  }

  return parsed;
}

function buildLineupEntries(
  artistNames: string[],
  source: TicketIoLineupEntry['source'],
  confidence: number,
): TicketIoLineupEntry[] {
  return artistNames.map((displayName) => ({
    displayName,
    normalizedName: normalizeArtistName(displayName),
    source,
    confidence,
  }));
}

function mergeArtistNames(...groups: Array<string[] | undefined>): string[] | undefined {
  const merged: string[] = [];
  for (const group of groups) {
    if (!group) continue;
    for (const name of group) {
      if (!merged.some((existing) => normalizeArtistName(existing) === normalizeArtistName(name))) {
        merged.push(name);
      }
    }
  }
  return sanitizeTicketIoArtistNames(merged);
}

export function parseTicketIoDetailHtml(
  html: string,
  fallbackTitle?: string,
): TicketIoDetailEnrichment {
  let description: string | undefined;
  let jsonLdArtists: string[] | undefined;
  let ticketOffers: TicketIoTicketOffer[] = [];
  let priceAmount: number | undefined;
  let priceCurrency = 'EUR';
  let availability: string | undefined;
  let soldOut = false;

  for (const block of extractJsonLdBlocks(html)) {
    for (const node of collectJsonLdNodes(block)) {
      const parsed = parseJsonLdEvent(node);
      const fields = parsed.fields;
      const rawDescription = fields.description ? String(fields.description) : undefined;
      if (rawDescription && !isTicketIoPlaceholderDescription(rawDescription)) {
        description = stripHtml(decodeHtmlEntities(rawDescription));
      }

      jsonLdArtists = mergeArtistNames(jsonLdArtists, parsePerformersFromJsonLd(node));
      const offers = parseOffersFromJsonLd(node);
      if (offers.length > 0) {
        ticketOffers = offers;
        const primary = offers[0];
        if (primary) {
          priceAmount = primary.priceAmount;
          priceCurrency = primary.priceCurrency ?? 'EUR';
          availability = primary.availability;
          soldOut = offers.every((offer) => offer.soldOut);
        }
      }
    }
  }

  const htmlArtists = parseLineupFromHtml(html);
  const descriptionArtists = extractLineupNamesFromDescriptionText(description);
  const runningOrder = extractRunningOrderFromDescriptionText(description, 'ticket_io_description');
  const timetable = extractTimetableFromDescriptionText(description, 'ticket_io_description');
  const textualAttributes = extractAttributesFromDescriptionText(description, 'ticket_io_description');
  const runningOrderNames = runningOrder?.map((entry) => entry.displayName);
  const titleArtists = fallbackTitle ? extractArtistsFromEventTitle(fallbackTitle) : undefined;
  const artistNames = mergeArtistNames(
    jsonLdArtists,
    htmlArtists,
    descriptionArtists,
    runningOrderNames,
    titleArtists,
  );

  const lineupEntries = [
    ...(jsonLdArtists ? buildLineupEntries(jsonLdArtists, 'json_ld', 0.9) : []),
    ...(htmlArtists ? buildLineupEntries(htmlArtists, 'html_lineup', 0.95) : []),
    ...(descriptionArtists
      ? buildLineupEntries(descriptionArtists, 'html_lineup', 0.85)
      : []),
    ...(titleArtists
      ? buildLineupEntries(
          titleArtists.filter(
            (name) =>
              !jsonLdArtists?.some(
                (existing) => normalizeArtistName(existing) === normalizeArtistName(name),
              ) &&
              !htmlArtists?.some(
                (existing) => normalizeArtistName(existing) === normalizeArtistName(name),
              ),
          ),
          'title',
          0.6,
        )
      : []),
  ];

  const classification = classifyTicketIoDetailHtml(html);
  if (classification.detailFetchStatus === 'pow_challenge') {
    return { blockedByPow: true };
  }

  const { admissionProducts } = partitionTicketIoAdmissionProducts(ticketOffers);
  const effectiveOffers = admissionProducts.length > 0 ? admissionProducts : ticketOffers;

  const allPrices = effectiveOffers
    .map((offer) => offer.priceAmount)
    .filter((value): value is number => value !== undefined && Number.isFinite(value));
  const availablePrices = effectiveOffers
    .filter((offer) => !offer.soldOut && offer.priceAmount !== undefined)
    .map((offer) => offer.priceAmount as number);
  const lowestPrice =
    availablePrices.length > 0
      ? Math.min(...availablePrices)
      : allPrices.length > 0
        ? Math.min(...allPrices)
        : priceAmount;

  return {
    description: sanitizeTicketIoDescription(description),
    artistNames,
    lineupEntries: lineupEntries.length > 0 ? lineupEntries : undefined,
    ticketOffers: effectiveOffers.length > 0 ? effectiveOffers : undefined,
    priceAmount: lowestPrice,
    priceCurrency,
    priceText: soldOut
      ? 'Ausverkauft'
      : formatGermanTicketPrice(lowestPrice, priceCurrency),
    availability,
    soldOut,
    blockedByPow: false,
    eventAttributes: textualAttributes.attributes.length > 0 ? textualAttributes.attributes : undefined,
    minimumAge: textualAttributes.minimumAge,
    doorsOpenAt: textualAttributes.doorsOpenAt,
    floorCount: textualAttributes.floorCount,
    venueEnvironment: textualAttributes.venueEnvironment,
    runningOrder,
    timetable,
  };
}
