import type { MediaVisionOcrResult } from '@/features/aggregation/connectors/framework/detail-extraction/media-vision-ocr-provider';
import {
  isMediaEvidenceProviderConfigured,
  resolveConfiguredMediaOcrProviders,
} from '@/features/aggregation/connectors/framework/detail-extraction/media-vision-ocr-provider';
import { normalizeCanonicalGenreLabel } from '@/features/events/formatting/canonical-genre-normalizer';
import {
  isLineupBlobArtistName,
  isLineupPlaceholderArtist,
} from '@/features/events/domain/lineup-artist-quality';
import type {
  EventMediaEvidence,
  MediaGenreCandidate,
  MediaLineupCandidate,
  MediaLineupEvidenceRole,
  RejectedMediaCandidate,
} from '@/features/import/domain/media-evidence-types';
import { fetchOfficialEventImage, fingerprintImageBytes } from '@/features/import/domain/media-image-fetch';
import { extractLineupFromContentBlocks } from '@/features/import/unified-website/lineup-extraction';

const MEDIA_LINEUP_CONFIDENCE_GATE = 0.45;
const MEDIA_GENRE_CONFIDENCE_GATE = 0.55;

const INVALID_LINEUP_PATTERNS =
  /\b(?:main\s*floor|second\s*floor|bootshaus|loonyland|present|presents|tba|and\s+more|ticket|einlass|uhr|august|january|february|march|april|may|june|july|september|october|november|december|www\.|http)\b/i;

const EXPLICIT_GENRE_LABEL_PATTERN =
  /^(?:genres?|music|style)\s*:?\s*(.+)$/i;

function normalizeEvidenceRole(value: string | undefined): MediaLineupEvidenceRole {
  if (value === 'headliner' || value === 'compound_act' || value === 'artist') {
    return value;
  }
  return 'artist';
}

function rejectLineupCandidate(
  rawText: string,
  reason: string,
  rejected: RejectedMediaCandidate[],
): void {
  rejected.push({ rawText, field: 'lineup', reason });
}

function isInvalidMediaLineupValue(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length < 2) {
    return 'too_short';
  }
  if (isLineupPlaceholderArtist(trimmed) || isLineupBlobArtistName(trimmed)) {
    return 'lineup_placeholder';
  }
  if (INVALID_LINEUP_PATTERNS.test(trimmed)) {
    return 'lineup_noise';
  }
  if (/^[\d./\s]+$/.test(trimmed)) {
    return 'date_or_numeric_noise';
  }
  if (/https?:\/\//i.test(trimmed) || trimmed.includes('@')) {
    return 'url_or_contact_noise';
  }
  return undefined;
}

function lineupCandidatesFromStructured(
  structured: MediaVisionOcrResult['structuredLineup'],
  rejected: RejectedMediaCandidate[],
): MediaLineupCandidate[] {
  const candidates: MediaLineupCandidate[] = [];
  for (const entry of structured ?? []) {
    const displayName = entry.displayName.trim();
    const rejectReason = isInvalidMediaLineupValue(displayName);
    if (rejectReason) {
      rejectLineupCandidate(displayName, rejectReason, rejected);
      continue;
    }
    candidates.push({
      displayName,
      rawText: displayName,
      confidence: 0.92,
      evidenceRole: normalizeEvidenceRole(entry.evidenceRole),
    });
  }
  return candidates;
}

function lineupCandidatesFromRawText(
  rawText: string,
  rejected: RejectedMediaCandidate[],
): MediaLineupCandidate[] {
  const extraction = extractLineupFromContentBlocks([rawText]);
  const candidates: MediaLineupCandidate[] = [];
  for (const entry of extraction.entries) {
    const displayName = entry.displayName.trim();
    const rejectReason = isInvalidMediaLineupValue(displayName);
    if (rejectReason) {
      rejectLineupCandidate(displayName, rejectReason, rejected);
      continue;
    }
    if (entry.confidence < MEDIA_LINEUP_CONFIDENCE_GATE) {
      rejectLineupCandidate(displayName, 'lineup_media_ambiguous', rejected);
      continue;
    }
    const evidenceRole: MediaLineupEvidenceRole =
      entry.billingRelation === 'B2B' || /\s&\s/.test(displayName)
        ? 'compound_act'
        : entry.billingRelation === 'HEADLINER'
          ? 'headliner'
          : 'artist';
    candidates.push({
      displayName,
      rawText: entry.rawSourceSpelling || displayName,
      confidence: entry.confidence,
      evidenceRole,
    });
  }
  return candidates;
}

function genreCandidatesFromStructured(
  structuredGenres: string[] | undefined,
  rejected: RejectedMediaCandidate[],
): MediaGenreCandidate[] {
  const candidates: MediaGenreCandidate[] = [];
  for (const rawLabel of structuredGenres ?? []) {
    const trimmed = rawLabel.trim();
    if (!trimmed) {
      continue;
    }
    const normalizedLabel = normalizeCanonicalGenreLabel(trimmed);
    const mapped = normalizedLabel !== trimmed || normalizedLabel.length > 1;
    if (!mapped && !/[a-z]/i.test(trimmed)) {
      rejected.push({ rawText: trimmed, field: 'genre', reason: 'genre_label_unmapped' });
      candidates.push({ rawLabel: trimmed, confidence: 0.6 });
      continue;
    }
    candidates.push({
      rawLabel: trimmed,
      normalizedLabel,
      confidence: 0.85,
    });
  }
  return candidates;
}

function genreCandidatesFromRawText(
  rawText: string,
  rejected: RejectedMediaCandidate[],
): MediaGenreCandidate[] {
  const candidates: MediaGenreCandidate[] = [];
  const lines = rawText.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    const explicit = line.match(EXPLICIT_GENRE_LABEL_PATTERN);
    if (!explicit?.[1]) {
      continue;
    }
    for (const part of explicit[1].split(/[,/|]/)) {
      const rawLabel = part.trim();
      if (!rawLabel) {
        continue;
      }
      const normalizedLabel = normalizeCanonicalGenreLabel(rawLabel);
      candidates.push({
        rawLabel,
        normalizedLabel,
        confidence: 0.8,
      });
    }
  }
  if (candidates.length === 0) {
    rejected.push({ rawText: rawText.slice(0, 120), field: 'genre', reason: 'genres_missing' });
  }
  return candidates;
}

export interface ExtractEventMediaEvidenceInput {
  sourceImageUrl?: string;
  observedAt: string;
  eventTitle?: string;
  venueName?: string;
  imageBytes?: Buffer;
  mimeType?: string;
  ocrOverride?: MediaVisionOcrResult;
}

export async function extractEventMediaEvidence(
  input: ExtractEventMediaEvidenceInput,
): Promise<EventMediaEvidence> {
  const extractionObservedAt = new Date().toISOString();
  const imageUrl = input.sourceImageUrl?.trim();

  if (!imageUrl) {
    return {
      sourceImageUrl: '',
      imageFingerprint: '',
      observedAt: input.observedAt,
      extractionObservedAt,
      extractionProvider: 'none',
      lineupCandidates: [],
      genreCandidates: [],
      rejectedCandidates: [],
      confidence: 0,
      status: 'media_evidence_missing',
    };
  }

  if (!isMediaEvidenceProviderConfigured() && !input.ocrOverride) {
    return {
      sourceImageUrl: imageUrl,
      imageFingerprint: '',
      observedAt: input.observedAt,
      extractionObservedAt,
      extractionProvider: 'none',
      lineupCandidates: [],
      genreCandidates: [],
      rejectedCandidates: [],
      confidence: 0,
      status: 'extraction_failed',
    };
  }

  let imageBytes = input.imageBytes;
  let mimeType = input.mimeType;
  let fingerprint = input.ocrOverride ? 'fixture-ocr-override' : '';
  let fetchedUrl = imageUrl;

  if (!imageBytes && !input.ocrOverride) {
    try {
      const fetched = await fetchOfficialEventImage(imageUrl);
      imageBytes = fetched.bytes;
      mimeType = fetched.mimeType;
      fingerprint = fetched.fingerprint;
      fetchedUrl = fetched.sourceUrl;
    } catch {
      return {
        sourceImageUrl: imageUrl,
        imageFingerprint: '',
        observedAt: input.observedAt,
        extractionObservedAt,
        extractionProvider: 'none',
        lineupCandidates: [],
        genreCandidates: [],
        rejectedCandidates: [{ rawText: imageUrl, field: 'lineup', reason: 'image_fetch_failed' }],
        confidence: 0,
        status: 'media_evidence_missing',
      };
    }
  } else if (imageBytes) {
    fingerprint = fingerprintImageBytes(imageBytes);
  }

  const rejected: RejectedMediaCandidate[] = [];
  let ocrResult = input.ocrOverride;
  let providerId = input.ocrOverride?.providerId ?? 'none';

  if (!ocrResult) {
    const providers = resolveConfiguredMediaOcrProviders();
    for (const provider of providers) {
      const result = (await provider.extract({
        eventId: imageUrl,
        title: input.eventTitle ?? '',
        imageUrl,
        imageBytes,
        mimeType,
      })) as MediaVisionOcrResult;
      providerId = result.providerId;
      if (result.status === 'text_extracted' && result.rawText?.trim()) {
        ocrResult = result;
        break;
      }
    }
  }

  if (!ocrResult?.rawText?.trim()) {
    return {
      sourceImageUrl: fetchedUrl,
      imageFingerprint: fingerprint,
      observedAt: input.observedAt,
      extractionObservedAt,
      extractionProvider: providerId,
      lineupCandidates: [],
      genreCandidates: [],
      rejectedCandidates: rejected,
      confidence: 0,
      status: 'genres_media_unreadable',
    };
  }

  const structuredLineup = lineupCandidatesFromStructured(ocrResult.structuredLineup, rejected);
  const parsedLineup =
    structuredLineup.length > 0
      ? structuredLineup
      : lineupCandidatesFromRawText(ocrResult.rawText, rejected);

  const structuredGenres = genreCandidatesFromStructured(ocrResult.structuredGenres, rejected);
  const parsedGenres =
    structuredGenres.length > 0
      ? structuredGenres
      : genreCandidatesFromRawText(ocrResult.rawText, rejected);

  const acceptedLineup = parsedLineup.filter(
    (candidate) => candidate.confidence >= MEDIA_LINEUP_CONFIDENCE_GATE,
  );
  const acceptedGenres = parsedGenres.filter(
    (candidate) => candidate.confidence >= MEDIA_GENRE_CONFIDENCE_GATE,
  );

  for (const candidate of parsedLineup) {
    if (candidate.confidence < MEDIA_LINEUP_CONFIDENCE_GATE) {
      rejectLineupCandidate(candidate.rawText, 'below_confidence_gate', rejected);
    }
  }

  const confidence =
    acceptedLineup.length > 0
      ? acceptedLineup.reduce((sum, entry) => sum + entry.confidence, 0) / acceptedLineup.length
      : ocrResult.confidence;

  return {
    sourceImageUrl: fetchedUrl,
    imageFingerprint: fingerprint,
    observedAt: input.observedAt,
    extractionObservedAt,
    extractionProvider: providerId,
    rawText: ocrResult.rawText,
    lineupCandidates: acceptedLineup,
    genreCandidates: acceptedGenres,
    rejectedCandidates: rejected,
    confidence,
    status: acceptedLineup.length > 0 || acceptedGenres.length > 0 ? 'extracted' : 'genres_media_unreadable',
  };
}

export const MEDIA_EVIDENCE_PROVIDER_MISSING = 'MEDIA_EVIDENCE_PROVIDER_MISSING';

export function assertMediaEvidenceProviderAvailable(): void {
  if (!isMediaEvidenceProviderConfigured()) {
    throw new Error(MEDIA_EVIDENCE_PROVIDER_MISSING);
  }
}
