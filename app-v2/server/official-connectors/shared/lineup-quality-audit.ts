import { canonicalActKey, isDateOcrFragmentLine, isEventPolicyOrBrandSloganLine, isLineupOcrPlaceholderFragment, isLineupPlaceholderLine, looksLikePromotionalSloganLine, validateOfficialLineupAct, type LineupValidationContext } from './lineup-normalization';
import { isContextNoiseTerm } from './media-evidence-context';

export type LineupQualityIssueClass =
  | 'date_or_time'
  | 'month_or_date_fragment'
  | 'copyright_symbol'
  | 'ticket_or_cta'
  | 'price_or_admission'
  | 'url_or_domain'
  | 'venue_or_address'
  | 'organizer_noise'
  | 'floor_or_stage'
  | 'placeholder'
  | 'show_or_tour_title'
  | 'description_prose'
  | 'social_or_brand_claim'
  | 'ocr_artifact'
  | 'symbol_only'
  | 'numeric_only'
  | 'truncated_word'
  | 'genre_label_as_artist'
  | 'validation_rejected'
  | 'slogan_or_policy'
  | 'date_ocr_fragment'
  | 'lineup_ocr_placeholder'

export interface LineupQualityIssue {
  class: LineupQualityIssueClass;
  detail: string;
}

const MONTH_PATTERN =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i;
const DATE_FRAGMENT_PATTERN = /\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/;
const TIME_PATTERN = /\b\d{1,2}[:.]\d{2}\b/;
const COPYRIGHT_PATTERN = /©|\(c\)|copyright/i;
const SHOW_TOUR_PATTERN =
  /\b(?:festival|weekender|sessions?|showcase|world tour|all night long|paint[- ]?rave|paint splash)\b/i;
const TICKET_CTA_PATTERN =
  /\b(?:ticket|einlass|eintritt|vorverkauf|abendkasse|fase\s*\d|backstage meet|see you at|limited!|highest chance|exclusive giveaway)\b/i;
const URL_DOMAIN_PATTERN = /^https?:\/\/|www\.|\.\w{2,4}$/i;
const SOCIAL_PATTERN = /\b(?:instagram|facebook|spotify|tiktok|youtube)\b/i;
const OCR_ARTIFACT_PATTERN = /^[^a-zA-Z0-9]{1,3}$|^[A-Z0-9]{1,2}$/;
const TRUNCATED_WORD_PATTERN = /^[A-Z]{2,5}[^A-Za-z0-9\s&]$/;

export function detectFinalLineupQualityIssues(
  displayName: string,
  options: {
    validationContext?: LineupValidationContext;
    knownGenreLabels?: string[];
  } = {},
): LineupQualityIssue[] {
  const issues: LineupQualityIssue[] = [];
  const normalized = displayName.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    issues.push({ class: 'validation_rejected', detail: 'empty_lineup_entry' });
    return issues;
  }

  const validation = validateOfficialLineupAct(normalized, 'floor_billing', options.validationContext);
  if (!validation.accepted) {
    issues.push({ class: 'validation_rejected', detail: validation.reason ?? 'invalid_lineup_entry' });
  }

  if (COPYRIGHT_PATTERN.test(normalized)) {
    issues.push({ class: 'copyright_symbol', detail: 'copyright_marker' });
  }
  if (MONTH_PATTERN.test(normalized) || DATE_FRAGMENT_PATTERN.test(normalized)) {
    issues.push({ class: 'month_or_date_fragment', detail: 'date_fragment' });
  }
  if (TIME_PATTERN.test(normalized) && normalized.length < 40) {
    issues.push({ class: 'date_or_time', detail: 'time_fragment' });
  }
  if (TICKET_CTA_PATTERN.test(normalized)) {
    issues.push({ class: 'ticket_or_cta', detail: 'ticket_or_marketing' });
  }
  if (/€|euro|vorverkauf|admission/i.test(normalized)) {
    issues.push({ class: 'price_or_admission', detail: 'price_or_admission' });
  }
  if (URL_DOMAIN_PATTERN.test(normalized)) {
    issues.push({ class: 'url_or_domain', detail: 'url_or_domain' });
  }
  if (SHOW_TOUR_PATTERN.test(normalized) && !normalized.includes('&') && !/\bb2b\b/i.test(normalized)) {
    issues.push({ class: 'show_or_tour_title', detail: 'show_or_tour_title' });
  }
  if (looksLikePromotionalSloganLine(normalized)) {
    issues.push({ class: 'show_or_tour_title', detail: 'promotional_slogan' });
  }
  if (/\|/.test(normalized)) {
    issues.push({ class: 'ocr_artifact', detail: 'ocr_pipe_artifact' });
  }
  if (SOCIAL_PATTERN.test(normalized)) {
    issues.push({ class: 'social_or_brand_claim', detail: 'social_or_brand' });
  }
  if (isLineupPlaceholderLine(normalized) || isLineupOcrPlaceholderFragment(normalized)) {
    issues.push({ class: 'lineup_ocr_placeholder', detail: 'placeholder_not_billing' });
  }
  if (isEventPolicyOrBrandSloganLine(normalized)) {
    issues.push({ class: 'slogan_or_policy', detail: 'event_policy_slogan' });
  }
  if (isDateOcrFragmentLine(normalized)) {
    issues.push({ class: 'date_ocr_fragment', detail: 'date_or_time_line' });
  }
  if (/^(?:tba|and more|and many more|more tba)$/i.test(normalized)) {
    issues.push({ class: 'placeholder', detail: 'placeholder' });
  }
  if (/^(?:MAIN\s*FLOOR|MAINFLOOR|UPPER\s*FLOOR|LOWER\s*FLOOR|BLCKBX|DREHEREI)/i.test(normalized)) {
    issues.push({ class: 'floor_or_stage', detail: 'floor_or_stage' });
  }
  if (options.validationContext?.mediaContext && isContextNoiseTerm(normalized, options.validationContext.mediaContext)) {
    issues.push({ class: 'venue_or_address', detail: 'context_noise_term' });
  }
  if (OCR_ARTIFACT_PATTERN.test(normalized)) {
    issues.push({ class: 'ocr_artifact', detail: 'ocr_artifact' });
  }
  if (/^[\d\s./:|+-]+$/.test(normalized)) {
    issues.push({ class: 'numeric_only', detail: 'numeric_only' });
  }
  if (TRUNCATED_WORD_PATTERN.test(normalized)) {
    issues.push({ class: 'truncated_word', detail: 'truncated_word' });
  }
  if (
    options.knownGenreLabels?.some(
      (genre) => canonicalActKey(genre) === canonicalActKey(normalized),
    )
  ) {
    issues.push({ class: 'genre_label_as_artist', detail: 'genre_label_as_artist' });
  }

  return issues;
}
