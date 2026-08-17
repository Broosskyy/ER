import type { EventCandidateTicket } from '../../ingestion/types/event-candidate';
import type { TicketSourceState } from './types';

export type TicketPersistenceOperation = 'insert' | 'update' | 'delete' | 'noop';

export interface ExistingEventTicketRecord {
  ticketId: string;
  eventId: string;
  provider: string | null;
  ticketUrl: string | null;
  priceFromMinor: number | null;
  currency: string | null;
  salesStatus: string | null;
  sortOrder: number;
}

export interface ExistingTicketSourceRecord {
  sourceId: string;
  eventId: string;
  sourceUrl: string | null;
  contentHash: string | null;
  rawPayload: Record<string, unknown> | null;
}

export interface ExistingOfficialEventBinding {
  eventId: string;
  officialUrl: string;
  sourceId: string;
  contentHash: string | null;
  rawPayload: Record<string, unknown> | null;
  title: string;
}

export interface PlannedConsumerProjection {
  ticketSourceState: TicketSourceState;
  providerKey?: string;
  priceLabel: string;
  priceEvidenceState: string;
  status: string;
  badge: string;
  actionKind: string;
  actionLabel: string;
  canonicalTicketUrl?: string;
  hasActivePurchaseCta: boolean;
}

export interface EventTicketPersistencePlan {
  sourceEventKey: string;
  officialUrl: string;
  eventId: string;
  eventTitle: string;
  officialSourceId: string;
  ticketSourceState: TicketSourceState;
  resolutionClass: string;
  evidenceSummary: string;
  ticketOperation: TicketPersistenceOperation;
  ticketOperationReason: string;
  plannedTicketRow?: EventCandidateTicket;
  existingTicketId?: string;
  providerSourceOperation: TicketPersistenceOperation;
  providerSourceReason: string;
  providerSourceUrl?: string;
  providerSourcePayload?: Record<string, unknown>;
  provenanceOperation: TicketPersistenceOperation;
  provenanceReason: string;
  provenancePayload: Record<string, unknown>;
  consumerProjection: PlannedConsumerProjection;
}

export interface TicketPersistenceWritePlanSummary {
  currentTicketInsertsRequired: number;
  currentTicketUpdatesRequired: number;
  currentTicketDeletesRequired: number;
  historicalTicketRelationsRequired: number;
  presaleActionsRequired: number;
  ticketLinkNotYetPublishedStates: number;
  providerUnavailableStates: number;
  providerSourceReferencesRequired: number;
  provenanceUpdatesRequired: number;
  eventCoreUpdatesRequired: number;
  m2TicketUpdatesRequired: number;
  allIdempotent: boolean;
  eventPlans: EventTicketPersistencePlan[];
}
