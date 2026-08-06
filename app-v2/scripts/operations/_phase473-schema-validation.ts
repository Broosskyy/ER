/**
 * Phase 4.7.3 — Read-only schema validation after migration deploy.
 *
 * Usage:
 *   npx tsx scripts/operations/_phase473-schema-validation.ts
 *
 * For post-4731 validation (writes both artifacts), prefer:
 *   npx tsx scripts/operations/_phase4731-schema-validation.ts
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { opsClient } from './ops-supabase-rows';
import {
  EXPECTED_ATTRIBUTE_COLUMNS,
  EXPECTED_PHASE473_INDEXES,
  validatePostgresSchemaPhase473Only,
  validateServiceRoleAccess,
} from './_phase473-schema-shared';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'docs/real-data/_phase473_schema_validation.json');

async function main(): Promise<void> {
  const c = opsClient();
  const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
  const service = await validateServiceRoleAccess(c);

  const blockers: string[] = [];
  if (!service.migrationApplied) {
    blockers.unshift('migration not applied — phase473 event attribute columns missing');
  }

  let columnMeta: Record<string, unknown> = {};
  let venueEnvironmentConstraint = '';
  let indexResults = EXPECTED_PHASE473_INDEXES.map((name) => ({ name, present: false }));
  let indexesPresent = false;

  if (databaseUrl) {
    const pg = await validatePostgresSchemaPhase473Only(databaseUrl);
    columnMeta = pg.columns;
    venueEnvironmentConstraint = pg.venueEnvironmentConstraint;
    indexResults = pg.indexes;
    indexesPresent = pg.indexesPresent;
    blockers.push(...pg.blockers);
  } else {
    blockers.push('DATABASE_URL / SUPABASE_DB_URL not set — skipped information_schema validation');
  }

  for (const col of Object.keys(EXPECTED_ATTRIBUTE_COLUMNS)) {
    const { error } = await c.from('events').select(col).limit(1);
    if (error) {
      blockers.push(`service_role cannot select ${col}: ${error.message}`);
    }
  }

  const report = {
    generatedAt: new Date().toISOString(),
    migrationFile: '20260803140000_phase473_canonical_event_attributes.sql',
    migrationApplied: service.migrationApplied,
    publishedEventCount: service.publishedEventCount,
    rowsWithAttributeData: service.rowsWithAttributeData,
    rowsChangedByMigration: 0,
    noImplicitBackfill: service.rowsWithAttributeData === 0,
    columns: columnMeta,
    venueEnvironmentConstraint,
    indexesPresent,
    indexes: indexResults,
    serviceRole: {
      selectNewColumns: blockers.filter((entry) => entry.startsWith('service_role')).length === 0,
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
      blockers.length === 0 &&
      service.rowsWithAttributeData === 0 &&
      service.serviceRoleSelectOk &&
      service.mapperRoundTripOk,
    blockers,
  };

  writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (!report.pass) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
