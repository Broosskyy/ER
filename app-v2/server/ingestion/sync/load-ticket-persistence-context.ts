import type { TicketPersistencePlannerContext } from '../../official-connectors/ticket-evidence/ticket-persistence-planner';
import type { LinkedQueryExecutor } from './linked-db';
import { loadJsonAgg } from './linked-db';

interface OfficialBindingRow {
  eventId: string;
  sourceId: string;
  officialUrl: string;
  contentHash: string | null;
  rawPayload: Record<string, unknown> | null;
  title: string;
}

interface TicketRow {
  ticketId: string;
  eventId: string;
  provider: string | null;
  ticketUrl: string | null;
  priceFromMinor: number | null;
  currency: string | null;
  salesStatus: string | null;
  sortOrder: number;
}

interface TicketSourceRow {
  sourceId: string;
  eventId: string;
  sourceUrl: string | null;
  contentHash: string | null;
  rawPayload: Record<string, unknown> | null;
}

export function loadTicketPersistenceContextFromLinkedDb(
  runQuery: LinkedQueryExecutor,
): TicketPersistencePlannerContext {
  const officialBindings = loadJsonAgg<OfficialBindingRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'sourceId', s.id,
        'officialUrl', s.source_url,
        'contentHash', s.content_hash,
        'rawPayload', s.raw_payload,
        'title', e.title
      )
      ORDER BY s.source_url
    ) AS rows
    FROM public.event_sources s
    INNER JOIN public.events e ON e.id = s.event_id
    WHERE s.source_role = 'official';
  `,
  ).map((row) => ({
    eventId: row.eventId,
    sourceId: row.sourceId,
    officialUrl: row.officialUrl,
    contentHash: row.contentHash,
    rawPayload: row.rawPayload,
    title: row.title,
  }));

  const existingTickets = loadJsonAgg<TicketRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'ticketId', t.id,
        'eventId', t.event_id,
        'provider', t.provider,
        'ticketUrl', t.ticket_url,
        'priceFromMinor', t.price_from_minor,
        'currency', t.currency,
        'salesStatus', t.sales_status,
        'sortOrder', t.sort_order
      )
      ORDER BY t.id
    ) AS rows
    FROM public.event_tickets t;
  `,
  ).map((row) => ({
    ticketId: row.ticketId,
    eventId: row.eventId,
    provider: row.provider,
    ticketUrl: row.ticketUrl,
    priceFromMinor: row.priceFromMinor,
    currency: row.currency,
    salesStatus: row.salesStatus,
    sortOrder: row.sortOrder,
  }));

  const existingTicketSources = loadJsonAgg<TicketSourceRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'sourceId', s.id,
        'eventId', s.event_id,
        'sourceUrl', s.source_url,
        'contentHash', s.content_hash,
        'rawPayload', s.raw_payload
      )
      ORDER BY s.source_url
    ) AS rows
    FROM public.event_sources s
    WHERE s.source_role = 'ticket';
  `,
  ).map((row) => ({
    sourceId: row.sourceId,
    eventId: row.eventId,
    sourceUrl: row.sourceUrl,
    contentHash: row.contentHash,
    rawPayload: row.rawPayload,
  }));

  return {
    officialBindings,
    existingTickets,
    existingTicketSources,
  };
}
