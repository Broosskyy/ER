import type { AdminEventRecord, SourceRecord } from '@/data/types/records';

import { runAcceptanceAudit } from './acceptance-runner';
import { acceptanceFixtureEventIds } from './acceptance-fixtures';
import { auditConsumerQuality } from './consumer-quality-audit';
import { buildCleanRebuildAudit } from './clean-rebuild-audit';
import {
  blockedContributionKeysFromTriage,
  contentBlockedContributionKeysFromTriage,
  triageClusterCollisions,
} from './collision-triage';
import { buildCutoverPlan, buildRollbackPlan } from './cutover-plan';
import { buildBulkCutoverManifest, buildBulkCutoverRollback } from './cutover-manifest';
import {
  assessPublishCore,
  buildChangeSet,
  classifyDisposition,
  detectContamination,
  resolveIdPreservation,
} from './disposition';
import {
  buildConsumerProjection,
  rebuiltToAdminShape,
} from './evidence-field-extractor';
import { buildBulkRebuildHorizon } from './horizon';
import {
  buildIdentityClusters,
  contributionsForCluster,
  type IdentityCluster,
} from './identity-graph';
import { runFixtureRebuildAcceptance } from './fixture-rebuild-runner';
import {
  applyDetailEvidenceToBundle,
  applyDetailEvidenceToCandidate,
} from './detail-evidence-integrator';
import { DetailEvidenceService } from './detail-evidence-service';
import {
  collectDetailUrlsFromContribution,
  contributionMatchesEventScope,
} from './detail-url-collector';
import { buildBulkRebuildEvidenceBundle } from './bulk-evidence-bundle';
import { assembleRebuiltCanonicalEvent } from './rebuild-assembler';
import { BulkRebuildSourceIngest, type BulkSourceIngestResult } from './source-ingest';
import type {
  BulkRebuildEventRow,
  BulkRebuildMetrics,
  BulkRebuildPreviewResult,
  SourceEvidenceContribution,
} from './types';

export type DetailFetchScope = 'none' | 'all' | 'references_and_candidates';

export interface BulkRebuildPreviewInput {
  existingEvents: AdminEventRecord[];
  activeSources: SourceRecord[];
  existingByExternalIdBySource: Map<string, Map<string, AdminEventRecord>>;
  manualLocksByEventId: Map<string, string[]>;
  triggeredBy?: string;
  detailFetchFn?: import('./detail-evidence-service').DetailFetchFn;
  enableHttpDetailFetch?: boolean;
  detailFetchScope?: DetailFetchScope;
  referenceEventIds?: string[];
}

function countDisposition(
  rows: BulkRebuildEventRow[],
  disposition: BulkRebuildEventRow['disposition'],
): number {
  return rows.filter((row) => row.disposition === disposition).length;
}

function buildMetrics(
  sourceResults: BulkSourceIngestResult[],
  clusters: IdentityCluster[],
  rows: BulkRebuildEventRow[],
): BulkRebuildMetrics {
  const rawSourceEvents = sourceResults.reduce((sum, result) => sum + result.fetchedEvents, 0);
  const normalized = sourceResults.reduce((sum, result) => sum + result.normalizedEvents, 0);
  const withIdPreservation = rows.filter((row) => row.idPreservation === 'preserve_existing_id').length;
  const withPublishCore = rows.filter((row) => row.rebuilt.publishCoreSecure).length;

  return {
    activeSources: sourceResults.length,
    successfulFetches: sourceResults.filter((r) => r.fetchSucceeded).length,
    fetchErrors: sourceResults.reduce((sum, r) => sum + r.errors.length, 0),
    rawSourceEvents,
    normalizedSourceEvents: normalized,
    identityClusters: clusters.length,
    rebuiltCanonicalEvents: rows.length,
    readyUnchanged: countDisposition(rows, 'ready_unchanged'),
    readyUpdate: countDisposition(rows, 'ready_update'),
    readyNew: countDisposition(rows, 'ready_new'),
    readyPartial: countDisposition(rows, 'ready_partial'),
    reviewIdentity: countDisposition(rows, 'review_identity'),
    reviewCollision: countDisposition(rows, 'review_collision'),
    reviewMissingEvidence: countDisposition(rows, 'review_missing_evidence'),
    reviewCoreMissing: countDisposition(rows, 'review_core_missing'),
    archiveDuplicate: countDisposition(rows, 'archive_duplicate'),
    archiveStale: countDisposition(rows, 'archive_stale'),
    blockedContamination: countDisposition(rows, 'blocked_contamination'),
    consumerFullyReady: rows.filter((row) => row.consumerQuality?.publishable).length,
    consumerPartial: rows.filter((row) => row.consumerQuality?.partial).length,
    consumerNotPublishable: rows.filter(
      (row) => !row.consumerQuality?.publishable && !row.consumerQuality?.partial,
    ).length,
    idPreservationRate: rows.length > 0 ? withIdPreservation / rows.length : 0,
    sourceNativeIdentityCoverage: rows.length > 0 ? withPublishCore / rows.length : 0,
    verifiedAtCoverage:
      rows.length > 0 ? rows.filter((row) => Boolean(row.rebuilt.verifiedAt)).length / rows.length : 0,
    contentCoverage:
      rows.length > 0 ? rows.filter((row) => Boolean(row.rebuilt.description)).length / rows.length : 0,
    genreCoverage:
      rows.length > 0 ? rows.filter((row) => (row.rebuilt.genreLabels?.length ?? 0) > 0).length / rows.length : 0,
    lineupCoverage:
      rows.length > 0
        ? rows.filter((row) => (row.rebuilt.lineupArtistNames?.length ?? 0) > 0).length / rows.length
        : 0,
    ticketCoverage:
      rows.length > 0 ? rows.filter((row) => Boolean(row.rebuilt.ticketUrl)).length / rows.length : 0,
    venueCoverage:
      rows.length > 0 ? rows.filter((row) => Boolean(row.rebuilt.venueName)).length / rows.length : 0,
  };
}

function buildRowFromCluster(
  cluster: IdentityCluster,
  contributions: ReturnType<typeof contributionsForCluster>,
  input: BulkRebuildPreviewInput,
): BulkRebuildEventRow {
  const existing = cluster.eventIdBefore
    ? input.existingEvents.find((event) => event.id === cluster.eventIdBefore)
    : undefined;

  const collisionAssessment = triageClusterCollisions(contributions, existing);
  const ticketBlockedKeys = blockedContributionKeysFromTriage(collisionAssessment);
  const contentBlockedKeys = contentBlockedContributionKeysFromTriage(collisionAssessment);
  const hasCollision =
    cluster.clusterVerdict === 'review_collision' ||
    collisionAssessment.clusterCollision ||
    Boolean(cluster.duplicateProposal);
  const hasContamination = detectContamination(contributions);

  const manualLocks = cluster.eventIdBefore
    ? input.manualLocksByEventId.get(cluster.eventIdBefore) ?? []
    : [];

  const seedId = cluster.eventIdBefore ?? `preview-${cluster.clusterKey}`;
  const rebuilt = assembleRebuiltCanonicalEvent({
    contributions,
    collisionContributionKeys: ticketBlockedKeys,
    contentBlockedContributionKeys: contentBlockedKeys,
    eventId: seedId,
    manualLocks,
  });

  const publishCore = assessPublishCore(rebuilt, contributions);
  rebuilt.publishCoreSecure = publishCore.secure;
  rebuilt.missingOptionalFields = publishCore.missingOptional;
  rebuilt.fieldGroupReadiness = publishCore.fieldGroupReadiness;

  const identityVerdicts = contributions.map((c) => c.identityVerdict);
  const changeSet = buildChangeSet(existing, rebuilt);
  const disposition = classifyDisposition({
    existing,
    rebuilt,
    changeSet,
    hasCollision,
    hasContamination,
    publishCore,
    identityVerdicts,
    manualLocks,
    hasContributions: contributions.length > 0,
  });

  const duplicateClusterIds = cluster.duplicateProposal?.collisionEventIds;
  const idPreservation = resolveIdPreservation({
    existing,
    hasCollision,
    identityVerdicts,
    duplicateClusterIds,
    publishCoreSecure: publishCore.secure,
  });

  const consumerBefore = existing
    ? buildConsumerProjection(existing, rebuilt.lineupArtistNames ?? [])
    : undefined;
  const rebuiltAdmin = rebuiltToAdminShape(rebuilt, {
    id: seedId,
    status: existing?.status,
  });
  const consumerAfter = buildConsumerProjection(rebuiltAdmin, rebuilt.lineupArtistNames ?? []);
  const consumerQuality = auditConsumerQuality(rebuiltAdmin, rebuilt.lineupArtistNames ?? []);

  const reviewReasons: string[] = [];
  if (hasCollision) reviewReasons.push('collision_review_required');
  if (!publishCore.secure) reviewReasons.push('publish_core_missing');
  if (publishCore.missingOptional.length) {
    reviewReasons.push(`missing_optional:${publishCore.missingOptional.join(',')}`);
  }
  if (hasContamination) reviewReasons.push('contamination_detected');
  for (const contribution of contributions) {
    if (contribution.identityVerdict === 'mismatch') {
      reviewReasons.push(`identity_mismatch:${contribution.sourceId}`);
    }
  }

  return {
    eventIdBefore: cluster.eventIdBefore,
    disposition,
    idPreservation,
    existing,
    rebuilt,
    sourceContributions: contributions,
    changeSet,
    consumerBefore,
    consumerAfter,
    consumerQuality,
    collision: (cluster.duplicateProposal ??
      (hasCollision || collisionAssessment.isolatedContributionKeys.length > 0
        ? {
            triage: collisionAssessment.triageByContribution,
            isolatedContributionKeys: collisionAssessment.isolatedContributionKeys,
            reassignmentSuggestions: collisionAssessment.reassignmentSuggestions,
            reasons: collisionAssessment.reasons,
            clusterCollision: collisionAssessment.clusterCollision,
          }
        : undefined)) as Record<string, unknown> | undefined,
    manualLocks,
    duplicateClusterIds,
    reviewReasons,
    rowOrigin: 'identity_cluster',
    clusterId: cluster.clusterKey,
    cleanRebuildAudit: buildCleanRebuildAudit(rebuilt, contributions),
  };
}

function buildAllRows(
  input: BulkRebuildPreviewInput,
  allContributions: SourceEvidenceContribution[],
): { clusters: IdentityCluster[]; rows: BulkRebuildEventRow[] } {
  const clusters = buildIdentityClusters(allContributions, input.existingEvents);
  const clusterRows: BulkRebuildEventRow[] = clusters.map((cluster) =>
    buildRowFromCluster(cluster, contributionsForCluster(cluster, allContributions), input),
  );

  const coveredIds = new Set(clusterRows.map((row) => row.eventIdBefore).filter(Boolean));
  const uncoveredRows: BulkRebuildEventRow[] = [];
  for (const event of input.existingEvents) {
    if (coveredIds.has(event.id)) continue;
    uncoveredRows.push({
      ...buildRowFromCluster(
        {
          clusterKey: `db-only:${event.id}`,
          eventIdBefore: event.id,
          contributionKeys: [],
          clusterVerdict: 'review_identity',
        },
        [],
        input,
      ),
      rowOrigin: 'uncovered_horizon_event',
      clusterId: `db-only:${event.id}`,
    });
  }

  return { clusters, rows: [...clusterRows, ...uncoveredRows] };
}

export class BulkRebuildPreviewRunner {
  private readonly ingest = new BulkRebuildSourceIngest();

  private async enrichContributionsWithDetailEvidence(
    contributions: SourceEvidenceContribution[],
    detailService: DetailEvidenceService,
    options: { allowHttp: boolean; httpEventIds?: Set<string> },
  ): Promise<void> {
    for (const contribution of contributions) {
      const urls = collectDetailUrlsFromContribution(contribution);
      if (urls.length === 0) continue;

      const inHttpScope =
        !options.httpEventIds ||
        options.httpEventIds.size === 0 ||
        contributionMatchesEventScope(contribution, options.httpEventIds);
      const allowHttp = options.allowHttp && inHttpScope;

      if (contribution.embeddedDetailHtml) {
        for (const url of urls) {
          detailService.registerEmbeddedHtml(url, contribution.embeddedDetailHtml);
        }
      }

      let primaryDetail: import('./detail-evidence-types').DetailEvidenceResult | undefined;
      for (const url of urls) {
        const detail = await detailService.resolve(
          {
            sourceId: contribution.sourceId,
            sourceRole: contribution.bundle.sourceRole,
            eventUrl: url,
            sourceExternalId: contribution.externalId,
            expectedIdentity: {
              title: contribution.candidate.title,
              eventDate: contribution.candidate.startDate?.slice(0, 10),
              venueName: contribution.candidate.venueName,
            },
          },
          { allowHttp },
        );

        if (!primaryDetail) {
          primaryDetail = detail;
        }

        if (detail.fetchStatus === 'ok' || detail.fetchStatus === 'pow_challenge') {
          contribution.candidate = applyDetailEvidenceToCandidate(contribution.candidate, detail);
        }
      }

      if (primaryDetail) {
        contribution.detailEvidence = primaryDetail;
      }

      const refreshedBundle = buildBulkRebuildEvidenceBundle(contribution.candidate);
      contribution.bundle =
        primaryDetail && (primaryDetail.fetchStatus === 'ok' || primaryDetail.fetchStatus === 'pow_challenge')
          ? applyDetailEvidenceToBundle(refreshedBundle, primaryDetail)
          : refreshedBundle;
    }
  }

  async run(input: BulkRebuildPreviewInput): Promise<BulkRebuildPreviewResult> {
    const { horizonStart, horizonEnd } = buildBulkRebuildHorizon();
    const sourceResults: BulkSourceIngestResult[] = [];
    const allContributions: SourceEvidenceContribution[] = [];

    for (const source of input.activeSources) {
      const existingByExternalId =
        input.existingByExternalIdBySource.get(source.id) ?? new Map<string, AdminEventRecord>();
      const result = await this.ingest.ingestSource({
        sourceRecord: source,
        existingByExternalId,
        horizonStart,
        horizonEnd,
        triggeredBy: input.triggeredBy,
      });
      sourceResults.push(result);
      allContributions.push(...result.contributions);
    }

    const detailService = new DetailEvidenceService({
      fetchFn: input.enableHttpDetailFetch ? input.detailFetchFn : undefined,
    });

    await this.enrichContributionsWithDetailEvidence(allContributions, detailService, {
      allowHttp: false,
    });

    let { clusters, rows } = buildAllRows(input, allContributions);

    if (input.enableHttpDetailFetch && input.detailFetchFn) {
      const referenceIds = new Set(
        input.referenceEventIds ?? acceptanceFixtureEventIds(),
      );
      const candidateIds = rows
        .filter((row) => row.disposition === 'ready_partial' && row.eventIdBefore)
        .map((row) => row.eventIdBefore as string);
      const scope =
        input.detailFetchScope === 'all'
          ? undefined
          : new Set([...referenceIds, ...candidateIds]);

      await this.enrichContributionsWithDetailEvidence(allContributions, detailService, {
        allowHttp: true,
        httpEventIds: scope,
      });

      ({ clusters, rows } = buildAllRows(input, allContributions));
    }

    const detailFetchMetrics = detailService.getMetrics();
    const horizonEventIds = new Set(input.existingEvents.map((event) => event.id));
    const collisionRows = rows.filter(
      (row) => row.disposition === 'review_collision' || Boolean(row.collision),
    );
    const acceptance = runAcceptanceAudit(rows, collisionRows);
    const fixtureAcceptance = runFixtureRebuildAcceptance().acceptance;
    const metrics = buildMetrics(sourceResults, clusters, rows);

    const sourceCoverage = sourceResults.map((result) => ({
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      fetchAttempted: result.fetchAttempted,
      fetchSucceeded: result.fetchSucceeded,
      parseSucceeded: result.parseSucceeded,
      fetchedEvents: result.fetchedEvents,
      normalizedEvents: result.normalizedEvents,
      legacyFallbackSkipped: result.legacyFallbackSkipped,
      reviewOnlyContributions: result.reviewOnlyContributions,
      errors: result.errors,
    }));

    return {
      phase: '4.8.6.7.3',
      productionMutationsInThisRun: 0,
      rolloutActivated: false,
      horizon: { start: horizonStart, end: horizonEnd },
      metrics,
      sourceCoverage,
      events: rows,
      acceptance: {
        passed: acceptance.passed,
        results: acceptance.results,
        blockingFailures: acceptance.blockingFailures,
        horizonEventCount: horizonEventIds.size,
        clusterCount: clusters.length,
        clusterRowCount: clusters.length,
        uncoveredHorizonEvents: rows.filter((r) => r.rowOrigin === 'uncovered_horizon_event').length,
        fixtureAcceptance: {
          passed: fixtureAcceptance.passed,
          results: fixtureAcceptance.results,
          blockingFailures: fixtureAcceptance.blockingFailures,
        },
        liveAcceptance: {
          passed: acceptance.passed,
          results: acceptance.results,
          blockingFailures: acceptance.blockingFailures,
        },
      },
      detailFetchMetrics,
      cutoverPlan: buildCutoverPlan(rows),
      rollbackPlan: buildRollbackPlan(rows),
      cutoverManifest: buildBulkCutoverManifest(rows),
      cutoverRollback: buildBulkCutoverRollback(rows),
    };
  }
}
