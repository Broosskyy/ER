import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import type { PipelineRecordEnvelope } from '@/features/aggregation/pipeline/types';
import type { EventIdentitySnapshot } from '@/features/import/ticket-platform-identity/types';

import { canonicalImportEventToEvidenceBundle, adminEventToIdentitySnapshot } from './evidence-from-canonical';
import { evaluateGenericTruthPublish } from './publish-evaluation';
import { resolveServerGenericTruthRollout } from './server-rollout-config';
import type { GenericTruthFieldGroup } from './source-evidence-contract';

export interface LiveShadowMetadataTrace {
  connectorOutput: Record<string, boolean>;
  canonicalImportEvent: Record<string, boolean>;
  evidenceBundle: Record<string, boolean>;
  legacyFallbackUsed: boolean;
  lossStages: string[];
}

export interface LiveShadowEventEvaluation {
  externalId: string;
  eventId?: string;
  candidate: CanonicalImportEvent;
  evaluation: ReturnType<typeof evaluateGenericTruthPublish>;
  metadataTrace: LiveShadowMetadataTrace;
}

export interface LiveShadowSourceResult {
  sourceId: string;
  sourceName: string;
  fetchAttempted: boolean;
  fetchSucceeded: boolean;
  parseSucceeded: boolean;
  fetchedEvents: number;
  evaluatedEvents: number;
  nativeIdentityCoverage: number;
  ticketCoverage: number;
  contentCoverage: number;
  lineupCoverage: number;
  verifiedAtCoverage: number;
  legacyFallbackCount: number;
  policyEligibleFieldGroups: GenericTruthFieldGroup[];
  reviewFieldGroups: GenericTruthFieldGroup[];
  errors: string[];
  events: LiveShadowEventEvaluation[];
}

export interface LiveShadowRunResult {
  sources: LiveShadowSourceResult[];
  totalDatabaseWrites: number;
}

function metadataFlags(meta: Record<string, unknown>): Record<string, boolean> {
  return {
    pageTitle: Boolean(meta.pageTitle),
    listRowTitle: Boolean(meta.listRowTitle),
    eventDate: Boolean(meta.eventDate),
    venueName: Boolean(meta.venueName),
    verifiedAt: Boolean(meta.verifiedAt),
    publicTicketPageUrl: Boolean(meta.publicTicketPageUrl || meta.publicCtaCandidateUrl),
    publicCtaCandidateUrl: Boolean(meta.publicCtaCandidateUrl || meta.publicTicketPageUrl),
    checkoutEvidenceUrl: Boolean(meta.checkoutEvidenceUrl),
    officialOutbound: Boolean(
      Array.isArray(meta.officialOutboundTicketUrls) && meta.officialOutboundTicketUrls.length > 0,
    ),
    description: Boolean(meta.officialDescription || meta.unifiedDescription || meta.ticketPlatformDescription),
    genres: Boolean(
      Array.isArray(meta.unifiedGenres) && meta.unifiedGenres.length > 0 ||
        Array.isArray(meta.officialGenres) && meta.officialGenres.length > 0,
    ),
    lineup: Boolean(meta.lineup || meta.structuredLineup),
  };
}

function traceMetadataLoss(
  rawMeta: Record<string, unknown>,
  canonical: CanonicalImportEvent,
  bundle: ReturnType<typeof canonicalImportEventToEvidenceBundle>,
): LiveShadowMetadataTrace {
  const connectorOutput = metadataFlags(rawMeta);
  const canonicalMeta = (canonical.sourceMetadata as Record<string, unknown> | undefined) ?? {};
  const canonicalImportEvent = metadataFlags(canonicalMeta);
  const evidenceBundle: Record<string, boolean> = {
    pageTitle: Boolean(bundle.identity.pageTitle),
    listRowTitle: Boolean(bundle.identity.listRowTitle),
    eventDate: Boolean(bundle.identity.eventDate),
    venueName: Boolean(bundle.identity.venueName),
    verifiedAt: Boolean(bundle.verifiedAt),
    publicCtaCandidateUrl: Boolean(bundle.tickets?.publicCtaCandidateUrl),
    checkoutEvidenceUrl: Boolean(bundle.tickets?.checkoutEvidenceUrl),
    description: Boolean(bundle.content?.description),
    genres: Boolean(bundle.content?.genreLabels?.length),
    lineup: Boolean(bundle.content?.structuredLineup?.length),
  };

  const lossStages: string[] = [];
  for (const key of Object.keys(connectorOutput)) {
    if (connectorOutput[key] && !canonicalImportEvent[key]) {
      lossStages.push(`canonical:${key}`);
    }
    if (connectorOutput[key] && !evidenceBundle[key]) {
      lossStages.push(`evidence:${key}`);
    }
  }

  return {
    connectorOutput,
    canonicalImportEvent,
    evidenceBundle,
    legacyFallbackUsed: bundle.legacyFallbackUsed,
    lossStages,
  };
}

function withinHorizon(startDate: string | undefined, horizonStart: string, horizonEnd: string): boolean {
  if (!startDate) {
    return false;
  }
  return startDate >= horizonStart && startDate <= horizonEnd;
}

export class GenericTruthLiveShadowRunner {
  private readonly pipeline: AggregationPipeline;

  constructor() {
    this.pipeline = new AggregationPipeline({
      fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
      logService: new AggregationLogService(),
    });
  }

  async runSourceReadOnly(input: {
    sourceRecord: SourceRecord;
    existingByExternalId: Map<string, AdminEventRecord>;
    collisionCatalog: EventIdentitySnapshot[];
    horizonStart: string;
    horizonEnd: string;
    triggeredBy?: string;
  }): Promise<LiveShadowSourceResult> {
    const importSource = mapSourceRecordToImportSource(input.sourceRecord);
    const errors: string[] = [];
    let fetchAttempted = false;
    let fetchSucceeded = false;
    let parseSucceeded = false;
    const eventEvaluations: LiveShadowEventEvaluation[] = [];

    const existingByExternal = input.existingByExternalId;

    try {
      fetchAttempted = true;
      const pipelineResult = await this.pipeline.run(
        input.sourceRecord,
        importSource,
        'manual',
        input.triggeredBy ?? 'phase48662-live-shadow',
      );
      fetchSucceeded = true;
      parseSucceeded = pipelineResult.records.some((record) => record.canonicalEvent != null);

      for (const envelope of pipelineResult.records) {
        if (!envelope.canonicalEvent) {
          continue;
        }
        const candidate = envelope.canonicalEvent;
        if (!withinHorizon(candidate.startDate, input.horizonStart, input.horizonEnd)) {
          continue;
        }

        const existing = existingByExternal.get(envelope.externalId);
        if (!existing) {
          continue;
        }

        const rawMeta =
          (envelope.rawPayload?.sourceMetadata as Record<string, unknown> | undefined) ??
          (candidate.sourceMetadata as Record<string, unknown> | undefined) ??
          {};
        const bundle = canonicalImportEventToEvidenceBundle(candidate);
        const metadataTrace = traceMetadataLoss(rawMeta, candidate, bundle);
        const evaluation = evaluateGenericTruthPublish({
          existing,
          candidate,
          bundle,
          rollout: resolveServerGenericTruthRollout({
            enabled: false,
            writesSuppressed: true,
          }),
          collisionCatalog: input.collisionCatalog,
        });

        eventEvaluations.push({
          externalId: envelope.externalId,
          eventId: existing.id,
          candidate,
          evaluation,
          metadataTrace,
        });
      }
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : 'live_shadow_failed');
    }

    const policyEligibleFieldGroups = new Set<GenericTruthFieldGroup>();
    const reviewFieldGroups = new Set<GenericTruthFieldGroup>();
    let nativeIdentityCoverage = 0;
    let ticketCoverage = 0;
    let contentCoverage = 0;
    let lineupCoverage = 0;
    let verifiedAtCoverage = 0;
    let legacyFallbackCount = 0;

    for (const entry of eventEvaluations) {
      for (const group of entry.evaluation.fieldGroupEligibility.policyEligibleFieldGroups) {
        policyEligibleFieldGroups.add(group);
      }
      for (const group of entry.evaluation.fieldGroupEligibility.reviewRequiredFieldGroups) {
        reviewFieldGroups.add(group);
      }
      if (entry.evaluation.sourceNativeEvidence) {
        nativeIdentityCoverage += 1;
      }
      if (entry.evaluation.evidenceCoverage.tickets) {
        ticketCoverage += 1;
      }
      if (entry.evaluation.evidenceCoverage.description) {
        contentCoverage += 1;
      }
      if (entry.evaluation.evidenceCoverage.lineup) {
        lineupCoverage += 1;
      }
      if (entry.evaluation.evidenceCoverage.verifiedAt) {
        verifiedAtCoverage += 1;
      }
      if (entry.evaluation.legacyFallbackUsed) {
        legacyFallbackCount += 1;
      }
    }

    const evaluated = eventEvaluations.length;
    return {
      sourceId: input.sourceRecord.id,
      sourceName: input.sourceRecord.displayName,
      fetchAttempted,
      fetchSucceeded,
      parseSucceeded,
      fetchedEvents: eventEvaluations.length,
      evaluatedEvents: evaluated,
      nativeIdentityCoverage: evaluated > 0 ? nativeIdentityCoverage / evaluated : 0,
      ticketCoverage: evaluated > 0 ? ticketCoverage / evaluated : 0,
      contentCoverage: evaluated > 0 ? contentCoverage / evaluated : 0,
      lineupCoverage: evaluated > 0 ? lineupCoverage / evaluated : 0,
      verifiedAtCoverage: evaluated > 0 ? verifiedAtCoverage / evaluated : 0,
      legacyFallbackCount,
      policyEligibleFieldGroups: [...policyEligibleFieldGroups],
      reviewFieldGroups: [...reviewFieldGroups],
      errors,
      events: eventEvaluations,
    };
  }
}

export function buildCollisionCatalog(events: AdminEventRecord[]): EventIdentitySnapshot[] {
  return events.map((event) => adminEventToIdentitySnapshot(event));
}

export function filterEnvelopeRecords(records: PipelineRecordEnvelope[]): PipelineRecordEnvelope[] {
  return records.filter((record) => record.canonicalEvent != null);
}
