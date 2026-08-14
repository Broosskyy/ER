import type { OfficialLineupCandidate, RejectedOfficialCandidate } from '../types';
import type { MediaEvidenceContext } from './media-evidence-context';
import { isContextNoiseTerm } from './media-evidence-context';

export type LineupEvidenceBlockType =
  | 'structured_lineup_header'
  | 'artists_section'
  | 'floor_billing'
  | 'timetable'
  | 'explicit_sentence'
  | 'official_media';

export interface LineupValidationContext {
  mediaContext?: MediaEvidenceContext;
  additionalNoiseTerms?: string[];
  eventTitle?: string;
}

const INVALID_LINEUP_PATTERNS = [
  /^tickets?$/i,
  /^and more$/i,
  /^and many more$/i,
  /^tba$/i,
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
const DJ_LINEUP_INTRO_MARKER_PATTERN = /^dj\s+line\s*-?\s*up\s*:?\s*$/i;
const NON_LINEUP_SECTION_HEADER_PATTERN =
  /^(?:ELEMENTS|STYLE|INFO|INFOS|DETAILS|PROGRAM|LIVE THE|PUBLIC TRANSPORT INFO)\s*:?$/i;
const NON_LINEUP_BOILERPLATE_PATTERN =
  /public transport|travel pass|passengers wishing|valid for \d|inbound travel|return journey|vrs network/i;
const DECOR_BULLET_PATTERN = /^\*[^*].*\*$/;
const PROSE_LINEUP_MAX_LENGTH = 100;
const TIMETABLE_TIME_PREFIX = /^\d{1,2}:\d{2}(?::\d{2})?\s*[-–—]\s*/;
const DECORATIVE_SEPARATOR_PATTERN = /^[▔_\-\s]{6,}$/;
const URL_PATTERN = /^https?:\/\/|^www\./i;
const TICKET_MARKETING_PATTERN =
  /ticket|einlass|eintritt|admission|euro|€|vorverkauf|abendkasse|dresscode|veranstalter|fase\s*\d|backstage meet|see you at|barzahlung|garderobe|umkleide|faq\/|uhrzeit:|verkleide|limited!|highest chance|exclusive giveaway|mobile app|merchandise|to be announced|bald angekündigt/i;
const MARKETING_PREFIX_PATTERN = /^[✔⚠️]/;
const DESCRIPTION_PROSE_PATTERN =
  /detailinfos|shoppingadressen|einlass ab|age for admission|live the |public transport|strict .+ dresscode|verkleide dich|umkleidebereich|schließfächer/i;
const PLACEHOLDER_INLINE_PATTERN = /\b(?:tba|and many more|support tba)\b/i;
const DATE_PATTERN =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i;
const VENUE_ADDRESS_PATTERN = /\bauenweg\b|\b\d{5}\s+[a-z]/i;
const DOMAIN_SUFFIX_PATTERN = /\.(?:com|de|tv|io|net|org)\b/i;

export function normalizeLineupName(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
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
    LINEUP_INTRO_MARKER_PATTERN.test(normalized) || DJ_LINEUP_INTRO_MARKER_PATTERN.test(normalized)
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
    URL_PATTERN.test(normalized) ||
    /@/.test(normalized) ||
    /\[email/i.test(normalized)
  );
}

export function isDescriptionProseLine(text: string): boolean {
  const normalized = normalizeLineupName(text);
  if (!normalized) {
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

  if (DOMAIN_SUFFIX_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'url_or_domain_line' };
  }

  if (isDescriptionProseLine(displayName)) {
    return { accepted: false, reason: 'description_prose_line' };
  }

  if (PLACEHOLDER_INLINE_PATTERN.test(displayName)) {
    return { accepted: false, reason: 'placeholder_not_billing' };
  }

  if (DATE_PATTERN.test(displayName) && displayName.length < 50) {
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
  const titleFragmentKeys = options.eventTitle
    ? getIsolatedTitleFragmentKeys(options.eventTitle, mediaOnlyNames)
    : new Set<string>();

  for (const act of lineupCandidates) {
    const blockType: LineupEvidenceBlockType =
      act.evidenceOrigin === 'official_media' ? 'official_media' : 'floor_billing';
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
