import type { CanonicalImportEvent } from '@/features/aggregation/domain/canonical-import-event';
import { blockingKeyDuplicateCandidateGenerator } from '@/features/aggregation/duplicate/duplicate-candidate-generator';
import type { EventSourceReferenceRepository } from '@/features/aggregation/repositories/multi-source-repositories';
import type { AdminEventRepository } from '@/data/repositories/repositories';
import type { KnownEventForDuplicateCheck, MatchingCatalog } from '@/features/import/matching/match-result';
import type { EventCanonicalIdentityService } from '@/features/events/services/event-canonical-identity-service';
import {
  resolveConfidenceTier,
  resolveMatchConfidenceThresholds,
  resolveMatchDecision,
} from '../domain/matching-config';
import type {
  EventBlockingKeyRepository,
  MultiSourceMatchCandidate,
  MultiSourceMatchContext,
  MultiSourceMatchEvaluation,
} from '../domain/matching-types';
import { MultiSourceMatchScorer } from './multi-source-match-scorer';
import { MatchConflictDetector } from './match-conflict-detector';

function createEvaluationId(): string {
  return `match-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toKnownEvent(
  event: Awaited<ReturnType<AdminEventRepository['getById']>>,
): KnownEventForDuplicateCheck | null {
  if (!event) {
    return null;
  }
  return {
    id: event.id,
    title: event.title,
    startDate: event.startDate,
    externalId: event.id,
    venueId: event.venueId,
    venueName: event.venueName,
    cityId: event.cityId,
    cityName: event.venueCity,
    ticketUrl: event.ticketUrl,
    eventUrl: event.websiteUrl,
  };
}

export interface MultiSourceMatchEngineInput {
  incoming: CanonicalImportEvent;
  sourceId: string;
  externalEventId: string;
  importRecordId?: string;
  importJobId?: string;
  catalog: MatchingCatalog;
  context?: MultiSourceMatchContext;
}

export class MultiSourceMatchEngine {
  constructor(
    private readonly adminEvents: AdminEventRepository,
    private readonly sourceReferences: EventSourceReferenceRepository,
    private readonly blockingKeys: EventBlockingKeyRepository,
    private readonly canonicalIdentity: EventCanonicalIdentityService,
    private readonly scorer: MultiSourceMatchScorer,
    private readonly conflictDetector: MatchConflictDetector,
  ) {}

  async evaluate(input: MultiSourceMatchEngineInput): Promise<MultiSourceMatchEvaluation> {
    const thresholds = resolveMatchConfidenceThresholds();
    const candidates = await this.findCandidates(input);
    const best = candidates.sort((left, right) => right.confidenceScore - left.confidenceScore)[0];
    const now = new Date().toISOString();

    if (!best || best.confidenceScore <= 0) {
      return {
        id: createEvaluationId(),
        importRecordId: input.importRecordId,
        importJobId: input.importJobId,
        sourceId: input.sourceId,
        externalEventId: input.externalEventId,
        confidenceScore: 0,
        confidenceTier: 'uncertain',
        decision: 'keep_separate',
        reasons: ['No cross-source match candidate found.'],
        signals: [],
        fieldDifferences: [],
        involvedSourceIds: [input.sourceId],
        fingerprintSnapshot: this.scorer.buildFingerprintSnapshot(input.incoming),
        createdAt: now,
      };
    }

    const canonicalEvent = await this.adminEvents.getById(best.canonicalEventId);
    const fieldDifferences = canonicalEvent
      ? this.conflictDetector.detect(input.incoming, canonicalEvent)
      : [];

    const confidenceTier = resolveConfidenceTier(best.confidenceScore, thresholds);
    const decision = resolveMatchDecision(best.confidenceScore, thresholds);
    const reasons = [
      `Best candidate ${best.canonicalEventId} scored ${best.confidenceScore}.`,
      `Confidence tier: ${confidenceTier}.`,
      ...best.signals.map((signal) => signal.message),
    ];

    if (fieldDifferences.length > 0 && decision === 'auto_link') {
      reasons.push(`Field differences detected (${fieldDifferences.length}); downgrading to review.`);
    }

    const finalDecision =
      fieldDifferences.some((difference) => difference.severity === 'critical') && decision === 'auto_link'
        ? 'review_required'
        : fieldDifferences.length > 0 && decision === 'auto_link'
          ? 'review_required'
          : decision;

    return {
      id: createEvaluationId(),
      importRecordId: input.importRecordId,
      importJobId: input.importJobId,
      sourceId: input.sourceId,
      externalEventId: input.externalEventId,
      canonicalEventId: best.canonicalEventId,
      confidenceScore: best.confidenceScore,
      confidenceTier,
      decision: finalDecision,
      reasons,
      signals: best.signals,
      fieldDifferences,
      involvedSourceIds: [...new Set([input.sourceId, ...best.involvedSourceIds])],
      fingerprintSnapshot: this.scorer.buildFingerprintSnapshot(input.incoming),
      metadata: {
        blockingKeys: best.blockingKeys,
      },
      createdAt: now,
    };
  }

  private async findCandidates(input: MultiSourceMatchEngineInput): Promise<MultiSourceMatchCandidate[]> {
    const candidateIds = new Set<string>();
    const reasons = new Map<string, { hasSourceReference: boolean; hasFingerprintMatch: boolean; blockingKeys: string[] }>();

    const sourceReference = await this.sourceReferences.findByExternalEventId(
      input.sourceId,
      input.externalEventId,
    );
    if (sourceReference?.canonicalEventId) {
      candidateIds.add(sourceReference.canonicalEventId);
      reasons.set(sourceReference.canonicalEventId, {
        hasSourceReference: true,
        hasFingerprintMatch: false,
        blockingKeys: [],
      });
    }

    const fingerprintMatch = await this.canonicalIdentity.resolveByFingerprint(input.incoming);
    if (fingerprintMatch) {
      candidateIds.add(fingerprintMatch);
      const existing = reasons.get(fingerprintMatch);
      reasons.set(fingerprintMatch, {
        hasSourceReference: existing?.hasSourceReference ?? false,
        hasFingerprintMatch: true,
        blockingKeys: existing?.blockingKeys ?? [],
      });
    }

    if (input.context?.importDuplicateEventId) {
      candidateIds.add(input.context.importDuplicateEventId);
    }

    const blockingCandidate = blockingKeyDuplicateCandidateGenerator.createCandidate(
      'lookup',
      input.incoming,
    );
    const indexedIds = await this.blockingKeys.findCanonicalEventIdsByKeys(blockingCandidate.blockingKeys);
    for (const canonicalEventId of indexedIds) {
      candidateIds.add(canonicalEventId);
      const existing = reasons.get(canonicalEventId);
      reasons.set(canonicalEventId, {
        hasSourceReference: existing?.hasSourceReference ?? false,
        hasFingerprintMatch: existing?.hasFingerprintMatch ?? false,
        blockingKeys: [...new Set([...(existing?.blockingKeys ?? []), ...blockingCandidate.blockingKeys])],
      });
    }

    const catalogCandidates = blockingKeyDuplicateCandidateGenerator.generate(
      input.incoming,
      input.catalog.events.map((event) =>
        blockingKeyDuplicateCandidateGenerator.createCandidate(event.id, {
          ...input.incoming,
          title: event.title,
          startDate: event.startDate,
          venueName: event.venueName,
          cityName: event.cityName,
          externalId: event.externalId ?? event.id,
          eventUrl: event.eventUrl,
          originalLink: event.eventUrl,
          ticketUrl: event.ticketUrl,
          sourceId: input.sourceId,
          sourceName: input.incoming.sourceName,
          rawSourceType: input.incoming.rawSourceType,
        }),
      ),
    );
    for (const candidate of catalogCandidates) {
      candidateIds.add(candidate.canonicalEventId);
    }

    const scored: MultiSourceMatchCandidate[] = [];
    for (const canonicalEventId of candidateIds) {
      const catalogEvent = input.catalog.events.find((event) => event.id === canonicalEventId);
      const adminEvent = catalogEvent ? null : await this.adminEvents.getById(canonicalEventId);
      const knownEvent = catalogEvent ?? toKnownEvent(adminEvent);
      if (!knownEvent) {
        continue;
      }

      const meta = reasons.get(canonicalEventId);
      const score = this.scorer.score({
        incoming: input.incoming,
        candidate: knownEvent,
        matchedVenueId: input.context?.matchedVenueId,
        matchedArtistIds: input.context?.matchedArtistIds,
        hasSourceReference: meta?.hasSourceReference,
        hasFingerprintMatch: meta?.hasFingerprintMatch,
        sharedBlockingKeys: meta?.blockingKeys,
      });

      const references = await this.sourceReferences.findByCanonicalEventId(canonicalEventId);
      scored.push({
        canonicalEventId,
        confidenceScore: score.confidenceScore,
        signals: score.signals,
        blockingKeys: meta?.blockingKeys ?? blockingCandidate.blockingKeys,
        involvedSourceIds: references.map((reference) => reference.sourceId),
      });
    }

    return scored.filter((candidate) => candidate.confidenceScore > 0);
  }
}
