import type { EventMediaType } from './event-media-candidate';
import type { EventMediaEvidence, MediaClassification } from './types';

const GENERIC_SHOP_PATTERN = /\b(?:shop|store|ticket|warenkorb|placeholder|default|logo-banner)\b/i;
const PLACEHOLDER_IMAGE_PATTERN =
  /\b(?:ticket-infos-soon|infos-soon|coming-soon|coming_soon|tba|to-be-announced|placeholder|no-image|image-soon)\b/i;
const BRANDING_PATTERN = /\b(?:logo|brand|avatar|icon|favicon)\b/i;
const MULTI_EVENT_PATTERN = /(?:^|\/)(?:programm|kalender|calendar|overview|ubersicht|übersicht)(?:\/|$)/i;
const TICKET_MARKETING_PATTERN = /\b(?:earlybird|early-bird|phase\s*\d|vip|bundle|kombi)\b/i;
const QUADA_EARLY_BIRD_URL_PATTERN = /(?:^|[/_-])eb(?:[_-]|$)|_eb_|(?:^|[/_-])earlybird|early.?bird/i;
const QUADA_LINEUP_URL_PATTERN = /(?:^|[/_-])lineup(?:[_-]|$)|_lineup_|lineup|line-up/i;
const EARLY_BIRD_OCR_PATTERN = /\bearly\s+bird\b/i;

function urlPathForClassification(imageUrl: string, sourceUrl: string): string {
  try {
    return `${new URL(imageUrl).pathname} ${new URL(sourceUrl).pathname}`.toLowerCase();
  } catch {
    return `${imageUrl} ${sourceUrl}`.toLowerCase();
  }
}

export function classifyEventMediaType(input: {
  imageUrl: string;
  sourceUrl: string;
  mediaEvidence?: EventMediaEvidence;
  lineupActCount?: number;
}): EventMediaType {
  const url = urlPathForClassification(input.imageUrl, input.sourceUrl);
  if (PLACEHOLDER_IMAGE_PATTERN.test(url)) {
    return 'decorative_image';
  }
  if (BRANDING_PATTERN.test(url)) {
    return url.includes('venue') || url.includes('bootshaus') ? 'venue_branding' : 'organizer_branding';
  }
  if (GENERIC_SHOP_PATTERN.test(url) && !/flyer|poster|event/.test(url)) {
    return 'generic_shop_image';
  }
  if (MULTI_EVENT_PATTERN.test(url)) {
    return 'multi_event_poster';
  }
  if (TICKET_MARKETING_PATTERN.test(url)) {
    return 'ticket_marketing';
  }
  if (
    QUADA_EARLY_BIRD_URL_PATTERN.test(url) &&
    !QUADA_LINEUP_URL_PATTERN.test(url)
  ) {
    return 'announcement_flyer';
  }
  if (input.mediaEvidence?.rawText && EARLY_BIRD_OCR_PATTERN.test(input.mediaEvidence.rawText)) {
    return 'announcement_flyer';
  }

  const mediaClassification = input.mediaEvidence?.mediaClassification;
  if (mediaClassification) {
    if (
      mediaClassification === 'unreadable' &&
      /flyer|poster|lineup|line-up|_lineup_|quada|web_/i.test(url) &&
      !QUADA_EARLY_BIRD_URL_PATTERN.test(url)
    ) {
      return (input.lineupActCount ?? 0) >= 3 ? 'lineup_flyer' : 'event_flyer';
    }
    return mapMediaClassification(mediaClassification, input.lineupActCount ?? 0);
  }

  if ((input.lineupActCount ?? 0) >= 3) {
    return 'lineup_flyer';
  }

  if (/flyer|poster|lineup|line-up/.test(url)) {
    return 'event_flyer';
  }

  if (/hero|banner|cover|artwork/.test(url)) {
    return 'event_hero';
  }

  return 'unknown';
}

function mapMediaClassification(
  classification: MediaClassification,
  lineupActCount: number,
): EventMediaType {
  switch (classification) {
    case 'event_flyer':
      return lineupActCount >= 3 ? 'lineup_flyer' : 'event_flyer';
    case 'event_artwork_without_billing':
      return 'event_hero';
    case 'generic_event_artwork':
      return 'announcement_flyer';
    case 'identity_unverifiable':
      return 'unknown';
    case 'unreadable':
      return 'unknown';
    default:
      return 'unknown';
  }
}
