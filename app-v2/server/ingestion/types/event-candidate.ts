import type { EventReconciliationSummary } from '../reconciliation/types';
import type { EventMatchResult } from '../identity/event-match-types';

export type SubmissionOriginRole = 'user' | 'organizer' | 'artist';

export interface OfficialConnectorOrigin {
  kind: 'official_connector';
  connectorId: string;
  sourceEventKey: string;
  officialUrl: string;
  pageFingerprint: string;
  fetchedAt: string;
  enrichmentGaps: string[];
}

export interface AdminManualOrigin {
  kind: 'admin_manual';
  createdByUserId?: string;
}

export interface SubmissionOrigin {
  kind: 'submission';
  role: SubmissionOriginRole;
  submissionId?: string;
}

export type EventCandidateOrigin = OfficialConnectorOrigin | AdminManualOrigin | SubmissionOrigin;

export interface EventCandidateVenue {
  name: string;
  addressLine?: string;
  postalCode?: string;
  city?: string;
  countryCode?: string;
}

export interface EventCandidateLineupAct {
  billingName: string;
  billingRole: 'artist' | 'headliner' | 'compound_act';
  sortOrder: number;
}

export interface EventCandidateGenre {
  genreKey: string;
  displayName: string;
  sortOrder: number;
}

export interface EventCandidateTicket {
  provider?: string;
  ticketUrl?: string;
  priceFromMinor?: number;
  currency?: string;
  salesStatus?: string;
  sortOrder: number;
}

export interface EventCandidate {
  origin: EventCandidateOrigin;
  title: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  organizerName?: string;
  description?: string;
  imageUrl?: string;
  venue?: EventCandidateVenue;
  lineup: EventCandidateLineupAct[];
  genres: EventCandidateGenre[];
  tickets: EventCandidateTicket[];
}

export interface EventCandidateValidation {
  decision: 'persist_ready' | 'review_required' | 'rejected';
  reasons: string[];
}

export type WriteAction = 'insert' | 'update' | 'replace' | 'reuse' | 'noop';

export interface OfficialSourceIdentity {
  sourceRole: 'official';
  sourceUrl: string;
  sourceEventKey: string;
  contentHash: string;
  fetchedAt: string;
}

export interface ExistingOfficialSourceRecord {
  sourceId: string;
  eventId: string;
  sourceUrl: string;
  contentHash: string | null;
  sourceRole?: string;
  sourceEventKey?: string;
  connectorId?: string;
}

export interface ExistingVenueRecord {
  id: string;
  name: string;
  city: string | null;
  postalCode: string | null;
}

export interface EventWritePlanRowCounts {
  venuesInserted: number;
  venuesReused: number;
  eventsInserted: number;
  eventsUpdated: number;
  lineupInserted: number;
  genresInserted: number;
  ticketsInserted: number;
  sourcesInserted: number;
  sourcesUpdated: number;
}

export interface EventWritePlan {
  sourceIdentity: OfficialSourceIdentity;
  validation: EventCandidateValidation;
  eventAction: WriteAction;
  venueAction: WriteAction;
  lineupAction: WriteAction;
  genresAction: WriteAction;
  ticketsAction: WriteAction;
  sourceAction: WriteAction;
  candidate: EventCandidate;
  sourcePayload: Record<string, unknown>;
  existingSource?: ExistingOfficialSourceRecord;
  existingVenueId?: string;
  reasons: string[];
  expectedRowCounts: EventWritePlanRowCounts;
  reconciliation?: EventReconciliationSummary;
  incomingCandidate?: EventCandidate;
  identity?: EventMatchResult;
  resolvedEventId?: string;
}

export interface IdempotencyCheckResult {
  sourceUrl: string;
  planEventAction: WriteAction;
  planSourceAction: WriteAction;
  isIdempotent: boolean;
}
