/**
 * Sprint 28.2 — Affenkäfig controlled live import helpers.
 * Dry-run simulation uses live fetch only; no fixture fallback.
 */
import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import { websiteProcessor } from '@/features/aggregation/connectors/website/processor';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import type { PipelineRecordEnvelope } from '@/features/aggregation/pipeline/types';
import { importUpdateService } from '@/features/aggregation/services/import-update-service';
import { createImportMatchingService } from '@/features/import/matching/create-import-matching-service';
import { InMemoryEntityAliasStore } from '@/features/entity-resolution/entity-alias-store';
import { loadMatchingCatalog } from '@/features/import/matching/matching-catalog';
import type { MatchResult } from '@/features/import/matching/match-result';
import { PublishDecisionService } from '@/features/import/services/publish-decision-service';
import { resolveConfidenceTier } from '@/features/multi-source-matching/domain/matching-config';
import {
  AFFENKAEFIG_EVENTS_URL,
  AFFENKAEFIG_SOURCE_ID,
  createAffenkaefigLiveProductionSourceRecord,
} from '@/features/sources/production/affenkaefig-source';
import type { SourceRecord } from '@/data/types/records';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { ImportRecord } from '@/features/import/models/types';

export interface AffenkaefigLiveFetchReport {
  fetchedAt: string;
  listUrl: string;
  httpStatus: number;
  finalUrl: string;
  strategy: string;
  detailPagesFetched: number;
  eventCount: number;
  validEventCount: number;
  events: Array<{
    externalId: string;
    title: string;
    startDate?: string;
    venueName?: string;
    organizerName?: string;
    imageUrl?: string;
    ticketUrl?: string;
    eventUrl?: string;
  }>;
  errors: string[];
}

export interface AffenkaefigSimulatedEventReport {
  externalId: string;
  title: string;
  startDate?: string;
  venueName?: string;
  organizerName?: string;
  imageUrl?: string;
  ticketUrl?: string;
  canonicalUrl?: string;
  pipelineStatus: string;
  importAction: 'insert' | 'update' | 'skip' | 'duplicate';
  duplicateEventId?: string;
  duplicateScore?: number;
  reviewRequired: boolean;
  publishDecision: 'publish' | 'queue_for_review' | 'skip';
  confidenceTier: 'certain' | 'probable' | 'uncertain';
  venueMatchId?: string;
  organizerMatchId?: string;
  artistMatchIds?: string[];
  matchingWarnings: string[];
}

export interface AffenkaefigDryRunReport {
  runId: string;
  fetchedAt: string;
  eventCount: number;
  inserts: number;
  updates: number;
  skips: number;
  duplicates: number;
  reviewsRequired: number;
  events: AffenkaefigSimulatedEventReport[];
}

export interface AffenkaefigIdempotencyComparison {
  firstRun: Pick<AffenkaefigDryRunReport, 'eventCount' | 'inserts' | 'updates' | 'skips' | 'duplicates' | 'reviewsRequired'>;
  secondRun: Pick<AffenkaefigDryRunReport, 'eventCount' | 'inserts' | 'updates' | 'skips' | 'duplicates' | 'reviewsRequired'>;
  idempotent: boolean;
  externalIdsStable: boolean;
}

function buildImportableSourceRecord(): SourceRecord {
  return createAffenkaefigLiveProductionSourceRecord({
    enabled: true,
    reviewRequired: true,
    publishMode: 'manual_review',
  });
}

function toSimulatedImportRecord(
  envelope: PipelineRecordEnvelope,
  source: SourceRecord,
  match: MatchResult,
): ImportRecord {
  const candidate = envelope.canonicalEvent;
  return {
    id: `dry-run-${envelope.externalId}`,
    importJobId: 'dry-run',
    sourceId: source.id,
    externalId: envelope.externalId,
    sourceUrl: candidate?.sourceUrl ?? candidate?.originalLink,
    sourceType: source.sourceType,
    sourceName: source.displayName,
    originalUrl: candidate?.originalLink ?? candidate?.eventUrl,
    retrievedAt: new Date().toISOString(),
    rawPayload: envelope.rawPayload ?? {},
    normalizedPayload: candidate ? (candidate as unknown as Record<string, unknown>) : undefined,
    validationErrors: envelope.validationErrors,
    validationWarnings: envelope.validationWarnings,
    matchedCityId: match.matchedCityId,
    matchedVenueId: match.matchedVenueId,
    matchedOrganizerId: match.matchedOrganizerId,
    matchedArtistIds: match.matchedArtistIds,
    matchedGenreIds: match.matchedGenreIds,
    duplicateEventId: envelope.duplicateEventId ?? match.duplicateEventId,
    duplicateScore: envelope.duplicateScore ?? match.duplicateScore,
    matchingWarnings: match.warnings,
    status:
      envelope.status === 'duplicate'
        ? 'duplicate'
        : envelope.status === 'rejected'
          ? 'rejected'
          : 'needs_review',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function resolveImportAction(
  envelope: PipelineRecordEnvelope,
  existingExternalIds: Set<string>,
): 'insert' | 'update' | 'skip' | 'duplicate' {
  if (envelope.status === 'duplicate') {
    return 'duplicate';
  }
  if (envelope.status === 'rejected' || !envelope.canonicalEvent) {
    return 'skip';
  }
  return existingExternalIds.has(envelope.externalId) ? 'update' : 'insert';
}

function duplicateConfidenceScore(duplicateScore?: number): number {
  if (duplicateScore === undefined) {
    return 75;
  }
  return Math.max(0, Math.min(100, Math.round(duplicateScore * 100)));
}

export async function runAffenkaefigLiveFetch(): Promise<AffenkaefigLiveFetchReport> {
  const sourceRecord = buildImportableSourceRecord();
  const importSource = mapSourceRecordToImportSource(sourceRecord);
  const errors: string[] = [];

  let httpStatus = 0;
  let finalUrl = AFFENKAEFIG_EVENTS_URL;
  try {
    const response = await fetch(AFFENKAEFIG_EVENTS_URL, {
      headers: {
        'User-Agent': sourceRecord.sourceConfig?.website?.userAgent ?? 'EternalRave-SourceBot/1.0',
        Accept: 'text/html',
      },
      redirect: 'follow',
    });
    httpStatus = response.status;
    finalUrl = response.url;
    if (!response.ok) {
      errors.push(`List fetch failed with status ${response.status}`);
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const output = await websiteProcessor.process({
    url: AFFENKAEFIG_EVENTS_URL,
    importSource,
    connectorKey: 'organizer_website',
  });

  return {
    fetchedAt: new Date().toISOString(),
    listUrl: AFFENKAEFIG_EVENTS_URL,
    httpStatus,
    finalUrl,
    strategy: output.result.diagnostics.strategy,
    detailPagesFetched: output.result.diagnostics.detailPagesFetched,
    eventCount: output.events.length,
    validEventCount: output.result.diagnostics.validEventCount,
    events: output.events.map((event: RawImportedEvent) => ({
      externalId: event.externalId,
      title: event.title ?? '',
      startDate: event.startDate,
      venueName: event.venueName,
      organizerName: event.organizerName,
      imageUrl: event.imageUrl,
      ticketUrl: event.ticketUrl,
      eventUrl: event.eventUrl ?? event.sourceUrl,
    })),
    errors,
  };
}

export async function simulateAffenkaefigControlledImport(input?: {
  existingExternalIds?: Set<string>;
  runId?: string;
}): Promise<AffenkaefigDryRunReport> {
  const sourceRecord = buildImportableSourceRecord();
  const importSource = mapSourceRecordToImportSource(sourceRecord);
  const existingExternalIds = input?.existingExternalIds ?? new Set<string>();
  const runId = input?.runId ?? `affenkaefig-dry-run-${Date.now()}`;
  const pipeline = new AggregationPipeline({
    fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
  });
  const { matchingService } = createImportMatchingService(new InMemoryEntityAliasStore());
  const publishDecision = new PublishDecisionService();
  const catalog = await loadMatchingCatalog();

  const result = await pipeline.run(sourceRecord, importSource, 'manual', 'affenkaefig-controlled-import');
  const events: AffenkaefigSimulatedEventReport[] = [];

  let inserts = 0;
  let updates = 0;
  let skips = 0;
  let duplicates = 0;
  let reviewsRequired = 0;

  for (const envelope of result.records) {
    const importAction = resolveImportAction(envelope, existingExternalIds);
    if (importAction === 'insert') inserts += 1;
    if (importAction === 'update') updates += 1;
    if (importAction === 'skip') skips += 1;
    if (importAction === 'duplicate') duplicates += 1;

    const candidate = envelope.canonicalEvent;
    const emptyMatch = {
      matchedCityId: undefined,
      matchedVenueId: undefined,
      matchedOrganizerId: undefined,
      matchedArtistIds: undefined,
      matchedGenreIds: undefined,
      warnings: [] as string[],
      duplicateEventId: undefined,
      duplicateScore: undefined,
      details: {},
    } satisfies MatchResult;

    const match = candidate
      ? matchingService.match(
          {
            externalId: envelope.externalId,
            title: candidate.title,
            description: candidate.description,
            startDate: candidate.startDate,
            endDate: candidate.endDate,
            venueName: candidate.venueName,
            cityName: candidate.cityName,
            countryCode: candidate.countryCode,
            latitude: candidate.latitude,
            longitude: candidate.longitude,
            artistNames: candidate.artistNames,
            genreNames: candidate.genreNames,
            ticketUrl: candidate.ticketUrl,
            eventUrl: candidate.eventUrl ?? candidate.originalLink,
            imageUrl: candidate.imageUrl,
            organizerName: candidate.organizerName,
            sourceId: candidate.sourceId ?? AFFENKAEFIG_SOURCE_ID,
            sourceName: candidate.sourceName ?? sourceRecord.displayName,
            rawSourceType: candidate.rawSourceType,
          },
          catalog,
        ).result
      : emptyMatch;

    const simulatedRecord = toSimulatedImportRecord(envelope, sourceRecord, match);
    const decision = await publishDecision.decide({ source: sourceRecord, record: simulatedRecord });
    const reviewRequired = decision === 'queue_for_review';
    if (reviewRequired) {
      reviewsRequired += 1;
    }

    const confidenceTier = resolveConfidenceTier(
      duplicateConfidenceScore(envelope.duplicateScore ?? match.duplicateScore),
    );

    events.push({
      externalId: envelope.externalId,
      title: candidate?.title ?? envelope.externalId,
      startDate: candidate?.startDate,
      venueName: candidate?.venueName,
      organizerName: candidate?.organizerName,
      imageUrl: candidate?.imageUrl,
      ticketUrl: candidate?.ticketUrl,
      canonicalUrl: candidate?.eventUrl ?? candidate?.originalLink,
      pipelineStatus: envelope.status,
      importAction,
      duplicateEventId: envelope.duplicateEventId ?? match.duplicateEventId,
      duplicateScore: envelope.duplicateScore ?? match.duplicateScore,
      reviewRequired,
      publishDecision: decision,
      confidenceTier,
      venueMatchId: match.matchedVenueId,
      organizerMatchId: match.matchedOrganizerId,
      artistMatchIds: match.matchedArtistIds,
      matchingWarnings: match.warnings,
    });

    if (importAction === 'insert') {
      existingExternalIds.add(envelope.externalId);
    }
  }

  return {
    runId,
    fetchedAt: new Date().toISOString(),
    eventCount: events.length,
    inserts,
    updates,
    skips,
    duplicates,
    reviewsRequired,
    events,
  };
}

export async function compareAffenkaefigDryRunIdempotency(): Promise<{
  firstRun: AffenkaefigDryRunReport;
  secondRun: AffenkaefigDryRunReport;
  comparison: AffenkaefigIdempotencyComparison;
}> {
  const firstRun = await simulateAffenkaefigControlledImport({ runId: 'dry-run-1' });
  const existing = new Set(firstRun.events.map((event) => event.externalId));
  const secondRun = await simulateAffenkaefigControlledImport({
    runId: 'dry-run-2',
    existingExternalIds: existing,
  });

  const comparison: AffenkaefigIdempotencyComparison = {
    firstRun: {
      eventCount: firstRun.eventCount,
      inserts: firstRun.inserts,
      updates: firstRun.updates,
      skips: firstRun.skips,
      duplicates: firstRun.duplicates,
      reviewsRequired: firstRun.reviewsRequired,
    },
    secondRun: {
      eventCount: secondRun.eventCount,
      inserts: secondRun.inserts,
      updates: secondRun.updates,
      skips: secondRun.skips,
      duplicates: secondRun.duplicates,
      reviewsRequired: secondRun.reviewsRequired,
    },
    idempotent: secondRun.inserts === 0 && secondRun.duplicates === 0 && secondRun.eventCount === firstRun.eventCount,
    externalIdsStable:
      firstRun.events.map((event) => event.externalId).join('|') ===
      secondRun.events.map((event) => event.externalId).join('|'),
  };

  return { firstRun, secondRun, comparison };
}

export function summarizePublishReadiness(events: AffenkaefigSimulatedEventReport[]) {
  return {
    publishReady: events.filter((event) => event.publishDecision === 'publish').length,
    reviewRequired: events.filter((event) => event.reviewRequired).length,
    duplicate: events.filter((event) => event.importAction === 'duplicate').length,
    missingData: events.filter((event) => !event.startDate || !event.title).length,
    blocked: events.filter((event) => event.publishDecision === 'skip').length,
  };
}

export { importUpdateService };
