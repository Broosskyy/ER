export interface TicketSnapshotRow {
  id: string;
  event_id: string;
  provider: string | null;
  ticket_url: string | null;
  price_from_minor: number | null;
  currency: string | null;
  sales_status: string | null;
  sort_order: number;
}

export function normalizeTicketRows(rows: Array<Record<string, unknown>>): TicketSnapshotRow[] {
  return rows.map((row) => ({
    id: String(row.id),
    event_id: String(row.event_id),
    provider: row.provider == null ? null : String(row.provider),
    ticket_url: row.ticket_url == null ? null : String(row.ticket_url),
    price_from_minor: row.price_from_minor == null ? null : Number(row.price_from_minor),
    currency: row.currency == null ? null : String(row.currency),
    sales_status: row.sales_status == null ? null : String(row.sales_status),
    sort_order: Number(row.sort_order ?? 0),
  }));
}

export function compareTicketSnapshots(
  before: TicketSnapshotRow[],
  after: TicketSnapshotRow[],
): {
  ticketRowsChanged: number;
  ticketPricesChanged: number;
  ticketUrlsChanged: number;
  ticketStatusesChanged: number;
} {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  let ticketPricesChanged = 0;
  let ticketUrlsChanged = 0;
  let ticketStatusesChanged = 0;

  if (before.length !== after.length) {
    return {
      ticketRowsChanged: Math.abs(before.length - after.length),
      ticketPricesChanged: before.length === after.length ? 0 : before.length,
      ticketUrlsChanged: before.length === after.length ? 0 : before.length,
      ticketStatusesChanged: before.length === after.length ? 0 : before.length,
    };
  }

  for (const row of after) {
    const previous = beforeById.get(row.id);
    if (!previous) {
      return {
        ticketRowsChanged: 1,
        ticketPricesChanged: 1,
        ticketUrlsChanged: 1,
        ticketStatusesChanged: 1,
      };
    }
    if (previous.price_from_minor !== row.price_from_minor || previous.currency !== row.currency) {
      ticketPricesChanged += 1;
    }
    if (previous.ticket_url !== row.ticket_url) {
      ticketUrlsChanged += 1;
    }
    if (previous.sales_status !== row.sales_status) {
      ticketStatusesChanged += 1;
    }
  }

  return {
    ticketRowsChanged: 0,
    ticketPricesChanged,
    ticketUrlsChanged,
    ticketStatusesChanged,
  };
}
