export type EventMatchDecision =
  | 'exact_match'
  | 'strong_match'
  | 'possible_match'
  | 'no_match'
  | 'review_required';

export type EventMatchSignalName =
  | 'title'
  | 'datetime'
  | 'venue'
  | 'city'
  | 'organizer'
  | 'lineup'
  | 'source_binding'
  | 'external_id';

export type EventMatchSignalOutcome = 'match' | 'partial' | 'mismatch' | 'missing' | 'blocked';

export interface EventMatchSignal {
  signal: EventMatchSignalName;
  outcome: EventMatchSignalOutcome;
  reason: string;
}

export interface EventSourceBindingRecord {
  sourceId: string;
  eventId: string;
  sourceRole: string;
  sourceUrl: string;
  sourceEventKey?: string;
  connectorId?: string;
  contentHash?: string | null;
}

export interface EventMatchCatalogEntry {
  eventId: string;
  title: string;
  startsAt: string;
  endsAt?: string | null;
  timezone: string;
  venueName?: string;
  venueCity?: string;
  venuePostalCode?: string;
  organizerName?: string;
  lineupBillingNames: string[];
  sourceBindings: EventSourceBindingRecord[];
}

export interface EventMatchCandidateInput {
  title: string;
  startsAt: string;
  endsAt?: string;
  timezone: string;
  venueName?: string;
  venueCity?: string;
  venuePostalCode?: string;
  organizerName?: string;
  lineupBillingNames: string[];
  sourceUrl?: string;
  sourceEventKey?: string;
  connectorId?: string;
}

export interface EventMatchResult {
  decision: EventMatchDecision;
  candidateEventId?: string;
  signals: EventMatchSignal[];
  reasons: string[];
  autoBindAllowed: boolean;
}
