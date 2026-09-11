import type { LinkedQueryExecutor } from '../../../ingestion/sync/linked-db';
import { loadJsonAgg } from '../../../ingestion/sync/linked-db';
import { canonicalizeOfficialSourceUrl } from '../../../ingestion/identity/source-identity';
import type { EventSummary } from '../../../../src/features/events/types/event-core';
import {
  buildConsumerDuplicateGroups,
  getDiscoverablePublishedEvents,
} from '../../../../src/features/events/discovery/consumer-discovery-feed';
import { classifyConsumerEventLifecycle } from '../../../../shared/consumer-event-lifecycle';
import type { EventRow, GenreRow, LineupRow, TicketRow, VenueRow } from '../../../../src/data/repositories/event-core-read';
import { mapEventDetail } from '../../../../src/data/mappers/event-core-mapper';
import { toEventDisplayModelFromDetail } from '../../../../src/data/mappers/event-core-display';

export interface DbEventReadbackRow {
  eventId: string;
  sourceEventKey: string;
  title: string;
  startsAt: string;
  endsAt: string | null;
  status: string;
  venueName: string | null;
  city: string | null;
  description: string | null;
  imageUrl: string | null;
  lineup: string[];
  genres: string[];
  officialUrl: string;
  tickets: Array<{
    provider: string | null;
    priceMinor: number | null;
    currency: string | null;
    salesStatus: string | null;
    ticketUrl: string | null;
  }>;
}

export function loadDbReadbackForSourceKeys(
  runQuery: LinkedQueryExecutor,
  sourceEventKeys: string[],
): DbEventReadbackRow[] {
  if (sourceEventKeys.length === 0) {
    return [];
  }
  const literals = sourceEventKeys.map((key) => `'${key.replace(/'/g, "''")}'`).join(', ');
  return loadJsonAgg<DbEventReadbackRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'sourceEventKey', s.raw_payload->>'sourceEventKey',
        'title', e.title,
        'startsAt', e.starts_at,
        'endsAt', e.ends_at,
        'status', e.status,
        'venueName', v.name,
        'city', v.city,
        'description', e.description,
        'imageUrl', e.image_url,
        'lineup', (
          SELECT COALESCE(jsonb_agg(l.billing_name ORDER BY l.sort_order), '[]'::jsonb)
          FROM public.event_lineup l WHERE l.event_id = e.id
        ),
        'genres', (
          SELECT COALESCE(jsonb_agg(g.display_name ORDER BY g.sort_order), '[]'::jsonb)
          FROM public.event_genres g WHERE g.event_id = e.id
        ),
        'officialUrl', s.source_url,
        'tickets', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'provider', t.provider,
              'priceMinor', t.price_from_minor,
              'currency', t.currency,
              'salesStatus', t.sales_status,
              'ticketUrl', t.ticket_url
            ) ORDER BY t.sort_order
          ), '[]'::jsonb)
          FROM public.event_tickets t WHERE t.event_id = e.id
        )
      )
    ) AS rows
    FROM public.event_sources s
    JOIN public.events e ON e.id = s.event_id
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE s.source_role = 'official'
      AND s.raw_payload->>'sourceEventKey' IN (${literals});
  `,
  );
}

export function loadPublishedEventSummaries(runQuery: LinkedQueryExecutor): EventSummary[] {
  const publishedRows = loadJsonAgg<{
    id: string;
    title: string;
    starts_at: string;
    ends_at: string | null;
    timezone: string | null;
    image_url: string | null;
    official_url: string | null;
    organizer_name: string | null;
    venue_id: string | null;
    venue_name: string | null;
    venue_city: string | null;
    ticket_url: string | null;
    price_from_minor: number | null;
    currency: string | null;
    sales_status: string | null;
  }>(
    runQuery,
    `SELECT jsonb_agg(row_to_json(t) ORDER BY t.starts_at, t.title) AS rows FROM (
      SELECT e.id, e.title, e.starts_at, e.ends_at, e.timezone, e.image_url, e.official_url, e.organizer_name,
        v.id AS venue_id, v.name AS venue_name, v.city AS venue_city,
        t.ticket_url, t.price_from_minor, t.currency, t.sales_status
      FROM events e
      LEFT JOIN venues v ON v.id = e.venue_id
      LEFT JOIN event_tickets t ON t.event_id = e.id AND t.sort_order = 0
      WHERE e.status = 'published'
    ) t;`,
  );

  return publishedRows.map((row) => ({
    id: row.id,
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timezone: row.timezone,
    imageUrl: row.image_url,
    officialUrl: row.official_url,
    organizerName: row.organizer_name,
    venue: row.venue_id
      ? {
          id: row.venue_id,
          name: row.venue_name ?? '',
          addressLine: null,
          postalCode: null,
          city: row.venue_city,
          countryCode: null,
          latitude: null,
          longitude: null,
          officialUrl: null,
        }
      : null,
    genres: [],
    primaryTicket: row.ticket_url
      ? {
          id: `${row.id}-ticket`,
          provider: 'ticket_io',
          ticketUrl: row.ticket_url,
          priceFromMinor: row.price_from_minor,
          currency: row.currency,
          salesStatus: row.sales_status,
          sortOrder: 0,
        }
      : null,
  }));
}

export function buildConsumerReadback(runQuery: LinkedQueryExecutor, referenceInstant: Date) {
  const publishedSummaries = loadPublishedEventSummaries(runQuery);
  const feed = getDiscoverablePublishedEvents(publishedSummaries, { referenceInstant });
  const duplicateGroups = buildConsumerDuplicateGroups(feed.events);
  return {
    events: feed.events.map((event) => ({
      id: event.id,
      title: event.title,
      startsAt: event.startsAt,
      venueName: event.venue?.name,
      city: event.venue?.city,
      imageUrl: event.imageUrl,
      ticketPriceMinor: event.primaryTicket?.priceFromMinor,
      ticketCurrency: event.primaryTicket?.currency,
      ticketStatus: event.primaryTicket?.salesStatus,
      ticketUrl: event.primaryTicket?.ticketUrl,
      lifecycle: classifyConsumerEventLifecycle({
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        status: 'published',
        referenceInstant,
      }),
    })),
    duplicateGroups,
    eligibleCount: feed.events.length,
  };
}

export const GOLDEN_CASE_PATTERNS = [
  /underland/i,
  /14\s*jahre.*affen/i,
  /zaagstep/i,
  /unreal weekender night i/i,
  /kitkat/i,
  /chris stussy/i,
  /bootshaus.*(?:new years|nye)/i,
  /nibirii/i,
  /ely oaks/i,
];

export function auditGoldenRegression(
  runQuery: LinkedQueryExecutor,
  referenceInstant: Date,
): Array<{ pattern: string; eventId: string; title: string; issues: string[] }> {
  const events = loadJsonAgg<{
    eventId: string;
    title: string;
    status: string;
    startsAt: string;
    imageUrl: string | null;
    ticketPrice: number | null;
    ticketUrl: string | null;
  }>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'title', e.title,
        'status', e.status,
        'startsAt', e.starts_at,
        'imageUrl', e.image_url,
        'ticketPrice', (
          SELECT t.price_from_minor FROM public.event_tickets t
          WHERE t.event_id = e.id ORDER BY t.sort_order LIMIT 1
        ),
        'ticketUrl', (
          SELECT t.ticket_url FROM public.event_tickets t
          WHERE t.event_id = e.id ORDER BY t.sort_order LIMIT 1
        )
      )
    ) AS rows
    FROM public.events e
    WHERE e.status = 'published';
  `,
  );

  const consumer = buildConsumerReadback(runQuery, referenceInstant);
  const results: Array<{ pattern: string; eventId: string; title: string; issues: string[] }> = [];

  for (const pattern of GOLDEN_CASE_PATTERNS) {
    const dbMatch = events.find((event) => pattern.test(event.title));
    if (!dbMatch) {
      results.push({ pattern: pattern.source, eventId: '', title: '', issues: ['missing_from_db'] });
      continue;
    }
    const issues: string[] = [];
    const consumerMatch = consumer.events.find((event) => event.id === dbMatch.eventId);
    const lifecycleEnded =
      classifyConsumerEventLifecycle({
        startsAt: dbMatch.startsAt,
        endsAt: null,
        status: 'published',
        referenceInstant,
      }) === 'ENDED';
    if (!consumerMatch) {
      if (!lifecycleEnded) {
        issues.push('missing_from_consumer_feed');
      }
    } else if (consumerMatch.lifecycle === 'ENDED' && !lifecycleEnded) {
      issues.push('unexpected_past_lifecycle');
    }
    if (dbMatch.status !== 'published') {
      issues.push(`status_${dbMatch.status}`);
    }
    results.push({
      pattern: pattern.source,
      eventId: dbMatch.eventId,
      title: dbMatch.title,
      issues,
    });
  }

  return results;
}

export function findConsumerEventBySourceKey(
  runQuery: LinkedQueryExecutor,
  sourceEventKey: string,
  referenceInstant: Date,
) {
  const rows = loadDbReadbackForSourceKeys(runQuery, [sourceEventKey]);
  const row = rows[0];
  if (!row) {
    return undefined;
  }

  const events = loadJsonAgg<EventRow>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(e)) AS rows FROM public.events e WHERE e.id = '${row.eventId}'::uuid;`,
  );
  const event = events[0];
  if (!event) {
    return undefined;
  }

  const venues = loadJsonAgg<VenueRow>(runQuery, `SELECT jsonb_agg(to_jsonb(v)) AS rows FROM public.venues v;`);
  const venue = venues.find((entry) => entry.id === event.venue_id) ?? null;
  const lineup = loadJsonAgg<LineupRow>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(l)) AS rows FROM public.event_lineup l WHERE l.event_id = '${row.eventId}'::uuid;`,
  );
  const genres = loadJsonAgg<GenreRow>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(g)) AS rows FROM public.event_genres g WHERE g.event_id = '${row.eventId}'::uuid;`,
  );
  const tickets = loadJsonAgg<TicketRow>(
    runQuery,
    `SELECT jsonb_agg(to_jsonb(t)) AS rows FROM public.event_tickets t WHERE t.event_id = '${row.eventId}'::uuid;`,
  );

  const detail = mapEventDetail(event, venue, lineup, genres, tickets);
  const display = toEventDisplayModelFromDetail(detail);
  const feed = getDiscoverablePublishedEvents(loadPublishedEventSummaries(runQuery), { referenceInstant });
  const summary = feed.events.find((entry) => entry.id === row.eventId);

  return { db: row, detail, display, summary };
}

export function canonicalOfficialUrl(url: string): string {
  return canonicalizeOfficialSourceUrl(url);
}
