import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { EventMediaEvidence, MediaEvidenceErrorCounters } from '@/features/import/domain/media-evidence-types';
import { EMPTY_MEDIA_EVIDENCE_ERROR_COUNTERS } from '@/features/import/domain/media-evidence-types';
import { extractEventMediaEvidence } from '@/features/import/domain/media-evidence-extractor';
import { fetchOfficialEventImage } from '@/features/import/domain/media-image-fetch';

export function resolveOfficialEventImageUrl(raw: RawImportedEvent): string | undefined {
  const direct = raw.imageUrl?.trim();
  if (direct?.startsWith('https://')) {
    return direct;
  }
  const metadata = raw.sourceMetadata as { imageUrls?: string[] } | undefined;
  const fromList = metadata?.imageUrls?.find((url) => url?.trim().startsWith('https://'));
  return fromList?.trim();
}

export interface MediaEvidenceBatchResult {
  byOfficialUrl: Map<string, EventMediaEvidence>;
  byImageFingerprint: Map<string, EventMediaEvidence>;
  uniqueImageCount: number;
  errorCounters: MediaEvidenceErrorCounters;
}

export async function buildMediaEvidenceBatchForOfficialEvents(input: {
  officialRawEvents: RawImportedEvent[];
  observedAt: string;
}): Promise<MediaEvidenceBatchResult> {
  const byOfficialUrl = new Map<string, EventMediaEvidence>();
  const byImageFingerprint = new Map<string, EventMediaEvidence>();
  const fetchedUrls = new Set<string>();
  const errorCounters = { ...EMPTY_MEDIA_EVIDENCE_ERROR_COUNTERS };

  for (const raw of input.officialRawEvents) {
    const officialUrl = raw.eventUrl ?? raw.sourceUrl ?? raw.externalId;
    const imageUrl = resolveOfficialEventImageUrl(raw);
    if (!officialUrl?.trim()) {
      continue;
    }
    if (!imageUrl) {
      byOfficialUrl.set(officialUrl, {
        sourceImageUrl: '',
        imageFingerprint: '',
        observedAt: input.observedAt,
        extractionObservedAt: new Date().toISOString(),
        extractionProvider: 'none',
        lineupCandidates: [],
        genreCandidates: [],
        rejectedCandidates: [{ rawText: officialUrl, field: 'lineup', reason: 'media_evidence_missing' }],
        confidence: 0,
        status: 'media_evidence_missing',
      });
      continue;
    }

    if (fetchedUrls.has(imageUrl)) {
      errorCounters.duplicateMediaFetches += 1;
      const existing = [...byImageFingerprint.values()].find((entry) => entry.sourceImageUrl === imageUrl);
      if (existing) {
        byOfficialUrl.set(officialUrl, existing);
      }
      continue;
    }
    fetchedUrls.add(imageUrl);

    let cached: EventMediaEvidence | undefined;
    const prior = [...byImageFingerprint.values()].find((entry) => entry.sourceImageUrl === imageUrl);
    if (prior) {
      cached = prior;
    } else {
      let imageBytes: Buffer | undefined;
      let mimeType: string | undefined;
      let fingerprint = '';
      try {
        const fetched = await fetchOfficialEventImage(imageUrl);
        imageBytes = fetched.bytes;
        mimeType = fetched.mimeType;
        fingerprint = fetched.fingerprint;
        const priorFingerprint = byImageFingerprint.get(fingerprint);
        if (priorFingerprint) {
          cached = priorFingerprint;
        }
      } catch {
        cached = {
          sourceImageUrl: imageUrl,
          imageFingerprint: '',
          observedAt: input.observedAt,
          extractionObservedAt: new Date().toISOString(),
          extractionProvider: 'none',
          lineupCandidates: [],
          genreCandidates: [],
          rejectedCandidates: [{ rawText: imageUrl, field: 'lineup', reason: 'image_fetch_failed' }],
          confidence: 0,
          status: 'media_evidence_missing',
        };
      }

      if (!cached && imageBytes) {
        cached = await extractEventMediaEvidence({
          sourceImageUrl: imageUrl,
          observedAt: input.observedAt,
          eventTitle: raw.title,
          imageBytes,
          mimeType,
        });
        if (cached.imageFingerprint || fingerprint) {
          byImageFingerprint.set(cached.imageFingerprint || fingerprint, cached);
        }
      }
    }

    if (!cached) {
      cached = {
        sourceImageUrl: imageUrl,
        imageFingerprint: '',
        observedAt: input.observedAt,
        extractionObservedAt: new Date().toISOString(),
        extractionProvider: 'none',
        lineupCandidates: [],
        genreCandidates: [],
        rejectedCandidates: [{ rawText: imageUrl, field: 'lineup', reason: 'extraction_failed' }],
        confidence: 0,
        status: 'extraction_failed',
      };
    }

    if (!cached.imageFingerprint) {
      errorCounters.mediaWithoutFingerprint += 1;
    }
    byOfficialUrl.set(officialUrl, cached);
  }

  return {
    byOfficialUrl,
    byImageFingerprint,
    uniqueImageCount: byImageFingerprint.size,
    errorCounters,
  };
}

export function mergeMediaEvidenceErrorCounters(
  base: MediaEvidenceErrorCounters,
  row: MediaEvidenceErrorCounters,
): MediaEvidenceErrorCounters {
  const merged = { ...base };
  for (const key of Object.keys(merged) as Array<keyof MediaEvidenceErrorCounters>) {
    merged[key] += row[key];
  }
  return merged;
}
