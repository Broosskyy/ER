import type { ElectronicRelevance, EternalRaveMatchClassification, TicketIoMediaRole } from './types';

export type DetailAccessStatus =
  | 'DETAIL_ACCESSIBLE'
  | 'PARTIAL_DETAIL'
  | 'PROVIDER_ACCESS_UNAVAILABLE'
  | 'BLOCKED_BY_SECURITY'
  | 'DETAIL_NOT_FOUND';

export type TicketProductCategory =
  | 'ADMISSION'
  | 'VIP_ADMISSION'
  | 'ADD_ON'
  | 'LOCKER'
  | 'PARKING'
  | 'MERCH'
  | 'REGISTRATION'
  | 'UNKNOWN';

export type TicketAvailabilityState =
  | 'AVAILABLE'
  | 'LOW_AVAILABILITY'
  | 'SOLD_OUT'
  | 'NOT_YET_ON_SALE'
  | 'REGISTRATION_ONLY'
  | 'UNKNOWN';

export type TicketActionState = 'PURCHASE' | 'PRE_REGISTER' | 'WAITLIST' | 'DOOR_ONLY' | 'NONE';

export type QualificationState =
  | 'IMPORT_CANDIDATE'
  | 'EXISTING'
  | 'AMBIGUOUS_REVIEW'
  | 'IRRELEVANT'
  | 'INACCESSIBLE_REVIEW';

export type DescriptionQualification = 'FULL_DESCRIPTION' | 'PARTIAL_DESCRIPTION' | 'NO_DESCRIPTION';
export type LineupQualification = 'FULL_LINEUP' | 'PARTIAL_LINEUP' | 'NO_LINEUP' | 'LINEUP_NOT_APPLICABLE';
export type GenreConfidence = 'explicit' | 'strong_inferred' | 'weak_inferred';

export interface EnrichedTicketProduct {
  label: string;
  category: TicketProductCategory;
  rawPrice?: string;
  amountMinor?: number;
  currency?: string;
  phaseLabel?: string;
  availability: TicketAvailabilityState;
  soldOut: boolean;
  purchasable: boolean;
  grantsAdmission: boolean;
  selectedAsCurrentAdmission: boolean;
}

export interface FieldEvidenceEntry {
  field: string;
  candidateSource: string;
  authorityType: 'ticket_io_detail' | 'ticket_io_list' | 'outbound_official' | 'inferred';
  confidence: number;
  selectedValue?: string;
  conflicts: string[];
}

export interface VerifiedOutboundSource {
  url: string;
  role: string;
  verified: boolean;
  verificationReasons: string[];
}

export interface EnrichedTicketIoEvent {
  identityKey: string;
  ticketIoEventId: string;
  shopId: string;
  shopSlug: string;
  listingUrl: string;
  eventUrl: string;
  canonicalUrl: string;
  title: string;
  subtitle?: string;
  startsAt?: string;
  endsAt?: string;
  lifecycle: 'UPCOMING' | 'ONGOING' | 'ENDED';
  venueName?: string;
  city?: string;
  address?: string;
  organizerName?: string;
  description?: string;
  descriptionQualification: DescriptionQualification;
  lineupHints: string[];
  lineupQualification: LineupQualification;
  genreHints: string[];
  genreCandidates: Array<{ label: string; confidence: GenreConfidence }>;
  outboundLinks: string[];
  verifiedOutbound: VerifiedOutboundSource[];
  imageUrls: string[];
  mediaRoles: TicketIoMediaRole[];
  bestMediaUrl?: string;
  products: EnrichedTicketProduct[];
  currentAdmissionPriceMinor?: number;
  currentAdmissionPhase?: string;
  currentAdmissionLabel?: string;
  ticketAvailability: TicketAvailabilityState;
  ticketAction: TicketActionState;
  detailAccess: DetailAccessStatus;
  fetchMethod: 'fetch' | 'playwright' | 'none';
  fetchStatus?: number;
  evidenceTimestamp: string;
  relevance: ElectronicRelevance;
  relevanceReasons: string[];
  ambiguityReason?: string;
  matchClassification: EternalRaveMatchClassification;
  matchedEventId?: string;
  matchedEventTitle?: string;
  matchReasons: string[];
  qualification: QualificationState;
  importReadinessScore?: number;
  fieldEvidence: FieldEvidenceEntry[];
  contentFingerprint?: string;
}

export interface InventoryDelta {
  previousCandidateCount: number;
  currentCandidateCount: number;
  newSincePrevious: string[];
  disappearedSincePrevious: string[];
  changedSincePrevious: string[];
}

export interface DetailQualificationSummary {
  generatedAt: string;
  referenceDateLocal: string;
  timezone: string;
  baselineHead: string;
  parentMilestone: string;
  inventoryDelta: InventoryDelta;
  shopsDiscovered: number;
  shopsReachable: number;
  shopsActive: number;
  currentUpcomingEvents: number;
  detailAccessible: number;
  partialDetail: number;
  inaccessibleDetail: number;
  ambiguousBefore: number;
  ambiguousAfter: number;
  resolvedToRelevant: number;
  resolvedToIrrelevant: number;
  stillAmbiguous: number;
  inaccessible: number;
  highRelevant: number;
  likelyRelevant: number;
  ambiguous: number;
  irrelevant: number;
  existing: number;
  possibleMatches: number;
  netNew: number;
  importCandidates: number;
  ambiguousReview: number;
  irrelevantQualified: number;
  inaccessibleReview: number;
  eventsWithDescription: number;
  eventsWithFullLineup: number;
  eventsWithGenres: number;
  eventsWithEventSpecificMedia: number;
  eventsWithCurrentAdmissionPrice: number;
  coverageByCity: Record<string, number>;
  coverageByGenre: Record<string, number>;
  newEventWrites: number;
  eventUpdates: number;
  ticketWrites: number;
  mediaWrites: number;
  sourceRegistryActivations: number;
  schedulerChanges: number;
  productionMutations: number;
}

export interface FirstBatchReviewPacket {
  identityKey: string;
  title: string;
  startsAt?: string;
  venueName?: string;
  city?: string;
  organizerName?: string;
  whyRelevant: string[];
  ticketIoListingUrl: string;
  ticketEventUrl: string;
  verifiedOfficialUrl?: string;
  descriptionSummary?: string;
  lineup: string[];
  genres: string[];
  bestMediaUrl?: string;
  products: EnrichedTicketProduct[];
  currentAdmissionPriceMinor?: number;
  currentAdmissionPhase?: string;
  ticketAvailability: TicketAvailabilityState;
  ticketAction: TicketActionState;
  matchClassification: EternalRaveMatchClassification;
  importReadinessScore: number;
  uncertainties: string[];
  visualQaDir?: string;
}
