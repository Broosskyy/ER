import { calculateConnectorQualityScore } from '@/features/aggregation/connectors/framework/detail-extraction';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import type { SourceRecord } from '@/data/types/records';
import type { ImportJob } from '@/features/import/models/types';
import { mapSourceRecordToRegistryEntry } from '@/features/sources/domain/source-registry';
import { sourceHealthResolver } from '@/features/sources/domain/source-health-resolver';
import { resolveSourceCapabilityDeclaration } from '@/features/sources/domain/source-capability-declaration';
import {
  analyzeFieldCoverage,
  parseCoverageEventFromRecord,
  type CoverageEventInput,
} from '@/features/sources/domain/source-field-coverage-analyzer';
import { detectSourceRegressions } from '@/features/sources/domain/source-regression-detector';
import type {
  SourceImportHealthSnapshot,
  SourceReliabilityMetadata,
  SourceReliabilitySummary,
} from '@/features/sources/domain/source-reliability-types';
import { getFieldReliability } from '@/features/sources/domain/source-capability-declaration';

function readReliabilityMetadata(source: SourceRecord): SourceReliabilityMetadata {
  const raw = source.metadata?.reliability;
  if (!raw || typeof raw !== 'object') {
    return { updatedAt: new Date().toISOString() };
  }
  return raw as SourceReliabilityMetadata;
}

function countDetailBlocked(events: CoverageEventInput[]): number {
  return events.filter((event) => {
    const metadata = event.sourceMetadata as Record<string, unknown> | undefined;
    return metadata?.detailEnrichment === 'blocked' || metadata?.lineupBlockerClass != null;
  }).length;
}

export function buildSourceReliabilitySummary(
  source: SourceRecord,
  events: CoverageEventInput[],
  options?: {
    importJob?: ImportJob;
    eventsFailed?: number;
    eventsWithWarnings?: number;
  },
): SourceReliabilitySummary {
  const declaration = resolveSourceCapabilityDeclaration(source);
  const registryEntry = mapSourceRecordToRegistryEntry(source);
  const health = sourceHealthResolver.resolve(registryEntry);
  const quality = calculateConnectorQualityScore({ source: registryEntry, health });
  const metadata = readReliabilityMetadata(source);
  const coverage = analyzeFieldCoverage(source.id, events);
  const regressions = detectSourceRegressions({
    sourceId: source.id,
    declaration,
    currentFields: coverage.fields,
    baselineFields: metadata.baselineCoverage?.fields,
    detailBlockedCount: countDetailBlocked(events),
    totalEvents: events.length,
  });

  const blockedFields = declaration.fieldReliability
    .filter((entry) => entry.status === 'blocked')
    .map((entry) => entry.field);

  return {
    declaration,
    healthScore: health.score,
    qualityScore: quality.score,
    coverage,
    regressions,
    blockedFields,
    lastSuccessfulImportAt: source.lastSuccessfulSyncAt ?? source.lastImportAt,
    metadata,
  };
}

export function buildImportHealthSnapshot(input: {
  source: SourceRecord;
  job: ImportJob;
  events: CoverageEventInput[];
  eventsFailed?: number;
  eventsWithWarnings?: number;
}): SourceImportHealthSnapshot {
  const declaration = resolveSourceCapabilityDeclaration(input.source);
  const metadata = readReliabilityMetadata(input.source);
  const coverage = analyzeFieldCoverage(input.source.id, input.events);
  const regressions = detectSourceRegressions({
    sourceId: input.source.id,
    declaration,
    currentFields: coverage.fields,
    baselineFields: metadata.baselineCoverage?.fields,
    detailBlockedCount: countDetailBlocked(input.events),
    totalEvents: input.events.length,
  });

  return {
    importJobId: input.job.id,
    eventsImported: input.events.length,
    eventsFailed: input.eventsFailed ?? input.job.metrics.errorCount,
    eventsWithWarnings: input.eventsWithWarnings ?? input.job.metrics.warningCount,
    detailBlockedCount: countDetailBlocked(input.events),
    coverage,
    regressions,
    calculatedAt: new Date().toISOString(),
  };
}

export function applyImportReliabilitySnapshot(
  source: SourceRecord,
  snapshot: SourceImportHealthSnapshot,
): SourceRecord {
  const now = new Date().toISOString();
  const previous = readReliabilityMetadata(source);
  const hasRegression = snapshot.regressions.regressions.some(
    (entry) => entry.severity === 'warning' || entry.severity === 'critical',
  );

  const nextMetadata: SourceReliabilityMetadata = {
    ...previous,
    lastSnapshot: snapshot,
    baselineCoverage: previous.baselineCoverage ?? snapshot.coverage,
    updatedAt: now,
    lastRegressionAt: hasRegression ? now : previous.lastRegressionAt,
  };

  return {
    ...source,
    metadata: {
      ...(source.metadata ?? {}),
      reliability: nextMetadata,
    },
    updatedAt: now,
  };
}

export function eventsFromImportRecords(
  records: Array<{ normalizedPayload?: Record<string, unknown>; status: string }>,
): CoverageEventInput[] {
  return records
    .filter((record) => record.status !== 'rejected' && record.status !== 'invalid')
    .map((record) => parseCoverageEventFromRecord(record.normalizedPayload))
    .filter((event): event is CoverageEventInput => event != null);
}

export function eventsFromCanonical(events: CanonicalImportEvent[]): CoverageEventInput[] {
  return events;
}

export function isFieldSupportedBySource(
  source: SourceRecord,
  ownershipField: string,
): boolean {
  const declaration = resolveSourceCapabilityDeclaration(source);
  const capabilityField = mapOwnershipFieldToCapability(ownershipField);
  if (!capabilityField) {
    return true;
  }
  const reliability = getFieldReliability(declaration, capabilityField);
  return reliability.status !== 'unsupported' && reliability.status !== 'blocked';
}

const OWNERSHIP_TO_CAPABILITY: Record<string, import('@/features/sources/domain/source-capability-fields').SourceCapabilityField> = {
  title: 'title',
  description: 'description',
  lineup: 'lineup',
  artists: 'lineup',
  ticketUrl: 'ticketUrl',
  eventUrl: 'eventUrl',
  genres: 'genres',
  priceText: 'priceText',
  ticketStatus: 'ticketStatus',
  venueName: 'venueName',
  venueAddress: 'venueAddress',
  coordinates: 'coordinates',
  organizerName: 'organizerName',
  imageUrl: 'images',
  websiteUrl: 'eventUrl',
};

function mapOwnershipFieldToCapability(
  ownershipField: string,
): import('@/features/sources/domain/source-capability-fields').SourceCapabilityField | undefined {
  return OWNERSHIP_TO_CAPABILITY[ownershipField];
}
