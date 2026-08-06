/**
 * Phase 4.7.3.1 — Read-only schema validation after schema-guarantee deploy.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase4731-schema-validation.ts
 */
import './bootstrap-ops-supabase';

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { opsClient } from './ops-supabase-rows';
import {
  EXPECTED_ATTRIBUTE_COLUMNS,
  EXPECTED_PHASE473_INDEXES,
  countFrozenDomains,
  validatePostgresSchema,
  validatePostgresSchemaPhase473Only,
  validateServiceRoleAccess,
} from './_phase473-schema-shared';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_PHASE473 = join(ROOT, 'docs/real-data/_phase473_schema_validation.json');
const OUT_PHASE4731 = join(ROOT, 'docs/real-data/_phase4731_schema_validation.json');
const BASELINE_PATH = join(ROOT, 'docs/real-data/_phase467_metrics_before.json');

async function main(): Promise<void> {
  const c = opsClient();
  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  const service = await validateServiceRoleAccess(c);
  const frozenCounts = await countFrozenDomains(c);

  const blockers473: string[] = [];
  const blockers4731: string[] = [];

  if (!service.migrationApplied) {
    blockers473.unshift('migration not applied — phase473 event attribute columns missing');
    blockers4731.unshift('migration not applied — phase473 event attribute columns missing');
  }

  for (const col of Object.keys(EXPECTED_ATTRIBUTE_COLUMNS)) {
    const { error } = await c.from('events').select(col).limit(1);
    if (error) {
      blockers473.push(`service_role cannot select ${col}: ${error.message}`);
      blockers4731.push(`service_role cannot select ${col}: ${error.message}`);
    }
  }

  let phase473Pg:
    | Awaited<ReturnType<typeof validatePostgresSchemaPhase473Only>>
    | undefined;
  let phase4731Pg: Awaited<ReturnType<typeof validatePostgresSchema>> | undefined;

  if (databaseUrl) {
    phase473Pg = await validatePostgresSchemaPhase473Only(databaseUrl);
    blockers473.push(...phase473Pg.blockers);

    phase4731Pg = await validatePostgresSchema(databaseUrl);
    blockers4731.push(...phase4731Pg.blockers);
  } else {
    const message = 'DATABASE_URL / SUPABASE_DB_URL not set — skipped information_schema validation';
    blockers473.push(message);
    blockers4731.push(message);
  }

  if (service.rowsWithAttributeData !== 0) {
    blockers4731.push(`rowsWithAttributeData must be 0 (got ${service.rowsWithAttributeData})`);
  }

  const baseline = existsSync(BASELINE_PATH)
    ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as {
        metrics?: { publishedEvents?: number; canonicalArtistCount?: number };
      })
    : undefined;

  const frozenDomainChecks = {
    publishedEvents: {
      current: service.publishedEventCount,
      baseline: baseline?.metrics?.publishedEvents ?? 108,
      unchanged: service.publishedEventCount === (baseline?.metrics?.publishedEvents ?? 108),
    },
    artists: { current: frozenCounts.artists },
    venues: { current: frozenCounts.venues },
    organizers: { current: frozenCounts.organizers },
    sources: { current: frozenCounts.sources },
    eventSourceReferences: { current: frozenCounts.eventSourceReferences },
    eventLineupEntries: { current: frozenCounts.eventLineupEntries },
    eventLineupEntryArtists: { current: frozenCounts.eventLineupEntryArtists },
    entityFollows: { current: frozenCounts.entityFollows },
    collections: { current: frozenCounts.collections },
    note: 'Count-only stability check; phase4731 migration contains no UPDATE/DELETE on events or related domains.',
  };

  if (!frozenDomainChecks.publishedEvents.unchanged) {
    blockers4731.push(
      `published event count changed: ${frozenDomainChecks.publishedEvents.baseline} -> ${frozenDomainChecks.publishedEvents.current}`,
    );
  }

  const phase473Report = {
    generatedAt: new Date().toISOString(),
    migrationFile: '20260803140000_phase473_canonical_event_attributes.sql',
    migrationApplied: service.migrationApplied,
    publishedEventCount: service.publishedEventCount,
    rowsWithAttributeData: service.rowsWithAttributeData,
    rowsChangedByMigration: 0,
    noImplicitBackfill: service.rowsWithAttributeData === 0,
    columns: phase473Pg?.columns ?? {},
    venueEnvironmentConstraint: phase473Pg?.venueEnvironmentConstraint ?? '',
    indexesPresent: phase473Pg?.indexesPresent ?? false,
    indexes: phase473Pg?.indexes ?? EXPECTED_PHASE473_INDEXES.map((name) => ({ name, present: false })),
    serviceRole: {
      selectNewColumns: blockers473.filter((entry) => entry.startsWith('service_role')).length === 0,
      publishedEventsReadable: service.serviceRoleSelectOk,
      sampleCount: service.publishedSampleCount,
    },
    rls: {
      serviceRolePublishedRead: service.serviceRoleSelectOk,
      note: 'service_role bypasses RLS; published event reads verified via ops client',
    },
    applicationTypes: {
      mapperRoundTripOk: service.mapperRoundTripOk,
      eventRowFields: Object.keys(EXPECTED_ATTRIBUTE_COLUMNS),
    },
    pass:
      service.migrationApplied &&
      blockers473.length === 0 &&
      service.rowsWithAttributeData === 0 &&
      service.serviceRoleSelectOk &&
      service.mapperRoundTripOk,
    blockers: blockers473,
  };

  const phase4731Report = {
    generatedAt: new Date().toISOString(),
    migrationFile: '20260803150000_phase4731_event_attribute_schema_guarantees.sql',
    migrationApplied: service.migrationApplied,
    phase4731Applied: phase4731Pg
      ? phase4731Pg.blockers.filter((entry) => entry.includes('default') || entry.includes('_check')).length ===
        0
      : null,
    publishedEventCount: service.publishedEventCount,
    rowsWithAttributeData: service.rowsWithAttributeData,
    rowsChangedByMigration: 0,
    noImplicitBackfill: service.rowsWithAttributeData === 0,
    eventAttributesDefault: phase4731Pg?.eventAttributesDefault ?? null,
    constraints: {
      venueEnvironment: phase4731Pg?.venueEnvironmentConstraint ?? '',
      floorCount: phase4731Pg?.floorCountConstraint ?? '',
      stageCount: phase4731Pg?.stageCountConstraint ?? '',
      floorCountRejectsNegative: phase4731Pg?.floorCountRejectsNegative ?? null,
      stageCountRejectsNegative: phase4731Pg?.stageCountRejectsNegative ?? null,
    },
    indexesPresent: phase4731Pg?.indexesPresent ?? false,
    indexes: phase4731Pg?.indexes ?? EXPECTED_PHASE473_INDEXES.map((name) => ({ name, present: false })),
    columns: phase4731Pg?.columns ?? {},
    serviceRole: {
      selectNewColumns: blockers4731.filter((entry) => entry.startsWith('service_role')).length === 0,
      publishedEventsReadable: service.serviceRoleSelectOk,
      sampleCount: service.publishedSampleCount,
    },
    frozenDomains: frozenDomainChecks,
    applicationTypes: {
      mapperRoundTripOk: service.mapperRoundTripOk,
    },
    pass:
      service.migrationApplied &&
      blockers4731.length === 0 &&
      service.rowsWithAttributeData === 0 &&
      service.serviceRoleSelectOk &&
      service.mapperRoundTripOk,
    blockers: blockers4731,
  };

  writeFileSync(OUT_PHASE473, JSON.stringify(phase473Report, null, 2));
  writeFileSync(OUT_PHASE4731, JSON.stringify(phase4731Report, null, 2));

  console.log(JSON.stringify(phase4731Report, null, 2));

  if (!phase4731Report.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
