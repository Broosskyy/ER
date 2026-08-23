import type { EventWritePlan } from '../types/event-candidate';
import { canonicalizeOfficialSourceUrl } from '../identity/source-identity';

export class OfficialEventApplyError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'invalid_plan'
      | 'ticket_mutation_forbidden'
      | 'precondition_failed'
      | 'noop_required'
      | 'unsupported_action',
  ) {
    super(message);
    this.name = 'OfficialEventApplyError';
  }
}

export type OfficialEventApplyStatementKind =
  | 'venue_insert'
  | 'event_insert'
  | 'event_update'
  | 'lineup_delete'
  | 'lineup_insert'
  | 'genre_delete'
  | 'genre_insert'
  | 'source_insert'
  | 'source_update';

export interface OfficialEventApplyStatement {
  kind: OfficialEventApplyStatementKind;
  table: 'venues' | 'events' | 'event_lineup' | 'event_genres' | 'event_sources';
  eventId?: string;
  sourceId?: string;
  venueId?: string;
  rowCount: number;
}

export interface OfficialEventApplyPrecondition {
  eventId?: string;
  sourceId?: string;
  venueId?: string;
  description?: string | null;
  sourceContentHash?: string | null;
  lineupBillingNames?: string[];
  genreDisplayNames?: string[];
}

export interface OfficialEventApplyIds {
  eventId: string;
  sourceId: string;
  venueId?: string;
}

export interface OfficialEventApplySummary {
  statements: OfficialEventApplyStatement[];
  logicalOperations: number;
  databaseWriteStatements: number;
  databaseRowsInserted: number;
  databaseRowsUpdated: number;
  databaseRowsDeleted: number;
  touchesTickets: boolean;
}

function lineupRole(billingName: string, index: number): string {
  if (billingName.includes('&') || /\bb2b\b/i.test(billingName)) {
    return 'compound_act';
  }
  return index === 0 ? 'headliner' : 'artist';
}

export function assertOfficialEventApplyPlan(plan: EventWritePlan): void {
  if (plan.validation.decision !== 'persist_ready') {
    throw new OfficialEventApplyError(`validation_not_ready:${plan.validation.decision}`, 'invalid_plan');
  }
  if (plan.ticketsAction !== 'noop') {
    throw new OfficialEventApplyError(`ticket_action_forbidden:${plan.ticketsAction}`, 'ticket_mutation_forbidden');
  }
  if (plan.candidate.origin.kind !== 'official_connector') {
    throw new OfficialEventApplyError('official_origin_required', 'invalid_plan');
  }
}

export function buildOfficialEventApplySummary(
  plan: EventWritePlan,
  ids: OfficialEventApplyIds,
): OfficialEventApplySummary {
  assertOfficialEventApplyPlan(plan);

  const statements: OfficialEventApplyStatement[] = [];
  let databaseRowsInserted = 0;
  let databaseRowsUpdated = 0;
  let databaseRowsDeleted = 0;

  const eventId = plan.existingSource?.eventId ?? ids.eventId;
  const sourceId = plan.existingSource?.sourceId ?? ids.sourceId;
  const venueId = plan.existingVenueId ?? ids.venueId;

  if (plan.venueAction === 'insert') {
    if (!ids.venueId) {
      throw new OfficialEventApplyError('venue_id_required_for_insert', 'invalid_plan');
    }
    statements.push({
      kind: 'venue_insert',
      table: 'venues',
      venueId: ids.venueId,
      rowCount: 1,
    });
    databaseRowsInserted += 1;
  }

  if (plan.eventAction === 'insert') {
    statements.push({
      kind: 'event_insert',
      table: 'events',
      eventId,
      venueId: venueId ?? ids.venueId,
      rowCount: 1,
    });
    databaseRowsInserted += 1;
  }

  if (plan.eventAction === 'update') {
    statements.push({
      kind: 'event_update',
      table: 'events',
      eventId,
      rowCount: 1,
    });
    databaseRowsUpdated += 1;
  }

  if (plan.lineupAction === 'replace') {
    const lineupCount = plan.candidate.lineup.length;
    if (lineupCount === 0) {
      throw new OfficialEventApplyError('lineup_replace_requires_non_empty_target', 'invalid_plan');
    }
    statements.push({
      kind: 'lineup_delete',
      table: 'event_lineup',
      eventId,
      rowCount: 1,
    });
    databaseRowsDeleted += 1;
    for (const act of plan.candidate.lineup) {
      statements.push({
        kind: 'lineup_insert',
        table: 'event_lineup',
        eventId,
        rowCount: 1,
      });
      databaseRowsInserted += 1;
    }
  }

  if (plan.genresAction === 'replace') {
    if (plan.candidate.genres.length === 0) {
      throw new OfficialEventApplyError('genre_replace_requires_non_empty_target', 'invalid_plan');
    }
    statements.push({
      kind: 'genre_delete',
      table: 'event_genres',
      eventId,
      rowCount: 1,
    });
    databaseRowsDeleted += 1;
    for (const genre of plan.candidate.genres) {
      statements.push({
        kind: 'genre_insert',
        table: 'event_genres',
        eventId,
        rowCount: 1,
      });
      databaseRowsInserted += 1;
    }
  }

  if (plan.sourceAction === 'insert') {
    statements.push({
      kind: 'source_insert',
      table: 'event_sources',
      eventId,
      sourceId,
      rowCount: 1,
    });
    databaseRowsInserted += 1;
  }

  if (plan.sourceAction === 'update') {
    statements.push({
      kind: 'source_update',
      table: 'event_sources',
      eventId,
      sourceId,
      rowCount: 1,
    });
    databaseRowsUpdated += 1;
  }

  return {
    statements,
    logicalOperations: statements.length,
    databaseWriteStatements: statements.length,
    databaseRowsInserted,
    databaseRowsUpdated,
    databaseRowsDeleted,
    touchesTickets: false,
  };
}

export function isOfficialEventApplyNoop(plan: EventWritePlan): boolean {
  return (
    plan.eventAction === 'noop' &&
    plan.venueAction !== 'insert' &&
    plan.lineupAction === 'noop' &&
    plan.genresAction === 'noop' &&
    plan.sourceAction === 'noop' &&
    plan.ticketsAction === 'noop'
  );
}

export function assertOfficialEventApplyPrecondition(
  plan: EventWritePlan,
  precondition: OfficialEventApplyPrecondition,
): void {
  if (plan.eventAction === 'update' && precondition.description !== undefined) {
    if (precondition.description !== (plan.candidate.description ?? null)) {
      throw new OfficialEventApplyError('description_precondition_failed', 'precondition_failed');
    }
  }

  if (plan.existingSource && precondition.sourceContentHash !== undefined) {
    if ((precondition.sourceContentHash ?? null) !== (plan.existingSource.contentHash ?? null)) {
      throw new OfficialEventApplyError('source_hash_precondition_failed', 'precondition_failed');
    }
  }

  if (plan.existingSource?.eventId && precondition.eventId && plan.existingSource.eventId !== precondition.eventId) {
    throw new OfficialEventApplyError('event_id_precondition_failed', 'precondition_failed');
  }

  if (plan.existingSource?.sourceId && precondition.sourceId && plan.existingSource.sourceId !== precondition.sourceId) {
    throw new OfficialEventApplyError('source_id_precondition_failed', 'precondition_failed');
  }
}

function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return `${sqlLiteral(JSON.stringify(value))}::jsonb`;
}

function sqlValue(value: string | number | null): string {
  if (value == null) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return sqlLiteral(value);
}

export function buildOfficialEventApplySql(
  plan: EventWritePlan,
  ids: OfficialEventApplyIds,
  precondition: OfficialEventApplyPrecondition,
): string {
  assertOfficialEventApplyPrecondition(plan, precondition);

  if (isOfficialEventApplyNoop(plan)) {
    return 'BEGIN; COMMIT;';
  }

  const summary = buildOfficialEventApplySummary(plan, ids);
  if (summary.statements.length === 0) {
    return 'BEGIN; COMMIT;';
  }

  const candidate = plan.candidate;
  if (candidate.origin.kind !== 'official_connector') {
    throw new OfficialEventApplyError('official_origin_required', 'invalid_plan');
  }
  const eventId = plan.existingSource?.eventId ?? ids.eventId;
  const sourceId = plan.existingSource?.sourceId ?? ids.sourceId;
  const venueId = plan.existingVenueId ?? ids.venueId;
  const blocks: string[] = [];

  if (plan.venueAction === 'insert' && ids.venueId && candidate.venue) {
    blocks.push(`
    INSERT INTO public.venues (id, name, address_line, postal_code, city, country_code)
    VALUES (
      ${sqlLiteral(ids.venueId)}::uuid,
      ${sqlLiteral(candidate.venue.name)},
      ${sqlValue(candidate.venue.addressLine ?? null)},
      ${sqlValue(candidate.venue.postalCode ?? null)},
      ${sqlValue(candidate.venue.city ?? null)},
      ${sqlValue(candidate.venue.countryCode ?? null)}
    );`);
  }

  if (plan.eventAction === 'insert') {
    blocks.push(`
    INSERT INTO public.events (
      id, status, title, description, starts_at, ends_at, timezone, image_url, official_url, venue_id, organizer_name, published_at
    )
    VALUES (
      ${sqlLiteral(eventId)}::uuid,
      'published',
      ${sqlLiteral(candidate.title)},
      ${sqlValue(candidate.description ?? null)},
      ${sqlLiteral(candidate.startsAt)}::timestamptz,
      ${sqlValue(candidate.endsAt ?? null)}::timestamptz,
      ${sqlLiteral(candidate.timezone)},
      ${sqlValue(candidate.imageUrl ?? null)},
      ${sqlLiteral(canonicalizeOfficialSourceUrl(candidate.origin.officialUrl))},
      ${venueId ? `${sqlLiteral(venueId)}::uuid` : 'NULL'},
      ${sqlValue(candidate.organizerName ?? null)},
      now()
    );`);
  }

  if (plan.eventAction === 'update') {
    const descriptionBefore = precondition.description ?? null;
    blocks.push(`
    UPDATE public.events
    SET
      title = ${sqlLiteral(candidate.title)},
      description = ${sqlValue(candidate.description ?? null)},
      starts_at = ${sqlLiteral(candidate.startsAt)}::timestamptz,
      ends_at = ${sqlValue(candidate.endsAt ?? null)}::timestamptz,
      timezone = ${sqlLiteral(candidate.timezone)},
      image_url = ${sqlValue(candidate.imageUrl ?? null)},
      official_url = ${sqlLiteral(canonicalizeOfficialSourceUrl(candidate.origin.officialUrl))},
      venue_id = ${venueId ? `${sqlLiteral(venueId)}::uuid` : 'NULL'},
      organizer_name = ${sqlValue(candidate.organizerName ?? null)},
      updated_at = now()
    WHERE id = ${sqlLiteral(eventId)}::uuid
      AND description IS NOT DISTINCT FROM ${sqlValue(descriptionBefore)};
    IF NOT FOUND THEN
      RAISE EXCEPTION 'official_event_apply_description_guard_failed:%', ${sqlLiteral(eventId)};
    END IF;`);
  }

  if (plan.lineupAction === 'replace') {
    blocks.push(`DELETE FROM public.event_lineup WHERE event_id = ${sqlLiteral(eventId)}::uuid;`);
    for (const [index, act] of candidate.lineup.entries()) {
      blocks.push(`
    INSERT INTO public.event_lineup (event_id, billing_name, billing_role, sort_order)
    VALUES (
      ${sqlLiteral(eventId)}::uuid,
      ${sqlLiteral(act.billingName)},
      ${sqlLiteral(lineupRole(act.billingName, index))},
      ${act.sortOrder}
    );`);
    }
    blocks.push(`
    IF (SELECT COUNT(*) FROM public.event_lineup WHERE event_id = ${sqlLiteral(eventId)}::uuid) <> ${candidate.lineup.length} THEN
      RAISE EXCEPTION 'official_event_apply_lineup_count_failed:%', ${sqlLiteral(eventId)};
    END IF;`);
  }

  if (plan.genresAction === 'replace') {
    blocks.push(`DELETE FROM public.event_genres WHERE event_id = ${sqlLiteral(eventId)}::uuid;`);
    for (const genre of candidate.genres) {
      blocks.push(`
    INSERT INTO public.event_genres (event_id, genre_key, display_name, raw_label, sort_order)
    VALUES (
      ${sqlLiteral(eventId)}::uuid,
      ${sqlLiteral(genre.genreKey)},
      ${sqlLiteral(genre.displayName)},
      ${sqlLiteral(genre.displayName)},
      ${genre.sortOrder}
    );`);
    }
    blocks.push(`
    IF (SELECT COUNT(*) FROM public.event_genres WHERE event_id = ${sqlLiteral(eventId)}::uuid) <> ${candidate.genres.length} THEN
      RAISE EXCEPTION 'official_event_apply_genre_count_failed:%', ${sqlLiteral(eventId)};
    END IF;`);
  }

  if (plan.sourceAction === 'insert') {
    blocks.push(`
    INSERT INTO public.event_sources (
      id, event_id, source_role, source_url, observed_at, content_hash, raw_payload
    )
    VALUES (
      ${sqlLiteral(sourceId)}::uuid,
      ${sqlLiteral(eventId)}::uuid,
      'official',
      ${sqlLiteral(plan.sourceIdentity.sourceUrl)},
      ${sqlLiteral(plan.sourceIdentity.fetchedAt)}::timestamptz,
      ${sqlLiteral(plan.sourceIdentity.contentHash)},
      ${sqlJson(plan.sourcePayload)}
    );`);
  }

  if (plan.sourceAction === 'update') {
    blocks.push(`
    UPDATE public.event_sources
    SET
      content_hash = ${sqlLiteral(plan.sourceIdentity.contentHash)},
      observed_at = ${sqlLiteral(plan.sourceIdentity.fetchedAt)}::timestamptz,
      raw_payload = COALESCE(raw_payload, '{}'::jsonb) || ${sqlJson(plan.sourcePayload)}
    WHERE id = ${sqlLiteral(sourceId)}::uuid
      AND source_role = 'official'
      AND content_hash IS NOT DISTINCT FROM ${sqlValue(precondition.sourceContentHash ?? null)};
    IF NOT FOUND THEN
      RAISE EXCEPTION 'official_event_apply_source_guard_failed:%', ${sqlLiteral(sourceId)};
    END IF;`);
  }

  return `BEGIN;\nDO $$\nBEGIN\n${blocks.join('\n')}\nEND $$;\nCOMMIT;\n`;
}
