import { normalizeOfficialGenreLabel } from '../shared/normalize-genre';
import {
  canonicalActKey,
  inferLineupEvidenceRole,
  isAcceptableOfficialMediaLineupActName,
  isFloorOrStageHeader,
  isLineupIntroMarker,
  isLineupPlaceholderLine,
  isShowcaseLabelLine,
  isTicketMarketingOrCtaLine,
  type LineupValidationContext,
} from '../shared/lineup-normalization';
import { isContextNoiseTerm, type MediaEvidenceContext } from '../shared/media-evidence-context';
import type {
  EventMediaEvidence,
  MediaClassification,
  MediaGenreCandidate,
  MediaLineupCandidate,
  MediaOcrBlock,
  MediaOcrLine,
  RejectedMediaCandidate,
} from './types';

const MIN_PUBLISH_LINE_CONFIDENCE = 50;
const MIN_PUBLISH_WORD_CONFIDENCE = 40;
const MAX_ARTIST_LINE_LENGTH = 80;

const PLACEHOLDER_PATTERN =
  /^(?:tba|and more|and many more|more tba|support tba|\.\.\.\s*more tba|soon|coming\s*:?\s*soon|coming soon|line-?up\s+soon|to be announced)$/i;
const PLACEHOLDER_INLINE_PATTERN = /\b(?:tba|and many more|support tba)\b/i;
const TIME_PATTERN = /^\d{1,2}[:.]\d{2}/;
const ROSTER_DASH_PATTERN = /\s+-\s+/;
const LINEUP_HEADER_PATTERN = /lineup\s*\(/i;
const SYMBOL_HEAVY_PATTERN = /[©¢\\#%*]{2,}|\\=\/|~\~/;
const DATE_LINE_PATTERN =
  /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|august|september|october|january)\b/i;
const PROMO_LINE_PATTERN = /every\s+.*\s+night|tasty/i;
const DATE_PATTERN =
  /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)\b|\b\d{1,2}[./-]\d{1,2}(?:[./-]\d{2,4})?\b/i;
const GENRE_HEADER_PATTERN = /^(?:genres?|sounds?|styles?)\s*:?\s*$/i;
const LOGO_BOILERPLATE_PATTERN =
  /presented by|powered by|in association|facebook|instagram|spotify/i;
const OCR_GARBAGE_PATTERN = /^(?:presents?|into the|party|at|weekender|sessions?|airport|lineup)$/i;
const PROMO_NUMBERED_PATTERN = /^\d{2,3}\s+every\s+/i;
const SYMBOL_COMPOUND_VENUE_PATTERN = /\*\s*[A-Z]{3,6}$/;

function splitBillingSegments(text: string): string[] {
  return text
    .split(/\s*(?:&|\+|\/|\bx\b|\bb2b\b|\*)\s*/i)
    .map((part) => normalizeLine(text))
    .filter(Boolean);
}

function normalizeLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function buildValidationContext(mediaContext?: MediaEvidenceContext): LineupValidationContext {
  return { mediaContext };
}

function classifyMediaLine(
  line: MediaOcrLine,
  mediaContext?: MediaEvidenceContext,
): string {
  const text = normalizeLine(line.text);
  if (!text) {
    return 'empty';
  }
  if (isFloorOrStageHeader(text) || isShowcaseLabelLine(text)) {
    return 'floor_header';
  }
  if (GENRE_HEADER_PATTERN.test(text)) {
    return 'genre_header';
  }
  if (PLACEHOLDER_PATTERN.test(text) || PLACEHOLDER_INLINE_PATTERN.test(text) || isLineupPlaceholderLine(text)) {
    return 'placeholder';
  }
  if (TIME_PATTERN.test(text)) {
    return 'time';
  }
  if (isTicketMarketingOrCtaLine(text)) {
    return 'ticket';
  }
  if (mediaContext && isContextNoiseTerm(text, mediaContext)) {
    return 'venue';
  }
  if (OCR_GARBAGE_PATTERN.test(text)) {
    return 'logo';
  }
  if (PROMO_NUMBERED_PATTERN.test(text)) {
    return 'logo';
  }
  if (SYMBOL_COMPOUND_VENUE_PATTERN.test(text)) {
    return 'venue';
  }
  if (mediaContext && splitBillingSegments(text).every((segment) => isContextNoiseTerm(segment, mediaContext))) {
    return 'venue';
  }
  if (LINEUP_HEADER_PATTERN.test(text)) {
    return 'logo';
  }
  if (SYMBOL_HEAVY_PATTERN.test(text)) {
    return 'logo';
  }
  if (ROSTER_DASH_PATTERN.test(text)) {
    const segments = text.split(/\s+-\s+/).map((part) => normalizeLine(part)).filter(Boolean);
    if (segments.length >= 2) {
      return 'roster_line';
    }
  }
  if (DATE_LINE_PATTERN.test(text) && text.length < 60) {
    return 'date';
  }
  if (PROMO_LINE_PATTERN.test(text)) {
    return 'logo';
  }
  if (DATE_PATTERN.test(text) && text.length < 50) {
    return 'date';
  }
  if (LOGO_BOILERPLATE_PATTERN.test(text)) {
    return 'logo';
  }
  if (isLikelyArtistLine(text, mediaContext)) {
    return 'artist_candidate';
  }
  return 'prose';
}

function isLikelyArtistLine(text: string, mediaContext?: MediaEvidenceContext): boolean {
  const normalized = normalizeLine(text);
  if (!normalized || normalized.length > MAX_ARTIST_LINE_LENGTH) {
    return false;
  }
  if (
    isFloorOrStageHeader(normalized) ||
    isLineupIntroMarker(normalized) ||
    isShowcaseLabelLine(normalized) ||
    PLACEHOLDER_PATTERN.test(normalized) ||
    PLACEHOLDER_INLINE_PATTERN.test(normalized) ||
    TIME_PATTERN.test(normalized) ||
    isTicketMarketingOrCtaLine(normalized) ||
    GENRE_HEADER_PATTERN.test(normalized) ||
    LOGO_BOILERPLATE_PATTERN.test(normalized)
  ) {
    return false;
  }
  if (mediaContext && isContextNoiseTerm(normalized, mediaContext)) {
    return false;
  }
  if (DATE_PATTERN.test(normalized) && normalized.length < 40) {
    return false;
  }
  if (/^[▔_\-\s*]{4,}$/.test(normalized)) {
    return false;
  }
  const letters = normalized.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length < 2) {
    return false;
  }
  return true;
}

function splitGenreLabels(text: string): string[] {
  return text
    .split(/\s*[,/|•·]\s*|\s+vs\.?\s+/i)
    .map((part) => normalizeLine(part))
    .filter(Boolean);
}

export function parseMediaLayoutFromOcr(
  ocrLines: MediaOcrLine[],
  ocrBlocks: MediaOcrBlock[],
  mediaContext?: MediaEvidenceContext,
): Pick<
  EventMediaEvidence,
  | 'lineupCandidates'
  | 'genreCandidates'
  | 'rejectedCandidates'
  | 'mediaClassification'
  | 'confidence'
> {
  const lineupCandidates: MediaLineupCandidate[] = [];
  const genreCandidates: MediaGenreCandidate[] = [];
  const rejectedCandidates: RejectedMediaCandidate[] = [];
  const seenActs = new Set<string>();
  const seenGenres = new Set<string>();
  let inGenreSection = false;
  let billingOrder = 0;
  let readableLineCount = 0;
  let confidenceSum = 0;
  const validationContext = buildValidationContext(mediaContext);

  const appendArtistCandidate = (candidateText: string, line: MediaOcrLine): void => {
    const text = normalizeLine(candidateText);
    if (!text || !isLikelyArtistLine(text, mediaContext)) {
      return;
    }
    if (line.confidence < MIN_PUBLISH_LINE_CONFIDENCE) {
      rejectedCandidates.push({
        rawText: text,
        reason: 'low_ocr_confidence',
        confidence: line.confidence,
        sourceRegion: 'ocr_line',
      });
      return;
    }
    const weakWords = line.words.filter((word) => word.confidence < MIN_PUBLISH_WORD_CONFIDENCE);
    if (weakWords.length > line.words.length / 2) {
      rejectedCandidates.push({
        rawText: text,
        reason: 'low_word_confidence',
        confidence: line.confidence,
        sourceRegion: 'ocr_line',
      });
      return;
    }
    if (!isAcceptableOfficialMediaLineupActName(text, validationContext)) {
      rejectedCandidates.push({
        rawText: text,
        reason: 'invalid_media_lineup_entry',
        confidence: line.confidence,
        sourceRegion: 'ocr_line',
      });
      return;
    }
    const key = canonicalActKey(text);
    if (seenActs.has(key)) {
      rejectedCandidates.push({
        rawText: text,
        reason: 'duplicate_lineup_entry',
        confidence: line.confidence,
        sourceRegion: 'ocr_line',
      });
      return;
    }
    seenActs.add(key);
    lineupCandidates.push({
      displayName: text,
      rawText: text,
      confidence: line.confidence,
      evidenceRole: inferLineupEvidenceRole(text, billingOrder),
      billingOrder,
      sourceRegion: 'ocr_line',
    });
    billingOrder += 1;
  };

  const sortedLines = [...ocrLines].sort((left, right) => {
    if (left.bbox.y0 !== right.bbox.y0) {
      return left.bbox.y0 - right.bbox.y0;
    }
    return left.bbox.x0 - right.bbox.x0;
  });

  for (const line of sortedLines) {
    const text = normalizeLine(line.text);
    if (!text) {
      continue;
    }

    readableLineCount += 1;
    confidenceSum += line.confidence;

    const kind = classifyMediaLine(line, mediaContext);
    if (kind === 'genre_header') {
      inGenreSection = true;
      continue;
    }
    if (kind === 'floor_header') {
      inGenreSection = false;
      rejectedCandidates.push({
        rawText: text,
        reason: 'floor_or_stage_header',
        confidence: line.confidence,
        sourceRegion: 'ocr_line',
      });
      continue;
    }
    if (
      ['placeholder', 'time', 'url', 'ticket', 'venue', 'date', 'logo', 'prose', 'empty'].includes(
        kind,
      )
    ) {
      if (kind === 'placeholder') {
        rejectedCandidates.push({
          rawText: text,
          reason: 'placeholder_not_billing',
          confidence: line.confidence,
          sourceRegion: 'ocr_line',
        });
      }
      continue;
    }
    if (kind === 'roster_line') {
      for (const segment of text.split(/\s+-\s+/).map(normalizeLine).filter(Boolean)) {
        appendArtistCandidate(segment, line);
      }
      continue;
    }

    if (inGenreSection || kind === 'artist_candidate') {
      const genreParts = inGenreSection ? splitGenreLabels(text) : [];
      if (inGenreSection) {
        for (const part of genreParts) {
          const normalized = normalizeOfficialGenreLabel(part);
          if (normalized.status === 'normalized') {
            const key = normalized.genreKey;
            if (!seenGenres.has(key)) {
              seenGenres.add(key);
              genreCandidates.push({
                rawLabel: part,
                normalizedLabel: normalized.displayName,
                confidence: line.confidence,
                sourceRegion: 'ocr_genre_section',
              });
            }
          } else if (part.length <= 24) {
            rejectedCandidates.push({
              rawText: part,
              reason: 'genre_label_unmapped',
              confidence: line.confidence,
              sourceRegion: 'ocr_genre_section',
            });
          }
        }
        continue;
      }
    }

    if (kind !== 'artist_candidate') {
      continue;
    }

    appendArtistCandidate(text, line);
  }

  const avgConfidence = readableLineCount > 0 ? confidenceSum / readableLineCount : 0;
  let mediaClassification: MediaClassification = 'generic_event_artwork';
  if (readableLineCount < 3 || avgConfidence < 35) {
    mediaClassification = 'unreadable';
  } else if (lineupCandidates.length > 0) {
    mediaClassification = 'event_flyer';
  } else if (genreCandidates.length > 0) {
    mediaClassification = 'event_artwork_without_billing';
  }

  if (ocrBlocks.length === 0 && readableLineCount === 0) {
    mediaClassification = 'unreadable';
  }

  return {
    lineupCandidates,
    genreCandidates,
    rejectedCandidates,
    mediaClassification,
    confidence: avgConfidence,
  };
}
