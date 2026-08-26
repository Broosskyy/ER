import type { EventMatchCatalogEntry } from '../identity/event-match-types';
import type { PlannerContext } from '../planning/event-write-planner';
import type { ExistingEventConsumerState } from '../reconciliation/reconciliation-policy';
import type {
  ExistingOfficialSourceRecord,
  ExistingVenueRecord,
} from '../types/event-candidate';
import type { LinkedQueryExecutor } from './linked-db';
import { loadJsonAgg } from './linked-db';

interface SourceRow {
  sourceId: string;
  eventId: string;
  sourceUrl: string;
  contentHash: string | null;
  sourceRole: string;
  sourceEventKey?: string;
  connectorId?: string;
}

interface VenueRow {
  id: string;
  name: string;
  city: string | null;
  postalCode: string | null;
}

interface EventRow {
  eventId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  timezone: string;
  organizerName: string | null;
  imageUrl: string | null;
  venueId: string | null;
  status: string;
  venueName: string | null;
  venueCity: string | null;
  venuePostalCode: string | null;
}

interface LineupRow {
  eventId: string;
  billingName: string;
  billingRole: string;
  sortOrder: number;
}

interface GenreRow {
  eventId: string;
  genreKey: string;
  displayName: string;
  sortOrder: number;
}

interface BindingRow {
  sourceId: string;
  eventId: string;
  sourceRole: string;
  sourceUrl: string;
  sourceEventKey?: string;
  connectorId?: string;
  contentHash?: string | null;
}

export function loadPlannerContextFromLinkedDb(runQuery: LinkedQueryExecutor): PlannerContext {
  const existingSources = loadJsonAgg<SourceRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'sourceId', s.id,
        'eventId', s.event_id,
        'sourceUrl', s.source_url,
        'contentHash', s.content_hash,
        'sourceRole', s.source_role,
        'sourceEventKey', s.raw_payload->>'sourceEventKey',
        'connectorId', s.raw_payload->>'connectorId'
      )
      ORDER BY s.source_url
    ) AS rows
    FROM public.event_sources s
    WHERE s.source_role = 'official';
  `,
  ).map(
    (row): ExistingOfficialSourceRecord => ({
      sourceId: row.sourceId,
      eventId: row.eventId,
      sourceUrl: row.sourceUrl,
      contentHash: row.contentHash,
      sourceRole: row.sourceRole,
      sourceEventKey: row.sourceEventKey,
      connectorId: row.connectorId,
    }),
  );

  const existingVenues = loadJsonAgg<VenueRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'city', v.city,
        'postalCode', v.postal_code
      )
    ) AS rows
    FROM public.venues v;
  `,
  ).map(
    (row): ExistingVenueRecord => ({
      id: row.id,
      name: row.name,
      city: row.city,
      postalCode: row.postalCode,
    }),
  );

  const eventRows = loadJsonAgg<EventRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventId', e.id,
        'title', e.title,
        'description', e.description,
        'startsAt', e.starts_at,
        'endsAt', e.ends_at,
        'timezone', e.timezone,
        'organizerName', e.organizer_name,
        'imageUrl', e.image_url,
        'venueId', e.venue_id,
        'status', e.status,
        'venueName', v.name,
        'venueCity', v.city,
        'venuePostalCode', v.postal_code
      )
      ORDER BY e.starts_at
    ) AS rows
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id;
  `,
  );

  const lineupRows = loadJsonAgg<LineupRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventId', l.event_id,
        'billingName', l.billing_name,
        'billingRole', l.billing_role,
        'sortOrder', l.sort_order
      )
      ORDER BY l.event_id, l.sort_order
    ) AS rows
    FROM public.event_lineup l;
  `,
  );

  const genreRows = loadJsonAgg<GenreRow>(
    runQuery,
    `
    SELECT jsonb_agg(
      jsonb_build_object(
        'eventId', g.event_id,
        'genreKey', g.genre_key,
        'displayName', g.display_name,
        'sortOrder', g.sort_order
      )
      ORDER BY g.event_id, g.sort_order
    ) AS rows
    FROM public.event_genres g;
  `,
  );

  const bindingsByEvent = new Map<string, BindingRow[]>();
  for (const source of existingSources) {
    const current = bindingsByEvent.get(source.eventId) ?? [];
    current.push({
      sourceId: source.sourceId,
      eventId: source.eventId,
      sourceRole: source.sourceRole ?? 'official',
      sourceUrl: source.sourceUrl,
      sourceEventKey: source.sourceEventKey,
      connectorId: source.connectorId,
      contentHash: source.contentHash,
    });
    bindingsByEvent.set(source.eventId, current);
  }

  const existingEvents: ExistingEventConsumerState[] = eventRows.map((event) => ({
    eventId: event.eventId,
    title: event.title,
    description: event.description,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    organizerName: event.organizerName,
    imageUrl: event.imageUrl,
    venueId: event.venueId,
    status: event.status,
    lineup: lineupRows
      .filter((row) => row.eventId === event.eventId)
      .map((row) => ({
        billingName: row.billingName,
        billingRole: row.billingRole as 'artist' | 'headliner' | 'compound_act',
        sortOrder: row.sortOrder,
      })),
    genres: genreRows
      .filter((row) => row.eventId === event.eventId)
      .map((row) => ({
        genreKey: row.genreKey,
        displayName: row.displayName,
        sortOrder: row.sortOrder,
      })),
  }));

  const eventCatalog: EventMatchCatalogEntry[] = eventRows.map((event) => ({
    eventId: event.eventId,
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
    timezone: event.timezone,
    venueName: event.venueName ?? undefined,
    venueCity: event.venueCity ?? undefined,
    venuePostalCode: event.venuePostalCode ?? undefined,
    organizerName: event.organizerName ?? undefined,
    lineupBillingNames: lineupRows
      .filter((row) => row.eventId === event.eventId)
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((row) => row.billingName),
    sourceBindings: bindingsByEvent.get(event.eventId) ?? [],
  }));

  return {
    existingSources,
    existingVenues,
    existingEvents,
    eventCatalog,
  };
}
