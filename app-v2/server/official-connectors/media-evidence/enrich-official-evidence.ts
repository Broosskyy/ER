import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import {
  readCachedImageBytes,
  readCachedMediaEvidence,
  writeCachedImageBytes,
} from './media-evidence-cache';
import { reconcileOfficialAndMediaEvidence } from './reconcile-evidence';
import { buildImageHostAllowlist, safeFetchImage } from './safe-image-fetch';
import { TesseractMediaEvidenceProvider } from './tesseract-media-evidence-provider';
import type { EventMediaEvidence, MediaEvidenceProvider, MediaPassCounters } from './types';

export interface EnrichOfficialEvidenceOptions {
  counters: ConnectorErrorCounters;
  mediaCounters: MediaPassCounters;
  allowedImageHosts: ReadonlySet<string>;
  sourceObservedAt: string;
  provider?: MediaEvidenceProvider;
}

const urlImageCache = new Map<
  string,
  {
    fingerprint: string;
    mimeType: string;
    bytes: Buffer;
  }
>();
const seenFingerprints = new Set<string>();
const analyzedFingerprints = new Set<string>();

async function loadOfficialImage(
  imageUrl: string,
  options: EnrichOfficialEvidenceOptions,
): Promise<{ fingerprint: string; mimeType: string; bytes: Buffer }> {
  const cached = urlImageCache.get(imageUrl);
  if (cached) {
    return cached;
  }

  const fetched = await safeFetchImage(imageUrl, {
    counters: options.counters,
    allowedHosts: options.allowedImageHosts,
  });

  const diskCached = readCachedImageBytes(fetched.fingerprint, fetched.mimeType);
  const payload = {
    fingerprint: fetched.fingerprint,
    mimeType: fetched.mimeType,
    bytes: diskCached ?? fetched.bytes,
  };

  if (!diskCached) {
    writeCachedImageBytes(payload.fingerprint, payload.mimeType, payload.bytes);
  }

  urlImageCache.set(imageUrl, payload);
  options.mediaCounters.uniqueImageUrlsFetched += 1;
  return payload;
}

export async function enrichOfficialEvidenceWithMedia(
  textEvidence: OfficialEventEvidence,
  options: EnrichOfficialEvidenceOptions,
): Promise<OfficialEventEvidence> {
  const imageUrl = textEvidence.officialImageUrl;
  if (!imageUrl) {
    return textEvidence;
  }

  options.mediaCounters.imageUrlsDiscovered += 1;
  const provider = options.provider ?? new TesseractMediaEvidenceProvider();

  let mediaEvidence: EventMediaEvidence | undefined;
  try {
    const { fingerprint, mimeType, bytes: imageBytes } = await loadOfficialImage(imageUrl, options);

    if (!seenFingerprints.has(fingerprint)) {
      seenFingerprints.add(fingerprint);
      options.mediaCounters.uniqueImageFingerprints += 1;
    } else {
      options.mediaCounters.duplicateImageContents += 1;
    }

    if (!analyzedFingerprints.has(fingerprint)) {
      analyzedFingerprints.add(fingerprint);
      options.mediaCounters.uniqueImagesAnalyzed += 1;
    }

    mediaEvidence = await provider.extractFromImage({
      sourceImageUrl: imageUrl,
      imageFingerprint: fingerprint,
      imageBytes,
      mimeType,
      sourceObservedAt: options.sourceObservedAt,
    });

    if (mediaEvidence.mediaClassification === 'unreadable') {
      options.mediaCounters.mediaOcrUnreadable += 1;
    }
  } catch {
    return {
      ...textEvidence,
      enrichmentGaps: [...textEvidence.enrichmentGaps, 'media_ocr_unreadable'],
    };
  }

  const reconciled = reconcileOfficialAndMediaEvidence(textEvidence, mediaEvidence);
  if (reconciled.conflicts.length > 0) {
    options.mediaCounters.lineupMediaAmbiguous += 1;
  }

  return reconciled.evidence;
}

export function buildBootshausImageHostAllowlist(imageUrls: string[]): Set<string> {
  return buildImageHostAllowlist(imageUrls);
}

export function resetMediaPassStateForTests(): void {
  urlImageCache.clear();
  seenFingerprints.clear();
  analyzedFingerprints.clear();
}
