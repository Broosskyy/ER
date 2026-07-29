export const LIFECYCLE_EVENT_TYPES = [
  'event_created',
  'event_updated',
  'event_moved',
  'time_changed',
  'venue_changed',
  'organizer_changed',
  'festival_edition_changed',
  'ticket_link_changed',
  'lineup_changed',
  'description_changed',
  'image_changed',
  'event_cancelled',
  'event_reactivated',
  'event_archived',
  'event_postponed',
] as const;

export type LifecycleEventType = (typeof LIFECYCLE_EVENT_TYPES)[number];

export const LIFECYCLE_DECISIONS = [
  'apply_immediately',
  'review_required',
  'create_conflict',
  'ignore',
] as const;

export type LifecycleDecision = (typeof LIFECYCLE_DECISIONS)[number];

export const LIFECYCLE_CHANGE_SEVERITIES = ['info', 'warning', 'critical'] as const;
export type LifecycleChangeSeverity = (typeof LIFECYCLE_CHANGE_SEVERITIES)[number];

export const EVENT_SERIES_TYPES = [
  'recurring',
  'annual_festival',
  'club_night',
  'special_edition',
] as const;

export type EventSeriesType = (typeof EVENT_SERIES_TYPES)[number];

export interface EventLifecycleFieldChange {
  fieldPath: string;
  oldValue: unknown;
  newValue: unknown;
  severity: LifecycleChangeSeverity;
  lifecycleEventType: LifecycleEventType;
}

export interface EventLifecycleEvaluation {
  id: string;
  canonicalEventId: string;
  lifecycleEventType: LifecycleEventType;
  decision: LifecycleDecision;
  changes: EventLifecycleFieldChange[];
  confidenceScore: number;
  lifecycleStatusBefore?: string;
  lifecycleStatusAfter?: string;
  reasons: string[];
  sourceId?: string;
  importJobId?: string;
  importRecordId?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EventLifecycleHistoryEntry {
  id: string;
  canonicalEventId: string;
  lifecycleEventType: LifecycleEventType;
  decision: LifecycleDecision;
  sourceId?: string;
  importJobId?: string;
  importRecordId?: string;
  confidenceScore?: number;
  lifecycleStatusBefore?: string;
  lifecycleStatusAfter?: string;
  changeCount: number;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface EventLifecycleChangeRecord {
  id: string;
  historyId: string;
  canonicalEventId: string;
  fieldPath: string;
  oldValue?: unknown;
  newValue?: unknown;
  severity: LifecycleChangeSeverity;
  provenanceSourceId?: string;
  createdAt: string;
}

export interface EventSeriesRecord {
  id: string;
  slug: string;
  displayName: string;
  seriesType: EventSeriesType;
  timezone?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface EventLifecycleHistoryRepository {
  create(entry: EventLifecycleHistoryEntry): Promise<EventLifecycleHistoryEntry>;
  listByCanonicalEventId(canonicalEventId: string, limit?: number): Promise<EventLifecycleHistoryEntry[]>;
  listBySourceId(sourceId: string, limit?: number): Promise<EventLifecycleHistoryEntry[]>;
  listRecent(limit?: number): Promise<EventLifecycleHistoryEntry[]>;
}

export interface EventLifecycleChangeRepository {
  createMany(changes: EventLifecycleChangeRecord[]): Promise<EventLifecycleChangeRecord[]>;
  listByCanonicalEventId(canonicalEventId: string, limit?: number): Promise<EventLifecycleChangeRecord[]>;
  listByHistoryId(historyId: string): Promise<EventLifecycleChangeRecord[]>;
}

export interface EventLifecycleContext {
  sourceId?: string;
  sourceName?: string;
  importJobId?: string;
  importRecordId?: string;
  confidenceScore?: number;
  cancelled?: boolean;
  postponed?: boolean;
  trustScore?: number;
}

export interface EventLifecycleProcessInput {
  before?: import('@/data/types/records').AdminEventRecord | null;
  after: import('@/data/types/records').AdminEventRecord;
  candidate?: import('@/features/aggregation/domain/canonical-import-event').CanonicalImportEvent;
  context?: EventLifecycleContext;
}

export interface EventLifecycleProcessResult {
  event: import('@/data/types/records').AdminEventRecord;
  evaluations: EventLifecycleEvaluation[];
  appliedChanges: EventLifecycleFieldChange[];
  queuedForReview: boolean;
  conflictsCreated: number;
}
