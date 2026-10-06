import type { EventMediaEvidence } from './types';

export type EventMediaIdentityResult = 'exact_match' | 'strong_match' | 'review_required' | 'reject';

export type EventMediaType =
  | 'lineup_flyer'
  | 'event_flyer'
  | 'event_hero'
  | 'announcement_flyer'
  | 'ticket_marketing'
  | 'multi_event_poster'
  | 'organizer_branding'
  | 'venue_branding'
  | 'generic_shop_image'
  | 'decorative_image'
  | 'unknown';

export type EventMediaSourceType =
  | 'primary_official'
  | 'secondary_official'
  | 'verified_ticket_provider'
  | 'verified_supplemental'
  | 'media_ocr';

export interface EventMediaContentSignals {
  hasEventTitle: boolean;
  hasDate: boolean;
  hasVenue: boolean;
  hasLineup: boolean;
  lineupActCount: number;
  lineupOverlapWithVerified: number;
  hasEventBranding: boolean;
  eventSpecificityScore: number;
  ocrConfidence?: number;
}

export interface EventMediaCandidate {
  candidateId: string;
  sourceId: string;
  sourceType: EventMediaSourceType;
  sourceUrl: string;
  imageUrl: string;
  mediaType: EventMediaType;
  identityConfidence: EventMediaIdentityResult;
  width?: number;
  height?: number;
  aspectRatio?: number;
  contentSignals: EventMediaContentSignals;
  provenance: {
    connectorId?: string;
    providerKey?: string;
    discoveredAt: string;
    observedAt: string;
  };
  discoveredAt: string;
  score: number;
  selectionReason?: string;
  rejectedReason?: string;
  mediaEvidence?: EventMediaEvidence;
}

export interface EventMediaSelectionResult {
  selected?: EventMediaCandidate;
  candidates: EventMediaCandidate[];
  rejectedCandidates: Array<{ candidateId: string; imageUrl: string; reason: string }>;
  retainedExisting: boolean;
  selectionReason: string;
}

export function isAutoSelectableIdentity(identity: EventMediaIdentityResult): boolean {
  return identity === 'exact_match' || identity === 'strong_match';
}
