import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { SourceRecord } from '@/data/types/records';
import { mapSourceRecordToAggregationSource } from '@/features/aggregation/domain/aggregation-source';
import {
  sourceConnectorRegistry,
  type SourceConnectorRegistry,
} from '@/features/aggregation/connectors/source-connector-registry';
import { resolveSourceConnectorKeyFromRecord } from '@/features/aggregation/connectors/source-connector-resolution';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import type { PipelineRunContext } from '@/features/aggregation/pipeline/types';

import { CanonicalEventBuilder } from './canonical-event-builder';
import {
  NoopCleanImportPersistence,
  type CleanImportPersistence,
  type CleanImportPersistenceResult,
} from './clean-import-persistence';
import {
  CrossSourceEventResolver,
  type ResolvedEventCluster,
  type ResolvableEventContribution,
} from './cross-source-event-resolver';
import type {
  CanonicalEvent,
  CleanImportDecision,
  CleanSourceFamily,
  EventEvidence,
} from './event-evidence';
import { IdentityResolver } from './identity-resolver';
import {
  bridgeProductionSourceEvidence,
  type EvidenceTransferAudit,
} from './production-evidence-bridge';
import { ReviewDecision, type ReviewDecisionResult } from './review-decision';
import { SourceAdapter } from './source-adapter';

export interface SourceRunResult {
  sourceId: string;
  status: 'success' | 'error';
  rawEventCount: number;
  contributionIds: string[];
  error?: string;
}

export type CleanMultiSourceDecision = CleanImportDecision | 'historical_preserve';

export interface CleanClusterDecision extends Omit<ReviewDecisionResult, 'decision'> {
  clusterId: string;
  decision: CleanMultiSourceDecision;
}

export interface CleanImportDiagnostics {
  sourceCount: number;
  successfulSourceCount: number;
  failedSourceCount: number;
  contributionCount: number;
  clusterCount: number;
  unexpectedEvidenceTransferLoss: number;
  resolverDiagnostics: string[];
  databaseWriteOperations: number;
}

export interface CleanImportRunResult {
  sourceResults: SourceRunResult[];
  contributions: EventEvidence[];
  clusters: ResolvedEventCluster[];
  canonicalEvents: CanonicalEvent[];
  decisions: CleanClusterDecision[];
  diagnostics: CleanImportDiagnostics;
}

export interface CleanImportRunInput {
  now?: Date;
  persistence?: CleanImportPersistence;
}

export interface CleanImportSourceCollection {
  listActiveSources(): Promise<SourceRecord[]>;
  executeSource(source: SourceRecord): Promise<RawImportedEvent[]>;
}

function sourceFamily(source: SourceRecord): CleanSourceFamily {
  if (source.sourceType === 'website') return 'official_website';
  const platform = (source.sourceConfig?.ticketPlatform as { platform?: string } | undefined)
    ?.platform;
  if (source.sourceType === 'ticket_platform' && platform === 'ticket_io') {
    return 'ticket_io';
  }
  if (source.sourceType === 'ticket_platform' && platform === 'ticket_king') {
    return 'ticket_kings';
  }
  throw new Error(`unsupported_clean_source_family:${source.id}`);
}

export class ProductionCleanImportSourceCollection implements CleanImportSourceCollection {
  constructor(
    private readonly sourceLoader: () => Promise<SourceRecord[]>,
    private readonly connectorRegistry: SourceConnectorRegistry = sourceConnectorRegistry,
  ) {}

  async listActiveSources(): Promise<SourceRecord[]> {
    return (await this.sourceLoader())
      .filter((source) => source.enabled && !source.archived)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async executeSource(source: SourceRecord): Promise<RawImportedEvent[]> {
    const connectorKey = resolveSourceConnectorKeyFromRecord(source);
    const aggregationSource = mapSourceRecordToAggregationSource(source);
    const importSource = mapSourceRecordToImportSource(source);
    const context: PipelineRunContext = {
      runId: `clean-multi-source-${source.id}-${Date.now()}`,
      source: aggregationSource,
      triggerType: 'scheduled',
      startedAt: new Date().toISOString(),
    };
    return (
      await this.connectorRegistry
        .getExecutor()
        .execute(this.connectorRegistry.get(connectorKey), aggregationSource, importSource, context)
    ).events;
  }
}

interface CollectedContribution extends ResolvableEventContribution {
  transferAudit: EvidenceTransferAudit;
}

function stableRawEvents(events: RawImportedEvent[]): RawImportedEvent[] {
  return [...events].sort((left, right) =>
    [left.externalId, left.eventUrl ?? left.originalLink ?? left.sourceUrl ?? '']
      .join('|')
      .localeCompare(
        [right.externalId, right.eventUrl ?? right.originalLink ?? right.sourceUrl ?? ''].join('|'),
      ),
  );
}

function contributionId(sourceId: string, raw: RawImportedEvent, duplicateIndex: number): string {
  const suffix = duplicateIndex > 0 ? `:${duplicateIndex}` : '';
  return `${sourceId}:${raw.externalId}${suffix}`;
}

function isHistorical(event: CanonicalEvent, now: Date): boolean {
  const timestamp = Date.parse(event.endDate ?? event.startDate);
  return Number.isFinite(timestamp) && timestamp < now.getTime();
}

/** Collects all source evidence before any identity or canonical decision is made. */
export class CleanMultiSourceImportService {
  constructor(
    private readonly collection: CleanImportSourceCollection,
    private readonly resolver = new CrossSourceEventResolver(),
    private readonly sourceAdapter = new SourceAdapter(),
    private readonly identityResolver = new IdentityResolver(),
    private readonly canonicalEventBuilder = new CanonicalEventBuilder(),
    private readonly reviewDecision = new ReviewDecision(),
  ) {}

  async run(input: CleanImportRunInput = {}): Promise<CleanImportRunResult> {
    const now = input.now ?? new Date();
    const persistence = input.persistence ?? new NoopCleanImportPersistence();
    const sources = (await this.collection.listActiveSources())
      .filter((source) => source.enabled && !source.archived)
      .sort((left, right) => left.id.localeCompare(right.id));
    const sourceResults: SourceRunResult[] = [];
    const collected: CollectedContribution[] = [];

    for (const source of sources) {
      try {
        const family = sourceFamily(source);
        const rawEvents = stableRawEvents(await this.collection.executeSource(source));
        const duplicateCounts = new Map<string, number>();
        const contributionIds: string[] = [];
        for (const raw of rawEvents) {
          const duplicateIndex = duplicateCounts.get(raw.externalId) ?? 0;
          duplicateCounts.set(raw.externalId, duplicateIndex + 1);
          const id = contributionId(source.id, raw, duplicateIndex);
          const bridged = bridgeProductionSourceEvidence({
            sourceId: source.id,
            sourceFamily: family,
            rawEvent: raw,
          });
          contributionIds.push(id);
          collected.push({
            contributionId: id,
            externalId: raw.externalId,
            evidence: this.sourceAdapter.adapt(bridged.output),
            transferAudit: bridged.audit,
          });
        }
        sourceResults.push({
          sourceId: source.id,
          status: 'success',
          rawEventCount: rawEvents.length,
          contributionIds,
        });
      } catch (error) {
        sourceResults.push({
          sourceId: source.id,
          status: 'error',
          rawEventCount: 0,
          contributionIds: [],
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const resolution = this.resolver.resolve(collected);
    const canonicalEvents: CanonicalEvent[] = [];
    const decisions: CleanClusterDecision[] = [];
    for (const cluster of resolution.clusters) {
      const identity = this.identityResolver.resolve(
        cluster.contributions.map((entry) => entry.evidence),
      );
      const canonicalEvent = this.canonicalEventBuilder.build(identity);
      if (canonicalEvent) canonicalEvents.push(canonicalEvent);
      const reviewed = this.reviewDecision.decide(canonicalEvent, identity);
      decisions.push({
        clusterId: cluster.clusterId,
        ...reviewed,
        decision:
          canonicalEvent && isHistorical(canonicalEvent, now)
            ? 'historical_preserve'
            : reviewed.decision === 'reject'
              ? 'review'
              : reviewed.decision,
      });
    }

    const result: CleanImportRunResult = {
      sourceResults,
      contributions: collected.map((entry) => entry.evidence),
      clusters: resolution.clusters,
      canonicalEvents,
      decisions,
      diagnostics: {
        sourceCount: sources.length,
        successfulSourceCount: sourceResults.filter((entry) => entry.status === 'success').length,
        failedSourceCount: sourceResults.filter((entry) => entry.status === 'error').length,
        contributionCount: collected.length,
        clusterCount: resolution.clusters.length,
        unexpectedEvidenceTransferLoss: collected.reduce(
          (total, entry) => total + entry.transferAudit.unexpectedLostFields.length,
          0,
        ),
        resolverDiagnostics: resolution.diagnostics,
        databaseWriteOperations: 0,
      },
    };
    const persistenceResult: CleanImportPersistenceResult = await persistence.persist(result);
    result.diagnostics.databaseWriteOperations = persistenceResult.databaseWriteOperations;
    return result;
  }
}
