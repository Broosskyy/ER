import {
  canonicalizeN8ManagerTicketUrl,
  canonicalizeTicketIoUrl,
} from '../../official-connectors/ticket-evidence/url-policy';

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

export interface TicketSnapshotFieldDelta {
  ticketId: string;
  eventId: string;
  kind: 'inserted' | 'updated' | 'deleted';
  priceChanged: boolean;
  urlChanged: boolean;
  statusChanged: boolean;
  priceBefore: number | null;
  priceAfter: number | null;
  currencyBefore: string | null;
  currencyAfter: string | null;
  urlBefore: string | null;
  urlAfter: string | null;
  urlBeforeCanonical: string | null;
  urlAfterCanonical: string | null;
  semanticUrlChanged: boolean;
  statusBefore: string | null;
  statusAfter: string | null;
}

export interface TicketSnapshotComparison {
  ticketRowsChanged: number;
  ticketPricesChanged: number;
  ticketUrlsChanged: number;
  ticketStatusesChanged: number;
  semanticUrlDeltas: number;
  inserted: number;
  updated: number;
  deleted: number;
  fieldDeltas: TicketSnapshotFieldDelta[];
}

export function canonicalTicketUrlForSnapshotCompare(url: string | null): string | null {
  if (!url) {
    return null;
  }
  return canonicalizeN8ManagerTicketUrl(url) ?? canonicalizeTicketIoUrl(url) ?? url.trim();
}

function normalizePriceState(
  priceMinor: number | null,
  currency: string | null,
): { priceMinor: number | null; currency: string | null } {
  if (priceMinor == null) {
    return { priceMinor: null, currency: null };
  }
  return { priceMinor, currency: currency ?? 'EUR' };
}

function pricesSemanticallyEqual(
  before: TicketSnapshotRow,
  after: TicketSnapshotRow,
): boolean {
  const left = normalizePriceState(before.price_from_minor, before.currency);
  const right = normalizePriceState(after.price_from_minor, after.currency);
  return left.priceMinor === right.priceMinor && left.currency === right.currency;
}

function eventTicketKey(row: TicketSnapshotRow): string {
  return `${row.event_id}::${row.sort_order}`;
}

function pairRowsByStableIdentity(
  before: TicketSnapshotRow[],
  after: TicketSnapshotRow[],
): {
  matched: Array<{ before: TicketSnapshotRow; after: TicketSnapshotRow }>;
  inserted: TicketSnapshotRow[];
  deleted: TicketSnapshotRow[];
} {
  const beforeById = new Map(before.map((row) => [row.id, row]));
  const afterById = new Map(after.map((row) => [row.id, row]));
  const beforeByEventKey = new Map(before.map((row) => [eventTicketKey(row), row]));
  const afterByEventKey = new Map(after.map((row) => [eventTicketKey(row), row]));

  const matched: Array<{ before: TicketSnapshotRow; after: TicketSnapshotRow }> = [];
  const inserted: TicketSnapshotRow[] = [];
  const deleted: TicketSnapshotRow[] = [];
  const usedBeforeIds = new Set<string>();
  const usedAfterIds = new Set<string>();

  for (const afterRow of after) {
    const sameId = beforeById.get(afterRow.id);
    if (sameId) {
      matched.push({ before: sameId, after: afterRow });
      usedBeforeIds.add(sameId.id);
      usedAfterIds.add(afterRow.id);
      continue;
    }

    const sameEventSlot = beforeByEventKey.get(eventTicketKey(afterRow));
    if (sameEventSlot && !usedBeforeIds.has(sameEventSlot.id)) {
      matched.push({ before: sameEventSlot, after: afterRow });
      usedBeforeIds.add(sameEventSlot.id);
      usedAfterIds.add(afterRow.id);
      continue;
    }

    inserted.push(afterRow);
  }

  for (const beforeRow of before) {
    if (!usedBeforeIds.has(beforeRow.id) && !afterById.has(beforeRow.id)) {
      const replaced = afterByEventKey.get(eventTicketKey(beforeRow));
      if (!replaced || usedAfterIds.has(replaced.id)) {
        deleted.push(beforeRow);
      }
    }
  }

  return { matched, inserted, deleted };
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

export function filterTicketRowsByEventIds(
  rows: TicketSnapshotRow[],
  eventIds: ReadonlySet<string>,
): TicketSnapshotRow[] {
  return rows.filter((row) => eventIds.has(row.event_id));
}

export function compareTicketSnapshotsDetailed(
  before: TicketSnapshotRow[],
  after: TicketSnapshotRow[],
): TicketSnapshotComparison {
  const { matched, inserted, deleted } = pairRowsByStableIdentity(before, after);
  const fieldDeltas: TicketSnapshotFieldDelta[] = [];
  let ticketPricesChanged = 0;
  let ticketUrlsChanged = 0;
  let ticketStatusesChanged = 0;
  let semanticUrlDeltas = 0;
  let updated = 0;

  for (const { before: previous, after: row } of matched) {
    const priceChanged = !pricesSemanticallyEqual(previous, row);
    const urlBeforeCanonical = canonicalTicketUrlForSnapshotCompare(previous.ticket_url);
    const urlAfterCanonical = canonicalTicketUrlForSnapshotCompare(row.ticket_url);
    const semanticUrlChanged = urlBeforeCanonical !== urlAfterCanonical;
    const urlChanged = semanticUrlChanged;
    const statusChanged = (previous.sales_status ?? '') !== (row.sales_status ?? '');
    const rowUpdated = priceChanged || urlChanged || statusChanged || previous.provider !== row.provider;

    if (rowUpdated) {
      updated += 1;
      fieldDeltas.push({
        ticketId: row.id,
        eventId: row.event_id,
        kind: 'updated',
        priceChanged,
        urlChanged,
        statusChanged,
        priceBefore: previous.price_from_minor,
        priceAfter: row.price_from_minor,
        currencyBefore: previous.currency,
        currencyAfter: row.currency,
        urlBefore: previous.ticket_url,
        urlAfter: row.ticket_url,
        urlBeforeCanonical,
        urlAfterCanonical,
        semanticUrlChanged,
        statusBefore: previous.sales_status,
        statusAfter: row.sales_status,
      });
    }

    if (priceChanged) {
      ticketPricesChanged += 1;
    }
    if (urlChanged) {
      ticketUrlsChanged += 1;
    }
    if (semanticUrlChanged) {
      semanticUrlDeltas += 1;
    }
    if (statusChanged) {
      ticketStatusesChanged += 1;
    }
  }

  for (const row of inserted) {
    const urlAfterCanonical = canonicalTicketUrlForSnapshotCompare(row.ticket_url);
    const priceChanged = row.price_from_minor != null;
    const urlChanged = row.ticket_url != null;
    const statusChanged = row.sales_status != null;
    fieldDeltas.push({
      ticketId: row.id,
      eventId: row.event_id,
      kind: 'inserted',
      priceChanged,
      urlChanged,
      statusChanged,
      priceBefore: null,
      priceAfter: row.price_from_minor,
      currencyBefore: null,
      currencyAfter: row.currency,
      urlBefore: null,
      urlAfter: row.ticket_url,
      urlBeforeCanonical: null,
      urlAfterCanonical,
      semanticUrlChanged: row.ticket_url != null,
      statusBefore: null,
      statusAfter: row.sales_status,
    });
    if (priceChanged) {
      ticketPricesChanged += 1;
    }
    if (urlChanged) {
      ticketUrlsChanged += 1;
      semanticUrlDeltas += 1;
    }
    if (statusChanged) {
      ticketStatusesChanged += 1;
    }
  }

  for (const row of deleted) {
    fieldDeltas.push({
      ticketId: row.id,
      eventId: row.event_id,
      kind: 'deleted',
      priceChanged: row.price_from_minor != null,
      urlChanged: row.ticket_url != null,
      statusChanged: row.sales_status != null,
      priceBefore: row.price_from_minor,
      priceAfter: null,
      currencyBefore: row.currency,
      currencyAfter: null,
      urlBefore: row.ticket_url,
      urlAfter: null,
      urlBeforeCanonical: canonicalTicketUrlForSnapshotCompare(row.ticket_url),
      urlAfterCanonical: null,
      semanticUrlChanged: row.ticket_url != null,
      statusBefore: row.sales_status,
      statusAfter: null,
    });
    if (row.price_from_minor != null) {
      ticketPricesChanged += 1;
    }
    if (row.ticket_url != null) {
      ticketUrlsChanged += 1;
      semanticUrlDeltas += 1;
    }
    if (row.sales_status != null) {
      ticketStatusesChanged += 1;
    }
  }

  return {
    ticketRowsChanged: inserted.length + deleted.length + updated,
    ticketPricesChanged,
    ticketUrlsChanged,
    ticketStatusesChanged,
    semanticUrlDeltas,
    inserted: inserted.length,
    updated,
    deleted: deleted.length,
    fieldDeltas,
  };
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
  const detailed = compareTicketSnapshotsDetailed(before, after);
  return {
    ticketRowsChanged: detailed.ticketRowsChanged,
    ticketPricesChanged: detailed.ticketPricesChanged,
    ticketUrlsChanged: detailed.ticketUrlsChanged,
    ticketStatusesChanged: detailed.ticketStatusesChanged,
  };
}
