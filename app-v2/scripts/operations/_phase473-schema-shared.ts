/**
 * Phase 4.7.3 / 4.7.3.1 — Shared read-only schema validation helpers.
 */
import pg from 'pg';

import { mapEventRowToAdminRecord } from '@/data/mappers/event-mapper';
import type { EventRow } from '@/data/mappers/event-mapper';
import type { SupabaseClient } from '@supabase/supabase-js';

export const EXPECTED_ATTRIBUTE_COLUMNS: Record<string, { dataType: string }> = {
  event_attributes: { dataType: 'jsonb' },
  floor_count: { dataType: 'integer' },
  stage_count: { dataType: 'integer' },
  venue_environment: { dataType: 'text' },
  last_entry_at: { dataType: 'timestamp with time zone' },
  dress_code: { dataType: 'text' },
  accessibility_notes: { dataType: 'text' },
};

export const EXPECTED_PHASE473_INDEXES = [
  'events_event_attributes_gin_idx',
  'events_floor_count_idx',
  'events_venue_environment_idx',
];

export interface ServiceRoleValidation {
  migrationApplied: boolean;
  publishedEventCount: number;
  rowsWithAttributeData: number;
  serviceRoleSelectOk: boolean;
  mapperRoundTripOk: boolean;
  publishedSampleCount: number;
}

export async function validateServiceRoleAccess(
  c: SupabaseClient,
): Promise<ServiceRoleValidation> {
  const { count: publishedCount } = await c
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'published');

  const { data: publishedSample, error: publishedSampleError } = await c
    .from('events')
    .select('id,title,updated_at,price_text,description,genre_labels')
    .eq('status', 'published')
    .limit(108);

  const migrationApplied = (
    await Promise.all(
      Object.keys(EXPECTED_ATTRIBUTE_COLUMNS).map(async (column) => {
        const { error } = await c.from('events').select(column).limit(1);
        return !error;
      }),
    )
  ).every(Boolean);

  let withAttributeData = 0;
  if (migrationApplied) {
    const { data: attributeRows } = await c
      .from('events')
      .select(
        'id,event_attributes,floor_count,stage_count,venue_environment,last_entry_at,dress_code,accessibility_notes',
      )
      .eq('status', 'published');
    withAttributeData = (attributeRows ?? []).filter(
      (row) =>
        row.event_attributes != null ||
        row.floor_count != null ||
        row.stage_count != null ||
        row.venue_environment != null ||
        row.last_entry_at != null ||
        row.dress_code != null ||
        row.accessibility_notes != null,
    ).length;
  }

  let mapperRoundTripOk = true;
  if (migrationApplied) {
    const { data: mapperRows } = await c.from('events').select('*').limit(1);
    if (mapperRows?.[0]) {
      try {
        mapEventRowToAdminRecord(mapperRows[0] as EventRow);
      } catch {
        mapperRoundTripOk = false;
      }
    }
  }

  const serviceRoleSelectOk = !publishedSampleError && (publishedSample?.length ?? 0) > 0;

  return {
    migrationApplied,
    publishedEventCount: publishedCount ?? 0,
    rowsWithAttributeData: withAttributeData,
    serviceRoleSelectOk,
    mapperRoundTripOk,
    publishedSampleCount: publishedSample?.length ?? 0,
  };
}

export interface FrozenDomainCounts {
  artists: number | null;
  venues: number | null;
  organizers: number | null;
  sources: number | null;
  eventSourceReferences: number | null;
  eventLineupEntries: number | null;
  eventLineupEntryArtists: number | null;
  entityFollows: number | null;
  collections: number | null;
}

export async function countFrozenDomains(c: SupabaseClient): Promise<FrozenDomainCounts> {
  async function countTable(table: string): Promise<number | null> {
    const { count, error } = await c.from(table).select('id', { count: 'exact', head: true });
    return error ? null : (count ?? 0);
  }

  return {
    artists: await countTable('artists'),
    venues: await countTable('venues'),
    organizers: await countTable('organizers'),
    sources: await countTable('sources'),
    eventSourceReferences: await countTable('event_source_references'),
    eventLineupEntries: await countTable('event_lineup_entries'),
    eventLineupEntryArtists: await countTable('event_lineup_entry_artists'),
    entityFollows: await countTable('entity_follows'),
    collections: await countTable('collections'),
  };
}

export interface PostgresSchemaValidation {
  columns: Record<string, unknown>;
  eventAttributesDefault: string | null;
  venueEnvironmentConstraint: string;
  floorCountConstraint: string;
  stageCountConstraint: string;
  indexes: Array<{ name: string; present: boolean }>;
  indexesPresent: boolean;
  floorCountRejectsNegative: boolean | null;
  stageCountRejectsNegative: boolean | null;
  blockers: string[];
}

function normalizeDefault(value: string | null): string {
  return (value ?? '').replace(/\s+/g, ' ').trim();
}

export async function validatePostgresSchema(
  databaseUrl: string,
): Promise<PostgresSchemaValidation> {
  const blockers: string[] = [];
  const pgClient = new pg.Client({ connectionString: databaseUrl });
  await pgClient.connect();

  try {
    const columns = await pgClient.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public' and table_name = 'events'
         and column_name = any($1::text[])`,
      [Object.keys(EXPECTED_ATTRIBUTE_COLUMNS)],
    );

    const columnMeta: Record<string, unknown> = {};
    for (const [name, expected] of Object.entries(EXPECTED_ATTRIBUTE_COLUMNS)) {
      const row = columns.rows.find((entry) => entry.column_name === name);
      columnMeta[name] = row ?? { missing: true };
      if (!row) {
        blockers.push(`missing column: ${name}`);
      } else if (row.data_type !== expected.dataType) {
        blockers.push(`wrong type for ${name}: ${row.data_type}`);
      }
    }

    const eventAttributes = columns.rows.find((entry) => entry.column_name === 'event_attributes');
    const eventAttributesDefault = eventAttributes?.column_default ?? null;
    const normalizedDefault = normalizeDefault(eventAttributesDefault);
    if (!normalizedDefault.includes("'{}'::jsonb") && !normalizedDefault.includes("'{}'::json")) {
      blockers.push(
        `event_attributes default must be '{}'::jsonb (got: ${eventAttributesDefault ?? 'null'})`,
      );
    }

    const constraints = await pgClient.query<{ conname: string; definition: string }>(
      `select conname, pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conrelid = 'public.events'::regclass`,
    );

    const venueEnvironmentConstraint =
      constraints.rows.find((row) => row.conname === 'events_venue_environment_check')
        ?.definition ?? '';
    const floorCountConstraint =
      constraints.rows.find((row) => row.conname === 'events_floor_count_check')?.definition ?? '';
    const stageCountConstraint =
      constraints.rows.find((row) => row.conname === 'events_stage_count_check')?.definition ?? '';

    if (!venueEnvironmentConstraint.includes('indoor')) {
      blockers.push('events_venue_environment_check constraint missing');
    }
    if (!floorCountConstraint.match(/floor_count\s*>=\s*0/i)) {
      blockers.push('events_floor_count_check constraint missing or incorrect');
    }
    if (!stageCountConstraint.match(/stage_count\s*>=\s*0/i)) {
      blockers.push('events_stage_count_check constraint missing or incorrect');
    }

    const indexes = await pgClient.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'events'`,
    );
    const indexNames = indexes.rows.map((row) => row.indexname);
    const indexResults = EXPECTED_PHASE473_INDEXES.map((name) => ({
      name,
      present: indexNames.includes(name),
    }));
    for (const index of indexResults) {
      if (!index.present) {
        blockers.push(`missing index: ${index.name}`);
      }
    }

    const { rows: probeRows } = await pgClient.query<{ id: string }>(
      `select id from public.events where status = 'published' limit 1`,
    );
    const probeId = probeRows[0]?.id;
    let floorCountRejectsNegative: boolean | null = null;
    let stageCountRejectsNegative: boolean | null = null;

    if (probeId) {
      await pgClient.query('BEGIN');
      try {
        try {
          await pgClient.query(
            `update public.events set floor_count = -1 where id = $1`,
            [probeId],
          );
          blockers.push('events_floor_count_check did not reject negative floor_count');
          floorCountRejectsNegative = false;
        } catch (error) {
          const code = (error as { code?: string }).code;
          floorCountRejectsNegative = code === '23514';
          if (!floorCountRejectsNegative) {
            blockers.push(`floor_count negative probe failed unexpectedly: ${String(error)}`);
          }
        }

        try {
          await pgClient.query(
            `update public.events set stage_count = -1 where id = $1`,
            [probeId],
          );
          blockers.push('events_stage_count_check did not reject negative stage_count');
          stageCountRejectsNegative = false;
        } catch (error) {
          const code = (error as { code?: string }).code;
          stageCountRejectsNegative = code === '23514';
          if (!stageCountRejectsNegative) {
            blockers.push(`stage_count negative probe failed unexpectedly: ${String(error)}`);
          }
        }
      } finally {
        await pgClient.query('ROLLBACK');
      }
    } else {
      blockers.push('no published event available for constraint rejection probe');
    }

    return {
      columns: columnMeta,
      eventAttributesDefault,
      venueEnvironmentConstraint,
      floorCountConstraint,
      stageCountConstraint,
      indexes: indexResults,
      indexesPresent: indexResults.every((entry) => entry.present),
      floorCountRejectsNegative,
      stageCountRejectsNegative,
      blockers,
    };
  } finally {
    await pgClient.end();
  }
}

export async function validatePostgresSchemaPhase473Only(
  databaseUrl: string,
): Promise<{
  columns: Record<string, unknown>;
  venueEnvironmentConstraint: string;
  indexes: Array<{ name: string; present: boolean }>;
  indexesPresent: boolean;
  blockers: string[];
}> {
  const blockers: string[] = [];
  const pgClient = new pg.Client({ connectionString: databaseUrl });
  await pgClient.connect();

  try {
    const columns = await pgClient.query<{
      column_name: string;
      data_type: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      `select column_name, data_type, is_nullable, column_default
       from information_schema.columns
       where table_schema = 'public' and table_name = 'events'
         and column_name = any($1::text[])`,
      [Object.keys(EXPECTED_ATTRIBUTE_COLUMNS)],
    );

    const columnMeta: Record<string, unknown> = {};
    for (const [name, expected] of Object.entries(EXPECTED_ATTRIBUTE_COLUMNS)) {
      const row = columns.rows.find((entry) => entry.column_name === name);
      columnMeta[name] = row ?? { missing: true };
      if (!row) {
        blockers.push(`missing column: ${name}`);
      } else if (row.data_type !== expected.dataType) {
        blockers.push(`wrong type for ${name}: ${row.data_type}`);
      }
    }

    const constraints = await pgClient.query<{ conname: string; definition: string }>(
      `select conname, pg_get_constraintdef(oid) as definition
       from pg_constraint
       where conrelid = 'public.events'::regclass`,
    );
    const venueEnvironmentConstraint =
      constraints.rows.find((row) => row.conname === 'events_venue_environment_check')
        ?.definition ?? '';
    if (!venueEnvironmentConstraint.includes('indoor')) {
      blockers.push('events_venue_environment_check constraint missing');
    }

    const indexes = await pgClient.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public' and tablename = 'events'`,
    );
    const indexNames = indexes.rows.map((row) => row.indexname);
    const indexResults = EXPECTED_PHASE473_INDEXES.map((name) => ({
      name,
      present: indexNames.includes(name),
    }));
    for (const index of indexResults) {
      if (!index.present) {
        blockers.push(`missing index: ${index.name}`);
      }
    }

    return {
      columns: columnMeta,
      venueEnvironmentConstraint,
      indexes: indexResults,
      indexesPresent: indexResults.every((entry) => entry.present),
      blockers,
    };
  } finally {
    await pgClient.end();
  }
}
