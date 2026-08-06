import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

import { normalizeCanonicalEventDescription } from '@/features/import/domain/canonical-description-normalizer';

export interface RemovedDescriptionBlock {
  text: string;
  reason: string;
}

export interface DescriptionBoundaryResult {
  rawBlocks: string[];
  contentBlocks: string[];
  removedBlocks: RemovedDescriptionBlock[];
  cleanedText: string;
  normalizedDescription?: string;
  boundaryFound: boolean;
}

const DIVIDER_ONLY = /^[\s▔━─\-_=]{6,}$/;
const INLINE_DIVIDER = /[\s▔━─\-_=]{8,}/;
const AGE_RESTRICTION =
  /^(?:einlass ab \d+\s*(?:jahren|years)|age for admission \d+\s*years?|mindestalter|minimum age)/i;
const VENUE_ADDRESS_FOOTER =
  /^[A-Za-zÀ-ÿ0-9 .&'-]+\s*\/\s*[A-Za-zÀ-ÿ0-9 .,'-]+\s*\/\s*\d{4,5}\s+[A-Za-zÀ-ÿ]/i;
const MOBILE_APP = /^(?:bootshaus )?mobile app\s*:?$/i;
const MERCHANDISE = /^bootshaus merchandise$/i;
const BITLY = /bit\.ly\//i;
const PROVIDER_HOMEPAGE = /^www\.[a-z0-9-]+\.(?:tv|de|com|info)$/i;
const LINEUP_TBA_ONLY = /^lineup\s+tba$/i;

function decodeBlockText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])\s*>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/gi, ' ')
      .replace(/\u00a0/g, ' '),
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitInlineDivider(block: string): string[] {
  const match = block.match(INLINE_DIVIDER);
  if (!match || match.index === undefined || match.index <= 0) {
    return [block];
  }
  const before = block.slice(0, match.index).trim();
  const after = block.slice(match.index).trim();
  return [before, after].filter(Boolean);
}

export function extractParagraphBlocksFromHtml(html: string): string[] {
  const blocks: string[] = [];
  const patterns = [
    /<div[^>]*class="[^"]*event-description-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<button[^>]*class="[^"]*event-description-toggle/i,
    /<div[^>]*class="[^"]*ecm-event-single__content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*(?:<\/div>|<section[^>]*class="[^"]*ecm-event-single__tickets)/i,
    /<div[^>]*class="[^"]*tribe-events-single-event-description[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const inner = match[1];
    const paragraphMatches = inner.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
    let found = false;
    for (const p of paragraphMatches) {
      const text = decodeBlockText(p[1] ?? '');
      if (text) {
        for (const part of splitInlineDivider(text)) {
          if (part.trim()) blocks.push(part.trim());
        }
        found = true;
      }
    }
    if (!found) {
      const text = decodeBlockText(inner);
      if (text) {
        for (const line of text.split('\n')) {
          const trimmed = line.trim();
          if (trimmed) blocks.push(trimmed);
        }
      }
    }
    if (blocks.length > 0) break;
  }

  return blocks;
}

export function classifyBoilerplateBlock(block: string): RemovedDescriptionBlock | null {
  const trimmed = block.trim();
  if (!trimmed) return { text: block, reason: 'empty_block' };

  if (DIVIDER_ONLY.test(trimmed)) {
    return { text: trimmed, reason: 'decorative_divider' };
  }
  if (AGE_RESTRICTION.test(trimmed)) {
    return { text: trimmed, reason: 'age_restriction_footer' };
  }
  if (VENUE_ADDRESS_FOOTER.test(trimmed)) {
    return { text: trimmed, reason: 'venue_address_footer' };
  }
  if (MOBILE_APP.test(trimmed)) {
    return { text: trimmed, reason: 'mobile_app_promotion' };
  }
  if (MERCHANDISE.test(trimmed)) {
    return { text: trimmed, reason: 'merchandise_promotion' };
  }
  if (BITLY.test(trimmed)) {
    return { text: trimmed, reason: 'promotional_link' };
  }
  if (PROVIDER_HOMEPAGE.test(trimmed)) {
    return { text: trimmed, reason: 'provider_homepage_footer' };
  }
  if (/^https?:\/\//i.test(trimmed) && BITLY.test(trimmed)) {
    return { text: trimmed, reason: 'promotional_link' };
  }
  if (/snash\.com/i.test(trimmed)) {
    return { text: trimmed, reason: 'merchandise_promotion' };
  }
  if (/^bootshaus mobile app/i.test(trimmed)) {
    return { text: trimmed, reason: 'mobile_app_promotion' };
  }

  return null;
}

export function applyDescriptionBoundaries(rawBlocks: string[]): DescriptionBoundaryResult {
  const contentBlocks: string[] = [];
  const removedBlocks: RemovedDescriptionBlock[] = [];
  let boundaryFound = false;

  for (const block of rawBlocks) {
    if (boundaryFound) {
      removedBlocks.push({ text: block, reason: 'after_footer_boundary' });
      continue;
    }

    const boilerplate = classifyBoilerplateBlock(block);
    if (boilerplate) {
      removedBlocks.push(boilerplate);
      boundaryFound = true;
      continue;
    }

    const inlineParts = splitInlineDivider(block);
    if (inlineParts.length > 1) {
      const [content, ...footerParts] = inlineParts;
      if (content) contentBlocks.push(content);
      for (const part of footerParts) {
        removedBlocks.push({ text: part, reason: 'inline_divider_footer' });
      }
      boundaryFound = true;
      continue;
    }

    contentBlocks.push(block);
  }

  const cleanedText = contentBlocks.join('\n\n').trim();
  const normalizedDescription = cleanedText
    ? normalizeCanonicalEventDescription(cleanedText)
    : undefined;

  return {
    rawBlocks,
    contentBlocks,
    removedBlocks,
    cleanedText,
    normalizedDescription,
    boundaryFound,
  };
}

export function extractDescriptionBoundariesFromHtml(html: string): DescriptionBoundaryResult {
  const rawBlocks = extractParagraphBlocksFromHtml(html);
  if (rawBlocks.length === 0) {
    return {
      rawBlocks: [],
      contentBlocks: [],
      removedBlocks: [],
      cleanedText: '',
      boundaryFound: false,
    };
  }
  return applyDescriptionBoundaries(rawBlocks);
}

export function isLineupTbaBlock(block: string): boolean {
  return LINEUP_TBA_ONLY.test(block.trim()) || /\blineup\s+tba\b/i.test(block);
}

/** @deprecated Use extractDescriptionBoundariesFromHtml */
export function stripDescriptionBoilerplate(value: string): { text: string; stripped: boolean } {
  const blocks = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const result = applyDescriptionBoundaries(blocks);
  return {
    text: result.normalizedDescription ?? result.cleanedText,
    stripped: result.removedBlocks.length > 0,
  };
}

export function finalizeEventDescription(rawHtmlOrText: string): string | undefined {
  if (rawHtmlOrText.includes('<')) {
    const result = extractDescriptionBoundariesFromHtml(rawHtmlOrText);
    return result.normalizedDescription;
  }
  const blocks = rawHtmlOrText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const result = applyDescriptionBoundaries(blocks);
  return result.normalizedDescription;
}
