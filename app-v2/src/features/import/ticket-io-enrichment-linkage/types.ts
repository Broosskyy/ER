import type { TicketIoPriceEvidenceDiscovery } from '@/features/aggregation/connectors/ticket-platform/ticket-io-price-evidence';

export const PHASE4862_R3HAB_EVENT_ID = 'evt-1785339421539-k3swcrl';

export type TicketIoLinkageRootCause =
  | 'NO_TICKETIO_SOURCE_REFERENCE'
  | 'NO_TICKETIO_IMPORT_RECORD'
  | 'IMPORT_RECORD_NOT_LINKED_TO_CANONICAL_EVENT'
  | 'VALID_EVIDENCE_NOT_PERSISTED'
  | 'CANONICAL_VALUE_STALE'
  | 'LIST_ROW_MATCH_FAILED'
  | 'PUBLIC_EVIDENCE_MISSING'
  | 'DETAIL_BLOCKED_LIST_SUFFICIENT'
  | 'REVIEW_REQUIRED'
  | 'NONE';

export type TicketIoLinkagePersistenceState =
  | 'linked_and_current'
  | 'linked_stale'
  | 'unlinked_gap'
  | 'review_required'
  | 'no_public_evidence';

export type TicketIoEnrichmentAuditRow = {
  eventId: string;
  title: string;
  ticketUrl: string;
  shopHost: string;
  eventSlug?: string;
  sourceReferences: Array<{
    sourceId: string;
    externalEventId: string;
    lastSeenAt?: string;
    active?: boolean;
  }>;
  ticketIoImportRecords: Array<{
    id: string;
    sourceId: string;
    status: string;
    resultingEventId?: string | null;
    updatedAt?: string;
    priceText?: string;
  }>;
  latestTicketIoImportAt?: string;
  canonicalPriceText?: string;
  canonicalTicketStatus?: string;
  canonicalTicketPhasesCount: number;
  publicListRowMatch: boolean;
  publicRawPrice?: string;
  publicNormalizedPrice?: string;
  publicAvailability?: string;
  publicSoldOut?: boolean;
  connectorPriceText?: string;
  connectorPriceAmount?: number;
  discovery: TicketIoPriceEvidenceDiscovery;
  rootCause: TicketIoLinkageRootCause;
  persistenceState: TicketIoLinkagePersistenceState;
  responsibleModule: string;
  responsibleTransition: string;
  repeatsWithoutFix: boolean;
  genericCodeChangeRequired: boolean;
  controlledEnrichmentSufficient: boolean;
  slugCollisionEventIds?: string[];
};

export type TicketIoEnrichmentPreviewMutation = {
  eventId: string;
  title: string;
  shopHost: string;
  eventSlug: string;
  field: 'priceText' | 'ticketStatus' | 'ticketPhases';
  currentValue: unknown;
  proposedValue: unknown;
  publicEvidence: string;
  connectorOutput: unknown;
  sourceReferenceState: string;
  importRecordState: string;
  writeReason: string;
  consumerVisibleResult: unknown;
  frozenDomainFingerprint: Record<string, unknown>;
  rollbackValue: unknown;
  risk: 'low' | 'medium' | 'high';
  batch: 'A' | 'review';
};
