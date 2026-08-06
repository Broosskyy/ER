/**
 * Phase 4.7.0 — Source Reliability audit (read-only).
 * Generates capability matrix, health, coverage, regression, and blocker reports.
 */
import './bootstrap-ops-supabase';

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { mapSourceRowToRecord } from '@/data/mappers/source-mapper';
import type { SourceRow } from '@/data/datasources/supabase/types';
import { PRODUCTION_CONNECTOR_SOURCE_IDS } from '@/features/aggregation/connectors/framework/detail-extraction/connector-field-coverage';
import { resolveSourceCapabilityDeclaration } from '@/features/sources/domain/source-capability-declaration';
import {
  analyzeFieldCoverage,
  parseCoverageEventFromRecord,
} from '@/features/sources/domain/source-field-coverage-analyzer';
import { detectSourceRegressions } from '@/features/sources/domain/source-regression-detector';
import { buildSourceReliabilitySummary } from '@/features/sources/domain/source-reliability-service';
import { mapSourceRecordToRegistryEntry } from '@/features/sources/domain/source-registry';
import { sourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import { getSupabaseServiceClient } from '@/services/supabase/client-service-role';

const DOCS = join(process.cwd(), 'docs');
const REAL_DATA = join(DOCS, 'real-data');

const VALIDATION_SOURCE_IDS = [
  ...PRODUCTION_CONNECTOR_SOURCE_IDS,
  'source-ticket-kings-org-underland',
  'source-ticket-kings-org-m-d-m-a-musik-die-mich-antreibt',
  'source-affenkaefig-ticket-kings',
  'source-musik-die-mich-antreibt',
] as const;

function client() {
  return getSupabaseServiceClient();
}

async function loadSource(sourceId: string) {
  const { data, error } = await client().from('sources').select('*').eq('id', sourceId).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    return null;
  }
  return mapSourceRowToRecord(data as SourceRow);
}

async function loadCoverageEvents(sourceId: string) {
  const { data, error } = await client()
    .from('import_records')
    .select('status,normalized_payload')
    .eq('source_id', sourceId)
    .in('status', ['imported', 'published', 'reviewed', 'updated'])
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((row) => parseCoverageEventFromRecord(row.normalized_payload as Record<string, unknown> | undefined))
    .filter((event): event is NonNullable<typeof event> => event != null);
}

async function main(): Promise<void> {
  const generatedAt = new Date().toISOString();
  const capabilityMatrix: Record<string, unknown>[] = [];
  const healthReport: Record<string, unknown>[] = [];
  const fieldCoverage: Record<string, unknown>[] = [];
  const regressions: Record<string, unknown>[] = [];
  const blockers: Record<string, unknown>[] = [];
  const topFailingConnectors: Array<{ sourceId: string; errorRate: number; healthScore: number }> = [];
  const topDegradedFields: Array<{ sourceId: string; field: string; severity: string }> = [];

  for (const sourceId of VALIDATION_SOURCE_IDS) {
    const source = await loadSource(sourceId);
    if (!source) {
      console.warn(`Skipping missing source: ${sourceId}`);
      continue;
    }

    const declaration = resolveSourceCapabilityDeclaration(source);
    const events = await loadCoverageEvents(source.id);
    const coverage = analyzeFieldCoverage(source.id, events);
    const summary = buildSourceReliabilitySummary(source, events);
    const registryEntry = mapSourceRecordToRegistryEntry(source);
    const health = sourceHealthResolver.resolve(registryEntry);
    const baselineFields = summary.metadata.baselineCoverage?.fields ?? coverage.fields;
    const regressionReport = detectSourceRegressions({
      sourceId: source.id,
      declaration,
      currentFields: coverage.fields,
      baselineFields,
      detailBlockedCount: summary.metadata.lastSnapshot?.detailBlockedCount ?? 0,
      totalEvents: events.length,
    });

    capabilityMatrix.push({
      sourceId: source.id,
      displayName: source.displayName,
      connectorKey: declaration.connectorKey,
      originType: declaration.originType,
      detailLevel: declaration.detailLevel,
      expectedFields: declaration.expectedFields,
      fieldReliability: declaration.fieldReliability,
      listFields: declaration.listFields,
      detailFields: declaration.detailFields,
      lostFields: declaration.lostFields,
    });

    healthReport.push({
      sourceId: source.id,
      displayName: source.displayName,
      healthStatus: health.status,
      healthScore: health.score,
      qualityScore: summary.qualityScore,
      lastImportAt: source.lastImportAt,
      lastSuccessfulSyncAt: source.lastSuccessfulSyncAt,
      consecutiveFailureCount: source.consecutiveFailureCount ?? 0,
      errorRate: source.errorRate ?? health.metrics.errorRate,
      eventsAnalyzed: events.length,
      lastRegressionAt: summary.metadata.lastRegressionAt,
    });

    fieldCoverage.push({
      sourceId: source.id,
      displayName: source.displayName,
      totalEvents: coverage.totalEvents,
      fields: coverage.fields,
    });

    regressions.push({
      sourceId: source.id,
      displayName: source.displayName,
      regressions: regressionReport.regressions,
      warnings: regressionReport.warnings,
    });

    const blocked = declaration.fieldReliability.filter((entry) => entry.status === 'blocked');
    if (blocked.length > 0 || declaration.detailBlockedDefault) {
      blockers.push({
        sourceId: source.id,
        displayName: source.displayName,
        detailBlockedDefault: declaration.detailBlockedDefault,
        blockedFields: blocked.map((entry) => entry.field),
        detailLevel: declaration.detailLevel,
      });
    }

    topFailingConnectors.push({
      sourceId: source.id,
      errorRate: source.errorRate ?? health.metrics.errorRate,
      healthScore: health.score,
    });

    for (const entry of regressionReport.regressions) {
      if (entry.severity === 'warning' || entry.severity === 'critical') {
        topDegradedFields.push({
          sourceId: source.id,
          field: entry.field,
          severity: entry.severity,
        });
      }
    }
  }

  topFailingConnectors.sort((left, right) => right.errorRate - left.errorRate);
  topDegradedFields.sort((left, right) => (left.severity === 'critical' ? -1 : 0));

  const payload = {
    generatedAt,
    validationSourceCount: capabilityMatrix.length,
    topFailingConnectors: topFailingConnectors.slice(0, 10),
    topDegradedFields: topDegradedFields.slice(0, 20),
  };

  writeFileSync(join(REAL_DATA, 'source_capability_matrix.json'), JSON.stringify(capabilityMatrix, null, 2));
  writeFileSync(join(REAL_DATA, 'source_health_report.json'), JSON.stringify(healthReport, null, 2));
  writeFileSync(join(REAL_DATA, 'source_field_coverage.json'), JSON.stringify(fieldCoverage, null, 2));
  writeFileSync(join(REAL_DATA, 'source_regressions.json'), JSON.stringify(regressions, null, 2));
  writeFileSync(join(REAL_DATA, 'source_blockers.json'), JSON.stringify(blockers, null, 2));
  writeFileSync(join(REAL_DATA, '_phase470_source_reliability_audit.json'), JSON.stringify(payload, null, 2));

  console.log(`Phase 4.7.0 audit complete — ${capabilityMatrix.length} sources analyzed`);
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
