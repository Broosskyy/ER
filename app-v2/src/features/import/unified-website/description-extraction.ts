import { decodeHtmlEntities, normalizeText } from '@/features/import/normalization/text-normalizer';

import {
  extractDescriptionBoundariesFromHtml,
  extractParagraphBlocksFromHtml,
} from './description-boundaries';
import { extractLineupFromContentBlocks } from './lineup-extraction';
import { readMetaContent } from './html-meta';
import type { DescriptionBodySource, DescriptionExtractionResult } from './types';

const SHORT_META_PATTERN = /^(doors:\s*\d|einlass|start:\s*\d|uhr\s*\d)/i;
const CONTAMINATION_PATTERN =
  /impressum|datenschutz|newsletter|cookie|ecm-event-share|site-footer|primary-menu|tablebooking/i;

function isUsableDescription(text: string | undefined, minLength = 40): text is string {
  if (!text?.trim()) return false;
  const normalized = text.trim();
  if (normalized.length < minLength && SHORT_META_PATTERN.test(normalized)) return false;
  if (CONTAMINATION_PATTERN.test(normalized)) return false;
  return normalized.length >= minLength || (!SHORT_META_PATTERN.test(normalized) && normalized.length >= 20);
}

function extractJsonLdDescription(html: string): string | undefined {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const body = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '');
    if (!/"@type"\s*:\s*"Event"/i.test(body)) continue;
    const descMatch = body.match(/"description"\s*:\s*"([^"]+)"/i);
    const raw = descMatch?.[1];
    if (!raw || raw.length < 3) continue;
    const decoded = normalizeText(decodeHtmlEntities(raw), 50_000);
    if (isUsableDescription(decoded, 40)) return decoded;
  }
  return undefined;
}

function extractFromHtmlBody(html: string, source: DescriptionBodySource): DescriptionExtractionResult | undefined {
  const boundaries = extractDescriptionBoundariesFromHtml(html);
  if (boundaries.contentBlocks.length === 0) {
    return undefined;
  }
  const description = boundaries.normalizedDescription ?? boundaries.cleanedText;
  if (!isUsableDescription(description, 20)) {
    return undefined;
  }
  return {
    description,
    source,
    contaminationRejected: false,
    boilerplateStripped: boundaries.removedBlocks.length > 0,
    boundaries,
  };
}

/**
 * Prefer visible event body (event-description-content, ECM) over og:description.
 */
export function extractEventDescription(html: string): DescriptionExtractionResult {
  if (
    CONTAMINATION_PATTERN.test(html) &&
    !html.includes('ecm-event-single') &&
    !html.includes('event-description-content')
  ) {
    return { source: 'none', contaminationRejected: true, boilerplateStripped: false };
  }

  if (html.includes('event-description-content')) {
    const body = extractFromHtmlBody(html, 'event_description_content');
    if (body) return body;
  }

  if (html.includes('ecm-event-single__content')) {
    const body = extractFromHtmlBody(html, 'event_body_ecm');
    if (body) return body;
  }

  if (html.includes('tribe-events-single-event-description')) {
    const body = extractFromHtmlBody(html, 'event_description_content');
    if (body) return body;
  }

  const jsonLd = extractJsonLdDescription(html);
  if (jsonLd) {
    const blocks = jsonLd.split('\n').map((l) => l.trim()).filter(Boolean);
    const boundaries = extractDescriptionBoundariesFromHtml(
      blocks.map((b) => `<p>${b}</p>`).join(''),
    );
    return {
      description: boundaries.normalizedDescription ?? jsonLd,
      source: 'json_ld',
      contaminationRejected: false,
      boilerplateStripped: boundaries.removedBlocks.length > 0,
      boundaries,
    };
  }

  const og = readMetaContent(html, 'og:description');
  if (og && isUsableDescription(normalizeText(og, 50_000), 40)) {
    const raw = normalizeText(og, 50_000)!;
    const boundaries = extractDescriptionBoundariesFromHtml(
      raw.split('\n').map((b) => `<p>${b}</p>`).join(''),
    );
    return {
      description: boundaries.normalizedDescription ?? raw,
      source: 'og_meta',
      contaminationRejected: false,
      boilerplateStripped: boundaries.removedBlocks.length > 0,
      boundaries,
    };
  }

  const meta = readMetaContent(html, 'description');
  if (meta && isUsableDescription(normalizeText(meta, 50_000), 40)) {
    const raw = normalizeText(meta, 50_000)!;
    return {
      description: raw,
      source: 'meta_description',
      contaminationRejected: false,
      boilerplateStripped: false,
    };
  }

  const rejectedShort = og ?? meta;
  if (rejectedShort && SHORT_META_PATTERN.test(rejectedShort.trim())) {
    return {
      source: 'none',
      rejectedShortMeta: rejectedShort,
      contaminationRejected: false,
      boilerplateStripped: false,
    };
  }

  if (rejectedShort && CONTAMINATION_PATTERN.test(rejectedShort)) {
    return { source: 'none', contaminationRejected: true, boilerplateStripped: false };
  }

  return { source: 'none', contaminationRejected: false, boilerplateStripped: false };
}

export function extractLineupFromDescriptionHtml(html: string) {
  const blocks =
    extractDescriptionBoundariesFromHtml(html).contentBlocks.length > 0
      ? extractDescriptionBoundariesFromHtml(html).contentBlocks
      : extractParagraphBlocksFromHtml(html);
  return extractLineupFromContentBlocks(blocks);
}

/** @deprecated Use DescriptionBodySource */
export type LegacyDescriptionSource = DescriptionBodySource | 'event_body_bootshaus';

export function mapDescriptionSourceForLegacy(
  source: DescriptionBodySource,
): LegacyDescriptionSource {
  if (source === 'event_description_content') {
    return 'event_body_bootshaus';
  }
  return source;
}
