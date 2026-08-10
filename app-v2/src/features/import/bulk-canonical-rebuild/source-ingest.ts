import { mapSourceRecordToImportSource } from '@/data/mappers/source-mapper';
import type { AdminEventRecord, SourceRecord } from '@/data/types/records';
import { createSourceConnectorFetchProvider } from '@/features/aggregation/connectors/create-source-connector-fetch-provider';
import { sourceConnectorRegistry } from '@/features/aggregation/connectors/source-connector-registry';
import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { AggregationLogService } from '@/features/aggregation/logging/aggregation-log-service';
import { AggregationPipeline } from '@/features/aggregation/pipeline/aggregation-pipeline';
import { evaluateEventEvidenceIdentityGate } from '@/features/import/domain/event-evidence-identity-gate';
import { adminEventToIdentitySnapshot } from '@/features/import/generic-truth-pipeline/evidence-from-canonical';

function extractEmbeddedHtml(
  envelope: import('@/features/aggregation/pipeline/types').PipelineRecordEnvelope,
): string | undefined {
  const raw = envelope.rawPayload;
  if (!raw) return undefined;
  if (typeof raw.html === 'string') return raw.html;
  if (typeof raw.detailHtml === 'string') return raw.detailHtml;
  if (typeof raw.rawHtml === 'string') return raw.rawHtml;
  return undefined;
}
import {
  buildBulkRebuildEvidenceBundle,
  buildTicketPlatformMetadataFromEnvelope,
  enrichCandidateForBulkEvidence,
} from './bulk-evidence-bundle';
import { isWithinBulkHorizon } from './horizon';
import type { SourceEvidenceContribution } from './types';

export interface BulkSourceIngestResult {
  sourceId: string;
  sourceName: string;
  fetchAttempted: boolean;
  fetchSucceeded: boolean;
  parseSucceeded: boolean;
  fetchedEvents: number;
  normalizedEvents: number;
  legacyFallbackSkipped: number;
  reviewOnlyContributions: number;
  errors: string[];
  contributions: SourceEvidenceContribution[];
}

function evaluateContributionIdentity(
  candidate: CanonicalImportEvent,
  bundle: ReturnType<typeof buildBulkRebuildEvidenceBundle>,
  existing?: AdminEventRecord,
): { verdict: SourceEvidenceContribution['identityVerdict']; reason: string } {
  const snapshot = existing
    ? adminEventToIdentitySnapshot(existing)
    : {
        eventId: 'unmapped',
        title: '',
        startDate: candidate.startDate,
        endDate: candidate.endDate,
        venueName: candidate.venueName,
        venueCity: candidate.cityName,
        organizerName: candidate.organizerName,
        ticketUrl: candidate.ticketUrl,
        websiteUrl: candidate.eventUrl,
        sourceId: candidate.sourceId,
      };

  const gate = evaluateEventEvidenceIdentityGate({
    event: snapshot,
    evidence: {
      pageTitle: bundle.identity.pageTitle,
      listRowTitle: bundle.identity.listRowTitle,
      eventDate: bundle.identity.eventDate,
      venueName: bundle.identity.venueName,
    },
    officialEventUrl: candidate.eventUrl,
    verifiedAt: bundle.verifiedAt,
  });

  return { verdict: gate.verdict, reason: gate.reason };
}

function mergeTicketPlatformMetadata(
  candidate: CanonicalImportEvent,
  envelope: import('@/features/aggregation/pipeline/types').PipelineRecordEnvelope,
): CanonicalImportEvent {
  const platformMeta = buildTicketPlatformMetadataFromEnvelope(candidate, envelope);
  if (!platformMeta) return candidate;
  return {
    ...candidate,
    sourceMetadata: {
      ...(candidate.sourceMetadata as Record<string, unknown> | undefined),
      ...platformMeta,
    },
  };
}

export class BulkRebuildSourceIngest {
  private readonly pipeline: AggregationPipeline;

  constructor() {
    this.pipeline = new AggregationPipeline({
      fetchProvider: createSourceConnectorFetchProvider(sourceConnectorRegistry),
      logService: new AggregationLogService(),
    });
  }

  async ingestSource(input: {
    sourceRecord: SourceRecord;
    existingByExternalId: Map<string, AdminEventRecord>;
    horizonStart: string;
    horizonEnd: string;
    triggeredBy?: string;
  }): Promise<BulkSourceIngestResult> {
    const importSource = mapSourceRecordToImportSource(input.sourceRecord);
    const errors: string[] = [];
    const contributions: SourceEvidenceContribution[] = [];
    let fetchAttempted = false;
    let fetchSucceeded = false;
    let parseSucceeded = false;
    let fetchedEvents = 0;
    let legacyFallbackSkipped = 0;
    let reviewOnlyContributions = 0;

    try {
      fetchAttempted = true;
      const pipelineResult = await this.pipeline.run(
        input.sourceRecord,
        importSource,
        'manual',
        input.triggeredBy ?? 'phase4867-bulk-rebuild',
      );
      fetchSucceeded = true;
      parseSucceeded = pipelineResult.records.some((record) => record.canonicalEvent != null);

      for (const envelope of pipelineResult.records) {
        if (!envelope.canonicalEvent) continue;
        let candidate = envelope.canonicalEvent;
        if (!isWithinBulkHorizon(candidate.startDate, input.horizonStart, input.horizonEnd)) {
          continue;
        }
        fetchedEvents += 1;

        candidate = mergeTicketPlatformMetadata(candidate, envelope);
        candidate = enrichCandidateForBulkEvidence(candidate, envelope);
        const bundle = buildBulkRebuildEvidenceBundle(candidate, envelope);

        if (bundle.legacyFallbackUsed && !bundle.sourceNativeEvidence) {
          legacyFallbackSkipped += 1;
          reviewOnlyContributions += 1;
        }

        const existing = input.existingByExternalId.get(envelope.externalId);
        const identity = evaluateContributionIdentity(candidate, bundle, existing);

        if (bundle.criticalIdentitySelfDerived && !existing) {
          reviewOnlyContributions += 1;
        }

        contributions.push({
          sourceId: input.sourceRecord.id,
          sourceName: input.sourceRecord.displayName,
          externalId: envelope.externalId,
          candidate,
          bundle,
          identityVerdict: identity.verdict,
          identityReason: identity.reason,
          verifiedAt: bundle.verifiedAt ?? null,
          mappedEventId: existing?.id,
          mappingMethod: existing ? 'import_record' : 'unmapped',
          embeddedDetailHtml: extractEmbeddedHtml(envelope),
        });
      }
    } catch (error: unknown) {
      errors.push(error instanceof Error ? error.message : 'bulk_source_ingest_failed');
    }

    return {
      sourceId: input.sourceRecord.id,
      sourceName: input.sourceRecord.displayName,
      fetchAttempted,
      fetchSucceeded,
      parseSucceeded,
      fetchedEvents,
      normalizedEvents: contributions.length,
      legacyFallbackSkipped,
      reviewOnlyContributions,
      errors,
      contributions,
    };
  }
}
