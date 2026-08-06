import type { EvidenceReviewState } from './evidence-types';

export type LineupBillingRelation = 'SOLO' | 'B2B' | 'F2F' | 'VS' | 'LIVE' | 'HEADLINER' | 'SPECIAL_GUEST';

export interface LineupEvidenceEntry {
  sortOrder: number;
  displayName: string;
  rawSourceSpelling: string;
  normalizedName: string;
  billingRelation: LineupBillingRelation;
  isB2b: boolean;
  isF2f: boolean;
  isLiveSet: boolean;
  stage?: string;
  floor?: string;
  resolvedArtistId?: string;
  confidence: number;
  reviewState: EvidenceReviewState;
  inclusionReason: string;
  rejectionReason?: string;
}
