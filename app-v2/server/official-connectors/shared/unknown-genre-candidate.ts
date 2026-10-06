import { normalizeOfficialGenreLabel } from './normalize-genre';

export type UnknownGenreClassification =
  | 'VALID_GENRE'
  | 'VALID_SUBGENRE'
  | 'ALIAS'
  | 'NON_GENRE'
  | 'AMBIGUOUS'
  | 'NEEDS_REVIEW';

export interface UnknownGenreCandidate {
  rawTerm: string;
  normalizedTerm: string;
  occurrences: number;
  eventIds: string[];
  sourceTypes: string[];
  evidenceAuthority: string[];
  contexts: string[];
  classification: UnknownGenreClassification;
  reviewReason?: string;
}

const NON_GENRE_HASHTAG_PATTERN =
  /^(?:\d+jahre|10jahre|10jahregemeinsam|party|rave|club|night|festival|openair|soldout|tickets?)$/i;

export function classifyUnknownGenreTerm(rawTerm: string): UnknownGenreClassification {
  const trimmed = rawTerm.trim();
  if (!trimmed || trimmed.length < 2) {
    return 'NON_GENRE';
  }
  const withoutHash = trimmed.replace(/^#/, '');
  if (NON_GENRE_HASHTAG_PATTERN.test(withoutHash)) {
    return 'NON_GENRE';
  }
  const normalized = normalizeOfficialGenreLabel(withoutHash);
  if (normalized.status === 'normalized') {
    return 'ALIAS';
  }
  if (/^[a-z]+(?:[a-z0-9-]*[a-z0-9])?$/i.test(withoutHash) && withoutHash.length <= 24) {
    return 'NEEDS_REVIEW';
  }
  return 'AMBIGUOUS';
}

export function registerUnknownGenreCandidate(
  registry: Map<string, UnknownGenreCandidate>,
  input: {
    rawTerm: string;
    eventId: string;
    sourceType: string;
    authority: string;
    context?: string;
  },
): void {
  const normalizedTerm = input.rawTerm.replace(/^#/, '').trim().toLowerCase();
  if (!normalizedTerm) {
    return;
  }
  const classification = classifyUnknownGenreTerm(input.rawTerm);
  if (classification === 'NON_GENRE' || classification === 'ALIAS') {
    return;
  }
  const key = normalizedTerm;
  const existing = registry.get(key);
  if (existing) {
    existing.occurrences += 1;
    if (!existing.eventIds.includes(input.eventId)) {
      existing.eventIds.push(input.eventId);
    }
    if (!existing.sourceTypes.includes(input.sourceType)) {
      existing.sourceTypes.push(input.sourceType);
    }
    if (!existing.evidenceAuthority.includes(input.authority)) {
      existing.evidenceAuthority.push(input.authority);
    }
    if (input.context && !existing.contexts.includes(input.context)) {
      existing.contexts.push(input.context);
    }
    return;
  }
  registry.set(key, {
    rawTerm: input.rawTerm,
    normalizedTerm,
    occurrences: 1,
    eventIds: [input.eventId],
    sourceTypes: [input.sourceType],
    evidenceAuthority: [input.authority],
    contexts: input.context ? [input.context] : [],
    classification,
    reviewReason: classification === 'NEEDS_REVIEW' ? 'taxonomy_missing' : undefined,
  });
}

export function exportUnknownGenreCandidates(
  registry: Map<string, UnknownGenreCandidate>,
): UnknownGenreCandidate[] {
  return [...registry.values()].sort((left, right) => right.occurrences - left.occurrences);
}
