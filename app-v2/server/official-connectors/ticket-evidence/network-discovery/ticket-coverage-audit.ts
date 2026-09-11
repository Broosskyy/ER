import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { loadStagingEventSnapshots } from '../../../ingestion/sync/canonical-consolidation';

export type TicketTargetClassification =
  | 'TICKET_TARGET_VERIFIED'
  | 'TICKET_TARGET_INVALID'
  | 'TICKET_TARGET_GENERIC'
  | 'TICKET_TARGET_MISSING'
  | 'NO_TICKET_EXPECTED'
  | 'SOLD_OUT'
  | 'REGISTRATION_ONLY'
  | 'DOOR_ONLY'
  | 'UNKNOWN';

export interface TicketCoverageEntry {
  eventId: string;
  title: string;
  ticketUrl: string | null;
  priceMinor: number | null;
  currency: string | null;
  salesStatus: string | null;
  classification: TicketTargetClassification;
  reason?: string;
}

function isGenericTicketUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) {
    return false;
  }
  const normalized = url.trim().toLowerCase();
  return (
    /ticket\.io\/?$/i.test(normalized) ||
    /\/shop\/?$/i.test(normalized) ||
    /\/events\/?$/i.test(normalized) ||
    /\/tickets\/?$/i.test(normalized)
  );
}

function classifyTicketEntry(
  ticketUrl: string | null,
  salesStatus: string | null,
  hasOfficialBinding: boolean,
): TicketTargetClassification {
  if (!ticketUrl) {
    return hasOfficialBinding ? 'TICKET_TARGET_MISSING' : 'NO_TICKET_EXPECTED';
  }
  if (/registration|anmeldung|register/i.test(ticketUrl)) {
    return 'REGISTRATION_ONLY';
  }
  if (salesStatus === 'sold_out' || /sold.?out|ausverkauft/i.test(salesStatus ?? '')) {
    return 'SOLD_OUT';
  }
  if (/ticket\.io\/[A-Za-z0-9]{4,}/i.test(ticketUrl) || /arep\.co\//i.test(ticketUrl)) {
    return 'TICKET_TARGET_VERIFIED';
  }
  if (/ticketkings|eventim|reservix|rausgegangen|n8manager/i.test(ticketUrl)) {
    return 'TICKET_TARGET_VERIFIED';
  }
  if (isGenericTicketUrl(ticketUrl)) {
    return 'TICKET_TARGET_GENERIC';
  }
  if (/bootshaus\.tv\/events\//i.test(ticketUrl)) {
    return 'TICKET_TARGET_VERIFIED';
  }
  return 'UNKNOWN';
}

export function auditTicketCoverage(runQuery: LinkedQueryExecutor): TicketCoverageEntry[] {
  const events = loadStagingEventSnapshots(runQuery).filter((event) => event.status === 'published');
  return events.map((event) => {
    const primary = event.tickets.find((ticket) => ticket.sortOrder === 0) ?? event.tickets[0];
    const hasOfficialBinding = event.sources.some((source) => source.sourceRole === 'official');
    const classification = classifyTicketEntry(
      primary?.ticketUrl ?? event.officialUrl,
      primary?.salesStatus ?? null,
      hasOfficialBinding,
    );
    return {
      eventId: event.eventId,
      title: event.title,
      ticketUrl: primary?.ticketUrl ?? event.officialUrl,
      priceMinor: primary?.priceMinor ?? null,
      currency: primary?.currency ?? null,
      salesStatus: primary?.salesStatus ?? null,
      classification,
      reason:
        classification === 'TICKET_TARGET_GENERIC'
          ? 'generic_shop_or_landing_url'
          : classification === 'TICKET_TARGET_MISSING'
            ? 'official_binding_without_event_specific_ticket'
            : undefined,
    };
  });
}
