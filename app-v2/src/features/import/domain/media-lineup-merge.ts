import type { LineupEvidenceEntry } from '@/features/import/contracts/lineup-evidence-candidate';
import {
  compactLineupArtistIdentityKey,
  dedupeLineupEvidenceEntries,
  detectCompoundActSplitRisk,
} from '@/features/import/domain/golden-content-quality-gate';
import type {
  EventMediaEvidence,
  MediaGenreCandidate,
  MediaLineupCandidate,
} from '@/features/import/domain/media-evidence-types';
import { normalizeCanonicalGenreLabels } from '@/features/events/formatting/canonical-genre-normalizer';
import { normalizeMatchText } from '@/features/import/matching/matching-utils';

export interface MediaLineupMergeResult {
  entries: LineupEvidenceEntry[];
  reviewReasons: string[];
  rejectedMedia: Array<{ rawText: string; reason: string }>;
}

function toLineupEvidenceEntry(
  candidate: MediaLineupCandidate,
  sortOrder: number,
): LineupEvidenceEntry {
  const billingRelation =
    candidate.evidenceRole === 'compound_act'
      ? 'B2B'
      : candidate.evidenceRole === 'headliner'
        ? 'HEADLINER'
        : 'SOLO';
  return {
    sortOrder,
    displayName: candidate.displayName,
    rawSourceSpelling: candidate.rawText,
    normalizedName: normalizeMatchText(candidate.displayName),
    billingRelation,
    isB2b: candidate.evidenceRole === 'compound_act' || /\bB2B\b/i.test(candidate.displayName),
    isF2f: /\bF2F\b/i.test(candidate.displayName),
    isLiveSet: /\bLIVE\b/i.test(candidate.displayName),
    confidence: candidate.confidence,
    reviewState: 'accepted',
    inclusionReason: 'official_media',
  };
}

function rankLineupEntry(entry: LineupEvidenceEntry): number {
  if (entry.inclusionReason.includes('structured')) {
    return 100;
  }
  if (entry.inclusionReason === 'official_media') {
    return 80;
  }
  if (entry.inclusionReason.includes('description') || entry.inclusionReason.includes('text')) {
    return 60;
  }
  if (entry.inclusionReason.includes('title')) {
    return 40;
  }
  return 50;
}

export function mergeOfficialAndMediaLineupEvidence(input: {
  officialEntries: LineupEvidenceEntry[];
  mediaEvidence?: EventMediaEvidence;
  lineupSourceText?: string;
}): MediaLineupMergeResult {
  const reviewReasons: string[] = [];
  const rejectedMedia: Array<{ rawText: string; reason: string }> = [];

  if (!input.mediaEvidence || input.mediaEvidence.status !== 'extracted') {
    return {
      entries: dedupeLineupEvidenceEntries(input.officialEntries),
      reviewReasons,
      rejectedMedia,
    };
  }

  const mediaEntries = input.mediaEvidence.lineupCandidates.map((candidate, index) =>
    toLineupEvidenceEntry(candidate, index),
  );

  const byKey = new Map<string, LineupEvidenceEntry>();
  for (const entry of input.officialEntries) {
    const key = compactLineupArtistIdentityKey(entry.displayName);
    if (key) {
      byKey.set(key, entry);
    }
  }

  for (const mediaEntry of mediaEntries) {
    const key = compactLineupArtistIdentityKey(mediaEntry.displayName);
    if (!key) {
      rejectedMedia.push({ rawText: mediaEntry.displayName, reason: 'invalid_lineup_entry' });
      continue;
    }
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, mediaEntry);
      continue;
    }
    if (rankLineupEntry(existing) >= rankLineupEntry(mediaEntry)) {
      continue;
    }
    byKey.set(key, {
      ...mediaEntry,
      displayName: existing.displayName,
      rawSourceSpelling: existing.rawSourceSpelling || mediaEntry.rawSourceSpelling,
      sortOrder: existing.sortOrder,
      inclusionReason: existing.inclusionReason,
    });
  }

  const merged = dedupeLineupEvidenceEntries(
    [...byKey.values()].sort((left, right) => left.sortOrder - right.sortOrder),
  );

  const officialKeys = new Set(
    input.officialEntries.map((entry) => compactLineupArtistIdentityKey(entry.displayName)),
  );
  for (const mediaEntry of mediaEntries) {
    const key = compactLineupArtistIdentityKey(mediaEntry.displayName);
    if (!key || officialKeys.has(key)) {
      continue;
    }
    const conflictingOfficial = input.officialEntries.find(
      (entry) =>
        normalizeMatchText(entry.displayName) !== normalizeMatchText(mediaEntry.displayName) &&
        compactLineupArtistIdentityKey(entry.displayName) !== key &&
        entry.displayName.toLowerCase().includes(mediaEntry.displayName.toLowerCase().slice(0, 4)),
    );
    if (conflictingOfficial) {
      reviewReasons.push('lineup_evidence_conflict');
    }
  }

  const sourceText = [input.lineupSourceText ?? '', input.mediaEvidence.rawText ?? ''].join('\n');
  if (detectCompoundActSplitRisk(sourceText, merged.map((entry) => entry.displayName))) {
    reviewReasons.push('compound_act_split');
  }

  return {
    entries: merged,
    reviewReasons,
    rejectedMedia,
  };
}

export function mergeOfficialAndMediaGenreEvidence(input: {
  officialGenres?: string[];
  mediaEvidence?: EventMediaEvidence;
  artistNames?: string[];
  venueName?: string;
  organizerName?: string;
}): {
  genreLabels: string[];
  reviewReasons: string[];
  rejectedGenres: Array<{ rawLabel: string; reason: string }>;
} {
  const reviewReasons: string[] = [];
  const rejectedGenres: Array<{ rawLabel: string; reason: string }> = [];
  const official = normalizeCanonicalGenreLabels(input.officialGenres ?? []);
  const mediaLabels = (input.mediaEvidence?.genreCandidates ?? [])
    .map((candidate) => candidate.normalizedLabel ?? candidate.rawLabel)
    .filter(Boolean);

  const artistTokens = new Set(
    (input.artistNames ?? []).map((name) => normalizeMatchText(name)).filter(Boolean),
  );
  const venueToken = input.venueName ? normalizeMatchText(input.venueName) : '';
  const organizerToken = input.organizerName ? normalizeMatchText(input.organizerName) : '';

  const filteredMedia: string[] = [];
  for (const candidate of input.mediaEvidence?.genreCandidates ?? []) {
    const raw = candidate.rawLabel.trim();
    const normalized = normalizeMatchText(raw);
    if (artistTokens.has(normalized)) {
      rejectedGenres.push({ rawLabel: raw, reason: 'genre_inferred_from_artist' });
      reviewReasons.push('genre_inferred_from_artist');
      continue;
    }
    if (venueToken && normalized.includes(venueToken)) {
      rejectedGenres.push({ rawLabel: raw, reason: 'genre_inferred_from_venue_or_organizer' });
      reviewReasons.push('genre_inferred_from_venue_or_organizer');
      continue;
    }
    if (organizerToken && normalized.includes(organizerToken)) {
      rejectedGenres.push({ rawLabel: raw, reason: 'genre_inferred_from_venue_or_organizer' });
      continue;
    }
    if (!candidate.normalizedLabel) {
      rejectedGenres.push({ rawLabel: raw, reason: 'genre_label_unmapped' });
      continue;
    }
    filteredMedia.push(candidate.normalizedLabel);
  }

  const merged = [...official];
  const seen = new Set(official.map((genre) => normalizeMatchText(genre)));
  for (const genre of filteredMedia) {
    const key = normalizeMatchText(genre);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push(genre);
  }

  for (const genre of official) {
    if (!merged.includes(genre)) {
      reviewReasons.push('explicit_genre_evidence_lost');
    }
  }

  return {
    genreLabels: normalizeCanonicalGenreLabels(merged),
    reviewReasons: [...new Set(reviewReasons)],
    rejectedGenres,
  };
}

export function mediaGenreCandidatesToLabels(candidates: MediaGenreCandidate[]): string[] {
  return normalizeCanonicalGenreLabels(
    candidates
      .map((candidate) => candidate.normalizedLabel ?? '')
      .filter((label) => label.length > 0),
  );
}
