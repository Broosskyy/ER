import type { EventCandidateTicket } from '../../ingestion/types/event-candidate';
import { canonicalizeOfficialSourceUrl } from '../../ingestion/identity/source-identity';
import { buildTicketSourcePayload } from './attach-ticket-evidence';
import type { VerifiedTicketCompleteResult } from './ticket-audit-metrics';
import {
  consumerTicketUrl,
  hasActivePurchaseCta,
  hasVerifiedEventSpecificTicketTarget,
  hasVerifiedPresaleCta,
} from './consumer-ticket-safety-gate';
import { isVerifiedTicketTargetIdentity } from './ticket-target-identity';
import { mapResolutionToTicketSourceState } from './ticket-source-state';
import { isShopRootUrl } from './url-policy';
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

function findExistingTicketSourceByUrl(
  sourceUrl: string,
  sources: ExistingTicketSourceRecord[],
): ExistingTicketSourceRecord | undefined {
  const canonical = sourceUrl.trim();
  return sources.find((source) => source.sourceUrl === canonical);
}

function resolveSourceState(result: VerifiedTicketCompleteResult): TicketSourceState {
  if (result.ticketSourceStateEvidence?.state) {
    return result.ticketSourceStateEvidence.state;
  }
  const mapped = mapResolutionToTicketSourceState(
    result.resolutionClass ?? result.classification,
    result.resolvedAction?.kind,
  );
  if (mapped) {
    return mapped;
  }
  if (result.priceEvidence?.state === 'provider_access_unavailable') {
    return 'provider_access_unavailable';
  }
  throw new Error(`ticket_source_state_missing:${result.sourceEventKey}`);
}

function identityAllowsPersistedPurchaseUrl(result: VerifiedTicketCompleteResult): boolean {
  if (result.identityResult === 'ticket_identity_conflict' || result.identityResult === 'ticket_identity_unverifiable') {
    return false;
  }
  const decision = result.targetIdentityEvidence?.identityDecision;
  if (decision && !isVerifiedTicketTargetIdentity(decision)) {
    return false;
  }
  return result.identityResult === 'ticket_identity_verified';
}

function resolveVerifiedEventTicketUrl(result: VerifiedTicketCompleteResult): string | undefined {
  if (!identityAllowsPersistedPurchaseUrl(result)) {
    return undefined;
  }
  const url =
    result.targetIdentityEvidence?.terminalUrl ??
    result.canonicalTicketUrl ??
    result.resolvedAction?.canonicalTicketUrl;
  if (!url?.startsWith('https://') || isShopRootUrl(url)) {
    return undefined;
  }
  return url;
}

function hasVerifiedEventSpecificTicketTargetFromResult(result: VerifiedTicketCompleteResult): boolean {
  return hasVerifiedEventSpecificTicketTarget({
    identityResult: result.identityResult,
    identityDecision: result.targetIdentityEvidence?.identityDecision,
    canonicalTicketUrl:
      result.canonicalTicketUrl ??
      result.resolvedAction?.canonicalTicketUrl ??
      result.targetIdentityEvidence?.terminalUrl,
  });
}

function shouldPersistTicketRow(sourceState: TicketSourceState, result: VerifiedTicketCompleteResult): boolean {
  if (sourceState === 'ticket_link_not_yet_published') {
    return (
      result.priceEvidence?.state === 'verified_current' &&
      result.priceEvidence.amountMinor != null &&
      result.priceEvidence.reason === 'official_door_admission_without_purchase_target'
    );
  }
  if (sourceState === 'provider_access_unavailable') {
    if (result.targetIdentityEvidence?.identityDecision === 'redirected_to_different_event') {
      return true;
    }
    if (hasVerifiedEventSpecificTicketTargetFromResult(result)) {
      return true;
    }
    return false;
  }
  if (sourceState === 'historical_ticket_detail') {
    return true;
  }
  if (sourceState === 'presale_registration' || sourceState === 'waitlist') {
    return hasVerifiedPresaleCta(buildSafetyInput(sourceState, result));
  }
  if (sourceState === 'current_ticket_detail') {
    const salesStatus = mapSalesStatus(sourceState, result);
    if (salesStatus === 'sold_out' || salesStatus === 'sales_ended') {
      return true;
    }
    if (identityAllowsPersistedPurchaseUrl(result) && (result.canonicalTicketUrl || result.resolvedAction?.canonicalTicketUrl)) {
      return true;
    }
    if (hasActivePurchaseCta(buildSafetyInput(sourceState, result))) {
      return true;
    }
    return false;
  }
  return false;
}

function buildSafetyInput(sourceState: TicketSourceState, result: VerifiedTicketCompleteResult) {
  const preview = result.consumerPreview;
  return {
    ticketSourceState: sourceState,
    identityResult: result.identityResult,
    identityDecision: result.targetIdentityEvidence?.identityDecision,
    salesStatus: mapSalesStatus(sourceState, result),
    actionKind: preview?.actionKind ?? result.resolvedAction?.kind,
    actionLabel: preview?.actionLabel,
    canonicalTicketUrl:
      preview?.canonicalTicketUrl ??
      result.canonicalTicketUrl ??
      result.resolvedAction?.canonicalTicketUrl ??
      result.targetIdentityEvidence?.terminalUrl,
    priceEvidenceState: preview?.priceEvidenceState ?? result.priceEvidence?.state,
  };
}

function mapSalesStatus(sourceState: TicketSourceState, result: VerifiedTicketCompleteResult): string {
  if (sourceState === 'historical_ticket_detail') {
    return 'sales_ended';
  }
  if (sourceState === 'provider_access_unavailable') {
    if (hasVerifiedEventSpecificTicketTargetFromResult(result)) {
      const normalized =
        result.ticketEvidence?.normalizedStatus ?? result.statusProjection?.normalizedStatus;
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

function buildSafeShopRootTicketDowngrade(existing: ExistingEventTicketRecord): EventCandidateTicket {
  return {
    provider: existing.provider ?? 'organizer_shop',
    ticketUrl: undefined,
    priceFromMinor: undefined,
    currency: undefined,
    salesStatus: 'availability_unverified',
    sortOrder: 0,
  };
}

function existingTicketNeedsShopRootDowngrade(
  existing: ExistingEventTicketRecord,
  result: VerifiedTicketCompleteResult,
): boolean {
  if (!existing.ticketUrl || !isShopRootUrl(existing.ticketUrl)) {
    return false;
  }
  if (result.classification === 'ticket_evidence_missing') {
    return true;
  }
  if (!result.ticketEvidence?.offers?.some((offer) => offer.role === 'regular_admission')) {
    return true;
  }
  return !identityAllowsPersistedPurchaseUrl(result);
}

function mapPlannedTicketRow(
  sourceState: TicketSourceState,
  result: VerifiedTicketCompleteResult,
  existing?: ExistingEventTicketRecord,
): EventCandidateTicket | undefined {
  if (existing && existingTicketNeedsShopRootDowngrade(existing, result)) {
    return buildSafeShopRootTicketDowngrade(existing);
  }
  if (!shouldPersistTicketRow(sourceState, result)) {
    return undefined;
  }
  const safetyInput = buildSafetyInput(sourceState, result);
  let salesStatus = mapSalesStatus(sourceState, result);
  const catalogMissing =
    result.priceEvidence?.reason === 'regular_price_not_exposed_by_provider' ||
    result.priceEvidence?.reason === 'admission_without_price';
  const verifiedCurrentPrice =
    result.priceEvidence?.state === 'verified_current' || result.priceEvidence?.state === 'verified_historical';
  if (
    catalogMissing &&
    existing &&
    (existing.salesStatus === 'sold_out' || existing.salesStatus === 'sales_ended') &&
    sourceState === 'current_ticket_detail'
  ) {
    salesStatus = existing.salesStatus;
  }
  const verifiedEventUrl = resolveVerifiedEventTicketUrl(result);
  let ticketUrl =
    salesStatus === 'sold_out' || salesStatus === 'sales_ended' || salesStatus === 'cancelled'
      ? verifiedEventUrl
      : consumerTicketUrl(safetyInput) ?? verifiedEventUrl;
  if (!ticketUrl?.startsWith('https://')) {
    ticketUrl = undefined;
  }
  let priceFromMinor = verifiedCurrentPrice ? result.priceEvidence?.amountMinor : undefined;
  let currency = verifiedCurrentPrice ? result.priceEvidence?.currency : undefined;
  if (sourceState === 'historical_ticket_detail' || sourceState === 'provider_access_unavailable') {
    if (!verifiedCurrentPrice) {
      priceFromMinor = undefined;
      currency = undefined;
    }
    if (sourceState === 'historical_ticket_detail') {
      ticketUrl = undefined;
    } else if (!verifiedEventUrl) {
      ticketUrl = undefined;
    }
  }
  return {
    provider: result.providerKey ?? result.ticketEvidence?.providerKey ?? existing?.provider ?? 'unknown',
    ticketUrl,
    priceFromMinor,
    currency,
    salesStatus,
    sortOrder: 0,
  };
}

function buildConsumerProjection(
  sourceState: TicketSourceState,
  result: VerifiedTicketCompleteResult,
): PlannedConsumerProjection {
  const preview = result.consumerPreview;
  const safetyInput = buildSafetyInput(sourceState, result);
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
    canonicalTicketUrl: consumerTicketUrl(safetyInput),
    hasActivePurchaseCta: hasActivePurchaseCta(safetyInput),
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
    targetIdentityEvidence: result.targetIdentityEvidence ?? null,
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

function shouldPreserveExistingTicketOnTransientFailure(
  result: VerifiedTicketCompleteResult,
  sourceState: TicketSourceState,
): boolean {
  if (sourceState === 'provider_access_unavailable') {
    return true;
  }
  if (sourceState === 'ticket_link_not_yet_published') {
    return true;
  }
  if (result.identityResult === 'ticket_identity_unverifiable') {
    return true;
  }
  if (result.identityResult === 'ticket_identity_conflict') {
    return true;
  }
  if (result.resolutionClass === 'internal_pipeline_failure') {
    return true;
  }
  if (result.resolutionClass === 'unresolved_ticket_relationship') {
    return true;
  }
  if (result.resolutionClass === 'provider_access_unavailable') {
    return true;
  }
  if (result.priceEvidence?.state === 'provider_access_unavailable') {
    return true;
  }
  return false;
}

function resolveTicketOperation(
  existing: ExistingEventTicketRecord | undefined,
  planned: EventCandidateTicket | undefined,
  result: VerifiedTicketCompleteResult,
  sourceState: TicketSourceState,
): { operation: TicketPersistenceOperation; reason: string } {
  if (!planned) {
    if (existing) {
      if (shouldPreserveExistingTicketOnTransientFailure(result, sourceState)) {
        return { operation: 'noop', reason: 'preserve_existing_ticket_on_transient_failure' };
      }
      return { operation: 'noop', reason: 'preserve_existing_ticket_fail_closed' };
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
      const globalExisting = findExistingTicketSourceByUrl(sourceUrl, existingSources);
      if (globalExisting && globalExisting.eventId !== eventId) {
        return {
          operation: 'noop',
          reason: 'provider_source_url_bound_to_other_event',
          sourceUrl,
          payload,
        };
      }
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
    const globalExisting = findExistingTicketSourceByUrl(presaleUrl, existingSources);
    if (globalExisting && globalExisting.eventId !== eventId) {
      return {
        operation: 'noop',
        reason: 'provider_source_url_bound_to_other_event',
        sourceUrl: presaleUrl,
        payload,
      };
    }
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
  const plans: EventTicketPersistencePlan[] = [];

  for (const result of results) {
    const binding = findOfficialBinding(result.officialUrl, context.officialBindings);
    if (!binding) {
      continue;
    }
    if (binding.title === M2_TEST_EVENT_TITLE) {
      throw new Error(`m2_event_in_ticket_batch:${result.sourceEventKey}`);
    }

    const sourceState = resolveSourceState(result);
    const existingTicket = findExistingTicket(binding.eventId, context.existingTickets);
    const plannedTicketRow = mapPlannedTicketRow(sourceState, result, existingTicket);
    const ticketResolution = resolveTicketOperation(
      existingTicket,
      plannedTicketRow,
      result,
      sourceState,
    );
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

    plans.push({
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
    });
  }

  return plans;
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
