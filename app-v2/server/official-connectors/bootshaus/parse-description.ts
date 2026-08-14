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

export function containsLineupNotAnnouncedSignal(text: string): boolean {
  return LINEUP_NOT_ANNOUNCED_PATTERNS.some((pattern) => pattern.test(text));
}

export function isBoilerplateParagraph(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return BOILERPLATE_MARKERS.some((marker) => normalized.includes(marker));
}

export function isFloorHeader(text: string): boolean {
  return FLOOR_HEADER_PATTERN.test(text.trim().toUpperCase());
}

export function cleanDescriptionParagraphs(paragraphs: string[]): string {
  return paragraphs
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0 && !isBoilerplateParagraph(paragraph))
    .join('\n\n');
}

export function extractDescriptionParagraphsFromHtml(html: string): string[] {
  const paragraphMatches = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)];
  return paragraphMatches.map((match) =>
    (match[1] ?? '')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&rsquo;/g, "'")
      .replace(/&#39;/g, "'")
      .trim(),
  );
}

export function splitDescriptionAndLineupBlocks(paragraphs: string[]): {
  descriptionParagraphs: string[];
  lineupParagraphs: string[];
  lineupNotAnnounced: boolean;
} {
  const descriptionParagraphs: string[] = [];
  const lineupParagraphs: string[] = [];
  let inLineupBlock = false;
  let lineupNotAnnounced = false;

  for (const paragraph of paragraphs) {
    if (containsLineupNotAnnouncedSignal(paragraph)) {
      lineupNotAnnounced = true;
      continue;
    }

    if (isFloorHeader(paragraph.replace(/:$/, '')) || /^[A-Z0-9][A-Z0-9\s/&-]{1,40}:$/.test(paragraph.trim())) {
      inLineupBlock = true;
      continue;
    }

    if (isBoilerplateParagraph(paragraph)) {
      inLineupBlock = false;
      continue;
    }

    if (inLineupBlock) {
      lineupParagraphs.push(paragraph);
      continue;
    }

    descriptionParagraphs.push(paragraph);
  }

  return {
    descriptionParagraphs,
    lineupParagraphs,
    lineupNotAnnounced,
  };
}
