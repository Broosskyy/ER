import { FIELD_LIMITS } from '@/features/import/config/import-config';

const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&nbsp;': ' ',
};

export function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match) => {
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
  if (!text) return undefined;
  if (text.length > maxLength) {
    return text.slice(0, maxLength);
  }
  return text;
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
