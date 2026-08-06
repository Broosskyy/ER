import { isCollapsedLineupArtistName } from '@/features/aggregation/domain/lineup-billing-parser';
import { decodeHtmlEntities } from '@/features/import/normalization/text-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

import {
  isLineupBlobArtistName,
  isLineupPlaceholderArtist,
  MAX_LINEUP_ARTIST_NAME_LENGTH,
} from './lineup-artist-quality';

export const ARTIST_CANDIDATE_GATE_VERSION = 'phase4691';

export type ArtistCandidateDecision = 'valid' | 'review_required' | 'invalid';

export type ArtistCandidateSignal =
  | 'html_entity'
  | 'html_tag'
  | 'url'
  | 'email'
  | 'prose_sentence'
  | 'amenity'
  | 'ticket_admission'
  | 'venue_organizer_text'
  | 'artwork_credit'
  | 'promotional_copy'
  | 'dress_code'
  | 'navigation_footer'
  | 'social_handle'
  | 'event_title_prose'
  | 'excessive_length'
  | 'excessive_word_count'
  | 'collapsed_boundary'
  | 'title_inference_brand'
  | 'known_alias_match';

export interface ArtistCandidateGateInput {
  name: string;
  sourceField?: string;
  extractionStrategy?: string;
  knownCanonicalNames?: Iterable<string>;
  eventTitle?: string;
}

export interface ArtistCandidateGateResult {
  normalizedCandidate: string;
  decision: ArtistCandidateDecision;
  reasons: string[];
  signals: ArtistCandidateSignal[];
  sourceField?: string;
  extractionStrategy?: string;
  confidence: number;
  requiresReview: boolean;
  gateVersion: string;
}

const HTML_ENTITY_PATTERN = /&(?:ldquo|rdquo|bdquo|eacute|amp|quot|nbsp|#\d+);?/i;
const HTML_TAG_PATTERN = /<[^>]+>/;
const URL_PATTERN = /https?:\/\/|www\.\w+/i;
const EMAIL_PATTERN = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const SENTENCE_PATTERN = /[.!?…]\s|\.{3,}/;
const AMENITY_PATTERN =
  /\b(?:massageservice|massage|lounge|raucher|verkleide|artwork\s+by|walking\s+acts|currywurst|pizza\s+deluxe|einlass|admission|eintritt|vorverkauf|abendkasse|age\s+for\s+admission)\b/i;
const ARTWORK_CREDIT_PATTERN = /\bartwork\s+by\b/i;
const PROMO_PATTERN =
  /\b(?:more\s+information|willkommen\s+ist|öffnet\s+sich|definiert\s+sich|traditionen|avantgardistisch|spektakulär)\b/i;
const DRESS_CODE_PATTERN = /\bverkleide\s+dich\b/i;
const SOCIAL_HANDLE_PATTERN = /(?:^|\s)@\w+/;
const TITLE_BRAND_PATTERN =
  /\b(?:weekender|pre-party|festival|club\s+night|edition|bootshaus|kitkat(?:\s*club)?)\b/i;

const MAX_AUTO_PUBLISH_WORDS = 8;
const REVIEW_WORD_THRESHOLD = 6;

function hasGluedArtistToken(value: string): boolean {
  return value.split(/\s+/).some((token) => {
    if (token.length < 12) {
      return false;
    }
    const uppercaseLetters = (token.match(/[A-Z]/g) ?? []).length;
    return uppercaseLetters >= 8 && uppercaseLetters / token.length >= 0.75;
  });
}

function normalizeCandidateName(name: string): string {
  return decodeHtmlEntities(name).replace(/\s+/g, ' ').trim();
}

function matchesKnownCanonical(name: string, knownCanonicalNames?: Iterable<string>): boolean {
  if (!knownCanonicalNames) {
    return false;
  }
  const normalized = normalizeMatchText(name);
  for (const known of knownCanonicalNames) {
    if (normalizeMatchText(known) === normalized) {
      return true;
    }
  }
  return false;
}

export function detectArtistCandidateSignals(
  name: string,
  input?: Pick<ArtistCandidateGateInput, 'eventTitle' | 'knownCanonicalNames'>,
): ArtistCandidateSignal[] {
  const trimmed = normalizeCandidateName(name);
  if (!trimmed) {
    return ['excessive_length'];
  }

  const signals: ArtistCandidateSignal[] = [];

  if (matchesKnownCanonical(trimmed, input?.knownCanonicalNames)) {
    signals.push('known_alias_match');
    return signals;
  }

  if (HTML_ENTITY_PATTERN.test(trimmed)) {
    signals.push('html_entity');
  }
  if (HTML_TAG_PATTERN.test(trimmed)) {
    signals.push('html_tag');
  }
  if (URL_PATTERN.test(trimmed)) {
    signals.push('url');
  }
  if (EMAIL_PATTERN.test(trimmed)) {
    signals.push('email');
  }
  if (trimmed.length > MAX_LINEUP_ARTIST_NAME_LENGTH || isLineupBlobArtistName(trimmed)) {
    signals.push('excessive_length');
  }
  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  if (wordCount > MAX_AUTO_PUBLISH_WORDS) {
    signals.push('excessive_word_count');
  }
  if (SENTENCE_PATTERN.test(trimmed) || wordCount >= 10) {
    signals.push('prose_sentence');
  }
  if (AMENITY_PATTERN.test(trimmed)) {
    signals.push('amenity');
  }
  if (ARTWORK_CREDIT_PATTERN.test(trimmed)) {
    signals.push('artwork_credit');
  }
  if (PROMO_PATTERN.test(trimmed)) {
    signals.push('promotional_copy');
  }
  if (DRESS_CODE_PATTERN.test(trimmed)) {
    signals.push('dress_code');
  }
  if (SOCIAL_HANDLE_PATTERN.test(trimmed)) {
    signals.push('social_handle');
  }
  if (
    /\b(?:bootshaus|kitkat(?:\s*club)?|venue|organizer|organiser|essigfabrik)\b/i.test(trimmed) &&
    trimmed.length > 40
  ) {
    signals.push('venue_organizer_text');
  }
  if (isCollapsedLineupArtistName(trimmed)) {
    signals.push('collapsed_boundary');
  }
  if (hasGluedArtistToken(trimmed)) {
    signals.push('collapsed_boundary');
  }
  if (input?.eventTitle) {
    const normalizedTitle = normalizeMatchText(input.eventTitle);
    const normalizedCandidate = normalizeMatchText(trimmed);
    if (
      normalizedCandidate.length > 20 &&
      normalizedTitle.includes(normalizedCandidate.slice(0, Math.min(24, normalizedCandidate.length)))
    ) {
      signals.push('event_title_prose');
    }
  }
  if (TITLE_BRAND_PATTERN.test(trimmed) && wordCount <= 4) {
    signals.push('title_inference_brand');
  }

  return [...new Set(signals)];
}

const HARD_REJECT_SIGNALS: ArtistCandidateSignal[] = [
  'html_entity',
  'html_tag',
  'url',
  'email',
  'prose_sentence',
  'amenity',
  'ticket_admission',
  'venue_organizer_text',
  'artwork_credit',
  'promotional_copy',
  'dress_code',
  'navigation_footer',
  'social_handle',
  'event_title_prose',
  'excessive_length',
  'excessive_word_count',
  'collapsed_boundary',
  'title_inference_brand',
];

export function evaluateArtistCandidate(input: ArtistCandidateGateInput): ArtistCandidateGateResult {
  const normalizedCandidate = normalizeCandidateName(input.name);
  const signals = detectArtistCandidateSignals(normalizedCandidate, input);

  if (signals.includes('known_alias_match')) {
    return {
      normalizedCandidate,
      decision: 'valid',
      reasons: ['Known canonical artist or alias match.'],
      signals,
      sourceField: input.sourceField,
      extractionStrategy: input.extractionStrategy,
      confidence: 1,
      requiresReview: false,
      gateVersion: ARTIST_CANDIDATE_GATE_VERSION,
    };
  }

  if (isLineupPlaceholderArtist(normalizedCandidate)) {
    return {
      normalizedCandidate,
      decision: 'invalid',
      reasons: ['Placeholder or blob lineup token.'],
      signals: [...signals, 'excessive_length'],
      sourceField: input.sourceField,
      extractionStrategy: input.extractionStrategy,
      confidence: 0,
      requiresReview: false,
      gateVersion: ARTIST_CANDIDATE_GATE_VERSION,
    };
  }

  const hardReject = signals.filter((signal) => HARD_REJECT_SIGNALS.includes(signal));
  if (hardReject.length > 0) {
    return {
      normalizedCandidate,
      decision: 'invalid',
      reasons: hardReject.map((signal) => `Rejected signal: ${signal}`),
      signals,
      sourceField: input.sourceField,
      extractionStrategy: input.extractionStrategy,
      confidence: 0,
      requiresReview: false,
      gateVersion: ARTIST_CANDIDATE_GATE_VERSION,
    };
  }

  const wordCount = normalizedCandidate.split(/\s+/).filter(Boolean).length;
  if (wordCount > REVIEW_WORD_THRESHOLD) {
    return {
      normalizedCandidate,
      decision: 'review_required',
      reasons: ['Multi-word artist requires manual review before publication.'],
      signals,
      sourceField: input.sourceField,
      extractionStrategy: input.extractionStrategy,
      confidence: 0.45,
      requiresReview: true,
      gateVersion: ARTIST_CANDIDATE_GATE_VERSION,
    };
  }

  return {
    normalizedCandidate,
    decision: 'valid',
    reasons: ['Passed artist candidate quality gate.'],
    signals,
    sourceField: input.sourceField,
    extractionStrategy: input.extractionStrategy,
    confidence: 0.9,
    requiresReview: false,
    gateVersion: ARTIST_CANDIDATE_GATE_VERSION,
  };
}

export function filterArtistCandidatesThroughGate(
  names: string[],
  input?: Omit<ArtistCandidateGateInput, 'name'>,
): string[] {
  const accepted: string[] = [];
  const seen = new Set<string>();
  for (const name of names) {
    const result = evaluateArtistCandidate({ ...input, name });
    if (result.decision !== 'valid') {
      continue;
    }
    const key = normalizeMatchText(result.normalizedCandidate);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    accepted.push(result.normalizedCandidate);
  }
  return accepted;
}
