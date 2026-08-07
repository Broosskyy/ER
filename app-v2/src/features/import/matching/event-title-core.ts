import { normalizeMatchText } from '@/features/import/matching/matching-utils';

export type EventTitleCoreConfidence = 'high' | 'medium' | 'low' | 'none';
export type EventTitleCoreMatchStrength = 'exact' | 'partial' | 'none';

export interface EventTitleCoreContext {
  venueName?: string;
  organizerName?: string;
}

export interface EventTitleCoreAnalysis {
  rawTitle: string;
  normalizedTitle: string;
  coreTokens: string[];
  residualTokens: string[];
  usesAnchorCore: boolean;
  removedQualifiers: string[];
  comparisonReason: string;
  confidence: EventTitleCoreConfidence;
}

export interface EventTitleCoreComparison {
  coresAgree: boolean;
  sharedCoreTokens: string[];
  residualTokensDiffer: boolean;
  comparisonReason: string;
  confidence: EventTitleCoreConfidence;
  requiresSecondaryEvidence: boolean;
  maxMatchStrength: EventTitleCoreMatchStrength;
}

export interface EventTitleCoreSecondaryEvidence {
  dateAgrees?: boolean;
  venueCompatible?: boolean;
  verifiedAt?: string;
  officialOutboundConfirmed?: boolean;
  slugRelationshipConfirmed?: boolean;
}

function pushQualifier(removed: string[], value: string | undefined): void {
  const trimmed = value?.trim();
  if (trimmed) {
    removed.push(trimmed);
  }
}

function stripParentheticalSuffix(value: string, removed: string[]): string {
  const match = value.match(/\s*\(([^)]+)\)\s*$/);
  if (!match) {
    return value;
  }
  pushQualifier(removed, match[0].trim());
  return value.slice(0, match.index).trim();
}

function stripAtSuffix(value: string, removed: string[]): string {
  const atIndex = value.indexOf('@');
  if (atIndex >= 0) {
    pushQualifier(removed, value.slice(atIndex).trim());
    return value.slice(0, atIndex).trim();
  }
  return value;
}

function stripPresenterPhrases(value: string, removed: string[]): string {
  let working = value;

  const suffixPatterns = [
    /\s+presented\s+by\s+.+$/i,
    /\s+pres\.?\s*by\s+.+$/i,
    /\s+präsentiert(?:\s+von)?\s+.+$/i,
  ];
  for (const pattern of suffixPatterns) {
    const match = working.match(pattern);
    if (match) {
      pushQualifier(removed, match[0].trim());
      working = working.slice(0, match.index).trim();
    }
  }

  const prefixPresentMatch = working.match(/^(.+?)\s+presents?\s+(.+)$/i);
  if (prefixPresentMatch?.[2]) {
    pushQualifier(removed, `${prefixPresentMatch[1]} presents`);
    working = prefixPresentMatch[2].trim();
  }

  const prefixPresMatch = working.match(/^(.+?)\s+pres\.?\s+(.+)$/i);
  if (prefixPresMatch?.[2]) {
    pushQualifier(removed, `${prefixPresMatch[1]} pres.`);
    working = prefixPresMatch[2].trim();
  }

  const prefixPraesentiertMatch = working.match(/^(.+?)\s+präsentiert\s+(.+)$/i);
  if (prefixPraesentiertMatch?.[2]) {
    pushQualifier(removed, `${prefixPraesentiertMatch[1]} präsentiert`);
    working = prefixPraesentiertMatch[2].trim();
  }

  return working;
}

function stripEmbeddedDates(value: string, removed: string[]): string {
  const datePatterns = [/\b\d{1,2}\.\d{1,2}\.\d{2,4}\b/g, /\b\d{4}-\d{2}-\d{2}\b/g];
  let working = value;
  for (const pattern of datePatterns) {
    const matches = working.match(pattern);
    if (matches) {
      for (const match of matches) {
        pushQualifier(removed, match);
      }
      working = working.replace(pattern, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return working;
}

function contextTokenSet(context: EventTitleCoreContext | undefined): Set<string> {
  const tokens = new Set<string>();
  for (const raw of [context?.venueName, context?.organizerName]) {
    if (!raw?.trim()) {
      continue;
    }
    for (const token of normalizeMatchText(raw).split(/[\s,/]+/).filter((entry) => entry.length > 1)) {
      tokens.add(token);
    }
  }
  return tokens;
}

function stripContextFields(
  value: string,
  context: EventTitleCoreContext | undefined,
  removed: string[],
): string {
  const contextTokens = contextTokenSet(context);
  if (contextTokens.size === 0) {
    return value;
  }

  const kept: string[] = [];
  const removedParts: string[] = [];
  for (const part of value.split(/\s+/).filter(Boolean)) {
    const normalizedPart = normalizeMatchText(part);
    if (normalizedPart && contextTokens.has(normalizedPart)) {
      removedParts.push(part);
      continue;
    }
    kept.push(part);
  }

  if (removedParts.length > 0) {
    pushQualifier(removed, removedParts.join(' '));
  }

  return kept.join(' ').trim();
}

function isAnchorCoreToken(normalizedToken: string, rawToken?: string): boolean {
  if (!normalizedToken) {
    return false;
  }
  if (/[0-9]/.test(normalizedToken)) {
    return true;
  }
  const raw = rawToken?.trim() ?? normalizedToken;
  if (/^[A-Z0-9]{2,8}$/.test(raw)) {
    return true;
  }
  return false;
}

function uniqueTokens(tokens: string[]): string[] {
  return [...new Set(tokens.filter(Boolean))];
}

function setsEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const rightSet = new Set(right);
  return left.every((token) => rightSet.has(token));
}

function tokenPairsFromWorking(working: string): Array<{ raw: string; normalized: string }> {
  return working
    .split(/[\s–—|/]+/)
    .map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter((token) => token.length > 0)
    .map((raw) => ({ raw, normalized: normalizeMatchText(raw) }))
    .filter((pair) => pair.normalized.length > 0);
}

function deriveCoreAndResidual(
  tokenPairs: Array<{ raw: string; normalized: string }>,
): { coreTokens: string[]; residualTokens: string[] } {
  const significant = tokenPairs.filter((pair) => pair.normalized.length > 1);
  const anchors = uniqueTokens(
    significant.filter((pair) => isAnchorCoreToken(pair.normalized, pair.raw)).map((pair) => pair.normalized),
  );

  if (anchors.length > 0) {
    const anchorSet = new Set(anchors);
    const residualTokens = uniqueTokens(
      significant
        .filter((pair) => !anchorSet.has(pair.normalized))
        .map((pair) => pair.normalized),
    );
    return { coreTokens: anchors, residualTokens };
  }

  return {
    coreTokens: uniqueTokens(significant.map((pair) => pair.normalized)),
    residualTokens: [],
  };
}

/** Extracts a stable event title core while preserving the raw title unchanged in the result. */
export function analyzeEventTitleCore(
  rawTitle: string,
  context?: EventTitleCoreContext,
): EventTitleCoreAnalysis {
  const raw = rawTitle.trim();
  if (!raw) {
    return {
      rawTitle: rawTitle,
      normalizedTitle: '',
      coreTokens: [],
      residualTokens: [],
      usesAnchorCore: false,
      removedQualifiers: [],
      comparisonReason: 'empty_title',
      confidence: 'none',
    };
  }

  const removedQualifiers: string[] = [];
  let working = raw;
  working = stripAtSuffix(working, removedQualifiers);
  working = stripParentheticalSuffix(working, removedQualifiers);
  working = stripPresenterPhrases(working, removedQualifiers);
  working = stripEmbeddedDates(working, removedQualifiers);
  working = stripContextFields(working, context, removedQualifiers);

  const normalizedTitle = normalizeMatchText(working);
  const tokenPairs = tokenPairsFromWorking(working);
  const { coreTokens, residualTokens } = deriveCoreAndResidual(tokenPairs);
  const usesAnchorCore = tokenPairs.some((pair) => isAnchorCoreToken(pair.normalized, pair.raw));

  const confidence: EventTitleCoreConfidence =
    coreTokens.length === 0
      ? 'none'
      : coreTokens.length === 1
        ? 'medium'
        : coreTokens.length <= 3
          ? 'high'
          : 'medium';

  return {
    rawTitle,
    normalizedTitle,
    coreTokens,
    residualTokens,
    usesAnchorCore,
    removedQualifiers,
    comparisonReason:
      coreTokens.length > 0 ? 'core_tokens_extracted' : 'no_stable_core_tokens_after_normalization',
    confidence,
  };
}

/** Compares extracted cores using exact token equality — never substring matching. */
export function compareEventTitleCores(
  left: EventTitleCoreAnalysis,
  right: EventTitleCoreAnalysis,
): EventTitleCoreComparison {
  const leftCore = uniqueTokens(left.coreTokens);
  const rightCore = uniqueTokens(right.coreTokens);

  if (leftCore.length === 0 || rightCore.length === 0) {
    return {
      coresAgree: false,
      sharedCoreTokens: [],
      residualTokensDiffer: false,
      comparisonReason: 'missing_core_tokens',
      confidence: 'none',
      requiresSecondaryEvidence: true,
      maxMatchStrength: 'none',
    };
  }

  const leftAnchors = left.usesAnchorCore ? leftCore : [];
  const rightAnchors = right.usesAnchorCore ? rightCore : [];
  const anchorMode = left.usesAnchorCore || right.usesAnchorCore;

  const leftSet = new Set(leftCore);
  const rightSet = new Set(rightCore);
  const sharedCoreTokens = leftCore.filter((token) => rightSet.has(token));

  if (sharedCoreTokens.length === 0) {
    return {
      coresAgree: false,
      sharedCoreTokens: [],
      residualTokensDiffer: false,
      comparisonReason: 'no_shared_core_tokens',
      confidence: 'none',
      requiresSecondaryEvidence: true,
      maxMatchStrength: 'none',
    };
  }

  if (!anchorMode) {
    const coresAgree = setsEqual(leftCore, rightCore);
    return {
      coresAgree,
      sharedCoreTokens,
      residualTokensDiffer: false,
      comparisonReason: coresAgree ? 'shared_core_tokens_agree' : 'non_anchor_core_token_mismatch',
      confidence: coresAgree ? 'high' : 'low',
      requiresSecondaryEvidence: false,
      maxMatchStrength: coresAgree ? 'exact' : 'none',
    };
  }

  const leftAnchorSet = new Set(leftAnchors);
  const rightAnchorSet = new Set(rightAnchors);
  const sharedAnchors = leftAnchors.filter((token) => rightAnchorSet.has(token));
  const anchorCoresAgree =
    sharedAnchors.length > 0 &&
    leftAnchors.every((token) => rightAnchorSet.has(token)) &&
    rightAnchors.every((token) => leftAnchorSet.has(token));

  if (!anchorCoresAgree) {
    return {
      coresAgree: false,
      sharedCoreTokens,
      residualTokensDiffer: false,
      comparisonReason: 'anchor_core_token_mismatch',
      confidence: 'low',
      requiresSecondaryEvidence: true,
      maxMatchStrength: 'none',
    };
  }

  const residualTokensDiffer = !setsEqual(left.residualTokens, right.residualTokens);
  const requiresSecondaryEvidence = sharedCoreTokens.length === 1;
  const maxMatchStrength: EventTitleCoreMatchStrength = residualTokensDiffer
    ? 'partial'
    : requiresSecondaryEvidence
      ? 'partial'
      : 'exact';

  return {
    coresAgree: true,
    sharedCoreTokens,
    residualTokensDiffer,
    comparisonReason: residualTokensDiffer
      ? 'shared_anchor_with_residual_token_difference'
      : requiresSecondaryEvidence
        ? 'single_core_token_requires_secondary_evidence'
        : 'shared_core_tokens_agree',
    confidence: residualTokensDiffer ? 'medium' : requiresSecondaryEvidence ? 'medium' : 'high',
    requiresSecondaryEvidence,
    maxMatchStrength,
  };
}

export function hasStrongTitleCoreSecondaryEvidence(
  evidence: EventTitleCoreSecondaryEvidence,
): boolean {
  if (!evidence.verifiedAt?.trim()) {
    return false;
  }
  if (!evidence.dateAgrees) {
    return false;
  }
  return Boolean(
    evidence.venueCompatible ||
      evidence.officialOutboundConfirmed ||
      evidence.slugRelationshipConfirmed,
  );
}

export function scoreTitleCoreAgreement(
  leftRawTitle: string,
  rightRawTitle: string,
  secondaryEvidence?: EventTitleCoreSecondaryEvidence,
  context?: { left?: EventTitleCoreContext; right?: EventTitleCoreContext },
): {
  score: number;
  coresAgree: boolean;
  comparisonReason: string;
  requiresSecondaryEvidence: boolean;
  residualTokensDiffer: boolean;
  maxMatchStrength: EventTitleCoreMatchStrength;
} {
  const comparison = compareEventTitleCores(
    analyzeEventTitleCore(leftRawTitle, context?.left),
    analyzeEventTitleCore(rightRawTitle, context?.right),
  );

  if (!comparison.coresAgree) {
    return {
      score: 0,
      coresAgree: false,
      comparisonReason: comparison.comparisonReason,
      requiresSecondaryEvidence: comparison.requiresSecondaryEvidence,
      residualTokensDiffer: comparison.residualTokensDiffer,
      maxMatchStrength: 'none',
    };
  }

  if (
    comparison.requiresSecondaryEvidence &&
    !hasStrongTitleCoreSecondaryEvidence(secondaryEvidence ?? {})
  ) {
    return {
      score: 0.34,
      coresAgree: true,
      comparisonReason: 'core_agrees_without_strong_secondary_evidence',
      requiresSecondaryEvidence: true,
      residualTokensDiffer: comparison.residualTokensDiffer,
      maxMatchStrength: 'partial',
    };
  }

  if (comparison.maxMatchStrength === 'partial') {
    return {
      score: 0.8,
      coresAgree: true,
      comparisonReason: comparison.comparisonReason,
      requiresSecondaryEvidence: comparison.requiresSecondaryEvidence,
      residualTokensDiffer: comparison.residualTokensDiffer,
      maxMatchStrength: 'partial',
    };
  }

  return {
    score: comparison.confidence === 'high' ? 0.95 : 0.8,
    coresAgree: true,
    comparisonReason: comparison.comparisonReason,
    requiresSecondaryEvidence: comparison.requiresSecondaryEvidence,
    residualTokensDiffer: comparison.residualTokensDiffer,
    maxMatchStrength: 'exact',
  };
}
