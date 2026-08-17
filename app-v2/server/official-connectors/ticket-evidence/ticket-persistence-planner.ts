import type { EventCandidateTicket } from '../../ingestion/types/event-candidate';
import { canonicalizeOfficialSourceUrl } from '../../ingestion/identity/source-identity';
import { buildTicketSourcePayload } from './attach-ticket-evidence';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';
import { mapResolutionToTicketSourceState } from './ticket-source-state';
import type {
  ExistingEventTicketRecord,
  ExistingOfficialEventBinding,
  ExistingTicketSourceRecord,
  EventTicketPersistencePlan,
  PlannedConsumerProjection,
  TicketPersistenceOperation,
  TicketPersistenceWritePlanSummary,
} from './ticket-persistence-types';
import type { TicketSourceState } from './types';

const M2_TEST_EVENT_TITLE = 'Eternal Rave Core Test';

export interface TicketPersistencePlannerContext {
  officialBindings: ExistingOfficialEventBinding[];
  existingTickets: ExistingEventTicketRecord[];
  existingTicketSources: ExistingTicketSourceRecord[];
}

function findOfficialBinding(
  officialUrl: string,
  bindings: ExistingOfficialEventBinding[],
): ExistingOfficialEventBinding | undefined {
  const canonical = canonicalizeOfficialSourceUrl(officialUrl);
  return bindings.find((binding) => canonicalizeOfficialSourceUrl(binding.officialUrl) === canonical);
}

function findExistingTicket(eventId: string, tickets: ExistingEventTicketRecord[]): ExistingEventTicketRecord | undefined {
  return tickets.find((ticket) => ticket.eventId === eventId && ticket.sortOrder === 0);
}

function findExistingTicketSource(
  eventId: string,
  sourceUrl: string,
  sources: ExistingTicketSourceRecord[],
): ExistingTicketSourceRecord | undefined {
  const canonical = sourceUrl.trim();
  return sources.find((source) => source.eventId === eventId && source.sourceUrl === canonical);
}

function resolveSourceState(result: VerifiedTicketCompleteResult): TicketSourceState {
  if (result.ticketSourceStateEvidence?.state) {
    return result.ticketSourceStateEvidence.state;
  }
  const mapped = mapResolutionToTicketSourceState(result.resolutionClass, result.resolvedAction?.kind);
  if (mapped) {
    return mapped;
  }
  throw new Error(`ticket_source_state_missing:${result.sourceEventKey}`);
}

function shouldPersistTicketRow(sourceState: TicketSourceState, result: VerifiedTicketCompleteResult): boolean {
  if (sourceState === 'ticket_link_not_yet_published' || sourceState === 'presale_registration' || sourceState === 'waitlist') {
    return false;
  }
  const ticketUrl = result.canonicalTicketUrl ?? result.resolvedAction?.canonicalTicketUrl;
  return Boolean(ticketUrl?.startsWith('https://'));
}

function mapSalesStatus(sourceState: TicketSourceState, result: VerifiedTicketCompleteResult): string {
  if (sourceState === 'historical_ticket_detail') {
    return 'sales_ended';
  }
  if (sourceState === 'provider_access_unavailable') {
    return 'availability_unverified';
  }
  const normalized = result.statusProjection?.normalizedStatus;
  if (normalized === 'sold_out') {
    return 'sold_out';
  }
  if (normalized === 'sales_ended') {
    return 'sales_ended';
  }
  if (normalized === 'sale_not_started') {
    return 'sale_not_started';
  }
  return 'available';
}

function mapPlannedTicketRow(
  sourceState: TicketSourceState,
  result: VerifiedTicketCompleteResult,
): EventCandidateTicket | undefined {
  if (!shouldPersistTicketRow(sourceState, result)) {
    return undefined;
  }
  const ticketUrl = result.canonicalTicketUrl ?? result.resolvedAction?.canonicalTicketUrl;
  if (!ticketUrl) {
    return undefined;
  }
  const priceEvidence = result.priceEvidence;
  const includePrice =
    priceEvidence?.state === 'verified_current' || priceEvidence?.state === 'verified_historical';
  return {
    provider: result.providerKey ?? result.ticketEvidence?.providerKey ?? 'unknown',
    ticketUrl,
    priceFromMinor: includePrice ? priceEvidence?.amountMinor : undefined,
    currency: includePrice ? priceEvidence?.currency : undefined,
    salesStatus: mapSalesStatus(sourceState, result),
    sortOrder: 0,
  };
}

function buildConsumerProjection(
  sourceState: TicketSourceState,
  result: VerifiedTicketCompleteResult,
): PlannedConsumerProjection {
  const preview = result.consumerPreview;
  const actionLabel = preview?.actionLabel ?? '';
  return {
    ticketSourceState: sourceState,
    providerKey: preview?.providerKey,
    priceLabel: preview?.priceLabel ?? preview?.visiblePrice ?? 'Preis nicht verfügbar',
    priceEvidenceState: preview?.priceEvidenceState ?? result.priceEvidence?.state ?? 'provider_access_unavailable',
    status: preview?.status ?? result.statusProjection?.normalizedStatus ?? 'available',
    badge: preview?.badge ?? result.statusProjection?.statusLabel ?? '',
    actionKind: preview?.actionKind ?? result.resolvedAction?.kind ?? 'ticket_detail',
    actionLabel,
    canonicalTicketUrl: preview?.canonicalTicketUrl ?? result.canonicalTicketUrl,
    hasActivePurchaseCta:
      sourceState === 'current_ticket_detail' && actionLabel.trim().length > 0,
  };
}

function buildProvenancePayload(
  sourceState: TicketSourceState,
  result: VerifiedTicketCompleteResult,
): Record<string, unknown> {
  return {
    ticketSourceState: sourceState,
    resolutionClass: result.resolutionClass,
    consumerProjection: buildConsumerProjection(sourceState, result),
    ticketSourceStateEvidence: result.ticketSourceStateEvidence ?? null,
    priceEvidence: result.priceEvidence ?? null,
    statusProjection: result.statusProjection ?? null,
    identityResult: result.identityResult,
    observedAt: result.ticketSourceStateEvidence?.observedAt ?? result.priceEvidence?.sourceObservedAt ?? null,
  };
}

function ticketsEqual(
  existing: ExistingEventTicketRecord,
  planned: EventCandidateTicket,
): boolean {
  return (
    (existing.provider ?? '') === (planned.provider ?? '') &&
    (existing.ticketUrl ?? '') === (planned.ticketUrl ?? '') &&
    existing.priceFromMinor === (planned.priceFromMinor ?? null) &&
    (existing.currency ?? '') === (planned.currency ?? '') &&
    (existing.salesStatus ?? '') === (planned.salesStatus ?? '')
  );
}

function normalizeComparableJson(value: unknown): unknown {
  if (value === undefined || value === '') {
    return null;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeComparableJson(entry));
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, entry]) => [key, normalizeComparableJson(entry)]),
    );
  }
  return value;
}

function comparableProjectionSubset(
  current: Record<string, unknown> | undefined | null,
  planned: Record<string, unknown> | undefined | null,
): boolean {
  if (!planned) {
    return current == null || current === undefined;
  }
  if (!current) {
    return false;
  }
  for (const [key, value] of Object.entries(planned)) {
    if (
      JSON.stringify(normalizeComparableJson(current[key])) !==
      JSON.stringify(normalizeComparableJson(value))
    ) {
      return false;
    }
  }
  return true;
}

function provenanceEqual(
  existingPayload: Record<string, unknown> | null | undefined,
  planned: Record<string, unknown>,
): boolean {
  const current = existingPayload?.ticketEvidenceProjection as Record<string, unknown> | undefined;
  if (!current) {
    return false;
  }
  return (
    current.ticketSourceState === planned.ticketSourceState &&
    current.resolutionClass === planned.resolutionClass &&
    comparableProjectionSubset(
      current.consumerProjection as Record<string, unknown> | undefined,
      planned.consumerProjection as Record<string, unknown>,
    ) &&
    comparableProjectionSubset(
      current.priceEvidence as Record<string, unknown> | undefined,
      planned.priceEvidence as Record<string, unknown>,
    ) &&
    comparableProjectionSubset(
      current.statusProjection as Record<string, unknown> | undefined,
      planned.statusProjection as Record<string, unknown>,
    )
  );
}

function resolveTicketOperation(
  existing: ExistingEventTicketRecord | undefined,
  planned: EventCandidateTicket | undefined,
): { operation: TicketPersistenceOperation; reason: string } {
  if (!planned) {
    if (existing) {
      return { operation: 'delete', reason: 'ticket_row_no_longer_supported_for_source_state' };
    }
    return { operation: 'noop', reason: 'no_ticket_row_required' };
  }
  if (!existing) {
    return { operation: 'insert', reason: 'ticket_row_missing' };
  }
  if (ticketsEqual(existing, planned)) {
    return { operation: 'noop', reason: 'ticket_row_already_matches' };
  }
  return { operation: 'update', reason: 'ticket_row_changed' };
}

function resolveProviderSourceOperation(
  eventId: string,
  sourceState: TicketSourceState,
  result: VerifiedTicketCompleteResult,
  existingSources: ExistingTicketSourceRecord[],
): {
  operation: TicketPersistenceOperation;
  reason: string;
  sourceUrl?: string;
  payload?: Record<string, unknown>;
} {
  if (sourceState !== 'presale_registration' && sourceState !== 'waitlist') {
    if (!result.ticketEvidence) {
      return { operation: 'noop', reason: 'no_provider_source_required' };
    }
    const sourceUrl = result.ticketEvidence.canonicalTicketUrl ?? result.canonicalTicketUrl;
    if (!sourceUrl?.startsWith('https://')) {
      return { operation: 'noop', reason: 'no_provider_source_url' };
    }
    const payload = buildTicketSourcePayload(result.ticketEvidence);
    const existing = findExistingTicketSource(eventId, sourceUrl, existingSources);
    if (!existing) {
      return { operation: 'insert', reason: 'provider_source_missing', sourceUrl, payload };
    }
    const sameHash = existing.contentHash === result.ticketEvidence.contentFingerprint;
    const samePayload =
      (existing.rawPayload?.providerKey as string | undefined) === payload.providerKey &&
      (existing.rawPayload?.contentFingerprint as string | undefined) === payload.contentFingerprint &&
      (existing.rawPayload?.canonicalTicketUrl as string | undefined) === payload.canonicalTicketUrl;
    if (sameHash && samePayload) {
      return { operation: 'noop', reason: 'provider_source_already_matches', sourceUrl, payload };
    }
    return { operation: 'update', reason: 'provider_source_changed', sourceUrl, payload };
  }

  const presaleUrl = result.canonicalTicketUrl ?? result.resolvedAction?.canonicalTicketUrl;
  if (!presaleUrl?.startsWith('https://')) {
    return { operation: 'noop', reason: 'presale_without_public_url' };
  }
  const payload = {
    actionKind: result.resolvedAction?.kind ?? 'presale_registration',
    canonicalTicketUrl: presaleUrl,
    observedAt: result.priceEvidence?.sourceObservedAt ?? result.ticketSourceStateEvidence?.observedAt,
    resolutionClass: result.resolutionClass,
  };
  const existing = findExistingTicketSource(eventId, presaleUrl, existingSources);
  if (!existing) {
    return { operation: 'insert', reason: 'presale_source_missing', sourceUrl: presaleUrl, payload };
  }
  if (JSON.stringify(existing.rawPayload ?? {}) === JSON.stringify(payload)) {
    return { operation: 'noop', reason: 'presale_source_already_matches', sourceUrl: presaleUrl, payload };
  }
  return { operation: 'update', reason: 'presale_source_changed', sourceUrl: presaleUrl, payload };
}

export function planTicketEvidencePersistence(
  results: VerifiedTicketCompleteResult[],
  context: TicketPersistencePlannerContext,
): EventTicketPersistencePlan[] {
  return results.map((result) => {
    const binding = findOfficialBinding(result.officialUrl, context.officialBindings);
    if (!binding) {
      throw new Error(`official_binding_missing:${result.sourceEventKey}`);
    }
    if (binding.title === M2_TEST_EVENT_TITLE) {
      throw new Error(`m2_event_in_ticket_batch:${result.sourceEventKey}`);
    }

    const sourceState = resolveSourceState(result);
    const plannedTicketRow = mapPlannedTicketRow(sourceState, result);
    const existingTicket = findExistingTicket(binding.eventId, context.existingTickets);
    const ticketResolution = resolveTicketOperation(existingTicket, plannedTicketRow);
    const provenancePayload = buildProvenancePayload(sourceState, result);
    const provenanceOperation: TicketPersistenceOperation = provenanceEqual(binding.rawPayload, provenancePayload)
      ? 'noop'
      : 'update';
    const providerSource = resolveProviderSourceOperation(
      binding.eventId,
      sourceState,
      result,
      context.existingTicketSources,
    );

    const evidenceSummary = [
      `resolution=${result.resolutionClass ?? 'unknown'}`,
      `sourceState=${sourceState}`,
      plannedTicketRow ? `ticketUrl=${plannedTicketRow.ticketUrl}` : 'no_ticket_row',
    ].join('; ');

    return {
      sourceEventKey: result.sourceEventKey,
      officialUrl: result.officialUrl,
      eventId: binding.eventId,
      eventTitle: binding.title,
      officialSourceId: binding.sourceId,
      ticketSourceState: sourceState,
      resolutionClass: result.resolutionClass ?? 'unresolved_ticket_relationship',
      evidenceSummary,
      ticketOperation: ticketResolution.operation,
      ticketOperationReason: ticketResolution.reason,
      plannedTicketRow,
      existingTicketId: existingTicket?.ticketId,
      providerSourceOperation: providerSource.operation,
      providerSourceReason: providerSource.reason,
      providerSourceUrl: providerSource.sourceUrl,
      providerSourcePayload: providerSource.payload,
      provenanceOperation,
      provenanceReason:
        provenanceOperation === 'noop' ? 'official_provenance_already_matches' : 'official_provenance_update_required',
      provenancePayload,
      consumerProjection: buildConsumerProjection(sourceState, result),
    };
  });
}

export function summarizeTicketPersistencePlan(plans: EventTicketPersistencePlan[]): TicketPersistenceWritePlanSummary {
  const currentStates = new Set<TicketSourceState>(['current_ticket_detail', 'provider_access_unavailable']);
  const historicalStates = new Set<TicketSourceState>(['historical_ticket_detail']);

  const summary: TicketPersistenceWritePlanSummary = {
    currentTicketInsertsRequired: plans.filter(
      (plan) => plan.ticketOperation === 'insert' && currentStates.has(plan.ticketSourceState),
    ).length,
    currentTicketUpdatesRequired: plans.filter(
      (plan) => plan.ticketOperation === 'update' && currentStates.has(plan.ticketSourceState),
    ).length,
    currentTicketDeletesRequired: plans.filter(
      (plan) => plan.ticketOperation === 'delete' && currentStates.has(plan.ticketSourceState),
    ).length,
    historicalTicketRelationsRequired: plans.filter((plan) => historicalStates.has(plan.ticketSourceState)).length,
    presaleActionsRequired: plans.filter((plan) => plan.ticketSourceState === 'presale_registration').length,
    ticketLinkNotYetPublishedStates: plans.filter(
      (plan) => plan.ticketSourceState === 'ticket_link_not_yet_published',
    ).length,
    providerUnavailableStates: plans.filter((plan) => plan.ticketSourceState === 'provider_access_unavailable').length,
    providerSourceReferencesRequired: plans.filter((plan) => plan.providerSourceOperation !== 'noop').length,
    provenanceUpdatesRequired: plans.filter((plan) => plan.provenanceOperation !== 'noop').length,
    eventCoreUpdatesRequired: 0,
    m2TicketUpdatesRequired: 0,
    allIdempotent: plans.every(
      (plan) =>
        plan.ticketOperation === 'noop' &&
        plan.providerSourceOperation === 'noop' &&
        plan.provenanceOperation === 'noop',
    ),
    eventPlans: plans,
  };

  return summary;
}
