export type VerifiedTicketStatus =
  | 'available'
  | 'sold_out'
  | 'sale_not_started'
  | 'sales_ended'
  | 'cancelled'
  | 'registration_only'
  | 'free'
  | 'unavailable_unknown';

export type NormalizedTicketStatus =
  | 'available'
  | 'sale_not_started'
  | 'sold_out'
  | 'sales_ended'
  | 'cancelled';

export type TicketEventClassification =
  | 'verified_ticket_available'
  | 'verified_ticket_sold_out'
  | 'verified_sale_not_started'
  | 'verified_sales_ended'
  | 'verified_ticket_free'
  | 'verified_registration_only'
  | 'ticket_not_offered'
  | 'ticket_evidence_missing'
  | 'ticket_identity_unverifiable'
  | 'ticket_identity_conflict'
  | 'ticket_identity_verified'
  | 'ticket_provider_blocked'
  | 'ticket_provider_unsupported'
  | 'ticket_status_ambiguous';

export type TicketLinkRelation =
  | 'official_ticket'
  | 'ticket_provider'
  | 'presale'
  | 'box_office'
  | 'unknown';

export type TicketPriceEvidenceState =
  | 'verified_current'
  | 'verified_historical'
  | 'not_yet_published'
  | 'no_longer_public'
  | 'provider_access_unavailable';

export type TicketPriceEvidenceOrigin =
  | 'provider_detail'
  | 'provider_structured_data'
  | 'verified_live_capture';

export interface TicketPriceEvidence {
  state: TicketPriceEvidenceState;
  amountMinor?: number;
  currency?: string;
  rawPriceText?: string;
  sourceUrl: string;
  sourceObservedAt: string;
  contentFingerprint: string;
  evidenceOrigin: TicketPriceEvidenceOrigin | 'event_lifecycle';
  reason?: string;
}

export type TicketAvailabilityStatus =
  | 'available'
  | 'sale_not_started'
  | 'sold_out'
  | 'sales_ended'
  | 'cancelled'
  | 'availability_unverified';

export type TicketStatusEvidenceOrigin =
  | 'provider'
  | 'event_lifecycle'
  | 'unavailable'
  | 'official_source_dom';

export type TicketSourceState =
  | 'current_ticket_detail'
  | 'historical_ticket_detail'
  | 'presale_registration'
  | 'waitlist'
  | 'ticket_link_not_yet_published'
  | 'provider_access_unavailable';

export type TicketSourceStateEvidenceOrigin =
  | 'official_source_dom'
  | 'official_source_runtime'
  | 'provider_detail'
  | 'verified_live_capture';

export interface TicketSourceStateEvidence {
  state: TicketSourceState;
  sourceEventUrl: string;
  observedAt: string;
  contentFingerprint: string;
  ctaObserved: boolean;
  ctaText?: string;
  ctaVisible?: boolean;
  ctaDisabled?: boolean;
  rawHref?: string;
  resolvedUrl?: string;
  canonicalTicketUrl?: string;
  providerKey?: string;
  providerIdentity?: TicketProviderIdentity;
  evidenceOrigin: TicketSourceStateEvidenceOrigin;
  reason?: string;
}

export type TicketActionKind =
  | 'ticket_detail'
  | 'presale_registration'
  | 'waitlist'
  | 'box_office'
  | 'historical_ticket_detail';

export interface ResolvedTicketAction {
  kind: TicketActionKind;
  sourceEventUrl: string;
  rawUrl: string;
  resolvedUrl: string;
  canonicalTicketUrl?: string;
  providerKey?: string;
  observedAt: string;
  contentFingerprint: string;
}

export type TicketEventResolutionClass =
  | 'verified_ticket_complete'
  | 'verified_ticket_available'
  | 'verified_ticket_with_historical_price'
  | 'verified_sold_out_without_public_price'
  | 'verified_sales_ended'
  | 'verified_presale_registration'
  | 'provider_access_unavailable'
  | 'ticket_link_not_yet_published'
  | 'ticket_identity_conflict'
  | 'internal_pipeline_failure'
  | 'unresolved_ticket_relationship';

export type TicketOfferRole =
  | 'regular_admission'
  | 'vip_admission'
  | 'group_admission'
  | 'camping'
  | 'upgrade'
  | 'parking'
  | 'shuttle'
  | 'locker'
  | 'table'
  | 'merchandise'
  | 'food_or_beverage'
  | 'power_or_equipment'
  | 'insurance'
  | 'donation'
  | 'other_addon'
  | 'unknown'
  /** @deprecated use regular_admission */
  | 'admission'
  /** @deprecated use table */
  | 'table_reservation'
  /** @deprecated use unknown */
  | 'unknown_addon'
  /** @deprecated use upgrade */
  | 'early_entry'
  /** @deprecated use other_addon */
  | 'shipping';

export interface TicketOfferClassification {
  role: TicketOfferRole;
  grantsEventEntry: boolean;
  requiresBaseTicket: boolean;
  category?: string;
  rejectionReason?: string;
}

export type TicketTargetIdentityDecision =
  | 'verified_same_event'
  | 'redirected_same_event'
  | 'redirected_to_different_event'
  | 'stale_ticket_detail'
  | 'identity_unverifiable';

export interface TicketTargetIdentityEvidence {
  originalUrl: string;
  redirectChain: string[];
  terminalUrl: string;
  providerKey?: string;
  providerEventId?: string;
  terminalTitle?: string;
  terminalStartAt?: string;
  terminalVenue?: string;
  terminalOrganizer?: string;
  observedAt: string;
  contentFingerprint: string;
  identityDecision: TicketTargetIdentityDecision;
  reasons: string[];
}

export interface DiscoveredTicketLink {
  rawUrl: string;
  relation: TicketLinkRelation;
  discoveredOnUrl: string;
  discoveredFromSource: string;
  observedAt: string;
  elementTag?: string;
  elementText?: string;
  elementClass?: string;
}

export interface ResolvedTicketLink {
  discovered: DiscoveredTicketLink;
  resolvedUrl: string;
  canonicalTicketUrl: string;
  providerKey: string;
  redirectChain: string[];
  isEventDetailUrl: boolean;
  rejectedUrlReason?: string;
}

export interface TicketProviderIdentity {
  providerKey: string;
  providerEventId: string;
  providerScope?: string;
  identityKey: string;
}

export interface RejectedTicketOffer {
  rawLabel?: string;
  rawPrice?: string;
  reason: string;
}

export interface TicketOfferEvidence {
  rawLabel?: string;
  normalizedLabel?: string;
  phaseLabel?: string;
  rawPrice?: string;
  amountMinor?: number;
  currency?: string;
  role?: TicketOfferRole;
  category?: string;
  description?: string;
  grantsEventEntry?: boolean;
  requiresBaseTicket?: boolean;
  availability: VerifiedTicketStatus;
  feeNotice?: string;
  confidence: number;
}

export interface EventIdentityEvidence {
  rawTitle?: string;
  normalizedTitle?: string;
  startAt?: string;
  endAt?: string;
  venueName?: string;
  venueAddress?: string;
  cityName?: string;
  organizerName?: string;
}

export interface EventTicketEvidence {
  providerKey: string;
  providerIdentity: TicketProviderIdentity;
  sourceUrl: string;
  canonicalTicketUrl: string;
  sourceObservedAt: string;
  extractedAt: string;
  contentFingerprint: string;
  eventIdentityEvidence: EventIdentityEvidence;
  offers: TicketOfferEvidence[];
  normalizedStatus: NormalizedTicketStatus;
  statusLabel: string;
  rejectedOffers: RejectedTicketOffer[];
  confidence: number;
}

export interface TicketProviderEventEvidence {
  providerKey: string;
  providerIdentity: TicketProviderIdentity;
  sourceUrl: string;
  canonicalTicketUrl: string;
  sourceObservedAt: string;
  extractedAt: string;
  contentFingerprint: string;
  event: {
    rawTitle?: string;
    normalizedTitle?: string;
    startAt?: string;
    endAt?: string;
    venueName?: string;
    venueAddress?: string;
    cityName?: string;
    organizerName?: string;
    description?: string;
    imageUrl?: string;
  };
  tickets: EventTicketEvidence;
  confidence: number;
  supplementalContent?: {
    descriptionClean?: string;
    lineupCandidates?: Array<{ displayName: string; rawText: string }>;
    genreLabels?: string[];
  };
}

export interface TicketEvidenceRequest {
  url: URL;
  canonicalTicketUrl: string;
  redirectChain: string[];
  body: string;
  contentType: string;
  fingerprint: string;
  observedAt: string;
  extractedAt: string;
}

export interface CanonicalTicketUrlResult {
  canonicalUrl: string;
  isEventDetailUrl: boolean;
}

export interface TicketFetchResult {
  finalUrl: string;
  body: string;
  contentType: string;
  fingerprint: string;
  blocked: boolean;
  blockReason?: 'bot_protection' | 'non_https' | 'host_not_allowed' | 'timeout' | 'too_large' | 'invalid_mime' | 'http_error' | 'redirect_limit';
  redirectChain: string[];
}

export interface TicketEvidenceProvider {
  readonly providerKey: string;
  canHandle(url: URL): boolean;
  canonicalizeUrl(url: URL): CanonicalTicketUrlResult | null;
  extractProviderIdentity(url: URL): TicketProviderIdentity | null;
  fetchEventEvidence(request: TicketEvidenceRequest): Promise<TicketProviderEventEvidence>;
}

export interface TicketProviderRegistry {
  resolveProvider(url: URL): TicketEvidenceProvider | null;
}

export type TicketIdentityResult =
  | 'ticket_identity_verified'
  | 'ticket_identity_conflict'
  | 'ticket_identity_stale_official_link'
  | 'ticket_identity_unverifiable';

export interface TicketAuditCounters {
  ticketLinkDetectionFailures: number;
  ticketRedirectResolutionFailures: number;
  merchandiseLinksPublishedAsTickets: number;
  ticketAssignedToWrongEvent: number;
  ticketIdentityConflicts: number;
  ticketIdentityUnverifiable: number;
  linkedEventsWithoutTicketRow: number;
  linkedEventsWithoutVerifiedPrice: number;
  linkedEventsWithoutVerifiedStatus: number;
  linkedEventsWithoutCanonicalUrl: number;
  linkedEventsWithoutStatusBadge: number;
  ticketShopRootPublished: number;
  ticketCheckoutUrlPublished: number;
  ticketStatusInferred: number;
  ticketPriceInferred: number;
  blockedInterpretedAsSoldOut: number;
  addonPricesPublishedAsAdmissionPrice: number;
  lockerOnlyEventsMarkedAvailable: number;
  fixtureEvidencePublishedAsLive: number;
  historicalPriceWithoutProvenance: number;
  duplicateTicketFetches: number;
  sameTicketUrlFetchedMultipleTimes: number;
  duplicateTicketEvidence: number;
  duplicateProviderOffers: number;
  duplicateCanonicalEventsCreated: number;
  duplicateSourceReferences: number;
  crossSourceMatchesByTitleOnly: number;
  differentEventDatesMerged: number;
  providerEvidenceLost: number;
  ticketProviderOverwriteAcrossProviders: number;
  ingestionOrderDependentResults: number;
  sourceSpecificTicketLogic: number;
  ticketProviderImportsOfficialConnector: number;
  officialConnectorParsesTicketProviderDom: number;
  unsupportedProviderPublishedAsVerified: number;
  consumerTicketDbMismatches: number;
  coreFieldsChangedByWeakerEvidence: number;
  m2TicketChanged: number;
}

export function createEmptyTicketAuditCounters(): TicketAuditCounters {
  return {
    ticketLinkDetectionFailures: 0,
    ticketRedirectResolutionFailures: 0,
    merchandiseLinksPublishedAsTickets: 0,
    ticketAssignedToWrongEvent: 0,
    ticketIdentityConflicts: 0,
    ticketIdentityUnverifiable: 0,
    linkedEventsWithoutTicketRow: 0,
    linkedEventsWithoutVerifiedPrice: 0,
    linkedEventsWithoutVerifiedStatus: 0,
    linkedEventsWithoutCanonicalUrl: 0,
    linkedEventsWithoutStatusBadge: 0,
    ticketShopRootPublished: 0,
    ticketCheckoutUrlPublished: 0,
    ticketStatusInferred: 0,
    ticketPriceInferred: 0,
    blockedInterpretedAsSoldOut: 0,
    addonPricesPublishedAsAdmissionPrice: 0,
    lockerOnlyEventsMarkedAvailable: 0,
    fixtureEvidencePublishedAsLive: 0,
    historicalPriceWithoutProvenance: 0,
    duplicateTicketFetches: 0,
    sameTicketUrlFetchedMultipleTimes: 0,
    duplicateTicketEvidence: 0,
    duplicateProviderOffers: 0,
    duplicateCanonicalEventsCreated: 0,
    duplicateSourceReferences: 0,
    crossSourceMatchesByTitleOnly: 0,
    differentEventDatesMerged: 0,
    providerEvidenceLost: 0,
    ticketProviderOverwriteAcrossProviders: 0,
    ingestionOrderDependentResults: 0,
    sourceSpecificTicketLogic: 0,
    ticketProviderImportsOfficialConnector: 0,
    officialConnectorParsesTicketProviderDom: 0,
    unsupportedProviderPublishedAsVerified: 0,
    consumerTicketDbMismatches: 0,
    coreFieldsChangedByWeakerEvidence: 0,
    m2TicketChanged: 0,
  };
}
