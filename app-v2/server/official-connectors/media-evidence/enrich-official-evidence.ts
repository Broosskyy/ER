import type { ConnectorErrorCounters, OfficialEventEvidence } from '../types';
import type { VerifiedTicketCompleteResult } from '../ticket-evidence/ticket-audit-metrics';
import {
  buildMediaEvidenceContextFromEvidence,
  type MediaEvidenceContext,
} from '../shared/media-evidence-context';
import {
  findCachedMediaEvidenceByImageUrl,
  readCachedImageBytes,
  readCachedMediaEvidence,
  writeCachedImageBytes,
} from './media-evidence-cache';
import { reconcileOfficialAndMediaEvidence } from './reconcile-evidence';
import { buildImageHostAllowlist, safeFetchImage } from './safe-image-fetch';
import {
  reparseCachedMediaEvidence,
  TesseractMediaEvidenceProvider,
} from './tesseract-media-evidence-provider';
import type { EventMediaEvidence, MediaEvidenceProvider, MediaPassCounters } from './types';

export interface EnrichOfficialEvidenceOptions {
  counters: ConnectorErrorCounters;
  mediaCounters: MediaPassCounters;
  allowedImageHosts: ReadonlySet<string>;
  sourceObservedAt: string;
  provider?: MediaEvidenceProvider;
  mediaContext?: MediaEvidenceContext;
  cachedOnly?: boolean;
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

function resolveMediaContext(
  textEvidence: OfficialEventEvidence,
  options: EnrichOfficialEvidenceOptions,
): MediaEvidenceContext {
  return (
    options.mediaContext ??
    buildMediaEvidenceContextFromEvidence({
      venueName: textEvidence.venue?.name,
      organizerLabel: textEvidence.organizerLabel,
      city: textEvidence.venue?.city,
      officialUrl: textEvidence.officialUrl,
      officialImageUrl: textEvidence.officialImageUrl,
    })
  );
}

function loadCachedMediaEvidenceForEvent(
  textEvidence: OfficialEventEvidence,
  mediaContext: MediaEvidenceContext,
): EventMediaEvidence | undefined {
  const imageUrl = textEvidence.officialImageUrl;
  if (!imageUrl) {
    return undefined;
  }

  const corroborationLineup = textEvidence.lineupCandidates.map((act) => act.displayName);

  const cached =
    findCachedMediaEvidenceByImageUrl(imageUrl) ??
    (() => {
      const imageCache = urlImageCache.get(imageUrl);
      return imageCache ? readCachedMediaEvidence(imageCache.fingerprint) : undefined;
    })();

  if (!cached?.ocrLines?.length) {
    return cached;
  }

  return reparseCachedMediaEvidence(cached, mediaContext, corroborationLineup);
}

export function enrichOfficialEvidenceFromCachedMedia(
  textEvidence: OfficialEventEvidence,
  options: {
    mediaCounters?: MediaPassCounters;
    mediaContext?: MediaEvidenceContext;
  } = {},
): OfficialEventEvidence {
  const imageUrl = textEvidence.officialImageUrl;
  if (!imageUrl) {
    return textEvidence;
  }

  const mediaCounters = options.mediaCounters;
  if (mediaCounters) {
    mediaCounters.imageUrlsDiscovered += 1;
  }

  const mediaContext = resolveMediaContext(textEvidence, options as EnrichOfficialEvidenceOptions);
  const mediaEvidence = loadCachedMediaEvidenceForEvent(textEvidence, mediaContext);

  if (!mediaEvidence) {
    return {
      ...textEvidence,
      enrichmentGaps: textEvidence.enrichmentGaps.includes('media_ocr_unreadable')
        ? textEvidence.enrichmentGaps
        : [...textEvidence.enrichmentGaps, 'media_ocr_unreadable'],
    };
  }

  if (mediaCounters) {
    if (!seenFingerprints.has(mediaEvidence.imageFingerprint)) {
      seenFingerprints.add(mediaEvidence.imageFingerprint);
      mediaCounters.uniqueImageFingerprints += 1;
    } else {
      mediaCounters.duplicateImageContents += 1;
    }

    if (!analyzedFingerprints.has(mediaEvidence.imageFingerprint)) {
      analyzedFingerprints.add(mediaEvidence.imageFingerprint);
      mediaCounters.uniqueImagesAnalyzed += 1;
    }

    if (mediaEvidence.mediaClassification === 'unreadable') {
      mediaCounters.mediaOcrUnreadable += 1;
    }
  }

  const reconciled = reconcileOfficialAndMediaEvidence(textEvidence, mediaEvidence, {
    mediaContext,
  });
  if (reconciled.conflicts.length > 0 && mediaCounters) {
    mediaCounters.lineupMediaAmbiguous += 1;
  }

  return reconciled.evidence;
}

export async function enrichOfficialEvidenceWithMedia(
  textEvidence: OfficialEventEvidence,
  options: EnrichOfficialEvidenceOptions,
): Promise<OfficialEventEvidence> {
  const imageUrl = textEvidence.officialImageUrl;
  if (!imageUrl) {
    return textEvidence;
  }

  if (options.cachedOnly) {
    return enrichOfficialEvidenceFromCachedMedia(textEvidence, options);
  }

  options.mediaCounters.imageUrlsDiscovered += 1;
  const provider = options.provider ?? new TesseractMediaEvidenceProvider();
  const mediaContext = resolveMediaContext(textEvidence, options);

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
      mediaContext,
      corroborationLineup: textEvidence.lineupCandidates.map((act) => act.displayName),
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

  const reconciled = reconcileOfficialAndMediaEvidence(textEvidence, mediaEvidence, {
    mediaContext,
  });
  if (reconciled.conflicts.length > 0) {
    options.mediaCounters.lineupMediaAmbiguous += 1;
  }

  return reconciled.evidence;
}

export async function enrichVerifiedTicketProviderMediaImage(
  evidence: OfficialEventEvidence,
  ticketResult: VerifiedTicketCompleteResult,
  options: EnrichOfficialEvidenceOptions,
): Promise<void> {
  const imageUrl = ticketResult.providerEvidence?.event.imageUrl;
  if (!imageUrl || imageUrl === evidence.officialImageUrl) {
    return;
  }

  const provider = options.provider ?? new TesseractMediaEvidenceProvider();
  const mediaContext = buildMediaEvidenceContextFromEvidence({
    venueName: evidence.venue?.name,
    organizerLabel: evidence.organizerLabel,
    city: evidence.venue?.city,
    officialUrl: evidence.officialUrl,
    officialImageUrl: imageUrl,
  });

  try {
    const { fingerprint, mimeType, bytes: imageBytes } = await loadOfficialImage(imageUrl, options);
    if (!seenFingerprints.has(fingerprint)) {
      seenFingerprints.add(fingerprint);
      options.mediaCounters.uniqueImageFingerprints += 1;
    }
    if (!analyzedFingerprints.has(fingerprint)) {
      analyzedFingerprints.add(fingerprint);
      options.mediaCounters.uniqueImagesAnalyzed += 1;
    }

    await provider.extractFromImage({
      sourceImageUrl: imageUrl,
      imageFingerprint: fingerprint,
      imageBytes,
      mimeType,
      sourceObservedAt: ticketResult.providerEvidence?.sourceObservedAt ?? options.sourceObservedAt,
      mediaContext,
    });
  } catch {
    // Ticket image OCR is best-effort; verified ticket identity still gates selection.
  }
}

export function resetMediaPassStateForTests(): void {
  urlImageCache.clear();
  seenFingerprints.clear();
  analyzedFingerprints.clear();
}
