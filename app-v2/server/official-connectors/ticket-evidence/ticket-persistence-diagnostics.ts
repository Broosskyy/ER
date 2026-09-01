import type { EventCandidateTicket } from '../../ingestion/types/event-candidate';
import type {
  EventTicketPersistencePlan,
  ExistingEventTicketRecord,
} from './ticket-persistence-types';
import { canonicalTicketUrlForSnapshotCompare } from '../../ingestion/sync/ticket-snapshot';

export type TicketDivergenceClassification =
  | 'REAL_UNPERSISTED_CHANGE'
  | 'NORMALIZATION_ONLY_DIFFERENCE'
  | 'NON_CANONICAL_ALTERNATE_URL'
  | 'STALE_SNAPSHOT_COMPARISON'
  | 'WRITE_PLAN_SUPPRESSED'
  | 'CONFLICT_SKIPPED'
  | 'FINGERPRINT_FALSE_NOOP'
  | 'EXECUTOR_NOOP_BUG'
  | 'TRANSACTION_ROLLBACK'
  | 'READBACK_COMPARISON_BUG'
  | 'ALIGNED';

export interface TicketPersistenceDiagnosticRow {
  eventId: string;
  eventTitle: string;
  sourceEventKey: string;
  officialUrl: string;
  existingRow: ExistingEventTicketRecord | null;
  plannedRow: EventCandidateTicket | null;
  changedFields: string[];
  ticketOperation: EventTicketPersistencePlan['ticketOperation'];
  ticketOperationReason: string;
  providerSourceOperation: EventTicketPersistencePlan['providerSourceOperation'];
  providerSourceReason: string;
  resolutionClass: string;
  ticketSourceState: string;
  evidenceSummary: string;
  classification: TicketDivergenceClassification;
  writeAttempted: boolean;
  writeApplied: boolean;
  skipReason: string | null;
  conflictReason: string | null;
  liveProvider: {
    canonicalTicketUrl?: string;
    priceFromMinor?: number | null;
    currency?: string | null;
    salesStatus?: string | null;
    actionKind?: string;
    resolutionClass?: string;
  };
}

function listChangedFields(
  existing: ExistingEventTicketRecord | null,
  planned: EventCandidateTicket | null,
): string[] {
  if (!existing || !planned) {
    return existing || planned ? ['row_presence'] : [];
  }
  const fields: string[] = [];
  if ((existing.provider ?? '') !== (planned.provider ?? '')) {
    fields.push('provider');
  }
  if ((existing.ticketUrl ?? '') !== (planned.ticketUrl ?? '')) {
    fields.push('ticketUrl');
  }
  if (
    canonicalTicketUrlForSnapshotCompare(existing.ticketUrl) !==
    canonicalTicketUrlForSnapshotCompare(planned.ticketUrl ?? null)
  ) {
    fields.push('ticketUrlCanonical');
  }
  if (existing.priceFromMinor !== (planned.priceFromMinor ?? null)) {
    fields.push('priceFromMinor');
  }
  if ((existing.currency ?? '') !== (planned.currency ?? '')) {
    fields.push('currency');
  }
  if ((existing.salesStatus ?? '') !== (planned.salesStatus ?? '')) {
    fields.push('salesStatus');
  }
  return fields;
}

function classifyDiagnostic(input: {
  changedFields: string[];
  ticketOperation: EventTicketPersistencePlan['ticketOperation'];
  ticketOperationReason: string;
  providerSourceReason: string;
  existing: ExistingEventTicketRecord | null;
  planned: EventCandidateTicket | null;
}): { classification: TicketDivergenceClassification; skipReason: string | null; conflictReason: string | null } {
  const { changedFields, ticketOperation, ticketOperationReason, providerSourceReason, existing, planned } = input;

  if (!existing && !planned) {
    return { classification: 'ALIGNED', skipReason: null, conflictReason: null };
  }
  if (!existing && planned && ticketOperation === 'insert') {
    return { classification: 'REAL_UNPERSISTED_CHANGE', skipReason: null, conflictReason: null };
  }
  if (existing && !planned && ticketOperation === 'delete') {
    return { classification: 'REAL_UNPERSISTED_CHANGE', skipReason: null, conflictReason: null };
  }

  if (changedFields.length === 0) {
    return { classification: 'ALIGNED', skipReason: null, conflictReason: null };
  }

  const onlyCanonicalUrlDiff =
    changedFields.length === 1 && changedFields[0] === 'ticketUrlCanonical' && !changedFields.includes('ticketUrl');
  if (onlyCanonicalUrlDiff) {
    return { classification: 'NORMALIZATION_ONLY_DIFFERENCE', skipReason: ticketOperationReason, conflictReason: null };
  }

  if (ticketOperation === 'update' || ticketOperation === 'insert' || ticketOperation === 'delete') {
    return { classification: 'REAL_UNPERSISTED_CHANGE', skipReason: null, conflictReason: null };
  }

  if (providerSourceReason === 'provider_source_url_bound_to_other_event') {
    return {
      classification: 'CONFLICT_SKIPPED',
      skipReason: ticketOperationReason,
      conflictReason: providerSourceReason,
    };
  }

  if (ticketOperationReason === 'ticket_row_already_matches') {
    return { classification: 'FINGERPRINT_FALSE_NOOP', skipReason: ticketOperationReason, conflictReason: null };
  }

  if (
    ticketOperationReason === 'preserve_existing_ticket_on_transient_failure' ||
    ticketOperationReason === 'preserve_existing_ticket_fail_closed' ||
    ticketOperationReason === 'no_ticket_row_required'
  ) {
    return { classification: 'WRITE_PLAN_SUPPRESSED', skipReason: ticketOperationReason, conflictReason: null };
  }

  if (ticketOperation === 'noop' && changedFields.length > 0) {
    return { classification: 'WRITE_PLAN_SUPPRESSED', skipReason: ticketOperationReason, conflictReason: null };
  }

  return { classification: 'REAL_UNPERSISTED_CHANGE', skipReason: ticketOperationReason, conflictReason: null };
}

export function buildTicketPersistenceDiagnostics(
  plans: EventTicketPersistencePlan[],
  existingTickets: ExistingEventTicketRecord[],
): TicketPersistenceDiagnosticRow[] {
  const existingByEventId = new Map(existingTickets.map((row) => [row.eventId, row]));

  return plans.map((plan) => {
    const existing = existingByEventId.get(plan.eventId) ?? null;
    const planned = plan.plannedTicketRow ?? null;
    const changedFields = listChangedFields(existing, planned);
    const { classification, skipReason, conflictReason } = classifyDiagnostic({
      changedFields,
      ticketOperation: plan.ticketOperation,
      ticketOperationReason: plan.ticketOperationReason,
      providerSourceReason: plan.providerSourceReason,
      existing,
      planned,
    });

    const writeAttempted = plan.ticketOperation !== 'noop';
    const writeApplied = writeAttempted && classification === 'REAL_UNPERSISTED_CHANGE';

    return {
      eventId: plan.eventId,
      eventTitle: plan.eventTitle,
      sourceEventKey: plan.sourceEventKey,
      officialUrl: plan.officialUrl,
      existingRow: existing,
      plannedRow: planned,
      changedFields,
      ticketOperation: plan.ticketOperation,
      ticketOperationReason: plan.ticketOperationReason,
      providerSourceOperation: plan.providerSourceOperation,
      providerSourceReason: plan.providerSourceReason,
      resolutionClass: plan.resolutionClass,
      ticketSourceState: plan.ticketSourceState,
      evidenceSummary: plan.evidenceSummary,
      classification,
      writeAttempted,
      writeApplied,
      skipReason,
      conflictReason,
      liveProvider: {
        canonicalTicketUrl: plan.consumerProjection.canonicalTicketUrl,
        salesStatus: planned?.salesStatus,
        actionKind: plan.consumerProjection.actionKind,
        resolutionClass: plan.resolutionClass,
      },
    };
  });
}
