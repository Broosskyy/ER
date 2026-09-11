import type { LinkedQueryExecutor } from './linked-db';
import { loadJsonAgg } from './linked-db';
import {
  descriptionQualityScore,
  extractEditorialDescription,
  preferDescription,
} from '../../official-connectors/shared/description-quality';
import { parseDescriptionExplicitGenres } from '../../official-connectors/shared/parse-description-genres';
import { normalizeOfficialGenreLabels, normalizedGenresToExplicitLabels } from '../../official-connectors/shared/normalize-genre';

export interface StagingEventSnapshot {
  eventId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  status: string;
  imageUrl: string | null;
  officialUrl: string | null;
  organizerName: string | null;
  venueId: string | null;
  venueName: string | null;
  venueCity: string | null;
  lineup: string[];
  genres: string[];
  sources: Array<{
    sourceId: string;
    sourceRole: string;
    sourceUrl: string;
    connectorId: string | null;
    sourceEventKey: string | null;
  }>;
  tickets: Array<{
    ticketId: string;
    provider: string | null;
    ticketUrl: string | null;
    priceMinor: number | null;
    currency: string | null;
    salesStatus: string | null;
    sortOrder: number;
  }>;
}

export function loadStagingEventSnapshots(runQuery: LinkedQueryExecutor): StagingEventSnapshot[] {
  return loadJsonAgg<StagingEventSnapshot>(
    runQuery,
    `
    SELECT jsonb_agg(row_to_json(t) ORDER BY t."startsAt", t.title) AS rows FROM (
      SELECT
        e.id AS "eventId",
        e.title,
        e.description,
        e.starts_at AS "startsAt",
        e.ends_at AS "endsAt",
        e.status,
        e.image_url AS "imageUrl",
        e.official_url AS "officialUrl",
        e.organizer_name AS "organizerName",
        e.venue_id AS "venueId",
        v.name AS "venueName",
        v.city AS "venueCity",
        (
          SELECT COALESCE(jsonb_agg(l.billing_name ORDER BY l.sort_order), '[]'::jsonb)
          FROM public.event_lineup l WHERE l.event_id = e.id
        ) AS lineup,
        (
          SELECT COALESCE(jsonb_agg(g.display_name ORDER BY g.sort_order), '[]'::jsonb)
          FROM public.event_genres g WHERE g.event_id = e.id
        ) AS genres,
        (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'sourceId', s.id,
            'sourceRole', s.source_role,
            'sourceUrl', s.source_url,
            'connectorId', s.raw_payload->>'connectorId',
            'sourceEventKey', s.raw_payload->>'sourceEventKey'
          ) ORDER BY s.source_role, s.source_url), '[]'::jsonb)
          FROM public.event_sources s WHERE s.event_id = e.id
        ) AS sources,
        (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'ticketId', t.id,
            'provider', t.provider,
            'ticketUrl', t.ticket_url,
            'priceMinor', t.price_from_minor,
            'currency', t.currency,
            'salesStatus', t.sales_status,
            'sortOrder', t.sort_order
          ) ORDER BY t.sort_order), '[]'::jsonb)
          FROM public.event_tickets t WHERE t.event_id = e.id
        ) AS tickets
      FROM public.events e
      LEFT JOIN public.venues v ON v.id = e.venue_id
      WHERE e.status IN ('published', 'review', 'draft')
    ) t;
  `,
  );
}

function eventEvidenceScore(event: StagingEventSnapshot): number {
  let score = 0;
  if (descriptionQualityScore(event.description ?? undefined) > 0) {
    score += 5;
  }
  if (event.endsAt) {
    score += 2;
  }
  if (event.genres.length > 0) {
    score += 1;
  }
  if (event.officialUrl && /bootshaus\.tv|arep\.co/i.test(event.officialUrl)) {
    score += 4;
  }
  if (event.sources.some((source) => source.connectorId === 'bootshaus-official')) {
    score += 4;
  }
  if (event.tickets.some((ticket) => ticket.priceMinor != null)) {
    score += 1;
  }
  return score;
}

export function pickCanonicalWinner(
  left: StagingEventSnapshot,
  right: StagingEventSnapshot,
): StagingEventSnapshot {
  const leftScore = eventEvidenceScore(left);
  const rightScore = eventEvidenceScore(right);
  return leftScore >= rightScore ? left : right;
}

export interface CanonicalConsolidationResult {
  winnerId: string;
  loserId: string;
  movedSourceBindings: number;
  movedTicketRows: number;
  updatedWinnerFields: string[];
  archivedLoser: boolean;
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function consolidateCanonicalEvents(
  runQuery: LinkedQueryExecutor,
  winner: StagingEventSnapshot,
  loser: StagingEventSnapshot,
): CanonicalConsolidationResult {
  const updatedWinnerFields: string[] = [];
  const preferredDescription = preferDescription(winner.description ?? undefined, loser.description ?? undefined);
  const description =
    preferredDescription.source === 'right'
      ? preferredDescription.value ?? winner.description
      : extractEditorialDescription(winner.description ?? undefined) ?? winner.description;
  if (description && description !== winner.description) {
    runQuery(
      `UPDATE public.events SET description = ${sqlLiteral(description)}, updated_at = now() WHERE id = '${winner.eventId}'::uuid;`,
    );
    updatedWinnerFields.push('description');
  }

  const endsAt = winner.endsAt ?? loser.endsAt;
  if (endsAt && endsAt !== winner.endsAt) {
    runQuery(
      `UPDATE public.events SET ends_at = ${sqlLiteral(endsAt)}, updated_at = now() WHERE id = '${winner.eventId}'::uuid;`,
    );
    updatedWinnerFields.push('endsAt');
  }

  const imageUrl = winner.imageUrl ?? loser.imageUrl;
  if (imageUrl && imageUrl !== winner.imageUrl) {
    runQuery(
      `UPDATE public.events SET image_url = ${sqlLiteral(imageUrl)}, updated_at = now() WHERE id = '${winner.eventId}'::uuid;`,
    );
    updatedWinnerFields.push('imageUrl');
  }

  const genreLabels = [
    ...new Set([
      ...winner.genres,
      ...loser.genres,
      ...parseDescriptionExplicitGenres(description ?? undefined),
    ]),
  ];
  if (genreLabels.length > winner.genres.length) {
    runQuery(`DELETE FROM public.event_genres WHERE event_id = '${winner.eventId}'::uuid;`);
    const normalized = normalizeOfficialGenreLabels(genreLabels);
    for (const [index, label] of normalizedGenresToExplicitLabels(normalized.normalized).entries()) {
      const genreKey = normalized.normalized.find((entry) => entry.displayName === label)?.genreKey ?? label;
      runQuery(
        `INSERT INTO public.event_genres (event_id, genre_key, display_name, sort_order)
         VALUES ('${winner.eventId}'::uuid, ${sqlLiteral(genreKey)}, ${sqlLiteral(label)}, ${index});`,
      );
    }
    updatedWinnerFields.push('genres');
  }

  const lineup = [...new Set([...winner.lineup, ...loser.lineup])];
  if (lineup.length > winner.lineup.length) {
    runQuery(`DELETE FROM public.event_lineup WHERE event_id = '${winner.eventId}'::uuid;`);
    for (const [index, billingName] of lineup.entries()) {
      runQuery(
        `INSERT INTO public.event_lineup (event_id, billing_name, billing_role, sort_order)
         VALUES ('${winner.eventId}'::uuid, ${sqlLiteral(billingName)}, ${index === 0 ? "'headliner'" : "'artist'"}, ${index});`,
      );
    }
    updatedWinnerFields.push('lineup');
  }

  let movedSourceBindings = 0;
  for (const source of loser.sources) {
    const conflict = winner.sources.some(
      (existing) => existing.sourceRole === source.sourceRole && existing.sourceUrl === source.sourceUrl,
    );
    if (conflict) {
      runQuery(`DELETE FROM public.event_sources WHERE id = '${source.sourceId}'::uuid;`);
      continue;
    }
    runQuery(
      `UPDATE public.event_sources SET event_id = '${winner.eventId}'::uuid WHERE id = '${source.sourceId}'::uuid;`,
    );
    movedSourceBindings += 1;
  }

  let movedTicketRows = 0;
  for (const ticket of loser.tickets) {
    if (winner.tickets.some((entry) => entry.ticketUrl === ticket.ticketUrl)) {
      runQuery(`DELETE FROM public.event_tickets WHERE id = '${ticket.ticketId}'::uuid;`);
      continue;
    }

    const winnerPrimary = winner.tickets.find((entry) => entry.sortOrder === 0) ?? winner.tickets[0];
    const preferIncomingTicket =
      winnerPrimary &&
      ticket.priceMinor != null &&
      (/ticket\.io/i.test(ticket.ticketUrl ?? '') ||
        winnerPrimary.priceMinor == null ||
        !/ticket\.io/i.test(winnerPrimary.ticketUrl ?? ''));

    if (winnerPrimary && preferIncomingTicket) {
      runQuery(`DELETE FROM public.event_tickets WHERE event_id = '${winner.eventId}'::uuid;`);
      runQuery(
        `UPDATE public.event_tickets SET event_id = '${winner.eventId}'::uuid, sort_order = 0 WHERE id = '${ticket.ticketId}'::uuid;`,
      );
      movedTicketRows += 1;
      continue;
    }

    if (winner.tickets.length > 0) {
      runQuery(`DELETE FROM public.event_tickets WHERE id = '${ticket.ticketId}'::uuid;`);
      continue;
    }

    runQuery(
      `UPDATE public.event_tickets SET event_id = '${winner.eventId}'::uuid WHERE id = '${ticket.ticketId}'::uuid;`,
    );
    movedTicketRows += 1;
  }

  runQuery(
    `UPDATE public.events SET status = 'archived', updated_at = now() WHERE id = '${loser.eventId}'::uuid;`,
  );

  return {
    winnerId: winner.eventId,
    loserId: loser.eventId,
    movedSourceBindings,
    movedTicketRows,
    updatedWinnerFields,
    archivedLoser: true,
  };
}
