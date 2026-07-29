export const MATCH_CONFIDENCE_TIERS = ['certain', 'probable', 'uncertain'] as const;
export type MatchConfidenceTier = (typeof MATCH_CONFIDENCE_TIERS)[number];

export const MATCH_DECISIONS = ['auto_link', 'review_required', 'keep_separate'] as const;
export type MatchDecision = (typeof MATCH_DECISIONS)[number];

export const MERGE_CANDIDATE_STATUSES = ['pending', 'approved', 'rejected', 'deferred'] as const;
export type MergeCandidateStatus = (typeof MERGE_CANDIDATE_STATUSES)[number];

export const MATCH_SIGNAL_TYPES = [
  'source_reference',
  'fingerprint',
  'title_similarity',
  'start_date',
  'end_date',
  'venue',
  'coordinates',
  'organizer',
  'ticket_url',
  'event_url',
  'external_id',
  'artist_overlap',
  'blocking_key',
] as const;

export type MatchSignalType = (typeof MATCH_SIGNAL_TYPES)[number];

export interface MatchSignal {
  type: MatchSignalType;
  weight: number;
  score: number;
  message: string;
}

export interface FieldDifference {
  field: string;
  incomingValue: unknown;
  canonicalValue: unknown;
  severity: 'info' | 'warning' | 'critical';
}

export interface MultiSourceMatchCandidate {
  canonicalEventId: string;
  confidenceScore: number;
  signals: MatchSignal[];
  blockingKeys: string[];
  involvedSourceIds: string[];
}

export interface MultiSourceMatchEvaluation {
  id: string;
  importRecordId?: string;
  importJobId?: string;
  sourceId: string;
  externalEventId: string;
  canonicalEventId?: string;
  confidenceScore: number;
  confidenceTier: MatchConfidenceTier;
  decision: MatchDecision;
  reasons: string[];
  signals: MatchSignal[];
  fieldDifferences: FieldDifference[];
  involvedSourceIds: string[];
  fingerprintSnapshot: Record<string, string>;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EventMergeCandidate {
  id: string;
  evaluationId: string;
  canonicalEventId: string;
  sourceId: string;
  externalEventId: string;
  confidenceScore: number;
  status: MergeCandidateStatus;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventBlockingKeyEntry {
  id: string;
  canonicalEventId: string;
  blockingKey: string;
  createdAt: string;
}

export interface EventBlockingKeyRepository {
  indexKeys(canonicalEventId: string, blockingKeys: string[]): Promise<EventBlockingKeyEntry[]>;
  findCanonicalEventIdsByKeys(blockingKeys: string[]): Promise<string[]>;
  listByCanonicalEventId(canonicalEventId: string): Promise<EventBlockingKeyEntry[]>;
}

export interface EventMatchEvaluationRepository {
  create(evaluation: MultiSourceMatchEvaluation): Promise<MultiSourceMatchEvaluation>;
  findByImportRecordId(importRecordId: string): Promise<MultiSourceMatchEvaluation | null>;
  listByCanonicalEventId(canonicalEventId: string, limit?: number): Promise<MultiSourceMatchEvaluation[]>;
  listBySourceId(sourceId: string, limit?: number): Promise<MultiSourceMatchEvaluation[]>;
  listRecent(limit?: number): Promise<MultiSourceMatchEvaluation[]>;
}

export interface EventMergeCandidateRepository {
  upsert(candidate: EventMergeCandidate): Promise<EventMergeCandidate>;
  listByCanonicalEventId(canonicalEventId: string, limit?: number): Promise<EventMergeCandidate[]>;
  listPending(limit?: number): Promise<EventMergeCandidate[]>;
}

export interface MultiSourceMatchContext {
  matchedVenueId?: string;
  matchedArtistIds?: string[];
  importDuplicateScore?: number;
  importDuplicateEventId?: string;
}
