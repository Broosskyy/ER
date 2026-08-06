import {
  collectJsonLdNodes,
  extractJsonLdBlocks,
  parseJsonLdEvent,
} from '@/features/import/adapters/parsers/json-ld-parser';
import { decodeHtmlEntities, stripHtml } from '@/features/import/normalization/text-normalizer';
import { expandLineupLine } from '@/features/aggregation/domain/lineup-billing-parser';
import { extractLineupNamesFromDescriptionText } from '@/features/aggregation/domain/lineup-text-parser';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';

import type { StructuredLineupEntry } from '@/features/aggregation/domain/structured-lineup';
import type { SourcedEventAttribute } from '@/features/aggregation/domain/event-structured-detail';

export const TICKET_KINGS_DETAIL_PARSER_VERSION = 'ticket-kings-detail-v1';

const LINEUP_SECTION_PATTERN =
  /<strong>\s*line\s*up\s*:?\s*<\/strong>[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/i;
const LINEUP_BR_SECTION_PATTERN =
  /line\s*up[^<]*(?:<\/[^>]+>)?\s*(?:<br\s*\/?>|\n)+([\s\S]*?)(?:<\/p>\s*<p>\s*LOCATION:|<\/p>\s*<p>\s*<iframe|LOCATION:|<\/p>\s*<ol|$)/i;
const LINEUP_LIST_ITEM_PATTERN = /<li[^>]*>([\s\S]*?)<\/li>/gi;
const ORDERED_ATTRIBUTE_PATTERN =
  /<ol[^>]*>([\s\S]*?)<\/ol>/gi;
const ORDERED_ATTRIBUTE_ITEM_PATTERN = /<li[^>]*>\s*<strong>([^<]+)<\/strong>/gi;
const LABELED_FIELD_PATTERN = /<strong>\s*([^<]+?)\s*<\/strong>\s*:?\s*([^<]+)/gi;
const FLOOR_COUNT_PATTERN = /(\d+)\s*floors?/i;
const INDOOR_OUTDOOR_PATTERN = /\b(in\s*&\s*outdoor|indoor\s*\/\s*outdoor|in\s+und\s+outdoor)\b/i;
const RELATED_EVENTS_SECTION_PATTERN =
  /<h2[^>]*class="[^"]*tribe-events-related-events-title[^"]*"[\s\S]*$/i;

/** Remove Tribe Events "Ähnliche Veranstaltungen" sidebar so related event titles are never parsed as lineup. */
export function stripTicketKingsRelatedEventsSidebar(html: string): string {
  return html.replace(RELATED_EVENTS_SECTION_PATTERN, '');
}

export interface TicketKingsDetailEnrichment {
  description?: string;
  artistNames?: string[];
  lineupEntries?: StructuredLineupEntry[];
  genreNames?: string[];
  eventAttributes?: SourcedEventAttribute[];
  floorCount?: number;
  venueEnvironment?: 'indoor' | 'outdoor' | 'hybrid';
  minimumAge?: string;
  doorsOpenAt?: string;
  priceAmount?: number;
  priceCurrency?: string;
  checkoutProviderId?: string;
  fieldCoverage: string[];
}

function normalizeArtistName(name: string): string {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parsePerformerField(performer: unknown): string[] | undefined {
  if (!performer) {
    return undefined;
  }
  if (typeof performer === 'string') {
    const trimmed = performer.trim();
    if (!trimmed || /^organization$/i.test(trimmed)) {
      return undefined;
    }
    return sanitizeLineupArtistNames([trimmed]);
  }
  if (Array.isArray(performer)) {
    const names: string[] = [];
    for (const item of performer) {
      const group = parsePerformerField(item);
      if (group) {
        names.push(...group);
      }
    }
    return sanitizeLineupArtistNames(names);
  }
  if (typeof performer === 'object') {
    const record = performer as Record<string, unknown>;
    const typeValue = record['@type'];
    const types = Array.isArray(typeValue)
      ? typeValue.map(String)
      : typeValue
        ? [String(typeValue)]
        : [];
    if (types.some((type) => /organization/i.test(type))) {
      return undefined;
    }
    const name = record.name ? String(record.name) : '';
    if (!name || /^organization$/i.test(name.trim())) {
      return undefined;
    }
    return sanitizeLineupArtistNames([name.trim()]);
  }
  return undefined;
}

function detectLineupRoles(displayName: string): Pick<
  StructuredLineupEntry,
  'isB2b' | 'isF2f' | 'isLiveSet' | 'role'
> {
  const upper = displayName.toUpperCase();
  const isB2b = /\bB2B\b/.test(upper);
  const isF2f = /\bF2F\b/.test(upper);
  const isLiveSet = /\bLIVE\b/.test(upper) && !/\bLIVESET\b/.test(upper);
  let role: string | undefined;
  if (isB2b) role = 'b2b';
  else if (isF2f) role = 'f2f';
  else if (isLiveSet) role = 'live';
  return { isB2b, isF2f, isLiveSet, role };
}

function buildLineupEntriesFromNames(names: string[]): StructuredLineupEntry[] {
  const entries: StructuredLineupEntry[] = [];
  let sortOrder = 0;
  for (const displayName of names) {
    const roles = detectLineupRoles(displayName);
    entries.push({
      displayName,
      normalizedName: normalizeArtistName(displayName),
      ...roles,
      source: 'html_lineup',
      confidence: 0.95,
      sortOrder,
    });
    sortOrder += 1;
  }
  return entries;
}

function parseLineupFromBrSection(html: string): StructuredLineupEntry[] {
  const sectionMatch = html.match(LINEUP_BR_SECTION_PATTERN);
  if (!sectionMatch?.[1]) {
    return [];
  }
  const rawBlock = sectionMatch[1];
  const names = rawBlock
    .split(/<br\s*\/?>/i)
    .map((part) => stripHtml(decodeHtmlEntities(part)).trim())
    .filter(Boolean);
  const expanded = names.flatMap((line) => expandLineupLine(line).map((entry) => entry.displayName));
  const cleaned = sanitizeLineupArtistNames(expanded) ?? [];
  return buildLineupEntriesFromNames(cleaned);
}

function parseLineupFromHtml(html: string): StructuredLineupEntry[] {
  const sectionMatch = html.match(LINEUP_SECTION_PATTERN);
  if (!sectionMatch?.[1]) {
    return parseLineupFromBrSection(html);
  }

  const entries: StructuredLineupEntry[] = [];
  let itemMatch: RegExpExecArray | null;
  const itemPattern = new RegExp(LINEUP_LIST_ITEM_PATTERN.source, 'gi');
  let sortOrder = 0;

  while ((itemMatch = itemPattern.exec(sectionMatch[1])) !== null) {
    const displayName = stripHtml(decodeHtmlEntities(itemMatch[1] ?? ''));
    const expanded = expandLineupLine(displayName);
    const cleaned = sanitizeLineupArtistNames(
      expanded.length > 0 ? expanded.map((entry) => entry.displayName) : [displayName],
    );
    if (!cleaned?.length) {
      continue;
    }
    for (const finalName of cleaned) {
      const expandedEntry = expanded.find(
        (entry) => entry.displayName.toLowerCase() === finalName.toLowerCase(),
      );
      const roles = expandedEntry
        ? {
            isB2b: expandedEntry.isB2b,
            isF2f: expandedEntry.isF2f,
            isLiveSet: expandedEntry.isLiveSet,
            role: expandedEntry.role,
          }
        : detectLineupRoles(finalName);
      entries.push({
        displayName: finalName,
        normalizedName: normalizeArtistName(finalName),
        ...roles,
        source: 'html_lineup',
        confidence: 0.95,
        sortOrder,
      });
      sortOrder += 1;
    }
  }

  if (entries.length > 0) {
    return entries;
  }
  return parseLineupFromBrSection(html);
}

function parseLabeledFields(html: string): Partial<TicketKingsDetailEnrichment> {
  const result: Partial<TicketKingsDetailEnrichment> = {
    genreNames: [],
    eventAttributes: [],
    fieldCoverage: [],
  };
  const genres: string[] = [];
  const attributes: SourcedEventAttribute[] = [];

  let match: RegExpExecArray | null;
  const pattern = new RegExp(LABELED_FIELD_PATTERN.source, 'gi');
  while ((match = pattern.exec(html)) !== null) {
    const label = stripHtml(match[1] ?? '').trim().toLowerCase();
    const value = stripHtml(decodeHtmlEntities(match[2] ?? '')).trim();
    if (!label || !value) {
      continue;
    }

    if (/^genre/.test(label)) {
      const split = value.split(/[,;/|]/).map((g) => g.trim()).filter(Boolean);
      genres.push(...split);
      result.fieldCoverage?.push('genres');
      continue;
    }

    if (/^mindestalter|^age|^alter/.test(label)) {
      result.minimumAge = value;
      result.fieldCoverage?.push('minimumAge');
      continue;
    }

    if (/^einlass|^doors|^beginn/.test(label)) {
      result.doorsOpenAt = value;
      result.fieldCoverage?.push('doorsOpenAt');
      continue;
    }

    if (/^indoor|^outdoor|^location|^ort/.test(label)) {
      if (INDOOR_OUTDOOR_PATTERN.test(value)) {
        result.venueEnvironment = 'hybrid';
        attributes.push({
          key: 'indoor',
          label: 'Indoor / Outdoor',
          source: 'html_lineup',
          confidence: 0.9,
        });
        result.fieldCoverage?.push('venueEnvironment');
      } else if (/outdoor|open\s*air/i.test(value)) {
        result.venueEnvironment = 'outdoor';
        attributes.push({
          key: 'outdoor',
          label: 'Outdoor',
          source: 'html_lineup',
          confidence: 0.9,
        });
      } else if (/indoor/i.test(value)) {
        result.venueEnvironment = 'indoor';
        attributes.push({
          key: 'indoor',
          label: 'Indoor',
          source: 'html_lineup',
          confidence: 0.9,
        });
      }
    }
  }

  const floorMatch = html.match(FLOOR_COUNT_PATTERN);
  if (floorMatch?.[1]) {
    const floorCount = Number.parseInt(floorMatch[1], 10);
    if (Number.isFinite(floorCount)) {
      result.floorCount = floorCount;
      attributes.push({
        key: 'multi_floor',
        label: `${floorCount} Floors`,
        value: floorCount,
        source: 'html_lineup',
        confidence: 0.85,
      });
      result.fieldCoverage?.push('floorCount');
    }
  }

  let orderedMatch: RegExpExecArray | null;
  const orderedPattern = new RegExp(ORDERED_ATTRIBUTE_PATTERN.source, 'gi');
  while ((orderedMatch = orderedPattern.exec(html)) !== null) {
    const block = orderedMatch[1] ?? '';
    let itemMatch: RegExpExecArray | null;
    const itemPattern = new RegExp(ORDERED_ATTRIBUTE_ITEM_PATTERN.source, 'gi');
    while ((itemMatch = itemPattern.exec(block)) !== null) {
      const value = stripHtml(decodeHtmlEntities(itemMatch[1] ?? '')).trim();
      if (!value) {
        continue;
      }
      if (INDOOR_OUTDOOR_PATTERN.test(value)) {
        result.venueEnvironment = 'hybrid';
        attributes.push({
          key: 'indoor',
          label: 'Indoor / Outdoor',
          source: 'html_lineup',
          confidence: 0.9,
        });
        result.fieldCoverage?.push('venueEnvironment');
        continue;
      }
      const floorItemMatch = value.match(FLOOR_COUNT_PATTERN);
      if (floorItemMatch?.[1]) {
        const floorCount = Number.parseInt(floorItemMatch[1], 10);
        if (Number.isFinite(floorCount)) {
          result.floorCount = floorCount;
          attributes.push({
            key: 'multi_floor',
            label: `${floorCount} Floors`,
            value: floorCount,
            source: 'html_lineup',
            confidence: 0.85,
          });
          result.fieldCoverage?.push('floorCount');
        }
        continue;
      }
      if (/techno|bounce|hardtechno|house|trance/i.test(value)) {
        value.split(/[,;/|]/).forEach((genre) => {
          const trimmed = genre.trim();
          if (trimmed) {
            genres.push(trimmed);
          }
        });
        result.fieldCoverage?.push('genres');
      }
    }
  }

  if (genres.length > 0) {
    result.genreNames = [...new Set(genres.map((g) => g.trim()).filter(Boolean))];
  }
  if (attributes.length > 0) {
    result.eventAttributes = attributes;
  }

  return result;
}

function extractCheckoutProviderId(html: string): string | undefined {
  const match = html.match(/native_event\.php\?id=(\d+)/i);
  return match?.[1];
}

function extractPriceFromHtml(html: string): { priceAmount?: number; priceCurrency?: string } {
  const eintrittMatch = html.match(/Eintritt:\s*([\d.,]+)\s*€/i);
  if (eintrittMatch?.[1]) {
    const priceAmount = Number(eintrittMatch[1].replace(',', '.'));
    if (Number.isFinite(priceAmount)) {
      return { priceAmount, priceCurrency: 'EUR' };
    }
  }

  const abMatch = html.match(/(?:ab|from)\s*([\d.,]+)\s*€/i);
  if (abMatch?.[1]) {
    const priceAmount = Number.parseFloat(abMatch[1].replace(',', '.'));
    if (Number.isFinite(priceAmount)) {
      return { priceAmount, priceCurrency: 'EUR' };
    }
  }

  const cardMatch = html.match(/(?:ticket|release)[^<]{0,120}?([\d.,]+)\s*€/i);
  if (cardMatch?.[1]) {
    const priceAmount = Number.parseFloat(cardMatch[1].replace(',', '.'));
    if (Number.isFinite(priceAmount)) {
      return { priceAmount, priceCurrency: 'EUR' };
    }
  }

  return {};
}

export function parseTicketKingsDetailHtml(html: string): TicketKingsDetailEnrichment {
  const sanitizedHtml = stripTicketKingsRelatedEventsSidebar(html);
  const fieldCoverage: string[] = [];
  let description: string | undefined;
  let jsonLdArtists: string[] | undefined;

  for (const block of extractJsonLdBlocks(sanitizedHtml)) {
    for (const node of collectJsonLdNodes(block)) {
      const parsed = parseJsonLdEvent(node);
      const fields = parsed.fields;
      const rawDescription = fields.description ? String(fields.description) : undefined;
      if (rawDescription) {
        description = stripHtml(decodeHtmlEntities(rawDescription));
        fieldCoverage.push('description');
      }
      jsonLdArtists = parsePerformerField((node as Record<string, unknown>).performer);
      if (jsonLdArtists?.length) {
        fieldCoverage.push('json_ld_performers');
      }
    }
  }

  const htmlLineup = parseLineupFromHtml(sanitizedHtml);
  if (htmlLineup.length > 0) {
    fieldCoverage.push('html_lineup');
  }

  const descriptionLineup =
    htmlLineup.length === 0 ? extractLineupNamesFromDescriptionText(description) : undefined;
  if (descriptionLineup?.length) {
    fieldCoverage.push('description_lineup');
  }

  const labeled = parseLabeledFields(sanitizedHtml);
  const labeledCoverage = labeled.fieldCoverage ?? [];
  fieldCoverage.push(...labeledCoverage);

  const lineupEntries =
    htmlLineup.length > 0
      ? htmlLineup
      : descriptionLineup && descriptionLineup.length > 0
        ? descriptionLineup.map((displayName, index) => ({
            displayName,
            normalizedName: normalizeArtistName(displayName),
            ...detectLineupRoles(displayName),
            source: 'html_lineup' as const,
            confidence: 0.85,
            sortOrder: index,
          }))
        : jsonLdArtists?.map((displayName, index) => ({
            displayName,
            normalizedName: normalizeArtistName(displayName),
            source: 'json_ld' as const,
            confidence: 0.8,
            sortOrder: index,
          }));

  const artistNames = sanitizeLineupArtistNames(
    lineupEntries?.map((entry) => entry.displayName) ?? jsonLdArtists,
  );

  const price = extractPriceFromHtml(sanitizedHtml);
  if (price.priceAmount !== undefined) {
    fieldCoverage.push('price');
  }

  const checkoutProviderId = extractCheckoutProviderId(sanitizedHtml);
  if (checkoutProviderId) {
    fieldCoverage.push('checkoutProviderId');
  }

  return {
    description,
    artistNames,
    lineupEntries: lineupEntries && lineupEntries.length > 0 ? lineupEntries : undefined,
    genreNames: labeled.genreNames,
    eventAttributes: labeled.eventAttributes,
    floorCount: labeled.floorCount,
    venueEnvironment: labeled.venueEnvironment,
    minimumAge: labeled.minimumAge,
    doorsOpenAt: labeled.doorsOpenAt,
    priceAmount: price.priceAmount,
    priceCurrency: price.priceCurrency,
    checkoutProviderId,
    fieldCoverage: [...new Set(fieldCoverage)],
  };
}
