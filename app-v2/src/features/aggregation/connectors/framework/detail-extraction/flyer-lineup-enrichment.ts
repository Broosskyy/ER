/**
 * Phase 4.6.4 — Controlled flyer/poster lineup enrichment (fallback stage 5).
 * Does not call unapproved external OCR providers; records evidence for Admin review.
 */

import { createHash } from 'node:crypto';

import {
  parseFlyerLineupCandidates,
  selectPublishableFlyerCandidates,
  selectReviewRequiredFlyerCandidates,
  type FlyerLineupCandidate,
} from '@/features/aggregation/domain/flyer-lineup-parser';

export const FLYER_EXTRACTION_ENGINE = 'phase464-flyer-lineup-v1';

export type FlyerExtractionStatus = 'pending' | 'processed' | 'skipped_unchanged' | 'no_text';

export interface FlyerLineupExtractionRecord {
  imageUrl: string;
  contentHash: string;
  engine: string;
  engineVersion: string;
  status: FlyerExtractionStatus;
  extractedAt: string;
  rawText?: string;
  candidates: FlyerLineupCandidate[];
  autoPublishCandidates: FlyerLineupCandidate[];
  reviewCandidates: FlyerLineupCandidate[];
  rejectedCandidates: FlyerLineupCandidate[];
}

export interface FlyerLineupEnrichmentInput {
  imageUrl: string;
  rawText?: string;
  previousHash?: string;
  eventTitle?: string;
  venueName?: string;
  cityName?: string;
  knownCanonicalNames?: string[];
  corroboratingTextNames?: string[];
}

export function hashFlyerImageContent(input: { imageUrl: string; rawText?: string }): string {
  return createHash('sha256')
    .update(`${input.imageUrl}|${input.rawText ?? ''}`)
    .digest('hex')
    .slice(0, 16);
}

export function enrichFlyerLineup(input: FlyerLineupEnrichmentInput): FlyerLineupExtractionRecord {
  const contentHash = hashFlyerImageContent({ imageUrl: input.imageUrl, rawText: input.rawText });
  const extractedAt = new Date().toISOString();

  if (input.previousHash && input.previousHash === contentHash) {
    return {
      imageUrl: input.imageUrl,
      contentHash,
      engine: FLYER_EXTRACTION_ENGINE,
      engineVersion: '1.0.0',
      status: 'skipped_unchanged',
      extractedAt,
      candidates: [],
      autoPublishCandidates: [],
      reviewCandidates: [],
      rejectedCandidates: [],
    };
  }

  if (!input.rawText?.trim()) {
    return {
      imageUrl: input.imageUrl,
      contentHash,
      engine: FLYER_EXTRACTION_ENGINE,
      engineVersion: '1.0.0',
      status: 'pending',
      extractedAt,
      candidates: [],
      autoPublishCandidates: [],
      reviewCandidates: [],
      rejectedCandidates: [],
    };
  }

  const candidates = parseFlyerLineupCandidates({
    rawText: input.rawText,
    eventTitle: input.eventTitle,
    venueName: input.venueName,
    cityName: input.cityName,
    knownCanonicalNames: input.knownCanonicalNames,
    corroboratingTextNames: input.corroboratingTextNames,
  });

  const autoPublishCandidates = selectPublishableFlyerCandidates(candidates);
  const reviewCandidates = selectReviewRequiredFlyerCandidates(candidates);
  const rejectedCandidates = candidates.filter((c) => c.rejected || c.confidence < 0.55);

  return {
    imageUrl: input.imageUrl,
    contentHash,
    engine: FLYER_EXTRACTION_ENGINE,
    engineVersion: '1.0.0',
    status: 'processed',
    extractedAt,
    rawText: input.rawText,
    candidates,
    autoPublishCandidates,
    reviewCandidates,
    rejectedCandidates,
  };
}

export function pickHighestResolutionOfficialImage(urls: Array<string | undefined>): string | undefined {
  const scored = urls
    .filter((url): url is string => Boolean(url?.trim()))
    .map((url) => {
      let score = 0;
      if (/flyer|poster|lineup/i.test(url)) score += 20;
      if (/\d{3,4}x\d{3,4}/.test(url)) score += 10;
      if (/large|original|hero|full/i.test(url)) score += 8;
      if (/thumb|small|icon/i.test(url)) score -= 10;
      return { url, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url;
}
