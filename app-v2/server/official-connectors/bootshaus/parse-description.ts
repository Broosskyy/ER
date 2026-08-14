import {
  isFloorOrStageHeader,
  isLineupIntroMarker,
  splitDescriptionAndStructuredLineup,
} from './parse-lineup';

const BOILERPLATE_MARKERS = [
  'einlass ab',
  'age for admission',
  'bootshaus mobile app',
  'bootshaus merchandise',
  'www.bootshaus.tv',
  '▔',
  'ticket-shop',
  'merch-shop',
];

const LINEUP_NOT_ANNOUNCED_PATTERNS = [
  /line\s*-?\s*up.*bald/i,
  /lineup.*soon/i,
  /wird bald angekündigt/i,
  /coming soon/i,
];

const FLOOR_HEADER_PATTERN = /^[A-Z0-9][A-Z0-9\s/&-]{1,40}:$/;
const DECORATIVE_SEPARATOR_PATTERN = /^[▔_\-\s]{6,}$/;

export type RemovedDescriptionBlockCategory =
  | 'footer_address'
  | 'app_promo'
  | 'merch_promo'
  | 'standalone_url'
  | 'ticket_cta'
  | 'age_admission'
  | 'decorative_separator'
  | 'boilerplate'
  | 'lineup_block'
  | 'lineup_not_announced';

export function containsLineupNotAnnouncedSignal(text: string): boolean {
  return LINEUP_NOT_ANNOUNCED_PATTERNS.some((pattern) => pattern.test(text));
}

export function isDecorativeSeparator(text: string): boolean {
  return DECORATIVE_SEPARATOR_PATTERN.test(text.trim());
}

export function isStandaloneUrlParagraph(text: string): boolean {
  const trimmed = text.trim();
  return /^https?:\/\/\S+$/i.test(trimmed) || /^www\.\S+$/i.test(trimmed);
}

export function isAddressFooterParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (/bootshaus\s*\/\s*auenweg/i.test(normalized)) {
    return true;
  }

  return (
    /auenweg\s*173/.test(normalized) &&
    /51063/.test(normalized) &&
    /(köln|cologne|bootshaus)/i.test(normalized)
  );
}

export function isAppPromoParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.includes('bootshaus mobile app') ||
    normalized.includes('bit.ly/bootshaus-app') ||
    normalized === 'app:'
  );
}

export function isMerchPromoParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return (
    normalized.includes('bootshaus merchandise') ||
    normalized.includes('bootshaus merch') ||
    normalized.includes('snash.com') ||
    normalized.includes('merch-shop')
  );
}

export function isTicketCtaParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (/early\s+bird\s+tickets/.test(normalized)) {
    return true;
  }
  if (/tickets.*jetzt\s+verfügbar/.test(normalized)) {
    return true;
  }
  if (/vergünstigten?\s+tickets/.test(normalized)) {
    return true;
  }
  if (/sichert\s+euch/.test(normalized) && /tickets?|shop/.test(normalized)) {
    return true;
  }
  if (/nur\s+für\s+kurze\s+zeit/.test(normalized) && /tickets?/.test(normalized)) {
    return true;
  }

  return (
    normalized.length < 220 &&
    /tickets?/.test(normalized) &&
    /(shop|verfügbar|sichern|sichert)/.test(normalized) &&
    !/[.!?].{40,}/.test(normalized)
  );
}

export function isAgeAdmissionParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  return normalized.includes('einlass ab') || normalized.includes('age for admission');
}

export function isFooterSentinelParagraph(text: string): boolean {
  return (
    isDecorativeSeparator(text) ||
    isAgeAdmissionParagraph(text) ||
    isAddressFooterParagraph(text) ||
    isAppPromoParagraph(text) ||
    isMerchPromoParagraph(text) ||
    isStandaloneUrlParagraph(text)
  );
}

export function classifyForbiddenDescriptionParagraph(
  text: string,
): RemovedDescriptionBlockCategory | null {
  if (isDecorativeSeparator(text)) {
    return 'decorative_separator';
  }
  if (isAgeAdmissionParagraph(text)) {
    return 'age_admission';
  }
  if (isAddressFooterParagraph(text)) {
    return 'footer_address';
  }
  if (isAppPromoParagraph(text)) {
    return 'app_promo';
  }
  if (isMerchPromoParagraph(text)) {
    return 'merch_promo';
  }
  if (isStandaloneUrlParagraph(text)) {
    return 'standalone_url';
  }
  if (isTicketCtaParagraph(text)) {
    return 'ticket_cta';
  }
  if (isBoilerplateParagraph(text)) {
    return 'boilerplate';
  }

  return null;
}

function isSplitBoilerplateParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return BOILERPLATE_MARKERS.some((marker) => normalized.includes(marker));
}

export function isBoilerplateParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (isSplitBoilerplateParagraph(text)) {
    return true;
  }

  return (
    isAddressFooterParagraph(text) ||
    isAppPromoParagraph(text) ||
    isMerchPromoParagraph(text) ||
    isStandaloneUrlParagraph(text) ||
    isTicketCtaParagraph(text) ||
    isDecorativeSeparator(text) ||
    isAgeAdmissionParagraph(text)
  );
}

export function isFloorHeader(text: string): boolean {
  const normalized = text.trim().toUpperCase();
  const withColon = normalized.endsWith(':') ? normalized : `${normalized}:`;
  return FLOOR_HEADER_PATTERN.test(withColon);
}

export function isFloorListHeaderParagraph(text: string): boolean {
  return isFloorOrStageHeader(text);
}

export function truncateDescriptionBeforeStructuredFloorList(paragraphs: string[]): string[] {
  const floorIndex = paragraphs.findIndex(
    (paragraph) => isFloorOrStageHeader(paragraph) || isLineupIntroMarker(paragraph),
  );
  if (floorIndex === -1) {
    return paragraphs;
  }
  return paragraphs.slice(0, floorIndex);
}

export function normalizeDescriptionParagraph(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function stripTrailingFooterParagraphs(paragraphs: string[]): string[] {
  const normalized = paragraphs.map((paragraph) => normalizeDescriptionParagraph(paragraph));
  let end = normalized.length;

  while (end > 0) {
    const paragraph = normalized[end - 1]!;
    if (!paragraph) {
      end -= 1;
      continue;
    }

    if (isFooterSentinelParagraph(paragraph) || isDecorativeSeparator(paragraph)) {
      end -= 1;
      continue;
    }

    break;
  }

  return normalized.slice(0, end).filter(Boolean);
}

export function cleanDescriptionParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => normalizeDescriptionParagraph(paragraph))
    .filter((paragraph) => paragraph.length > 0 && !isBoilerplateParagraph(paragraph))
    .join('\n\n');
}

export function extractDescriptionParagraphsFromHtml(html: string): string[] {
  const paragraphMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  const lines: string[] = [];

  for (const match of paragraphMatches) {
    const inner = (match[1] ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&rsquo;/g, "'")
      .replace(/&#39;/g, "'")
      .replace(/&ouml;/g, 'ö')
      .replace(/&Ouml;/g, 'Ö')
      .replace(/&uuml;/g, 'ü')
      .replace(/&Uuml;/g, 'Ü')
      .replace(/&auml;/g, 'ä')
      .replace(/&Auml;/g, 'Ä')
      .replace(/&szlig;/g, 'ß');

    for (const line of inner.split('\n')) {
      const normalized = normalizeDescriptionParagraph(line);
      if (normalized) {
        lines.push(normalized);
      }
    }
  }

  return lines;
}

export function splitDescriptionAndLineupBlocks(paragraphs: string[]): {
  descriptionParagraphs: string[];
  lineupParagraphs: string[];
  lineupNotAnnounced: boolean;
} {
  const split = splitDescriptionAndStructuredLineup(paragraphs);
  return {
    descriptionParagraphs: split.descriptionParagraphs,
    lineupParagraphs: split.lineupBlocks.flatMap((block) => block.rawLines),
    lineupNotAnnounced: split.lineupNotAnnounced,
  };
}

export function containsForbiddenDescriptionContent(text: string | undefined): boolean {
  if (!text?.trim()) {
    return false;
  }

  const paragraphs = text.split(/\n{2,}/).map((entry) => normalizeDescriptionParagraph(entry));
  return paragraphs.some((paragraph) => isBoilerplateParagraph(paragraph));
}
