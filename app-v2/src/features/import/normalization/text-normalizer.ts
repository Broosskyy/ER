import { FIELD_LIMITS } from '@/features/import/config/import-config';
import { meaningfulEventText } from '@/features/events/domain/event-field-value';

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
  '&Auml;': 'Ä',
  '&auml;': 'ä',
  '&Aring;': 'Å',
  '&aring;': 'å',
  '&AElig;': 'Æ',
  '&aelig;': 'æ',
  '&Ccedil;': 'Ç',
  '&ccedil;': 'ç',
  '&Euml;': 'Ë',
  '&euml;': 'ë',
  '&Iuml;': 'Ï',
  '&iuml;': 'ï',
  '&Ntilde;': 'Ñ',
  '&ntilde;': 'ñ',
  '&Ouml;': 'Ö',
  '&ouml;': 'ö',
  '&Oslash;': 'Ø',
  '&oslash;': 'ø',
  '&Uuml;': 'Ü',
  '&uuml;': 'ü',
  '&szlig;': 'ß',
  '&Yuml;': 'Ÿ',
  '&yuml;': 'ÿ',
  '&ndash;': '–',
  '&mdash;': '—',
  '&lsquo;': '\u2018',
  '&rsquo;': '\u2019',
  '&ldquo;': '\u201C',
  '&rdquo;': '\u201D',
  '&bdquo;': '\u201E',
  '&sbquo;': '\u201A',
  '&hellip;': '…',
  '&bull;': '•',
  '&middot;': '·',
  '&copy;': '©',
  '&reg;': '®',
  '&trade;': '™',
  '&euro;': '€',
  '&pound;': '£',
  '&cent;': '¢',
  '&yen;': '¥',
  '&frac12;': '½',
  '&frac14;': '¼',
  '&frac34;': '¾',
};

export function decodeHtmlEntities(value: string): string {
  let result = value;
  let prev = '';
  while (prev !== result) {
    prev = result;
    result = result.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match) => {
      if (HTML_ENTITY_MAP[match]) return HTML_ENTITY_MAP[match];
      if (match.startsWith('&#x')) {
        const code = Number.parseInt(match.slice(3, -1), 16);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      if (match.startsWith('&#')) {
        const code = Number.parseInt(match.slice(2, -1), 10);
        return Number.isFinite(code) ? String.fromCodePoint(code) : match;
      }
      return match;
    });
  }
  return result;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeText(value: unknown, maxLength = FIELD_LIMITS.field): string | undefined {
  if (value === null || value === undefined) return undefined;
  const text = decodeHtmlEntities(stripHtml(String(value)))
    .replace(/\0/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const meaningful = meaningfulEventText(text);
  if (!meaningful) return undefined;
  if (meaningful.length > maxLength) {
    return meaningful.slice(0, maxLength);
  }
  return meaningful;
}

export function normalizeStringList(value: unknown): string[] | undefined {
  if (value === null || value === undefined) return undefined;
  const items: string[] = [];
  const source = Array.isArray(value) ? value : String(value).split(/[,;|]/);
  for (const entry of source) {
    const normalized = normalizeText(entry, FIELD_LIMITS.field);
    if (normalized) {
      items.push(normalized);
    }
  }
  return items.length > 0 ? [...new Set(items)] : undefined;
}

export function sanitizeCsvFormula(value: string): string {
  if (/^[=+\-@]/.test(value)) {
    return `'${value}`;
  }
  return value;
}
