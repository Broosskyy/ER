export type MediaLineupEvidenceRole = 'headliner' | 'artist' | 'compound_act';

export interface MediaLineupCandidate {
  displayName: string;
  rawText: string;
  confidence: number;
  evidenceRole: MediaLineupEvidenceRole;
}

export interface MediaGenreCandidate {
  rawLabel: string;
  normalizedLabel?: string;
  confidence: number;
}

export interface RejectedMediaCandidate {
  rawText: string;
  field: 'lineup' | 'genre';
  reason: string;
}

export type MediaEvidenceStatus =
  | 'extracted'
  | 'media_evidence_missing'
  | 'media_identity_unverifiable'
  | 'genres_media_unreadable'
  | 'extraction_failed';

export interface EventMediaEvidence {
  sourceImageUrl: string;
  imageFingerprint: string;
  observedAt: string;
  extractionObservedAt: string;
  extractionProvider: string;
  rawText?: string;
  lineupCandidates: MediaLineupCandidate[];
  genreCandidates: MediaGenreCandidate[];
  rejectedCandidates: RejectedMediaCandidate[];
  confidence: number;
  status: MediaEvidenceStatus;
}

export interface MediaEvidenceErrorCounters {
  mediaAssignedToWrongEvent: number;
  duplicateMediaFetches: number;
  mediaWithoutFingerprint: number;
  lineupEvidenceLost: number;
  lineupDuplicates: number;
  compoundActSplit: number;
  invalidLineupEntries: number;
  mediaArtistHallucinations: number;
  lineupEvidenceConflicts: number;
  explicitGenreEvidenceLost: number;
  genreInferredFromArtist: number;
  genreInferredFromVenueOrOrganizer: number;
  unsupportedGenresPublished: number;
  ticketFieldsChanged: number;
  venueFieldsChanged: number;
  urlRoleErrors: number;
  dbFallbackFieldsUsed: number;
}

export const EMPTY_MEDIA_EVIDENCE_ERROR_COUNTERS: MediaEvidenceErrorCounters = {
  mediaAssignedToWrongEvent: 0,
  duplicateMediaFetches: 0,
  mediaWithoutFingerprint: 0,
  lineupEvidenceLost: 0,
  lineupDuplicates: 0,
  compoundActSplit: 0,
  invalidLineupEntries: 0,
  mediaArtistHallucinations: 0,
  lineupEvidenceConflicts: 0,
  explicitGenreEvidenceLost: 0,
  genreInferredFromArtist: 0,
  genreInferredFromVenueOrOrganizer: 0,
  unsupportedGenresPublished: 0,
  ticketFieldsChanged: 0,
  venueFieldsChanged: 0,
  urlRoleErrors: 0,
  dbFallbackFieldsUsed: 0,
};
