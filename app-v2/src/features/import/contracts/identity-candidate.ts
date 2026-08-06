export type IdentityMatchSignal =
  | 'exact_external_id'
  | 'event_specific_url'
  | 'ticket_kings_slug'
  | 'ticket_io_slug'
  | 'title_date_venue'
  | 'organizer_relationship'
  | 'checkout_id'
  | 'official_website_url';

export interface EventIdentityCandidate {
  candidateKey: string;
  externalIds: string[];
  eventUrls: string[];
  title?: string;
  startAt?: string;
  venueName?: string;
  cityName?: string;
  organizerName?: string;
  checkoutId?: string;
  signals: IdentityMatchSignal[];
  confidence: number;
}

export interface IdentityMatchResult {
  matchedCanonicalEventId?: string;
  confidence: number;
  identityEvidence: IdentityMatchSignal[];
  rejectedAlternatives: Array<{ eventId: string; reason: string }>;
  requiresReview: boolean;
  matcherVersion: string;
  decisionReason: string;
}
