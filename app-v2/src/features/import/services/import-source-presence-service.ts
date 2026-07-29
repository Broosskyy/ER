export const DEFAULT_MISSING_SOURCE_THRESHOLD = 3;

export interface SourcePresenceRecord {
  sourceId: string;
  externalEventId: string;
  canonicalEventId: string;
  consecutiveMissingCount: number;
  lastSeenAt: string;
  missingSince?: string;
  active: boolean;
}

export interface SourcePresenceEvaluation {
  externalEventId: string;
  canonicalEventId: string;
  status: 'seen' | 'missing_once' | 'missing_threshold' | 'review_required';
  consecutiveMissingCount: number;
  shouldArchive: boolean;
  shouldReview: boolean;
}

export class ImportSourcePresenceService {
  constructor(private readonly missingThreshold = DEFAULT_MISSING_SOURCE_THRESHOLD) {}

  markSeen(record: SourcePresenceRecord, seenAt: string): SourcePresenceRecord {
    return {
      ...record,
      consecutiveMissingCount: 0,
      missingSince: undefined,
      lastSeenAt: seenAt,
      active: true,
    };
  }

  markMissing(record: SourcePresenceRecord, missingAt: string): SourcePresenceEvaluation {
    const consecutiveMissingCount = record.consecutiveMissingCount + 1;
    const updated: SourcePresenceRecord = {
      ...record,
      consecutiveMissingCount,
      missingSince: record.missingSince ?? missingAt,
      active: consecutiveMissingCount < this.missingThreshold,
    };

    if (consecutiveMissingCount === 1) {
      return {
        externalEventId: record.externalEventId,
        canonicalEventId: record.canonicalEventId,
        status: 'missing_once',
        consecutiveMissingCount,
        shouldArchive: false,
        shouldReview: false,
      };
    }

    if (consecutiveMissingCount < this.missingThreshold) {
      return {
        externalEventId: record.externalEventId,
        canonicalEventId: record.canonicalEventId,
        status: 'missing_threshold',
        consecutiveMissingCount,
        shouldArchive: false,
        shouldReview: true,
      };
    }

    return {
      externalEventId: record.externalEventId,
      canonicalEventId: record.canonicalEventId,
      status: 'review_required',
      consecutiveMissingCount,
      shouldArchive: true,
      shouldReview: true,
    };
  }

  evaluateMissingFromImport(
    previousExternalIds: string[],
    currentExternalIds: string[],
    recordsByExternalId: Map<string, SourcePresenceRecord>,
    evaluatedAt: string,
  ): SourcePresenceEvaluation[] {
    const current = new Set(currentExternalIds);
    const missing = previousExternalIds.filter((externalId) => !current.has(externalId));
    return missing.map((externalEventId) => {
      const existing = recordsByExternalId.get(externalEventId);
      if (!existing) {
        return {
          externalEventId,
          canonicalEventId: externalEventId,
          status: 'missing_once' as const,
          consecutiveMissingCount: 1,
          shouldArchive: false,
          shouldReview: false,
        };
      }
      return this.markMissing(existing, evaluatedAt);
    });
  }
}

export const importSourcePresenceService = new ImportSourcePresenceService();
