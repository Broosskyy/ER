import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import { htmlFragmentToStructuredText } from '@/features/aggregation/connectors/website/html-utils';
import {
  expandLineupLine,
  expandSegmentedLineupNames,
  splitLineupTextIntoLines,
} from '@/features/aggregation/domain/lineup-billing-parser';
import { sanitizeLineupArtistNames } from '@/features/events/domain/lineup-artist-quality';

const SECTION_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: 'lineup', pattern: /line[\s-]?up\s*:?\s*/i },
  { key: 'artists_az', pattern: /artists?\s*\(a[–-]z\)\s*:?\s*/i },
  { key: 'artists', pattern: /artists?\s*:?\s*/i },
  { key: 'running_order', pattern: /running\s+order\s*:?\s*/i },
  { key: 'live', pattern: /\blive\s*:?\s*/i },
  { key: 'support', pattern: /\bsupport\s*:?\s*/i },
  { key: 'special_guests', pattern: /special\s+guests?\s*:?\s*/i },
];

const STOP_PATTERN =
  /(?:(?:\n|\s)(?:location|venue|ort|tickets?|einlass|doors|presented\s+by|sponsor|edition|hosted\s+by|running\s+order|time|uhr|faq|info)\s*:|[▔]{4,}|\shttps?:\/\/|\s@\w+)/i;

const REJECT_TOKEN_PATTERNS: RegExp[] = [
  /^(venue|organizer|organiser|sponsor|edition|presented\s+by|location|doors|door|time|tickets?|einlass|faq|info)$/i,
  /^xxx\s+edition$/i,
  /^by\s+/i,
  /^hosted\s+by$/i,
  /^special\s+guests?$/i,
  /^live$/i,
  /^support$/i,
  /^artists?$/i,
  /^line[\s-]?up$/i,
  /^\(a[–-]z\)/i,
  /^&[a-z]+;?$/i,
  /^\d{4}$/,
  /more\s+tba/i,
  /save\s+the\s+date/i,
  /^on:mode/i,
  /^[▔─_]{4,}$/,
];

export function isRejectedLineupToken(token: string): boolean {
  const trimmed = token.trim();
  if (!trimmed) {
    return true;
  }
  return REJECT_TOKEN_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function findSectionBlock(plain: string): { block: string; section: string } | undefined {
  for (const entry of SECTION_PATTERNS) {
    const match = plain.match(entry.pattern);
    if (!match || match.index === undefined) {
      continue;
    }
    const start = match.index + match[0].length;
    const tail = plain.slice(start);
    const stop = tail.search(STOP_PATTERN);
    const block = (stop === -1 ? tail : tail.slice(0, stop)).trim();
    if (block) {
      return { block, section: entry.key };
    }
  }
  return undefined;
}

function tokenizeLineupBlock(block: string): string[] {
  const cleaned = block
    .replace(/\s+location\s*:.*/i, '')
    .replace(/[▔─_]{4,}.*$/s, '')
    .trim();
  const pipeSeparated =
    cleaned.includes('|') && !/\b(?:b2b|f2f|vs\.?)\b/i.test(cleaned)
      ? cleaned
          .split(/\s*\|\s*/)
          .map((part) => part.trim())
          .filter((part) => part.length > 0 && !isRejectedLineupToken(part))
      : [];
  if (pipeSeparated.length >= 2) {
    return expandSegmentedLineupNames(pipeSeparated);
  }
  const lines = splitLineupTextIntoLines(cleaned);
  const sourceLines = lines.length > 0 ? lines : [cleaned];

  const artists: string[] = [];
  for (const line of sourceLines) {
    if (isRejectedLineupToken(line)) {
      continue;
    }
    const hasBilling = /\b(?:b2b|f2f|vs\.?)\b/i.test(line);
    if (!hasBilling && /[,;|]/.test(line)) {
      const commaSplit = line
        .split(/\s*[,;|]\s*/)
        .map((part) => part.trim())
        .filter((part) => part.length > 0 && !isRejectedLineupToken(part));
      artists.push(...commaSplit);
      continue;
    }
    const expanded = expandLineupLine(line);
    if (expanded.length > 0) {
      for (const entry of expanded) {
        const name = entry.displayName;
        if (!/\b(?:b2b|f2f|vs\.?)\b/i.test(name) && /[,;|]/.test(name)) {
          const commaSplit = name
            .split(/\s*[,;|]\s*/)
            .map((part) => part.trim())
            .filter((part) => part.length > 0 && !isRejectedLineupToken(part));
          artists.push(...commaSplit);
        } else {
          artists.push(name);
        }
      }
      continue;
    }
    const commaSplit = line
      .split(/\s*[,;|]\s*/)
      .map((part) => part.trim())
      .filter((part) => part.length > 0 && !isRejectedLineupToken(part));
    artists.push(...commaSplit);
  }

  return expandSegmentedLineupNames(artists);
}

function prepareDescriptionForLineupExtraction(description: string): string {
  const decoded = decodeHtmlEntities(description);
  const structured = htmlFragmentToStructuredText(decoded);
  if (structured.includes('\n')) {
    return structured;
  }
  const withLineupBreak = structured.replace(/(line[\s-]?up\s*:)/gi, '\n$1\n');
  if (withLineupBreak.includes('\n')) {
    return withLineupBreak
      .replace(/[ \t]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .trim();
  }
  if (/\b(?:b2b|f2f|vs\.?)\b/i.test(structured) || /line[\s-]?up\s*:/i.test(structured)) {
    return structured
      .replace(/([a-z])([A-Z])/g, '$1\n$2')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
  return structured.replace(/\s+/g, ' ').trim();
}

/** Extract lineup artist tokens from plain-text or HTML description blocks. */
export function extractLineupNamesFromDescriptionText(
  description: string | undefined,
): string[] | undefined {
  if (!description?.trim()) {
    return undefined;
  }

  const structured = prepareDescriptionForLineupExtraction(description);
  const section = findSectionBlock(structured);
  const block = section?.block;
  if (!block) {
    return undefined;
  }

  const tokens = tokenizeLineupBlock(block);
  return sanitizeLineupArtistNames(tokens);
}

export function extractLineupSectionKey(description: string | undefined): string | undefined {
  if (!description?.trim()) {
    return undefined;
  }
  return findSectionBlock(prepareDescriptionForLineupExtraction(description))?.section;
}
