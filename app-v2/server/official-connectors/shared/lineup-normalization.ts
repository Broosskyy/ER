import type { OfficialLineupCandidate, RejectedOfficialCandidate } from '../types';
import type { MediaEvidenceContext } from './media-evidence-context';
import { isContextNoiseTerm } from './media-evidence-context';

export type LineupEvidenceBlockType =
  | 'structured_lineup_header'
  | 'artists_section'
  | 'floor_billing'
  | 'timetable'
  | 'explicit_sentence'
  | 'official_media'
  | 'official_title';

export interface LineupValidationContext {
  mediaContext?: MediaEvidenceContext;
  additionalNoiseTerms?: string[];
  eventTitle?: string;
  knownGenreLabels?: string[];
}

const INVALID_LINEUP_PATTERNS = [
  /^tickets?$/i,
  /^and more$/i,
  /^and many more$/i,
  /^tba$/i,
  /^soon$/i,
  /^more tba$/i,
  /^support tba$/i,
  /^\.{2,}\s*more tba$/i,
  /^\*+\s*$/,
  /^https?:\/\//i,
  /ticket\.io/i,
  /^\d{1,2}:\d{2}\s*-/i,
  /^till late$/i,
  /^line\s*-?\s*up$/i,
  /^lineup$/i,
  /^presents?$/i,
  /^sessions?$/i,
  /^airport$/i,
];

const FLOOR_STAGE_HEADER_PATTERN =
  /^(?:MAIN\s*FLOOR|MAINFLOOR|UPPER\s*FLOOR|UPPERFLOOR|LOWER\s*FLOOR|LOWERFLOOR|1ST\s*FLOOR|BASEMENT|OUTDOOR|BLCKBX|DREHEREI|MAIN|UPPER|LOWER)(?:\s*:|)?$/i;

const LINEUP_INTRO_MARKER_PATTERN = /^(?:line\s*-?\s*up|artists)\s*:?\s*$/i;
const FULL_LINEUP_MARKER_PATTERN = /^full\s+line\s*-?\s*up(?:\s+a\s*-?\s*z)?\s*:?\s*$/i;
const DJ_LINEUP_INTRO_MARKER_PATTERN = /^dj\s+line\s*-?\s*up\s*:?\s*$/i;
const NON_LINEUP_SECTION_HEADER_PATTERN =
  /^(?:ELEMENTS|STYLE|INFO|INFOS|DETAILS|PROGRAM|LIVE THE|PUBLIC TRANSPORT INFO|HIGHLIGHTS)\s*:?$/i;
const NON_LINEUP_BOILERPLATE_PATTERN =
  /public transport|travel pass|passengers wishing|valid for \d|inbound travel|return journey|vrs network/i;
const DECOR_BULLET_PATTERN = /^\*[^*].*\*$/;
const PROSE_LINEUP_MAX_LENGTH = 100;
const TIMETABLE_TIME_PREFIX = /^\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*/;
const DECORATIVE_SEPARATOR_PATTERN = /^[▔_\-\s]{6,}$/;
const URL_PATTERN = /^https?:\/\/|^www\./i;
const TICKET_MARKETING_PATTERN =
  /ticket|einlass|eintritt|admission|euro|€|vorverkauf|abendkasse|dresscode|veranstalter|fase\s*\d|backstage meet|see you at|barzahlung|garderobe|umkleide|faq\/|uhrzeit:|verkleide|limited!|highest chance|exclusive giveaway|mobile app|merchandise|to be announced|bald angekündigt|early\s*bird|earlybird|sichert euch/i;
const EARLY_BIRD_FRAGMENT_PATTERN = /^(?:early|arly|earlybird)$/i;
const TICKET_PHASE_FRAGMENT_PATTERN = /^phase\s*[12]$/i;
const MARKETING_PREFIX_PATTERN = /^[✔⚠️]/;
const DESCRIPTION_PROSE_PATTERN =
  /detailinfos|shoppingadressen|einlass ab|age for admission|live the |public transport|strict .+ dresscode|verkleide dich|umkleidebereich|schließfächer/i;
const PLACEHOLDER_INLINE_PATTERN = /\b(?:tba|and many more|support tba)\b/i;
const DATE_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b(?:,?\s*\d{1,2}(?:st|nd|rd|th)?)?|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i;
const DATE_ONLY_LINE_PATTERN =
  /^(?:[A-Za-z]+,?\s*)?\d{1,2}(?:st|nd|rd|th)$/i;
const VENUE_ADDRESS_PATTERN = /\bauenweg\b|\b\d{5}\s+[a-z]/i;
const DOMAIN_SUFFIX_PATTERN = /\.(?:com|de|tv|io|net|org)\b/i;
const COPYRIGHT_PATTERN = /©|\(c\)|copyright/i;
const OCR_PIPE_PATTERN = /\|/;
const EVENT_TITLE_DESCRIPTOR_PATTERN =
  /\b(?:festival|weekender|sessions?|showcase|world tour|all night long|paint[- ]?rave|paint splash)\b/i;
const LINEUP_PLACEHOLDER_PATTERN =
  /^(?:soon|tba|to be announced|more tba|support tba|and more|and many more|coming\s*:?\s*soon|coming soon|line-?up\s+soon|lineup\s+soon|announced\s+soon)$/i;
const LINEUP_OCR_PLACEHOLDER_PATTERN =
  /^line\s*-?\s*up(?:\s+[a-z]{1,4})?$/i;
const LINEUP_OCR_SUFFIX_PATTERN = /\b(?:ss|soon|tba)\b/i;
const CLUB_OR_FLOOR_DESCRIPTOR_PATTERN = /\bclub\s+night\b/i;
const CURRENCY_PREFIX_PATTERN = /^[¢$€£]\s*/;
const POLICY_SLOGAN_SIGNAL_PATTERN =
  /\b(?:together|create|creating|respect|freedom|awareness|positive|comes first|safe as possible|dress\s*code|playroom|participation|voluntary)\b/i;
const DATE_MONTH_PATTERN =
  /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|oktober)\b/i;
const DATE_PREFIX_OCR_PATTERN =
  /^[a-zäöüß]{1,3}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag|oktober)\b/i;
const IMPLAUSIBLE_YEAR_PATTERN = /\b(?:19[0-4]\d|20[4-9]\d|\d{5,})\b/;

export function normalizeLineupName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function isLineupOcrPlaceholderFragment(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (LINEUP_OCR_PLACEHOLDER_PATTERN.test(normalized)) {
    return true;
  }
  if (/^line\s*-?\s*up\b/i.test(normalized)) {
    const remainder = normalized.replace(/^line\s*-?\s*up\b/i, '').trim();
    if (!remainder || LINEUP_OCR_SUFFIX_PATTERN.test(remainder)) {
      return true;
    }
  }
  if (/^lineup\s+[a-z]{1,4}$/i.test(normalized)) {
    return true;
  }
  return false;
}

export function isEventPolicyOrBrandSloganLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (normalized.includes('&') || /\bb2b\b/i.test(normalized) || /\bvs\.?\b/i.test(normalized)) {
    return false;
  }
  if (/\bpres\./i.test(normalized) && /\([^)]+\)/.test(normalized)) {
    return false;
  }
  const words = normalized.split(/\s+/);
  if (words.length < 4) {
    return false;
  }
  if (POLICY_SLOGAN_SIGNAL_PATTERN.test(normalized)) {
    return true;
  }
  if (/\bthe\s+[a-z]+\b/i.test(normalized) && words.length >= 4 && !/^[A-Z0-9\s'.-]+$/.test(normalized)) {
    return true;
  }
  return looksLikePromotionalSloganLine(normalized);
}

export function isDateOcrFragmentLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (DATE_PREFIX_OCR_PATTERN.test(normalized)) {
    return true;
  }
  if (DATE_MONTH_PATTERN.test(normalized) && IMPLAUSIBLE_YEAR_PATTERN.test(normalized)) {
    return true;
  }
  if (DATE_MONTH_PATTERN.test(normalized) && /\d{5,}/.test(normalized)) {
    return true;
  }
  if (/^\d{1,2}[./-]\d{1,2}[./-]\d{2,}$/i.test(normalized)) {
    return true;
  }
  return false;
}

export function isLineupPlaceholderLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return true;
  }
  if (LINEUP_PLACEHOLDER_PATTERN.test(normalized)) {
    return true;
  }
  if (isLineupOcrPlaceholderFragment(normalized)) {
    return true;
  }
  if (PLACEHOLDER_INLINE_PATTERN.test(normalized) && normalized.length < 40) {
    return true;
  }
  return false;
}

export function isClubOrFloorDescriptorLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (CLUB_OR_FLOOR_DESCRIPTOR_PATTERN.test(normalized)) {
    return true;
  }
  if (CURRENCY_PREFIX_PATTERN.test(normalized)) {
    return true;
  }
  if (/\bindoor\b/i.test(normalized) && /\b(?:club|night|floor)\b/i.test(normalized)) {
    return true;
  }
  return false;
}

export function isPublishedGenreLabel(
  text: string,
  knownGenreLabels: string[] = [],
): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  const key = canonicalActKey(normalized);
  return knownGenreLabels.some((label) => canonicalActKey(label) === key);
}

export function canonicalActKey(name: string): string {
  return normalizeLineupName(name).toLowerCase();
}

export function preferDisplayName(current: string, next: string): string {
  const currentHasUpper = /[A-Z]/.test(current);
  const nextHasUpper = /[A-Z]/.test(next);
  if (nextHasUpper && !currentHasUpper) {
    return next;
  }
  if (current.length >= next.length) {
    return current;
  }
  return next;
}

export function inferLineupEvidenceRole(
  displayName: string,
  billingOrder: number,
): OfficialLineupCandidate['evidenceRole'] {
  if (
    displayName.includes('&') ||
    /\bx\b/i.test(displayName) ||
    /\bb2b\b/i.test(displayName) ||
    /\bvs\.?\b/i.test(displayName)
  ) {
    return 'compound_act';
  }
  return billingOrder === 0 ? 'headliner' : 'artist';
}

export function isLineupIntroMarker(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return (
    LINEUP_INTRO_MARKER_PATTERN.test(normalized) ||
    DJ_LINEUP_INTRO_MARKER_PATTERN.test(normalized) ||
    FULL_LINEUP_MARKER_PATTERN.test(normalized)
  );
}

export function isNonLineupSectionHeader(text: string): boolean {
  return NON_LINEUP_SECTION_HEADER_PATTERN.test(normalizeLineupName(text));
}

export function isFloorOrStageHeader(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }

  if (isLineupIntroMarker(normalized) || isNonLineupSectionHeader(normalized)) {
    return false;
  }

  if (FLOOR_STAGE_HEADER_PATTERN.test(normalized)) {
    return true;
  }

  if (/^blckbx\b/i.test(normalized)) {
    return true;
  }

  if (/^dreherei\b/i.test(normalized)) {
    return true;
  }

  return /^[A-Z0-9][A-Z0-9\s/&-]{1,40}:$/.test(normalized.toUpperCase());
}

export function isShowcaseLabelLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return (
    /showcase$/i.test(normalized) ||
    /^.+\sby\s.+\s(?:label|friends|showcase)\b/i.test(normalized) ||
    /^blckbx\s+by\s/i.test(normalized)
  );
}

export function isSuspectedFlyerArtifactName(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return /^[A-Z0-9]{2,5}-[A-Z0-9]{1,3}$/.test(normalized) && !normalized.includes(' ');
}

export function looksLikePromotionalSloganLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (normalized.includes('&') || /\bb2b\b/i.test(normalized) || /\bvs\.?\b/i.test(normalized)) {
    return false;
  }
  if (/\bpres\./i.test(normalized) && /\([^)]+\)/.test(normalized)) {
    return false;
  }
  if (EVENT_TITLE_DESCRIPTOR_PATTERN.test(normalized)) {
    return true;
  }
  if (/\bon the [a-z]/i.test(normalized) && normalized.split(/\s+/).length >= 3) {
    return true;
  }
  const words = normalized.split(/\s+/);
  if (words.length >= 4) {
    const uppercaseWords = words.filter((word) => /^[A-Z0-9][A-Z0-9'.-]*$/.test(word));
    if (uppercaseWords.length >= Math.ceil(words.length * 0.8)) {
      return true;
    }
  }
  return false;
}

export function stripTimetableTimePrefix(text: string): string {
  return normalizeLineupName(text.replace(TIMETABLE_TIME_PREFIX, ''));
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ');
}

export function stripVenueSuffix(text: string): string {
  const decoded = decodeHtmlEntities(text);
  const venueMatch = decoded.match(/^(.+?)\s*<[^>]+>\s*$/);
  return normalizeLineupName(venueMatch?.[1] ?? decoded);
}

export function isTicketMarketingOrCtaLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  return (
    MARKETING_PREFIX_PATTERN.test(normalized) ||
    TICKET_MARKETING_PATTERN.test(normalized) ||
    EARLY_BIRD_FRAGMENT_PATTERN.test(normalized) ||
    TICKET_PHASE_FRAGMENT_PATTERN.test(normalized) ||
    URL_PATTERN.test(normalized) ||
    /@/.test(normalized) ||
    /\[email/i.test(normalized)
  );
}

export function isEarlyBirdOcrSplitFragment(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (/^early\s*bird$/i.test(normalized) || /^earlybird$/i.test(normalized)) {
    return true;
  }
  if (EARLY_BIRD_FRAGMENT_PATTERN.test(normalized)) {
    return true;
  }
  if (/^bird$/i.test(normalized)) {
    return true;
  }
  return false;
}

export function isOcrFlyerNoiseLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return true;
  }
  if (/^soon\.?$/i.test(normalized) || /^llu\)?$/i.test(normalized)) {
    return true;
  }
  if (/\d{1,2}\.0KT\./i.test(normalized) || /^\d{1,2}[./]\d{1,2}[A-Z]{2,}/i.test(normalized)) {
    return true;
  }
  if (/^sichert euch/i.test(normalized) || /\bburger\b|\bonlin\b/i.test(normalized)) {
    return true;
  }
  // Preserve short but valid billing labels such as "ACT 1".
  if (/^[A-Za-z]{2,}\s+\d{1,2}$/.test(normalized)) {
    return false;
  }
  if (/[\\(){}|<>]/.test(normalized) && normalized.replace(/[^A-Za-zÀ-ÿ]/g, '').length < 8) {
    return true;
  }
  const words = normalized.split(/\s+/);
  if (words.length === 1 && normalized.replace(/[^A-Za-zÀ-ÿ]/g, '').length >= 5) {
    return false;
  }
  if (
    words.length <= 3 &&
    words.every((word) => word.replace(/[^A-Za-zÀ-ÿ]/g, '').length <= 3) &&
    normalized.replace(/[^A-Za-zÀ-ÿ]/g, '').length <= 6
  ) {
    return true;
  }
  if (words.length === 1 && normalized.length <= 4 && !/\bb2b\b/i.test(normalized)) {
    return true;
  }
  return false;
}

export function isDescriptionProseLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return false;
  }
  if (/\bb2b\b/i.test(normalized) || /\([^)]+\)/.test(normalized)) {
    return false;
  }
  if (DESCRIPTION_PROSE_PATTERN.test(normalized)) {
    return true;
  }
  if (normalized.length > 55 && /[:|;]/.test(normalized)) {
    return true;
  }
  if (normalized.split(/\s+/).length > 8) {
    return true;
  }
  return false;
}

export function isLineupBlockTerminator(text: string, context?: LineupValidationContext): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
    return true;
  }

  if (DECORATIVE_SEPARATOR_PATTERN.test(normalized)) {
    return true;
  }

  if (
    /einlass ab|age for admission|mobile app|merchandise/i.test(normalized) ||
    URL_PATTERN.test(normalized)
  ) {
    return true;
  }

  for (const term of context?.additionalNoiseTerms ?? []) {
    if (normalized.toLowerCase().includes(term.toLowerCase())) {
      return true;
    }
  }

  if (context?.mediaContext && isContextNoiseTerm(normalized, context.mediaContext)) {
    return true;
  }

  return false;
}

export function validateOfficialLineupAct(
  rawText: string,
  blockType: LineupEvidenceBlockType,
  context?: LineupValidationContext,
): { accepted: boolean; reason?: string } {
  const displayName = stripVenueSuffix(stripTimetableTimePrefix(rawText));
  if (!displayName) {
    return { accepted: false, reason: 'empty_lineup_entry' };
  }

  if (isFloorOrStageHeader(displayName) || isShowcaseLabelLine(displayName)) {
    return { accepted: false, reason: 'floor_or_boilerplate' };
  }

  if (isLineupPlaceholderLine(displayName)) {
    return { accepted: false, reason: 'placeholder_not_billing' };
  }

  if (isLineupOcrPlaceholderFragment(displayName)) {
    return { accepted: false, reason: 'placeholder_not_billing' };
  }

  if (isEventPolicyOrBrandSloganLine(displayName)) {
    return { accepted: false, reason: 'event_policy_slogan' };
  }

  if (isDateOcrFragmentLine(displayName)) {
    return { accepted: false, reason: 'date_or_time_line' };
  }

  if (isClubOrFloorDescriptorLine(displayName)) {
    return { accepted: false, reason: 'club_or_floor_descriptor' };
  }

  if (context?.knownGenreLabels && isPublishedGenreLabel(displayName, context.knownGenreLabels)) {
    return { accepted: false, reason: 'genre_label_as_artist' };
  }

  if (/^STYLE\s*:/i.test(displayName)) {
    return { accepted: false, reason: 'style_metadata' };
  }

  if (DECOR_BULLET_PATTERN.test(displayName) || /^\/\//.test(displayName)) {
    return { accepted: false, reason: 'decor_bullet' };
  }

  if (DECORATIVE_SEPARATOR_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'invalid_lineup_entry' };
  }

  if (displayName.length > PROSE_LINEUP_MAX_LENGTH) {
    return { accepted: false, reason: 'prose_not_lineup' };
  }

  if (NON_LINEUP_BOILERPLATE_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'non_lineup_boilerplate' };
  }

  if (isTicketMarketingOrCtaLine(displayName)) {
    return { accepted: false, reason: 'ticket_or_marketing_line' };
  }

  if (isEarlyBirdOcrSplitFragment(displayName)) {
    return { accepted: false, reason: 'ticket_marketing_fragment' };
  }

  if (blockType === 'official_media' && isOcrFlyerNoiseLine(displayName)) {
    return { accepted: false, reason: 'ocr_flyer_noise' };
  }

  if (DOMAIN_SUFFIX_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'url_or_domain_line' };
  }

  if (COPYRIGHT_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'copyright_or_symbol_line' };
  }

  if (OCR_PIPE_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'ocr_pipe_artifact' };
  }

  if (looksLikePromotionalSloganLine(displayName)) {
    return { accepted: false, reason: 'show_slogan_line' };
  }

  if (
    /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b/i.test(
      displayName,
    ) &&
    /\d{4,}/.test(displayName)
  ) {
    return { accepted: false, reason: 'date_or_time_line' };
  }

  if (
    /\bevent\b/i.test(displayName) &&
    !displayName.includes('&') &&
    displayName.split(/\s+/).length <= 5
  ) {
    return { accepted: false, reason: 'event_policy_line' };
  }

  if (/^\s*closing\s*$/i.test(displayName) || isLineupIntroMarker(displayName)) {
    return { accepted: false, reason: 'non_lineup_boilerplate' };
  }

  if (
    /\bfestival\b/i.test(displayName) &&
    !displayName.includes('&') &&
    !/\bb2b\b/i.test(displayName)
  ) {
    return { accepted: false, reason: 'show_or_event_title' };
  }

  if (isDescriptionProseLine(displayName)) {
    return { accepted: false, reason: 'description_prose_line' };
  }

  if (PLACEHOLDER_INLINE_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'placeholder_not_billing' };
  }

  if (DATE_PATTERN.test(displayName) && (displayName.length < 50 || DATE_ONLY_LINE_PATTERN.test(displayName))) {
    return { accepted: false, reason: 'date_or_time_line' };
  }

  if (VENUE_ADDRESS_PATTERN.test(displayName) || (displayName.includes('/') && /\d{4,5}/.test(displayName))) {
    return { accepted: false, reason: 'venue_address_line' };
  }

  if (INVALID_LINEUP_PATTERNS.some((pattern) => pattern.test(displayName))) {
    return { accepted: false, reason: 'invalid_lineup_entry' };
  }

  if (context?.mediaContext && isContextNoiseTerm(displayName, context.mediaContext)) {
    return { accepted: false, reason: 'context_noise_term' };
  }

  if (blockType === 'structured_lineup_header' && isSuspectedFlyerArtifactName(displayName)) {
    return { accepted: false, reason: 'suspected_flyer_artifact' };
  }

  const letters = displayName.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 2) {
    return { accepted: false, reason: 'invalid_lineup_entry' };
  }

  return { accepted: true };
}

export function isAcceptableOfficialLineupActName(
  text: string,
  context?: LineupValidationContext,
): boolean {
  return validateOfficialLineupAct(text, 'structured_lineup_header', context).accepted;
}

export function isAcceptableOfficialMediaLineupActName(
  text: string,
  context?: LineupValidationContext,
): boolean {
  return validateOfficialLineupAct(text, 'official_media', context).accepted;
}

function tokenizeTitleSegments(eventTitle: string): string[][] {
  return eventTitle
    .split(/\s*(?:pres\.|presents|w\/|live at|&|\||\/|-)\s*/i)
    .map((segment) =>
      segment
        .split(/\s+/)
        .map((word) => word.replace(/[^a-z0-9]/gi, '').toLowerCase())
        .filter((word) => word.length > 2),
    )
    .filter((segment) => segment.length > 0);
}

export function getIsolatedTitleFragmentKeys(
  eventTitle: string,
  mediaOnlyActNames: string[],
): Set<string> {
  const rejects = new Set<string>();
  const mediaSingleWords = mediaOnlyActNames
    .filter((name) => !name.includes(' '))
    .map((name) => canonicalActKey(name));

  for (const segmentWords of tokenizeTitleSegments(eventTitle)) {
    const hits = mediaSingleWords.filter((word) => segmentWords.includes(word));
    if (hits.length < 2) {
      continue;
    }

    const segmentPhrase = segmentWords.join(' ');
    const hasCompoundAct = mediaOnlyActNames.some((name) => {
      const key = canonicalActKey(name);
      return key.includes(' ') && segmentPhrase.includes(key);
    });
    if (hasCompoundAct) {
      continue;
    }

    for (const hit of hits) {
      rejects.add(hit);
    }
  }

  return rejects;
}

export function sanitizeFinalLineupCandidates(
  lineupCandidates: OfficialLineupCandidate[],
  options: {
    eventTitle?: string;
    validationContext?: LineupValidationContext;
    showTitleFragmentKeys?: Set<string>;
  },
): {
  lineupCandidates: OfficialLineupCandidate[];
  rejectedCandidates: RejectedOfficialCandidate[];
} {
  const rejectedCandidates: RejectedOfficialCandidate[] = [];
  const validationContext = options.validationContext;
  const kept: OfficialLineupCandidate[] = [];
  const seen = new Set<string>();

  const mediaOnlyNames = lineupCandidates
    .filter((act) => act.evidenceOrigin === 'official_media')
    .map((act) => act.displayName);
  const titleFragmentKeys = new Set<string>(options.showTitleFragmentKeys ?? []);
  if (options.eventTitle) {
    for (const key of getIsolatedTitleFragmentKeys(options.eventTitle, mediaOnlyNames)) {
      titleFragmentKeys.add(key);
    }
  }

  const earlyBirdSplitKeys = new Set<string>();
  const actKeys = lineupCandidates.map((act) => canonicalActKey(act.displayName));
  if (actKeys.includes('arly') && actKeys.includes('bird')) {
    earlyBirdSplitKeys.add('arly');
    earlyBirdSplitKeys.add('bird');
  }

  for (const act of lineupCandidates) {
    const blockType: LineupEvidenceBlockType =
      act.evidenceOrigin === 'official_media'
        ? 'official_media'
        : act.evidenceOrigin === 'official_title'
          ? 'official_title'
          : 'floor_billing';
    const validation = validateOfficialLineupAct(act.rawText, blockType, validationContext);
    if (!validation.accepted) {
      rejectedCandidates.push({
        rawText: act.rawText,
        reason: validation.reason ?? 'invalid_lineup_entry',
      });
      continue;
    }

    if (
      act.evidenceOrigin === 'official_media' &&
      titleFragmentKeys.has(canonicalActKey(act.displayName))
    ) {
      rejectedCandidates.push({
        rawText: act.rawText,
        reason: 'title_phrase_fragment',
      });
      continue;
    }

    if (earlyBirdSplitKeys.has(canonicalActKey(act.displayName))) {
      rejectedCandidates.push({
        rawText: act.rawText,
        reason: 'early_bird_ocr_split',
      });
      continue;
    }

    const key = canonicalActKey(act.displayName);
    if (seen.has(key)) {
      rejectedCandidates.push({ rawText: act.rawText, reason: 'duplicate_lineup_entry' });
      continue;
    }
    seen.add(key);
    kept.push(act);
  }

  return {
    lineupCandidates: kept.map((act, index) => ({
      ...act,
      billingOrder: index,
      evidenceRole: inferLineupEvidenceRole(act.displayName, index),
    })),
    rejectedCandidates,
  };
}
