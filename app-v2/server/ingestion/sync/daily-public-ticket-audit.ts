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
  priority: 'action_needed' | 'routine_verification';
}

const ADMISSION_INFORMATION_ONLY = new Set([
  'free_entry', 'free_until_midnight', 'door_only',
]);
const NON_PURCHASABLE = new Set([
  ...ADMISSION_INFORMATION_ONLY, 'sold_out', 'sales_ended',
  'sale_not_started', 'cancelled', 'availability_unverified',
  'provider_access_unavailable', 'unavailable_unknown', 'registration_only',
]);

const AVAILABLE_STATUSES = new Set(['available', 'on_sale', 'low_availability']);
const ACTION_NEEDED = new Set<TicketAuditConcern>([
  'missing_ticket_record', 'bad_purchase_url', 'unknown_ticket_provider',
  'unqualified_zero_price', 'available_without_link_or_admission_context',
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
  // Explicit zero-euro registration requires a ticket but is not an invalid
  // zero-price claim. Still flag unknown currencies and other sale statuses.
  if (row.priceMinor === 0 &&
    !((status === 'free_entry' || status === 'registration_only') && row.currency === 'EUR')) {
    concerns.push('unqualified_zero_price');
  }
  if (!NON_PURCHASABLE.has(status) && row.priceMinor == null) {
    concerns.push('missing_numeric_price_needs_provider_check');
  }
  if (verifiedPublicTicketUrl && !NON_PURCHASABLE.has(status)) {
    // The URL may lead to a different event, old product tier or presale form.
    concerns.push('ticket_link_requires_source_verification');
  }
  if (AVAILABLE_STATUSES.has(status) && !row.ticketUrl) {
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
      flags.push({
        eventId: row.eventId, title: row.title, startsAt: row.startsAt, concerns,
        priority: concerns.some(concern => ACTION_NEEDED.has(concern))
          ? 'action_needed' : 'routine_verification',
      });
    }
  }
  return {
    upcomingPublishedEvents: rows.length,
    withTicketRecord: rows.filter(row => row.ticketId != null).length,
    flaggedEvents: flags.length,
    // Triage requires no manual SQL: resolve actual data gaps before routine
    // provider re-verification. Never auto-correct prices or URLs from this audit.
    actionNeededCount: flags.filter(flag => flag.priority === 'action_needed').length,
    actionNeeded: flags.filter(flag => flag.priority === 'action_needed'),
    routineVerificationCount: flags.filter(flag => flag.priority === 'routine_verification').length,
    knownFullFree: rows.filter(row => row.salesStatus === 'free_entry').length,
    knownConditionalFree: rows.filter(row => row.salesStatus === 'free_until_midnight').length,
    knownDoorOnly: rows.filter(row => row.salesStatus === 'door_only').length,
    unknownNumericPrice: rows.filter(row => row.ticketId && row.priceMinor == null).length,
    ticketRowsWithoutPurchaseLink: rows.filter(row => row.ticketId && !row.ticketUrl).length,
    countsByConcern: totals,
    flags,
  };
}
