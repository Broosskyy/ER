export interface PublicTicketAuditRow {
  eventId: string;
  title: string;
  startsAt: string;
  ticketId: string | null;
  provider: string | null;
  priceMinor: number | null;
  currency: string | null;
  ticketUrl: string | null;
  salesStatus: string | null;
}

export type TicketAuditConcern =
  | 'missing_ticket_record'
  | 'missing_numeric_price_needs_provider_check'
  | 'ticket_link_requires_source_verification'
  | 'bad_purchase_url'
  | 'unknown_ticket_provider'
  | 'unqualified_zero_price'
  | 'available_without_link_or_admission_context';

export interface TicketAuditFlag {
  eventId: string;
  title: string;
  startsAt: string;
  concerns: TicketAuditConcern[];
}

const ADMISSION_INFORMATION_ONLY = new Set([
  'free_entry', 'free_until_midnight', 'door_only',
]);
const NON_PURCHASABLE = new Set([
  ...ADMISSION_INFORMATION_ONLY, 'sold_out', 'sales_ended',
  'sale_not_started', 'cancelled', 'availability_unverified',
  'provider_access_unavailable', 'unavailable_unknown', 'registration_only',
]);

export function reviewPublicTicket(row: PublicTicketAuditRow): TicketAuditConcern[] {
  if (!row.ticketId) return ['missing_ticket_record'];
  const concerns: TicketAuditConcern[] = [];
  const status = row.salesStatus ?? '';
  const verifiedPublicTicketUrl = row.ticketUrl?.startsWith('https://') ?? false;
  if (row.ticketUrl && !verifiedPublicTicketUrl) {
    concerns.push('bad_purchase_url');
  }
  if (!row.provider || row.provider.toLowerCase() === 'unknown') {
    concerns.push('unknown_ticket_provider');
  }
  if (row.priceMinor === 0 && status !== 'free_entry') {
    concerns.push('unqualified_zero_price');
  }
  if (!NON_PURCHASABLE.has(status) && row.priceMinor == null) {
    concerns.push('missing_numeric_price_needs_provider_check');
  }
  if (verifiedPublicTicketUrl && !NON_PURCHASABLE.has(status)) {
    // The URL may lead to a different event, old product tier or presale form.
    concerns.push('ticket_link_requires_source_verification');
  }
  if (status === 'available' && !row.ticketUrl && !ADMISSION_INFORMATION_ONLY.has(status)) {
    concerns.push('available_without_link_or_admission_context');
  }
  return concerns;
}

/** Diagnostics, not proof of provider-current prices or a DB write instruction. */
export function auditPublicTickets(rows: PublicTicketAuditRow[]) {
  const flags: TicketAuditFlag[] = [];
  const totals: Record<string, number> = {};
  for (const row of rows) {
    const concerns = reviewPublicTicket(row);
    for (const concern of concerns) totals[concern] = (totals[concern] ?? 0) + 1;
    if (concerns.length) {
      flags.push({ eventId: row.eventId, title: row.title, startsAt: row.startsAt, concerns });
    }
  }
  return {
    upcomingPublishedEvents: rows.length,
    withTicketRecord: rows.filter(row => row.ticketId != null).length,
    flaggedEvents: flags.length,
    knownFullFree: rows.filter(row => row.salesStatus === 'free_entry').length,
    knownConditionalFree: rows.filter(row => row.salesStatus === 'free_until_midnight').length,
    knownDoorOnly: rows.filter(row => row.salesStatus === 'door_only').length,
    unknownNumericPrice: rows.filter(row => row.ticketId && row.priceMinor == null).length,
    ticketRowsWithoutPurchaseLink: rows.filter(row => row.ticketId && !row.ticketUrl).length,
    countsByConcern: totals,
    flags,
  };
}
