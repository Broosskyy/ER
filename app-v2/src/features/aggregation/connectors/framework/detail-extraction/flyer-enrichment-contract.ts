/**
 * Phase 4.6.5 — Reusable flyer enrichment stage contract (inventory + future OCR).
 * Low-confidence candidates must never auto-publish.
 */

import type { FlyerLineupCandidate } from '@/features/aggregation/domain/flyer-lineup-parser';

export const FLYER_ENRICHMENT_STAGE = 'flyer_enrichment_v1' as const;

export type FlyerEnrichmentPhase =
  | 'inventory_only'
  | 'ocr_pending'
  | 'candidates_extracted'
  | 'review_required'
  | 'published';

export interface FlyerArtworkInventoryEntry {
  eventId: string;
  title: string;
  imageUrl: string;
  imageSource: string;
  resolutionHint?: string;
  textualEvidenceAvailable: string[];
  likelyMissingFields: string[];
  extractionFeasibility: 'high' | 'medium' | 'low' | 'blocked';
  inventoryReason: string;
}

export interface FlyerEnrichmentProvenance {
  stage: typeof FLYER_ENRICHMENT_STAGE;
  imageUrl: string;
  contentHash: string;
  engine: string;
  engineVersion: string;
  rawOcrText?: string;
  candidates: FlyerLineupCandidate[];
  confidence: number;
  autoPublishAllowed: false;
  reviewedAt?: string;
  reviewedBy?: string;
}

export interface FlyerEnrichmentPipelineOutput {
  provenance: FlyerEnrichmentProvenance;
  phase: FlyerEnrichmentPhase;
  /** Never written to canonical without explicit review. */
  canonicalCandidates: FlyerLineupCandidate[];
}

export function buildFlyerInventoryEntry(input: {
  eventId: string;
  title: string;
  imageUrl: string;
  imageSource: string;
  missingFields: string[];
  textualSources: string[];
}): FlyerArtworkInventoryEntry {
  const hasLineupText = input.textualSources.some((s) => /lineup|artist|structured/i.test(s));
  const hasDescription = input.textualSources.some((s) => /description|website/i.test(s));
  const likelyMissing = input.missingFields.filter(Boolean);

  let feasibility: FlyerArtworkInventoryEntry['extractionFeasibility'] = 'medium';
  if (!input.imageUrl?.trim()) {
    feasibility = 'blocked';
  } else if (likelyMissing.includes('lineup') && !hasLineupText && /flyer|poster|holder/i.test(input.imageUrl)) {
    feasibility = 'high';
  } else if (likelyMissing.length === 0) {
    feasibility = 'low';
  }

  const resolutionHint = (() => {
    const match = input.imageUrl.match(/(\d{3,4})x(\d{3,4})/i);
    if (match) {
      return `${match[1]}x${match[2]}`;
    }
    if (/1080|holder|large|hero/i.test(input.imageUrl)) {
      return 'high_resolution_candidate';
    }
    return undefined;
  })();

  return {
    eventId: input.eventId,
    title: input.title,
    imageUrl: input.imageUrl,
    imageSource: input.imageSource,
    resolutionHint,
    textualEvidenceAvailable: input.textualSources,
    likelyMissingFields: likelyMissing,
    extractionFeasibility: feasibility,
    inventoryReason:
      feasibility === 'blocked'
        ? 'no_official_artwork_url'
        : feasibility === 'high'
          ? 'textual_sources_exhausted_lineup_likely_on_artwork'
          : 'awaiting_textual_fallback_completion',
  };
}
