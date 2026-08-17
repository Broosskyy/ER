import {
  canonicalActKey,
  inferLineupEvidenceRole,
  isAcceptableOfficialMediaLineupActName,
  type LineupValidationContext,
} from '../shared/lineup-normalization';
import type { MediaEvidenceContext } from '../shared/media-evidence-context';
import type {
  EventMediaEvidence,
  MediaLineupCandidate,
  MediaOcrLine,
} from './types';
import { compactOcrKey, normalizeOcrArtistLine } from './normalize-ocr-artist-line';

const MIN_SIGNIFICANT_TOKEN_LENGTH = 4;
const CORROBORATION_CONFIDENCE = 68;
const MIN_COMPACT_ACT_MATCH_RATIO = 0.5;
const MIN_COMPACT_LEVENSHTEIN_RATIO = 0.72;

function levenshteinDistance(left: string, right: string): number {
  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));

  for (let row = 0; row < rows; row++) {
    matrix[row]![0] = row;
  }
  for (let col = 0; col < cols; col++) {
    matrix[0]![col] = col;
  }

  for (let row = 1; row < rows; row++) {
    const matrixRow = matrix[row]!;
    const previousRow = matrix[row - 1]!;
    for (let col = 1; col < cols; col++) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrixRow[col] = Math.min(
        previousRow[col]! + 1,
        matrixRow[col - 1]! + 1,
        previousRow[col - 1]! + cost,
      );
    }
  }

  return matrix[left.length]![right.length]!;
}

function compactLevenshteinRatio(left: string, right: string): number {
  if (!left || !right) {
    return 0;
  }
  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function compactActMatchRatio(actName: string, targetCompact: string): number {
  const actCompact = compactOcrKey(actName);
  if (!actCompact || !targetCompact) {
    return 0;
  }
  if (targetCompact.includes(actCompact) || actCompact.includes(targetCompact)) {
    return 1;
  }

  const levenshteinRatio = compactLevenshteinRatio(actCompact, targetCompact);
  if (
    Math.abs(actCompact.length - targetCompact.length) <= 3 &&
    levenshteinRatio >= MIN_COMPACT_LEVENSHTEIN_RATIO
  ) {
    return levenshteinRatio;
  }

  let best = 0;
  for (let start = 0; start < actCompact.length; start++) {
    for (let end = start + MIN_SIGNIFICANT_TOKEN_LENGTH; end <= actCompact.length; end++) {
      const slice = actCompact.slice(start, end);
      if (targetCompact.includes(slice)) {
        best = Math.max(best, slice.length / actCompact.length);
      }
    }
  }
  return best;
}

function extractSignificantTokens(actName: string): string[] {
  return actName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_SIGNIFICANT_TOKEN_LENGTH);
}

export function buildOcrCorpusCompact(ocrLines: MediaOcrLine[], rawText?: string): string {
  const parts = ocrLines.map((line) => compactOcrKey(line.text));
  if (rawText) {
    parts.push(compactOcrKey(rawText));
  }
  return parts.join('');
}

export function actNameMatchesOcrCorpus(
  actName: string,
  corpusCompact: string,
  ocrLines: MediaOcrLine[] = [],
  rawText?: string,
): boolean {
  if (compactActMatchRatio(actName, corpusCompact) >= MIN_COMPACT_ACT_MATCH_RATIO) {
    return true;
  }

  for (const line of ocrLines) {
    if (compactActMatchRatio(actName, compactOcrKey(line.text)) >= MIN_COMPACT_ACT_MATCH_RATIO) {
      return true;
    }
  }

  if (rawText && compactActMatchRatio(actName, compactOcrKey(rawText)) >= MIN_COMPACT_ACT_MATCH_RATIO) {
    return true;
  }

  const tokens = extractSignificantTokens(actName);
  if (tokens.length === 0) {
    const compactAct = compactOcrKey(actName);
    return compactAct.length >= MIN_SIGNIFICANT_TOKEN_LENGTH && corpusCompact.includes(compactAct);
  }

  const matchedTokens = tokens.filter((token) => corpusCompact.includes(token));
  const requiredMatches = tokens.length === 1 ? 1 : Math.min(2, tokens.length);
  return matchedTokens.length >= requiredMatches;
}

function findBestMatchingOcrLine(actName: string, ocrLines: MediaOcrLine[]): string | undefined {
  const tokens = extractSignificantTokens(actName);
  let bestLine: string | undefined;
  let bestScore = 0;

  for (const line of ocrLines) {
    const compactLine = compactOcrKey(line.text);
    const score = tokens.filter((token) => compactLine.includes(token)).length;
    if (score > bestScore) {
      bestScore = score;
      bestLine = line.text;
    }
  }

  return bestScore > 0 ? bestLine : undefined;
}

export function corroborateMediaLineupFromOcr(
  parsed: Pick<
    EventMediaEvidence,
    | 'lineupCandidates'
    | 'genreCandidates'
    | 'rejectedCandidates'
    | 'mediaClassification'
    | 'confidence'
  >,
  ocrLines: MediaOcrLine[],
  corroborationLineup: string[],
  options: {
    mediaContext?: MediaEvidenceContext;
    rawText?: string;
  } = {},
): Pick<
  EventMediaEvidence,
  | 'lineupCandidates'
  | 'genreCandidates'
  | 'rejectedCandidates'
  | 'mediaClassification'
  | 'confidence'
> {
  if (corroborationLineup.length === 0) {
    return parsed;
  }

  const corpusCompact = buildOcrCorpusCompact(ocrLines, options.rawText);
  const validationContext: LineupValidationContext = { mediaContext: options.mediaContext };
  const corroborationKeys = new Set(corroborationLineup.map((act) => canonicalActKey(act)));
  const seenKeys = new Set<string>();
  const lineupCandidates: MediaLineupCandidate[] = [];

  for (const candidate of parsed.lineupCandidates) {
    const key = canonicalActKey(candidate.displayName);
    const supersededByCorroboration = corroborationLineup.some(
      (actName) =>
        canonicalActKey(actName) !== key &&
        compactActMatchRatio(actName, compactOcrKey(candidate.displayName)) >=
          MIN_COMPACT_ACT_MATCH_RATIO,
    );
    if (supersededByCorroboration) {
      continue;
    }
    if (!corroborationKeys.has(key)) {
      continue;
    }
    if (!isAcceptableOfficialMediaLineupActName(candidate.displayName, validationContext)) {
      continue;
    }
    if (seenKeys.has(key)) {
      continue;
    }
    seenKeys.add(key);
    lineupCandidates.push(candidate);
  }

  for (const actName of corroborationLineup) {
    const key = canonicalActKey(actName);
    if (seenKeys.has(key)) {
      continue;
    }
    if (!actNameMatchesOcrCorpus(actName, corpusCompact, ocrLines, options.rawText)) {
      continue;
    }
    if (!isAcceptableOfficialMediaLineupActName(actName, validationContext)) {
      continue;
    }

    const rawText = findBestMatchingOcrLine(actName, ocrLines) ?? actName;
    lineupCandidates.push({
      displayName: actName,
      rawText,
      confidence: CORROBORATION_CONFIDENCE,
      evidenceRole: inferLineupEvidenceRole(actName, lineupCandidates.length),
      billingOrder: lineupCandidates.length,
      sourceRegion: 'ocr_corroboration',
    });
    seenKeys.add(key);
  }

  let mediaClassification = parsed.mediaClassification;
  if (lineupCandidates.length > 0 && mediaClassification === 'unreadable') {
    mediaClassification = 'event_flyer';
  }

  return {
    ...parsed,
    lineupCandidates,
    mediaClassification,
  };
}

export function normalizeMediaOcrLines(ocrLines: MediaOcrLine[]): MediaOcrLine[] {
  return ocrLines
    .map((line) => ({
      ...line,
      text: normalizeOcrArtistLine(line.text),
    }))
    .filter((line) => line.text.length > 0);
}
