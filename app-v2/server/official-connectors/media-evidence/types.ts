import type { MediaEvidenceContext } from '../shared/media-evidence-context';

export type MediaClassification =
  | 'event_flyer'
  | 'event_artwork_without_billing'
  | 'generic_event_artwork'
  | 'unreadable'
  | 'identity_unverifiable';

export interface MediaBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface MediaOcrWord {
  text: string;
  confidence: number;
  bbox: MediaBoundingBox;
}

export interface MediaOcrLine {
  text: string;
  confidence: number;
  bbox: MediaBoundingBox;
  words: MediaOcrWord[];
}

export interface MediaOcrBlock {
  text: string;
  confidence: number;
  bbox: MediaBoundingBox;
  lines: MediaOcrLine[];
}

export interface MediaLineupCandidate {
  displayName: string;
  rawText: string;
  confidence: number;
  evidenceRole: 'headliner' | 'artist' | 'compound_act';
  billingGroup?: string;
  billingOrder?: number;
  sourceRegion?: string;
}

export interface MediaGenreCandidate {
  rawLabel: string;
  normalizedLabel?: string;
  confidence: number;
  sourceRegion?: string;
}

export interface RejectedMediaCandidate {
  rawText: string;
  reason: string;
  confidence?: number;
  sourceRegion?: string;
}

export type EventMediaRole = 'event_flyer' | 'event_artwork' | 'unknown';

export interface EventMediaReference {
  sourceImageUrl: string;
  imageFingerprint?: string;
  sourceObservedAt: string;
  mediaRole: EventMediaRole;
}

export interface EventMediaEvidence {
  sourceImageUrl: string;
  imageFingerprint: string;
  sourceObservedAt: string;
  extractedAt: string;
  extractionProvider: string;
  extractionModel?: string;
  mediaClassification: MediaClassification;
  rawText?: string;
  ocrBlocks: MediaOcrBlock[];
  ocrLines: MediaOcrLine[];
  lineupCandidates: MediaLineupCandidate[];
  genreCandidates: MediaGenreCandidate[];
  rejectedCandidates: RejectedMediaCandidate[];
  confidence: number;
}

export interface MediaEvidenceExtractInput {
  sourceImageUrl: string;
  imageFingerprint: string;
  imageBytes: Buffer;
  mimeType: string;
  sourceObservedAt: string;
  mediaContext?: MediaEvidenceContext;
  corroborationLineup?: string[];
}

export interface MediaEvidenceProvider {
  readonly providerId: string;
  extractFromImage(input: MediaEvidenceExtractInput): Promise<EventMediaEvidence>;
}

export interface MediaPassCounters {
  imageUrlsDiscovered: number;
  uniqueImageUrlsFetched: number;
  uniqueImageFingerprints: number;
  duplicateImageContents: number;
  uniqueImagesAnalyzed: number;
  mediaOcrUnreadable: number;
  lineupMediaAmbiguous: number;
}

export function createEmptyMediaPassCounters(): MediaPassCounters {
  return {
    imageUrlsDiscovered: 0,
    uniqueImageUrlsFetched: 0,
    uniqueImageFingerprints: 0,
    duplicateImageContents: 0,
    uniqueImagesAnalyzed: 0,
    mediaOcrUnreadable: 0,
    lineupMediaAmbiguous: 0,
  };
}
