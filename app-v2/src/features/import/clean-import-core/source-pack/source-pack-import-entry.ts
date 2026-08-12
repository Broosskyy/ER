/**
 * Single productive import entry for source packs.
 *
 * Source Connector → SourceEvent validation → Identity/Duplicate → ImportDraft
 * → Review track → Consumer preview → Noop persistence.
 */
import type { SourceRecord } from '@/data/types/records';
import type { RawImportedEvent } from '@/features/aggregation/connectors/types';
import { parseEventCalendarDay } from '@/features/import/matching/matching-utils';

import {
  CleanMultiSourceImportService,
  type CleanImportRunResult,
  type CleanImportSourceCollection,
} from '../clean-multi-source-import-service';
import {
  applyDuplicateUrlReconciliationToDraft,
  reconcileDuplicateUrlClusters,
  reconciledClusterToConnectorOutputs,
  type DuplicateUrlReconciliationResult,
} from '../duplicate-url-reconciliation';
import { buildConsumerPreview, buildFieldPublishPreview } from '../draft-publish-eligibility';
import type { ImportDraft, ReviewTrack } from '../import-draft';
import type { ImportSubmission } from '../import-submission';
import { UnifiedImportDraftService } from '../unified-import-draft-service';
import { BOOTSHAUS_OFFICIAL_SOURCE_ID } from './bootshaus-source-pack';
import { resolveSourceEventFromDraft } from './canonical-to-source-event';
import {
  isConsumerReadySourceEvent,
  validateSourceEvent,
  type SourceEventValidationIssue,
} from './source-event-validation';
import type { SourceEvent } from './source-event';

export interface SourcePackDraftRow {
  clusterId: string;
  title: string;
  localDay: string;
  venueName?: string;
  venueAddress?: string;
  venueCity?: string;
  websiteUrl?: string;
  ticketUrl?: string;
  priceText?: string;
  ticketStatus?: string;
  genreLabels: string[];
  lineupCount: number;
  decision: ReviewTrack | 'quarantine' | 'historical_preserve';
  reviewReason: string;
  sourceEvent?: SourceEvent;
  validationIssues: SourceEventValidationIssue[];
  consumerReady: boolean;
  consumerIssues: string[];
  draft: ImportDraft;
}

export interface SourcePackImportResult {
  cleanResult: CleanImportRunResult;
  reconciliation: DuplicateUrlReconciliationResult;
  rows: SourcePackDraftRow[];
  summary: {
    officialFetchCount: number;
    ticketFetchCount: number;
    upcomingOfficialEvents: number;
    consumerReady: number;
    quickReview: number;
    conflictReview: number;
    quarantine: number;
    historicalPreserve: number;
    databaseWriteOperations: 0;
    productionMutationsInThisRun: 0;
    rolloutActivated: false;
  };
}

class FixedSourceCollection implements CleanImportSourceCollection {
  constructor(
    private readonly sources: SourceRecord[],
    private readonly executor: CleanImportSourceCollection,
  ) {}

  async listActiveSources(): Promise<SourceRecord[]> {
    return [...this.sources].sort((left, right) => left.id.localeCompare(right.id));
  }

  async executeSource(source: SourceRecord): Promise<RawImportedEvent[]> {
    return this.executor.executeSource(source);
  }
}

function isUpcoming(startDate: string | undefined, now: Date): boolean {
  if (!startDate?.trim()) return false;
  const parsed = parseEventCalendarDay(startDate);
  if (!parsed) return false;
  const day = new Date(parsed.year, parsed.month - 1, parsed.day, 23, 59, 59, 999);
  return day.getTime() >= now.getTime();
}

function hasOfficialContribution(
  cluster: DuplicateUrlReconciliationResult['draftInputs'][number],
  officialSourceId: string,
): boolean {
  return cluster.contributions.some(
    (entry) =>
      entry.evidence.sourceId === officialSourceId &&
      entry.evidence.sourceFamily === 'official_website',
  );
}

export async function runSourcePackImport(input: {
  sources: SourceRecord[];
  officialSourceId: string;
  executor: CleanImportSourceCollection;
  now?: Date;
}): Promise<SourcePackImportResult> {
  const now = input.now ?? new Date();
  const collection = new FixedSourceCollection(input.sources, input.executor);
  const cleanResult = await new CleanMultiSourceImportService(collection).run({ now });
  const reconciliation = reconcileDuplicateUrlClusters(cleanResult.clusters);
  const unifiedService = new UnifiedImportDraftService();
  const decisionByCluster = new Map(
    cleanResult.decisions.map((decision) => [decision.clusterId, decision]),
  );

  const rows: SourcePackDraftRow[] = [];
  for (const cluster of reconciliation.draftInputs) {
    if (!hasOfficialContribution(cluster, input.officialSourceId)) continue;

    const originalDecisions = cluster.originalClusterIds
      .map((clusterId) => decisionByCluster.get(clusterId))
      .filter((decision): decision is NonNullable<typeof decision> => Boolean(decision));
    if (
      originalDecisions.length > 0 &&
      originalDecisions.every((decision) => decision.decision === 'historical_preserve')
    ) {
      continue;
    }

    const contributions = [...cluster.contributions].sort((left, right) =>
      [left.evidence.sourceId, left.externalId]
        .join('|')
        .localeCompare([right.evidence.sourceId, right.externalId].join('|')),
    );
    const primary = contributions[0];
    if (!primary) continue;

    const connectorOutputs = reconciledClusterToConnectorOutputs(cluster);
    const submission: ImportSubmission = {
      id: `source-pack:${cluster.clusterId}`,
      kind: 'automatic_source',
      submitter: {
        role: 'system',
        displayName: 'Source Pack Import',
        trustHint: 'official_source',
      },
      submittedAt:
        connectorOutputs.map((output) => output.verifiedAt).find(Boolean) ??
        now.toISOString(),
      sourceId: primary.evidence.sourceId,
      externalId: primary.externalId,
      connectorOutputs,
    };
    const draft = applyDuplicateUrlReconciliationToDraft(
      unifiedService.process(submission).draft,
      cluster,
    );
    const event = draft.proposedCanonicalEvent;
    if (!isUpcoming(event?.startDate, now)) continue;

    const sourceEvent = resolveSourceEventFromDraft(draft);
    const validationIssues = sourceEvent ? validateSourceEvent(sourceEvent) : [];
    const fieldPreview = buildFieldPublishPreview(draft, undefined);
    const consumerPreview = buildConsumerPreview(draft, fieldPreview);
    const consumerIssues = [
      ...validationIssues.map((issue) => issue.code),
      ...consumerPreview.issues,
    ];
    const consumerReady =
      isConsumerReadySourceEvent(sourceEvent ?? {}, validationIssues) &&
      consumerPreview.cardRenderable &&
      consumerIssues.length === 0;

    let decision: SourcePackDraftRow['decision'] = draft.reviewTrack;
    if (draft.reviewTrack === 'conflict_review') {
      decision = 'conflict_review';
    } else if (!consumerReady && draft.reviewTrack === 'auto_ready') {
      decision = 'quick_review';
    } else if (validationIssues.some((issue) => /missing|invalid|quarantine/i.test(issue.code))) {
      decision = 'quarantine';
    }

    rows.push({
      clusterId: cluster.clusterId,
      title: event?.title ?? '',
      localDay: event?.startDate?.slice(0, 10) ?? '',
      venueName: event?.venueName ?? event?.locationText,
      venueAddress: sourceEvent?.venueAddress,
      venueCity: sourceEvent?.venueCity,
      websiteUrl: sourceEvent?.websiteUrl,
      ticketUrl: event?.ticketUrl,
      priceText: event?.admissionPrice?.text,
      ticketStatus: event?.ticketStatus,
      genreLabels: draft.genres.normalizedLabels,
      lineupCount: event?.lineup?.length ?? 0,
      decision,
      reviewReason:
        draft.reviewReasons[0] ??
        (consumerReady ? 'consumer_ready' : consumerIssues[0] ?? 'review_required'),
      sourceEvent,
      validationIssues,
      consumerReady,
      consumerIssues,
      draft,
    });
  }

  rows.sort((left, right) =>
    [left.localDay, left.title].join('|').localeCompare([right.localDay, right.title].join('|')),
  );

  const officialFetch =
    cleanResult.sourceResults.find((entry) => entry.sourceId === input.officialSourceId)
      ?.rawEventCount ?? 0;
  const ticketSource = input.sources.find((source) => source.id !== input.officialSourceId);
  const ticketFetch =
    cleanResult.sourceResults.find((entry) => entry.sourceId === ticketSource?.id)?.rawEventCount ??
    0;

  return {
    cleanResult,
    reconciliation,
    rows,
    summary: {
      officialFetchCount: officialFetch,
      ticketFetchCount: ticketFetch,
      upcomingOfficialEvents: rows.length,
      consumerReady: rows.filter((row) => row.consumerReady).length,
      quickReview: rows.filter((row) => row.decision === 'quick_review').length,
      conflictReview: rows.filter((row) => row.decision === 'conflict_review').length,
      quarantine: rows.filter((row) => row.decision === 'quarantine').length,
      historicalPreserve: cleanResult.decisions.filter(
        (decision) => decision.decision === 'historical_preserve',
      ).length,
      databaseWriteOperations: 0,
      productionMutationsInThisRun: 0,
      rolloutActivated: false,
    },
  };
}

export { BOOTSHAUS_OFFICIAL_SOURCE_ID };
