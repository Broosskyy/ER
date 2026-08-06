/**
 * Phase 4.6.4 — Parse flyer/poster OCR text into lineup candidates with noise rejection.
 */

import { sanitizeLineupArtistNames, isLineupPlaceholderArtist } from '@/features/events/domain/lineup-artist-quality';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

const FLYER_NOISE_PATTERN =
  /\b(?:line[\s-]?up|artists?|presents?|edition|floor|stage|organization|sponsor|mystery|unknown|tba|tbd|tickets?|einlass|doors|ab\s+\d|uhr|pm|am|€|eur|years?|jahre?|instagram|facebook|soundcloud|www\.|http)\b/i;

const B2B_UNIT_PATTERN =
  /[A-Z][A-Za-z0-9&.'+\-]*(?:\s+[A-Z][A-Za-z0-9&.'+\-]*)*\s+(?:B2B|F2F)\s+[A-Z][A-Za-z0-9&.'+\-]*(?:\s+[A-Z][A-Za-z0-9&.'+\-]*)*/g;

export interface FlyerLineupCandidate {
  displayName: string;
  normalizedName: string;
  confidence: number;
  isB2b?: boolean;
  isF2f?: boolean;
  rejected?: boolean;
  rejectReason?: string;
}

export interface FlyerLineupParseInput {
  rawText: string;
  eventTitle?: string;
  venueName?: string;
  cityName?: string;
  knownCanonicalNames?: string[];
  knownAliasNames?: string[];
  corroboratingTextNames?: string[];
}

function isObviousNoise(token: string, input: FlyerLineupParseInput): boolean {
  const trimmed = token.trim();
  if (!trimmed || trimmed.length < 2) return true;
  if (isLineupPlaceholderArtist(trimmed)) return true;
  if (FLYER_NOISE_PATTERN.test(trimmed)) return true;
  if (/^\d+([.,]\d+)?\s*€?$/.test(trimmed)) return true;
  if (/^\d{1,2}[./]\d{1,2}([./]\d{2,4})?$/.test(trimmed)) return true;

  const normalized = normalizeMatchText(trimmed);
  if (input.eventTitle && normalizeMatchText(input.eventTitle) === normalized) return true;
  if (input.venueName && normalizeMatchText(input.venueName) === normalized) return true;
  if (input.cityName && normalizeMatchText(input.cityName) === normalized) return true;
  if (/^by\s+/i.test(trimmed)) return true;
  return false;
}

function scoreCandidate(name: string, input: FlyerLineupParseInput): number {
  const normalized = normalizeMatchText(name);
  const canonical = (input.knownCanonicalNames ?? []).map(normalizeMatchText);
  const aliases = (input.knownAliasNames ?? []).map(normalizeMatchText);
  const corroborating = (input.corroboratingTextNames ?? []).map(normalizeMatchText);

  if (canonical.includes(normalized)) return 0.95;
  if (aliases.includes(normalized)) return 0.9;
  if (corroborating.includes(normalized)) return 0.75;
  if (/\b(?:B2B|F2F)\b/.test(name)) return 0.55;
  if (name.length >= 4 && /^[A-Z]/.test(name)) return 0.45;
  return 0.25;
}

function tokenizeFlyerText(rawText: string): string[] {
  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const tokens: string[] = [];
  for (const line of lines) {
    const b2bMatches = line.match(B2B_UNIT_PATTERN);
    if (b2bMatches?.length) {
      tokens.push(...b2bMatches.map((part) => part.trim()));
      continue;
    }

    tokens.push(
      ...line
        .split(/\s{2,}|,/)
        .map((part) => part.trim())
        .filter(Boolean),
    );
  }

  return tokens;
}

export function parseFlyerLineupCandidates(input: FlyerLineupParseInput): FlyerLineupCandidate[] {
  const tokens = tokenizeFlyerText(input.rawText);
  const seen = new Set<string>();
  const candidates: FlyerLineupCandidate[] = [];

  for (const token of tokens) {
    if (/\b(?:B2B|F2F|VS\.?)\b/i.test(token)) {
      const key = normalizeMatchText(token);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      const confidence = Math.max(scoreCandidate(token, input), 0.85);
      candidates.push({
        displayName: token,
        normalizedName: key,
        confidence,
        isB2b: /\bB2B\b/i.test(token),
        isF2f: /\bF2F\b/i.test(token),
        rejected: false,
      });
      continue;
    }

    const cleanedNames = sanitizeLineupArtistNames([token]) ?? [];
    for (const cleaned of cleanedNames) {
      const key = normalizeMatchText(cleaned);
      if (seen.has(key)) continue;
      seen.add(key);

      if (isObviousNoise(cleaned, input)) {
        candidates.push({
          displayName: cleaned,
          normalizedName: key,
          confidence: 0,
          rejected: true,
          rejectReason: 'flyer_noise',
        });
        continue;
      }

      const confidence = scoreCandidate(cleaned, input);
      candidates.push({
        displayName: cleaned,
        normalizedName: key,
        confidence,
        isB2b: /\bB2B\b/i.test(token),
        isF2f: /\bF2F\b/i.test(token),
        rejected: confidence < 0.4,
        rejectReason: confidence < 0.4 ? 'low_confidence' : undefined,
      });
    }
  }

  return candidates;
}

export function selectPublishableFlyerCandidates(
  candidates: FlyerLineupCandidate[],
): FlyerLineupCandidate[] {
  return candidates.filter((c) => !c.rejected && c.confidence >= 0.9);
}

export function selectReviewRequiredFlyerCandidates(
  candidates: FlyerLineupCandidate[],
): FlyerLineupCandidate[] {
  return candidates.filter((c) => !c.rejected && c.confidence >= 0.55 && c.confidence < 0.9);
}
