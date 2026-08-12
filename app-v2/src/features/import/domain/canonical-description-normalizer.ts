import { meaningfulEventText } from '@/features/events/domain/event-field-value';
import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';

const METADATA_LINE_PATTERN =
  /^(place|ort|location|venue|date|datum|start|end|time|uhrzeit|doors|einlass|adresse|address|ticket|tickets|preis|price|info)\s*:/i;

/** Strip excessive decorative emoji while preserving text content. */
function stripMarketingEmojiSpam(value: string): string {
  return value
    .replace(/([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])\s*([\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}])+/gu, '$1')
    .replace(/^\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/gu, '')
    .trim();
}

function repairEscapedNewlines(value: string): string {
  return value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, ' ');
}

function stripHtmlPreservingLines(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<(br|hr)\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|li)\s*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function stripMetadataLines(value: string): string {
  const result: string[] = [];
  for (const line of value.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      result.push('');
      continue;
    }
    if (!METADATA_LINE_PATTERN.test(trimmed)) {
      result.push(trimmed);
    }
  }
  return result.join('\n');
}

function repairWhitespace(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n\n/g, '\u0000PARA\u0000')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\u0000PARA\u0000/g, '\n\n')
    .trim();
}

/**
 * Single canonical description normalization for import, publish, and display.
 * Preserves meaningful prose; strips marketing noise and broken formatting.
 */
export function normalizeCanonicalEventDescription(
  value: unknown,
  maxLength = 8000,
): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  let text = repairEscapedNewlines(String(value));
  text = text.replace(/\bmain\s*floor\.(?=[A-Z])/gi, 'mainfloor. ');
  text = text.replace(/([a-z])([A-Z][A-Z]{3,}:)/g, '$1 $2');
  text = stripMetadataLines(text);
  text = decodeHtmlEntities(stripHtmlPreservingLines(text));
  text = stripMarketingEmojiSpam(text);
  text = repairWhitespace(text);

  const meaningful = meaningfulEventText(text);
  if (!meaningful) {
    return undefined;
  }

  if (meaningful.length > maxLength) {
    return meaningful.slice(0, maxLength);
  }
  return meaningful;
}
